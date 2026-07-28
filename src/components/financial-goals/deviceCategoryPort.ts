/**
 * RFC-0228 A5a — the **device-category port** (the SEAM), plus test/demo fakes.
 *
 * ── WHY A SEAM (RFC-0228 feedback §5) ─────────────────────────────────────────
 * The management UI (`deviceCategoryPanel.ts`) must NOT be coded against a
 * presumed concrete device HTTP API. The GCDR device `tariffCategory` contract is
 * item **B6** in the RFC-0228 index — it is *not built yet* (other repo). If A5a
 * hard-wired a guessed request/response shape, it would rot the moment B6 lands.
 *
 * So the UI depends only on this small **injectable interface**. B6 later supplies
 * a real implementation (`createHttpDeviceCategoryPort` below is a marked stub that
 * *awaits* the B6 contract). Tests and the showcase use
 * {@link createFakeDeviceCategoryPort} — an in-memory port with the same surface —
 * so the whole component is exercised with **zero** live host calls.
 *
 * ── EXPLICIT CLASSIFICATION (RFC-0207 discipline) ─────────────────────────────
 * A device's category is the **explicit** `tariffCategory` attribute and nothing
 * else. The port never infers a category from a device's name/label, and neither
 * does the UI. A device labeled "Loja 12" with `tariffCategory: null` is
 * **uncategorized** until a human sets the attribute — never auto-`SPECIFIC`.
 *
 * ── VALUE SET ─────────────────────────────────────────────────────────────────
 * The category value is exactly `COMMON_AREA | SPECIFIC | null` (GCDR
 * API-Financial-Goals §6). It maps to the pricing panel's `area_comum`/`lojas`
 * terms through A1's centralized map (`tariffApiAdapter.ts`) — the UI reuses that
 * map and never re-string-matches these tokens.
 *
 * Pure & framework-agnostic: no DOM, no ThingsBoard.
 */

import type { WireCategory } from '../pricing-panel/tariffApiClient';

/**
 * The device tariff category — the explicit attribute B6 stores per device.
 * `COMMON_AREA`/`SPECIFIC` reuse the frozen WIRE category tokens (RFC-0054);
 * `null` means **uncategorized** (excluded from money sums until set).
 */
export type DeviceCategory = WireCategory | null;

/** One device row as the port exposes it to the UI. */
export interface DeviceCategoryRow {
  /** Stable device identifier (GCDR device id). */
  deviceId: string;
  /** Short human code/identifier (e.g. `"SCP-041"`), optional. */
  code?: string;
  /** Human label (e.g. `"Loja 12 — Piso L2"`), optional. Display only — NEVER a
   *  classification input (RFC-0207: category comes from `tariffCategory`, not name). */
  label?: string;
  /** The EXPLICIT category attribute. `null` = uncategorized. */
  tariffCategory: DeviceCategory;
  /** Optimistic-concurrency token echoed back on writes as `expectedVersion`. */
  version?: string;
}

/**
 * The SEAM the UI depends on. B6 (gcdr) implements this over HTTP; tests/demo use
 * {@link createFakeDeviceCategoryPort}. Keeping the interface tiny is deliberate —
 * it is the *entire* contract B6 must satisfy, nothing more.
 */
export interface DeviceCategoryPort {
  /** List a customer's devices (optionally scoped to one money domain). */
  listDevices(args: {
    customerId: string;
    domain?: 'ENERGY' | 'WATER';
  }): Promise<DeviceCategoryRow[]>;

  /**
   * Set (or clear, with `null`) one device's explicit category. `expectedVersion`
   * carries the row's last-seen version for optimistic concurrency; a stale write
   * MUST reject (the UI surfaces the conflict without losing other edits).
   * Returns the updated row (new `version`).
   */
  setCategory(args: {
    deviceId: string;
    category: DeviceCategory;
    expectedVersion?: string;
  }): Promise<DeviceCategoryRow>;

  /**
   * OPTIONAL bulk write. When absent, the UI falls back to N {@link setCategory}
   * calls. Returns a per-device outcome so partial failures surface honestly.
   */
  setCategoryBulk?(args: {
    deviceIds: string[];
    category: DeviceCategory;
  }): Promise<{ updated: number; failed: Array<{ deviceId: string; reason: string }> }>;
}

/** Error a port throws (or resolves-as-failure) on an optimistic-concurrency clash. */
export class DeviceCategoryConflictError extends Error {
  readonly deviceId: string;
  readonly code = 'DEVICE_CATEGORY_VERSION_CONFLICT';
  constructor(deviceId: string, message?: string) {
    super(message || `Version conflict for device ${deviceId}`);
    this.name = 'DeviceCategoryConflictError';
    this.deviceId = deviceId;
  }
}

// ---------------------------------------------------------------------------
// In-memory fake — the ONLY port tests/demo rely on. No HTTP, no host.
// ---------------------------------------------------------------------------

/** Seed row for {@link createFakeDeviceCategoryPort}. */
export interface FakeDeviceSeed {
  deviceId: string;
  code?: string;
  label?: string;
  tariffCategory?: DeviceCategory;
  version?: string;
  /** Optional domain tag so `listDevices({domain})` can filter the fake. */
  domain?: 'ENERGY' | 'WATER';
}

