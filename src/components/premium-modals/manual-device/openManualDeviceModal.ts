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

export interface OpenManualDeviceModalParams extends Omit<CreateManualDeviceParams, 'label' | 'identifier'> {
  /** Usuário MyIO: mostra detalhes técnicos (nome do device, profile, asset, erro bruto) */
  showTechnicalDetails?: boolean;
  /** Chamado após criar com sucesso (ex.: recarregar o dashboard) */
  onCreated?: (result: CreateManualDeviceResult) => void;
  container?: HTMLElement;
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

export function openManualDeviceModal(params: OpenManualDeviceModalParams): StandardModalInstance {
  const domain = params.domain;
  if (!MANUAL_DEVICE_PROFILES[domain]) throw new Error(`[openManualDeviceModal] domínio inválido: ${domain}`);
  injectStyles();

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

export { manualDeviceName };
