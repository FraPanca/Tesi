import asyncio
import json
import time
import warnings
from kasa import Discover
from kasa.module import Module

from config import USERNAME, PASSWORD, POLLING_INTERVAL, WARNING_INTERVAL, BACKOFF_TIME
from mqtt.mqtt_publisher import publish
from logger.energy_logger import *

warnings.filterwarnings("ignore", category=DeprecationWarning)


async def monitor_device(ip, device_id, stop_event, command_queue):

    retry_delay = 1
    fail_count = 0

    while not stop_event.is_set():

        try:
            device = await Discover.discover_single(ip, username=USERNAME, password=PASSWORD)
            await device.update()

            print(f"SYSTEM =>\tConnected to: {device_id} - {device.alias} ({ip})")

            # reset backoff after successful connection
            retry_delay = 1
            fail_count = 0

            energy = device.modules[Module.Energy]

            while not stop_event.is_set():
                try:
                    command = command_queue.get_nowait()

                    if command == "on":
                        await device.turn_on()
                    elif command == "off":
                        await device.turn_off()

                    print(f"SYSTEM =>\t{device_id} command executed: {command}")

                except asyncio.QueueEmpty:
                    pass


                await device.update()
                realtime = energy.realtime

                data = {
                    "deviceId": device_id,
                    "timestamp": time.time(),
                    "power": realtime.power,
                    "voltage": realtime.voltage,
                    "current": realtime.current,
                }

                publish(f"home/{device_id}/raw", json.dumps(data))

                print(
                    f"DEVICE: {device_id} =>\n\t\t"
                    f"Power: {data['power']:.2f} W | "
                    f"Voltage: {data['voltage']:.2f} V | "
                    f"Current: {data['current']:.3f} A"
                )

                log_energy(device_id, data)

                await asyncio.sleep(POLLING_INTERVAL)

            await device.disconnect()

        except asyncio.CancelledError:
            print(f"ERROR =>\t{device_id} ({ip}) has been canceled")
            raise

        except Exception as e:

            if retry_delay == BACKOFF_TIME:
                fail_count += 1

            print(f"ERROR =>\tUnable to connect to {device_id} ({ip}): {e}")
            log_error(f"Unable to connect to {device_id} ({ip}): {e}")

            if fail_count != 0 and fail_count % WARNING_INTERVAL == 0:
                print(f"WARNING =>\t{device_id} ({ip}) has failed {fail_count} consecutive times, retrying...")
                log_warning(f"Failed connection to {device_id} ({ip}) {fail_count} consecutive times")

            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, BACKOFF_TIME)