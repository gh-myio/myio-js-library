#!/bin/sh
# ============================================================================
# restore-hubot-backup.sh — restaura o banco `hubot` de uma central MyIO
# (OrangePi) a partir de um backup .tar.gz (pg_dump -Fc dentro do tar)
# baixado por URL (ex.: link presigned do S3 myio-central-backup-bucket).
#
# Uso:
#   ./restore-hubot-backup.sh "<url-do-backup.tar.gz>" [dir-de-trabalho]
#
#   - A URL DEVE vir entre aspas (links presigned têm '&').
#   - dir-de-trabalho: default /data (precisa de espaço p/ tarball + dump).
#
# Variáveis de ambiente opcionais:
#   SKIP_PREDUMP=1   não faz o backup de segurança do banco atual
#   KEEP_FILES=1     preserva tarball/dump/toc após sucesso (default: remove)
#
# Compatível com BusyBox ash. Requer: wget, tar, psql, pg_restore, pg_dump.
# ATENÇÃO (Windows/git): mantenha terminação de linha LF — se copiar do
# working tree com CRLF, rode: sed -i 's/\r$//' restore-hubot-backup.sh
#
# Lições que motivaram este script (incidente 2026-07-13):
#   - psql com vários -c encadeados NÃO para no primeiro erro → um DROP
#     DATABASE que falha (conexão ativa) passa despercebido e o restore
#     esbarra em "type already exists". Aqui todo psql usa ON_ERROR_STOP=1.
#   - O dump contém CREATE EXTENSION timescaledb; com --exit-on-error o
#     restore abortaria em "already exists" — filtramos a entrada do TOC.
#   - CREATE DATABASE usa TEMPLATE template0 (imune a template1 poluído).
# ============================================================================
set -eu

URL="${1:?Uso: $0 \"<url do backup .tar.gz>\" [dir de trabalho (default /data)]}"
WORKDIR="${2:-/data}"
DB=hubot
DBUSER=hubot
STAMP=$(date +%Y%m%d%H%M%S)
TARBALL="$WORKDIR/backup-$STAMP.tar.gz"
DUMP="$WORKDIR/dump-$STAMP.pgdump"
TOCLIST="$WORKDIR/restore-$STAMP.list"
PREDUMP="$WORKDIR/hubot-pre-restore-$STAMP.pgdump"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { echo "" >&2; echo "ERRO: $*" >&2; exit 1; }

# psql estrito: para no primeiro erro (evita DROP/CREATE silenciosamente falhos)
PSQL="psql -X -v ON_ERROR_STOP=1 -U $DBUSER"

DONE=0
finish() {
  if [ "$DONE" = "1" ]; then
    if [ "${KEEP_FILES:-0}" != "1" ]; then
      rm -f "$TARBALL" "$DUMP" "$TOCLIST"
    fi
    return
  fi
  echo ""
  echo "!! RESTORE FALHOU — serviços myio* continuam PARADOS."
  echo "!! Artefatos preservados para diagnóstico:"
  echo "   tarball : $TARBALL"
  echo "   dump    : $DUMP"
  echo "   toc     : $TOCLIST"
  [ -f "$PREDUMP" ] && echo "   pré-dump: $PREDUMP  (backup do banco ANTIGO)"
  echo "!! Para religar sem restaurar: systemctl start 'myio*'"
}
trap finish EXIT

# ── 0. Pré-checagens ────────────────────────────────────────────────────────
[ -d "$WORKDIR" ] || fail "diretório de trabalho não existe: $WORKDIR"
for bin in wget tar psql pg_restore pg_dump systemctl; do
  command -v "$bin" >/dev/null 2>&1 || fail "binário não encontrado: $bin"
done
log "Espaço em disco em $WORKDIR:"
df -h "$WORKDIR" | sed 's/^/    /'

