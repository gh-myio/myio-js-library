/**
 * RFC-0228 A1 — Bidirectional adapter between the pricing panel's UX shape and
 * the GCDR **hourly tariff** contract (RFC-0054, frozen).
 *
 * The panel thinks in `month | range` periods, `energy|water` domains,
 * `lojas|area_comum` categories and (legacy) numeric `pricePerKwh`. The server
 * stores **hourly buckets** keyed by `(customer × domain × category × year)`,
 * WIRE domains/categories, and **decimal-string** prices. This module is the
 * ONLY place those two worlds meet:
 *
 *  - **Category / domain maps** — centralized here (both directions). Nothing
 *    else in the codebase string-matches `SPECIFIC`/`COMMON_AREA`/`ENERGY`/…
 *  - **Write (panel → PUT/PATCH):** a day price expands to its 24 hourly buckets,
 *    a range to every hour of its days, an intraday band to exactly its hours,
 *    a month to every hour of the month. Annual → PUT (replace year); everything
 *    else → PATCH (sparse merge, siblings preserved). Carries `expectedVersion`.
 *  - **Read (GET → panel):** the hourly/day tree collapses equal contiguous
 *    hours/days back into `month|range|day|band` bands with a single price.
 *  - **Prices are decimal strings end to end.** `pricePerKwh` (number) is accepted
 *    only as a *legacy input alias* and normalized to the canonical string
 *    `price`; it is never echoed back to the wire. A numeric view is derived for
 *    rendering only, never for round-tripping.
 *  - **Leap year** (Feb 29 exists only in leap years) and the **empty tariff**
 *    (`version: 0` → "no entries", not an error) are handled explicitly.
 *
 * Pure & framework-agnostic: no DOM, no ThingsBoard. Uses `TariffApiClient`.
 */

import type { PricingCategory, PricingDomain, PricingEntry } from './types';
import type {
  TariffApiClient,
  TariffBucket,
  TariffSelector,
  TariffTreeNode,
  TariffTreeResponse,
  WireCategory,
  WireDomain,
} from './tariffApiClient';

// ---------------------------------------------------------------------------
// Dimension maps — the single source of truth for panel↔wire translation.
// ---------------------------------------------------------------------------

/** panel domain → WIRE domain. */
export const PANEL_TO_WIRE_DOMAIN: Record<PricingDomain, WireDomain> = {
  energy: 'ENERGY',
  water: 'WATER',
};
/** WIRE domain → panel domain. */
export const WIRE_TO_PANEL_DOMAIN: Record<WireDomain, PricingDomain> = {
  ENERGY: 'energy',
  WATER: 'water',
};
/** panel category → WIRE category (`lojas` = tenant/SPECIFIC, `area_comum` = COMMON_AREA). */
export const PANEL_TO_WIRE_CATEGORY: Record<PricingCategory, WireCategory> = {
  lojas: 'SPECIFIC',
  area_comum: 'COMMON_AREA',
};
/** WIRE category → panel category. */
export const WIRE_TO_PANEL_CATEGORY: Record<WireCategory, PricingCategory> = {
  SPECIFIC: 'lojas',
  COMMON_AREA: 'area_comum',
};

export function panelDomainToWire(d: PricingDomain): WireDomain {
  const w = PANEL_TO_WIRE_DOMAIN[d];
  if (!w) throw new Error(`Unknown panel domain: ${String(d)}`);
  return w;
}
export function wireDomainToPanel(w: WireDomain): PricingDomain {
  const d = WIRE_TO_PANEL_DOMAIN[w];
  if (!d) throw new Error(`Unknown wire domain: ${String(w)}`);
  return d;
}
export function panelCategoryToWire(c: PricingCategory): WireCategory {
  const w = PANEL_TO_WIRE_CATEGORY[c];
  if (!w) throw new Error(`Unknown panel category: ${String(c)}`);
  return w;
}
export function wireCategoryToPanel(w: WireCategory): PricingCategory {
  const c = WIRE_TO_PANEL_CATEGORY[w];
  if (!c) throw new Error(`Unknown wire category: ${String(w)}`);
  return c;
}

// ---------------------------------------------------------------------------
// Price normalization — canonical decimal string; numeric only as legacy alias.
// ---------------------------------------------------------------------------

