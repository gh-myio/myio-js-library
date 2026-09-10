/**
 * RFC-0231 — CentralStatusCard v1.0.0
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const openConfirmDialogMock = vi.fn();
const openGenericModalMock = vi.fn();
vi.mock('../../../../src/components/premium-modals/dialog', () => ({
  openConfirmDialog: (...args: unknown[]) => openConfirmDialogMock(...args),
  openGenericModal: (...args: unknown[]) => openGenericModalMock(...args),
}));

import { createCentralStatusCard } from '../../../../src/components/cards/central-status/v1.0.0';

let container: HTMLElement;

/** Minimal real-DOM fake matching GenericModalInstance, so click delegation on getBodyEl() works naturally. */
function fakeGenericModal(params: { bodyHtml: string }) {
  const bodyEl = document.createElement('div');
  bodyEl.innerHTML = params.bodyHtml;
  document.body.appendChild(bodyEl);
  return {
    close: vi.fn(),
    setBodyHtml: (html: string) => {
      bodyEl.innerHTML = html;
    },
    setTitle: vi.fn(),
    getBodyEl: () => bodyEl,
    getRoot: () => bodyEl,
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  openConfirmDialogMock.mockReset();
  openConfirmDialogMock.mockResolvedValue('confirm');
  openGenericModalMock.mockReset();
  openGenericModalMock.mockImplementation(fakeGenericModal);
});

afterEach(() => {
  container.remove();
});

const baseParams = () => ({
  container,
  id: 'central-1',
  name: 'Central Campinas Hidrômetros G0',
  monitoringEnabled: true,
  entityStatus: 'ACTIVE' as const,
  derivedConnectivity: 'ONLINE' as const,
});

function flip(el: HTMLInputElement, checked: boolean) {
  el.checked = checked;
  el.dispatchEvent(new Event('change'));
}

describe('CentralStatusCard (RFC-0231) — rendering', () => {
  it('renders a single flat block (Operação/Cadastro split removed) with all rows together', () => {
    const card = createCentralStatusCard(baseParams());
    const blocks = card.el.querySelectorAll('.myio-cscard__block');
    expect(blocks.length).toBe(1);
    const block = blocks[0];
    expect(block.querySelector('.myio-cscard__connectivity')).toBeTruthy();
    expect(block.querySelector('.myio-cscard__monitoring')).toBeTruthy();
    expect(block.querySelector('.myio-cscard__status')).toBeTruthy();
  });

  it('variant "card" renders full evidence rows; "compact" still renders badge + both switches inline', () => {
    const cardVariant = createCentralStatusCard({
      ...baseParams(),
      lastAttemptAt: '2026-09-02T14:00:00.000Z',
      lastSuccessAt: '2026-09-02T14:00:00.000Z',
    });
    expect(cardVariant.el.querySelector('.myio-cscard__last-attempt')).toBeTruthy();
    cardVariant.destroy();

    const compact = createCentralStatusCard({ ...baseParams(), variant: 'compact' });
    expect(compact.el.querySelector('.myio-cscard__badge')).toBeTruthy();
    expect(compact.el.querySelector('.myio-cscard__monitoring-switch')).toBeTruthy();
    expect(compact.el.querySelector('.myio-cscard__status-switch')).toBeTruthy();
    // evidence rows still exist in the DOM (density is a CSS concern), not stripped
    expect(compact.el.querySelector('.myio-cscard__row--evidence')).toBeTruthy();
  });

  it('derives connectivity from connectivityEvidence + offlineGraceMs when derivedConnectivity is omitted', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      derivedConnectivity: undefined,
      connectivityEvidence: { monitoringEnabled: true, lastSuccessAt: null },
      offlineGraceMs: 60_000,
    });
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('UNKNOWN');
  });

  it('optional rows (probeVerdict, deviceCounts) are omitted when absent', () => {
    const card = createCentralStatusCard(baseParams());
    expect(card.el.querySelector('.myio-cscard__probe')).toBeNull();
    expect(card.el.querySelector('.myio-cscard__devices')).toBeNull();
  });

  it('showDivergence gates the divergência warning icon (info-tooltip trigger, not a full row)', () => {
    const withDiv = createCentralStatusCard({
      ...baseParams(),
      showDivergence: true,
      divergence: { current: 'ONLINE', proposed: 'OFFLINE' },
    });
    const flag = withDiv.el.querySelector('.myio-cscard__divergence-flag');
    expect(flag).toBeTruthy();
    expect(flag?.getAttribute('data-role')).toBe('divergence-tooltip');
    expect(flag?.getAttribute('aria-label')).toContain('ONLINE');
    expect(flag?.getAttribute('aria-label')).toContain('OFFLINE');
    withDiv.destroy();

    const without = createCentralStatusCard({
      ...baseParams(),
      showDivergence: false,
      divergence: { current: 'ONLINE', proposed: 'OFFLINE' },
    });
    expect(without.el.querySelector('.myio-cscard__divergence-flag')).toBeNull();
  });
});

describe('CentralStatusCard — color scheme (two independent axes)', () => {
  it('data-status follows entityStatus (registry axis, drives the border)', () => {
    const active = createCentralStatusCard({ ...baseParams(), entityStatus: 'ACTIVE' });
    expect(active.el.dataset.status).toBe('ACTIVE');
    active.update({ entityStatus: 'INACTIVE' });
    expect(active.el.dataset.status).toBe('INACTIVE');
  });

  it('data-connectivity follows connectivity (health axis, drives the header/badge)', () => {
    const card = createCentralStatusCard({ ...baseParams(), derivedConnectivity: 'WARNING' });
    expect(card.el.dataset.connectivity).toBe('WARNING');
    card.update({ derivedConnectivity: 'OFFLINE' });
    expect(card.el.dataset.connectivity).toBe('OFFLINE');
  });

  it('DELETED entityStatus is accepted and rendered without crashing', () => {
    const card = createCentralStatusCard({ ...baseParams(), entityStatus: 'DELETED' as any });
    expect(card.el.dataset.status).toBe('DELETED');
    expect(card.el.querySelector('.myio-cscard__status-switch')).toBeTruthy();
  });
});

