/**
 * CentralStatusCard v1.0.0 (RFC-0231)
 *
 * Shared vanilla-DOM "Central Status card" — connectivity/monitoring/status
 * surface for one central, unifying the GCDR orchestrator-devices cockpit and
 * the customer centrals list. Two visually separated blocks: Operação
 * (connectivity, Monitoramento slider, force-sync, evidence) and Cadastro
 * (Status slider). Auth/audit are NOT baked in — the host supplies async
 * callbacks; this component owns only presentation + optimistic UI + confirm.
 */
import {
  CentralAnnotationType,
  CentralEntityStatus,
  CentralStatusCardForceSyncEvent,
  CentralStatusCardHandle,
  CentralStatusCardLabels,
  CentralStatusToggleEvent,
  CentralMonitoringToggleEvent,
  CreateCentralStatusCardParams,
  DivCardAccent,
} from './types';
import { injectCentralStatusCardStyles } from './styles';
import { deriveCentralConnectivity, CentralConnectivity } from '../../../../utils/central/deriveConnectivity';
import { openConfirmDialog } from '../../../premium-modals/dialog';
import type { DialogButton } from '../../../premium-modals/dialog';
import { InfoTooltip } from '../../../../utils/tooltips/InfoTooltip';
import { openCentralTimelineModal } from './TimelineModal';

function escAttr(s: string): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

const CONNECTIVITY_ACCENT: Record<CentralConnectivity, Exclude<DivCardAccent, 'none'>> = {
  ONLINE: 'emerald',
  OFFLINE: 'rose',
  WARNING: 'amber',
  UNKNOWN: 'slate',
};

type DefaultLabelSet = Required<
  Pick<
    CentralStatusCardLabels,
    | 'connectivity'
    | 'monitoring'
    | 'status'
    | 'forceSync'
    | 'lastAttempt'
    | 'lastSuccess'
    | 'connectionTest'
    | 'devices'
    | 'deviceTotal'
    | 'deviceOnline'
    | 'deviceOffline'
    | 'deviceUnknown'
    | 'divergence'
  >
>;

const DEFAULT_LABELS_PT: DefaultLabelSet = {
  connectivity: 'conectividade',
  monitoring: 'Monitoramento',
  status: 'Status',
  forceSync: 'Atualizar evidência',
  lastAttempt: 'última tentativa',
  lastSuccess: 'último sucesso',
  connectionTest: 'teste de conexão',
  devices: 'dispositivos',
  deviceTotal: 'total',
  deviceOnline: 'online',
  deviceOffline: 'offline',
  deviceUnknown: 'desconhecido',
  divergence: 'divergência',
};

const DEFAULT_LABELS_EN: DefaultLabelSet = {
  connectivity: 'connectivity',
  monitoring: 'Monitoring',
  status: 'Status',
  forceSync: 'Refresh evidence',
  lastAttempt: 'last attempt',
  lastSuccess: 'last success',
  connectionTest: 'connection test',
  devices: 'devices',
  deviceTotal: 'total',
  deviceOnline: 'online',
  deviceOffline: 'offline',
  deviceUnknown: 'unknown',
  divergence: 'divergence',
};

const STALE_BADGE_TEXT: Record<'pt' | 'en', string> = {
  pt: 'desatualizado',
  en: 'stale',
};

/** Deltas within ±this (ms) render as "flat" (▬) rather than a directional arrow. */
const LATENCY_TREND_FLAT_THRESHOLD_MS = 100;

type LatencyTrend = 'faster' | 'flat' | 'slower';

function latencyTrend(current: number, previous: number | null): LatencyTrend | null {
  if (previous == null) return null; // nothing to compare against yet
  const delta = current - previous; // negative = faster (lower latency is better)
  if (Math.abs(delta) <= LATENCY_TREND_FLAT_THRESHOLD_MS) return 'flat';
  return delta < 0 ? 'faster' : 'slower';
}

// Per explicit spec: straight-up green when faster, flat black bar within
// tolerance, DIAGONAL red (not straight-down) when it got worse.
const LATENCY_TREND_GLYPH: Record<LatencyTrend, string> = {
  faster: '↑',
  flat: '▬',
  slower: '↘',
};

// Invariant across languages per explicit request — Monitoramento reads
// "ON"/"OFF" in both pt and en, unlike the Status switch (ATIVO/INATIVO vs
// ACTIVE/INACTIVE), which does translate.
const MONITORING_SWITCH_TEXT: Record<'pt' | 'en', { on: string; off: string }> = {
  pt: { on: 'ON', off: 'OFF' },
  en: { on: 'ON', off: 'OFF' },
};

const ENTITY_STATUS_TEXT: Record<'pt' | 'en', Record<CentralEntityStatus, string>> = {
  // DELETED behavior (should the switch even render? disabled? a distinct
  // badge?) is intentionally undesigned — see the CentralEntityStatus doc
  // comment in types.ts. This just keeps the switch-text from ever showing
  // "undefined" if a host passes it today.
  pt: { ACTIVE: 'ATIVO', INACTIVE: 'INATIVO', DELETED: 'EXCLUÍDO' },
  en: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', DELETED: 'DELETED' },
};

const CONNECTIVITY_VALUE_DEFAULT: Record<CentralConnectivity, string> = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  WARNING: 'WARNING',
  UNKNOWN: 'UNKNOWN',
};

/** Native confirm() fallback used only when openConfirmDialog itself throws/is unavailable. */
async function confirmFallback(title: string, message: string): Promise<boolean> {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(`${title}\n\n${message}`);
  }
  return true;
}

const DATE_LOCALE: Record<'pt' | 'en', string> = { pt: 'pt-BR', en: 'en-US' };

