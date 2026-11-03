// Aba "Equipamentos da Retrolavagem": hidrômetros de entrada/saída (até 10 + 10) gravados no
// atributo SERVER_SCOPE `retrolavagemBindings` do device HIDROMETRO_ENTRADA_RETROLAVAGEM.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';
import {
  RetrolavagemTab,
  isRetrolavagemCandidateProfile,
  normalizeRetrolavagemBindings,
} from '../../../src/components/premium-modals/settings/retrolavagem/RetrolavagemTab';

const catalog = [
  { id: { id: 'retro-1' }, name: 'Hidr. STB_Retrolavagem' },
  { id: { id: 'in-1' }, name: 'Entrada filtro A' },
  { id: { id: 'in-2' }, name: 'Entrada filtro B' },
  { id: { id: 'out-1' }, name: 'Saída filtro' },
  { id: { id: 'pump-1' }, name: 'Bomba poço' },
  { id: { id: 'manual-1' }, name: 'Hidr. manual' },
];
const attrs: Record<string, Array<{ key: string; value: unknown }>> = {
  'in-1': [{ key: 'deviceProfile', value: 'HIDROMETRO_AREA_COMUM' }, { key: 'gcdrDeviceId', value: 'g-in-1' }],
  'in-2': [{ key: 'deviceProfile', value: 'HIDROMETRO' }],
  'out-1': [{ key: 'deviceProfile', value: 'HIDROMETRO_SHOPPING' }],
  'pump-1': [{ key: 'deviceProfile', value: 'BOMBA_POCO' }],
  'manual-1': [{ key: 'deviceProfile', value: 'HIDROMETRO_MANUAL' }],
};

const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });

function openTab(stored: unknown = undefined, writeOk = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') return response({}, writeOk, writeOk ? 200 : 500);
    if (url.includes('/api/customer/customer-1/devices')) return response({ data: catalog, hasNext: false });
    if (url.includes('/retro-1/values/attributes/')) {
      return response(stored === undefined ? [] : [{ key: 'retrolavagemBindings', value: stored }]);
    }
    const id = Object.keys(attrs).find((k) => url.includes(`/${k}/values/attributes/`));
    return response(attrs[id || ''] || []);
  });
  vi.stubGlobal('fetch', fetchMock);
  const tab = new RetrolavagemTab({
    container,
    deviceId: 'retro-1',
    customerId: 'customer-1',
    jwtToken: 'jwt',
    tbBaseUrl: 'https://thingsboard.test',
  });
  return { container, fetchMock, tab };
}

const click = (container: HTMLElement, selector: string) => container.querySelector<HTMLButtonElement>(selector)!.click();
function choose(container: HTMLElement, side: 'inputs' | 'outputs', index: number, value: string) {
  const el = container.querySelector<HTMLSelectElement>(`select[data-side="${side}"][data-index="${index}"]`)!;
  el.value = value;
  el.dispatchEvent(new Event('change'));
}
const posted = (fetchMock: ReturnType<typeof vi.fn>) => {
  const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
  return call ? JSON.parse(String((call[1] as RequestInit).body)) : null;
};
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('RetrolavagemTab — regras puras', () => {
  it('só hidrômetros entram na lista (sem a própria retrolavagem e sem *_MANUAL)', () => {
    expect(isRetrolavagemCandidateProfile('HIDROMETRO')).toBe(true);
    expect(isRetrolavagemCandidateProfile('hidrometro_shopping')).toBe(true);
    expect(isRetrolavagemCandidateProfile('HIDROMETRO_ENTRADA_RETROLAVAGEM')).toBe(false);
    expect(isRetrolavagemCandidateProfile('HIDROMETRO_MANUAL')).toBe(false);
    expect(isRetrolavagemCandidateProfile('BOMBA_POCO')).toBe(false);
  });

  it('normalizeRetrolavagemBindings: aceita string, remove inválidos/duplicados e limita a 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ tbId: `d${i}`, label: `D${i}` }));
    const r = normalizeRetrolavagemBindings(
      JSON.stringify({ inputs: [{ tbId: 'a', label: 'A' }, { tbId: 'a', label: 'A2' }, { label: 'sem id' }], outputs: many })
    );
    expect(r.inputs).toEqual([{ tbId: 'a', label: 'A' }]);
    expect(r.outputs).toHaveLength(10);
    expect(normalizeRetrolavagemBindings('não é json')).toEqual({ version: 1, inputs: [], outputs: [] });
  });
});

