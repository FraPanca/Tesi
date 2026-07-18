import asyncio

from devices.device_manager import readData
from mqtt.mqtt_subscriber import start as mqtt_start
from mqtt.mqtt_publisher import shutdown


if __name__ == "__main__":
    try:
        mqtt_start()
        asyncio.run(readData())
    finally:
        shutdown()