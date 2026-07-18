import os
from dotenv import load_dotenv


# PATHS
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DOTENV_PATH = os.path.join(BASE_DIR, "config", ".env")
load_dotenv(DOTENV_PATH)

DEVICES_FILE = os.path.join(BASE_DIR, "config", "devices.json")

LOG_DIR = os.path.join(BASE_DIR, "logs")


# TAPO
USERNAME = os.getenv("TAPO_USERNAME")
PASSWORD = os.getenv("TAPO_PASSWORD")

# INTERVALS
POLLING_INTERVAL = int(os.getenv("POLLING_INTERVAL", 10))
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", 30))
WARNING_INTERVAL = int(os.getenv("WARNING_INTERVAL", 5))

BACKOFF_TIME = int(os.getenv("BACKOFF_TIME", 60))

# MQTT
MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")