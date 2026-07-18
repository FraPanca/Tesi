import json
import os

from config import LOG_DIR


def log_energy(device_alias, message):
    log_file_path = os.path.join(LOG_DIR, f"{device_alias}.log")
    with open(log_file_path, "a") as log_file:
        log_file.write(json.dumps(message) + "\n")


def log_warning(message):
    log_file_path = os.path.join(LOG_DIR, "warning.log")
    with open(log_file_path, "a") as log_file:
        log_file.write(json.dumps({"Warning": message}) + "\n")


def log_error(message):
    log_file_path = os.path.join(LOG_DIR, "error.log")
    with open(log_file_path, "a") as log_file:
        log_file.write(json.dumps({"Error": message}) + "\n")