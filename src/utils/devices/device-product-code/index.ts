/**
 * RFC-0230 — Device Product Code: public facade.
 *
 * A dependency-free, headless implementation of MYIO's device factory
 * serial-number scheme (a 4-byte packed bit-field code, `B1.B2.B3.B4`) and
 * its companion canonical device-name format (`PREFIX YYMMDD-NNNN`), with
 * lossless bidirectional conversion, validation, and a versioned codec.
 *
 * Not to be confused with `generateDeviceCode()`/`generateMercosulPlate()`
 * in `../device` — those produce a random, non-decodable, pre-provisioning
 * placeholder ID. This module implements the real, deterministic,
 * decodable factory serial, once a device has actually been manufactured.
 */

import type { DeviceProductCode, DeviceProductCodeFields, DeviceProductCodeValidationResult } from './types';
import { resolveCodec } from './codecs/registry';
import { deviceProductCodeToName, deviceNameToDeviceProductCode, validateDeviceProductName } from './name';

/**
 * Validates raw fields (manufacture date, daily sequence, product type) and
 * returns them as the canonical, immutable `DeviceProductCode` Value Object.
 * The daily sequence itself is caller-supplied — this module does not
 * allocate or persist counters; that is the manufacturing service's
 * responsibility. Round-trips the fields through the active codec's
 * encode/decode pair so the returned object is guaranteed consistent with
 * what `formatDeviceProductCode`/`decodeDeviceProductCode` would produce.
 */
export function encodeDeviceProductCode(fields: DeviceProductCodeFields): DeviceProductCode {
  const codec = resolveCodec();
  return codec.decode(codec.encode(fields));
}

/** Parses a "B1.B2.B3.B4" string into a validated `DeviceProductCode`. */
export function decodeDeviceProductCode(code: string): DeviceProductCode {
  return resolveCodec().decode(code);
}

/** Serializes a `DeviceProductCode` back to the dotted "B1.B2.B3.B4" string. */
export function formatDeviceProductCode(value: DeviceProductCode): string {
  return resolveCodec().encode(value);
}

/** Standalone code validator — does not throw; branch-testable independently of decode. */
export function validateDeviceProductCode(code: string): DeviceProductCodeValidationResult {
  return resolveCodec().validate(code);
}

export { deviceProductCodeToName, deviceNameToDeviceProductCode, validateDeviceProductName };

export type { DeviceProductCode, DeviceProductCodeFields, DeviceProductCodeValidationResult } from './types';
export { DeviceProductCodeError } from './errors';
export type { DeviceProductCodeErrorReason } from './errors';
