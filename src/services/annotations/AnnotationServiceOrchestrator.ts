/**
 * RFC-0203 M2 — AnnotationServiceOrchestrator factory.
 *
 * Builds an in-memory index over `log_annotations` SERVER_SCOPE attributes
 * across ALL devices of a customer (cross-domain). Exposes 3 indices
 * (byIdentifier / byDeviceId / byDomain) to feed the HEADER panel tabs.
 *
 * Mirrors the async-factory pattern of `buildTicketServiceOrchestrator`
 * (RFC-0198, src/components/premium-modals/settings/tickets/TicketServiceOrchestrator.ts).
 *
 * NO localStorage / sessionStorage — annotations may contain PII (LGPD).
 * NO polling, NO websocket — refresh is manual + event-driven.
 *
 * ACs covered by this module: AC-7, AC-8, AC-11, AC-12, AC-13, AC-14.
 * (AC-9 and AC-10 live in CustomerDeviceService.)
 */

import { CustomerDeviceService } from './CustomerDeviceService';
import { parseLogAnnotations } from './parseLogAnnotations';
import type {
  AnnotatedDevice,
  AnnotationDeviceDomain,
  AnnotationFilter,
  AnnotationGroup,
  AnnotationGroupBy,
  AnnotationServiceOrchestratorShape,
  BuildAnnotationServiceOrchestratorParams,
  Annotation,
  AnnotationStatus,
  AnnotationType,
} from './types';

// ============================================================================
// Domain icons / labels (RFC-0203 §4.2/4.3)
// ============================================================================

const DOMAIN_ICONS: Record<AnnotationDeviceDomain, string> = {
  energy: '⚡',
  water: '💧',
  temperature: '🌡️',
  unknown: '·',
};

const DOMAIN_LABELS: Record<AnnotationDeviceDomain, string> = {
  energy: 'Energia',
  water: 'Água',
  temperature: 'Temperatura',
  unknown: 'Indeterminado',
};

const BUCKET_NO_IDENTIFIER = 'Sem Identificador';

// ============================================================================
// Builder (async factory) — AC-7, AC-8
// ============================================================================

/**
 * Async factory. Fetches devices + attributes, parses log_annotations, builds
 * indices, registers the `myio:annotation-changed` listener, and returns the
 * orchestrator object.
 */
/**
 * Returns a logger that always has debug/info/warn/error methods, falling
 * back to `log` (or no-op) for missing ones. Defensive against widget-side
 * loggers like LogHelper that may only expose `log`/`warn`/`error`.
 */
function _normalizeLogger(
  raw?: Partial<Console>
): Pick<Console, 'debug' | 'info' | 'warn' | 'error'> {
  const noop = (): void => {
    /* no-op */
  };
  const log = (raw && (raw as { log?: (...a: unknown[]) => void }).log) || noop;
  return {
    debug: (raw?.debug as (...a: unknown[]) => void) || log,
    info: (raw?.info as (...a: unknown[]) => void) || log,
    warn: (raw?.warn as (...a: unknown[]) => void) || log,
    error: (raw?.error as (...a: unknown[]) => void) || log,
  };
}

