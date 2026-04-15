-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Mestre Álvaro — L2AC (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 4 slaves (ids 21, 127, 128, 129)
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (21, 127, 128, 129);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (21, 127, 128, 129)
ORDER BY id;
