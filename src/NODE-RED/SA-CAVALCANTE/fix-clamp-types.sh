#!/usr/bin/env bash
# Usage:
#   ./fix_clamp_type.sh            # dry run (default): shows what would change
#   ./fix_clamp_type.sh --apply    # actually performs the UPDATE
set -u

MODE="dry-run"
if [[ "${1:-}" == "--apply" ]]; then
  MODE="apply"
fi

read -r -d '' DRY_RUN_SQL <<'SQL'
SELECT id, name,
       clamp_type AS current_clamp_type,
       (config->'config_clamp'->>'value')::int AS new_clamp_type
FROM slaves
WHERE type = 'three_phase_sensor'
  AND config->'config_clamp'->>'value' IS NOT NULL
  AND (config->'config_clamp'->>'value')::int <> clamp_type
ORDER BY id;
SQL

read -r -d '' APPLY_SQL <<'SQL'
BEGIN;
UPDATE slaves
SET clamp_type = (config->'config_clamp'->>'value')::int
WHERE type = 'three_phase_sensor'
  AND config->'config_clamp'->>'value' IS NOT NULL
  AND (config->'config_clamp'->>'value')::int <> clamp_type
RETURNING id, name, clamp_type AS new_clamp_type;
ROLLBACK;
SQL

if [[ "$MODE" == "apply" ]]; then
  QUERY="$APPLY_SQL"
else
  QUERY="$DRY_RUN_SQL"
fi

GATEWAYS=(
  "L0/L1 Mestre Alvaro|200:ba5f:dacb:b278:8f85:acf4:f33c:f485"
  "L3/L4 Mestre Alvaro|200:b0b1:81aa:49a4:c554:4fec:f110:9896"
  "L2/AC Mestre Alvaro|200:8b:483c:9008:1184:caec:41b1:fa28"
  "Moxuara|202:1567:faee:79ef:486:6d44:d391:fb18"
  "MontSerrat|200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc"
  "Metropole|201:ca6e:c33b:3a06:f4dd:d148:5d85:6315"
  "Rio Poty|203:bdfb:8fda:634d:c846:1404:f319:718c"
  "Shopping da Ilha|201:3447:911:5955:4018:3960:6838:ee12"
)

SSH_OPTS=(
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -o LogLevel=ERROR
)

echo "### MODE: $MODE ###"
echo

for entry in "${GATEWAYS[@]}"; do
  name="${entry%%|*}"
  host="${entry##*|}"
  echo "===== $name ($host) ====="
  ssh "${SSH_OPTS[@]}" "root@$host" \
    "psql -Uhubot -d hubot -c \"$QUERY\"" \
    || echo "!! failed on $name"
  echo
done