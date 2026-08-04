#!/usr/bin/env bash
# =============================================================================
# run-fleet.sh — roda UM comando em TODAS as centrais da frota via SSH.
#
# ⚠️ EXCLUSIVO DO LÍDER TÉCNICO. Depende da chave `id_rsa` (assinada/liberada
#    para todas as centrais), que vive SÓ no box `restarter`
#    (ubuntu@healthchecks.myio-bas.com). Sem essa chave, não roda.
#
# USO (no box, dentro de ~/restarter):
#   ./run-fleet.sh                                   # restart (default) em todas
#   ./run-fleet.sh 'systemctl restart myio-api.service'
#   ./run-fleet.sh 'systemctl is-active myio-api.service'   # só checar status
#   ./run-fleet.sh 'systemctl show -p ActiveEnterTimestamp --value myio-api.service'
#
# Vars: KEY=id_rsa  LIST=centrais.txt  (sobrescrevíveis por env)
#
# As flags de SSH matam os 2 atritos manuais:
#   StrictHostKeyChecking=no    → não pede "yes" na 1ª conexão
#   UserKnownHostsFile=/dev/null→ nunca dá "HOST KEY CHANGED" (centrais são
#                                 re-imageadas/Mender e trocam host key) →
#                                 dispensa o ssh-keygen -R + retry
#   ConnectTimeout=10           → central offline falha rápido (não trava)
#   BatchMode=yes               → nunca cai pra senha (falha limpo)
# Tradeoff: desliga verificação de host (MITM). Aceitável em mesh Yggdrasil
# privada, para a própria frota. Ver README.md.
# =============================================================================
set -u
CMD="${1:-systemctl restart myio-api.service}"
KEY="${KEY:-id_rsa}"
LIST="${LIST:-centrais.txt}"
OPTS="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      -o LogLevel=ERROR -o ConnectTimeout=10 -o BatchMode=yes"

[ -f "$KEY" ]  || { echo "ERRO: chave '$KEY' não encontrada (rode no box restarter)."; exit 1; }
[ -f "$LIST" ] || { echo "ERRO: lista '$LIST' não encontrada."; exit 1; }

echo ">> comando: $CMD"
echo ">> lista:   $LIST"
echo
ok=0; fail=0; fails=()
while IFS='|' read -r nome ip; do
  case "$nome" in ''|'#'*) continue ;; esac      # pula vazias e comentários
  ip="$(printf '%s' "$ip" | tr -d '[:space:]')"
  [ -z "$ip" ] && continue
  printf '%-44s ' "$nome"
  if out="$(ssh $OPTS "root@$ip" "$CMD" 2>&1)"; then
    echo "OK";  ok=$((ok+1))
    [ -n "$out" ] && echo "      ↳ $out"
  else
    reason="$(printf '%s' "$out" | tail -n1)"; [ -z "$reason" ] && reason="timeout/erro"
    echo "FALHOU ($reason)"; fail=$((fail+1)); fails+=("$nome | $ip")
  fi
done < "$LIST"

echo
echo "==== $ok OK · $fail falharam ===="
[ "$fail" -gt 0 ] && printf '  ✗ %s\n' "${fails[@]}"
exit 0