describe('CentralStatusCard — v2: offlineHardMs duration badge', () => {
  // The card doesn't accept an injectable clock (unlike deriveCentralConnectivity's
  // own `nowMs`), so Date.now() must be pinned via fake timers to make the
  // OFFLINE_HARD duration text deterministic instead of flaky.
  const T0 = Date.parse('2026-09-08T20:00:00.000Z');
  const HARD = 2.5 * 60 * 60 * 1000; // 2h30min
  const GRACE = 10 * 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('past offlineHardMs renders "OFFLINE 2h30min" instead of the bare label', () => {
    const lastSuccessAt = new Date(T0 - HARD).toISOString();
    const card = createCentralStatusCard({
      ...baseParams(),
      derivedConnectivity: undefined,
      connectivityEvidence: {
        monitoringEnabled: true,
        probeResult: 'TIMEOUT',
        lastCheckAt: new Date(T0).toISOString(),
        lastSuccessAt,
      },
      offlineGraceMs: GRACE,
      offlineHardMs: HARD,
    });
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('OFFLINE 2h30min');
  });

  it('past grace but before offlineHardMs stays the bare "OFFLINE" label (no suffix yet)', () => {
    const lastSuccessAt = new Date(T0 - 30 * 60 * 1000).toISOString(); // 30min: past 10min grace, before 2h30 hard
    const card = createCentralStatusCard({
      ...baseParams(),
      derivedConnectivity: undefined,
      connectivityEvidence: {
        monitoringEnabled: true,
        probeResult: 'TIMEOUT',
        lastCheckAt: new Date(T0).toISOString(),
        lastSuccessAt,
      },
      offlineGraceMs: GRACE,
      offlineHardMs: HARD,
    });
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('OFFLINE');
  });

  it('a `labels.connectivityValue` override always wins over the auto duration suffix', () => {
    const lastSuccessAt = new Date(T0 - HARD).toISOString();
    const card = createCentralStatusCard({
      ...baseParams(),
      derivedConnectivity: undefined,
      connectivityEvidence: {
        monitoringEnabled: true,
        probeResult: 'TIMEOUT',
        lastCheckAt: new Date(T0).toISOString(),
        lastSuccessAt,
      },
      offlineGraceMs: GRACE,
      offlineHardMs: HARD,
      labels: { connectivityValue: { OFFLINE: 'Custom Offline Label' } },
    });
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('Custom Offline Label');
  });

  it('the derivedConnectivity host-controlled path never auto-appends a duration (host owns the full label)', () => {
    const card = createCentralStatusCard({ ...baseParams(), derivedConnectivity: 'OFFLINE' });
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('OFFLINE');
  });
});

describe('CentralStatusCard — devices row (colored dots)', () => {
  it('renders 4 colored dots (total/online/offline/unknown) with the numbers as real visible text', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      deviceCounts: { total: 420, online: 400, offline: 5, unknown: 15 },
    });
    const dots = card.el.querySelectorAll('.myio-cscard__devicedot');
    expect(dots.length).toBe(4);
    expect(dots[0].textContent).toBe('420');
    expect(dots[0].classList.contains('myio-cscard__devicedot--total')).toBe(true);
    expect(dots[1].textContent).toBe('400');
    expect(dots[1].classList.contains('myio-cscard__devicedot--online')).toBe(true);
    expect(dots[2].textContent).toBe('5');
    expect(dots[2].classList.contains('myio-cscard__devicedot--offline')).toBe(true);
    expect(dots[3].textContent).toBe('15');
    expect(dots[3].classList.contains('myio-cscard__devicedot--unknown')).toBe(true);
  });

  it('omits the devices row entirely when deviceCounts is absent', () => {
    const card = createCentralStatusCard(baseParams());
    expect(card.el.querySelector('.myio-cscard__devicedot')).toBeNull();
  });

  it('each dot carries its own title + aria-label caption — order alone is not the only signal (pt default)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      deviceCounts: { total: 155, online: 0, offline: 0, unknown: 155 },
    });
    const dots = card.el.querySelectorAll('.myio-cscard__devicedot');
    expect(dots[0].getAttribute('title')).toBe('total');
    expect(dots[0].getAttribute('aria-label')).toBe('total: 155');
    expect(dots[1].getAttribute('title')).toBe('online');
    expect(dots[1].getAttribute('aria-label')).toBe('online: 0');
    expect(dots[2].getAttribute('title')).toBe('offline');
    expect(dots[2].getAttribute('aria-label')).toBe('offline: 0');
    expect(dots[3].getAttribute('title')).toBe('desconhecido');
    expect(dots[3].getAttribute('aria-label')).toBe('desconhecido: 155');
  });

  it('the row-level title is also labeled (not the old bare "155 · 0 · 0 · 155")', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      deviceCounts: { total: 155, online: 0, offline: 0, unknown: 155 },
    });
    const valueEl = card.el.querySelector('.myio-cscard__value--dots');
    expect(valueEl?.getAttribute('title')).toBe('total: 155 · online: 0 · offline: 0 · unknown: 155');
  });
});

