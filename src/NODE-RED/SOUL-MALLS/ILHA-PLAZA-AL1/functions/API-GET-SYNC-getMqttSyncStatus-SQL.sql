-- GET /api/mqttSyncStatus — lê (e grava o default na primeira vez) via função.
-- Sempre retorna 1 row com a coluna mqtt_sync_status (enable|disable).
SELECT get_mqtt_sync_status() AS mqtt_sync_status;
