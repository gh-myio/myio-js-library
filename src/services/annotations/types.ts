/**
 * RFC-0203 M2 — AnnotationServiceOrchestrator types.
 *
 * Re-exports canonical annotation types from RFC-0104 (the source of truth
 * already in production via TELEMETRY badge + AnnotationsTab) and adds the
 * service-facing types (AnnotatedDevice, AnnotationGroup, etc.).
 */

// ============================================================================
// Re-exports of canonical types (RFC-0104) — single source of truth
// ============================================================================

export type {
  Annotation,
  AnnotationType,
  AnnotationStatus,
  ResponseType,
  AuditAction,
  UserInfo,
  AnnotationResponse,
  AuditEntry,
  LogAnnotationsAttribute,
  ImportanceLevel,
} from '../../components/premium-modals/settings/annotations/types';

import type {
  Annotation,
  AnnotationType,
  AnnotationStatus,
} from '../../components/premium-modals/settings/annotations/types';
import type { GcdrAnnotationsClient } from '../../components/gcdr-annotations/v1.0.0/GcdrAnnotationsClient';

// ============================================================================
// Service-facing types
// ============================================================================

/** Device domain. RFC-0111 derived classification (energy/water/temperature). */
export type AnnotationDeviceDomain = 'energy' | 'water' | 'temperature' | 'unknown';

/**
 * A device augmented with its parsed annotations and the metadata required
 * by the HEADER panel (identifier, domain, label). One object per TB device.
 */
export interface AnnotatedDevice {
  /** TB device UUID */
  deviceId: string;
  /** TB device name (raw) */
  name: string;
  /** TB device label (UI-friendly) */
  label: string;
  /** SERVER_SCOPE attribute `identifier` (the cross-domain join key); null when absent */
  identifier: string | null;
  /** RFC-0111 derived domain */
  domain: AnnotationDeviceDomain;
  /** TB deviceType / deviceProfile (for context) */
  deviceType: string;
  /** Parsed annotations (status !== 'archived' filter is applied by consumers, NOT here) */
  annotations: Annotation[];
  /** RFC-0219: GCDR UUID of the device (GCDR source only; null when the device isn't linked). */
  gcdrDeviceId?: string | null;
}

/** Tab grouping mode for the HEADER panel. */
export type AnnotationGroupBy = 'identifier' | 'device' | 'domain';

/** Sort modes for groups in the HEADER panel (RFC-0203 M5, AC-23). */
export type AnnotationSortKey =
  | 'alpha-asc'
  | 'alpha-desc'
  | 'count-desc'
  | 'count-asc'
  | 'importance-desc'
  | 'recent-desc';

/** Export options chosen via the export modal (RFC-0203 M7, AC-39..AC-43). */
export interface AnnotationExportOptions {
  format: 'pdf' | 'csv';
  /** PDF levels — combinable. Ignored when format === 'csv'. */
  levels?: Array<'summary' | 'consolidated' | 'detailed'>;
  scope: 'current-tab' | 'all' | 'filtered';
}

/**
 * A logical group of devices sharing some axis (identifier / device / domain).
 * Computed on-demand from the indexed maps inside the orchestrator.
 */
export interface AnnotationGroup {
  /** Stable key (the identifier string, the deviceId, or the domain literal) */
  key: string;
  /** Display label for the UI (e.g. "L-203 Havaianas", "Co2_UTI_03", "Energia") */
  label: string;
  /** Optional icon to render alongside the label */
  icon?: string;
  /** Devices in this group */
  devices: AnnotatedDevice[];
  /** Total non-archived annotations across all devices in the group */
  totalAnnotations: number;
  /** Highest importance found in the group */
  maxImportance: number;
  /** Most recent annotation createdAt across the group (ISO-8601) */
  mostRecentAt: string | null;
}

/**
 * Filter state applied to annotations *inside* the panel. The orchestrator
 * exposes filter helpers but does NOT own UI state.
 */
export interface AnnotationFilter {
  /** Annotation types to include. Empty Set = all types. */
  types: Set<AnnotationType>;
  /** Annotation statuses to include. Empty Set = include all EXCEPT 'archived'. */
  statuses: Set<AnnotationStatus>;
  /** Importance levels to include. Empty Set = all levels. */
  importance: Set<1 | 2 | 3 | 4 | 5>;
  /**
   * "Actionable only" — type === 'pending' && status !== 'archived' &&
   * (!dueDate || dueDate <= now + 7d). Errata corrected per RFC-0203 §5 note.
   */
  actionableOnly: boolean;
  /** Free-text search; NFD-normalized at comparison time */
  searchTerm: string;
}

