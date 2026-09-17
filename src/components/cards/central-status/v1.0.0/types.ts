/**
 * CentralStatusCard v1.0.0 (RFC-0231) — public types.
 */
import type {
  CentralConnectivity,
  CentralConnectivityEvidence,
} from '../../../../utils/central/deriveConnectivity';

export type { CentralConnectivity };

/**
 * DELETED added per review — behavior is intentionally NOT designed yet
 * (does it disable the Status slider? show a distinct badge instead of the
 * slider? who can transition into/out of it?). The type accepts it so a host
 * won't hit a TS error just by having deleted centrals in the same dataset;
 * the card currently renders it like INACTIVE (switch off) with the raw
 * label text — revisit before any UI actually sets entityStatus: 'DELETED'.
 */
export type CentralEntityStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';
export type CentralStatusCardVariant = 'card' | 'compact';

/** Reuses the createDivCard accent vocabulary. */
export type DivCardAccent =
  | 'rose'
  | 'amber'
  | 'blue'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'slate'
  | 'none';

export interface CentralProbeVerdict {
  /** Plain-language label, e.g. "Respondendo", "Sem resposta", "Erro de configuração". */
  label: string;
  /** Chip severity for styling. */
  tone: 'ok' | 'warn' | 'bad' | 'muted';
  /** Optional latency in ms (shown as a muted suffix). */
  latencyMs?: number | null;
}

export interface CentralDeviceCounts {
  total: number;
  online: number;
  offline: number;
  /** Remainder (mostly CENTRAL_UNREACHABLE cascade), NOT offline. */
  unknown: number;
}

export interface CentralDivergence {
  /** Canonical status. */
  current: string;
  /** Worker-proposed status. */
  proposed: string;
}

/**
 * Worker/history vocabulary (`orchestrator_devices_status_history`) —
 * DELIBERATELY NOT the same union as `CentralConnectivity` (ONLINE/OFFLINE/
 * WARNING/UNKNOWN). The history table stores the worker's canonical/proposed
 * verdict, never the cockpit's display-only hard-offline derivation — there
 * is no "OFFLINE_HARD" row in the ledger, because that tier is computed at
 * render time by `deriveCentralConnectivity`, not persisted. Conflating the
 * two vocabularies would be exactly the kind of drift RFC-0231 was written
 * to kill.
 */
export type CentralTimelineStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

/** One row from `orchestrator_devices_status_history` (migration 0072) — append-on-change, never per-tick. */
export interface CentralTimelineTransition {
  from_status: CentralTimelineStatus;
  to_status: CentralTimelineStatus;
  /** The signal that caused the transition, e.g. "TIMEOUT". Null when not applicable. */
  probe_result: string | null;
  /** shadow = proposed trajectory (not yet authoritative); canonical = the live verdict. */
  mode: 'shadow' | 'canonical';
  /** ISO timestamp. */
  created_at: string;
}

/** A continuous run of one status, reconstructed server-side from the transitions. */
export interface CentralTimelineSegment {
  status: CentralTimelineStatus;
  /** ISO timestamp. */
  start: string;
  /** ISO timestamp. */
  end: string;
  durationMs: number;
}

/** Body of `GET {baseUrl}{path}?days=N`. */
export interface CentralTimelineResponse {
  transitions: CentralTimelineTransition[];
  segments: CentralTimelineSegment[];
}

/**
 * Wires the 📈 timeline button + modal to a GCDR admin endpoint. Omit `timeline`
 * entirely on `CreateCentralStatusCardParams` to hide the button (matches the
 * old card's behavior on hosts that haven't wired it yet).
 *
 * Two ways to fetch, same as the connectivity derivation split elsewhere in
 * this card:
 * - `baseUrl`/`path`/`fetchOptions` — the card builds the URL and calls
 *   `fetch()` itself. `fetchOptions` is passed to `fetch()` verbatim (headers,
 *   credentials, …) — the card never invents auth, same principle as
 *   `onMonitoringToggle` et al.
 * - `onFetchTimeline` — full override (non-fetch transport, extra
 *   processing, etc.). Takes precedence over `baseUrl`/`path`/`fetchOptions`
 *   when provided.
 */
