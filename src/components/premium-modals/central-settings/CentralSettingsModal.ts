/**
 * CentralSettingsModal — literally `extends SettingsModalView`
 * (`src/components/premium-modals/settings/SettingsModalView.ts`, the device
 * settings modal), per explicit direction: "CentralSettingsModal deve
 * estender SettingsModalView e vou pensando em customizações depois."
 *
 * What this buys today: the full device-modal shell (header, tabs, theme
 * toggle, focus trap, identity card, Anotações/Alarmes/Chamados tabs) for
 * free. Central/gateway identity+telemetry was ALSO added directly to
 * `SettingsModalView.ts` (its first real edit — everything else here is pure
 * subclass injection) — gated behind `ModalConfig.isGateway`/`gatewayInfo`,
 * a real device never sets it, so this changes nothing for the device
 * settings modal. It renders the full read-only GCDR identity/telemetry
 * surface (`GET /api/v1/centrals/:id`: serialNumber, type, status,
 * connectionStatus, monitoringEnabled, lastGatewayCheck*, probeResult,
 * firmware/softwareVersion, frequency, stats{}, createdAt/updatedAt,
 * version) via `SettingsModalView.getGatewayInfoHTML()`, INLINE in the Geral
 * tab right after the identity card — not its own tab (an earlier revision
 * used a dedicated "Central" tab; folded back into Geral per explicit
 * follow-up: wanted the whole modal to open on one screen instead of forcing
 * a tab switch to see central-specific data). Connectivity health itself
 * (`connectionStatus`/last-check timestamps) reuses the SAME visual pattern
 * as a real device's "Informações de Conexão" card (`getConnectionInfoHTML()`)
 * — same classes, same status color-coding, same relative-time-ago style —
 * so a central's connectivity reads exactly like a device's, per explicit
 * follow-up wanting maximum visual parity. The editable v2
 * `deriveCentralConnectivity` calibration knobs (grace/blip/hard-offline —
 * the base has no concept of these either) are injected as a 5th
 * `.form-card` into the gateway-info grid (Identificação/Estatísticas/
 * Metadados) — everything central-specific lives in one place, in Geral.
 *
 * Still deferred (per the "customizações depois" instruction) — the base's
 * OTHER tabs/fields stay device-shaped:
 *   - "Andar"/"Identificador" fields (Geral tab) don't map to a central concept
 *   - Anotações/Alarmes read as generic device tabs, showing "não disponível"
 *     placeholders (no `jwtToken`/`gcdrDeviceId` wired — a central isn't
 *     GCDR-alarm-shaped the same way a device is)
 *   - keyboard focus-trap wrap-around may skip the injected Conectividade
 *     fields (`setupFocusTrap()` snapshots focusable elements before this
 *     class gets to inject them — a private base-class method, can't hook in)
 * See `showcase/central-status-card/README.md` §10 for the running list.
 *
 * Mechanics: `SettingsModalView`'s fields are `private`, so a subclass has no
 * access to `this.config`/`this.modal`/`this.form` — this class works around
 * that in two ways: (1) `render()` and `close()`/`showError()`/
 * `showLoadingState()` are all public, so they're legitimate override/call
 * points; (2) `onSave`/`onClose` are rebound by mutating the SAME config
 * object reference passed to `super()` — the base class stores it as
 * `this.config` internally (no clone), so a closure over `this` set on that
 * object AFTER `super()` returns is picked up correctly at click-time. The
 * Conectividade fieldset itself is injected via a plain
 * `document.querySelector` into the Geral tab's inline `.gateway-info-grid`
 * after `super.render()` mounts the DOM. That grid is a descendant of the
 * Geral tab's own `<form>`, so the base's own `getFormData()`
 * (`new FormData(this.form)`) already picks up these fields — no
 * `getFormData()` override needed (unlike when this content lived in a
 * separate, non-form-wrapped tab).
 */
import { SettingsModalView } from '../settings/SettingsModalView';
import type { ModalConfig, Domain, GatewayInfo, InterpolatedSlot } from '../settings/types';
import { validateCentralSettings, type CentralSettingsData, type CentralSettingsPersistResult } from './utils';

