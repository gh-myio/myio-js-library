/**
 * Modal "Importar dados" — widgets TELEMETRY de dispositivos manuais (Shopping v-5.2.0).
 * Fluxo do runbook TELEMETRY-SHEET-IMPORT: modelo → planilha → validação (tudo-ou-nada) →
 * importação (job assíncrono: acompanhar / cancelar). Shell padrão SettingsModalView
 * (`openStandardModal`) com stepper no estilo do Relatório de Demanda (dp2).
 */

import { openStandardModal, type StandardModalInstance } from '../standard-modal';
import {
  buildTemplateCsv,
  parseSheetFile,
  rowsFromTable,
  splitImportableDevices,
  VALUE_COLUMN,
  type ImportDevice,
  type ImportDomain,
  type ImportRow,
  type SheetIssue,
} from './sheet';
import {
  createTelemetryImportApi,
  ImportApiError,
  TERMINAL_JOB_STATUSES,
  type ImportJob,
  type TelemetryImportApi,
  type TelemetryImportApiConfig,
  type ValidateResult,
} from './importApi';

export interface OpenTelemetryImportModalParams {
  domain: ImportDomain;
  /** Customer no Ingestion (atributo `ingestionId` do customer TB) */
  customerId: string;
  /** Devices do widget (label + centralId/slaveId — chave da planilha) */
  devices: ImportDevice[];
  /** API pronta (testes) ou configuração para criar o cliente */
  api: TelemetryImportApi | TelemetryImportApiConfig;
  /** Nome do shopping (nome do arquivo modelo) */
  customerName?: string;
  /** Usuário MyIO: mostra detalhes técnicos dos erros */
  showTechnicalDetails?: boolean;
  /** Intervalo do acompanhamento do job (ms). Default 5000. */
  pollMs?: number;
  /** Chamado quando a importação termina com sucesso */
  onCompleted?: (job: ImportJob) => void;
  /** Injeção para testes */
  now?: () => number;
  container?: HTMLElement;
}

type Step = 1 | 2 | 3 | 4;

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: 'Modelo' },
  { n: 2, label: 'Planilha' },
  { n: 3, label: 'Validação' },
  { n: 4, label: 'Importação' },
];

const DOMAIN_TEXT: Record<ImportDomain, { noun: string; unit: string; icon: string }> = {
  energy: { noun: 'energia', unit: 'kWh', icon: '⚡' },
  water: { noun: 'água', unit: 'm³', icon: '💧' },
};

const JOB_STATUS_TEXT: Record<string, string> = {
  queued: 'Na fila',
  executing: 'Importando',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  reverted: 'Revertida',
};

