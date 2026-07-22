#!/usr/bin/env bash
# Script di avvio/arresto "soft" dell'intero sistema IoT Energy Monitor.

set -euo pipefail

usage() {
  echo "Uso: $0 {start|stop|restart|status}"
  exit 1
}

[ $# -eq 1 ] || usage

case "$1" in
  start)
    echo "Avvio stack Docker..."
    sudo systemctl start iot-energy-docker.service
    echo "Avvio gateway..."
    sudo systemctl start iot-energy-gateway.service
    ;;
  stop)
    echo "Arresto gateway..."
    sudo systemctl stop iot-energy-gateway.service
    echo "Arresto stack Docker..."
    sudo systemctl stop iot-energy-docker.service
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  status)
    systemctl status iot-energy-docker.service --no-pager || true
    systemctl status iot-energy-gateway.service --no-pager || true
    ;;
  *)
    usage
    ;;
esac