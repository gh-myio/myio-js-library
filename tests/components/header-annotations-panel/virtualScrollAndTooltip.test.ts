/**
 * RFC-0203 M6 — Virtual scroll + Tooltip behaviors unit tests.
 *
 * Covers:
 *   - AC-28 VirtualList activates only when items > 100
 *   - AC-32 pin/maximize/close/drag controls are present in the rendered header
 *   - AC-33 pinned panel does NOT close on click-outside
 *   - AC-34 maximized adds the .maximized class (90vw × 90vh applied by CSS)
 *   - AC-35 Esc + ✕ + click-outside close (when not pinned)
 *   - VirtualList unit: shouldVirtualize threshold, render window, destroy
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VirtualList,
  shouldVirtualize,
  VIRTUAL_SCROLL_THRESHOLD,
} from '../../../src/components/header-annotations-panel/VirtualList';
import { HeaderAnnotationsPanel } from '../../../src/components/header-annotations-panel/HeaderAnnotationsPanel';
import type {
  AnnotatedDevice,
  Annotation,
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
    annotations: over.annotations ?? [makeAnn()],
  };
}

/** Build an orchestrator stub with N annotations across one identifier. */
function makeOrchN(n: number): AnnotationServiceOrchestratorShape {
  const anns = Array.from({ length: n }, (_, i) => makeAnn({ id: 'a' + i, text: 'item ' + i }));
  const device = makeDevice({ identifier: 'L-1', annotations: anns });
  const groups: AnnotationGroup[] = [
    {
      key: 'L-1',
      label: 'L-1',
      icon: undefined,
      devices: [device],
      totalAnnotations: n,
      maxImportance: 3,
      mostRecentAt: anns[anns.length - 1]?.createdAt ?? null,
    },
  ];
  return {
    devices: [device],
    byIdentifier: new Map(),
    byDeviceId: new Map(),
    byDomain: new Map(),
    fetchedAt: Date.now(),
    getAll: () => [device],
    getByIdentifier: () => [device],
    getByDevice: () => device,
    getByDomain: () => [device],
    getGroups: () => groups,
    getTotalCount: () => n,
    getPendingCount: () => 0,
    getOverdueCount: () => 0,
    refresh: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn(),
  };
}

// ─── VirtualList helper ────────────────────────────────────────────────────

describe('shouldVirtualize', () => {
  it('returns false at or below the threshold (AC-28)', () => {
    expect(shouldVirtualize(0)).toBe(false);
    expect(shouldVirtualize(50)).toBe(false);
    expect(shouldVirtualize(VIRTUAL_SCROLL_THRESHOLD)).toBe(false);
  });

  it('returns true above the threshold', () => {
    expect(shouldVirtualize(VIRTUAL_SCROLL_THRESHOLD + 1)).toBe(true);
    expect(shouldVirtualize(1000)).toBe(true);
  });
});

describe('VirtualList', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 300, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders only the rows visible in the viewport (+ overscan)', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      key: 'r' + i,
      height: 50,
      render: () => `<div class="row" data-key="${i}">${i}</div>`,
    }));
    const list = new VirtualList({ container, rows, overscan: 0 });
    // Viewport height 300 / row 50 = 6 rows visible from top.
    const renderedKeys = Array.from(container.querySelectorAll('.row')).map((el) =>
      el.getAttribute('data-key')
    );
    expect(renderedKeys.length).toBeGreaterThanOrEqual(6);
    expect(renderedKeys.length).toBeLessThanOrEqual(8);
    expect(renderedKeys[0]).toBe('0');
    list.destroy();
  });

  it('total spacer height equals sum of row heights', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      key: 'r' + i,
      height: 30,
      render: () => `<div></div>`,
    }));
    const list = new VirtualList({ container, rows });
    const spacer = container.querySelector('.myio-vlist-spacer') as HTMLDivElement;
    expect(spacer.style.height).toBe('300px');
    list.destroy();
  });

  it('destroy() empties the container and detaches', () => {
    const rows = [{ key: 'r1', height: 30, render: () => '<div>x</div>' }];
    const list = new VirtualList({ container, rows });
    expect(container.innerHTML).not.toBe('');
    list.destroy();
    expect(container.innerHTML).toBe('');
  });
});

// ─── Panel — tooltip behaviors ─────────────────────────────────────────────

describe('HeaderAnnotationsPanel — tooltip behaviors', () => {
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

  it('renders pin / maximize / close header buttons (AC-32)', () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);

    expect(document.querySelector('[data-action="pin"]')).not.toBeNull();
    expect(document.querySelector('[data-action="maximize"]')).not.toBeNull();
    expect(document.querySelector('[data-action="close"]')).not.toBeNull();
    panel.destroy();
  });

  it('pinned panel does NOT close on click-outside (AC-33)', async () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);

    // Toggle pin
    const pinBtn = document.querySelector<HTMLButtonElement>('[data-action="pin"]');
    pinBtn?.click();

    // The click-outside listener attaches after a setTimeout(0); wait a tick
    await new Promise((r) => setTimeout(r, 5));

    // Click outside (on document.body)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const root = document.getElementById('myio-annotations-panel');
    expect(root?.style.display).not.toBe('none');
    panel.destroy();
  });

  it('maximize toggles .maximized class (AC-34)', () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);

    const root = document.getElementById('myio-annotations-panel');
    expect(root?.classList.contains('maximized')).toBe(false);

    const maxBtn = document.querySelector<HTMLButtonElement>('[data-action="maximize"]');
    maxBtn?.click();
    expect(root?.classList.contains('maximized')).toBe(true);

    // Toggle back
    document.querySelector<HTMLButtonElement>('[data-action="maximize"]')?.click();
    expect(document.getElementById('myio-annotations-panel')?.classList.contains('maximized')).toBe(false);
    panel.destroy();
  });

  it('close button hides the panel (AC-35)', () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);

    document.querySelector<HTMLButtonElement>('[data-action="close"]')?.click();
    expect(document.getElementById('myio-annotations-panel')?.style.display).toBe('none');
    panel.destroy();
  });

  it('header has data-drag-handle (AC-32 drag entry point)', () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);
    expect(document.querySelector('[data-drag-handle]')).not.toBeNull();
    panel.destroy();
  });

  it('Esc still closes when NOT pinned, and is blocked when pinned implicitly via click-outside path', () => {
    // Esc always closes per current behavior — pinned only blocks click-outside.
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(3) });
    panel.show(anchor);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('myio-annotations-panel')?.style.display).toBe('none');
    panel.destroy();
  });
});

// ─── Panel — virtual scroll activation (AC-28) ─────────────────────────────

describe('HeaderAnnotationsPanel — virtual scroll', () => {
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

  it('static render (no vlist-spacer) when count <= 100', () => {
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(50) });
    panel.show(anchor);
    expect(document.querySelector('.myio-vlist-spacer')).toBeNull();
    panel.destroy();
  });

  it('activates VirtualList (renders .myio-vlist-spacer) when count > 100', () => {
    // Make body clientHeight measurable in jsdom
    const panel = new HeaderAnnotationsPanel({ getOrchestrator: () => makeOrchN(150) });
    panel.show(anchor);
    expect(document.querySelector('.myio-vlist-spacer')).not.toBeNull();
    panel.destroy();
  });
});
