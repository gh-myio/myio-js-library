-- =============================================================================
-- fix-temp-registry — Batch 5 (2026-05-15) — Pass 2: janela 30-90 dias (one shot)
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch5-pass2.sql
--
-- Substituições (continuação do Pass 1 — slaves já renomeados):
--   • CTI Pediátrico | 126 → 162 | offset -6
--   • CAF            | 149 → 164 | offset -7
--
-- ESCOPO DESTE ARQUIVO:
--   • Migrar APENAS a janela 30-90 dias atrás (timestamp entre -90d e -30d)
--   • Sem renomeação (já feita no Pass 1)
--   • Uma única transação cobrindo os 2 swaps
-- =============================================================================

-- ── Pré-flight: contagem da janela 30-90d (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (126, 149)
--   AND timestamp >= NOW() - INTERVAL '90 days'
--   AND timestamp <  NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;

-- =============================================================================
-- Histórico — Janela 30 a 90 dias atrás
-- =============================================================================

BEGIN;

-- CTI Pediátrico | 126 → 162 | offset -6
UPDATE temperature_history
  SET slave_id = 162, value = value + (-6)
  WHERE slave_id = 126
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

-- CAF | 149 → 164 | offset -7
UPDATE temperature_history
  SET slave_id = 164, value = value + (-7)
  WHERE slave_id = 149
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

COMMIT;
