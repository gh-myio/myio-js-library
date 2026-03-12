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
export function openUserManagementModal(params: OpenUserManagementParams): void {
  if (!params.jwtToken) {
    console.warn('[openUserManagementModal] jwtToken is required');
    return;
  }
  if (!params.customerId) {
    console.warn('[openUserManagementModal] customerId is required');
    return;
  }
  const controller = new UserManagementController(params);
  controller.show();
}
