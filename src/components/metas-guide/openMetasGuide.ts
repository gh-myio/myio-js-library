/**
 * RFC-0227: Metas × Consumo — "?" Help Button + Mock-Data Guided Tour (Wizard).
 *
 * `openMetasGuide` is a SELF-CONTAINED premium wizard. It owns its overlay,
 * navigation, focus-trap/restore, HTML escaping and persistence — it does NOT
 * depend on the `openOnboardModal` shell lifecycle (which has known defects:
 * Esc-listener leak, HTMLElement-not-attached-on-first-render, no focus trap,
 * no escaping — RFC §P0). The Academy premium look (purple header + footer) is
 * replicated here so the shell stays untouched and its consumers unaffected.
 *
 * HARD CONSTRAINT: the guide NEVER performs a network request. Every section
 * renders static, deterministic snapshots built from co-located fixtures. This
 * is enforced by a no-network test (RFC §P0).
 */

import type { MetasGuideHandle, MetasGuideOptions, MetasGuideShoppingFixture, MetasGuideTheme } from './types';
import {
  DEFAULT_FIXTURES,
  WATER_FIXTURES,
  SERIES_COLORS,
  computeChips,
  deriveTotal,
} from './metasGuideFixtures';

const STYLE_ID = 'myio-metas-guide-styles';
const ROOT_ID = 'myio-metas-guide-root';

/** Academy purple fallback (matches the onboard shell header). */
const FALLBACK_THEME: MetasGuideTheme = {
  accent: '#6c5ce7',
  accentDark: '#a29bfe',
  accentText: '#ffffff',
  mode: 'light',
};

// --------------------------------------------------------------------------
// small pure helpers
// --------------------------------------------------------------------------

/** Escape untrusted text before it is interpolated into innerHTML (RFC §P0). */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const nfInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

function fmtInt(n: number): string {
  return nfInt.format(Math.round(n));
}

/** Signed pt-BR percentage, e.g. `+8,2%` / `-3,0%`. */
function fmtPct(ratio: number): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '' : '';
  return `${sign}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function resolveTheme(theme?: Partial<MetasGuideTheme>): MetasGuideTheme {
  return {
    accent: theme?.accent || FALLBACK_THEME.accent,
    accentDark: theme?.accentDark || FALLBACK_THEME.accentDark,
    accentText: theme?.accentText || FALLBACK_THEME.accentText,
    mode: theme?.mode === 'dark' ? 'dark' : 'light',
  };
}

// --------------------------------------------------------------------------
// mock visual builders — pure HTML/SVG, zero Chart.js, zero network
// --------------------------------------------------------------------------

/** Small legend row shared across the card sections. */
function legendHtml(): string {
  const items: Array<[string, string]> = [
    [SERIES_COLORS.aMinus1, 'A-1'],
    [SERIES_COLORS.realizado, 'Realizado'],
    [SERIES_COLORS.meta, 'Meta'],
    [SERIES_COLORS.orcado, 'Orçado'],
  ];
  return `<div class="myio-mg-legend">${items
    .map(
      ([c, l]) =>
        `<span class="myio-mg-legend__item"><span class="myio-mg-legend__dot" style="background:${c}" aria-hidden="true"></span>${escapeHtml(
          l,
        )}</span>`,
    )
    .join('')}</div>`;
}

/**
 * Deterministic inline-SVG mini-chart: A-1 + Realizado as bars, Meta + Orçado
 * as lines. No Chart.js, no ResizeObserver, no images — pure markup.
 */
function miniChartSvg(s: MetasGuideShoppingFixture): string {
  const W = 320;
  const H = 130;
  const padB = 16;
  const padT = 8;
  const n = s.labels.length;
  const all = [
    ...s.series.aMinus1,
    ...s.series.realizado.map((v) => (v == null ? 0 : v)),
    ...s.series.meta,
    ...s.series.orcado,
  ];
  const max = Math.max(1, ...all);
  const plotH = H - padB - padT;
  const bandW = W / n;
  const barW = Math.max(3, bandW * 0.28);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const bars = s.labels
    .map((_, i) => {
      const cx = i * bandW + bandW / 2;
      const a1 = s.series.aMinus1[i] ?? 0;
      const rz = s.series.realizado[i];
      const x1 = cx - barW - 1;
      const x2 = cx + 1;
      const b1 = `<rect x="${x1.toFixed(1)}" y="${y(a1).toFixed(1)}" width="${barW.toFixed(
        1,
      )}" height="${(padT + plotH - y(a1)).toFixed(1)}" rx="1.5" fill="${SERIES_COLORS.aMinus1}"></rect>`;
      const b2 =
        rz == null
          ? ''
          : `<rect x="${x2.toFixed(1)}" y="${y(rz).toFixed(1)}" width="${barW.toFixed(
              1,
            )}" height="${(padT + plotH - y(rz)).toFixed(1)}" rx="1.5" fill="${SERIES_COLORS.realizado}"></rect>`;
      return b1 + b2;
    })
    .join('');

  const line = (data: number[], color: string) => {
    const pts = data
      .map((v, i) => `${(i * bandW + bandW / 2).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>`;
  };

  return `<svg class="myio-mg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico ilustrativo de ${escapeHtml(
    s.name,
  )}" preserveAspectRatio="none">
    ${bars}
    ${line(s.series.meta, SERIES_COLORS.meta)}
    ${line(s.series.orcado, SERIES_COLORS.orcado)}
  </svg>`;
}

