#!/usr/bin/env bash
#
# Insere (POST) um ponto de timeseries num device do ThingsBoard, com timestamp customizado.
#
# Uso:
#   ./insert-telemetry.sh [DEVICE_ID] [KEY] [VALUE] [TS_MS]
#
# Sem argumentos, repõe o ponto deletado:
#   device  e8831fb0-9ddf-11ef-88ea-9f32e7332750
#   key     startupTime
#   value   42552900
#   ts      1779369218409  → 2026-05-21T13:13:38.409Z (mesmo ts do delete)
#
# Dica p/ converter data → epoch ms:
#   node -e 'console.log(Date.parse("2026-05-21T13:13:38Z"))'        # como UTC
#   node -e 'console.log(Date.parse("2026-05-21T13:13:38-03:00"))'   # como BR (UTC-3)
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tb.env
source "$DIR/tb.env"

DEVICE_ID="${1:-e8831fb0-9ddf-11ef-88ea-9f32e7332750}"
KEY="${2:-startupTime}"
VALUE="${3:-42552900}"
TS_MS="${4:-1779369218409}"

if [ -z "${TB_TOKEN:-}" ]; then
  echo "ERRO: TB_TOKEN vazio. Preencha em $DIR/tb.env" >&2
  exit 1
fi

URL="${TB_HOST}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/timeseries/ANY"
BODY="{\"ts\": ${TS_MS}, \"values\": {\"${KEY}\": ${VALUE}}}"

echo "POST  ${URL}"
echo "BODY  ${BODY}"
echo

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: Bearer ${TB_TOKEN}" \
  -d "$BODY" \
  -w "\nHTTP %{http_code}\n"
