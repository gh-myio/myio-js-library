/**
 * Indicadores B1 / B2 / S (ED-1354) — três apresentações da mesma informação:
 *  - strip  : coluna no card do poço (verde = ligada, cinza = desligada, azul = aberta, vermelho = fechada)
 *  - tiles  : blocos discretos sob o ícone da modal do reservatório
 *  - chips  : mini-badges dentro do botão de atalho no header da modal
 */
import { formatClock } from './equipmentState';
import type { EquipmentIndicator } from './types';

const STYLE_ID = 'myio-equipment-indicators-styles';

export const PUMP_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><g class="myio-eq-rotor"><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/></g></svg>`;
export const VALVE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v10l9-5zM21 7v10l-9-5z"/><path d="M12 12V5M9 5h6"/></svg>`;

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Classe de estado: on/off (bomba), open/closed (válvula), unk (sem leitura). */
export function indicatorStateClass(ind: EquipmentIndicator): 'on' | 'off' | 'open' | 'closed' | 'unk' {
  if (ind.active === null || ind.active === undefined) return 'unk';
  if (ind.kind === 'valve') return ind.active ? 'open' : 'closed';
  return ind.active ? 'on' : 'off';
}

export function indicatorStateText(ind: EquipmentIndicator, short = false): string {
  if (ind.active === null || ind.active === undefined) return short ? 'S/ leit.' : 'sem leitura';
  if (ind.kind === 'valve') return ind.active ? (short ? 'Aberta' : 'aberta') : short ? 'Fechada' : 'fechada';
  return ind.active ? (short ? 'Ligada' : 'ligada') : short ? 'Deslig.' : 'desligada';
}

export function indicatorTitle(ind: EquipmentIndicator): string {
  const profile = ind.deviceProfile ? ` (${ind.deviceProfile})` : '';
  const since = ind.since ? ` desde ${formatClock(ind.since)}` : '';
  return `${ind.code} · ${ind.label}${profile}: ${indicatorStateText(ind)}${ind.active === null || ind.active === undefined ? '' : since}`;
}

export function ensureEquipmentIndicatorStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .myio-eq-strip{position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:25;display:flex;flex-direction:column;flex-wrap:wrap-reverse;align-content:flex-end;max-height:96px;gap:4px;font-family:Nunito,system-ui,sans-serif}
    .myio-eq-strip.clickable{cursor:pointer}
    .myio-eq-b{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:22px;padding:0 5px;
      border-radius:6px;font:800 11px Nunito,system-ui,sans-serif;border:1.5px solid;transition:all .25s;box-sizing:border-box}
    .myio-eq-b svg{width:13px;height:13px}
    .myio-eq-b.on{background:#22c55e;border-color:#16a34a;color:#fff;box-shadow:0 0 0 2px rgba(34,197,94,.25)}
    .myio-eq-b.off{background:#f1f5f9;border-color:#cbd5e1;color:#94a3b8}
    .myio-eq-b.open{background:#3b82f6;border-color:#1d4ed8;color:#fff;box-shadow:0 0 0 2px rgba(59,130,246,.25)}
    .myio-eq-b.closed{background:#fef2f2;border-color:#f87171;color:#dc2626}
    .myio-eq-b.unk{background:#fff;border-style:dashed;border-color:#cbd5e1;color:#94a3b8}
    .myio-eq-b.on::after,.myio-eq-b.open::after{content:'';position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;
      border:1.5px solid #fff;animation:myioEqPulse 1.4s ease-in-out infinite}
    .myio-eq-b.on::after{background:#16a34a}.myio-eq-b.open::after{background:#1d4ed8}

    .myio-eq-tiles{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
    .myio-eq-ti{width:50px;padding:6px 0 5px;border-radius:10px;background:rgba(255,255,255,.75);border:1px solid #e2e8f0;
      box-shadow:0 1px 2px rgba(15,23,42,.06);display:flex;flex-direction:column;align-items:center;gap:2px;
      font-family:Nunito,system-ui,sans-serif;transition:all .3s}
    .myio-eq-ti b{font-size:11.5px;font-weight:800;color:#334155;line-height:1}
    .myio-eq-ti small{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.3px;line-height:1}
    .myio-eq-ti i{width:8px;height:8px;border-radius:50%;background:#cbd5e1;margin-bottom:2px}
    .myio-eq-ti.on{border-color:#bbf7d0;background:linear-gradient(180deg,#f0fdf4,#fff)}
    .myio-eq-ti.on i{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18);animation:myioEqPulse 1.6s ease-in-out infinite}
    .myio-eq-ti.on small{color:#16a34a}
    .myio-eq-ti.open{border-color:#bfdbfe;background:linear-gradient(180deg,#eff6ff,#fff)}
    .myio-eq-ti.open i{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18);animation:myioEqPulse 1.6s ease-in-out infinite}
    .myio-eq-ti.open small{color:#2563eb}
    .myio-eq-ti.closed{border-color:#fecaca}.myio-eq-ti.closed i{background:#ef4444}.myio-eq-ti.closed small{color:#dc2626}

    .myio-eq-shortcut{display:inline-flex;align-items:center;gap:5px;margin-right:6px;padding:5px 10px;border-radius:8px;cursor:pointer;
      background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);color:#fff;font:700 12px Nunito,system-ui,sans-serif}
    .myio-eq-shortcut:hover{background:rgba(255,255,255,.26)}
    .myio-eq-shortcut svg{width:15px;height:15px}
    .myio-eq-shortcut i{font-style:normal;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px}
    .myio-eq-shortcut i.on{background:#22c55e;color:#fff}.myio-eq-shortcut i.off,.myio-eq-shortcut i.unk{background:rgba(255,255,255,.25);color:#e2e8f0}
    .myio-eq-shortcut i.open{background:#3b82f6;color:#fff}.myio-eq-shortcut i.closed{background:#ef4444;color:#fff}

    .myio-eq-rotor{transform-origin:12px 12px}
    .myio-eq-spin .myio-eq-rotor{animation:myioEqSpin 1s linear infinite}
    @keyframes myioEqSpin{to{transform:rotate(360deg)}}
    @keyframes myioEqPulse{0%,100%{opacity:1}50%{opacity:.35}}
    @media (prefers-reduced-motion:reduce){.myio-eq-b::after,.myio-eq-ti i,.myio-eq-spin .myio-eq-rotor{animation:none!important}}
  `;
  document.head.appendChild(style);
}

/** HTML interno da coluna do card (sem o wrapper). */
export function renderEquipmentStripHTML(indicators: EquipmentIndicator[]): string {
  return (indicators || [])
    .map((ind) => {
      const cls = indicatorStateClass(ind);
      // válvula única 'S' → ícone; várias (S1, S2…) → código, para distinguir
      const content = ind.kind === 'valve' && ind.code.length <= 1 ? VALVE_SVG : escapeHtml(ind.code);
      return `<span class="myio-eq-b ${cls}" data-code="${escapeHtml(ind.code)}" title="${escapeHtml(indicatorTitle(ind))}">${content}</span>`;
    })
    .join('');
}

/** Coluna B1/B2/S para o card; `onClick` torna a coluna clicável (abre a modal das bombas). */
export function createEquipmentIndicatorStrip(
  indicators: EquipmentIndicator[],
  opts: { onClick?: (ev: MouseEvent) => void } = {}
): HTMLElement {
  ensureEquipmentIndicatorStyles();
  const el = document.createElement('div');
  el.className = 'myio-eq-strip';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Bombas e solenoide');
  el.innerHTML = renderEquipmentStripHTML(indicators);
  if (typeof opts.onClick === 'function') {
    el.classList.add('clickable');
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      opts.onClick!(ev);
    });
  }
  return el;
}

/** Blocos discretos sob o ícone do reservatório. */
export function renderEquipmentTilesHTML(indicators: EquipmentIndicator[]): string {
  if (!indicators?.length) return '';
  return `<div class="myio-eq-tiles">${indicators
    .map((ind) => {
      const cls = indicatorStateClass(ind);
      return `<div class="myio-eq-ti ${cls}" title="${escapeHtml(indicatorTitle(ind))}"><i></i><b>${escapeHtml(ind.code)}</b><small>${indicatorStateText(ind, true)}</small></div>`;
    })
    .join('')}</div>`;
}

/** Conteúdo do botão de atalho (ícone + rótulo + mini-badges). */
export function renderEquipmentShortcutHTML(indicators: EquipmentIndicator[], label = 'Bombas'): string {
  const anyOn = (indicators || []).some((i) => i.kind === 'pump' && i.active === true);
  return (
    `<span class="${anyOn ? 'myio-eq-spin' : ''}" style="display:inline-flex">${PUMP_SVG}</span><span>${escapeHtml(label)}</span>` +
    (indicators || []).map((ind) => `<i class="${indicatorStateClass(ind)}">${escapeHtml(ind.code)}</i>`).join('')
  );
}
