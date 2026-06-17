-- GET /api/mqttSyncStatus — lê o status persistido em slaves.config do slave
-- virtual "MQTT Sync". Devolve 1 row com a coluna mqtt_sync_status (enable|disable|NULL).
SELECT config::jsonb->>'mqttSyncStatus' AS mqtt_sync_status
FROM slaves
WHERE name = 'MQTT Sync'
ORDER BY id
LIMIT 1;
