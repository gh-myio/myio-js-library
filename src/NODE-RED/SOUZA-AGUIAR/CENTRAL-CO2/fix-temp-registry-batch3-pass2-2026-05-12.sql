-- =============================================================================
-- fix-temp-registry — Batch 3 (2026-05-12) — Pass 2: janela 30-90 dias (one shot)
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch3-pass2.sql
--
-- Substituições (continuação do Pass 1 — slaves já renomeados):
--   • CME SL01    | 121 → 122 | offset -6
--   • CME SL02    | 124 → 123 | offset -7  ⚠️ Pass 1 retornou 0 rows nos últimos 30d
--   • Queimados   | 150 → 151 | offset -4
--
-- ESCOPO DESTE ARQUIVO:
--   • Migrar APENAS a janela 30-90 dias atrás (timestamp entre -90d e -30d)
--   • Sem renomeação (já feita no Pass 1)
--   • Uma única transação cobrindo os 3 swaps
-- =============================================================================

-- ── Pré-flight: contagem da janela 30-90d (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (121, 124, 150)
--   AND timestamp >= NOW() - INTERVAL '90 days'
--   AND timestamp <  NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;

-- =============================================================================
-- Histórico — Janela 30 a 90 dias atrás
-- =============================================================================

BEGIN;

-- CME SL01 | 121 → 122 | offset -6
UPDATE temperature_history
  SET slave_id = 122, value = value + (-6)
  WHERE slave_id = 121
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

-- CME SL02 | 124 → 123 | offset -7
UPDATE temperature_history
  SET slave_id = 123, value = value + (-7)
  WHERE slave_id = 124
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

-- Queimados | 150 → 151 | offset -4
UPDATE temperature_history
  SET slave_id = 151, value = value + (-4)
  WHERE slave_id = 150
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

COMMIT;
