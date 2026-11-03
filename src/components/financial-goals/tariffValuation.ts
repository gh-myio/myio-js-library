/**
 * RFC-0241 §5.3 — Pure tariff valuator ("R$ instead of kWh/m³").
 *
 * Turns per-device bucketed consumption (kWh or m³) into an **estimated cost**
 * using GCDR hourly tariff trees (GCDR RFC-0054, read via `TariffApiClient`,
 * RFC-0228 A1). No DOM, no ThingsBoard, no fetch — callers load the trees and
 * the consumption series and hand them in.
 *
 * Disciplines (RFC-0228 A1 / A4 / DEC-6 / DEC-8):
 *  - **Prices are decimal strings; never `Number(price)`.** Quantities are
 *    normalised to a fixed 6-decimal string and multiplied as `BigInt`
 *    (6dp × 6dp → exact 12dp product).
 *  - **No rounding here.** Amounts are returned unrounded (decimal strings);
 *    rounding happens once, at display (`formatMoneyBRL`). Parents are
 *    `round(Σ raw)`, never `Σ round` — use {@link TariffValuator.sum}.
 *  - **Honest coverage.** A device is `complete` only when every bucket is
 *    priced by a single price for the device's tariff category. Otherwise it is
 *    `partial` / `none` / `uncategorized` and carries **no amount** — the UI must
 *    keep the physical value and show a coverage marker (never `R$ 0`, never a
 *    partial sum presented as a total).
 *  - **Category is explicit** (`SPECIFIC` | `COMMON_AREA`); this module never
 *    infers it from names.
 */

import type { TariffTreeNode, TariffTreeResponse, WireCategory } from '../pricing-panel/tariffApiClient';

/** Max period (days) for which hourly consumption is fetched when tariffs vary intraday. */
export const MONEY_HOURLY_MAX_DAYS = 31;

/** Default timezone of the tariff trees (GCDR RFC-0054). */
export const TARIFF_DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const HOUR_MS = 3_600_000;
/** Fixed scale of quantities and prices (decimal places). */
const QTY_SCALE = 6;
const PRICE_SCALE = 6;
/** Scale of a raw amount = QTY_SCALE + PRICE_SCALE. */
const AMOUNT_SCALE = QTY_SCALE + PRICE_SCALE;

/** One consumption bucket `[startTs, endTs)` in epoch ms; `qty` in kWh or m³. */
export interface ValuationBucket {
  startTs: number;
  endTs: number;
  qty: number;
}

export interface DeviceSeries {
  deviceKey: string;
  /** Explicit tariff category; `null` → uncategorized (kept in physical units). */
  category: WireCategory | null;
  buckets: ValuationBucket[];
}

export type DeviceMoneyState = 'complete' | 'partial' | 'none' | 'uncategorized' | 'not-convertible';

export type DeviceMoneyReason =
  | 'no-category'
  | 'no-tariff'
  | 'no-data'
  | 'needs-hourly'
  | 'invalid-qty'
  | 'intraday-tariff-long-period';

export interface DeviceMoney {
  state: DeviceMoneyState;
  /** Unrounded decimal string; present **only** when `state === 'complete'`. */
  amount?: string;
  /** Fraction of buckets priced (0..1). */
  coveredRatio?: number;
  /** Why the device is not `complete` (first uncovered reason). */
  reason?: DeviceMoneyReason;
  /** True when more than one price applied across the period ("tarifa variável no período"). */
  priceVaries?: boolean;
}

export interface MoneySum {
  state: 'complete' | 'partial' | 'none';
  /** Unrounded `Σ raw`; present only when every member is `complete`. */
  amount?: string;
  /** Members that are `complete`. */
  covered: number;
  /** Members considered. */
  total: number;
}

export type ConsumptionGranularity = '1d' | '1h';

export interface GranularityDecision {
  granularity: ConsumptionGranularity;
  /**
   * True when tariffs vary inside a day but the period exceeds
   * {@link MONEY_HOURLY_MAX_DAYS}: daily buckets are fetched and the affected
   * buckets come back `partial` with reason `needs-hourly`.
   */
  intradayLimited: boolean;
}

export interface TariffValuatorOptions {
  /** Tariff trees per category (one response per tariff year). */
  trees: Partial<Record<WireCategory, TariffTreeResponse[]>>;
  /** IANA timezone for resolving local hour/day. Default `America/Sao_Paulo`. */
  timezone?: string;
}

