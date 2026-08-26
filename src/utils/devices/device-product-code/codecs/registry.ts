/**
 * RFC-0230 — CODEC_REGISTRY + resolveCodec(version?). The forward-compatible
 * seam: once GCDR settles how a v3 code (or a v1/v2 cutover) is
 * distinguished, this module adds that resolution logic in one place
 * without changing every call site. It must not silently guess a scheme —
 * an unsupported version is an explicit, visible error.
 */

import type { Codec } from './codec';
import { V2Codec } from './v2';
import { DeviceProductCodeError } from '../errors';

const CODEC_REGISTRY: Readonly<Record<string, Codec>> = {
  v2: V2Codec,
};

const DEFAULT_VERSION = 'v2';

export function resolveCodec(version?: string): Codec {
  const key = version ?? DEFAULT_VERSION;
  const codec = CODEC_REGISTRY[key];
  if (!codec) {
    throw new DeviceProductCodeError('unsupported-codec-version', `resolveCodec: unsupported version "${key}"`);
  }
  return codec;
}