describe('CentralStatusCard — title (i) tooltip', () => {
  it('titleTooltipHtml renders the (i) button; omitting it renders none', () => {
    const withTooltip = createCentralStatusCard({ ...baseParams(), titleTooltipHtml: '<b>uuid-123</b>' });
    expect(withTooltip.el.querySelector('[data-role="title-tooltip"]')).toBeTruthy();
    withTooltip.destroy();

    const without = createCentralStatusCard(baseParams());
    expect(without.el.querySelector('[data-role="title-tooltip"]')).toBeNull();
  });

  it('destroy() detaches the tooltip listeners without throwing', () => {
    const card = createCentralStatusCard({ ...baseParams(), titleTooltipHtml: '<b>uuid-123</b>' });
    expect(() => card.destroy()).not.toThrow();
  });

  it('lives beside the "Status" label, not the titlebar (checkbox took over that titlebar spot)', () => {
    const card = createCentralStatusCard({ ...baseParams(), titleTooltipHtml: '<b>uuid-123</b>' });
    const titlebar = card.el.querySelector('.myio-cscard__titlebar')!;
    const statusRow = card.el.querySelector('.myio-cscard__status')!;
    expect(titlebar.querySelector('[data-role="title-tooltip"]')).toBeNull();
    expect(statusRow.querySelector('[data-role="title-tooltip"]')).toBeTruthy();
  });
});

describe('CentralStatusCard — v6.0.0-inspired layout (left action column, select row, reduced font)', () => {
  it('surface is a flex row with an optional left .myio-cscard__actioncol beside .myio-cscard__content', () => {
    const card = createCentralStatusCard({ ...baseParams(), onOpenReport: vi.fn() });
    const surface = card.el.querySelector('.myio-cscard__surface');
    const actioncol = card.el.querySelector('.myio-cscard__actioncol');
    const content = card.el.querySelector('.myio-cscard__content');
    expect(surface).toBeTruthy();
    expect(actioncol).toBeTruthy();
    expect(content).toBeTruthy();
    // surface (the clipped/rounded visual layer) is a direct child of root;
    // actioncol/content are its children, not the root's — this is what lets
    // root-level badges hang outside the clipped surface (see notification-
    // badges describe block below).
    expect(surface!.parentElement).toBe(card.el);
    expect(actioncol!.parentElement).toBe(surface);
    expect(content!.parentElement).toBe(surface);
  });

  it('the selection checkbox is inline in the titlebar (took over the spot the (i) used to occupy)', () => {
    const card = createCentralStatusCard({ ...baseParams(), enableSelection: true });
    const titlebar = card.el.querySelector('.myio-cscard__titlebar')!;
    expect(titlebar.querySelector('.myio-cscard__select-checkbox')).toBeTruthy();
  });

  it("'card' variant has a fixed min-height floor so a grid of cards with different optional rows doesn't look broken", () => {
    const card = createCentralStatusCard(baseParams());
    expect(card.el.classList.contains('myio-cscard--card')).toBe(true);
    // computed styles aren't reliable in jsdom without a real stylesheet engine —
    // assert the CSS rule exists in the injected stylesheet instead.
    const styleTag = document.getElementById('myio-central-status-card-styles')!;
    expect(styleTag.textContent).toMatch(/\.myio-cscard--card\{min-height:\d+px;?\}/);
  });
});

describe('CentralStatusCard — language (RFC-0231 i18n)', () => {
  it('defaults to pt labels when language is omitted', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      deviceCounts: { total: 10, online: 10, offline: 0, unknown: 0 },
    });
    const labels = Array.from(card.el.querySelectorAll('.myio-cscard__label')).map((n) => n.textContent);
    expect(labels).toContain('conectividade');
    expect(labels).toContain('Monitoramento');
    expect(labels).toContain('última tentativa');
    expect(labels).toContain('último sucesso');
    expect(labels).toContain('dispositivos');
  });

  it('language: "en" renders the built-in English defaults', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      probeVerdict: { label: 'Responding', tone: 'ok' },
      deviceCounts: { total: 10, online: 10, offline: 0, unknown: 0 },
    });
    const labels = Array.from(card.el.querySelectorAll('.myio-cscard__label')).map((n) => n.textContent);
    expect(labels).toContain('connectivity');
    expect(labels).toContain('Monitoring');
    expect(labels).toContain('last attempt');
    expect(labels).toContain('last success');
    expect(labels).toContain('connection test');
    expect(labels).toContain('devices');
  });

  it('a `labels` override always wins over the language default, key by key', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      labels: { monitoring: 'Custom Monitor Label' },
    });
    const labels = Array.from(card.el.querySelectorAll('.myio-cscard__label')).map((n) => n.textContent);
    expect(labels).toContain('Custom Monitor Label');
    expect(labels).toContain('connectivity'); // untouched key still falls back to the EN default
  });

  it('update({ language }) re-renders the labels in the new language without remounting', () => {
    const card = createCentralStatusCard(baseParams());
    expect(card.el.querySelector('.myio-cscard__connectivity .myio-cscard__label')?.textContent).toBe(
      'conectividade'
    );
    card.update({ language: 'en' });
    expect(card.el.querySelector('.myio-cscard__connectivity .myio-cscard__label')?.textContent).toBe(
      'connectivity'
    );
  });

  it('stale badge text follows language too', () => {
    const card = createCentralStatusCard({ ...baseParams(), derivedStale: true, language: 'en' });
    expect(card.el.querySelector('.myio-cscard__stale')?.textContent).toBe('stale');
    card.update({ language: 'pt' });
    expect(card.el.querySelector('.myio-cscard__stale')?.textContent).toBe('desatualizado');
  });
});

