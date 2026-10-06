/**
 * RFC-0237 §2 — device lifecycle.
 *
 * Authority: the SERVER_SCOPE attribute `lifecycleStatus` (`active` | `stock` | `archived`),
 * `active` when absent. Legacy encodings found in production (a `deviceProfile`
 * containing `ARQUIVADO`, a customer named with `DESATIVAR`) are returned as a
 * hint only — they never change the status.
 */

import type { InventoryDevice, LifecycleResolution, LifecycleStatus } from './types';

const VALID: ReadonlySet<string> = new Set<LifecycleStatus>(['active', 'stock', 'archived']);

export function resolveLifecycle(device: InventoryDevice): LifecycleResolution {
  const raw = (device.lifecycleStatus || '').trim().toLowerCase();
  const fromAttribute = VALID.has(raw);
  const status = (fromAttribute ? raw : 'active') as LifecycleStatus;

  let legacyHint: LifecycleResolution['legacyHint'] = null;
  if (status === 'active') {
    if (/ARQUIVAD/i.test(device.deviceProfile || '')) legacyHint = 'deviceProfile';
    else if (/DESATIVAR/i.test(device.ownerName || '')) legacyHint = 'customerName';
  }

  return { status, source: fromAttribute ? 'attribute' : 'default', legacyHint };
}
