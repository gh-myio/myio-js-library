-- =============================================================================
-- MOXUARA 2.0 — rename do MQTT Sync para o CENTRAL_UUID da central NOVA
-- (2026-07-13)
--
-- Contexto: a Moxuara original (CENTRAL_UUID e982edf9-edb1-4aa6-8a14-4782465ae5a3,
-- IPv6 202:1567:faee:79ef:486:6d44:d391:fb18) foi INATIVADA e substituída por
-- DUAS centrais novas, ambas com banco restaurado do backup da antiga — por
-- isso o slave virtual MQTT Sync chega com o UUID VELHO no nome em ambas:
--
--   A) Central Moxuara 2.0 - 2026-07-13
--      CENTRAL_UUID 6e88d9be-e351-4a8a-aa02-2a2222fcb22b
--      IPv6 201:bc00:2a0e:6e36:a50f:9ef6:9b23:d097
--
--   B) Central Moxuara 2.0 - ENTRADA - TRAFO - 2026-07-13
--      CENTRAL_UUID 6d7cd66a-c6dd-40df-b40b-e1bad295e424
--      IPv6 200:b2d6:a485:7a30:364b:424c:cafa:141c
--
-- ⚠️ Execute APENAS o bloco da central onde você está logado (confira antes:
--    systemctl show myio-api.service -p Environment | grep -o 'CENTRAL_UUID=[^ ]*').
--
-- As functions get/set_mqtt_sync_status usam LIKE 'MQTT Sync%' (indiferentes ao
-- rename); o config do slave (mqttSyncStatus etc.) fica intacto.
--
-- Pós-rename (em cada central):
--   1) env CENTRAL_UUID do Node-RED = o uuid usado no rename (nomeia o device TB);
--   2) se o gateway já criou o device TB com o nome antigo, remover o órfão.
-- =============================================================================

-- ─── BLOCO A — Central Moxuara 2.0 (6e88d9be…) ──────────────────────────────
-- BEGIN;
-- UPDATE slaves
-- SET name = 'MQTT Sync - 6e88d9be-e351-4a8a-aa02-2a2222fcb22b', updated_at = now()
-- WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';
-- UPDATE channels
-- SET name = 'MQTT Sync - 6e88d9be-e351-4a8a-aa02-2a2222fcb22b', updated_at = now()
-- WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';
-- UPDATE ambients
-- SET name = 'MQTT Sync - 6e88d9be-e351-4a8a-aa02-2a2222fcb22b', updated_at = now()
-- WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';
-- COMMIT;

-- ─── BLOCO B — Central Moxuara 2.0 ENTRADA-TRAFO (6d7cd66a…) ────────────────
BEGIN;

UPDATE slaves
SET name = 'MQTT Sync - 6d7cd66a-c6dd-40df-b40b-e1bad295e424', updated_at = now()
WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';

UPDATE channels
SET name = 'MQTT Sync - 6d7cd66a-c6dd-40df-b40b-e1bad295e424', updated_at = now()
WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';

UPDATE ambients
SET name = 'MQTT Sync - 6d7cd66a-c6dd-40df-b40b-e1bad295e424', updated_at = now()
WHERE name = 'MQTT Sync - e982edf9-edb1-4aa6-8a14-4782465ae5a3';

COMMIT;

-- Conferência (3 objetos com o UUID da central local):
--   SELECT 'slave' AS obj, id, name FROM slaves   WHERE name LIKE 'MQTT Sync%'
--   UNION ALL
--   SELECT 'channel', id, name      FROM channels WHERE name LIKE 'MQTT Sync%'
--   UNION ALL
--   SELECT 'ambient', id, name      FROM ambients WHERE name LIKE 'MQTT Sync%';