describe('CentralStatusCard — accessibility', () => {
  it('sliders are real role="switch" inputs with an accessible name and aria-checked tracking state', () => {
    const card = createCentralStatusCard(baseParams());
    const mon = card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    const st = card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!;
    expect(mon.getAttribute('role')).toBe('switch');
    expect(mon.getAttribute('aria-labelledby')).toBeTruthy();
    expect(mon.getAttribute('aria-checked')).toBe('true');
    expect(st.getAttribute('role')).toBe('switch');
    expect(st.getAttribute('aria-checked')).toBe('true');
  });

  it('state is present as text (on/off, ACTIVE/INACTIVE, connectivity value)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      monitoringEnabled: false,
      entityStatus: 'INACTIVE',
    });
    expect(card.el.querySelector('.myio-cscard__monitoring .myio-cscard__switch-text')?.textContent).toBe('OFF');
    expect(card.el.querySelector('.myio-cscard__status .myio-cscard__switch-text')?.textContent).toBe('INACTIVE');
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('ONLINE');
  });

  it('Monitoramento switch-text is invariant "ON"/"OFF" regardless of language; Status still translates (pt: ATIVO/INATIVO)', () => {
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: false, entityStatus: 'INACTIVE' });
    expect(card.el.querySelector('.myio-cscard__monitoring .myio-cscard__switch-text')?.textContent).toBe('OFF');
    expect(card.el.querySelector('.myio-cscard__status .myio-cscard__switch-text')?.textContent).toBe('INATIVO');

    const enCard = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      monitoringEnabled: false,
      entityStatus: 'INACTIVE',
    });
    expect(enCard.el.querySelector('.myio-cscard__monitoring .myio-cscard__switch-text')?.textContent).toBe('OFF');
  });

  it('monitoringReadonly / statusReadonly disable the respective sliders', () => {
    const card = createCentralStatusCard({ ...baseParams(), monitoringReadonly: true, statusReadonly: true });
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!.disabled).toBe(true);
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!.disabled).toBe(true);
  });

  it('icons decorative: overriding an icon to false leaves the row readable via text/aria', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      icons: { connectivity: false },
    });
    expect(card.el.querySelector('[data-icon-key="connectivity"]')?.textContent).toBe('');
    // state still fully readable via text
    expect(card.el.querySelector('.myio-cscard__badge')?.textContent).toBe('ONLINE');
  });

  it('icons decorative: a string override replaces the default glyph without touching text state', () => {
    const card = createCentralStatusCard({ ...baseParams(), icons: { connectivity: '🟢' } });
    expect(card.el.querySelector('[data-icon-key="connectivity"]')?.textContent).toBe('🟢');
  });
});

describe('CentralStatusCard — event-object callbacks (no positional args)', () => {
  it('onMonitoringToggle receives {id, next, previous, source}, next=true means monitoring ON', async () => {
    openConfirmDialogMock.mockResolvedValue('confirm');
    const onMonitoringToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    const sw = card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    flip(sw, false); // ON -> OFF is destructive, goes through confirm
    await vi.waitFor(() => expect(onMonitoringToggle).toHaveBeenCalled());
    expect(onMonitoringToggle).toHaveBeenCalledWith({
      id: 'central-1',
      next: false,
      previous: true,
      source: 'central-status-card',
    });
  });

  it('onStatusToggle receives a string union next/previous, never a boolean', async () => {
    const onStatusToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), entityStatus: 'ACTIVE', onStatusToggle });
    const sw = card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!;
    flip(sw, false); // ACTIVE -> INACTIVE is destructive, goes through confirm
    await vi.waitFor(() => expect(onStatusToggle).toHaveBeenCalled());
    const call = onStatusToggle.mock.calls[0][0];
    expect(call).toEqual({ id: 'central-1', next: 'INACTIVE', previous: 'ACTIVE', source: 'central-status-card' });
    expect(typeof call.next).toBe('string');
  });

  it('onForceSync receives {id, source} and disables the button while in flight', async () => {
    let resolveFn: () => void;
    const onForceSync = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        })
    );
    const card = createCentralStatusCard({ ...baseParams(), showForceSync: true, onForceSync });
    const btn = card.el.querySelector<HTMLButtonElement>('.myio-cscard__force')!;
    btn.click();
    await vi.waitFor(() => expect(onForceSync).toHaveBeenCalledWith({ id: 'central-1', source: 'central-status-card' }));
    expect(card.el.querySelector<HTMLButtonElement>('.myio-cscard__force')!.disabled).toBe(true);
    resolveFn!();
    await vi.waitFor(() => expect(card.el.querySelector<HTMLButtonElement>('.myio-cscard__force')!.disabled).toBe(false));
  });
});

describe('CentralStatusCard — confirmation matrix', () => {
  it('Monitoramento OFF (destructive) asks for confirm', async () => {
    const onMonitoringToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    flip(card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!, false);
    await vi.waitFor(() => expect(onMonitoringToggle).toHaveBeenCalled());
    expect(openConfirmDialogMock).toHaveBeenCalled();
  });

  it('Monitoramento ON (non-destructive) skips confirm', async () => {
    const onMonitoringToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: false, onMonitoringToggle });
    flip(card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!, true);
    await vi.waitFor(() => expect(onMonitoringToggle).toHaveBeenCalled());
    expect(openConfirmDialogMock).not.toHaveBeenCalled();
  });

  it('Status INACTIVE asks for confirm; Status ACTIVE skips confirm by default', async () => {
    const onStatusToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), entityStatus: 'ACTIVE', onStatusToggle });
    flip(card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!, false);
    await vi.waitFor(() => expect(onStatusToggle).toHaveBeenCalled());
    expect(openConfirmDialogMock).toHaveBeenCalled();

    openConfirmDialogMock.mockClear();
    onStatusToggle.mockClear();
    const card2 = createCentralStatusCard({ ...baseParams(), entityStatus: 'INACTIVE', onStatusToggle });
    flip(card2.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!, true);
    await vi.waitFor(() => expect(onStatusToggle).toHaveBeenCalled());
    expect(openConfirmDialogMock).not.toHaveBeenCalled();
  });

  it('confirmStatusActivate:true asks for confirm on activate too', async () => {
    const onStatusToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({
      ...baseParams(),
      entityStatus: 'INACTIVE',
      confirmStatusActivate: true,
      onStatusToggle,
    });
    flip(card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!, true);
    await vi.waitFor(() => expect(onStatusToggle).toHaveBeenCalled());
    expect(openConfirmDialogMock).toHaveBeenCalled();
  });

  it('cancel on a confirm reverts the slider (and aria-checked) and does NOT call the callback', async () => {
    openConfirmDialogMock.mockResolvedValue('cancel');
    const onMonitoringToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    const sw = card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    flip(sw, false);
    await vi.waitFor(() => expect(openConfirmDialogMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(sw.checked).toBe(true));
    expect(onMonitoringToggle).not.toHaveBeenCalled();
  });
});