# ── 1. Download ─────────────────────────────────────────────────────────────
log "Baixando backup para $TARBALL ..."
wget -q -O "$TARBALL" "$URL" || fail "download falhou (URL expirada? presigned dura 1h)"
[ -s "$TARBALL" ] || fail "arquivo baixado está vazio"
log "Download ok: $(du -h "$TARBALL" | cut -f1)"

# ── 2. Materializa e valida o dump ─────────────────────────────────────────
log "Extraindo dump do tarball ..."
tar -O -x -f "$TARBALL" > "$DUMP" || fail "tar falhou (tarball corrompido?)"
[ -s "$DUMP" ] || fail "dump extraído está vazio"
pg_restore -l "$DUMP" > /dev/null 2>&1 || fail "dump inválido (não é pg_dump -Fc?)"
log "Dump válido: $(du -h "$DUMP" | cut -f1)"

# ── 3. Para os serviços ─────────────────────────────────────────────────────
log "Parando serviços myio* ..."
systemctl stop 'myio*' || true
sleep 2

# ── 4. Backup de segurança do banco ATUAL ──────────────────────────────────
if [ "${SKIP_PREDUMP:-0}" != "1" ]; then
  if $PSQL -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
    log "Backup de segurança do banco atual em $PREDUMP ..."
    if pg_dump -U "$DBUSER" -Fc "$DB" > "$PREDUMP"; then
      log "Pré-dump ok: $(du -h "$PREDUMP" | cut -f1)"
    else
      echo "AVISO: pré-dump falhou — seguindo mesmo assim (exporte SKIP_PREDUMP=1 para silenciar)"
      rm -f "$PREDUMP"
    fi
  fi
fi

# ── 5. Drop + create limpos (template0; derruba conexões antes) ────────────
log "Recriando o banco $DB ..."
$PSQL -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB' AND pid<>pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"$DB\";" \
  -c "CREATE DATABASE \"$DB\" TEMPLATE template0;" \
  || fail "drop/create do banco falhou (ainda há conexões? serviço fora do padrão myio*?)"

# ── 6. Extensão + pre_restore ───────────────────────────────────────────────
log "Criando extensão timescaledb + pre_restore ..."
$PSQL -d "$DB" \
  -c 'CREATE EXTENSION IF NOT EXISTS timescaledb;' \
  -c 'SELECT timescaledb_pre_restore();' \
  || fail "extensão/pre_restore falhou (versão da timescaledb difere da do dump?)"

# ── 7. Restore estrito, filtrando a extensão do TOC ────────────────────────
log "Montando TOC sem a entrada da extensão ..."
pg_restore -l "$DUMP" \
  | grep -vE 'EXTENSION (- )?timescaledb|COMMENT - EXTENSION timescaledb' \
  > "$TOCLIST"
log "Restaurando (pg_restore --exit-on-error) ..."
pg_restore --verbose --exit-on-error -U "$DBUSER" -Fc -L "$TOCLIST" -d "$DB" "$DUMP" \
  || fail "pg_restore falhou — veja as últimas linhas acima"

# ── 8. Pós-restore + estatísticas ───────────────────────────────────────────
log "timescaledb_post_restore + ANALYZE ..."
$PSQL -d "$DB" -c 'SELECT timescaledb_post_restore();' || fail "post_restore falhou"
$PSQL -d "$DB" -c 'ANALYZE;' || true

# ── 9. Validação rápida ─────────────────────────────────────────────────────
TABLES=$($PSQL -d "$DB" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public';")
log "Validação: $TABLES tabelas no schema public"
[ "$TABLES" -gt 0 ] || fail "banco restaurado sem tabelas"
for t in consumption slaves users; do
  N=$($PSQL -d "$DB" -tAc "SELECT count(*) FROM \"$t\";" 2>/dev/null || echo 'n/d')
  log "    $t: $N registros"
done

# ── 10. Religa os serviços ──────────────────────────────────────────────────
log "Subindo serviços myio* ..."
systemctl start 'myio*' || true

DONE=1
log "RESTORE CONCLUÍDO ✔"
[ -f "$PREDUMP" ] && log "Backup do banco anterior preservado em: $PREDUMP"
