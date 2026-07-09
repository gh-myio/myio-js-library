/**
 * CustomerGoalsCard v1.0.0 (RFC-0217)
 * Per-shopping "small multiples" card faithful to logs/025-card-GoalsByCustomer.png:
 * 3-series sparkline (Realizado green solid, A-1 blue solid, Orçado amber dashed),
 * totals strip (series-colored labels) and variance badges (vs A-1, vs Orçado).
 *
 * Chart engine: window.Chart (Chart.js, host-provided). The library does NOT
 * bundle Chart.js — when absent, the chart area renders a quiet placeholder.
 */

import {
  CustomerGoalsCardInstance,
  CustomerGoalsCardOptions,
  CustomerGoalsCardParams,
  CustomerGoalsChartType,
  CustomerGoalsSeries,
  CustomerGoalsThemeMode,
  CustomerGoalsTotals,
} from './types';
import { injectCustomerGoalsCardStyles } from './styles';

const COLORS = {
  realized: '#22c55e',
  prev: '#3b82f6',
  budget: '#f59e0b',
};

type ChartLike = { destroy(): void; resize?(): void };

export class CustomerGoalsCard implements CustomerGoalsCardInstance {
  public el: HTMLElement;

  private params: CustomerGoalsCardParams;
  private themeMode: CustomerGoalsThemeMode;
  private locale: string;
  private chart: ChartLike | null = null;
  private chartType: CustomerGoalsChartType;
  private showPoints: boolean;
  private expanded = false;
  private onEscKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(params: CustomerGoalsCardParams) {
    this.params = { ...params, series: { ...params.series } };
    this.themeMode = params.themeMode || 'light';
    this.locale = params.locale || 'pt-BR';
    this.chartType = params.options?.chartType || 'line';
    this.showPoints = params.options?.showPoints !== false;

    injectCustomerGoalsCardStyles();

    this.el = document.createElement('div');
    this.el.className = 'myio-cgc';
    this.el.dataset.theme = this.themeMode;
    this.renderInner();
    params.container.appendChild(this.el);
    this.renderChart();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public update(
    partial: Partial<Pick<CustomerGoalsCardParams, 'series' | 'totals' | 'title'>>
  ): void {
    if (partial.title !== undefined) this.params.title = partial.title;
    if (partial.series !== undefined) this.params.series = { ...partial.series };
    if (partial.totals !== undefined) this.params.totals = partial.totals;
    this.renderInner();
    this.renderChart();
  }

  public setThemeMode(mode: CustomerGoalsThemeMode): void {
    if (mode === this.themeMode) return;
    this.themeMode = mode;
    this.el.dataset.theme = mode;
    // Chart tick/grid colors are theme-dependent — rebuild
    this.renderChart();
  }

  public setOptions(options: CustomerGoalsCardOptions): void {
    if (options.chartType !== undefined) this.chartType = options.chartType;
    if (options.showPoints !== undefined) this.showPoints = options.showPoints;
    this.renderChart();
  }

  public toggleExpand(force?: boolean): void {
    const next = force !== undefined ? force : !this.expanded;
    if (next === this.expanded) return;
    this.expanded = next;
    this.el.classList.toggle('myio-cgc--full', this.expanded);
    const btn = this.el.querySelector('.myio-cgc__expand');
    if (btn) {
      btn.textContent = this.expanded ? '✕' : '⛶';
      btn.setAttribute('title', this.expanded ? 'Recolher' : 'Expandir');
    }
    if (this.expanded) {
      this.onEscKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.toggleExpand(false);
        }
      };
      document.addEventListener('keydown', this.onEscKey, true);
    } else if (this.onEscKey) {
      document.removeEventListener('keydown', this.onEscKey, true);
      this.onEscKey = null;
    }
    // Chart.js re-mede o canvas após o reflow do layout
    setTimeout(() => this.chart?.resize?.(), 60);
  }

  public destroy(): void {
    if (this.onEscKey) {
      document.removeEventListener('keydown', this.onEscKey, true);
      this.onEscKey = null;
    }
    this.destroyChart();
    this.el.remove();
  }

  // ── Derived values ────────────────────────────────────────────────────────

  private resolvedTotals(): Required<CustomerGoalsTotals> {
    const s = this.params.series;
    const sum = (arr?: Array<number | null>): number | null => {
      if (!arr || !arr.length) return null;
      let total = 0;
      let seen = false;
      for (const v of arr) {
        if (v == null || Number.isNaN(Number(v))) continue;
        total += Number(v);
        seen = true;
      }
      return seen ? total : null;
    };
    const o = this.params.totals || {};
    return {
      realized: o.realized !== undefined ? o.realized : sum(s.realized),
      previousYear: o.previousYear !== undefined ? o.previousYear : sum(s.previousYear),
      budget: o.budget !== undefined ? o.budget : sum(s.budget),
    };
  }

  /**
   * Quantity with automatic unit scaling: kWh ≥ 1.000 renders as MWh
   * (≥ 1.000.000 as GWh). Other units (m³) pass through with the unit suffix.
   */
  private fmtQty(v: number | null): string {
    if (v == null || Number.isNaN(Number(v))) return '—';
    let n = Number(v);
    let u = this.params.unit || 'kWh';
    if (u === 'kWh') {
      if (Math.abs(n) >= 1e6) {
        n = n / 1e6;
        u = 'GWh';
      } else if (Math.abs(n) >= 1e3) {
        n = n / 1e3;
        u = 'MWh';
      }
    }
    const txt = n.toLocaleString(this.locale, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
    return `${txt} ${u}`;
  }

  /** Compact axis ticks like the reference ("1M", "2M", "500k") */
  private fmtCompact(v: number): string {
    const abs = Math.abs(v);
    const num = (n: number) =>
      n.toLocaleString(this.locale, { maximumFractionDigits: n < 10 ? 1 : 0 });
    if (abs >= 1e9) return `${num(v / 1e9)}B`;
    if (abs >= 1e6) return `${num(v / 1e6)}M`;
    if (abs >= 1e3) return `${num(v / 1e3)}k`;
    return num(v);
  }

  /** Variance badge: consumption ABOVE the reference is bad (↑ red); below is good (↓ green). */
  private deltaBadge(realized: number | null, reference: number | null): string {
    if (realized == null || reference == null || reference === 0) {
      return '<span class="myio-cgc__delta-value myio-cgc__delta-value--neutral">—</span>';
    }
    const pct = ((realized - reference) / reference) * 100;
    const txt = `${Math.abs(pct).toLocaleString(this.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
    if (pct > 0) {
      return `<span class="myio-cgc__delta-value myio-cgc__delta-value--bad">&#8593; ${txt}</span>`;
    }
    if (pct < 0) {
      return `<span class="myio-cgc__delta-value myio-cgc__delta-value--good">&#8595; ${txt}</span>`;
    }
    return `<span class="myio-cgc__delta-value myio-cgc__delta-value--neutral">${txt}</span>`;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private esc(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private renderInner(): void {
    const s = this.params.series;
    const totals = this.resolvedTotals();
    const hasPrev = !!s.previousYear;
    const hasBudget = !!s.budget;

    const totalCells: string[] = [
      `<div class="myio-cgc__total">
         <span class="myio-cgc__total-label myio-cgc__total-label--realized">Realizado</span>
         <span class="myio-cgc__total-value" data-total="realized">${this.fmtQty(totals.realized)}</span>
       </div>`,
    ];
    if (hasPrev) {
      totalCells.push(`<div class="myio-cgc__total">
        <span class="myio-cgc__total-label myio-cgc__total-label--prev">A-1</span>
        <span class="myio-cgc__total-value" data-total="prev">${this.fmtQty(totals.previousYear)}</span>
      </div>`);
    }
    if (hasBudget) {
      totalCells.push(`<div class="myio-cgc__total">
        <span class="myio-cgc__total-label myio-cgc__total-label--budget">Or&ccedil;ado</span>
        <span class="myio-cgc__total-value" data-total="budget">${this.fmtQty(totals.budget)}</span>
      </div>`);
    }
    const totalsMod =
      totalCells.length === 1 ? ' myio-cgc__totals--one' : totalCells.length === 2 ? ' myio-cgc__totals--two' : '';

    const deltaCells: string[] = [];
    if (hasPrev) {
      deltaCells.push(`<div class="myio-cgc__delta">
        <span class="myio-cgc__delta-label">vs A-1</span>
        ${this.deltaBadge(totals.realized, totals.previousYear)}
      </div>`);
    }
    if (hasBudget) {
      deltaCells.push(`<div class="myio-cgc__delta">
        <span class="myio-cgc__delta-label">vs Or&ccedil;ado</span>
        ${this.deltaBadge(totals.realized, totals.budget)}
      </div>`);
    }
    const deltasHtml = deltaCells.length
      ? `<div class="myio-cgc__deltas${deltaCells.length === 1 ? ' myio-cgc__deltas--one' : ''}">${deltaCells.join('')}</div>`
      : '';

    const clickable = typeof this.params.onClick === 'function';
    const expandable = this.params.expandable !== false;
    this.el.innerHTML = `
      ${expandable ? `<button type="button" class="myio-cgc__expand" title="${this.expanded ? 'Recolher' : 'Expandir'}">${this.expanded ? '✕' : '⛶'}</button>` : ''}
      <h4 class="myio-cgc__title${clickable ? ' myio-cgc__title--clickable' : ''}" title="${this.esc(this.params.title)}">${this.esc(this.params.title)}</h4>
      <div class="myio-cgc__chart"><canvas></canvas></div>
      <div class="myio-cgc__totals${totalsMod}">${totalCells.join('')}</div>
      ${deltasHtml}
    `;

    if (clickable) {
      const title = this.el.querySelector('.myio-cgc__title');
      title?.addEventListener('click', () => this.params.onClick?.({ title: this.params.title }));
    }
    if (expandable) {
      this.el
        .querySelector('.myio-cgc__expand')
        ?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleExpand();
        });
    }
  }

  private destroyChart(): void {
    try {
      this.chart?.destroy();
    } catch {
      /* chart já destruído */
    }
    this.chart = null;
  }

  private renderChart(): void {
    this.destroyChart();
    const wrap = this.el.querySelector('.myio-cgc__chart') as HTMLElement | null;
    if (!wrap) return;

    const ChartCtor = (globalThis as any).Chart;
    if (typeof ChartCtor !== 'function') {
      wrap.innerHTML = '<div class="myio-cgc__chart-empty">gr&aacute;fico indispon&iacute;vel</div>';
      return;
    }
    let canvas = wrap.querySelector('canvas');
    if (!canvas) {
      wrap.innerHTML = '<canvas></canvas>';
      canvas = wrap.querySelector('canvas');
    }

    const s: CustomerGoalsSeries = this.params.series;
    const dark = this.themeMode === 'dark';
    const tickColor = dark ? '#94a3b8' : '#64748b';
    const gridColor = dark ? 'rgba(148,163,184,.14)' : 'rgba(100,116,139,.16)';
    const unit = this.params.unit || 'kWh';
    const yl = this.params.yearLabels;

    const pointR = this.showPoints ? 2.5 : 0;
    const asBar = this.chartType === 'bar';
    const mainSeries = (label: string, data: Array<number | null>, color: string): any =>
      asBar
        ? {
            type: 'bar',
            label,
            data,
            backgroundColor: color,
            borderRadius: 2,
          }
        : {
            type: 'line',
            label,
            data,
            borderColor: color,
            backgroundColor: color,
            pointRadius: pointR,
            pointHoverRadius: 4,
            borderWidth: 2,
            tension: 0.3,
            spanGaps: true,
            fill: false,
          };

    const datasets: any[] = [];
    if (s.budget) {
      // Orçado é SEMPRE linha tracejada (overlay), mesmo no modo barra
      datasets.push({
        type: 'line',
        label: yl ? `Orçado (${yl.current})` : 'Orçado',
        data: s.budget,
        borderColor: COLORS.budget,
        backgroundColor: COLORS.budget,
        borderDash: [6, 4],
        pointStyle: 'rect',
        pointRadius: pointR,
        pointHoverRadius: 4,
        borderWidth: 2,
        tension: 0.3,
        spanGaps: true,
        fill: false,
        order: 0,
      });
    }
    datasets.push({
      ...mainSeries(yl ? `Realizado (${yl.current})` : 'Realizado', s.realized, COLORS.realized),
      order: 1,
    });
    if (s.previousYear) {
      datasets.push({
        ...mainSeries(yl ? `A-1 (${yl.previous})` : 'A-1', s.previousYear, COLORS.prev),
        order: 2,
      });
    }

    this.chart = new ChartCtor((canvas as HTMLCanvasElement).getContext('2d'), {
      type: this.chartType,
      data: { labels: s.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false }, // shared legend is rendered once by the host grid
          tooltip: {
            callbacks: {
              label: (c: any) =>
                `${c.dataset.label}: ${
                  c.parsed.y == null
                    ? '—'
                    : `${Number(c.parsed.y).toLocaleString(this.locale, { maximumFractionDigits: 2 })} ${unit}`
                }`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tickColor, font: { size: 9 }, maxTicksLimit: 4, maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: tickColor,
              font: { size: 9 },
              maxTicksLimit: 4,
              callback: (v: number) => this.fmtCompact(Number(v)),
            },
            grid: { color: gridColor },
          },
        },
      },
    }) as ChartLike;
  }
}

/**
 * Factory (library public API)
 */
export function createCustomerGoalsCard(params: CustomerGoalsCardParams): CustomerGoalsCardInstance {
  return new CustomerGoalsCard(params);
}
