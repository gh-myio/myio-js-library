-- GET /api/state — returns the central's local Postgres state as a single
-- JSON document. See docs/central-provision-function.md for the full spec.
--
-- The Node-RED postgresql node yields one row with a `state` column; the
-- function step after it pulls msg.payload[0].state up to msg.payload so
-- the HTTP response body is the JSON object directly (not wrapped in
-- an array of {state: …}).
--
-- Install:
--   psql -U hubot -h localhost  ← test the query directly
--   (no need to CREATE FUNCTION — flow runs the SQL inline)

SELECT json_build_object(
  'ambients', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'order', "order"
    ))
    FROM ambients
  ), '[]'::json),
  'slaves', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'type', type,
      'addr_low', addr_low,
      'addr_high', addr_high,
      'channels', channels,
      'config', config
    ))
    FROM slaves
  ), '[]'::json),
  'channels', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'channel', channel,
      'type', type,
      'slave_id', slave_id,
      'config', config
    ))
    FROM channels
  ), '[]'::json),
  'rfir_devices', COALESCE((
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'type', type,
      'category', category,
      'slave_id', slave_id
    ))
    FROM rfir_devices
  ), '[]'::json),
  'ambients_rfir_slaves_rel', COALESCE((
    SELECT json_agg(json_build_object(
      'ambient_id', ambient_id,
      'slave_id', slave_id
    ))
    FROM ambients_rfir_slaves_rel
  ), '[]'::json),
  'ambients_rfir_devices_rel', COALESCE((
    SELECT json_agg(json_build_object(
      'ambient_id', ambient_id,
      'rfir_device_id', rfir_device_id
    ))
    FROM ambients_rfir_devices_rel
  ), '[]'::json),
  'environment', COALESCE((
    SELECT json_object_agg(key, value)
    FROM environment
  ), '{}'::json)
) AS state;
