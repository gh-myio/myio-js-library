-- Temperature Report Query v3
-- All timestamps returned in UTC for consistency with frontend/controller

SELECT
    date_trunc('day', timestamp) AS reading_date,
    slave_id,
    date_trunc('hour', timestamp)
        + INTERVAL '30 minutes'
        * floor(date_part('minute', timestamp) / 30)
        AS time_interval,
    AVG(value) AS avg_value
FROM
    temperature_history
WHERE
    timestamp >= '{{{ msg.payload.dateStart }}}'
    AND timestamp < '{{{ msg.payload.dateEnd }}}'
    AND slave_id IN ({{{ msg.payload.slaveIds }}})
GROUP BY
    date_trunc('day', timestamp),
    slave_id,
    date_trunc('hour', timestamp)
        + INTERVAL '30 minutes'
        * floor(date_part('minute', timestamp) / 30)
ORDER BY
    slave_id,
    time_interval;
