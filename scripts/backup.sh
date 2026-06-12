#!/usr/bin/env bash
# Бэкап Vire → внешний S3. Запуск по cron на сервере, напр.:
#   0 4 * * *  cd /opt/vire && ./scripts/backup.sh >> /var/log/vire-backup.log 2>&1
#
# Кладёт: дамп Postgres (gzip, с датой) + зеркало vault-bucket (исходные FLAC).
# Переменные BACKUP_S3_* — в .env (внешний холодный S3: Timeweb S3 / Backblaze B2).
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date +%F_%H%M)"

if [[ -z "${BACKUP_S3_ENDPOINT:-}" || -z "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "BACKUP_S3_* не заданы в .env — бэкап пропущен"; exit 1
fi

echo "[$(date -Is)] Дамп Postgres…"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "/tmp/vire-db-${STAMP}.sql.gz"

# mc-контейнер с доступом к сети compose и к /tmp с дампом
MC="docker run --rm --network=vire_default \
  -v /tmp:/tmp \
  -e BACKUP_S3_ENDPOINT -e BACKUP_S3_ACCESS_KEY -e BACKUP_S3_SECRET_KEY \
  -e S3_ACCESS_KEY -e S3_SECRET_KEY \
  --entrypoint sh minio/mc:latest -c"

# Сколько дней хранить дампы Postgres (vault зеркалится, не накапливает версии)
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo "[$(date -Is)] Загрузка дампа + зеркало vault…"
$MC "
  set -e
  mc alias set backup \"\$BACKUP_S3_ENDPOINT\" \"\$BACKUP_S3_ACCESS_KEY\" \"\$BACKUP_S3_SECRET_KEY\"
  mc alias set local http://minio:9000 \"\$S3_ACCESS_KEY\" \"\$S3_SECRET_KEY\"
  mc cp /tmp/vire-db-${STAMP}.sql.gz backup/${BACKUP_S3_BUCKET}/db/
  mc mirror --overwrite --remove local/${S3_BUCKET_VAULT} backup/${BACKUP_S3_BUCKET}/vault
  echo 'Чистка дампов старше ${BACKUP_RETENTION_DAYS}д…'
  mc rm --recursive --force --older-than ${BACKUP_RETENTION_DAYS}d backup/${BACKUP_S3_BUCKET}/db/ || true
"

rm -f "/tmp/vire-db-${STAMP}.sql.gz"
echo "[$(date -Is)] Бэкап готов: db/vire-db-${STAMP}.sql.gz + vault/"
