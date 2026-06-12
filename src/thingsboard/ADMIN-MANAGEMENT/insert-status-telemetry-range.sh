#!/usr/bin/env bash
#
# Insere (POST) MÚLTIPLOS pontos de timeseries de teste num device do ThingsBoard,
# com timestamps aleatórios distribuídos por dia.
#
# Cenário padrão (dados de teste):
#   device  2d930c50-5f9a-11f1-b98b-230c8cf30ada
#   key     status
#   value   "on"   (string)
#   janela  04/06/2026 00:00  →  09/06/2026 12:00  (horário BR, UTC-3)
#   volume  de 5 a 10 acionamentos aleatórios POR DIA (último dia até 12:00)
#
# Uso:
#   ./insert-status-telemetry-range.sh                 # roda com os padrões acima
#   DRY_RUN=1 ./insert-status-telemetry-range.sh       # só imprime os POSTs, sem enviar
#   ./insert-status-telemetry-range.sh DEVICE_ID KEY VALUE
#
# Override por env:
#   MIN_PER_DAY (default 5)  MAX_PER_DAY (default 10)
#   TZ_OFFSET   (default -03:00)
#   SLEEP_MS    (default 120)  pausa entre POSTs
#
# Dica p/ converter data → epoch ms:
#   node -e 'console.log(Date.parse("2026-06-04T00:00:00-03:00"))'
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tb.env
source "$DIR/tb.env"

DEVICE_ID="${1:-2d930c50-5f9a-11f1-b98b-230c8cf30ada}"
KEY="${2:-status}"
VALUE="${3:-on}"          # string; enviada como "on" no JSON

TZ_OFFSET="${TZ_OFFSET:--03:00}"
MIN_PER_DAY="${MIN_PER_DAY:-5}"
MAX_PER_DAY="${MAX_PER_DAY:-10}"
SLEEP_MS="${SLEEP_MS:-120}"
DRY_RUN="${DRY_RUN:-0}"

# Janela: dias completos + último dia parcial (até 12:00).
# Formato por linha: YYYY-MM-DD HORA_INICIAL HORA_FINAL(exclusiva)
DAYS=$(cat <<EOF
2026-06-04 0 24
2026-06-05 0 24
2026-06-06 0 24
2026-06-07 0 24
2026-06-08 0 24
2026-06-09 0 12
EOF
)

if [ -z "${TB_TOKEN:-}" ]; then
  echo "ERRO: TB_TOKEN vazio. Preencha em $DIR/tb.env" >&2
  exit 1
fi

URL="${TB_HOST}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/timeseries/ANY"

echo "Device : ${DEVICE_ID}"
echo "Key    : ${KEY} = alterna \"on\" / \"off\" por ponto"
echo "Janela : 2026-06-04 00:00 → 2026-06-09 12:00 (${TZ_OFFSET})"
echo "Volume : ${MIN_PER_DAY}-${MAX_PER_DAY} acionamentos/dia (aleatório)"
echo "URL    : ${URL}"
[ "$DRY_RUN" = "1" ] && echo ">>> DRY_RUN: nenhum POST será enviado"
echo

# Gera, via Node, todos os timestamps (epoch ms) ordenados — um por linha.
TIMESTAMPS=$(MIN_PER_DAY="$MIN_PER_DAY" MAX_PER_DAY="$MAX_PER_DAY" \
  TZ_OFFSET="$TZ_OFFSET" DAYS="$DAYS" node -e '
  const off  = process.env.TZ_OFFSET;
  const min  = parseInt(process.env.MIN_PER_DAY, 10);
  const max  = parseInt(process.env.MAX_PER_DAY, 10);
  const rows = process.env.DAYS.trim().split("\n");
  const HOUR = 3600 * 1000;
  const out = [];
  for (const row of rows) {
    const [date, hStart, hEnd] = row.trim().split(/\s+/);
    const dayBase = Date.parse(`${date}T00:00:00${off}`);
    const t0 = dayBase + parseInt(hStart, 10) * HOUR;
    const t1 = dayBase + parseInt(hEnd, 10) * HOUR;
    const n  = min + Math.floor(Math.random() * (max - min + 1));
    for (let i = 0; i < n; i++) {
      out.push(t0 + Math.floor(Math.random() * (t1 - t0)));
    }
  }
  out.sort((a, b) => a - b);
  console.log(out.join("\n"));
')

TOTAL=$(printf '%s\n' "$TIMESTAMPS" | grep -c .)
echo "Total de pontos gerados: ${TOTAL}"
echo

i=0
while IFS= read -r TS_MS; do
  [ -z "$TS_MS" ] && continue
  i=$((i + 1))
  # Alterna o valor a cada ponto, na ordem temporal: 1º=on, 2º=off, 3º=on, ...
  if [ $((i % 2)) -eq 1 ]; then
    CUR_VALUE="on"
  else
    CUR_VALUE="off"
  fi
  BODY="{\"ts\": ${TS_MS}, \"values\": {\"${KEY}\": \"${CUR_VALUE}\"}}"
  ISO=$(TS="$TS_MS" node -e 'console.log(new Date(parseInt(process.env.TS,10)).toISOString())')

  if [ "$DRY_RUN" = "1" ]; then
    printf '[%3d/%d] %s  %s\n' "$i" "$TOTAL" "$ISO" "$BODY"
    continue
  fi

  printf '[%3d/%d] %s  ts=%s ... ' "$i" "$TOTAL" "$ISO" "$TS_MS"
  CODE=$(curl -sS -o /dev/null -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "X-Authorization: Bearer ${TB_TOKEN}" \
    -d "$BODY" \
    -w "%{http_code}")
  echo "HTTP ${CODE}"

  # pausa entre requests (SLEEP_MS em milissegundos)
  sleep "$(awk "BEGIN{print ${SLEEP_MS}/1000}")"
done <<< "$TIMESTAMPS"

echo
echo "Concluído: ${TOTAL} pontos processados."
