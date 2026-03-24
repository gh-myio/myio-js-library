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
  name: string;
  description?: string;
  allow: string[];
  deny: string[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  /** System policies are immutable */
  system?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GCDRRole {
  id: string;
  name: string;
  description?: string;
  /** IDs of associated policies */
  policyIds: string[];
  system?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GCDRAssignment {
  id: string;
  userId: string;
  roleId: string;
  roleKey: string;
  roleDisplayName: string;
  scope: string;
  status: 'active' | 'inactive' | 'expired';
  expiresAt: string | null;
  grantedAt: string;
  grantedBy: string;
  reason: string | null;
}

export interface AssignmentEntry {
  id: string;
  roleKey: string;
  roleDisplayName: string;
  scope: string;
  status: string;
  expiresAt: string | null;
  grantedAt: string;
  grantedBy: string;
  reason: string | null;
}

export interface UserRoleAssignmentsSnapshot {
  updatedAt: string;
  version: number;
  assignments: AssignmentEntry[];
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
