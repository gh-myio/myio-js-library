/**
 * RFC-0203 M4 — HeaderAnnotationsPanel unit tests.
 *
 * Covers:
 *   - AC-15 3 tabs rendered in order (Identifier → Device → Domain)
 *   - AC-16 last tab persisted to sessionStorage
 *   - AC-17 "Sem Identificador" bucket visible when devices lack identifier
 *   - AC-18 domain tab shows Energia / Água / Temperatura / Indeterminado
 *   - AC-19 item exhibits all required fields (icon, identifier, label, text, importance)
 *   - AC-44 ←/→/Home/End keyboard navigation between tabs
 *   - AC-46 role=dialog + aria-labelledby
 *   - AC-47 focus returns to anchor button on hide()
 *   - Item click dispatches myio:annotation-clicked with correct payload
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderAnnotationsPanel } from '../../../src/components/header-annotations-panel/HeaderAnnotationsPanel';
import { renderAnnotationItemCard, escapeHtml, truncate, formatRelative, isOverdue } from '../../../src/components/header-annotations-panel/AnnotationItemCard';
import type {
  AnnotatedDevice,
  Annotation,
  AnnotationGroup,
  AnnotationServiceOrchestratorShape,
} from '../../../src/services/annotations/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeAnn(over: Partial<Annotation> = {}): Annotation {
  return {
    id: over.id ?? 'a-1',
    version: 1,
    text: over.text ?? 'Trocar disjuntor C2',
    type: over.type ?? 'pending',
    importance: over.importance ?? 4,
    status: over.status ?? 'created',
    createdAt: over.createdAt ?? new Date(Date.now() - 3600_000).toISOString(),
    dueDate: over.dueDate,
    createdBy: over.createdBy ?? { id: 'u', email: 'u@x', name: 'João Silva' },
    acknowledged: false,
    responses: [],
    history: [],
  } as Annotation;
}

function makeDevice(over: Partial<AnnotatedDevice> = {}): AnnotatedDevice {
  return {
    deviceId: over.deviceId ?? 'd1',
    name: over.name ?? 'Device 1',
    label: over.label ?? 'Havaianas Medidor',
    identifier: over.identifier === undefined ? 'L-203' : over.identifier,
    domain: over.domain ?? 'energy',
    deviceType: over.deviceType ?? '3F_MEDIDOR',
    annotations: over.annotations ?? [makeAnn()],
  };
}

/** Build a minimal orchestrator stub for tests. */
function makeOrchStub(devices: AnnotatedDevice[]): AnnotationServiceOrchestratorShape {
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
    getGroups: (groupBy): AnnotationGroup[] => {
      const buckets = new Map<string, AnnotatedDevice[]>();
      for (const d of devices) {
        let key: string;
        if (groupBy === 'identifier') key = d.identifier ?? 'Sem Identificador';
        else if (groupBy === 'device') key = d.deviceId;
        else key = d.domain;
        const arr = buckets.get(key) ?? [];
        arr.push(d);
        buckets.set(key, arr);
      }
      const labelFor = (key: string, gb: string): string => {
        if (gb === 'domain') {
          const m: Record<string, string> = {
            energy: 'Energia',
            water: 'Água',
            temperature: 'Temperatura',
            unknown: 'Indeterminado',
          };
          return m[key] ?? key;
        }
        if (gb === 'device') {
          const dev = devices.find((d) => d.deviceId === key);
          return dev?.label ?? key;
        }
        return key;
      };
      const out: AnnotationGroup[] = [];
      for (const [key, devs] of buckets) {
        out.push({
          key,
          label: labelFor(key, groupBy),
          icon: groupBy === 'domain' ? { energy: '⚡', water: '💧', temperature: '🌡️', unknown: '·' }[devs[0].domain] : undefined,
          devices: devs,
          totalAnnotations: devs.reduce((s, d) => s + d.annotations.length, 0),
          maxImportance: 0,
          mostRecentAt: null,
        });
      }
      return out;
    },
    getTotalCount: () => devices.reduce((s, d) => s + d.annotations.length, 0),
    getPendingCount: () =>
      devices.reduce(
        (s, d) =>
          s + d.annotations.filter((a) => a.type === 'pending' && a.status !== 'archived').length,
        0
      ),
    getOverdueCount: () => 0,
    refresh: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn(),
  };
}

// ─── AnnotationItemCard pure helpers ───────────────────────────────────────