export interface FakeDeviceCategoryPortOptions {
  /**
   * If `true`, the fake exposes `setCategoryBulk`. If `false`/omitted, the bulk
   * method is absent so the UI's N-call fallback path is exercised. Default `true`.
   */
  supportsBulk?: boolean;
  /**
   * Optional latency (ms) injected before each resolve, to exercise loading UX.
   * Default `0` (synchronous microtask).
   */
  latencyMs?: number;
}

interface FakeInternalRow extends DeviceCategoryRow {
  domain?: 'ENERGY' | 'WATER';
  _v: number;
}

/**
 * Build an in-memory {@link DeviceCategoryPort}. Versions are monotonic integers
 * stringified; a `setCategory` whose `expectedVersion` no longer matches rejects
 * with {@link DeviceCategoryConflictError}. Bump a row's version out-of-band via
 * {@link FakeDeviceCategoryPortHandle.bumpVersion} to simulate a concurrent edit.
 */
export interface FakeDeviceCategoryPortHandle extends DeviceCategoryPort {
  /** Read the current in-memory rows (deep-ish copy). */
  snapshot(): DeviceCategoryRow[];
  /** Force a version bump on a device (simulates someone else editing it). */
  bumpVersion(deviceId: string): void;
}

export function createFakeDeviceCategoryPort(
  seed: FakeDeviceSeed[] = [],
  options: FakeDeviceCategoryPortOptions = {}
): FakeDeviceCategoryPortHandle {
  const supportsBulk = options.supportsBulk !== false;
  const latency = Math.max(0, options.latencyMs || 0);

  const rows = new Map<string, FakeInternalRow>();
  for (const s of seed) {
    const v = s.version != null ? Number(s.version) || 0 : 0;
    rows.set(s.deviceId, {
      deviceId: s.deviceId,
      code: s.code,
      label: s.label,
      tariffCategory: s.tariffCategory ?? null,
      version: String(v),
      domain: s.domain,
      _v: v,
    });
  }

  const delay = <T>(value: T): Promise<T> =>
    latency > 0
      ? new Promise((res) => setTimeout(() => res(value), latency))
      : Promise.resolve(value);

  const toRow = (r: FakeInternalRow): DeviceCategoryRow => ({
    deviceId: r.deviceId,
    code: r.code,
    label: r.label,
    tariffCategory: r.tariffCategory,
    version: r.version,
  });

  const port: FakeDeviceCategoryPortHandle = {
    listDevices(args) {
      const list = [...rows.values()]
        .filter((r) => !args.domain || !r.domain || r.domain === args.domain)
        .map(toRow);
      return delay(list);
    },

    setCategory(args) {
      const r = rows.get(args.deviceId);
      if (!r) {
        return Promise.reject(new Error(`Unknown device ${args.deviceId}`));
      }
      if (args.expectedVersion != null && args.expectedVersion !== r.version) {
        return Promise.reject(
          new DeviceCategoryConflictError(
            args.deviceId,
            `Version conflict: expected ${args.expectedVersion}, current ${r.version}`
          )
        );
      }
      r.tariffCategory = args.category;
      r._v += 1;
      r.version = String(r._v);
      return delay(toRow(r));
    },

    snapshot() {
      return [...rows.values()].map(toRow);
    },

    bumpVersion(deviceId) {
      const r = rows.get(deviceId);
      if (!r) return;
      r._v += 1;
      r.version = String(r._v);
    },
  };

  if (supportsBulk) {
    port.setCategoryBulk = (args) => {
      const failed: Array<{ deviceId: string; reason: string }> = [];
      let updated = 0;
      for (const id of args.deviceIds) {
        const r = rows.get(id);
        if (!r) {
          failed.push({ deviceId: id, reason: 'UNKNOWN_DEVICE' });
          continue;
        }
        r.tariffCategory = args.category;
        r._v += 1;
        r.version = String(r._v);
        updated += 1;
      }
      return delay({ updated, failed });
    };
  }

  return port;
}

// ---------------------------------------------------------------------------
// HTTP stub — AWAITS THE B6 CONTRACT. Not used by tests. Not a real client.
// ---------------------------------------------------------------------------

/** Config the future B6-backed HTTP port will need. Shape is provisional. */
export interface HttpDeviceCategoryPortConfig {
  baseUrl: string;
  apiKey?: string;
  jwt?: string;
  tenantId?: string;
  fetchImpl?: typeof fetch;
}

/**
 * ⚠️ **AWAITS B6 CONTRACT — DO NOT RELY ON THIS.** This is a placeholder so callers
 * can see where the real GCDR device-tariffCategory client will plug in. The exact
 * endpoints, RBAC, auditing and bulk semantics are defined by RFC-0228 **B6**
 * (gcdr repo) and are NOT settled here. Until B6 lands, every method throws. Tests
 * and the showcase MUST use {@link createFakeDeviceCategoryPort} instead.
 */
export function createHttpDeviceCategoryPort(
  config: HttpDeviceCategoryPortConfig
): DeviceCategoryPort {
  void config;
  // Reject (don't sync-throw) so consumers awaiting the port see a normal
  // rejection — the interface is Promise-returning end to end.
  const notReady = <T>(): Promise<T> =>
    Promise.reject(
      new Error(
        'createHttpDeviceCategoryPort: the GCDR device tariffCategory API (RFC-0228 B6) ' +
          'is not implemented yet. Inject createFakeDeviceCategoryPort for now, or a real ' +
          'DeviceCategoryPort once B6 ships.'
      )
    );
  return {
    listDevices: () => notReady<DeviceCategoryRow[]>(),
    setCategory: () => notReady<DeviceCategoryRow>(),
  };
}
