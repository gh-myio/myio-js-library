-- provision_central() — v5 (multi-channel per slave, RFC-0003)
--
-- v4 created exactly ONE channel per slave (channel=1, channels=1 hardcoded).
-- v5 adds per-board CHANNELS: when a device entry carries `channels[]`, the
-- function creates one `channels` row per entry and sets `slaves.channels = N`.
-- Back-compatible: a device WITHOUT `channels` still gets a single default
-- channel exactly like v4.
--
-- Channel entry shape (payload.devices[].channels[]):
--   { "channel": 0, "name": "Energia", "type": "presence_sensor",
--     "config": { "remoteInput": true, "pulses": 1 } }
--
-- Idempotency: channels are REPLACED for the slave on each provision (DELETE +
-- re-INSERT) so renames/retypes/removals converge. Timeseries (channel_pulse_log
-- etc.) are NOT touched. All v2/v3/v4 ops (remove[], rename[], cleanup_ambients[],
-- explicit slave_id) are unchanged.
--
-- v5.4 (2026-10-19): a device of type three_phase_sensor WITHOUT `channels` no
-- longer gets the v4 default channel — it is created with 0 channel rows and
-- slaves.channels = 0, like the central itself reports it ("channels": []).
--
-- v5.5 (2026-11-03): clamp (TC) OPCIONAL por device — payload.devices[].clamp_type,
-- inteiro 0..6 (0=50A 1=100A 2=400A 3=1000A 4=2000A 5=1600A 6=1000A). Grava nos
-- DOIS lugares, mantendo-os iguais (regra do manual das centrais §7):
--   - coluna slaves.clamp_type → é o que a agregação horária lê para o teto
--     anti-outlier ((value/3) <= amperes*220; NULL vira 0 = 50A e corta picos);
--   - slaves.config.config_clamp = {"confirmed":true,"value":N} (merge, preserva
--     channelConfig etc.) → o que a UI da central mostra.
-- Chave ausente → clamp atual intocado. Vale para slave criado E reusado; só faz
-- UPDATE se algum dos dois difere (slaves_clamp_updated). Valor fora de 0..6
-- (inclusive null) → errors[], slave segue sem mudar o clamp.
-- rename[] também aceita `clamp_type` (e `name` virou opcional), p/ ajustar o
-- clamp de um slave só: {"rename":[{"slave_id":143,"clamp_type":1}]}.
--
-- v5.6 (2026-11-05): payload.rename_channels[] — renomeia UM canal, sem tocar em
-- slaves.name, nos outros canais nem em rfir_devices (o rename[] renomeia o slave
-- e TODOS os canais dele: num hidrômetro o ch0 "Energia" viraria "HIDR. … x10").
--   {"rename_channels":[{"slave_id":232,"channel":1,"type":"flow_sensor",
--                        "name":"HIDR. SCMOXUARA108BL1 x10"}]}
-- slave_id + channel + name obrigatórios; type opcional, mas necessário quando o
-- slave tem 2 rows no mesmo nº de canal (ex.: ch0 presence_sensor + ch0 lamp).
-- Só faz UPDATE se casar EXATAMENTE 1 row; 0 ou >1 → errors[], nada muda.
-- Nome igual ao atual → no-op. Contador: channels_renamed_single.
-- Array de topo (e não `channel` dentro de rename[]) de propósito: provision
-- antigo ignora chave de topo desconhecida, mas ignoraria `channel` dentro do
-- rename[] e faria o rename completo. Consumidor deve checar result.version
-- >= '5.6' (ou a presença de channels_renamed_single) antes de confiar na escrita.