describe('CentralStatusCard — revert-on-reject', () => {
  it('a rejecting callback reverts the slider, clears aria-busy, re-enables, and shows a local role="alert" error', async () => {
    const onMonitoringToggle = vi.fn().mockRejectedValue(new Error('sem permissão'));
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    const sw = () => card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    flip(sw(), false);
    await vi.waitFor(() => expect(onMonitoringToggle).toHaveBeenCalled());
    await vi.waitFor(() => expect(sw().getAttribute('aria-checked')).toBe('true'));
    expect(sw().checked).toBe(true);
    expect(sw().disabled).toBe(false);
    expect(sw().getAttribute('aria-busy')).toBeNull();
    const err = card.el.querySelector('.myio-cscard__monitoring .myio-cscard__err');
    expect(err?.getAttribute('role')).toBe('alert');
    expect(err?.hasAttribute('hidden')).toBe(false);
    expect(err?.textContent).toBe('sem permissão');
  });

  it('disables the control (aria-busy) while the write is in flight', async () => {
    let resolveFn: () => void;
    const onMonitoringToggle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        })
    );
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    const sw = () => card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    flip(sw(), false);
    await vi.waitFor(() => expect(sw().disabled).toBe(true));
    expect(sw().getAttribute('aria-busy')).toBe('true');
    resolveFn!();
    await vi.waitFor(() => expect(sw().disabled).toBe(false));
  });
});

describe('CentralStatusCard — timeline button (📈)', () => {
  it('is gated by `timeline` — absent by default, present when wired', () => {
    const without = createCentralStatusCard(baseParams());
    expect(without.el.querySelector('[data-role="open-timeline"]')).toBeNull();
    without.destroy();

    const withTimeline = createCentralStatusCard({
      ...baseParams(),
      timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) },
    });
    expect(withTimeline.el.querySelector('[data-role="open-timeline"]')).toBeTruthy();
  });

  it('clicking it opens the generic modal with the interpolated title and this central\'s id', async () => {
    const onFetchTimeline = vi.fn().mockResolvedValue({ transitions: [], segments: [] });
    const card = createCentralStatusCard({
      ...baseParams(),
      id: 'gcdr-gw-42',
      name: 'Central Sá Cavalcante',
      timeline: { onFetchTimeline },
    });
    card.el.querySelector<HTMLButtonElement>('[data-role="open-timeline"]')!.click();
    expect(openGenericModalMock).toHaveBeenCalledTimes(1);
    expect(openGenericModalMock.mock.calls[0][0].title).toBe('Timeline de conectividade — Central Sá Cavalcante');
    await vi.waitFor(() => expect(onFetchTimeline).toHaveBeenCalledWith({ id: 'gcdr-gw-42', days: 30 }));
  });

  it('language: "en" flips the modal title template too', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) },
    });
    card.el.querySelector<HTMLButtonElement>('[data-role="open-timeline"]')!.click();
    expect(openGenericModalMock.mock.calls[0][0].title).toBe(
      `Connectivity timeline — ${baseParams().name}`
    );
  });

  it('icons.timeline override replaces the glyph without touching the click behavior', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) },
      icons: { timeline: '🕓' },
    });
    const btn = card.el.querySelector<HTMLButtonElement>('[data-role="open-timeline"]')!;
    expect(btn.textContent).toBe('🕓');
    btn.click();
    expect(openGenericModalMock).toHaveBeenCalledTimes(1);
  });
});

describe('CentralStatusCard — selection (inspired by cards/main-view/v6.0.0, no MyIOSelectionStore dependency)', () => {
  it('checkbox is gated by enableSelection', () => {
    const without = createCentralStatusCard(baseParams());
    expect(without.el.querySelector('.myio-cscard__select-checkbox')).toBeNull();
    without.destroy();

    const withSelection = createCentralStatusCard({ ...baseParams(), enableSelection: true });
    expect(withSelection.el.querySelector('.myio-cscard__select-checkbox')).toBeTruthy();
  });

  it('`selected` controls the checked state and the --selected outline class (host-controlled, not internal state)', () => {
    const card = createCentralStatusCard({ ...baseParams(), enableSelection: true, selected: true });
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__select-checkbox')!.checked).toBe(true);
    expect(card.el.classList.contains('myio-cscard--selected')).toBe(true);

    card.update({ selected: false });
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__select-checkbox')!.checked).toBe(false);
    expect(card.el.classList.contains('myio-cscard--selected')).toBe(false);
  });

  it('toggling the checkbox fires onSelectChange with {id, selected, source} and does not fire onClickCard', () => {
    const onSelectChange = vi.fn();
    const onClickCard = vi.fn();
    const card = createCentralStatusCard({
      ...baseParams(),
      id: 'central-9',
      enableSelection: true,
      onSelectChange,
      onClickCard,
    });
    const checkbox = card.el.querySelector<HTMLInputElement>('.myio-cscard__select-checkbox')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSelectChange).toHaveBeenCalledWith({ id: 'central-9', selected: true, source: 'central-status-card' });
    expect(onClickCard).not.toHaveBeenCalled();
  });
});

