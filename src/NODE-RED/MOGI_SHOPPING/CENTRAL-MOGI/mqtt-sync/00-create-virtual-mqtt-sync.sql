BEGIN;

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
    RAISE EXCEPTION 'MQTT Sync JÁ EXISTE neste banco (%) — não rode o create de novo; se for o nome legado, use os UPDATEs de rename do 00-create-virtual-mqtt-sync.bkp.sql.', v_found;
  END IF;
END $$;

WITH next_addr AS (
  SELECT COALESCE(
    (SELECT MIN(candidate)
     FROM generate_series((SELECT MIN(addr_low) + 1 FROM slaves), 247) AS candidate
     WHERE candidate NOT IN (SELECT addr_low FROM slaves)),
    200
  ) AS addr_low
),
new_slave AS (
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
  INSERT INTO ambients (name, image, "order", config, created_at, updated_at)
  VALUES ('MQTT Sync - da4f38b5-06e6-4f86-8705-c1e23f2639f9', NULL, NULL, NULL, now(), now())
  RETURNING id
)
INSERT INTO ambients_rfir_slaves_rel (slave_id, ambient_id, created_at, updated_at)
SELECT (SELECT id FROM new_slave), (SELECT id FROM new_ambient), now(), now();

COMMIT;
