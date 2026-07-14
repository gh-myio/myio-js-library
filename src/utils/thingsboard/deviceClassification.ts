/**
 * RFC-0209 — single-source device classification & status aggregation.
 *
 * Pure, dependency-injected helpers shared by every dashboard controller
 * (v-5.2.0 / v-5.4.0 / SIM) so the row→device mapping, routing and status
 * aggregation can never silently diverge. No fetch, no DOM, no toast: the
 * caller (controller) owns I/O and decides UI on the typed result/`unknown[]`.
 */
import { getDomainFromDeviceType } from '../devices/deviceItem.js';
import { calculateDeviceStatusMasterRules } from '../devices/deviceStatus.js';
import type { DeviceMeta, ByStatusCounts } from '../../types/device';

/** Minimal domain catalog entry needed here (e.g. `exportMapDomain()` output). */
export interface DomainCatalogEntry {
  valueField?: string;
}
export type DomainCatalog = Record<string, DomainCatalogEntry>;

/** deviceProfile (UPPERCASE) → location, e.g. `parseClassificationEntities().profileIndex`. */
export type ProfileIndex = Record<string, { domain: string; column: string }>;

export interface ExtractDeps {
  /** Domain catalog (provides each domain's primary `valueField`). */
  catalog: DomainCatalog;
  /** Override for domain detection (default: lib getDomainFromDeviceType). */
  getDomain?: (deviceType: string) => string;
  /** Override for status calc (default: lib calculateDeviceStatusMasterRules). */
  calcStatus?: (args: {
    connectionStatus: string;
    telemetryTimestamp: number | null;
    delayMins: number;
    domain: string;
  }) => string;
  /** Inactivity window in minutes (default 1440 = 24h). */
  delayMins?: number;
}

/**
 * Build a DeviceMeta from the TB datasource rows of a SINGLE entity.
 * Order is fixed: detect domain → read the catalog's valueField → read the row by that key.
 */
export function extractDeviceMetadataFromRows(
  rows: any[],
  deps: ExtractDeps,
): DeviceMeta | null {
  if (!rows || rows.length === 0) return null;

  const getDomain = deps.getDomain || getDomainFromDeviceType;
  const calcStatus = deps.calcStatus || calculateDeviceStatusMasterRules;
  const catalog = deps.catalog || {};
  const delayMins = deps.delayMins ?? 1440;

  const firstRow = rows[0] || {};
  const datasource = firstRow.datasource || {};
  const entityId = datasource.entityId;
  const deviceName = datasource.entityName || '';
  const entityLabel = datasource.entityLabel || '';

  const dataKeyValues: Record<string, any> = {};
  const dataKeyTimestamps: Record<string, any> = {};
  for (const row of rows) {
    const keyName = row?.dataKey?.name;
    if (keyName && row.data && row.data.length > 0) {
      const latestData = row.data[row.data.length - 1];
      if (Array.isArray(latestData) && latestData.length >= 2) {
        dataKeyTimestamps[keyName] = latestData[0];
        dataKeyValues[keyName] = latestData[1];
      }
    }
  }

  // deviceProfile é a ÚNICA autoridade (deviceType em desuso, 2026-07-14) — o
  // campo legado é preenchido do profile e o domínio sai do profile.
  const deviceProfile = dataKeyValues['deviceProfile'] || '';
  const deviceType = deviceProfile;
  const connectionStatus = dataKeyValues['connectionStatus'] || 'no_info';

  const domain = getDomain(deviceProfile) || '';
  const valueField = catalog[domain]?.valueField || '';
  const primaryValue = valueField ? dataKeyValues[valueField] ?? null : null;
  const primaryTs = valueField ? dataKeyTimestamps[valueField] ?? null : null;

  const deviceStatus = calcStatus({
    connectionStatus,
    telemetryTimestamp: primaryTs,
    delayMins,
    domain,
  });

  return {
    id: entityId,
    entityId,
    name: deviceName,
    label: dataKeyValues['label'] || entityLabel,
    labelOrName: dataKeyValues['label'] || entityLabel || deviceName,
    deviceType,
    deviceProfile,
    identifier: dataKeyValues['identifier'] || '',
    centralName: dataKeyValues['centralName'] || '',
    slaveId: dataKeyValues['slaveId'] || '',
    centralId: dataKeyValues['centralId'] || '',
    customerId: dataKeyValues['customerId'] || '',
    ownerName: dataKeyValues['ownerName'] || '',
    ingestionId: dataKeyValues['ingestionId'] || '',
    consumption: dataKeyValues['consumption'] || null,
    val: primaryValue,
    value: primaryValue,
    pulses: dataKeyValues['pulses'],
    // Domain-specific raw field via computed key (no domain-word literals).
    ...(valueField && valueField !== 'consumption' && valueField !== 'pulses'
      ? { [valueField]: dataKeyValues[valueField] ?? null }
      : {}),
    connectionStatus,
    deviceStatus,
    domain,
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
  } as DeviceMeta;
}

