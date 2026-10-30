/**
 * Modal "Novo dispositivo manual" — botão "+" dos widgets TELEMETRY "…MANUAL" (Shopping v-5.2.0).
 * Shell padrão do SettingsModalView (ModalHeader + footer) via `openStandardModal`.
 *
 * Usuário final vê só Etiqueta + Identificador (o tipo vem do domínio do widget:
 * energia → 3F_MEDIDOR_MANUAL, água → HIDROMETRO_MANUAL). Com `showTechnicalDetails`
 * (usuários MyIO) o resultado mostra nome do device, profile e asset.
 */

import { openStandardModal, type StandardModalInstance } from '../standard-modal';
import {
  createManualDevice,
  ManualDeviceError,
  MANUAL_DEVICE_PROFILES,
  manualDeviceName,
  type CreateManualDeviceParams,
  type CreateManualDeviceResult,
  type ManualDeviceDomain,
} from './createManualDevice';

// ── RFC-0240: criação nos 4 sistemas (TB, GCDR, Ingestion, Central) ────────────
// O modal só desenha; quem fala com os sistemas é o host (MAIN_VIEW), injetado em `provisioner`.

export type ManualProvisionStatus = 'pending' | 'running' | 'ok' | 'warn' | 'error' | 'skipped' | 'rolledback';

export interface ManualProvisionStep {
  key: string;
  /** Rótulo curto do sistema (ThingsBoard, GCDR, Ingestion, Central, …) */
  system: string;
  /** O que o passo faz, em uma linha */
  title: string;
  status: ManualProvisionStatus;
  /** Resultado / motivo (id criado, erro, aviso) */
  message?: string;
}

export interface ManualProvisionPlan {
  /** O que o usuário confere antes de criar (nome, etiqueta, identificador) */
  summary: Array<{ label: string; value: string }>;
  /** Dados técnicos (tipo, central, slaveId, endereço, asset) — recolhidos em "Ver mais detalhes" */
  details?: Array<{ label: string; value: string }>;
  /** Passos por sistema — recolhidos junto com `details` */
  steps: ManualProvisionStep[];
  /** Impedem a criação (o botão Criar fica desabilitado) */
  blockers?: string[];
  warnings?: string[];
  /** Estado opaco do host, devolvido em apply() */
  context?: unknown;
}

export interface ManualProvisionResult {
  ok: boolean;
  steps: ManualProvisionStep[];
  /** Mensagem final (sucesso parcial / erro) */
  message?: string;
  result?: CreateManualDeviceResult;
}

export interface ManualDeviceProvisioner {
  plan(input: { domain: ManualDeviceDomain; label: string; identifier: string }): Promise<ManualProvisionPlan>;
  apply(plan: ManualProvisionPlan, onStep: (step: ManualProvisionStep) => void): Promise<ManualProvisionResult>;
}

export interface OpenManualDeviceModalParams extends Omit<CreateManualDeviceParams, 'label' | 'identifier'> {
  /** Usuário MyIO: mostra detalhes técnicos (nome do device, profile, asset, erro bruto) */
  showTechnicalDetails?: boolean;
  /** Chamado após criar com sucesso (ex.: recarregar o dashboard) */
  onCreated?: (result: CreateManualDeviceResult) => void;
  container?: HTMLElement;
  /** RFC-0240: cria nos 4 sistemas (plano → criar). Sem ele, cria só no ThingsBoard. */
  provisioner?: ManualDeviceProvisioner;
}

const DOMAIN_TEXT: Record<ManualDeviceDomain, { title: string; icon: string; noun: string }> = {
  energy: { title: 'Novo medidor de energia manual', icon: '⚡', noun: 'Medidor de energia' },
  water: { title: 'Novo hidrômetro manual', icon: '💧', noun: 'Hidrômetro' },
};

