-- clear_all_data_central() — full central wipe PRESERVANDO o MQTT Sync
--
-- ⚠ SOBRESCREVE a function clear_all_data_central() original (mesmo nome e mesma
--   assinatura → CREATE OR REPLACE). Depois de rodar este arquivo, o endpoint/flow que
--   já chama clear_all_data_central() passa a preservar o MQTT Sync. Para voltar ao
--   comportamento antigo (apaga tudo), rode de novo o 02-clear-all-data-central.sql.
--
-- Igual ao 02-clear-all-data-central.sql (TRUNCATE de todas as tabelas do schema
-- `public`, exceto SequelizeMeta e environment), MAS mantém o device virtual
-- "MQTT Sync" intacto, com os MESMOS ids:
--   • slaves   WHERE name LIKE 'MQTT Sync%'          (container 'outlet'; slaves.config
--                                                     guarda o mqttSyncStatus → preservado)
--   • channels WHERE slave_id ∈ slaves acima          (channel 'plug')
--   • ambients WHERE name LIKE 'MQTT Sync%'
--   • ambients_rfir_slaves_rel que liga esse slave a esse ambient
-- Cobre o nome legado ('MQTT Sync') e o especializado ('MQTT Sync - <CENTRAL_UUID>').
--
-- Como funciona (tudo numa transação implícita da function — qualquer erro desfaz tudo):
--   1) copia as linhas do MQTT Sync para tabelas TEMP;
--   2) TRUNCATE … RESTART IDENTITY CASCADE em todas as tabelas (igual ao 02);
--   3) reinsere as linhas do MQTT Sync com os ids originais;
--   4) ajusta as sequences de slaves/channels/ambients/ambients_rfir_slaves_rel para
--      MAX(id), senão o próximo cadastro colidiria com o id preservado.
--
-- ⚠ DESTRUCTIVE: apaga todo o resto — cadastro (slaves/channels/ambients), históricos
--   (channel_pulse_log, raw_energy, consumption*, temperature_history), logs, alarms,
--   scenes, schedules, favorites, metadata, USERS e os comandos IR (rfir_*).
--   O histórico do próprio MQTT Sync (linhas em logs) também vai embora; só o
--   cadastro e o status atual (slaves.config.mqttSyncStatus) ficam.
--   Faça backup antes:  pg_dump -U postgres -d hubot -Fc -f /root/hubot-pre-clear-$(date +%F).dump
--
-- Retorna JSONB com a contagem por tabela ANTES do wipe, as tabelas excluídas e
-- o que foi preservado.
--
-- Uso:
--   \i 02-clear-all-data-central-expect-mqtt-sync-device.sql   -- cria/atualiza a function
--   SELECT clear_all_data_central();
--   -- conferência:
--   SELECT id, addr_low, name, config FROM slaves;   -- só o MQTT Sync
--   SELECT id, slave_id, type, name   FROM channels;
--   SELECT id, name                   FROM ambients;

CREATE OR REPLACE FUNCTION clear_all_data_central()
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  tbl        TEXT;
  tbl_list   TEXT := '';
  removed    JSONB := '{}'::JSONB;
  cnt        BIGINT;
  n_tables   INT := 0;
  kept       JSONB;
  seq        TEXT;
BEGIN
  -- (1) Snapshot do MQTT Sync (mesmas colunas, via SELECT *).
  DROP TABLE IF EXISTS _keep_slaves, _keep_channels, _keep_ambients, _keep_rel;
  CREATE TEMP TABLE _keep_slaves   ON COMMIT DROP AS
    SELECT * FROM slaves WHERE name LIKE 'MQTT Sync%';
  CREATE TEMP TABLE _keep_channels ON COMMIT DROP AS
    SELECT * FROM channels WHERE slave_id IN (SELECT id FROM _keep_slaves);
  CREATE TEMP TABLE _keep_ambients ON COMMIT DROP AS
    SELECT * FROM ambients WHERE name LIKE 'MQTT Sync%';
  CREATE TEMP TABLE _keep_rel      ON COMMIT DROP AS
    SELECT * FROM ambients_rfir_slaves_rel
     WHERE slave_id   IN (SELECT id FROM _keep_slaves)
       AND ambient_id IN (SELECT id FROM _keep_ambients);

  kept := jsonb_build_object(
    'slaves',   (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'addr_low', addr_low)), '[]') FROM _keep_slaves),
    'channels', (SELECT count(*) FROM _keep_channels),
    'ambients', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]') FROM _keep_ambients),
    'ambients_rfir_slaves_rel', (SELECT count(*) FROM _keep_rel)
  );

  -- (2) Wipe de tudo (igual ao 02), exceto SequelizeMeta e environment.
  FOR tbl IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type   = 'BASE TABLE'
       AND table_name NOT IN ('SequelizeMeta', 'environment')
     ORDER BY table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', tbl) INTO cnt;
    removed  := removed || jsonb_build_object(tbl, cnt);
    tbl_list := tbl_list || format('%I,', tbl);
    n_tables := n_tables + 1;
  END LOOP;

  IF n_tables > 0 THEN
    tbl_list := left(tbl_list, length(tbl_list) - 1);
    EXECUTE 'TRUNCATE TABLE ' || tbl_list || ' RESTART IDENTITY CASCADE';
  END IF;

  -- (3) Reinsere o MQTT Sync com os ids originais (ordem respeita as FKs).
  INSERT INTO slaves                   SELECT * FROM _keep_slaves;
  INSERT INTO channels                 SELECT * FROM _keep_channels;
  INSERT INTO ambients                 SELECT * FROM _keep_ambients;
  INSERT INTO ambients_rfir_slaves_rel SELECT * FROM _keep_rel;

  -- (4) Sequences → MAX(id), para o próximo cadastro não colidir com o id preservado.
  FOREACH tbl IN ARRAY ARRAY['slaves', 'channels', 'ambients', 'ambients_rfir_slaves_rel'] LOOP
    -- tabela sem coluna id (ex.: junction com PK composta) → nada a ajustar
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'id');
    seq := pg_get_serial_sequence(tbl, 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, coalesce((SELECT max(id) FROM %I), 0) + 1, false)', seq, tbl);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'tables_truncated', n_tables,
    'excluded', jsonb_build_array('SequelizeMeta', 'environment'),
    'preserved_mqtt_sync', kept,
    'removed', removed
  );
END;
$$;