const STYLE_ID = 'myio-tlmimport-styles';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const fmtNum = (n: unknown, d = 0) =>
  Number.isFinite(Number(n)) ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.tlmi { --tlmi-ac: #3e1a7d; --tlmi-ac-soft: #f1ecfa; --tlmi-ok: #16a34a; --tlmi-warn: #d97706; --tlmi-err: #dc2626;
  display: flex; flex-direction: column; gap: 12px; font-size: 14px; color: #1e293b; }
.tlmi-stepper { display: flex; gap: 6px; }
.tlmi-step { flex: 1; display: flex; align-items: center; gap: 8px; color: #64748b; padding: 6px 8px; border-radius: 10px; font-size: 13px; }
.tlmi-step b { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  border: 2px solid #e2e8f0; font-size: 12px; flex-shrink: 0; }
.tlmi-step[data-state="current"] { color: var(--tlmi-ac); font-weight: 800; background: var(--tlmi-ac-soft); }
.tlmi-step[data-state="current"] b { border-color: var(--tlmi-ac); background: var(--tlmi-ac); color: #fff; }
.tlmi-step[data-state="done"] { color: #1e293b; }
.tlmi-step[data-state="done"] b { border-color: var(--tlmi-ok); background: var(--tlmi-ok); color: #fff; }
.tlmi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.tlmi-card h3 { margin: 0 0 10px !important; font-size: 14px !important; font-weight: 700 !important; line-height: 1.4 !important; }
.tlmi-muted { color: #64748b; font-size: 13px; margin: 0; line-height: 1.5; }
.tlmi-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.tlmi-field { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 12px; color: #64748b; }
.tlmi-field input { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; font: inherit; color: #1e293b; }
.tlmi-btn { font: inherit; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; border: 1px solid #d1d5db;
  background: #fff; color: #374151; cursor: pointer; }
.tlmi-btn.primary { background: var(--tlmi-ac); border-color: var(--tlmi-ac); color: #fff; }
.tlmi-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.tlmi-drop { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 22px; text-align: center; color: #64748b; cursor: pointer; }
.tlmi-drop[data-over="1"] { border-color: var(--tlmi-ac); background: var(--tlmi-ac-soft); }
.tlmi-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.tlmi-kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
.tlmi-kpi span { display: block; font-size: 11.5px; color: #64748b; }
.tlmi-kpi strong { font-size: 18px; }
.tlmi-banner { padding: 9px 12px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
.tlmi-banner.warn { background: #fef3c7; border: 1px solid #fcd34d; color: #78350f; }
.tlmi-banner.err { background: #fee2e2; border: 1px solid #fca5a5; color: #7f1d1d; }
.tlmi-banner.ok { background: #dcfce7; border: 1px solid #86efac; color: #14532d; }
.tlmi-errors { max-height: 220px; overflow: auto; border: 1px solid #fecaca; border-radius: 8px; }
.tlmi-errors table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tlmi-errors th, .tlmi-errors td { padding: 5px 8px; border-bottom: 1px solid #fee2e2; text-align: left; }
.tlmi-errors th { background: #fef2f2; position: sticky; top: 0; }
.tlmi-progress { height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
.tlmi-progress > i { display: block; height: 100%; background: var(--tlmi-ac); transition: width 0.4s; }
.tlmi-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; }
.tlmi-tech { font-size: 11.5px; color: #6b7280; word-break: break-word; }
`;
  document.head.appendChild(style);
}

function issuesTable(errors: SheetIssue[], limit = 100): string {
  const rows = errors
    .slice(0, limit)
    .map((e) => `<tr><td>${esc(e.line)}</td><td>${esc(e.reason)}</td></tr>`)
    .join('');
  const more = errors.length > limit ? `<p class="tlmi-muted">… e mais ${errors.length - limit} erro(s).</p>` : '';
  return `<div class="tlmi-errors"><table><thead><tr><th>Linha</th><th>Problema</th></tr></thead><tbody>${rows}</tbody></table></div>${more}`;
}

/** Período padrão: últimos 7 dias completos (ontem para trás), em America/Sao_Paulo. */
function defaultPeriod(now: number): { start: string; end: string } {
  const sp = new Date(now - 3 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() - 1));
  const start = new Date(end.getTime() - 6 * 86400000);
  return { start: ymd(start), end: ymd(end) };
}

export function openTelemetryImportModal(params: OpenTelemetryImportModalParams): StandardModalInstance {
  injectStyles();
  const domain = params.domain;
  const txt = DOMAIN_TEXT[domain];
  const now = params.now ?? (() => Date.now());
  const api: TelemetryImportApi =
    'validate' in params.api ? (params.api as TelemetryImportApi) : createTelemetryImportApi(params.api as TelemetryImportApiConfig);
  const { ok: importable, missingKey } = splitImportableDevices(params.devices);

  const s = {
    step: 1 as Step,
    period: defaultPeriod(now()),
    fileName: '',
    rows: [] as ImportRow[],
    localErrors: [] as SheetIssue[],
    skippedEmpty: 0,
    parseError: '',
    busy: false,
    validation: null as ValidateResult | null,
    apiError: '' as string,
    apiDetail: '' as string,
    confirmReal: false,
    job: null as ImportJob | null,
  };
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const modal = openStandardModal({
    icon: '📥',
    title: `Importar dados de ${txt.noun}`,
    width: 760,
    bodyHtml: '<div class="tlmi"></div>',
    container: params.container,
    buttons: [
      { label: 'Voltar', value: 'back', variant: 'secondary', closeOnClick: false },
      { label: 'Fechar', value: 'close', variant: 'secondary' },
      { label: 'Avançar', value: 'next', variant: 'primary', closeOnClick: false },
    ],
    onButton: (v) => {
      if (v === 'back') goBack();
      if (v === 'next') void goNext();
    },
    onClose: () => {
      closed = true;
      if (pollTimer) clearTimeout(pollTimer);
    },
  });
  const root = modal.getBodyEl().querySelector<HTMLElement>('.tlmi')!;

  const setError = (err: unknown) => {
    s.apiError = err instanceof ImportApiError ? err.message : (err as Error)?.message || 'Erro inesperado.';
    s.apiDetail = params.showTechnicalDetails ? (err instanceof ImportApiError ? err.detail || '' : String(err)) : '';
  };

  /* ------------------------------------------------------------ render */
  function stepper(): string {
    return `<div class="tlmi-stepper">${STEPS.map((st) => {
      const state = st.n === s.step ? 'current' : st.n < s.step ? 'done' : 'todo';
      return `<div class="tlmi-step" data-state="${state}"><b>${state === 'done' ? '✓' : st.n}</b>${st.label}</div>`;
    }).join('')}</div>`;
  }

  function apiErrorBanner(): string {
    if (!s.apiError) return '';
    return `<div class="tlmi-banner err" role="alert">${esc(s.apiError)}${s.apiDetail ? `<div class="tlmi-tech">${esc(s.apiDetail)}</div>` : ''}</div>`;
  }

  function step1(): string {
    const warn = missingKey.length
      ? `<div class="tlmi-banner warn">${missingKey.length} dispositivo(s) sem central/endereço cadastrados ficam fora do modelo: ${esc(
          missingKey.slice(0, 5).map((d) => d.label).join(', ')
        )}${missingKey.length > 5 ? '…' : ''}</div>`
      : '';
    return `
      <div class="tlmi-card"><h3>Como funciona</h3>
        <p class="tlmi-muted">1) Baixe o modelo com os dispositivos desta lista, uma linha por hora. 2) Preencha a coluna
        <strong>${VALUE_COLUMN[domain]}</strong> (${txt.unit}); apague ou deixe em branco as horas que não quer alterar.
        3) Envie a planilha: ela é validada por inteiro — qualquer linha inválida cancela a importação.
        Os valores importados <strong>substituem</strong> as leituras existentes nas horas enviadas.</p>
      </div>
      ${warn}
      <div class="tlmi-card"><h3>Modelo da planilha</h3>
        <div class="tlmi-row">
          <label class="tlmi-field">Início<input type="date" data-field="start" value="${esc(s.period.start)}" /></label>
          <label class="tlmi-field">Fim<input type="date" data-field="end" value="${esc(s.period.end)}" /></label>
          <button class="tlmi-btn" type="button" data-action="template" ${importable.length ? '' : 'disabled'}>⬇ Baixar modelo (CSV)</button>
        </div>
        <p class="tlmi-muted" style="margin-top:8px">${importable.length} dispositivo(s) no modelo. Já tem a planilha preenchida? Clique em <strong>Avançar</strong>.</p>
      </div>`;
  }

  function step2(): string {
    const summary = s.fileName
      ? s.parseError
        ? `<div class="tlmi-banner err">${esc(s.parseError)}</div>`
        : `<div class="tlmi-kpis">
            <div class="tlmi-kpi"><span>Arquivo</span><strong style="font-size:13px">${esc(s.fileName)}</strong></div>
            <div class="tlmi-kpi"><span>Linhas para importar</span><strong>${fmtNum(s.rows.length)}</strong></div>
            <div class="tlmi-kpi"><span>Em branco (ignoradas)</span><strong>${fmtNum(s.skippedEmpty)}</strong></div>
            <div class="tlmi-kpi"><span>Com erro</span><strong style="color:${s.localErrors.length ? '#dc2626' : '#16a34a'}">${fmtNum(s.localErrors.length)}</strong></div>
          </div>
          ${s.localErrors.length ? `<div class="tlmi-banner err">Corrija as linhas abaixo e envie de novo — nada foi importado.</div>${issuesTable(s.localErrors)}` : ''}
          ${!s.localErrors.length && !s.rows.length ? '<div class="tlmi-banner warn">Nenhuma linha com valor preenchido.</div>' : ''}`
      : '';
    return `
      <div class="tlmi-card"><h3>Planilha preenchida</h3>
        <label class="tlmi-drop" data-role="drop">
          <input type="file" accept=".xlsx,.xls,.csv" data-field="file" hidden />
          📄 Clique ou arraste a planilha aqui (.xlsx ou .csv)
        </label>
      </div>
      ${summary}`;
  }

  function step3(): string {
    const v = s.validation;
    if (!v) return `${apiErrorBanner()}<div class="tlmi-card"><p class="tlmi-muted">${s.busy ? 'Validando…' : 'Aguardando validação.'}</p></div>`;
    if (v.valid === false) {
      return `<div class="tlmi-banner err">A planilha foi recusada: ${fmtNum(v.invalidCount)} linha(s) inválida(s). Nada foi importado.</div>
        ${issuesTable(v.errors)}`;
    }
    const p = v.preview || {};
    const real = Number(p.existingRealReadings || 0);
    const period = typeof p.period === 'string' ? p.period : p.period ? `${p.period.start || ''} → ${p.period.end || ''}` : '—';
    const devices = Array.isArray(p.devices) ? p.devices.length : p.devices;
    return `
      <div class="tlmi-banner ok">Planilha válida. Confira o resumo antes de importar.</div>
      <div class="tlmi-kpis">
        <div class="tlmi-kpi"><span>Horas a gravar</span><strong>${fmtNum(p.targetSlots)}</strong></div>
        <div class="tlmi-kpi"><span>Dispositivos</span><strong>${fmtNum(devices)}</strong></div>
        <div class="tlmi-kpi"><span>Total (${txt.unit})</span><strong>${fmtNum(p.totalValue, 2)}</strong></div>
        <div class="tlmi-kpi"><span>Leituras substituídas</span><strong>${fmtNum(p.existingReadingsInTarget)}</strong></div>
      </div>
      <p class="tlmi-muted">Período: ${esc(period)}</p>
      ${
        real > 0
          ? `<div class="tlmi-banner warn"><strong>${fmtNum(real)} leitura(s) reais do medidor</strong> serão substituídas pelos valores da planilha.
              <label class="tlmi-check" style="margin-top:6px"><input type="checkbox" data-field="confirmReal" ${s.confirmReal ? 'checked' : ''} />
              Confirmo a substituição das leituras reais.</label></div>`
          : ''
      }
      ${apiErrorBanner()}`;
  }

  function step4(): string {
    const j = s.job;
    if (!j) return `${apiErrorBanner()}<div class="tlmi-card"><p class="tlmi-muted">Iniciando importação…</p></div>`;
    const pct = Math.max(0, Math.min(100, Number(j.progress ?? (j.status === 'completed' ? 100 : 0))));
    const statusText = JOB_STATUS_TEXT[j.status] || j.status;
    const terminal = TERMINAL_JOB_STATUSES.includes(j.status);
    let banner = '';
    if (j.status === 'completed') {
      banner =
        j.refreshStatus === 'failed'
          ? '<div class="tlmi-banner warn">Dados importados, mas a atualização dos totais falhou. Avise o suporte MyIO.</div>'
          : '<div class="tlmi-banner ok">Importação concluída. Os totais podem levar alguns minutos para refletir.</div>';
    } else if (j.status === 'failed') {
      banner = `<div class="tlmi-banner err">A importação falhou${j.error ? `: ${esc(j.error)}` : '.'}</div>`;
    } else if (j.status === 'cancelled') {
      banner = '<div class="tlmi-banner warn">Importação cancelada. As leituras anteriores foram mantidas.</div>';
    }
    return `
      <div class="tlmi-card"><h3>Importação <span style="font-weight:600;color:#64748b">${esc(statusText)}</span></h3>
        <div class="tlmi-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        <div class="tlmi-kpis" style="margin-top:12px">
          <div class="tlmi-kpi"><span>Progresso</span><strong>${fmtNum(pct)}%</strong></div>
          <div class="tlmi-kpi"><span>Leituras removidas</span><strong>${fmtNum(j.deleted)}</strong></div>
          <div class="tlmi-kpi"><span>Leituras gravadas</span><strong>${fmtNum(j.inserted)}</strong></div>
        </div>
        ${j.phase && !terminal ? `<p class="tlmi-muted" style="margin-top:8px">Etapa: ${esc(j.phase)}</p>` : ''}
        ${
          !terminal
            ? `<div style="margin-top:12px"><button class="tlmi-btn" type="button" data-action="cancel" ${s.busy ? 'disabled' : ''}>Cancelar importação</button>
               <span class="tlmi-muted" style="margin-left:8px">Você pode fechar esta janela; a importação continua.</span></div>`
            : ''
        }
      </div>
      ${banner}
      ${apiErrorBanner()}`;
  }

  function render(): void {
    if (closed) return;
    const body = s.step === 1 ? step1() : s.step === 2 ? step2() : s.step === 3 ? step3() : step4();
    root.innerHTML = stepper() + body;
    syncFooter();
  }

  function syncFooter(): void {
    const v = s.validation;
    const terminal = s.job ? TERMINAL_JOB_STATUSES.includes(s.job.status) : false;
    modal.setButton('back', { hidden: s.step === 1 || s.step === 4, disabled: s.busy });
    if (s.step === 1) modal.setButton('next', { label: 'Avançar', disabled: false, hidden: false });
    if (s.step === 2)
      modal.setButton('next', { label: 'Validar planilha', disabled: s.busy || !s.rows.length || !!s.localErrors.length || !!s.parseError, hidden: false });
    if (s.step === 3) {
      const real = v && v.valid ? Number(v.preview?.existingRealReadings || 0) : 0;
      modal.setButton('next', {
        label: s.busy ? 'Iniciando…' : 'Importar',
        hidden: !v || !v.valid,
        disabled: s.busy || (real > 0 && !s.confirmReal),
      });
    }
    if (s.step === 4) modal.setButton('next', { label: 'Concluir', hidden: !terminal, disabled: false });
  }

  /* ------------------------------------------------------------ actions */
  function goBack(): void {
    if (s.busy || s.step === 1 || s.step === 4) return;
    s.apiError = '';
    if (s.step === 3) s.validation = null;
    s.step = (s.step - 1) as Step;
    render();
  }

  async function goNext(): Promise<void> {
    if (s.busy) return;
    if (s.step === 1) {
      s.step = 2;
      render();
    } else if (s.step === 2) {
      await validate();
    } else if (s.step === 3) {
      await start();
    } else if (s.step === 4) {
      if (s.job?.status === 'completed') params.onCompleted?.(s.job);
      modal.close();
    }
  }

  function downloadTemplate(): void {
    const { csv, rows } = buildTemplateCsv(domain, importable, s.period.start, s.period.end, now());
    if (!rows) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const who = (params.customerName || 'shopping').replace(/[^\w-]+/g, '_');
    a.download = `importacao-${domain === 'energy' ? 'energia' : 'agua'}-${who}-${s.period.start}_${s.period.end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function loadFile(file: File | undefined): Promise<void> {
    if (!file) return;
    s.fileName = file.name;
    s.parseError = '';
    s.rows = [];
    s.localErrors = [];
    s.skippedEmpty = 0;
    s.validation = null;
    try {
      const table = await parseSheetFile(file);
      const r = rowsFromTable(domain, table);
      s.rows = r.rows;
      s.localErrors = r.errors;
      s.skippedEmpty = r.skippedEmpty;
    } catch (err) {
      s.parseError = (err as Error)?.message || 'Não foi possível ler a planilha.';
    }
    render();
  }

  async function validate(): Promise<void> {
    s.busy = true;
    s.apiError = '';
    s.validation = null;
    s.step = 3;
    render();
    try {
      s.validation = await api.validate({ customerId: params.customerId, readingType: domain, rows: s.rows, sourceRef: s.fileName });
    } catch (err) {
      setError(err);
    } finally {
      s.busy = false;
      render();
    }
  }

  async function start(): Promise<void> {
    const v = s.validation;
    if (!v || !v.valid) return;
    s.busy = true;
    s.apiError = '';
    render();
    try {
      const started = await api.startJob({ validationId: v.validationId, confirmReplaceReal: s.confirmReal || undefined });
      s.job = { jobId: started.jobId, status: started.status };
      s.step = 4;
      s.busy = false;
      render();
      schedulePoll(0);
    } catch (err) {
      setError(err);
      s.busy = false;
      render();
    }
  }

  function schedulePoll(delay = params.pollMs ?? 5000): void {
    if (closed || !s.job?.jobId) return;
    pollTimer = setTimeout(async () => {
      if (closed || !s.job?.jobId) return;
      try {
        s.job = { ...(await api.getJob(s.job.jobId)), jobId: s.job.jobId };
        s.apiError = '';
      } catch (err) {
        setError(err);
      }
      render();
      if (s.job && !TERMINAL_JOB_STATUSES.includes(s.job.status)) schedulePoll();
    }, delay);
  }

  async function cancelJob(): Promise<void> {
    if (!s.job?.jobId || s.busy) return;
    s.busy = true;
    render();
    try {
      const j = await api.cancelJob(s.job.jobId);
      if (j?.status) s.job = { ...s.job, ...j };
    } catch (err) {
      setError(err);
    } finally {
      s.busy = false;
      render();
    }
  }

  /* ------------------------------------------------------------ events */
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'template') downloadTemplate();
    if (el.dataset.action === 'cancel') void cancelJob();
  });
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.field === 'start') s.period.start = t.value;
    if (t.dataset.field === 'end') s.period.end = t.value;
    if (t.dataset.field === 'file') void loadFile(t.files?.[0]);
    if (t.dataset.field === 'confirmReal') {
      s.confirmReal = t.checked;
      syncFooter();
    }
  });
  root.addEventListener('dragover', (e) => {
    const drop = (e.target as HTMLElement).closest<HTMLElement>('[data-role="drop"]');
    if (!drop) return;
    e.preventDefault();
    drop.dataset.over = '1';
  });
  root.addEventListener('dragleave', (e) => {
    const drop = (e.target as HTMLElement).closest<HTMLElement>('[data-role="drop"]');
    if (drop) drop.dataset.over = '';
  });
  root.addEventListener('drop', (e) => {
    const drop = (e.target as HTMLElement).closest<HTMLElement>('[data-role="drop"]');
    if (!drop) return;
    e.preventDefault();
    void loadFile((e as DragEvent).dataTransfer?.files?.[0]);
  });

  render();
  return modal;
}
