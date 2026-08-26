/**
 * RFC-0230 — V2Codec: bit-packing for the v2 device product-code scheme,
 * `DEVICE-PRODUCT-CODE-NUMBERING.md` §1-2.
 *
 * A v2 code is 4 dotted-decimal bytes, each a packed bit-field:
 *   B1  high 4 bits = year offset (year - 2026, 0-15)   low 4 bits = month (1-12)
 *   B2  high 3 bits = seq3 (0-7)                        low 5 bits = day (1-31)
 *   B3  all 8 bits  = seq (1-254; 0 and 255 reserved)
 *   B4  all 8 bits  = productType (registry byte — this codec validates only
 *                     that it's a valid byte, 0-255; it does not look up or
 *                     validate registry membership, since a raw code can be
 *                     shape-valid regardless of whether the byte is a
 *                     currently-registered product type — that check is the
 *                     name-layer's concern)
 *
 * This codec only implements v2. v1 is legacy/archived per the spec and is
 * intentionally not implemented here.
 */

import type { Codec } from './codec';
import type { DeviceProductCode, DeviceProductCodeFields, DeviceProductCodeValidationResult } from '../types';
import { DeviceProductCodeError, type DeviceProductCodeErrorReason } from '../errors';

const YEAR_BASE = 2026;
const YEAR_MAX = 2041; // YEAR_BASE + 15 (4-bit offset ceiling)

/**
 * Field-range validation shared by V2Codec's own encode/decode AND by
 * name.ts's deviceNameToDeviceProductCode (imported directly from here,
 * not via index.ts, to avoid a circular import — index.ts is what exports
 * the public facade and itself imports from name.ts). Exported so both
 * "build a code from fields" and "build a code from a name" go through the
 * exact same range checks — a name that parses but doesn't survive this
 * check must fail validateDeviceProductName too, not just formatting.
 */
export function checkFields(fields: DeviceProductCodeFields): DeviceProductCodeErrorReason | null {
  if (fields.year < YEAR_BASE || fields.year > YEAR_MAX) return 'year-out-of-range';
  if (fields.month < 1 || fields.month > 12) return 'month-out-of-range';
  if (fields.day < 1 || fields.day > 31) return 'day-out-of-range';
  if (fields.seq3 < 0 || fields.seq3 > 7) return 'seq3-out-of-range';
  if (fields.seq < 1 || fields.seq > 254) return 'seq-out-of-range';
  if (fields.productType < 0 || fields.productType > 255) return 'product-type-out-of-range';
  return null;
}

function encodeV2(fields: DeviceProductCodeFields): string {
  const reason = checkFields(fields);
  if (reason) {
    throw new DeviceProductCodeError(reason, `encodeDeviceProductCode: ${reason} (${JSON.stringify(fields)})`);
  }
  const yearOffset = fields.year - YEAR_BASE;
  const b1 = (yearOffset << 4) | fields.month;
  const b2 = (fields.seq3 << 5) | fields.day;
  const b3 = fields.seq;
  const b4 = fields.productType;
  return `${b1}.${b2}.${b3}.${b4}`;
}

function parseBytes(code: string): number[] | null {
  const parts = code.split('.');
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

function decodeV2(code: string): DeviceProductCode {
  const bytes = parseBytes(code);
  if (!bytes) {
    throw new DeviceProductCodeError('invalid-code-shape', `decodeDeviceProductCode: not 4 dotted decimal bytes 0-255 ("${code}")`);
  }
  const [b1, b2, b3, b4] = bytes;
  const yearOffset = (b1 >> 4) & 0xf;
  const month = b1 & 0xf;
  const seq3 = (b2 >> 5) & 0x7;
  const day = b2 & 0x1f;
  const seq = b3;
  const productType = b4;

  const fields: DeviceProductCodeFields = { year: YEAR_BASE + yearOffset, month, day, seq3, seq, productType };
  const reason = checkFields(fields);
  if (reason) {
    throw new DeviceProductCodeError(reason, `decodeDeviceProductCode: ${reason} ("${code}" -> ${JSON.stringify(fields)})`);
  }
  return fields;
}

function validateV2(code: string): DeviceProductCodeValidationResult {
  try {
    decodeV2(code);
    return { valid: true };
  } catch (e) {
    if (e instanceof DeviceProductCodeError) {
      return { valid: false, reason: e.reason, message: e.message };
    }
    throw e;
  }
}

export const V2Codec: Codec = {
  version: 'v2',
  encode: encodeV2,
  decode: decodeV2,
  validate: validateV2,
};
