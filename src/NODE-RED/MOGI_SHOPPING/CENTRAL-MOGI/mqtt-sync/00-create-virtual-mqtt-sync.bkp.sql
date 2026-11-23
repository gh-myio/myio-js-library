-- =============================================================================
-- MOGI SHOPPING — Produto VIRTUAL "MQTT Sync" (plug)
-- Central: Central Mogi Shopping (2026-11-22) · CENTRAL_UUID da4f38b5-06e6-4f86-8705-c1e23f2639f9
-- IPv6 (Yggdrasil): 201:92b:2197:6dcc:9167:4be7:b2aa:896f
-- Central ID [141,5,106,155] (141.5.106.155) · Frequência 99
-- Especializado a partir do template canônico (CENTRAL_PRE_SETUP/mqtt-sync).
-- Banco: hubot (PostgreSQL, na própria central OrangePi)
--
-- ⚠️ Central REALOCADA: é a ex-"Central Deodoro - 2026-10-22" (Supervia),
--    ex-"Central Backup Vitória 2". O CENTRAL_UUID não muda, então o
--    "MQTT Sync - da4f38b5-…" da Deodoro PODE JÁ EXISTIR no banco — rode a
--    VERIFICAÇÃO PRÉVIA abaixo; se existir, NÃO rode o create.
--    Limpe o cadastro da Deodoro (02-clear-all-data-central.sql) antes do
--    provisionamento do Mogi.
--
-- Objetivo: criar um device "fake" (sem hardware Modbus) que aparece como card
--           PLUG (toggle on/off) no app, agrupado num ambient "MQTT Sync".
--
-- ⚠️ NOME ESPECIALIZADO POR CENTRAL (banco E ThingsBoard):
--   - NESTA central o slave/channel/ambient são criados já com o nome
--     especializado 'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9'
--     (uuid = CENTRAL_UUID da env do Node-RED desta central).
--   - As functions PG get/set_mqtt_sync_status() usam LIKE 'MQTT Sync%',
--     então funcionam com o nome especializado E com o legado ('MQTT Sync').
--   - No THINGSBOARD o gateway cria o device com o MESMO nome, montado nas
--     functions JS via env.get('CENTRAL_UUID') — ver attributes-sync.js /
--     status-sync.js em SA-CAVALCANTE/ (raiz da holding).
--
-- MODELO (igual ao "Desligar Automação" da Benfica / ILHA-PLAZA-AL1):
--   - 'plug' é um tipo de CHANNEL, não de slave: 1 slave 'outlet' (container)
--     + 1 channel 'plug' por cima, agrupado num ambient próprio.
--
-- ℹ️ addr_low é DINÂMICO (CTE next_addr): menor addr_low do banco + 1, pulando
--    para o próximo livre se ocupado (candidatos ≤247; 248-255 é faixa Modbus
--    reservada; banco vazio → 200). Preview do valor que será usado:
--      SELECT COALESCE(
--        (SELECT MIN(candidate)
--         FROM generate_series((SELECT MIN(addr_low) + 1 FROM slaves), 247) AS candidate
--         WHERE candidate NOT IN (SELECT addr_low FROM slaves)),
--        200) AS addr_low_que_sera_usado;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICAÇÃO PRÉVIA (rode antes, principalmente em banco RESTAURADO de backup —
-- o MQTT Sync pode já existir de uma configuração anterior):
--   SELECT 'slave'   AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
--   UNION ALL
--   SELECT 'channel', id, name        FROM channels WHERE name ILIKE '%mqtt%sync%'
--   UNION ALL
--   SELECT 'ambient', id, name        FROM ambients WHERE name ILIKE '%mqtt%sync%';
-- 0 linhas → pode rodar o create. Linhas existentes → NÃO rode; avalie renomear
-- para o padrão especializado em vez de duplicar:
--   UPDATE slaves   SET name = 'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', updated_at = now() WHERE name = 'MQTT Sync';
--   UPDATE channels SET name = 'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', updated_at = now() WHERE name = 'MQTT Sync';
--   UPDATE ambients SET name = 'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', updated_at = now() WHERE name = 'MQTT Sync';
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Guarda de idempotência: se QUALQUER objeto MQTT Sync já existir (slave,
-- channel ou ambient — legado ou especializado), aborta a transação inteira.
DO $$
DECLARE
  v_found TEXT;
