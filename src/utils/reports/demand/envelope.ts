/**
 * RFC-0238 §3 — the audit envelope stored in the customer SERVER_SCOPE attribute
 * `demandReportJob_<jobId>`, and the GCDR commands projected from it (RFC-0075 §4.2.3, strict).
 */
import { CATALOG_VERSION, telemetriesInCatalogOrder } from './catalog';
import { HASH_ALGORITHM, requestHash, type Sha256 } from './hash';
import { bucketCount, type Range } from './period';
import type {
  AuditEvent,
  DemandDevice,
  DemandReportEnvelope,
  DemandRequest,
  DemandResolution,
  PeriodPreset,
  RequestDevice,
  SubmitCommand,
  SubmitOptions,
  ValidateCommand,
} from './types';
import { ENVELOPE_SCHEMA_VERSION } from './types';

export const JOB_KEY_PREFIX = 'demandReportJob_';
/** Submit body schema (GCDR `schemaVersion: 1`). */
export const SUBMIT_SCHEMA_VERSION = 1;

export const envelopeKey = (jobId: string): string => JOB_KEY_PREFIX + jobId;

/**
 * UUID v7 (48-bit ms timestamp + version + random). Ordered by the CLIENT clock — listing order
 * and "newest first" depend on it (RFC-0238 §3, time).
 */
