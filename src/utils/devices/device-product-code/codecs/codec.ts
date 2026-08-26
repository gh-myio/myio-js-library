/**
 * RFC-0230 — Codec: the versioning seam. `DEVICE-PRODUCT-CODE-NUMBERING.md`
 * §8 flags that the 4-bit year field exhausts in 2041 and a v3 revision will
 * be required; a future `V3Codec` slots into this same contract without a
 * breaking rewrite of every consumer. This module does not implement v1 at
 * all (legacy/archived per the spec) and does not resolve the v1/v2
 * code-string disambiguation `DEVICE-PRODUCT-CODE-NUMBERING.md` §8 calls its
 * "critical open question" — that is owned by GCDR, not this library.
 */

import type { DeviceProductCode, DeviceProductCodeFields, DeviceProductCodeValidationResult } from '../types';

export interface Codec {
  readonly version: string;
  encode(fields: DeviceProductCodeFields): string;
  decode(code: string): DeviceProductCode;
  validate(code: string): DeviceProductCodeValidationResult;
}
