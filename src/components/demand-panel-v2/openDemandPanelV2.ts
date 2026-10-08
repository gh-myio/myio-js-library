/**
 * RFC-0238 — Demand Panel v2: multi-device telemetry report wizard.
 *
 * Builds a request in 4 steps (devices → period → telemetries → summary), records the audit
 * envelope in ThingsBoard (customer SERVER_SCOPE, through `store`) and asks GCDR to run the job
 * (through `api`). GCDR owns status, result and download; nothing about execution is written
 * to ThingsBoard. I/O goes through the injected ports, so the showcase and tests use fakes.
 *
 * Building blocks: premium modal shell with the standard header (close / maximize), premium
 * footer (createModalFooter), MyIOToast, openConfirmDialog (RFC-0205), getDeviceIcon (RFC-0200)
 * and the dynamic device taxonomy (RFC-0207: resolveGroup / resolveCategory / liftProfileToTree).
 */
import { createModal, type ModalShellHandle } from '../premium-modals/internal/ModalPremiumShell';
import { createModalFooter } from '../premium-modals/footer-modal';
import { openConfirmDialog } from '../premium-modals/dialog';
import { MyIOToast } from '../MyIOToast.js';
import { getDeviceIcon, DEFAULT_DEVICE_ICON } from '../../utils/devices/deviceIcons';
import { resolveGroup, resolveCategory } from '../../utils/devices/deviceClassificationProfile';
import { liftProfileToTree, flattenTree } from '../../utils/devices/classificationNodeTree';
import {
  AGGREGATIONS,
  DEFAULT_AGGREGATION,
  DEFAULT_RESOLUTION,
  maxPeriodDays,
  DEMAND_LIMITS,
  JOB_KEY_PREFIX,
  JOB_STATE_LABEL,
  RESOLUTIONS,
  RESOLUTION_BY_ID,
  TELEMETRY_CATALOG,
  TELEMETRY_GROUPS,
  auditEvent,
  bucketCount,
  buildEnvelope,
  buildRequest,
  buildTaxonomyChips,
  deriveJobView,
  envelopeKey,
  finestFittingResolution,
  formatLocalDateTime,
  isUncertainStatus,
  mergeBatch,
  needsPolling,
  parseEnvelope,
  parseLocalDateTime,
  periodErrors,
  presetRange,
  reconciliationEvents,
  rejectionText,
  spParts,
  toLocalDateTimeInput,
  toSubmitCommand,
  MIN_PERIOD_START,
  type AuditEvent,
  type DemandAggregation,
  type DemandDevice,
  type DemandReportEnvelopeV1,
  type DemandRequest,
  type DemandResolution,
  type EnvelopeStore,
  type GcdrJobView,
  type JobKnowledge,
  type JobView,
  type PeriodPreset,
  type PortError,
  type ReportJobsApi,
  type Sha256,
  type TaxonomyChip,
  type TaxonomyClassifier,
} from '../../utils/reports/demand';
import { injectDemandPanelStyles } from './styles';

export interface DemandPanelV2Params {
  /** Energy devices of the customer, already adapted (each id in its own namespace — RFC-0238 §2). */
  devices: DemandDevice[];
  customer: { tbCustomerId: string; gcdrCustomerId: string; name: string };
  user: { tbUserId: string; name: string; email?: string };
  /** ThingsBoard customer SERVER_SCOPE attributes (envelopes only). */
  store: EnvelopeStore;
  /** GCDR report-jobs API. */
  api: ReportJobsApi;
  /** tbDeviceIds pre-selected (deep link from the per-device modal). */
  preselect?: string[];
  /** Dashboard palette: createMyIOTheme instance or a flat map of `--myio-*` vars. */
  theme?: unknown;
  themeMode?: 'light' | 'dark';
  /** Show raw envelope / codes / jobs without envelope (MYIO support — O-11). */
  supportMode?: boolean;
  /** Send `declaredRequester` to GCDR (only if the O-7 auth model keeps declared identity). */
  includeDeclaredRequester?: boolean;
  /** Custom taxonomy classifier; default = active classification profile (RFC-0207). */
  classifier?: TaxonomyClassifier;
  /** Read-after-write grace before "not found" means "not received". Default 120 000 ms. */
  graceMs?: number;
  /** GCDR idempotency window for a jobId (Q5/O-17 — open). Default 24 h. */
  idempotencyWindowMs?: number;
  /** Envelopes per page in "Relatórios". Default 20. */
  pageSize?: number;
  /** Polling: first interval and cap (ms). Default 5 000 → 30 000. */
  pollMinMs?: number;
  pollMaxMs?: number;
  now?: () => number;
  idGen?: (now: number) => string;
  sha256?: Sha256;
  onClose?: () => void;
}

export interface DemandPanelV2Instance {
  close(): void;
  /** Reloads the jobs list. */
  refresh(): Promise<void>;
}

const PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last7days', label: 'Últimos 7 dias' },
  { id: 'thisMonth', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'custom', label: 'Personalizado' },
];
const STEPS = ['Dispositivos', 'Período', 'Telemetrias', 'Resumo'];

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const norm = (s: unknown): string => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtN = (n: number): string => n.toLocaleString('pt-BR');
const pad = (n: number): string => String(n).padStart(2, '0');
const fmtDay = (ms: number): string => { const p = spParts(ms); return `${pad(p.d)}/${pad(p.m + 1)}`; };
const fmtDuration = (ms: number): string => {
  const h = ms / 3_600_000;
  return h < 48 ? `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${(h / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
};
const asPortError = (e: unknown): PortError => {
  const x = e as Partial<PortError> & { name?: string };
  return { status: typeof x?.status === 'number' ? x.status : 0, code: x?.code || (x?.name === 'AbortError' ? 'ABORTED' : 'ERROR'), message: x?.message || String(e) };
};

/** Default classifier: active profile (GCDR taxonomy, RFC-0207) — group, then energy category. */
export function createProfileClassifier(): TaxonomyClassifier {
  const nodes = new Map<string, { label: string; icon?: string; order: number }>();
  try {
    flattenTree(liftProfileToTree()).forEach((n, i) => nodes.set(n.key, { label: n.label, icon: n.icon, order: i }));
  } catch {
    /* no profile — labels are humanized */
  }
  return {
    classify(d) {
      const item = { deviceProfile: d.deviceProfile, identifier: d.identifier };
      const g = resolveGroup(item).group;
      if (g === 'ocultos') return null;
      if (g === 'entrada') return 'entrada';
      return resolveCategory(item).category || g;
    },
    describe: (key) => nodes.get(key),
  };
}

function deviceIconUrl(profile: string): string {
  const url = getDeviceIcon(profile);
  return typeof url === 'string' && /^(https?:|data:)/.test(url) ? url : DEFAULT_DEVICE_ICON;
}

class DemandPanelV2 {
  private modal!: ModalShellHandle;
  private footer: ReturnType<typeof createModalFooter> | null = null;
  private root!: HTMLElement;
  private el!: { stepper: HTMLElement; banner: HTMLElement; body: HTMLElement; nav: HTMLElement; live: HTMLElement; count: HTMLElement };
  private readonly abort = new AbortController();
  private destroyed = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollDelay: number;
  private paused = false;
  private resizeObs: ResizeObserver | null = null;

  private readonly now: () => number;
  private readonly graceMs: number;
  private readonly windowMs: number;
  private readonly pageSize: number;
  private readonly deviceById: Map<string, DemandDevice>;
  private readonly labelCount = new Map<string, number>();
  private readonly chips: TaxonomyChip[];
  private readonly categoryOf: Map<string, string | null>;

  private s = {
    tab: 'new' as 'new' | 'jobs',
    step: 1,
    maxStep: 1,
    search: '',
    category: 'all',
    selected: [] as string[],
    period: { preset: 'last7days' as PeriodPreset, start: 0, end: 0 },
    // Agrupamento — same model/defaults as RealTimeTelemetryModal "Por período"
    aggregation: DEFAULT_AGGREGATION as DemandAggregation,
    resolution: DEFAULT_RESOLUTION as DemandResolution,
    telemetries: new Set<string>(['consumption']),
    snapshot: null as null | { takenAt: number; request: DemandRequest },
    submitting: false,
    envelopes: [] as DemandReportEnvelopeV1[],
    unreadable: 0,
    keys: [] as string[],
    page: 1,
    listState: 'idle' as 'idle' | 'loading' | 'ok' | 'error',
    listError: '',
    jobs: new Map<string, JobKnowledge>(),
    active: [] as GcdrJobView[],
    inflight: new Set<string>(),
    uncertain: new Set<string>(),
    auditPending: new Set<string>(),
    openDetails: new Set<string>(),
  };

  constructor(private readonly p: DemandPanelV2Params) {
    this.now = p.now ?? (() => Date.now());
    this.graceMs = p.graceMs ?? 120_000;
    this.windowMs = p.idempotencyWindowMs ?? 24 * 3_600_000;
    this.pageSize = p.pageSize ?? 20;
    this.pollDelay = p.pollMinMs ?? 5_000;
    this.deviceById = new Map(p.devices.map((d) => [d.tbDeviceId, d]));
    p.devices.forEach((d) => this.labelCount.set(d.label, (this.labelCount.get(d.label) || 0) + 1));
    const tax = buildTaxonomyChips(p.devices, p.classifier ?? createProfileClassifier());
    this.chips = tax.chips;
    this.categoryOf = tax.categoryOf;
    const r = presetRange('last7days', this.now())!;
    this.s.period = { preset: 'last7days', start: r.start, end: r.end };
    this.s.selected = (p.preselect ?? []).filter((id) => this.deviceById.has(id) && this.eligibility(this.deviceById.get(id)!).ok);
  }

  /* ------------------------------------------------------------------ lifecycle */
  open(): DemandPanelV2Instance {
    injectDemandPanelStyles();
    this.modal = createModal({
      title: 'Relatório de Demanda e Telemetrias',
      icon: '⚡',
      useStandardHeader: true,
      showMaximize: true,
      width: '1120px',
      height: '88vh',
      theme: this.p.themeMode === 'dark' ? 'dark' : 'light',
      closeOnBackdrop: false,
      closeOnEscape: false,
    });
    this.root = document.createElement('div');
    this.root.className = 'dp2-root';
    this.root.innerHTML = `
      <nav class="dp2-tabs" role="tablist" aria-label="Relatório de demanda">
        <button class="dp2-tab" role="tab" type="button" data-action="tab" data-tab="new">Novo relatório</button>
        <button class="dp2-tab" role="tab" type="button" data-action="tab" data-tab="jobs">Relatórios <span data-role="count"></span></button>
      </nav>
      <div class="dp2-stepper" data-region="stepper" aria-label="Etapas"></div>
      <div data-region="banner"></div>
      <div class="dp2-body" data-region="body" role="tabpanel"></div>
      <div class="dp2-nav" data-region="nav"></div>
      <div class="dp2-sr" aria-live="polite" data-region="live"></div>`;
    const q = (sel: string) => this.root.querySelector(sel) as HTMLElement;
    this.el = { stepper: q('[data-region="stepper"]'), banner: q('[data-region="banner"]'), body: q('[data-region="body"]'),
      nav: q('[data-region="nav"]'), live: q('[data-region="live"]'), count: q('[data-role="count"]') };
    this.modal.setContent(this.root);
    this.applyTheme();
    this.mountFooter();

    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('input', this.onInput);
    this.root.addEventListener('change', this.onChange);
    this.root.addEventListener('keydown', this.onKeydown);
    document.addEventListener('keydown', this.onDocKeydown);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(([e]) => { this.root.dataset.narrow = String(e.contentRect.width < 760); });
      this.resizeObs.observe(this.root);
    }
    this.modal.on('close', () => this.teardown());

    this.render();
    void this.loadPage(false);
    return { close: () => this.modal.close(), refresh: () => this.loadPage(true) };
  }

  private teardown(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('input', this.onInput);
    this.root.removeEventListener('change', this.onChange);
    this.root.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('keydown', this.onDocKeydown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObs?.disconnect();
    this.footer?.destroy();
    this.footer = null;
    this.p.onClose?.();
  }

  private mountFooter(): void {
    const lib = (window as { MyIOLibrary?: { version?: string } }).MyIOLibrary;
    this.footer = createModalFooter({
      customerName: this.p.customer.name,
      // unknown version (tests / showcase without the UMD) → no npm version check
      libVersion: lib?.version ? { current: lib.version } : false,
      themeMode: this.p.themeMode === 'dark' ? 'dark' : 'light',
    });
    const modalRoot = (this.modal.element.closest('.myio-modal') as HTMLElement | null) || this.modal.element;
    modalRoot.appendChild(this.footer.element);
  }

  private applyTheme(): void {
    const theme = this.p.theme ?? (window as { MyIOUtils?: { theme?: unknown } }).MyIOUtils?.theme;
    if (!theme) return;
    const vars = typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (theme as { cssVars(): Record<string, string> }).cssVars()
      : (theme as Record<string, string>);
    const target = (this.modal.element.closest('.myio-modal') as HTMLElement | null) || this.modal.element;
    Object.entries(vars || {}).forEach(([k, v]) => { if (k.startsWith('--') && typeof v === 'string') target.style.setProperty(k, v); });
  }

  /* ------------------------------------------------------------------ helpers */
  private announce(msg: string): void { this.el.live.textContent = msg; }
  private toast(kind: 'success' | 'info' | 'warning' | 'error', msg: string): void {
    const t = MyIOToast as unknown as Record<string, (m: string) => void>;
    (t[kind] || t.info).call(MyIOToast, msg);
  }
  private async confirmDialog(title: string, message: string, confirmLabel: string, cancelLabel = 'Cancelar'): Promise<boolean> {
    const v = await openConfirmDialog({
      title, message, theme: this.p.themeMode === 'dark' ? 'dark' : 'light',
      buttons: [{ label: cancelLabel, value: 'no' }, { label: confirmLabel, value: 'yes', variant: 'primary', autoFocus: true }],
    });
    return v === 'yes';
  }
  private eligibility(d: DemandDevice): { ok: boolean; cls?: string; text?: string; title?: string } {
    if (!d.gcdrDeviceId) return { ok: false, cls: 'block', text: '⛔ sem vínculo GCDR', title: 'O fluxo atual exige o vínculo com o GCDR' };
    if (!d.ingestionId) return { ok: true, cls: 'warn', text: '⚠ sem vínculo de dados', title: 'Sem ingestionId — o resultado pode vir sem este medidor (Q3)' };
    return { ok: true };
  }
  private selectedDevices(): DemandDevice[] { return this.s.selected.map((id) => this.deviceById.get(id)!).filter(Boolean); }
  private searchResults(): DemandDevice[] {
    const q = norm(this.s.search).trim();
    return this.p.devices.filter((d) => {
      const cat = this.categoryOf.get(d.tbDeviceId);
      if (cat === null) return false;
      if (this.s.category !== 'all' && cat !== this.s.category) return false;
      return !q || norm(`${d.label} ${d.name} ${d.identifier ?? ''} ${d.deviceProfile}`).includes(q);
    });
  }
  /** Grouping interval in effect (`null` = Bruto). */
  private effResolution(): DemandResolution | null {
    return this.s.aggregation === 'NONE' ? null : this.s.resolution;
  }
  /** Bruto has no estimate (every sample of the period; size depends on each meter's rate). */
  private estimatePoints(): { buckets: number | null; points: number | null } {
    const res = this.effResolution();
    if (!res) return { buckets: null, points: null };
    const buckets = bucketCount(this.s.period.start, this.s.period.end, res);
    return { buckets, points: buckets * this.s.selected.length * this.s.telemetries.size };
  }
  private groupingLabel(aggregation: DemandAggregation, resolution: DemandResolution | null): string {
    if (aggregation === 'NONE') return 'Bruto · todos os pontos';
    const agg = AGGREGATIONS.find((a) => a.id === aggregation)?.label ?? aggregation;
    return `${agg} · ${resolution ? RESOLUTION_BY_ID[resolution]?.label ?? resolution : ''}`;
  }
  private stepErrors(step: number): string[] {
    if (step === 1) return this.s.selected.length ? [] : ['Adicione ao menos 1 medidor.'];
    if (step === 2) return periodErrors(this.s.period, this.effResolution(), this.now());
    if (step === 3) return this.s.telemetries.size ? [] : ['Escolha ao menos 1 telemetria.'];
    const errs: string[] = [];
    [1, 2, 3].forEach((n) => { if (this.stepErrors(n).length) errs.push(`Etapa ${n} incompleta.`); });
    const pts = this.s.snapshot?.request.estimate.points;
    if (pts != null && pts > DEMAND_LIMITS.points) {
      errs.push(`O relatório passa do tamanho máximo (${fmtN(DEMAND_LIMITS.points)} linhas).`);
    }
    if (this.s.active.length >= DEMAND_LIMITS.activeJobs) errs.push(`Já existem ${DEMAND_LIMITS.activeJobs} relatórios em andamento — aguarde um terminar.`);
    return errs;
  }
  private view(e: DemandReportEnvelopeV1): JobView {
    return deriveJobView({
      envelope: e, knowledge: this.s.jobs.get(e.jobId), now: this.now(),
      inflight: this.s.inflight.has(e.jobId), uncertain: this.s.uncertain.has(e.jobId),
      graceMs: this.graceMs, idempotencyWindowMs: this.windowMs,
    });
  }
  private freezeSnapshot(): void {
    const now = this.now();
    if (this.s.period.preset !== 'custom') {
      const r = presetRange(this.s.period.preset, now)!;
      this.s.period.start = r.start;
      this.s.period.end = r.end;
    }
    this.s.snapshot = {
      takenAt: now,
      request: buildRequest({
        devices: this.selectedDevices(), range: this.s.period, preset: this.s.period.preset,
        aggregation: this.s.aggregation, resolution: this.s.resolution,
        telemetryKeys: this.s.telemetries,
      }),
    };
  }

  /* ------------------------------------------------------------------ rendering */
  private render(): void {
    if (this.destroyed) return;
    this.root.querySelectorAll<HTMLElement>('[data-action="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.s.tab)));
    this.el.count.innerHTML = this.s.active.length ? `<span class="dp2-count">${this.s.active.length}</span>` : '';
    this.el.stepper.hidden = this.s.tab !== 'new';
    this.renderBanner();
    if (this.s.tab === 'jobs') { this.renderJobs(); return; }
    this.renderStepper();
    [() => this.renderStep1(), () => this.renderStep2(), () => this.renderStep3(), () => this.renderStep4()][this.s.step - 1]();
    this.renderNav();
  }

  private renderBanner(): void {
    if (this.s.tab !== 'new' || this.s.active.length < DEMAND_LIMITS.activeJobs) { this.el.banner.innerHTML = ''; return; }
    const who = this.s.active.slice(0, 3).map((j) => formatLocalDateTime(Date.parse(j.createdAt)).slice(11)).join(', ');
    this.el.banner.innerHTML = `<div class="dp2-banner">⏳ ${DEMAND_LIMITS.activeJobs} relatórios em andamento (pedidos às ${esc(who)}). Você pode montar o pedido, mas só poderá enviar quando um terminar.
      <button class="dp2-btn link" type="button" data-action="tab" data-tab="jobs">Ver relatórios</button></div>`;
  }

  private renderStepper(): void {
    this.el.stepper.innerHTML = STEPS.map((label, i) => {
      const n = i + 1;
      const st = n === this.s.step ? 'current' : n <= this.s.maxStep && n < 4 && !this.stepErrors(n).length ? 'done' : 'todo';
      return `<button class="dp2-step" type="button" data-action="goto" data-step="${n}" data-state="${st}" ${st === 'current' ? 'aria-current="step"' : ''} ${st === 'done' ? '' : 'tabindex="-1"'}>
        <b>${st === 'done' ? '✓' : n}</b><span>${label}</span></button>`;
    }).join('');
  }

  private highlight(text: string): string {
    const q = norm(this.s.search).trim();
    const i = q ? norm(text).indexOf(q) : -1;
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + `<mark class="dp2-mark">${esc(text.slice(i, i + q.length))}</mark>` + esc(text.slice(i + q.length));
  }

  private deviceRow(d: DemandDevice, mode: 'result' | 'selected'): string {
    const picked = this.s.selected.includes(d.tbDeviceId);
    const el = this.eligibility(d);
    const cat = this.categoryOf.get(d.tbDeviceId);
    const chip = this.chips.find((c) => c.key === cat);
    const dup = (this.labelCount.get(d.label) || 0) > 1;
    const action = mode === 'result'
      ? picked ? '<span class="dp2-added">✓ Adicionado</span>'
        : `<button class="dp2-btn sm" type="button" data-action="add" data-id="${esc(d.tbDeviceId)}" ${el.ok ? '' : 'disabled'} aria-label="Adicionar ${esc(d.label)}">+ Adicionar</button>`
      : `<button class="dp2-btn sm" type="button" data-action="remove" data-id="${esc(d.tbDeviceId)}" aria-label="Remover ${esc(d.label)}">✕ Remover</button>`;
    return `<div class="dp2-item ${el.ok ? '' : 'blocked'}">
      <img class="dp2-ico" src="${esc(deviceIconUrl(d.deviceProfile))}" alt="" loading="lazy">
      <div style="min-width:0">
        <div class="dp2-name">${mode === 'result' ? this.highlight(d.label) : esc(d.label)}${dup && d.identifier ? ` <small class="dp2-info">· ${esc(d.identifier)}</small>` : ''}</div>
        <div class="dp2-sub">${chip ? `<span class="dp2-tag">${esc(chip.label)}</span>` : ''}${el.text ? `<span class="dp2-tag ${el.cls}" title="${esc(el.title)}">${el.text}</span>` : ''}
          ${mode === 'result' ? this.highlight(d.name) : esc(d.name)}${d.identifier ? ' · ' + esc(d.identifier) : ''}</div>
      </div>
      <div>${action}</div>
    </div>`;
  }

  private renderStep1(): void {
    const results = this.searchResults();
    const visible = this.p.devices.filter((d) => this.categoryOf.get(d.tbDeviceId) !== null).length;
    const addable = results.filter((d) => !this.s.selected.includes(d.tbDeviceId) && this.eligibility(d).ok).length;
    const sel = this.selectedDevices();
    const active = document.activeElement as HTMLInputElement | null;
    const hadFocus = active?.dataset?.role === 'search';
    const caret = hadFocus ? active!.selectionStart : null;
    const chips = [{ key: 'all', label: 'Todos', icon: undefined as string | undefined, count: visible }, ...this.chips];
    this.el.body.innerHTML = `<div class="dp2-s1">
      <section class="dp2-col" aria-label="Buscar medidores">
        <div class="dp2-col-head">
          <input class="dp2-search" data-role="search" type="search" placeholder="🔎 Buscar por nome, identificador ou tipo…" value="${esc(this.s.search)}" aria-label="Buscar medidores">
          <div class="dp2-chips" role="group" aria-label="Filtrar por tipo">${chips.map((c) => `<button class="dp2-chip" type="button" data-action="category" data-key="${esc(c.key)}" aria-pressed="${this.s.category === c.key}">${c.icon ? esc(c.icon) + ' ' : ''}${esc(c.label)} · ${c.count}</button>`).join('')}</div>
          <h3><span>${fmtN(results.length)} resultado(s)</span>
            <button class="dp2-btn link" type="button" data-action="add-all" ${addable ? '' : 'disabled'}>+ Adicionar todos (${addable})</button></h3>
        </div>
        <div class="dp2-list" data-role="results">${results.length ? results.map((d) => this.deviceRow(d, 'result')).join('') : `<div class="dp2-empty">${this.p.devices.length ? 'Nenhum medidor encontrado para essa busca.' : 'Nenhum medidor de energia neste cliente.'}</div>`}</div>
      </section>
      <section class="dp2-col" aria-label="Medidores selecionados">
        <div class="dp2-col-head"><h3><span>Selecionados · ${sel.length} de ${DEMAND_LIMITS.devices}</span>
          <button class="dp2-btn link" type="button" data-action="clear" ${sel.length ? '' : 'disabled'}>Limpar lista</button></h3>
          <div class="dp2-meter"><span style="width:${Math.min(100, (sel.length / DEMAND_LIMITS.devices) * 100)}%"></span></div></div>
        <div class="dp2-list" data-role="selected">${sel.length ? sel.map((d) => this.deviceRow(d, 'selected')).join('') : '<div class="dp2-empty">Nenhum medidor na lista.<br>Busque à esquerda e clique em <b>+ Adicionar</b>.</div>'}</div>
      </section>
    </div>`;
    if (hadFocus) {
      const s = this.el.body.querySelector('[data-role="search"]') as HTMLInputElement;
      s.focus();
      if (caret !== null) s.setSelectionRange(caret, caret);
    }
  }

  private renderStep2(): void {
    const { start, end, preset } = this.s.period;
    const raw = this.s.aggregation === 'NONE';
    const res = this.effResolution();
    const r = RESOLUTION_BY_ID[this.s.resolution];
    const maxDays = maxPeriodDays(res);
    const modeLabel = raw ? 'dados brutos' : `agrupamento de ${r.label}`;
    const errs = this.stepErrors(2);
    const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
    const tooLong = valid && end - start > maxDays * 86_400_000;
    const fit = tooLong ? finestFittingResolution(this.s.period) : null;
    const presetTooLong = (id: PeriodPreset) => { const x = presetRange(id, this.now()); return !!x && x.end - x.start > maxDays * 86_400_000; };
    this.el.body.innerHTML = `
      <div class="dp2-card"><h3 tabindex="-1" data-role="step-title">Período</h3>
        <div class="dp2-chips" style="margin-bottom:12px">${PRESETS.map((p) => {
          const off = p.id !== 'custom' && presetTooLong(p.id);
          return `<button class="dp2-chip" type="button" data-action="preset" data-preset="${p.id}" aria-pressed="${preset === p.id}" ${off ? `disabled title="até ${maxDays} dia(s) com ${esc(modeLabel)}"` : ''}>${p.label}</button>`;
        }).join('')}</div>
        <div class="dp2-row">
          <label class="dp2-field">Início<input type="datetime-local" data-role="start" min="${MIN_PERIOD_START}T00:00" value="${Number.isFinite(start) ? toLocalDateTimeInput(start) : ''}"></label>
          <label class="dp2-field">Fim (exclusivo)<input type="datetime-local" data-role="end" value="${Number.isFinite(end) ? toLocalDateTimeInput(end) : ''}"></label>
          <div class="dp2-info">${valid ? `Duração: <b>${fmtDuration(end - start)}</b> · horário de Brasília` : ''}</div>
        </div></div>
      <div class="dp2-card"><h3>Agrupamento</h3>
        <div class="dp2-field" style="margin-bottom:6px">Agregação</div>
        <div class="dp2-chips" role="group" aria-label="Agregação">${AGGREGATIONS.map((a) => `<button class="dp2-chip" type="button" data-action="aggregation" data-agg="${a.id}" aria-pressed="${this.s.aggregation === a.id}">${a.label}</button>`).join('')}</div>
        ${raw
          ? `<p class="dp2-info" style="margin:10px 0 0">Bruto: todas as amostras do período, como foram gravadas, sem intervalo de agrupamento e sem limite de pontos. Período máximo de ${maxDays} dias.</p>`
          : `<div class="dp2-field" style="margin:12px 0 6px">Intervalo de agrupamento</div>
             <div class="dp2-chips" role="group" aria-label="Intervalo de agrupamento">${RESOLUTIONS.map((x) => `<button class="dp2-chip" type="button" data-action="resolution" data-res="${x.id}" aria-pressed="${this.s.resolution === x.id}">${x.label} <small>(até ${x.maxDays} d)</small></button>`).join('')}</div>
             <p class="dp2-info" style="margin:10px 0 0">Um ponto por intervalo; um intervalo sem telemetria repete o valor anterior (marcado no resultado). Os intervalos seguem o relógio (00:00, 00:15…) e os parciais nas pontas contam. 15 min é o intervalo de integração de demanda das concessionárias.</p>
             ${valid && !tooLong ? `<p class="dp2-info" style="margin:6px 0 0">${fmtN(bucketCount(start, end, this.s.resolution))} intervalos de ${esc(r.label)}.</p>` : ''}`}
        ${tooLong ? `<div class="dp2-fix"><span class="dp2-err">O período é longo demais para ${esc(modeLabel)}.</span>
          ${fit ? `<button class="dp2-btn sm primary" type="button" data-action="${raw ? 'aggregate-fit' : 'resolution'}" data-res="${fit}">${raw ? `Agrupar por ${esc(RESOLUTION_BY_ID[fit].label)} (Máximo)` : `Usar ${esc(RESOLUTION_BY_ID[fit].label)}`}</button>` : ''}
          <button class="dp2-btn sm" type="button" data-action="shorten">Encurtar para os últimos ${maxDays} dia(s)</button></div>` : ''}
      </div>
      ${errs.length && !tooLong ? `<p class="dp2-err">${errs.map(esc).join('<br>')}</p>` : ''}`;
  }

  private renderStep3(): void {
    this.el.body.innerHTML = `<div class="dp2-tgrid">${TELEMETRY_GROUPS.map((g) => {
      const all = g.items.every((t) => this.s.telemetries.has(t.key));
      return `<div class="dp2-card"><h3><span>${g.icon} ${esc(g.label)}</span>
        <button class="dp2-btn link" type="button" data-action="group-all" data-gid="${g.id}">${all ? 'Desmarcar' : 'Marcar'} todos</button></h3>
        ${g.items.map((t) => `<label class="dp2-check"><input type="checkbox" data-role="tel" data-key="${t.key}" ${this.s.telemetries.has(t.key) ? 'checked' : ''}>
          ${esc(t.label)}<span class="u">${this.p.supportMode ? esc(t.key) + ' · ' : ''}${esc(t.unit)}</span></label>`).join('')}
      </div>`;
    }).join('')}</div>
    <p class="dp2-info">${this.s.telemetries.size} de ${TELEMETRY_CATALOG.length} telemetrias. Mesmo catálogo da modal "Telemetrias Instantâneas e Pico de Demanda".</p>`;
  }

  private renderStep4(): void {
    const snap = this.s.snapshot!;
    const req = snap.request;
    const est = req.estimate;
    const errs = this.stepErrors(4);
    const noIng = req.devices.filter((d) => !d.ingestionId).length;
    const pts = est.points;
    const [cls, txt] = pts === null ? ['medio', 'não estimado'] : pts < 50_000 ? ['pequeno', 'pequeno'] : pts < 500_000 ? ['medio', 'médio'] : ['grande', 'grande'];
    const sizeDetail = pts === null || est.buckets === null
      ? '<span class="dp2-info">dados brutos: todas as amostras do período — o volume depende da frequência de cada medidor</span>'
      : `<span class="dp2-info">≈ ${fmtN(pts)} linhas de dados</span>
            <details class="dp2-details"><summary>Detalhes</summary><span class="dp2-info">${fmtN(est.buckets)} intervalos × ${req.devices.length} medidores × ${req.telemetries.length} telemetrias · limite ${fmtN(DEMAND_LIMITS.points)}</span></details>`;
    const start = Date.parse(req.period.startUtc);
    const end = Date.parse(req.period.endUtc);
    this.el.body.innerHTML = `
      <div class="dp2-card"><h3 tabindex="-1" data-role="step-title">Resumo do pedido</h3>
        <dl class="dp2-sum">
          <dt>Solicitante</dt><dd>${esc(this.p.user.name)}</dd>
          <dt>Medidores (${req.devices.length})</dt><dd><div class="dp2-pills">${req.devices.map((d) => `<span class="dp2-pill">${esc(d.label)}${(this.labelCount.get(d.label) || 0) > 1 && d.identifier ? ' · ' + esc(d.identifier) : ''}</span>`).join('')}</div>
            ${noIng ? `<div class="dp2-err" style="font-weight:600;margin-top:6px">⚠ ${noIng} sem vínculo de dados — o resultado pode vir sem esses medidores (Q3).</div>` : ''}</dd>
          <dt>Período</dt><dd>${formatLocalDateTime(start)} → ${formatLocalDateTime(end)} <span class="dp2-info">(${fmtDuration(end - start)}, horário de Brasília${req.period.preset === 'today' || req.period.preset === 'thisMonth' ? `, calculado às ${formatLocalDateTime(snap.takenAt).slice(11)}` : ''})</span></dd>
          <dt>Agrupamento</dt><dd>${esc(this.groupingLabel(req.aggregation, req.resolution))}
            <span class="dp2-info">${req.aggregation === 'NONE' ? '(sem intervalo, sem limite de pontos)' : '(intervalo sem telemetria repete o valor anterior)'}</span></dd>
          <dt>Telemetrias (${req.telemetries.length})</dt><dd><div class="dp2-pills">${req.telemetries.map((t) => `<span class="dp2-pill">${esc(t.label)} · ${esc(t.unit)}</span>`).join('')}</div></dd>
          <dt>Tamanho</dt><dd><span class="dp2-size ${cls}">${txt}</span> ${sizeDetail}</dd>
        </dl>
        <p class="dp2-info" style="margin:12px 0 0">Seu pedido fica registrado (quem, quando, o quê) e é processado em segundo plano. <b>Você pode fechar este painel</b> e acompanhar em Relatórios.</p>
      </div>
      ${this.p.supportMode ? `<div class="dp2-card"><h3>Pedido que será registrado (suporte)</h3><pre class="dp2-json">${esc(JSON.stringify(req, null, 2))}</pre></div>` : ''}
      ${errs.length ? `<p class="dp2-err">${errs.map(esc).join('<br>')}</p>` : ''}`;
  }

  private renderNav(): void {
    const errs = this.stepErrors(this.s.step);
    const hints = ['', `${this.s.selected.length} medidor(es) na lista`, 'Escolha o período e a resolução', `${this.s.telemetries.size} telemetria(s)`, 'Revise e confirme'];
    this.el.nav.innerHTML = `
      <button class="dp2-btn" type="button" data-action="back" ${this.s.step === 1 ? 'disabled' : ''}>← Voltar</button>
      <span class="hint">${esc(hints[this.s.step])}</span>
      ${this.s.step === 4
        ? `<button class="dp2-btn primary" type="button" data-action="confirm" ${errs.length || this.s.submitting ? 'disabled' : ''}>${this.s.submitting ? 'Enviando…' : '✓ Confirmar e enviar'}</button>`
        : `<button class="dp2-btn primary" type="button" data-action="next" ${errs.length ? 'disabled' : ''}>Próximo →</button>`}`;
  }

  private jobTitle(e: DemandReportEnvelopeV1): string {
    const r = e.request;
    return `${r.devices.length} medidor(es) · ${fmtDay(Date.parse(r.period.startUtc))}–${fmtDay(Date.parse(r.period.endUtc) - 1)} · ${this.groupingLabel(r.aggregation ?? 'MAX', r.resolution)}`;
  }

  private renderJobs(): void {
    const s = this.s;
    this.el.nav.innerHTML = `<span class="hint">${s.envelopes.length} de ${s.keys.length} pedido(s) registrados${s.unreadable ? ` · ${s.unreadable} ilegível(is)` : ''}</span>
      ${s.envelopes.length + s.unreadable < s.keys.length ? '<button class="dp2-btn" type="button" data-action="more">Carregar mais</button>' : ''}
      <button class="dp2-btn" type="button" data-action="reload">⟳ Atualizar</button>
      <button class="dp2-btn primary" type="button" data-action="tab" data-tab="new">+ Novo relatório</button>`;
    if (s.listState === 'loading' && !s.envelopes.length) { this.el.body.innerHTML = '<div class="dp2-skel"></div><div class="dp2-skel"></div><div class="dp2-skel"></div>'; return; }
    if (s.listState === 'error') {
      this.el.body.innerHTML = `<div class="dp2-empty">Não foi possível carregar os relatórios (${esc(s.listError)}).<br><button class="dp2-btn" type="button" data-action="reload">Tentar de novo</button></div>`;
      return;
    }
    const orphans = this.p.supportMode ? s.active.filter((j) => !s.keys.includes(envelopeKey(j.jobId))) : [];
    if (!s.envelopes.length && !orphans.length) { this.el.body.innerHTML = '<div class="dp2-empty">Nenhum relatório ainda. Crie um em <b>Novo relatório</b>.</div>'; return; }
    const cards = s.envelopes.map((e) => {
      const v = this.view(e);
      const st = v.state;
      const j = v.job;
      const progress = j?.progress ?? 0;
      const canResend = v.canResend && !(v.state === 'rejected' && s.active.length >= DEMAND_LIMITS.activeJobs);
      const busy = s.inflight.has(e.jobId) ? 'disabled' : '';
      const note = (cls: string, text: string) => `<div class="${cls}" style="margin-top:6px">${text}</div>`;
      return `<article class="dp2-job" aria-label="${esc(this.jobTitle(e))}">
        <div class="dp2-job-top">
          <span class="dp2-job-title">${esc(this.jobTitle(e))}</span>
          <span class="dp2-status ${st}">${JOB_STATE_LABEL[st]}${st === 'running' ? ` ${progress}%` : ''}</span>
          <span style="flex:1"></span>
          <span class="dp2-info">${esc(e.requestedBy.name)} · ${formatLocalDateTime(Date.parse(e.requestedAt))}</span>
        </div>
        ${st === 'queued' || st === 'running' ? `<div class="dp2-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>` : ''}
        ${st === 'failed' && j?.error ? note('dp2-err', `${esc(j.error.message)}${this.p.supportMode ? ` <small>(${esc(j.error.code)})</small>` : ''}`) : ''}
        ${st === 'rejected' ? note('dp2-err', `${esc(rejectionText(v.code, v.message, DEMAND_LIMITS.activeJobs))}${this.p.supportMode ? ` <small>(${esc(v.code)})</small>` : ''}`) : ''}
        ${st === 'not_received' ? note('dp2-err', 'O pedido está registrado, mas o processamento não o recebeu. Reenviar é seguro: não gera relatório duplicado.') : ''}
        ${st === 'query_unavailable' ? note('dp2-info', 'Não foi possível consultar o andamento agora. Tentaremos de novo; reenviar é seguro.') : ''}
        ${st === 'expired' ? note('dp2-info', 'Passou o prazo para reenviar este pedido com segurança. Use "Duplicar e editar".') : ''}
        ${st === 'result_expired' ? note('dp2-info', 'O relatório foi concluído, mas o arquivo já expirou.') : ''}
        ${s.auditPending.has(e.jobId) ? '<div class="dp2-audit-warn">⚠ A ação foi aceita, mas o registro de auditoria falhou — será reconciliado.</div>' : ''}
        <div class="dp2-job-actions">
          ${st === 'succeeded' ? `<button class="dp2-btn sm" type="button" data-action="download" data-job="${esc(e.jobId)}">⬇ Baixar</button>` : ''}
          ${st === 'queued' || st === 'running' ? `<button class="dp2-btn sm" type="button" data-action="cancel" data-job="${esc(e.jobId)}" ${busy}>✕ Cancelar</button>` : ''}
          ${canResend ? `<button class="dp2-btn sm primary" type="button" data-action="resend" data-job="${esc(e.jobId)}" ${busy}>↻ Reenviar</button>` : ''}
          ${['failed', 'cancelled', 'succeeded', 'result_expired', 'expired', 'rejected'].includes(st) ? `<button class="dp2-btn sm" type="button" data-action="clone" data-job="${esc(e.jobId)}">⧉ Duplicar e editar</button>` : ''}
          ${this.p.supportMode ? `<button class="dp2-btn link" type="button" data-action="details" data-job="${esc(e.jobId)}">${s.openDetails.has(e.jobId) ? 'Ocultar' : 'Detalhes /'} auditoria</button>` : ''}
        </div>
        ${this.p.supportMode && s.openDetails.has(e.jobId) ? `<pre class="dp2-json">${esc(JSON.stringify(e, null, 2))}</pre>` : ''}
      </article>`;
    }).join('');
    const orphanCards = orphans.map((j) => `<article class="dp2-job ghost"><div class="dp2-job-top">
        <span class="dp2-job-title">Job sem registro no ThingsBoard (O-6)</span><span class="dp2-status ${j.status}">${JOB_STATE_LABEL[j.status]}</span>
        <span style="flex:1"></span><span class="dp2-info">${esc(j.requestedBy?.principal ?? '')} · ${formatLocalDateTime(Date.parse(j.createdAt))}</span></div>
        <div class="dp2-info" style="margin-top:4px"><code>${esc(j.jobId)}</code></div></article>`).join('');
    this.el.body.innerHTML = cards + orphanCards;
  }

  /* ------------------------------------------------------------------ data flows */
  private opts() { return { signal: this.abort.signal }; }

  private async refreshActive(): Promise<void> {
    try { this.s.active = await this.p.api.active(this.opts()); } catch { /* keep last known */ }
  }

  private async queryJobs(ids: string[]): Promise<void> {
    if (!ids.length) return;
    try {
      mergeBatch(this.s.jobs, await this.p.api.batchGet(ids, this.opts()));
    } catch (err) {
      const code = asPortError(err).code;
      ids.forEach((id) => this.s.jobs.set(id, { queryError: code }));
    }
  }

  async loadPage(reset: boolean): Promise<void> {
    if (this.destroyed) return;
    this.s.listState = 'loading';
    if (reset) { this.s.page = 1; this.render(); }
    try {
      // UUID v7 ids → newest first (ordered by the CLIENT clock — RFC-0238 §3)
      this.s.keys = (await this.p.store.keys(this.opts())).filter((k) => k.startsWith(JOB_KEY_PREFIX)).sort().reverse();
      const keys = this.s.keys.slice(0, this.s.page * this.pageSize);
      const rows = keys.length ? await this.p.store.get(keys, this.opts()) : [];
      const parsed = rows.map((r) => parseEnvelope(r.value));
      this.s.envelopes = parsed.filter((x): x is { ok: true; envelope: DemandReportEnvelopeV1 } => x.ok).map((x) => x.envelope);
      this.s.unreadable = parsed.length - this.s.envelopes.length;
      this.s.listState = 'ok';
    } catch (err) {
      if (this.destroyed) return;
      this.s.listState = 'error';
      this.s.listError = asPortError(err).message;
      this.render();
      return;
    }
    if (this.destroyed) return;
    await Promise.all([this.queryJobs(this.s.envelopes.map((e) => e.jobId)), this.refreshActive()]);
    if (this.destroyed) return;
    await this.reconcile();
    this.render();
    this.schedulePoll(true);
  }

  private async reconcile(): Promise<void> {
    for (const e of this.s.envelopes) {
      const k = this.s.jobs.get(e.jobId);
      if (!k || !('found' in k) || !k.found) continue;
      for (const ev of reconciliationEvents(e, k.job)) {
        if (!(await this.appendAudit(e, ev))) break;
      }
    }
  }

  private async appendAudit(e: DemandReportEnvelopeV1, ev: AuditEvent): Promise<boolean> {
    try {
      Object.assign(e, await this.p.store.appendAudit(envelopeKey(e.jobId), ev, this.opts()));
      this.s.auditPending.delete(e.jobId);
      return true;
    } catch {
      this.s.auditPending.add(e.jobId);
      return false;
    }
  }

  /** Uncertain TB write: read back, reuse when it matches; never overwrite appended audit. */
  private async putEnvelope(env: DemandReportEnvelopeV1): Promise<void> {
    const key = envelopeKey(env.jobId);
    try { await this.p.store.put(key, env, this.opts()); return; } catch (err) {
      if (asPortError(err).code === 'ABORTED') throw err;
    }
    const [found] = await this.p.store.get([key], this.opts());
    const parsed = found ? parseEnvelope(found.value) : null;
    if (parsed && parsed.ok && parsed.envelope.requestHash === env.requestHash) return;
    if (found) throw new Error('chave existente com outro conteúdo');
    await this.p.store.put(key, env, this.opts());
  }

  /** One automatic retry on an uncertain outcome (no response / 5xx), same jobId. */
  private async send(env: DemandReportEnvelopeV1): Promise<{ outcome: 'accepted'; job: GcdrJobView } | { outcome: 'rejected' | 'uncertain'; err: PortError }> {
    const cmd = toSubmitCommand(env, { includeDeclaredRequester: this.p.includeDeclaredRequester });
    let last: PortError = { status: 0, code: 'ERROR', message: '' };
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return { outcome: 'accepted', job: await this.p.api.submit(cmd, this.opts()) }; } catch (e) {
        last = asPortError(e);
        if (last.code === 'ABORTED') return { outcome: 'uncertain', err: last };
        if (!isUncertainStatus(last.status)) return { outcome: 'rejected', err: last };
      }
    }
    return { outcome: 'uncertain', err: last };
  }

  private async applySend(e: DemandReportEnvelopeV1, op: 'submit' | 'resend', res: Awaited<ReturnType<DemandPanelV2['send']>>): Promise<'ok' | 'audit_failed' | 'rejected' | 'uncertain'> {
    const by = this.p.user.tbUserId;
    if (res.outcome === 'accepted') {
      this.s.uncertain.delete(e.jobId);
      this.s.jobs.set(e.jobId, { found: true, job: res.job });   // UI reflects what GCDR confirmed first
      this.render();
      return (await this.appendAudit(e, auditEvent(op, 'accepted', by, this.now()))) ? 'ok' : 'audit_failed';
    }
    if (res.outcome === 'rejected') {
      this.s.uncertain.delete(e.jobId);
      this.s.jobs.set(e.jobId, { found: false });
      await this.appendAudit(e, auditEvent(op, 'rejected', by, this.now(), { code: res.err.code, httpStatus: res.err.status, message: res.err.message }));
      return 'rejected';
    }
    this.s.uncertain.add(e.jobId);                                // timeouts are not rejections: nothing appended
    this.s.jobs.set(e.jobId, { found: false });
    return 'uncertain';
  }

  private async confirm(): Promise<void> {
    if (this.stepErrors(4).length || this.s.submitting || !this.s.snapshot) return;
    this.s.submitting = true;
    this.render();
    let env: DemandReportEnvelopeV1;
    try {
      env = await buildEnvelope({ request: this.s.snapshot.request, now: this.now(), user: this.p.user, customer: this.p.customer, idGen: this.p.idGen, sha256: this.p.sha256 });
      await this.putEnvelope(env);
    } catch (err) {
      this.s.submitting = false;
      if (!this.destroyed) { this.toast('error', `Não foi possível registrar o pedido: ${asPortError(err).message}. Nada foi enviado.`); this.render(); }
      return;
    }
    this.s.inflight.add(env.jobId);
    this.s.envelopes.unshift(env);
    this.s.keys.unshift(envelopeKey(env.jobId));
    this.resetWizard();
    this.s.tab = 'jobs';
    this.render();
    const res = await this.send(env);
    this.s.inflight.delete(env.jobId);
    if (this.destroyed) return;
    const outcome = await this.applySend(env, 'submit', res);
    this.s.submitting = false;
    await this.refreshActive();
    const msg = {
      ok: ['success', 'Pedido enviado. Acompanhe em Relatórios.'],
      audit_failed: ['warning', 'Pedido enviado. O registro de auditoria falhou e será reconciliado.'],
      rejected: ['error', `Pedido recusado: ${rejectionText(res.outcome !== 'accepted' ? res.err.code : undefined, res.outcome !== 'accepted' ? res.err.message : undefined)}`],
      uncertain: ['info', 'Pedido registrado; confirmando o recebimento…'],
    }[outcome] as ['success' | 'warning' | 'error' | 'info', string];
    this.toast(msg[0], msg[1]);
    this.announce('Pedido registrado.');
    this.render();
    this.schedulePoll(true);
  }

  private async resend(jobId: string): Promise<void> {
    const e = this.s.envelopes.find((x) => x.jobId === jobId);
    if (!e) return;
    this.s.inflight.add(jobId);
    this.render();
    const res = await this.send(e);   // stored snapshot + stored hash + same jobId
    this.s.inflight.delete(jobId);
    if (this.destroyed) return;
    const outcome = await this.applySend(e, 'resend', res);
    await this.refreshActive();
    if (outcome === 'ok') this.toast('success', 'Reenviado.');
    else if (outcome === 'audit_failed') this.toast('warning', 'Reenviado. O registro de auditoria falhou e será reconciliado.');
    else if (outcome === 'rejected' && res.outcome !== 'accepted') this.toast('error', `Recusado: ${rejectionText(res.err.code, res.err.message)}`);
    else this.toast('info', 'Ainda sem confirmação — tentaremos de novo.');
    this.render();
    this.schedulePoll(true);
  }

  private async cancelJob(jobId: string): Promise<void> {
    const e = this.s.envelopes.find((x) => x.jobId === jobId);
    if (!e) return;
    if (!(await this.confirmDialog('Cancelar relatório?', `${this.jobTitle(e)}\nO cancelamento fica registrado na auditoria.`, 'Sim, cancelar', 'Manter'))) return;
    let job: GcdrJobView;
    try {
      job = await this.p.api.cancel(jobId, { tbUserId: this.p.user.tbUserId }, this.opts());
    } catch (err) {
      const pe = asPortError(err);
      if (this.destroyed) return;
      if (pe.status !== 0) await this.appendAudit(e, auditEvent('cancel', 'rejected', this.p.user.tbUserId, this.now(), { code: pe.code, httpStatus: pe.status }));
      this.toast('error', `Não foi possível cancelar: ${pe.message}`);
      await this.queryJobs([jobId]);
      this.render();
      return;
    }
    this.s.jobs.set(jobId, { found: true, job });                 // UI reflects GCDR first
    await this.refreshActive();
    this.render();
    const ok = await this.appendAudit(e, auditEvent('cancel', 'accepted', this.p.user.tbUserId, this.now()));
    this.toast(ok ? 'success' : 'warning', ok ? 'Relatório cancelado.' : 'Relatório cancelado. O registro de auditoria falhou e será reconciliado.');
    this.announce('Relatório cancelado.');
    this.render();
  }

  private async download(jobId: string): Promise<void> {
    try {
      await this.p.api.download(jobId, this.opts());
      this.toast('info', 'Download: a forma de entrega ainda será definida (Q8).');
    } catch (err) {
      this.toast('error', asPortError(err).message);
      await this.queryJobs([jobId]);
      this.render();
    }
  }

  /* ------------------------------------------------------------------ polling */
  private pollIds(): string[] {
    return this.s.envelopes.filter((e) => needsPolling(this.view(e).state)).map((e) => e.jobId);
  }

  private schedulePoll(reset: boolean): void {
    if (this.destroyed) return;
    if (reset) this.pollDelay = this.p.pollMinMs ?? 5_000;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (!this.pollIds().length && !this.s.active.length) return;
    // a job inside the grace period must flip to "Não enviado" right when the grace ends
    const graceEnds = this.s.envelopes
      .filter((e) => { const st = this.view(e).state; return (st === 'sending' || st === 'send_uncertain') && !this.s.inflight.has(e.jobId); })
      .map((e) => Date.parse(e.requestedAt) + this.graceMs - this.now() + 100)
      .filter((ms) => ms > 0);
    this.pollTimer = setTimeout(() => void this.pollTick(), Math.min(this.pollDelay, ...graceEnds));
  }

  private async pollTick(): Promise<void> {
    this.pollTimer = null;
    if (this.destroyed) return;
    if (typeof document !== 'undefined' && document.hidden) { this.paused = true; return; }
    await Promise.all([this.queryJobs(this.pollIds()), this.refreshActive()]);
    if (this.destroyed) return;
    await this.reconcile();
    this.render();
    this.pollDelay = Math.min(this.pollDelay * 1.5, this.p.pollMaxMs ?? 30_000);
    this.schedulePoll(false);
  }

  private onVisibility = (): void => {
    if (!document.hidden && this.paused) { this.paused = false; void this.pollTick(); }
  };

  /* ------------------------------------------------------------------ wizard actions */
  private async addDevices(ids: string[]): Promise<void> {
    const fresh = ids.filter((id) => !this.s.selected.includes(id) && this.deviceById.has(id) && this.eligibility(this.deviceById.get(id)!).ok);
    const room = DEMAND_LIMITS.devices - this.s.selected.length;
    if (fresh.length > room) {
      if (room <= 0) { this.toast('warning', `A lista já tem ${DEMAND_LIMITS.devices} medidores.`); return; }
      if (!(await this.confirmDialog('Limite de medidores', `Cabem ${room} de ${fresh.length}. Adicionar os ${room} primeiros?`, `Adicionar ${room}`))) return;
    }
    const added = fresh.slice(0, Math.max(0, room));
    this.s.selected.push(...added);
    if (added.length) {
      const first = this.deviceById.get(added[0])!;
      this.announce(`${added.length === 1 ? first.label + ' adicionado' : added.length + ' medidores adicionados'} · ${this.s.selected.length} de ${DEMAND_LIMITS.devices}`);
    }
  }

  private resetWizard(): void {
    const r = presetRange('last7days', this.now())!;
    Object.assign(this.s, { step: 1, maxStep: 1, search: '', category: 'all', selected: [], snapshot: null,
      aggregation: DEFAULT_AGGREGATION, resolution: DEFAULT_RESOLUTION,
      period: { preset: 'last7days', start: r.start, end: r.end }, telemetries: new Set(['consumption']) });
  }

  /** A duplicate is a NEW request: relative presets are recomputed (O-12 open). */
  private cloneJob(e: DemandReportEnvelopeV1): void {
    const req = e.request;
    this.resetWizard();
    this.s.selected = req.devices.map((d) => d.tbDeviceId).filter((id) => this.deviceById.has(id) && this.eligibility(this.deviceById.get(id)!).ok);
    this.s.aggregation = req.aggregation ?? DEFAULT_AGGREGATION;
    this.s.resolution = req.resolution ?? DEFAULT_RESOLUTION;
    this.s.period = req.period.preset !== 'custom'
      ? { preset: req.period.preset, ...presetRange(req.period.preset, this.now())! }
      : { preset: 'custom', start: Date.parse(req.period.startUtc), end: Date.parse(req.period.endUtc) };
    this.s.telemetries = new Set(req.telemetries.map((t) => t.key));
    this.s.tab = 'new';
    this.s.step = 4;
    this.s.maxStep = 4;
    this.freezeSnapshot();
  }

  private focusStepTitle(): void {
    (this.el.body.querySelector('[data-role="step-title"]') as HTMLElement | null)?.focus();
  }

  private isDirty(): boolean {
    return this.s.tab === 'new' && (this.s.selected.length > 0 || this.s.step > 1);
  }

  /* ------------------------------------------------------------------ events */
  private onClick = async (ev: Event): Promise<void> => {
    const t = (ev.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!t || !this.root.contains(t)) return;
    const a = t.dataset.action;
    const job = t.dataset.job || '';
    switch (a) {
      case 'tab':
        this.s.tab = t.dataset.tab as 'new' | 'jobs';
        if (this.s.tab === 'jobs') { void this.loadPage(true); return; }
        break;
      case 'goto':
        if (t.dataset.state === 'done') { this.s.step = Number(t.dataset.step); this.render(); this.focusStepTitle(); }
        return;
      case 'next':
        if (!this.stepErrors(this.s.step).length) {
          this.s.step++;
          this.s.maxStep = Math.max(this.s.maxStep, this.s.step);
          if (this.s.step === 4) this.freezeSnapshot();
          this.render();
          this.focusStepTitle();
        }
        return;
      case 'back':
        this.s.step = Math.max(1, this.s.step - 1);
        this.render();
        this.focusStepTitle();
        return;
      case 'add':
      case 'remove': {
        const sel = `[data-role="${a === 'add' ? 'results' : 'selected'}"] [data-action="${a}"]`;
        const idx = Array.from(this.el.body.querySelectorAll(sel)).indexOf(t);
        if (a === 'add') await this.addDevices([t.dataset.id!]);
        else {
          const d = this.deviceById.get(t.dataset.id!);
          this.s.selected = this.s.selected.filter((id) => id !== t.dataset.id);
          if (d) this.announce(`${d.label} removido · ${this.s.selected.length} de ${DEMAND_LIMITS.devices}`);
        }
        this.render();
        const next = Array.from(this.el.body.querySelectorAll<HTMLElement>(sel));
        (next[idx] || next[idx - 1] || (this.el.body.querySelector('[data-role="search"]') as HTMLElement | null))?.focus();
        return;
      }
      case 'add-all':
        await this.addDevices(this.searchResults().map((d) => d.tbDeviceId));
        break;
      case 'clear':
        this.s.selected = [];
        break;
      case 'category':
        this.s.category = t.dataset.key || 'all';
        break;
      case 'preset': {
        this.s.period.preset = t.dataset.preset as PeriodPreset;
        const r = presetRange(this.s.period.preset, this.now());
        if (r) Object.assign(this.s.period, r);
        break;
      }
      case 'resolution':
        this.s.resolution = t.dataset.res as DemandResolution;   // never changes the period by itself
        break;
      case 'aggregation':
        this.s.aggregation = t.dataset.agg as DemandAggregation;
        break;
      case 'aggregate-fit':
        // Bruto over a long period → switch to an aggregation (Máximo) with the finest fitting interval
        this.s.aggregation = 'MAX';
        this.s.resolution = t.dataset.res as DemandResolution;
        break;
      case 'shorten': {
        const maxDays = maxPeriodDays(this.effResolution());
        this.s.period = { preset: 'custom', start: this.s.period.end - maxDays * 86_400_000, end: this.s.period.end };
        break;
      }
      case 'group-all': {
        const g = TELEMETRY_GROUPS.find((x) => x.id === t.dataset.gid);
        if (g) {
          const all = g.items.every((x) => this.s.telemetries.has(x.key));
          g.items.forEach((x) => (all ? this.s.telemetries.delete(x.key) : this.s.telemetries.add(x.key)));
        }
        break;
      }
      case 'confirm':
        void this.confirm();
        return;
      case 'reload':
        void this.loadPage(true);
        return;
      case 'more':
        this.s.page++;
        void this.loadPage(false);
        return;
      case 'details':
        if (this.s.openDetails.has(job)) this.s.openDetails.delete(job);
        else this.s.openDetails.add(job);
        break;
      case 'resend':
        void this.resend(job);
        return;
      case 'cancel':
        void this.cancelJob(job);
        return;
      case 'clone': {
        const e = this.s.envelopes.find((x) => x.jobId === job);
        if (e) this.cloneJob(e);
        break;
      }
      case 'download':
        void this.download(job);
        return;
      default:
        return;
    }
    this.render();
  };

  private onInput = (ev: Event): void => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.role === 'search') { this.s.search = t.value; this.renderStep1(); this.renderNav(); }
  };

  private onChange = (ev: Event): void => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.role === 'tel') {
      if (t.checked) this.s.telemetries.add(t.dataset.key!);
      else this.s.telemetries.delete(t.dataset.key!);
      this.render();
    }
    if (t.dataset.role === 'start' || t.dataset.role === 'end') {
      this.s.period.preset = 'custom';
      this.s.period[t.dataset.role] = parseLocalDateTime(t.value);
      this.render();
    }
  };

  private onKeydown = async (ev: KeyboardEvent): Promise<void> => {
    const t = ev.target as HTMLElement;
    if (ev.key === 'Enter' && t.dataset.role === 'search') {
      ev.preventDefault();
      const candidates = this.searchResults().filter((d) => !this.s.selected.includes(d.tbDeviceId) && this.eligibility(d).ok);
      if (candidates.length === 1) { await this.addDevices([candidates[0].tbDeviceId]); this.renderStep1(); this.renderNav(); }
      else (this.el.body.querySelector('[data-role="results"] [data-action="add"]:not([disabled])') as HTMLElement | null)?.focus();
    }
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && t.getAttribute('role') === 'tab') {
      const tabs = Array.from(this.root.querySelectorAll<HTMLElement>('[role="tab"]'));
      tabs[(tabs.indexOf(t) + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
    }
  };

  /** Esc closes; with a filled wizard it asks first. */
  private onDocKeydown = async (ev: KeyboardEvent): Promise<void> => {
    if (ev.key !== 'Escape' || this.destroyed) return;
    if (document.querySelector('.myio-dialog-backdrop, .myio-dialog')) return;   // a dialog is open: it handles Esc
    if (this.isDirty() && !(await this.confirmDialog('Fechar o relatório?', 'O pedido em montagem será descartado.', 'Fechar', 'Continuar'))) return;
    this.modal.close();
  };
}

/** Opens the Demand Panel v2 modal (RFC-0238). */
export function openDemandPanelV2(params: DemandPanelV2Params): DemandPanelV2Instance {
  return new DemandPanelV2(params).open();
}
