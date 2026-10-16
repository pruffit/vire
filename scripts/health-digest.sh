#!/usr/bin/env bash
# Ежедневная сводка здоровья прода в Telegram (через ALERT_WEBHOOK_URL). Cron на сервере:
#   0 6 * * *  cd /opt/vire && ./scripts/health-digest.sh >> /opt/vire/health-digest.log 2>&1
#
# Алерты ловят ошибки, сводка — медленный рост (так копилась авария 12.10.2026).
# DRY=1 — напечатать сводку и ничего не отправлять.
set -uo pipefail

cd "$(dirname "$0")/.."

envval() { grep -m1 "^$1=" .env | cut -d= -f2- | tr -d '\r' | sed -E "s/^['\"](.*)['\"]$/\1/"; }
WEBHOOK=$(envval ALERT_WEBHOOK_URL)
DOMAIN=$(envval DOMAIN)
PGUSER=$(envval POSTGRES_USER)
PGDB=$(envval POSTGRES_DB)

warn=()
flag() { warn+=("$1"); }
num() { [[ "$1" =~ ^[0-9]+([.][0-9]+)?$ ]]; }

health=$(curl -s -m 20 "https://${DOMAIN}/api/health" || true)
version=$(echo "$health" | jq -r '.version // "?"' 2>/dev/null || echo '?')
status=$(echo "$health" | jq -r '.status // "нет ответа"' 2>/dev/null || echo 'нет ответа')
[ "$status" = "ok" ] || flag "health: ${status}"

load=$(cut -d' ' -f1-3 /proc/loadavg)
mem_avail=$(free -m | awk '/^Mem:/{print $7}')
swap_used=$(free -m | awk '/^Swap:/{print $3}')
disk_pct=$(df -P / | awk 'NR==2{gsub("%","",$5); print $5}')
io_avg=$(awk -F'avg300=' '/^some/{split($2,a," "); print a[1]}' /proc/pressure/io 2>/dev/null)
num "$mem_avail" && [ "$mem_avail" -lt 250 ] && flag "память: свободно ${mem_avail} МБ"
num "$disk_pct" && [ "$disk_pct" -gt 80 ] && flag "диск: ${disk_pct}%"
num "$io_avg" && awk "BEGIN{exit !($io_avg > 10)}" && flag "давление ввода-вывода ${io_avg}% (5 мин)"

R="docker exec vire-redis-1 redis-cli"
redis_keys=$($R dbsize 2>/dev/null || echo '?')
redis_mem=$($R info memory 2>/dev/null | awk -F: '/^used_memory_human/{print $2}' | tr -d '\r')
redis_save=$($R info persistence 2>/dev/null | awk -F: '/^rdb_last_bgsave_time_sec/{print $2}' | tr -d '\r')
dump_mb=$(docker exec vire-redis-1 sh -c 'du -m /data/dump.rdb 2>/dev/null | cut -f1' || echo '?')
failed=0
for key in $($R --scan --pattern 'bull:*:failed' 2>/dev/null); do
  failed=$((failed + $($R zcard "$key" 2>/dev/null || echo 0)))
done
[[ "$redis_keys" =~ ^[0-9]+$ ]] && [ "$redis_keys" -gt 20000 ] && flag "Redis: ${redis_keys} ключей"
[[ "$dump_mb" =~ ^[0-9]+$ ]] && [ "$dump_mb" -gt 20 ] && flag "снапшот Redis ${dump_mb} МБ"

# RestartCount живёт до пересоздания контейнера, поэтому флаг — по приросту с прошлого прогона.
STATE=.health-digest.state
touch "$STATE"
restarts=$(docker ps -a --filter name=vire- --format '{{.Names}}' | while read -r c; do
  [ "$c" = "vire-minio-init-1" ] && continue
  id=$(docker inspect -f '{{.Id}}' "$c"); n=$(docker inspect -f '{{.RestartCount}}' "$c")
  s=$(docker inspect -f '{{.State.Status}}' "$c")
  prev=$(awk -v id="$id" '$1==id{print $2}' "$STATE"); prev=${prev:-0}
  [ "$s" != "running" ] && echo "${c#vire-}:${s}"
  [ "$n" -gt "$prev" ] && echo "${c#vire-}:+$((n - prev)) перезапуск"
done | paste -sd' ' -)
docker ps -aq --no-trunc --filter name=vire- | while read -r id; do
  echo "$id $(docker inspect -f '{{.RestartCount}}' "$id")"
done > "$STATE"
[ -n "$restarts" ] && flag "контейнеры: ${restarts}"

sql() { docker exec vire-postgres-1 psql -U "$PGUSER" -d "$PGDB" -At -c "$1" 2>/dev/null || echo '?'; }
db_size=$(sql "select pg_size_pretty(pg_database_size(current_database()))")
users_new=$(sql "select count(*) from users where created_at > now() - interval '1 day'")
users_all=$(sql "select count(*) from users")
plays=$(sql "select count(*) from play_events where started_at > now() - interval '1 day'")

head="🟢 Прод: всё в порядке"
[ ${#warn[@]} -gt 0 ] && head="🟡 Прод: обратить внимание — $(IFS=';'; echo "${warn[*]}")"

text="${head}
Версия ${version} · load ${load}
Память свободно ${mem_avail} МБ · swap ${swap_used} МБ · диск ${disk_pct}% · ввод-вывод ${io_avg}%
Redis ${redis_keys} ключей, ${redis_mem}, снапшот ${dump_mb} МБ за ${redis_save} с · упавших задач ${failed}
Postgres ${db_size}
За сутки: новых пользователей ${users_new} (всего ${users_all}), прослушиваний ${plays}"

if [ "${DRY:-0}" = "1" ]; then
  echo "$text"
  exit 0
fi
if [ -z "$WEBHOOK" ]; then
  echo "health-digest: в .env нет ALERT_WEBHOOK_URL, сводка не отправлена" >&2
  echo "$text"
  exit 1
fi
body=$(jq -n --arg t "$text" '{text: $t}')
for attempt in 1 2 3; do
  code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data "$body" "$WEBHOOK")
  [ "$code" = "200" ] && { echo "$(date -u +%FT%TZ) sent"; exit 0; }
  sleep $((attempt * 20))
done
echo "$(date -u +%FT%TZ) health-digest: relay ответил ${code} после трёх попыток" >&2
exit 1
