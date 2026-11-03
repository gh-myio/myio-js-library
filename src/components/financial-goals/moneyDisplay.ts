/**
 * RFC-0241 Part B (rev. 2) — dashboard-wide "R$ instead of kWh/m³" display mode.
 *
 * Library side of the v-5.2.0 money mode. MAIN_VIEW owns the state and the I/O
 * (GCDR tariffs, Ingestion `/devices/totals`); this module keeps everything that
 * can be pure so it is unit-tested once:
 *  - per-viewer persistence of the mode (localStorage, try/catch);
 *  - the opt-in customer rule `moneyCategoryRule` (dashboard group → tariff
 *    category, owner decision Q3);
 *  - {@link valuateDomainMoney}: "constant-price segments" valuation — split the
 *    period where the effective price changes, one `/devices/totals` call per
 *    segment (zero extra calls when the whole period has one price: the totals
 *    MAIN already loaded are reused), device value = Σ total × price;
 *  - the report money config (AllReportModal A6 column + per-bucket valuation);
 *  - tiny HTML helpers shared by the widgets (chip / coverage marker).
 *
 * Disciplines (RFC-0228 A1/A4/DEC-6/DEC-8): prices and amounts are decimal
 * strings, rounding only at display, a total is shown in R$ only when every
 * member is `complete`, never `R$ 0`, never `NaN`. Allowed wording: "Custo
 * estimado", "Estimado R$", "Cobertura incompleta".
 */

import type { TariffTreeResponse, WireCategory, WireDomain } from '../pricing-panel/tariffApiClient';
import { formatBRL as formatMoneyBRL } from './moneyFormat';
import type { AllReportMoneyConfig } from '../premium-modals/types';
import {
  createTariffValuator,
  moneyReasonText,
  moneyStateChipLabel,
  roundMoney2,
  sumItemMoney,
  toItemMoney,
  TARIFF_DEFAULT_TIMEZONE,
  type ItemMoney,
  type ItemMoneySum,
  type PricePlan,
  type TariffValuator,
} from './tariffValuation';

export type ValueDisplayMode = 'physical' | 'money';
export type MoneyDomain = 'energy' | 'water';

/** Column header / card label for the estimated cost (allowed wording). */
export const MONEY_ESTIMATE_LABEL = 'Custo estimado';
export const MONEY_REPORT_HEADER = 'Custo estimado (R$)';
export const MONEY_INCOMPLETE_LABEL = 'Cobertura incompleta';

// ---------------------------------------------------------------------------
// Persistence (per user × shopping × browser)
// ---------------------------------------------------------------------------

export const VALUE_DISPLAY_MODE_STORAGE_PREFIX = 'myio:value-display-mode:v1';

export function valueDisplayModeStorageKey(tbUserId: string | null | undefined, customerTbId: string | null | undefined): string {
  return `${VALUE_DISPLAY_MODE_STORAGE_PREFIX}:${tbUserId || 'anon'}:${customerTbId || 'default'}`;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Stored mode, or `'physical'` (missing / invalid / storage blocked). */
export function readValueDisplayMode(storage: StorageLike | null | undefined, key: string): ValueDisplayMode {
  try {
    return storage?.getItem(key) === 'money' ? 'money' : 'physical';
  } catch {
    return 'physical';
  }
}

/** Persist the mode; `false` when storage is unavailable (private mode). */
export function writeValueDisplayMode(storage: StorageLike | null | undefined, key: string, mode: ValueDisplayMode): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, mode === 'money' ? 'money' : 'physical');
    return true;
  } catch {
    return false;
  }
}

/** A requested/stored `'money'` only holds for an eligible user with tariffs available (AC-17). */
export function resolveEffectiveDisplayMode(args: {
  requested: ValueDisplayMode | string | null | undefined;
  eligible: boolean;
  available: boolean;
}): ValueDisplayMode {
  return args.requested === 'money' && args.eligible === true && args.available === true ? 'money' : 'physical';
}

// ---------------------------------------------------------------------------
// Category rule (customer SERVER_SCOPE `moneyCategoryRule`, owner decision Q3)
// ---------------------------------------------------------------------------