function formatSince(iso: string | null | undefined, nowMs: number, language: 'pt' | 'en'): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const date = new Date(t);
  const abs = date.toLocaleString(DATE_LOCALE[language], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const deltaMs = Math.max(0, nowMs - t);
  const s = Math.round(deltaMs / 1000);
  let rel: string;
  if (s < 60) rel = `${s}s`;
  else if (s < 3600) rel = `${Math.round(s / 60)}min`;
  else if (s < 86400) rel = `${Math.round(s / 3600)}h`;
  else rel = `${Math.round(s / 86400)}d`;
  return `${abs} (${rel})`;
}

/** "2h30min" / "45min" style duration, used for the OFFLINE_HARD badge suffix. */
function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return hours > 0 ? `${hours}h${minutes}min` : `${minutes}min`;
}

export class CentralStatusCard implements CentralStatusCardHandle {
  public el: HTMLElement;

  private params: CreateCentralStatusCardParams;
  private theme: 'light' | 'dark';
  private monitoringBusy = false;
  private statusBusy = false;
  private forceSyncBusy = false;
  private monitoringError: string | null = null;
  private statusError: string | null = null;
  private detachTitleTooltip: (() => void) | null = null;
  private detachDivergenceTooltip: (() => void) | null = null;
  private detachAlarmTooltip: (() => void) | null = null;
  private detachTicketTooltip: (() => void) | null = null;
  private detachAnnotationTooltips: Array<() => void> = [];
  /** Latency from the PREVIOUS render, to derive the trend arrow next to
   *  "teste de conexão". Internal — the host doesn't need to track deltas
   *  itself; each update() with a fresh probeVerdict.latencyMs naturally
   *  becomes the new baseline for the next comparison. */
  private lastLatencyMs: number | null = null;

  constructor(params: CreateCentralStatusCardParams) {
    this.params = { ...params };
    this.theme = params.theme || 'light';

    injectCentralStatusCardStyles();

    this.el = document.createElement('article');
    this.bindRootEvents(); // once — this.el survives every render()'s innerHTML rebuild
    this.render();
    if (params.container) params.container.appendChild(this.el);
  }

