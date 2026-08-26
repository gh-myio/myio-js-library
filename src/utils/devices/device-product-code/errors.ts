/**
 * RFC-0230 — typed validation/decoding error for the device-product-code module.
 * Failures are a `DeviceProductCodeError` with a `reason` discriminant, not a
 * generic thrown `Error`, so failure branches are individually assertable in tests.
 */

export type DeviceProductCodeErrorReason =
  | 'invalid-code-shape'
  | 'invalid-name-shape'
  | 'year-out-of-range'
  | 'month-out-of-range'
  | 'day-out-of-range'
  | 'seq3-out-of-range'
  | 'seq-out-of-range'
  | 'unit-out-of-range'
  | 'unknown-prefix'
  | 'non-invertible-prefix'
  | 'unsupported-codec-version';

export class DeviceProductCodeError extends Error {
  readonly reason: DeviceProductCodeErrorReason;

  constructor(reason: DeviceProductCodeErrorReason, message: string) {
    super(message);
    this.name = 'DeviceProductCodeError';
    this.reason = reason;
  }
}