export async function buildAnnotationServiceOrchestrator(
  params: BuildAnnotationServiceOrchestratorParams
): Promise<AnnotationServiceOrchestratorShape> {
  // Defensive: callers (e.g. widget controllers using LogHelper) may pass a
  // partial logger missing .debug. Normalize before use to avoid TypeError.
  const logger = _normalizeLogger(params.logger ?? console);
  const cacheTtlMs = params.cacheTtlMs ?? 60_000;

  const client = new CustomerDeviceService({
    customerId: params.customerId,
    tbHost: params.tbHost,
    jwt: params.jwt,
    logger,
  });

  // Mutable state captured in the orchestrator closure.
  const state = {
    devices: [] as AnnotatedDevice[],
    byIdentifier: new Map<string | null, AnnotatedDevice[]>(),
    byDeviceId: new Map<string, AnnotatedDevice>(),
    byDomain: new Map<AnnotationDeviceDomain, AnnotatedDevice[]>(),
    fetchedAt: 0,
    stale: false,
  };

  // ── Internal: fetch + parse + index ───────────────────────────────────────

  async function _fetchAndIndex(): Promise<void> {
    const t0 = Date.now();

    const flatDevices = await client.fetchAllCustomerDevices();
    const deviceIds = flatDevices.map((d) => d.id);
    const attrs = await client.fetchAttributesBatch(deviceIds, [
      'log_annotations',
      'identifier',
    ]);

    const annotated: AnnotatedDevice[] = flatDevices.map((d) => {
      const a = attrs.get(d.id) ?? {};
      const rawAnnotations = (a as Record<string, unknown>)['log_annotations'];
      const identifierRaw = (a as Record<string, unknown>)['identifier'];

      return {
        deviceId: d.id,
        name: d.name,
        label: d.label,
        identifier:
          typeof identifierRaw === 'string' && identifierRaw.length > 0
            ? identifierRaw
            : null,
        domain: _classifyDomain(d.deviceType),
        deviceType: d.deviceType,
        annotations: parseLogAnnotations(rawAnnotations, d.id, logger),
      };
    });

    state.devices = annotated;
    state.byIdentifier = _indexByIdentifier(annotated);
    state.byDeviceId = _indexByDeviceId(annotated);
    state.byDomain = _indexByDomain(annotated);
    state.fetchedAt = Date.now();
    state.stale = false;

    const durationMs = state.fetchedAt - t0;
    logger.debug(
      `[AnnotationServiceOrchestrator] built — ${annotated.length} devices, ` +
        `${_totalAnnotations(annotated)} annotations, ${durationMs}ms`
    );
  }

  // Initial fetch — failures are surfaced (caller decides what to do).
  await _fetchAndIndex();

  // ── Listener: AC-14 — invalidate + refresh on annotation-changed ─────────

  if (typeof window !== 'undefined') {
    window.addEventListener('myio:annotation-changed', (ev: Event) => {
      logger.debug(
        '[AnnotationServiceOrchestrator] myio:annotation-changed received:',
        (ev as CustomEvent).detail
      );
      state.stale = true;
      // Fire-and-forget refresh; consumers can also call refresh() explicitly.
      orchestrator.refresh().catch((err) => {
        logger.warn('[AnnotationServiceOrchestrator] refresh after annotation-changed failed:', err);
      });
    });
  }

  // ── Returned shape ───────────────────────────────────────────────────────

  const orchestrator: AnnotationServiceOrchestratorShape = {
    get devices() {
      return state.devices;
    },
    get byIdentifier() {
      return state.byIdentifier;
    },
    get byDeviceId() {
      return state.byDeviceId;
    },
    get byDomain() {
      return state.byDomain;
    },
    get fetchedAt() {
      return state.fetchedAt;
    },

    // Queries
    getAll: () => state.devices.slice(),
    getByIdentifier: (identifier) => state.byIdentifier.get(identifier)?.slice() ?? [],
    getByDevice: (deviceId) => state.byDeviceId.get(deviceId) ?? null,
    getByDomain: (domain) => state.byDomain.get(domain)?.slice() ?? [],
    getGroups: (groupBy, filter) => _buildGroups(state, groupBy, filter),

    // Counts
    getTotalCount: () => _countNonArchived(state.devices),
    getPendingCount: () =>
      _countWhere(state.devices, (a) => a.status !== 'archived' && a.type === 'pending'),
    getOverdueCount: () =>
      _countWhere(state.devices, (a) => a.status !== 'archived' && _isOverdue(a)),

    // Lifecycle — AC-13
    refresh: async () => {
      await _fetchAndIndex();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('myio:annotations-refreshed', {
            detail: {
              totalCount: _countNonArchived(state.devices),
              durationMs: 0, // already logged inside _fetchAndIndex
            },
          })
        );
      }
    },

    // AC-12 helper — TTL-based staleness
    invalidate: () => {
      state.stale = true;
      // also drop the timestamp so cache-aware consumers see ttl as expired
      state.fetchedAt = Math.min(state.fetchedAt, Date.now() - cacheTtlMs - 1);
    },
  };

  return orchestrator;
}