CREATE OR REPLACE FUNCTION provision_central(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  device JSONB;
  channel JSONB;
  remove_entry JSONB;
  rename_entry JSONB;
  cleanup_amb_entry JSONB;
  env_entry JSONB;
  env_key TEXT;
  env_value TEXT;
  ambient_name TEXT;
  ambient_id_var INTEGER;
  slave_id_var INTEGER;
  explicit_slave_id INTEGER;
  rfir_id_var INTEGER;
  device_name TEXT;
  existing_name TEXT;
  new_name TEXT;
  rm_name TEXT;
  slave_type TEXT;
  -- v5.3 — versão do slave configurável via payload.version (default '6.0.0').
  slave_version TEXT;
  ambient_map JSONB := '{}'::JSONB;
  is_ac BOOLEAN;
  has_rfir BOOLEAN;
  slave_was_created BOOLEAN;
  channel_count INT;
  rel_count INT;
  -- v5.1 — Modbus wiring assembled into slaves.config.channelConfig
  channel_config JSONB;
  ch_cfg JSONB;
  ch_idx INT;
  mb_type TEXT;
  -- v5.2 — quando true, os channels são SÓ pra montar o channelConfig (Modbus)
  -- e NÃO viram channel rows (ex.: sensor de temperatura: outlet, 0 rows, mas
  -- channelConfig REMOTE_INPUT+PULSE_ON_POWER — cf. Rio Poty "TEMP. …").
  cfg_only BOOLEAN;
  rows_created INT;
  -- v5.5 — clamp opcional (payload.devices[].clamp_type)
  clamp_val INT;
  clamp_cfg JSONB;
  -- v5.6 — rename_channels[]
  rename_ch_entry JSONB;
  rc_channel INT;
  rc_type TEXT;
  rc_matches INT;
  rc_row_id INT;
  result JSONB := '{
    "version":"5.6",
    "ambients_created":0, "ambients_reused":0,
    "ambients_cleaned":0, "ambient_rels_cleaned":0,
    "slaves_created":0, "slaves_reused":0,
    "slaves_removed":0, "slaves_renamed":0,
    "slaves_clamp_updated":0,
    "channels_created":0, "channels_reused":0,
    "channels_removed":0, "channels_renamed":0,
    "channels_renamed_single":0,
    "rfir_devices_created":0, "rfir_devices_reused":0,
    "rfir_devices_removed":0, "rfir_devices_renamed":0,
    "environment_updated":[],
    "errors":[]
  }'::JSONB;
