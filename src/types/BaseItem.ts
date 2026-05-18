/**
 * RFC-0201 — Canonical baseline item shape produced by
 * `extractDeviceMetadataFromRows` in `v-5.4.0/controller.js` and
 * mirrored from `v-5.2.0/WIDGET/MAIN_VIEW/controller.js
 * ::buildMetadataMapFromCtxData`.
 *
 * This is the un-classified "base" device descriptor that flows from
 * `ctx.data` into `STATE.itemsBase` and downstream into orchestrator
 * items, alarm lookups, and grid rendering.
 *
 * Public API stability: this type is re-exported from `src/index.ts`
 * for TypeScript consumers (v-5.4.0 .ts forks, the showcase, third-
 * party integrations).
 */

/** Domain bucket used for classification (RFC-0111). */
export type BaseItemDomain = 'energy' | 'water' | 'temperature';

/**
 * Canonical baseline device shape — every field returned by
 * `extractDeviceMetadataFromRows`. Numeric telemetry fields can be
 * either a number or `null` because TB delivers them as the latest
 * `[timestamp, value]` pair and the value may be missing.
 */
export interface BaseItem {
  /** Mirrors `entityId` for use as a stable React/DOM key. */
  id: string;
  /** ThingsBoard entity UUID. */
  entityId: string;
  /** Raw entity name from datasource. */
  name: string;
  /** Human-readable label (TB attr `label` falls back to `entityLabel`). */
  label: string;
  /** `label` ?? `entityLabel` ?? `name` — convenience for UI rendering. */
  labelOrName: string;
  /** TB `deviceType` SERVER_SCOPE attribute. */
  deviceType: string;
  /** TB `deviceProfile` (falls back to `deviceType`). */
  deviceProfile: string;
  /** Free-form identifier (e.g., asset tag, store code). */
  identifier: string;
  /** Display name of the central/gateway. */
  centralName: string;
  /** Modbus slave ID (when applicable). */
  slaveId: string | number;
  /** ThingsBoard ID of the parent central asset. */
  centralId: string;
  /** GCDR / TB customer ID. */
  customerId: string;
  /** Owner display name (tenant or store owner). */
  ownerName: string;
  /** GCDR ingestion ID — the canonical key on the GCDR API side. */
  ingestionId: string;
  /** Latest energy consumption value (kWh). */
  consumption: number | string | null;
  /** First non-null of `consumption | pulses | temperature`. */
  val: number | string | null;
  /** Same as `val` — separate field for legacy consumers. */
  value: number | string | null;
  /** Latest water pulses count. */
  pulses: number | string | undefined;
  /** Latest temperature reading (°C). */
  temperature: number | string | undefined;
  /** Raw connection status from TB. */
  connectionStatus: string;
  /** Computed status (online / offline / waiting / weak / etc.). */
  deviceStatus: string;
  /** Domain bucket for classification. */
  domain: BaseItemDomain;
  /** Latest activity timestamp (epoch ms). */
  lastActivityTime: number | string | undefined;
  /** Latest connect timestamp (epoch ms). */
  lastConnectTime: number | string | undefined;
  /**
   * GCDR device UUID — the bridge key between TB devices and the GCDR
   * Alarm/Ticket APIs. Sourced from the TB SERVER_SCOPE attribute
   * `gcdrDeviceId` (with lowercase `gcdrdeviceid` fallback).
   * `null` when the device has no GCDR mapping.
   */
  gcdrDeviceId: string | null;
}
