/**
 * RFC-0176: GCDR Sync Modal — Diff Engine (pure, no side effects)
 *
 * Computes a sync plan by comparing the TB entity tree against the current
 * GCDR state. Returns an ordered list of SyncActions.
 */

import type {
  GCDRSyncPlan,
  SyncAction,
  TBCustomer,
  TBAsset,
  TBDevice,
  TBServerScopeAttrs,
  GCDREntity,
  CreateCustomerDto,
  CreateAssetDto,
  CreateDeviceDto,
} from './types';
import { mapCustomerToGCDR, mapAssetToGCDR, mapDeviceToGCDR } from './entityMappers';

export interface TBDataBundle {
  customer: TBCustomer;
  customerAttrs: TBServerScopeAttrs;
  assets: TBAsset[];
  devices: TBDevice[];
  deviceAttrs: Map<string, TBServerScopeAttrs>; // tbDeviceId → attrs
  gcdrTenantId: string;
}

/**
 * Computes a sync plan from TB data and the current GCDR entity lookup.
 *
 * @param tbData - Fetched TB entities and attributes
 * @param gcdrLookup - Map from gcdrId → GCDREntity | null (null = not found in GCDR)
 * @param gcdrCustomerId - The GCDR customer ID (already created or fetched)
 */
export function computeSyncPlan(
  tbData: TBDataBundle,
  gcdrLookup: Map<string, GCDREntity | null>,
): GCDRSyncPlan {
  const actions: SyncAction[] = [];

  // ---- Customer ----
  const customerAction = buildCustomerAction(tbData, gcdrLookup);
  actions.push(customerAction);

  // ---- Assets ----
  for (const asset of tbData.assets) {
    const action = buildAssetAction(asset, tbData, gcdrLookup);
    actions.push(action);
  }

  // ---- Devices ----
  for (const device of tbData.devices) {
    const attrs = tbData.deviceAttrs.get(device.id.id) ?? {};
    const action = buildDeviceAction(device, attrs, tbData, gcdrLookup);
    actions.push(action);
  }

  const toCreate = actions.filter((a) => a.type === 'CREATE').length;
  const toUpdate = actions.filter((a) => a.type === 'UPDATE').length;
  const toSkip = actions.filter((a) => a.type === 'SKIP').length;
  const toRecreate = actions.filter((a) => a.type === 'RECREATE').length;

  return { actions, toCreate, toUpdate, toSkip, toRecreate };
}

// ============================================================================
// Helpers
// ============================================================================

function buildCustomerAction(
  tbData: TBDataBundle,
  gcdrLookup: Map<string, GCDREntity | null>,
): SyncAction {
  const { customer, customerAttrs, gcdrTenantId } = tbData;
  const tbId = customer.id.id;
  const gcdrId = customerAttrs.gcdrId as string | undefined;
  const dto = mapCustomerToGCDR(customer, gcdrTenantId, customerAttrs);

  if (!gcdrId) {
    return { type: 'CREATE', entityKind: 'customer', tbId, tbName: customer.name, dto };
  }

  const gcdrEntity = gcdrLookup.get(gcdrId);
  if (gcdrEntity === null) {
    // gcdrId present in TB but entity not found in GCDR → recreate
    return { type: 'RECREATE', entityKind: 'customer', tbId, tbName: customer.name, gcdrId, dto };
  }
  if (!gcdrEntity) {
    // Not looked up (shouldn't happen) → CREATE
    return { type: 'CREATE', entityKind: 'customer', tbId, tbName: customer.name, dto };
  }

  const changedFields = detectChangedCustomerFields(dto, gcdrEntity);
  if (changedFields.length > 0) {
    return { type: 'UPDATE', entityKind: 'customer', tbId, tbName: customer.name, gcdrId, dto, changedFields };
  }
  return { type: 'SKIP', entityKind: 'customer', tbId, tbName: customer.name, gcdrId };
}

