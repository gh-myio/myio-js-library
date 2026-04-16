-- Fix ingestion: multiplicadores X maiúsculo não aplicados
-- Central: Rio Poty
-- Gateway: c0af8288-7b13-4024-bc11-df5017fef656
-- Data: 2026-04-10

-- slave 209 | 3F SCRPAC-BCAG5 ×2 X2A | multiplier: 2
UPDATE energy_readings SET value = value * 2 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 209;
UPDATE aggregated_energy_hourly SET value = value * 2 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 209;

-- slave 231 | 3F SCRPAC-CasaAR5 X2 X2A | multiplier: 2
UPDATE energy_readings SET value = value * 2 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 231;
UPDATE aggregated_energy_hourly SET value = value * 2 WHERE gateway_id = 'c0af8288-7b13-4024-bc11-df5017fef656' AND slave_id = 231;
