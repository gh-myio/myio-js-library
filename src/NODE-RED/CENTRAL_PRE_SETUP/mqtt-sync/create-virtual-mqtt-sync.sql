-- =============================================================================
-- CENTRAL PRE-SETUP — Produto VIRTUAL "MQTT Sync" (plug)
-- Central: Pre-Setup · CENTRAL_UUID a77ac87c-addd-4172-a65f-0f6f6038e98e
-- IPv6 (Yggdrasil): 204:12fb:5518:d04:d9e1:360d:4ab0:125b
-- Banco: hubot (PostgreSQL, na própria central OrangePi)
--
-- Objetivo: criar um device "fake" (sem hardware Modbus) que aparece como card
--           PLUG (toggle on/off) no app, agrupado num ambient "MQTT Sync".
--
-- ⚠️ NOME ESPECIALIZADO POR CENTRAL (banco E ThingsBoard):
--   - NESTA central o slave/channel/ambient são criados já com o nome
--     especializado 'MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e'
--     (uuid colocado NA MÃO — igual ao CENTRAL_UUID da env do Node-RED).
--   - As functions PG get/set_mqtt_sync_status() usam LIKE 'MQTT Sync%',
--     então funcionam com o nome especializado E com o legado ('MQTT Sync').
--   - No THINGSBOARD o gateway cria o device com o MESMO nome, montado nas
--     functions JS via env.get('CENTRAL_UUID') — ver attributes-sync.js /
--     status-sync.js desta pasta.
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

BEGIN;

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
    'MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e', NULL, '002-002-002-012',
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
  SELECT 'plug', 0, 'MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e', NULL, id, NULL, NULL,
         '{"confirm":false}', now(), now()
  FROM new_slave
  RETURNING slave_id
),
new_ambient AS (
  -- (3) Ambient "MQTT Sync - <uuid>".
  INSERT INTO ambients (name, image, "order", config, created_at, updated_at)
  VALUES ('MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e', NULL, NULL, NULL, now(), now())
  RETURNING id
)
-- (4) Vincula o slave ao ambient (junction; created_at/updated_at obrigatórios).
INSERT INTO ambients_rfir_slaves_rel (slave_id, ambient_id, created_at, updated_at)
SELECT (SELECT id FROM new_slave), (SELECT id FROM new_ambient), now(), now();

-- Confira antes do COMMIT:
--   SELECT id, name, type, addr_low, addr_high, config FROM slaves   WHERE name LIKE 'MQTT Sync%';
--   SELECT id, type, channel, name, slave_id          FROM channels WHERE name LIKE 'MQTT Sync%';
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
