-- =============================================================================
-- fix-temp-registry — Batch 3 (2026-05-12) — Pass 1: últimos 30 dias + renames
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch3-pass1.sql
--
-- Substituições (slave GAS assume o lugar do slave Temp com offset):
--   • CME SL01    | 121 → 122 | offset -6
--   • CME SL02    | 124 → 123 | offset -7
--   • Queimados   | 150 → 151 | offset -4
--
-- ESCOPO DESTE ARQUIVO:
--   1. Migrar APENAS os últimos 30 dias (timestamp >= NOW() - 30 days)
--   2. Renomear os 6 slaves (3 OLD- + 3 limpos)
--
-- As janelas 30-60d e 60-90d ficam para um arquivo posterior (Pass 2 / Pass 3).
-- =============================================================================

-- ── Pré-flight: contagem dos últimos 30 dias (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (121, 124, 150)
--   AND timestamp >= NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;

-- =============================================================================
-- Histórico — Últimos 30 dias
-- =============================================================================

BEGIN;

-- CME SL01 | 121 → 122 | offset -6
UPDATE temperature_history
  SET slave_id = 122, value = value + (-6)
  WHERE slave_id = 121
    AND timestamp >= NOW() - INTERVAL '30 days';

-- CME SL02 | 124 → 123 | offset -7
UPDATE temperature_history
  SET slave_id = 123, value = value + (-7)
  WHERE slave_id = 124
    AND timestamp >= NOW() - INTERVAL '30 days';

-- Queimados | 150 → 151 | offset -4
UPDATE temperature_history
  SET slave_id = 151, value = value + (-4)
  WHERE slave_id = 150
    AND timestamp >= NOW() - INTERVAL '30 days';

COMMIT;

-- =============================================================================
-- Renomeação dos slaves
-- =============================================================================

BEGIN;

-- CME SL01
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CME_SL01 -6' WHERE id = 121;
UPDATE slaves SET name = 'Temp. Co2_CME_SL01'            WHERE id = 122;

-- CME SL02
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CME_SL02 -7' WHERE id = 124;
UPDATE slaves SET name = 'Temp. Co2_CME_SL02'            WHERE id = 123;

-- Queimados
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Queimados -4' WHERE id = 150;
UPDATE slaves SET name = 'Temp. Co2_Queimados'            WHERE id = 151;

COMMIT;
