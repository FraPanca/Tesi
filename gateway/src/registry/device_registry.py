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


def _next_id(devices):
    """Genera il prossimo id libero nel formato presaN."""
    existing_numbers = set()
    for d in devices:
        device_id = d.get("id", "")
        if device_id.startswith("presa") and device_id[5:].isdigit():
            existing_numbers.add(int(device_id[5:]))

    n = 1
    while n in existing_numbers:
        n += 1
    return f"presa{n}"


def add_device(ip, device_id=None):
    devices = load_devices()

    if any(d["ip"] == ip for d in devices):
        return

    if device_id is None:
        device_id = _next_id(devices)
    elif any(d.get("id") == device_id for d in devices):
        raise ValueError(f"id '{device_id}' già in uso")

    devices.append({"ip": ip, "id": device_id})
    save_devices(devices)


def remove_device(ip):
    devices = load_devices()
    devices = [d for d in devices if d["ip"] != ip]
    save_devices(devices)