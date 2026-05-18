/**
 * RFC-0201 Phase-2 / RFC-0196 — AC-RFC-0196-1, AC-RFC-0196-2.
 *
 * Verifies the TelemetryInfoShopping component:
 *   - Fires `onSliceClick(group)` and dispatches `myio:filter-applied`
 *     when the user activates a slice (legend item proxies the click,
 *     since Chart.js is not loaded under jsdom). (AC-RFC-0196-1)
 *   - Applies the visual ring class (`tis-card--active`) to the clicked
 *     group's card and `tis-card--faded` to siblings. (AC-RFC-0196-1)
 *   - Computes `Erro = Entrada − Σ(consumers)` and includes the slice
 *     in the chart data + Erro card whenever the residual is strictly
 *     positive. (AC-RFC-0196-2)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTelemetryInfoShoppingComponent } from '../../../src/components/telemetry-info-shopping/createTelemetryInfoShoppingComponent';
import type { TelemetryInfoShoppingInstance } from '../../../src/components/telemetry-info-shopping/types';

/**
 * Mount the component into a fresh container detached from <body> isn't
 * enough — `injectStyles` writes to `document.head`, and the Chart.js
 * canvas requires a parent in the document tree for `getBoundingClientRect`
 * to return non-zero dimensions. We attach to `document.body` and clean
 * up between tests.
 */
let container: HTMLElement;

beforeEach(() => {
  // Ensure each test starts from a clean DOM.
  document.body.innerHTML = '';
  container = document.createElement('div');
  // jsdom defaults all element rects to zero — give the Info root a
  // non-zero size so the chart-init dimension check passes (it doesn't
  // matter much since Chart.js itself is undefined in this env).
  container.style.width = '600px';
  container.style.height = '400px';
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TelemetryInfoShopping — onSliceClick (RFC-0196 / AC-RFC-0196-1)', () => {
  it('fires onSliceClick("lojas") + dispatches myio:filter-applied + applies tis-card--active to the lojas card', () => {
    const onSliceClick = vi.fn();
    const filterEvents: CustomEvent[] = [];
    const filterListener = (e: Event) => filterEvents.push(e as CustomEvent);
    window.addEventListener('myio:filter-applied', filterListener);

    let instance: TelemetryInfoShoppingInstance | null = null;
    try {
      instance = createTelemetryInfoShoppingComponent({
        container,
        domain: 'energy',
        themeMode: 'light',
        showChart: true,
        showExpandButton: false,
        debugActive: false,
        onSliceClick,
      });

      // Seed energy data: every consumer + entrada is non-zero so the
      // pie has every slice (and the legend has every chip).
      instance.setEnergyData({
        entrada: { total: 1000 },
        lojas: { total: 400 },
        climatizacao: { total: 200 },
        elevadores: { total: 100 },
        escadasRolantes: { total: 50 },
        outros: { total: 50 },
      });

      // The pie can't be clicked under jsdom (Chart.js is not loaded),
      // but the legend chips share the same `handleSliceClick` path.
      // Find and click the Lojas chip via its data-group.
      const lojasChip = container.querySelector(
        '.tis-legend-item[data-group="lojas"]'
      ) as HTMLElement | null;
      expect(lojasChip).not.toBeNull();

      lojasChip!.click();

      // (1) Callback fired with the canonical group identifier.
      expect(onSliceClick).toHaveBeenCalledTimes(1);
      expect(onSliceClick).toHaveBeenCalledWith('lojas');

      // (2) Global event dispatched with matching detail.
      expect(filterEvents.length).toBe(1);
      expect(filterEvents[0].detail).toMatchObject({
        domain: 'energy',
        group: 'lojas',
      });
      expect(Array.isArray(filterEvents[0].detail.deviceIds)).toBe(true);

      // (3) Visual ring: the lojas card is active, siblings are faded.
      const lojasCard = container.querySelector(
        '.tis-card[data-category="lojas"]'
      ) as HTMLElement | null;
      const climatizacaoCard = container.querySelector(
        '.tis-card[data-category="climatizacao"]'
      ) as HTMLElement | null;
      const totalCard = container.querySelector(
        '.tis-card[data-category="total"]'
      ) as HTMLElement | null;

      expect(lojasCard?.classList.contains('tis-card--active')).toBe(true);
      expect(lojasCard?.classList.contains('tis-card--faded')).toBe(false);
      expect(climatizacaoCard?.classList.contains('tis-card--faded')).toBe(true);
      expect(climatizacaoCard?.classList.contains('tis-card--active')).toBe(false);
      // The "Total Consumidores" card is informational and should never fade.
      expect(totalCard?.classList.contains('tis-card--faded')).toBe(false);

      expect(instance.getActiveGroup()).toBe('lojas');
    } finally {
      window.removeEventListener('myio:filter-applied', filterListener);
      instance?.destroy();
    }
  });

  it('toggles the filter off when the same slice is clicked twice (group becomes null)', () => {
    const onSliceClick = vi.fn();
    const filterEvents: CustomEvent[] = [];
    const filterListener = (e: Event) => filterEvents.push(e as CustomEvent);
    window.addEventListener('myio:filter-applied', filterListener);

    let instance: TelemetryInfoShoppingInstance | null = null;
    try {
      instance = createTelemetryInfoShoppingComponent({
        container,
        domain: 'energy',
        themeMode: 'light',
        showChart: true,
        showExpandButton: false,
        debugActive: false,
        onSliceClick,
      });

      instance.setEnergyData({
        entrada: { total: 1000 },
        lojas: { total: 400 },
        climatizacao: { total: 200 },
        elevadores: { total: 100 },
        escadasRolantes: { total: 50 },
        outros: { total: 50 },
      });

      // First click — activates.
      const lojasChip = container.querySelector(
        '.tis-legend-item[data-group="lojas"]'
      ) as HTMLElement;
      lojasChip.click();
      expect(instance.getActiveGroup()).toBe('lojas');

      // Second click on the same chip — toggle off.
      const lojasChipAgain = container.querySelector(
        '.tis-legend-item[data-group="lojas"]'
      ) as HTMLElement;
      lojasChipAgain.click();

      expect(instance.getActiveGroup()).toBeNull();
      expect(onSliceClick).toHaveBeenCalledTimes(2);

      // Last dispatched event should carry `group: null` (filter cleared).
      expect(filterEvents.length).toBe(2);
      expect(filterEvents[1].detail).toMatchObject({
        domain: 'energy',
        group: null,
      });

      // Visual: no card should be active or faded after toggle-off.
      const lojasCard = container.querySelector(
        '.tis-card[data-category="lojas"]'
      ) as HTMLElement;
      const climatizacaoCard = container.querySelector(
        '.tis-card[data-category="climatizacao"]'
      ) as HTMLElement;
      expect(lojasCard.classList.contains('tis-card--active')).toBe(false);
      expect(lojasCard.classList.contains('tis-card--faded')).toBe(false);
      expect(climatizacaoCard.classList.contains('tis-card--faded')).toBe(false);
    } finally {
      window.removeEventListener('myio:filter-applied', filterListener);
      instance?.destroy();
    }
  });
});

