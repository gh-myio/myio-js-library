-- =============================================================================
-- ⛔ SUPERADO — use restore-names-from-thingsboard.sql (cobre 75 slaves,
--    incluindo estes 26, validados 26/26 contra este backup). Mantido só como
--    registro da recuperação via backup de 04/07.
-- =============================================================================
-- RESTAURA os nomes ORIGINAIS dos slaves 5–30 — Central Contagem (Soul Malls)
-- =============================================================================
-- O import em lote de 2026-07-06 16:59:39.352285+00 RENOMEOU os medidores
-- manuais existentes (pareamento posicional), destruindo o mapeamento de campo.
-- Os nomes originais abaixo vêm do backup diário 2026-07-04-04-00.bak
-- (restaurado e conferido em Docker local — ver confronto-backup-2026-07-04.md).
--
-- Escopo: SOMENTE os 26 slaves que existiam em 04/07 04:00 UTC (ids 5–30).
-- Os demais manuais (31–55, 88–89, 91–116) dependem dos backups de 05/07 e
-- 06/07 ou dos nomes dos devices no ThingsBoard.
--
-- Guarda dupla: id + nome atual precisam casar; se qualquer um dos 26 não
-- casar, o total difere de 26 e a transação ABORTA sem alterar nada.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  UPDATE slaves s
     SET name = v.original_name,
         updated_at = now()
    FROM (VALUES
      ( 5, '3F SCO01067', '3F SMCONTAGEM_01006'),
      ( 6, '3F SCO01016', '3F SMCONTAGEM_01011'),
      ( 7, '3F SCO01018', '3F SMCONTAGEM_01012'),
      ( 8, '3F SCO01019', '3F SMCONTAGEM_01015'),
      ( 9, '3F SCO01020', '3F SMCONTAGEM_01059'),
      (10, '3F SCO01021', '3F SMCONTAGEM_01060'),
      (11, '3F SCO01022', '3F SMCONTAGEM_01064'),
      (12, '3F SCO01023', '3F SMCONTAGEM_01065'),
      (13, '3F SCO01025', '3F SMCONTAGEM_01066'),
      (14, '3F SCO01027', '3F SMCONTAGEM_Q0102'),
      (15, '3F SCO01028', '3F SMCONTAGEM_02024'),
      (16, '3F SCO01029', '3F SMCONTAGEM_1013B'),
      (17, '3F SCO1031',  '3F SMCONTAGEM_1019B'),
      (18, '3F SCO01035', '3F SMCINTAGEM_Q0115'),
      (19, '3F SCO01036', '3F SMCONTAGEM_Q0204'),
      (20, '3F SCO01037', '3F SMCONTAGEM_Q200B'),
      (21, '3F SCO01041', '3F SMCONTAGEM_Q0103'),
      (22, '3F SCO01044', '3F SMCONTAGEM_Q0116'),
      (23, '3F SCO01046', '3F SMCONTAGEM_Q1015'),
      (24, '3F SCO1047',  '3F SMCONTAGEM_Q202B'),
      (25, '3F SCO01048', '3F SMCONTAGEM_Q0104'),
      (26, '3F SCO01053', '3F SMCONTAGEM_Q0201'),
      (27, '3F SCO01054', '3F SMCONTAGEM_Q0104B'),
      (28, '3F SCO01059', '3F SMCONTAGEM_Q0202'),
      (29, '3F SCO01060', '3F SMCONTAGEM_Q102A'),
      (30, '3F SCO01064', '3F SMCONTAGEM_Q114A')
    ) AS v(id, current_name, original_name)
   WHERE s.id = v.id
     AND s.name = v.current_name;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Slaves renomeados de volta ao original: %', n;

  IF n <> 26 THEN
    RAISE EXCEPTION 'Esperado 26 renames, aplicaria % — nome atual não casou em algum id; abortando sem alterar nada', n;
  END IF;
END $$;

-- Conferência visual pós-rename
SELECT id, name FROM slaves WHERE id BETWEEN 5 AND 30 ORDER BY id;

COMMIT;
