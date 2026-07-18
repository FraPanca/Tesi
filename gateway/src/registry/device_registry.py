import json

from config import DEVICES_FILE


def load_devices():
    try:
        with open(DEVICES_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []
    

def save_devices(devices):
    with open(DEVICES_FILE, "w") as f:
        json.dump(devices, f, indent=2)


def add_device(ip):
    devices = load_devices()

    if not any(d["ip"] == ip for d in devices):
        devices.append({"ip": ip})
        save_devices(devices)


def remove_device(ip):
    devices = load_devices()
    devices = [d for d in devices if d["ip"] != ip]
    save_devices(devices)