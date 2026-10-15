/**
 * RFC-0238 / RFC-0075 §4.2.5 (L-8) — `requestHash`, canonicalisation v2, shared with GCDR
 * (`gcdr.git/src/services/reports/canonical.ts`). The fixture
 * `tests/fixtures/reports/request-hash-v2.json` is kept identical in both repositories.
 *
 * Steps applied to the `request` object exactly as sent:
 * 1. strip `devices[].label`, `devices[].name` and `estimate`;
 * 2. sort `devices` by `gcdrDeviceId` and `telemetries` by `key` (UTF-16 code units);
 * 3. `period.start` / `period.end` → UTC ISO with milliseconds and `Z`;
 * 4. canonical JSON (keys sorted recursively by code units, no whitespace, JSON.stringify semantics);
 * 5. lowercase hex SHA-256 (no prefix).
 *
 * Every other field (identifier, tbDeviceId, ingestionId, deviceProfile, group, preset, telemetry
 * label/unit) IS part of the hash — a resend must send the stored request unchanged.
 */
import type { DemandRequest } from './types';

/** Envelope marker of the canonicalisation version (versioned by the submit `schemaVersion` 1). */
export const HASH_ALGORITHM = 'canonical-v2';

/** UTF-16 code-unit order (what `<` does on JS strings) — never locale-aware. */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function serialize(value: unknown): string | undefined {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return JSON.stringify(value);
    case 'bigint':
      throw new TypeError('canonicalJson: bigint is not serialisable');
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
    default:
      break;
  }
  const withToJson = value as { toJSON?: (key: string) => unknown };
  if (typeof withToJson.toJSON === 'function') return serialize(withToJson.toJSON(''));
  if (Array.isArray(value)) return '[' + value.map((item) => serialize(item) ?? 'null').join(',') + ']';
  if (isPlainObject(value)) {
    const parts: string[] = [];
    for (const key of Object.keys(value).sort(compareCodeUnits)) {
      const s = serialize(value[key]);
      if (s !== undefined) parts.push(JSON.stringify(key) + ':' + s);
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

/** Canonical JSON (JSON.stringify semantics, keys sorted recursively, no whitespace). */
export function canonicalJson(value: unknown): string {
  const out = serialize(value);
  return out === undefined ? 'null' : out;
}

const toUtcIso = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`invalid datetime: ${String(value)}`);
  return d.toISOString();
};

/** Steps 1–3: the canonical projection of the request (a new object). */
export function canonicalizeRequest(request: DemandRequest): Record<string, unknown> {
  const devices = request.devices
    .map((d) => {
      const rest: Record<string, unknown> = { ...d };
      delete rest.label;
      delete rest.name;
      return rest;
    })
    .sort((a, b) => compareCodeUnits(String(a.gcdrDeviceId), String(b.gcdrDeviceId)));
  const telemetries = request.telemetries.map((t) => ({ ...t })).sort((a, b) => compareCodeUnits(a.key, b.key));
  const period = { ...request.period, start: toUtcIso(request.period.start), end: toUtcIso(request.period.end) };
  const out: Record<string, unknown> = { ...request, devices, period, telemetries };
  delete out.estimate;
  return out;
}

export function canonicalRequestJson(request: DemandRequest): string {
  return canonicalJson(canonicalizeRequest(request));
}

/** SHA-256 digest function (injectable for tests / non-browser runtimes). */
export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;

export const webCryptoSha256: Sha256 = async (bytes) => {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('crypto.subtle indisponível (contexto não seguro?)');
  return new Uint8Array(await subtle.digest('SHA-256', bytes as unknown as BufferSource));
};

/** Lowercase hex SHA-256 of the canonical request (64 chars, no prefix). */
export async function requestHash(request: DemandRequest, sha256: Sha256 = webCryptoSha256): Promise<string> {
  const digest = await sha256(new TextEncoder().encode(canonicalRequestJson(request)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