// ============================================================================
// Indexing helpers
// ============================================================================

function _indexByIdentifier(
  devices: AnnotatedDevice[]
): Map<string | null, AnnotatedDevice[]> {
  const map = new Map<string | null, AnnotatedDevice[]>();
  for (const d of devices) {
    const key: string | null = d.identifier;
    const arr = map.get(key);
    if (arr) arr.push(d);
    else map.set(key, [d]);
  }
  return map;
}

function _indexByDeviceId(devices: AnnotatedDevice[]): Map<string, AnnotatedDevice> {
  const map = new Map<string, AnnotatedDevice>();
  for (const d of devices) map.set(d.deviceId, d);
  return map;
}

function _indexByDomain(
  devices: AnnotatedDevice[]
): Map<AnnotationDeviceDomain, AnnotatedDevice[]> {
  const map = new Map<AnnotationDeviceDomain, AnnotatedDevice[]>();
  for (const d of devices) {
    const arr = map.get(d.domain);
    if (arr) arr.push(d);
    else map.set(d.domain, [d]);
  }
  return map;
}

// ============================================================================
// Domain classification (lightweight; defers to RFC-0111 conventions)
// ============================================================================

/**
 * Lightweight classification keyed off TB deviceType / deviceProfile. The full
 * RFC-0111 classifier lives in `src/utils/deviceInfo.js` and applies many more
 * heuristics — here we only need the broad bucket for the "Por Domínio" tab.
 */
function _classifyDomain(deviceType: string): AnnotationDeviceDomain {
  const t = (deviceType || '').toUpperCase();
  if (!t) return 'unknown';
  if (t.includes('HIDROMETRO') || t.includes('CAIXA_DAGUA') || t === 'TANK') return 'water';
  if (t.includes('TERMOSTATO') || t.includes('TEMP')) return 'temperature';
  // RFC-0111 catch-all: energy is the dominant domain
  if (
    t.includes('3F_MEDIDOR') ||
    t.includes('ENTRADA') ||
    t.includes('RELOGIO') ||
    t.includes('TRAFO') ||
    t.includes('SUBESTACAO') ||
    t.includes('MEDIDOR') ||
    t.includes('CHILLER') ||
    t.includes('FANCOIL') ||
    t.includes('HVAC') ||
    t.includes('AR_CONDICIONADO') ||
    t.includes('BOMBA') ||
    t.includes('ELEVADOR') ||
    t.includes('ESCADA')
  ) {
    return 'energy';
  }
  return 'unknown';
}

// ============================================================================
// Group builder (for tabs) — supports optional filter
// ============================================================================

function _buildGroups(
  state: { devices: AnnotatedDevice[] },
  groupBy: AnnotationGroupBy,
  filter?: AnnotationFilter
): AnnotationGroup[] {
  const filtered = state.devices.map((d) => _applyFilterToDevice(d, filter)).filter(
    (d): d is AnnotatedDevice => d !== null
  );

  const buckets = new Map<string, AnnotatedDevice[]>();

  for (const d of filtered) {
    let key: string;
    if (groupBy === 'identifier') key = d.identifier ?? BUCKET_NO_IDENTIFIER;
    else if (groupBy === 'device') key = d.deviceId;
    else key = d.domain;

    const arr = buckets.get(key);
    if (arr) arr.push(d);
    else buckets.set(key, [d]);
  }

  const groups: AnnotationGroup[] = [];
  for (const [key, devs] of buckets) {
    const annotations = devs.flatMap((d) => d.annotations);
    groups.push({
      key,
      label: _labelForGroup(key, groupBy, devs[0]),
      icon: _iconForGroup(key, groupBy),
      devices: devs,
      totalAnnotations: annotations.length,
      maxImportance: annotations.reduce((acc, a) => Math.max(acc, a.importance || 0), 0),
      mostRecentAt: _maxCreatedAt(annotations),
    });
  }

  return groups;
}

