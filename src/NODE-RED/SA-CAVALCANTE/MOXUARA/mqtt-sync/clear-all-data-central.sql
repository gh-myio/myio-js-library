-- clear_all_data_central() — full central wipe (no parameters)
--
-- TRUNCATEs EVERY base table in the `public` schema EXCEPT:
--   • SequelizeMeta — migration bookkeeping (must survive)
--   • environment   — key→value config (must survive)
--
-- All the rest (slaves, channels, ambients, rfir_*, the M:N relations, AND the
-- timeseries/history/log tables: channel_pulse_log, raw_energy,
-- temperature_history, consumption*, alarms, alert_history, logs, scenes,
-- schedules, favorites, metadata, users, …) are wiped so the central can be
-- re-provisioned/clean from scratch.
--
-- Uses a SINGLE `TRUNCATE … RESTART IDENTITY CASCADE`:
--   • CASCADE resolves every FK (the previous version failed because
--     channel_pulse_log / raw_energy / consumption reference slaves/channels —
--     truncating slaves without CASCADE raised a FK error).
--   • RESTART IDENTITY resets all serial sequences (ids back to 1).
--   • One statement → all locks taken together (no ordering, no per-table loop).
--
-- ⚠ DESTRUCTIVE: wipes telemetry/history too, and IR-capture tables
--   (rfir_remotes/buttons/commands) — IR commands must be recaptured on the
--   blaster afterwards. Runs in the function's implicit transaction: any error
--   rolls everything back.
--
-- Returns a JSONB summary with per-table row counts (snapshot BEFORE the wipe)
-- and the excluded tables.

CREATE OR REPLACE FUNCTION clear_all_data_central()
RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  tbl       TEXT;
  tbl_list  TEXT := '';
  removed   JSONB := '{}'::JSONB;
  cnt       BIGINT;
  n_tables  INT := 0;
BEGIN
  -- Collect every base table except the two we must preserve.
  FOR tbl IN
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type   = 'BASE TABLE'
       AND table_name NOT IN ('SequelizeMeta', 'environment')
     ORDER BY table_name
  LOOP
    -- Snapshot row count before truncating (TRUNCATE yields no count).
    EXECUTE format('SELECT count(*) FROM %I', tbl) INTO cnt;
    removed := removed || jsonb_build_object(tbl, cnt);
    tbl_list := tbl_list || format('%I,', tbl);
    n_tables := n_tables + 1;
  END LOOP;

  IF n_tables > 0 THEN
    -- Drop the trailing comma and wipe everything in one statement.
    tbl_list := left(tbl_list, length(tbl_list) - 1);
    EXECUTE 'TRUNCATE TABLE ' || tbl_list || ' RESTART IDENTITY CASCADE';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'tables_truncated', n_tables,
    'excluded', jsonb_build_array('SequelizeMeta', 'environment'),
    'removed', removed
  );
END;
$$;