function buildAssetAction(
  asset: TBAsset,
  tbData: TBDataBundle,
  gcdrLookup: Map<string, GCDREntity | null>,
): SyncAction {
  const tbId = asset.id.id;
  const tbName = asset.label || asset.name;
  // We use the customer's gcdrId as parentGcdrCustomerId; actual ID resolved at execution time
  const gcdrId = undefined; // Assets don't have a cached gcdrId in TBDataBundle — handled via attrs separately
  // For the diff engine, we use the customerAttrs as proxy; asset attrs come from assetAttrsMap if available
  // In practice, the controller passes asset attrs in deviceAttrs map (using device key pattern for assets)
  const assetAttrs = (tbData.deviceAttrs.get(tbId) ?? {}) as TBServerScopeAttrs;
  const assetGcdrId = assetAttrs.gcdrId as string | undefined;

  const dto = mapAssetToGCDR(asset, '__placeholder_customer_gcdr_id__');

  if (!assetGcdrId) {
    return { type: 'CREATE', entityKind: 'asset', tbId, tbName, dto };
  }

  const gcdrEntity = gcdrLookup.get(assetGcdrId);
  if (gcdrEntity === null) {
    return { type: 'RECREATE', entityKind: 'asset', tbId, tbName, gcdrId: assetGcdrId, dto };
  }
  if (!gcdrEntity) {
    return { type: 'CREATE', entityKind: 'asset', tbId, tbName, dto };
  }

  const changedFields = detectChangedAssetFields(dto, gcdrEntity);
  if (changedFields.length > 0) {
    return { type: 'UPDATE', entityKind: 'asset', tbId, tbName, gcdrId: assetGcdrId, dto, changedFields };
  }
  return { type: 'SKIP', entityKind: 'asset', tbId, tbName, gcdrId: assetGcdrId };
}

function buildDeviceAction(
  device: TBDevice,
  attrs: TBServerScopeAttrs,
  tbData: TBDataBundle,
  gcdrLookup: Map<string, GCDREntity | null>,
): SyncAction {
  const tbId = device.id.id;
  const tbName = device.label || device.name;
  const deviceGcdrId = attrs.gcdrId as string | undefined;

  const dto = mapDeviceToGCDR(
    device,
    attrs,
    '__placeholder_asset_gcdr_id__',
    '__placeholder_customer_gcdr_id__',
  );

  if (!deviceGcdrId) {
    return { type: 'CREATE', entityKind: 'device', tbId, tbName, dto };
  }

  const gcdrEntity = gcdrLookup.get(deviceGcdrId);
  if (gcdrEntity === null) {
    return { type: 'RECREATE', entityKind: 'device', tbId, tbName, gcdrId: deviceGcdrId, dto };
  }
  if (!gcdrEntity) {
    return { type: 'CREATE', entityKind: 'device', tbId, tbName, dto };
  }

  const changedFields = detectChangedDeviceFields(dto, gcdrEntity);
  if (changedFields.length > 0) {
    return { type: 'UPDATE', entityKind: 'device', tbId, tbName, gcdrId: deviceGcdrId, dto, changedFields };
  }
  return { type: 'SKIP', entityKind: 'device', tbId, tbName, gcdrId: deviceGcdrId };
}

function detectChangedCustomerFields(dto: CreateCustomerDto, gcdr: GCDREntity): string[] {
  const changed: string[] = [];
  if (gcdr.name && gcdr.name !== dto.name) changed.push('name');
  if (gcdr.slug && gcdr.slug !== dto.slug) changed.push('slug');
  return changed;
}

function detectChangedAssetFields(dto: CreateAssetDto, gcdr: GCDREntity): string[] {
  const changed: string[] = [];
  if (gcdr.name && gcdr.name !== dto.name) changed.push('name');
  if (gcdr.type && gcdr.type !== dto.type) changed.push('type');
  if (gcdr.slug && gcdr.slug !== dto.slug) changed.push('slug');
  return changed;
}

function detectChangedDeviceFields(dto: CreateDeviceDto, gcdr: GCDREntity): string[] {
  const changed: string[] = [];
  if (gcdr.name && gcdr.name !== dto.name) changed.push('name');
  if (gcdr.type && gcdr.type !== dto.type) changed.push('type');
  if (gcdr.slug && gcdr.slug !== dto.slug) changed.push('slug');
  return changed;
}
