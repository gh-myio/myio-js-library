-- Fix: sincronizar clamp_type com config.config_clamp.value
-- Central: Mestre Álvaro — L0L1 (Sá Cavalcante)
-- Data: 2026-04-14
-- Divergências identificadas: 15 slaves (three_phase_sensor com clamp_type=0 e config_clamp.value=1 ou 2)
-- Ref: query-clamp-type-diagnostic-2026-04-14.log

-- 1. UPDATE
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE id IN (2, 8, 9, 14, 19, 34, 46, 66, 71, 74, 86, 88, 92, 95, 99);

-- 2. Verificação pós-update
SELECT id, name, clamp_type, config -> 'config_clamp' ->> 'value' AS config_clamp_value
FROM slaves
WHERE id IN (2, 8, 9, 14, 19, 34, 46, 66, 71, 74, 86, 88, 92, 95, 99)
ORDER BY id;
