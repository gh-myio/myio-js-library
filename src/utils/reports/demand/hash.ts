/**
 * RFC-0238 §6.3 — request hash shared by the panel and GCDR (`rmc-json-sha256-v1`).
 *
 * 1. Projection: only what defines the work —
 *    `{ type, catalogVersion, devices: sorted gcdrDeviceIds, period: {start, end, timezone},
 *       aggregation, resolution, fillGaps, telemetries: sorted keys }`. Labels, names,
 *    tb/ingestion ids, preset and estimate are NOT part of it (renaming a device does not change
 *    the request). `resolution` is `null` for Bruto.
 * 2. Canonical JSON: object keys sorted by UTF-16 code units, recursively; arrays keep their
 *    (already sorted) order; no whitespace; strings/numbers as `JSON.stringify`.
 * 3. `"sha256:" + lowercase hex(SHA-256(UTF-8(canonical)))`.
 *
 * GCDR recomputes the hash from the received request; a mismatch is `422 HASH_MISMATCH`.
 */
import type { DemandRequest } from './types';

export const HASH_ALGORITHM = 'rmc-json-sha256-v1';

export interface HashProjection {
  type: 'demand-report';
  catalogVersion: number;
  devices: string[];
  period: { start: string; end: string; timezone: string };
  aggregation: string;
  resolution: string | null;
  fillGaps: boolean;
  telemetries: string[];
}

export function hashProjection(request: DemandRequest, catalogVersion: number): HashProjection {
  return {
    type: 'demand-report',
    catalogVersion,
    devices: request.devices.map((d) => String(d.gcdrDeviceId)).sort(),
    period: { start: request.period.startUtc, end: request.period.endUtc, timezone: request.period.timezone },
    aggregation: request.aggregation,
    resolution: request.resolution ?? null,
    fillGaps: !!request.fillGaps,
    telemetries: request.telemetries.map((t) => t.key).sort(),
  };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
      .join(',') +
    '}'
  );
}

/** SHA-256 digest function (injectable for tests / non-browser runtimes). */
export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;

export const webCryptoSha256: Sha256 = async (bytes) => {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('crypto.subtle indisponível (contexto não seguro?)');
  return new Uint8Array(await subtle.digest('SHA-256', bytes as unknown as BufferSource));
};

export async function requestHash(request: DemandRequest, catalogVersion: number, sha256: Sha256 = webCryptoSha256): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(hashProjection(request, catalogVersion)));
  const digest = await sha256(bytes);
  return 'sha256:' + Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
