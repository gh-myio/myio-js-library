#!/usr/bin/env bash
# =============================================================================
# backup-fleet.sh — pg_dump do CADASTRO (hubot) de TODAS as centrais e puxa os
#                   dumps para o box (scp), num diretório com timestamp.
#
# ⚠️ EXCLUSIVO DO LÍDER TÉCNICO — depende da `id_rsa` (só no box restarter).
#    Rodar em ~/restarter. Ver README.md.
#
# USO:
#   ./backup-fleet.sh                      # backup do cadastro de todas → backups/<stamp>/
#   OUTDIR=/data/bkp ./backup-fleet.sh     # muda o destino
#   TABLES='' ./backup-fleet.sh            # TABLES vazio = pg_dump do banco INTEIRO
#
# Tabelas default = as de CADASTRO (mesmas do passo 3.0 do steps-new-central):
#   slaves, channels, ambients, ambients_rfir_slaves_rel
# (a telemetria consumption_realtime/pulses NÃO entra — é grande e volátil).
# =============================================================================
set -u
KEY="${KEY:-id_rsa}"
LIST="${LIST:-centrais.txt}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTDIR="${OUTDIR:-backups/$STAMP}"
TABLES="${TABLES:--t slaves -t channels -t ambients -t ambients_rfir_slaves_rel}"
OPTS="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o LogLevel=ERROR -o ConnectTimeout=10 -o BatchMode=yes"

[ -f "$KEY" ]  || { echo "ERRO: chave '$KEY' não encontrada (rode no box restarter)."; exit 1; }
[ -f "$LIST" ] || { echo "ERRO: lista '$LIST' não encontrada."; exit 1; }
mkdir -p "$OUTDIR"
echo ">> backup do cadastro (tabelas: ${TABLES:-BANCO INTEIRO})"
echo ">> destino: $OUTDIR"
echo

ok=0; fail=0; fails=()
while IFS='|' read -r nome ip; do
  case "$nome" in ''|'#'*) continue ;; esac
  ip="$(printf '%s' "$ip" | tr -d '[:space:]')"; [ -z "$ip" ] && continue
  slug="$(printf '%s' "$nome" | tr -cs '[:alnum:]' '_' | sed 's/^_//;s/_$//')"
  remote="/tmp/bkp-cadastro-$STAMP.sql"
  printf '%-44s ' "$nome"

  # 1) pg_dump na central   2) scp de volta pro box (IPv6 exige colchetes no scp)
  if ssh $OPTS "root@$ip" "pg_dump -U hubot --clean --if-exists $TABLES > $remote 2>/dev/null" \
     && scp $OPTS "root@[$ip]:$remote" "$OUTDIR/$slug.sql" >/dev/null 2>&1; then
    sz="$(wc -c < "$OUTDIR/$slug.sql" 2>/dev/null || echo 0)"
    ssh $OPTS "root@$ip" "rm -f $remote" >/dev/null 2>&1   # limpa o /tmp da central
    echo "OK (${sz} bytes)"; ok=$((ok+1))
  else
    echo "FALHOU (offline/erro)"; fail=$((fail+1)); fails+=("$nome | $ip")
    rm -f "$OUTDIR/$slug.sql" 2>/dev/null
  fi
done < "$LIST"

echo
echo "==== $ok OK · $fail falharam · dumps em $OUTDIR ===="
[ "$fail" -gt 0 ] && printf '  ✗ %s\n' "${fails[@]}"
exit 0
