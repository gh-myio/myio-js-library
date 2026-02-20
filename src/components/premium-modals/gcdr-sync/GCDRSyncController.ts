/**
 * RFC-0176: GCDR Sync Modal — Orchestration Controller
 *
 * Fetch → Diff → Sync loop with progress callbacks.
 * Execution order: Customer → Assets → Devices.
 */

import type {
  GCDRSyncModalParams,
  GCDRSyncPlan,
  GCDRSyncResult,
  SyncAction,
  SyncOutcome,
  GCDREntity,
  TBServerScopeAttrs,
  CreateCustomerDto,
  CreateAssetDto,
  CreateDeviceDto,
} from './types';
import { GCDRApiClient } from './GCDRApiClient';
import {
  fetchCustomer,
  fetchAssets,
  fetchDevices,
  fetchDeviceAssetMap,
  fetchServerScopeAttrs,
  fetchServerScopeAttrsBatch,
} from './TBDataFetcher';
import { computeSyncPlan, type TBDataBundle } from './diffEngine';
import { writeGcdrIdToTB } from './attrWriteback';
import { mapCustomerToGCDR, mapAssetToGCDR, mapDeviceToGCDR } from './entityMappers';

export type { GCDRSyncPlan, GCDRSyncResult };

export class GCDRSyncController {
  private params: GCDRSyncModalParams;
  private gcdrClient: GCDRApiClient;

  constructor(params: GCDRSyncModalParams) {
    this.params = params;
    this.gcdrClient = new GCDRApiClient(params.gcdrTenantId!);
  }

  // ============================================================================
  // Phase 1: Fetch TB data and build sync plan (preview)
  // ============================================================================

  async buildSyncPlan(
    onProgress?: (message: string) => void,
  ): Promise<{ plan: GCDRSyncPlan; bundle: TBDataBundle }> {
    const { thingsboardToken, customerId, gcdrTenantId, concurrency = 5 } = this.params;
    const jwt = thingsboardToken;

    onProgress?.('Carregando dados do ThingsBoard...');

    // Fetch all TB entities
    const [customer, assets, devices] = await Promise.all([
      fetchCustomer(customerId, jwt),
      fetchAssets(customerId, jwt),
      fetchDevices(customerId, jwt),
    ]);

    onProgress?.('Mapeando devices para assets...');
    // Build device→asset map via TB relations (needed to pass correct assetId when creating devices)
    const deviceAssetMap = await fetchDeviceAssetMap(assets.map((a) => a.id.id), jwt, concurrency);

    onProgress?.('Carregando atributos dos dispositivos...');

    // Fetch SERVER_SCOPE attrs for all entities in parallel
    const attrItems: Array<{ entityType: 'CUSTOMER' | 'ASSET' | 'DEVICE'; entityId: string }> = [
      { entityType: 'CUSTOMER', entityId: customerId },
      ...assets.map((a) => ({ entityType: 'ASSET' as const, entityId: a.id.id })),
      ...devices.map((d) => ({ entityType: 'DEVICE' as const, entityId: d.id.id })),
    ];

    const attrsMap = await fetchServerScopeAttrsBatch(attrItems, jwt, concurrency);

    const customerAttrs = attrsMap.get(customerId) ?? {};

    // Build device attrs map (includes asset attrs as well — both keyed by TB ID)
    const deviceAttrs = new Map<string, TBServerScopeAttrs>();
    for (const asset of assets) {
      deviceAttrs.set(asset.id.id, attrsMap.get(asset.id.id) ?? {});
    }
    for (const device of devices) {
      deviceAttrs.set(device.id.id, attrsMap.get(device.id.id) ?? {});
    }

    const bundle: TBDataBundle = {
      customer,
      customerAttrs,
      assets,
      devices,
      deviceAttrs,
      deviceAssetMap,
      gcdrTenantId: gcdrTenantId!,
    };

    onProgress?.('Verificando entidades no GCDR...');

    // Collect all gcdrIds to verify in GCDR
    const gcdrIdsToCheck: string[] = [];
    if (customerAttrs.gcdrId) gcdrIdsToCheck.push(customerAttrs.gcdrId as string);
    for (const [, attrs] of deviceAttrs) {
      if (attrs.gcdrId) gcdrIdsToCheck.push(attrs.gcdrId as string);
    }

    // Build GCDR lookup map
    const gcdrLookup = new Map<string, GCDREntity | null>();
    await Promise.all(
      gcdrIdsToCheck.map(async (gcdrId) => {
        // Try customer, asset, device — we don't know which entity type this gcdrId is
        // So we search by checking which endpoint returns a result
        let entity: GCDREntity | null = null;
        try {
          entity = await this.gcdrClient.getCustomer(gcdrId);
        } catch { /* not a customer */ }
        if (!entity) {
          try {
            entity = await this.gcdrClient.getAsset(gcdrId);
          } catch { /* not an asset */ }
        }
        if (!entity) {
          try {
            entity = await this.gcdrClient.getDevice(gcdrId);
          } catch { /* not a device */ }
        }
        gcdrLookup.set(gcdrId, entity);
      }),
    );

    const plan = computeSyncPlan(bundle, gcdrLookup);
    return { plan, bundle };
  }