function kpiRowHtml(s: MetasGuideShoppingFixture, unit: string): string {
  const kpis: Array<[string, number, string]> = [
    ['A-1', s.aMinus1, SERIES_COLORS.aMinus1],
    ['Realizado', s.realizado, SERIES_COLORS.realizado],
    ['Orçado', s.orcado, SERIES_COLORS.orcado],
    ['Meta', s.meta, SERIES_COLORS.meta],
  ];
  return `<div class="myio-mg-kpis">${kpis
    .map(
      ([label, val, color]) => `<div class="myio-mg-kpi">
        <span class="myio-mg-kpi__label" style="color:${color}">${escapeHtml(label)}</span>
        <span class="myio-mg-kpi__value">${fmtInt(val)} <small>${escapeHtml(unit)}</small></span>
      </div>`,
    )
    .join('')}</div>`;
}

function chipsHtml(s: MetasGuideShoppingFixture): string {
  const c = computeChips(s);
  const chip = (label: string, ratio: number) => {
    const cls = ratio > 0 ? 'is-up' : ratio < 0 ? 'is-down' : 'is-flat';
    return `<span class="myio-mg-chip ${cls}">${escapeHtml(label)} <strong>${escapeHtml(
      fmtPct(ratio),
    )}</strong></span>`;
  };
  return `<div class="myio-mg-chips">
    ${chip('vs A-1', c.vsAMinus1)}
    ${chip('vs Realizado', c.vsRealizado)}
    ${chip('vs Meta', c.vsMeta)}
  </div>`;
}

/** A compact illustrative card (chart + KPIs + chips). */
function miniCardHtml(s: MetasGuideShoppingFixture, unit: string, opts?: { chart?: boolean; kpis?: boolean; chips?: boolean }): string {
  const showChart = opts?.chart !== false;
  const showKpis = opts?.kpis !== false;
  const showChips = opts?.chips !== false;
  return `<div class="myio-mg-card">
    <h5 class="myio-mg-card__title">${escapeHtml(s.name)}</h5>
    ${showChart ? legendHtml() + miniChartSvg(s) : ''}
    ${showKpis ? kpiRowHtml(s, unit) : ''}
    ${showChips ? chipsHtml(s) : ''}
  </div>`;
}

/** Illustrative sidebar "Resumo por shopping" with a Total row. */
function miniSidebarHtml(shoppings: MetasGuideShoppingFixture[], unit: string, prevY: number, curY: number): string {
  const total = deriveTotal({ shoppings });
  const row = (name: string, a: number, r: number, o: number, m: number, isTotal: boolean) => `
    <div class="myio-mg-side__row${isTotal ? ' is-total' : ''}">
      <span class="myio-mg-side__name">${escapeHtml(name)}</span>
      <span class="myio-mg-side__vals">
        <b style="color:${SERIES_COLORS.aMinus1}">${fmtInt(a)}</b>
        <b style="color:${SERIES_COLORS.realizado}">${fmtInt(r)}</b>
        <b style="color:${SERIES_COLORS.orcado}">${fmtInt(o)}</b>
        <b style="color:${SERIES_COLORS.meta}">${fmtInt(m)}</b>
      </span>
    </div>`;
  return `<div class="myio-mg-side">
    <div class="myio-mg-side__head">
      <span>Resumo por shopping</span>
      <span class="myio-mg-side__unit">${escapeHtml(unit)}</span>
    </div>
    <div class="myio-mg-side__cols">
      <span>Shopping</span>
      <span class="myio-mg-side__vals">
        <b style="color:${SERIES_COLORS.aMinus1}">${prevY}</b>
        <b style="color:${SERIES_COLORS.realizado}">${curY}</b>
        <b style="color:${SERIES_COLORS.orcado}">Orç.</b>
        <b style="color:${SERIES_COLORS.meta}">Meta</b>
      </span>
    </div>
    ${shoppings.map((s) => row(s.name, s.aMinus1, s.realizado, s.orcado, s.meta, false)).join('')}
    ${row('Total', total.aMinus1, total.realizado, total.orcado, total.meta, true)}
  </div>`;
}

