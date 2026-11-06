/**
 * Aba "Equipamentos da Retrolavagem" do SettingsModal — device HIDROMETRO_ENTRADA_RETROLAVAGEM.
 *
 * A retrolavagem é virtual: o MAIN_VIEW calcula Σ entradas − Σ saídas. Esta aba escolhe quais
 * hidrômetros entram em cada lado (até 5 + 5) e grava o JSON `retrolavagemBindings` no
 * atributo SERVER_SCOPE do próprio device. Sem vínculos, o MAIN_VIEW usa a conta antiga
 * (Entrada − consumidores). O mesmo hidrômetro pode ser usado em outras retrolavagens.
 *
 * Mesmo padrão da WellEquipmentTab (catálogo = devices do customer filtrados por deviceProfile).
 */

export const RETROLAVAGEM_PROFILE = 'HIDROMETRO_ENTRADA_RETROLAVAGEM';
export const RETROLAVAGEM_BINDINGS_KEY = 'retrolavagemBindings';
export const MAX_RETROLAVAGEM_DEVICES_PER_SIDE = 5;

export interface RetrolavagemTabConfig {
  container: HTMLElement;
  deviceId: string;
  customerId: string;
  jwtToken: string;
  tbBaseUrl: string;
}

export interface RetrolavagemDeviceRef {
  tbId: string;
  label: string;
  gcdrId?: string;
}

export interface RetrolavagemBindings {
  version: 1;
  inputs: RetrolavagemDeviceRef[];
  outputs: RetrolavagemDeviceRef[];
}

type Side = 'inputs' | 'outputs';

interface HydrometerOption {
  tbId: string;
  label: string;
  profile: string;
  gcdrId?: string;
}

interface TbDevice {
  id?: { id?: string } | string;
  name?: string;
  label?: string;
}

interface TbAttribute {
  key: string;
  value: unknown;
}

const MAX_CUSTOMER_DEVICE_PAGES = 100;
const SIDE_TEXT: Record<Side, { title: string; add: string; hint: string }> = {
  inputs: { title: 'Entrada', add: '+ Adicionar entrada', hint: 'Hidrômetros que medem a água que entra na retrolavagem.' },
  outputs: { title: 'Saída', add: '+ Adicionar saída', hint: 'Hidrômetros que medem a água que sai da retrolavagem.' },
};

/** Hidrômetros elegíveis: qualquer HIDROMETRO*, exceto a própria retrolavagem e os *_MANUAL. */
export function isRetrolavagemCandidateProfile(profile: string): boolean {
  const p = String(profile || '').trim().toUpperCase();
  return p.startsWith('HIDROMETRO') && p !== RETROLAVAGEM_PROFILE && !p.endsWith('_MANUAL');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string);
}

/** JSON do atributo (string ou objeto) → vínculos válidos; refs sem tbId e duplicadas caem fora. */
export function normalizeRetrolavagemBindings(value: unknown): RetrolavagemBindings {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  const raw = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const side = (items: unknown): RetrolavagemDeviceRef[] =>
    (Array.isArray(items) ? items : [])
      .filter((item): item is RetrolavagemDeviceRef =>
        !!item && typeof item === 'object' && typeof (item as RetrolavagemDeviceRef).tbId === 'string' && !!(item as RetrolavagemDeviceRef).tbId)
      .filter((item) => (seen.has(item.tbId) ? false : (seen.add(item.tbId), true)))
      .slice(0, MAX_RETROLAVAGEM_DEVICES_PER_SIDE)
      .map((item) => ({
        tbId: item.tbId,
        label: String(item.label || item.tbId),
        ...(item.gcdrId ? { gcdrId: String(item.gcdrId) } : {}),
      }));
  const inputs = side(raw.inputs);
  const outputs = side(raw.outputs);
  return { version: 1, inputs, outputs };
}

export class RetrolavagemTab {
  private readonly config: RetrolavagemTabConfig;
  private catalog: HydrometerOption[] = [];
  private bindings: RetrolavagemBindings = { version: 1, inputs: [], outputs: [] };
  /** Linhas na tela (tbId '' = linha vazia ainda sem device escolhido) */
  private rows: Record<Side, string[]> = { inputs: [], outputs: [] };
  private loaded = false;
  private catalogWarnings = 0;

