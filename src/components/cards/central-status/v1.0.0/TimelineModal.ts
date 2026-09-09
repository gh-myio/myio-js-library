/**
 * CentralStatusCard v1.0.0 (RFC-0231) — connectivity timeline modal.
 *
 * Ports the 📈 feature the old DivCard-based central card had: a period
 * selector (24h/7d/30d/90d) over `orchestrator_devices_status_history`
 * (migration 0072, append-on-change — one row per status TRANSITION, never
 * per tick), rendered as a stacked connectivity bar + a chronological
 * transitions list.
 *
 * The server (GET {baseUrl}{path}?days=N) already reconstructs continuous
 * segments from the raw transitions — this module renders what it returns,
 * it does not re-derive segments client-side.
 *
 * Auth is never invented here: `fetchOptions` passes through to `fetch()`
 * verbatim, or the host fully owns the network call via `onFetchTimeline`.
 * Same principle as `onMonitoringToggle`/`onStatusToggle`/`onForceSync`.
 */
import { openGenericModal } from '../../../premium-modals/dialog';
import type {
  CentralStatusCardLabels,
  CentralTimelineResponse,
  CentralTimelineSegment,
  CentralTimelineStatus,
  CentralTimelineTransition,
  CreateCentralStatusCardTimelineConfig,
} from './types';

const STYLE_ID = 'myio-cscard-timeline-styles';
const DEFAULT_PERIODS = [1, 7, 30, 90];

function escAttr(s: string): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function injectTimelineModalStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = `
.myio-tlmodal{
  --tl-online:#3b82f6;
  --tl-degraded:#f59e0b;
  --tl-offline:#f43f5e;
  --tl-unknown:#94a3b8;
  --tl-text:#1e293b;
  --tl-muted:#64748b;
  --tl-border:#e2e8f0;
  font-family:'Nunito', system-ui, sans-serif;
  color:var(--tl-text);
}
.myio-tlmodal[data-theme="dark"]{
  --tl-text:#e2e8f0;
  --tl-muted:#94a3b8;
  --tl-border:rgba(148,163,184,.22);
}
.myio-tlmodal__periods{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;}
.myio-tlmodal__period-btn{
  font:700 12px 'Nunito', system-ui, sans-serif;padding:6px 12px;border-radius:999px;
  border:1px solid var(--tl-border);background:transparent;color:var(--tl-muted);cursor:pointer;
}
.myio-tlmodal__period-btn:hover{background:rgba(59,130,246,.08);}
.myio-tlmodal__period-btn[aria-selected="true"]{background:#3b82f6;color:#fff;border-color:#3b82f6;}
.myio-tlmodal__period-btn:disabled{opacity:.5;cursor:not-allowed;}

.myio-tlmodal__legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:12px;color:var(--tl-muted);}
.myio-tlmodal__legend-item{display:inline-flex;align-items:center;gap:5px;}
.myio-tlmodal__swatch{width:10px;height:10px;border-radius:3px;display:inline-block;flex-shrink:0;}
.myio-tlmodal__swatch--ONLINE{background:var(--tl-online);}
.myio-tlmodal__swatch--DEGRADED{background:var(--tl-degraded);}
.myio-tlmodal__swatch--OFFLINE{background:var(--tl-offline);}
.myio-tlmodal__swatch--UNKNOWN{background:var(--tl-unknown);}

.myio-tlmodal__bar{
  display:flex;width:100%;height:26px;border-radius:6px;overflow:hidden;margin-bottom:12px;
  border:1px solid var(--tl-border);
}
.myio-tlmodal__seg{height:100%;min-width:2px;}
.myio-tlmodal__seg--ONLINE{background:var(--tl-online);}
.myio-tlmodal__seg--DEGRADED{background:var(--tl-degraded);}
.myio-tlmodal__seg--OFFLINE{background:var(--tl-offline);}
.myio-tlmodal__seg--UNKNOWN{background:var(--tl-unknown);}

.myio-tlmodal__list{list-style:none;margin:0;padding:0;max-height:280px;overflow-y:auto;}
.myio-tlmodal__list-item{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:7px 0;font-size:12.5px;
  border-bottom:1px solid var(--tl-border);
}
.myio-tlmodal__list-item:last-child{border-bottom:none;}
.myio-tlmodal__list-transition{font-weight:700;}
.myio-tlmodal__list-time{color:var(--tl-muted);}
.myio-tlmodal__list-probe{
  font:700 10.5px 'Nunito', system-ui, sans-serif;padding:1px 7px;border-radius:999px;
  background:rgba(148,163,184,.15);color:var(--tl-muted);
}
.myio-tlmodal__list-mode{
  font:700 10px 'Nunito', system-ui, sans-serif;padding:1px 7px;border-radius:999px;
  text-transform:uppercase;letter-spacing:.03em;
}
.myio-tlmodal__list-mode--shadow{background:rgba(148,163,184,.18);color:var(--tl-muted);}
.myio-tlmodal__list-mode--canonical{background:rgba(59,130,246,.15);color:#1d4ed8;}
.myio-tlmodal[data-theme="dark"] .myio-tlmodal__list-mode--canonical{color:#93c5fd;}

.myio-tlmodal__empty{color:var(--tl-muted);font-size:13px;padding:12px 0;}
.myio-tlmodal__shadow-note{color:var(--tl-muted);font-size:11.5px;margin-top:10px;font-style:italic;}
.myio-tlmodal__error{color:#dc2626;font-size:13px;padding:8px 0;}
.myio-tlmodal__retry{
  margin-left:8px;font:700 12px 'Nunito', system-ui, sans-serif;padding:4px 10px;border-radius:6px;
  border:1px solid #dc2626;background:transparent;color:#dc2626;cursor:pointer;
}
.myio-tlmodal__loading{color:var(--tl-muted);font-size:13px;padding:12px 0;}
`;
  document.head.appendChild(tag);
}

