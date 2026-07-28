/**
 * RFC-0222 — Customer Energy/Water Pricing Panel (prototype).
 *
 * Public type surface for `openPricingPanel`. See
 * `docs/rfcs/RFC-0222-Customer-Energy-Pricing-Panel.md` for the data model,
 * category/overlap/idempotency rules, the audit trail and the (future) GCDR
 * persistence contract. This is a prototype: persistence is in-memory +
 * localStorage only.
 */

/** A customer (shopping) the panel can attach prices to. */
export interface PricingCustomerRef {
  /** ThingsBoard customer id (optional). */
  tbId?: string;
  /** GCDR customer id (preferred stable id when present). */
  gcdrCustomerId?: string;
  /** Human-readable label shown in the selector. */
  title: string;
}

/** Priced domain. Energy price is R$/kWh; water price is R$/m³. */
export type PricingDomain = 'energy' | 'water';

/**
 * Usage category the price applies to:
 *  - `lojas`      — tenant stores.
 *  - `area_comum` — common-area equipment.
 */
export type PricingCategory = 'lojas' | 'area_comum';

/** How a pricing period is expressed. */
export type PricingPeriodType = 'month' | 'range';

/** Audit trail action. */
export type PricingAuditAction = 'created' | 'edited' | 'deleted' | 'price-changed';

/** One immutable audit trail record. */
export interface PricingAuditRecord {
  action: PricingAuditAction;
  /** ISO timestamp of the action. */
  at: string;
  /** Author (currentUserEmail in the prototype). */
  by: string;
  customerId: string;
  domain: PricingDomain;
  category: PricingCategory;
  /** Human-readable period label at the time of the action. */
  periodLabel: string;
  /** Price before the action (null for creation). */
  before?: { pricePerKwh?: number } | null;
  /** Price after the action (null/undefined for deletion). */
  after?: { pricePerKwh?: number } | null;
}

/**
 * A single price association: one customer × domain × category × period × price.
 *
 * The tuple (customerId, domain, category, periodType, periodKey | start+end) is
 * the upsert key: re-adding the same period only updates `pricePerKwh`
 * (idempotent). Overlap is forbidden only within the same
 * (customerId, domain, category) scope.
 */
export interface PricingEntry {
  /** Stable customer id (gcdrCustomerId ?? tbId ?? title). */
  customerId: string;
  domain: PricingDomain;
  category: PricingCategory;
  periodType: PricingPeriodType;
  /** Closed month, `YYYY-MM` (present when periodType === 'month'). */
  periodKey?: string;
  /** Range start `YYYY-MM-DD` inclusive (present when periodType === 'range'). */
  start?: string;
  /** Range end `YYYY-MM-DD` inclusive (present when periodType === 'range'). */
  end?: string;
  /**
   * Canonical price per unit as a **decimal string** (`"0.892000"`) — the
   * authoritative value when the panel is backed by the GCDR tariff API
   * (RFC-0228 A1). Preserved verbatim (no `Number()` drift). When absent (the
   * localStorage prototype path), `pricePerKwh` is authoritative.
   */
  price?: string;
  /**
   * Price per unit — kWh for energy, m³ for water — in BRL (positive number).
   *
   * In the tariff-API path this is a **derived numeric view for rendering only**
   * (`Number(price)`); never round-trip it back to the wire. In the localStorage
   * prototype path it remains the source of truth.
   */
  pricePerKwh: number;
  /** Always `'BRL'` in this prototype. */
  currency: 'BRL';
  /** Optimistic-concurrency counter; bumped on each real change. */
  version?: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  /** Per-entry audit trail (created/price-changed/edited). */
  history?: PricingAuditRecord[];
}

/** KPIs computed over a set of entries (Dashboard tab). */
export interface PricingKpis {
  totalPeriods: number;
  periodsByDomain: Record<PricingDomain, number>;
  periodsByCategory: Record<PricingCategory, number>;
  /** Mean R$/kWh across energy entries (null when none). */
  avgEnergyPrice: number | null;
  /** Mean R$/m³ across water entries (null when none). */
  avgWaterPrice: number | null;
  /** Most recent updatedAt across entries (null when none). */
  lastUpdatedAt: string | null;
  /**
   * Coverage of (customer × domain × category) combinations that hold at least
   * one price. `total` = customerCount × 4 when a customer count is provided,
   * else equals `covered`.
   */
  coverage: { covered: number; total: number; pct: number };
}

/**
 * Host dashboard palette: either a `createMyIOTheme` object (exposes `cssVars()`)
 * or a flat map of `--myio-*` CSS custom properties. Applied to the panel root.
 */
export type PricingPanelThemeSource =
  | { cssVars(): Record<string, string> }
  | Record<string, string>;

export interface OpenPricingPanelParams {
  /** Customers the operator may price. First one is preselected. */
  customers: PricingCustomerRef[];
  /** Signed-in user email; gates the panel (`@myio.com.br` only) and is the audit author. */
  currentUserEmail?: string;
  /** Initial domain selection in the Add form. Default `'energy'`. */
  domain?: PricingDomain;
  /** Initial category selection in the Add form. Default `'lojas'`. */
  category?: PricingCategory;
  /** Host palette; falls back to `window.MyIOUtils.theme` when omitted. */
  theme?: PricingPanelThemeSource;
  /** Called with the full entry list after every mutation (add/edit/remove). */
  onSave?: (entries: PricingEntry[]) => void;
  /** Where to mount the panel. Defaults to the top-level document. */
  targetDocument?: Document;
  /** localStorage namespace (tenant). Default `'myio'`. */
  storageKeyPrefix?: string;
  /** Seed entries (merged over anything found in localStorage). */
  initialEntries?: PricingEntry[];
  /**
   * RFC-0228 A1 — GCDR hourly tariff API config. **When present**, the panel
   * loads and saves through the tariff adapter (`GET/PUT/PATCH/DELETE
   * /customers/:id/tariffs`) and `localStorage` is NOT used as a source of truth.
   * **When absent**, the panel keeps its byte-identical localStorage prototype.
   */
  tariffApi?: TariffApiPanelConfig;
}

/** Config for the RFC-0228 A1 tariff-API persistence path. */
export interface TariffApiPanelConfig {
  /** API origin, e.g. `https://gcdr-api.a.myio-bas.com`. `/api/v1` is appended. */
  baseUrl: string;
  /** Customer API Key (`gcdr_cust_…`) → `X-API-Key`. */
  apiKey?: string;
  /** JWT → `Authorization: Bearer`. */
  jwt?: string;
  /** Optional tenant hint forwarded as `X-Tenant-Id`. */
  tenantId?: string;
  /** Tariff year to load (default: current year). Writes derive year from the period. */
  year?: number;
  /**
   * Test seam: injectable `fetch`. Not needed in production (defaults to
   * `globalThis.fetch`); lets unit tests drive the panel with a mocked backend.
   */
  fetchImpl?: typeof fetch;
}

/** Events emitted by the panel handle. */
export type PricingPanelEvent = 'save' | 'close' | 'add' | 'remove';

export interface PricingPanelHandle {
  /** Close and remove the panel from the DOM. */
  close(): void;
  /** Subscribe to a panel event. */
  on(event: PricingPanelEvent, cb: (payload?: unknown) => void): void;
  /** Current in-memory entries (defensive copy). */
  getEntries(): PricingEntry[];
  /** Aggregated audit log, most recent first (defensive copy). */
  getAuditLog(): PricingAuditRecord[];
}
