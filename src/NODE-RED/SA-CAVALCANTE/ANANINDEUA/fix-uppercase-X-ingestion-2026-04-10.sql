-- Fix ingestion: multiplicadores X maiúsculo não aplicados
-- Central: Shopping Metrópole Ananindeua
-- Gateway: 7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a
-- Data: 2026-04-10

-- slave 354 | 3F SCMPAC Medicao Geral_CAG x820 X820A | multiplier: 820
UPDATE energy_readings SET value = value * 820 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 354;
UPDATE aggregated_energy_hourly SET value = value * 820 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 354;

-- slave 231 | 3F MOTR. SCMPAC-CasaAR11 X2 X2A | multiplier: 2
UPDATE energy_readings SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 231;
UPDATE aggregated_energy_hourly SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 231;

-- slave 232 | 3F MOTR. SCMPAC-CasaAR12 X2 X2A | multiplier: 2
UPDATE energy_readings SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 232;
UPDATE aggregated_energy_hourly SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 232;

-- slave 236 | 3F MOTR. SCMPAC-CasaAR16 X2 X2A | multiplier: 2
UPDATE energy_readings SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 236;
UPDATE aggregated_energy_hourly SET value = value * 2 WHERE gateway_id = '7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a' AND slave_id = 236;
