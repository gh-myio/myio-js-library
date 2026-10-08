/**
 * RFC-0238 §3 — the audit envelope stored in the customer SERVER_SCOPE attribute
 * `demandReportJob_<jobId>`, and the GCDR command projected from it.
 */
import { CATALOG_VERSION, DEFAULT_AGGREGATION, telemetriesInCatalogOrder } from './catalog';
import { HASH_ALGORITHM, requestHash, type Sha256 } from './hash';
import { bucketCount, type Range } from './period';
import type {
  AuditEvent,
  DemandDevice,
  DemandReportEnvelopeV1,
  DemandAggregation,
  DemandRequest,
  DemandResolution,
  PeriodPreset,
  SubmitCommand,
} from './types';

export const JOB_KEY_PREFIX = 'demandReportJob_';
export const PROTOCOL_VERSION = 1;

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
  /** Default MAX (as RealTimeTelemetryModal). */
  aggregation?: DemandAggregation;
  /** Grouping interval when aggregated (ignored for Bruto). */
  resolution: DemandResolution;
  telemetryKeys: Iterable<string>;
}

/** The request snapshot shown in the summary — and exactly what is stored and sent. */
export function buildRequest(input: BuildRequestInput): DemandRequest {
  const telemetries = telemetriesInCatalogOrder(input.telemetryKeys);
  const aggregation = input.aggregation ?? DEFAULT_AGGREGATION;
  const raw = aggregation === 'NONE';
  const buckets = raw ? null : bucketCount(input.range.start, input.range.end, input.resolution);
  return {
    devices: input.devices.map((d) => ({
      tbDeviceId: d.tbDeviceId,
      gcdrDeviceId: d.gcdrDeviceId,
      ingestionId: d.ingestionId,
      label: d.label,
      name: d.name,
      identifier: d.identifier,
      deviceProfile: d.deviceProfile,
      group: d.group ?? null,
    })),
    period: {
      startUtc: new Date(input.range.start).toISOString(),
      endUtc: new Date(input.range.end).toISOString(),
      timezone: 'America/Sao_Paulo',
      preset: input.preset,
    },
    aggregation,
    resolution: raw ? null : input.resolution,
    fillGaps: !raw,
    telemetries,
    estimate: { buckets, points: buckets === null ? null : buckets * input.devices.length * telemetries.length },
  };
}

export interface BuildEnvelopeInput {
  request: DemandRequest;
  now: number;
  user: { tbUserId: string; name: string; email?: string };
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  idGen?: (now: number) => string;
  sha256?: Sha256;
}

export async function buildEnvelope(input: BuildEnvelopeInput): Promise<DemandReportEnvelopeV1> {
  const jobId = `drj_${(input.idGen ?? uuidv7)(input.now)}` as const;
  const at = new Date(input.now).toISOString();
  return {
    schemaVersion: 1,
    type: 'demand-report',
    jobId,
    catalogVersion: CATALOG_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    requestHash: await requestHash(input.request, CATALOG_VERSION, input.sha256),
    requestedAt: at,
    requestedBy: { ...input.user },
    customer: { ...input.customer },
    request: input.request,
    audit: [{ op: 'submit', outcome: 'requested', at, by: input.user.tbUserId }],
  };
}

/**
 * GCDR command from the STORED envelope: a resend sends the original snapshot and hash, never a
 * recomputed preset or refreshed device metadata. `declaredRequester` only when the O-7 model
 * keeps a declared identity.
 */
export function toSubmitCommand(e: DemandReportEnvelopeV1, opts: { includeDeclaredRequester?: boolean } = {}): SubmitCommand {
  const cmd: SubmitCommand = {
    protocolVersion: PROTOCOL_VERSION,
    jobId: e.jobId,
    type: e.type,
    catalogVersion: e.catalogVersion,
    hashAlgorithm: e.hashAlgorithm,
    requestHash: e.requestHash,
    requestedAt: e.requestedAt,
    request: e.request,
  };
  if (opts.includeDeclaredRequester) cmd.declaredRequester = { tbUserId: e.requestedBy.tbUserId };
  return cmd;
}

export type ParsedEnvelope = { ok: true; envelope: DemandReportEnvelopeV1 } | { ok: false; reason: string; schemaVersion?: unknown };

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
  const o = v as Partial<DemandReportEnvelopeV1>;
  if (o.schemaVersion !== 1) return { ok: false, reason: 'unknown-version', schemaVersion: o.schemaVersion };
  if (o.type !== 'demand-report' || typeof o.jobId !== 'string' || !o.jobId.startsWith('drj_')) return { ok: false, reason: 'bad-header' };
  if (!o.request || !Array.isArray(o.request.devices) || !o.request.period || !Array.isArray(o.request.telemetries)) {
    return { ok: false, reason: 'bad-request' };
  }
  if (!Array.isArray(o.audit) || typeof o.requestedAt !== 'string' || !o.requestedBy) return { ok: false, reason: 'bad-audit' };
  return { ok: true, envelope: o as DemandReportEnvelopeV1 };
}

export function auditEvent(op: AuditEvent['op'], outcome: AuditEvent['outcome'], by: string, now: number, extra: Partial<AuditEvent> = {}): AuditEvent {
  return { op, outcome, at: new Date(now).toISOString(), by, ...extra };
}
