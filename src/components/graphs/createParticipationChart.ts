/**
 * createParticipationChart — share-of-total chart (SVG pie/donut or horizontal bars).
 *
 * Hand-rolled SVG on purpose: the library must stay dependency-free for charts
 * (no Chart.js). SVG also makes PNG/PDF export trivial (serialize → canvas).
 *
 * PDF export reuses the repo's jsPDF mechanism (same static import used by
 * `src/components/telemetry-grid-shopping/export.ts`).
 */

import { jsPDF } from 'jspdf';
import { InfoTooltip } from '../../utils/tooltips/InfoTooltip';
import {
  DEFAULT_PARTICIPATION_CHART_SETTINGS,
  MYIO_CHART_PALETTE,
  MYIO_CHART_PALETTE_DARK,
  ParticipationChartInstance,
  ParticipationChartItem,
  ParticipationChartParams,
  ParticipationChartSettings,
  ParticipationChartThemeMode,
  ParticipationChartType,
} from './types';
import { PARTICIPATION_CHART_CSS_PREFIX as P, injectParticipationChartStyles } from './styles';

// ─── Color helpers ────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Mix two #rrggbb colors — `ratio` is the weight of `b`. */
function mixHex(a: string, b: string, ratio: number): string {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const r = clamp01(ratio);
  const mix = (i: number) => {
    const ca = parseInt(pa.slice(i, i + 2), 16);
    const cb = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(ca + (cb - ca) * r)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** Stable pseudo-random color per label (djb2 hash → hue) — re-renders keep colors. */
function hashColor(label: string, dark: boolean): string {
  let h = 5381;
  for (let i = 0; i < label.length; i++) h = ((h << 5) + h + label.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const sat = 55 + (Math.abs(h >> 8) % 25); // 55–79
  return hslToHex(hue, sat, dark ? 58 : 44);
}

/** Extend a base palette beyond its length with deterministic tone steps (never plain cycling). */
function paletteColor(base: string[], index: number, dark: boolean): string {
  if (index < base.length) return base[index];
  const seed = base[index % base.length];
  const round = Math.floor(index / base.length); // 1, 2, …
  const pct = Math.min(0.6, 0.18 * round);
  const target = round % 2 === 1 ? (dark ? '#0f172a' : '#ffffff') : dark ? '#ffffff' : '#0f172a';
  return mixHex(seed, target, pct);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const defaultFormatValue = (v: number): string =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (pct: number): string =>
  `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ─── Internal resolved settings shape ─────────────────────────────────────────

interface ResolvedSettings {
  chartType: ParticipationChartType;
  showTypeSelector: boolean;
  title: string;
  subtitle: string;
  palette: string[] | null;
  paletteMode: 'myio' | 'random';
  legend: { visible: boolean; position: 'bottom' | 'left' | 'top' | 'right'; selectable: boolean };
  themeMode: ParticipationChartThemeMode;
  theme: { light: { bg?: string; text?: string; border?: string }; dark: { bg?: string; text?: string; border?: string } };
  border: boolean | { color?: string; radius?: number };
  exportButtons: { visible: boolean; pdf: boolean; png: boolean };
  tooltip: boolean;
  expandable: boolean;
  formatValue: (v: number) => string;
  unit: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createParticipationChart(
  container: HTMLElement,
  params: ParticipationChartParams
): ParticipationChartInstance {
  if (!container) throw new Error('[ParticipationChart] container is required');

  injectParticipationChartStyles();

  const D = DEFAULT_PARTICIPATION_CHART_SETTINGS;

  let items: ParticipationChartItem[] = Array.isArray(params.items) ? [...params.items] : [];
  const hidden = new Set<string>();
  let destroyed = false;
  let expanded = false;
  let overlay: HTMLElement | null = null;
  let marker: HTMLElement | null = null;
  let tooltipCleanups: Array<() => void> = [];

  const settings: ResolvedSettings = {
    chartType: params.chartType || D.chartType,
    showTypeSelector: params.showTypeSelector !== false,
    title: params.title || '',
    subtitle: params.subtitle || '',
    palette: Array.isArray(params.palette) && params.palette.length ? [...params.palette] : null,
    paletteMode: params.paletteMode === 'random' ? 'random' : 'myio',
    legend: {
      visible: params.legend?.visible !== false,
      position: params.legend?.position || D.legend.position,
      selectable: params.legend?.selectable !== false,
    },
    themeMode: params.themeMode === 'dark' ? 'dark' : 'light',
    theme: { light: { ...(params.theme?.light || {}) }, dark: { ...(params.theme?.dark || {}) } },
    border: params.border === undefined ? true : params.border,
    exportButtons: {
      visible: params.exportButtons?.visible !== false,
      pdf: params.exportButtons?.pdf !== false,
      png: params.exportButtons?.png !== false,
    },
    tooltip: params.tooltip !== false,
    expandable: params.expandable === true,
    formatValue: typeof params.formatValue === 'function' ? params.formatValue : defaultFormatValue,
    unit: params.unit || '',
  };

  const root = document.createElement('div');
  container.appendChild(root);

  const keyOf = (item: ParticipationChartItem): string => String(item.id ?? item.label);

  const isDark = (): boolean => settings.themeMode === 'dark';

  const themeOverrides = () => (isDark() ? settings.theme.dark : settings.theme.light);

  const resolvedBg = (): string => themeOverrides().bg || (isDark() ? '#1f2333' : '#ffffff');
  const resolvedText = (): string => themeOverrides().text || (isDark() ? '#e5e7eb' : '#1e293b');
  const resolvedMuted = (): string => (isDark() ? '#9ca3af' : '#6b7280');

  /** Color per item index over the FULL items list — hiding an item never repaints survivors. */
  function colorFor(index: number, item: ParticipationChartItem): string {
    if (settings.palette) return paletteColor(settings.palette, index, isDark());
    if (settings.paletteMode === 'random') return hashColor(item.label, isDark());
    return paletteColor(isDark() ? MYIO_CHART_PALETTE_DARK : MYIO_CHART_PALETTE, index, isDark());
  }

  function visibleEntries(): Array<{ item: ParticipationChartItem; index: number; color: string }> {
    return items
      .map((item, index) => ({ item, index, color: colorFor(index, item) }))
      .filter((e) => !hidden.has(keyOf(e.item)));
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function cleanupTooltips(): void {
    tooltipCleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
    tooltipCleanups = [];
  }

  function applyRootDecoration(): void {
    root.className = [
      P,
      isDark() ? `${P}--dark` : '',
      `${P}--legend-${settings.legend.position}`,
      settings.border ? `${P}--bordered` : '',
      expanded ? `${P}--expanded` : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Explicit theme overrides → inline CSS vars (win over the class defaults)
    const t = themeOverrides();
    root.style.removeProperty('--mpc-bg');
    root.style.removeProperty('--mpc-text');
    root.style.removeProperty('--mpc-border');
    if (t.bg) root.style.setProperty('--mpc-bg', t.bg);
    if (t.text) root.style.setProperty('--mpc-text', t.text);
    if (t.border) root.style.setProperty('--mpc-border', t.border);

    root.style.borderColor = '';
    root.style.borderRadius = '';
    if (settings.border && typeof settings.border === 'object') {
      if (settings.border.color) root.style.borderColor = settings.border.color;
      if (typeof settings.border.radius === 'number') root.style.borderRadius = `${settings.border.radius}px`;
    }
  }

  function buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = `${P}__header`;

    const titles = document.createElement('div');
    titles.className = `${P}__titles`;
    if (settings.title) {
      const t = document.createElement('div');
      t.className = `${P}__title`;
      t.textContent = settings.title;
      titles.appendChild(t);
    }
    if (settings.subtitle) {
      const s = document.createElement('div');
      s.className = `${P}__subtitle`;
      s.textContent = settings.subtitle;
      titles.appendChild(s);
    }
    header.appendChild(titles);

    const actions = document.createElement('div');
    actions.className = `${P}__actions`;

    if (settings.showTypeSelector) {
      const toggle = document.createElement('div');
      toggle.className = `${P}__type-toggle`;
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', 'Tipo de gráfico');
      const mk = (type: ParticipationChartType, label: string) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `${P}__type-btn${settings.chartType === type ? ' is-active' : ''}`;
        btn.dataset.type = type;
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (settings.chartType === type) return;
          settings.chartType = type;
          render();
        });
        return btn;
      };
      toggle.appendChild(mk('pie', 'Pizza'));
      toggle.appendChild(mk('bars', 'Barras'));
      actions.appendChild(toggle);
    }

    const iconBtn = (label: string, title: string, onClick: () => void, dataAction: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${P}__icon-btn`;
      btn.dataset.action = dataAction;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      return btn;
    };

    if (settings.exportButtons.visible && settings.exportButtons.png) {
      actions.appendChild(iconBtn('🖼️', 'Exportar PNG', () => void exportPNG(), 'export-png'));
    }
    if (settings.exportButtons.visible && settings.exportButtons.pdf) {
      actions.appendChild(iconBtn('📄', 'Exportar PDF', () => void exportPDF(), 'export-pdf'));
    }
    if (settings.expandable) {
      actions.appendChild(
        iconBtn(expanded ? '🗗' : '⛶', expanded ? 'Minimizar' : 'Expandir', () => (expanded ? minimize() : expand()), 'expand')
      );
    }

    header.appendChild(actions);
    return header;
  }

  function attachItemTooltip(el: Element, item: ParticipationChartItem, pct: number): void {
    if (!settings.tooltip) return;
    const cleanup = InfoTooltip.attach(el as HTMLElement, () => ({
      icon: '📊',
      title: item.label,
      content: `
        <div class="myio-info-tooltip__section" style="min-width:180px;">
          <div style="font-size:12px;line-height:1.6;">
            <div><strong>Valor:</strong> ${escapeHtml(settings.formatValue(item.value))}${settings.unit ? ` ${escapeHtml(settings.unit)}` : ''}</div>
            <div><strong>Participação:</strong> ${fmtPct(pct)}</div>
          </div>
        </div>
      `,
    }));
    tooltipCleanups.push(cleanup);
  }

  /** Full donut ring (single visible item) — evenodd double circle. */
  function fullRingPath(cx: number, cy: number, ro: number, ri: number): string {
    const circle = (r: number) =>
      `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    return `${circle(ro)} ${circle(ri)}`;
  }

  function slicePath(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number): string {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0o = cx + ro * Math.cos(a0);
    const y0o = cy + ro * Math.sin(a0);
    const x1o = cx + ro * Math.cos(a1);
    const y1o = cy + ro * Math.sin(a1);
    const x0i = cx + ri * Math.cos(a0);
    const y0i = cy + ri * Math.sin(a0);
    const x1i = cx + ri * Math.cos(a1);
    const y1i = cy + ri * Math.sin(a1);
    return [
      `M ${x0o} ${y0o}`,
      `A ${ro} ${ro} 0 ${large} 1 ${x1o} ${y1o}`,
      `L ${x1i} ${y1i}`,
      `A ${ri} ${ri} 0 ${large} 0 ${x0i} ${y0i}`,
      'Z',
    ].join(' ');
  }

  function buildPieSvg(entries: ReturnType<typeof visibleEntries>, total: number): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const SIZE = 300;
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const ro = 128;
    const ri = 68;
    const bg = resolvedBg();

    let angle = -Math.PI / 2;

    entries.forEach(({ item, color }) => {
      const pct = total > 0 ? (item.value / total) * 100 : 0;
      const sweep = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
      if (sweep <= 0) return;

      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;

      const path = document.createElementNS(SVG_NS, 'path');
      const isFull = sweep >= Math.PI * 2 - 0.0001;
      path.setAttribute('d', isFull ? fullRingPath(cx, cy, ro, ri) : slicePath(cx, cy, ro, ri, a0, a1));
      if (isFull) path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('fill', color);
      // 2px surface gap between adjacent fills (dataviz mark spec)
      path.setAttribute('stroke', bg);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('class', `${P}__slice`);
      path.setAttribute('data-key', keyOf(item));

      // Hover: slight outward offset along the mid-angle (JS — direction is per-slice)
      const mid = (a0 + a1) / 2;
      const dx = Math.cos(mid) * 5;
      const dy = Math.sin(mid) * 5;
      path.addEventListener('mouseenter', () => {
        path.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      path.addEventListener('mouseleave', () => {
        path.style.transform = '';
      });

      svg.appendChild(path);
      attachItemTooltip(path, item, pct);

      // Percent labels only on slices ≥ 8% (omit on thin slices)
      if (pct >= 8) {
        const rl = (ro + ri) / 2;
        const tx = cx + rl * Math.cos(mid);
        const ty = cy + rl * Math.sin(mid);
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', String(tx));
        text.setAttribute('y', String(ty));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#ffffff');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', "'Nunito', system-ui, sans-serif");
        text.setAttribute('pointer-events', 'none');
        text.textContent = fmtPct(pct);
        svg.appendChild(text);
      }
    });

    return svg;
  }

  function buildBarsSvg(entries: ReturnType<typeof visibleEntries>, total: number): SVGSVGElement {
    const sorted = [...entries].sort((a, b) => b.item.value - a.item.value);
    const W = 440;
    const ROW_H = 26;
    const LABEL_W = 132;
    const BAR_MAX = 200;
    const H = Math.max(ROW_H, sorted.length * ROW_H) + 6;
    const maxValue = sorted.reduce((m, e) => Math.max(m, e.item.value), 0);
    const textColor = resolvedText();
    const mutedColor = resolvedMuted();

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svg.setAttribute('role', 'img');

    sorted.forEach(({ item, color }, row) => {
      const pct = total > 0 ? (item.value / total) * 100 : 0;
      const y = row * ROW_H + 4;
      const barW = maxValue > 0 ? Math.max(2, (item.value / maxValue) * BAR_MAX) : 2;

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(LABEL_W - 8));
      label.setAttribute('y', String(y + 13));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', textColor);
      label.setAttribute('font-size', '11');
      label.setAttribute('font-family', "'Nunito', system-ui, sans-serif");
      const raw = item.label || '';
      label.textContent = raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
      svg.appendChild(label);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(LABEL_W));
      rect.setAttribute('y', String(y + 3));
      rect.setAttribute('width', String(barW));
      rect.setAttribute('height', '14');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', color);
      rect.setAttribute('class', `${P}__bar-rect`);
      rect.setAttribute('data-key', keyOf(item));
      svg.appendChild(rect);
      attachItemTooltip(rect, item, pct);

      const value = document.createElementNS(SVG_NS, 'text');
      value.setAttribute('x', String(LABEL_W + barW + 6));
      value.setAttribute('y', String(y + 13));
      value.setAttribute('text-anchor', 'start');
      value.setAttribute('fill', mutedColor);
      value.setAttribute('font-size', '10.5');
      value.setAttribute('font-family', "'Nunito', system-ui, sans-serif");
      value.textContent = `${settings.formatValue(item.value)}${settings.unit ? ` ${settings.unit}` : ''} · ${fmtPct(pct)}`;
      svg.appendChild(value);
    });

    return svg;
  }

  function buildLegend(total: number): HTMLElement {
    const legend = document.createElement('div');
    legend.className = `${P}__legend`;

    items.forEach((item, index) => {
      const key = keyOf(item);
      const isOff = hidden.has(key);
      const pct = !isOff && total > 0 ? (item.value / total) * 100 : null;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = [
        `${P}__legend-chip`,
        isOff ? 'is-off' : '',
        settings.legend.selectable ? 'is-selectable' : '',
      ]
        .filter(Boolean)
        .join(' ');
      chip.dataset.key = key;
      chip.title = item.label;

      const swatch = document.createElement('span');
      swatch.className = `${P}__legend-swatch`;
      swatch.style.background = colorFor(index, item);
      chip.appendChild(swatch);

      const label = document.createElement('span');
      label.className = `${P}__legend-label`;
      label.textContent = item.label;
      chip.appendChild(label);

      const pctEl = document.createElement('span');
      pctEl.className = `${P}__legend-pct`;
      pctEl.textContent = pct === null ? '—' : fmtPct(pct);
      chip.appendChild(pctEl);

      if (settings.legend.selectable) {
        chip.addEventListener('click', () => {
          if (hidden.has(key)) hidden.delete(key);
          else hidden.add(key);
          render(); // percentages recompute over the remaining items
        });
      }

      legend.appendChild(chip);
    });

    return legend;
  }

  function render(): void {
    if (destroyed) return;
    cleanupTooltips();
    applyRootDecoration();
    root.innerHTML = '';

    root.appendChild(buildHeader());

    const body = document.createElement('div');
    body.className = `${P}__body`;

    const canvas = document.createElement('div');
    canvas.className = `${P}__canvas`;

    const entries = visibleEntries();
    const total = entries.reduce((s, e) => s + (Number(e.item.value) || 0), 0);

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = `${P}__empty`;
      empty.textContent = items.length
        ? 'Todos os itens estão ocultos — clique na legenda para reexibir.'
        : 'Sem dados para exibir.';
      canvas.appendChild(empty);
    } else {
      canvas.appendChild(settings.chartType === 'bars' ? buildBarsSvg(entries, total) : buildPieSvg(entries, total));
    }

    body.appendChild(canvas);
    if (settings.legend.visible && items.length) body.appendChild(buildLegend(total));
    root.appendChild(body);
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  async function svgToPng(scale = 2): Promise<{ dataUrl: string; width: number; height: number } | null> {
    const svg = root.querySelector('svg');
    if (!svg) {
      console.warn('[ParticipationChart] Nada para exportar — gráfico vazio.');
      return null;
    }
    const vb = (svg as SVGSVGElement).viewBox.baseVal;
    const width = vb && vb.width ? vb.width : 300;
    const height = vb && vb.height ? vb.height : 300;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.fillStyle = resolvedBg();
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
        } catch (err) {
          console.warn('[ParticipationChart] Falha ao rasterizar o SVG:', err);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn('[ParticipationChart] Falha ao carregar o SVG para exportação.');
        resolve(null);
      };
      img.src = svgUrl;
    });
  }

  function exportFilenameBase(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    return `${slugify(settings.title || 'participacao') || 'participacao'}-${stamp}`;
  }

  async function exportPNG(): Promise<void> {
    const png = await svgToPng(2);
    if (!png) return;
    const a = document.createElement('a');
    a.href = png.dataUrl;
    a.download = `${exportFilenameBase()}.png`;
    a.click();
  }

  async function exportPDF(): Promise<void> {
    const png = await svgToPng(2);
    if (!png) return;
    try {
      const landscape = png.width >= png.height;
      const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const MARGIN = 12;

      // Header band — same visual language as the grid PDF export
      doc.setFillColor(62, 26, 125);
      doc.rect(0, 0, PW, 14, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(settings.title || 'Participação', MARGIN, 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, PW - MARGIN, 9, { align: 'right' });

      // Fit the chart image inside the content area, preserving aspect ratio
      const availW = PW - MARGIN * 2;
      const availH = PH - 14 - MARGIN * 2;
      const ratio = Math.min(availW / png.width, availH / png.height);
      const imgW = png.width * ratio;
      const imgH = png.height * ratio;
      const x = (PW - imgW) / 2;
      const y = 14 + (availH - imgH) / 2 + MARGIN / 2;
      doc.addImage(png.dataUrl, 'PNG', x, y, imgW, imgH);

      doc.save(`${exportFilenameBase()}.pdf`);
    } catch (err) {
      // jsPDF indisponível ou falha na geração — degrada sem quebrar o host.
      console.warn('[ParticipationChart] Exportação PDF indisponível:', err);
    }
  }

  // ── Expand / minimize ───────────────────────────────────────────────────────

  function expand(): void {
    if (destroyed || expanded) return;
    expanded = true;
    marker = document.createElement('div');
    marker.style.display = 'none';
    marker.className = `${P}-marker`;
    root.parentNode?.insertBefore(marker, root);

    overlay = document.createElement('div');
    overlay.className = `${P}-overlay`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) minimize();
    });
    overlay.appendChild(root);
    document.body.appendChild(overlay);
    render();
  }

  function minimize(): void {
    if (destroyed || !expanded) return;
    expanded = false;
    if (marker?.parentNode) {
      marker.parentNode.insertBefore(root, marker);
      marker.remove();
    } else {
      container.appendChild(root);
    }
    marker = null;
    overlay?.remove();
    overlay = null;
    render();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function updateData(next: ParticipationChartItem[]): void {
    if (destroyed) return;
    items = Array.isArray(next) ? [...next] : [];
    // Keep the hidden selection only for keys still present in the new dataset
    const keys = new Set(items.map(keyOf));
    Array.from(hidden).forEach((k) => {
      if (!keys.has(k)) hidden.delete(k);
    });
    render();
  }

  function updateSettings(partial: Partial<ParticipationChartSettings> & { unit?: string }): void {
    if (destroyed || !partial) return;
    if (partial.chartType) settings.chartType = partial.chartType;
    if (partial.showTypeSelector !== undefined) settings.showTypeSelector = partial.showTypeSelector;
    if (partial.title !== undefined) settings.title = partial.title || '';
    if (partial.subtitle !== undefined) settings.subtitle = partial.subtitle || '';
    if (partial.palette !== undefined) {
      settings.palette = Array.isArray(partial.palette) && partial.palette.length ? [...partial.palette] : null;
    }
    if (partial.paletteMode) settings.paletteMode = partial.paletteMode === 'random' ? 'random' : 'myio';
    if (partial.legend) {
      if (partial.legend.visible !== undefined) settings.legend.visible = partial.legend.visible;
      if (partial.legend.position) settings.legend.position = partial.legend.position;
      if (partial.legend.selectable !== undefined) settings.legend.selectable = partial.legend.selectable;
    }
    if (partial.themeMode) settings.themeMode = partial.themeMode === 'dark' ? 'dark' : 'light';
    if (partial.theme) {
      if (partial.theme.light) settings.theme.light = { ...settings.theme.light, ...partial.theme.light };
      if (partial.theme.dark) settings.theme.dark = { ...settings.theme.dark, ...partial.theme.dark };
    }
    if (partial.border !== undefined) settings.border = partial.border;
    if (partial.exportButtons) {
      if (partial.exportButtons.visible !== undefined) settings.exportButtons.visible = partial.exportButtons.visible;
      if (partial.exportButtons.pdf !== undefined) settings.exportButtons.pdf = partial.exportButtons.pdf;
      if (partial.exportButtons.png !== undefined) settings.exportButtons.png = partial.exportButtons.png;
    }
    if (partial.tooltip !== undefined) settings.tooltip = partial.tooltip;
    if (partial.expandable !== undefined) settings.expandable = partial.expandable;
    if (partial.formatValue) settings.formatValue = partial.formatValue;
    if (partial.unit !== undefined) settings.unit = partial.unit || '';
    render();
  }

  function destroy(): void {
    if (destroyed) return;
    if (expanded) minimize();
    cleanupTooltips();
    destroyed = true;
    root.remove();
    overlay?.remove();
    overlay = null;
    marker?.remove();
    marker = null;
  }

  render();

  return {
    element: root,
    updateData,
    updateSettings,
    setThemeMode: (mode: ParticipationChartThemeMode) => updateSettings({ themeMode: mode }),
    getHiddenIds: () => Array.from(hidden),
    getVisibleItems: () => visibleEntries().map((e) => e.item),
    expand,
    minimize,
    exportPNG,
    exportPDF,
    toPngDataUrl: () => svgToPng(2),
    destroy,
  };
}