/** Illustrative toolbar with the domain tabs, período, presets, view + ⚙️/? . */
function miniToolbarHtml(prevY: number, curY: number, highlight?: string): string {
  const hl = (key: string) => (highlight === key ? ' is-highlight' : '');
  return `<div class="myio-mg-toolbar" aria-hidden="true">
    <span class="myio-mg-tb__group${hl('domain')}"><span class="myio-mg-tb__pill is-on">⚡ Energia</span><span class="myio-mg-tb__pill">💧 Água</span></span>
    <span class="myio-mg-tb__input${hl('period')}">📅 Período</span>
    <span class="myio-mg-tb__group${hl('presets')}"><span class="myio-mg-tb__pill">Ano ${prevY}</span><span class="myio-mg-tb__pill">Ano ${curY}</span></span>
    <span class="myio-mg-tb__group${hl('view')}"><span class="myio-mg-tb__pill is-on">📊 Dashboards</span><span class="myio-mg-tb__pill">📋 Analítico</span></span>
    <span class="myio-mg-tb__icon${hl('engine')}">⚙️</span>
    <span class="myio-mg-tb__icon${hl('help')}">?</span>
  </div>`;
}

function bannerHtml(text: string): string {
  return `<p class="myio-mg-banner">${escapeHtml(text)}</p>`;
}

function paras(sentences: string[]): string {
  return `<div class="myio-mg-copy">${sentences.map((s) => `<p>${escapeHtml(s)}</p>`).join('')}</div>`;
}

// --------------------------------------------------------------------------
// section model
// --------------------------------------------------------------------------

interface GuideSection {
  id: string;
  title: string;
  render: () => string;
}

/**
 * Build the 11 sections (RFC §Guide-level). Copy uses DYNAMIC live-control
 * years (`curY`/`prevY` from getFullYear), while the fixtures illustrate their
 * own years — the two are kept distinct (RFC §P1).
 */
