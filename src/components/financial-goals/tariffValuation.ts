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
  | 'intraday-tariff-long-period'
  | 'too-many-segments';

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
  /**
   * RFC-0241 rev. 2 — "constant-price segments". Split `[startTs, endTs)` at every
   * point where the effective price (or coverage) of **any** of `categories`
   * changes. Days whose price varies **inside** the day (hourly bands) collapse
   * into one `hourly` run per category — never one segment per hour.
   */
  planSegments(categories: WireCategory[], startTs: number, endTs: number): PricePlan;
  /**
   * Value one device from per-segment period totals (`qtyBySegment[i]` = the
   * device's consumption inside `plan.segments[i]`; `null`/`undefined` → no data).
   * Segments that are `none` / `hourly` for the device's category never need a
   * quantity — they make the device `partial`/`none` (honest coverage).
   */
  valuatePlan(
    category: WireCategory | null,
    plan: PricePlan,
    qtyBySegment: Array<number | null | undefined>
  ): DeviceMoney;
}

/** Max number of `/devices/totals` calls one money valuation may spend (per domain). */
export const MONEY_MAX_SEGMENT_FETCHES = 31;

/** Per-category state of a constant-price segment. */
export type SegmentCategoryState = 'priced' | 'hourly' | 'none';

export interface PriceSegment {
  startTs: number;
  endTs: number;
  /** Price per category (decimal string) — only for `priced` categories. */
  prices: Partial<Record<WireCategory, string>>;
  states: Partial<Record<WireCategory, SegmentCategoryState>>;
  /** True when at least one category is `priced` here (consumption must be fetched). */
  needsFetch: boolean;
}

export interface PricePlan {
  startTs: number;
  endTs: number;
  segments: PriceSegment[];
  /** Segments with `needsFetch`. */
  fetchCount: number;
  /** `fetchCount > MONEY_MAX_SEGMENT_FETCHES` → callers must not fetch; devices are `partial`. */
  tooMany: boolean;
}

// ---------------------------------------------------------------------------
// Item-level money (the `item.money` contract read by widgets, RFC-0241 §5.1)
// ---------------------------------------------------------------------------

/** Display state of `item.money`. `missing` = no tariff/data at all for the period. */
export type ItemMoneyState = 'complete' | 'partial' | 'missing' | 'uncategorized';

export interface ItemMoney {
  state: ItemMoneyState;
  /** Unrounded decimal string; present **only** when `state === 'complete'`. */
  amount?: string;
  currency: 'BRL';
  /** Covered fraction of the period (0..1). */
  coverage: number;
  reason?: DeviceMoneyReason;
  /** "tarifa variável no período". */
  priceVaries?: boolean;
}

/** Map the valuator's {@link DeviceMoney} to the widget-facing `item.money`. */
export function toItemMoney(dm: DeviceMoney | null | undefined): ItemMoney {
  if (!dm) return { state: 'missing', currency: 'BRL', coverage: 0, reason: 'no-data' };
  if (dm.state === 'complete' && typeof dm.amount === 'string') {
    const out: ItemMoney = { state: 'complete', amount: dm.amount, currency: 'BRL', coverage: 1 };
    if (dm.priceVaries) out.priceVaries = true;
    return out;
  }
  if (dm.state === 'uncategorized' || dm.state === 'not-convertible') {
    return { state: 'uncategorized', currency: 'BRL', coverage: 0, reason: dm.reason || 'no-category' };
  }
  // A tariff that exists only as hourly bands is "Tarifa parcial", not "Sem tarifa".
  const hourlyOnly = dm.reason === 'needs-hourly' || dm.reason === 'intraday-tariff-long-period';
  if (dm.state === 'partial' || (dm.state === 'none' && hourlyOnly)) {
    const out: ItemMoney = {
      state: 'partial',
      currency: 'BRL',
      coverage: typeof dm.coveredRatio === 'number' ? dm.coveredRatio : 0,
    };
    if (dm.reason) out.reason = dm.reason;
    if (dm.priceVaries) out.priceVaries = true;
    return out;
  }
  return { state: 'missing', currency: 'BRL', coverage: 0, reason: dm.reason || 'no-tariff' };
}

/** Aggregate of several `item.money` (group totals, KPI, selection dock). */
export interface ItemMoneySum {
  /** `complete` only when **every** member is complete. */
  state: 'complete' | 'partial' | 'none';
  /** Unrounded `Σ raw`; present only when `state === 'complete'`. */
  amount?: string;
  covered: number;
  total: number;
}