describe('TelemetryInfoShopping — Erro slice calculation (RFC-0196 / AC-RFC-0196-2)', () => {
  it('seeds entrada=100 and Σ(consumers)=88 → Erro slice value 12 is included in the legend', () => {
    let instance: TelemetryInfoShoppingInstance | null = null;
    try {
      instance = createTelemetryInfoShoppingComponent({
        container,
        domain: 'energy',
        themeMode: 'light',
        showChart: true,
        showExpandButton: false,
        debugActive: false,
      });

      // Σ(consumers) = 50 + 20 + 10 + 5 + 3 = 88 → Erro = 100 − 88 = 12.
      instance.setEnergyData({
        entrada: { total: 100 },
        lojas: { total: 50 },
        climatizacao: { total: 20 },
        elevadores: { total: 10 },
        escadasRolantes: { total: 5 },
        outros: { total: 3 },
      });

      // (1) State carries the residual.
      const state = instance.getState() as { erro?: { total: number } } | null;
      expect(state).not.toBeNull();
      expect(state?.erro).toBeDefined();
      expect(state?.erro?.total).toBeCloseTo(12, 6);

      // (2) Erro card text reflects the calculation.
      const erroValueEl = container.querySelector('#erroTotal') as HTMLElement | null;
      expect(erroValueEl).not.toBeNull();
      expect(erroValueEl!.textContent).toMatch(/12,00/);

      // (3) Pie chart legend includes the Erro slice with the same value.
      const erroChip = container.querySelector(
        '.tis-legend-item[data-group="erro"]'
      ) as HTMLElement | null;
      expect(erroChip).not.toBeNull();
      const valueLabel = erroChip!.querySelector('.tis-legend-value');
      expect(valueLabel?.textContent).toMatch(/12,00/);
    } finally {
      instance?.destroy();
    }
  });

  it('renders the placeholder "—" and omits the slice when Σ(consumers) ≥ Entrada', () => {
    let instance: TelemetryInfoShoppingInstance | null = null;
    try {
      instance = createTelemetryInfoShoppingComponent({
        container,
        domain: 'energy',
        themeMode: 'light',
        showChart: true,
        showExpandButton: false,
        debugActive: false,
      });

      // Σ(consumers) = 110 > Entrada = 100 → Erro = -10 (negative). Card
      // shows the placeholder; chart legend has no `erro` chip.
      instance.setEnergyData({
        entrada: { total: 100 },
        lojas: { total: 50 },
        climatizacao: { total: 30 },
        elevadores: { total: 20 },
        escadasRolantes: { total: 5 },
        outros: { total: 5 },
      });

      const state = instance.getState() as { erro?: { total: number } } | null;
      expect(state?.erro?.total).toBeLessThanOrEqual(0);

      const erroValueEl = container.querySelector('#erroTotal') as HTMLElement | null;
      expect(erroValueEl?.textContent).toBe('—');

      const erroChip = container.querySelector('.tis-legend-item[data-group="erro"]');
      expect(erroChip).toBeNull();
    } finally {
      instance?.destroy();
    }
  });
});