export function uuidv7(ms: number, random: (n: number) => Uint8Array = defaultRandom): string {
  const r = random(10);
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const t = Math.floor(ms).toString(16).padStart(12, '0').slice(-12);
  const rh = hex(r);
  const variant = ((r[2] & 0x3f) | 0x80).toString(16);
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${rh.slice(0, 3)}-${variant}${rh.slice(6, 8)}-${rh.slice(8, 20)}`;
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export interface BuildRequestInput {
  devices: DemandDevice[];
  range: Range;
  preset: PeriodPreset;
  resolution: DemandResolution;
  telemetryKeys: Iterable<string>;
}

const clip = (v: string | null | undefined, max: number): string | undefined =>
  typeof v === 'string' && v.length ? v.slice(0, max) : undefined;

/** Device entry within GCDR's strict limits; absent values are omitted (they change the hash). */
function requestDevice(d: DemandDevice): RequestDevice {
  const out: RequestDevice = { gcdrDeviceId: String(d.gcdrDeviceId) };
  const tb = clip(d.tbDeviceId, 64);
  if (tb) out.tbDeviceId = tb;
  out.ingestionId = d.ingestionId || null;
  const label = clip(d.label, 200);
  if (label) out.label = label;
  const name = clip(d.name, 200);
  if (name) out.name = name;
  out.identifier = d.identifier ? d.identifier.slice(0, 100) : null;
  const profile = clip(d.deviceProfile, 100);
  if (profile) out.deviceProfile = profile;
  const group = clip(d.group ?? undefined, 40);
  if (group) out.group = group;
  return out;
}

/** The request snapshot shown in the summary — and exactly what is stored, hashed and sent. */
export function buildRequest(input: BuildRequestInput): DemandRequest {
  const telemetries = telemetriesInCatalogOrder(input.telemetryKeys);
  const devices = input.devices.filter((d) => !!d.gcdrDeviceId).map(requestDevice);
  const buckets = bucketCount(input.range.start, input.range.end, input.resolution);
  return {
    devices,
    period: {
      start: new Date(input.range.start).toISOString(),
      end: new Date(input.range.end).toISOString(),
      timezone: 'America/Sao_Paulo',
      preset: input.preset,
    },
    resolution: input.resolution,
    telemetries,
    estimate: { buckets, points: buckets * devices.length * telemetries.length },
  };
}

export interface BuildEnvelopeInput {
  request: DemandRequest;
  now: number;
  user: { tbUserId: string; name: string; email?: string };
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  options?: SubmitOptions;
  idGen?: (now: number) => string;
  sha256?: Sha256;
}

export async function buildEnvelope(input: BuildEnvelopeInput): Promise<DemandReportEnvelope> {
  const jobId = `drj_${(input.idGen ?? uuidv7)(input.now)}` as const;
  const at = new Date(input.now).toISOString();
  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    type: 'demand-report',
    jobId,
    catalogVersion: CATALOG_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    requestHash: await requestHash(input.request, input.sha256),
    requestedAt: at,
    requestedBy: { ...input.user },
    customer: { ...input.customer },
    request: input.request,
    options: { ...(input.options || {}) },
    audit: [{ op: 'submit', outcome: 'requested', at, by: input.user.tbUserId }],
  };
}

function withOptions<T extends object>(cmd: T, o: SubmitOptions | undefined): T {
  if (!o) return cmd;
  const out = cmd as T & SubmitOptions;
  if (o.force !== undefined) out.force = o.force;
  if (o.visibility !== undefined) out.visibility = o.visibility;
  if (o.notify !== undefined) out.notify = o.notify;
  return out;
}

/**
 * GCDR submit body from the STORED envelope: a resend repeats the original request, hash and
 * options (any difference is 409 JOB_ID_CONFLICT). `requestedBy` carries only the declared
 * `userId` (GCDR strips name/e-mail anyway — LGPD, O-9).
 */
export function toSubmitCommand(e: DemandReportEnvelope): SubmitCommand {
  return withOptions<SubmitCommand>(
    {
      schemaVersion: SUBMIT_SCHEMA_VERSION,
      type: e.type,
      catalogVersion: e.catalogVersion,
      jobId: e.jobId,
      requestHash: e.requestHash,
      requestedBy: { userId: e.requestedBy.tbUserId },
      request: e.request,
    },
    e.options
  );
}

/** Dry-run body (no jobId/hash) — called on step 4 BEFORE the envelope is written (L-10). */
export function toValidateCommand(request: DemandRequest, user: { tbUserId: string }, options?: SubmitOptions): ValidateCommand {
  return withOptions<ValidateCommand>(
    {
      schemaVersion: SUBMIT_SCHEMA_VERSION,
      type: 'demand-report',
      catalogVersion: CATALOG_VERSION,
      requestedBy: { userId: user.tbUserId },
      request,
    },
    options
  );
}

export type ParsedEnvelope = { ok: true; envelope: DemandReportEnvelope } | { ok: false; reason: string; schemaVersion?: unknown };

/** Validates the shape read from TB; unknown versions or broken JSON never break the list. */
export function parseEnvelope(raw: unknown): ParsedEnvelope {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return { ok: false, reason: 'invalid-json' };
    }
  }
  if (!v || typeof v !== 'object') return { ok: false, reason: 'not-an-object' };
  const o = v as Partial<DemandReportEnvelope>;
  // schema 1 = pre-RFC-0075 draft (aggregation/startUtc) — illegible for the current contract
  if (o.schemaVersion !== ENVELOPE_SCHEMA_VERSION) return { ok: false, reason: 'unknown-version', schemaVersion: o.schemaVersion };
  if (o.type !== 'demand-report' || typeof o.jobId !== 'string' || !o.jobId.startsWith('drj_')) return { ok: false, reason: 'bad-header' };
  if (!o.request || !Array.isArray(o.request.devices) || !o.request.period?.start || !Array.isArray(o.request.telemetries)) {
    return { ok: false, reason: 'bad-request' };
  }
  if (!Array.isArray(o.audit) || typeof o.requestedAt !== 'string' || !o.requestedBy) return { ok: false, reason: 'bad-audit' };
  return { ok: true, envelope: { ...(o as DemandReportEnvelope), options: o.options || {} } };
}

export function auditEvent(op: AuditEvent['op'], outcome: AuditEvent['outcome'], by: string, now: number, extra: Partial<AuditEvent> = {}): AuditEvent {
  return { op, outcome, at: new Date(now).toISOString(), by, ...extra };
}