// ============================================================================
// Orchestrator shape
// ============================================================================

/**
 * The object exposed at `window.AnnotationServiceOrchestrator`. All queries
 * are synchronous (data lives in memory after the async build). Only
 * `refresh()` is async (re-fetches from TB).
 */
export interface AnnotationServiceOrchestratorShape {
  /** All devices observed for this customer (annotated or not). */
  readonly devices: AnnotatedDevice[];

  /** Devices indexed by their SERVER_SCOPE `identifier` (null → bucket "Sem Identificador"). */
  readonly byIdentifier: Map<string | null, AnnotatedDevice[]>;

  /** Devices indexed by deviceId (one device per key). */
  readonly byDeviceId: Map<string, AnnotatedDevice>;

  /** RFC-0219: devices indexed by GCDR device UUID (GCDR source only; empty otherwise). */
  readonly byGcdrDeviceId: Map<string, AnnotatedDevice>;

  /**
   * RFC-0219: GCDR annotations whose device is not in this dashboard's device
   * list (GCDR source only) — a non-zero value means a TB↔GCDR link is missing.
   */
  readonly unmatchedCount: number;

  /** Devices indexed by domain. */
  readonly byDomain: Map<AnnotationDeviceDomain, AnnotatedDevice[]>;

  /** Timestamp (ms epoch) of the last successful fetch; 0 if never built. */
  readonly fetchedAt: number;

  // ── Queries ──────────────────────────────────────────────────────────────

  /** All devices (annotated or not). */
  getAll(): AnnotatedDevice[];

  /** Devices that share the given identifier (or null for "Sem Identificador"). */
  getByIdentifier(identifier: string | null): AnnotatedDevice[];

  /** Single device or null. */
  getByDevice(deviceId: string): AnnotatedDevice | null;

  /** RFC-0219: single device by GCDR UUID, or null. */
  getByGcdrDevice(gcdrDeviceId: string): AnnotatedDevice | null;

  /** Devices in a domain. */
  getByDomain(domain: AnnotationDeviceDomain): AnnotatedDevice[];

  /** Groups for a given grouping axis, optionally filtered. */
  getGroups(groupBy: AnnotationGroupBy, filter?: AnnotationFilter): AnnotationGroup[];

  // ── Counts (drive the badge) ─────────────────────────────────────────────

  /** Total non-archived annotations across all devices. */
  getTotalCount(): number;

  /** Non-archived annotations of `type === 'pending'`. */
  getPendingCount(): number;

  /** Pending annotations with `dueDate` in the past (now-relative). */
  getOverdueCount(): number;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Re-fetches devices + attributes from TB and rebuilds all indices.
   * Dispatches `myio:annotations-refreshed` on completion.
   */
  refresh(): Promise<void>;

  /** Marks the cache stale (next get* will still serve, but refresh() should be called). */
  invalidate(): void;

  /** Removes the `myio:annotation-changed` listener — call before replacing the orchestrator. */
  destroy(): void;
}

/**
 * Factory params. The factory is async; it performs an initial fetch
 * before returning a built orchestrator.
 */
export interface BuildAnnotationServiceOrchestratorParams {
  /** TB customer UUID — used in `/api/customer/{customerId}/deviceInfos` */
  customerId: string;
  /** TB base URL, e.g. "https://dashboard.myio-bas.com" */
  tbHost: string;
  /** TB JWT token — sent as `X-Authorization: Bearer ${jwt}` */
  jwt: string;
  /** Cache TTL in ms (default 60_000) — used by `invalidate()` and SWR consumers */
  cacheTtlMs?: number;
  /** Optional logger; defaults to console */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  /**
   * RFC-0219: read the annotations from GCDR (one `listByCustomer`) instead of
   * each device's TB `log_annotations` attribute. Device names/labels/types
   * still come from the TB device list; the TB↔GCDR link and `identifier` come
   * from `deviceMap` (the dashboard already holds both).
   */
  gcdr?: AnnotationOrchestratorGcdrSource;
}

/** RFC-0219: GCDR source for the annotation orchestrator. */
export interface AnnotationOrchestratorGcdrSource {
  client: GcdrAnnotationsClient;
  gcdrCustomerId: string;
  /** TB device id → its GCDR UUID and (optional) `identifier` attribute. */
  deviceMap: Map<string, { gcdrDeviceId: string; identifier?: string | null }>;
}
