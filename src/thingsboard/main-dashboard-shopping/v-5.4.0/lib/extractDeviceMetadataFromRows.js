/* global window */

/**
 * RFC-0201 Phase-1 (Pod F0) — extract `extractDeviceMetadataFromRows` from
 * `v-5.4.0/controller.js` into a small importable helper so it can be unit-
 * tested without booting the full ThingsBoard global-script controller.
 *
 * Mirrors the schema returned by `v-5.2.0/WIDGET/MAIN_VIEW/controller.js
 * ::buildMetadataMapFromCtxData` — including the `gcdrDeviceId` field
 * (with lowercase `gcdrdeviceid` fallback, since TB sometimes lowercases
 * the dataKey name).
 *
 * @typedef {import('../../../../types/BaseItem').BaseItem} BaseItem
 *
 * @param {Array<{ datasource?: any, dataKey?: { name?: string }, data?: any[][] }>} rows
 * @returns {BaseItem | null}
 */
export function extractDeviceMetadataFromRows(rows) {
  if (!rows || rows.length === 0) return null;

  const firstRow = rows[0];
  const datasource = firstRow.datasource || {};
  const entityId = datasource.entityId;
  const deviceName = datasource.entityName || '';
  const entityLabel = datasource.entityLabel || '';

  const dataKeyValues = {};
  const dataKeyTimestamps = {};

  for (const row of rows) {
    const keyName = row.dataKey?.name;
    if (keyName && row.data && row.data.length > 0) {
      const latestData = row.data[row.data.length - 1];
      if (Array.isArray(latestData) && latestData.length >= 2) {
        dataKeyTimestamps[keyName] = latestData[0];
        dataKeyValues[keyName] = latestData[1];
      }
    }
  }

  const deviceType = dataKeyValues['deviceType'] || '';
  const deviceProfile = dataKeyValues['deviceProfile'] || deviceType;
  const connectionStatus = dataKeyValues['connectionStatus'] || 'no_info';

  // Domain detection (RFC-0111)
  const isWater = deviceType.toUpperCase().includes('HIDROMETRO');
  const isTemperature = deviceType.toUpperCase().includes('TERMOSTATO');
  const domain = isWater ? 'water' : isTemperature ? 'temperature' : 'energy';

  // Calculate device status
  let deviceStatus = 'offline';
  if (typeof window !== 'undefined' && window.MyIOLibrary?.calculateDeviceStatusMasterRules) {
    const telemetryTs =
      domain === 'energy'
        ? dataKeyTimestamps['consumption']
        : domain === 'water'
        ? dataKeyTimestamps['pulses']
        : dataKeyTimestamps['temperature'];
    deviceStatus = window.MyIOLibrary.calculateDeviceStatusMasterRules({
      connectionStatus,
      telemetryTimestamp: telemetryTs,
      delayMins: 1440,
      domain,
    });
  }

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
    val: dataKeyValues['consumption'] || dataKeyValues['pulses'] || dataKeyValues['temperature'] || null,
    value: dataKeyValues['consumption'] || dataKeyValues['pulses'] || dataKeyValues['temperature'] || null,
    pulses: dataKeyValues['pulses'],
    temperature: dataKeyValues['temperature'],
    connectionStatus,
    deviceStatus,
    domain,
    lastActivityTime: dataKeyValues['lastActivityTime'],
    lastConnectTime: dataKeyValues['lastConnectTime'],
    // RFC-0201 Phase-1 row #1: gcdrDeviceId propagation (case-insensitive
    // — TB sometimes lowercases the dataKey name).
    gcdrDeviceId: dataKeyValues['gcdrDeviceId'] || dataKeyValues['gcdrdeviceid'] || null,
  };
}
