-- =============================================================================
-- fix UTI Neonatal — Correção do reparo errado (2026-05-12)
-- Central: Souza Aguiar — Maternidade Nova
-- SSH: ssh -i id_rsa root@201:ce30:f047:7f02:a27c:cbac:ffb7:2b67
-- Executar: psql -U hubot -f /tmp/fix-uti-neonatal-rename.sql
--
-- Contexto: o técnico renomeou na direção errada.
--   • slave 21 está nomeado como ativo (Temp. Co2_UTI_Neonatal) mas NÃO recebe
--     telemetria do sensor físico.
--   • slave 41 está nomeado como legado (OLD-...-4) mas É quem recebe a
--     telemetria do sensor físico real.
--
-- Correção: APENAS renomeação. Não há migração de temperature_history.
--   O offset -4 fica no nome do slave 41 para que transform-temperature.js
--   continue aplicando -4 às leituras vindas do sensor físico.
--
-- Slave 22 permanece intocado (legado histórico genuíno).
-- =============================================================================

-- ── Pré-flight: confirmar quem está recebendo dados nos últimos 7 dias
-- SELECT slave_id, MAX(timestamp) AS last_seen, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (21, 22, 41)
--   AND timestamp >= NOW() - INTERVAL '7 days'
-- GROUP BY slave_id ORDER BY slave_id;
-- Esperado: slave_id=41 com last_seen recente e rows > 0;
--           slave_id=21 com 0 rows ou last_seen antigo.

BEGIN;

-- slave 21: era o suposto ativo, vira legado (sem offset — nunca teve)
UPDATE slaves
  SET name = 'OLD-T.e.m.p. Co2_UTI_Neonatal'
  WHERE id = 21;

-- slave 41: é o real ativo, ganha o nome de Temp ativo (mantém -4 para offset)
UPDATE slaves
  SET name = 'Temp. Co2_UTI_Neonatal -4'
  WHERE id = 41;

COMMIT;

-- ── Pós-execução: verificar nomes
-- SELECT id, name FROM slaves WHERE id IN (21, 22, 41) ORDER BY id;
-- Esperado:
--   21 | OLD-T.e.m.p. Co2_UTI_Neonatal
--   22 | OLD-T.e.m.p. Co2_UTI_Neonatal -4
--   41 | Temp. Co2_UTI_Neonatal -4