export interface CreateCentralStatusCardTimelineConfig {
  /** GCDR host, e.g. "https://gcdr.example.com". Trailing slash optional. Required unless `onFetchTimeline` is given. */
  baseUrl?: string;
  /**
   * Path template with a literal `:id` placeholder, substituted with this
   * card's `id` (the GCDR gateway/central id — the same id already used in
   * every other event payload on this card).
   * Default: "/admin/orchestrator-devices/api/centrals/:id/timeline".
   */
  path?: string;
  /** Passed to `fetch()` verbatim — headers/credentials/etc. */
  fetchOptions?: RequestInit;
  /** Escape hatch: full override of the fetch itself. */
  onFetchTimeline?: (params: { id: string; days: number }) => Promise<CentralTimelineResponse>;
  /** Which period buttons to offer, in days. Default: [1, 7, 30, 90] (24h/7d/30d/90d). */
  periods?: number[];
  /** Pre-selected period (days) when the modal opens. Default: 30. */
  defaultDays?: number;
}

/** i18n overrides — every human string the card renders. All optional. */
export interface CentralStatusCardLabels {
  connectivity?: string; // "conectividade"
  monitoring?: string; // "Monitoramento"
  status?: string; // "Status"
  forceSync?: string; // "Atualizar evidência"
  lastAttempt?: string; // "última tentativa"
  lastSuccess?: string; // "último sucesso"
  connectionTest?: string; // "teste de conexão"
  devices?: string; // "dispositivos"
  /**
   * Per-count captions for the devices row (total/online/offline/unknown) —
   * exposed as a title/aria-label on each colored dot, since visible order +
   * a 6px dot alone isn't a real signal (confirmed confusing: "155 · 0 · 0 ·
   * 155" reads as 4 unlabeled numbers when two counts are 0).
   */
  deviceTotal?: string; // "total"
  deviceOnline?: string; // "online"
  deviceOffline?: string; // "offline"
  deviceUnknown?: string; // "desconhecido"
  divergence?: string; // "divergência"
  connectivityValue?: Partial<Record<CentralConnectivity, string>>;
  confirmMonitoringOff?: { title: string; message: string; confirm: string; cancel: string };
  confirmDeactivate?: { title: string; message: string; confirm: string; cancel: string };
  confirmActivate?: { title: string; message: string; confirm: string; cancel: string };
  // {name} is interpolated in confirm messages.

  // ── timeline modal (§ CreateCentralStatusCardTimelineConfig) ─────────────
  timelineButton?: string; // aria-label/title of the 📈 button — "Ver timeline de conectividade"
  timelineModalTitle?: string; // "Timeline de conectividade — {name}" — {name} interpolated
  /** Period button labels, keyed by days. Falls back to "{n}d"/"{n}h" for periods not listed. */
  timelinePeriodLabels?: Partial<Record<number, string>>;
  timelineLegend?: Partial<Record<CentralTimelineStatus, string>>; // DEGRADED defaults to "ATENÇÃO" (pt)
  timelineEmptyState?: string; // "Sem transições registradas nesse período."
  timelineShadowNote?: string; // "Em shadow, reflete o estado proposto; canônico quando ativo."
  timelineFetchError?: string; // generic fetch-failure message
  timelineRetry?: string; // retry button label
  timelineLoading?: string; // loading placeholder text

  // ── action row / selection (§ onOpenDashboard/onOpenReport/onOpenSettings/enableSelection) ──
  dashboardButton?: string; // "Ver dashboard"
  reportButton?: string; // "Ver relatório"
  settingsButton?: string; // "Configurações"
  selectCheckbox?: string; // "Selecionar {name}" — {name} interpolated
}

