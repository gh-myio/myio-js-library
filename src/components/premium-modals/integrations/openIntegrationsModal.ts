/**
 * RFC-0174: Open Integrations Modal
 *
 * Public API for opening the integrations modal.
 *
 * @example
 * ```typescript
 * import { openIntegrationsModal } from 'myio-js-library';
 *
 * const modal = openIntegrationsModal({
 *   theme: 'dark',
 *   defaultTab: 'chiller',
 *   onClose: () => console.log('Modal closed'),
 * });
 *
 * // Close programmatically
 * modal.close();
 * ```
 */

import { IntegrationsModal } from './IntegrationsModal';
import { IntegrationsModalOptions, IntegrationsModalInstance } from './types';

/**
 * Opens the Integrations Modal with tabs for CHILLER, VRF, and GERADOR iframes.
 *
 * @param options - Modal configuration options
 * @returns Modal instance with close method and event handlers
 */
export function openIntegrationsModal(
  options?: IntegrationsModalOptions
): IntegrationsModalInstance {
  const modal = new IntegrationsModal(options || {});
  return modal.open();
}
