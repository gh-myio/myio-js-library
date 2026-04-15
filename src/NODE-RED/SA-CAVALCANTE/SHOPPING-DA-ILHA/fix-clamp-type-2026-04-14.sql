-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Shopping da Ilha (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 17 slaves (ids 38, 134, 151, 153, 159, 178, 196, 200, 215, 217, 275, 276, 277, 278, 283, 411, 417)
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (38, 134, 151, 153, 159, 178, 196, 200, 215, 217, 275, 276, 277, 278, 283, 411, 417);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (38, 134, 151, 153, 159, 178, 196, 200, 215, 217, 275, 276, 277, 278, 283, 411, 417)
ORDER BY id;
