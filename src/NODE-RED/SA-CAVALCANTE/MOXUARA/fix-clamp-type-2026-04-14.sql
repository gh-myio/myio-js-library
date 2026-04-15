-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Moxuara (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 18 slaves
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (3, 62, 67, 85, 93, 98, 99, 100, 103, 105, 111, 121, 189, 193, 194, 199, 210, 218);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (3, 62, 67, 85, 93, 98, 99, 100, 103, 105, 111, 121, 189, 193, 194, 199, 210, 218)
ORDER BY id;
