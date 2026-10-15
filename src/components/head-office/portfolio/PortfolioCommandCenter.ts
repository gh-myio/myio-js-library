/**
 * RFC-0238 — Head Office Portfolio Command Center (fase 1: overview executivo).
 *
 * Componente de apresentação: recebe um `PortfolioSnapshot` já calculado
 * (`buildPortfolioSnapshot`) e callbacks de navegação. Não busca dados sozinho —
 * a trajetória chega por `setTrajectory`, a pedido (`onTrajectoryRequest`).
 */

import type { PortfolioMetric, PortfolioSnapshot, PriorityItem, ShoppingRow } from '../../../utils/portfolio/types';
import { PCC_CSS, PCC_STYLE_ID } from './styles';

export type PortfolioDestination =
  | 'overview'
  | 'energy'
  | 'demand'
  | 'water'
  | 'goals'
  | 'alarms'
  | 'benchmarking'
  | 'reports'
  | 'administration';

export type TrajectoryDomain = 'energy' | 'water';

export interface TrajectoryPoint {
  /** Início do bucket (ms) */
  ts: number;
  value: number;
}

export type TrajectoryState =
  | { state: 'loading' }
  | { state: 'available'; points: TrajectoryPoint[]; unit: string; scopeLabel: string; partialLast?: boolean }
  | { state: 'unavailable'; reason: string };

export interface PortfolioCommandCenterParams {
  container: HTMLElement;
  snapshot: PortfolioSnapshot | null;
  themeMode?: 'light' | 'dark';
  holdingName?: string;
  /** Clique num KPI → visão correspondente (a navegação principal fica no menu do HO) */
  onNavigate?: (destination: PortfolioDestination) => void;
  onOpenShopping?: (row: ShoppingRow) => void;
  onPriorityOpen?: (item: PriorityItem) => void;
  onTrajectoryRequest?: (domain: TrajectoryDomain) => void;
}

