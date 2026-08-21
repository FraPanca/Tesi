#!/usr/bin/env bash
# Backup giornaliero di MongoDB (dump completo, "archive" mongodump) verso l'hard disk esterno.
# Serie progressiva di dump datati con rotazione automatica dei dump più vecchi di RETENTION_DAYS.

set -euo pipefail
 
REPO_DIR="/home/francesco/iot"
BACKUP_DIR="/mnt/wd1tb/iot-energy/backups/mongodb"
RETENTION_DAYS=7
ENV_FILE="${REPO_DIR}/.env"
 
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_FILE="${BACKUP_DIR}/iot_energy-${TIMESTAMP}.archive.gz"
 
mkdir -p "$BACKUP_DIR"
 
mongo_user_line="$(grep -E '^MONGO_ROOT_USER=' "$ENV_FILE" | tail -n1)"
mongo_pass_line="$(grep -E '^MONGO_ROOT_PASSWORD=' "$ENV_FILE" | tail -n1)"
MONGO_ROOT_USER="${mongo_user_line#MONGO_ROOT_USER=}"
MONGO_ROOT_PASSWORD="${mongo_pass_line#MONGO_ROOT_PASSWORD=}"
 
if [[ -z "$MONGO_ROOT_USER" || -z "$MONGO_ROOT_PASSWORD" ]]; then
  echo "Errore: MONGO_ROOT_USER/MONGO_ROOT_PASSWORD non trovate in ${ENV_FILE}" >&2
  exit 1
fi
 
cd "$REPO_DIR"
 
docker compose exec -T mongodb mongodump \
  --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db iot_energy \
  --archive --gzip > "$ARCHIVE_FILE"
 
echo "Backup completato: ${ARCHIVE_FILE} ($(du -h "$ARCHIVE_FILE" | cut -f1))"
 
# Rotazione: rimuove i dump più vecchi di RETENTION_DAYS giorni.
find "$BACKUP_DIR" -name 'iot_energy-*.archive.gz' -mtime +"$RETENTION_DAYS" -print -delete
