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
