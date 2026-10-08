/**
 * RFC-0238 — Demand Panel v2: shared types (pure, no DOM).
 *
 * ThingsBoard keeps only the audit envelope of a request (who / when / what + audit events);
 * GCDR owns execution, status, result and download.
 */

/**
 * Grouping interval of an aggregated request — the same options as the "Por período" tab of
 * RealTimeTelemetryModal (15 min … 1 dia).
 */
export type DemandResolution = '15m' | '30m' | '1h' | '2h' | '4h' | '12h' | '1d';
/**
 * Aggregation, as in RealTimeTelemetryModal: `NONE` = Bruto — every raw sample of the period,
 * with NO point limit (unlike the live modal, which caps raw points).
 */
export type DemandAggregation = 'NONE' | 'AVG' | 'MAX' | 'MIN' | 'SUM';
export type PeriodPreset = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom';

/** A device as offered by the dashboard adapter — each id keeps its own namespace (RFC-0238 §2). */
export interface DemandDevice {
  /** ThingsBoard entity id — never filled with a GCDR id. */
  tbDeviceId: string;
  /** GCDR device id — required by the current flow. */
  gcdrDeviceId: string | null;
  /** Ingestion id — never filled with another id (Q3 decides what happens when missing). */
  ingestionId: string | null;
  label: string;
  name: string;
  identifier: string | null;
  deviceProfile: string;
  /** Dynamic taxonomy group (GCDR); optional. */
  group?: string | null;
}

export interface EnvelopeTelemetry {
  key: string;
  label: string;
  unit: string;
}

export interface EnvelopePeriod {
  /** Canonical instants, `toISOString()` (UTC, milliseconds, `Z`). Half-open `[start, end)`. */
  startUtc: string;
  endUtc: string;
  timezone: 'America/Sao_Paulo';
  preset: PeriodPreset;
}

export interface DemandRequest {
  devices: DemandDevice[];
  period: EnvelopePeriod;
  /** Bruto (`NONE`) or the aggregation applied per grouping interval. */
  aggregation: DemandAggregation;
  /** Grouping interval — only when aggregated (`null` for Bruto). */
  resolution: DemandResolution | null;
  /**
   * Aggregated series have one point per interval; an interval without telemetry repeats the
   * previous value (flagged as "carried", as RealTimeTelemetryModal paints it purple). Always
   * `false` for Bruto.
   */
  fillGaps: boolean;
  telemetries: EnvelopeTelemetry[];
  /**
   * Aggregated: buckets = grid intervals, points = buckets × devices × telemetries.
   * Bruto: `null` — every sample of the period, size depends on each meter's reporting rate.
   */
  estimate: { buckets: number | null; points: number | null };
}

/** Audit operation and the GCDR response it records. Timeouts are never recorded (not a rejection). */
export type AuditOp = 'submit' | 'resend' | 'cancel';
export type AuditOutcome = 'requested' | 'accepted' | 'rejected';

export interface AuditEvent {
  op: AuditOp;
  /** `requested` = intent written with the envelope; `accepted`/`rejected` = a GCDR response was received. */
  outcome: AuditOutcome;
  at: string;
  /** ThingsBoard user id (or the GCDR principal for reconciled events). */
  by: string;
  /** Error code for `rejected` (e.g. VALIDATION_FAILED, ACTIVE_JOBS_LIMIT, FORBIDDEN). */
  code?: string;
  httpStatus?: number;
  message?: string;
  /** `reconciled` when rebuilt from GCDR state after a lost append. */
  source?: 'reconciled';
}

export interface DemandReportEnvelopeV1 {
  schemaVersion: 1;
  type: 'demand-report';
  jobId: `drj_${string}`;
  catalogVersion: number;
  hashAlgorithm: string;
  requestHash: string;
  /** Declared by the browser clock — informative, not authoritative. */
  requestedAt: string;
  requestedBy: { tbUserId: string; name: string; email?: string };
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  request: DemandRequest;
  audit: AuditEvent[];
}

/** Command sent to GCDR — a projection of the stored envelope. */
export interface SubmitCommand {
  protocolVersion: number;
  jobId: string;
  type: 'demand-report';
  catalogVersion: number;
  hashAlgorithm: string;
  requestHash: string;
  requestedAt: string;
  request: DemandRequest;
  /** Only when the authentication model (O-7) keeps a declared identity; never the authenticated principal. */
  declaredRequester?: { tbUserId: string };
}

export type GcdrJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface GcdrJobView {
  jobId: string;
  status: GcdrJobStatus;
  progress: number | null;
  createdAt: string;
  finishedAt?: number | string | null;
  requestedBy?: { principal: string; declared?: { tbUserId: string } | null };
  summary?: { deviceCount: number; start: string; end: string; aggregation?: DemandAggregation; resolution: DemandResolution | null; telemetryCount: number };
  cancelledBy?: { principal: string; declared?: { tbUserId: string } | null } | null;
  cancelledAt?: string | null;
  error?: { code: string; message: string; retryable?: boolean } | null;
  result?: { available: boolean; expiresAt?: string } | null;
}

export type BatchResult = { jobId: string; found: true; job: GcdrJobView } | { jobId: string; found: false };

/** Error shape thrown by the ports: `status` 0 = no response (timeout / network). */
export interface PortError {
  status: number;
  code: string;
  message: string;
}

/** ThingsBoard customer SERVER_SCOPE attributes. */
export interface EnvelopeStore {
  keys(opts?: { signal?: AbortSignal }): Promise<string[]>;
  get(keys: string[], opts?: { signal?: AbortSignal }): Promise<Array<{ key: string; value: unknown; lastUpdateTs?: number }>>;
  put(key: string, envelope: DemandReportEnvelopeV1, opts?: { signal?: AbortSignal }): Promise<void>;
  appendAudit(key: string, event: AuditEvent, opts?: { signal?: AbortSignal }): Promise<DemandReportEnvelopeV1>;
}

/** GCDR report-jobs API (RFC-0238 §6). */
export interface ReportJobsApi {
  submit(cmd: SubmitCommand, opts?: { signal?: AbortSignal }): Promise<GcdrJobView>;
  batchGet(jobIds: string[], opts?: { signal?: AbortSignal }): Promise<BatchResult[]>;
  active(opts?: { signal?: AbortSignal }): Promise<GcdrJobView[]>;
  cancel(jobId: string, declared?: { tbUserId: string }, opts?: { signal?: AbortSignal }): Promise<GcdrJobView>;
  download(jobId: string, opts?: { signal?: AbortSignal }): Promise<unknown>;
}
