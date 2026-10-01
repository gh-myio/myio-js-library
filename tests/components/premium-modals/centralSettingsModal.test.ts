/**
 * CentralSettingsModal — literally `extends SettingsModalView`
 * (settings/SettingsModalView.ts, the device settings modal). Exercises the
 * REAL device-modal DOM (no mocking of the base class) — see
 * CentralSettingsModal.ts's file doc for the mechanics (config-object-
 * reference rebinding, injected Conectividade fieldset, scoped root lookup).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openCentralSettingsModal,
  validateCentralSettings,
  minutesToMs,
  msToMinutes,
} from '../../../src/components/premium-modals/central-settings';
import type { CentralSettingsData } from '../../../src/components/premium-modals/central-settings';
import { deviceIcons, DEFAULT_DEVICE_ICON } from '../../../src/utils/devices/deviceIcons';

// `.myio-device-settings-modal` (unlike `.myio-device-settings-overlay`,
// which the base class's own template applies to BOTH the outer container
// div and a nested inner div — a pre-existing quirk in SettingsModalView.ts,
// not something introduced here) appears exactly once per instance.
function root(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>('.myio-device-settings-modal');
  return els[els.length - 1];
}

function instanceCount(): number {
  return document.querySelectorAll('.myio-device-settings-modal').length;
}

function nameInput(): HTMLInputElement {
  return root().querySelector<HTMLInputElement>('[name="label"]')!;
}
function graceInput(): HTMLInputElement {
  return root().querySelector<HTMLInputElement>('[name="offlineGraceMinutes"]')!;
}
function blipInput(): HTMLInputElement {
  return root().querySelector<HTMLInputElement>('[name="blipToleranceMinutes"]')!;
}
function hardInput(): HTMLInputElement {
  return root().querySelector<HTMLInputElement>('[name="offlineHardMinutes"]')!;
}
function saveBtn(): HTMLButtonElement {
  return root().querySelector<HTMLButtonElement>('.btn-save')!;
}
function cancelBtn(): HTMLButtonElement {
  return root().querySelector<HTMLButtonElement>('.btn-cancel')!;
}

afterEach(() => {
  // Instances aren't tracked by the test, so sweep any overlay left mounted
  // (a failed/aborted test, or a modal a case didn't explicitly close).
  document.querySelectorAll('.myio-device-settings-overlay').forEach((el) => el.remove());
});

const baseParams = (overrides: Partial<Parameters<typeof openCentralSettingsModal>[0]> = {}) => ({
  id: 'gw-1',
  name: 'Central Teste',
  onSaveSettings: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('minutesToMs / msToMinutes', () => {
  it('convert both ways, null-safe', () => {
    expect(minutesToMs(10)).toBe(600000);
    expect(minutesToMs(null)).toBeUndefined();
    expect(msToMinutes(600000)).toBe(10);
    expect(msToMinutes(null)).toBeNull();
  });
});

describe('validateCentralSettings', () => {
  const valid = (): CentralSettingsData => ({
    name: 'Central X',
    offlineGraceMinutes: 10,
    blipToleranceMinutes: 0,
    offlineHardMinutes: 150,
  });

  it('a fully valid payload has no errors', () => {
    expect(validateCentralSettings(valid(), 'pt')).toEqual([]);
  });

  it('requires a non-empty name', () => {
    const errors = validateCentralSettings({ ...valid(), name: '  ' }, 'pt');
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('rejects negative grace/blip minutes', () => {
    expect(
      validateCentralSettings({ ...valid(), offlineGraceMinutes: -1 }, 'pt').some((e) => e.field === 'offlineGraceMinutes')
    ).toBe(true);
    expect(
      validateCentralSettings({ ...valid(), blipToleranceMinutes: -1 }, 'pt').some((e) => e.field === 'blipToleranceMinutes')
    ).toBe(true);
  });

  it("offlineHardMinutes must exceed offlineGraceMinutes when set (mirrors deriveCentralConnectivity's pastHard guard)", () => {
    const errors = validateCentralSettings({ ...valid(), offlineGraceMinutes: 10, offlineHardMinutes: 5 }, 'pt');
    expect(errors.some((e) => e.field === 'offlineHardMinutes')).toBe(true);
  });

  it('offlineHardMinutes: null is always valid (feature disabled)', () => {
    expect(validateCentralSettings({ ...valid(), offlineHardMinutes: null }, 'pt')).toEqual([]);
  });
});

describe('openCentralSettingsModal — mounts the real device-modal shell', () => {
  it('appends one settings modal to document.body, titled with the central name', () => {
    openCentralSettingsModal(baseParams());
    expect(instanceCount()).toBe(1);
    expect(root().querySelector('#modal-title')?.textContent || root().textContent).toContain('Configurações');
  });

  it('title interpolates {name} and flips template with language', () => {
    openCentralSettingsModal(baseParams());
    expect(root().textContent).toContain('Central Teste');
    document.querySelectorAll('.myio-device-settings-overlay').forEach((el) => el.remove());

    openCentralSettingsModal(baseParams({ language: 'en' }));
    // English copy isn't wired into the base class's own labels (device-modal
    // chrome stays pt-BR — a known "customização depois" item), but our own
    // injected Conectividade fieldset does flip language.
    expect(root().textContent).toContain('Connectivity Settings');
  });

  it("the 'Excluir Grupos' tab is removed entirely (no domain concept for a central)", () => {
    openCentralSettingsModal(baseParams());
    expect(root().querySelector('[data-tab="exclusion-groups"]')).toBeNull();
  });

  it('the label input is pre-filled with the central name', () => {
    openCentralSettingsModal(baseParams({ name: 'Central Campinas' }));
    expect(nameInput().value).toBe('Central Campinas');
  });
});

describe('openCentralSettingsModal — inline gateway identity/telemetry in Geral (SettingsModalView.isGateway)', () => {
  function gwField(key: string): string | undefined {
    return root().querySelector(`#gwinfo-${key}`)?.textContent ?? undefined;
  }

  it('renders inline in Geral, visible immediately — no separate "Central"/"gateway" tab exists', () => {
    openCentralSettingsModal(baseParams());
    // no separate tab button/content for gateway info any more
    expect(root().querySelector('[data-tab="gateway"]')).toBeNull();
    expect(root().querySelector('#gateway-tab-content')).toBeNull();
    expect(Array.from(root().querySelectorAll('.modal-tab')).some((b) => b.textContent?.includes('Central'))).toBe(
      false
    );

    // gateway info grid renders directly inside the Geral tab, no click needed
    const generalContent = root().querySelector<HTMLElement>('#general-tab-content')!;
    expect(generalContent.style.display).not.toBe('none');
    expect(generalContent.querySelector('.gateway-info-grid')).toBeTruthy();
    expect(generalContent.querySelector('#gwinfo-uuid')).toBeTruthy();

    // Geral's Save button stays visible (the tab still has editable fields:
    // Etiqueta + the injected Conectividade inputs)
    expect(root().querySelector<HTMLElement>('.btn-save')!.style.display).not.toBe('none');
  });

  it('shows read-only identity/telemetry fields from `seed`', () => {
    openCentralSettingsModal(
      baseParams({
        uuid: 'uuid-central-1',
        seed: {
          serialNumber: 'SCMXGATEWAY01',
          type: 'GATEWAY',
          status: 'ACTIVE',
          connectionStatus: 'ONLINE',
          monitoringEnabled: true,
          firmwareVersion: '1.0.0',
          softwareVersion: '0.0.0',
          frequency: 60,
          lastGatewayCheckLatencyMs: 1372,
          probeResult: 'OK',
          stats: { connectedDevices: 5, activeRules: 2, pendingSyncEvents: 0, uptimeSeconds: 93784 },
          version: 3,
        },
      })
    );
    expect(gwField('uuid')).toBe('uuid-central-1');
    expect(gwField('serialNumber')).toBe('SCMXGATEWAY01');
    expect(gwField('type')).toBe('GATEWAY');
    expect(gwField('status')).toBe('ACTIVE');
    expect(gwField('connectionStatus')).toBe('ONLINE');
    expect(gwField('monitoringEnabled')).toBe('Sim');
    expect(gwField('firmwareVersion')).toBe('1.0.0');
    expect(gwField('softwareVersion')).toBe('0.0.0');
    expect(gwField('frequency')).toBe('60');
    expect(gwField('lastGatewayCheckLatencyMs')).toBe('1372ms');
    expect(gwField('probeResult')).toBe('OK');
    expect(gwField('statsConnectedDevices')).toBe('5');
    expect(gwField('statsActiveRules')).toBe('2');
    expect(gwField('statsPendingSyncEvents')).toBe('0');
    expect(gwField('statsUptimeSeconds')).toBe('1d 2h 3min'); // 93784s = 1d 02h 03min
    expect(gwField('version')).toBe('3');
  });

  it('missing fields render as "—", not blank/undefined', () => {
    openCentralSettingsModal(baseParams());
    expect(gwField('serialNumber')).toBe('—');
    expect(gwField('monitoringEnabled')).toBe('—');
    expect(gwField('lastGatewayCheckAt')).toBe('—');
    expect(gwField('statsUptimeSeconds')).toBe('—');
  });

  it('an async onFetchSettings patches the tab after resolving (HTML was frozen at construction time)', async () => {
    const onFetchSettings = vi.fn().mockResolvedValue({
      name: 'Central Teste',
      offlineGraceMinutes: 10,
      blipToleranceMinutes: 0,
      offlineHardMinutes: null,
      serialNumber: 'FETCHED-SN-1',
      connectionStatus: 'DEGRADED',
      stats: { connectedDevices: 9 },
    });
    openCentralSettingsModal(baseParams({ onFetchSettings }));
    // Note: unlike the `seed` path, the modal isn't even mounted to
    // document.body yet at this point — render() only runs once the fetch
    // promise resolves (see openCentralSettingsModal's else-branch) — so
    // there's nothing to assert pre-resolution here.
    await vi.waitFor(() => expect(gwField('serialNumber')).toBe('FETCHED-SN-1'));
    // 'DEGRADED' renders as friendly 'Atenção' — same status vocabulary as a
    // real device's "Informações de Conexão" card (SettingsModalView.GATEWAY_CONN_STATUS_MAP).
    expect(gwField('connectionStatus')).toBe('Atenção');
    expect(gwField('statsConnectedDevices')).toBe('9');
  });

  it('read-only fields are never part of the save payload sent to onSaveSettings', async () => {
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    openCentralSettingsModal(baseParams({ onSaveSettings, seed: { serialNumber: 'SN-X', status: 'ACTIVE' } }));
    // captured BEFORE saving — a successful save closes the modal, removing it from the DOM
    const hasSerialNumberInput = !!root().querySelector('[name="serialNumber"]');
    const hasStatusInput = !!root().querySelector('[name="status"]');
    saveBtn().click();
    await vi.waitFor(() => expect(onSaveSettings).toHaveBeenCalled());
    const sentKeys = Object.keys(onSaveSettings.mock.calls[0][0].data);
    // still carried on the DATA OBJECT (harmless read-only context for the host —
    // see CentralSettingsModal.ts), but never as an editable <input> the user
    // could tamper with.
    expect(hasSerialNumberInput).toBe(false);
    expect(hasStatusInput).toBe(false);
    expect(sentKeys).toContain('name');
  });
});

describe('openCentralSettingsModal — injected Conectividade fieldset', () => {
  it('uses `seed` directly, skipping onFetchSettings entirely', () => {
    const onFetchSettings = vi.fn();
    openCentralSettingsModal(baseParams({ seed: { offlineGraceMinutes: 20 }, onFetchSettings }));
    expect(onFetchSettings).not.toHaveBeenCalled();
    expect(graceInput().value).toBe('20');
  });

  it('falls back to built-in defaults (grace=10, blip=0, hard=null) when neither seed nor onFetchSettings is given', () => {
    openCentralSettingsModal(baseParams());
    expect(graceInput().value).toBe('10');
    expect(blipInput().value).toBe('0');
    expect(hardInput().value).toBe('');
  });

  it('calls onFetchSettings({id}) and populates the injected fields on success', async () => {
    const onFetchSettings = vi.fn().mockResolvedValue({
      name: 'Fetched Name',
      offlineGraceMinutes: 15,
      blipToleranceMinutes: 2,
      offlineHardMinutes: 200,
    });
    openCentralSettingsModal(baseParams({ onFetchSettings }));
    await vi.waitFor(() => expect(onFetchSettings).toHaveBeenCalledWith({ id: 'gw-1' }));
    await vi.waitFor(() => expect(nameInput().value).toBe('Fetched Name'));
    expect(graceInput().value).toBe('15');
    expect(hardInput().value).toBe('200');
  });

  it('a rejected onFetchSettings still opens the modal (with defaults) and surfaces an inline error', async () => {
    const onFetchSettings = vi.fn().mockRejectedValue(new Error('down'));
    openCentralSettingsModal(baseParams({ onFetchSettings }));
    await vi.waitFor(() => expect(onFetchSettings).toHaveBeenCalled());
    await vi.waitFor(() => expect(graceInput().value).toBe('10')); // defaults, modal still usable
    expect(root().querySelector('.error-message')?.textContent).toContain('Não foi possível carregar');
  });
});

describe('openCentralSettingsModal — identity fields', () => {
  it('uuid appears exactly once, read-only in the inline Identificação card — not as an editable input', () => {
    openCentralSettingsModal(baseParams({ uuid: 'uuid-123' }));
    expect(root().querySelector('#gwinfo-uuid')?.textContent).toBe('uuid-123');
    // No `<input>` anywhere in the modal carries the UUID as its value — the
    // old injected-fieldset copy was removed as a duplicate of #gwinfo-uuid.
    const uuidAsInputValue = Array.from(root().querySelectorAll('input')).find((i) => i.value === 'uuid-123');
    expect(uuidAsInputValue).toBeUndefined();
  });

  it('the Geral tab identity image resolves to deviceIcons.GATEWAY, not the generic DEFAULT_DEVICE_ICON fallback', () => {
    openCentralSettingsModal(baseParams());
    const img = root().querySelector<HTMLImageElement>('.identity-device-image');
    expect(img?.getAttribute('src')).toBe(deviceIcons.GATEWAY);
    expect(img?.getAttribute('src')).not.toBe(DEFAULT_DEVICE_ICON);
  });
});

describe('openCentralSettingsModal — Conectividade fieldset lives inline in Geral', () => {
  it("the connectivity inputs are inside Geral's form, appended as the last card in the gateway-info grid", () => {
    openCentralSettingsModal(baseParams());
    const generalForm = root().querySelector('#general-tab-content form')!;
    const grid = generalForm.querySelector('.gateway-info-grid')!;

    expect(grid.querySelector('[name="offlineGraceMinutes"]')).toBeTruthy();
    expect(grid.querySelector('[name="blipToleranceMinutes"]')).toBeTruthy();
    expect(grid.querySelector('[name="offlineHardMinutes"]')).toBeTruthy();

    // Identificação, Estatísticas, Metadados + the injected connectivity
    // fieldset — connectivity HEALTH (status/last-check) now lives in its
    // own "Informações de Conexão" card outside this grid, so there's no
    // "Conectividade (telemetria)" card left to anchor next to.
    const cards = Array.from(grid.querySelectorAll('.gateway-info-card'));
    const connectivityIdx = cards.findIndex((c) => c.classList.contains('myio-csettings-connectivity'));
    expect(connectivityIdx).toBe(cards.length - 1);
  });

  it('the "Informações de Conexão" card mirrors the real-device pattern (same classes, status color, relative time)', () => {
    openCentralSettingsModal(
      baseParams({
        uuid: 'uuid-conn-1',
        seed: {
          connectionStatus: 'DEGRADED',
          lastGatewayCheckAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        },
      })
    );
    const card = Array.from(root().querySelectorAll('.info-card-wide')).find(
      (c) => c.querySelector('.section-title')?.textContent?.includes('Informações de Conexão')
    );
    expect(card).toBeTruthy();
    expect(card!.querySelector('.info-grid')).toBeTruthy();
    expect(card!.querySelectorAll('.info-row').length).toBeGreaterThanOrEqual(6);
    expect(card!.querySelector('#gwinfo-connCentral')?.textContent).toBe('Central Teste');
    expect(card!.querySelector('#gwinfo-connectionStatus')?.textContent).toBe('Atenção');
    expect(card!.querySelector('#gwinfo-lastGatewayCheckAt')?.textContent).toContain('min atrás)');
  });

  it('the connectivity fields still submit correctly (base getFormData now covers them — no override needed)', async () => {
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    openCentralSettingsModal(baseParams({ onSaveSettings }));
    graceInput().value = '25';
    blipInput().value = '3';
    saveBtn().click();
    await vi.waitFor(() => expect(onSaveSettings).toHaveBeenCalled());
    const data = onSaveSettings.mock.calls[0][0].data;
    expect(data.offlineGraceMinutes).toBe(25);
    expect(data.blipToleranceMinutes).toBe(3);
  });
});

describe('openCentralSettingsModal — save flow', () => {
  it('validation errors block the save and render inline, onSaveSettings is never called', () => {
    const onSaveSettings = vi.fn();
    openCentralSettingsModal(baseParams({ onSaveSettings, seed: { offlineGraceMinutes: 10, offlineHardMinutes: 5 } }));
    saveBtn().click();
    expect(onSaveSettings).not.toHaveBeenCalled();
    expect(root().querySelector('.myio-csettings__field-error')).toBeTruthy();
    expect(root().querySelector('.error-message')?.textContent).toBeTruthy();
  });

  it('a valid save calls onSaveSettings with {id, data} and closes the modal on success', async () => {
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    openCentralSettingsModal(baseParams({ id: 'central-9', onSaveSettings }));
    saveBtn().click();
    await vi.waitFor(() => expect(onSaveSettings).toHaveBeenCalledTimes(1));
    expect(onSaveSettings.mock.calls[0][0].id).toBe('central-9');
    expect(onSaveSettings.mock.calls[0][0].data.offlineGraceMinutes).toBe(10);
    await vi.waitFor(() => expect(document.querySelectorAll('.myio-device-settings-overlay').length).toBe(0));
  });

  it('edited form values are read back and sent, not the stale seed', async () => {
    const onSaveSettings = vi.fn().mockResolvedValue(undefined);
    openCentralSettingsModal(baseParams({ onSaveSettings }));
    nameInput().value = 'Renomeada';
    graceInput().value = '25';
    saveBtn().click();
    await vi.waitFor(() => expect(onSaveSettings).toHaveBeenCalled());
    expect(onSaveSettings.mock.calls[0][0].data.name).toBe('Renomeada');
    expect(onSaveSettings.mock.calls[0][0].data.offlineGraceMinutes).toBe(25);
  });

  it('a rejected onSaveSettings shows an inline error and keeps the modal open', async () => {
    const onSaveSettings = vi.fn().mockRejectedValue(new Error('network down'));
    openCentralSettingsModal(baseParams({ onSaveSettings }));
    saveBtn().click();
    await vi.waitFor(() => expect(root().querySelector('.error-message')?.textContent).toContain('network down'));
    expect(instanceCount()).toBe(1);
  });

  it('onSaveSettings returning {ok:false, error} is treated the same as a rejection', async () => {
    const onSaveSettings = vi.fn().mockResolvedValue({ ok: false, error: { code: 'X', message: 'Nome duplicado' } });
    openCentralSettingsModal(baseParams({ onSaveSettings }));
    saveBtn().click();
    await vi.waitFor(() => expect(root().querySelector('.error-message')?.textContent).toContain('Nome duplicado'));
    expect(instanceCount()).toBe(1);
  });

  it('clicking cancel closes the modal without calling onSaveSettings', () => {
    const onSaveSettings = vi.fn();
    openCentralSettingsModal(baseParams({ onSaveSettings }));
    cancelBtn().click();
    expect(onSaveSettings).not.toHaveBeenCalled();
    expect(instanceCount()).toBe(0);
  });
});

describe('openCentralSettingsModal — instance isolation', () => {
  it('two modals open at once each save through their own onSaveSettings/data, not the other\'s', async () => {
    const saveA = vi.fn().mockResolvedValue(undefined);
    const saveB = vi.fn().mockResolvedValue(undefined);
    openCentralSettingsModal(baseParams({ id: 'a', name: 'Central A', onSaveSettings: saveA, seed: { offlineGraceMinutes: 11 } }));
    openCentralSettingsModal(baseParams({ id: 'b', name: 'Central B', onSaveSettings: saveB, seed: { offlineGraceMinutes: 22 } }));

    const modals = document.querySelectorAll<HTMLElement>('.myio-device-settings-modal');
    expect(modals.length).toBe(2);
    const [rootA, rootB] = Array.from(modals);

    expect(rootA.querySelector<HTMLInputElement>('[name="offlineGraceMinutes"]')!.value).toBe('11');
    expect(rootB.querySelector<HTMLInputElement>('[name="offlineGraceMinutes"]')!.value).toBe('22');

    rootB.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await vi.waitFor(() => expect(saveB).toHaveBeenCalledTimes(1));
    expect(saveA).not.toHaveBeenCalled();
    expect(saveB.mock.calls[0][0].id).toBe('b');
  });
});

describe('openCentralSettingsModal — "Incidentes" tab (RFC-0232, admin MyIO only)', () => {
  const SLOTS = [
    { slaveId: 1, deviceName: 'Hidr. Outback', hourStart: '2026-09-16T13:00:00Z', value: 12.5, sourceHour: '2026-09-16T12:00:00Z', ruleId: 'rule-aaaaaaaa-1111', incidentRef: 'INC-1', createdAt: '2026-09-16T13:05:00Z' },
    { slaveId: 1, deviceName: 'Hidr. Outback', hourStart: '2026-09-16T14:00:00Z', value: 13.0, sourceHour: '2026-09-16T12:00:00Z', ruleId: 'rule-aaaaaaaa-1111', incidentRef: null, createdAt: '2026-09-16T14:05:00Z' },
    { slaveId: 1, deviceName: 'Hidr. Outback', hourStart: '2026-09-17T09:00:00Z', value: 14.2, sourceHour: '2026-09-17T08:00:00Z', ruleId: 'rule-aaaaaaaa-1111', incidentRef: null, createdAt: '2026-09-17T09:05:00Z' },
    { slaveId: 2, deviceName: null, hourStart: '2026-09-16T13:00:00Z', value: 2600, sourceHour: '2026-09-16T11:00:00Z', ruleId: 'rule-bbbbbbbb-2222', incidentRef: null, createdAt: '2026-09-16T13:05:00Z' },
  ];

  it('does NOT render for a non-admin viewer, even with interpolatedSlots present', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'someone@example.com', interpolatedSlots: SLOTS }));
    expect(root().querySelector('[data-tab="incidents"]')).toBeNull();
    expect(root().querySelector('#incidents-tab-content')).toBeNull();
  });

  it('renders for a @myio.com.br viewer, grouped by device then by day, with a slot-count tab badge', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    const tabBtn = root().querySelector<HTMLElement>('[data-tab="incidents"]');
    expect(tabBtn).toBeTruthy();
    expect(tabBtn!.textContent).toContain('Incidentes');
    expect(tabBtn!.querySelector('.modal-tab-badge')?.textContent).toBe('4');

    tabBtn!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    expect(content.style.display).toBe('block');

    const devices = Array.from(content.querySelectorAll('.incidents-device__name')).map((el) => el.textContent);
    expect(devices).toEqual(['Hidr. Outback', 'slave 2']); // null deviceName falls back to "slave <id>", alphabetically after "Hidr..."

    const outbackDevice = content.querySelectorAll('.incidents-device')[0];
    const days = outbackDevice.querySelectorAll('.incidents-day__header span:first-child');
    expect(days.length).toBe(2); // 16/09 (2 slots) + 17/09 (1 slot), not 3 flat rows
    expect(days[0].textContent).toBe('16/09/2026');
    expect(days[1].textContent).toBe('17/09/2026');

    const firstDayRows = outbackDevice.querySelectorAll('.incidents-day')[0].querySelectorAll('tbody tr');
    expect(firstDayRows.length).toBe(2);
    expect(firstDayRows[0].querySelector('.num')?.textContent).toBe('12.5');
    expect(firstDayRows[0].textContent).toContain('INC-1');
    expect(firstDayRows[1].textContent).toContain('—'); // no incidentRef
  });

  it('respects an explicit superadmin:true override even without a @myio.com.br email', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'ops@partner.com', superadmin: true, interpolatedSlots: SLOTS }));
    expect(root().querySelector('[data-tab="incidents"]')).toBeTruthy();
  });

  it('shows an empty state for an admin when interpolatedSlots is empty/omitted', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br' }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    expect(content.querySelector('.incidents-empty')).toBeTruthy();
    expect(root().querySelector('[data-tab="incidents"] .modal-tab-badge')).toBeNull();
  });

  it('clicking a device header collapses/re-expands its body', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const deviceEl = root().querySelector<HTMLElement>('.incidents-device')!;
    const header = deviceEl.querySelector<HTMLElement>('[data-role="toggle-incidents-device"]')!;
    expect(deviceEl.classList.contains('is-collapsed')).toBe(false);
    header.click();
    expect(deviceEl.classList.contains('is-collapsed')).toBe(true);
    header.click();
    expect(deviceEl.classList.contains('is-collapsed')).toBe(false);
  });

  it('the Salvar button stays hidden while the Incidentes tab is active (read-only, like every other non-Geral tab)', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    expect(saveBtn().style.display).toBe('none');
  });

  it('renders KPI cards (total, dispositivos, dias, com incidente) matching the unfiltered data', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    const values = Array.from(content.querySelectorAll('.incidents-kpi__value')).map((el) => el.textContent);
    // 4 slots total, 2 devices, 2 distinct local days (16/09 + 17/09), 1 with incidentRef
    expect(values).toEqual(['4', '2', '2', '1']);
  });

  it('the search input live-filters by device name/label', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    const search = content.querySelector<HTMLInputElement>('.incidents-search-input')!;

    search.value = 'outback';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    const devices = Array.from(content.querySelectorAll('.incidents-device__name')).map((el) => el.textContent);
    expect(devices).toEqual(['Hidr. Outback']);
    expect(content.querySelector('.incidents-kpi__value')?.textContent).toBe('3'); // Outback's own 3 slots

    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Array.from(content.querySelectorAll('.incidents-device__name')).map((el) => el.textContent)).toEqual([
      'Hidr. Outback',
      'slave 2',
    ]);
  });

  it('the devices dropdown starts closed and toggles open on click', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    const panel = content.querySelector<HTMLElement>('[data-role="incidents-devices-panel"]')!;
    expect(panel.hidden).toBe(true);
    content.querySelector<HTMLElement>('[data-role="incidents-devices-toggle"]')!.click();
    expect(panel.hidden).toBe(false);
  });

  it('every device checkbox starts checked (default: todos marcados)', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;
    const checkboxes = Array.from(content.querySelectorAll<HTMLInputElement>('[data-role="incidents-device-checkbox"]'));
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
  });

  it('unchecking a device hides it from the body/KPIs; "Desmarcar todos"/"Marcar todos" clear and restore the view', () => {
    openCentralSettingsModal(baseParams({ userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    root().querySelector<HTMLElement>('[data-tab="incidents"]')!.click();
    const content = root().querySelector<HTMLElement>('#incidents-tab-content')!;

    const slave2Checkbox = Array.from(
      content.querySelectorAll<HTMLInputElement>('[data-role="incidents-device-checkbox"]')
    ).find((cb) => cb.value === 'slave 2')!;
    slave2Checkbox.checked = false;
    slave2Checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(Array.from(content.querySelectorAll('.incidents-device__name')).map((el) => el.textContent)).toEqual([
      'Hidr. Outback',
    ]);

    content.querySelector<HTMLElement>('[data-role="incidents-devices-none"]')!.click();
    expect(content.querySelector('.incidents-kpi-empty')).toBeTruthy();
    expect(content.querySelector('.incidents-empty')).toBeTruthy();
    expect(content.querySelector('[data-role="incidents-devices-summary"]')?.textContent).toBe('0 de 2');

    content.querySelector<HTMLElement>('[data-role="incidents-devices-all"]')!.click();
    expect(Array.from(content.querySelectorAll('.incidents-device__name')).map((el) => el.textContent)).toEqual([
      'Hidr. Outback',
      'slave 2',
    ]);
    expect(content.querySelector('[data-role="incidents-devices-summary"]')?.textContent).toBe('Todos (2)');
  });

  it('mounts a unique period date-range container per instance (no duplicate-id collision across simultaneous modals)', () => {
    openCentralSettingsModal(baseParams({ id: 'c1', userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    openCentralSettingsModal(baseParams({ id: 'c2', userEmail: 'admin@myio.com.br', interpolatedSlots: SLOTS }));
    const mounts = Array.from(document.querySelectorAll<HTMLElement>('.incidents-daterange-mount'));
    expect(mounts).toHaveLength(2);
    expect(mounts[0].id).not.toBe(mounts[1].id);
    expect(mounts[0].id).toMatch(/^incidents-daterange-/);
  });
});