/** "8h" / "45min" — rounded, single-unit, matches the legacy tooltip format exactly. */
function formatRoundedDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function formatDateTime(iso: string, language: 'pt' | 'en'): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString(language === 'en' ? 'en-US' : 'pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LEGEND_DEFAULT: Record<'pt' | 'en', Record<CentralTimelineStatus, string>> = {
  pt: { ONLINE: 'ONLINE', DEGRADED: 'ATENÇÃO', OFFLINE: 'OFFLINE', UNKNOWN: 'DESCONHECIDO' },
  en: { ONLINE: 'ONLINE', DEGRADED: 'DEGRADED', OFFLINE: 'OFFLINE', UNKNOWN: 'UNKNOWN' },
};

function periodLabel(days: number, overrides: Partial<Record<number, string>> | undefined, language: 'pt' | 'en'): string {
  if (overrides?.[days]) return overrides[days] as string;
  if (days === 1) return language === 'en' ? '24h' : '24h';
  const unit = language === 'en' ? 'd' : 'dias';
  return `${days} ${unit}`;
}

/** Renders the stacked bar. Floors each segment to >=0.3% then renormalizes so the total is exactly 100%. */
function renderBarHtml(segments: CentralTimelineSegment[], language: 'pt' | 'en', legend: Record<CentralTimelineStatus, string>): string {
  if (segments.length === 0) return '';
  const totalMs = segments.reduce((sum, s) => sum + s.durationMs, 0);
  if (totalMs <= 0) return '';
  const floored = segments.map((s) => Math.max(0.3, (s.durationMs / totalMs) * 100));
  const flooredSum = floored.reduce((a, b) => a + b, 0);
  const pct = floored.map((p) => (p / flooredSum) * 100);

  return (
    `<div class="myio-tlmodal__bar" role="img" aria-label="${escAttr(
      segments.map((s) => `${legend[s.status]} ${formatRoundedDuration(s.durationMs)}`).join(', ')
    )}">` +
    segments
      .map((s, i) => {
        const title = `${legend[s.status]} · ${formatDateTime(s.start, language)} → ${formatDateTime(
          s.end,
          language
        )} (${formatRoundedDuration(s.durationMs)})`;
        return `<span class="myio-tlmodal__seg myio-tlmodal__seg--${s.status}" style="flex-basis:${pct[i].toFixed(
          3
        )}%" title="${escAttr(title)}"></span>`;
      })
      .join('') +
    `</div>`
  );
}