export interface TariffValuator {
  /** Price (decimal string) in force at `ts` for `category`; `null` when no tariff covers it. */
  priceAt(category: WireCategory, ts: number): string | null;
  /**
   * Value one device's series. Pass `intradayLimited` from {@link chooseGranularity}
   * so buckets that needed hourly data report `intraday-tariff-long-period`.
   */
  valuate(series: DeviceSeries, opts?: { intradayLimited?: boolean }): DeviceMoney;
  /** Aggregate devices: `complete` (with `round`-free `Σ raw`) only if every member is complete. */
  sum(list: DeviceMoney[]): MoneySum;
  /** Decide the consumption granularity for a period (§5.4 step 2). */
  chooseGranularity(categories: WireCategory[], startTs: number, endTs: number): GranularityDecision;
}

// ---------------------------------------------------------------------------
// Decimal helpers (BigInt, no float)
// ---------------------------------------------------------------------------

const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/;

/** Parse a decimal string to a BigInt scaled by 10^scale (truncates extra digits). */
function parseScaled(s: string, scale: number): bigint | null {
  const m = DECIMAL_RE.exec(String(s).trim());
  if (!m) return null;
  const frac = (m[3] || '').slice(0, scale).padEnd(scale, '0');
  const v = BigInt(m[2] + frac);
  return m[1] === '-' ? -v : v;
}

/** Format a BigInt scaled by 10^scale as a decimal string (trailing zeros trimmed, ≥ 2 dp). */
function formatScaled(v: bigint, scale: number): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const digits = abs.toString().padStart(scale + 1, '0');
  const int = digits.slice(0, digits.length - scale);
  let frac = digits.slice(digits.length - scale).replace(/0+$/, '');
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  const isZero = abs === 0n;
  return `${neg && !isZero ? '-' : ''}${int}.${frac}`;
}

/** Normalise a numeric quantity to a BigInt at QTY_SCALE (via a fixed 6-dp string). */
function qtyToScaled(qty: number): bigint | null {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || Math.abs(qty) >= 1e15) return null;
  return parseScaled(qty.toFixed(QTY_SCALE), QTY_SCALE);
}

function isPriceString(p: unknown): p is string {
  return typeof p === 'string' && DECIMAL_RE.test(p.trim());
}

// ---------------------------------------------------------------------------
// Local time
// ---------------------------------------------------------------------------

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function makeLocalPartsFn(timezone: string): (ts: number) => LocalParts {
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    fmt = null;
  }
  return (ts: number) => {
    if (fmt) {
      const out: Record<string, number> = {};
      for (const p of fmt.formatToParts(new Date(ts))) {
        if (p.type === 'year' || p.type === 'month' || p.type === 'day' || p.type === 'hour') {
          out[p.type] = Number(p.value);
        }
      }
      return { year: out.year, month: out.month, day: out.day, hour: out.hour % 24 };
    }
    // Fallback: Brasília sem horário de verão (UTC−3).
    const d = new Date(ts - 3 * HOUR_MS);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours() };
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Tree resolution (finest wins: hour > day > month > annual)
// ---------------------------------------------------------------------------

function nodePrice(node: TariffTreeNode | undefined): string | null {
  return node && isPriceString(node.price) ? node.price.trim() : null;
}

function hourPrice(dayNode: TariffTreeNode | undefined, hour: number): string | null {
  const hourly = dayNode?.hourly;
  if (!hourly) return null;
  return nodePrice(hourly[String(hour)]) ?? nodePrice(hourly[pad2(hour)]);
}

