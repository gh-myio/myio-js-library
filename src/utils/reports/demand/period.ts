/**
 * RFC-0238 — period and buckets in America/Sao_Paulo.
 *
 * São Paulo is UTC-03:00 for every instant since the end of the last DST (2019-02-17); periods
 * starting before MIN_PERIOD_START are rejected, so a fixed offset is exact for every accepted
 * date. Periods are half-open `[start, end)`. Buckets are anchored at the period's `start`
 * (`[start + k·res, start + (k+1)·res)`, RFC-0075 §3.3); `1d` counts local calendar days and
 * requires `start` at local midnight (L-9).
 */
import { RESOLUTIONS, RESOLUTION_BY_ID } from './catalog';
import type { DemandResolution, PeriodPreset } from './types';

const SP_OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;
/** GCDR accepts `end` up to now + 5 min (partial periods). */
export const END_TOLERANCE_MS = 5 * 60_000;
/** First accepted local date (first full month after the last DST ended). */
export const MIN_PERIOD_START = '2019-03-01';
export const MIN_PERIOD_START_MS = Date.UTC(2019, 2, 1) - SP_OFFSET_MS;

export interface LocalParts {
  y: number;
  /** 0-based month. */
  m: number;
  d: number;
  h: number;
  mi: number;
}

/** Wall-clock parts in São Paulo of an instant. */
export function spParts(ms: number): LocalParts {
  const d = new Date(ms + SP_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

/** Instant of a São Paulo wall-clock time (month 0-based; days/months may overflow like Date.UTC). */
export function spEpoch(y: number, m: number, d: number, h = 0, mi = 0): number {
  return Date.UTC(y, m, d, h, mi) - SP_OFFSET_MS;
}

/** Parses `YYYY-MM-DDTHH:mm` (a `datetime-local` value) as São Paulo time; NaN when invalid. */
export function parseLocalDateTime(value: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  return m ? spEpoch(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
}

/** Formats an instant as a `datetime-local` value in São Paulo time. */
export function toLocalDateTimeInput(ms: number): string {
  const p = spParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** `dd/mm/aaaa hh:mm` in São Paulo time. */
export function formatLocalDateTime(ms: number): string {
  const p = spParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.d)}/${pad(p.m + 1)}/${p.y} ${pad(p.h)}:${pad(p.mi)}`;
}

export interface Range {
  start: number;
  end: number;
}

/**
 * Resolves a preset against ONE `now` snapshot. "today" / "thisMonth" end at `now`
 * (partial periods — RFC-0238 O-16 is still open); the others end at a local midnight.
 */
export function presetRange(preset: PeriodPreset, now: number): Range | null {
  const t = spParts(now);
  switch (preset) {
    case 'today':
      return { start: spEpoch(t.y, t.m, t.d), end: now };
    case 'yesterday':
      return { start: spEpoch(t.y, t.m, t.d - 1), end: spEpoch(t.y, t.m, t.d) };
    case 'last7days':
      return { start: spEpoch(t.y, t.m, t.d - 7), end: spEpoch(t.y, t.m, t.d) };
    case 'thisMonth':
      return { start: spEpoch(t.y, t.m, 1), end: now };
    case 'lastMonth':
      return { start: spEpoch(t.y, t.m - 1, 1), end: spEpoch(t.y, t.m, 1) };
    default:
      return null;
  }
}

/** True when the instant is a local (São Paulo) midnight. */
export function isLocalMidnight(ms: number): boolean {
  const p = spParts(ms);
  return p.h === 0 && p.mi === 0 && new Date(ms + SP_OFFSET_MS).getUTCSeconds() === 0 && ms % 1000 === 0;
}

/** Local midnight at or before the instant. */
export function localMidnightOf(ms: number): number {
  const p = spParts(ms);
  return spEpoch(p.y, p.m, p.d);
}

/**
 * Rows per device: `ceil((end − start) / res)`, anchored at `start`; for `1d` the number of local
 * calendar days touched (a partial last day counts). Same definition as GCDR's estimate.
 */
export function bucketCount(start: number, end: number, resolution: DemandResolution): number {
  if (!(end > start)) return 0;
  if (resolution === '1d') return Math.ceil((localMidnightOf(end - 1) - localMidnightOf(start)) / DAY_MS) + 1;
  return Math.ceil((end - start) / RESOLUTION_BY_ID[resolution].ms);
}

/** Finest resolution whose max period fits the range, or null. */
export function finestFittingResolution(range: Range): DemandResolution | null {
  const len = range.end - range.start;
  return RESOLUTIONS.find((r) => len <= r.maxDays * DAY_MS)?.id ?? null;
}

export function maxPeriodDays(resolution: DemandResolution): number {
  return RESOLUTION_BY_ID[resolution].maxDays;
}

/** Validation messages (pt-BR) for a range with a resolution; empty when valid. GCDR re-checks. */
export function periodErrors(range: Range, resolution: DemandResolution, now: number): string[] {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return ['Informe início e fim.'];
  if (range.end <= range.start) return ['O fim precisa ser depois do início.'];
  const errs: string[] = [];
  if (range.start < MIN_PERIOD_START_MS) errs.push('Períodos antes de 01/03/2019 não são suportados.');
  if (range.start > now) errs.push('O início está no futuro.');
  if (range.end > now + END_TOLERANCE_MS) errs.push('O fim não pode estar no futuro.');
  const maxDays = maxPeriodDays(resolution);
  if (range.end - range.start > maxDays * DAY_MS) {
    errs.push(`Com intervalos de ${RESOLUTION_BY_ID[resolution].label}, o período máximo é ${maxDays} dia(s).`);
  }
  if (resolution === '1d' && !isLocalMidnight(range.start)) {
    errs.push(`Com intervalos de 1 dia, o início precisa ser à meia-noite (ex.: ${formatLocalDateTime(localMidnightOf(range.start))}).`);
  }
  return errs;
}
