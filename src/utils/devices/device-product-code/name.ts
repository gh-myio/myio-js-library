/**
 * RFC-0230 — canonical device name <-> DeviceProductCode, `DEVICE-NAME-SPEC.md` §1-2, §4-5.
 *
 * Name shape: `PREFIX YYMMDD-NNNN` — one space after PREFIX (not a hyphen;
 * `handleDeviceType()` in `CENTRAL_PRE_SETUP/attributes-sync.js` word-boundary
 * matches on this, so the module must guard the exact separator), hyphen
 * between date and unit, regex `^[A-Z0-9]{2,12} \d{6}-\d{4}$`.
 * `NNNN` merges `seq3`/`seq` into a single "unit of the day"
 * (`unit = seq3*254 + seq`, range `0001`-`2032`).
 */

import type { DeviceProductCode, DeviceProductCodeValidationResult } from './types';
import { DeviceProductCodeError } from './errors';
import { getProductTypeEntryByByte, getProductTypeEntryByPrefix } from './registry/productTypeRegistry';
import { isFunctionalKeywordPrefix } from './registry/functionalKeywordRegistry';
import { checkFields } from './codecs/v2';

const NAME_RE = /^([A-Z0-9]{2,12}) (\d{2})(\d{2})(\d{2})-(\d{4})$/;

// Spec-mandated (not an RFC invention) — `DEVICE-NAME-SPEC.md` §4's reference
// implementation and §5 rule 2 both define this fallback for an unrecognized
// type byte.
const UNKNOWN_PREFIX_RE = /^T(\d{1,3})$/;

function prefixForProductType(productType: number): string {
  const entry = getProductTypeEntryByByte(productType);
  if (entry) return entry.prefix;
  return `T${productType}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function deviceProductCodeToName(value: DeviceProductCode): string {
  const prefix = prefixForProductType(value.productType);
  const yy = pad2(value.year % 100);
  const mm = pad2(value.month);
  const dd = pad2(value.day);
  const unit = value.seq3 * 254 + value.seq;
  return `${prefix} ${yy}${mm}${dd}-${pad4(unit)}`;
}

function resolveProductType(prefix: string): number {
  const entry = getProductTypeEntryByPrefix(prefix);
  if (entry) return entry.byte;

  if (isFunctionalKeywordPrefix(prefix)) {
    throw new DeviceProductCodeError(
      'non-invertible-prefix',
      `deviceNameToDeviceProductCode: "${prefix}" is a functional keyword, not a product-type prefix — the product-type byte cannot be derived from it alone`,
    );
  }

  const fallbackMatch = UNKNOWN_PREFIX_RE.exec(prefix);
  if (fallbackMatch) {
    const byte = Number(fallbackMatch[1]);
    if (byte >= 0 && byte <= 255) return byte;
  }

  throw new DeviceProductCodeError('unknown-prefix', `deviceNameToDeviceProductCode: unrecognized prefix "${prefix}"`);
}

export function deviceNameToDeviceProductCode(name: string): DeviceProductCode {
  const match = NAME_RE.exec(name);
  if (!match) {
    throw new DeviceProductCodeError('invalid-name-shape', `deviceNameToDeviceProductCode: does not match PREFIX YYMMDD-NNNN ("${name}")`);
  }
  const [, prefix, yy, mm, dd, nnnn] = match;
  const productType = resolveProductType(prefix);

  const unit = Number(nnnn);
  if (unit < 1 || unit > 2032) {
    throw new DeviceProductCodeError('unit-out-of-range', `deviceNameToDeviceProductCode: NNNN out of 0001-2032 ("${name}")`);
  }
  const seq3 = Math.floor((unit - 1) / 254);
  const seq = unit - seq3 * 254;

  const fields: DeviceProductCode = {
    year: 2000 + Number(yy),
    month: Number(mm),
    day: Number(dd),
    seq3,
    seq,
    productType,
  };

  // A name can match the shape regex (YY/MM/DD are each just "2 digits" to
  // the regex) while still carrying a year/month/day the codec would never
  // accept — e.g. "3F 250101-0001" (year 2025, one short of the 2026 floor).
  // Route through the same range checks the codec itself enforces so a name
  // that validates here is guaranteed to survive formatDeviceProductCode
  // too, not just the regex.
  const reason = checkFields(fields);
  if (reason) {
    throw new DeviceProductCodeError(reason, `deviceNameToDeviceProductCode: ${reason} ("${name}" -> ${JSON.stringify(fields)})`);
  }

  return fields;
}

export function validateDeviceProductName(name: string): DeviceProductCodeValidationResult {
  try {
    deviceNameToDeviceProductCode(name);
    return { valid: true };
  } catch (e) {
    if (e instanceof DeviceProductCodeError) {
      return { valid: false, reason: e.reason, message: e.message };
    }
    throw e;
  }
}
