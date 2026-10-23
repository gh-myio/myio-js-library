/**
 * Campos comerciais do SettingsModal (ABL / Contrato / Segmento → Atividade):
 * visíveis só para @myio / superadmin; Atividade carrega depois do Segmento.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
// Ciclo pré-existente SettingsModalView ↔ CentralSettingsModal: carregar pelo
// central-settings primeiro (mesma ordem do centralSettingsModal.test.ts).
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';
import {
  DEFAULT_STORE_SEGMENTS,
  activitiesForSegment,
  loadStoreSegmentCatalog,
} from '../../../src/components/premium-modals/settings/commercialCatalog';

const flush = () => new Promise((r) => setTimeout(r, 0));

function openView(overrides: Record<string, unknown> = {}, initialData: Record<string, unknown> = {}) {
  const view = new SettingsModalView({
    title: 'Settings',
    domain: 'energy',
    mapInstantaneousPower: {},
    deviceMapInstaneousPower: {},
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  } as any);
  view.render(initialData);
  return view;
}

const modal = () => {
  const els = document.querySelectorAll<HTMLElement>('.myio-device-settings-modal');
  return els[els.length - 1];
};
const q = <T extends Element>(sel: string) => modal().querySelector<T>(sel);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
});

afterEach(() => {
  document.querySelectorAll('.myio-device-settings-overlay').forEach((el) => el.remove());
  vi.unstubAllGlobals();
});

describe('commercialCatalog helpers', () => {
  it('loadStoreSegmentCatalog: sem fonte → catálogo padrão; loader async é usado', async () => {
    expect(await loadStoreSegmentCatalog()).toBe(DEFAULT_STORE_SEGMENTS);
    const custom = [{ segment: 'A', activities: ['a1'] }];
    expect(await loadStoreSegmentCatalog(async () => custom)).toEqual(custom);
  });

  it('loadStoreSegmentCatalog: loader que falha ou volta vazio → catálogo padrão', async () => {
    expect(await loadStoreSegmentCatalog(async () => { throw new Error('x'); })).toBe(DEFAULT_STORE_SEGMENTS);
    expect(await loadStoreSegmentCatalog([])).toBe(DEFAULT_STORE_SEGMENTS);
  });

  it('activitiesForSegment preserva atividade salva fora do catálogo', () => {
    const cat = [{ segment: 'A', activities: ['a1', 'a2'] }];
    expect(activitiesForSegment(cat, 'A')).toEqual(['a1', 'a2']);
    expect(activitiesForSegment(cat, 'A', 'antiga')).toEqual(['a1', 'a2', 'antiga']);
    expect(activitiesForSegment(cat, 'X')).toEqual([]);
  });
});

describe('SettingsModalView — campos comerciais', () => {
  it('não renderiza para usuário sem @myio', () => {
    openView({ userEmail: 'cliente@shopping.com.br' });
    expect(q('#abl')).toBeNull();
    expect(q('#segment')).toBeNull();
  });

  it('renderiza ABL, Contrato, Segmento e Atividade para @myio', () => {
    openView({ userEmail: 'rodrigo@myio.com.br' });
    expect(q('#abl')).not.toBeNull();
    expect(q('#contract')).not.toBeNull();
    expect(q('#segment')).not.toBeNull();
    expect(q('#activity')).not.toBeNull();
  });

  it('título "Dados de Cadastro | <CUSTOMER>" (config ou fallback MyIOUtils.customerName)', () => {
    openView({ userEmail: 'rodrigo@myio.com.br', customerName: 'Mestre Álvaro' });
    expect(q('.commercial-title')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Dados de Cadastro | MESTRE ÁLVARO');
    document.querySelectorAll('.myio-device-settings-overlay').forEach((el) => el.remove());

    (window as any).MyIOUtils = { customerName: 'Shopping Taboão' };
    openView({ userEmail: 'rodrigo@myio.com.br' });
    expect(q('.commercial-title')!.textContent).toContain('SHOPPING TABOÃO');
    delete (window as any).MyIOUtils;
  });

  it('renderiza para superadmin explícito', () => {
    openView({ superadmin: true });
    expect(q('#abl')).not.toBeNull();
  });

  it('Atividade só carrega depois do Segmento (cascata) e grava no form', async () => {
    const catalog = [
      { segment: 'Alimentação', activities: ['Fast food', 'Restaurante'] },
      { segment: 'Vestuário', activities: ['Moda feminina'] },
    ];
    const view = openView({ userEmail: 'rodrigo@myio.com.br', segmentCatalog: catalog });
    await flush();

    const seg = q<HTMLSelectElement>('#segment')!;
    const act = q<HTMLSelectElement>('#activity')!;
    expect(seg.disabled).toBe(false);
    expect([...seg.options].map((o) => o.value)).toEqual(['', 'Alimentação', 'Vestuário']);
    expect(act.disabled).toBe(true);

    seg.value = 'Alimentação';
    seg.dispatchEvent(new Event('change'));
    expect(act.disabled).toBe(false);
    expect([...act.options].map((o) => o.value)).toEqual(['', 'Fast food', 'Restaurante']);

    act.value = 'Restaurante';
    q<HTMLInputElement>('#abl')!.value = '120,5 m²';
    q<HTMLInputElement>('#contract')!.value = 'CT-0042';
    const data = view.getFormData();
    expect(data).toMatchObject({ abl: '120,5 m²', contract: 'CT-0042', segment: 'Alimentação', activity: 'Restaurante' });
  });

  it('restaura valores salvos (inclusive atividade fora do catálogo)', async () => {
    const catalog = [{ segment: 'Alimentação', activities: ['Fast food'] }];
    openView(
      { userEmail: 'rodrigo@myio.com.br', segmentCatalog: catalog },
      { abl: '80', contract: 'C-1', segment: 'Alimentação', activity: 'Food truck' }
    );
    await flush();

    expect(q<HTMLInputElement>('#abl')!.value).toBe('80');
    expect(q<HTMLInputElement>('#contract')!.value).toBe('C-1');
    expect(q<HTMLSelectElement>('#segment')!.value).toBe('Alimentação');
    expect(q<HTMLSelectElement>('#activity')!.value).toBe('Food truck');
  });
});