export interface ClassifyDeps extends ExtractDeps {
  /** REQUIRED — deviceProfile → {domain, column}. No global, no default. */
  profileIndex: ProfileIndex;
  /** Optional: pre-seed empty buckets so every column exists even with no devices. */
  domains?: Array<{ code: string; columns: Array<{ key: string }> }>;
}

export interface ClassifyResult {
  /** byDomainColumn[domain][column] = devices[]. */
  byDomainColumn: Record<string, Record<string, DeviceMeta[]>>;
  /** Devices whose deviceProfile is not in profileIndex (never silently dropped). */
  unknown: DeviceMeta[];
}

/**
 * Group TB rows by entity, extract each device, and route by `profileIndex[deviceProfile]`.
 * Unroutable devices go to `unknown[]` (no fallback bucket).
 */
export function classifyAllDevices(data: any[], deps: ClassifyDeps): ClassifyResult {
  const byDomainColumn: Record<string, Record<string, DeviceMeta[]>> = {};
  for (const d of deps.domains || []) {
    byDomainColumn[d.code] = {};
    for (const c of d.columns) byDomainColumn[d.code][c.key] = [];
  }
  const unknown: DeviceMeta[] = [];

  const deviceRowsMap = new Map<string, any[]>();
  for (const row of data || []) {
    const entityId = row?.datasource?.entityId || row?.datasource?.entity?.id?.id;
    if (!entityId) continue;
    if (!deviceRowsMap.has(entityId)) deviceRowsMap.set(entityId, []);
    deviceRowsMap.get(entityId)!.push(row);
  }

  for (const rows of deviceRowsMap.values()) {
    const device = extractDeviceMetadataFromRows(rows, deps);
    if (!device) continue;
    const profileKey = String(device.deviceProfile || '').trim().toUpperCase();
    const loc = deps.profileIndex?.[profileKey];
    if (loc) {
      (byDomainColumn[loc.domain] ||= {});
      (byDomainColumn[loc.domain][loc.column] ||= []).push(device);
    } else {
      unknown.push(device);
    }
  }

  return { byDomainColumn, unknown };
}

const DEFAULT_ONLINE = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
const DEFAULT_OFFLINE = ['offline', 'no_info'];
const DEFAULT_WAITING = ['waiting', 'not_installed', 'pending'];

/** Aggregate device status counts. Status synonym sets are overridable. */
export function buildByStatusFromDevices(
  devices: DeviceMeta[],
  opts?: { online?: string[]; offline?: string[]; waiting?: string[] },
): ByStatusCounts {
  const ONLINE = opts?.online || DEFAULT_ONLINE;
  const OFFLINE = opts?.offline || DEFAULT_OFFLINE;
  const WAITING = opts?.waiting || DEFAULT_WAITING;

  const byStatus: ByStatusCounts = {
    waiting: 0,
    offline: 0,
    normal: 0,
    alert: 0,
    failure: 0,
    weakConnection: 0,
    standby: 0,
    noConsumption: 0,
  };

  for (const d of devices || []) {
    const status = String(d.deviceStatus || d.connectionStatus || '').toLowerCase();
    const value = Number(d.value || d.val || 0);

    if (WAITING.includes(status)) byStatus.waiting++;
    else if (OFFLINE.includes(status)) byStatus.offline++;
    else if (status === 'alert') byStatus.alert++;
    else if (status === 'failure') byStatus.failure++;
    else if (ONLINE.includes(status) && value === 0) byStatus.noConsumption++;
    else if (ONLINE.includes(status)) byStatus.normal++;
    else byStatus.offline++;
  }

  return byStatus;
}