  // ============================================================================
  // Phase 2: Execute sync plan
  // ============================================================================

  async runSync(
    bundle: TBDataBundle,
    plan: GCDRSyncPlan,
    onProgress?: (current: number, total: number, entityName: string) => void,
  ): Promise<GCDRSyncResult> {
    const { thingsboardToken } = this.params;
    const jwt = thingsboardToken;

    const succeeded: SyncOutcome[] = [];
    const failed: SyncOutcome[] = [];
    const skipped: SyncOutcome[] = [];

    // Track resolved GCDR IDs for use during execution
    // (customer ID needed by assets, asset IDs needed by devices)
    const resolvedGcdrIds = new Map<string, string>(); // tbId → gcdrId

    // Populate already-known IDs from attrs
    if (bundle.customerAttrs.gcdrId) {
      resolvedGcdrIds.set(bundle.customer.id.id, bundle.customerAttrs.gcdrId as string);
    }
    for (const [tbId, attrs] of bundle.deviceAttrs) {
      if (attrs.gcdrId) {
        resolvedGcdrIds.set(tbId, attrs.gcdrId as string);
      }
    }

    // Sort actions: customer first, then assets, then devices
    const orderedActions = [
      ...plan.actions.filter((a) => a.entityKind === 'customer'),
      ...plan.actions.filter((a) => a.entityKind === 'asset'),
      ...plan.actions.filter((a) => a.entityKind === 'device'),
    ];

    let current = 0;
    const total = orderedActions.filter((a) => a.type !== 'SKIP').length;

    // Track failed CREATE/RECREATE entity TB IDs so dependents can be aborted.
    let customerCreateFailed = false;
    const failedAssetTbIds = new Set<string>(); // assets that failed CREATE/RECREATE

    for (const action of orderedActions) {
      if (action.type === 'SKIP') {
        skipped.push({ action, success: true });
        continue;
      }

      // Abort assets and devices if customer could not be created
      if (customerCreateFailed && (action.entityKind === 'asset' || action.entityKind === 'device')) {
        failed.push({ action, success: false, error: 'Abortado: criação do customer no GCDR falhou' });
        continue;
      }

      // Abort a device if its parent asset failed to be created
      if (action.entityKind === 'device') {
        const parentAssetTbId = bundle.deviceAssetMap.get(action.tbId);
        if (parentAssetTbId && failedAssetTbIds.has(parentAssetTbId)) {
          failed.push({ action, success: false, error: 'Abortado: criação do asset pai no GCDR falhou' });
          continue;
        }
      }

      current++;
      onProgress?.(current, total, action.tbName);

      try {
        const gcdrId = await this.executeAction(action, bundle, resolvedGcdrIds, jwt);
        if (gcdrId) {
          resolvedGcdrIds.set(action.tbId, gcdrId);
        }
        succeeded.push({ action, success: true, gcdrId });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        failed.push({ action, success: false, error });
        if (action.entityKind === 'customer' && (action.type === 'CREATE' || action.type === 'RECREATE')) {
          customerCreateFailed = true;
        }
        if (action.entityKind === 'asset' && (action.type === 'CREATE' || action.type === 'RECREATE')) {
          failedAssetTbIds.add(action.tbId);
        }
      }
    }

    return { succeeded, failed, skipped };
  }

