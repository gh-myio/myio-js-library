/**
 * RFC-0207 "Dispositivos Específicos" — UI do picker no modal de perfil.
 *
 * Cobre o que o spec exige da UI: seção só na Climatização, "+" abre o picker,
 * busca por label, devices já adicionados somem da lista (não dá para adicionar
 * duas vezes), chips removíveis, modo read-only sem "+", e round-trip do campo
 * novo pelo `onSave`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDeviceProfileModal } from '../src/components/premium-modals/device-profile/openDeviceProfileModal';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  setActiveProfile,
  type DeviceClassificationProfile,
} from '../src/utils/devices/deviceClassificationProfile';

const DEVICES = [
  { id: 'dev-trafo-cag', label: 'Medição Geral CAG', deviceProfile: 'ENTRADA', identifier: 'CAG' },
  { id: 'dev-entrada', label: 'Geral Entrada', deviceProfile: 'ENTRADA', identifier: 'ENTRADA-GERAL' },
  { id: 'dev-bomba-3', label: 'Bomba CAG 3', deviceProfile: 'BOMBA_CAG', identifier: 'CAG' },
  { id: 'dev-bomba-4', label: 'Bomba CAG 4', deviceProfile: 'BOMBA_CAG', identifier: 'CAG' },
  { id: 'dev-elevador', label: 'Elevador Social 1', deviceProfile: 'ELEVADOR', identifier: 'ELV-01' },
];

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function open(opts: Partial<Parameters<typeof openDeviceProfileModal>[0]> = {}) {
  return openDeviceProfileModal({
    customerId: 'cust-1',
    canEdit: true,
    getDevices: () => clone(DEVICES),
    ...opts,
  });
}

/** Índice da regra `climatizacao` dentro de categories.rules (cat-N nos data-attrs). */
const CLIMA_IDX = DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy.categories!.rules.findIndex(
  (r) => r.name === 'climatizacao',
);

function overrideSectionEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.mdp-ovr');
}
function addButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.mdp-ovr-add'));
}
function pickerRowNames(): string[] {
  return Array.from(document.querySelectorAll('.mdp-picker-row .mdp-picker-name')).map(
    (el) => el.textContent?.trim() || '',
  );
}
function chipTexts(): string[] {
  return Array.from(document.querySelectorAll('.mdp-ovr-chip')).map((el) =>
    (el.textContent || '').replace(/\s+/g, ' ').trim(),
  );
}
function pick(label: string, mode: 'include' | 'exclude') {
  const row = Array.from(document.querySelectorAll('.mdp-picker-row')).find(
    (r) => r.querySelector('.mdp-picker-name')?.textContent?.trim() === label,
  );
  if (!row) throw new Error(`picker row not found: ${label}`);
  row.querySelector<HTMLButtonElement>(`.mdp-picker-pick.is-${mode}`)!.click();
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

describe('openDeviceProfileModal — seção Dispositivos Específicos', () => {
  it('renderiza a seção APENAS na categoria Climatização', () => {
    handle = open();
    const sections = document.querySelectorAll('.mdp-ovr');
    expect(sections.length).toBe(1);
    expect(overrideSectionEl()!.textContent).toContain('Dispositivos Específicos');
    expect(addButtons()).toHaveLength(1);
    expect(addButtons()[0].dataset.cat).toBe(String(CLIMA_IDX));
  });

  it('parte vazia e o "+" abre o picker com busca (lupa)', () => {
    handle = open();
    expect(overrideSectionEl()!.textContent).toContain('Nenhum dispositivo específico');
    expect(document.querySelector('.mdp-picker')).toBeNull();

    addButtons()[0].click();

    expect(document.querySelector('.mdp-picker')).not.toBeNull();
    expect(document.querySelector('.mdp-picker-mag')?.textContent).toBe('🔍');
    expect(document.querySelector('.mdp-picker-input')).not.toBeNull();
    expect(pickerRowNames()).toEqual(DEVICES.map((d) => d.label));
  });

  it('a busca filtra por device.label', () => {
    handle = open();
    addButtons()[0].click();
    const input = document.querySelector<HTMLInputElement>('.mdp-picker-input')!;
    input.value = 'bomba';
    input.dispatchEvent(new Event('input'));
    expect(pickerRowNames()).toEqual(['Bomba CAG 3', 'Bomba CAG 4']);

    input.value = 'zzz-nao-existe';
    input.dispatchEvent(new Event('input'));
    expect(pickerRowNames()).toEqual([]);
    expect(document.querySelector('.mdp-picker-list')!.textContent).toContain('Nenhum dispositivo');
  });

  it('o picker REMOVE os devices já adicionados (não dá para adicionar duas vezes)', () => {
    handle = open();
    addButtons()[0].click();
    pick('Medição Geral CAG', 'include');

    // chip criado, picker fechado
    expect(chipTexts().some((t) => t.includes('Medição Geral CAG'))).toBe(true);
    expect(document.querySelector('.mdp-picker')).toBeNull();

    // reabre: o device já adicionado não está mais na lista
    addButtons()[0].click();
    const names = pickerRowNames();
    expect(names).not.toContain('Medição Geral CAG');
    expect(names).toEqual(['Geral Entrada', 'Bomba CAG 3', 'Bomba CAG 4', 'Elevador Social 1']);

    // e continua fora depois de uma busca (o filtro roda sobre a lista já reduzida)
    const input = document.querySelector<HTMLInputElement>('.mdp-picker-input')!;
    input.value = 'CAG';
    input.dispatchEvent(new Event('input'));
    expect(pickerRowNames()).toEqual(['Bomba CAG 3', 'Bomba CAG 4']);
  });

  it('marca incluir/excluir e a chip mostra o modo', () => {
    handle = open();
    addButtons()[0].click();
    pick('Medição Geral CAG', 'include');
    addButtons()[0].click();
    pick('Bomba CAG 3', 'exclude');

    const chips = chipTexts();
    expect(chips.some((t) => t.startsWith('incluir') && t.includes('Medição Geral CAG'))).toBe(true);
    expect(chips.some((t) => t.startsWith('excluir') && t.includes('Bomba CAG 3'))).toBe(true);
    expect(document.querySelectorAll('.mdp-ovr-chip.is-include')).toHaveLength(1);
    expect(document.querySelectorAll('.mdp-ovr-chip.is-exclude')).toHaveLength(1);
  });

  it('cada chip é removível', () => {
    handle = open();
    addButtons()[0].click();
    pick('Medição Geral CAG', 'include');
    expect(document.querySelectorAll('.mdp-ovr-chip')).toHaveLength(1);

    document.querySelector<HTMLButtonElement>('.mdp-ovr-x')!.click();
    expect(document.querySelectorAll('.mdp-ovr-chip')).toHaveLength(0);
    expect(overrideSectionEl()!.textContent).toContain('Nenhum dispositivo específico');
  });

  it('read-only (canEdit=false): sem "+" e sem "×" nas chips', () => {
    const profile: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    profile.domains.energy.categories!.rules[CLIMA_IDX].deviceOverrides = [
      { id: 'dev-trafo-cag', label: 'Medição Geral CAG', mode: 'include' },
    ];
    handle = open({ canEdit: false, profile });

    expect(overrideSectionEl()).not.toBeNull();
    expect(addButtons()).toHaveLength(0);
    expect(document.querySelectorAll('.mdp-ovr-x')).toHaveLength(0);
    expect(document.querySelectorAll('.mdp-picker')).toHaveLength(0);
    // a chip existente continua visível
    expect(chipTexts().some((t) => t.includes('Medição Geral CAG'))).toBe(true);
  });

  it('getDevices vazio/ausente não quebra — mostra dica', () => {
    handle = open({ getDevices: undefined });
    expect(addButtons()).toHaveLength(1);
    addButtons()[0].click();
    expect(document.querySelector('.mdp-picker-list')!.textContent).toContain(
      'Nenhum dispositivo disponível',
    );
  });

  it('getDevices que lança não quebra o modal', () => {
    handle = open({
      getDevices: () => {
        throw new Error('boom');
      },
    });
    expect(overrideSectionEl()).not.toBeNull();
    addButtons()[0].click();
    expect(document.querySelector('.mdp-picker')).not.toBeNull();
  });

  it('device removido do dashboard aparece com o label salvo + aviso "não encontrado"', () => {
    const profile: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    profile.domains.energy.categories!.rules[CLIMA_IDX].deviceOverrides = [
      { id: 'dev-que-sumiu', label: 'Trafo Antigo', mode: 'include' },
    ];
    handle = open({ profile });
    const chip = document.querySelector('.mdp-ovr-chip')!;
    expect(chip.classList.contains('is-missing')).toBe(true);
    expect(chip.textContent).toContain('Trafo Antigo');
    expect(chip.querySelector('.mdp-ovr-warn')).not.toBeNull();
  });

  it('round-trip: o campo novo chega ao onSave e some quando esvaziado', async () => {
    const onSave = vi.fn();
    handle = open({ onSave, userName: 'tester' });

    addButtons()[0].click();
    pick('Medição Geral CAG', 'include');
    addButtons()[0].click();
    pick('Bomba CAG 3', 'exclude');

    document.getElementById('mdp-save')!.click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());

    const saved: DeviceClassificationProfile = onSave.mock.calls[0][0];
    const rule = saved.domains.energy.categories!.rules[CLIMA_IDX];
    expect(rule.deviceOverrides).toEqual([
      { id: 'dev-trafo-cag', label: 'Medição Geral CAG', mode: 'include' },
      { id: 'dev-bomba-3', label: 'Bomba CAG 3', mode: 'exclude' },
    ]);
    // as demais regras continuam sem o campo (opt-in)
    expect(saved.domains.energy.categories!.rules.filter((r) => r.deviceOverrides).length).toBe(1);
  });

  it('remover a última chip apaga a chave do JSON salvo (perfil volta ao formato anterior)', async () => {
    const onSave = vi.fn();
    handle = open({ onSave });
    addButtons()[0].click();
    pick('Medição Geral CAG', 'include');
    document.querySelector<HTMLButtonElement>('.mdp-ovr-x')!.click();

    document.getElementById('mdp-save')!.click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved: DeviceClassificationProfile = onSave.mock.calls[0][0];
    expect(saved.domains.energy.categories!.rules[CLIMA_IDX].deviceOverrides).toBeUndefined();
  });

  it('o preview ao vivo reflete os overrides (exclude some, include muda de bucket)', () => {
    handle = open();
    const breakdownText = () =>
      Array.from(document.querySelectorAll('#mdp-preview-cats .mdp-pv-row'))
        .map((r) => r.textContent?.replace(/\s+/g, ' ').trim() || '')
        .join(' | ');

    // baseline: 2 bombas + o trafo (identifier CAG) caem em climatizacao
    expect(breakdownText()).toMatch(/climatizacao\s*3/);

    addButtons()[0].click();
    pick('Bomba CAG 3', 'exclude');
    addButtons()[0].click();
    pick('Bomba CAG 4', 'exclude');

    // as duas bombas saíram do breakdown por completo; sobrou o trafo
    expect(breakdownText()).toMatch(/climatizacao\s*1/);
    expect(breakdownText()).not.toMatch(/Bomba CAG 3/);
  });

  it('a seção NÃO aparece nas abas água/temperatura (sem breakdown)', () => {
    handle = open();
    const waterTab = Array.from(document.querySelectorAll<HTMLButtonElement>('.mdp-tab')).find(
      (t) => t.dataset.domain === 'water',
    )!;
    waterTab.click();
    expect(document.querySelector('.mdp-ovr')).toBeNull();
  });
});
