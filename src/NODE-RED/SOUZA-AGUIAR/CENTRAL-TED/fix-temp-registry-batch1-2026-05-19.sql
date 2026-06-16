-- =============================================================================
-- fix-temp-registry — T&D Batch 1 (2026-05-19) — One-shot 90 dias
-- Central: Souza Aguiar — T&D
-- SSH: ssh -i id_rsa root@202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7
-- Executar: psql -U hubot -f /tmp/fix-ted-batch1.sql
--
-- Substituição (única — padrão batch3 do CO2, GAS antigo substitui Temp):
--   • Lactário | 64 → 63 | offset -6 | padrão batch3
--
-- Contexto:
--   • Slave 64 (`Temp. Co2_Lactareo -6`, infrared) é o sensor de temperatura
--     atual, com offset -6°C aplicado no nome.
--   • Slave 63 (`GAS Co2_Lactareo 132 5000 x9.47`, outlet) é o sensor GAS
--     que vai assumir o papel de Temp limpa (sem offset) após a migração.
--   • Esta é a PRIMEIRA migração fix-temp-registry da central T&D.
--   • Padrão idêntico ao do CO2 batch3 (CME / Queimados).
--
-- ATENÇÃO:
--   • Slave 63 está sem `updated_at` desde 2025-09-10 (~8 meses). Verificar
--     com o pré-flight se ele tem rows recentes em temperature_history. Se
--     tiver rows pré-existentes, podem ser leituras de GAS bruto e precisam
--     ser analisadas antes de mesclar — possível duplicação ou conflito.
-- =============================================================================

-- ── Pré-flight (RODAR ANTES DE EXECUTAR O SCRIPT)
-- 1. Contagem de rows no slave de origem e destino (últimos 90 dias):
-- SELECT slave_id, COUNT(*) AS rows, MIN(timestamp) AS first, MAX(timestamp) AS last
-- FROM temperature_history
-- WHERE slave_id IN (63, 64)
--   AND timestamp >= NOW() - INTERVAL '90 days'
-- GROUP BY slave_id ORDER BY slave_id;
--
-- Esperado:
--   • 64 → volume normal (sensor ativo, com offset -6 sendo aplicado)
--   • 63 → zero ou pouquíssimos rows (GAS sem atividade desde 2025-09-10)
--
-- Se 63 tiver rows significativos:
--   - Investigar quais valores são (GAS bruto vs Temp esperada)
--   - Decidir se precisa BACKUP antes do UPDATE
--   - Considerar adicionar filtro no UPDATE para evitar sobrescrever

-- 2. Confirmar identidade dos slaves:
-- SELECT id, type, name, code, version, updated_at
-- FROM slaves
-- WHERE id IN (63, 64);
--
-- Esperado:
--   • 64: type=infrared, code=002-002-002-014, version=7.0.0
--   • 63: type=outlet,   code=002-002-002-012, version=6.0.0

-- =============================================================================
-- Migração: Histórico 90 dias + Renames
-- =============================================================================

BEGIN;

-- Histórico — Últimos 90 dias
-- Lactário | 64 → 63 | offset -6
UPDATE temperature_history
  SET slave_id = 63, value = value + (-6)
  WHERE slave_id = 64
    AND timestamp >= NOW() - INTERVAL '90 days';

-- Renomeação dos slaves
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Lactareo -6' WHERE id = 64;
UPDATE slaves SET name = 'Temp. Co2_Lactareo'           WHERE id = 63;

COMMIT;

-- =============================================================================
-- Pós-execução — Verificações sugeridas
-- =============================================================================
-- 1. Confirmar renomeação:
-- SELECT id, name, type, updated_at FROM slaves WHERE id IN (63, 64);
--
-- 2. Confirmar histórico migrado:
-- SELECT slave_id, COUNT(*) FROM temperature_history
-- WHERE slave_id IN (63, 64) AND timestamp >= NOW() - INTERVAL '90 days'
-- GROUP BY slave_id;
-- (Esperado: 63 com rows migrados, 64 com 0 rows na janela de 90d)
--
-- 3. Validar amostra de valores migrados (verificar se offset foi aplicado):
-- SELECT timestamp, value FROM temperature_history
-- WHERE slave_id = 63 AND timestamp >= NOW() - INTERVAL '1 day'
-- ORDER BY timestamp DESC LIMIT 10;
-- (Valores devem refletir temperatura real, não valor bruto + 6)
