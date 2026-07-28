SELECT json_build_object(
  'ambients', COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'order', "order"))
    FROM ambients
  ), '[]'::json),
  'slaves', COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'type', type,
                                       'addr_low', addr_low, 'addr_high', addr_high))
    FROM slaves
  ), '[]'::json),
  'channels', COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'channel', channel,
                                       'type', type, 'slave_id', slave_id))
    FROM channels
  ), '[]'::json),
  'rfir_devices', COALESCE((
    SELECT json_agg(json_build_object('id', id, 'name', name, 'type', type,
                                       'category', category, 'slave_id', slave_id))
    FROM rfir_devices
  ), '[]'::json),
  'ambients_rfir_slaves_rel', COALESCE((
    SELECT json_agg(json_build_object('ambient_id', ambient_id, 'slave_id', slave_id))
    FROM ambients_rfir_slaves_rel
  ), '[]'::json),
  'ambients_rfir_devices_rel', COALESCE((
    SELECT json_agg(json_build_object('ambient_id', ambient_id, 'rfir_device_id', rfir_device_id))
    FROM ambients_rfir_devices_rel
  ), '[]'::json)
) AS state;