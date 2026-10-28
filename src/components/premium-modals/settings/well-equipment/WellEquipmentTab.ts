export interface WellEquipmentTabConfig {
  container: HTMLElement;
  deviceId: string;
  deviceProfile: string;
  customerId: string;
  jwtToken: string;
  tbBaseUrl: string;
}

export interface WellEquipmentBinding {
  tbId: string;
  gcdrId?: string;
  code: 'B1' | 'B2' | 'S';
  label: string;
  thresholdW?: number;
}

export interface WellEquipmentBindings {
  pumps: WellEquipmentBinding[];
  valves: WellEquipmentBinding[];
}

interface EquipmentOption {
  tbId: string;
  profile: 'BOMBA_POCO' | 'BOMBA_CISTERNA' | 'SOLENOIDE';
  label: string;
  gcdrId?: string;
}

/** BOMBA_POCO e BOMBA_CISTERNA têm o mesmo comportamento: ambos servem para B1/B2. */
const PUMP_EQUIPMENT_PROFILES = new Set<string>(['BOMBA_POCO', 'BOMBA_CISTERNA']);
type EquipmentKind = 'pump' | 'valve';
const kindOf = (profile: string): EquipmentKind => (PUMP_EQUIPMENT_PROFILES.has(profile) ? 'pump' : 'valve');

interface TbDevice {
  id?: { id?: string } | string;
  name?: string;
  label?: string;
}

interface TbAttribute {
  key: string;
  value: unknown;
}

const PUMP_PROFILES = new Set(['CISTERNA', 'CISTERNA_ENTRADA']);
const ATTRIBUTE_KEYS = 'deviceProfile,gcdrDeviceId,pumpBindings';
const MAX_CUSTOMER_DEVICE_PAGES = 100;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string);
}

function normalizeBindings(value: unknown): WellEquipmentBindings {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const bindings = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  const valid = (items: unknown, codes: Set<string>) => (Array.isArray(items) ? items : [])
    .filter((item): item is WellEquipmentBinding =>
      !!item && typeof item === 'object' &&
      typeof (item as WellEquipmentBinding).tbId === 'string' &&
      codes.has((item as WellEquipmentBinding).code))
    .map((item) => ({ ...item }));
  return {
    pumps: valid(bindings.pumps, new Set(['B1', 'B2'])),
    valves: valid(bindings.valves, new Set(['S'])),
  };
}

export class WellEquipmentTab {
  private readonly config: WellEquipmentTabConfig;
  private equipment: EquipmentOption[] = [];
  private bindings: WellEquipmentBindings = { pumps: [], valves: [] };
  private loaded = false;
  private catalogWarnings = 0;

  constructor(config: WellEquipmentTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.config.container.innerHTML = '<p class="wet-state">Carregando vínculos e equipamentos…</p>';
    try {
      const [wellAttributes, equipment] = await Promise.all([
        this.fetchAttributes(this.config.deviceId, 'pumpBindings'),
        this.fetchEquipment(),
      ]);
      const stored = wellAttributes.get('pumpBindings');
      this.bindings = stored == null ? { pumps: [], valves: [] } : normalizeBindings(stored);
      this.equipment = equipment;
      this.loaded = true;
      this.render();
      if (this.catalogWarnings > 0) {
        this.showMessage(
          `${this.catalogWarnings} equipamento(s) não puderam ser verificados e foram omitidos do catálogo.`,
          true,
        );
      }
    } catch (error) {
      this.config.container.innerHTML =
        `<p class="wet-state wet-error" role="alert">Não foi possível carregar os vínculos ou o catálogo de equipamentos: ${escapeHtml(this.errorMessage(error))}</p>`;
    }
  }

  destroy(): void {
    // All listeners are scoped to the container, which is removed with the modal.
  }