function escAttr(s: string): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

export interface CentralSettingsModalLabels {
  title?: string; // "Configurações — {name}"
  identitySection?: string;
  connectivitySection?: string;
  nameLabel?: string;
  uuidLabel?: string;
  hardwareIdLabel?: string;
  offlineGraceLabel?: string;
  blipToleranceLabel?: string;
  offlineHardLabel?: string;
  offlineHardHint?: string;
  save?: string;
  cancel?: string;
  saving?: string;
  loading?: string;
  fetchError?: string;
  retry?: string;
  saveError?: string;
}

export interface CentralSettingsModalParams {
  id: string;
  name: string;
  uuid?: string | null;
  hardwareId?: string | null;
  language?: 'pt' | 'en';
  theme?: 'light' | 'dark';
  container?: HTMLElement;
  labels?: CentralSettingsModalLabels;
  /** Pre-known current settings — when given, `onFetchSettings` is never called. */
  seed?: Partial<CentralSettingsData>;
  onFetchSettings?: (params: { id: string }) => Promise<CentralSettingsData>;
  onSaveSettings: (params: { id: string; data: CentralSettingsData }) => Promise<CentralSettingsPersistResult | void>;
  /**
   * Current viewer's email — gates the "Incidentes" tab (RFC-0232) via the
   * base class's `isSuperAdmin()` (true when this ends in `@myio.com.br`, or
   * when `superadmin` below is explicitly set). Neither field affects
   * anything else in this modal (central settings have no other
   * admin-vs-non-admin distinction today) — they exist ONLY for this gate.
   */
  userEmail?: string;
  /** Explicit override for the "Incidentes" tab gate — takes precedence over the `userEmail` domain check. */
  superadmin?: boolean;
  /**
   * Pre-fetched interpolated (fabricated) readings for this central, from
   * the No-Consumption Interpolation agent (`data-ingestion-prod`) — a
   * different backend than GCDR, so this is its own param rather than a
   * `CentralSettingsData`/`onFetchSettings` field. Renders in the
   * admin-only "Incidentes" tab (see `userEmail`/`superadmin` above); omit
   * or pass `[]` to show its empty state. The host is responsible for
   * scoping the fetch to this central and to whatever period it wants shown.
   */
  interpolatedSlots?: InterpolatedSlot[];
}

export interface CentralSettingsModalInstance {
  close: () => void;
}

function defaultData(params: CentralSettingsModalParams): CentralSettingsData {
  return {
    name: params.name,
    uuid: params.uuid ?? null,
    hardwareId: params.hardwareId ?? null,
    offlineGraceMinutes: 10,
    blipToleranceMinutes: 0,
    offlineHardMinutes: null,
    ...params.seed,
  };
}

function mapToGatewayInfo(data: CentralSettingsData): GatewayInfo {
  return {
    serialNumber: data.serialNumber ?? null,
    hardwareId: data.hardwareId ?? null,
    type: data.type ?? null,
    status: data.status ?? null,
    connectionStatus: data.connectionStatus ?? null,
    monitoringEnabled: data.monitoringEnabled ?? null,
    lastGatewayCheckAt: data.lastGatewayCheckAt ?? null,
    lastGatewaySuccessCheckAt: data.lastGatewaySuccessCheckAt ?? null,
    lastGatewayCheckLatencyMs: data.lastGatewayCheckLatencyMs ?? null,
    probeResult: data.probeResult ?? null,
    firmwareVersion: data.firmwareVersion ?? null,
    softwareVersion: data.softwareVersion ?? null,
    frequency: data.frequency ?? null,
    stats: data.stats ?? null,
    lastConsumptionTelemetry: data.lastConsumptionTelemetry ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    version: data.version ?? null,
  };
}

