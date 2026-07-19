import asyncio
from config import CHECK_INTERVAL

from registry.device_registry import load_devices
from .device_monitor import monitor_device


active_tasks = {}
device_commands = {}

async def readData():

    while True:
        devices_list = load_devices()
        devices_by_ip = {d["ip"]: d for d in devices_list}

        current_ips = set(devices_by_ip.keys())
        monitored_ips = set(active_tasks.keys())


        # Adding devices
        for ip in current_ips - monitored_ips:
            device_id = devices_by_ip[ip].get("id", ip)

            stop_event = asyncio.Event()
            command_queue = asyncio.Queue()

            task = asyncio.create_task(monitor_device(ip, device_id, stop_event, command_queue))

            active_tasks[ip] = (task, stop_event)
            device_commands[ip] = command_queue

            print(f"SYSTEM =>\tStarted monitoring for {device_id} ({ip})")


        # Removing devices
        for ip in monitored_ips - current_ips:
            task, stop_event = active_tasks[ip]

            stop_event.set()
            task.cancel()

            del active_tasks[ip]
            del device_commands[ip]

            print(f"SYSTEM =>\tStopped monitoring for {ip}")

        await asyncio.sleep(CHECK_INTERVAL)


def send_command(ip, command):

    if ip in device_commands:
        device_commands[ip].put_nowait(command)
        print(f"SYSTEM =>\tCommand '{command}' sent to {ip}")
    else:
        print(f"ERROR =>\tDevice {ip} not currently monitored")