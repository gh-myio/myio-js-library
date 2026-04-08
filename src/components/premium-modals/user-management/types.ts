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
  /** Visual theme. Auto-detected from the application if omitted; defaults to 'light'. */
  theme?: 'light' | 'dark';
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
  additionalInfo?: { description?: string; userCredentialsEnabled?: boolean; [key: string]: unknown };
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
  theme?: 'light' | 'dark';
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

// ── GCDR RBAC types (RFC-0197) ───────────────────────────────────────────────

export interface GCDRPolicy {
  id: string;
  key?: string;
  displayName: string;
  description?: string;
  allow: string[];
  deny: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** System policies are immutable */
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GCDRRole {
  id: string;
  key?: string;
  displayName: string;
  description?: string;
  /** Policy keys as returned by the GCDR API (e.g. "policy:alarm-management") */
  policies?: string[];
  /** Legacy field — use `policies` instead */
  policyIds?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GCDRAssignment {
  id: string;
  userId: string;
  /** Role identifier key (e.g. "customer_admin") */
  roleKey: string;
  /** Display name — enriched client-side, not returned by API */
  roleDisplayName?: string;
  scope: string;
  status: 'active' | 'inactive' | 'expired';
  expiresAt: string | null;
  grantedAt: string;
  grantedBy?: string;
  reason?: string | null;
  tenantId?: string;
  createdAt?: string;
}

/** Response shape of GET /authorization/users/:userId/assignments */
export interface UserAssignmentsResponse {
  userId: string;
  assignments: GCDRAssignment[];
}

export interface UserRoleAssignmentsSnapshot {
  updatedAt: string;
  version: number;
  assignments: AssignmentEntry[];
}

export interface GCDRUser {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  status: 'UNVERIFIED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  type: 'INTERNAL' | 'CUSTOMER' | 'PARTNER' | 'SERVICE_ACCOUNT';
  customerId?: string;
  tenantId?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Stored as TB SERVER_SCOPE attribute `gcdrUserConfigs` on each user entity */
export interface GCDRUserConfigs {
  gcdrUserId?: string;
  gcdrStatus?: 'UNVERIFIED' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  gcdrType?: 'INTERNAL' | 'CUSTOMER' | 'PARTNER' | 'SERVICE_ACCOUNT';
  /** ISO timestamp of last successful sync */
  syncedAt?: string;
  /** Total number of sync attempts */
  syncCount?: number;
  lastSyncResult?: 'success' | 'error';
  lastError?: string | null;
  /** First sync timestamp */
  createdAt?: string;
  updatedAt?: string;
}

// ── GCDR Groups / Channels / Notifications types (RFC-0190) ──────────────────

export type GCDRChannelType =
  | 'EMAIL' | 'EMAIL_RELAY' | 'TELEGRAM' | 'WHATSAPP'
  | 'WEBHOOK' | 'SLACK' | 'SMS' | 'TEAMS' | 'CUSTOM';

export type AlarmAction =
  | 'OPEN' | 'ACK' | 'ESCALATE' | 'SNOOZE' | 'CLOSE' | 'STATE_HISTORY';

export type GCDRGroupType = 'USER' | 'DEVICE' | 'ASSET' | 'MIXED';

export interface GCDRGroup {
  id: string;
  customerId: string;
  name: string;
  code: string;
  type: GCDRGroupType;
  purposes: string[];
  memberCount?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface GCDRGroupMember {
  /** UUID of the user/device/asset */
  id: string;
  type: 'USER' | 'DEVICE' | 'ASSET';
  /** Enriched — present for USER members from GET /groups/:id/members */
  name?: string;
  email?: string;
  addedAt?: string;
}

export interface GCDRGroupChannel {
  channel: GCDRChannelType;
  active: boolean;
  /** Destination address: email, chat ID, phone, URL, etc. */
  target?: string;
  config?: Record<string, unknown>;
}

export interface GCDRDispatchEntry {
  channel: GCDRChannelType;
  action: AlarmAction;
  active: boolean;
  escalationDelayMs?: number;
}

export interface CustomerChannel {
  id: string;
  customerId: string;
  channel: GCDRChannelType;
  active: boolean;
  /** Credentials — tokens, SMTP config, API keys */
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