function formatIsoPtBr(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatIsoPtBrWithSeconds(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Mirrors `SettingsModalView`'s private "Conectado desde" relative-time format. */
function formatIsoRelativeDetailed(iso?: string | null): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '';
  const diffMinutes = Math.floor((Date.now() - ms) / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    return `(${diffDays}d:${String(diffHours % 24).padStart(2, '0')}hs:${String(diffMinutes % 60).padStart(2, '0')}mins atrás)`;
  }
  if (diffHours > 0) return `(${diffHours}hs:${String(diffMinutes % 60).padStart(2, '0')}mins atrás)`;
  if (diffMinutes > 0) return `(${diffMinutes}mins atrás)`;
  return '(agora)';
}

/** Mirrors `SettingsModalView`'s private "Último check status" relative-time format. */
function formatIsoRelativeSimple(iso?: string | null): string {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return '';
  const diffMinutes = Math.floor((Date.now() - ms) / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `(${diffDays}d atrás)`;
  if (diffHours > 0) return `(${diffHours}h atrás)`;
  if (diffMinutes > 0) return `(${diffMinutes}min atrás)`;
  return '(agora)';
}

function formatUptime(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}min`);
  return parts.join(' ');
}

/**
 * Patches the base's `#gwinfo-<key>` elements (inline gateway-info grid in
 * Geral, see `SettingsModalView.getGatewayInfoHTML()`) with fresh values — needed
 * because that HTML is only generated ONCE, at construction time
 * (`createModal()` never re-runs), so it can't see data that arrives later
 * via an async `onFetchSettings`. Mirrors the exact same formatting the base
 * itself uses (pt-BR dates, "Xd Yh Zmin" uptime, "Sim"/"Não" booleans) —
 * small, deliberate duplication rather than reaching into a private method.
 */
function patchGatewayInfoDom(root: HTMLElement, uuid: string | null | undefined, data: CentralSettingsData): void {
  const set = (key: string, value: string) => {
    const el = root.querySelector(`#gwinfo-${key}`);
    if (el) el.textContent = value;
  };
  const setHtml = (key: string, html: string) => {
    const el = root.querySelector(`#gwinfo-${key}`);
    if (el) el.innerHTML = html;
  };
  set('uuid', uuid || '—');
  set('serialNumber', data.serialNumber || '—');
  set('hardwareId', data.hardwareId || '—');
  set('type', data.type || '—');
  set('status', data.status || '—');
  set('firmwareVersion', data.firmwareVersion || '—');
  set('softwareVersion', data.softwareVersion || '—');
  set('frequency', data.frequency != null ? String(data.frequency) : '—');

  // "Informações de Conexão" card — mirrors SettingsModalView.getGatewayInfoHTML()'s
  // rendering exactly (status color-coding + relative-time-ago spans), so an
  // async refresh doesn't regress to plain, uncolored text.
  set('connCentral', data.name || '—');
  const connStatusInfo = SettingsModalView.GATEWAY_CONN_STATUS_MAP[(data.connectionStatus || '').toUpperCase()] || {
    text: data.connectionStatus || '—',
    color: '#6b7280',
  };
  setHtml('connectionStatus', `<span style="color: ${connStatusInfo.color}; font-weight: 600;">${connStatusInfo.text}</span>`);
  const isOnline = (data.connectionStatus || '').toUpperCase() === 'ONLINE';
  const connectedSinceAbs = isOnline ? formatIsoPtBr(data.lastGatewaySuccessCheckAt) : '—';
  const connectedSinceRel = isOnline ? formatIsoRelativeDetailed(data.lastGatewaySuccessCheckAt) : '';
  setHtml(
    'lastGatewaySuccessCheckAt',
    `${connectedSinceAbs}${connectedSinceRel ? ` <span class="time-since">${connectedSinceRel}</span>` : ''}`
  );
  const lastCheckAbs = formatIsoPtBr(data.lastGatewayCheckAt);
  const lastCheckRel = formatIsoRelativeSimple(data.lastGatewayCheckAt);
  setHtml(
    'lastGatewayCheckAt',
    `${lastCheckAbs}${lastCheckRel ? ` <span class="time-since">${lastCheckRel}</span>` : ''}`
  );
  const lc = data.lastConsumptionTelemetry;
  setHtml(
    'lastConsumptionTelemetry',
    lc
      ? `${lc.value.toLocaleString('pt-BR')}${lc.unit ? ` ${lc.unit}` : ''} - ${formatIsoPtBrWithSeconds(
          lc.timestamp
        )} ${formatIsoRelativeSimple(lc.timestamp)}`.trim()
      : '—'
  );
  set('monitoringEnabled', data.monitoringEnabled == null ? '—' : data.monitoringEnabled ? 'Sim' : 'Não');
  set('lastGatewayCheckLatencyMs', data.lastGatewayCheckLatencyMs != null ? `${data.lastGatewayCheckLatencyMs}ms` : '—');
  set('probeResult', data.probeResult || '—');

  set('statsConnectedDevices', data.stats?.connectedDevices != null ? String(data.stats.connectedDevices) : '—');
  set('statsActiveRules', data.stats?.activeRules != null ? String(data.stats.activeRules) : '—');
  set('statsPendingSyncEvents', data.stats?.pendingSyncEvents != null ? String(data.stats.pendingSyncEvents) : '—');
  set('statsUptimeSeconds', formatUptime(data.stats?.uptimeSeconds));
  set('statsLastHeartbeatAt', formatIsoPtBr(data.stats?.lastHeartbeatAt));
  set('createdAt', formatIsoPtBr(data.createdAt));
  set('updatedAt', formatIsoPtBr(data.updatedAt));
  set('version', data.version != null ? String(data.version) : '—');
}

/**
 * The one piece of UI the base class has no concept of — the v2
 * `deriveCentralConnectivity` calibration knobs (grace/blip/hard-offline).
 * Injected as a 4th `.form-card.gateway-info-card.info-card-wide` into the
 * Geral tab's inline `.gateway-info-grid` (see `injectConnectivitySection()`),
 * appended after Identificação/Estatísticas/Metadados, same one-per-line
 * "Informações de Conexão" pattern as its siblings (`.info-grid`/`.info-row`
 * with an `<input>` where a device's card would show a read-only value) —
 * connectivity HEALTH itself (status/last-check) lives separately in
 * "Informações de Conexão". No `UUID` field here either — the "Identificação"
 * card already shows it (`#gwinfo-uuid`), so repeating it here was pure
 * duplication.
 */
function connectivityFieldsetHtml(
  data: CentralSettingsData,
  l: CentralSettingsModalLabels,
  language: 'pt' | 'en',
  errors: Record<string, string>
): string {
  const err = (field: string) =>
    errors[field] ? `<span class="myio-csettings__field-error">${escAttr(errors[field])}</span>` : '';
  const errClass = (field: string) => (errors[field] ? ' myio-csettings__input--error' : '');
  const inputRow = (label: string, field: string, inputHtml: string) => `
    <div class="info-row">
      <span class="info-label">${escAttr(label)}</span>
      <span class="info-value">${inputHtml}${err(field)}</span>
    </div>`;
  return `
    <div class="form-card gateway-info-card info-card-wide myio-csettings-connectivity">
      <h4 class="section-title">${escAttr(
        l.connectivitySection || (language === 'en' ? 'Connectivity Settings' : 'Configuração de Conectividade')
      )}</h4>
      <div class="info-grid">
        ${inputRow(
          `${l.offlineGraceLabel || (language === 'en' ? 'Grace window (min)' : 'Janela de graça (min)')}:`,
          'offlineGraceMinutes',
          `<input type="number" min="0" step="1" name="offlineGraceMinutes" value="${data.offlineGraceMinutes}" class="myio-csettings__input${errClass(
            'offlineGraceMinutes'
          )}" />`
        )}
        ${inputRow(
          `${l.blipToleranceLabel || (language === 'en' ? 'Blip tolerance (min)' : 'Tolerância de blip (min)')}:`,
          'blipToleranceMinutes',
          `<input type="number" min="0" step="1" name="blipToleranceMinutes" value="${data.blipToleranceMinutes}" class="myio-csettings__input${errClass(
            'blipToleranceMinutes'
          )}" />`
        )}
        ${inputRow(
          `${l.offlineHardLabel || (language === 'en' ? 'Hard-offline threshold (min)' : 'Limiar de hard-offline (min)')}:`,
          'offlineHardMinutes',
          `<input type="number" min="0" step="1" name="offlineHardMinutes" value="${
            data.offlineHardMinutes ?? ''
          }" placeholder="${escAttr(l.offlineHardHint || (language === 'en' ? 'empty = disabled' : 'vazio = desativado'))}" class="myio-csettings__input${errClass(
            'offlineHardMinutes'
          )}" />`
        )}
      </div>
    </div>
  `;
}

const STYLE_ID = 'myio-central-settings-modal-styles';
function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = `
.myio-csettings__input{
  font:600 13px 'Nunito', system-ui, sans-serif;padding:6px 8px;border-radius:6px;
  border:1px solid #e5e7eb;background:#fff;color:#1f2937;width:100px;box-sizing:border-box;
  text-align:right;
}
.myio-csettings__input--error{border-color:#dc2626;}
.myio-csettings__field-error{display:block;margin-top:4px;font:700 11px 'Nunito', system-ui, sans-serif;color:#dc2626;text-align:right;}
.theme-dark .myio-csettings__input{background:#111827;border-color:#4b5563;color:#e5e7eb;}
`;
  document.head.appendChild(tag);
}

export class CentralSettingsModal extends SettingsModalView {
  private csParams: CentralSettingsModalParams;
  private csLanguage: 'pt' | 'en';
  private csLabels: CentralSettingsModalLabels;
  private csCurrentData: CentralSettingsData;
  /** Captured right after `super.render()` (the most-recently-appended
   *  `.myio-device-settings-overlay`) so DOM injection/lookups stay scoped to
   *  THIS instance even if another settings modal is open at the same time —
   *  `this.container`/`this.modal` on the base class are private, so this is
   *  the only handle a subclass can hold. */
  private csRootEl: HTMLElement | null = null;

  constructor(params: CentralSettingsModalParams) {
    const language = params.language ?? 'pt';
    const l = params.labels || {};
    const title = (l.title || (language === 'en' ? 'Settings — {name}' : 'Configurações — {name}')).replace(
      '{name}',
      params.name
    );
    const initialData = defaultData(params);

    const config: ModalConfig = {
      title,
      width: 1300,
      theme: params.theme ?? 'light',
      closeOnBackdrop: true,
      deviceId: params.id,
      deviceLabel: params.name,
      deviceName: params.uuid ?? undefined,
      // RFC-0200: identity-card image (Geral tab) — without this, getDeviceImage()
      // sees an empty deviceType and falls back to DEFAULT_DEVICE_ICON (generic
      // 3F_MEDIDOR art) instead of deviceIcons.GATEWAY. A real device never sets
      // deviceType to this value (it's not a valid TB deviceProfile), so this is
      // fully inert for the device settings modal, same as isGateway above.
      deviceType: 'GATEWAY',
      // No domain concept for a central — suppresses the energy/water/
      // temperature-only sections and removes the "Excluir Grupos" tab
      // (gated on `domain === 'energy'` in the base class).
      domain: '' as Domain,
      // No device JWT-backed persistence — CentralSettingsModal's own
      // onSaveSettings callback owns saving, not the base's fetcher/persister.
      jwtToken: '',
      mapInstantaneousPower: {},
      deviceMapInstaneousPower: {},
      // Inline gateway identity/telemetry in Geral (see file doc) — read-only
      // GCDR data. Real devices never set isGateway, so this is fully inert
      // for the device settings modal.
      isGateway: true,
      gatewayInfo: mapToGatewayInfo(initialData),
      // RFC-0232: "Incidentes" tab gate + data — see CentralSettingsModalParams doc.
      userEmail: params.userEmail,
      superadmin: params.superadmin,
      interpolatedSlots: params.interpolatedSlots,
      onSave: () => Promise.resolve(), // rebound below once `this` exists (see class doc)
      onClose: () => {}, // rebound below
    };
    super(config);
    this.csParams = params;
    this.csLanguage = language;
    this.csLabels = l;
    this.csCurrentData = initialData;
    injectStyles();

    // `config` is the exact object reference stored as the base class's
    // private `this.config` — mutating it here (after super() returns, so
    // `this` is usable in the closures) is how a subclass rewires callbacks
    // it has no direct field access to.
    config.onSave = (formData: Record<string, any>) => this.handleCentralSave(formData);
    config.onClose = () => {
      this.close();
    };
  }

  /** Overrides the base's public `render()`: mounts the full device-modal
   *  shell via `super.render()`, then injects the Conectividade fieldset the
   *  base has no concept of, and patches the Geral tab's inline gateway-info
   *  `#gwinfo-*` elements — its HTML was generated once at construction time
   *  (from whatever data was available then), so an async `onFetchSettings`
   *  resolving later needs this explicit patch to actually show up. */
  render(initialData: Record<string, any> = {}): void {
    this.csCurrentData = { ...this.csCurrentData, ...initialData };
    super.render({
      label: this.csCurrentData.name,
      identifier: this.csCurrentData.hardwareId ?? '',
      ...initialData,
    });
    const overlays = document.querySelectorAll<HTMLElement>('.myio-device-settings-overlay');
    this.csRootEl = overlays[overlays.length - 1] ?? null;
    this.injectConnectivitySection({});
    if (this.csRootEl) {
      patchGatewayInfoDom(this.csRootEl, this.csParams.uuid, this.csCurrentData);
    }
  }

  /**
   * Injects the editable connectivity fieldset into the Geral tab's inline
   * gateway-info `.gateway-info-grid` (Identificação/Estatísticas/Metadados)
   * as a 4th `.form-card`, appended at the end. This grid is a descendant of
   * the Geral tab's own `<form>`, so the base's `new FormData(this.form)`
   * (used by the base's own `getFormData()`) picks up these inputs
   * automatically — no `getFormData()` override needed here.
   */
  private injectConnectivitySection(errors: Record<string, string>): void {
    const grid = this.csRootEl?.querySelector('.gateway-info-grid');
    if (!grid) return;
    const html = connectivityFieldsetHtml(this.csCurrentData, this.csLabels, this.csLanguage, errors);
    const existing = grid.querySelector('.myio-csettings-connectivity');
    if (existing) {
      existing.outerHTML = html;
      return;
    }
    grid.insertAdjacentHTML('beforeend', html);
  }

  private async handleCentralSave(formData: Record<string, any>): Promise<void> {
    const hardRaw = formData.offlineHardMinutes;
    const merged: CentralSettingsData = {
      ...this.csCurrentData,
      name: typeof formData.label === 'string' && formData.label.trim() ? formData.label.trim() : this.csCurrentData.name,
      offlineGraceMinutes: Number(formData.offlineGraceMinutes),
      blipToleranceMinutes: Number(formData.blipToleranceMinutes),
      offlineHardMinutes: hardRaw === '' || hardRaw == null ? null : Number(hardRaw),
    };

    const errorList = validateCentralSettings(merged, this.csLanguage);
    if (errorList.length > 0) {
      this.csCurrentData = merged;
      this.injectConnectivitySection(Object.fromEntries(errorList.map((e) => [e.field, e.message])));
      this.showError(errorList.map((e) => e.message).join(' '));
      return;
    }

    this.hideError();
    this.showLoadingState(true);
    try {
      const result = await this.csParams.onSaveSettings({ id: this.csParams.id, data: merged });
      this.showLoadingState(false);
      if (result && result.ok === false) {
        this.showError(result.error?.message || (this.csLanguage === 'en' ? 'Save failed.' : 'Falha ao salvar.'));
        return;
      }
      this.csCurrentData = merged;
      this.close();
    } catch (err) {
      this.showLoadingState(false);
      this.showError(err instanceof Error ? err.message : this.csLanguage === 'en' ? 'Save failed.' : 'Falha ao salvar.');
    }
  }
}

export function openCentralSettingsModal(params: CentralSettingsModalParams): CentralSettingsModalInstance {
  const modal = new CentralSettingsModal(params);

  if (params.seed || !params.onFetchSettings) {
    modal.render(params.seed ? { ...params.seed } : {});
  } else {
    params
      .onFetchSettings({ id: params.id })
      .then((data) => modal.render(data))
      .catch(() => {
        modal.render({});
        modal.showError(
          params.language === 'en' ? 'Could not load settings.' : 'Não foi possível carregar as configurações.'
        );
      });
  }

  return { close: () => modal.close() };
}