  constructor(config: RetrolavagemTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.config.container.innerHTML = '<p class="rlt-state">Carregando vínculos e hidrômetros…</p>';
    try {
      const [attributes, catalog] = await Promise.all([
        this.fetchAttributes(this.config.deviceId, RETROLAVAGEM_BINDINGS_KEY),
        this.fetchCatalog(),
      ]);
      this.bindings = normalizeRetrolavagemBindings(attributes.get(RETROLAVAGEM_BINDINGS_KEY));
      this.catalog = catalog;
      this.rows = { inputs: this.bindings.inputs.map((d) => d.tbId), outputs: this.bindings.outputs.map((d) => d.tbId) };
      this.loaded = true;
      this.render();
      if (this.catalogWarnings > 0) {
        this.showMessage(`${this.catalogWarnings} hidrômetro(s) não puderam ser verificados e foram omitidos da lista.`, true);
      }
    } catch (error) {
      this.config.container.innerHTML = `<p class="rlt-state rlt-error" role="alert">Não foi possível carregar os vínculos ou a lista de hidrômetros: ${escapeHtml(
        this.errorMessage(error)
      )}</p>`;
    }
  }

  destroy(): void {
    // Listeners ficam no container, que sai junto com o modal.
  }

  private headers(): Record<string, string> {
    return { 'X-Authorization': `Bearer ${this.config.jwtToken}`, 'Content-Type': 'application/json' };
  }

