/**
 * RFC-0217 — CustomerGoalsCard v1.0.0
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCustomerGoalsCard } from '../../../../src/components/cards/customer-goals/v1.0.0';

const destroySpy = vi.fn();

class ChartStub {
  static instances: ChartStub[] = [];
  ctx: unknown;
  config: any;
  constructor(ctx: unknown, config: any) {
    this.ctx = ctx;
    this.config = config;
    ChartStub.instances.push(this);
  }
  destroy() {
    destroySpy();
  }
}

const baseSeries = () => ({
  labels: ['Jan', 'Fev', 'Mar', 'Abr'],
  realized: [100, 200, null, 300],
  previousYear: [150, 150, 150, 150],
  budget: [200, 200, 200, 200],
});

let container: HTMLElement;

beforeEach(() => {
  ChartStub.instances = [];
  destroySpy.mockClear();
  (globalThis as any).Chart = ChartStub;
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  delete (globalThis as any).Chart;
  container.remove();
});

describe('CustomerGoalsCard (RFC-0217)', () => {
  it('renders title, totals strip (kWh auto-scaled to GWh) and both delta badges', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'Shopping Alpha',
      series: {
        labels: ['Jan'],
        realized: [1486520],
        previousYear: [1512300],
        budget: [1500000],
      },
    });
    expect(card.el.querySelector('.myio-cgc__title')?.textContent).toBe('Shopping Alpha');
    expect(card.el.querySelector('[data-total="realized"]')?.textContent).toBe('1,49 GWh');
    expect(card.el.querySelector('[data-total="prev"]')?.textContent).toBe('1,51 GWh');
    expect(card.el.querySelector('[data-total="budget"]')?.textContent).toBe('1,5 GWh');
    expect(card.el.querySelectorAll('.myio-cgc__delta').length).toBe(2);
  });

  it('scales kWh to MWh from 1.000 and keeps m³ untouched', () => {
    const mwh = createCustomerGoalsCard({
      container,
      title: 'M',
      series: { labels: ['a'], realized: [45250] },
    });
    expect(mwh.el.querySelector('[data-total="realized"]')?.textContent).toBe('45,25 MWh');
    const agua = createCustomerGoalsCard({
      container,
      title: 'W',
      unit: 'm³',
      series: { labels: ['a'], realized: [4344] },
    });
    expect(agua.el.querySelector('[data-total="realized"]')?.textContent).toBe('4.344 m³');
  });

  it('delta math: above reference = up/bad, below = down/good', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'X',
      series: { labels: ['a'], realized: [110], previousYear: [100], budget: [120] },
    });
    const deltas = card.el.querySelectorAll('.myio-cgc__delta-value');
    // vs A-1: 110 vs 100 → +10% → bad (↑)
    expect(deltas[0].className).toContain('--bad');
    expect(deltas[0].textContent).toContain('↑');
    expect(deltas[0].textContent).toContain('10,00%');
    // vs Orçado: 110 vs 120 → -8,33% → good (↓)
    expect(deltas[1].className).toContain('--good');
    expect(deltas[1].textContent).toContain('↓');
    expect(deltas[1].textContent).toContain('8,33%');
  });

  it('null/zero reference renders a neutral em-dash badge', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'X',
      series: { labels: ['a'], realized: [110], budget: [0] },
    });
    const badge = card.el.querySelector('.myio-cgc__delta-value');
    expect(badge?.className).toContain('--neutral');
    expect(badge?.textContent).toBe('—');
  });

  it('totals default to the sum of non-null points; explicit totals override wins', () => {
    const auto = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    expect(auto.el.querySelector('[data-total="realized"]')?.textContent).toBe('600 kWh'); // 100+200+300
    const overridden = createCustomerGoalsCard({
      container,
      title: 'B',
      series: baseSeries(),
      totals: { realized: 999999 },
    });
    expect(overridden.el.querySelector('[data-total="realized"]')?.textContent).toBe('1.000 MWh');
  });

  it('omits strip cells and badges for absent optional series', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'X',
      series: { labels: ['a'], realized: [10] },
    });
    expect(card.el.querySelectorAll('.myio-cgc__total').length).toBe(1);
    expect(card.el.querySelector('.myio-cgc__deltas')).toBeNull();
  });

  it('update() re-renders values keeping the same root element', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    const el = card.el;
    card.update({ title: 'Novo', series: { labels: ['a'], realized: [42] } });
    expect(card.el).toBe(el);
    expect(el.querySelector('.myio-cgc__title')?.textContent).toBe('Novo');
    expect(el.querySelector('[data-total="realized"]')?.textContent).toBe('42 kWh');
  });

  it('setThemeMode swaps the data-theme attribute and rebuilds the chart', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    const before = ChartStub.instances.length;
    card.setThemeMode('dark');
    expect(card.el.dataset.theme).toBe('dark');
    expect(ChartStub.instances.length).toBe(before + 1);
  });

  it('destroy() removes the element and destroys the chart', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    card.destroy();
    expect(container.querySelector('.myio-cgc')).toBeNull();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('renders a placeholder (no throw) when window.Chart is absent', () => {
    delete (globalThis as any).Chart;
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    expect(card.el.querySelector('.myio-cgc__chart-empty')?.textContent).toContain('indisponível');
  });

  it('setOptions({showPoints:false}) removes point markers from line series', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    card.setOptions({ showPoints: false });
    const cfg = ChartStub.instances.at(-1)!.config;
    cfg.data.datasets
      .filter((d: any) => d.type === 'line')
      .forEach((d: any) => expect(d.pointRadius).toBe(0));
  });

  it('setOptions({chartType:"bar"}) makes realized/A-1 bars while Orçado stays a dashed line', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    card.setOptions({ chartType: 'bar' });
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.type).toBe('bar');
    const byLabel = (frag: string) => cfg.data.datasets.find((d: any) => d.label.includes(frag));
    expect(byLabel('Realizado').type).toBe('bar');
    expect(byLabel('A-1').type).toBe('bar');
    expect(byLabel('Orçado').type).toBe('line');
    expect(byLabel('Orçado').borderDash).toEqual([6, 4]);
  });

  it('toggleExpand() switches fullscreen class and expand button glyph', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries() });
    const btn = card.el.querySelector('.myio-cgc__expand') as HTMLElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(card.el.classList.contains('myio-cgc--full')).toBe(true);
    expect(btn.textContent).toBe('✕');
    card.toggleExpand(false);
    expect(card.el.classList.contains('myio-cgc--full')).toBe(false);
    expect(card.el.querySelector('.myio-cgc__expand')?.textContent).toBe('⛶');
  });

  it('expandable:false omits the expand button', () => {
    const card = createCustomerGoalsCard({ container, title: 'A', series: baseSeries(), expandable: false });
    expect(card.el.querySelector('.myio-cgc__expand')).toBeNull();
  });

  it('builds datasets in order budget(dashed)/realized/previous with legend hidden', () => {
    createCustomerGoalsCard({
      container,
      title: 'A',
      series: baseSeries(),
      yearLabels: { current: '2026', previous: '2025' },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.options.plugins.legend.display).toBe(false);
    const labels = cfg.data.datasets.map((d: any) => d.label);
    expect(labels).toEqual(['Orçado (2026)', 'Realizado (2026)', 'A-1 (2025)']);
    expect(cfg.data.datasets[0].borderDash).toEqual([6, 4]);
  });
});
