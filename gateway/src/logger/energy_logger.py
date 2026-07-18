import json
import logging
import os
from logging.handlers import RotatingFileHandler

from config import LOG_DIR, LOG_MAX_BYTES, LOG_BACKUP_COUNT

_loggers = {}


def _get_logger(name):
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(f"energy.{name}")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    handler = RotatingFileHandler(
        os.path.join(LOG_DIR, f"{name}.log"),
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

    _loggers[name] = logger
    return logger


def log_energy(device_alias, message):
    _get_logger(device_alias).info(json.dumps(message))


def log_warning(message):
    _get_logger("warning").warning(json.dumps({"Warning": message}))


def log_error(message):
    _get_logger("error").error(json.dumps({"Error": message}))