/**
 * RFC-0238 — period and buckets in America/Sao_Paulo.
 *
 * São Paulo is UTC-03:00 for every instant since the end of the last DST (2019-02-17); periods
 * starting before MIN_PERIOD_START are rejected, so a fixed offset is exact for every accepted
 * date. Periods are half-open `[start, end)`. Buckets sit on a clock grid anchored at local
 * midnight (00:00, 00:15, … / 00:00 every day); a partial bucket at either edge counts.
 */
import { RAW_MAX_DAYS, RESOLUTIONS, RESOLUTION_BY_ID } from './catalog';
import type { DemandResolution, PeriodPreset } from './types';

const SP_OFFSET_MS = -3 * 3_600_000;
/** 1970-01-01T00:00 local time = 03:00Z — origin of the bucket grid. */
const GRID_ORIGIN = -SP_OFFSET_MS;
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

/** Number of grid buckets of `resolution` intersecting `[start, end)` (edge buckets count). */
export function bucketCount(start: number, end: number, resolution: DemandResolution): number {
  if (!(end > start)) return 0;
  const size = RESOLUTION_BY_ID[resolution].ms;
  return Math.ceil((end - GRID_ORIGIN) / size) - Math.floor((start - GRID_ORIGIN) / size);
}

/** Finest grouping interval whose max period fits the range, or null. */
export function finestFittingResolution(range: Range): DemandResolution | null {
  const len = range.end - range.start;
  return RESOLUTIONS.find((r) => len <= r.maxDays * 86_400_000)?.id ?? null;
}

/** Max period (days) for an aggregated interval, or for Bruto (`null`). */
export function maxPeriodDays(resolution: DemandResolution | null): number {
  return resolution ? RESOLUTION_BY_ID[resolution].maxDays : RAW_MAX_DAYS;
}

/** Validation messages (pt-BR) for a range with a grouping interval (`null` = Bruto); empty when valid. */
export function periodErrors(range: Range, resolution: DemandResolution | null, now: number): string[] {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return ['Informe início e fim.'];
  if (range.end <= range.start) return ['O fim precisa ser depois do início.'];
  const errs: string[] = [];
  if (range.start < MIN_PERIOD_START_MS) errs.push('Períodos antes de 01/03/2019 não são suportados.');
  if (range.start > now) errs.push('O início está no futuro.');
  const maxDays = maxPeriodDays(resolution);
  if (range.end - range.start > maxDays * 86_400_000) {
    errs.push(resolution
      ? `Com agrupamento de ${RESOLUTION_BY_ID[resolution].label}, o período máximo é ${maxDays} dia(s).`
      : `Com dados brutos, o período máximo é ${maxDays} dia(s).`);
  }
  return errs;
}