function _applyFilterToDevice(
  device: AnnotatedDevice,
  filter?: AnnotationFilter
): AnnotatedDevice | null {
  if (!filter) {
    // Default: drop archived annotations entirely from the device's array.
    const visible = device.annotations.filter((a) => a.status !== 'archived');
    if (visible.length === 0) return null;
    return { ...device, annotations: visible };
  }

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const visible = device.annotations.filter((a) => {
    // Status filter: empty Set means "all except archived"
    if (filter.statuses.size > 0) {
      if (!filter.statuses.has(a.status)) return false;
    } else if (a.status === 'archived') {
      return false;
    }

    // Type filter
    if (filter.types.size > 0 && !filter.types.has(a.type)) return false;

    // Importance filter
    if (filter.importance.size > 0 && !filter.importance.has(a.importance)) return false;

    // Actionable filter — AC-25 (errata: type === 'pending', not status)
    if (filter.actionableOnly) {
      const isPending = a.type === 'pending' && a.status !== 'archived';
      if (!isPending) return false;
      const hasDue = !!a.dueDate;
      if (hasDue) {
        const dueMs = new Date(a.dueDate as string).getTime();
        if (!(dueMs <= now + sevenDaysMs)) return false;
      }
      // No dueDate AND type === 'pending' AND status !== 'archived' → actionable
    }

    // Search filter — NFD-normalized
    if (filter.searchTerm) {
      const needle = _nfd(filter.searchTerm);
      const haystack = _nfd(
        [a.text, device.identifier ?? '', device.name, device.label].join(' ')
      );
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });

  if (visible.length === 0) return null;
  return { ...device, annotations: visible };
}

function _labelForGroup(
  key: string,
  groupBy: AnnotationGroupBy,
  sample: AnnotatedDevice | undefined
): string {
  if (groupBy === 'identifier') return key;
  if (groupBy === 'device') return sample?.label || sample?.name || key;
  return DOMAIN_LABELS[key as AnnotationDeviceDomain] ?? key;
}

function _iconForGroup(key: string, groupBy: AnnotationGroupBy): string | undefined {
  if (groupBy === 'domain') return DOMAIN_ICONS[key as AnnotationDeviceDomain];
  return undefined;
}

function _maxCreatedAt(annotations: Annotation[]): string | null {
  if (annotations.length === 0) return null;
  let max = annotations[0].createdAt;
  for (let i = 1; i < annotations.length; i++) {
    if (annotations[i].createdAt > max) max = annotations[i].createdAt;
  }
  return max;
}

// ============================================================================
// Count helpers
// ============================================================================

function _countNonArchived(devices: AnnotatedDevice[]): number {
  let n = 0;
  for (const d of devices) {
    for (const a of d.annotations) if (a.status !== 'archived') n++;
  }
  return n;
}

function _countWhere(
  devices: AnnotatedDevice[],
  predicate: (a: Annotation) => boolean
): number {
  let n = 0;
  for (const d of devices) {
    for (const a of d.annotations) if (predicate(a)) n++;
  }
  return n;
}

function _totalAnnotations(devices: AnnotatedDevice[]): number {
  let n = 0;
  for (const d of devices) n += d.annotations.length;
  return n;
}

function _isOverdue(a: Annotation): boolean {
  if (!a.dueDate || a.type !== 'pending') return false;
  const due = new Date(a.dueDate).getTime();
  if (isNaN(due)) return false;
  return due < Date.now();
}

function _nfd(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Re-export the canonical types for consumers using THIS module as the entry
export type {
  Annotation,
  AnnotatedDevice,
  AnnotationDeviceDomain,
  AnnotationFilter,
  AnnotationGroup,
  AnnotationGroupBy,
  AnnotationServiceOrchestratorShape,
  AnnotationStatus,
  AnnotationType,
  BuildAnnotationServiceOrchestratorParams,
} from './types';
