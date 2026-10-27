/**
 * Modal "Automação dos Poços" (ED-1354): painel por bomba (estado, desde quando,
 * tempo ligada e acionamentos hoje, potência, nível do poço, linha do tempo 24 h)
 * + painel da solenoide da entrada de água. Somente leitura (sem comando/RPC).
 */
import { deviceIcons } from '../../utils/devices/deviceIcons';
import {
  dayStats,
  formatClock,
  formatDuration,
  isActive,
  stateSince,
  timelineSegments,
  DAY_MS,
} from './equipmentState';
import { escapeHtml, PUMP_SVG, VALVE_SVG } from './equipmentIndicators';
import type {
  OpenWellPumpsModalParams,
  WellPumpInfo,
  WellPumpsModalData,
  WellPumpsModalHandle,
  WellValveInfo,
} from './types';

const STYLE_ID = 'myio-well-pumps-modal-styles';
const TICK_MS = 30_000; // re-render das durações ("estado há") sem nova telemetria

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .myio-wp-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);display:flex;align-items:center;
      justify-content:center;font-family:Nunito,system-ui,sans-serif;animation:myioWpFade .15s ease-out}
    @keyframes myioWpFade{from{opacity:0}to{opacity:1}}
    .myio-wp-modal{width:min(880px,94vw);max-height:90vh;overflow:auto;background:#f8fafc;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.35);color:#1e293b}
    .myio-wp-head{display:flex;align-items:center;gap:12px;padding:16px 20px;color:#fff;background:linear-gradient(135deg,#3e1a7d 0%,#5b2bb5 100%);
      border-radius:14px 14px 0 0;position:sticky;top:0;z-index:2}
    .myio-wp-head h2{margin:0;font-size:17px;font-weight:800;color:#fff}
    .myio-wp-head p{margin:2px 0 0;font-size:12px;opacity:.85}
    .myio-wp-sim{margin-left:auto;font-size:10px;font-weight:800;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);padding:2px 8px;border-radius:999px}
    .myio-wp-close{margin-left:auto;background:rgba(255,255,255,.15);border:0;color:#fff;width:32px;height:32px;border-radius:8px;font-size:18px;cursor:pointer;flex:none}
    .myio-wp-sim + .myio-wp-close{margin-left:0}
    .myio-wp-close:hover{background:rgba(255,255,255,.28)}
    .myio-wp-body{padding:18px 20px 20px;display:flex;flex-direction:column;gap:16px}
    .myio-wp-empty{padding:28px;text-align:center;color:#64748b;font-size:13px}
    .myio-wp-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .myio-wp-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
    .myio-wp-kpi small{display:block;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
    .myio-wp-kpi b{font-size:20px;font-weight:800}
    .myio-wp-kpi .sub{font-size:11px;color:#64748b}
    .myio-wp-kpi b.open{color:#1d4ed8}.myio-wp-kpi b.closed{color:#b91c1c}
    .myio-wp-pumps{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    @media (max-width:720px){.myio-wp-pumps,.myio-wp-kpis{grid-template-columns:1fr}}
    .myio-wp-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;transition:box-shadow .2s,border-color .2s}
    .myio-wp-card.focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.18)}
    .myio-wp-top{display:flex;align-items:center;gap:12px}
    .myio-wp-img{width:54px;height:54px;object-fit:contain;transition:filter .3s}
    .myio-wp-card.is-off .myio-wp-img,.myio-wp-card.is-closed .myio-wp-img{filter:grayscale(1) opacity(.55)}
    .myio-wp-name{font-weight:800;font-size:15px}
    .myio-wp-tag{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:22px;padding:0 5px;border-radius:6px;
      font:800 11px Nunito,system-ui,sans-serif;margin-right:6px;vertical-align:middle;background:#e2e8f0;color:#64748b}
    .myio-wp-card.is-on .myio-wp-tag{background:#22c55e;color:#fff}
    .myio-wp-card.is-open .myio-wp-tag{background:#3b82f6;color:#fff}
    .myio-wp-card.is-closed .myio-wp-tag{background:#fecaca;color:#b91c1c}
    .myio-wp-meta{font-size:11.5px;color:#64748b;display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:2px}
    .myio-wp-prof{font-size:10px;font-weight:800;color:#475569;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:0 5px}
    .myio-wp-state{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-weight:800;font-size:13px;border:1px solid;white-space:nowrap}
    .myio-wp-state svg{width:16px;height:16px}
    .myio-wp-state.on{background:#dcfce7;border-color:#22c55e;color:#15803d}
    .myio-wp-state.off{background:#f1f5f9;border-color:#cbd5e1;color:#64748b}
    .myio-wp-state.open{background:#dbeafe;border-color:#3b82f6;color:#1d4ed8}
    .myio-wp-state.closed{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}
    .myio-wp-state.unk{background:#fff;border-style:dashed;border-color:#cbd5e1;color:#94a3b8}
    .myio-wp-state.on .myio-eq-rotor{transform-origin:12px 12px;animation:myioWpSpin 1s linear infinite}
    @keyframes myioWpSpin{to{transform:rotate(360deg)}}
    .myio-wp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .myio-wp-cell{background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:7px 9px}
    .myio-wp-cell small{display:block;font-size:10.5px;color:#64748b;font-weight:700}
    .myio-wp-cell span{font-size:14px;font-weight:800}
    .myio-wp-level{display:flex;align-items:center;gap:8px;font-size:12px;color:#475569}
    .myio-wp-bar{flex:1;height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}
    .myio-wp-bar i{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#0284c7);border-radius:999px}
    .myio-wp-tl small{font-size:10.5px;color:#64748b;font-weight:700;display:flex;justify-content:space-between}
    .myio-wp-track{position:relative;height:16px;border-radius:5px;background:#eef2f7;margin:4px 0 2px;overflow:hidden}
    .myio-wp-seg{position:absolute;top:0;bottom:0;background:#22c55e;border-radius:3px}
    .myio-wp-seg.live{background:repeating-linear-gradient(45deg,#22c55e 0 6px,#16a34a 6px 12px)}
    .myio-wp-seg.valve{background:#3b82f6}
    .myio-wp-seg.valve.live{background:repeating-linear-gradient(45deg,#3b82f6 0 6px,#1d4ed8 6px 12px)}
    .myio-wp-valve{display:grid;grid-template-columns:auto 1fr;gap:12px 16px;align-items:center}
    .myio-wp-foot{font-size:11.5px;color:#64748b}
    @media (prefers-reduced-motion:reduce){.myio-wp-overlay{animation:none}.myio-wp-state.on .myio-eq-rotor{animation:none}}
  `;
  document.head.appendChild(style);
}

const fmtKw = (n: number) => `${n.toFixed(1).replace('.', ',')} kW`;

function timelineHTML(history: WellPumpInfo['history'], now: number, kind: 'pump' | 'valve'): string {
  const segs = timelineSegments(history, now, DAY_MS)
    .map((s) => {
      const title = `${kind === 'valve' ? 'aberta ' : ''}${formatClock(s.start)} – ${s.end ? formatClock(s.end) : 'agora'}`;
      return `<span class="myio-wp-seg ${kind === 'valve' ? 'valve' : ''} ${s.live ? 'live' : ''}" style="left:${s.leftPct.toFixed(3)}%;width:${s.widthPct.toFixed(3)}%" title="${title}"></span>`;
    })
    .join('');
  return `
    <div class="myio-wp-tl">
      <small><span>Últimas 24 h</span><span>${kind === 'valve' ? 'azul = aberta' : 'verde = ligada'}</span></small>
      <div class="myio-wp-track">${segs}</div>
      <small><span>${formatClock(now - DAY_MS)}</span><span>agora</span></small>
    </div>`;
}

function pumpCardHTML(p: WellPumpInfo, now: number, images: { pump: string }, focusWellId?: string): string {
  const on = isActive(p.history);
  const known = Array.isArray(p.history);
  const stateClass = !known ? 'is-unknown' : on ? 'is-on' : 'is-off';
  const since = stateSince(p.history);
  const { activeMs, starts } = dayStats(p.history || [], now);
  const power = !known ? '—' : on ? (typeof p.powerKw === 'number' ? fmtKw(p.powerKw) : '—') : fmtKw(0).replace(',0', '');
  const hasLevel = typeof p.wellLevelMca === 'number';
  const hasPerc = typeof p.wellPercentage === 'number';
  const pct = hasPerc ? Math.round(Math.max(0, Math.min(1, p.wellPercentage as number)) * 100) : null;
  const meta = [p.identifier, p.wellLabel].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="myio-wp-card ${stateClass} ${focusWellId && p.wellId === focusWellId ? 'focus' : ''}" data-code="${escapeHtml(p.code)}">
      <div class="myio-wp-top">
        <img class="myio-wp-img" src="${escapeHtml(images.pump)}" alt="">
        <div>
          <div class="myio-wp-name"><span class="myio-wp-tag">${escapeHtml(p.code)}</span>${escapeHtml(p.label)}</div>
          <div class="myio-wp-meta"><span class="myio-wp-prof">${escapeHtml(p.deviceProfile || 'BOMBA_POCO')}</span>${meta}</div>
        </div>
        <span class="myio-wp-state ${!known ? 'unk' : on ? 'on' : 'off'}">${PUMP_SVG}${!known ? 'SEM LEITURA' : on ? 'LIGADA' : 'DESLIGADA'}</span>
      </div>
      <div class="myio-wp-grid">
        <div class="myio-wp-cell"><small>${known ? (on ? 'Ligada desde' : 'Desligada desde') : 'Estado desde'}</small><span>${formatClock(since)}</span></div>
        <div class="myio-wp-cell"><small>Tempo ligada hoje</small><span>${known ? formatDuration(activeMs) : '—'}</span></div>
        <div class="myio-wp-cell"><small>Acionamentos hoje</small><span>${known ? starts : '—'}</span></div>
        <div class="myio-wp-cell"><small>Potência atual</small><span>${power}</span></div>
        <div class="myio-wp-cell"><small>Estado há</small><span>${since ? formatDuration(now - since) : '—'}</span></div>
        <div class="myio-wp-cell"><small>Nível do poço</small><span>${hasLevel ? `${((p.wellLevelMca as number) / 100).toFixed(2).replace('.', ',')} M.C.A` : '—'}</span></div>
      </div>
      ${
        pct !== null
          ? `<div class="myio-wp-level">${escapeHtml(p.wellLabel || 'Poço')}<div class="myio-wp-bar"><i style="width:${pct}%"></i></div>${pct}%</div>`
          : ''
      }
      ${timelineHTML(p.history || [], now, 'pump')}
    </div>`;
}

function valveCardHTML(v: WellValveInfo, now: number, images: { valve: string }): string {
  const open = isActive(v.history);
  const known = Array.isArray(v.history);
  const stateClass = !known ? 'is-unknown' : open ? 'is-open' : 'is-closed';
  const since = stateSince(v.history);
  const { activeMs, starts } = dayStats(v.history || [], now);
  const meta = [v.identifier, v.description].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="myio-wp-card myio-wp-valve ${stateClass}" data-code="${escapeHtml(v.code)}">
      <img class="myio-wp-img" src="${escapeHtml(images.valve)}" alt="">
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
        <div class="myio-wp-top">
          <div>
            <div class="myio-wp-name"><span class="myio-wp-tag">${escapeHtml(v.code)}</span>${escapeHtml(v.label)}</div>
            <div class="myio-wp-meta"><span class="myio-wp-prof">${escapeHtml(v.deviceProfile || 'SOLENOIDE')}</span>${meta}</div>
          </div>
          <span class="myio-wp-state ${!known ? 'unk' : open ? 'open' : 'closed'}">${VALVE_SVG}${!known ? 'SEM LEITURA' : open ? 'ABERTA' : 'FECHADA'}</span>
        </div>
        <div class="myio-wp-grid">
          <div class="myio-wp-cell"><small>${known ? (open ? 'Aberta desde' : 'Fechada desde') : 'Estado desde'}</small><span>${formatClock(since)}</span></div>
          <div class="myio-wp-cell"><small>Tempo aberta hoje</small><span>${known ? formatDuration(activeMs) : '—'}</span></div>
          <div class="myio-wp-cell"><small>Aberturas hoje</small><span>${known ? starts : '—'}</span></div>
        </div>
        ${timelineHTML(v.history || [], now, 'valve')}
      </div>
    </div>`;
}

/** HTML do corpo (exportado para testes). */
export function renderWellPumpsBodyHTML(
  data: WellPumpsModalData,
  opts: { now?: number; focusWellId?: string; footnote?: string; images?: { pump?: string; valve?: string } } = {}
): string {
  const now = opts.now ?? Date.now();
  const images = {
    pump: opts.images?.pump || deviceIcons.BOMBA_POCO,
    valve: opts.images?.valve || deviceIcons.SOLENOIDE,
  };
  const pumps = data?.pumps || [];
  const valves = data?.valves || [];
  if (!pumps.length && !valves.length) return `<div class="myio-wp-empty">Nenhuma bomba ou solenoide vinculada a este poço.</div>`;

  const onPumps = pumps.filter((p) => isActive(p.history));
  const unknownPumpCount = pumps.filter((p) => !Array.isArray(p.history)).length;
  const knownPower = onPumps.filter((p) => typeof p.powerKw === 'number');
  const totalPower =
    unknownPumpCount > 0
      ? knownPower.length
        ? `${fmtKw(knownPower.reduce((s, p) => s + (p.powerKw as number), 0))} parcial`
        : '—'
      : knownPower.length
        ? fmtKw(knownPower.reduce((s, p) => s + (p.powerKw as number), 0))
        : onPumps.length
          ? '—'
          : '0 kW';
  const openValves = valves.filter((v) => isActive(v.history));
  const unknownValveCount = valves.filter((v) => !Array.isArray(v.history)).length;
  // 1 solenoide → estado + desde quando; M solenoides → "X de M abertas"
  const valveKpi =
    valves.length === 1
      ? `<div class="myio-wp-kpi"><small>${escapeHtml(valves[0].label)}</small><b class="${!Array.isArray(valves[0].history) ? '' : openValves.length ? 'open' : 'closed'}">${!Array.isArray(valves[0].history) ? 'SEM LEITURA' : openValves.length ? 'Aberta' : 'Fechada'}</b>
           <div class="sub">${Array.isArray(valves[0].history) ? `desde ${formatClock(stateSince(valves[0].history))}` : 'Estado desconhecido'}</div></div>`
      : valves.length > 1
        ? `<div class="myio-wp-kpi"><small>Solenoides abertas</small><b>${openValves.length} de ${valves.length}</b>${unknownValveCount ? `<div class="sub">${unknownValveCount} sem leitura</div>` : ''}</div>`
        : '';
  const pumpKpis = pumps.length
    ? `<div class="myio-wp-kpi"><small>Bombas ligadas</small><b>${onPumps.length} de ${pumps.length}</b>${unknownPumpCount ? `<div class="sub">${unknownPumpCount} sem leitura</div>` : ''}</div>
       <div class="myio-wp-kpi"><small>Potência total</small><b>${totalPower}</b>${unknownPumpCount && knownPower.length ? `<div class="sub">${unknownPumpCount} sem leitura</div>` : ''}</div>`
    : '';

  return `
    <div class="myio-wp-kpis">${pumpKpis}${valveKpi}</div>
    ${pumps.length ? `<div class="myio-wp-pumps">${pumps.map((p) => pumpCardHTML(p, now, images, opts.focusWellId)).join('')}</div>` : ''}
    ${valves.map((v) => valveCardHTML(v, now, images)).join('')}
    ${opts.footnote ? `<div class="myio-wp-foot">ⓘ ${escapeHtml(opts.footnote)}</div>` : ''}`;
}

/** Abre a modal "Automação dos Poços". Somente leitura. */
export function openWellPumpsModal(params: OpenWellPumpsModalParams): WellPumpsModalHandle {
  ensureStyles();
  const overlay = document.createElement('div');
  overlay.className = 'myio-wp-overlay';
  overlay.style.zIndex = String(params.zIndex ?? 100000);
  overlay.innerHTML = `
    <div class="myio-wp-modal" role="dialog" aria-modal="true" aria-labelledby="myio-wp-title">
      <div class="myio-wp-head">
        <div>
          <h2 id="myio-wp-title">${escapeHtml(params.title || 'Automação dos Poços')}</h2>
          ${params.subtitle ? `<p>${escapeHtml(params.subtitle)}</p>` : ''}
        </div>
        ${params.simulated ? '<span class="myio-wp-sim">SIMULADO</span>' : ''}
        <button type="button" class="myio-wp-close" title="Fechar" aria-label="Fechar">×</button>
      </div>
      <div class="myio-wp-body"><div class="myio-wp-empty">Carregando…</div></div>
    </div>`;
  const body = overlay.querySelector('.myio-wp-body') as HTMLElement;

  let current: WellPumpsModalData | null = null;
  let closed = false;
  const timers: Array<ReturnType<typeof setInterval>> = [];

  const render = () => {
    if (closed || !current) return;
    body.innerHTML = renderWellPumpsBodyHTML(current, {
      focusWellId: params.focusWellId,
      footnote: params.footnote,
      images: params.images,
    });
  };
  const update = (data: WellPumpsModalData) => {
    current = data;
    render();
  };
  const load = async () => {
    if (typeof params.data !== 'function') return;
    try {
      update(await params.data());
    } catch (err) {
      console.warn('[WellPumpsModal] falha ao carregar dados:', err);
      if (!current) body.innerHTML = `<div class="myio-wp-empty">Não foi possível carregar o estado das bombas.</div>`;
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    if (closed) return;
    closed = true;
    timers.forEach(clearInterval);
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    try {
      params.onClose?.();
    } catch (err) {
      console.warn('[WellPumpsModal] onClose falhou:', err);
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.myio-wp-close')!.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  (overlay.querySelector('.myio-wp-close') as HTMLButtonElement).focus();

  if (typeof params.data === 'function') {
    load();
    if (params.refreshIntervalMs && params.refreshIntervalMs > 0) timers.push(setInterval(load, params.refreshIntervalMs));
  } else {
    update(params.data);
  }
  timers.push(setInterval(render, TICK_MS));

  return { update, close, element: overlay };
}