function buildSections(ctx: {
  energy: typeof DEFAULT_FIXTURES;
  water: typeof WATER_FIXTURES;
  curY: number;
  prevY: number;
}): GuideSection[] {
  const { energy, water, curY, prevY } = ctx;
  const e0 = energy.shoppings[0];
  const w0 = water.shoppings[0];
  const fxPrev = energy.fixtureYearPrev;
  const fxCur = energy.fixtureYearCur;

  return [
    {
      id: 'welcome',
      title: 'Bem-vindo ao Metas × Consumo',
      render: () =>
        bannerHtml('Este é um guia com dados de exemplo — nada aqui é do seu cliente e nenhuma informação é enviada ou alterada.') +
        paras([
          'O painel Metas × Consumo compara, para cada shopping, o que foi realizado no ano atual contra a meta, o orçado e o ano anterior (A-1).',
          'Ele serve a operadores e ao time comercial para acompanhar desempenho e desvios de energia e água.',
          'Vamos percorrer cada parte do painel, do topo até a gestão de metas. Use Anterior / Próximo ou as setas do teclado.',
        ]) +
        miniToolbarHtml(prevY, curY),
    },
    {
      id: 'domain',
      title: 'Domínio: Energia e Água',
      render: () =>
        bannerHtml('As abas de domínio trocam toda a leitura do painel entre Energia (MWh) e Água (m³).') +
        paras([
          'A régua da meta muda por domínio: em Energia a referência é a ENTRADA; em Água, os hidrômetros.',
          'Os números e a unidade de cada card acompanham o domínio selecionado.',
        ]) +
        miniToolbarHtml(prevY, curY, 'domain') +
        `<div class="myio-mg-two">
          <div><div class="myio-mg-two__tag">⚡ Energia · ${escapeHtml(energy.unit)}</div>${miniCardHtml(e0, energy.unit, { chips: false })}</div>
          <div><div class="myio-mg-two__tag">💧 Água · ${escapeHtml(water.unit)}</div>${miniCardHtml(w0, water.unit, { chips: false })}</div>
        </div>`,
    },
    {
      id: 'period',
      title: 'Período e presets de Ano',
      render: () =>
        bannerHtml('O input Período aceita qualquer intervalo; os presets de Ano são atalhos rápidos.') +
        paras([
          `Os presets aparecem com rótulos dinâmicos: "Ano ${prevY}" (ano anterior) e "Ano ${curY}" (ano atual) — eles seguem a data de hoje, não são fixos.`,
          'O intervalo escolhido afeta a granularidade: até 15 dias o painel detalha por Dia/Hora.',
          `Neste guia os exemplos ilustram ${fxPrev} vs ${fxCur}, apenas para você ver o formato.`,
        ]) +
        miniToolbarHtml(prevY, curY, 'period') +
        miniToolbarHtml(prevY, curY, 'presets'),
    },
    {
      id: 'views',
      title: 'Dashboards × Analítico',
      render: () =>
        bannerHtml('Duas sub-abas mostram a mesma seleção de formas diferentes.') +
        paras([
          'Dashboards traz os gráficos e cards por shopping, dirigidos pela configuração do Engine.',
          'Analítico traz a tabela do portfólio (Resumo Analítico) com os mesmos dados, ideal para leitura linha a linha.',
        ]) +
        miniToolbarHtml(prevY, curY, 'view'),
    },
    {
      id: 'card-chart',
      title: 'O card do shopping — gráfico',
      render: () =>
        bannerHtml('Cada card mostra quatro séries com cores fixas.') +
        paras([
          `As barras são consumo: A-1 (ano anterior) em cinza e Realizado (ano atual) em azul.`,
          'As linhas são referências: Meta em roxo e Orçado em laranja.',
          'Comparar a altura das barras azuis com as linhas mostra, mês a mês, se o realizado ficou acima ou abaixo da meta.',
        ]) +
        miniCardHtml(e0, energy.unit, { kpis: false, chips: false }),
    },
    {
      id: 'card-kpis',
      title: 'O card do shopping — KPIs e chips',
      render: () => {
        const c = computeChips(e0);
        return (
          bannerHtml('Abaixo do gráfico ficam os KPIs do período e os chips de desvio.') +
          paras([
            'Os KPIs consolidam o período: A-1, Realizado, Orçado e Meta.',
            `Os chips leem o sinal do desvio: vs A-1 ${fmtPct(c.vsAMinus1)}, vs Realizado ${fmtPct(
              c.vsRealizado,
            )}, vs Meta ${fmtPct(c.vsMeta)}.`,
            'Verde indica acima da referência e vermelho abaixo — a interpretação (bom/ruim) depende do domínio.',
          ]) +
          miniCardHtml(e0, energy.unit, { chart: false })
        );
      },
    },
    {
      id: 'year-toggles',
      title: 'Toggles de ano (👁)',
      render: () =>
        bannerHtml('Os ícones 👁 na legenda ligam e desligam séries no gráfico.') +
        paras([
          'Desligue A-1 para focar só no ano atual, ou desligue Realizado para inspecionar apenas as referências.',
          'O painel nunca deixa as duas ocultas ao mesmo tempo — sempre resta uma série visível.',
        ]) +
        `<div class="myio-mg-toggles">
          <span class="myio-mg-toggle is-on"><span aria-hidden="true">👁</span> A-1 <i style="background:${SERIES_COLORS.aMinus1}"></i></span>
          <span class="myio-mg-toggle is-on"><span aria-hidden="true">👁</span> Realizado <i style="background:${SERIES_COLORS.realizado}"></i></span>
        </div>` +
        miniCardHtml(e0, energy.unit, { kpis: false, chips: false }),
    },
    {
      id: 'sidebar',
      title: 'Resumo por shopping (sidebar)',
      render: () =>
        bannerHtml('A lista lateral resume o portfólio inteiro em uma olhada.') +
        paras([
          `Por shopping ela mostra ${prevY}, ${curY}, Orçado e Meta com os respectivos deltas.`,
          'A linha Total consolida todos os shoppings da seleção atual.',
        ]) +
        miniSidebarHtml(energy.shoppings, energy.unit, prevY, curY),
    },
    {
      id: 'ordering',
      title: 'Ordenar o resumo',
      render: () =>
        bannerHtml('Você controla a ordem e o filtro da sidebar.') +
        paras([
          'O botão de ordenação (ex.: "Data de Inauguração ↑") inverte a direção a cada clique.',
          'O botão de filtros abre um modal para buscar, excluir shoppings e aplicar filtros rápidos.',
        ]) +
        `<div class="myio-mg-order">
          <span class="myio-mg-order__btn">Data de Inauguração ↑ · ⚙️</span>
          <span class="myio-mg-order__btn">▽ Filtros</span>
        </div>` +
        `<ul class="myio-mg-order__list">${energy.shoppings
          .slice()
          .sort((a, b) => a.inaugurationDate.localeCompare(b.inaugurationDate))
          .map((s) => `<li><b>${escapeHtml(s.name)}</b> <span>inaugurado em ${escapeHtml(s.inaugurationDate)}</span></li>`)
          .join('')}</ul>`,
    },
    {
      id: 'engine',
      title: 'Engine — gestão de metas',
      render: () =>
        bannerHtml('O botão ⚙️ Engine controla como os dados são agregados e exibidos.') +
        paras([
          'Nele você define granularidade, visão (consolidado × por shopping), tipo (cards, empilhado ou separado) e ordenação.',
          'As escolhas podem ser salvas no seu usuário, para o painel reabrir já configurado.',
        ]) +
        `<div class="myio-mg-engine">
          <div class="myio-mg-engine__row"><span>Granularidade</span><b>Mês</b></div>
          <div class="myio-mg-engine__row"><span>Visão</span><b>Por shopping</b></div>
          <div class="myio-mg-engine__row"><span>Tipo</span><b>Cards</b></div>
          <div class="myio-mg-engine__row"><span>Ordenação</span><b>Inauguração ↑</b></div>
          <div class="myio-mg-engine__save">💾 Salvar preferência</div>
        </div>`,
    },
    {
      id: 'export',
      title: 'Exportar e finalizar',
      render: () =>
        bannerHtml('No topo da janela ficam as ações de exportação e aparência.') +
        paras([
          '⬇️ PDF exporta o painel atual; 🌙 alterna tema claro/escuro; ⛶ maximiza a janela.',
          'É isso! Você pode reabrir este guia a qualquer momento pelo botão "?" ao lado do Engine.',
        ]) +
        `<div class="myio-mg-window-actions">
          <span>🌙 Tema</span><span>⛶ Maximizar</span><span>⬇️ PDF</span><span>✕ Fechar</span>
        </div>`,
    },
  ];
}