/**
 * Event passed to onMonitoringToggle. `next` is the requested state, `previous`
 * the state before the flip (so the host can log the transition).
 */
export interface CentralMonitoringToggleEvent {
  id: string;
  /** true = monitoring ON. */
  next: boolean;
  previous: boolean;
  source: 'central-status-card';
}

/**
 * Event passed to onStatusToggle. The registry lifecycle uses an explicit string
 * union — never a boolean — so there is no ambiguity about what the flag means.
 */
export interface CentralStatusToggleEvent {
  id: string;
  next: CentralEntityStatus;
  previous: CentralEntityStatus;
  source: 'central-status-card';
}

export interface CentralStatusCardForceSyncEvent {
  id: string;
  source: 'central-status-card';
}

/** Fired by onClickCard and the 📊/📄/⚙️ action row — no state involved, just "this happened for this id". */
export interface CentralCardActionEvent {
  id: string;
  source: 'central-status-card';
}

export interface CentralSelectChangeEvent {
  id: string;
  selected: boolean;
  source: 'central-status-card';
}

/**
 * Same 4 types as the TELEMETRY widget's annotation type badges
 * (`addAnnotationIndicator` — pending/maintenance/activity/observation).
 */
export type CentralAnnotationType = 'pending' | 'maintenance' | 'activity' | 'observation';

export interface CentralAnnotationBadgeClickEvent {
  id: string;
  type: CentralAnnotationType;
  source: 'central-status-card';
}

export interface CreateCentralStatusCardParams {
  /** Mount target — the card appends itself here (like CustomerGoalsCard's `container`). */
  container?: HTMLElement;

  // ── identity & presentation ──────────────────────────────────────────────
  id: string;
  name: string;
  /** Density. 'card' (default) = full grid card; 'compact' = row-dense for tables. */
  variant?: CentralStatusCardVariant;
  /** Accent override; when omitted it is derived from connectivity (health). */
  accent?: DivCardAccent;
  /**
   * Scales the WHOLE card proportionally — fonts, paddings, switches, the
   * `min-height` floor, everything together (applied via CSS `zoom`, same
   * idea as `cards/main-view/v6.0.0`'s `customStyle.zoomMultiplier`, just one
   * CSS property instead of per-element overrides). Default: 1 (100%).
   * Example: 0.8 = 80% size. Supported in all evergreen browsers; very old
   * Firefox (<126) ignores it and renders at 100%.
   */
  scale?: number;
  /** HTML rendered inside the premium InfoTooltip on hover of the header (i)
   *  icon (e.g. UUID / Hardware ID) — same contract as DivCard's `infoHtml`,
   *  since this card is now built on `createDivCard`. Omit to hide the (i). */
  titleTooltipHtml?: string;

  // ── connectivity: pass EITHER the derived value OR the raw evidence ───────
  /** Pre-derived connectivity (host called deriveCentralConnectivity itself and
   *  passes result.connectivity). */
  derivedConnectivity?: CentralConnectivity;
  /** Pre-derived stale flag (result.stale) — renders the "stale/desatualizado"
   *  badge. Only meaningful alongside `derivedConnectivity`. */
  derivedStale?: boolean;
  /** If `derivedConnectivity` is absent, the card calls deriveCentralConnectivity
   *  on this and uses BOTH result.connectivity and result.stale. */
  connectivityEvidence?: CentralConnectivityEvidence;
  /** Grace threshold (ms) for the derivation path — failure past this but
   *  before `offlineHardMs` renders WARNING. Default 10min (mirrors the
   *  helper's own default). */
  offlineGraceMs?: number;
  /** v2 (helper): failures shorter than this are tolerated as a "blip" and
   *  the card still reads ONLINE. Default 0 (no tolerance — matches v1
   *  behavior exactly when omitted). Only used on the `connectivityEvidence`
   *  path. */
  blipToleranceMs?: number;
  /** v2 (helper): once a failure has lasted this long, the OFFLINE badge
   *  gains a duration suffix (e.g. "OFFLINE 2h30min") instead of the bare
   *  connectivityValue text. Default: unset — no hard-offline tier, bare
   *  "OFFLINE" forever (matches v1 behavior exactly when omitted). Only used
   *  on the `connectivityEvidence` path. */
  offlineHardMs?: number;

