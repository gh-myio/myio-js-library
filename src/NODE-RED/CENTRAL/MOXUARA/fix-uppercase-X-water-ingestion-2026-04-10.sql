-- Fix ingestion water: multiplicadores X maiúsculo não aplicados
-- Central: Moxuara Shopping
-- Gateway: e982edf9-edb1-4aa6-8a14-4782465ae5a3
-- Data: 2026-04-10

-- slave 297 | HIDR. SCMOXUARAQ214L2 x10 | multiplier: 10
UPDATE water_readings SET value = value * 10 WHERE gateway_id = 'e982edf9-edb1-4aa6-8a14-4782465ae5a3' AND slave_id = 297;
UPDATE aggregated_water_hourly SET value = value * 10 WHERE gateway_id = 'e982edf9-edb1-4aa6-8a14-4782465ae5a3' AND slave_id = 297;
