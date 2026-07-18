#!/bin/bash
# log.sh - mostra i log dei container in tempo reale

echo "Mostrando log di tutti i servizi (CTRL+C per uscire)..."

SERVICE=$1
if [ -z "$SERVICE" ]; then
  docker compose logs -f
else
  docker compose logs -f $SERVICE
fi