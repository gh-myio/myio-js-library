/**
 * RFC-0230 — Value Object + field types for the device product-code scheme.
 */

import type { DeviceProductCodeErrorReason } from './errors';

/**
 * Immutable Value Object decoded from (or destined to be encoded into) a
 * device product code. Single point of truth: both `formatDeviceProductCode`
 * and `deviceProductCodeToName` are pure projections of this shape, which is
 * what makes the round-trip invariant (`decode(encode(x)) === x`, both
 * directions) meaningfully testable.
 */
export interface DeviceProductCode {
  /** Calendar year, 2026-2041 (the v2 scheme's 4-bit year field ceiling). */
  readonly year: number;
  /** Calendar month, 1-12. */
  readonly month: number;
  /** Day of month, 1-31. Calendar-impossible dates (e.g. Feb 30) are not rejected here. */
  readonly day: number;
  /** Secondary/block sequential, 0-7. */
  readonly seq3: number;
  /** Daily sequential, 1-254 (0 and 255 are reserved). */
  readonly seq: number;
  /** Product-type byte (B4) — looked up in `productTypeRegistry`. */
  readonly productType: number;
}

/**
 * Caller-supplied fields for `encodeDeviceProductCode`. The daily sequence
 * itself is caller-supplied — this module does not allocate or persist
 * counters; that is the manufacturing service's responsibility.
 */
export type DeviceProductCodeFields = DeviceProductCode;

export interface DeviceProductCodeValidationResult {
  readonly valid: boolean;
  readonly reason?: DeviceProductCodeErrorReason;
  readonly message?: string;
}