describe('CentralStatusCard — drag and drop (same dataTransfer payload as v6.0.0, no store dependency)', () => {
  function fakeDataTransfer() {
    const store: Record<string, string> = {};
    return {
      setData: vi.fn((type: string, value: string) => {
        store[type] = value;
      }),
      getData: (type: string) => store[type],
      effectAllowed: '',
    };
  }

  it('root element is draggable only when enableDragDrop is true', () => {
    const without = createCentralStatusCard(baseParams());
    expect(without.el.getAttribute('draggable')).toBeNull();
    without.destroy();

    const withDrag = createCentralStatusCard({ ...baseParams(), enableDragDrop: true });
    expect(withDrag.el.getAttribute('draggable')).toBe('true');
  });

  it('dragstart sets the same 3 dataTransfer keys v6.0.0 uses (text/myio-id, application/json, text/myio-name)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      id: 'central-9',
      name: 'Central Teste',
      enableDragDrop: true,
    });
    const dt = fakeDataTransfer();
    card.el.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }));
    expect(dt.setData).toHaveBeenCalledWith('text/myio-id', 'central-9');
    expect(dt.setData).toHaveBeenCalledWith('text/myio-name', 'Central Teste');
    expect(JSON.parse(dt.getData('application/json'))).toEqual({ id: 'central-9', name: 'Central Teste' });
    expect(dt.effectAllowed).toBe('copy');
  });

  it('a single root listener survives many re-renders — no duplicate dragstart/click firing (regression: listeners must bind once, not per render())', () => {
    const onClickCard = vi.fn();
    const card = createCentralStatusCard({ ...baseParams(), enableDragDrop: true, onClickCard });
    for (let i = 0; i < 5; i++) card.update({ lastAttemptAt: new Date().toISOString() }); // 5 extra renders
    card.el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onClickCard).toHaveBeenCalledTimes(1);
  });
});

describe('CentralStatusCard — onClickCard', () => {
  it('fires on a body click but NOT when the click originated on a switch/button/checkbox', () => {
    const onClickCard = vi.fn();
    const card = createCentralStatusCard({
      ...baseParams(),
      id: 'central-9',
      enableSelection: true,
      showForceSync: true,
      onClickCard,
      onForceSync: vi.fn().mockResolvedValue(undefined),
    });

    card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!.click();
    card.el.querySelector<HTMLButtonElement>('.myio-cscard__force')!.click();
    card.el.querySelector<HTMLInputElement>('.myio-cscard__select-checkbox')!.click();
    expect(onClickCard).not.toHaveBeenCalled();

    card.el.querySelector<HTMLElement>('.myio-cscard__title')!.click();
    expect(onClickCard).toHaveBeenCalledWith({ id: 'central-9', source: 'central-status-card' });
  });

  it('is a no-op (no listener side effects) when omitted', () => {
    const card = createCentralStatusCard(baseParams());
    expect(() => card.el.click()).not.toThrow();
  });
});

describe('CentralStatusCard — action row (📊 dashboard / 📄 report / ⚙️ settings)', () => {
  it('each button only renders when its callback is provided', () => {
    const none = createCentralStatusCard(baseParams());
    expect(none.el.querySelector('.myio-cscard__actioncol')).toBeNull();
    none.destroy();

    const dashboardOnly = createCentralStatusCard({ ...baseParams(), onOpenDashboard: vi.fn() });
    expect(dashboardOnly.el.querySelector('[data-role="open-dashboard"]')).toBeTruthy();
    expect(dashboardOnly.el.querySelector('[data-role="open-report"]')).toBeNull();
    expect(dashboardOnly.el.querySelector('[data-role="open-settings"]')).toBeNull();
  });

  it('clicking a button fires its own callback, stops propagation (no onClickCard), and does not trigger the others', () => {
    const onOpenDashboard = vi.fn();
    const onOpenReport = vi.fn();
    const onOpenSettings = vi.fn();
    const onClickCard = vi.fn();
    const card = createCentralStatusCard({
      ...baseParams(),
      id: 'central-9',
      onOpenDashboard,
      onOpenReport,
      onOpenSettings,
      onClickCard,
    });
    card.el.querySelector<HTMLButtonElement>('[data-role="open-report"]')!.click();
    expect(onOpenReport).toHaveBeenCalledWith({ id: 'central-9', source: 'central-status-card' });
    expect(onOpenDashboard).not.toHaveBeenCalled();
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(onClickCard).not.toHaveBeenCalled();
  });

  it('icons.dashboard/report/settings override the default glyphs', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      onOpenDashboard: vi.fn(),
      onOpenReport: vi.fn(),
      onOpenSettings: vi.fn(),
      icons: { dashboard: '🖥️', report: '🧾', settings: '🔧' },
    });
    expect(card.el.querySelector('[data-role="open-dashboard"]')?.textContent).toBe('🖥️');
    expect(card.el.querySelector('[data-role="open-report"]')?.textContent).toBe('🧾');
    expect(card.el.querySelector('[data-role="open-settings"]')?.textContent).toBe('🔧');
  });
});