  // ── OPERAÇÃO block state ─────────────────────────────────────────────────
  monitoringEnabled: boolean;
  lastAttemptAt?: string | null; // ISO
  lastSuccessAt?: string | null; // ISO
  probeVerdict?: CentralProbeVerdict | null;
  deviceCounts?: CentralDeviceCounts | null;
  divergence?: CentralDivergence | null;
  /** Show the divergência row. Default: false (cockpit passes true; customer keeps it hidden). */
  showDivergence?: boolean;
  /** Show the 🔄 force-sync button (default: false; cockpit passes true). */
  showForceSync?: boolean;
  /**
   * Wires the 📈 timeline button next to Monitoramento — opens a modal with a
   * period selector (24h/7d/30d/90d), a stacked connectivity bar, and the raw
   * transitions list, sourced from `orchestrator_devices_status_history` via
   * a GCDR admin endpoint. Omit to hide the button entirely.
   */
  timeline?: CreateCentralStatusCardTimelineConfig;

  // ── selection / drag / click (inspired by cards/main-view/v6.0.0) ────────
  // Deliberately NOT wired to `MyIOSelectionStore` (a document/window-coupled
  // eager singleton from the main-view card family — importing it would make
  // this portable, host-agnostic card implicitly depend on the shopping
  // dashboard's report-cart concept, and it already breaks non-browser
  // builds by touching `document` at module-init). Instead: host-controlled
  // `selected` + `onSelectChange`, same principle as `monitoringEnabled`.
  // The drag payload shape matches v6.0.0's exactly, so existing drop-zones
  // stay compatible even without the store.
  /** Adds a selection checkbox (top-right) + a `.myio-cscard--selected` ring. Default: false. */
  enableSelection?: boolean;
  /** Host-controlled checked state of the selection checkbox. */
  selected?: boolean;
  /** Native HTML5 `draggable` + dragstart payload (`text/myio-id`, `application/json`, `text/myio-name` — same as v6.0.0). Default: false. */
  enableDragDrop?: boolean;

  // ── CADASTRO block state ─────────────────────────────────────────────────
  entityStatus: CentralEntityStatus;

  // ── behaviour toggles ────────────────────────────────────────────────────
  /** Disable the Monitoramento slider (e.g. no permission). Default: false. */
  monitoringReadonly?: boolean;
  /** Disable the Status slider (e.g. no permission). Default: false. */
  statusReadonly?: boolean;
  /** Require a confirm on the non-destructive Status→ACTIVE direction too. Default: false. */
  confirmStatusActivate?: boolean;
  theme?: 'light' | 'dark';
  /** UI language for the built-in default labels/confirm texts. Default: 'pt'.
   *  Only affects DEFAULTS — `labels` overrides (below) always win regardless
   *  of `language`, key by key. */
  language?: 'pt' | 'en';
  labels?: CentralStatusCardLabels;
  /**
   * Decorative icon overrides per row (string glyph or HTMLElement slot). Icons
   * are NEVER the sole semantic signal (see Accessibility / "icons are
   * decorative"). Omit to use the theme defaults; pass `false`/'' to render none.
   */
  icons?: Partial<
    Record<
      | 'connectivity'
      | 'monitoring'
      | 'status'
      | 'forceSync'
      | 'lastAttempt'
      | 'lastSuccess'
      | 'probe'
      | 'devices'
      | 'divergence'
      | 'timeline'
      | 'dashboard'
      | 'report'
      | 'settings',
      string | HTMLElement | false
    >
  >;

