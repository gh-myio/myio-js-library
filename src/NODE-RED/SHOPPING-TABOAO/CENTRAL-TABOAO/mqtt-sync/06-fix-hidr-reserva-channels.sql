-- 06 — Converte os hidrometros "HIDR. RESERVA-xx" para o padrao de 2 canais
-- dos demais hidrometros da central (ex.: slave 6 HIDR. STB01001):
--   channel 0  presence_sensor "Fonte"  {"pulses": 1, "remoteInput": true}
--   channel 1  flow_sensor     "Vazão"  {"pulses": 1, "countingPulseOnPower": true}
--   slaves.channels = 2 e slaves.config.channelConfig (REMOTE_INPUT / PULSE_ON_POWER)
--
-- Central: Shopping Taboao (8324c829-1bc9-4ab8-9bcb-2793ee0f436a), banco hubot.
-- Estado em 2026-11-04 (log.channels.log): 15 slaves outlet HIDR. RESERVA-01..15
-- (ids 237..265 impares), criados em 2026-10-27 23:39 pelo default v4 do provision
-- (payload sem `channels`): 1 so channel (channel=1, type outlet, nome do slave,
-- config {}), slaves.channels=1 e slaves.config NULL.
--
-- Alvo: slave outlet com nome 'HIDR. %' cujo UNICO channel e channel=1 type outlet.
-- O channel 1 existente e convertido (mantem o id); o channel 0 e inserido.
--
-- ANTES: backup do cadastro (manual-centrais-linix-orangepi.md, 9.4)
--   pg_dump -U hubot --clean --if-exists -t slaves -t channels -t ambients -t ambients_rfir_slaves_rel \
--     > /tmp/backup-cadastro-$(date +%Y%m%d-%H%M%S).sql
--
-- Uso: psql -U hubot -f 06-fix-hidr-reserva-channels.sql
-- Tudo numa transacao; confira a saida antes do COMMIT final (ou troque por ROLLBACK).

BEGIN;

CREATE TEMP TABLE alvo ON COMMIT DROP AS
SELECT s.id AS slave_id, s.name, c.id AS channel_row_id
  FROM slaves s
  JOIN channels c ON c.slave_id = s.id
 WHERE s.type = 'outlet'
   AND s.name LIKE 'HIDR. %'
   AND c.channel = 1
   AND c.type = 'outlet'
   AND (SELECT count(*) FROM channels c2 WHERE c2.slave_id = s.id) = 1;

-- 1) O que vai mudar (esperado: 15 linhas, HIDR. RESERVA-01..15)
SELECT * FROM alvo ORDER BY slave_id;

-- 2) channel 1: outlet -> flow_sensor "Vazão"
UPDATE channels c
   SET type = 'flow_sensor',
       name = 'Vazão',
       config = '{"pulses": 1, "countingPulseOnPower": true}'::json,
       updated_at = NOW()
  FROM alvo a
 WHERE c.id = a.channel_row_id;

-- 3) channel 0: presence_sensor "Fonte"
INSERT INTO channels (type, channel, name, slave_id, config, created_at, updated_at)
SELECT 'presence_sensor', 0, 'Fonte', a.slave_id,
       '{"pulses": 1, "remoteInput": true}'::json, NOW(), NOW()
  FROM alvo a;

-- 4) slave: channels=2 + channelConfig Modbus (merge, preserva o resto do config)
UPDATE slaves s
   SET channels = 2,
       config = (COALESCE(s.config::jsonb, '{}'::jsonb) || jsonb_build_object('channelConfig', jsonb_build_object(
         'channel0', jsonb_build_object('output', 'HOLDING', 'pulses', 1, 'channel', 0, 'slaveId', s.id, 'channel_type', 'REMOTE_INPUT'),
         'channel1', jsonb_build_object('output', 'HOLDING', 'pulses', 1, 'channel', 1, 'slaveId', s.id, 'channel_type', 'PULSE_ON_POWER')
       )))::json,
       updated_at = NOW()
  FROM alvo a
 WHERE s.id = a.slave_id;

-- 5) Conferencia: cada RESERVA com 2 rows (0 presence_sensor Fonte / 1 flow_sensor Vazão)
SELECT s.id, s.name, s.channels, c.channel, c.type, c.name, c.config
  FROM slaves s
  JOIN channels c ON c.slave_id = s.id
 WHERE s.id IN (SELECT slave_id FROM alvo)
 ORDER BY s.id, c.channel;

-- Resumo: hidrometros outlet por nº de channels (esperado: so channels=2, exceto
-- MQTT Sync 1/1 e SCD de nivel que cadastram so o ch0)
SELECT s.channels, count(*) AS slaves,
       sum((SELECT count(*) FROM channels c WHERE c.slave_id = s.id)) AS channel_rows
  FROM slaves s
 WHERE s.type = 'outlet'
 GROUP BY s.channels
 ORDER BY s.channels;

COMMIT;   -- ou ROLLBACK se algo estranho aparecer