describe('CentralStatusCard — latency trend arrow (teste de conexão)', () => {
  it('no arrow on the very first render — nothing to compare against yet', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 },
    });
    expect(card.el.querySelector('.myio-cscard__latency-trend')).toBeNull();
  });

  it('a big drop in latency (>100ms faster) shows the green up arrow', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 300 },
    });
    card.update({ probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 } });
    const trend = card.el.querySelector('.myio-cscard__latency-trend')!;
    expect(trend.classList.contains('myio-cscard__latency-trend--faster')).toBe(true);
    expect(trend.textContent).toBe('↑');
  });

  it('a big rise in latency (>100ms slower) shows the red diagonal arrow', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 },
    });
    card.update({ probeVerdict: { label: 'Sem resposta', tone: 'warn', latencyMs: 300 } });
    const trend = card.el.querySelector('.myio-cscard__latency-trend')!;
    expect(trend.classList.contains('myio-cscard__latency-trend--slower')).toBe(true);
    expect(trend.textContent).toBe('↘');
  });

  it('a delta within ±100ms shows the flat black bar, not a directional arrow', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 },
    });
    card.update({ probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 120 } }); // +75ms, within tolerance
    const trend = card.el.querySelector('.myio-cscard__latency-trend')!;
    expect(trend.classList.contains('myio-cscard__latency-trend--flat')).toBe(true);
    expect(trend.textContent).toBe('▬');
  });

  it('exact ±100ms boundary counts as flat (inclusive)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 },
    });
    card.update({ probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 145 } }); // exactly +100ms
    expect(
      card.el.querySelector('.myio-cscard__latency-trend')!.classList.contains('myio-cscard__latency-trend--flat')
    ).toBe(true);
  });

  it('each render becomes the new baseline for the next comparison (not stuck comparing to the first value)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 45 },
    });
    card.update({ probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 300 } }); // +255ms -> slower
    expect(
      card.el.querySelector('.myio-cscard__latency-trend')!.classList.contains('myio-cscard__latency-trend--slower')
    ).toBe(true);
    card.update({ probeVerdict: { label: 'Respondendo', tone: 'ok', latencyMs: 320 } }); // +20ms vs 300, not vs 45 -> flat
    expect(
      card.el.querySelector('.myio-cscard__latency-trend')!.classList.contains('myio-cscard__latency-trend--flat')
    ).toBe(true);
  });

  it('title/aria-label are language-aware', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      probeVerdict: { label: 'Responding', tone: 'ok', latencyMs: 300 },
    });
    card.update({ probeVerdict: { label: 'Responding', tone: 'ok', latencyMs: 45 } });
    const trend = card.el.querySelector('.myio-cscard__latency-trend')!;
    expect(trend.getAttribute('title')).toBe('faster than last attempt');
  });

  it('no probe or no latencyMs never throws and renders no trend', () => {
    const card = createCentralStatusCard({ ...baseParams(), probeVerdict: { label: 'Sem dados', tone: 'muted' } });
    expect(card.el.querySelector('.myio-cscard__latency-trend')).toBeNull();
    expect(() => card.update({ probeVerdict: null })).not.toThrow();
  });
});

describe('CentralStatusCard — scale (inspired by cards/main-view/v6.0.0 zoomMultiplier)', () => {
  it('applies CSS zoom when scale !== 1, clears it (empty string, not "1") at the default', () => {
    const scaled = createCentralStatusCard({ ...baseParams(), scale: 0.8 });
    expect((scaled.el.style as any).zoom).toBe('0.8');

    const atDefault = createCentralStatusCard({ ...baseParams(), scale: 1 });
    expect((atDefault.el.style as any).zoom).toBe('');

    const omitted = createCentralStatusCard(baseParams());
    expect((omitted.el.style as any).zoom).toBe('');
  });

  it('update({ scale }) re-applies zoom live', () => {
    const card = createCentralStatusCard(baseParams());
    expect((card.el.style as any).zoom).toBe('');
    card.update({ scale: 1.25 });
    expect((card.el.style as any).zoom).toBe('1.25');
    card.update({ scale: 1 });
    expect((card.el.style as any).zoom).toBe('');
  });
});

