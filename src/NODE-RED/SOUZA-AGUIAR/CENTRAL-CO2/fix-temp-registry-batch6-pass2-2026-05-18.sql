-- =============================================================================
-- fix-temp-registry — Batch 6 (2026-05-18) — Pass 2: janela 30-90 dias (one shot)
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch6-pass2.sql
--
-- Substituições (continuação do Pass 1 — slaves já renomeados):
--   • Sala Vermelha Adulto    | 74  → 165 | offset -8
--   • Sala Vermelha Infantil  | 135 → 134 | offset -8
--   • Farmácia Satélite       | 140 → 141 | offset -7
--
-- ESCOPO DESTE ARQUIVO:
--   • Migrar APENAS a janela 30-90 dias atrás (timestamp entre -90d e -30d)
--   • Sem renomeação (já feita no Pass 1)
--   • Uma única transação cobrindo os 3 swaps
-- =============================================================================

-- ── Pré-flight: contagem da janela 30-90d (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (74, 135, 140)
--   AND timestamp >= NOW() - INTERVAL '90 days'
--   AND timestamp <  NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;

-- =============================================================================
-- Histórico — Janela 30 a 90 dias atrás
-- =============================================================================

BEGIN;

-- Sala Vermelha Adulto | 74 → 165 | offset -8
UPDATE temperature_history
  SET slave_id = 165, value = value + (-8)
  WHERE slave_id = 74
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

-- Sala Vermelha Infantil | 135 → 134 | offset -8
UPDATE temperature_history
  SET slave_id = 134, value = value + (-8)
  WHERE slave_id = 135
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

-- Farmácia Satélite | 140 → 141 | offset -7
UPDATE temperature_history
  SET slave_id = 141, value = value + (-7)
  WHERE slave_id = 140
    AND timestamp >= NOW() - INTERVAL '90 days'
    AND timestamp <  NOW() - INTERVAL '30 days';

COMMIT;
