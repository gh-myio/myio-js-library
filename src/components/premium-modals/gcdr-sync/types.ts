/**
 * RFC-0176: GCDR Sync Modal — Type definitions
 */

// ============================================================================
// Modal Parameters
// ============================================================================

export interface GCDRSyncModalParams {
  /** ThingsBoard JWT token (from localStorage.jwt_token) */
  thingsboardToken: string;

  /** GCDR Tenant ID (from customer SERVER_SCOPE attr `gcdrTenantId`) */
  gcdrTenantId: string | null;

  /** ThingsBoard Customer ID to sync (root customer) */
  customerId: string;

  /** Theme mode (optional) */
  themeMode?: 'light' | 'dark';

  /** Max concurrent GCDR API calls (default: 5) */
  concurrency?: number;

  /** Callback after sync completes */
  onSync?: (result: GCDRSyncResult) => void;

  /** Callback when modal is closed */
  onClose?: () => void;
}

// ============================================================================
// Sync Plan & Actions
// ============================================================================

export type SyncActionType = 'CREATE' | 'UPDATE' | 'SKIP' | 'RECREATE';

export interface SyncAction {
  type: SyncActionType;
  entityKind: 'customer' | 'asset' | 'device';
  tbId: string;
  tbName: string;
  gcdrId?: string;
  /** For CREATE/RECREATE: mapped DTO to send to GCDR */
  dto?: CreateCustomerDto | CreateAssetDto | CreateDeviceDto;
  /** Fields that differ (for UPDATE) */
  changedFields?: string[];
}

export interface GCDRSyncPlan {
  actions: SyncAction[];
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  toRecreate: number;
}

export interface SyncOutcome {
  action: SyncAction;
  success: boolean;
  gcdrId?: string;
  error?: string;
}

export interface GCDRSyncResult {
  succeeded: SyncOutcome[];
  failed: SyncOutcome[];
  skipped: SyncOutcome[];
}

// ============================================================================
// GCDR DTOs
// ============================================================================

export interface CreateCustomerDto {
  name: string;
  type: string; // "COMPANY" — tenantId comes from X-Tenant-Id header, not body
  metadata?: Record<string, unknown>;
}

export interface CreateAssetDto {
  name: string;
  type: string;
  customerId: string; // GCDR customer ID (from create response)
  parentAssetId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDeviceDto {
  name: string;
  type: string;
  externalId?: string; // TB device ID (externalId exists for devices only)
  assetId: string;
  customerId: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ThingsBoard Entities
// ============================================================================

export interface TbEntityId {
  entityType: string;
  id: string;
}

export interface TBCustomer {
  id: TbEntityId;
  name: string;
  title?: string;
  email?: string;
  createdTime?: number;
  parentCustomerId?: TbEntityId | null;
  additionalInfo?: Record<string, unknown>;
}

export interface TBAsset {
  id: TbEntityId;
  name: string;
  type?: string;
  label?: string;
  createdTime?: number;
  customerId?: TbEntityId;
  additionalInfo?: Record<string, unknown>;
}

export interface TBDevice {
  id: TbEntityId;
  name: string;
  type?: string;
  label?: string;
  createdTime?: number;
  deviceProfileName?: string;
  customerId?: TbEntityId;
  additionalInfo?: Record<string, unknown>;
}

export interface TBServerScopeAttrs {
  [key: string]: unknown;
  gcdrId?: string;
  gcdrCustomerId?: string;
  gcdrAssetId?: string;
  gcdrDeviceId?: string;
  gcdrSyncedAt?: string;
  gcdrTenantId?: string;
}

// ============================================================================
// GCDR Entities (returned by GCDR API)
// ============================================================================

export interface GCDREntity {
  id: string;
  name: string;
  slug: string;
  externalId?: string;
  type?: string;
  customerId?: string;
  parentAssetId?: string;
  assetId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Progress
// ============================================================================

export type ProgressCallback = (current: number, total: number, entityName: string) => void;