describe('RetrolavagemTab — tela', () => {
  it('lista só hidrômetros elegíveis e mostra a nota da conta automática quando não há vínculo', async () => {
    const { container, tab } = openTab();
    await tab.init();
    const values = [...container.querySelectorAll('button[data-add]')].map((b) => b.textContent);
    expect(values).toEqual(['+ Adicionar entrada', '+ Adicionar saída']);
    expect(container.textContent).toContain('conta automática');
    click(container, 'button[data-add="inputs"]');
    const options = [...container.querySelectorAll('select[data-side="inputs"] option')].map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['', 'in-1', 'in-2', 'out-1']); // ordem alfabética; sem retro, bomba e manual
  });

  it('salva entradas e saídas no atributo retrolavagemBindings', async () => {
    const { container, fetchMock, tab } = openTab();
    await tab.init();
    click(container, 'button[data-add="inputs"]');
    choose(container, 'inputs', 0, 'in-1');
    click(container, 'button[data-add="inputs"]');
    choose(container, 'inputs', 1, 'in-2');
    click(container, 'button[data-add="outputs"]');
    choose(container, 'outputs', 0, 'out-1');
    click(container, '#rlt-save');
    await flush();
    expect(posted(fetchMock)).toEqual({
      retrolavagemBindings: {
        version: 1,
        inputs: [
          { tbId: 'in-1', label: 'Entrada filtro A', gcdrId: 'g-in-1' },
          { tbId: 'in-2', label: 'Entrada filtro B' },
        ],
        outputs: [{ tbId: 'out-1', label: 'Saída filtro' }],
      },
    });
    const postUrl = String(fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === 'POST')![0]);
    expect(postUrl).toBe('https://thingsboard.test/api/plugins/telemetry/DEVICE/retro-1/attributes/SERVER_SCOPE');
    expect(container.querySelector('#rlt-message')!.textContent).toContain('Vínculos salvos');
  });

  it('bloqueia o mesmo hidrômetro na entrada e na saída', async () => {
    const { container, fetchMock, tab } = openTab();
    await tab.init();
    click(container, 'button[data-add="inputs"]');
    choose(container, 'inputs', 0, 'in-1');
    click(container, 'button[data-add="outputs"]');
    choose(container, 'outputs', 0, 'in-1');
    click(container, '#rlt-save');
    await flush();
    expect(posted(fetchMock)).toBeNull();
    expect(container.querySelector('#rlt-message')!.textContent).toContain('na entrada e na saída');
  });

  it('limite de 10 por lado: o botão de adicionar desabilita', async () => {
    const stored = { inputs: Array.from({ length: 10 }, (_, i) => ({ tbId: `x${i}`, label: `X${i}` })), outputs: [] };
    const { container, tab } = openTab(stored);
    await tab.init();
    expect(container.querySelector<HTMLButtonElement>('button[data-add="inputs"]')!.disabled).toBe(true);
    expect(container.querySelector('fieldset[data-side="inputs"] .rlt-count')!.textContent).toBe('10/10');
  });

  it('vínculo salvo que saiu da lista continua visível e pode ser mantido', async () => {
    const { container, fetchMock, tab } = openTab({ inputs: [{ tbId: 'gone-1', label: 'Hidr. removido' }], outputs: [] });
    await tab.init();
    const opt = container.querySelector<HTMLOptionElement>('select[data-side="inputs"] option[data-unavailable="true"]')!;
    expect(opt.textContent).toContain('Hidr. removido');
    click(container, '#rlt-save');
    await flush();
    expect(posted(fetchMock).retrolavagemBindings.inputs).toEqual([{ tbId: 'gone-1', label: 'Hidr. removido' }]);
  });

  it('remover todas as linhas e salvar volta para a conta automática (listas vazias)', async () => {
    const { container, fetchMock, tab } = openTab({ inputs: [{ tbId: 'in-1', label: 'A' }], outputs: [] });
    await tab.init();
    click(container, 'button[data-remove="inputs"][data-index="0"]');
    click(container, '#rlt-save');
    await flush();
    expect(posted(fetchMock)).toEqual({ retrolavagemBindings: { version: 1, inputs: [], outputs: [] } });
  });

  it('falha ao gravar mostra o erro e reabilita o botão', async () => {
    const { container, tab } = openTab(undefined, false);
    await tab.init();
    click(container, '#rlt-save');
    await flush();
    expect(container.querySelector('#rlt-message')!.textContent).toContain('Falha ao salvar');
    expect(container.querySelector<HTMLButtonElement>('#rlt-save')!.disabled).toBe(false);
  });
});

describe('SettingsModalView — aba da retrolavagem', () => {
  const baseConfig = {
    deviceId: 'retro-1',
    customerId: 'customer-1',
    jwtToken: 'jwt',
    tbBaseUrl: 'https://thingsboard.test',
    domain: 'water',
    themeMode: 'light',
    onSave: async () => undefined,
    onClose: () => undefined,
  };

  it('aparece só para HIDROMETRO_ENTRADA_RETROLAVAGEM + SuperAdmin', () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([])));
    const make = (deviceProfile: string, superadmin: boolean) => {
      document.body.innerHTML = '';
      const view = new SettingsModalView({ ...baseConfig, deviceProfile, superadmin } as any);
      view.render({});
      return !!document.querySelector('[data-tab="retrolavagem"]');
    };
    expect(make('HIDROMETRO_ENTRADA_RETROLAVAGEM', true)).toBe(true);
    expect(make('HIDROMETRO_ENTRADA_RETROLAVAGEM', false)).toBe(false);
    expect(make('HIDROMETRO', true)).toBe(false);
  });
});
