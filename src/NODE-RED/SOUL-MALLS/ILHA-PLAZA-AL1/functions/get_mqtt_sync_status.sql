-- get_mqtt_sync_status() — lê o status persistido em slaves.config do slave
-- virtual "MQTT Sync" e, na PRIMEIRA vez (sem valor no banco), grava o default
-- 'enable' (write-on-miss). Atômico — sem race entre ler e gravar.
--
-- Retorno: TEXT 'enable' | 'disable'.
--   - slave "MQTT Sync" inexistente → devolve 'enable' (não há onde persistir).
--   - config sem mqttSyncStatus      → grava 'enable' e devolve 'enable'.
--   - config com valor               → devolve o valor (sem gravar).

CREATE OR REPLACE FUNCTION get_mqtt_sync_status()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_slave_id INTEGER;
  v_status   TEXT;
BEGIN
  SELECT id, config::jsonb->>'mqttSyncStatus'
    INTO v_slave_id, v_status
  FROM slaves WHERE name = 'MQTT Sync' ORDER BY id LIMIT 1;

  -- slave virtual ainda não existe → nada pra persistir; default em memória
  IF v_slave_id IS NULL THEN
    RETURN 'enable';
  END IF;

  -- primeira vez (sem valor) → grava o default uma única vez
  IF v_status IS NULL OR v_status = '' THEN
    v_status := 'enable';
    UPDATE slaves
    SET config = (COALESCE(config::jsonb, '{}'::jsonb)
                  || jsonb_build_object('mqttSyncStatus', v_status))::json,
        updated_at = NOW()
    WHERE id = v_slave_id;
  END IF;

  RETURN v_status;
END;
$$;