describe('AnnotationItemCard helpers', () => {
  it('escapeHtml escapes <, >, &, ", \'', () => {
    expect(escapeHtml('<b>"foo" & \'bar\'</b>')).toBe('&lt;b&gt;&quot;foo&quot; &amp; &#39;bar&#39;&lt;/b&gt;');
  });

  it('truncate respects max with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hell…');
    expect(truncate('short', 10)).toBe('short');
  });

  it('formatRelative handles common ranges', () => {
    const now = Date.now();
    expect(formatRelative(new Date(now - 30 * 1000).toISOString(), now)).toBe('agora há pouco');
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString(), now)).toBe('há 5 min');
    expect(formatRelative(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('há 3 h');
    expect(formatRelative(new Date(now - 2 * 86400_000).toISOString(), now)).toBe('há 2 d');
  });

  it('isOverdue is true only for pending past-due', () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(isOverdue(makeAnn({ type: 'pending', dueDate: past }))).toBe(true);
    expect(isOverdue(makeAnn({ type: 'pending', dueDate: future }))).toBe(false);
    expect(isOverdue(makeAnn({ type: 'maintenance', dueDate: past }))).toBe(false);
    expect(isOverdue(makeAnn({ type: 'pending' }))).toBe(false);
  });

  it('renderAnnotationItemCard exposes all required fields (AC-19)', () => {
    // RFC-0203 follow-up: importance now renders as a label ("Muito Alta"
    // for 5) with inline color from RFC-0104 canonical IMPORTANCE_COLORS
    // (#F44336 for level 5), instead of a number + scale class.
    const dev = makeDevice({ identifier: 'L-100', label: 'Riachuelo Energia', domain: 'energy' });
    const ann = makeAnn({ text: 'Quadro vibrando', importance: 5 });
    const html = renderAnnotationItemCard(dev, ann);

    expect(html).toContain('data-device-id="d1"');
    expect(html).toContain('data-annotation-id="a-1"');
    expect(html).toContain('L-100');
    expect(html).toContain('Riachuelo Energia');
    expect(html).toContain('Quadro vibrando');
    expect(html).toContain('Muito Alta');
    expect(html).toContain('#F44336');
    expect(html).toContain('João Silva');
  });
});

// ─── HeaderAnnotationsPanel ────────────────────────────────────────────────

describe('HeaderAnnotationsPanel', () => {
  let anchor: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    anchor = document.createElement('button');
    anchor.id = 'anchor-btn';
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders 3 tabs in order: Por Identificador / Por Device / Por Domínio (AC-15)', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    const tabs = Array.from(document.querySelectorAll('.myio-annotations-tab')).map((t) =>
      t.getAttribute('data-tab')
    );
    expect(tabs).toEqual(['identifier', 'device', 'domain']);
    panel.destroy();
  });

  it('default tab is identifier, last tab persists to sessionStorage (AC-16)', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    expect(panel.getActiveTab()).toBe('identifier');

    panel.setActiveTab('device');
    expect(sessionStorage.getItem('myio.annotations.activeTab')).toBe('device');

    panel.destroy();

    // New instance restores from sessionStorage
    const panel2 = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    expect(panel2.getActiveTab()).toBe('device');
  });

  it('shows "Sem Identificador" bucket for devices without identifier (AC-17)', () => {
    const orch = makeOrchStub([
      makeDevice({ identifier: 'L-100' }),
      makeDevice({ deviceId: 'd2', identifier: null, label: 'Orphan' }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    const groupLabels = Array.from(
      document.querySelectorAll('.myio-annotations-group-label')
    ).map((el) => el.textContent);
    expect(groupLabels).toContain('Sem Identificador');
    panel.destroy();
  });

  it('renders domain labels Energia/Água/Temperatura/Indeterminado (AC-18)', () => {
    const orch = makeOrchStub([
      makeDevice({ deviceId: 'd1', domain: 'energy' }),
      makeDevice({ deviceId: 'd2', domain: 'water' }),
      makeDevice({ deviceId: 'd3', domain: 'temperature' }),
      makeDevice({ deviceId: 'd4', domain: 'unknown' }),
    ]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    panel.setActiveTab('domain');

    const labels = Array.from(document.querySelectorAll('.myio-annotations-group-label')).map(
      (el) => el.textContent
    );
    expect(labels.sort()).toEqual(['Energia', 'Indeterminado', 'Temperatura', 'Água']);
    panel.destroy();
  });

  it('panel has role=dialog and aria-labelledby (AC-46)', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    const root = document.getElementById('myio-annotations-panel');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('aria-labelledby')).toBe('myio-annotations-panel-title');
    panel.destroy();
  });

  it('hide() returns focus to the anchor button (AC-47)', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    const focusSpy = vi.spyOn(anchor, 'focus');
    panel.hide();
    expect(focusSpy).toHaveBeenCalled();
    panel.destroy();
  });

  it('item click dispatches myio:annotation-clicked with correct payload', () => {
    const orch = makeOrchStub([makeDevice({ deviceId: 'dX', annotations: [makeAnn({ id: 'aY' })] })]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    const seen: CustomEvent[] = [];
    const handler = (e: Event) => seen.push(e as CustomEvent);
    window.addEventListener('myio:annotation-clicked', handler);

    const item = document.querySelector<HTMLButtonElement>('.myio-annotations-item');
    expect(item).not.toBeNull();
    item!.click();

    expect(seen.length).toBe(1);
    expect(seen[0].detail).toMatchObject({
      deviceId: 'dX',
      annotationId: 'aY',
      returnTo: 'header-panel',
    });

    window.removeEventListener('myio:annotation-clicked', handler);
    panel.destroy();
  });

  it('Esc key hides the panel', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    expect(document.getElementById('myio-annotations-panel')?.style.display).not.toBe('none');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('myio-annotations-panel')?.style.display).toBe('none');
    panel.destroy();
  });

  it('ArrowRight on tablist navigates to next tab (AC-44)', () => {
    const orch = makeOrchStub([makeDevice()]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);
    expect(panel.getActiveTab()).toBe('identifier');

    const tablist = document.querySelector('.myio-annotations-tabs');
    expect(tablist).not.toBeNull();
    tablist!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(panel.getActiveTab()).toBe('device');
    panel.destroy();
  });

  it('empty state when orchestrator has no devices', () => {
    const orch = makeOrchStub([]);
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => orch });
    panel.show(anchor);

    expect(document.querySelector('.myio-annotations-empty')).not.toBeNull();
    panel.destroy();
  });
});
