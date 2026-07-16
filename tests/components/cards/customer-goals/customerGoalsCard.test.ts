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

  it('builds datasets in order budget(dashed)/A-1/realized with legend hidden (shopping bar order)', () => {
    createCustomerGoalsCard({
      container,
      title: 'A',
      series: baseSeries(),
      yearLabels: { current: '2026', previous: '2025' },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.options.plugins.legend.display).toBe(false);
    const labels = cfg.data.datasets.map((d: any) => d.label);
    // A-1 antes do Realizado — no modo barra a barrinha do ano anterior fica à esquerda
    expect(labels).toEqual(['Orçado (2026)', 'A-1 (2025)', 'Realizado (2026)']);
    expect(cfg.data.datasets[0].borderDash).toEqual([6, 4]);
    // Padrão de cores do GoalsModal dos shoppings: A-1 grafite, Realizado azul
    expect(cfg.data.datasets[1].borderColor).toBe('#94a3b8');
    expect(cfg.data.datasets[2].borderColor).toBe('#6c5ce7');
  });

  it('breakdown: one chart series per device (replacing consolidated realized) + per-card legend', () => {
    createCustomerGoalsCard({
      container,
      title: 'Shopping Alpha',
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        budget: [40, 40],
        breakdown: [
          { name: 'Entrada #1', values: [10, 20] },
          { name: 'Entrada #2', values: [20, 30] },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const labels = cfg.data.datasets.map((d: any) => d.label);
    // Participação: % do device sobre a soma do breakdown (30/80 e 50/80)
    expect(labels).toEqual(['Orçado', 'Entrada #1 · 37,5%', 'Entrada #2 · 62,5%']);
    // legenda do card aparece no modo breakdown (nomes/cores variam por card)
    expect(cfg.options.plugins.legend.display).toBe(true);
    // cores distintas da paleta para cada medidor
    expect(cfg.data.datasets[1].borderColor).not.toBe(cfg.data.datasets[2].borderColor);
  });

  it('breakdownStacked: devices share stack "realized", A-1/Orçado isolated, axes stacked', () => {
    createCustomerGoalsCard({
      container,
      title: 'A',
      options: { chartType: 'bar', breakdownStacked: true },
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        previousYear: [28, 45],
        budget: [40, 40],
        breakdown: [
          { name: 'M1', values: [10, 20] },
          { name: 'M2', values: [20, 30] },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const byLabel = Object.fromEntries(
      cfg.data.datasets.map((d: any) => [String(d.label).split(' · ')[0], d])
    );
    expect(byLabel['M1'].stack).toBe('realized');
    expect(byLabel['M2'].stack).toBe('realized');
    expect(byLabel['A-1'].stack).toBe('prev');
    expect(byLabel['Orçado'].stack).toBe('goal');
    expect(cfg.options.scales.x.stacked).toBe(true);
    expect(cfg.options.scales.y.stacked).toBe(true);
  });

  // ── RFC-0046 Addendum A: metas por medidor (anos DEVICE) ────────────────────

  it('budgetBreakdown: one DASHED goal line per meter replacing the consolidated Orçado line', () => {
    createCustomerGoalsCard({
      container,
      title: 'Moxuara',
      yearLabels: { current: '2026', previous: '2025' },
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        budget: [40, 40], // consolidado — só alimenta a faixa de totais
        budgetBreakdown: [
          { name: 'Geral Entrada', values: [30, 30] },
          { name: 'Medição Geral CAG', values: [10, 10] },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const labels = cfg.data.datasets.map((d: any) => d.label);
    // Sem a linha consolidada "Orçado (2026)": uma linha de meta POR medidor
    expect(labels).toEqual([
      'Orçado · Geral Entrada',
      'Orçado · Medição Geral CAG',
      'Realizado (2026)',
    ]);
    const goals = cfg.data.datasets.filter((d: any) => String(d.label).startsWith('Orçado ·'));
    goals.forEach((d: any) => {
      expect(d.type).toBe('line');
      expect(d.borderDash).toEqual([6, 4]);
    });
    // cores distintas por medidor + legenda do card visível (nomes variam por card)
    expect(goals[0].borderColor).not.toBe(goals[1].borderColor);
    expect(cfg.options.plugins.legend.display).toBe(true);
    // o filter da legenda mantém as metas por medidor e esconde A-1/Orçado consolidados
    const filter = cfg.options.plugins.legend.labels.filter;
    expect(filter({ text: 'Orçado · Geral Entrada' })).toBe(true);
    expect(filter({ text: 'Orçado (2026)' })).toBe(false);
    expect(filter({ text: 'Orçado' })).toBe(false);
    expect(filter({ text: 'A-1 (2025)' })).toBe(false);
  });

  it('budgetBreakdown: Orçado total falls back to the element-wise sum when budget is absent', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'M',
      series: {
        labels: ['Jan', 'Fev'],
        realized: [10, 10],
        budgetBreakdown: [
          { name: 'A', values: [100, null] },
          { name: 'B', values: [200, 300] },
        ],
      },
    });
    expect(card.el.querySelector('[data-total="budget"]')?.textContent).toBe('600 kWh');
    // e o badge "vs Orçado" existe (hasBudget considera o breakdown)
    const deltaLabels = [...card.el.querySelectorAll('.myio-cgc__delta-label')].map((n) => n.textContent);
    expect(deltaLabels).toContain('vs Orçado');
  });

  it('budgetDetail: consolidated Orçado line keeps a per-meter tooltip breakdown (afterLabel)', () => {
    createCustomerGoalsCard({
      container,
      title: 'Moxuara',
      yearLabels: { current: '2026', previous: '2025' },
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        budget: [40, 42],
        budgetDetail: [
          { name: 'Geral Entrada', values: [30, 31] },
          { name: 'Medição Geral CAG', annual: 3519194.31 },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const budgetDs = cfg.data.datasets.find((d: any) => String(d.label).startsWith('Orçado'));
    expect(budgetDs._cgcBudgetDetail).toBe(true);
    const afterLabel = cfg.options.plugins.tooltip.callbacks.afterLabel;
    // hover num bucket da linha de Orçado → detalhamento por medidor
    const lines = afterLabel({ dataset: budgetDs, dataIndex: 1 });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Geral Entrada: 31 kWh');
    expect(lines[1]).toContain('Medição Geral CAG: 3.519.194,31 kWh (anual)');
    // hover em outra série (Realizado) NÃO ganha o detalhamento
    const realizedDs = cfg.data.datasets.find((d: any) => String(d.label).startsWith('Realizado'));
    expect(afterLabel({ dataset: realizedDs, dataIndex: 1 })).toBeUndefined();
  });

  it('budgetDetail is ignored when budgetBreakdown is plotted (no consolidated line to detail)', () => {
    createCustomerGoalsCard({
      container,
      title: 'M',
      series: {
        labels: ['Jan'],
        realized: [10],
        budget: [20],
        budgetBreakdown: [{ name: 'A', values: [20] }],
        budgetDetail: [{ name: 'A', annual: 240 }],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.data.datasets.some((d: any) => d._cgcBudgetDetail)).toBe(false);
  });

  it('breakdownStacked + budgetBreakdown: each goal line gets its own stack (never summed)', () => {
    createCustomerGoalsCard({
      container,
      title: 'M',
      options: { chartType: 'bar', breakdownStacked: true },
      series: {
        labels: ['Jan'],
        realized: [30],
        breakdown: [
          { name: 'M1', values: [10] },
          { name: 'M2', values: [20] },
        ],
        budgetBreakdown: [
          { name: 'M1', values: [15] },
          { name: 'M2', values: [25] },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const goals = cfg.data.datasets.filter((d: any) => String(d.label).startsWith('Orçado ·'));
    expect(goals[0].stack).toBe('goal-0');
    expect(goals[1].stack).toBe('goal-1');
    expect(goals[0].stack).not.toBe(goals[1].stack);
  });

  it('without the new options the card behaves exactly as before (compat)', () => {
    createCustomerGoalsCard({
      container,
      title: 'A',
      series: baseSeries(),
      yearLabels: { current: '2026', previous: '2025' },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.data.datasets.map((d: any) => d.label)).toEqual([
      'Orçado (2026)',
      'A-1 (2025)',
      'Realizado (2026)',
    ]);
    expect(cfg.options.plugins.legend.display).toBe(false);
    expect(cfg.data.datasets.some((d: any) => d._cgcBudgetDetail)).toBe(false);
  });

  // ── Orçado (value cru) × Meta (adjustedValue) — 3 colunas / 2 linhas ────────

  it('orcado + budget: grade 3×2 — linha 1 valores (Orçado, sem Meta empilhada); linha 2 col3 = Meta', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'Shopping da Ilha',
      series: {
        labels: ['Jan'],
        realized: [586000],
        previousYear: [600000],
        budget: [663000], // Meta (adjustedValue)
        orcado: [697790], // Orçado (value cru)
      },
    });
    // Linha 1 (valores): Realizado | A-1 | Orçado — 3 colunas, SEM Meta empilhada
    // (fmtQty do card arredonda ≥100 p/ inteiro — comportamento existente)
    expect(card.el.querySelector('[data-total="orcado"]')?.textContent).toBe('698 MWh');
    expect(card.el.querySelectorAll('.myio-cgc__total').length).toBe(3); // realized + A-1 + orçado
    expect(card.el.querySelector('.myio-cgc__total-sub')).toBeNull(); // Meta saiu da linha 1
    // Linha 2: 3 colunas alinhadas → vs A-1 | vs Orçado | Meta <valor> (+ chip vs Meta)
    expect(card.el.querySelector('.myio-cgc__deltas')?.className).toContain('myio-cgc__deltas--three');
    const deltaLabels = [...card.el.querySelectorAll('.myio-cgc__delta-label')].map((n) => n.textContent);
    expect(deltaLabels).toEqual(['vs A-1', 'vs Orçado', 'Meta 663 MWh']);
    // Meta agora na col3 da linha 2 (data-total="budget")
    expect(card.el.querySelector('[data-total="budget"]')?.textContent).toBe('Meta 663 MWh');
    // 3 badges de desvio (vs A-1, vs Orçado, vs Meta)
    expect(card.el.querySelectorAll('.myio-cgc__delta').length).toBe(3);
  });

  it('orcado + budget: chart plots BOTH a Meta line and a distinct Orçado overlay line', () => {
    createCustomerGoalsCard({
      container,
      title: 'Ilha',
      yearLabels: { current: '2026', previous: '2025' },
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        previousYear: [28, 45],
        budget: [40, 40], // Meta
        orcado: [42, 42], // Orçado
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const byLabel = (frag: string) => cfg.data.datasets.find((d: any) => d.label === frag);
    const meta = byLabel('Meta (2026)');
    const orcado = byLabel('Orçado (2026)');
    expect(meta).toBeTruthy();
    expect(orcado).toBeTruthy();
    // Ambas linhas tracejadas, mas cores/estilos distintos: Orçado LARANJA, Meta AZUL
    expect(orcado.borderColor).toBe('#f59e0b'); // laranja
    expect(meta.borderColor).toBe('#0ea5e9'); // azul
    expect(meta.borderColor).not.toBe(orcado.borderColor);
    // A série de meta foi relabelada para "Meta" (não "Orçado") quando há orcado cru
    expect(cfg.data.datasets.some((d: any) => d.label === 'Orçado (2026)')).toBe(true);
    expect(cfg.data.datasets.some((d: any) => d.label === 'Meta (2026)')).toBe(true);
  });

  it('orcado: totals default to the element-wise sum of the raw series', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'M',
      series: {
        labels: ['Jan', 'Fev'],
        realized: [10, 10],
        budget: [300, 300],
        orcado: [400, null],
      },
    });
    // Orçado (value cru) na linha 1; Meta (soma do budget) na col3 da linha 2
    expect(card.el.querySelector('[data-total="orcado"]')?.textContent).toBe('400 kWh');
    expect(card.el.querySelector('[data-total="budget"]')?.textContent).toBe('Meta 600 kWh');
  });

  it('budgetBreakdown + orcado: per-meter goal lines relabel to "Meta ·" + one consolidated Orçado line', () => {
    createCustomerGoalsCard({
      container,
      title: 'Ilha',
      yearLabels: { current: '2026', previous: '2025' },
      series: {
        labels: ['Jan', 'Fev'],
        realized: [30, 50],
        budget: [40, 40],
        orcado: [45, 45],
        budgetBreakdown: [
          { name: 'Geral Entrada', values: [30, 30] },
          { name: 'Medição CAG', values: [10, 10] },
        ],
      },
    });
    const cfg = ChartStub.instances.at(-1)!.config;
    const labels = cfg.data.datasets.map((d: any) => d.label);
    // metas por medidor relabeladas p/ "Meta · X" + linha consolidada de Orçado
    expect(labels).toContain('Meta · Geral Entrada');
    expect(labels).toContain('Meta · Medição CAG');
    expect(labels).toContain('Orçado (2026)');
    // filtro da legenda: mantém "Meta · X", esconde "Meta"/"Orçado" consolidados
    const filter = cfg.options.plugins.legend.labels.filter;
    expect(filter({ text: 'Meta · Geral Entrada' })).toBe(true);
    expect(filter({ text: 'Orçado (2026)' })).toBe(false);
    expect(filter({ text: 'Meta (2026)' })).toBe(false);
  });

  it('retrocompat: WITHOUT orcado the card is identical to before (single "Orçado" line, no sub-line)', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'A',
      series: baseSeries(),
      yearLabels: { current: '2026', previous: '2025' },
    });
    // Sem orcado → coluna Orçado com UMA linha (data-total="budget"), sem sub-linha
    expect(card.el.querySelector('[data-total="budget"]')?.textContent).toBe('800 kWh'); // 200*4
    expect(card.el.querySelector('[data-total="orcado"]')).toBeNull();
    expect(card.el.querySelector('.myio-cgc__total-sub')).toBeNull();
    // Delta permanece "vs Orçado" e o gráfico mantém a linha "Orçado (2026)"
    const deltaLabels = [...card.el.querySelectorAll('.myio-cgc__delta-label')].map((n) => n.textContent);
    expect(deltaLabels).toContain('vs Orçado');
    const cfg = ChartStub.instances.at(-1)!.config;
    expect(cfg.data.datasets.map((d: any) => d.label)).toEqual([
      'Orçado (2026)',
      'A-1 (2025)',
      'Realizado (2026)',
    ]);
    // nenhuma linha extra de Orçado/Meta foi adicionada
    expect(cfg.data.datasets.filter((d: any) => /Orçado|Meta/.test(d.label)).length).toBe(1);
  });

  it('breakdown: totals strip falls back to the element-wise sum when realized is empty', () => {
    const card = createCustomerGoalsCard({
      container,
      title: 'Shopping Alpha',
      series: {
        labels: ['Jan', 'Fev'],
        realized: [null, null],
        breakdown: [
          { name: 'A', values: [100, null] },
          { name: 'B', values: [200, 300] },
        ],
      },
    });
    expect(card.el.querySelector('[data-total="realized"]')?.textContent).toBe('600 kWh');
  });
});
