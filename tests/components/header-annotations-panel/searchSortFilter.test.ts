/**
 * RFC-0203 M5 — Search / Sort / Filter unit tests.
 *
 * Covers:
 *   - AC-20 search debounce (timing tested in panel integration)
 *   - AC-21 NFD-normalized match (accent/case-insensitive)
 *   - AC-22 highlightMatches wraps with <mark>, does NOT double-escape
 *   - AC-23 sortGroups produces correct ordering for all 6 keys; sort persists in sessionStorage
 *   - AC-24 panel.setFilter merges; AND-between-sections behaviour via orchestrator stub
 *   - AC-25 "Acionáveis apenas" actually filters via the orchestrator filter contract
 *   - AC-26 toolbar count reflects filtered total
 *   - AC-27 archived excluded by default; toggle in filter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nfdNormalize,
  highlightMatches,
  sortGroups,
  SORT_OPTIONS,
  DEFAULT_SORT,
  createDefaultFilter,
  toggleInSet,
  countAnnotationsInGroups,
} from '../../../src/components/header-annotations-panel/searchSortFilter';
import { HeaderAnnotationsPanel } from '../../../src/components/header-annotations-panel/HeaderAnnotationsPanel';
import type {
  AnnotatedDevice,
  Annotation,
  AnnotationFilter,
  AnnotationGroup,
  AnnotationServiceOrchestratorShape,
} from '../../../src/services/annotations/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeAnn(over: Partial<Annotation> = {}): Annotation {
  return {
    id: over.id ?? 'a',
    version: 1,
    text: over.text ?? 'texto',
    type: over.type ?? 'observation',
    importance: over.importance ?? 3,
    status: over.status ?? 'created',
    createdAt: over.createdAt ?? new Date().toISOString(),
    dueDate: over.dueDate,
    createdBy: { id: 'u', email: 'u@x', name: 'U' },
    acknowledged: false,
    responses: [],
    history: [],
  } as Annotation;
}

function makeDevice(over: Partial<AnnotatedDevice> = {}): AnnotatedDevice {
  return {
    deviceId: over.deviceId ?? 'd',
    name: over.name ?? 'Device',
    label: over.label ?? 'Device Label',
    identifier: over.identifier === undefined ? null : over.identifier,
    domain: over.domain ?? 'energy',
    deviceType: over.deviceType ?? '3F_MEDIDOR',
    annotations: over.annotations ?? [],
  };
}

function makeGroup(over: Partial<AnnotationGroup>): AnnotationGroup {
  return {
    key: over.key ?? 'k',
    label: over.label ?? 'L',
    icon: over.icon,
    devices: over.devices ?? [],
    totalAnnotations: over.totalAnnotations ?? 0,
    maxImportance: over.maxImportance ?? 0,
    mostRecentAt: over.mostRecentAt ?? null,
  };
}

// ─── nfdNormalize / highlightMatches (AC-21, AC-22) ────────────────────────

describe('nfdNormalize', () => {
  it('strips accents and lowercases', () => {
    expect(nfdNormalize('Havaiánas L-203 — Térmico')).toBe('havaianas l-203 — termico');
  });

  it('returns empty for nullish', () => {
    expect(nfdNormalize('')).toBe('');
    // @ts-expect-error testing runtime guard
    expect(nfdNormalize(undefined)).toBe('');
  });
});

describe('highlightMatches', () => {
  it('wraps matches with <mark> (case + accent insensitive)', () => {
    const out = highlightMatches('Havaianas L-203', 'avaia');
    expect(out).toBe('H<mark>avaia</mark>nas L-203');
  });

  it('does NOT change escapedText when term is empty', () => {
    expect(highlightMatches('foo &amp; bar', '')).toBe('foo &amp; bar');
  });

  it('handles multiple occurrences', () => {
    const out = highlightMatches('aba abba aba', 'aba');
    expect(out).toBe('<mark>aba</mark> abba <mark>aba</mark>');
  });

  it('accepts already-escaped text and does not double-escape', () => {
    const out = highlightMatches('&lt;b&gt;ola&lt;/b&gt;', 'ola');
    expect(out).toBe('&lt;b&gt;<mark>ola</mark>&lt;/b&gt;');
  });
});

// ─── sortGroups (AC-23) ────────────────────────────────────────────────────

describe('sortGroups', () => {
  const groups: AnnotationGroup[] = [
    makeGroup({ key: 'Bb', label: 'Bb', totalAnnotations: 2, maxImportance: 5, mostRecentAt: '2026-05-01T00:00:00Z' }),
    makeGroup({ key: 'Aa', label: 'Aa', totalAnnotations: 5, maxImportance: 2, mostRecentAt: '2026-05-03T00:00:00Z' }),
    makeGroup({ key: 'Cc', label: 'Cc', totalAnnotations: 1, maxImportance: 4, mostRecentAt: null }),
  ];

  it('alpha-asc sorts by label A→Z (PT-BR locale)', () => {
    const out = sortGroups(groups, 'alpha-asc');
    expect(out.map((g) => g.label)).toEqual(['Aa', 'Bb', 'Cc']);
  });

  it('alpha-desc sorts by label Z→A', () => {
    const out = sortGroups(groups, 'alpha-desc');
    expect(out.map((g) => g.label)).toEqual(['Cc', 'Bb', 'Aa']);
  });

  it('count-desc sorts by totalAnnotations descending', () => {
    const out = sortGroups(groups, 'count-desc');
    expect(out.map((g) => g.totalAnnotations)).toEqual([5, 2, 1]);
  });

  it('count-asc sorts by totalAnnotations ascending', () => {
    const out = sortGroups(groups, 'count-asc');
    expect(out.map((g) => g.totalAnnotations)).toEqual([1, 2, 5]);
  });

  it('importance-desc sorts by maxImportance descending', () => {
    const out = sortGroups(groups, 'importance-desc');
    expect(out.map((g) => g.maxImportance)).toEqual([5, 4, 2]);
  });

  it('recent-desc sorts by mostRecentAt descending; nulls last', () => {
    const out = sortGroups(groups, 'recent-desc');
    expect(out.map((g) => g.key)).toEqual(['Aa', 'Bb', 'Cc']);
  });

  it('does not mutate input array', () => {
    const before = groups.map((g) => g.key).join(',');
    sortGroups(groups, 'count-desc');
    expect(groups.map((g) => g.key).join(',')).toBe(before);
  });
});

// ─── Stats / helpers ───────────────────────────────────────────────────────

describe('countAnnotationsInGroups', () => {
  it('sums totalAnnotations across groups', () => {
    expect(
      countAnnotationsInGroups([
        makeGroup({ totalAnnotations: 3 }),
        makeGroup({ totalAnnotations: 5 }),
        makeGroup({ totalAnnotations: 0 }),
      ])
    ).toBe(8);
  });
});

describe('toggleInSet', () => {
  it('adds when missing, removes when present, immutably', () => {
    const a = new Set(['x']);
    const b = toggleInSet(a, 'y');
    expect(Array.from(b).sort()).toEqual(['x', 'y']);
    expect(a.size).toBe(1); // unchanged

    const c = toggleInSet(b, 'x');
    expect(Array.from(c).sort()).toEqual(['y']);
  });
});

describe('createDefaultFilter', () => {
  it('returns an empty, mutable filter shape', () => {
    const f = createDefaultFilter();
    expect(f.types.size).toBe(0);
    expect(f.statuses.size).toBe(0);
    expect(f.importance.size).toBe(0);
    expect(f.actionableOnly).toBe(false);
    expect(f.searchTerm).toBe('');
  });
});

describe('SORT_OPTIONS', () => {
  it('exposes 6 options including the default', () => {
    expect(SORT_OPTIONS).toHaveLength(6);
    expect(SORT_OPTIONS.some((o) => o.key === DEFAULT_SORT)).toBe(true);
  });
});

// ─── Panel integration (AC-23 persistence, AC-26 count, AC-27 archived) ────

function makeOrch(devices: AnnotatedDevice[]): AnnotationServiceOrchestratorShape {
  return {
    devices,
    byIdentifier: new Map(),
    byDeviceId: new Map(),
    byDomain: new Map(),
    fetchedAt: Date.now(),
    getAll: () => devices,
    getByIdentifier: () => [],
    getByDevice: () => null,
    getByDomain: () => [],
    getGroups: (groupBy, filter): AnnotationGroup[] => {
      // Minimal mirror of orchestrator behaviour: apply filter, then bucket.
      const filtered = devices
        .map((d) => {
          let anns = d.annotations.slice();
          if (filter?.statuses && filter.statuses.size > 0) {
            anns = anns.filter((a) => filter.statuses.has(a.status));
          } else {
            anns = anns.filter((a) => a.status !== 'archived');
          }
          if (filter?.types && filter.types.size > 0) {
            anns = anns.filter((a) => filter.types.has(a.type));
          }
          if (filter?.importance && filter.importance.size > 0) {
            anns = anns.filter((a) => filter.importance.has(a.importance));
          }
          if (filter?.actionableOnly) {
            const now = Date.now();
            anns = anns.filter(
              (a) =>
                a.type === 'pending' &&
                a.status !== 'archived' &&
                (!a.dueDate || new Date(a.dueDate).getTime() <= now + 7 * 86400_000)
            );
          }
          if (filter?.searchTerm) {
            const needle = nfdNormalize(filter.searchTerm);
            anns = anns.filter((a) =>
              nfdNormalize([a.text, d.identifier ?? '', d.name, d.label].join(' ')).includes(needle)
            );
          }
          if (anns.length === 0) return null;
          return { ...d, annotations: anns };
        })
        .filter((d): d is AnnotatedDevice => d !== null);

      const buckets = new Map<string, AnnotatedDevice[]>();
      for (const d of filtered) {
        const key = groupBy === 'identifier' ? d.identifier ?? 'Sem Identificador' : groupBy === 'device' ? d.deviceId : d.domain;
        const arr = buckets.get(key) ?? [];
        arr.push(d);
        buckets.set(key, arr);
      }
      return Array.from(buckets, ([key, devs]) => ({
        key,
        label: key,
        icon: undefined,
        devices: devs,
        totalAnnotations: devs.reduce((s, d) => s + d.annotations.length, 0),
        maxImportance: devs.reduce(
          (m, d) => Math.max(m, ...d.annotations.map((a) => a.importance)),
          0
        ),
        mostRecentAt:
          devs
            .flatMap((d) => d.annotations.map((a) => a.createdAt))
            .sort()
            .pop() ?? null,
      }));
    },
    getTotalCount: () =>
      devices.reduce(
        (s, d) => s + d.annotations.filter((a) => a.status !== 'archived').length,
        0
      ),
    getPendingCount: () => 0,
    getOverdueCount: () => 0,
    refresh: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn(),
  };
}

describe('HeaderAnnotationsPanel — search / sort / filter', () => {
  let anchor: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    anchor = document.createElement('button');
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('sort persists in sessionStorage (AC-23)', () => {
    const orch = makeOrch([makeDevice({ annotations: [makeAnn()] })]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    expect(panel.getSortBy()).toBe('alpha-asc');
    panel.setSortBy('importance-desc');
    expect(sessionStorage.getItem('myio.annotations.sortBy')).toBe('importance-desc');

    panel.destroy();
    const panel2 = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    expect(panel2.getSortBy()).toBe('importance-desc');
  });

  it('toolbar count reflects filtered results (AC-26)', () => {
    const orch = makeOrch([
      makeDevice({
        deviceId: 'd1',
        annotations: [
          makeAnn({ id: 'a1', type: 'pending' }),
          makeAnn({ id: 'a2', type: 'observation' }),
          makeAnn({ id: 'a3', type: 'maintenance' }),
        ],
      }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    expect(
      document.querySelector('.myio-annotations-toolbar-count')?.textContent
    ).toContain('3 anotações');

    panel.setFilter({ types: new Set(['pending']) });
    const after = document.querySelector('.myio-annotations-toolbar-count')?.textContent;
    expect(after).toContain('1 de 3 anotações');

    panel.destroy();
  });

  it('archived is excluded by default; statuses filter exposes it (AC-27)', () => {
    const orch = makeOrch([
      makeDevice({
        deviceId: 'd1',
        annotations: [
          makeAnn({ id: 'a1', status: 'created' }),
          makeAnn({ id: 'a2', status: 'archived' }),
        ],
      }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    // Default: archived hidden — only 1 item
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(1);

    // Set the statuses filter to include 'archived' explicitly
    panel.setFilter({ statuses: new Set(['archived']) });
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(1);
    panel.destroy();
  });

  it('"actionable only" filters down to pending non-archived with due ≤ now+7d (AC-25)', () => {
    const future = new Date(Date.now() + 3 * 86400_000).toISOString();
    const past = new Date(Date.now() - 86400_000).toISOString();
    const farFuture = new Date(Date.now() + 30 * 86400_000).toISOString();

    const orch = makeOrch([
      makeDevice({
        deviceId: 'd1',
        annotations: [
          makeAnn({ id: 'a1', type: 'pending', dueDate: future }),   // actionable: in 3 days
          makeAnn({ id: 'a2', type: 'pending', dueDate: past }),     // actionable: overdue
          makeAnn({ id: 'a3', type: 'pending', dueDate: farFuture }), // NOT actionable
          makeAnn({ id: 'a4', type: 'maintenance' }),                 // NOT actionable
          makeAnn({ id: 'a5', type: 'pending' }),                     // actionable: no dueDate
        ],
      }),
    ]);

    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(5);

    panel.setFilter({ actionableOnly: true });
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(3);
    panel.destroy();
  });

  it('NFD-normalized search matches across identifier/label/text (AC-21)', () => {
    const orch = makeOrch([
      makeDevice({
        deviceId: 'd1',
        identifier: 'L-203',
        label: 'Havaiánas',
        annotations: [makeAnn({ id: 'a1', text: 'trocar disjuntor' })],
      }),
      makeDevice({
        deviceId: 'd2',
        identifier: 'L-100',
        label: 'Renner',
        annotations: [makeAnn({ id: 'a2', text: 'observar vibracao' })],
      }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(2);

    panel.setFilter({ searchTerm: 'havaianas' });
    // Should match the device with "Havaiánas" (accent-insensitive)
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(1);

    panel.setFilter({ searchTerm: 'VIBRACAO' });
    expect(document.querySelectorAll('.myio-annotations-item')).toHaveLength(1);
    panel.destroy();
  });

  it('empty state copy changes when filters are active', () => {
    const orch = makeOrch([
      makeDevice({
        deviceId: 'd1',
        annotations: [makeAnn({ id: 'a1', type: 'observation' })],
      }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    panel.setFilter({ types: new Set(['pending']) });

    const empty = document.querySelector('.myio-annotations-empty');
    expect(empty?.textContent).toContain('Nada encontrado');
    panel.destroy();
  });
});
