// engines/DateEngine.ts
export const toISOWithOffset = (d: string, endOfDay = false, tz = 'America/Sao_Paulo') => {
  const dt = new Date(`${d}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName:'shortOffset' })
    .formatToParts(dt).find(p=>p.type==='timeZoneName')?.value || '-03:00';
  return `${d}T${endOfDay ? '23:59:59' : '00:00:00'}${off.replace('GMT','')}`;
};

export const rangeDaysInclusive = (start: string, end: string) => {
  const out: string[] = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return out;
};

// RFC-0223: tz-pinned day/hour bucket keys — Intl.DateTimeFormat is tz-database
// driven, so DST transition days naturally yield 23/25 distinct hour keys instead
// of a hard-coded 24. Never use `new Date().getHours()` (browser-local-tz) for
// these keys — it would drift from the São Paulo day boundary the operator sees.
const dayHourParts = (timestamp: number | Date, tz: string, withHour: boolean) => {
  const dt = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withHour ? { hour: '2-digit' as const, hourCycle: 'h23' as const } : {}),
  }).formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
};

// 'YYYY-MM-DD' — the day bucket key, shared by 1d server buckets and 1h client bucketing.
export const toDayKey = (timestamp: number | Date, tz = 'America/Sao_Paulo'): string => {
  const { year, month, day } = dayHourParts(timestamp, tz, false);
  return `${year}-${month}-${day}`;
};

// 'YYYY-MM-DDTHH' — the hour bucket key (00-23, actual local hour count on DST days).
export const toHourKey = (timestamp: number | Date, tz = 'America/Sao_Paulo'): string => {
  const { year, month, day, hour } = dayHourParts(timestamp, tz, true);
  return `${year}-${month}-${day}T${hour}`;
};