/**
 * Canonicalize a price to a decimal STRING.
 *  - A non-empty string is preserved **verbatim** (`"0.892000"` stays
 *    `"0.892000"`; no `Number()` drift).
 *  - A finite `pricePerKwh` (legacy numeric alias) is formatted to a string with
 *    up to 6 decimals. It is NEVER echoed back as `pricePerKwh`.
 * Throws if neither is usable or the value is `<= 0`.
 */
export function normalizePriceString(input: {
  price?: string | number | null;
  pricePerKwh?: number | null;
}): string {
  if (typeof input.price === 'string' && input.price.trim() !== '') {
    const s = input.price.trim();
    if (!(Number(s) > 0)) throw new Error(`Price must be > 0 (got "${s}").`);
    return s;
  }
  const numeric =
    typeof input.price === 'number'
      ? input.price
      : typeof input.pricePerKwh === 'number'
        ? input.pricePerKwh
        : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('A positive price (string) or legacy numeric pricePerKwh is required.');
  }
  // Up to 6 decimals, trailing zeros trimmed but at least 2 kept for readability.
  let s = numeric.toFixed(6).replace(/0+$/, '');
  if (/\.\d?$/.test(s)) s = numeric.toFixed(2);
  return s;
}

/** Numeric view for RENDERING ONLY — never feed this back into a write. */
export function priceToNumber(price: string): number {
  return Number(price);
}