// --------------------------------------------------------------------------
// styles
// --------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
  #${ROOT_ID}{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);font-family:'Nunito',system-ui,sans-serif;}
  #${ROOT_ID} *{box-sizing:border-box;}
  .myio-mg-modal{--mg-surface:#fff;--mg-text:#1f2937;--mg-text2:#475569;--mg-muted:#64748b;--mg-border:#e2e8f0;--mg-chip:#f1f5f9;
    width:760px;max-width:96vw;max-height:92vh;background:var(--mg-surface);color:var(--mg-text);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.35);}
  .myio-mg-modal.is-dark{--mg-surface:#0f172a;--mg-text:#e2e8f0;--mg-text2:#cbd5e1;--mg-muted:#94a3b8;--mg-border:#334155;--mg-chip:#1e293b;}
  .myio-mg-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;background:linear-gradient(135deg,var(--mg-accent),var(--mg-accent-dark));color:var(--mg-accent-text);}
  .myio-mg-header__l{display:flex;align-items:center;gap:12px;min-width:0;}
  .myio-mg-header__logo{font-size:26px;}
  .myio-mg-header__t{margin:0;font-size:18px;font-weight:800;}
  .myio-mg-header__s{margin:0;font-size:12px;opacity:.85;font-weight:600;}
  .myio-mg-close{background:rgba(255,255,255,.2);border:0;color:inherit;font-size:22px;width:34px;height:34px;border-radius:50%;cursor:pointer;line-height:1;flex-shrink:0;}
  .myio-mg-close:hover{background:rgba(255,255,255,.32);}
  .myio-mg-body{flex:1;overflow:auto;padding:20px 22px;min-height:220px;}
  .myio-mg-banner{margin:0 0 14px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;color:var(--mg-accent);background:color-mix(in srgb, var(--mg-accent) 12%, transparent);border:1px solid color-mix(in srgb, var(--mg-accent) 30%, transparent);}
  .myio-mg-copy p{margin:0 0 8px;font-size:14px;line-height:1.55;color:var(--mg-text2);}
  .myio-mg-legend{display:flex;flex-wrap:wrap;gap:12px;margin:6px 0 8px;}
  .myio-mg-legend__item{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--mg-muted);}
  .myio-mg-legend__dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
  .myio-mg-chart{width:100%;height:130px;display:block;margin-bottom:10px;}
  .myio-mg-card{border:1px solid var(--mg-border);border-radius:12px;padding:14px;background:var(--mg-surface);}
  .myio-mg-card__title{margin:0 0 8px;font-size:15px;font-weight:800;color:var(--mg-text);}
  .myio-mg-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;}
  .myio-mg-kpi{display:flex;flex-direction:column;gap:2px;padding:8px;border-radius:8px;background:var(--mg-chip);}
  .myio-mg-kpi__label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;}
  .myio-mg-kpi__value{font-size:14px;font-weight:800;color:var(--mg-text);}
  .myio-mg-kpi__value small{font-size:10px;font-weight:700;color:var(--mg-muted);}
  .myio-mg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
  .myio-mg-chip{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--mg-chip);color:var(--mg-muted);border:1px solid var(--mg-border);}
  .myio-mg-chip.is-up{color:#15803d;border-color:#86efac;background:rgba(34,197,94,.12);}
  .myio-mg-chip.is-down{color:#b91c1c;border-color:#fca5a5;background:rgba(239,68,68,.12);}
  .myio-mg-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;}
  .myio-mg-two__tag{font-size:12px;font-weight:800;margin-bottom:6px;color:var(--mg-text2);}
  .myio-mg-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;border:1px dashed var(--mg-border);border-radius:10px;margin-top:12px;background:var(--mg-chip);}
  .myio-mg-tb__group{display:inline-flex;gap:3px;background:var(--mg-surface);border-radius:8px;padding:3px;}
  .myio-mg-tb__pill{font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;color:var(--mg-muted);}
  .myio-mg-tb__pill.is-on{background:var(--mg-accent);color:var(--mg-accent-text);}
  .myio-mg-tb__input{font-size:12px;font-weight:700;padding:5px 10px;border:1px solid var(--mg-border);border-radius:8px;color:var(--mg-text2);background:var(--mg-surface);}
  .myio-mg-tb__icon{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--mg-accent);border-radius:8px;color:var(--mg-accent);font-weight:800;}
  .myio-mg-toolbar .is-highlight{outline:3px solid color-mix(in srgb, var(--mg-accent) 55%, transparent);outline-offset:2px;border-radius:10px;}
  .myio-mg-side{border:1px solid var(--mg-border);border-radius:12px;overflow:hidden;margin-top:12px;}
  .myio-mg-side__head{display:flex;justify-content:space-between;padding:10px 14px;font-weight:800;font-size:13px;background:var(--mg-chip);color:var(--mg-text);}
  .myio-mg-side__unit{color:var(--mg-muted);font-weight:700;}
  .myio-mg-side__cols{display:flex;justify-content:space-between;padding:6px 14px;font-size:11px;font-weight:800;color:var(--mg-muted);border-bottom:1px solid var(--mg-border);}
  .myio-mg-side__row{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;font-size:13px;border-bottom:1px solid var(--mg-border);}
  .myio-mg-side__row.is-total{font-weight:900;background:var(--mg-chip);border-bottom:0;}
  .myio-mg-side__name{font-weight:700;color:var(--mg-text);}
  .myio-mg-side__vals{display:inline-flex;gap:12px;}
  .myio-mg-side__vals b{font-size:12px;min-width:44px;text-align:right;}
  .myio-mg-toggles{display:flex;gap:10px;margin:6px 0 10px;}
  .myio-mg-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;border:1px solid var(--mg-border);color:var(--mg-text2);}
  .myio-mg-toggle i{width:10px;height:10px;border-radius:2px;display:inline-block;}
  .myio-mg-order{display:flex;gap:8px;margin-top:12px;}
  .myio-mg-order__btn{font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid var(--mg-accent);color:var(--mg-accent);}
  .myio-mg-order__list{list-style:none;margin:10px 0 0;padding:0;}
  .myio-mg-order__list li{display:flex;justify-content:space-between;padding:8px 12px;border:1px solid var(--mg-border);border-radius:8px;margin-bottom:6px;font-size:13px;}
  .myio-mg-order__list span{color:var(--mg-muted);font-size:12px;}
  .myio-mg-engine{border:1px solid var(--mg-border);border-radius:12px;padding:12px;margin-top:12px;}
  .myio-mg-engine__row{display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid var(--mg-border);font-size:13px;color:var(--mg-text2);}
  .myio-mg-engine__row b{color:var(--mg-text);}
  .myio-mg-engine__save{margin-top:10px;text-align:center;font-weight:800;font-size:13px;padding:8px;border-radius:8px;background:var(--mg-accent);color:var(--mg-accent-text);}
  .myio-mg-window-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;}
  .myio-mg-window-actions span{font-size:13px;font-weight:700;padding:8px 14px;border-radius:8px;border:1px solid var(--mg-border);color:var(--mg-text2);}
  .myio-mg-footer{border-top:1px solid var(--mg-border);padding:14px 22px;display:flex;flex-direction:column;gap:12px;background:var(--mg-chip);}
  .myio-mg-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .myio-mg-progress{font-size:12px;font-weight:800;color:var(--mg-muted);}
  .myio-mg-dots{display:inline-flex;gap:5px;margin-left:8px;}
  .myio-mg-dot{width:7px;height:7px;border-radius:50%;background:var(--mg-border);}
  .myio-mg-dot.is-on{background:var(--mg-accent);}
  .myio-mg-nav__r{display:flex;gap:8px;}
  .myio-mg-btn{font-family:inherit;font-size:13px;font-weight:800;padding:8px 16px;border-radius:8px;cursor:pointer;border:1px solid var(--mg-accent);background:transparent;color:var(--mg-accent);}
  .myio-mg-btn:hover{background:color-mix(in srgb, var(--mg-accent) 12%, transparent);}
  .myio-mg-btn.is-primary{background:var(--mg-accent);color:var(--mg-accent-text);border-color:var(--mg-accent);}
  .myio-mg-btn.is-ghost{border-color:transparent;color:var(--mg-muted);}
  .myio-mg-btn:disabled{opacity:.4;cursor:not-allowed;}
  .myio-mg-persist{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--mg-muted);}
  .myio-mg-persist input{width:15px;height:15px;accent-color:var(--mg-accent);}
  .myio-mg-academy{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:10px;border-top:1px solid var(--mg-border);}
  .myio-mg-academy__brand{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:var(--mg-text2);}
  .myio-mg-academy__links{display:inline-flex;gap:10px;flex-wrap:wrap;}
  .myio-mg-academy__links a{font-size:12px;font-weight:700;color:var(--mg-muted);text-decoration:none;padding:4px 10px;border-radius:6px;border:1px solid var(--mg-border);}
  .myio-mg-academy__links a:hover{color:var(--mg-accent);border-color:var(--mg-accent);}
  @media (max-width:640px){
    .myio-mg-kpis{grid-template-columns:repeat(2,1fr);}
    .myio-mg-two{grid-template-columns:1fr;}
  }`;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// public API
// --------------------------------------------------------------------------

/**
 * Open the Metas × Consumo guided tour (self-contained, mock-data, no network).
 *
 * @returns a handle compatible with `OnboardModalHandle` (+ `goToStep`).
 */
export function openMetasGuide(options: MetasGuideOptions = {}): MetasGuideHandle {
  const theme = resolveTheme(options.theme);
  const energy = options.mockData || DEFAULT_FIXTURES;
  const water = options.mockDataWater || WATER_FIXTURES;
  const now = new Date();
  const curY = now.getFullYear();
  const prevY = curY - 1;
  const sections = buildSections({ energy, water, curY, prevY });
  const total = sections.length;

  // Remove any stray previous instance (idempotent open).
  document.getElementById(ROOT_ID)?.remove();

  injectStyles();

  const previouslyFocused = document.activeElement as HTMLElement | null;
  let index = 0;
  let closed = false;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="myio-mg-modal${theme.mode === 'dark' ? ' is-dark' : ''}" role="dialog" aria-modal="true"
         aria-labelledby="myio-mg-title"
         style="--mg-accent:${escapeHtml(theme.accent)};--mg-accent-dark:${escapeHtml(
           theme.accentDark,
         )};--mg-accent-text:${escapeHtml(theme.accentText)};">
      <div class="myio-mg-header">
        <div class="myio-mg-header__l">
          <span class="myio-mg-header__logo" aria-hidden="true">🎓</span>
          <div>
            <h2 class="myio-mg-header__t" id="myio-mg-title"></h2>
            <p class="myio-mg-header__s">Guia do painel Metas × Consumo</p>
          </div>
        </div>
        <button type="button" class="myio-mg-close" data-mg-close aria-label="Fechar guia">&times;</button>
      </div>
      <div class="myio-mg-body" data-mg-body></div>
      <div class="myio-mg-footer">
        <div class="myio-mg-nav">
          <div class="myio-mg-progress" data-mg-progress aria-live="polite"></div>
          <div class="myio-mg-nav__r">
            <button type="button" class="myio-mg-btn is-ghost" data-mg-skip aria-label="Pular guia">Pular</button>
            <button type="button" class="myio-mg-btn" data-mg-prev aria-label="Seção anterior">◀ Anterior</button>
            <button type="button" class="myio-mg-btn is-primary" data-mg-next aria-label="Próxima seção">Próximo ▶</button>
          </div>
        </div>
        <label class="myio-mg-persist" data-mg-persist-wrap hidden>
          <input type="checkbox" data-mg-persist> Não mostrar novamente
        </label>
        <div class="myio-mg-academy">
          <span class="myio-mg-academy__brand"><span aria-hidden="true">🎓</span> MYIO Academy</span>
          <span class="myio-mg-academy__links">
            <a href="https://academy.myio.com.br/tutoriais" target="_blank" rel="noopener noreferrer">📚 Tutoriais</a>
            <a href="https://academy.myio.com.br/docs" target="_blank" rel="noopener noreferrer">📖 Documentação</a>
            <a href="https://academy.myio.com.br/suporte" target="_blank" rel="noopener noreferrer">💬 Suporte</a>
          </span>
        </div>
      </div>
    </div>`;

  const modal = root.querySelector('.myio-mg-modal') as HTMLElement;
  const titleEl = root.querySelector('#myio-mg-title') as HTMLElement;
  const bodyEl = root.querySelector('[data-mg-body]') as HTMLElement;
  const progressEl = root.querySelector('[data-mg-progress]') as HTMLElement;
  const prevBtn = root.querySelector('[data-mg-prev]') as HTMLButtonElement;
  const nextBtn = root.querySelector('[data-mg-next]') as HTMLButtonElement;
  const skipBtn = root.querySelector('[data-mg-skip]') as HTMLButtonElement;
  const closeBtn = root.querySelector('[data-mg-close]') as HTMLButtonElement;
  const persistWrap = root.querySelector('[data-mg-persist-wrap]') as HTMLElement;
  const persistBox = root.querySelector('[data-mg-persist]') as HTMLInputElement;

  function maybePersist(): void {
    // Never writes without BOTH an explicit persistKey and the ticked box.
    if (!options.persistKey || !persistBox.checked) return;
    try {
      window.localStorage.setItem(options.persistKey, JSON.stringify({ seen: true, at: Date.now() }));
    } catch {
      /* storage unavailable — silently ignore */
    }
  }

  function close(): void {
    if (closed) return;
    closed = true;
    maybePersist();
    document.removeEventListener('keydown', onKeyDown, true);
    root.remove();
    // Restore focus to the opener (the "?" button) per RFC §7.
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    options.onClose?.();
  }

  function render(): void {
    const section = sections[index];
    titleEl.textContent = section.title;
    bodyEl.innerHTML = section.render();
    bodyEl.scrollTop = 0;

    const isLast = index === total - 1;
    const isFirst = index === 0;
    prevBtn.disabled = isFirst;
    nextBtn.textContent = isLast ? 'Concluir' : 'Próximo ▶';
    nextBtn.setAttribute('aria-label', isLast ? 'Concluir guia' : 'Próxima seção');

    const dots = sections
      .map((_, i) => `<span class="myio-mg-dot${i === index ? ' is-on' : ''}"></span>`)
      .join('');
    progressEl.innerHTML = `${index + 1} / ${total}<span class="myio-mg-dots" aria-hidden="true">${dots}</span>`;
    progressEl.setAttribute('aria-label', `Passo ${index + 1} de ${total}: ${section.title}`);

    // "Não mostrar novamente" only on the last section, only when opt-in enabled.
    persistWrap.hidden = !(isLast && !!options.persistKey);
  }

  function goToStep(target: number): void {
    if (closed) return;
    const clamped = Math.max(0, Math.min(total - 1, target));
    if (clamped === index) return;
    index = clamped;
    render();
  }

  function next(): void {
    if (index === total - 1) {
      options.onFinish?.();
      close();
      return;
    }
    goToStep(index + 1);
  }

  function prev(): void {
    goToStep(index - 1);
  }

  function focusables(): HTMLElement[] {
    return Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (closed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
      return;
    }
    if (e.key === 'Tab') {
      // Focus trap.
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Wire events.
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  skipBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close(); // backdrop
  });
  document.addEventListener('keydown', onKeyDown, true);

  document.body.appendChild(root);
  render();

  // Initial focus inside the dialog (RFC §7).
  nextBtn.focus();

  return {
    close,
    getElement: () => (closed ? null : modal),
    setContent: (content: string | HTMLElement) => {
      if (closed) return;
      if (typeof content === 'string') {
        bodyEl.innerHTML = content;
      } else {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(content);
      }
    },
    goToStep,
  };
}
