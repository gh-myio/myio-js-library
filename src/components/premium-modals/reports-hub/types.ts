/**
 * RFC-0239 — Reports Hub public types.
 */
import type { OpenAllReportParams, StoreItem } from '../types';
import type { DemandPanelV2Params } from '../../demand-panel-v2/openDemandPanelV2';
import type { MyIOThemePalette } from '../../theme/types';

export type { StoreItem };

export type ReportDomain = 'energy' | 'water' | 'temperature' | 'alarms';
/** Domains the default group-report handler and AllReportModal accept. */
export type GroupReportDomain = Exclude<ReportDomain, 'alarms'>;
/** `${domain}_${itemId}` — the same keys as settings.enabledReportItems (RFC-0182). */
export type ReportItemKey = `${ReportDomain}_${string}`;
export type ReportItemState = 'hidden' | 'locked' | 'enabled';

export interface ReportsCatalogItem {
  /** Unique per domain: 'entrada' | 'area_comum' | 'lojas' | 'todos' | 'demand_telemetry' | … */
  id: string;
  /** Rendered with textContent. */
  label: string;
  /** Rendered with textContent. */
  description: string;
  /** Text/emoji only (v1), rendered with textContent and aria-hidden. */
  icon: string;
  /** Applied via element.style (colour values only). */
  tint: { bg: string; fg: string };
  kind: 'group-report' | 'demand-panel' | 'alarm-report' | (string & {});
}

export interface ReportsCatalogDomain {
  id: ReportDomain;
  label: string;
  items: ReportsCatalogItem[];
}
export type ReportsCatalog = ReportsCatalogDomain[];

export interface ReportsHubDevice {
  id?: string;
  ingestionId?: string;
  identifier?: string;
  label?: string;
  name?: string;
  excludeGroupsTotals?: string | Record<string, unknown> | null;
  offSetTemperature?: number | string;
  /** Full device kept for demandDevicesFromItems (gcdrDeviceId, tbId, deviceProfile, …). */
  [k: string]: unknown;
}

export interface ReportsHubVisual {
  palette?: MyIOThemePalette;
  /** Drives the hub only (destinations keep today's visual parameters). */
  mode: 'light' | 'dark';
  customerName: string;
}

export type AllReportBase = Omit<OpenAllReportParams, 'domain' | 'group' | 'itemsList'>;
export type DemandPanelParams = Omit<DemandPanelV2Params, 'devices'>;

export interface ReportsHubContext {
  /** Domains this context can serve; drives availability. */
  domains: GroupReportDomain[];
  /** Classified groups, e.g. { lojas, entrada, areacomum, ocultos }. Only called for a domain in `domains`. */
  getGroups(domain: GroupReportDomain): Record<string, ReportsHubDevice[]>;
  /** Today's semantics: resolves when hydration ends; hydration errors are logged, not thrown. */
  ensureDomainLoaded?(domain: GroupReportDomain, signal: AbortSignal): Promise<void>;
  /** AllReport base (customerId, api.*, ui, optional theme/customerName). Read once per selection. */
  getAllReportBase(): AllReportBase;
  temperature?: {
    validRange?: { min: number; max: number };
    idealRange?: { min: number; max: number };
  };
  /** Demand Panel params minus `devices`, built at prepare; absent → 'demand-panel' unavailable. */
  getDemandPanelParams?(): DemandPanelParams | null;
}

/** Synchronous: only mounts the destination. */
export type ReportsHubOpener = () => void;

export interface ReportsHubPrepareArgs {
  domain: ReportDomain;
  item: ReportsCatalogItem;
  context: ReportsHubContext;
  visual: ReportsHubVisual;
  signal: AbortSignal;
}

export interface ReportsHubHandlerDef {
  /** Which domains this handler can serve. */
  domains?: ReportDomain[];
  /** Extra availability check for an item of `domain`. Default: available. */
  isAvailable?(context: ReportsHubContext, domain: ReportDomain): boolean;
  /** Runs with the hub open. Resolve with the opener; reject to show the inline error. */
  prepare(args: ReportsHubPrepareArgs): ReportsHubOpener | Promise<ReportsHubOpener>;
}

export interface ReportsHubErrorEvent {
  domain: ReportDomain;
  item: string;
  phase: 'prepare' | 'open';
  message: string;
}

export interface OpenReportsHubParams {
  context: ReportsHubContext;
  /** Raw settings.enabledReportItems; resolved by the hub against the catalog. */
  enabledItems?: Record<string, unknown> | null;
  catalog?: ReportsCatalog;
  initialDomain?: ReportDomain;
  theme?: MyIOThemePalette;
  themeMode?: 'light' | 'dark';
  customerName?: string;
  /** Mount target of the hub only; default window.top.document when reachable, else document. */
  document?: Document;
  /** Host handlers by kind; a host handler wins over the default of the same kind. */
  handlers?: Partial<Record<string, ReportsHubHandlerDef>>;
  /** true (default): opening while open on the same Document closes it. */
  toggle?: boolean;
  /** Logging hook. Never receives the context or credentials. */
  onOpenReport?(e: { domain: ReportDomain; item: string; itemsCount?: number }): void;
  /** Error hook. Prepare errors are also shown inline; open errors as a toast. */
  onError?(e: ReportsHubErrorEvent): void;
}

export interface ReportsHubHandle {
  close(): void;
  readonly isOpen: boolean;
}

/** Minimal orchestrator capabilities read by the dashboard adapter (all optional). */
export interface ReportsHubOrchestrator {
  getEnergyGroups?(): Record<string, ReportsHubDevice[]>;
  getWaterGroups?(): Record<string, ReportsHubDevice[]>;
  getTemperatureGroups?(): Record<string, ReportsHubDevice[]>;
  getCredentials?(): { CUSTOMER_ING_ID?: string; CLIENT_ID?: string; CLIENT_SECRET?: string };
  tokenManager?: { getToken(name: string): string | undefined | null };
  hydrateDomain?(domain: string, period: unknown): Promise<unknown>;
  getCurrentPeriod?(): unknown;
  gcdrCustomerId?: string;
  gcdrApiBaseUrl?: string;
  gcdrApiKey?: string;
  gcdrTenantId?: string;
}

export interface DashboardAdapterOptions {
  orchestrator: ReportsHubOrchestrator | null | undefined;
  /** Resolved by the caller (MENU: settings.customerTB_ID ‖ window.__myioCustomerTB_ID). */
  tbCustomerId: string;
  tbBaseUrl?: string;
  getJwt(): string;
  getDataApiHost?(): string | undefined;
  /** Must count only settled data (not provisional `:loading` / `:failed`). */
  isDomainLoaded?(domain: GroupReportDomain): boolean;
  temperatureClampRange?: { min: unknown; max: unknown } | null;
  temperatureLimits?: { minTemperature?: unknown; maxTemperature?: unknown } | null;
  /** Logger (default console). Never receives credentials. */
  log?: { warn(...a: unknown[]): void };
}
