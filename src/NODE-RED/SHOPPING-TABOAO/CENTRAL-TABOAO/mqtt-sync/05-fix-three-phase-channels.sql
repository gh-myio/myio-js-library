-- 05 — Remove os channel rows que a provision_central() v5 criou para os slaves
-- three_phase_sensor (fallback v4: 1 canal default quando o device do payload vem
-- sem a chave `channels`). Um trifasico nao tem canal de I/O: a API real da
-- central responde "channels": [] e slaves.channels = 0 (cf. Capim Dourado).
--
-- Central: Shopping Taboao (8324c829-1bc9-4ab8-9bcb-2793ee0f436a), banco hubot.
-- Estado em 2026-10-19: 177 slaves three_phase_sensor, cada um com 1 channel
-- (channel=1, type three_phase_sensor, mesmo nome do slave) e slaves.channels=1.
--
-- ANTES: backup do cadastro (manual-centrais-linix-orangepi.md, 9.4)
--   pg_dump -U hubot --clean --if-exists -t slaves -t channels -t ambients -t ambients_rfir_slaves_rel \
--     > /tmp/backup-cadastro-$(date +%Y%m%d-%H%M%S).sql
--
-- Uso: psql -U hubot -f 05-fix-three-phase-channels.sql
-- Tudo numa transacao; confira a saida antes do COMMIT final (ou troque por ROLLBACK).

BEGIN;

-- 1) O que vai sair: so canais de slaves three_phase_sensor, e so canais do
--    mesmo tipo (um 3F com canal flow_sensor/presence_sensor cadastrado de
--    proposito NAO e tocado).
SELECT c.id AS channel_id, c.slave_id, s.name AS slave, c.channel, c.type, c.name
  FROM channels c
  JOIN slaves s ON s.id = c.slave_id
 WHERE s.type = 'three_phase_sensor'
   AND c.type = 'three_phase_sensor'
 ORDER BY c.slave_id;

-- 2) Tabelas com FK para channels (se vier algo, o DELETE pode falhar: me avise)
SELECT conrelid::regclass AS tabela, conname
  FROM pg_constraint
 WHERE contype = 'f' AND confrelid = 'channels'::regclass;

-- 3) Remove os canais e zera slaves.channels nos trifasicos
WITH alvo AS (
  SELECT c.id
    FROM channels c
    JOIN slaves s ON s.id = c.slave_id
   WHERE s.type = 'three_phase_sensor'
     AND c.type = 'three_phase_sensor'
),
del AS (
  DELETE FROM channels WHERE id IN (SELECT id FROM alvo) RETURNING slave_id
)
SELECT count(*) AS channels_removidos FROM del;

UPDATE slaves s
   SET channels = 0, updated_at = NOW()
 WHERE s.type = 'three_phase_sensor'
   AND NOT EXISTS (SELECT 1 FROM channels c WHERE c.slave_id = s.id);

-- 4) Conferencia: three_phase_sensor deve vir com channels=0 e channel_rows=0;
--    outlet (hidrometros) segue com channels=2 e 2 rows por slave; MQTT Sync 1/1.
SELECT s.type, s.channels, count(*) AS slaves,
       sum((SELECT count(*) FROM channels c WHERE c.slave_id = s.id)) AS channel_rows
  FROM slaves s
 GROUP BY s.type, s.channels
 ORDER BY s.type, s.channels;

COMMIT;   -- ou ROLLBACK se algo estranho aparecer