/**
 * Honest sum (DEC-8: `round(Σ raw)` — round only at display). An empty list is
 * `none` (never `R$ 0`). Any non-complete member → no amount.
 */
export function sumItemMoney(list: Array<{ state?: string; amount?: string } | null | undefined>): ItemMoneySum {
  const items = Array.isArray(list) ? list : [];
  const total = items.length;
  if (total === 0) return { state: 'none', covered: 0, total: 0 };
  let acc = 0n;
  let covered = 0;
  for (const m of items) {
    if (!m || m.state !== 'complete' || typeof m.amount !== 'string') continue;
    const v = parseScaled(m.amount, AMOUNT_SCALE);
    if (v == null) continue;
    acc += v;
    covered += 1;
  }
  if (covered === total) return { state: 'complete', amount: formatScaled(acc, AMOUNT_SCALE), covered, total };
  return { state: covered > 0 ? 'partial' : 'none', covered, total };
}

/** Round a decimal string half-up (away from zero) to 2 places — string/BigInt only. */
export function roundMoney2(amount: string | null | undefined): string | null {
  if (typeof amount !== 'string') return null;
  const m = DECIMAL_RE.exec(amount.trim());
  if (!m) return null;
  const frac = m[3] || '';
  let cents = BigInt(m[2]) * 100n + BigInt(frac.slice(0, 2).padEnd(2, '0'));
  if (frac.charAt(2) >= '5') cents += 1n;
  const neg = m[1] === '-' && cents !== 0n;
  return `${neg ? '-' : ''}${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** Short pt-BR chip for a non-complete `item.money` ("Sem tarifa" / "Tarifa parcial" / "Sem categoria"). */
export function moneyStateChipLabel(state: ItemMoneyState | string | null | undefined): string {
  if (state === 'uncategorized') return 'Sem categoria';
  if (state === 'missing') return 'Sem tarifa';
  if (state === 'partial') return 'Tarifa parcial';
  return '';
}

/** pt-BR explanation of a coverage reason (tooltips). */
export function moneyReasonText(reason: DeviceMoneyReason | string | null | undefined): string {
  switch (reason) {
    case 'no-category':
      return 'Dispositivo sem categoria tarifária (Lojas / Área Comum).';
    case 'no-tariff':
      return 'Não há tarifa cadastrada para todo o período.';
    case 'no-data':
      return 'Sem dados de consumo em parte do período.';
    case 'needs-hourly':
    case 'intraday-tariff-long-period':
      return 'Tarifa horária ainda não suportada nesta visão.';
    case 'too-many-segments':
      return 'Tarifa muda muitas vezes no período; reduza o intervalo.';
    case 'invalid-qty':
      return 'Consumo inválido em parte do período.';
    default:
      return '';
  }
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
  const rawLocalParts = makeLocalPartsFn(options?.timezone || TARIFF_DEFAULT_TIMEZONE);
  // Memo: the same hour timestamps repeat across devices/rows (reports value
  // N devices × M buckets) — Intl.formatToParts is the hot path.
  const partsCache = new Map<number, LocalParts>();
  const localParts = (ts: number): LocalParts => {
    let p = partsCache.get(ts);
    if (!p) {
      if (partsCache.size > 50_000) partsCache.clear();
      p = rawLocalParts(ts);
      partsCache.set(ts, p);
    }
    return p;
  };

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
    return sumItemMoney(list);
  }

  /** Normalised price key ("1.0" ≡ "1.000000"); `null` when not a price. */
  function normPrice(p: string | null): string | null {
    if (p == null) return null;
    const v = parseScaled(p, PRICE_SCALE);
    return v == null ? null : formatScaled(v, PRICE_SCALE);
  }

  function planSegments(categories: WireCategory[], startTs: number, endTs: number): PricePlan {
    const cats = Array.from(new Set((categories || []).filter(Boolean))) as WireCategory[];
    const empty: PricePlan = { startTs, endTs, segments: [], fetchCount: 0, tooMany: false };
    if (!cats.length || !Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return empty;

    // Pass 1 — price of every hour per category + local day key.
    const hours: number[] = [];
    const dayKeys: string[] = [];
    const prices: Record<string, Array<string | null>> = {};
    cats.forEach((c) => (prices[c] = []));
    for (let t = startTs; t < endTs; t += HOUR_MS) {
      const p = localParts(t);
      hours.push(t);
      dayKeys.push(`${p.year}-${p.month}-${p.day}`);
      for (const c of cats) prices[c].push(normPrice(priceAt(c, t)));
    }

    // Days whose price varies inside the day (hourly bands / gaps inside a day).
    const intraday: Record<string, Set<string>> = {};
    for (const c of cats) {
      const first = new Map<string, string | null>();
      const set = new Set<string>();
      hours.forEach((_, i) => {
        const dk = dayKeys[i];
        if (!first.has(dk)) first.set(dk, prices[c][i]);
        else if (first.get(dk) !== prices[c][i]) set.add(dk);
      });
      intraday[c] = set;
    }

    // Pass 2 — merge consecutive hours with the same per-category state/price.
    const segments: PriceSegment[] = [];
    let curKey = '';
    hours.forEach((t, i) => {
      const parts = cats.map((c) => (intraday[c].has(dayKeys[i]) ? 'H' : (prices[c][i] ?? '-')));
      const key = parts.join('|');
      if (segments.length && key === curKey) return;
      if (segments.length) segments[segments.length - 1].endTs = t;
      curKey = key;
      const seg: PriceSegment = { startTs: t, endTs, prices: {}, states: {}, needsFetch: false };
      cats.forEach((c, ci) => {
        const k = parts[ci];
        if (k === 'H') seg.states[c] = 'hourly';
        else if (k === '-') seg.states[c] = 'none';
        else {
          seg.states[c] = 'priced';
          seg.prices[c] = k;
          seg.needsFetch = true;
        }
      });
      segments.push(seg);
    });

    const fetchCount = segments.filter((s) => s.needsFetch).length;
    return { startTs, endTs, segments, fetchCount, tooMany: fetchCount > MONEY_MAX_SEGMENT_FETCHES };
  }

  function valuatePlan(
    category: WireCategory | null,
    plan: PricePlan,
    qtyBySegment: Array<number | null | undefined>
  ): DeviceMoney {
    if (!category) return { state: 'uncategorized', reason: 'no-category' };
    if (!hasAnyTariff(category)) return { state: 'none', reason: 'no-tariff', coveredRatio: 0 };
    const segs = plan?.segments || [];
    if (!segs.length) return { state: 'none', reason: 'no-data', coveredRatio: 0 };
    if (plan.tooMany) return { state: 'partial', reason: 'too-many-segments', coveredRatio: 0 };

    const span = Math.max(1, plan.endTs - plan.startTs);
    let acc = 0n;
    let coveredMs = 0;
    let coveredSegs = 0;
    let firstReason: DeviceMoneyReason | undefined;
    const distinct = new Set<string>();

    segs.forEach((seg, i) => {
      const st = seg.states[category];
      if (st === 'hourly') {
        firstReason = firstReason || 'needs-hourly';
        return;
      }
      if (st !== 'priced' || !seg.prices[category]) {
        firstReason = firstReason || 'no-tariff';
        return;
      }
      const raw = qtyBySegment?.[i];
      const qty = raw == null ? null : qtyToScaled(raw);
      if (qty == null) {
        firstReason = firstReason || (raw == null ? 'no-data' : 'invalid-qty');
        return;
      }
      const price = parseScaled(seg.prices[category] as string, PRICE_SCALE) as bigint;
      distinct.add(seg.prices[category] as string);
      acc += qty * price;
      coveredMs += seg.endTs - seg.startTs;
      coveredSegs += 1;
    });

    const priceVaries = distinct.size > 1;
    if (coveredSegs === segs.length) {
      return { state: 'complete', amount: formatScaled(acc, AMOUNT_SCALE), coveredRatio: 1, priceVaries };
    }
    if (coveredSegs === 0) {
      // Tariff exists but only as hourly bands → "Tarifa parcial" (not "Sem tarifa").
      if (firstReason === 'needs-hourly') return { state: 'partial', reason: firstReason, coveredRatio: 0 };
      return { state: 'none', reason: firstReason || 'no-tariff', coveredRatio: 0 };
    }
    return { state: 'partial', reason: firstReason, coveredRatio: coveredMs / span, priceVaries };
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

  return { priceAt, valuate, sum, chooseGranularity, planSegments, valuatePlan };
}