BEGIN
  -- v5.3 — versão aplicada a TODOS os slaves deste provisionamento.
  -- payload.version (mesmo '') manda; ausente → '6.0.0' (default).
  slave_version := COALESCE(payload->>'version', '6.0.0');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 0) ENVIRONMENT — payload.environment[] (v5.4)
  -- Array de {key, value}, irmão de payload.devices[] — mesmo padrão de loop
  -- (jsonb_array_elements). Upsert genérico na tabela `environment`: aceita
  -- qualquer chave (CENTRAL_ID, FREQUENCY, e o que mais surgir depois) sem
  -- precisar de código novo por propriedade. Chave normalizada p/ MAIÚSCULO
  -- (convenção já usada nas linhas existentes da tabela). Upsert manual
  -- (UPDATE, senão INSERT) por não haver constraint UNIQUE confirmada em
  -- environment.key para usar ON CONFLICT.
  -- ─────────────────────────────────────────────────────────────────────────
  FOR env_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'environment', '[]'::jsonb))
  LOOP
    env_key := UPPER(env_entry->>'key');
    env_value := env_entry->>'value';
    IF env_key IS NOT NULL THEN
      UPDATE environment SET value = env_value WHERE key = env_key;
      IF NOT FOUND THEN
        INSERT INTO environment (key, value) VALUES (env_key, env_value);
      END IF;
      result := jsonb_set(result, '{environment_updated}', (result->'environment_updated') || to_jsonb(env_key));
    END IF;
  END LOOP;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1) ADD/REUSE — slave_id-aware (v4) + multi-channel (v5)
  -- ─────────────────────────────────────────────────────────────────────────
  FOR device IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'devices', '[]'::jsonb))
  LOOP
    ambient_name := (
      SELECT elem FROM jsonb_array_elements_text(device->'hierarchyPath')
        WITH ORDINALITY AS t(elem, ord)
      ORDER BY ord DESC LIMIT 1
    );
    IF ambient_name IS NULL THEN ambient_name := 'default'; END IF;
    -- Remove o prefixo "ASSET " do nome do ambient salvo na central
    -- (ex.: "ASSET Depósito Subsolo" → "Depósito Subsolo").
    ambient_name := regexp_replace(ambient_name, '^ASSET\s+', '');

    -- get-or-create ambient (unchanged)
    IF ambient_map ? ambient_name THEN
      ambient_id_var := (ambient_map->>ambient_name)::INTEGER;
    ELSE
      SELECT id INTO ambient_id_var FROM ambients WHERE name = ambient_name LIMIT 1;
      IF ambient_id_var IS NULL THEN
        INSERT INTO ambients (name, "order", config, created_at, updated_at)
        VALUES (ambient_name, 0, '{}'::json, NOW(), NOW())
        RETURNING id INTO ambient_id_var;
        result := jsonb_set(result, '{ambients_created}', to_jsonb((result->>'ambients_created')::INT + 1));
      ELSE
        result := jsonb_set(result, '{ambients_reused}', to_jsonb((result->>'ambients_reused')::INT + 1));
      END IF;
      ambient_map := ambient_map || jsonb_build_object(ambient_name, ambient_id_var);
    END IF;

    device_name := device->>'name';
    is_ac := device_name LIKE 'AC %';

    IF is_ac THEN
      rm_name := 'RM ' || substring(device_name from 4);
      slave_type := 'remote';
    ELSE
      rm_name := device_name;
      slave_type := COALESCE(device->>'type','outlet');
    END IF;

    -- slave create/reuse (v4) — sets slave_id_var + slave_was_created
    explicit_slave_id := (device->>'slave_id')::INTEGER;
    slave_id_var := NULL;
    slave_was_created := FALSE;

    IF explicit_slave_id IS NOT NULL THEN
      SELECT name INTO existing_name FROM slaves WHERE id = explicit_slave_id;
      IF existing_name IS NULL THEN
        INSERT INTO slaves (id, name, type, addr_low, addr_high, channels, aggregate, version, created_at, updated_at)
        VALUES (explicit_slave_id, rm_name, slave_type,
                (device->>'addr_low')::INT, (device->>'addr_high')::INT,
                1, TRUE, slave_version, NOW(), NOW())
        RETURNING id INTO slave_id_var;
        slave_was_created := TRUE;
        result := jsonb_set(result, '{slaves_created}', to_jsonb((result->>'slaves_created')::INT + 1));
      ELSE
        slave_id_var := explicit_slave_id;
        IF existing_name <> rm_name THEN
          UPDATE slaves SET name = rm_name, updated_at = NOW() WHERE id = slave_id_var;
          result := jsonb_set(result, '{slaves_renamed}', to_jsonb((result->>'slaves_renamed')::INT + 1));
        ELSE
          result := jsonb_set(result, '{slaves_reused}', to_jsonb((result->>'slaves_reused')::INT + 1));
        END IF;
      END IF;
    ELSE
      SELECT id INTO slave_id_var FROM slaves WHERE name = rm_name LIMIT 1;
      IF slave_id_var IS NULL THEN
        INSERT INTO slaves (name, type, addr_low, addr_high, channels, aggregate, version, created_at, updated_at)
        VALUES (rm_name, slave_type,
                (device->>'addr_low')::INT, (device->>'addr_high')::INT,
                1, TRUE, slave_version, NOW(), NOW())
        RETURNING id INTO slave_id_var;
        slave_was_created := TRUE;
        result := jsonb_set(result, '{slaves_created}', to_jsonb((result->>'slaves_created')::INT + 1));
      ELSE
        result := jsonb_set(result, '{slaves_reused}', to_jsonb((result->>'slaves_reused')::INT + 1));
      END IF;
    END IF;

    -- v5.3 — slave REUSADO: atualiza o version para o configurado (corrige '1.0.0'
    -- antigos e mantém consistente entre re-provisionamentos).
    IF NOT slave_was_created THEN
      UPDATE slaves SET version = slave_version, updated_at = NOW()
       WHERE id = slave_id_var AND version IS DISTINCT FROM slave_version;
    END IF;

    -- v5.5 — clamp opcional: só age se a chave `clamp_type` vier no device.
    -- Coluna e config_clamp sempre gravados juntos (ver cabeçalho).
    IF (device ? 'clamp_type') THEN
      IF jsonb_typeof(device->'clamp_type') = 'number'
         AND (device->>'clamp_type') ~ '^[0-6]$' THEN
        clamp_val := (device->>'clamp_type')::INT;
        clamp_cfg := jsonb_build_object('confirmed', true, 'value', clamp_val);
        UPDATE slaves
        SET clamp_type = clamp_val,
            config = (COALESCE(config::jsonb, '{}'::jsonb) || jsonb_build_object('config_clamp', clamp_cfg))::json,
            updated_at = NOW()
        WHERE id = slave_id_var
          AND (clamp_type IS DISTINCT FROM clamp_val
               OR (config::jsonb -> 'config_clamp') IS DISTINCT FROM clamp_cfg);
        IF FOUND THEN
          result := jsonb_set(result, '{slaves_clamp_updated}', to_jsonb((result->>'slaves_clamp_updated')::INT + 1));
        END IF;
      ELSE
        result := jsonb_set(result, '{errors}', (result->'errors') || jsonb_build_object(
          'slave_id', slave_id_var, 'name', rm_name,
          'error', 'clamp_type inválido (esperado inteiro 0..6): ' || COALESCE(device->>'clamp_type', 'null')));
      END IF;
    END IF;

    -- ── channels (v5) ──────────────────────────────────────────────────────
    -- If the device carries the `channels` key (mesmo que vazio []), REPLACE the
    -- slave's channels with exactly those entries (idempotent) — uma lista vazia
    -- cria 0 channel rows (ex.: sensor de temperatura nativo, que não tem canais
    -- de I/O — cf. Benfica "Temperatura Ambiente Central"). Só quando a chave
    -- `channels` está AUSENTE caímos no v4: 1 canal default no create.
    IF (device ? 'channels') THEN
      DELETE FROM channels WHERE slave_id = slave_id_var;
      channel_count := 0;
      rows_created := 0;
      channel_config := '{}'::JSONB;
      cfg_only := COALESCE((device->>'channelsConfigOnly')::BOOLEAN, FALSE);
      FOR channel IN SELECT value FROM jsonb_array_elements(device->'channels')
      LOOP
        ch_cfg := COALESCE(channel->'config', '{}'::jsonb);
        -- channelsConfigOnly: NÃO cria channel row, só usa o config pra montar
        -- o channelConfig do slave (sensor de temperatura).
        IF NOT cfg_only THEN
          INSERT INTO channels (type, channel, name, slave_id, config, created_at, updated_at)
          VALUES (
            COALESCE(channel->>'type', slave_type),
            COALESCE((channel->>'channel')::INT, channel_count),
            COALESCE(channel->>'name', rm_name),
            slave_id_var,
            ch_cfg::json,
            NOW(), NOW()
          );
          rows_created := rows_created + 1;
        END IF;
        -- v5.1 — derive Modbus channelConfig from the channel's config.
        -- countingPulseOnPower → PULSE_ON_POWER ; remoteInput → REMOTE_INPUT.
        -- Channels without a recognized Modbus config (lamp/plug/outlet outputs)
        -- are skipped. Keyed by the channel index ("channel0", "channel1", …).
        mb_type := NULL;
        IF COALESCE((ch_cfg->>'countingPulseOnPower')::BOOLEAN, FALSE) THEN
          mb_type := 'PULSE_ON_POWER';
        ELSIF COALESCE((ch_cfg->>'remoteInput')::BOOLEAN, FALSE) THEN
          mb_type := 'REMOTE_INPUT';
        END IF;
        IF mb_type IS NOT NULL THEN
          ch_idx := COALESCE((channel->>'channel')::INT, channel_count);
          channel_config := channel_config || jsonb_build_object(
            'channel' || ch_idx::TEXT,
            jsonb_build_object(
              'slaveId', slave_id_var,
              'channel', ch_idx,
              'channel_type', mb_type,
              'pulses', COALESCE((ch_cfg->>'pulses')::INT, 1),
              'output', 'HOLDING'
            )
          );
        END IF;
        channel_count := channel_count + 1;
      END LOOP;
      -- slaves.channels = nº de canais físicos da placa. Normalmente == nº de
      -- channel rows criadas, mas alguns devices (ex.: SCD) declaram mais canais
      -- físicos do que cadastram (só ch0). Honra o override `slave_channels`.
      UPDATE slaves
      SET channels = COALESCE((device->>'slave_channels')::INT, channel_count),
          updated_at = NOW()
      WHERE id = slave_id_var;
      -- Persist the assembled Modbus wiring on slaves.config (merge, don't clobber).
      IF channel_config <> '{}'::JSONB THEN
        UPDATE slaves
        SET config = (COALESCE(config::jsonb, '{}'::jsonb) || jsonb_build_object('channelConfig', channel_config))::json,
            updated_at = NOW()
        WHERE id = slave_id_var;
      END IF;
      result := jsonb_set(result, '{channels_created}', to_jsonb((result->>'channels_created')::INT + rows_created));
    ELSIF slave_was_created AND slave_type = 'three_phase_sensor' THEN
      -- v5.4 — trifasico nao tem canal de I/O: sem channel row e channels=0
      -- (a API da central responde "channels": [] para three_phase_sensor).
      -- Antes caia no default v4 e criava 1 canal lixo (channel=1, type
      -- three_phase_sensor) — cf. Taboao 2026-10-19, 05-fix-three-phase-channels.sql.
      UPDATE slaves SET channels = 0, updated_at = NOW() WHERE id = slave_id_var;
    ELSIF slave_was_created THEN
      INSERT INTO channels (type, channel, name, slave_id, config, created_at, updated_at)
      VALUES (slave_type, 1, rm_name, slave_id_var, '{}'::json, NOW(), NOW());
      result := jsonb_set(result, '{channels_created}', to_jsonb((result->>'channels_created')::INT + 1));
    ELSE
      result := jsonb_set(result, '{channels_reused}', to_jsonb((result->>'channels_reused')::INT + 1));
    END IF;

    -- link slave ↔ ambient
    INSERT INTO ambients_rfir_slaves_rel (ambient_id, slave_id, created_at, updated_at)
    VALUES (ambient_id_var, slave_id_var, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    -- AC also gets a rfir_device pointing to the RM slave (unchanged)
    IF is_ac THEN
      SELECT id INTO rfir_id_var FROM rfir_devices WHERE name = device_name LIMIT 1;
      IF rfir_id_var IS NULL THEN
        INSERT INTO rfir_devices (name, type, category, slave_id, created_at, updated_at)
        VALUES (device_name, COALESCE(device->>'type','outlet'), 'ac', slave_id_var, NOW(), NOW())
        RETURNING id INTO rfir_id_var;
        result := jsonb_set(result, '{rfir_devices_created}', to_jsonb((result->>'rfir_devices_created')::INT + 1));
      ELSE
        UPDATE rfir_devices SET slave_id = slave_id_var
          WHERE id = rfir_id_var AND slave_id IS NULL;
        result := jsonb_set(result, '{rfir_devices_reused}', to_jsonb((result->>'rfir_devices_reused')::INT + 1));
      END IF;

      INSERT INTO ambients_rfir_devices_rel (ambient_id, rfir_device_id, created_at, updated_at)
      VALUES (ambient_id_var, rfir_id_var, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2-4) REMOVE / RENAME / CLEANUP — identical to v4
  -- ─────────────────────────────────────────────────────────────────────────
  FOR remove_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'remove', '[]'::jsonb))
  LOOP
    slave_id_var := (remove_entry->>'slave_id')::INTEGER;
    DELETE FROM ambients_rfir_devices_rel
     WHERE rfir_device_id IN (SELECT id FROM rfir_devices WHERE slave_id = slave_id_var);
    DELETE FROM ambients_rfir_slaves_rel WHERE slave_id = slave_id_var;
    DELETE FROM rfir_devices WHERE slave_id = slave_id_var;
    IF FOUND THEN result := jsonb_set(result, '{rfir_devices_removed}', to_jsonb((result->>'rfir_devices_removed')::INT + 1)); END IF;
    DELETE FROM channels WHERE slave_id = slave_id_var;
    IF FOUND THEN result := jsonb_set(result, '{channels_removed}', to_jsonb((result->>'channels_removed')::INT + 1)); END IF;
    DELETE FROM slaves WHERE id = slave_id_var;
    IF FOUND THEN result := jsonb_set(result, '{slaves_removed}', to_jsonb((result->>'slaves_removed')::INT + 1)); END IF;
  END LOOP;

  -- v5.5 — rename[] aceita `clamp_type` opcional (mesma regra do devices[]) e
  -- `name` passou a ser opcional: {slave_id, clamp_type} só ajusta o clamp, sem
  -- tocar em nome, canais, ambient ou rfir.
  FOR rename_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'rename', '[]'::jsonb))
  LOOP
    slave_id_var := (rename_entry->>'slave_id')::INTEGER;
    new_name := rename_entry->>'name';

    IF (rename_entry ? 'clamp_type') THEN
      IF jsonb_typeof(rename_entry->'clamp_type') = 'number'
         AND (rename_entry->>'clamp_type') ~ '^[0-6]$' THEN
        clamp_val := (rename_entry->>'clamp_type')::INT;
        clamp_cfg := jsonb_build_object('confirmed', true, 'value', clamp_val);
        UPDATE slaves
        SET clamp_type = clamp_val,
            config = (COALESCE(config::jsonb, '{}'::jsonb) || jsonb_build_object('config_clamp', clamp_cfg))::json,
            updated_at = NOW()
        WHERE id = slave_id_var
          AND (clamp_type IS DISTINCT FROM clamp_val
               OR (config::jsonb -> 'config_clamp') IS DISTINCT FROM clamp_cfg);
        IF FOUND THEN
          result := jsonb_set(result, '{slaves_clamp_updated}', to_jsonb((result->>'slaves_clamp_updated')::INT + 1));
        END IF;
      ELSE
        result := jsonb_set(result, '{errors}', (result->'errors') || jsonb_build_object(
          'slave_id', slave_id_var, 'name', new_name,
          'error', 'clamp_type inválido (esperado inteiro 0..6): ' || COALESCE(rename_entry->>'clamp_type', 'null')));
      END IF;
    END IF;

    CONTINUE WHEN new_name IS NULL;

    SELECT id INTO rfir_id_var FROM rfir_devices WHERE slave_id = slave_id_var LIMIT 1;
    has_rfir := rfir_id_var IS NOT NULL;

    IF has_rfir THEN
      UPDATE rfir_devices SET name = new_name, updated_at = NOW() WHERE id = rfir_id_var;
      IF FOUND THEN result := jsonb_set(result, '{rfir_devices_renamed}', to_jsonb((result->>'rfir_devices_renamed')::INT + 1)); END IF;
      IF new_name LIKE 'AC %' THEN
        rm_name := 'RM ' || substring(new_name from 4);
        UPDATE slaves SET name = rm_name, updated_at = NOW() WHERE id = slave_id_var;
        IF FOUND THEN result := jsonb_set(result, '{slaves_renamed}', to_jsonb((result->>'slaves_renamed')::INT + 1)); END IF;
        UPDATE channels SET name = rm_name, updated_at = NOW() WHERE slave_id = slave_id_var;
        IF FOUND THEN result := jsonb_set(result, '{channels_renamed}', to_jsonb((result->>'channels_renamed')::INT + 1)); END IF;
      END IF;
    ELSE
      UPDATE slaves SET name = new_name, updated_at = NOW() WHERE id = slave_id_var;
      IF FOUND THEN result := jsonb_set(result, '{slaves_renamed}', to_jsonb((result->>'slaves_renamed')::INT + 1)); END IF;
      UPDATE channels SET name = new_name, updated_at = NOW() WHERE slave_id = slave_id_var;
      IF FOUND THEN result := jsonb_set(result, '{channels_renamed}', to_jsonb((result->>'channels_renamed')::INT + 1)); END IF;
    END IF;
  END LOOP;

  -- v5.6 — rename_channels[]: renomeia só o canal indicado (ver cabeçalho).
  FOR rename_ch_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'rename_channels', '[]'::jsonb))
  LOOP
    new_name := NULLIF(btrim(rename_ch_entry->>'name'), '');
    rc_type := rename_ch_entry->>'type';
    IF NOT COALESCE((rename_ch_entry->>'slave_id') ~ '^[0-9]+$', FALSE)
       OR NOT COALESCE((rename_ch_entry->>'channel') ~ '^[0-9]+$', FALSE)
       OR new_name IS NULL THEN
      result := jsonb_set(result, '{errors}', (result->'errors') || jsonb_build_object(
        'rename_channels', rename_ch_entry,
        'error', 'rename_channels: slave_id, channel (inteiros) e name obrigatórios'));
      CONTINUE;
    END IF;
    slave_id_var := (rename_ch_entry->>'slave_id')::INTEGER;
    rc_channel := (rename_ch_entry->>'channel')::INT;

    -- alias obrigatório: `channel` também é variável PL/pgSQL desta função
    SELECT count(*), min(ch.id) INTO rc_matches, rc_row_id
      FROM channels ch
     WHERE ch.slave_id = slave_id_var
       AND ch.channel = rc_channel
       AND (rc_type IS NULL OR ch.type = rc_type);

    IF rc_matches <> 1 THEN
      result := jsonb_set(result, '{errors}', (result->'errors') || jsonb_build_object(
        'slave_id', slave_id_var, 'channel', rc_channel, 'type', rc_type, 'name', new_name,
        'error', CASE WHEN rc_matches = 0
                      THEN 'rename_channels: nenhum canal encontrado'
                      ELSE 'rename_channels: ' || rc_matches || ' canais casam; informe type' END));
      CONTINUE;
    END IF;

    UPDATE channels SET name = new_name, updated_at = NOW()
     WHERE id = rc_row_id AND name IS DISTINCT FROM new_name;
    IF FOUND THEN
      result := jsonb_set(result, '{channels_renamed_single}', to_jsonb((result->>'channels_renamed_single')::INT + 1));
    END IF;
  END LOOP;

  FOR cleanup_amb_entry IN
    SELECT value FROM jsonb_array_elements(COALESCE(payload->'cleanup_ambients', '[]'::jsonb))
  LOOP
    ambient_id_var := (cleanup_amb_entry->>'id')::INTEGER;
    DELETE FROM ambients_rfir_slaves_rel WHERE ambient_id = ambient_id_var;
    GET DIAGNOSTICS rel_count = ROW_COUNT;
    result := jsonb_set(result, '{ambient_rels_cleaned}', to_jsonb((result->>'ambient_rels_cleaned')::INT + rel_count));
    DELETE FROM ambients_rfir_devices_rel WHERE ambient_id = ambient_id_var;
    GET DIAGNOSTICS rel_count = ROW_COUNT;
    result := jsonb_set(result, '{ambient_rels_cleaned}', to_jsonb((result->>'ambient_rels_cleaned')::INT + rel_count));
    DELETE FROM ambients WHERE id = ambient_id_var;
    IF FOUND THEN result := jsonb_set(result, '{ambients_cleaned}', to_jsonb((result->>'ambients_cleaned')::INT + 1)); END IF;
  END LOOP;

  RETURN result;
END;
$$;
