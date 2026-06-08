#!/bin/sh
# =============================================================================
# db-backup.sh — Backup do banco `hubot` de uma central OrangePi MyIO.
#
# RODA NA CENTRAL (shell BusyBox `ash` — POSIX, sem bashismos).
# Gera dumps pg_dump no formato custom (-Fc, comprimido) em
#   /data/backups/<central>/<timestamp>/        (/data sobrevive a update Mender)
#
# Camadas geradas:
#   1) config-and-infra_*.dump  -> schema COMPLETO + dados de TODAS as tabelas
#                                  EXCETO as séries temporais. É o que você
#                                  restaura após um POST /api/clear-all-data-central.
#                                  Inclui SequelizeMeta + environment.
#   2) infra-only_*.dump        -> só DADOS de SequelizeMeta + environment
#                                  (o par "preservar sempre"), para restore isolado.
#   3) timeseries_*.dump        -> séries temporais À PARTE (consumption, logs,
#                                  raw_energy, temperature_history, etc. +
#                                  chunks _timescaledb_internal). Opcional.
#   +  MANIFEST.txt             -> data, versão pg, conteúdo de environment,
#                                  contagem aproximada por tabela, lista de arquivos.
#
# Uso (na central):
#   sh db-backup.sh                      # gera 1 + 2 + 3 (séries temporais incluídas, à parte)
#   WITH_TIMESERIES=0 sh db-backup.sh    # pula o dump de séries temporais (rápido/leve)
#   FULL=1 sh db-backup.sh               # gera TAMBÉM full_*.dump (DB inteiro, Timescale-safe)
#   CENTRAL=praia-grande sh db-backup.sh # reaproveita para outra central
#
# Restore: ver README.md (mesma pasta).
# =============================================================================

set -e
set -f   # noglob: impede que os patterns "*.dump"/"_timescaledb_internal.*" sofram globbing

# ---- Parâmetros (sobrescrevíveis por env) ----
CENTRAL="${CENTRAL:-aricanduva}"
DB_USER="${DB_USER:-hubot}"
DB_NAME="${DB_NAME:-hubot}"
DB_HOST="${DB_HOST:-/var/run/postgresql}"   # socket local (Debian/Ubuntu); ver manual §5.1
BACKUP_ROOT="${BACKUP_ROOT:-/data/backups}"
WITH_TIMESERIES="${WITH_TIMESERIES:-1}"
FULL="${FULL:-0}"

# Tabelas de séries temporais (volumosas; várias são hypertables TimescaleDB).
TIMESERIES="consumption consumption_realtime raw_energy temperature_history logs channel_pulse_log alert_history"

PSQL="psql -U $DB_USER -h $DB_HOST -d $DB_NAME"
PGDUMP="pg_dump -U $DB_USER -h $DB_HOST -d $DB_NAME"

TS=$(date +%Y-%m-%d_%H%M%S)
OUT="$BACKUP_ROOT/$CENTRAL/$TS"
mkdir -p "$OUT"

log() { echo "[backup] $*" >&2; }

log "central=$CENTRAL  db=$DB_NAME  host=$DB_HOST"
log "destino=$OUT"
$PSQL -tAc "select 1;" >/dev/null 2>&1 || { log "ERRO: não conectou no banco ($PSQL)"; exit 1; }

# ---- args de exclusão das séries temporais (dados) ----
EXCL=""
for t in $TIMESERIES; do
  EXCL="$EXCL --exclude-table-data=public.$t"
done
# chunks das hypertables Timescale (onde os dados realmente ficam)
EXCL="$EXCL --exclude-table-data=_timescaledb_internal.*"

# ---- 1) config + infra (schema completo + dados, SEM séries temporais) ----
log "1/3  config+infra (schema completo + dados, sem séries temporais) ..."
# shellcheck disable=SC2086
$PGDUMP -Fc $EXCL -f "$OUT/config-and-infra_${CENTRAL}_${TS}.dump"

# ---- 2) infra isolada (SequelizeMeta + environment, só dados) ----
log "2/3  infra isolada (SequelizeMeta + environment, data-only) ..."
$PGDUMP -Fc --data-only -t 'public."SequelizeMeta"' -t public.environment \
  -f "$OUT/infra-only_${CENTRAL}_${TS}.dump"

# ---- 3) séries temporais à parte (opcional) ----
if [ "$WITH_TIMESERIES" = "1" ]; then
  log "3/3  séries temporais (à parte, data-only + chunks Timescale) ..."
  TS_ARGS=""
  for t in $TIMESERIES; do TS_ARGS="$TS_ARGS -t public.$t"; done
  # shellcheck disable=SC2086
  $PGDUMP -Fc --data-only $TS_ARGS -t '_timescaledb_internal.*' \
    -f "$OUT/timeseries_${CENTRAL}_${TS}.dump"
else
  log "3/3  séries temporais PULADAS (WITH_TIMESERIES=0)"
fi

# ---- extra opcional: DB inteiro num arquivo (Timescale-safe) ----
if [ "$FULL" = "1" ]; then
  log "extra: dump completo do DB inteiro (Timescale-safe) ..."
  $PGDUMP -Fc -f "$OUT/full_${CENTRAL}_${TS}.dump"
fi

# ---- manifesto ----
MAN="$OUT/MANIFEST.txt"
{
  echo "MyIO — backup do banco da central"
  echo "central : $CENTRAL"
  echo "db      : $DB_NAME"
  echo "quando  : $TS"
  echo "pg_dump : $(pg_dump --version 2>/dev/null || echo '?')"
  echo "pg      : $($PSQL -tAc 'select version();' 2>/dev/null || echo '?')"
  echo
  echo "== environment (key -> value) =="
  $PSQL -c "select * from environment order by 1;" 2>/dev/null || echo "(falhou ler environment)"
  echo
  echo "== contagem aproximada por tabela public (reltuples) =="
  echo "   (hypertables aparecem ~0 aqui — os dados estão em _timescaledb_internal)"
  $PSQL -tAc "select rpad(relname,28) || ' ' || to_char(reltuples::bigint,'FM999G999G999') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by relname;" 2>/dev/null || echo "(falhou)"
  echo
  echo "== arquivos =="
} > "$MAN"
ls -lh "$OUT" >> "$MAN" 2>&1 || true

# symlink 'latest' (BusyBox ln não tem -n; recria manualmente)
rm -f "$BACKUP_ROOT/$CENTRAL/latest" 2>/dev/null || true
ln -s "$OUT" "$BACKUP_ROOT/$CENTRAL/latest" 2>/dev/null || true

log "OK. Arquivos gerados em $OUT:"
ls -lh "$OUT" >&2

# stdout final (limpo) — o orquestrador pull-backup.sh captura esta linha:
echo "BACKUP_DIR=$OUT"