function resolveTreePrice(tree: TariffTreeNode, p: LocalParts): string | null {
  const mm = pad2(p.month);
  const dd = pad2(p.day);
  const mmdd = `${mm}-${dd}`;
  const monthNode = tree.monthly?.[mm];
  const dayNodes = [tree.daily?.[mmdd], monthNode?.daily?.[dd], monthNode?.daily?.[mmdd]];
  for (const dn of dayNodes) {
    const hp = hourPrice(dn, p.hour);
    if (hp) return hp;
  }
  for (const dn of dayNodes) {
    const dp = nodePrice(dn);
    if (dp) return dp;
  }
  return nodePrice(monthNode) ?? nodePrice(tree.annual);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTariffValuator(options: TariffValuatorOptions): TariffValuator {
  const trees = options?.trees || {};
  const localParts = makeLocalPartsFn(options?.timezone || TARIFF_DEFAULT_TIMEZONE);

  const byYear: Partial<Record<WireCategory, Map<number, TariffTreeNode>>> = {};
  (Object.keys(trees) as WireCategory[]).forEach((cat) => {
    const map = new Map<number, TariffTreeNode>();
    for (const res of trees[cat] || []) {
      if (res && typeof res.year === 'number' && res.tree) map.set(res.year, res.tree);
    }
    byYear[cat] = map;
  });

  function hasAnyTariff(category: WireCategory): boolean {
    const map = byYear[category];
    return !!map && map.size > 0;
  }

  function priceAt(category: WireCategory, ts: number): string | null {
    const map = byYear[category];
    if (!map || !Number.isFinite(ts)) return null;
    const p = localParts(ts);
    const tree = map.get(p.year);
    return tree ? resolveTreePrice(tree, p) : null;
  }

  /** Prices of every hour inside [startTs, endTs) (at least the start hour). */
  function pricesInside(category: WireCategory, startTs: number, endTs: number): Array<string | null> {
    const out: Array<string | null> = [];
    const end = Math.max(endTs, startTs + 1);
    for (let t = startTs; t < end; t += HOUR_MS) out.push(priceAt(category, t));
    return out;
  }

  function valuate(series: DeviceSeries, opts?: { intradayLimited?: boolean }): DeviceMoney {
    const needsHourlyReason: DeviceMoneyReason = opts?.intradayLimited
      ? 'intraday-tariff-long-period'
      : 'needs-hourly';
    const category = series?.category ?? null;
    if (!category) return { state: 'uncategorized', reason: 'no-category' };
    if (!hasAnyTariff(category)) return { state: 'none', reason: 'no-tariff', coveredRatio: 0 };
    const buckets = Array.isArray(series.buckets) ? series.buckets : [];
    if (buckets.length === 0) return { state: 'none', reason: 'no-data', coveredRatio: 0 };

    let acc = 0n;
    let covered = 0;
    let firstReason: DeviceMoneyReason | undefined;
    const distinct = new Set<string>();

    for (const b of buckets) {
      const qty = qtyToScaled(b?.qty as number);
      if (qty == null || !Number.isFinite(b.startTs) || !Number.isFinite(b.endTs)) {
        firstReason = firstReason || 'invalid-qty';
        continue;
      }
      const prices = pricesInside(category, b.startTs, b.endTs);
      if (prices.some((p) => p == null)) {
        firstReason = firstReason || 'no-tariff';
        continue;
      }
      const unique = new Set(prices as string[]);
      if (unique.size > 1) {
        // Tarifa varia dentro do bucket (ex.: bucket diário com bandas horárias).
        firstReason = firstReason || needsHourlyReason;
        continue;
      }
      const price = prices[0] as string;
      const scaledPrice = parseScaled(price, PRICE_SCALE);
      if (scaledPrice == null) {
        firstReason = firstReason || 'no-tariff';
        continue;
      }
      distinct.add(formatScaled(scaledPrice, PRICE_SCALE));
      acc += qty * scaledPrice;
      covered += 1;
    }

    const ratio = covered / buckets.length;
    const priceVaries = distinct.size > 1;
    if (covered === buckets.length) {
      return { state: 'complete', amount: formatScaled(acc, AMOUNT_SCALE), coveredRatio: 1, priceVaries };
    }
    if (covered === 0) return { state: 'none', reason: firstReason || 'no-tariff', coveredRatio: 0 };
    return { state: 'partial', reason: firstReason, coveredRatio: ratio, priceVaries };
  }

  function sum(list: DeviceMoney[]): MoneySum {
    const items = Array.isArray(list) ? list : [];
    const total = items.length;
    if (total === 0) return { state: 'none', covered: 0, total: 0 };
    let acc = 0n;
    let covered = 0;
    for (const m of items) {
      if (m?.state !== 'complete' || m.amount == null) continue;
      const v = parseScaled(m.amount, AMOUNT_SCALE);
      if (v == null) continue;
      acc += v;
      covered += 1;
    }
    if (covered === total) return { state: 'complete', amount: formatScaled(acc, AMOUNT_SCALE), covered, total };
    return { state: covered > 0 ? 'partial' : 'none', covered, total };
  }

  function chooseGranularity(categories: WireCategory[], startTs: number, endTs: number): GranularityDecision {
    const cats = Array.from(new Set((categories || []).filter(Boolean)));
    let intraday = false;
    outer: for (const cat of cats) {
      let dayKey = '';
      let dayPrice: string | null | undefined;
      for (let t = startTs; t < endTs; t += HOUR_MS) {
        const p = localParts(t);
        const key = `${p.year}-${p.month}-${p.day}`;
        const price = priceAt(cat, t);
        if (key !== dayKey) {
          dayKey = key;
          dayPrice = price;
        } else if (price !== dayPrice) {
          intraday = true;
          break outer;
        }
      }
    }
    if (!intraday) return { granularity: '1d', intradayLimited: false };
    const days = (endTs - startTs) / (24 * HOUR_MS);
    if (days <= MONEY_HOURLY_MAX_DAYS) return { granularity: '1h', intradayLimited: false };
    return { granularity: '1d', intradayLimited: true };
  }

  return { priceAt, valuate, sum, chooseGranularity };
}
