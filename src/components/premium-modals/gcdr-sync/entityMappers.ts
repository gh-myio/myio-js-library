/**
 * RFC-0176: GCDR Sync Modal — Entity mappers
 * Maps TB entities to GCDR DTOs for CREATE/UPDATE operations.
 */

import type { TBCustomer, TBAsset, TBDevice, TBServerScopeAttrs, CreateCustomerDto, CreateAssetDto, CreateDeviceDto } from './types';
import { mapAssetType, mapDeviceType } from './typeMapping';

/**
 * Maps a ThingsBoard Customer to a GCDR CreateCustomerDto.
 *
 * @param tbCustomer - The TB customer entity
 * @param gcdrTenantId - The GCDR tenant ID to associate with
 * @param attrs - SERVER_SCOPE attributes (unused currently, reserved for future)
 */
export function mapCustomerToGCDR(
  tbCustomer: TBCustomer,
  _gcdrTenantId?: string,
  _attrs?: TBServerScopeAttrs,
): CreateCustomerDto {
  const name = tbCustomer.title || tbCustomer.name;
  return {
    name,
    type: 'COMPANY',
    externalId: tbCustomer.id.id, // RFC-0176-v2: TB UUID stored in indexed external_id column
    metadata: {
      tbEntityType: 'CUSTOMER',
      tbId: tbCustomer.id.id,
      tbName: tbCustomer.name,
    },
  };
}

/**
 * Maps a ThingsBoard Asset to a GCDR CreateAssetDto.
 *
 * @param tbAsset - The TB asset entity
 * @param parentGcdrCustomerId - GCDR customer ID (required by GCDR)
 * @param parentGcdrAssetId - Optional parent GCDR asset ID (for nested assets)
 */
export function mapAssetToGCDR(
  tbAsset: TBAsset,
  parentGcdrCustomerId: string,
  parentGcdrAssetId?: string,
): CreateAssetDto {
  const name = tbAsset.label || tbAsset.name;
  return {
    name,
    type: mapAssetType(tbAsset.type),
    customerId: parentGcdrCustomerId,
    externalId: tbAsset.id.id, // RFC-0176-v2: forward-compat, external_id column pending RFC-0017
    // Always send parentAssetId explicitly: null when absent so the GCDR API receives
    // JSON null (DB NULL) instead of omitting the key (which the server defaults to '' → UUID error)
    parentAssetId: parentGcdrAssetId || null,
    metadata: {
      tbEntityType: 'ASSET',
      tbId: tbAsset.id.id,
      tbType: tbAsset.type,
      tbName: tbAsset.name,
    },
  };
}

/**
 * Maps a ThingsBoard Device to a GCDR CreateDeviceDto.
 *
 * @param tbDevice - The TB device entity
 * @param attrs - SERVER_SCOPE attributes (may contain deviceType, profile info)
 * @param parentGcdrAssetId - GCDR asset ID where device belongs
 * @param parentGcdrCustomerId - GCDR customer ID
 */
export function mapDeviceToGCDR(
  tbDevice: TBDevice,
  attrs: TBServerScopeAttrs,
  parentGcdrAssetId: string,
  parentGcdrCustomerId: string,
): CreateDeviceDto {
  const name = tbDevice.label || tbDevice.name;
  const tbType = tbDevice.type || (attrs.deviceType as string | undefined);
  const tbProfile = tbDevice.deviceProfileName;

  const dto: CreateDeviceDto = {
    name,
    type: mapDeviceType(tbType, tbProfile),
    externalId: tbDevice.id.id,
    assetId: parentGcdrAssetId,
    customerId: parentGcdrCustomerId,
    metadata: {
      tbEntityType: 'DEVICE',
      tbId: tbDevice.id.id,
      tbType,
      tbProfile,
      tbName: tbDevice.name,
    },
  };

  if (attrs.slaveId)    dto.slaveId    = String(attrs.slaveId);
  if (attrs.centralId)  dto.centralId  = String(attrs.centralId);
  if (attrs.identifier) dto.identifier = String(attrs.identifier);

  return dto;
}