  private headers(): Record<string, string> {
    return {
      'X-Authorization': `Bearer ${this.config.jwtToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchAttributes(deviceId: string, keys: string): Promise<Map<string, unknown>> {
    const url = `${this.config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/attributes/SERVER_SCOPE?keys=${encodeURIComponent(keys)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json() as TbAttribute[];
    if (!Array.isArray(raw)) throw new Error('Resposta de atributos inválida');
    return new Map(raw.map(({ key, value }) => [key, value]));
  }

  private async fetchEquipment(): Promise<EquipmentOption[]> {
    if (!this.config.customerId) throw new Error('customerId indisponível');

    const devices: TbDevice[] = [];
    let page = 0;
    let hasNext = true;
    while (hasNext) {
      if (page >= MAX_CUSTOMER_DEVICE_PAGES) {
        throw new Error(`Catálogo excede o limite de ${MAX_CUSTOMER_DEVICE_PAGES} páginas`);
      }
      const query = new URLSearchParams({ pageSize: '1000', page: String(page) });
      const url = `${this.config.tbBaseUrl}/api/customer/${encodeURIComponent(this.config.customerId)}/devices?${query}`;
      const response = await fetch(url, { headers: this.headers() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json() as { data?: TbDevice[]; hasNext?: boolean };
      if (!Array.isArray(result.data)) throw new Error('Resposta de equipamentos inválida');
      if (result.hasNext === true && result.data.length === 0) {
        throw new Error('Paginação do catálogo não avançou');
      }
      devices.push(...result.data);
      hasNext = result.hasNext === true;
      page += 1;
    }

    const candidates = devices.map((device) => ({
      device,
      tbId: typeof device.id === 'string' ? device.id : device.id?.id,
    })).filter((item): item is { device: TbDevice; tbId: string } => !!item.tbId);
    const queue = [...candidates];
    const matching: EquipmentOption[] = [];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        try {
          const attributes = await this.fetchAttributes(item.tbId, ATTRIBUTE_KEYS);
          const profile = String(attributes.get('deviceProfile') || '').toUpperCase();
          if (!PUMP_EQUIPMENT_PROFILES.has(profile) && profile !== 'SOLENOIDE') continue;
          matching.push({
            tbId: item.tbId,
            profile: profile as EquipmentOption['profile'],
            label: String(item.device.label || item.device.name || item.tbId),
            gcdrId: attributes.get('gcdrDeviceId') == null ? undefined : String(attributes.get('gcdrDeviceId')),
          });
        } catch (error) {
          this.catalogWarnings += 1;
          console.warn(`[WellEquipmentTab] Falha ao ler atributos do equipamento ${item.tbId}:`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, Math.max(1, queue.length)) }, () => worker()));
    return matching.sort((a, b) => a.label.localeCompare(b.label));
  }

  private render(): void {
    const options = (kind: EquipmentKind, code: 'B1' | 'B2' | 'S', existing?: WellEquipmentBinding) => {
      const eligible = this.equipment.filter((item) => kindOf(item.profile) === kind);
      const missing = existing && !eligible.some((item) => item.tbId === existing.tbId)
        ? `<option value="${escapeHtml(existing.tbId)}" selected data-unavailable="true">Vínculo atual indisponível — ${escapeHtml(existing.label)}</option>`
        : '';
      const items = eligible.map((item) =>
        `<option value="${escapeHtml(item.tbId)}"${item.tbId === existing?.tbId ? ' selected' : ''}>${escapeHtml(item.label)}</option>`
      ).join('');
      return `<select id="wet-${code.toLowerCase()}-device" data-slot="${code}" aria-label="Equipamento ${code}">
        <option value="">Nenhum</option>${missing}${items}
      </select>`;
    };
    const binding = (items: WellEquipmentBinding[], code: WellEquipmentBinding['code']) => items.find((item) => item.code === code);
    const labelInput = (code: string, existing?: WellEquipmentBinding) =>
      `<input id="wet-${code.toLowerCase()}-label" data-label="${code}" aria-label="Rótulo ${code}" value="${escapeHtml(existing?.label || '')}" placeholder="Rótulo opcional">`;

    this.config.container.innerHTML = `
      <section class="wet-tab">
        <p>Configure as bombas e o solenoide associados a este poço. O mesmo equipamento pode ser usado em outros poços.</p>
        <div class="wet-grid">
          <label for="wet-b1-device">Bomba B1</label>${options('pump', 'B1', binding(this.bindings.pumps, 'B1'))}${labelInput('B1', binding(this.bindings.pumps, 'B1'))}
          <label for="wet-b2-device">Bomba B2</label>${options('pump', 'B2', binding(this.bindings.pumps, 'B2'))}${labelInput('B2', binding(this.bindings.pumps, 'B2'))}
          <label for="wet-s-device">Solenoide S</label>${options('valve', 'S', binding(this.bindings.valves, 'S'))}${labelInput('S', binding(this.bindings.valves, 'S'))}
        </div>
        <p id="wet-message" class="wet-message" role="status" aria-live="polite"></p>
        <button type="button" id="wet-save" ${this.loaded ? '' : 'disabled'}>Salvar vínculos</button>
      </section>
      <style>
        .wet-tab{padding:24px;color:#374151}.wet-grid{display:grid;grid-template-columns:130px minmax(180px,1fr) minmax(180px,1fr);gap:12px;align-items:center}
        .wet-grid label{font-weight:600}.wet-grid select,.wet-grid input{box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;background:white}
        #wet-save{margin-top:18px;padding:9px 16px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:600;cursor:pointer}
        #wet-save:disabled{opacity:.6;cursor:wait}.wet-message{min-height:20px;margin:12px 0 0}.wet-message.wet-error,.wet-error{color:#b91c1c}.wet-message.wet-success{color:#15803d}.wet-state{text-align:center;padding:30px;color:#6b7280}
      </style>`;

    this.config.container.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach((select) => {
      select.addEventListener('change', () => {
        const slot = select.dataset.slot || '';
        const selected = this.equipment.find((item) => item.tbId === select.value);
        const label = this.config.container.querySelector<HTMLInputElement>(`[data-label="${slot}"]`);
        if (label && selected) label.value = selected.label;
        if (label && !selected) label.value = '';
        this.showMessage('');
      });
    });
    this.config.container.querySelector<HTMLButtonElement>('#wet-save')?.addEventListener('click', () => {
      void this.save();
    });
  }

  private async save(): Promise<void> {
    const container = this.config.container;
    const saveButton = container.querySelector<HTMLButtonElement>('#wet-save');
    if (!this.loaded || !saveButton) return;

    const b1 = container.querySelector<HTMLSelectElement>('#wet-b1-device')?.value || '';
    const b2 = container.querySelector<HTMLSelectElement>('#wet-b2-device')?.value || '';
    const solenoid = container.querySelector<HTMLSelectElement>('#wet-s-device')?.value || '';
    if (b1 && b1 === b2) {
      this.showMessage('Selecione bombas diferentes para B1 e B2.', true);
      return;
    }

    const selected: Array<{ id: string; kind: EquipmentKind; code: WellEquipmentBinding['code'] }> = [
      ...(b1 ? [{ id: b1, kind: 'pump' as const, code: 'B1' as const }] : []),
      ...(b2 ? [{ id: b2, kind: 'pump' as const, code: 'B2' as const }] : []),
      ...(solenoid ? [{ id: solenoid, kind: 'valve' as const, code: 'S' as const }] : []),
    ];
    for (const item of selected) {
      const current = item.code === 'S'
        ? this.bindings.valves.find((binding) => binding.code === item.code)
        : this.bindings.pumps.find((binding) => binding.code === item.code);
      const unchangedUnavailableBinding = current?.tbId === item.id &&
        !this.equipment.some((equipment) => equipment.tbId === item.id);
      if (!unchangedUnavailableBinding &&
          !this.equipment.some((equipment) => equipment.tbId === item.id && kindOf(equipment.profile) === item.kind)) {
        this.showMessage(`O equipamento selecionado para ${item.code} não pertence ao catálogo válido.`, true);
        return;
      }
    }

    const oldBinding = (code: WellEquipmentBinding['code']) =>
      code === 'S' ? this.bindings.valves.find((item) => item.code === code) : this.bindings.pumps.find((item) => item.code === code);
    const createBinding = (id: string, code: WellEquipmentBinding['code']): WellEquipmentBinding | null => {
      if (!id) return null;
      const current = oldBinding(code);
      const equipment = this.equipment.find((item) => item.tbId === id);
      const label = container.querySelector<HTMLInputElement>(`[data-label="${code}"]`)?.value.trim() || equipment?.label || current?.label || id;
      return {
        tbId: id,
        ...(equipment?.gcdrId || (current?.tbId === id ? current.gcdrId : undefined)
          ? { gcdrId: equipment?.gcdrId || current?.gcdrId }
          : {}),
        code,
        label,
        ...(code !== 'S' && current?.tbId === id && current.thresholdW !== undefined
          ? { thresholdW: current.thresholdW }
          : {}),
      };
    };
    const bindings: WellEquipmentBindings = {
      pumps: [createBinding(b1, 'B1'), createBinding(b2, 'B2')].filter((item): item is WellEquipmentBinding => !!item),
      valves: [createBinding(solenoid, 'S')].filter((item): item is WellEquipmentBinding => !!item),
    };

    saveButton.disabled = true;
    saveButton.textContent = 'Salvando…';
    this.showMessage('');
    try {
      const response = await fetch(
        `${this.config.tbBaseUrl}/api/plugins/telemetry/DEVICE/${encodeURIComponent(this.config.deviceId)}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ pumpBindings: bindings }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.bindings = bindings;
      this.render();
      this.showMessage('Vínculos salvos com sucesso.', false, true);
    } catch (error) {
      this.showMessage(`Falha ao salvar os vínculos: ${this.errorMessage(error)}`, true);
    } finally {
      const button = container.querySelector<HTMLButtonElement>('#wet-save');
      if (button) {
        button.disabled = false;
        button.textContent = 'Salvar vínculos';
      }
    }
  }

  private showMessage(message: string, isError = false, isSuccess = false): void {
    const element = this.config.container.querySelector<HTMLElement>('#wet-message');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('wet-error', isError);
    element.classList.toggle('wet-success', isSuccess);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
