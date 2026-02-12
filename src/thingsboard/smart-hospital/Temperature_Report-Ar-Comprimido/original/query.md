SELECT
date_trunc('day', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS reading_date,
slave_id,
date_trunc('hour', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') +
interval '30 minutes' _ floor(date_part('minute', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') / 30) AS time_interval,
AVG(value) AS avg_value
FROM temperature_history
WHERE timestamp >= '{{{ msg.payload.dateStart }}}'
AND timestamp < '{{{ msg.payload.dateEnd }}}'
AND slave_id IN ({{{ msg.payload.slaveIds }}})
GROUP BY
date_trunc('day', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'),
slave_id,
date_trunc('hour', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') +
interval '30 minutes' _ floor(date_part('minute', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') / 30)
ORDER BY
slave_id, -- Order by device ID first
time_interval; -- Then by timestamp
