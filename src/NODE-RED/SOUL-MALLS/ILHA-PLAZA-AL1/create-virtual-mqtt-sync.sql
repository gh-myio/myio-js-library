-- =============================================================================
-- Ilha Plaza AL1 (Soul Malls) — Produto VIRTUAL "MQTT Sync" (plug)
-- Central: Ilha Plaza AL1 · Gateway 81a60176-222c-4bb9-88f5-bc2b47802d82
-- Banco: hubot (PostgreSQL, na própria central OrangePi)
--
-- Objetivo: criar um device "fake" (sem hardware Modbus) que aparece como card
--           PLUG (toggle on/off) no app, agrupado num ambient "MQTT Sync".
--
-- MODELO (igual ao "Desligar Automação" da Benfica):
--   - 'plug' é um tipo de CHANNEL, não de slave. O toggle "Automação Obramax" da
--     Benfica é um channel plug (id 70) sobre o slave 26 (type 'outlet').
--   - Aqui replicamos isso: 1 slave 'outlet' (container) + 1 channel 'plug' por cima.
--
-- ✅ SCHEMA CONFIRMADO via logsMaps.log (2026-06-17):
--   - slaves/ambients/channels têm id por sequence (nextval) → 'id' omitido.
--   - Associação slave↔ambient é pela junction ambients_rfir_slaves_rel
--     (PK (slave_id, ambient_id); created_at/updated_at NOT NULL SEM default → preencher!).
--
-- ⚠️ DECISÕES CONFIRMADAS:
--   - Device VIRTUAL/FAKE (sem slave Modbus físico).
--   - Card aparece OFFLINE no app local — ACEITO (status local vem do polling Modbus).
-- =============================================================================

BEGIN;

WITH new_slave AS (
  -- (1) Slave container 'outlet' (tipo válido; NÃO 3F).
  --     addr_low = 200: livre (não usado por nenhum slave) e ≤247 (fora da faixa
  --     reservada Modbus 248-255 — por isso 255 foi descartado). Par 200/249 livre.
  INSERT INTO slaves (
    type, addr_low, addr_high, channels, name, color, code,
    clamp_type, aggregate, version, temperature_correction, config,
    created_at, updated_at
  )
  VALUES (
    'outlet', 200, 249, 1, 'MQTT Sync', NULL, '002-002-002-012',
    NULL, true, '6.0.0', NULL,
    '{"virtual":true,"source":"mqttSyncStatus"}',
    now(), now()
  )
  RETURNING id
),
new_channel AS (
  -- (2) Channel 'plug' (o toggle visível) sobre o slave container — channel 0.
  INSERT INTO channels (
    type, channel, name, channel_id, slave_id, scene_up_id, scene_down_id,
    config, created_at, updated_at
  )
  SELECT 'plug', 0, 'MQTT Sync', NULL, id, NULL, NULL,
         '{"confirm":false}', now(), now()
  FROM new_slave
  RETURNING slave_id
),
new_ambient AS (
  -- (3) Ambient "MQTT Sync" (config NULL — convenção desta central).
  INSERT INTO ambients (name, image, "order", config, created_at, updated_at)
  VALUES ('MQTT Sync', NULL, NULL, NULL, now(), now())
  RETURNING id
)
-- (4) Vincula o slave ao ambient (junction; created_at/updated_at obrigatórios).
INSERT INTO ambients_rfir_slaves_rel (slave_id, ambient_id, created_at, updated_at)
SELECT (SELECT id FROM new_slave), (SELECT id FROM new_ambient), now(), now();

-- Confira antes do COMMIT:
--   SELECT id, name, type, addr_low, addr_high, config FROM slaves   WHERE name = 'MQTT Sync';
--   SELECT id, type, channel, name, slave_id          FROM channels WHERE name = 'MQTT Sync';
--   SELECT id, name, config                            FROM ambients WHERE name = 'MQTT Sync';

COMMIT;
-- ROLLBACK;  -- use no lugar do COMMIT para testar sem gravar

-- =============================================================================
-- ROLLBACK MANUAL (se precisar desfazer):
--   DELETE FROM ambients_rfir_slaves_rel
--     WHERE slave_id = (SELECT id FROM slaves WHERE name = 'MQTT Sync');
--   DELETE FROM channels WHERE name = 'MQTT Sync';
--   DELETE FROM ambients WHERE name = 'MQTT Sync';
--   DELETE FROM slaves   WHERE name = 'MQTT Sync';
-- =============================================================================
