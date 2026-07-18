import asyncio

from devices.device_manager import readData
from mqtt import mqtt_publisher, mqtt_subscriber


if __name__ == "__main__":
    try:
        mqtt_publisher.start()
        mqtt_subscriber.start()
        asyncio.run(readData())
    finally:
        mqtt_publisher.shutdown()
        mqtt_subscriber.stop()