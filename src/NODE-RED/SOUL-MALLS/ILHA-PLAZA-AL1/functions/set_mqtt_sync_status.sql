-- set_mqtt_sync_status() — persiste o estado do MQTT Sync (RFC mqttSyncStatus)
--
-- Mesma pegada do provision_central(): recebe o JSONB do POST cru, faz o trabalho
-- de banco de forma atômica e devolve um JSONB de resultado (consumido pelo
-- format-return-response.js do flow).
--
-- Aceita o ENVELOPE v2 (setMqttSyncStatus-payload.example.json) e também a forma
-- simples { "mqttSyncStatus": "enable" }.
--
-- Derivações a partir do envelope v2:
--   status: intent DISABLE/FORCE_DISABLE → 'disable' · ENABLE/FORCE_ENABLE → 'enable'
--           QUERY → read-only (não grava, devolve o status atual)
--           (ou, na forma simples, lê de mqttSyncStatus|status)
--   user:   actor.user.userName → actor.user.userId → actor.system → user → 'system'
--   slave:  slave_id explícito; senão o slave virtual "MQTT Sync"
--
-- O que faz quando há mudança (intent != QUERY):
--   1) GRAVA em slaves.config a propriedade mqttSyncStatus (merge, sem clobber);
--   2) AUDITA na tabela logs (value: enable=1, disable=0).
--
-- ⚠️ Esta é a CAMADA DE PERSISTÊNCIA (logs + slaves.config). A lógica de
--    holds/TTL/reference-counting (effectiveStatus) vive nas functions v2/ —
--    aqui apenas persistimos o status efetivo informado/derivado.
--
-- Retorno:
--   { "ok": true, "mqttSyncStatus": "...", "previousStatus": "...",
--     "changed": bool, "slaveId": N, "user": "...", "intent": "...",
--     "requestId": "...", "correlationId": "..." }

CREATE OR REPLACE FUNCTION set_mqtt_sync_status(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_intent   TEXT;
  v_status   TEXT;
  v_user     TEXT;
  v_slave_id INTEGER;
  v_value    INTEGER;
  v_prev     TEXT;
  v_reqid    TEXT;
  v_corrid   TEXT;
  v_now      TIMESTAMPTZ;
BEGIN
  v_now    := now();
  v_intent := upper(COALESCE(payload->>'intent', ''));
  v_reqid  := payload#>>'{request,requestId}';
  v_corrid := payload#>>'{request,correlationId}';

  -- user: actor.user.userName → actor.user.userId → actor.system → user → 'system'
  v_user := COALESCE(
    NULLIF(payload#>>'{actor,user,userName}', ''),
    NULLIF(payload#>>'{actor,user,userId}',   ''),
    NULLIF(payload#>>'{actor,system}',        ''),
    NULLIF(payload->>'user',                  ''),
    'system'
  );

  -- slave alvo: slave_id explícito; senão, o slave virtual "MQTT Sync"
  v_slave_id := NULLIF(payload->>'slave_id', '')::INTEGER;
  IF v_slave_id IS NULL THEN
    SELECT id INTO v_slave_id FROM slaves WHERE name = 'MQTT Sync' ORDER BY id LIMIT 1;
  END IF;
  IF v_slave_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no target slave (passe slave_id ou crie o slave "MQTT Sync" antes)'
    );
  END IF;

  SELECT config::jsonb->>'mqttSyncStatus' INTO v_prev FROM slaves WHERE id = v_slave_id;

  -- QUERY: read-only — devolve o status persistido (default 'enable'), sem gravar
  IF v_intent = 'QUERY' THEN
    RETURN jsonb_build_object(
      'ok', true, 'intent', 'QUERY',
      'mqttSyncStatus', COALESCE(v_prev, 'enable'),
      'previousStatus', v_prev, 'changed', false,
      'slaveId', v_slave_id, 'user', v_user,
      'requestId', v_reqid, 'correlationId', v_corrid
    );
  END IF;

  -- status: forma simples OU derivado do intent
  v_status := lower(COALESCE(NULLIF(payload->>'mqttSyncStatus',''), NULLIF(payload->>'status','')));
  IF v_status IS NULL THEN
    v_status := CASE v_intent
                  WHEN 'DISABLE'       THEN 'disable'
                  WHEN 'FORCE_DISABLE' THEN 'disable'
                  WHEN 'ENABLE'        THEN 'enable'
                  WHEN 'FORCE_ENABLE'  THEN 'enable'
                  ELSE NULL
                END;
  END IF;
  IF v_status NOT IN ('enable', 'disable') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'status indefinido: informe intent (DISABLE|ENABLE|FORCE_*|QUERY) ou mqttSyncStatus (enable|disable)',
      'intent', NULLIF(v_intent, '')
    );
  END IF;

  -- 1) persiste em slaves.config (merge — não sobrescreve channelConfig/virtual/etc.)
  --    lastUpdateChange = timestamp ISO da última mudança; lastUpdateBy = quem alterou.
  UPDATE slaves
  SET config = (COALESCE(config::jsonb, '{}'::jsonb)
                || jsonb_build_object(
                     'mqttSyncStatus',   v_status,
                     'lastUpdateChange', to_jsonb(v_now),
                     'lastUpdateBy',     v_user
                   ))::json,
      updated_at = v_now
  WHERE id = v_slave_id;

  -- 2) auditoria em logs (value: enable=1, disable=0; "user" é palavra reservada)
  v_value := CASE WHEN v_status = 'enable' THEN 1 ELSE 0 END;
  INSERT INTO logs (timestamp, type, action_type, "user", slave_id, value)
  VALUES (v_now, 'mqtt_sync', COALESCE(NULLIF(v_intent, ''), 'setMqttSyncStatus'),
          v_user, v_slave_id, v_value);

  RETURN jsonb_build_object(
    'ok', true,
    'mqttSyncStatus', v_status,
    'previousStatus', v_prev,
    'changed', (v_prev IS DISTINCT FROM v_status),
    'lastUpdateChange', to_jsonb(v_now),
    'lastUpdateBy', v_user,
    'slaveId', v_slave_id,
    'user', v_user,
    'intent', NULLIF(v_intent, ''),
    'requestId', v_reqid,
    'correlationId', v_corrid
  );
END;
$$;
