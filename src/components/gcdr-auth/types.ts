import type { GCDRAssignment } from '../premium-modals/user-management/types';

export interface AuthConfig {
  /** GCDR API base URL including `/api/v1` suffix (e.g. 'https://gcdr-api.a.myio-bas.com/api/v1') */
  gcdrApiBaseUrl: string;
  /** GCDR API key */
  gcdrApiKey: string;
  /** GCDR tenant ID (X-Tenant-ID header) */
  gcdrTenantId?: string;
  /** ThingsBoard base URL */
  tbBaseUrl: string;
  /** ThingsBoard JWT token */
  jwtToken: string;
  /** Current user email — used for GCDR user lookup */
  currentUserEmail?: string;
  /** Current user ThingsBoard entity UUID */
  currentUserTbId?: string;
  /**
   * Customer UUID.
   * Used to build default scope `customer:{customerId}` and for GCDR user search.
   */
  customerId?: string;
  /**
   * Explicit RBAC scope to filter assignments against.
   * Defaults to `customer:{customerId}` if not provided.
   * Use `'*'` to match only global assignments.
   */
  scope?: string;
  /**
   * Bypass GCDR lookup and grant all permissions.
   * Set `true` for TENANT_ADMIN or MyIO super-admin users.
   */
  allowAll?: boolean;
}

export interface AuthContextSnapshot {
  ready: boolean;
  gcdrUserId: string | null;
  scope: string;
  allowAll: boolean;
  error: string | null;
  assignments: GCDRAssignment[];
}
