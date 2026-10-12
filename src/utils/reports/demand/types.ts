/**
 * RFC-0238 — Demand Panel v2: shared types (pure, no DOM).
 *
 * ThingsBoard keeps only the audit envelope of a request (who / when / what + audit events);
 * GCDR owns execution, status, result and download. The request/response shapes below follow the
 * deployed GCDR contract — RFC-0075 "Report Jobs" (§4.2) and its list of library changes (§5,
 * L-1…L-19, X-L1…X-L6).
 */

/**
 * Bucket size of the report rows (RFC-0075 §4.5). Every row carries avg / max / min / samples of
 * each selected key — there is no aggregation choice and no raw mode.
 */
export type DemandResolution = '1m' | '5m' | '15m' | '1h' | '1d';
export type PeriodPreset = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom';

/** A device as offered by the dashboard adapter — each id keeps its own namespace. */
export interface DemandDevice {
  /** ThingsBoard entity id — never filled with a GCDR id. */
  tbDeviceId: string;
  /** GCDR device id — required (the request is keyed by it). */
  gcdrDeviceId: string | null;
  /** Ingestion id — informative; GCDR resolves its own. */
  ingestionId: string | null;
  label: string;
  name: string;
  identifier: string | null;
  deviceProfile: string;
  /** Dynamic taxonomy group (GCDR); optional. */
  group?: string | null;
}

/** Device entry of the GCDR request (strict: only these fields). */
export interface RequestDevice {
  gcdrDeviceId: string;
  tbDeviceId?: string;
  ingestionId?: string | null;
  label?: string;
  name?: string;
  identifier?: string | null;
  deviceProfile?: string;
  group?: string;
}

export interface EnvelopeTelemetry {
  key: string;
  label: string;
  unit: string;
}

export interface RequestPeriod {
  /** ISO instants (UTC `toISOString()`); half-open `[start, end)`. */
  start: string;
  end: string;
  timezone: 'America/Sao_Paulo';
  preset?: PeriodPreset;
}

/** The `request` object sent to GCDR — the input of `requestHash` (canonicalisation v2). */
export interface DemandRequest {
  devices: RequestDevice[];
  period: RequestPeriod;
  resolution: DemandResolution;
  telemetries: EnvelopeTelemetry[];
  /** buckets × devices × keys; informative (stripped from the hash). */
  estimate?: { buckets: number; points: number };
}

/** Audit operation and the GCDR response it records. Timeouts are never recorded (not a rejection). */
export type AuditOp = 'submit' | 'resend' | 'cancel' | 'reused';
export type AuditOutcome = 'requested' | 'accepted' | 'rejected';

export interface AuditEvent {
  op: AuditOp;
  /** `requested` = intent written with the envelope; `accepted`/`rejected` = a GCDR response was received. */
  outcome: AuditOutcome;
  at: string;
  /** ThingsBoard user id (or the GCDR declared identity for reconciled events). */
  by: string;
  /** Error code for `rejected` (e.g. VALIDATION_FAILED, JOB_ID_CONFLICT, ACTIVE_JOBS_LIMIT). */
  code?: string;
  /** `details.reason` of the rejection (e.g. PERIOD_TOO_LONG, DEVICE_NO_SOURCE). */
  reason?: string;
  httpStatus?: number;
  message?: string;
  /** For `reused`: the execution whose result was reused (X-L2). */
  executionId?: string;
  /** `reconciled` when rebuilt from GCDR state after a lost append. */
  source?: 'reconciled';
}

/** Options sent outside `request` (part of GCDR's intent hash; a resend must repeat them). */
export interface SubmitOptions {
  force?: boolean;
  visibility?: 'customer' | 'private';
  notify?: NotifyIntent;
}

export interface NotifyIntent {
  onSucceeded?: boolean;
  onFailed?: boolean;
  onQueued?: boolean;
  onCancelled?: boolean;
  recipients?: { users?: string[]; groups?: string[] };
}

/** Envelope schema 2 = GCDR request shape (schema 1 was the pre-RFC-0075 draft — read as illegible). */
export const ENVELOPE_SCHEMA_VERSION = 2;

export interface DemandReportEnvelope {
  schemaVersion: 2;
  type: 'demand-report';
  jobId: `drj_${string}`;
  catalogVersion: number;
  /** Version of the request canonicalisation (`canonical-v2` = RFC-0075 §4.2.5). */
  hashAlgorithm: string;
  /** Lowercase hex SHA-256 (64 chars). */
  requestHash: string;
  /** Declared by the browser clock — informative, not authoritative. */
  requestedAt: string;
  requestedBy: { tbUserId: string; name: string; email?: string };
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  request: DemandRequest;
  /** Stored so a resend repeats them exactly (else 409 OPTIONS_MISMATCH). */
  options: SubmitOptions;
  audit: AuditEvent[];
}

/** @deprecated name kept for existing imports — use {@link DemandReportEnvelope}. */
export type DemandReportEnvelopeV1 = DemandReportEnvelope;

/** Submit body (RFC-0075 §4.2.3, strict). */
export interface SubmitCommand extends SubmitOptions {
  schemaVersion: 1;
  type: 'demand-report';
  catalogVersion: number;
  jobId: string;
  requestHash: string;
  requestedBy?: { userId: string; name?: string; email?: string };
  request: DemandRequest;
}

