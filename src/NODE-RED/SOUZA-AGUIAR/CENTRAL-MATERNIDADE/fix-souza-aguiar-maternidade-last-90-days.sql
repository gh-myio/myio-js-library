cat > /tmp/fix-souza-aguiar-maternidade-last-90-days.sql << 'EOF'
BEGIN;

-- ETAPA 1: Migrar histórico (temperature_history) - ultimos 90 dias
UPDATE temperature_history SET slave_id = 28, value = value + (-4) WHERE slave_id = 27  AND timestamp >= NOW() - INTERVAL '90 days';
UPDATE temperature_history SET slave_id = 10, value = value + (-3) WHERE slave_id = 8  AND timestamp >= NOW() - INTERVAL '90 days';
UPDATE temperature_history SET slave_id = 20, value = value + (-4) WHERE slave_id = 19  AND timestamp >= NOW() - INTERVAL '90 days';

-- ETAPA 2: Renomear slaves ANTIGOS
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4' WHERE id = 27;
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3' WHERE id = 8;
UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4' WHERE id = 19;

-- ETAPA 3: Renomear slaves NOVOS
UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_03' WHERE id = 28;
UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_02' WHERE id = 10;
UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_01' WHERE id = 20;

COMMIT;
EOF