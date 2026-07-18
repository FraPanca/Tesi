#!/bin/bash
# stop.sh - ferma tutti i container del progetto

echo "Stop dei container..."
docker compose down

echo "Container arrestati. I volumi persistenti (MongoDB, Redis) non sono stati rimossi."