describe('CentralStatusCard — notification badges (faithful port of TELEMETRY/controller.js)', () => {
  describe('alarm badge (top-left, red, bell)', () => {
    it('hidden entirely when 0/omitted — never rendered as "0"', () => {
      const none = createCentralStatusCard(baseParams());
      expect(none.el.querySelector('[data-role="alarm-badge"]')).toBeNull();
      none.destroy();

      const zero = createCentralStatusCard({ ...baseParams(), alarmCount: 0 });
      expect(zero.el.querySelector('[data-role="alarm-badge"]')).toBeNull();
    });

    it('shows the count (capped at "99+") with a pt-BR pluralized aria-label', () => {
      const one = createCentralStatusCard({ ...baseParams(), alarmCount: 1 });
      expect(one.el.querySelector('[data-role="alarm-badge"] span')?.textContent).toBe('1');
      expect(one.el.querySelector('[data-role="alarm-badge"]')?.getAttribute('aria-label')).toBe('1 alarme ativo');

      const many = createCentralStatusCard({ ...baseParams(), alarmCount: 150 });
      expect(many.el.querySelector('[data-role="alarm-badge"] span')?.textContent).toBe('99+');
      expect(many.el.querySelector('[data-role="alarm-badge"]')?.getAttribute('aria-label')).toBe('150 alarmes ativos');
    });

    it('fires onAlarmBadgeClick only when provided (matches the original\'s pointer-events:none default)', () => {
      const onAlarmBadgeClick = vi.fn();
      const card = createCentralStatusCard({ ...baseParams(), id: 'central-9', alarmCount: 3, onAlarmBadgeClick });
      card.el.querySelector<HTMLElement>('[data-role="alarm-badge"]')!.click();
      expect(onAlarmBadgeClick).toHaveBeenCalledWith({ id: 'central-9', source: 'central-status-card' });
    });
  });

  describe('ticket badge (bottom-left, cyan, headphone)', () => {
    it('hidden entirely when 0/omitted', () => {
      const none = createCentralStatusCard(baseParams());
      expect(none.el.querySelector('[data-role="ticket-badge"]')).toBeNull();
      none.destroy();
      const zero = createCentralStatusCard({ ...baseParams(), ticketCount: 0 });
      expect(zero.el.querySelector('[data-role="ticket-badge"]')).toBeNull();
    });

    it('shows the count pill (capped at "99+") with a pt-BR pluralized aria-label', () => {
      const card = createCentralStatusCard({ ...baseParams(), ticketCount: 150 });
      expect(card.el.querySelector('.myio-cscard__ticket-badge-count')?.textContent).toBe('99+');
      expect(card.el.querySelector('[data-role="ticket-badge"]')?.getAttribute('aria-label')).toBe('150 chamados abertos');
    });

    it('fires onTicketBadgeClick with {id, source}', () => {
      const onTicketBadgeClick = vi.fn();
      const card = createCentralStatusCard({ ...baseParams(), id: 'central-9', ticketCount: 2, onTicketBadgeClick });
      card.el.querySelector<HTMLElement>('[data-role="ticket-badge"]')!.click();
      expect(onTicketBadgeClick).toHaveBeenCalledWith({ id: 'central-9', source: 'central-status-card' });
    });
  });

  describe('annotation badges (right-edge stack, one per type)', () => {
    it('renders one badge per present, non-zero type, in pending/maintenance/activity/observation order', () => {
      const card = createCentralStatusCard({
        ...baseParams(),
        annotationCounts: { observation: 2, pending: 1, activity: 0 },
      });
      const badges = Array.from(card.el.querySelectorAll<HTMLElement>('[data-role="annotation-badge"]'));
      expect(badges.map((b) => b.dataset.type)).toEqual(['pending', 'observation']); // activity omitted (0), maintenance omitted (absent)
    });

    it('each type gets its own faithful color (#d63031 pending / #e17055 maintenance / #00b894 activity / #0984e3 observation)', () => {
      const card = createCentralStatusCard({
        ...baseParams(),
        annotationCounts: { pending: 1, maintenance: 1, activity: 1, observation: 1 },
      });
      const byType = (t: string) => card.el.querySelector<HTMLElement>(`[data-role="annotation-badge"][data-type="${t}"]`)!;
      expect(byType('pending').style.background).toBe('rgb(214, 48, 49)'); // #d63031
      expect(byType('maintenance').style.background).toBe('rgb(225, 112, 85)'); // #e17055
      expect(byType('activity').style.background).toBe('rgb(0, 184, 148)'); // #00b894
      expect(byType('observation').style.background).toBe('rgb(9, 132, 227)'); // #0984e3
    });

    it('omitted entirely when annotationCounts is not provided', () => {
      const card = createCentralStatusCard(baseParams());
      expect(card.el.querySelector('.myio-cscard__annotation-badges')).toBeNull();
    });

    it('fires onAnnotationBadgeClick with {id, type, source}', () => {
      const onAnnotationBadgeClick = vi.fn();
      const card = createCentralStatusCard({
        ...baseParams(),
        id: 'central-9',
        annotationCounts: { maintenance: 4 },
        onAnnotationBadgeClick,
      });
      card.el.querySelector<HTMLElement>('[data-role="annotation-badge"]')!.click();
      expect(onAnnotationBadgeClick).toHaveBeenCalledWith({ id: 'central-9', type: 'maintenance', source: 'central-status-card' });
    });
  });

  it('badges are root-level children (siblings of .myio-cscard__surface) — hang outside the clipped surface, never collide with the left action column', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      alarmCount: 1,
      ticketCount: 1,
      annotationCounts: { pending: 1 },
      onOpenReport: vi.fn(), // forces the left action column to render too
    });
    const alarmBadge = card.el.querySelector('[data-role="alarm-badge"]')!;
    const ticketBadge = card.el.querySelector('[data-role="ticket-badge"]')!;
    const annotationBadges = card.el.querySelector('.myio-cscard__annotation-badges')!;
    expect(alarmBadge).toBeTruthy();
    expect(ticketBadge).toBeTruthy();
    expect(annotationBadges).toBeTruthy();
    // root-level, not nested inside the clipped .myio-cscard__surface —
    // otherwise the negative left/right offsets that hang them outside the
    // surface would be clipped by its overflow:hidden.
    expect(alarmBadge.parentElement).toBe(card.el);
    expect(ticketBadge.parentElement).toBe(card.el);
    expect(annotationBadges.parentElement).toBe(card.el);
    expect(card.el.querySelector('.myio-cscard__actioncol')).toBeTruthy(); // both coexist
  });
});

describe('CentralStatusCard — handle API', () => {
  it('update(patch) re-renders keeping the same root element', () => {
    const card = createCentralStatusCard(baseParams());
    const el = card.el;
    card.update({ name: 'Nova Central' });
    expect(card.el).toBe(el);
    expect(card.el.querySelector('.myio-cscard__title')?.textContent).toBe('Nova Central');
  });

  it('setThemeMode("dark") flips the theme attribute', () => {
    const card = createCentralStatusCard(baseParams());
    card.setThemeMode('dark');
    expect(card.el.dataset.theme).toBe('dark');
  });

  it('update() preserves focus on the monitoring switch across the full innerHTML re-render', () => {
    const card = createCentralStatusCard(baseParams());
    const sw = card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    sw.focus();
    expect(document.activeElement).toBe(sw);

    card.update({ lastAttemptAt: new Date().toISOString() }); // periodic refresh, e.g. every 10s in prod

    const swAfter = card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!;
    expect(swAfter).not.toBe(sw); // innerHTML rebuild really did create a new node
    expect(document.activeElement).toBe(swAfter); // ...but focus followed it
  });

  it('does not try to restore focus when nothing inside the card was focused', () => {
    const card = createCentralStatusCard(baseParams());
    (document.activeElement as HTMLElement | null)?.blur?.();
    expect(() => card.update({ lastAttemptAt: new Date().toISOString() })).not.toThrow();
  });

  it('setMonitoring/setStatus are programmatic and bypass confirm', () => {
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, entityStatus: 'ACTIVE' });
    card.setMonitoring(false);
    card.setStatus('INACTIVE');
    expect(openConfirmDialogMock).not.toHaveBeenCalled();
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!.checked).toBe(false);
    expect(card.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch')!.checked).toBe(false);
  });

  it('destroy() removes the element from the DOM', () => {
    const card = createCentralStatusCard(baseParams());
    const el = card.el;
    expect(container.contains(el)).toBe(true);
    card.destroy();
    expect(container.contains(el)).toBe(false);
  });

  it('degrades gracefully to a native confirm() fallback when openConfirmDialog throws', async () => {
    openConfirmDialogMock.mockRejectedValue(new Error('dialog unavailable'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onMonitoringToggle = vi.fn().mockResolvedValue(undefined);
    const card = createCentralStatusCard({ ...baseParams(), monitoringEnabled: true, onMonitoringToggle });
    flip(card.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch')!, false);
    await vi.waitFor(() => expect(onMonitoringToggle).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
