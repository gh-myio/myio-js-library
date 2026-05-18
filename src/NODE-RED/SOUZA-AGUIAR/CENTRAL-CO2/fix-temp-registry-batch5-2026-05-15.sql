-- =============================================================================
-- fix-temp-registry — Batch 5 (2026-05-15) — Pass 1: últimos 30 dias + renames
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch5-pass1.sql
--
-- Substituições (slave novo outlet assume o lugar do slave infrared com offset):
--   • CTI Pediátrico | 126 → 162 | offset -6
--   • CAF            | 149 → 164 | offset -7
--
-- Contexto: slaves 162 e 164 foram criados em 2026-05-13 como sensores novos
-- (hardware fisicamente instalado nos ambientes). Eles assumem o papel dos
-- slaves infrared antigos (126 e 149), que ficam como OLD-.
--
-- Nomes originais antes desta migração:
--   • slave 162: 'CTI Pediátrico_ sétimo-andar' (outlet, criado 2026-05-13)
--   • slave 126: 'Temp. Co2_CTI_Pediatrico -6' (infrared, criado 2024-12-28)
--   • slave 164: 'TEMP_FARMACIA-CAF' (outlet, criado 2026-05-13)
--   • slave 149: 'Temp. Co2_CAF -7' (infrared, criado 2024-12-30)
--
-- ESCOPO DESTE ARQUIVO:
--   1. Migrar APENAS os últimos 30 dias (timestamp >= NOW() - 30 days)
--   2. Renomear os 4 slaves (2 OLD- + 2 limpos)
--
-- As janelas 30-90d ficam para o Pass 2 (fix-temp-registry-batch5-pass2-2026-05-15.sql).
-- =============================================================================

-- ── Pré-flight: contagem dos últimos 30 dias (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (126, 149, 162, 164)
--   AND timestamp >= NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;
--
-- Esperado:
--   • 126 e 149 com volume normal (sensores antigos transmitindo)
--   • 162 e 164 com poucos rows (apenas desde 2026-05-13)
-- Se houver overlap de timestamps entre 126↔162 ou 149↔164, considerar filtro
-- adicional para evitar duplicação na coluna timestamp+slave_id.

-- =============================================================================
-- Histórico — Últimos 30 dias
-- =============================================================================

BEGIN;

-- CTI Pediátrico | 126 → 162 | offset -6
UPDATE temperature_history
  SET slave_id = 162, value = value + (-6)
  WHERE slave_id = 126
    AND timestamp >= NOW() - INTERVAL '30 days';

-- CAF | 149 → 164 | offset -7
UPDATE temperature_history
  SET slave_id = 164, value = value + (-7)
  WHERE slave_id = 149
    AND timestamp >= NOW() - INTERVAL '30 days';

COMMIT;

-- =============================================================================
-- Renomeação dos slaves
-- =============================================================================

BEGIN;

-- CTI Pediátrico
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CTI_Pediatrico -6' WHERE id = 126;
UPDATE slaves SET name = 'Temp. Co2_CTI_Pediatrico'           WHERE id = 162;

-- CAF
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CAF -7' WHERE id = 149;
UPDATE slaves SET name = 'Temp. Co2_CAF'           WHERE id = 164;

COMMIT;