export interface MoneyCategoryRule {
  source: 'classification';
  SPECIFIC: string[];
  COMMON_AREA: string[];
}

/** Dashboard groups whose devices can be valued. Entrada & co. stay physical in v1 (Q8). */
export const MONEY_CONVERTIBLE_GROUPS: Readonly<Record<MoneyDomain, readonly string[]>> = {
  energy: ['lojas', 'areacomum'],
  water: ['lojas', 'areacomum', 'banheiros'],
};

const normGroup = (g: unknown): string =>
  String(g ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

export function isMoneyConvertibleGroup(domain: string, group: string | null | undefined): boolean {
  const list = MONEY_CONVERTIBLE_GROUPS[domain as MoneyDomain];
  return !!list && list.includes(normGroup(group));
}

/** Parse the attribute (JSON string or object). Invalid → `null` (devices stay uncategorized). */
export function parseMoneyCategoryRule(raw: unknown): MoneyCategoryRule | null {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.source != null && o.source !== 'classification') return null;
  const list = (x: unknown): string[] =>
    Array.isArray(x) ? x.map((s) => (String(s).trim() === '*' ? '*' : normGroup(s))).filter(Boolean) : [];
  const SPECIFIC = list(o.SPECIFIC);
  const COMMON_AREA = list(o.COMMON_AREA);
  if (!SPECIFIC.length && !COMMON_AREA.length) return null;
  return { source: 'classification', SPECIFIC, COMMON_AREA };
}

/**
 * Tariff category of a dashboard group under the rule. An explicit group name wins
 * over the `"*"` wildcard; no rule / no match → `null` (uncategorized).
 */
export function resolveMoneyCategory(rule: MoneyCategoryRule | null | undefined, group: string | null | undefined): WireCategory | null {
  if (!rule) return null;
  const g = normGroup(group);
  if (!g) return null;
  if (rule.SPECIFIC.includes(g)) return 'SPECIFIC';
  if (rule.COMMON_AREA.includes(g)) return 'COMMON_AREA';
  if (rule.SPECIFIC.includes('*')) return 'SPECIFIC';
  if (rule.COMMON_AREA.includes('*')) return 'COMMON_AREA';
  return null;
}

// ---------------------------------------------------------------------------
// Domain valuation ("constant-price segments")
// ---------------------------------------------------------------------------

export interface MoneyDevice {
  /** Device key = ingestionId (the `/devices/totals` row id). */
  key: string;
  /** Dashboard group (`lojas`, `areacomum`, `entrada`, …). */
  group: string;
}

export type QtyMap = Map<string, number> | Record<string, number>;

export interface ValuateDomainOptions {
  domain: MoneyDomain;
  startTs: number;
  endTs: number;
  devices: MoneyDevice[];
  rule: MoneyCategoryRule | null;
  /** Loads one tariff year (GCDR). Rejection / `null` → no tariff for that year. */
  loadTree: (sel: { domain: WireDomain; category: WireCategory; year: number }) => Promise<TariffTreeResponse | null>;
  /** Whole-period totals already loaded by MAIN (reused when the period has a single price). */
  periodTotals: QtyMap;
  /** `/devices/totals` for one segment (same filters MAIN uses). Absent → multi-segment devices are `partial`. */
  fetchSegmentTotals?: (startTs: number, endTs: number) => Promise<QtyMap>;
  timezone?: string;
}

export interface DomainMoneyResult {
  domain: MoneyDomain;
  startTs: number;
  endTs: number;
  /** `item.money` per device key — only devices of convertible groups. */
  byKey: Map<string, ItemMoney>;
  categoryByKey: Map<string, WireCategory | null>;
  coverage: ItemMoneySum;
  valuator: TariffValuator;
  plan: PricePlan;
  /** `/devices/totals` calls spent (0 when the whole period has one price). */
  segmentFetches: number;
}

