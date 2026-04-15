-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Ananindeua (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 31 slaves
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (1, 9, 16, 50, 87, 91, 102, 111, 113, 140, 142, 148, 149, 153, 154, 166, 194, 195, 196, 201, 208, 209, 210, 211, 212, 213, 218, 219, 220, 233, 237);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (1, 9, 16, 50, 87, 91, 102, 111, 113, 140, 142, 148, 149, 153, 154, 166, 194, 195, 196, 201, 208, 209, 210, 211, 212, 213, 218, 219, 220, 233, 237)
ORDER BY id;
