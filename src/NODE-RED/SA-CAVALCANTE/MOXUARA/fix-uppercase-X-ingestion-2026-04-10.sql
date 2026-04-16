-- Fix ingestion: multiplicadores X maiúsculo não aplicados
-- Central: Moxuara Shopping
-- Gateway: e982edf9-edb1-4aa6-8a14-4782465ae5a3
-- Data: 2026-04-10

-- slave 7 | 3F SCMOXUARA113EL1 ×40 X40A | multiplier: 40
UPDATE energy_readings SET value = value * 40 WHERE gateway_id = 'e982edf9-edb1-4aa6-8a14-4782465ae5a3' AND slave_id = 7;
UPDATE aggregated_energy_hourly SET value = value * 40 WHERE gateway_id = 'e982edf9-edb1-4aa6-8a14-4782465ae5a3' AND slave_id = 7;
