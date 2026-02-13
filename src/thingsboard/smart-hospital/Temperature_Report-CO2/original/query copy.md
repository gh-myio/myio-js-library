SELECT DISTINCT ON (date_trunc('day', timestamp), slave_id, hour_group)
date_trunc('day', timestamp) AS reading_date,
slave_id,
hour_group,
timestamp,
value
FROM (
SELECT
timestamp,
slave_id,
value,
CASE
WHEN date_part('hour', timestamp) >= 11 AND date_part('hour', timestamp) < 12 THEN '11:00'
WHEN date_part('hour', timestamp) >= 17 AND date_part('hour', timestamp) < 18 THEN '17:00'
WHEN date_part('hour', timestamp) >= 23 THEN '23:00'
END AS hour_group
FROM temperature_history
WHERE timestamp >= '{{{ msg.payload.dateStart }}}'
AND timestamp < '{{{ msg.payload.dateEnd }}}'
AND slave_id IN ({{{ msg.payload.slaveIds }}})
) subquery
WHERE hour_group IS NOT NULL
ORDER BY date_trunc('day', timestamp), slave_id, hour_group, timestamp;
