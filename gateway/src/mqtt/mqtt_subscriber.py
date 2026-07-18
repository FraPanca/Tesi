import json
import paho.mqtt.client as mqtt

from config import MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASSWORD
from devices.device_manager import send_command
from registry.device_registry import add_device, remove_device


mqtt_client = mqtt.Client()

if MQTT_USER:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)


def on_connect(client, userdata, flags, rc):
    print("SYSTEM =>\tMQTT connected")
    client.subscribe("home/+/commands")


def on_message(client, userdata, msg):
    topic = msg.topic
    payload = json.loads(msg.payload.decode())

    parts = topic.split("/")
    device = parts[1]
    action = payload.get("action")

    print("SYSTEM =>\tReceived MQTT command: ", topic, payload)

    if device == "system":
        if action == "add":
            add_device(payload["ip"])
        elif action == "remove":
            remove_device(payload["ip"])
    else:
        if action in ["on", "off"]:
            ip = payload.get("ip")
            send_command(ip, action)


mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

mqtt_client.connect(MQTT_BROKER, MQTT_PORT)


def start():
    mqtt_client.loop_start()


def stop():
    mqtt_client.loop_stop()
    mqtt_client.disconnect()