  /**
   * Listeners on `this.el` itself (not on children replaced by innerHTML)
   * must be bound exactly ONCE — re-binding on every render() would stack a
   * duplicate handler per render, firing onClickCard/dragstart N times after
   * N re-renders. `this.params` is read fresh inside each handler instead, so
   * update() (enableDragDrop/onClickCard changing) is picked up without
   * re-binding.
   */
  private bindRootEvents(): void {
    this.el.addEventListener('dragstart', (e) => {
      if (!this.params.enableDragDrop) return;
      const dt = (e as DragEvent).dataTransfer;
      if (!dt) return;
      // Same payload shape as cards/main-view/v6.0.0's device card, so
      // existing drop-zones built for that card stay compatible.
      dt.setData('text/myio-id', this.params.id);
      dt.setData('application/json', JSON.stringify({ id: this.params.id, name: this.params.name }));
      dt.setData('text/myio-name', this.params.name);
      dt.effectAllowed = 'copy';
    });

    this.el.addEventListener('click', (e) => {
      if (!this.params.onClickCard) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, a, [role="switch"], [role="button"], [tabindex]')) return;
      this.params.onClickCard({ id: this.params.id, source: 'central-status-card' });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public update(patch: Partial<CreateCentralStatusCardParams>): void {
    this.params = { ...this.params, ...patch };
    if (patch.theme !== undefined) this.theme = patch.theme;
    this.render();
  }

  public setThemeMode(mode: 'light' | 'dark'): void {
    if (mode === this.theme) return;
    this.theme = mode;
    this.el.dataset.theme = mode;
  }

  public setMonitoring(next: boolean): void {
    // Programmatic (tests / external sync) — bypasses confirm/callback.
    this.params.monitoringEnabled = next;
    this.render();
  }

  public setStatus(next: CentralEntityStatus): void {
    this.params.entityStatus = next;
    this.render();
  }

  public destroy(): void {
    this.detachTitleTooltip?.();
    this.detachDivergenceTooltip?.();
    this.detachAlarmTooltip?.();
    this.detachTicketTooltip?.();
    this.detachAnnotationTooltips.forEach((fn) => fn());
    this.el.remove();
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  private resolvedConnectivity(): {
    connectivity: CentralConnectivity;
    stale: boolean;
    pastHard?: boolean;
    sinceSuccessMs?: number | null;
  } {
    const p = this.params;
    if (p.derivedConnectivity) {
      // Host-derived path: no `reason`/duration data available, so the
      // OFFLINE_HARD duration suffix never applies here — the host controls
      // the full label itself via `labels.connectivityValue`.
      return { connectivity: p.derivedConnectivity, stale: !!p.derivedStale };
    }
    if (p.connectivityEvidence) {
      const r = deriveCentralConnectivity(p.connectivityEvidence, {
        offlineGraceMs: p.offlineGraceMs ?? 10 * 60 * 1000,
        blipToleranceMs: p.blipToleranceMs,
        offlineHardMs: p.offlineHardMs,
      });
      return {
        connectivity: r.connectivity,
        stale: r.stale,
        pastHard: r.pastHard,
        sinceSuccessMs: r.sinceSuccessMs,
      };
    }
    return { connectivity: 'UNKNOWN', stale: false };
  }

  private language(): 'pt' | 'en' {
    return this.params.language === 'en' ? 'en' : 'pt';
  }

  private labels(): DefaultLabelSet & CentralStatusCardLabels {
    const defaults = this.language() === 'en' ? DEFAULT_LABELS_EN : DEFAULT_LABELS_PT;
    return { ...defaults, ...(this.params.labels || {}) };
  }

  /**
   * Icon markup for a decorative row icon. Icons are never the sole semantic
   * signal (see "Icons are decorative, not semantic") — every row still shows
   * its state as text regardless of this glyph. `icons[key] === false` renders
   * none; a string glyph is escaped inline; an HTMLElement override is patched
   * in after innerHTML is set (see patchIconElements()).
   */
  private iconHtml(key: string, defaultGlyph: string): string {
    const override = this.params.icons?.[key as keyof NonNullable<CreateCentralStatusCardParams['icons']>];
    if (override === false || override === '') {
      return `<span class="myio-cscard__ico" aria-hidden="true" data-icon-key="${key}"></span>`;
    }
    if (typeof override === 'string') {
      return `<span class="myio-cscard__ico" aria-hidden="true" data-icon-key="${key}">${escAttr(override)}</span>`;
    }
    if (override && typeof override === 'object') {
      // HTMLElement override — placeholder patched post-render.
      return `<span class="myio-cscard__ico" aria-hidden="true" data-icon-key="${key}"></span>`;
    }
    return `<span class="myio-cscard__ico" aria-hidden="true" data-icon-key="${key}">${defaultGlyph}</span>`;
  }

  private patchIconElements(): void {
    const icons = this.params.icons;
    if (!icons) return;
    for (const key of Object.keys(icons) as Array<keyof NonNullable<CreateCentralStatusCardParams['icons']>>) {
      const override = icons[key];
      if (!override || typeof override !== 'object') continue;
      const slot = this.el.querySelector(`[data-icon-key="${String(key)}"]`);
      if (slot) {
        slot.innerHTML = '';
        slot.appendChild(override);
      }
    }
  }

  private async confirm(title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
    try {
      const buttons: DialogButton[] = [
        { label: cancelLabel, value: 'cancel', variant: 'secondary' },
        { label: confirmLabel, value: 'confirm', variant: 'danger', autoFocus: false },
      ];
      const result = await openConfirmDialog({
        title,
        message,
        buttons,
        theme: this.theme,
        container: this.params.container,
      });
      return result === 'confirm';
    } catch {
      // Degrade gracefully when the premium dialog is unavailable.
      return confirmFallback(title, message);
    }
  }

  // ── Toggle flows ──────────────────────────────────────────────────────────

  private async handleMonitoringToggle(checkbox: HTMLInputElement): Promise<void> {
    if (this.monitoringBusy || this.params.monitoringReadonly) {
      checkbox.checked = this.params.monitoringEnabled;
      return;
    }
    const previous = this.params.monitoringEnabled;
    const next = checkbox.checked;
    const l = this.labels();

    if (!next) {
      // Monitoramento → OFF is destructive: confirm.
      const cfg =
        l.confirmMonitoringOff ||
        (this.language() === 'en'
          ? {
              title: 'Disable monitoring?',
              message: `Monitoring for "${this.params.name}" will stop — new evidence will no longer be collected.`,
              confirm: 'Disable',
              cancel: 'Cancel',
            }
          : {
              title: 'Desativar monitoramento?',
              message: `O monitoramento de "${this.params.name}" será interrompido — novas evidências deixarão de ser coletadas.`,
              confirm: 'Desativar',
              cancel: 'Cancelar',
            });
      const ok = await this.confirm(
        cfg.title,
        cfg.message.replace('{name}', this.params.name),
        cfg.confirm,
        cfg.cancel
      );
      if (!ok) {
        checkbox.checked = previous;
        return;
      }
    }

    this.monitoringBusy = true;
    this.monitoringError = null;
    this.render();

    const event: CentralMonitoringToggleEvent = { id: this.params.id, next, previous, source: 'central-status-card' };
    try {
      if (this.params.onMonitoringToggle) await this.params.onMonitoringToggle(event);
      this.params.monitoringEnabled = next;
    } catch (err) {
      this.params.monitoringEnabled = previous;
      this.monitoringError = err instanceof Error ? err.message : String(err);
    } finally {
      this.monitoringBusy = false;
      this.render();
    }
  }

  private async handleStatusToggle(checkbox: HTMLInputElement): Promise<void> {
    if (this.statusBusy || this.params.statusReadonly) {
      checkbox.checked = this.params.entityStatus === 'ACTIVE';
      return;
    }
    const previous = this.params.entityStatus;
    const next: CentralEntityStatus = checkbox.checked ? 'ACTIVE' : 'INACTIVE';
    const l = this.labels();

    const needsConfirm = next === 'INACTIVE' || (next === 'ACTIVE' && this.params.confirmStatusActivate);
    if (needsConfirm) {
      const isDeactivate = next === 'INACTIVE';
      const isEn = this.language() === 'en';
      const cfg =
        (isDeactivate ? l.confirmDeactivate : l.confirmActivate) ||
        (isDeactivate
          ? isEn
            ? {
                title: 'Deactivate central?',
                message: `"${this.params.name}" will be marked INACTIVE in the registry.`,
                confirm: 'Deactivate',
                cancel: 'Cancel',
              }
            : {
                title: 'Desativar central?',
                message: `"${this.params.name}" será marcada como INATIVA no cadastro.`,
                confirm: 'Desativar',
                cancel: 'Cancelar',
              }
          : isEn
          ? {
              title: 'Activate central?',
              message: `"${this.params.name}" will be marked ACTIVE in the registry.`,
              confirm: 'Activate',
              cancel: 'Cancel',
            }
          : {
              title: 'Ativar central?',
              message: `"${this.params.name}" será marcada como ATIVA no cadastro.`,
              confirm: 'Ativar',
              cancel: 'Cancelar',
            });
      const ok = await this.confirm(
        cfg.title,
        cfg.message.replace('{name}', this.params.name),
        cfg.confirm,
        cfg.cancel
      );
      if (!ok) {
        checkbox.checked = previous === 'ACTIVE';
        return;
      }
    }

    this.statusBusy = true;
    this.statusError = null;
    this.render();

    const event: CentralStatusToggleEvent = { id: this.params.id, next, previous, source: 'central-status-card' };
    try {
      if (this.params.onStatusToggle) await this.params.onStatusToggle(event);
      this.params.entityStatus = next;
    } catch (err) {
      this.params.entityStatus = previous;
      this.statusError = err instanceof Error ? err.message : String(err);
    } finally {
      this.statusBusy = false;
      this.render();
    }
  }

  private async handleForceSync(): Promise<void> {
    if (this.forceSyncBusy || !this.params.onForceSync) return;
    this.forceSyncBusy = true;
    this.render();
    const event: CentralStatusCardForceSyncEvent = { id: this.params.id, source: 'central-status-card' };
    try {
      await this.params.onForceSync(event);
      // Host re-renders fresh evidence via handle.update(...) — not this callback's return.
    } catch {
      /* force-sync failures are the host's to surface (toast, etc.) */
    } finally {
      this.forceSyncBusy = false;
      this.render();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * render() replaces innerHTML wholesale, which would otherwise steal focus
   * away from whatever the user was interacting with (e.g. a periodic
   * update() firing while a switch is focused). Capture a stable identity for
   * the focused element (if it's inside this card) before the rebuild, then
   * refocus its equivalent after.
   */
  private static readonly FOCUS_TRACKED_SELECTORS: Record<string, string> = {
    'monitoring-switch': '.myio-cscard__monitoring-switch',
    'status-switch': '.myio-cscard__status-switch',
    'force-sync': '.myio-cscard__force',
    timeline: '[data-role="open-timeline"]',
    select: '.myio-cscard__select-checkbox',
    dashboard: '[data-role="open-dashboard"]',
    report: '[data-role="open-report"]',
    settings: '[data-role="open-settings"]',
  };

  private captureFocus(): { key: string } | null {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.el.contains(active)) return null;
    for (const [key, selector] of Object.entries(CentralStatusCard.FOCUS_TRACKED_SELECTORS)) {
      if (active.matches(selector)) return { key };
    }
    return null;
  }

  private restoreFocus(captured: { key: string } | null): void {
    if (!captured) return;
    const selector = CentralStatusCard.FOCUS_TRACKED_SELECTORS[captured.key];
    if (!selector) return;
    const el = this.el.querySelector<HTMLElement>(selector);
    if (el && !(el as HTMLInputElement | HTMLButtonElement).disabled) el.focus();
  }

  private render(): void {
    const focusToRestore = this.captureFocus();
    const p = this.params;
    const variant = p.variant || 'card';
    const { connectivity, stale, pastHard, sinceSuccessMs } = this.resolvedConnectivity();
    // `accent` (host override / CONNECTIVITY_ACCENT fallback) is kept only as
    // a data-attribute hook for any external CSS a host may have layered on
    // top — it no longer drives the header/badge/border colors below, which
    // now follow two independent axes: border = entityStatus (registry),
    // header+badge = connectivity (health). See the color-scheme spec this
    // was built from (chat, RFC-0231 follow-up review).
    const accent = p.accent && p.accent !== 'none' ? p.accent : CONNECTIVITY_ACCENT[connectivity];
    const l = this.labels();
    const nowMs = Date.now();

    this.el.className = `myio-cscard myio-cscard--${variant}${p.selected ? ' myio-cscard--selected' : ''}`;
    this.el.dataset.theme = this.theme;
    this.el.dataset.accent = accent;
    this.el.dataset.status = p.entityStatus;
    this.el.dataset.connectivity = connectivity;
    if (p.enableDragDrop) {
      this.el.setAttribute('draggable', 'true');
    } else {
      this.el.removeAttribute('draggable');
    }
    // CSS zoom scales fonts/paddings/switches/min-height together as one
    // property, instead of the per-element inline-style overrides
    // cards/main-view/v6.0.0's zoomMultiplier does.
    (this.el.style as CSSStyleDeclaration & { zoom?: string }).zoom =
      p.scale && p.scale !== 1 ? String(p.scale) : '';

    const connLabel =
      l.connectivityValue?.[connectivity] ||
      (pastHard && sinceSuccessMs != null
        ? `${CONNECTIVITY_VALUE_DEFAULT.OFFLINE} ${formatDuration(sinceSuccessMs)}`
        : CONNECTIVITY_VALUE_DEFAULT[connectivity]);
    const staleBadge = stale
      ? `<span class="myio-cscard__stale">${STALE_BADGE_TEXT[this.language()]}</span>`
      : '';
    const divergenceGlyph = (() => {
      const o = p.icons?.divergence;
      if (o === false || o === '') return '';
      if (typeof o === 'string') return escAttr(o);
      return '⚠️'; // HTMLElement overrides patch in post-render, like other iconHtml() glyphs
    })();
    const divergenceFlagHtml =
      p.showDivergence && p.divergence
        ? `<span class="myio-cscard__divergence-flag" data-icon-key="divergence" data-role="divergence-tooltip" tabindex="0" role="button"
             aria-label="${escAttr(l.divergence)}: ${escAttr(p.divergence.current)} → ${escAttr(
            p.divergence.proposed
          )}">${divergenceGlyph}</span>`
        : '';

    const monitoringChecked = p.monitoringEnabled;
    const monitoringDisabled = this.monitoringBusy || !!p.monitoringReadonly;
    const forceSyncGlyph = (() => {
      const o = p.icons?.forceSync;
      if (o === false || o === '') return '';
      if (typeof o === 'string') return escAttr(o);
      return '🔄';
    })();
    const forceSyncHtml = p.showForceSync
      ? `<button type="button" class="myio-cscard__force" aria-label="${escAttr(
          l.forceSync
        )}" title="${escAttr(l.forceSync)}" ${
          this.forceSyncBusy ? 'disabled aria-busy="true"' : ''
        } data-icon-key="forceSync">${forceSyncGlyph}</button>`
      : '';
    const timelineGlyph = (() => {
      const o = p.icons?.timeline;
      if (o === false || o === '') return '';
      if (typeof o === 'string') return escAttr(o);
      return '📈';
    })();
    const timelineButtonLabel = l.timelineButton || (this.language() === 'en' ? 'View connectivity timeline' : 'Ver timeline de conectividade');
    const timelineHtml = p.timeline
      ? `<button type="button" class="myio-cscard__timeline" data-role="open-timeline" aria-label="${escAttr(
          timelineButtonLabel
        )}" title="${escAttr(timelineButtonLabel)}" data-icon-key="timeline">${timelineGlyph}</button>`
      : '';

    // ── selection checkbox — lives inline in the titlebar (where the (i) used
    // to sit), so it stays visible/reachable at a glance even in a dense
    // grid — this is the anchor a future footer-based multi-card comparison
    // will read from. ──
    const selectLabel = (l.selectCheckbox || (this.language() === 'en' ? 'Select {name}' : 'Selecionar {name}')).replace(
      '{name}',
      p.name
    );
    const selectCheckboxHtml = p.enableSelection
      ? `<input type="checkbox" class="myio-cscard__select-checkbox" aria-label="${escAttr(selectLabel)}" ${
          p.selected ? 'checked' : ''
        } />`
      : '';

    // ── left action column (inspired by cards/main-view/v6.0.0's piano-key buttons) ──
    function actionGlyph(key: 'dashboard' | 'report' | 'settings', defaultGlyph: string): string {
      const o = p.icons?.[key];
      if (o === false || o === '') return '';
      if (typeof o === 'string') return escAttr(o);
      return defaultGlyph;
    }
    const dashboardLabel = l.dashboardButton || (this.language() === 'en' ? 'View dashboard' : 'Ver dashboard');
    const reportLabel = l.reportButton || (this.language() === 'en' ? 'View report' : 'Ver relatório');
    const settingsLabel = l.settingsButton || (this.language() === 'en' ? 'Settings' : 'Configurações');
    const actionRowHtml =
      p.onOpenDashboard || p.onOpenReport || p.onOpenSettings
        ? `<div class="myio-cscard__actioncol">${
            p.onOpenDashboard
              ? `<button type="button" class="myio-cscard__action-btn" data-role="open-dashboard" aria-label="${escAttr(
                  dashboardLabel
                )}" title="${escAttr(dashboardLabel)}" data-icon-key="dashboard">${actionGlyph(
                  'dashboard',
                  '📊'
                )}</button>`
              : ''
          }${
            p.onOpenReport
              ? `<button type="button" class="myio-cscard__action-btn" data-role="open-report" aria-label="${escAttr(
                  reportLabel
                )}" title="${escAttr(reportLabel)}" data-icon-key="report">${actionGlyph('report', '📄')}</button>`
              : ''
          }${
            p.onOpenSettings
              ? `<button type="button" class="myio-cscard__action-btn" data-role="open-settings" aria-label="${escAttr(
                  settingsLabel
                )}" title="${escAttr(settingsLabel)}" data-icon-key="settings">${actionGlyph(
                  'settings',
                  '⚙️'
                )}</button>`
              : ''
          }</div>`
        : '';

    // ── notification badges (faithful port of TELEMETRY/controller.js's
    // .myio-alarm-badge / .myio-ticket-badge / .annotation-type-badge(s)) —
    // rendered as root-level children (siblings of .myio-cscard__surface, see
    // below) so they can hang outside the clipped/rounded surface, straddling
    // the card's own outer border instead of overlapping real title/row
    // content the original device tile never had in these corners. Alarm
    // sits 18% down from the top edge, ticket 18% up from the bottom edge,
    // both hugging the left border (see styles.ts). ──
    // title="" attrs deliberately omitted on all 3 badge families below — hover
    // is now handled by the same premium InfoTooltip used for the (i)/
    // divergência triggers (see bindTooltips()), so a native browser tooltip
    // would just double up with it. aria-label keeps the equivalent text
    // available to assistive tech.
    const alarmBadgeHtml =
      p.alarmCount && p.alarmCount > 0
        ? `<div class="myio-cscard__alarm-badge" data-role="alarm-badge" aria-label="${escAttr(
            `${p.alarmCount} alarme${p.alarmCount !== 1 ? 's' : ''} ativo${p.alarmCount !== 1 ? 's' : ''}`
          )}">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
            <span>${p.alarmCount > 99 ? '99+' : p.alarmCount}</span>
          </div>`
        : '';

    const ticketBadgeHtml =
      p.ticketCount && p.ticketCount > 0
        ? `<div class="myio-cscard__ticket-badge" data-role="ticket-badge" aria-label="${escAttr(
            `${p.ticketCount} chamado${p.ticketCount !== 1 ? 's' : ''} aberto${p.ticketCount !== 1 ? 's' : ''}`
          )}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            <span class="myio-cscard__ticket-badge-count">${p.ticketCount > 99 ? '99+' : p.ticketCount}</span>
          </div>`
        : '';

    const ANNOTATION_TYPE_CONFIG = this.annotationTypeConfig();
    const annotationBadgesHtml = p.annotationCounts
      ? `<div class="myio-cscard__annotation-badges">${(
          ['pending', 'maintenance', 'activity', 'observation'] as CentralAnnotationType[]
        )
          .map((type) => {
            const count = p.annotationCounts?.[type];
            if (!count || count <= 0) return '';
            const cfg = ANNOTATION_TYPE_CONFIG[type];
            return `<div class="myio-cscard__annotation-badge" data-role="annotation-badge" data-type="${type}" style="background:${
              cfg.color
            }" aria-label="${escAttr(`${cfg.label}: ${count}`)}">
              <span>${cfg.icon}</span>
              <span class="myio-cscard__annotation-badge-count">${count > 99 ? '99+' : count}</span>
            </div>`;
          })
          .join('')}</div>`
      : '';

    const devicesText = p.deviceCounts
      ? `${l.deviceTotal}: ${p.deviceCounts.total} · ${l.deviceOnline}: ${p.deviceCounts.online} · ${l.deviceOffline}: ${p.deviceCounts.offline} · ${l.deviceUnknown}: ${p.deviceCounts.unknown}`
      : null;
    // Colored dots reinforce the breakdown visually, but the color/order
    // alone isn't a real signal (confirmed confusing in practice — two
    // zero-counts read as unlabeled "155 · 0 · 0 · 155"), so every dot also
    // carries its own title + aria-label caption.
    const devicesDotsHtml = p.deviceCounts
      ? `<span class="myio-cscard__devicedot myio-cscard__devicedot--total" title="${escAttr(l.deviceTotal)}" aria-label="${escAttr(l.deviceTotal)}: ${p.deviceCounts.total}">${p.deviceCounts.total}</span>` +
        `<span class="myio-cscard__devicedot myio-cscard__devicedot--online" title="${escAttr(l.deviceOnline)}" aria-label="${escAttr(l.deviceOnline)}: ${p.deviceCounts.online}">${p.deviceCounts.online}</span>` +
        `<span class="myio-cscard__devicedot myio-cscard__devicedot--offline" title="${escAttr(l.deviceOffline)}" aria-label="${escAttr(l.deviceOffline)}: ${p.deviceCounts.offline}">${p.deviceCounts.offline}</span>` +
        `<span class="myio-cscard__devicedot myio-cscard__devicedot--unknown" title="${escAttr(l.deviceUnknown)}" aria-label="${escAttr(l.deviceUnknown)}: ${p.deviceCounts.unknown}">${p.deviceCounts.unknown}</span>`
      : null;

    const probe = p.probeVerdict;
    let latencyTrendHtml = '';
    if (probe?.latencyMs != null) {
      const trend = latencyTrend(probe.latencyMs, this.lastLatencyMs);
      if (trend) {
        const trendLabel =
          trend === 'faster'
            ? this.language() === 'en'
              ? 'faster than last attempt'
              : 'mais rápido que a última tentativa'
            : trend === 'slower'
            ? this.language() === 'en'
              ? 'slower than last attempt'
              : 'mais lento que a última tentativa'
            : this.language() === 'en'
            ? `within ${LATENCY_TREND_FLAT_THRESHOLD_MS}ms of last attempt`
            : `dentro de ${LATENCY_TREND_FLAT_THRESHOLD_MS}ms da última tentativa`;
        latencyTrendHtml = ` <span class="myio-cscard__latency-trend myio-cscard__latency-trend--${trend}" title="${escAttr(
          trendLabel
        )}" aria-label="${escAttr(trendLabel)}">${LATENCY_TREND_GLYPH[trend]}</span>`;
      }
      this.lastLatencyMs = probe.latencyMs;
    }
    const probeText = probe
      ? `${escAttr(probe.label)}${
          probe.latencyMs != null ? ` <span class="myio-cscard__muted">${probe.latencyMs}ms</span>${latencyTrendHtml}` : ''
        }`
      : null;

    const statusChecked = p.entityStatus === 'ACTIVE';
    const statusDisabled = this.statusBusy || !!p.statusReadonly;

    const compactEvidenceLine =
      variant === 'compact'
        ? `<div class="myio-cscard__evidence-line">${
            devicesText ? escAttr(devicesText) : ''
          }${probeText ? (devicesText ? ' · ' : '') + probeText : ''}</div>`
        : '';

    this.el.innerHTML = `
      ${alarmBadgeHtml}
      ${ticketBadgeHtml}
      ${annotationBadgesHtml}
      <div class="myio-cscard__surface">
      ${actionRowHtml}
      <div class="myio-cscard__content">
        <div class="myio-cscard__titlebar">
          <h4 class="myio-cscard__title" title="${escAttr(p.name)}">${escAttr(p.name)}</h4>
          ${selectCheckboxHtml}
        </div>

      <section class="myio-cscard__block">
        <div class="myio-cscard__row myio-cscard__connectivity">
          ${this.iconHtml('connectivity', '📡')}
          <span class="myio-cscard__label">${escAttr(l.connectivity)}</span>
          <span class="myio-cscard__badge myio-cscard__badge--${connectivity}" role="status">${escAttr(
            connLabel
          )}</span>${staleBadge}${divergenceFlagHtml}
        </div>

        <div class="myio-cscard__row myio-cscard__monitoring">
          ${this.iconHtml('monitoring', '👁')}
          <span class="myio-cscard__label" id="mon-lbl-${escAttr(p.id)}">${escAttr(l.monitoring)}</span>
          ${timelineHtml}
          ${forceSyncHtml}
          <input type="checkbox" role="switch" class="myio-cscard__switch myio-cscard__monitoring-switch"
            aria-labelledby="mon-lbl-${escAttr(p.id)}" aria-checked="${monitoringChecked}"
            ${monitoringChecked ? 'checked' : ''} ${monitoringDisabled ? 'disabled' : ''}
            ${this.monitoringBusy ? 'aria-busy="true"' : ''} />
          <span class="myio-cscard__switch-text">${
            MONITORING_SWITCH_TEXT[this.language()][monitoringChecked ? 'on' : 'off']
          }</span>
          ${
            this.monitoringError
              ? `<span class="myio-cscard__err" role="alert" aria-live="assertive">${escAttr(
                  this.monitoringError
                )}</span>`
              : `<span class="myio-cscard__err" role="alert" aria-live="assertive" hidden></span>`
          }
        </div>

        <div class="myio-cscard__row myio-cscard__last-attempt myio-cscard__row--evidence">
          ${this.iconHtml('lastAttempt', '🕒')}
          <span class="myio-cscard__label">${escAttr(l.lastAttempt)}</span>
          <span class="myio-cscard__value">${escAttr(formatSince(p.lastAttemptAt, nowMs, this.language()))}</span>
        </div>
        <div class="myio-cscard__row myio-cscard__last-success myio-cscard__row--evidence">
          ${this.iconHtml('lastSuccess', '✅')}
          <span class="myio-cscard__label">${escAttr(l.lastSuccess)}</span>
          <span class="myio-cscard__value">${escAttr(formatSince(p.lastSuccessAt, nowMs, this.language()))}</span>
        </div>
        ${
          probeText
            ? `<div class="myio-cscard__row myio-cscard__probe myio-cscard__row--evidence">
                ${this.iconHtml('probe', '📶')}
                <span class="myio-cscard__label">${escAttr(l.connectionTest)}</span>
                <span class="myio-cscard__value">${probeText}</span>
              </div>`
            : ''
        }
        ${
          devicesDotsHtml
            ? `<div class="myio-cscard__row myio-cscard__devices myio-cscard__row--evidence">
                ${this.iconHtml('devices', '📟')}
                <span class="myio-cscard__label">${escAttr(l.devices)}</span>
                <span class="myio-cscard__value myio-cscard__value--dots" title="${escAttr(devicesText || '')}">${devicesDotsHtml}</span>
              </div>`
            : ''
        }
        ${compactEvidenceLine}

        <div class="myio-cscard__row myio-cscard__status">
          ${this.iconHtml('status', '⚡')}
          <span class="myio-cscard__label" id="st-lbl-${escAttr(p.id)}">${escAttr(l.status)}</span>
          ${
            p.titleTooltipHtml
              ? `<button type="button" class="myio-cscard__info-btn" data-role="title-tooltip" aria-label="info" title="info">ⓘ</button>`
              : ''
          }
          <input type="checkbox" role="switch" class="myio-cscard__switch myio-cscard__status-switch"
            aria-labelledby="st-lbl-${escAttr(p.id)}" aria-checked="${statusChecked}"
            ${statusChecked ? 'checked' : ''} ${statusDisabled ? 'disabled' : ''}
            ${this.statusBusy ? 'aria-busy="true"' : ''} />
          <span class="myio-cscard__switch-text">${escAttr(
            ENTITY_STATUS_TEXT[this.language()][p.entityStatus]
          )}</span>
          ${
            this.statusError
              ? `<span class="myio-cscard__err" role="alert" aria-live="assertive">${escAttr(this.statusError)}</span>`
              : `<span class="myio-cscard__err" role="alert" aria-live="assertive" hidden></span>`
          }
        </div>
      </section>
      </div>
      </div>
    `;

    this.patchIconElements();
    this.bindEvents();
    this.bindTooltips();
    this.restoreFocus(focusToRestore);
  }

  /**
   * The (i) title tooltip and the divergência warning-icon tooltip both use
   * InfoTooltip.attach() directly (the same utility DivCard.ts itself uses)
   * rather than wrapping this whole component in createDivCard — the header
   * background here follows connectivity while the border follows
   * entityStatus, two independent axes DivCard's single `accent` can't
   * express, so only the tooltip piece is reused, not the whole shell.
   * Re-attached on every render() since innerHTML is rebuilt wholesale.
   */
  private annotationTypeConfig(): Record<CentralAnnotationType, { color: string; icon: string; label: string }> {
    const en = this.language() === 'en';
    return {
      pending: { color: '#d63031', icon: '⚠️', label: en ? 'Pending' : 'Pendência' },
      maintenance: { color: '#e17055', icon: '🔧', label: en ? 'Maintenance' : 'Manutenção' },
      activity: { color: '#00b894', icon: '✓', label: en ? 'Activity' : 'Atividade' },
      observation: { color: '#0984e3', icon: '📝', label: en ? 'Observation' : 'Observação' },
    };
  }

  private bindTooltips(): void {
    this.detachTitleTooltip?.();
    this.detachTitleTooltip = null;
    this.detachDivergenceTooltip?.();
    this.detachDivergenceTooltip = null;
    this.detachAlarmTooltip?.();
    this.detachAlarmTooltip = null;
    this.detachTicketTooltip?.();
    this.detachTicketTooltip = null;
    this.detachAnnotationTooltips.forEach((fn) => fn());
    this.detachAnnotationTooltips = [];

    const p = this.params;
    const l = this.labels();
    const en = this.language() === 'en';

    if (p.titleTooltipHtml) {
      const titleBtn = this.el.querySelector<HTMLElement>('[data-role="title-tooltip"]');
      if (titleBtn) {
        this.detachTitleTooltip = InfoTooltip.attach(titleBtn, () => ({
          icon: 'ℹ️',
          title: p.name,
          content: p.titleTooltipHtml ?? '',
        }));
      }
    }

    if (p.showDivergence && p.divergence) {
      const divBtn = this.el.querySelector<HTMLElement>('[data-role="divergence-tooltip"]');
      if (divBtn) {
        const divergence = p.divergence;
        this.detachDivergenceTooltip = InfoTooltip.attach(divBtn, () => ({
          icon: '⚠️',
          title: l.divergence,
          content: `${escAttr(divergence.current)} → ${escAttr(divergence.proposed)}`,
        }));
      }
    }

    if (p.alarmCount && p.alarmCount > 0) {
      const alarmBadge = this.el.querySelector<HTMLElement>('[data-role="alarm-badge"]');
      if (alarmBadge) {
        const count = p.alarmCount;
        this.detachAlarmTooltip = InfoTooltip.attach(alarmBadge, () => ({
          icon: '🔔',
          title: en ? 'Alarms' : 'Alarmes',
          content: escAttr(
            en
              ? `${count} active alarm${count !== 1 ? 's' : ''}`
              : `${count} alarme${count !== 1 ? 's' : ''} ativo${count !== 1 ? 's' : ''}`
          ),
        }));
      }
    }

    if (p.ticketCount && p.ticketCount > 0) {
      const ticketBadge = this.el.querySelector<HTMLElement>('[data-role="ticket-badge"]');
      if (ticketBadge) {
        const count = p.ticketCount;
        this.detachTicketTooltip = InfoTooltip.attach(ticketBadge, () => ({
          icon: '🎧',
          title: en ? 'Tickets' : 'Chamados',
          content: escAttr(
            en
              ? `${count} open ticket${count !== 1 ? 's' : ''}`
              : `${count} chamado${count !== 1 ? 's' : ''} aberto${count !== 1 ? 's' : ''}`
          ),
        }));
      }
    }

    if (p.annotationCounts) {
      const cfgMap = this.annotationTypeConfig();
      this.el.querySelectorAll<HTMLElement>('[data-role="annotation-badge"]').forEach((badge) => {
        const type = badge.dataset.type as CentralAnnotationType;
        const cfg = cfgMap[type];
        const count = p.annotationCounts?.[type] ?? 0;
        if (!cfg || count <= 0) return;
        this.detachAnnotationTooltips.push(
          InfoTooltip.attach(badge, () => ({
            icon: cfg.icon,
            title: cfg.label,
            content: escAttr(
              en ? `${count} annotation${count !== 1 ? 's' : ''}` : `${count} ${count === 1 ? 'anotação' : 'anotações'}`
            ),
          }))
        );
      });
    }
  }

  private bindEvents(): void {
    const monitoringSwitch = this.el.querySelector<HTMLInputElement>('.myio-cscard__monitoring-switch');
    if (monitoringSwitch) {
      monitoringSwitch.addEventListener('change', () => this.handleMonitoringToggle(monitoringSwitch));
      monitoringSwitch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          monitoringSwitch.checked = !monitoringSwitch.checked;
          monitoringSwitch.dispatchEvent(new Event('change'));
        }
      });
    }

    const statusSwitch = this.el.querySelector<HTMLInputElement>('.myio-cscard__status-switch');
    if (statusSwitch) {
      statusSwitch.addEventListener('change', () => this.handleStatusToggle(statusSwitch));
      statusSwitch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          statusSwitch.checked = !statusSwitch.checked;
          statusSwitch.dispatchEvent(new Event('change'));
        }
      });
    }

    const forceBtn = this.el.querySelector<HTMLButtonElement>('.myio-cscard__force');
    if (forceBtn) {
      forceBtn.addEventListener('click', () => this.handleForceSync());
    }

    const timelineBtn = this.el.querySelector<HTMLButtonElement>('[data-role="open-timeline"]');
    if (timelineBtn) {
      timelineBtn.addEventListener('click', () => this.handleOpenTimeline());
    }

    const selectCheckbox = this.el.querySelector<HTMLInputElement>('.myio-cscard__select-checkbox');
    if (selectCheckbox) {
      selectCheckbox.addEventListener('click', (e) => e.stopPropagation());
      selectCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.params.onSelectChange?.({
          id: this.params.id,
          selected: selectCheckbox.checked,
          source: 'central-status-card',
        });
      });
    }

    const dashboardBtn = this.el.querySelector<HTMLButtonElement>('[data-role="open-dashboard"]');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.params.onOpenDashboard?.({ id: this.params.id, source: 'central-status-card' });
      });
    }
    const reportBtn = this.el.querySelector<HTMLButtonElement>('[data-role="open-report"]');
    if (reportBtn) {
      reportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.params.onOpenReport?.({ id: this.params.id, source: 'central-status-card' });
      });
    }
    const settingsBtn = this.el.querySelector<HTMLButtonElement>('[data-role="open-settings"]');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.params.onOpenSettings?.({ id: this.params.id, source: 'central-status-card' });
      });
    }

    const alarmBadge = this.el.querySelector<HTMLElement>('[data-role="alarm-badge"]');
    if (alarmBadge && this.params.onAlarmBadgeClick) {
      alarmBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.params.onAlarmBadgeClick?.({ id: this.params.id, source: 'central-status-card' });
      });
    }
    const ticketBadge = this.el.querySelector<HTMLElement>('[data-role="ticket-badge"]');
    if (ticketBadge) {
      ticketBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.params.onTicketBadgeClick?.({ id: this.params.id, source: 'central-status-card' });
      });
    }
    this.el.querySelectorAll<HTMLElement>('[data-role="annotation-badge"]').forEach((badge) => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = badge.dataset.type as CentralAnnotationType;
        this.params.onAnnotationBadgeClick?.({ id: this.params.id, type, source: 'central-status-card' });
      });
    });
  }

  private handleOpenTimeline(): void {
    const p = this.params;
    if (!p.timeline) return;
    openCentralTimelineModal({
      id: p.id,
      name: p.name,
      timeline: p.timeline,
      labels: this.labels(),
      language: this.language(),
      theme: this.theme,
      container: p.container,
    });
  }
}

/**
 * Factory (library public API)
 */
export function createCentralStatusCard(params: CreateCentralStatusCardParams): CentralStatusCardHandle {
  return new CentralStatusCard(params);
}
