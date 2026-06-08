#!/usr/bin/env bash
#
# Deleta (DELETE) pontos de timeseries de uma key num device do ThingsBoard,
# numa janela [startTs, endTs].
#
# Uso:
#   ./delete-telemetry.sh [DEVICE_ID] [KEYS] [START_TS] [END_TS]
#
# Sem argumentos, reproduz o exemplo:
#   device   e8831fb0-9ddf-11ef-88ea-9f32e7332750
#   keys     startupTime
#   startTs  1779369218409
#   endTs    1779369218411   (janela de 2 ms)
#
# Flags (sobrescreva via env se precisar):
#   DELETE_ALL_DATA_FOR_KEYS  (default false) — true apaga TODA a série da key
#   DELETE_LATEST             (default true)
#   REWRITE_LATEST_IF_DELETED (default true)
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tb.env
source "$DIR/tb.env"

DEVICE_ID="${1:-e8831fb0-9ddf-11ef-88ea-9f32e7332750}"
KEYS="${2:-startupTime}"
START_TS="${3:-1779369218409}"
END_TS="${4:-1779369218411}"

DELETE_ALL="${DELETE_ALL_DATA_FOR_KEYS:-false}"
DELETE_LATEST="${DELETE_LATEST:-true}"
REWRITE_LATEST="${REWRITE_LATEST_IF_DELETED:-true}"

if [ -z "${TB_TOKEN:-}" ]; then
  echo "ERRO: TB_TOKEN vazio. Preencha em $DIR/tb.env" >&2
  exit 1
fi

URL="${TB_HOST}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/timeseries/delete"
URL="${URL}?keys=${KEYS}&deleteAllDataForKeys=${DELETE_ALL}&startTs=${START_TS}&endTs=${END_TS}"
URL="${URL}&deleteLatest=${DELETE_LATEST}&rewriteLatestIfDeleted=${REWRITE_LATEST}"

echo "DELETE  ${URL}"
echo

curl -sS -X DELETE "$URL" \
  -H "X-Authorization: Bearer ${TB_TOKEN}" \
  -w "\nHTTP %{http_code}\n"