const STYLE_ID = 'myio-manualdev-styles';

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Campos no padrão do formulário do SettingsModalView (.form-group)
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.myio-manualdev { display: flex; flex-direction: column; gap: 16px; }
.myio-manualdev__hint { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
.myio-manualdev__field { display: flex; flex-direction: column; gap: 6px; }
.myio-manualdev__label { font-size: 14px; font-weight: 500; color: #333; }
.myio-manualdev__input {
  font-family: inherit; font-size: 14px; padding: 10px 12px; border: 1px solid #ddd;
  border-radius: 6px; outline: none; color: #111827; background: #fff; box-sizing: border-box; width: 100%;
}
.myio-manualdev__input:focus { border-color: var(--myio-brand-700, #3e1a7d); box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.12); }
.myio-manualdev__input[aria-invalid="true"] { border-color: #dc3545; }
.myio-manualdev__input:disabled { background: #f8f9fa; color: #6c757d; }
.myio-manualdev__type {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  font-size: 12px; font-weight: 600; color: #3e1a7d; background: #f1ecfa;
  padding: 4px 10px; border-radius: 999px;
}
.myio-manualdev__error {
  margin: 0; font-size: 13px; color: #991b1b; background: #fee2e2; border-radius: 6px; padding: 8px 10px;
}
.myio-manualdev__detail { display: block; margin-top: 4px; font-size: 11.5px; color: #7f1d1d; opacity: 0.85; word-break: break-word; }
.myio-manualdev__ok { text-align: center; padding: 4px 0; }
.myio-manualdev__ok-icon { font-size: 34px; line-height: 1; }
.myio-manualdev__ok-title { margin: 8px 0 4px; font-size: 16px; font-weight: 700; color: #065f46; }
.myio-manualdev__ok-text { margin: 0; font-size: 13px; color: #4b5563; }
.myio-manualdev__tech {
  margin-top: 12px; text-align: left; font-size: 11.5px; color: #6b7280; background: #f9fafb;
  border: 1px dashed #e5e7eb; border-radius: 6px; padding: 8px 10px; line-height: 1.6;
}
.myio-manualdev__tech code { font-size: 11.5px; color: #374151; }
.myio-manualdev__summary { width: 100%; border-collapse: collapse; font-size: 13px; }
.myio-manualdev__summary th { text-align: left; font-weight: 500; color: #6b7280; padding: 4px 8px 4px 0; width: 42%; vertical-align: top; }
.myio-manualdev__summary td { color: #111827; padding: 4px 0; word-break: break-word; }
.myio-manualdev__steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.myio-manualdev__step { display: grid; grid-template-columns: 22px 92px 1fr; gap: 8px; align-items: start; font-size: 13px; }
.myio-manualdev__step-sys { font-weight: 600; color: #3e1a7d; }
.myio-manualdev__step-msg { display: block; font-size: 11.5px; color: #6b7280; word-break: break-word; }
.myio-manualdev__step[data-status="error"] .myio-manualdev__step-msg { color: #991b1b; }
.myio-manualdev__step[data-status="warn"] .myio-manualdev__step-msg { color: #92400e; }
.myio-manualdev__more { font-size: 13px; }
.myio-manualdev__more > summary { cursor: pointer; color: #3e1a7d; font-weight: 500; font-size: 13px; }
.myio-manualdev__more[open] > summary { margin-bottom: 10px; }
.myio-manualdev__more > .myio-manualdev__summary { margin-bottom: 10px; }
.myio-manualdev__note { margin: 0; font-size: 12.5px; border-radius: 6px; padding: 8px 10px; }
.myio-manualdev__note--warn { color: #92400e; background: #fef3c7; }
.myio-manualdev__note--block { color: #991b1b; background: #fee2e2; }
`;
  document.head.appendChild(style);
}

function formHtml(domain: ManualDeviceDomain, values: { label: string; identifier: string }, error?: string, detail?: string): string {
  const t = DOMAIN_TEXT[domain];
  return `
    <form class="myio-manualdev" novalidate>
      <p class="myio-manualdev__hint">Cadastre um ponto de leitura manual. Ele aparece nesta lista e não entra nos totais nem nos relatórios.</p>
      <span class="myio-manualdev__type">${t.icon} ${escapeHtml(t.noun)} manual</span>
      <label class="myio-manualdev__field">
        <span class="myio-manualdev__label">Etiqueta</span>
        <input class="myio-manualdev__input" name="label" maxlength="80" autocomplete="off"
          placeholder="Ex.: Burger King" value="${escapeHtml(values.label)}" />
      </label>
      <label class="myio-manualdev__field">
        <span class="myio-manualdev__label">Identificador</span>
        <input class="myio-manualdev__input" name="identifier" maxlength="40" autocomplete="off"
          placeholder="Ex.: STB01010" value="${escapeHtml(values.identifier)}" />
      </label>
      ${
        error
          ? `<p class="myio-manualdev__error" role="alert">${escapeHtml(error)}${
              detail ? `<small class="myio-manualdev__detail">${escapeHtml(detail)}</small>` : ''
            }</p>`
          : ''
      }
      <button type="submit" hidden></button>
    </form>`;
}

function successHtml(domain: ManualDeviceDomain, r: CreateManualDeviceResult, tech: boolean): string {
  return `
    <div class="myio-manualdev__ok">
      <div class="myio-manualdev__ok-icon">✅</div>
      <p class="myio-manualdev__ok-title">${escapeHtml(DOMAIN_TEXT[domain].noun)} criado</p>
      <p class="myio-manualdev__ok-text"><strong>${escapeHtml(r.label)}</strong> · ${escapeHtml(r.identifier)}</p>
      ${
        tech
          ? `<div class="myio-manualdev__tech">
              device <code>${escapeHtml(r.name)}</code><br/>
              profile <code>${escapeHtml(r.deviceProfile)}</code><br/>
              asset <code>${escapeHtml(r.assetName)}</code><br/>
              id <code>${escapeHtml(r.deviceId)}</code>
            </div>`
          : ''
      }
    </div>`;
}

const STEP_ICON: Record<ManualProvisionStatus, string> = {
  pending: '○',
  running: '⏳',
  ok: '✅',
  warn: '⚠️',
  error: '❌',
  skipped: '⏭️',
  rolledback: '↩️',
};

function stepsHtml(steps: ManualProvisionStep[]): string {
  return `<ol class="myio-manualdev__steps">${steps
    .map(
      (s) => `<li class="myio-manualdev__step" data-status="${escapeHtml(s.status)}">
        <span aria-hidden="true">${STEP_ICON[s.status] || '○'}</span>
        <span class="myio-manualdev__step-sys">${escapeHtml(s.system)}</span>
        <span>${escapeHtml(s.title)}${s.message ? `<small class="myio-manualdev__step-msg">${escapeHtml(s.message)}</small>` : ''}</span>
      </li>`
    )
    .join('')}</ol>`;
}

function notesHtml(plan: ManualProvisionPlan): string {
  const block = (plan.blockers || []).map((b) => `<p class="myio-manualdev__note myio-manualdev__note--block" role="alert">⛔ ${escapeHtml(b)}</p>`);
  const warn = (plan.warnings || []).map((w) => `<p class="myio-manualdev__note myio-manualdev__note--warn">⚠️ ${escapeHtml(w)}</p>`);
  return [...block, ...warn].join('');
}

function rowsHtml(rows: Array<{ label: string; value: string }>): string {
  return `<table class="myio-manualdev__summary"><tbody>${rows
    .map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join('')}</tbody></table>`;
}

/** Dados técnicos ficam recolhidos: o usuário final só vê o que preencheu. */
function moreHtml(inner: string, open = false): string {
  return `<details class="myio-manualdev__more"${open ? ' open' : ''}>
    <summary>Ver mais detalhes</summary>
    ${inner}
  </details>`;
}

function planHtml(plan: ManualProvisionPlan): string {
  return `
    <div class="myio-manualdev">
      <p class="myio-manualdev__hint">Revise o que será criado. Nada foi gravado ainda.</p>
      ${rowsHtml(plan.summary)}
      ${notesHtml(plan)}
      ${moreHtml(`${plan.details?.length ? rowsHtml(plan.details) : ''}${stepsHtml(plan.steps)}`)}
    </div>`;
}

function progressHtml(steps: ManualProvisionStep[], message?: string, ok?: boolean, open = false): string {
  return `
    <div class="myio-manualdev">
      ${
        ok === undefined
          ? '<p class="myio-manualdev__hint">Criando o dispositivo… não feche esta janela.</p>'
          : `<p class="myio-manualdev__note ${ok ? 'myio-manualdev__note--warn' : 'myio-manualdev__note--block'}" role="status">${escapeHtml(
              message || (ok ? 'Concluído com avisos.' : 'Não foi possível concluir.')
            )}</p>`
      }
      ${moreHtml(stepsHtml(steps), open)}
    </div>`;
}

export function openManualDeviceModal(params: OpenManualDeviceModalParams): StandardModalInstance {
  const domain = params.domain;
  if (!MANUAL_DEVICE_PROFILES[domain]) throw new Error(`[openManualDeviceModal] domínio inválido: ${domain}`);
  injectStyles();
  if (params.provisioner) return openProvisionedModal(params, params.provisioner);

  const values = { label: '', identifier: '' };
  let busy = false;
  let created: CreateManualDeviceResult | null = null;

  const modal = openStandardModal({
    title: DOMAIN_TEXT[domain].title,
    icon: DOMAIN_TEXT[domain].icon,
    bodyHtml: formHtml(domain, values),
    width: 460,
    container: params.container,
    buttons: [
      { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
      { label: 'Criar', value: 'create', variant: 'primary', closeOnClick: false },
    ],
    onButton: (v) => {
      if (v !== 'create') return;
      if (created) {
        const r = created;
        modal.close();
        params.onCreated?.(r);
      } else {
        void submit();
      }
    },
  });

  const bindForm = (focus = true) => {
    const form = modal.getBodyEl().querySelector('form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void submit();
    });
    if (focus) form?.querySelector<HTMLInputElement>('input[name="label"]')?.focus();
  };
  bindForm();

  async function submit(): Promise<void> {
    if (busy || created) return;
    const body = modal.getBodyEl();
    values.label = (body.querySelector<HTMLInputElement>('input[name="label"]')?.value || '').trim();
    values.identifier = (body.querySelector<HTMLInputElement>('input[name="identifier"]')?.value || '').trim();

    const missing = !values.label ? 'label' : !values.identifier ? 'identifier' : null;
    if (missing) {
      modal.setBodyHtml(formHtml(domain, values, missing === 'label' ? 'Informe a etiqueta.' : 'Informe o identificador.'));
      bindForm(false);
      const input = body.querySelector<HTMLInputElement>(`input[name="${missing}"]`);
      input?.setAttribute('aria-invalid', 'true');
      input?.focus();
      return;
    }

    busy = true;
    modal.setButton('create', { disabled: true, label: 'Criando…' });
    modal.setButton('cancel', { disabled: true });
    body.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.disabled = true));

    try {
      created = await createManualDevice({ ...params, label: values.label, identifier: values.identifier });
      modal.setBodyHtml(successHtml(domain, created, !!params.showTechnicalDetails));
      modal.setButton('cancel', { hidden: true });
      modal.setButton('create', { disabled: false, label: 'Concluir' });
    } catch (err) {
      const msg = err instanceof ManualDeviceError ? err.message : 'Não foi possível criar o dispositivo.';
      const detail = params.showTechnicalDetails
        ? (err instanceof ManualDeviceError ? err.detail : String((err as Error)?.message || err)) || undefined
        : undefined;
      modal.setBodyHtml(formHtml(domain, values, msg, detail));
      bindForm();
      modal.setButton('create', { disabled: false, label: 'Criar' });
      modal.setButton('cancel', { disabled: false });
    } finally {
      busy = false;
    }
  }

  return modal;
}

/**
 * RFC-0240: formulário → "Revisar" (plano por sistema, nada gravado) → "Criar" (progresso
 * passo a passo) → resultado. O host decide a ordem, as chamadas e o rollback.
 */
function openProvisionedModal(params: OpenManualDeviceModalParams, provisioner: ManualDeviceProvisioner): StandardModalInstance {
  const domain = params.domain;
  const values = { label: '', identifier: '' };
  let phase: 'form' | 'planning' | 'plan' | 'applying' | 'done' = 'form';
  let plan: ManualProvisionPlan | null = null;
  let outcome: ManualProvisionResult | null = null;

  const modal = openStandardModal({
    title: DOMAIN_TEXT[domain].title,
    icon: DOMAIN_TEXT[domain].icon,
    bodyHtml: formHtml(domain, values),
    width: 560,
    container: params.container,
    buttons: [
      { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
      { label: 'Voltar', value: 'back', variant: 'secondary', closeOnClick: false },
      { label: 'Revisar', value: 'next', variant: 'primary', closeOnClick: false },
    ],
    onButton: (v) => {
      if (v === 'back' && phase === 'plan') return showForm();
      if (v !== 'next') return;
      if (phase === 'form') return void review();
      if (phase === 'plan') return void apply();
      if (phase === 'done') {
        modal.close();
        if (outcome?.result) params.onCreated?.(outcome.result);
      }
    },
  });
  modal.setButton('back', { hidden: true });

  const bindForm = (focus = true) => {
    const form = modal.getBodyEl().querySelector('form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      void review();
    });
    if (focus) form?.querySelector<HTMLInputElement>('input[name="label"]')?.focus();
  };
  bindForm();

  function showForm(error?: string, detail?: string): void {
    phase = 'form';
    modal.setBodyHtml(formHtml(domain, values, error, detail));
    bindForm();
    modal.setButton('back', { hidden: true });
    modal.setButton('cancel', { disabled: false, hidden: false });
    modal.setButton('next', { disabled: false, label: 'Revisar' });
  }

  const errorText = (err: unknown) => {
    const msg = err instanceof ManualDeviceError ? err.message : 'Não foi possível montar o plano.';
    const detail = params.showTechnicalDetails
      ? (err instanceof ManualDeviceError ? err.detail : String((err as Error)?.message || err)) || undefined
      : undefined;
    return { msg, detail };
  };

  async function review(): Promise<void> {
    if (phase !== 'form') return;
    const body = modal.getBodyEl();
    values.label = (body.querySelector<HTMLInputElement>('input[name="label"]')?.value || '').trim();
    values.identifier = (body.querySelector<HTMLInputElement>('input[name="identifier"]')?.value || '').trim();
    const missing = !values.label ? 'label' : !values.identifier ? 'identifier' : null;
    if (missing) {
      showForm(missing === 'label' ? 'Informe a etiqueta.' : 'Informe o identificador.');
      const input = modal.getBodyEl().querySelector<HTMLInputElement>(`input[name="${missing}"]`);
      input?.setAttribute('aria-invalid', 'true');
      input?.focus();
      return;
    }

    phase = 'planning';
    modal.setButton('next', { disabled: true, label: 'Revisando…' });
    body.querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.disabled = true));
    try {
      plan = await provisioner.plan({ domain, label: values.label, identifier: values.identifier });
      phase = 'plan';
      modal.setBodyHtml(planHtml(plan));
      modal.setButton('back', { hidden: false, disabled: false });
      modal.setButton('next', { disabled: !!plan.blockers?.length, label: 'Criar' });
    } catch (err) {
      const { msg, detail } = errorText(err);
      showForm(msg, detail);
    }
  }

  async function apply(): Promise<void> {
    if (phase !== 'plan' || !plan || plan.blockers?.length) return;
    phase = 'applying';
    const steps = plan.steps.map((s) => ({ ...s }));
    modal.setBodyHtml(progressHtml(steps));
    modal.setButton('back', { hidden: true });
    modal.setButton('cancel', { hidden: true });
    modal.setButton('next', { disabled: true, label: 'Criando…' });

    // Mantém o "Ver mais detalhes" como o usuário deixou entre um passo e outro
    const moreOpen = () => !!modal.getBodyEl().querySelector<HTMLDetailsElement>('.myio-manualdev__more')?.open;
    const onStep = (step: ManualProvisionStep) => {
      const i = steps.findIndex((s) => s.key === step.key);
      if (i >= 0) steps[i] = { ...steps[i], ...step };
      else steps.push(step);
      modal.setBodyHtml(progressHtml(steps, undefined, undefined, moreOpen()));
    };

    try {
      outcome = await provisioner.apply(plan, onStep);
    } catch (err) {
      outcome = { ok: false, steps, message: errorText(err).msg };
    }
    phase = 'done';
    const finalSteps = outcome.steps?.length ? outcome.steps : steps;
    const clean = outcome.ok && finalSteps.every((s) => s.status === 'ok');
    modal.setBodyHtml(
      clean && outcome.result
        ? successHtml(domain, outcome.result, !!params.showTechnicalDetails) +
            (params.showTechnicalDetails ? moreHtml(stepsHtml(finalSteps)) : '')
        : progressHtml(finalSteps, outcome.message, outcome.ok, true) // algo deu errado: já mostra os passos
    );
    modal.setButton('next', { disabled: false, label: outcome.ok ? 'Concluir' : 'Fechar' });
  }

  return modal;
}

export { manualDeviceName };