/** Validate (dry-run) body: same as submit, jobId/requestHash optional. */
export type ValidateCommand = Omit<SubmitCommand, 'jobId' | 'requestHash'> & { jobId?: string; requestHash?: string };

export type GcdrJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type ResultAvailability = 'pending' | 'available' | 'expired' | 'purged';

export interface DeclaredIdentity {
  userId: string;
}

export interface JobFile {
  kind: 'csv' | 'xlsx' | 'json';
  filename: string;
  byteSize?: number;
}

export interface LargestDevicePeak {
  deviceId?: string;
  label?: string;
  w?: number;
  kw?: number;
  at?: string;
}

/** JobStatus of GCDR, projected by the adapter (progress → percent). */
export interface GcdrJobView {
  jobId: string;
  executionId?: string | null;
  status: GcdrJobStatus;
  resultAvailability?: ResultAvailability;
  reused?: boolean;
  /** 0–100 (`progress.percent`), null when unknown. */
  progress: number | null;
  phase?: string | null;
  attempts?: number | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  expiresAt?: string | null;
  generatedAt?: string | null;
  requestedBy?: DeclaredIdentity | null;
  generatedBy?: DeclaredIdentity | null;
  cancelledBy?: { declared?: DeclaredIdentity | null; credentialKind?: string; credentialId?: string } | null;
  cancelledAt?: string | null;
  error?: { code: string; message: string; retryable?: boolean; details?: unknown } | null;
  result?: { expiresAt?: string; points?: number; rows?: number; files?: JobFile[]; warnings?: unknown[] } | null;
  totals?: { largestDevicePeak?: LargestDevicePeak | null } & Record<string, unknown>;
  summary?: { deviceCount?: number; start?: string; end?: string; resolution?: DemandResolution; telemetryCount?: number } & Record<string, unknown>;
  queue?: { position?: number; freeSlots?: number; estimatedStartAt?: string | null } | null;
}

export type BatchResult = { jobId: string; found: true; job: GcdrJobView } | { jobId: string; found: false };

/** Error shape thrown by the ports: `status` 0 = no response (timeout / network). */
export interface PortError {
  status: number;
  code: string;
  message: string;
  /** `error.details` of GCDR (e.g. `{ reason }`, `{ limit, current, max }`). */
  details?: unknown;
  /** Seconds from `Retry-After`, when present. */
  retryAfter?: number;
}

export interface QuotaCounter {
  current: number;
  max: number;
  resetsAt?: string;
}

export interface ValidateResult {
  ok: boolean;
  errors: Array<{ code?: string; reason?: string; message?: string; details?: unknown }>;
  warnings: Array<{ code?: string; message?: string; details?: unknown }>;
  estimate?: { buckets: number; points: number; rowsExported?: number; workUnits?: number } | null;
  demandSeries?: boolean;
  quotas?: { user?: QuotaCounter; customer?: QuotaCounter; tenant?: QuotaCounter; day?: QuotaCounter } | null;
  activeJobs?: GcdrJobView[];
  dataPreview?: unknown;
  reusable?: { jobId?: string; generatedAt?: string; generatedBy?: DeclaredIdentity | null } | null;
}

export interface ReportJobsConfig {
  catalogVersion?: number;
  demandLabel?: string;
  diPowerBuckets?: boolean;
  limits?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ResultDescriptor {
  jobId: string;
  status?: GcdrJobStatus;
  resultAvailability?: ResultAvailability;
  reused?: boolean;
  generatedAt?: string | null;
  generatedBy?: DeclaredIdentity | null;
  expiresAt?: string | null;
  files: Array<JobFile & { url: string; contentType?: string; expiresInSeconds?: number }>;
}

/** ThingsBoard customer SERVER_SCOPE attributes. */
export interface EnvelopeStore {
  keys(opts?: { signal?: AbortSignal }): Promise<string[]>;
  get(keys: string[], opts?: { signal?: AbortSignal }): Promise<Array<{ key: string; value: unknown; lastUpdateTs?: number }>>;
  put(key: string, envelope: DemandReportEnvelope, opts?: { signal?: AbortSignal }): Promise<void>;
  appendAudit(key: string, event: AuditEvent, opts?: { signal?: AbortSignal }): Promise<DemandReportEnvelope>;
}

/** GCDR report-jobs API (RFC-0075 §4.2; port of RFC-0238 + L-19). */
export interface ReportJobsApi {
  submit(cmd: SubmitCommand, opts?: { signal?: AbortSignal }): Promise<GcdrJobView>;
  validate(cmd: ValidateCommand, opts?: { signal?: AbortSignal }): Promise<ValidateResult>;
  config(opts?: { signal?: AbortSignal }): Promise<ReportJobsConfig>;
  batchGet(jobIds: string[], opts?: { signal?: AbortSignal }): Promise<BatchResult[]>;
  active(opts?: { signal?: AbortSignal }): Promise<GcdrJobView[]>;
  cancel(jobId: string, declared?: { tbUserId: string }, opts?: { signal?: AbortSignal }): Promise<GcdrJobView>;
  download(jobId: string, opts?: { signal?: AbortSignal; expiresInSeconds?: number }): Promise<ResultDescriptor>;
  summary?(jobId: string, opts?: { signal?: AbortSignal }): Promise<unknown>;
}
