/**
 * RFC-0222 — Pure pricing helpers (no DOM). Kept separate so the idempotency,
 * category-scoped overlap, KPI and formatting rules are unit-testable without a
 * modal.
 */

import type {
  PricingAuditAction,
  PricingAuditRecord,
  PricingCategory,
  PricingCustomerRef,
  PricingDomain,
  PricingEntry,
  PricingKpis,
} from './types';

export const DOMAIN_LABEL: Record<PricingDomain, string> = {
  energy: 'Energia',
  water: 'Água',
};

export const CATEGORY_LABEL: Record<PricingCategory, string> = {
  lojas: 'Lojas',
  area_comum: 'Área Comum',
};

/** Price unit label for a domain (energy → R$/kWh, water → R$/m³). */
export function unitLabel(domain: PricingDomain): string {
  return domain === 'water' ? 'R$/m³' : 'R$/kWh';
}

/** Stable customer id: gcdrCustomerId ?? tbId ?? title. */
export function resolveCustomerId(c: PricingCustomerRef): string {
  return String(c.gcdrCustomerId ?? c.tbId ?? c.title ?? '').trim();
}

/** Whether an email grants access to the pricing panel. */
export function isPricingAllowed(email?: string, superAdmin?: boolean): boolean {
  if (superAdmin === true) return true;
  const e = (email ?? '').trim().toLowerCase();
  return e.endsWith('@myio.com.br');
}

/**
 * Format a BRL price in pt-BR (e.g. 0.75 → "R$ 0,75"), up to 4 decimals.
 * The amount is formatted with the decimal formatter and prefixed with a plain
 * "R$ " so the separator is a deterministic ASCII space (the currency formatter
 * emits an ICU non-breaking space that varies by runtime).
 */
export function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return '';
  const amount = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return `R$ ${amount}`;
}

/**
 * Parse a pt-BR price string ("R$ 1.234,56", "0,75", "0.75") into a number.
 * Returns NaN for empty/invalid input.
 */