// ---------------------------------------------------------------------------
// Calendar helpers (nominal civil days; leap-year aware). No timezone math.
// ---------------------------------------------------------------------------

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Days in `month` (1–12) of `year`, honoring Feb 29 in leap years. */
export function daysInMonthYear(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_DAYS[month - 1];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Assert a `YYYY-MM-DD` is a real civil date — rejects `02-29` in a non-leap
 * year (mirrors the backend's `TARIFF_BUCKET_INVALID`).
 */
export function assertValidCivilDate(date: string): void {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) throw new Error(`Invalid month in date: ${date}`);
  if (d < 1 || d > daysInMonthYear(y, mo)) {
    throw new Error(`Invalid day for ${y}-${pad2(mo)} (leap=${isLeapYear(y)}): ${date}`);
  }
}

/** Inclusive iterator of `YYYY-MM-DD` between `start` and `end` (UTC math). */
export function* eachDate(start: string, end: string): Generator<string> {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const t1 = Date.UTC(ye, me - 1, de);
  for (let t = Date.UTC(ys, ms - 1, ds); t <= t1; t += 86400000) {
    const dt = new Date(t);
    yield `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }
}

// ---------------------------------------------------------------------------
// Canonical adapter band — the shape both directions speak internally.
// ---------------------------------------------------------------------------

export type TariffBandPeriod = 'year' | 'month' | 'range' | 'day' | 'band';

/**
 * A canonical tariff band. `price` is the decimal string (authoritative).
 * `pricePerKwh` is accepted on INPUT only (legacy alias) and never populated on
 * adapter output.
 */
export interface TariffBand {
  domain: PricingDomain;
  category: PricingCategory;
  periodType: TariffBandPeriod;
  /** Explicit year for `year` bands; otherwise derived from the period. */
  year?: number;
  /** `YYYY-MM` for `month`. */
  periodKey?: string;
  /** `YYYY-MM-DD` for `range`. */
  start?: string;
  end?: string;
  /** `YYYY-MM-DD` for `day` / `band`. */
  date?: string;
  /** Inclusive intraday hour window for `band` (0–23). */
  startHour?: number;
  endHour?: number;
  /** Canonical decimal-string price. */
  price: string;
}

/** Loose input accepted from callers (price may still be numeric/legacy). */
export type TariffBandInput = Omit<TariffBand, 'price'> & {
  price?: string | number | null;
  pricePerKwh?: number | null;
};

/** Normalize a loose band: canonical decimal-string price, no legacy echo. */
export function normalizeBand(input: TariffBandInput): TariffBand {
  const price = normalizePriceString(input);
  const band: TariffBand = {
    domain: input.domain,
    category: input.category,
    periodType: input.periodType,
    price,
  };
  if (input.year != null) band.year = input.year;
  if (input.periodKey != null) band.periodKey = input.periodKey;
  if (input.start != null) band.start = input.start;
  if (input.end != null) band.end = input.end;
  if (input.date != null) band.date = input.date;
  if (input.startHour != null) band.startHour = input.startHour;
  if (input.endHour != null) band.endHour = input.endHour;
  return band;
}

/** The `(customer × domain × category × year)` key for version bookkeeping. */
function selectorKey(sel: TariffSelector): string {
  return `${sel.domain}|${sel.category}|${sel.year}`;
}

/** Build a WIRE selector for a band + explicit year. */
export function bandSelector(band: TariffBand, customerId: string, year: number): TariffSelector {
  return {
    customerId,
    domain: panelDomainToWire(band.domain),
    category: panelCategoryToWire(band.category),
    year,
  };
}

// ---------------------------------------------------------------------------
// Panel entry ↔ band
// ---------------------------------------------------------------------------

/** Panel `PricingEntry` (month|range) → canonical band. */
export function panelEntryToBand(e: PricingEntry): TariffBand {
  const price = normalizePriceString({ price: e.price, pricePerKwh: e.pricePerKwh });
  if (e.periodType === 'month') {
    if (!e.periodKey) throw new Error('month entry missing periodKey');
    return { domain: e.domain, category: e.category, periodType: 'month', periodKey: e.periodKey, price };
  }
  if (!e.start || !e.end) throw new Error('range entry missing start/end');
  return { domain: e.domain, category: e.category, periodType: 'range', start: e.start, end: e.end, price };
}

/**
 * Canonical band → panel `PricingEntry` for display. The panel UI only renders
 * `month|range`, so `year`→whole-year range, `day`/`band`→single-day range (the
 * intraday hour window is not shown by the month/range UI — flagged in the RFC).
 * `price` carries the authoritative decimal string; `pricePerKwh` is the derived
 * numeric view for the existing `formatBRL` render path.
 */
export function bandToPanelEntry(band: TariffBand, customerId: string): PricingEntry {
  const base = {
    customerId,
    domain: band.domain,
    category: band.category,
    currency: 'BRL' as const,
    price: band.price,
    pricePerKwh: priceToNumber(band.price),
  };
  if (band.periodType === 'month' && band.periodKey) {
    return { ...base, periodType: 'month', periodKey: band.periodKey };
  }
  if (band.periodType === 'year' && band.year != null) {
    return { ...base, periodType: 'range', start: `${band.year}-01-01`, end: `${band.year}-12-31` };
  }
  if (band.periodType === 'range' && band.start && band.end) {
    return { ...base, periodType: 'range', start: band.start, end: band.end };
  }
  // day | band → single-day range
  const date = band.date || band.start || '';
  return { ...base, periodType: 'range', start: date, end: date };
}

// ---------------------------------------------------------------------------
// WRITE — expand a band into hourly buckets, grouped by tariff year.
// ---------------------------------------------------------------------------

/** Every hour (`0..23`) of `date` at `price` → HOUR buckets. */
export function expandDayToHourBuckets(date: string, price: string): TariffBucket[] {
  assertValidCivilDate(date);
  const out: TariffBucket[] = [];
  for (let h = 0; h < 24; h++) out.push({ level: 'HOUR', ref: `${date}T${pad2(h)}`, price });
  return out;
}

/** An intraday band `[startHour, endHour]` (inclusive) of `date` → HOUR buckets. */
export function expandBandHours(
  date: string,
  startHour: number,
  endHour: number,
  price: string
): TariffBucket[] {
  assertValidCivilDate(date);
  if (startHour < 0 || endHour > 23 || startHour > endHour) {
    throw new Error(`Invalid hour band ${startHour}-${endHour} for ${date}`);
  }
  const out: TariffBucket[] = [];
  for (let h = startHour; h <= endHour; h++) out.push({ level: 'HOUR', ref: `${date}T${pad2(h)}`, price });
  return out;
}

/** The inclusive `[start,end]` civil-date bounds a band covers. */
export function bandDateBounds(band: TariffBand): { start: string; end: string } {
  switch (band.periodType) {
    case 'month': {
      if (!band.periodKey) throw new Error('month band missing periodKey');
      const [y, m] = band.periodKey.split('-').map(Number);
      return { start: `${band.periodKey}-01`, end: `${band.periodKey}-${pad2(daysInMonthYear(y, m))}` };
    }
    case 'range': {
      if (!band.start || !band.end) throw new Error('range band missing start/end');
      return { start: band.start, end: band.end };
    }
    case 'day':
    case 'band': {
      const d = band.date || band.start;
      if (!d) throw new Error('day/band missing date');
      return { start: d, end: d };
    }
    case 'year': {
      const y = band.year;
      if (y == null) throw new Error('year band missing year');
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    default:
      throw new Error(`Unsupported band periodType: ${String(band.periodType)}`);
  }
}

/**
 * Expand a band into HOUR buckets, grouped by tariff year (a range may cross a
 * year boundary; each year is a separate tariff resource). `year` bands are NOT
 * bucket-expanded — they route through PUT annual (see {@link TariffApiAdapter}).
 */
export function expandBandToHourBucketsByYear(band: TariffBand): Map<number, TariffBucket[]> {
  const byYear = new Map<number, TariffBucket[]>();
  const push = (year: number, buckets: TariffBucket[]): void => {
    const arr = byYear.get(year) || [];
    arr.push(...buckets);
    byYear.set(year, arr);
  };

  if (band.periodType === 'band') {
    const date = band.date || band.start!;
    push(Number(date.slice(0, 4)), expandBandHours(date, band.startHour ?? 0, band.endHour ?? 23, band.price));
    return byYear;
  }

  const { start, end } = bandDateBounds(band);
  for (const date of eachDate(start, end)) {
    push(Number(date.slice(0, 4)), expandDayToHourBuckets(date, band.price));
  }
  return byYear;
}

// ---------------------------------------------------------------------------
// READ — collapse a tariff tree back into user-facing bands.
// ---------------------------------------------------------------------------

/**
 * Merge a day's hours into the fewest contiguous equal-price bands. A single
 * band spanning `0..23` collapses to a `day`; anything narrower is a `band`.
 * Non-contiguous or unequal-priced hours stay split.
 */
export function collapseHoursToBands(
  date: string,
  hours: Array<{ hour: number; price: string }>,
  dims: { domain: PricingDomain; category: PricingCategory }
): TariffBand[] {
  const sorted = [...hours].sort((a, b) => a.hour - b.hour);
  const runs: Array<{ startHour: number; endHour: number; price: string }> = [];
  for (const h of sorted) {
    const cur = runs[runs.length - 1];
    if (cur && h.hour === cur.endHour + 1 && h.price === cur.price) {
      cur.endHour = h.hour;
    } else {
      runs.push({ startHour: h.hour, endHour: h.hour, price: h.price });
    }
  }
  return runs.map((r) =>
    r.startHour === 0 && r.endHour === 23
      ? { domain: dims.domain, category: dims.category, periodType: 'day' as const, date, price: r.price }
      : {
          domain: dims.domain,
          category: dims.category,
          periodType: 'band' as const,
          date,
          startHour: r.startHour,
          endHour: r.endHour,
          price: r.price,
        }
  );
}

/** Resolve a day node's 24 hours: hourly override wins, else the day price. */
function dayNodeToHours(node: TariffTreeNode): Array<{ hour: number; price: string }> | null {
  const dayPrice = typeof node.price === 'string' ? node.price : undefined;
  const hourly = node.hourly || {};
  const hourKeys = Object.keys(hourly);
  if (hourKeys.length === 0) {
    return dayPrice != null ? Array.from({ length: 24 }, (_, h) => ({ hour: h, price: dayPrice })) : null;
  }
  const out: Array<{ hour: number; price: string }> = [];
  for (let h = 0; h < 24; h++) {
    const ov = hourly[String(h)];
    const price = ov && typeof ov.price === 'string' ? ov.price : dayPrice;
    if (price != null) out.push({ hour: h, price });
  }
  return out.length ? out : null;
}

/** Normalize a daily-map key (`MM-DD` at day granularity or `DD` under a month) to `MM-DD`. */
function normalizeDayKey(key: string, monthKey?: string): string {
  if (/^\d{2}-\d{2}$/.test(key)) return key;
  if (/^\d{2}$/.test(key) && monthKey) return `${monthKey}-${key}`;
  return key;
}

/** Merge contiguous equal-price single-day bands into `range`/`day` bands. */
function mergeContiguousDays(days: TariffBand[], year: number): TariffBand[] {
  // Only merge simple full-day bands (no intraday variation).
  const simple = days.every((d) => d.periodType === 'day' && d.date);
  if (!simple || days.length === 0) return days;
  const sorted = [...days].sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const out: TariffBand[] = [];
  let run: { start: string; end: string; price: string; dims: TariffBand } | null = null;
  const flush = (): void => {
    if (!run) return;
    out.push(
      run.start === run.end
        ? { domain: run.dims.domain, category: run.dims.category, periodType: 'day', date: run.start, price: run.price }
        : {
            domain: run.dims.domain,
            category: run.dims.category,
            periodType: 'range',
            start: run.start,
            end: run.end,
            price: run.price,
          }
    );
    run = null;
  };
  for (const d of sorted) {
    if (run && d.price === run.price && isNextDay(run.end, d.date!)) {
      run.end = d.date!;
    } else {
      flush();
      run = { start: d.date!, end: d.date!, price: d.price, dims: d };
    }
  }
  flush();
  void year;
  return out;
}

function isNextDay(prev: string, next: string): boolean {
  const [py, pm, pd] = prev.split('-').map(Number);
  const [ny, nm, nd] = next.split('-').map(Number);
  return Date.UTC(py, pm - 1, pd) + 86400000 === Date.UTC(ny, nm - 1, nd);
}

/**
 * Collapse a tariff tree into user-facing bands. Handles the frozen shapes:
 * empty tree → `[]`; `annual` uniform → one `year` band; `monthly`/`daily` maps
 * → per-day collapse (intraday variation kept as `band`s), then contiguous equal
 * days merged into `range`s.
 */
export function collapseTreeToBands(
  tree: TariffTreeNode,
  dims: { year: number; domain: PricingDomain; category: PricingCategory }
): TariffBand[] {
  if (!tree || typeof tree !== 'object') return [];
  const dimOnly = { domain: dims.domain, category: dims.category };

  // Annual uniform tariff (FLAT v1 common case).
  if (tree.annual && typeof tree.annual.price === 'string' && !tree.daily && !tree.monthly) {
    return [{ ...dimOnly, periodType: 'year', year: dims.year, price: tree.annual.price }];
  }

  const dayBands: TariffBand[] = [];

  const collectDaily = (daily: Record<string, TariffTreeNode>, monthKey?: string): void => {
    for (const rawKey of Object.keys(daily)) {
      const mmdd = normalizeDayKey(rawKey, monthKey);
      const date = `${dims.year}-${mmdd}`;
      const hours = dayNodeToHours(daily[rawKey]);
      if (!hours) continue;
      dayBands.push(...collapseHoursToBands(date, hours, dimOnly));
    }
  };

  if (tree.daily) collectDaily(tree.daily);
  if (tree.monthly) {
    for (const mm of Object.keys(tree.monthly)) {
      const node = tree.monthly[mm];
      if (node.daily) {
        collectDaily(node.daily, mm);
      } else if (typeof node.price === 'string') {
        // Uniform month → expand to its days as day bands (merged below).
        const last = daysInMonthYear(dims.year, Number(mm));
        for (let d = 1; d <= last; d++) {
          dayBands.push({ ...dimOnly, periodType: 'day', date: `${dims.year}-${mm}-${pad2(d)}`, price: node.price });
        }
      }
    }
  }

  return mergeContiguousDays(dayBands, dims.year);
}

// ---------------------------------------------------------------------------
// The adapter — orchestrates load / save / delete against the client.
// ---------------------------------------------------------------------------

/** The four `(domain × category)` combos a customer's tariffs span. */
const WIRE_COMBOS: Array<[WireDomain, WireCategory]> = [
  ['ENERGY', 'SPECIFIC'],
  ['ENERGY', 'COMMON_AREA'],
  ['WATER', 'SPECIFIC'],
  ['WATER', 'COMMON_AREA'],
];

export interface TariffApiAdapterOptions {
  /** Tariff year to load (writes derive their own year from the period). */
  year?: number;
}

export class TariffApiAdapter {
  private readonly client: TariffApiClient;
  private readonly year: number;
  /** Last-seen version per `(domain|category|year)` for optimistic concurrency. */
  private readonly versions = new Map<string, number>();

  constructor(client: TariffApiClient, opts: TariffApiAdapterOptions = {}) {
    this.client = client;
    this.year = opts.year ?? new Date().getFullYear();
  }

  /** Default load year. */
  getYear(): number {
    return this.year;
  }

  /**
   * Load every `(domain × category)` tariff for a customer and collapse each into
   * panel entries. An empty tariff (`version: 0`) contributes no entries — it is
   * "no entries", never an error. Read errors propagate (caller surfaces them).
   */
  async loadEntriesForCustomer(customerId: string, year: number = this.year): Promise<PricingEntry[]> {
    const out: PricingEntry[] = [];
    for (const [domain, category] of WIRE_COMBOS) {
      const sel: TariffSelector = { customerId, domain, category, year };
      const resp = await this.client.getTariff(sel, 'hour');
      this.versions.set(selectorKey(sel), resp.version);
      if (resp.version === 0) continue; // empty tariff → no entries
      const bands = collapseTreeToBands(resp.tree, {
        year,
        domain: wireDomainToPanel(domain),
        category: wireCategoryToPanel(category),
      });
      for (const b of bands) out.push(bandToPanelEntry(b, customerId));
    }
    return out;
  }

  /** Convenience: read + collapse one specific tariff. */
  async loadBands(customerId: string, domain: PricingDomain, category: PricingCategory, year: number = this.year): Promise<{ bands: TariffBand[]; version: number }> {
    const sel: TariffSelector = { customerId, domain: panelDomainToWire(domain), category: panelCategoryToWire(category), year };
    const resp = await this.client.getTariff(sel, 'hour');
    this.versions.set(selectorKey(sel), resp.version);
    const bands = resp.version === 0 ? [] : collapseTreeToBands(resp.tree, { year, domain, category });
    return { bands, version: resp.version };
  }

  /**
   * Persist one panel edit. Annual bands REPLACE the year (PUT); every other
   * period MERGES its hourly buckets (PATCH), so sibling periods survive. A range
   * spanning a year boundary writes once per year. `expectedVersion` is carried
   * from the last-seen version; a stale guard throws `TARIFF_VERSION_CONFLICT`
   * (surfaced, never swallowed).
   */
  async saveEntry(customerId: string, entryOrBand: PricingEntry | TariffBandInput): Promise<void> {
    const band = toBand(entryOrBand);

    if (band.periodType === 'year') {
      const year = band.year ?? this.year;
      const sel = bandSelector(band, customerId, year);
      const key = selectorKey(sel);
      const res = await this.client.putTariff(sel, { annual: { price: band.price } }, this.versions.get(key));
      this.versions.set(key, res.version);
      return;
    }

    const byYear = expandBandToHourBucketsByYear(band);
    for (const [year, buckets] of byYear) {
      const sel = bandSelector(band, customerId, year);
      const key = selectorKey(sel);
      const res = await this.client.patchTariff(sel, buckets, this.versions.get(key));
      this.versions.set(key, res.version);
    }
  }

  /**
   * Remove a panel period. The contract offers whole-year DELETE or a single
   * sub-bucket per call, so a partial period is deleted day-by-day (`level:'DAY'`).
   * Removing a full year deletes the whole year in one call.
   */
  async deleteEntry(customerId: string, entryOrBand: PricingEntry | TariffBandInput): Promise<void> {
    const band = toBand(entryOrBand);

    if (band.periodType === 'year') {
      const year = band.year ?? this.year;
      const sel = bandSelector(band, customerId, year);
      const key = selectorKey(sel);
      const res = await this.client.deleteTariff(sel, { expectedVersion: this.versions.get(key) });
      if (typeof res.version === 'number') this.versions.set(key, res.version);
      return;
    }

    const { start, end } = bandDateBounds(band);
    for (const date of eachDate(start, end)) {
      const year = Number(date.slice(0, 4));
      const sel = bandSelector(band, customerId, year);
      const key = selectorKey(sel);
      const res = await this.client.deleteTariff(sel, {
        bucket: { level: 'DAY', ref: date },
        expectedVersion: this.versions.get(key),
      });
      if (typeof res.version === 'number') this.versions.set(key, res.version);
    }
  }

  /** Seed the version cache from an out-of-band read (e.g. a raw client call). */
  rememberVersion(resp: Pick<TariffTreeResponse, 'domain' | 'category' | 'year' | 'version'>): void {
    this.versions.set(`${resp.domain}|${resp.category}|${resp.year}`, resp.version);
  }
}

/** Accept a panel entry OR a loose band; always return a normalized band. */
function toBand(entryOrBand: PricingEntry | TariffBandInput): TariffBand {
  if ('periodType' in entryOrBand && (entryOrBand.periodType === 'month' || entryOrBand.periodType === 'range') && !('startHour' in entryOrBand)) {
    // Could be a PricingEntry or a month/range band — normalize via the entry path
    // when it looks like a PricingEntry (has customerId), else treat as a band.
    if ('customerId' in entryOrBand) return panelEntryToBand(entryOrBand as PricingEntry);
  }
  return normalizeBand(entryOrBand as TariffBandInput);
}

/** Convenience factory. */
export function createTariffApiAdapter(client: TariffApiClient, opts?: TariffApiAdapterOptions): TariffApiAdapter {
  return new TariffApiAdapter(client, opts);
}
