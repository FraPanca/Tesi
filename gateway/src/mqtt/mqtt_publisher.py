import paho.mqtt.client as mqtt

from config import MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASSWORD


mqtt_client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION1)

if MQTT_USER:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

def start():
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT)
    mqtt_client.loop_start()


def publish(topic, payload):
    mqtt_client.publish(topic, payload)


def shutdown():
    mqtt_client.loop_stop()
    mqtt_client.disconnect()