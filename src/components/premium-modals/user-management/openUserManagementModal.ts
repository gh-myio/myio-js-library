import { UserManagementController } from './UserManagementController';
import { OpenUserManagementParams } from './types';

/**
 * RFC-0190 — Opens the User Management premium modal.
 *
 * Restricted to SuperAdmin MYIO users in V1. The caller (MENU controller) is responsible
 * for the access gate; this function does not enforce it.
 *
 * @example
 * ```javascript
 * window.MyIOLibrary.openUserManagementModal({
 *   customerId:   orch?.customerTB_ID || '',
 *   tenantId:     user.tenantId?.id || '',
 *   customerName: orch?.customerName || '',
 *   jwtToken:     localStorage.getItem('jwt_token') || '',
 *   tbBaseUrl:    self.ctx.settings?.tbBaseUrl || '',
 *   currentUser:  { id: user.id?.id, email: user.email,
 *                   firstName: user.firstName, lastName: user.lastName },
 * });
 * ```
 */

function detectTheme(): 'light' | 'dark' {
  if (document.body.classList.contains('dark-mode')) return 'dark';
  if (document.body.classList.contains('light-mode')) return 'light';
  const attr =
    document.documentElement.getAttribute('data-theme') ||
    document.body.getAttribute('data-theme');
  if (attr === 'dark') return 'dark';
  if (attr === 'light') return 'light';
  return 'light';
}

export function openUserManagementModal(params: OpenUserManagementParams): void {
  if (!params.jwtToken) {
    console.warn('[openUserManagementModal] jwtToken is required');
    return;
  }
  if (!params.customerId) {
    console.warn('[openUserManagementModal] customerId is required');
    return;
  }
  const controller = new UserManagementController({
    ...params,
    theme: params.theme ?? detectTheme(),
  });
  controller.show();
}
