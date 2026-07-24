/**
 * RFC-0207 "parent" — terceira opção ("como pai") no picker de Dispositivos
 * Específicos do modal de perfil.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDeviceProfileModal } from '../src/components/premium-modals/device-profile/openDeviceProfileModal';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  setActiveProfile,
  type DeviceClassificationProfile,
} from '../src/utils/devices/deviceClassificationProfile';

const DEVICES = [
  { id: 'dev-cag-entrada', label: 'CAG-Entrada', deviceProfile: 'ENTRADA', identifier: 'CAG' },
  { id: 'dev-chiller', label: 'Chiller 1', deviceProfile: 'CHILLER', identifier: 'CHILLER-01' },
];

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

const CLIMA_IDX = DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy.categories!.rules.findIndex(
  (r) => r.name === 'climatizacao',
);

function open(opts: Partial<Parameters<typeof openDeviceProfileModal>[0]> = {}) {
  return openDeviceProfileModal({
    customerId: 'cust-1',
    canEdit: true,
    getDevices: () => clone(DEVICES),
    ...opts,
  });
}

function addButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.mdp-ovr-add'));
}
function pick(label: string, mode: 'include' | 'exclude' | 'parent') {
  const row = Array.from(document.querySelectorAll('.mdp-picker-row')).find(
    (r) => r.querySelector('.mdp-picker-name')?.textContent?.trim() === label,
  );
  if (!row) throw new Error(`picker row not found: ${label}`);
  row.querySelector<HTMLButtonElement>(`.mdp-picker-pick.is-${mode}`)!.click();
}
function chipTexts(): string[] {
  return Array.from(document.querySelectorAll('.mdp-ovr-chip')).map((el) =>
    (el.textContent || '').replace(/\s+/g, ' ').trim(),
  );
}

let handle: { close: () => void } | null = null;

beforeEach(() => {
  document.body.innerHTML = '';
  setActiveProfile(null);
});
afterEach(() => {
  try {
    handle?.close();
  } catch {
    /* noop */
  }
  handle = null;
  document.body.innerHTML = '';
  setActiveProfile(null);
});

describe('openDeviceProfileModal — modo "como pai"', () => {
  it('o picker oferece as TRÊS opções (incluir / como pai / excluir)', () => {
    handle = open();
    addButtons()[0].click();
    const row = document.querySelector('.mdp-picker-row')!;
    const modes = Array.from(row.querySelectorAll<HTMLButtonElement>('.mdp-picker-pick')).map(
      (b) => b.dataset.mode,
    );
    expect(modes).toEqual(['include', 'parent', 'exclude']);
    expect(row.querySelector('.mdp-picker-pick.is-parent')?.textContent?.trim()).toBe('como pai');
  });

  it('escolher "como pai" cria uma chip com o modo e a classe is-parent', () => {
    handle = open();
    addButtons()[0].click();
    pick('CAG-Entrada', 'parent');

    expect(document.querySelectorAll('.mdp-ovr-chip.is-parent')).toHaveLength(1);
    expect(chipTexts().some((t) => t.startsWith('como pai') && t.includes('CAG-Entrada'))).toBe(true);
    // não é confundido com include/exclude
    expect(document.querySelectorAll('.mdp-ovr-chip.is-include')).toHaveLength(0);
    expect(document.querySelectorAll('.mdp-ovr-chip.is-exclude')).toHaveLength(0);
  });

  it('round-trip: o modo "parent" chega ao onSave', async () => {
    const onSave = vi.fn();
    handle = open({ onSave, userName: 'tester' });
    addButtons()[0].click();
    pick('CAG-Entrada', 'parent');

    document.getElementById('mdp-save')!.click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved: DeviceClassificationProfile = onSave.mock.calls[0][0];
    expect(saved.domains.energy.categories!.rules[CLIMA_IDX].deviceOverrides).toEqual([
      { id: 'dev-cag-entrada', label: 'CAG-Entrada', mode: 'parent' },
    ]);
  });

  it('read-only renderiza a chip "como pai" salva (sem remover)', () => {
    const profile: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    profile.domains.energy.categories!.rules[CLIMA_IDX].deviceOverrides = [
      { id: 'dev-cag-entrada', label: 'CAG-Entrada', mode: 'parent' },
    ];
    handle = open({ canEdit: false, profile });
    expect(document.querySelectorAll('.mdp-ovr-chip.is-parent')).toHaveLength(1);
    expect(chipTexts().some((t) => t.includes('como pai') && t.includes('CAG-Entrada'))).toBe(true);
    expect(document.querySelectorAll('.mdp-ovr-x')).toHaveLength(0);
    expect(addButtons()).toHaveLength(0);
  });
});