  // ── host callbacks (auth/audit live HERE, not in the card) ───────────────
  // All callbacks receive a typed EVENT OBJECT (never positional args), so hosts
  // can audit/log uniformly. Resolve = keep the optimistic state; reject = revert.
  /** Persist the Monitoramento flag (boolean: next = true means monitoring ON). */
  onMonitoringToggle?: (e: CentralMonitoringToggleEvent) => Promise<void>;
  /** Persist the Status flag ('ACTIVE' | 'INACTIVE' string union — never a boolean). */
  onStatusToggle?: (e: CentralStatusToggleEvent) => Promise<void>;
  /** Optional force re-probe. On resolve the host calls handle.update(...) with fresh evidence. */
  onForceSync?: (e: CentralStatusCardForceSyncEvent) => Promise<void>;
  /** Whole-card click — ignored when the click originated on a switch/button/checkbox/tooltip trigger. */
  onClickCard?: (e: CentralCardActionEvent) => void;
  /** Fires when the selection checkbox is toggled (only rendered when `enableSelection` is true). */
  onSelectChange?: (e: CentralSelectChangeEvent) => void;
  /** 📊 action button in the title bar — only rendered when provided. */
  onOpenDashboard?: (e: CentralCardActionEvent) => void;
  /** 📄 action button in the title bar — only rendered when provided. */
  onOpenReport?: (e: CentralCardActionEvent) => void;
  /** ⚙️ action button in the title bar — only rendered when provided. */
  onOpenSettings?: (e: CentralCardActionEvent) => void;

  // ── notification badges (faithful port of TELEMETRY/controller.js's ──────
  // .myio-alarm-badge / .myio-ticket-badge / .annotation-type-badge(s)) ────
  /** Top-left red bell badge. Hidden entirely when 0/omitted — never rendered as "0". Same 99+ cap and pt-BR pluralized tooltip as the original. */
  alarmCount?: number;
  /** Fires on badge click — the original is `pointer-events:none` (no click), this card makes it optional/clickable since it now anchors to `.myio-cscard__content`, not a raw device tile. */
  onAlarmBadgeClick?: (e: CentralCardActionEvent) => void;
  /** Bottom-left cyan headphone badge. Hidden when 0/omitted. Same 99+ cap as the original. */
  ticketCount?: number;
  onTicketBadgeClick?: (e: CentralCardActionEvent) => void;
  /**
   * Left-edge violet warning-triangle badge, stacked directly between the
   * alarm badge (top) and the ticket badge (bottom) — count of
   * interpolated/fabricated telemetry slots for this central (RFC-0232
   * "Incidentes" admin tab). Hidden entirely when 0/omitted. Same 99+ cap.
   */
  incidentCount?: number;
  onIncidentBadgeClick?: (e: CentralCardActionEvent) => void;
  /** Right-edge stacked column, one colored square per type present — same 4 types/colors/icons/order as `addAnnotationIndicator` (pending #d63031 ⚠️, maintenance #e17055 🔧, activity #00b894 ✓, observation #0984e3 📝). Omit a key or pass 0 to hide that type's badge. */
  annotationCounts?: Partial<Record<CentralAnnotationType, number>>;
  onAnnotationBadgeClick?: (e: CentralAnnotationBadgeClickEvent) => void;
}

/**
 * Handle mirrors CustomerGoalsCard (`el`/`update`/`setThemeMode`/`destroy`)
 * because a central status card is poll-driven data, re-rendered on each refresh.
 */
export interface CentralStatusCardHandle {
  el: HTMLElement;
  update(patch: Partial<CreateCentralStatusCardParams>): void;
  setThemeMode(mode: 'light' | 'dark'): void;
  /** Programmatic (tests / external sync). */
  setMonitoring(next: boolean): void;
  setStatus(next: CentralEntityStatus): void;
  destroy(): void;
}
