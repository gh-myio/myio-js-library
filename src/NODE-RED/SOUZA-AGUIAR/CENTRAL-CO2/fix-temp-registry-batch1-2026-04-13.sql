-- =============================================================================
-- fix-temp-registry — Batch 1 (2026-04-13)
-- Central: Souza Aguiar — CO2
-- SSH: ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa
-- Executar: psql -U hubot -f /tmp/fix.sql
--
-- Ordem: 1. UPDATE temperature_history  2. UPDATE slaves (nomes)
-- =============================================================================

BEGIN;

-- ── 1. Histórico ──────────────────────────────────────────────────────────────

-- row_020 | Centro Cirúrgico 04 | slave 44 → 45 | offset -7
UPDATE temperature_history
  SET slave_id = 45, value = value + (-7)
  WHERE slave_id = 44
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_021 | CTI 01 | slave 88 → 87 | offset -2
UPDATE temperature_history
  SET slave_id = 87, value = value + (-2)
  WHERE slave_id = 88
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_025 | Tomografia | slave 132 → 133 | offset -6
UPDATE temperature_history
  SET slave_id = 133, value = value + (-6)
  WHERE slave_id = 132
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_024 | Raio-X 01 | slave 103 → 102 | offset -5
UPDATE temperature_history
  SET slave_id = 102, value = value + (-5)
  WHERE slave_id = 103
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_027 | Hemodiálise | slave 130 → 131 | offset -6
UPDATE temperature_history
  SET slave_id = 131, value = value + (-6)
  WHERE slave_id = 130
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_028 | Agência Transfusional | slave 137 → 138 | offset -5
UPDATE temperature_history
  SET slave_id = 138, value = value + (-5)
  WHERE slave_id = 137
    AND timestamp >= NOW() - INTERVAL '90 days';

-- row_029 | CTI 04 | slave 84 → 91 | offset -5
UPDATE temperature_history
  SET slave_id = 91, value = value + (-5)
  WHERE slave_id = 84
    AND timestamp >= NOW() - INTERVAL '90 days';

-- ── 2. Nomes ──────────────────────────────────────────────────────────────────

-- row_020 | Centro Cirúrgico 04
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia4 -7' WHERE id = 44;
UPDATE slaves SET name = 'Temp. Co2_Cirurgia4'            WHERE id = 45;

-- row_021 | CTI 01
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CTI_01 -2' WHERE id = 88;
UPDATE slaves SET name = 'Temp. Co2_CTI_01'            WHERE id = 87;

-- row_025 | Tomografia
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Tomografia -6' WHERE id = 132;
UPDATE slaves SET name = 'Temp. Co2_Tomografia'            WHERE id = 133;

-- row_024 | Raio-X 01
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Raiox1 -5' WHERE id = 103;
UPDATE slaves SET name = 'Temp. Co2_Raiox1'            WHERE id = 102;

-- row_027 | Hemodiálise
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Hemodialise -6' WHERE id = 130;
UPDATE slaves SET name = 'Temp. Co2_Hemodialise'            WHERE id = 131;

-- row_028 | Agência Transfusional
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Agencia_Transfusional -5' WHERE id = 137;
UPDATE slaves SET name = 'Temp. Co2_Agencia_Transfusional'            WHERE id = 138;

-- row_029 | CTI 04
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CTI_04 -5' WHERE id = 84;
UPDATE slaves SET name = 'Temp. Co2_CTI_04'            WHERE id = 91;

COMMIT;