export interface PortfolioCommandCenterInstance {
  element: HTMLElement;
  setSnapshot(snapshot: PortfolioSnapshot | null): void;
  setTrajectory(domain: TrajectoryDomain, state: TrajectoryState): void;
  setThemeMode(mode: 'light' | 'dark'): void;
  destroy(): void;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const nf = (v: number, digits = 0): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** kWh → kWh/MWh/GWh legível */
export function formatEnergy(kwh: number | null): string {
  if (kwh === null) return '—';
  const a = Math.abs(kwh);
  if (a >= 1e6) return `${nf(kwh / 1e6, 2)} GWh`;
  if (a >= 1e3) return `${nf(kwh / 1e3, 1)} MWh`;
  return `${nf(kwh, 0)} kWh`;
}

export function formatWater(m3: number | null): string {
  return m3 === null ? '—' : `${nf(m3, m3 !== 0 && Math.abs(m3) < 100 ? 1 : 0)} m³`;
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const pct = (x: number): string => `${Math.round(x * 100)}%`;

const STATE_BADGE: Record<PortfolioMetric['state'], { cls: string; text: string }> = {
  available: { cls: 'ok', text: 'Completo' },
  partial: { cls: 'warn', text: 'Parcial' },
  unavailable: { cls: '', text: 'Sem dados' },
  'not-configured': { cls: '', text: 'Não configurado' },
};

const SEVERITY_LABEL: Record<PriorityItem['severity'], { cls: string; text: string }> = {
  critical: { cls: 'crit', text: 'Crítico' },
  warning: { cls: 'warn', text: 'Atenção' },
  info: { cls: 'info', text: 'Acompanhar' },
};

export function createPortfolioCommandCenter(params: PortfolioCommandCenterParams): PortfolioCommandCenterInstance {
  ensureStyles();

  let snapshot = params.snapshot;
  let theme: 'light' | 'dark' = params.themeMode ?? 'light';
  let trajectoryDomain: TrajectoryDomain = 'energy';
  const trajectory: Partial<Record<TrajectoryDomain, TrajectoryState>> = {};
  const openWhy = new Set<string>();
  let drawer: { backdrop: HTMLElement; panel: HTMLElement; returnFocus: HTMLElement | null } | null = null;
  let destroyed = false;

  const root = document.createElement('div');
  root.className = 'myio-pcc';
  root.setAttribute('data-testid', 'portfolio-command-center');
  params.container.innerHTML = '';
  params.container.appendChild(root);

  // Responsivo pela largura do container (no ThingsBoard o viewport não reflete o widget)
  const applySize = (width: number) => {
    root.classList.toggle('myio-pcc--md', width < 1024);
    root.classList.toggle('myio-pcc--sm', width < 640);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((e) => applySize(e[0].contentRect.width)) : null;
  ro?.observe(root);
  applySize(params.container.clientWidth || 1440);

  const onClick = (e: Event) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = el.dataset.action;
    switch (action) {
      case 'kpi':
        params.onNavigate?.(el.dataset.dest as PortfolioDestination);
        break;
      case 'trajectory': {
        const d = el.dataset.domain as TrajectoryDomain;
        if (d && d !== trajectoryDomain) {
          trajectoryDomain = d;
          if (!trajectory[d]) requestTrajectory(d);
          renderTrajectory();
        }
        break;
      }
      case 'why': {
        const id = el.dataset.id || '';
        if (openWhy.has(id)) openWhy.delete(id);
        else openWhy.add(id);
        renderPriorities();
        break;
      }
      case 'priority': {
        const item = snapshot?.priorities.find((p) => p.id === el.dataset.id);
        if (item) params.onPriorityOpen?.(item);
        break;
      }
      case 'shopping': {
        const row = snapshot?.shoppings.find((r) => r.name === el.dataset.name);
        if (row) openDrawer(row, el);
        break;
      }
    }
  };
  root.addEventListener('click', onClick);

  function requestTrajectory(d: TrajectoryDomain) {
    trajectory[d] = { state: 'loading' };
    params.onTrajectoryRequest?.(d);
  }

  function render() {
    root.classList.toggle('myio-pcc--dark', theme === 'dark');
    root.innerHTML = `
      <main class="myio-pcc__main">
        <header class="myio-pcc__head" data-region="head"></header>
        <div class="myio-pcc__grid">
          <section class="myio-pcc__span-12" aria-label="Indicadores executivos">
            <div class="myio-pcc__grid" data-region="kpis"></div>
          </section>
          <section class="myio-pcc__panel myio-pcc__span-8" aria-labelledby="pcc-traj-title" data-region="trajectory"></section>
          <section class="myio-pcc__panel myio-pcc__span-4" aria-labelledby="pcc-prio-title" data-region="priorities"></section>
          <section class="myio-pcc__panel myio-pcc__span-12" aria-labelledby="pcc-matrix-title" data-region="matrix"></section>
          <section class="myio-pcc__panel myio-pcc__span-6" aria-labelledby="pcc-drivers-title" data-region="drivers"></section>
          <section class="myio-pcc__panel myio-pcc__span-6" aria-labelledby="pcc-cov-title" data-region="coverage"></section>
        </div>
      </main>`;
    renderHead();
    renderKpis();
    renderTrajectory();
    renderPriorities();
    renderMatrix();
    renderDrivers();
    renderCoverage();
  }

  const region = (name: string) => root.querySelector<HTMLElement>(`[data-region="${name}"]`);

  function renderHead() {
    const el = region('head');
    if (!el) return;
    const s = snapshot;
    el.innerHTML = `
      <div>
        <h2 class="myio-pcc__h1">Portfólio${params.holdingName ? ` · ${esc(params.holdingName)}` : ' da holding'}</h2>
        <div class="myio-pcc__sub">Onde a holding deve agir agora — números com escopo e cobertura explícitos.</div>
      </div>
      <div class="myio-pcc__chips">
        <span class="myio-pcc__chip">🏬 ${s ? s.shoppings.length : '—'} shoppings</span>
        <span class="myio-pcc__chip">📅 ${s ? `${fmtDate(s.period.start)} – ${fmtDate(s.period.end)}` : '—'} <span class="myio-pcc__badge">parcial</span></span>
        <span class="myio-pcc__chip myio-pcc__chip--live">Atualizado ${s ? fmtTime(s.computedAt) : '—'}</span>
      </div>`;
  }

  function kpiCard(m: PortfolioMetric, icon: string, label: string, dest: PortfolioDestination, valueText: string): string {
    const badge = STATE_BADGE[m.state];
    const hasValue = m.value !== null;
    const coverage = m.state === 'not-configured' ? '' : `<span class="myio-pcc__badge">${m.coverage.covered}/${m.coverage.total} shoppings</span>`;
    return `<div class="myio-pcc__span-3">
      <button type="button" class="myio-pcc__kpi" data-action="kpi" data-dest="${dest}" data-state="${m.state}"
        aria-label="${esc(label)}: ${esc(hasValue ? valueText : badge.text)}. ${esc(m.scopeLabel)}">
        <span class="myio-pcc__kpi-label"><span aria-hidden="true">${icon}</span>${esc(label)}</span>
        <span class="myio-pcc__kpi-value ${hasValue ? '' : 'myio-pcc__kpi-value--empty'}">${esc(hasValue ? valueText : badge.text)}</span>
        <span class="myio-pcc__kpi-scope">${esc(m.scopeLabel)}</span>
        ${m.reasons.length ? `<span class="myio-pcc__kpi-scope">${esc(m.reasons[0])}</span>` : ''}
        <span class="myio-pcc__kpi-foot">
          <span class="myio-pcc__badge ${badge.cls ? `myio-pcc__badge--${badge.cls}` : ''}">${badge.text}</span>
          ${coverage}
          ${hasValue ? '<span class="myio-pcc__badge">Meta: não configurada</span>' : ''}
        </span>
      </button>
    </div>`;
  }

  function renderKpis() {
    const el = region('kpis');
    if (!el) return;
    if (!snapshot) {
      el.innerHTML = [0, 1, 2, 3].map(() => '<div class="myio-pcc__span-3"><div class="myio-pcc__skeleton" style="height:150px"></div></div>').join('');
      return;
    }
    const k = snapshot.kpis;
    el.innerHTML =
      kpiCard(k.energy, '⚡', 'Energia', 'energy', formatEnergy(k.energy.value)) +
      kpiCard(k.water, '💧', 'Água', 'water', formatWater(k.water.value)) +
      kpiCard(k.demand, '📈', 'Exposição de demanda', 'demand', '') +
      kpiCard(k.cost, '💰', 'Perspectiva de custo', 'goals', '');
  }

  function renderTrajectory() {
    const el = region('trajectory');
    if (!el) return;
    const st = trajectory[trajectoryDomain];
    const seg = (d: TrajectoryDomain, label: string) =>
      `<button type="button" data-action="trajectory" data-domain="${d}" aria-pressed="${trajectoryDomain === d}">${label}</button>`;
    let body: string;
    if (!st || st.state === 'loading') body = '<div class="myio-pcc__skeleton" aria-busy="true"></div>';
    else if (st.state === 'unavailable') body = `<div class="myio-pcc__empty">${esc(st.reason)}</div>`;
    else body = trajectoryChart(st.points, st.unit, trajectoryDomain, st.partialLast) + trajectoryLegend(st.scopeLabel);
    el.innerHTML = `
      <div class="myio-pcc__panel-head">
        <h3 class="myio-pcc__panel-title" id="pcc-traj-title">Trajetória do portfólio</h3>
        <div class="myio-pcc__seg" role="group" aria-label="Domínio">${seg('energy', 'Energia')}${seg('water', 'Água')}</div>
      </div>
      <div class="myio-pcc__panel-body">${body}</div>`;
  }

  function trajectoryLegend(scope: string): string {
    return `<div class="myio-pcc__legend">
      <span><i></i>Acumulado real</span>
      <span><i class="bar"></i>Consumo diário</span>
      <span><i class="goal"></i>Meta: não configurada no escopo</span>
      <span>Escopo: ${esc(scope)}</span>
    </div>`;
  }

  function trajectoryChart(points: TrajectoryPoint[], unit: string, domain: TrajectoryDomain, partialLast?: boolean): string {
    if (!points.length) return '<div class="myio-pcc__empty">Sem dados no período.</div>';
    const W = 720;
    const H = 220;
    const pad = { l: 76, r: 12, t: 12, b: 26 };
    const cum: number[] = [];
    points.reduce((s, p, i) => (cum[i] = s + p.value), 0);
    const maxCum = Math.max(...cum, 1);
    const maxDay = Math.max(...points.map((p) => p.value), 1);
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const step = iw / points.length;
    const x = (i: number) => pad.l + step * i + step / 2;
    const yCum = (v: number) => pad.t + ih - (v / maxCum) * ih;
    const fmt = (v: number) => (domain === 'energy' ? formatEnergy(v) : formatWater(v));
    const bars = points
      .map((p, i) => {
        const h = (p.value / maxDay) * ih * 0.45;
        const partial = partialLast && i === points.length - 1;
        return `<rect x="${(x(i) - step * 0.32).toFixed(1)}" y="${(pad.t + ih - h).toFixed(1)}" width="${(step * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2"
          style="fill:color-mix(in srgb, var(--pcc-accent) ${partial ? 12 : 25}%, transparent)"><title>${esc(fmtDate(new Date(p.ts).toISOString()))}: ${esc(fmt(p.value))}${partial ? ' (dia em andamento)' : ''}</title></rect>`;
      })
      .join('');
    const line = cum.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yCum(v).toFixed(1)}`).join(' ');
    const grid = [0, 0.5, 1]
      .map((f) => {
        const y = pad.t + ih - f * ih;
        return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke-width="1" style="stroke:var(--pcc-border)"/>
          <text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" style="fill:var(--pcc-muted)">${esc(fmt(maxCum * f))}</text>`;
      })
      .join('');
    const labelEvery = Math.max(1, Math.ceil(points.length / 8));
    const xLabels = points
      .map((p, i) =>
        i % labelEvery === 0
          ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" style="fill:var(--pcc-muted)">${esc(fmtDate(new Date(p.ts).toISOString()))}</text>`
          : ''
      )
      .join('');
    const last = cum[cum.length - 1];
    const summary = `Acumulado de ${fmt(last)} em ${points.length} dia(s); unidade ${unit}.`;
    return `<svg class="myio-pcc__chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
        ${grid}${bars}
        <path d="${line}" fill="none" stroke-width="2.5" style="stroke:var(--pcc-accent)" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(cum.length - 1).toFixed(1)}" cy="${yCum(last).toFixed(1)}" r="4" style="fill:var(--pcc-accent)"/>
        ${xLabels}
      </svg>`;
  }

  function renderPriorities() {
    const el = region('priorities');
    if (!el) return;
    const items = snapshot?.priorities ?? [];
    const list = !snapshot
      ? '<div class="myio-pcc__skeleton"></div>'
      : !items.length
        ? '<div class="myio-pcc__empty">Nenhuma prioridade pelas regras atuais.</div>'
        : `<ol class="myio-pcc__prio">${items
            .map((p) => {
              const sev = SEVERITY_LABEL[p.severity];
              const why = openWhy.has(p.id);
              return `<li class="myio-pcc__prio-item" data-severity="${p.severity}">
                <div class="myio-pcc__prio-top">
                  <span class="myio-pcc__prio-title">${esc(p.title)}</span>
                  <span class="myio-pcc__badge myio-pcc__badge--${sev.cls}">${sev.text}</span>
                </div>
                <div class="myio-pcc__prio-shop">${esc(p.shopping)}</div>
                <div class="myio-pcc__prio-ev">${esc(p.evidence)}</div>
                <div class="myio-pcc__prio-meta">
                  <span>Responsável: não atribuído</span>
                  <button type="button" class="myio-pcc__link" data-action="why" data-id="${esc(p.id)}" aria-expanded="${why}">Por que aparece</button>
                  <button type="button" class="myio-pcc__link" data-action="priority" data-id="${esc(p.id)}">Abrir evidência →</button>
                </div>
                ${why ? `<div class="myio-pcc__why">${esc(p.rule)}</div>` : ''}
              </li>`;
            })
            .join('')}</ol>`;
    el.innerHTML = `
      <div class="myio-pcc__panel-head">
        <h3 class="myio-pcc__panel-title" id="pcc-prio-title">Ações prioritárias</h3>
        <span class="myio-pcc__panel-note">até 5 · regras determinísticas</span>
      </div>
      <div class="myio-pcc__panel-body">${list}</div>`;
  }

  function renderMatrix() {
    const el = region('matrix');
    if (!el) return;
    const rows = snapshot?.shoppings ?? [];
    const nd = '<span class="myio-pcc__nd">Sem dados</span>';
    const conn = (c: { online: number; total: number }) =>
      c.total ? `${c.online}/${c.total}<span class="myio-pcc__cell-sub">${pct(c.online / c.total)} online</span>` : nd;
    const body = rows
      .map((r) => {
        const residual =
          r.water.residual === null
            ? '<span class="myio-pcc__cell-sub">balanço indisponível</span>'
            : `<span class="myio-pcc__cell-sub ${r.water.residual < 0 ? 'myio-pcc__neg' : ''}">residual ${esc(formatWater(r.water.residual))}</span>`;
        const alarms =
          r.alarms.open === null
            ? nd
            : `${r.alarms.open}${(r.alarms.critical ?? 0) > 0 ? `<span class="myio-pcc__cell-sub myio-pcc__neg">${r.alarms.critical} crítico(s)</span>` : '<span class="myio-pcc__cell-sub">nenhum crítico</span>'}`;
        const temp =
          r.temperature.avg === null
            ? nd
            : `${nf(r.temperature.avg, 1)} °C<span class="myio-pcc__cell-sub">${r.temperature.outOfRange}/${r.temperature.sensors} fora da faixa</span>`;
        return `<tr>
          <th scope="row" style="font-weight:inherit;text-transform:none;letter-spacing:0;font-size:13px;color:inherit">
            <button type="button" class="myio-pcc__shop-btn" data-action="shopping" data-name="${esc(r.name)}">${esc(r.name)}</button>
            ${r.attention ? `<span class="myio-pcc__cell-sub">${esc(r.attention)}</span>` : ''}
          </th>
          <td>${r.energy.value === null ? nd : esc(formatEnergy(r.energy.value))}<span class="myio-pcc__cell-sub">${r.energy.devices} submedidores</span></td>
          <td>${r.water.supply === null ? '<span class="myio-pcc__nd">Sem entrada</span>' : esc(formatWater(r.water.supply))}${residual}</td>
          <td>${temp}</td>
          <td><span class="myio-pcc__nd">Não configurado</span></td>
          <td><span class="myio-pcc__nd">Não configurado</span></td>
          <td>${alarms}</td>
          <td>${conn({
            online: r.connectivity.energy.online + r.connectivity.water.online + r.connectivity.temperature.online,
            total: r.connectivity.energy.total + r.connectivity.water.total + r.connectivity.temperature.total,
          })}</td>
        </tr>`;
      })
      .join('');
    el.innerHTML = `
      <div class="myio-pcc__panel-head">
        <h3 class="myio-pcc__panel-title" id="pcc-matrix-title">Desempenho por shopping</h3>
        <span class="myio-pcc__sort-rule">Ordem: ${esc(snapshot?.sortRule ?? '—')}</span>
      </div>
      <div class="myio-pcc__table-wrap" role="region" aria-label="Matriz de shoppings" tabindex="0">
        ${
          !snapshot
            ? '<div class="myio-pcc__panel-body"><div class="myio-pcc__skeleton"></div></div>'
            : !rows.length
              ? '<div class="myio-pcc__empty">Nenhum shopping no escopo.</div>'
              : `<table class="myio-pcc__table">
                <thead><tr>
                  <th scope="col">Shopping</th><th scope="col">Energia</th><th scope="col">Água (entrada)</th>
                  <th scope="col">Temperatura</th><th scope="col">Demanda</th><th scope="col">Metas</th>
                  <th scope="col">Alarmes</th><th scope="col">Conectividade</th>
                </tr></thead>
                <tbody>${body}</tbody>
              </table>`
        }
      </div>`;
  }

  function renderDrivers() {
    const el = region('drivers');
    if (!el) return;
    const cats = snapshot?.categories ?? [];
    const max = Math.max(...cats.map((c) => c.value), 1);
    const bars = cats
      .map(
        (c) => `<div class="myio-pcc__bar-row">
          <span class="myio-pcc__bar-label" title="${esc(c.label)}">${esc(c.label)}</span>
          <span class="myio-pcc__bar-track" role="img" aria-label="${esc(c.label)}: ${esc(formatEnergy(c.value))}, ${pct(c.share)} do total">
            <span class="myio-pcc__bar-fill" data-cat="${c.id}" style="width:${((c.value / max) * 100).toFixed(1)}%"></span>
          </span>
          <span class="myio-pcc__bar-value">${esc(formatEnergy(c.value))}<span class="myio-pcc__cell-sub">${pct(c.share)} · ${c.devices} disp.</span></span>
        </div>`
      )
      .join('');
    el.innerHTML = `
      <div class="myio-pcc__panel-head">
        <h3 class="myio-pcc__panel-title" id="pcc-drivers-title">Vetores de consumo (energia)</h3>
        <span class="myio-pcc__panel-note">categorias da holding · submedidores</span>
      </div>
      <div class="myio-pcc__panel-body">
        ${!snapshot ? '<div class="myio-pcc__skeleton"></div>' : cats.length ? `<div class="myio-pcc__bars">${bars}</div>` : '<div class="myio-pcc__empty">Sem consumo categorizado no período.</div>'}
      </div>`;
  }

  function renderCoverage() {
    const el = region('coverage');
    if (!el) return;
    if (!snapshot) {
      el.innerHTML = '<div class="myio-pcc__panel-body"><div class="myio-pcc__skeleton"></div></div>';
      return;
    }
    const c = snapshot.coverage;
    const item = (label: string, d: { online: number; total: number }) =>
      `<div class="myio-pcc__cov-item">
        <div class="myio-pcc__cov-label">${label}</div>
        <div class="myio-pcc__cov-value">${d.total ? pct(d.online / d.total) : '—'}</div>
        <div class="myio-pcc__cov-sub">${d.online}/${d.total} online</div>
      </div>`;
    const t = c.temperature;
    el.innerHTML = `
      <div class="myio-pcc__panel-head">
        <h3 class="myio-pcc__panel-title" id="pcc-cov-title">Cobertura e conforto</h3>
        <span class="myio-pcc__panel-note">conectividade ≠ completude histórica</span>
      </div>
      <div class="myio-pcc__panel-body">
        <div class="myio-pcc__cov">
          ${item('Energia', c.connectivity.byDomain.energy)}
          ${item('Água', c.connectivity.byDomain.water)}
          ${item('Temperatura', c.connectivity.byDomain.temperature)}
        </div>
        <div class="myio-pcc__comfort">
          🌡️ ${
            t.range
              ? `<strong>${t.outOfRange}</strong> de ${t.sensors} sensores fora de ${nf(t.range.min, 1)}–${nf(t.range.max, 1)} °C`
              : 'Faixa ideal de temperatura não configurada'
          }
          · 💧 ${c.waterSupplyShoppings}/${snapshot.shoppings.length} shoppings com hidrômetro de entrada
          ${c.excludedDevices ? `<div class="myio-pcc__panel-note" style="margin-top:6px">${c.excludedDevices} dispositivo(s) de clientes fora do escopo selecionado não entram nos totais.</div>` : ''}
        </div>
      </div>`;
  }

  // ---------- Drawer ----------
  function openDrawer(row: ShoppingRow, trigger: HTMLElement) {
    closeDrawer();
    const backdrop = document.createElement('div');
    backdrop.className = 'myio-pcc__drawer-backdrop';
    const panel = document.createElement('aside');
    panel.className = `myio-pcc myio-pcc__drawer ${theme === 'dark' ? 'myio-pcc--dark' : ''}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'pcc-drawer-title');
    const prios = (snapshot?.priorities ?? []).filter((p) => p.shopping === row.name);
    const conn = row.connectivity;
    panel.innerHTML = `
      <div class="myio-pcc__drawer-head">
        <h3 class="myio-pcc__drawer-title" id="pcc-drawer-title">${esc(row.name)}</h3>
        <button type="button" class="myio-pcc__icon-btn" data-drawer="close" aria-label="Fechar">✕</button>
      </div>
      <div class="myio-pcc__drawer-body">
        <dl class="myio-pcc__dl">
          <dt>Energia (submedidores)</dt><dd>${esc(formatEnergy(row.energy.value))}</dd>
          <dt>Água — entrada</dt><dd>${esc(formatWater(row.water.supply))}</dd>
          <dt>Água — consumos medidos</dt><dd>${esc(formatWater(row.water.downstream))}</dd>
          <dt>Água — residual (com sinal)</dt><dd class="${(row.water.residual ?? 0) < 0 ? 'myio-pcc__neg' : ''}">${esc(formatWater(row.water.residual))}</dd>
          <dt>Temperatura média</dt><dd>${row.temperature.avg === null ? '—' : `${nf(row.temperature.avg, 1)} °C`}</dd>
          <dt>Sensores fora da faixa</dt><dd>${row.temperature.outOfRange}/${row.temperature.sensors}</dd>
          <dt>Alarmes abertos</dt><dd>${row.alarms.open ?? '—'}${row.alarms.critical ? ` (${row.alarms.critical} críticos)` : ''}</dd>
          <dt>Conectividade energia</dt><dd>${conn.energy.online}/${conn.energy.total}</dd>
          <dt>Conectividade água</dt><dd>${conn.water.online}/${conn.water.total}</dd>
          <dt>Conectividade temperatura</dt><dd>${conn.temperature.online}/${conn.temperature.total}</dd>
          <dt>Demanda contratada</dt><dd class="myio-pcc__nd">Não configurado</dd>
          <dt>Metas</dt><dd class="myio-pcc__nd">Não configurado</dd>
        </dl>
        <div>
          <div class="myio-pcc__cov-label" style="margin-bottom:8px">Prioridades deste shopping</div>
          ${
            prios.length
              ? prios.map((p) => `<div class="myio-pcc__why"><strong>${esc(p.title)}</strong> — ${esc(p.evidence)}</div>`).join('')
              : '<div class="myio-pcc__panel-note">Nenhuma prioridade pelas regras atuais.</div>'
          }
        </div>
      </div>
      <div class="myio-pcc__drawer-foot">
        <button type="button" class="myio-pcc__btn" data-drawer="close">Fechar</button>
        ${params.onOpenShopping ? '<button type="button" class="myio-pcc__btn myio-pcc__btn--primary" data-drawer="open">Abrir dashboard do shopping</button>' : ''}
      </div>`;
    const onDrawerClick = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-drawer]');
      if (!b) return;
      if (b.dataset.drawer === 'open') params.onOpenShopping?.(row);
      closeDrawer();
    };
    panel.addEventListener('click', onDrawerClick);
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    drawer = { backdrop, panel, returnFocus: trigger };
    panel.querySelector<HTMLElement>('[data-drawer="close"]')?.focus();
  }

  function closeDrawer() {
    if (!drawer) return;
    const { backdrop, panel, returnFocus } = drawer;
    drawer = null;
    backdrop.remove();
    panel.remove();
    returnFocus?.focus?.();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drawer) closeDrawer();
  };
  document.addEventListener('keydown', onKey);

  render();
  // Pedido inicial adiado: o chamador ainda não recebeu a instância durante a criação
  trajectory.energy = { state: 'loading' };
  renderTrajectory();
  setTimeout(() => {
    if (!destroyed) params.onTrajectoryRequest?.('energy');
  }, 0);

  return {
    element: root,
    setSnapshot(next) {
      if (destroyed) return;
      snapshot = next;
      // drawer aberto mostra o snapshot antigo — fecha em vez de exibir dados de outro contexto
      closeDrawer();
      renderHead();
      renderKpis();
      renderPriorities();
      renderMatrix();
      renderDrivers();
      renderCoverage();
    },
    setTrajectory(domain, state) {
      if (destroyed) return;
      trajectory[domain] = state;
      if (domain === trajectoryDomain) renderTrajectory();
    },
    setThemeMode(mode) {
      if (destroyed) return;
      theme = mode;
      root.classList.toggle('myio-pcc--dark', theme === 'dark');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      closeDrawer();
      ro?.disconnect();
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
}

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(PCC_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PCC_STYLE_ID;
  style.textContent = PCC_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Áreas da seção Dashboard ainda não implementadas (RFC-0238 §4): página honesta
// de "em breve" com a pergunta que a área responde, o conteúdo e a dependência.
// ---------------------------------------------------------------------------

export type PortfolioUpcomingPage = 'demand' | 'benchmarking' | 'reports' | 'administration';

const UPCOMING: Record<PortfolioUpcomingPage, { icon: string; title: string; question: string; items: string[]; dependency: string }> = {
  demand: {
    icon: '📈',
    title: 'Demanda',
    question: 'Os contratos de demanda e a demanda medida estão alinhados?',
    items: [
      'Cadastro de contratos por ponto de suprimento (kW por posto, vigência e revisões)',
      'Demanda por intervalo, pico do período, utilização e folga com sinal',
      'Alertas de exposição e candidatos a revisão de contrato',
      'Simulação de cenários com premissas e versão da regra tarifária',
    ],
    dependency: 'Contratos versionados por ponto de suprimento e método de cálculo de demanda validado (fase 3).',
  },
  benchmarking: {
    icon: '📊',
    title: 'Benchmarking',
    question: 'Quais shoppings são comparáveis — e como estão entre si?',
    items: [
      'Grupos de pares por porte, horário de operação e sistema de climatização',
      'Indicadores normalizados (por m², por hora de operação, por visitante)',
      'Mapas de calor shopping × categoria com escala comum',
    ],
    dependency: 'Denominadores versionados por shopping (área com base declarada, horários, visitantes).',
  },
  reports: {
    icon: '📄',
    title: 'Relatórios',
    question: 'A análise pode ser compartilhada e reproduzida?',
    items: [
      'Exportação CSV com escopo, fronteira, unidades e cobertura',
      'Relatório executivo compartilhável a partir do snapshot da tela',
      'Snapshots salvos e jobs de relatório com progresso e expiração',
    ],
    dependency: 'Jobs de relatório no backend e snapshots reproduzíveis (fase 5).',
  },
  administration: {
    icon: '⚙️',
    title: 'Administração',
    question: 'O que torna a análise confiável?',
    items: [
      'Taxonomia da holding e mapeamento das categorias locais (com versões)',
      'Topologia de medição: medidores de entrada, submedidores e exclusões',
      'Contratos de demanda, metas e permissões por shopping',
      'Fila de remediação para configurações ausentes ou inválidas',
    ],
    dependency: 'Serviço de configuração versionado (GCDR) com autorização de escrita e auditoria.',
  },
};

export interface PortfolioUpcomingParams {
  container: HTMLElement;
  page: PortfolioUpcomingPage;
  themeMode?: 'light' | 'dark';
  /** Volta para o Portfólio (overview) */
  onBack?: () => void;
}

export function createPortfolioUpcomingPage(params: PortfolioUpcomingParams): {
  element: HTMLElement;
  setThemeMode(mode: 'light' | 'dark'): void;
  destroy(): void;
} {
  ensureStyles();
  const info = UPCOMING[params.page];
  const root = document.createElement('div');
  root.className = `myio-pcc myio-pcc--upcoming${params.themeMode === 'dark' ? ' myio-pcc--dark' : ''}`;
  root.setAttribute('data-testid', `portfolio-upcoming-${params.page}`);
  root.innerHTML = `
    <main class="myio-pcc__main">
      <section class="myio-pcc__panel myio-pcc__upcoming" aria-labelledby="pcc-upcoming-title">
        <div class="myio-pcc__upcoming-icon" aria-hidden="true">${info.icon}</div>
        <span class="myio-pcc__badge">Em breve</span>
        <h2 class="myio-pcc__h1" id="pcc-upcoming-title">${esc(info.title)}</h2>
        <p class="myio-pcc__upcoming-q">${esc(info.question)}</p>
        <div class="myio-pcc__section-label">O que esta área vai trazer</div>
        <ul class="myio-pcc__upcoming-list">${info.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        <div class="myio-pcc__why"><strong>Depende de:</strong> ${esc(info.dependency)}</div>
        ${params.onBack ? '<button type="button" class="myio-pcc__btn myio-pcc__btn--primary" data-upcoming="back">Ir para o Portfólio</button>' : ''}
      </section>
    </main>`;
  const onClick = (e: Event) => {
    if ((e.target as HTMLElement).closest('[data-upcoming="back"]')) params.onBack?.();
  };
  root.addEventListener('click', onClick);
  params.container.innerHTML = '';
  params.container.appendChild(root);
  return {
    element: root,
    setThemeMode(mode) {
      root.classList.toggle('myio-pcc--dark', mode === 'dark');
    },
    destroy() {
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