  private async fetchAttributes(deviceId: string, keys: string): Promise<Map<string, unknown>> {
    const url = `${this.config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/attributes/SERVER_SCOPE?keys=${encodeURIComponent(keys)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = (await response.json()) as TbAttribute[];
    if (!Array.isArray(raw)) throw new Error('Resposta de atributos inválida');
    return new Map(raw.map(({ key, value }) => [key, value]));
  }

  private async fetchCatalog(): Promise<HydrometerOption[]> {
    if (!this.config.customerId) throw new Error('customerId indisponível');
    const devices: TbDevice[] = [];
    let page = 0;
    let hasNext = true;
    while (hasNext) {
      if (page >= MAX_CUSTOMER_DEVICE_PAGES) throw new Error(`Lista excede o limite de ${MAX_CUSTOMER_DEVICE_PAGES} páginas`);
      const query = new URLSearchParams({ pageSize: '1000', page: String(page) });
      const response = await fetch(
        `${this.config.tbBaseUrl}/api/customer/${encodeURIComponent(this.config.customerId)}/devices?${query}`,
        { headers: this.headers() }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as { data?: TbDevice[]; hasNext?: boolean };
      if (!Array.isArray(result.data)) throw new Error('Resposta de dispositivos inválida');
      if (result.hasNext === true && result.data.length === 0) throw new Error('Paginação da lista não avançou');
      devices.push(...result.data);
      hasNext = result.hasNext === true;
      page += 1;
    }

    const queue = devices
      .map((device) => ({ device, tbId: typeof device.id === 'string' ? device.id : device.id?.id }))
      .filter((item): item is { device: TbDevice; tbId: string } => !!item.tbId && item.tbId !== this.config.deviceId);
    const matching: HydrometerOption[] = [];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        try {
          const attributes = await this.fetchAttributes(item.tbId, 'deviceProfile,gcdrDeviceId');
          const profile = String(attributes.get('deviceProfile') || '').toUpperCase();
          if (!isRetrolavagemCandidateProfile(profile)) continue;
          matching.push({
            tbId: item.tbId,
            label: String(item.device.label || item.device.name || item.tbId),
            profile,
            ...(attributes.get('gcdrDeviceId') != null ? { gcdrId: String(attributes.get('gcdrDeviceId')) } : {}),
          });
        } catch (error) {
          this.catalogWarnings += 1;
          console.warn(`[RetrolavagemTab] Falha ao ler atributos do hidrômetro ${item.tbId}:`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, Math.max(1, queue.length)) }, () => worker()));
    return matching.sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Vínculo salvo que não está mais no catálogo (device apagado, perfil mudou, sem acesso). */
  private storedRef(tbId: string): RetrolavagemDeviceRef | undefined {
    return [...this.bindings.inputs, ...this.bindings.outputs].find((d) => d.tbId === tbId);
  }

  private sideHtml(side: Side): string {
    const text = SIDE_TEXT[side];
    const rows = this.rows[side];
    const full = rows.length >= MAX_RETROLAVAGEM_DEVICES_PER_SIDE;
    const options = (current: string) => {
      const missing =
        current && !this.catalog.some((o) => o.tbId === current)
          ? `<option value="${escapeHtml(current)}" selected data-unavailable="true">Vínculo atual indisponível — ${escapeHtml(
              this.storedRef(current)?.label || current
            )}</option>`
          : '';
      return `<option value="">Selecione…</option>${missing}${this.catalog
        .map(
          (o) =>
            `<option value="${escapeHtml(o.tbId)}"${o.tbId === current ? ' selected' : ''}>${escapeHtml(o.label)} · ${escapeHtml(o.profile)}</option>`
        )
        .join('')}`;
    };
    return `
      <fieldset class="rlt-side" data-side="${side}">
        <legend>${text.title} <span class="rlt-count">${rows.length}/${MAX_RETROLAVAGEM_DEVICES_PER_SIDE}</span></legend>
        <p class="rlt-hint">${text.hint}</p>
        ${
          rows.length
            ? rows
                .map(
                  (tbId, i) => `<div class="rlt-row">
                    <select data-side="${side}" data-index="${i}" aria-label="${text.title} ${i + 1}">${options(tbId)}</select>
                    <button type="button" class="rlt-remove" data-remove="${side}" data-index="${i}" aria-label="Remover ${text.title} ${i + 1}">✕</button>
                  </div>`
                )
                .join('')
            : `<p class="rlt-empty">Nenhum hidrômetro de ${text.title.toLowerCase()}.</p>`
        }
        <button type="button" class="rlt-add" data-add="${side}" ${full ? 'disabled' : ''}>${text.add}</button>
      </fieldset>`;
  }

  private render(): void {
    const noConfig = !this.rows.inputs.length && !this.rows.outputs.length;
    this.config.container.innerHTML = `
      <section class="rlt-tab">
        <p>Escolha os hidrômetros de entrada e de saída. A retrolavagem passa a ser <strong>total de entrada − total de saída</strong>
        no período. O mesmo hidrômetro pode ser usado em outras retrolavagens.</p>
        ${
          noConfig
            ? '<p class="rlt-note">Sem vínculos, o painel usa a conta automática: entrada do shopping − consumo de lojas e área comum.</p>'
            : ''
        }
        <div class="rlt-grid">${this.sideHtml('inputs')}${this.sideHtml('outputs')}</div>
        <p id="rlt-message" class="rlt-message" role="status" aria-live="polite"></p>
        <button type="button" id="rlt-save" ${this.loaded ? '' : 'disabled'}>Salvar vínculos</button>
      </section>
      <style>
        .rlt-tab{padding:24px;color:#374151}.rlt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:12px}
        .rlt-side{border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin:0}.rlt-side legend{font-weight:700;padding:0 6px}
        .rlt-count{font-weight:500;color:#6b7280;font-size:12px}.rlt-hint,.rlt-empty,.rlt-note{margin:0 0 10px;font-size:13px;color:#6b7280}
        .rlt-note{background:#f1ecfa;color:#3e1a7d;border-radius:6px;padding:8px 10px}
        .rlt-row{display:flex;gap:8px;margin-bottom:8px}.rlt-row select{flex:1;min-width:0;min-height:36px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff}
        .rlt-remove{border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:0 10px;cursor:pointer;color:#6b7280}
        .rlt-add{border:1px dashed #9ca3af;background:#fff;border-radius:6px;padding:7px 12px;cursor:pointer;color:#374151;font-weight:600}
        .rlt-add:disabled{opacity:.5;cursor:not-allowed}
        #rlt-save{margin-top:18px;padding:9px 16px;border:0;border-radius:6px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}
        #rlt-save:disabled{opacity:.6;cursor:wait}.rlt-message{min-height:20px;margin:12px 0 0}.rlt-message.rlt-error,.rlt-error{color:#b91c1c}
        .rlt-message.rlt-success{color:#15803d}.rlt-state{text-align:center;padding:30px;color:#6b7280}
      </style>`;

    const c = this.config.container;
    c.querySelectorAll<HTMLSelectElement>('select[data-side]').forEach((select) => {
      select.addEventListener('change', () => {
        this.rows[select.dataset.side as Side][Number(select.dataset.index)] = select.value;
        this.showMessage('');
      });
    });
    c.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.add as Side;
        if (this.rows[side].length >= MAX_RETROLAVAGEM_DEVICES_PER_SIDE) return;
        this.rows[side].push('');
        this.render();
      });
    });
    c.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.rows[btn.dataset.remove as Side].splice(Number(btn.dataset.index), 1);
        this.render();
      });
    });
    c.querySelector<HTMLButtonElement>('#rlt-save')?.addEventListener('click', () => {
      void this.save();
    });
  }

  /** Linhas da tela → vínculos, ou a mensagem do primeiro problema encontrado. */
  private buildBindings(): RetrolavagemBindings | string {
    const known = (tbId: string) => this.catalog.find((o) => o.tbId === tbId);
    const seen = new Map<string, Side>();
    const out: RetrolavagemBindings = { version: 1, inputs: [], outputs: [] };
    for (const side of ['inputs', 'outputs'] as Side[]) {
      const ids = this.rows[side].filter(Boolean);
      if (ids.length > MAX_RETROLAVAGEM_DEVICES_PER_SIDE) {
        return `No máximo ${MAX_RETROLAVAGEM_DEVICES_PER_SIDE} hidrômetros de ${SIDE_TEXT[side].title.toLowerCase()}.`;
      }
      for (const tbId of ids) {
        const option = known(tbId);
        const stored = this.storedRef(tbId);
        const name = option?.label || stored?.label || tbId;
        if (seen.has(tbId)) {
          return seen.get(tbId) === side
            ? `${name} aparece duas vezes em ${SIDE_TEXT[side].title}.`
            : `${name} não pode estar na entrada e na saída ao mesmo tempo.`;
        }
        // vínculo salvo e indisponível pode ser mantido como está; device novo tem que estar na lista
        if (!option && !stored) return `${name} não é um hidrômetro válido deste cliente.`;
        seen.set(tbId, side);
        const gcdrId = option?.gcdrId || stored?.gcdrId;
        out[side].push({ tbId, label: name, ...(gcdrId ? { gcdrId } : {}) });
      }
    }
    return out;
  }

  private async save(): Promise<void> {
    const button = this.config.container.querySelector<HTMLButtonElement>('#rlt-save');
    if (!this.loaded || !button) return;
    const bindings = this.buildBindings();
    if (typeof bindings === 'string') {
      this.showMessage(bindings, true);
      return;
    }
    if (bindings.inputs.length && !bindings.outputs.length) {
      // permitido (saída zero), mas raro: avisa sem bloquear
      this.showMessage('Atenção: sem hidrômetro de saída, a retrolavagem fica igual ao total de entrada.');
    }
    button.disabled = true;
    button.textContent = 'Salvando…';
    try {
      const response = await fetch(
        `${this.config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${encodeURIComponent(this.config.deviceId)}/attributes/SERVER_SCOPE`,
        { method: 'POST', headers: this.headers(), body: JSON.stringify({ [RETROLAVAGEM_BINDINGS_KEY]: bindings }) }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.bindings = bindings;
      this.rows = { inputs: bindings.inputs.map((d) => d.tbId), outputs: bindings.outputs.map((d) => d.tbId) };
      this.render();
      this.showMessage('Vínculos salvos. O painel recalcula a retrolavagem na próxima atualização dos dados.', false, true);
    } catch (error) {
      this.showMessage(`Falha ao salvar os vínculos: ${this.errorMessage(error)}`, true);
      const b = this.config.container.querySelector<HTMLButtonElement>('#rlt-save');
      if (b) {
        b.disabled = false;
        b.textContent = 'Salvar vínculos';
      }
    }
  }

  private showMessage(message: string, isError = false, isSuccess = false): void {
    const element = this.config.container.querySelector<HTMLElement>('#rlt-message');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('rlt-error', isError);
    element.classList.toggle('rlt-success', isSuccess);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
