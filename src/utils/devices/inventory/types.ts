/**
 * RFC-0237 — Inventory Panel v2: shared types of the pure inventory logic.
 *
 * Everything in `src/utils/devices/inventory/` is DOM-free and deterministic
 * (time is injected), so the ThingsBoard widget can stay thin and the rules
 * can be tested in Vitest.
 */

import type { DeviceTypeCategory } from '../deviceTypeConfig';

/** One device as loaded by `entitiesQuery/find` and parsed by `parseEntityRow`. */
export interface InventoryDevice {
  id: string;
  name: string;
  label: string | null;
  /** ThingsBoard device profile name (`type` entity field). */
  type: string | null;
  createdTime: number | null;
  ownerName: string | null;
  /** `'CUSTOMER'` or `'TENANT'` (null when the field did not come back). */
  ownerType: string | null;
  /** Resolved from `ownerName` through `/api/customers` (entity field comes back empty). */
  customerId: string | null;
  deviceProfile: string | null;
  identifier: string | null;
  ingestionId: string | null;
  gcdrDeviceId: string | null;
  centralId: string | null;
  slaveId: string | null;
  lifecycleStatus: string | null;
  /** TB `active` server attribute: `true`/`false`, or null when missing. */
  active: boolean | null;
  /** TB `lastActivityTime` server attribute (ms), or null when missing. */
  lastActivityTime: number | null;
  /**
   * false when the page/keys holding the MYIO attributes failed to load —
   * the rules that need them evaluate to `unknown`.
   */
  attributesLoaded: boolean;
}

export type RuleOutcome = 'pass' | 'fail' | 'unknown' | 'notApplicable';
export type RuleAxis = 'cadastro' | 'atividade';
/** `info` rules are reported but never change the Cadastro badge. */
export type RuleSeverity = 'critical' | 'pending' | 'info' | 'inactive';

export type LifecycleStatus = 'active' | 'stock' | 'archived';
export type LegacyLifecycleHint = 'deviceProfile' | 'customerName';

export interface LifecycleResolution {
  status: LifecycleStatus;
  /** Where `status` came from: the `lifecycleStatus` attribute or the default. */
  source: 'attribute' | 'default';
  /** Legacy signal suggesting the device is archived (hint only, never authority). */
  legacyHint: LegacyLifecycleHint | null;
}

export interface RuleResult {
  id: string;
  outcome: RuleOutcome;
}

/** Cadastro badge value. `partial` = no known failure but some applicable rule is unknown. */
export type CadastroLevel = 'ok' | 'pending' | 'critical' | 'partial' | 'excluded';
export type AtividadeLevel = 'ok' | 'inactive' | 'nodata' | 'excluded';

export interface DeviceEvaluation {
  lifecycle: LifecycleResolution;
  results: RuleResult[];
  /** Ids of the rules that failed (in rule order), including `info` rules. */
  failed: string[];
  cadastro: { level: CadastroLevel; partial: boolean };
  atividade: { level: AtividadeLevel; partial: boolean };
}

export type InventoryDomain = DeviceTypeCategory | 'unclassified';

/** A device ready for the list: parsed data + evaluation + presentation helpers. */
export interface InventoryRow {
  device: InventoryDevice;
  evaluation: DeviceEvaluation;
  domain: InventoryDomain;
  /** `deviceProfile` when recognized, otherwise `'Não classificado'`. */
  profileLabel: string;
  /** Group key used by `groupBy: 'customer'` (`'__no_customer__'` for tenant-owned devices). */
  customerKey: string;
}
