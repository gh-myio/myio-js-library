/**
 * RFC-0176: GCDR Sync Modal — Write-back GCDR IDs to TB SERVER_SCOPE attributes
 */

const TB_API_BASE = '';

type TBEntityType = 'CUSTOMER' | 'ASSET' | 'DEVICE';

/**
 * Writes the assigned GCDR ID back to a ThingsBoard entity's SERVER_SCOPE attributes.
 *
 * Sets:
 *  - `gcdrId` (universal)
 *  - `gcdrCustomerId` | `gcdrAssetId` | `gcdrDeviceId` (entity-specific)
 *  - `gcdrSyncedAt` (ISO timestamp)
 */
export async function writeGcdrIdToTB(
  entityType: TBEntityType,
  tbId: string,
  gcdrId: string,
  tbJwt: string,
): Promise<void> {
  const entityTypeUrl = entityType === 'CUSTOMER' ? 'CUSTOMER' : entityType === 'ASSET' ? 'ASSET' : 'DEVICE';

  const specificKey =
    entityType === 'CUSTOMER'
      ? 'gcdrCustomerId'
      : entityType === 'ASSET'
        ? 'gcdrAssetId'
        : 'gcdrDeviceId';

  const body: Record<string, string> = {
    gcdrId,
    [specificKey]: gcdrId,
    gcdrSyncedAt: new Date().toISOString(),
  };

  const url = `${TB_API_BASE}/api/plugins/telemetry/${entityTypeUrl}/${tbId}/attributes/SERVER_SCOPE`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${tbJwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to write GCDR ID to TB (${entityType} ${tbId}): HTTP ${response.status} ${text}`);
  }
}
