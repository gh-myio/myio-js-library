-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Rio Poty (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 21 slaves
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (7, 114, 142, 153, 164, 186, 187, 196, 197, 206, 207, 208, 210, 211, 228, 229, 235, 240, 242, 345, 348);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (7, 114, 142, 153, 164, 186, 187, 196, 197, 206, 207, 208, 210, 211, 228, 229, 235, 240, 242, 345, 348)
ORDER BY id;
