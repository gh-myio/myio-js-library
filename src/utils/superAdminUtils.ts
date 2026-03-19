/**
 * RFC-0104: SuperAdmin Detection Utilities
 *
 * Functions to detect SuperAdmin status for users in the MYIO platform.
 * - SuperAdmin MYIO: Users with @myio.com.br email (except alarme@ and alarmes@)
 * - SuperAdmin Holding: Users with isUserAdmin=true on their customer entity
 */

import type { UserInfo } from '../components/premium-modals/settings/annotations/types';

// ============================================
// FETCH USER INFO
// ============================================

/**
 * Fetch current user information from ThingsBoard API
 * @param jwtToken - Optional JWT token (defaults to localStorage)
 * @returns User info object or null if not authenticated
 */
export async function fetchCurrentUserInfo(jwtToken?: string, tbBaseUrl?: string): Promise<UserInfo | null> {
  const jwt = jwtToken || localStorage.getItem('jwt_token');
  if (!jwt) {
    console.warn('[SuperAdminUtils] No JWT token available');
    return null;
  }

  const base = tbBaseUrl || '';
  try {
    const response = await fetch(`${base}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${jwt}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('[SuperAdminUtils] Failed to fetch user info:', response.status);
      return null;
    }

    const user = await response.json();
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || user.email || 'Unknown User';

    return {
      id: user.id?.id || user.id || '',
      email: user.email || '',
      name,
    };
  } catch (error) {
    console.error('[SuperAdminUtils] Error fetching user info:', error);
    return null;
  }
}

// ============================================
// SUPERADMIN MYIO DETECTION
// ============================================

/**
 * Detect if current user is a SuperAdmin MYIO
 * SuperAdmin MYIO = user with @myio.com.br email EXCEPT alarme@ or alarmes@
 *
 * @param jwtToken - Optional JWT token (defaults to localStorage)
 * @returns Promise<boolean> - true if user is SuperAdmin MYIO
 *
 * @example
 * ```typescript
 * const isSuperAdmin = await detectSuperAdminMyio();
 * if (isSuperAdmin) {
 *   // Show admin-only features
 * }
 * ```
 */
export async function detectSuperAdminMyio(jwtToken?: string, tbBaseUrl?: string): Promise<boolean> {
  const jwt = jwtToken || localStorage.getItem('jwt_token');
  if (!jwt) {
    console.warn('[SuperAdminUtils] detectSuperAdminMyio: No JWT token');
    return false;
  }

  const base = tbBaseUrl || '';
  try {
    const response = await fetch(`${base}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${jwt}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn('[SuperAdminUtils] detectSuperAdminMyio: API error', response.status);
      return false;
    }

    const user = await response.json();
    const email = (user.email || '').toLowerCase().trim();

    // Check: email ends with @myio.com.br AND is NOT alarme@ or alarmes@
    const isSuperAdmin =
      email.endsWith('@myio.com.br') &&
      !email.startsWith('alarme@') &&
      !email.startsWith('alarmes@');

    console.log(`[SuperAdminUtils] detectSuperAdminMyio: ${email} -> ${isSuperAdmin}`);
    return isSuperAdmin;
  } catch (error) {
    console.error('[SuperAdminUtils] detectSuperAdminMyio error:', error);
    return false;
  }
}

// ============================================
// SUPERADMIN HOLDING DETECTION
// ============================================

/**
 * Detect if current user is a SuperAdmin Holding
 * SuperAdmin Holding = user with isUserAdmin=true attribute on their customer entity
 *
 * @param customerId - The customer/tenant ID to check
 * @param jwtToken - Optional JWT token (defaults to localStorage)
 * @returns Promise<boolean> - true if user is SuperAdmin Holding
 *
 * @example
 * ```typescript
 * const isHoldingAdmin = await detectSuperAdminHolding('customer-uuid');
 * if (isHoldingAdmin) {
 *   // Show holding admin features
 * }
 * ```
 */
export async function detectSuperAdminHolding(
  customerId: string,
  jwtToken?: string,
  tbBaseUrl?: string
): Promise<boolean> {
  if (!customerId) {
    console.warn('[SuperAdminUtils] detectSuperAdminHolding: No customerId provided');
    return false;
  }

  const jwt = jwtToken || localStorage.getItem('jwt_token');
  if (!jwt) {
    console.warn('[SuperAdminUtils] detectSuperAdminHolding: No JWT token');
    return false;
  }

  const base = tbBaseUrl || '';
  try {
    const response = await fetch(
      `${base}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${jwt}`,
        },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      console.warn('[SuperAdminUtils] detectSuperAdminHolding: API error', response.status);
      return false;
    }

    const attributes = await response.json();
    const isUserAdminAttr = attributes.find(
      (attr: { key: string; value: unknown }) => attr.key === 'isUserAdmin'
    );

    const isAdmin = isUserAdminAttr?.value === true || isUserAdminAttr?.value === 'true';
    console.log(`[SuperAdminUtils] detectSuperAdminHolding: customerId=${customerId} -> ${isAdmin}`);
    return isAdmin;
  } catch (error) {
    console.error('[SuperAdminUtils] detectSuperAdminHolding error:', error);
    return false;
  }
}

// ============================================
// COMBINED PERMISSION CHECK
// ============================================

/**
 * Get full permission set for the current user
 *
 * @param customerId - The customer/tenant ID for holding admin check
 * @param jwtToken - Optional JWT token (defaults to localStorage)
 * @returns Permission set with user info and admin flags
 *
 * @example
 * ```typescript
 * const permissions = await getAnnotationPermissions('customer-uuid');
 * if (permissions.isSuperAdminMyio || permissions.isSuperAdminHolding) {
 *   // Can edit any annotation
 * }
 * ```
 */
export async function getAnnotationPermissions(
  customerId?: string,
  jwtToken?: string,
  tbBaseUrl?: string
): Promise<{
  currentUser: UserInfo | null;
  isSuperAdminMyio: boolean;
  isSuperAdminHolding: boolean;
}> {
  const [currentUser, isSuperAdminMyio, isSuperAdminHolding] = await Promise.all([
    fetchCurrentUserInfo(jwtToken, tbBaseUrl),
    detectSuperAdminMyio(jwtToken, tbBaseUrl),
    customerId ? detectSuperAdminHolding(customerId, jwtToken, tbBaseUrl) : Promise.resolve(false),
  ]);

  return {
    currentUser,
    isSuperAdminMyio,
    isSuperAdminHolding,
  };
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if user can modify a specific annotation
 *
 * @param annotation - The annotation to check
 * @param permissions - The permission set for current user
 * @returns boolean - true if user can edit/archive the annotation
 */
export function canModifyAnnotation(
  annotation: { createdBy: UserInfo },
  permissions: {
    currentUser: UserInfo | null;
    isSuperAdminMyio: boolean;
    isSuperAdminHolding: boolean;
  }
): boolean {
  // SuperAdmin MYIO can modify anything
  if (permissions.isSuperAdminMyio) return true;

  // SuperAdmin Holding can modify within tenant
  if (permissions.isSuperAdminHolding) return true;

  // Regular users can only modify their own
  if (!permissions.currentUser) return false;
  return annotation.createdBy.email === permissions.currentUser.email;
}
