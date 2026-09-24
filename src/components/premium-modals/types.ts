// src/components/premium-modals/types.ts
import type { MoneyOverlay } from '../financial-goals/moneyTypes';

export type ISODate = `${number}-${number}-${number}`; // YYYY-MM-DD

/**
 * RFC-0228 A6 — optional R$ money overlay for AllReportModal (additive + gated).
 * When **absent**, the modal renders exactly as before (byte-identical). When
 * present, an R$ column is shown beside kWh/m³ and an honest footer total is
 * produced on the DEC-8 rounding contract (GCDR RFC-0054). Amounts are decimal
 * **strings**; the modal never re-derives or `Number()`-round-trips them.
 */
export interface AllReportMoneyConfig {
  /** Aggregate coverage overlay (F0) — gates whether a numeric total is shown. */
  overlay: MoneyOverlay;
  /** Per-device R$ (backend `monetaryValue`, DEC-8 2dp), keyed by device id (ingestionId). */
  perDevice: Record<string, string | null | undefined>;
  /** Backend-authoritative aggregate R$ (DEC-8 top-down parent). Preferred for the total. */
  total?: string | null;
  /** Optional R$ deviation vs the meta for the report total (A7 owns the per-consumer chip). */
  variance?: string | null;
  /** Column header label override (defaults to "Custo projetado (R$)"). */
  headerLabel?: string;
  /**
   * RFC-0228 A7 — per-consumer **goal/budget R$** keyed by device id (ingestionId),
   * the `currencyBudget` half of the naming bridge (never the quantity `budget`). When
   * present, an additive "Variação vs meta (R$)" column shows each consumer's
   * realized-vs-goal variance chip: realized R$ comes from {@link perDevice}
   * (`monetaryProjection`), the goal from here. Absent → no variance column (the
   * A6 cost column, if any, is unaffected). Withheld per DEC-6 when coverage is
   * incomplete / a verdict is indeterminate — never a fabricated number.
   */
  perDeviceGoal?: Record<string, string | null | undefined>;
  /** A7 variance column header override (defaults to "Variação vs meta (R$)"). */
  varianceHeaderLabel?: string;
}

export interface DateRange { 
  start: ISODate; 
  end: ISODate; 
}

export interface BaseApiCfg {
  clientId?: string;
  clientSecret?: string;
  dataApiBaseUrl?: string;
  graphsBaseUrl?: string;
  timezone?: string;        // default: "America/Sao_Paulo"
  tbJwtToken?: string;      // required only for Settings writes
  ingestionToken?: string;  // NEW: token for data ingestion access
}

export interface BaseUiCfg {
  theme?: 'light' | 'dark';
  width?: number | 'auto';  // default: 0.8 * viewport width
}

export interface OpenEnergyParams {
  deviceId: string;
  label?: string;
  gatewayId?: string;
  slaveId?: number;
  ingestionId?: string;
  date?: Partial<DateRange>;
  ui?: BaseUiCfg;
  api: BaseApiCfg;
}

// Energy fetcher type for dependency injection
export type EnergyFetcher = (args: {
  baseUrl: string;
  ingestionId: string;
  startISO: string;
  endISO: string;
}) => Promise<any>;

export interface OpenDeviceReportParams {
  ingestionId: string;
  deviceId?: string;
  identifier?: string;    // NEW: replaces deviceLabel (device identifier/code)
  label?: string;         // NEW: replaces storeLabel (human-readable name)
  domain?: 'energy' | 'water' | 'temperature'; // NEW: data domain (default: 'energy')
  granularity?: '1d' | '1h'; // API data granularity (default: '1d')
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  fetcher?: EnergyFetcher; // Optional dependency injection for testing
}

// Customer Totals fetcher type for dependency injection
export type CustomerTotalsFetcher = (args: {
  baseUrl: string;
  token: string;
  customerId: string;
  startISO: string;
  endISO: string;
}) => Promise<any[]>;

export interface StoreItem {
  id: string;           // ingestionId to match with API response (device.ingestionId)
  identifier: string;   // Display identifier (e.g., "SCMAL1230B")
  label: string;        // Display name (e.g., "McDonalds")
  groupLabel?: string;  // RFC-0182: Optional group for "todos" mode — triggers section headers
  // Per-device `exclude_groups_totals` SERVER_SCOPE attribute (raw JSON string or parsed object).
  // When a device is flagged for the report's group, it is excluded from the report so the
  // total reconciles with the dashboard KPIs (which honor it via getValorEfetivo in MAIN_VIEW).
  excludeGroupsTotals?: string | Record<string, unknown> | null;
}

export interface OpenAllReportParams {
  customerId: string;
  domain?: 'energy' | 'water' | 'temperature'; // Data domain (default: 'energy')
  group?: string; // RFC-0182: e.g. 'lojas' | 'entrada' | 'area_comum' | 'todos' | 'climatizavel' | 'nao_climatizavel'
  granularity?: '1d' | '1h'; // API data granularity (default: '1d')
  /**
   * RFC-0223: report temporal resolution — 'consolidado' (default) keeps today's
   * single aggregate-per-device behavior; '1d'/'1h' render collapsible per-device
   * sections (day rows / day→hour drill-down) in both the grid and the PDF.
   */
  reportMode?: 'consolidado' | '1d' | '1h';
  ui?: BaseUiCfg;
  api: BaseApiCfg;
  itemsList?: StoreItem[]; // RFC-0182: Optional — if absent, maps directly from API response
  fetcher?: CustomerTotalsFetcher; // Optional dependency injection for testing
  debug?: 1 | 0; // Optional debug logging flag (1 = enabled, 0 = disabled)
  /**
   * Dashboard theme palette (createMyIOTheme) OU um mapa plano de CSS vars
   * (--myio-*). Aplicado no root da modal para herdar as cores do dashboard.
   */
  theme?: { cssVars(): Record<string, string> } | Record<string, string>;
  /** Nome do customer/shopping exibido no footer premium da modal. */
  customerName?: string;
  /**
   * RFC-0228 A6 — optional R$ money overlay. Absent → byte-identical to the
   * pre-A6 report. Present → an additive R$ column + honest DEC-8 footer total.
   */
  money?: AllReportMoneyConfig;
}

export interface OpenSettingsParams {
  deviceId: string;
  api: BaseApiCfg;
  ui?: BaseUiCfg;
  seed?: {
    label?: string; floor?: string; storeNumber?: string;
    meterId?: string; deviceRef?: string; guid?: string;
    maxDailyKwh?: number; maxNightKwh?: number; maxBusinessKwh?: number;
  };
}

export interface ModalHandle {
  close(): void;
  on(event: 'close'|'loaded'|'error', handler: (p?: any) => void): void;
}
