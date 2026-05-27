#!/usr/bin/env bash
# ============================================================================
# Investigação slave 48 — Hidr. Água Potável Entra Novo (Praia Grande)
# Roda os 4 passos do INVESTIGACAO_Device_Slave48_AguaPotavelEntraNovo.md
# Conecta no DB `hubot` (Postgres da central) e salva tudo num log em /tmp
#
# Uso: ./query-slave48-pulses-hoje.sh
# ============================================================================

set -u

# --- Config -----------------------------------------------------------------
DATA_HOJE="2026-05-25"      # ajustar se rodar em outro dia
DATA_AMANHA="2026-05-26"
SLAVE_ID=48
CHANNEL=1
TZ="America/Sao_Paulo"

# --- Saída ------------------------------------------------------------------
OUT="/tmp/investigacao-slave${SLAVE_ID}-pulses-$(date +%Y%m%d-%H%M%S).log"

# Tudo abaixo vai para stdout E para o arquivo $OUT
exec > >(tee "$OUT") 2>&1

echo "================================================================"
echo " Investigação slave ${SLAVE_ID} ch ${CHANNEL} — pulses do dia"
echo " Data alvo:  ${DATA_HOJE}  (${TZ})"
echo " Executado:  $(date)"
echo " Host:       $(hostname)"
echo " Log:        ${OUT}"
echo "================================================================"
echo

# --- Detectar socket do Postgres (Debian usa /var/run/postgresql) -----------
PSQL_HOST_OPT=""
if ! psql -U hubot -d hubot -c '\q' 2>/dev/null; then
  if psql -U hubot -h /var/run/postgresql -d hubot -c '\q' 2>/dev/null; then
    PSQL_HOST_OPT="-h /var/run/postgresql"
    echo "[info] usando socket -h /var/run/postgresql"
  else
    echo "[ERRO] não consegui conectar como hubot. Cheque o psql." >&2
    exit 1
  fi
fi

# --- Rodar todas as queries num único psql ----------------------------------
psql -U hubot $PSQL_HOST_OPT -d hubot <<SQL
\pset pager off
\timing on

\echo
\echo === PASSO 1.1 — slave ${SLAVE_ID} ===========================================
SELECT id, name, type, addr_low, addr_high FROM slaves WHERE id = ${SLAVE_ID};

\echo
\echo === PASSO 1.2 — channels do slave ${SLAVE_ID} ===============================
SELECT id, type, channel, name, slave_id
FROM channels WHERE slave_id = ${SLAVE_ID} ORDER BY id;

\echo
\echo === PASSO 1.3 — última leitura e amostras 7d ===============================
SELECT channel,
       MAX(timestamp) AS ultima_leitura,
       COUNT(*)        AS amostras_7d
FROM channel_pulse_log
WHERE slave_id = ${SLAVE_ID} AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY channel ORDER BY channel;

\echo
\echo === PASSO 2 (T4) — Pulsos brutos HOJE, hora a hora ========================
\echo === Compara com a coluna "Litros" do dashboard            ==================
SELECT date_trunc('hour', timestamp AT TIME ZONE '${TZ}') AS hora_local,
       SUM(value)        AS pulsos_hora,
       SUM(value) * 10   AS litros_estimados
FROM channel_pulse_log
WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
  AND timestamp >= '${DATA_HOJE} 00:00:00-03'::timestamptz
  AND timestamp <  '${DATA_AMANHA} 00:00:00-03'::timestamptz
GROUP BY hora_local
ORDER BY hora_local;

\echo
\echo === PASSO 3 — Total do dia (compara com dashboard 9.830 L) ================
SELECT SUM(value)        AS pulsos_total_hoje,
       SUM(value) * 10   AS litros_total_hoje,
       COUNT(*)          AS amostras_hoje
FROM channel_pulse_log
WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
  AND timestamp >= '${DATA_HOJE} 00:00:00-03'::timestamptz
  AND timestamp <  '${DATA_AMANHA} 00:00:00-03'::timestamptz;

\echo
\echo === PASSO 4.1 — Anomalia hora 14 (dashboard: Mín 3070 > Méd 1970.7) ======
\echo === Série de 30 dias para hora 14 (slot 14:00-15:00 local)          =======
SELECT date_trunc('day', timestamp AT TIME ZONE '${TZ}') AS dia,
       SUM(value) AS pulsos_h14
FROM channel_pulse_log
WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
  AND EXTRACT(HOUR FROM timestamp AT TIME ZONE '${TZ}') = 14
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY dia
ORDER BY dia;

\echo
\echo === PASSO 4.2 — Hora 14: agregado min/max/avg (replica da pipeline) =======
WITH h14 AS (
  SELECT date_trunc('day', timestamp AT TIME ZONE '${TZ}') AS dia,
         SUM(value) AS pulsos
  FROM channel_pulse_log
  WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
    AND EXTRACT(HOUR FROM timestamp AT TIME ZONE '${TZ}') = 14
    AND timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY dia
)
SELECT COUNT(*) AS dias,
       MIN(pulsos)            AS min_,
       MAX(pulsos)            AS max_,
       ROUND(AVG(pulsos), 2)  AS avg_
FROM h14;

\echo
\echo === PASSO 4.3 — Anomalia hora 4 (dashboard: Mín 1485 > Méd 860) ===========
\echo === Série de 30 dias para hora 4                                   ========
SELECT date_trunc('day', timestamp AT TIME ZONE '${TZ}') AS dia,
       SUM(value) AS pulsos_h04
FROM channel_pulse_log
WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
  AND EXTRACT(HOUR FROM timestamp AT TIME ZONE '${TZ}') = 4
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY dia
ORDER BY dia;

\echo
\echo === PASSO 4.4 — Hora 4: agregado min/max/avg ==============================
WITH h04 AS (
  SELECT date_trunc('day', timestamp AT TIME ZONE '${TZ}') AS dia,
         SUM(value) AS pulsos
  FROM channel_pulse_log
  WHERE slave_id = ${SLAVE_ID} AND channel = ${CHANNEL}
    AND EXTRACT(HOUR FROM timestamp AT TIME ZONE '${TZ}') = 4
    AND timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY dia
)
SELECT COUNT(*) AS dias,
       MIN(pulsos)            AS min_,
       MAX(pulsos)            AS max_,
       ROUND(AVG(pulsos), 2)  AS avg_
FROM h04;

\echo
\echo === PASSO 5 — Comparativo: 3 medidores de potável (slaves 20, 48, 49) ====
SELECT slave_id, channel,
       to_char(MAX(timestamp), 'YYYY-MM-DD HH24:MI') AS ultima_leitura,
       COUNT(*)                                       AS amostras_7d,
       SUM(value)                                     AS pulsos_7d
FROM channel_pulse_log
WHERE (slave_id, channel) IN ((20,1),(48,1),(49,1))
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY slave_id, channel
ORDER BY slave_id;

\echo
\echo === FIM ==================================================================
SQL

echo
echo "================================================================"
echo " ✓ Concluído. Saída completa em:"
echo "   ${OUT}"
echo "================================================================"
echo
echo "Para visualizar:        less ${OUT}"
echo "Para baixar local:      scp root@<central>:${OUT} ."
