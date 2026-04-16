-- Fix ingestion water: multiplicadores X maiúsculo não aplicados
-- Central: Rio Poty
-- Gateway: c0af8288-7b13-4024-bc11-df5017fef656
-- Data: 2026-04-10

-- slave 244 | HIDR. SCRP107ABCD x100 | multiplier: 100
UPDATE water_readings SET value = value * 100 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 244;
UPDATE aggregated_water_hourly SET value = value * 100 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 244;
