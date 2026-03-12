/**
 * RFC-0190: User Management Modal — shared types
 */

export interface OpenUserManagementParams {
  /** ThingsBoard customer UUID */
  customerId: string;
  /** ThingsBoard tenant UUID */
  tenantId: string;
  /** Human-readable customer name (shown in modal header) */
  customerName?: string;
  /** JWT token from localStorage */
  jwtToken: string;
  /** ThingsBoard base URL */
  tbBaseUrl: string;
  /** Currently authenticated user */
  currentUser: TBCurrentUser;
}

export interface TBCurrentUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface TBUserId {
  id: string;
  entityType: 'USER';
}

export interface TBUser {
  id: TBUserId;
  tenantId: { id: string; entityType: 'TENANT' };
  customerId: { id: string; entityType: 'CUSTOMER' };
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  authority: 'CUSTOMER_USER' | 'TENANT_ADMIN';
  additionalInfo?: { description?: string; [key: string]: unknown };
  createdTime?: number;
}

export interface TBUserPage {
  data: TBUser[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

export interface UserManagementConfig {
  customerId: string;
  tenantId: string;
  customerName: string;
  jwtToken: string;
  tbBaseUrl: string;
  currentUser: TBCurrentUser;
  onClose: () => void;
}

/** Builds the dynamic tab label: "FIRSTNAME L." — uppercase */
export function buildUserTabLabel(user: TBUser): string {
  const first = (user.firstName || user.email.split('@')[0] || '?').toUpperCase();
  const lastInitial = user.lastName ? user.lastName[0].toUpperCase() + '.' : '';
  return lastInitial ? `${first} ${lastInitial}` : first;
}

/** Returns the full display name of a TB user */
export function buildUserDisplayName(user: TBUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email;
}