BEGIN
  SELECT string_agg(obj || ' #' || id || ' "' || name || '"', ' · ')
    INTO v_found
  FROM (
    SELECT 'slave'   AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
    UNION ALL
    SELECT 'channel', id, name        FROM channels WHERE name ILIKE '%mqtt%sync%'
    UNION ALL
    SELECT 'ambient', id, name        FROM ambients WHERE name ILIKE '%mqtt%sync%'
  ) hits;
  IF v_found IS NOT NULL THEN
    RAISE EXCEPTION 'MQTT Sync JÁ EXISTE neste banco (%) — não rode o create de novo; se for o nome legado, use os UPDATEs de rename do cabeçalho.', v_found;
  END IF;
END $$;

WITH next_addr AS (
  -- (0) addr_low DINÂMICO: menor addr_low do banco + 1; se esse valor já
  --     estiver em uso, pula para o PRÓXIMO livre (candidatos até 247 —
  --     248-255 é faixa Modbus reservada). Banco vazio → fallback 200.
  SELECT COALESCE(
    (SELECT MIN(candidate)
     FROM generate_series((SELECT MIN(addr_low) + 1 FROM slaves), 247) AS candidate
     WHERE candidate NOT IN (SELECT addr_low FROM slaves)),
    200
  ) AS addr_low
),
new_slave AS (
  -- (1) Slave container 'outlet' (tipo válido; NÃO 3F).
  INSERT INTO slaves (
    type, addr_low, addr_high, channels, name, color, code,
    clamp_type, aggregate, version, temperature_correction, config,
    created_at, updated_at
  )
  SELECT
    'outlet', next_addr.addr_low, 249, 1,
    'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', NULL, '002-002-002-012',
    NULL, true, '6.0.0', NULL,
    '{"virtual":true,"source":"mqttSyncStatus"}',
    now(), now()
  FROM next_addr
  RETURNING id
),
new_channel AS (
  -- (2) Channel 'plug' (o toggle visível) sobre o slave container — channel 0.
  INSERT INTO channels (
    type, channel, name, channel_id, slave_id, scene_up_id, scene_down_id,
    config, created_at, updated_at
  )
  SELECT 'plug', 0, 'MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', NULL, id, NULL, NULL,
         '{"confirm":false}', now(), now()
  FROM new_slave
  RETURNING slave_id
),
new_ambient AS (
  -- (3) Ambient "MQTT Sync - <uuid>".
  INSERT INTO ambients (name, image, "order", config, created_at, updated_at)
  VALUES ('MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', NULL, NULL, NULL, now(), now())
  RETURNING id
)
-- (4) Vincula o slave ao ambient (junction; created_at/updated_at obrigatórios).
INSERT INTO ambients_rfir_slaves_rel (slave_id, ambient_id, created_at, updated_at)
SELECT (SELECT id FROM new_slave), (SELECT id FROM new_ambient), now(), now();

-- Confira antes do COMMIT:
--   SELECT id, name, type, addr_low, addr_high, config FROM slaves   WHERE name LIKE 'MQTT Sync%';
--   SELECT id, type, channel, name, slave_id           FROM channels WHERE name LIKE 'MQTT Sync%';
--   SELECT id, name, config                            FROM ambients WHERE name LIKE 'MQTT Sync%';

COMMIT;
-- ROLLBACK;  -- use no lugar do COMMIT para testar sem gravar

-- =============================================================================
-- ROLLBACK MANUAL (se precisar desfazer):
--   DELETE FROM ambients_rfir_slaves_rel
--     WHERE slave_id = (SELECT id FROM slaves WHERE name LIKE 'MQTT Sync%');
--   DELETE FROM channels WHERE name LIKE 'MQTT Sync%';
--   DELETE FROM ambients WHERE name LIKE 'MQTT Sync%';
--   DELETE FROM slaves   WHERE name LIKE 'MQTT Sync%';
-- =============================================================================
