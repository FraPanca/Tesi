#!/bin/bash
# start.sh - avvia il progetto completo con Docker Compose

echo "Avvio build dei container..."
docker compose build

echo "Avvio dei container in background..."
docker compose up -d

echo ""
echo "Tutti i container sono stati avviati:"
docker compose ps

echo ""
echo "Frontend accessibile su: http://localhost"
echo "Backend REST accessibile su: http://localhost:3000/api"
echo "WebSocket backend su: ws://localhost:3000/socket.io/"
echo "MQTT broker su: localhost:1883"

echo ""
echo "Usa 'log.sh [<servizio>]' per vedere i log"