export function parseBRL(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[R$\s ]/g, '');
  if (!s) return NaN;
  const hasComma = s.includes(',');
  if (hasComma) {
    // pt-BR: dots are thousands separators, comma is the decimal mark.
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Zero-pad to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Last day (1-31) of a `YYYY-MM` month. */
export function daysInMonth(periodKey: string): number {
  const [y, m] = periodKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Inclusive [start, end] date bounds (YYYY-MM-DD) of an entry, regardless of
 * whether it is a closed month or an explicit range. Returns null if malformed.
 */
export function entryBounds(entry: PricingEntry): { start: string; end: string } | null {
  if (entry.periodType === 'month') {
    if (!entry.periodKey || !/^\d{4}-\d{2}$/.test(entry.periodKey)) return null;
    const last = daysInMonth(entry.periodKey);
    return { start: `${entry.periodKey}-01`, end: `${entry.periodKey}-${pad2(last)}` };
  }
  if (entry.periodType === 'range') {
    if (!entry.start || !entry.end) return null;
    if (entry.start > entry.end) return null;
    return { start: entry.start, end: entry.end };
  }
  return null;
}

/** Whether two entries share the same (customer, domain, category) scope. */
export function sameScope(a: PricingEntry, b: PricingEntry): boolean {
  return a.customerId === b.customerId && a.domain === b.domain && a.category === b.category;
}

/**
 * Identity key of a period within its scope, used for the idempotent upsert:
 * (customer, domain, category, period).
 */
export function periodIdentity(entry: PricingEntry): string {
  const period =
    entry.periodType === 'month'
      ? `month|${entry.periodKey}`
      : `range|${entry.start}|${entry.end}`;
  return `${entry.customerId}|${entry.domain}|${entry.category}|${period}`;
}

/** Two inclusive date intervals overlap iff aStart <= bEnd && bStart <= aEnd. */
export function intervalsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string }
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Human-readable period label ("Mês 2026-03" / "01/03/2026 – 31/03/2026"). */
export function formatPeriodLabel(entry: PricingEntry): string {
  if (entry.periodType === 'month') return `Mês ${entry.periodKey}`;
  const fmt = (iso?: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(entry.start)} – ${fmt(entry.end)}`;
}

/** Build one audit record for an entry action. */
export function auditFor(
  action: PricingAuditAction,
  entry: PricingEntry,
  by: string,
  now: string,
  priceBefore?: number,
  priceAfter?: number
): PricingAuditRecord {
  return {
    action,
    at: now,
    by,
    customerId: entry.customerId,
    domain: entry.domain,
    category: entry.category,
    periodLabel: formatPeriodLabel(entry),
    before: priceBefore === undefined ? null : { pricePerKwh: priceBefore },
    after: priceAfter === undefined ? null : { pricePerKwh: priceAfter },
  };
}

export interface UpsertResult {
  entries: PricingEntry[];
  /** `noop` = same period re-added with the same price (fully idempotent). */
  status: 'inserted' | 'updated' | 'overlap' | 'noop';
  /** The overlapping existing entry when status === 'overlap'. */
  conflict?: PricingEntry;
  /** Audit record produced (inserted/updated only). */
  audit?: PricingAuditRecord;
}

export interface MutationOptions {
  /** Author email recorded in the audit trail. */
  by?: string;
  /** ISO timestamp (defaults to now); injectable for deterministic tests. */
  now?: string;
}

/**
 * Idempotent upsert scoped to (customer, domain, category):
 *  - same period identity, same price → `noop` (no change);
 *  - same period identity, new price  → `updated` (price-changed, version bump);
 *  - different period that overlaps in time within the scope → `overlap`;
 *  - otherwise → `inserted`.
 * The input list is not mutated.
 */
export function upsertEntry(
  entries: PricingEntry[],
  candidate: PricingEntry,
  opts: MutationOptions = {}
): UpsertResult {
  const by = opts.by ?? '';
  const now = opts.now ?? new Date().toISOString();
  const next: PricingEntry[] = entries.map((e) => ({ ...e, history: e.history ? [...e.history] : [] }));

  const candBounds = entryBounds(candidate);
  if (!candBounds) return { entries: next, status: 'overlap' };
  const candId = periodIdentity(candidate);

  // Exact same period within the scope → idempotent upsert.
  const sameIdx = next.findIndex((e) => sameScope(e, candidate) && periodIdentity(e) === candId);
  if (sameIdx >= 0) {
    const prev = next[sameIdx];
    if (prev.pricePerKwh === candidate.pricePerKwh) {
      return { entries: next, status: 'noop' };
    }
    const audit = auditFor(
      'price-changed',
      prev,
      by,
      now,
      prev.pricePerKwh,
      candidate.pricePerKwh
    );
    next[sameIdx] = {
      ...prev,
      pricePerKwh: candidate.pricePerKwh,
      currency: 'BRL',
      version: (prev.version ?? 0) + 1,
      updatedAt: now,
      updatedBy: by,
      history: [...(prev.history ?? []), audit],
    };
    return { entries: next, status: 'updated', audit };
  }

  // Different period overlapping another in the same scope → reject.
  for (const e of next) {
    if (!sameScope(e, candidate)) continue;
    const b = entryBounds(e);
    if (b && intervalsOverlap(candBounds, b)) {
      return { entries: next, status: 'overlap', conflict: e };
    }
  }

  const created: PricingEntry = {
    ...candidate,
    currency: 'BRL',
    version: 1,
    createdAt: now,
    createdBy: by,
    updatedAt: now,
    updatedBy: by,
    history: [],
  };
  const audit = auditFor('created', created, by, now, undefined, candidate.pricePerKwh);
  created.history = [audit];
  next.push(created);
  return { entries: next, status: 'inserted', audit };
}

export interface RemoveResult {
  entries: PricingEntry[];
  audit?: PricingAuditRecord;
}

/**
 * Remove the entry matching (customer, domain, category, bounds) and produce a
 * `deleted` audit record. Bounds are matched via `${start}__${end}`.
 */
export function removeEntryByBounds(
  entries: PricingEntry[],
  target: {
    customerId: string;
    domain: PricingDomain;
    category: PricingCategory;
    boundsKey: string;
  },
  opts: MutationOptions = {}
): RemoveResult {
  const by = opts.by ?? '';
  const now = opts.now ?? new Date().toISOString();
  let removed: PricingEntry | undefined;
  const kept = entries.filter((e) => {
    if (removed) return true;
    if (
      e.customerId !== target.customerId ||
      e.domain !== target.domain ||
      e.category !== target.category
    ) {
      return true;
    }
    const b = entryBounds(e);
    if (b && `${b.start}__${b.end}` === target.boundsKey) {
      removed = e;
      return false;
    }
    return true;
  });
  if (!removed) return { entries: entries.slice() };
  const audit = auditFor('deleted', removed, by, now, removed.pricePerKwh, undefined);
  return { entries: kept, audit };
}

/** Compute Dashboard KPIs over a set of entries. */
export function computePricingKpis(
  entries: PricingEntry[],
  opts: { customerCount?: number } = {}
): PricingKpis {
  const periodsByDomain: Record<PricingDomain, number> = { energy: 0, water: 0 };
  const periodsByCategory: Record<PricingCategory, number> = { lojas: 0, area_comum: 0 };
  let energySum = 0;
  let energyN = 0;
  let waterSum = 0;
  let waterN = 0;
  let lastUpdatedAt: string | null = null;
  const combos = new Set<string>();

  for (const e of entries) {
    periodsByDomain[e.domain] = (periodsByDomain[e.domain] ?? 0) + 1;
    periodsByCategory[e.category] = (periodsByCategory[e.category] ?? 0) + 1;
    if (e.domain === 'energy') {
      energySum += e.pricePerKwh;
      energyN++;
    } else {
      waterSum += e.pricePerKwh;
      waterN++;
    }
    if (e.updatedAt && (!lastUpdatedAt || e.updatedAt > lastUpdatedAt)) lastUpdatedAt = e.updatedAt;
    combos.add(`${e.customerId}|${e.domain}|${e.category}`);
  }

  const covered = combos.size;
  const total = opts.customerCount ? opts.customerCount * 4 : covered;
  return {
    totalPeriods: entries.length,
    periodsByDomain,
    periodsByCategory,
    avgEnergyPrice: energyN ? energySum / energyN : null,
    avgWaterPrice: waterN ? waterSum / waterN : null,
    lastUpdatedAt,
    coverage: { covered, total, pct: total ? Math.round((covered / total) * 100) : 0 },
  };
}