function qtyOf(map: QtyMap | null | undefined, key: string): number | undefined {
  if (!map) return undefined;
  const v = map instanceof Map ? map.get(key) : (map as Record<string, number>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function yearsSpanned(startTs: number, endTs: number, timezone: string): number[] {
  const yearOf = (ts: number): number => {
    try {
      return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(new Date(ts)));
    } catch {
      return new Date(ts - 3 * 3_600_000).getUTCFullYear();
    }
  };
  const a = yearOf(startTs);
  const b = yearOf(Math.max(startTs, endTs - 1));
  const out: number[] = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}

const WIRE_DOMAIN: Record<MoneyDomain, WireDomain> = { energy: 'ENERGY', water: 'WATER' };

export async function valuateDomainMoney(opts: ValuateDomainOptions): Promise<DomainMoneyResult> {
  const timezone = opts.timezone || TARIFF_DEFAULT_TIMEZONE;
  const devices = (opts.devices || []).filter((d) => d && d.key && isMoneyConvertibleGroup(opts.domain, d.group));

  const categoryByKey = new Map<string, WireCategory | null>();
  for (const d of devices) categoryByKey.set(d.key, resolveMoneyCategory(opts.rule, d.group));
  const categories = Array.from(new Set(Array.from(categoryByKey.values()).filter(Boolean))) as WireCategory[];

  // 1) Tariff trees: (category × year) of the period. Empty tree (version 0) = no tariff.
  const trees: Partial<Record<WireCategory, TariffTreeResponse[]>> = {};
  const years = yearsSpanned(opts.startTs, opts.endTs, timezone);
  await Promise.all(
    categories.flatMap((category) =>
      years.map(async (year) => {
        let res: TariffTreeResponse | null = null;
        try {
          res = await opts.loadTree({ domain: WIRE_DOMAIN[opts.domain], category, year });
        } catch {
          res = null;
        }
        if (res && res.tree && Object.keys(res.tree).length > 0) {
          (trees[category] = trees[category] || []).push({ ...res, year });
        }
      })
    )
  );

  const valuator = createTariffValuator({ trees, timezone });
  const plan = valuator.planSegments(categories, opts.startTs, opts.endTs);

  // 2) Consumption per segment. Single priced segment → reuse MAIN's period totals.
  const qtyBySeg: Array<QtyMap | null> = plan.segments.map(() => null);
  let segmentFetches = 0;
  if (plan.segments.length === 1 && plan.segments[0].needsFetch) {
    qtyBySeg[0] = opts.periodTotals;
  } else if (!plan.tooMany && typeof opts.fetchSegmentTotals === 'function') {
    for (let i = 0; i < plan.segments.length; i++) {
      const seg = plan.segments[i];
      if (!seg.needsFetch) continue;
      segmentFetches += 1;
      try {
        qtyBySeg[i] = await opts.fetchSegmentTotals(seg.startTs, seg.endTs);
      } catch {
        qtyBySeg[i] = null; // devices → partial ('no-data'), never R$ 0
      }
    }
  }

  // 3) Value each device.
  const byKey = new Map<string, ItemMoney>();
  for (const d of devices) {
    const qtys = plan.segments.map((_, i) => qtyOf(qtyBySeg[i], d.key));
    byKey.set(d.key, toItemMoney(valuator.valuatePlan(categoryByKey.get(d.key) ?? null, plan, qtys)));
  }

  return {
    domain: opts.domain,
    startTs: opts.startTs,
    endTs: opts.endTs,
    byKey,
    categoryByKey,
    coverage: sumItemMoney(Array.from(byKey.values())),
    valuator,
    plan,
    segmentFetches,
  };
}

// ---------------------------------------------------------------------------
// Reports (AllReportModal A6 column, rev. 2)
// ---------------------------------------------------------------------------

/**
 * Build `params.money` for AllReportModal from a domain valuation. Rows that are
 * not `complete` get no amount (cell "—" on screen, empty in exports). The total
 * is `round(Σ raw)` and only when every listed device is complete.
 */
export function buildReportMoneyConfig(
  result: DomainMoneyResult,
  opts: { period?: { startISO?: string | null; endISO?: string | null }; deviceKeys?: string[] } = {}
): AllReportMoneyConfig {
  const keys = opts.deviceKeys && opts.deviceKeys.length ? opts.deviceKeys : Array.from(result.byKey.keys());
  const perDevice: Record<string, string | null> = {};
  const listed: ItemMoney[] = [];
  for (const k of keys) {
    const m = result.byKey.get(k);
    if (!m) continue;
    listed.push(m);
    perDevice[k] = m.state === 'complete' ? roundMoney2(m.amount) : null;
  }
  const sum = sumItemMoney(listed);
  const complete = sum.state === 'complete';
  return {
    overlay: {
      state: 'available',
      currency: 'BRL',
      coverageComplete: complete,
      uncategorizedDevices: [],
    },
    perDevice,
    total: complete ? roundMoney2(sum.amount) : null,
    // The report may list a subset (one group): its total is round(Σ raw) of THOSE rows.
    totalFor: (ids: string[]) => {
      const s = sumItemMoney((ids || []).map((k) => result.byKey.get(k) || { state: 'missing' }));
      return s.state === 'complete' ? roundMoney2(s.amount) : null;
    },
    headerLabel: MONEY_REPORT_HEADER,
    period: opts.period
      ? { startISO: opts.period.startISO ?? null, endISO: opts.period.endISO ?? null }
      : { startISO: new Date(result.startTs).toISOString(), endISO: new Date(result.endTs).toISOString() },
    valuateBucket: (deviceKey: string, startTs: number, endTs: number, qty: number) => {
      const cat = result.categoryByKey.get(deviceKey);
      if (cat === undefined) return null; // not a convertible device
      return toItemMoney(result.valuator.valuate({ deviceKey, category: cat, buckets: [{ startTs, endTs, qty }] }));
    },
  };
}

// ---------------------------------------------------------------------------
// Widget helpers (strings only; no DOM)
// ---------------------------------------------------------------------------

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** `"R$ 1.234,57"` for a complete money, else `null` (caller keeps the physical value). */
export function formatItemMoney(money: { state?: string; amount?: string } | null | undefined): string | null {
  if (!money || money.state !== 'complete' || typeof money.amount !== 'string') return null;
  const s = formatMoneyBRL(money.amount);
  return s === '—' ? null : s;
}

/** Tooltip text explaining a non-complete `item.money`. */
export function moneyCoverageTitle(money: ItemMoney | { state?: string; reason?: string } | null | undefined): string {
  if (!money) return '';
  const label = moneyStateChipLabel((money as ItemMoney).state);
  const why = moneyReasonText((money as ItemMoney).reason);
  return [label, why].filter(Boolean).join(' — ');
}

/** Small chip for a device whose value stays physical ("Sem tarifa" / "Tarifa parcial" / "Sem categoria"). */
export function buildMoneyChipHTML(money: ItemMoney | { state?: string; reason?: string } | null | undefined): string {
  const label = money ? moneyStateChipLabel((money as ItemMoney).state) : '';
  if (!label) return '';
  return (
    `<span class="myio-money-chip" data-money-state="${esc((money as ItemMoney).state)}" title="${esc(moneyCoverageTitle(money))}" ` +
    `style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font:600 10px Nunito,sans-serif;` +
    `background:#fef3c7;color:#92400e;vertical-align:middle;white-space:nowrap;">${esc(label)}</span>`
  );
}

/** "Cobertura incompleta (n de m)" marker for a total that stays physical. */
export function buildMoneyCoverageMarkerHTML(sum: { covered: number; total: number } | null | undefined): string {
  if (!sum || !sum.total) return '';
  return (
    `<span class="myio-money-coverage" data-money-coverage="incomplete" ` +
    `title="Total exibido em unidade física: nem todos os dispositivos têm custo estimado completo." ` +
    `style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font:600 10px Nunito,sans-serif;` +
    `background:#fef3c7;color:#92400e;white-space:nowrap;">${MONEY_INCOMPLETE_LABEL} (${sum.covered} de ${sum.total})</span>`
  );
}

export { sumItemMoney, roundMoney2, toItemMoney };