function renderListHtml(
  transitions: CentralTimelineTransition[],
  language: 'pt' | 'en',
  emptyText: string
): string {
  if (transitions.length === 0) {
    return `<p class="myio-tlmodal__empty">${escAttr(emptyText)}</p>`;
  }
  const sorted = [...transitions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return (
    `<ul class="myio-tlmodal__list">` +
    sorted
      .map(
        (t) => `<li class="myio-tlmodal__list-item">
          <span class="myio-tlmodal__list-transition">${escAttr(t.from_status)} → ${escAttr(t.to_status)}</span>
          <span class="myio-tlmodal__list-time">${escAttr(formatDateTime(t.created_at, language))}</span>
          ${t.probe_result ? `<span class="myio-tlmodal__list-probe">${escAttr(t.probe_result)}</span>` : ''}
          <span class="myio-tlmodal__list-mode myio-tlmodal__list-mode--${t.mode}">${escAttr(t.mode)}</span>
        </li>`
      )
      .join('') +
    `</ul>`
  );
}

function buildTimelineUrl(config: CreateCentralStatusCardTimelineConfig, id: string, days: number): string {
  const path = (config.path || '/admin/orchestrator-devices/api/centrals/:id/timeline').replace(
    ':id',
    encodeURIComponent(id)
  );
  const base = (config.baseUrl || '').replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  return `${base}${path}${sep}days=${days}`;
}

async function fetchCentralTimeline(
  config: CreateCentralStatusCardTimelineConfig,
  id: string,
  days: number
): Promise<CentralTimelineResponse> {
  if (config.onFetchTimeline) return config.onFetchTimeline({ id, days });
  if (!config.baseUrl) {
    throw new Error('[CentralStatusCard timeline] requires either `baseUrl` or `onFetchTimeline`');
  }
  const url = buildTimelineUrl(config, id, days);
  const res = await fetch(url, config.fetchOptions);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface OpenCentralTimelineModalParams {
  id: string;
  name: string;
  timeline: CreateCentralStatusCardTimelineConfig;
  labels: CentralStatusCardLabels;
  language: 'pt' | 'en';
  theme: 'light' | 'dark';
  container?: HTMLElement;
}

/**
 * Opens the timeline modal and drives its own fetch/period-switch lifecycle.
 * Fire-and-forget from the card's point of view — nothing to clean up on the
 * caller's side beyond what `openGenericModal`'s own dismiss handling covers.
 */
export function openCentralTimelineModal(params: OpenCentralTimelineModalParams): void {
  injectTimelineModalStyles();

  const { id, name, timeline, labels: l, language } = params;
  const periods = timeline.periods && timeline.periods.length > 0 ? timeline.periods : DEFAULT_PERIODS;
  let selectedDays = timeline.defaultDays ?? (periods.includes(30) ? 30 : periods[0]);
  const legend: Record<CentralTimelineStatus, string> = {
    ...LEGEND_DEFAULT[language],
    ...(l.timelineLegend || {}),
  } as Record<CentralTimelineStatus, string>;

  const title = (l.timelineModalTitle || (language === 'en' ? 'Connectivity timeline — {name}' : 'Timeline de conectividade — {name}')).replace(
    '{name}',
    name
  );
  const loadingText = l.timelineLoading || (language === 'en' ? 'Loading…' : 'Carregando…');
  const errorText = l.timelineFetchError || (language === 'en' ? 'Could not load the timeline.' : 'Não foi possível carregar a timeline.');
  const retryText = l.timelineRetry || (language === 'en' ? 'Retry' : 'Tentar novamente');
  const emptyText = l.timelineEmptyState || (language === 'en' ? 'No transitions recorded in this period.' : 'Sem transições registradas nesse período.');
  const shadowNote = l.timelineShadowNote || (language === 'en'
    ? 'While in shadow, this reflects the proposed trajectory; canonical once active.'
    : 'Em shadow, reflete o estado proposto; canônico quando ativo.');

  function periodsHtml(busy: boolean): string {
    return (
      `<div class="myio-tlmodal__periods" role="tablist">` +
      periods
        .map(
          (d) =>
            `<button type="button" class="myio-tlmodal__period-btn" data-days="${d}" role="tab" aria-selected="${
              d === selectedDays
            }" ${busy ? 'disabled' : ''}>${escAttr(periodLabel(d, l.timelinePeriodLabels, language))}</button>`
        )
        .join('') +
      `</div>`
    );
  }

  function legendHtml(): string {
    return (
      `<div class="myio-tlmodal__legend">` +
      (['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN'] as CentralTimelineStatus[])
        .map(
          (s) =>
            `<span class="myio-tlmodal__legend-item"><span class="myio-tlmodal__swatch myio-tlmodal__swatch--${s}"></span>${escAttr(
              legend[s]
            )}</span>`
        )
        .join('') +
      `</div>`
    );
  }

  function bodyHtml(state: { loading: boolean; error: string | null; data: CentralTimelineResponse | null }): string {
    let content: string;
    if (state.loading) {
      content = `<p class="myio-tlmodal__loading">${escAttr(loadingText)}</p>`;
    } else if (state.error) {
      content = `<p class="myio-tlmodal__error">${escAttr(errorText)} <button type="button" class="myio-tlmodal__retry" data-role="timeline-retry">${escAttr(
        retryText
      )}</button></p>`;
    } else if (state.data) {
      content =
        renderBarHtml(state.data.segments, language, legend) +
        renderListHtml(state.data.transitions, language, emptyText) +
        `<p class="myio-tlmodal__shadow-note">${escAttr(shadowNote)}</p>`;
    } else {
      content = '';
    }
    return `<div class="myio-tlmodal" data-theme="${params.theme}">${periodsHtml(state.loading)}${legendHtml()}${content}</div>`;
  }

  const modal = openGenericModal({
    title,
    icon: '📈',
    bodyHtml: bodyHtml({ loading: true, error: null, data: null }),
    theme: params.theme,
    width: 640,
    container: params.container,
  });

  function load(days: number): void {
    selectedDays = days;
    modal.setBodyHtml(bodyHtml({ loading: true, error: null, data: null }));
    fetchCentralTimeline(timeline, id, days).then(
      (data) => modal.setBodyHtml(bodyHtml({ loading: false, error: null, data })),
      () => modal.setBodyHtml(bodyHtml({ loading: false, error: errorText, data: null }))
    );
  }

  // Event delegation on the stable body element — survives setBodyHtml()
  // replacing innerHTML on every load/period-switch/retry cycle.
  modal.getBodyEl().addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const periodBtn = target.closest<HTMLElement>('[data-days]');
    if (periodBtn) {
      const days = Number(periodBtn.dataset.days);
      if (!Number.isNaN(days) && days !== selectedDays) load(days);
      return;
    }
    if (target.closest('[data-role="timeline-retry"]')) {
      load(selectedDays);
    }
  });

  load(selectedDays);
}