  // ============================================================================
  // Execute individual action
  // ============================================================================

  private async executeAction(
    action: SyncAction,
    bundle: TBDataBundle,
    resolvedGcdrIds: Map<string, string>,
    jwt: string,
  ): Promise<string | undefined> {
    const { entityKind, type, tbId } = action;

    if (type === 'UPDATE') {
      // Update existing entity
      const gcdrId = action.gcdrId!;
      if (entityKind === 'customer') {
        await this.gcdrClient.updateCustomer(gcdrId, action.dto as CreateCustomerDto);
      } else if (entityKind === 'asset') {
        await this.gcdrClient.updateAsset(gcdrId, this.resolveAssetDto(action, bundle, resolvedGcdrIds));
      } else {
        await this.gcdrClient.updateDevice(gcdrId, this.resolveDeviceDto(action, bundle, resolvedGcdrIds));
      }
      return gcdrId;
    }

    if (type === 'CREATE' || type === 'RECREATE') {
      let gcdrEntity: GCDREntity;

      if (entityKind === 'customer') {
        gcdrEntity = await this.gcdrClient.createCustomer(action.dto as CreateCustomerDto);
      } else if (entityKind === 'asset') {
        const dto = this.resolveAssetDto(action, bundle, resolvedGcdrIds);
        gcdrEntity = await this.gcdrClient.createAsset(dto);
      } else {
        const dto = this.resolveDeviceDto(action, bundle, resolvedGcdrIds);
        gcdrEntity = await this.gcdrClient.createDevice(dto);
      }

      const newGcdrId = gcdrEntity.id;

      // Write back to TB
      const tbEntityType = entityKind === 'customer' ? 'CUSTOMER' : entityKind === 'asset' ? 'ASSET' : 'DEVICE';
      await writeGcdrIdToTB(tbEntityType, tbId, newGcdrId, jwt);

      return newGcdrId;
    }

    return undefined;
  }

  // ============================================================================
  // DTO resolution helpers (fill in placeholder IDs with resolved ones)
  // ============================================================================

  private resolveAssetDto(
    action: SyncAction,
    bundle: TBDataBundle,
    resolvedGcdrIds: Map<string, string>,
  ): CreateAssetDto {
    const asset = bundle.assets.find((a) => a.id.id === action.tbId);
    const customerGcdrId = resolvedGcdrIds.get(bundle.customer.id.id) ?? '__unknown_customer__';
    return mapAssetToGCDR(asset!, customerGcdrId, undefined);
  }

  private resolveDeviceDto(
    action: SyncAction,
    bundle: TBDataBundle,
    resolvedGcdrIds: Map<string, string>,
  ): CreateDeviceDto {
    const device = bundle.devices.find((d) => d.id.id === action.tbId);
    const attrs = bundle.deviceAttrs.get(action.tbId) ?? {};
    const customerGcdrId = resolvedGcdrIds.get(bundle.customer.id.id) ?? '__unknown_customer__';

    // Resolve the correct asset for this device via the device→asset map
    const parentAssetTbId = bundle.deviceAssetMap.get(action.tbId);
    const assetGcdrId = parentAssetTbId
      ? (resolvedGcdrIds.get(parentAssetTbId) ?? '__unknown_asset__')
      : '__unknown_asset__';

    return mapDeviceToGCDR(device!, attrs, assetGcdrId, customerGcdrId);
  }
}
