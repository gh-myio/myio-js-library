-- =============================================================================
-- fix-temp-registry — Batch 6 (2026-05-18) — Pass 1: últimos 30 dias + renames
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix-batch6-pass1.sql
--
-- Substituições (estratégia mista — 1 com novo HW, 2 com padrão GAS→Temp):
--   • Sala Vermelha Adulto    | 74  → 165 | offset -8 | novo HW (batch5-style)
--   • Sala Vermelha Infantil  | 135 → 134 | offset -8 | GAS antigo (batch3-style)
--   • Farmácia Satélite       | 140 → 141 | offset -7 | GAS antigo (batch3-style)
--
-- Contexto:
--   • Slave 165 foi criado em 2026-05-15 como novo sensor físico instalado em
--     Sala Vermelha Adulto. Substitui o slave infrared 74 (que tinha offset -8).
--   • Slaves 134 e 141 são os antigos sensores GAS (range 5000, fator x9.47)
--     que vão assumir o papel de Temp limpa (sem offset) nos respectivos
--     ambientes. Padrão usado nos batches 1-3.
--
-- Não incluídos neste batch:
--   • Raio-X 02 (101 → 98) — fica para batch7
--   • Lactário (156/157) — ainda a identificar
--   • Slaves 166, 167, 168 — instalados em campo mas equipe optou por não usar
--
-- ESCOPO DESTE ARQUIVO:
--   1. Migrar APENAS os últimos 30 dias (timestamp >= NOW() - 30 days)
--   2. Renomear os 6 slaves (3 OLD- + 3 limpos)
--
-- As janelas 30-90d ficam para o Pass 2 (fix-temp-registry-batch6-pass2-2026-05-18.sql).
-- =============================================================================

-- ── Pré-flight: contagem dos últimos 30 dias (rodar SELECT antes para conferir)
-- SELECT slave_id, COUNT(*) AS rows
-- FROM temperature_history
-- WHERE slave_id IN (74, 135, 140, 165, 134, 141)
--   AND timestamp >= NOW() - INTERVAL '30 days'
-- GROUP BY slave_id ORDER BY slave_id;
--
-- Esperado:
--   • 74, 135, 140  → volume normal (sensores antigos transmitindo)
--   • 165           → poucos rows (apenas desde 2026-05-15)
--   • 134, 141      → poucos/zero rows (slaves GAS não costumam ter histórico de Temp;
--                      se tiverem, verificar se são leituras de GAS que devem ser ignoradas)
--
-- Se 134 ou 141 tiverem rows significativos pré-migração, considerar filtro
-- adicional para preservar/excluir conforme convier.

-- =============================================================================
-- Histórico — Últimos 30 dias
-- =============================================================================

BEGIN;

-- Sala Vermelha Adulto | 74 → 165 | offset -8
UPDATE temperature_history
  SET slave_id = 165, value = value + (-8)
  WHERE slave_id = 74
    AND timestamp >= NOW() - INTERVAL '30 days';

-- Sala Vermelha Infantil | 135 → 134 | offset -8
UPDATE temperature_history
  SET slave_id = 134, value = value + (-8)
  WHERE slave_id = 135
    AND timestamp >= NOW() - INTERVAL '30 days';

-- Farmácia Satélite | 140 → 141 | offset -7
UPDATE temperature_history
  SET slave_id = 141, value = value + (-7)
  WHERE slave_id = 140
    AND timestamp >= NOW() - INTERVAL '30 days';

COMMIT;

-- =============================================================================
-- Renomeação dos slaves
-- =============================================================================

BEGIN;

-- Sala Vermelha Adulto
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Sala_Vermelha_Adulto -8' WHERE id = 74;
UPDATE slaves SET name = 'Temp. Co2_Sala_Vermelha_Adulto'           WHERE id = 165;

-- Sala Vermelha Infantil
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Sala_Vermelha_Infantil -8' WHERE id = 135;
UPDATE slaves SET name = 'Temp. Co2_Sala_Vermelha_Infantil'           WHERE id = 134;

-- Farmácia Satélite
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Farmácia_Satelite -7' WHERE id = 140;
UPDATE slaves SET name = 'Temp. Co2_Farmácia_Satelite'           WHERE id = 141;

COMMIT;
