-- =============================================================================
-- REVERT do import em lote — Central Contagem (Soul Malls)
-- =============================================================================
-- O import de 2026-07-06 16:59:39.352285+00 (13:59 GMT-3) criou, num único
-- evento (mesmo created_at em todas as linhas):
--   • 218 ambients  SCO*            (ids 11–228, config = '{}', "order" = 0)
--   • 148 slaves    three_phase_... (1 canal, SEM code; ids 1–4, 56–87, 90, 117–227)
--   • 148 channels  three_phase_... (ids 9–156, channel = 1, config = '{}')
--   • 227 linhas na ambients_rfir_slaves_rel (slave 1–227 → ambient SCO 11–228)
--
-- Este script deleta APENAS esses itens. NÃO toca em:
--   • 79 slaves manuais (created_at 2026-07-03 → 07-06 < 16:59, code 002-002-002-015)
--   • ambients 5, 6, 7, 8, 9, 10 (grupos L1/L2/L3, Piso G4, Identificar, Serviço)
--   • ambient 229 "Piso G3" (criado 2026-07-07 03:14)
--   • channels de teste 1–8 (criados 2026-06-17)
--   • 78 linhas manuais da junction (vínculos aos grupos 5/6/8/9/10)
--
-- ⚠️ ANTES DE RODAR: backup das 4 tabelas
--   pg_dump -U hubot -d hubot -t ambients -t ambients_rfir_slaves_rel \
--     -t slaves -t channels > /tmp/backup_pre_revert_2026-07-07.sql
--
-- ⚠️ O import também sobrescreveu updated_at de TODOS os slaves para
--   2026-07-06 16:59:39.352285+00 — isso não é revertido (metadado apenas).
-- ⚠️ Se o MQTT Sync já criou devices no ThingsBoard a partir desses
--   slaves/channels, a limpeza no TB é um passo separado (não coberto aqui).
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) CONFERÊNCIA (automática) — os counts devem ser exatamente:
--    junction 227 · channels 148 · slaves 148 · ambients 218.
--    Se qualquer valor divergir, o bloco abaixo LANÇA EXCEÇÃO e a transação
--    inteira é abortada (nada é deletado).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n_junction bigint; n_channels bigint; n_slaves bigint; n_ambients bigint;
BEGIN
  SELECT count(*) INTO n_junction FROM ambients_rfir_slaves_rel
    WHERE created_at = '2026-07-06 16:59:39.352285+00';
  SELECT count(*) INTO n_channels FROM channels
    WHERE created_at = '2026-07-06 16:59:39.352285+00';
  SELECT count(*) INTO n_slaves FROM slaves
    WHERE created_at = '2026-07-06 16:59:39.352285+00';
  SELECT count(*) INTO n_ambients FROM ambients
    WHERE created_at = '2026-07-06 16:59:39.352285+00';

  RAISE NOTICE 'Pré-check: junction=% channels=% slaves=% ambients=%',
    n_junction, n_channels, n_slaves, n_ambients;

  IF n_junction <> 227 OR n_channels <> 148 OR n_slaves <> 148 OR n_ambients <> 218 THEN
    RAISE EXCEPTION 'Pré-check FALHOU (esperado 227/148/148/218) — abortando sem deletar nada';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) JUNCTION — 227 linhas do import (inclui os vínculos dos 79 slaves
--    manuais aos ambients SCO*, que também nasceram no import).
--    Guarda dupla: timestamp + ambient na faixa SCO (11–228).
-- ---------------------------------------------------------------------------
DELETE FROM ambients_rfir_slaves_rel
 WHERE created_at = '2026-07-06 16:59:39.352285+00'
   AND ambient_id BETWEEN 11 AND 228;

-- ---------------------------------------------------------------------------
-- 2) CHANNELS — 148 channels do import (ids 9–156). Os de teste (1–8) ficam.
-- ---------------------------------------------------------------------------
DELETE FROM channels
 WHERE created_at = '2026-07-06 16:59:39.352285+00'
   AND id BETWEEN 9 AND 156;

-- ---------------------------------------------------------------------------
-- 3) SLAVES — 148 slaves do import (1 canal, sem code). Os manuais têm
--    created_at anterior e code preenchido, então não casam no filtro.
-- ---------------------------------------------------------------------------
DELETE FROM slaves
 WHERE created_at = '2026-07-06 16:59:39.352285+00'
   AND code IS NULL
   AND channels = 1;

-- ---------------------------------------------------------------------------
-- 4) AMBIENTS — 218 ambients SCO* do import (ids 11–228).
-- ---------------------------------------------------------------------------
DELETE FROM ambients
 WHERE created_at = '2026-07-06 16:59:39.352285+00'
   AND id BETWEEN 11 AND 228;

-- ---------------------------------------------------------------------------
-- 5) PÓS-CHECAGEM (automática) — estado esperado após o revert:
--    slaves = 79 · channels = 8 · ambients = 7 · junction = 78.
--    Divergência → EXCEÇÃO → transação abortada (deletes desfeitos).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  n_slaves bigint; n_channels bigint; n_ambients bigint; n_junction bigint;
BEGIN
  SELECT count(*) INTO n_slaves   FROM slaves;
  SELECT count(*) INTO n_channels FROM channels;
  SELECT count(*) INTO n_ambients FROM ambients;
  SELECT count(*) INTO n_junction FROM ambients_rfir_slaves_rel;

  RAISE NOTICE 'Pós-check: slaves=% channels=% ambients=% junction=%',
    n_slaves, n_channels, n_ambients, n_junction;

  IF n_slaves <> 79 OR n_channels <> 8 OR n_ambients <> 7 OR n_junction <> 78 THEN
    RAISE EXCEPTION 'Pós-check FALHOU (esperado 79/8/7/78) — abortando, nada foi deletado';
  END IF;
END $$;

-- Sobram: ambients 5 (L1), 6 (L2), 7 (Serviço), 8 (L3), 9 (Piso G4),
--         10 (Identificar), 229 (Piso G3); slaves manuais 5–55, 88, 89, 91–116.

COMMIT;
