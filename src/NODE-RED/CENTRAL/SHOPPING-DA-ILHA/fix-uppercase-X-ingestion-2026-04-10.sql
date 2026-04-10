-- Fix ingestion energy: multiplicadores X maiúsculo não aplicados
-- Central: Shopping da Ilha
-- Gateway: cb318f02-1020-4f99-857f-d44d001d939b
-- Data: 2026-04-10

-- POPEYES | slave 126 | 3F SCSDI309C X16 X16A | multiplier: 16
-- tudo errado → limite inferior: 01/02/2026
UPDATE energy_readings SET value = value * 16 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 126 AND timestamp >= '2026-02-01 00:00:00+00';
UPDATE aggregated_energy_hourly SET value = value * 16 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 126 AND hour_start >= '2026-02-01 00:00:00+00';

-- PASTELLOCO | slave 132 | 3F SCSDI310F X20 x20A | multiplier: 20
-- corrigir de 01/02/2026 até dia anterior a 27/03/2026 (inclusive)
UPDATE energy_readings SET value = value * 20 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 132 AND timestamp >= '2026-02-01 00:00:00+00' AND timestamp < '2026-03-27 00:00:00+00';
UPDATE aggregated_energy_hourly SET value = value * 20 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 132 AND hour_start >= '2026-02-01 00:00:00+00' AND hour_start < '2026-03-27 00:00:00+00';

-- Medição Geral CAG | slave 285 | 3F SCSDIAC-TrafoCAG x1380 x40A X36.31v | multiplier: 1380
-- corrigir de 01/02/2026 até dia anterior a 30/03/2026 (inclusive)
UPDATE energy_readings SET value = value * 1380 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 285 AND timestamp >= '2026-02-01 00:00:00+00' AND timestamp < '2026-03-30 00:00:00+00';
UPDATE aggregated_energy_hourly SET value = value * 1380 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 285 AND hour_start >= '2026-02-01 00:00:00+00' AND hour_start < '2026-03-30 00:00:00+00';

-- Geral Entrada | slave 284 | 3F SCSDIAC-TrafoEntrada x1724.72 x50A X36.31v | multiplier: 1724.72
-- corrigir de 01/02/2026 até dia anterior a 30/03/2026 (inclusive)
UPDATE energy_readings SET value = value * 1724.72 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 284 AND timestamp >= '2026-02-01 00:00:00+00' AND timestamp < '2026-03-30 00:00:00+00';
UPDATE aggregated_energy_hourly SET value = value * 1724.72 WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b' AND slave_id = 284 AND hour_start >= '2026-02-01 00:00:00+00' AND hour_start < '2026-03-30 00:00:00+00';
