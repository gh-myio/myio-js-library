/**
 * Participation Chart component tests — SVG pie/bars, legend toggle,
 * palette resolution, theme switch, expand/minimize and destroy.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createParticipationChart,
  MYIO_CHART_PALETTE,
  MYIO_CHART_PALETTE_DARK,
  PARTICIPATION_CHART_CSS_PREFIX as P,
} from '../../../src/components/graphs';
import type { ParticipationChartInstance } from '../../../src/components/graphs';

const baseItems = () => [
  { id: 'a', label: 'Loja A', value: 60 },
  { id: 'b', label: 'Loja B', value: 40 },
];

let container: HTMLElement;
let instances: ParticipationChartInstance[];

const make = (params: Parameters<typeof createParticipationChart>[1]) => {
  const inst = createParticipationChart(container, params);
  instances.push(inst);
  return inst;
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  instances = [];
});

afterEach(() => {
  instances.forEach((i) => i.destroy());
  container.remove();
});

describe('createParticipationChart', () => {
  it('renders a pie by default with one slice per item, title and subtitle', () => {
    const chart = make({ items: baseItems(), title: 'Participação', subtitle: 'kWh no período' });
    expect(chart.element.classList.contains(P)).toBe(true);
    expect(chart.element.querySelector(`.${P}__title`)?.textContent).toBe('Participação');
    expect(chart.element.querySelector(`.${P}__subtitle`)?.textContent).toBe('kWh no período');
    const slices = chart.element.querySelectorAll(`path.${P}__slice`);
    expect(slices.length).toBe(2);
    // Percent labels on slices >= 8%
    const labels = Array.from(chart.element.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(labels).toContain('60%');
    expect(labels).toContain('40%');
  });

  it('renders horizontal bars sorted desc by value when chartType is "bars"', () => {
    const chart = make({
      items: [
        { id: 'x', label: 'X', value: 10 },
        { id: 'y', label: 'Y', value: 50 },
        { id: 'z', label: 'Z', value: 30 },
      ],
      chartType: 'bars',
    });
    const rects = Array.from(chart.element.querySelectorAll(`rect.${P}__bar-rect`));
    expect(rects.length).toBe(3);
    expect(rects.map((r) => r.getAttribute('data-key'))).toEqual(['y', 'z', 'x']);
    // Widest bar first
    const widths = rects.map((r) => Number(r.getAttribute('width')));
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  it('type selector pill switches between pie and bars', () => {
    const chart = make({ items: baseItems() });
    expect(chart.element.querySelector(`path.${P}__slice`)).toBeTruthy();
    const barsBtn = chart.element.querySelector(`.${P}__type-btn[data-type="bars"]`) as HTMLElement;
    expect(barsBtn).toBeTruthy();
    barsBtn.click();
    expect(chart.element.querySelector(`path.${P}__slice`)).toBeNull();
    expect(chart.element.querySelectorAll(`rect.${P}__bar-rect`).length).toBe(2);
    const activeBtn = chart.element.querySelector(`.${P}__type-btn.is-active`);
    expect(activeBtn?.getAttribute('data-type')).toBe('bars');
  });

  it('hides the type selector when showTypeSelector is false', () => {
    const chart = make({ items: baseItems(), showTypeSelector: false });
    expect(chart.element.querySelector(`.${P}__type-toggle`)).toBeNull();
  });

  it('legend toggle removes the item and recomputes percentages over the remaining ones', () => {
    const chart = make({ items: baseItems() });
    const chipB = chart.element.querySelector(`.${P}__legend-chip[data-key="b"]`) as HTMLElement;
    chipB.click();

    expect(chart.getHiddenIds()).toEqual(['b']);
    expect(chart.getVisibleItems().map((i) => i.id)).toEqual(['a']);
    // Only one slice remains and it now owns 100%
    expect(chart.element.querySelectorAll(`path.${P}__slice`).length).toBe(1);
    const chipA = chart.element.querySelector(`.${P}__legend-chip[data-key="a"]`) as HTMLElement;
    expect(chipA.querySelector(`.${P}__legend-pct`)?.textContent).toBe('100%');
    // Toggled-off chip: strikethrough style class + em-dash percent
    const offChip = chart.element.querySelector(`.${P}__legend-chip[data-key="b"]`) as HTMLElement;
    expect(offChip.classList.contains('is-off')).toBe(true);
    expect(offChip.querySelector(`.${P}__legend-pct`)?.textContent).toBe('—');

    // Clicking again restores the item
    offChip.click();
    expect(chart.getHiddenIds()).toEqual([]);
    expect(chart.element.querySelectorAll(`path.${P}__slice`).length).toBe(2);
  });

  it('legend is not selectable when legend.selectable is false', () => {
    const chart = make({ items: baseItems(), legend: { selectable: false } });
    const chip = chart.element.querySelector(`.${P}__legend-chip[data-key="a"]`) as HTMLElement;
    expect(chip.classList.contains('is-selectable')).toBe(false);
    chip.click();
    expect(chart.getHiddenIds()).toEqual([]);
  });

  it('falls back to the MYIO default palette and honors an explicit palette', () => {
    const chart = make({ items: baseItems() });
    const slices = chart.element.querySelectorAll(`path.${P}__slice`);
    expect(slices[0].getAttribute('fill')).toBe(MYIO_CHART_PALETTE[0]);
    expect(slices[1].getAttribute('fill')).toBe(MYIO_CHART_PALETTE[1]);

    const custom = make({ items: baseItems(), palette: ['#111111', '#222222'] });
    const customSlices = custom.element.querySelectorAll(`path.${P}__slice`);
    expect(customSlices[0].getAttribute('fill')).toBe('#111111');
    expect(customSlices[1].getAttribute('fill')).toBe('#222222');
  });

  it('random paletteMode is stable per label across re-renders', () => {
    const chart = make({ items: baseItems(), paletteMode: 'random' });
    const before = chart.element
      .querySelector(`path.${P}__slice[data-key="a"]`)
      ?.getAttribute('fill');
    expect(before).toMatch(/^#[0-9a-f]{6}$/i);

    // Re-render with the same labels in a different order — colors follow the label
    chart.updateData([
      { id: 'b', label: 'Loja B', value: 10 },
      { id: 'a', label: 'Loja A', value: 90 },
    ]);
    const after = chart.element
      .querySelector(`path.${P}__slice[data-key="a"]`)
      ?.getAttribute('fill');
    expect(after).toBe(before);
  });

  it('setThemeMode("dark") applies the dark modifier and the dark palette', () => {
    const chart = make({ items: baseItems() });
    chart.setThemeMode('dark');
    expect(chart.element.classList.contains(`${P}--dark`)).toBe(true);
    const slice = chart.element.querySelector(`path.${P}__slice[data-key="a"]`);
    expect(slice?.getAttribute('fill')).toBe(MYIO_CHART_PALETTE_DARK[0]);
    chart.setThemeMode('light');
    expect(chart.element.classList.contains(`${P}--dark`)).toBe(false);
  });

  it('updateSettings toggles legend visibility, border and title', () => {
    const chart = make({ items: baseItems(), title: 'Antes' });
    expect(chart.element.querySelector(`.${P}__legend`)).toBeTruthy();
    expect(chart.element.classList.contains(`${P}--bordered`)).toBe(true);

    chart.updateSettings({ legend: { visible: false }, border: false, title: 'Depois' });
    expect(chart.element.querySelector(`.${P}__legend`)).toBeNull();
    expect(chart.element.classList.contains(`${P}--bordered`)).toBe(false);
    expect(chart.element.querySelector(`.${P}__title`)?.textContent).toBe('Depois');
  });

  it('expand moves the chart into a fullscreen overlay and minimize restores it', () => {
    const chart = make({ items: baseItems(), expandable: true });
    chart.expand();
    const overlay = document.body.querySelector(`.${P}-overlay`);
    expect(overlay).toBeTruthy();
    expect(overlay?.contains(chart.element)).toBe(true);
    expect(chart.element.classList.contains(`${P}--expanded`)).toBe(true);

    chart.minimize();
    expect(document.body.querySelector(`.${P}-overlay`)).toBeNull();
    expect(container.contains(chart.element)).toBe(true);
    expect(chart.element.classList.contains(`${P}--expanded`)).toBe(false);
  });

  it('updateData keeps hidden selection for surviving keys and prunes removed ones', () => {
    const chart = make({
      items: [...baseItems(), { id: 'c', label: 'Loja C', value: 20 }],
    });
    (chart.element.querySelector(`.${P}__legend-chip[data-key="b"]`) as HTMLElement).click();
    (chart.element.querySelector(`.${P}__legend-chip[data-key="c"]`) as HTMLElement).click();
    expect(chart.getHiddenIds().sort()).toEqual(['b', 'c']);

    chart.updateData(baseItems()); // 'c' no longer exists
    expect(chart.getHiddenIds()).toEqual(['b']);
    expect(chart.getVisibleItems().map((i) => i.id)).toEqual(['a']);
  });

  it('renders an empty state without items and a full ring for a single visible item', () => {
    const empty = make({ items: [] });
    expect(empty.element.querySelector(`.${P}__empty`)?.textContent).toContain('Sem dados');

    const single = make({ items: [{ id: 'solo', label: 'Solo', value: 42 }] });
    const slice = single.element.querySelector(`path.${P}__slice`);
    expect(slice).toBeTruthy();
    expect(slice?.getAttribute('fill-rule')).toBe('evenodd'); // full donut ring path
  });

  it('destroy removes the element, overlay and marker from the DOM', () => {
    const chart = make({ items: baseItems(), expandable: true });
    chart.expand();
    chart.destroy();
    expect(container.querySelector(`.${P}`)).toBeNull();
    expect(document.body.querySelector(`.${P}-overlay`)).toBeNull();
    expect(container.querySelector(`.${P}-marker`)).toBeNull();
    // Idempotent
    chart.destroy();
  });
});

describe('AllReportModal smoke (integration compile check)', () => {
  it('module imports and exposes the AllReportModal class', async () => {
    const mod = await import('../../../src/components/premium-modals/report-all/AllReportModal');
    expect(typeof mod.AllReportModal).toBe('function');
  });
});
