/**
 * Shopping v-5.2.0 — devices *_MANUAL de loja (3F_MEDIDOR_MANUAL / HIDROMETRO_MANUAL) em Lojas,
 * com opt-in por customer (SERVER_SCOPE `includeManualStoresInLojas`).
 *
 * As funções são extraídas do código-fonte dos controllers e avaliadas com o `resolveGroup` real
 * da lib. Com o opt-in, os manuais de loja:
 *  - continuam no grupo MANUAL (aba própria) e entram TAMBÉM em `regular` → Lojas/totais/relatórios;
 *  - caem em Lojas (energia e água) — o resolver sozinho mandaria 3F_MEDIDOR_MANUAL p/ Área Comum;
 *  - ficam ACTIVE no filtro "Status Disp." (sem conectividade, status fixo online).
 * Sem o opt-in, o comportamento é o anterior: ficam só na aba MANUAL e fora dos relatórios.
 */
import { describe, expect, it, vi } from 'vitest';
import { resolveGroup } from '../../src/utils/devices/deviceClassificationProfile';
import { extractBlockAfter, extractFunction, readControllerSource } from './helpers/extractControllerFunction';

const MAIN_SRC = readControllerSource('MAIN_VIEW');
const HEADER_SRC = readControllerSource('HEADER');

type Fns = {
  _isManualStore: (item: any) => boolean;
  _splitManualItems: (items: any[]) => { regular: any[]; manual: any[] };
  categorizeItemsByGroup: (items: any[]) => Record<string, any[]>;
  categorizeItemsByGroupWater: (items: any[]) => Record<string, any[]>;
  _resolveDeviceGcdrStatus: (item: any) => string;
};

type FakeWindow = { MyIOLibrary: { resolveGroup: typeof resolveGroup }; MyIOUtils: { manualStoresInLojas?: boolean } };

const fakeWindowWith = (manualStoresInLojas?: boolean): FakeWindow => ({
  MyIOLibrary: { resolveGroup },
  MyIOUtils: manualStoresInLojas === undefined ? {} : { manualStoresInLojas },
});

/** Uma "avaliação" do controller: funções reais do MAIN_VIEW num escopo próprio, sobre o `window` dado. */
function evaluateMain(win: FakeWindow): Fns {
  const names = [
    '_isManualDevice',
    '_isManualStore',
    '_splitManualItems',
    'categorizeItemsByGroup',
    'categorizeItemsByGroupWater',
    '_resolveDeviceGcdrStatus',
  ];
  const LogHelper = { log: () => {}, warn: () => {}, error: () => {} };
  const gcdrIndex = { byGcdrId: new Map(), byTbId: new Map([['tb-loja', 'INACTIVE']]) };
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'LogHelper',
    '_gcdrDeviceStatusIndex',
    `${names.map((n) => extractFunction(MAIN_SRC, n)).join('\n')}\nreturn { ${names.join(', ')} };`
  );
  return factory(win, LogHelper, gcdrIndex);
}

const loadMain = (manualStoresInLojas: boolean): Fns => evaluateMain(fakeWindowWith(manualStoresInLojas));

function loadHeaderMerge(win: unknown): (domain: string, items: any[] | null) => any[] {
  // eslint-disable-next-line no-new-func
  return new Function(
    'window',
    `${extractFunction(HEADER_SRC, '_applyManualStoresToReportList')}\nreturn _applyManualStoresToReportList;`
  )(win);
}

const quiosque = (id: string) => ({ id, tbId: `tb-${id}`, deviceProfile: '3F_MEDIDOR_MANUAL', value: 12.5 });
const loja = { id: 'loja', tbId: 'tb-loja', deviceProfile: '3F_MEDIDOR', value: 100 };
const entrada = { id: 'ent', tbId: 'tb-ent', deviceProfile: 'ENTRADA', value: 500 };

describe('v-5.2.0 MAIN_VIEW — *_MANUAL de loja COM o opt-in', () => {
  const fns = loadMain(true);

  it('_isManualStore: só perfis de loja manuais', () => {
    expect(fns._isManualStore({ deviceProfile: '3F_MEDIDOR_MANUAL' })).toBe(true);
    expect(fns._isManualStore({ deviceProfile: 'hidrometro_manual' })).toBe(true);
    expect(fns._isManualStore({ deviceType: 'HIDROMETRO_MANUAL' })).toBe(true);
    expect(fns._isManualStore({ deviceProfile: '3F_MEDIDOR' })).toBe(false);
    expect(fns._isManualStore({ deviceProfile: 'ENTRADA_MANUAL' })).toBe(false);
    expect(fns._isManualStore(null)).toBe(false);
  });

  it('_splitManualItems: manual de loja vai para a aba MANUAL e também para regular (mesmo objeto)', () => {
    const other = { id: 'x', deviceProfile: 'ENTRADA_MANUAL' };
    const { regular, manual } = fns._splitManualItems([loja, quiosque('q1'), other]);
    expect(manual.map((i) => i.id)).toEqual(['q1', 'x']);
    expect(regular.map((i) => i.id)).toEqual(['loja', 'q1']);
    expect(regular[1]).toBe(manual[0]);
    expect(manual[0]).toMatchObject({ deviceStatus: 'power_on', connectionStatus: 'online', _isManual: true });
  });

  it('_splitManualItems é idempotente (populateState re-divide a saída do emitProvide)', () => {
    const first = fns._splitManualItems([loja, quiosque('q1')]);
    const second = fns._splitManualItems(first.regular);
    expect(second.regular.map((i) => i.id)).toEqual(['loja', 'q1']);
    expect(second.regular[1]).toBe(first.manual[0]); // sem cópia nova → valores consistentes
  });

  it('categorizeItemsByGroup: 3F_MEDIDOR_MANUAL → lojas (resolver sozinho mandaria p/ área comum)', () => {
    expect(resolveGroup({ deviceProfile: '3F_MEDIDOR_MANUAL' } as any).group).toBe('areacomum');
    const { regular } = fns._splitManualItems([loja, entrada, quiosque('q1'), quiosque('q2')]);
    const groups = fns.categorizeItemsByGroup(regular);
    expect(groups.lojas.map((i) => i.id)).toEqual(['loja', 'q1', 'q2']);
    expect(groups.entrada.map((i) => i.id)).toEqual(['ent']);
    expect(groups.areacomum).toHaveLength(0);
  });

  it('categorizeItemsByGroupWater: HIDROMETRO_MANUAL → lojas', () => {
    const hm = { id: 'hm', deviceProfile: 'HIDROMETRO_MANUAL', value: 3 };
    const { regular } = fns._splitManualItems([hm]);
    expect(fns.categorizeItemsByGroupWater(regular).lojas.map((i) => i.id)).toEqual(['hm']);
  });

  it('_resolveDeviceGcdrStatus: manual = ACTIVE; demais seguem o índice GCDR', () => {
    const { manual } = fns._splitManualItems([quiosque('q1')]);
    expect(fns._resolveDeviceGcdrStatus(manual[0])).toBe('ACTIVE');
    expect(fns._resolveDeviceGcdrStatus(loja)).toBe('INACTIVE');
    expect(fns._resolveDeviceGcdrStatus({ id: 'nope' })).toBe('UNKNOWN');
  });
});

describe('v-5.2.0 MAIN_VIEW — *_MANUAL SEM o opt-in (padrão)', () => {
  const fns = loadMain(false);

  it('_isManualStore é sempre false', () => {
    expect(fns._isManualStore({ deviceProfile: '3F_MEDIDOR_MANUAL' })).toBe(false);
    expect(fns._isManualStore({ deviceProfile: 'HIDROMETRO_MANUAL' })).toBe(false);
  });

  it('manual fica só na aba MANUAL: fora de regular, Lojas e totais', () => {
    const hm = { id: 'hm', deviceProfile: 'HIDROMETRO_MANUAL', value: 3 };
    const { regular, manual } = fns._splitManualItems([loja, quiosque('q1'), hm]);
    expect(manual.map((i) => i.id)).toEqual(['q1', 'hm']);
    expect(regular.map((i) => i.id)).toEqual(['loja']);
    expect(fns.categorizeItemsByGroup(regular).lojas.map((i) => i.id)).toEqual(['loja']);
  });
});

describe('v-5.2.0 MAIN_VIEW — várias avaliações do controller na mesma página', () => {
  // Taboão: uma avaliação anterior do controller (listeners em window que o onDestroy não remove)
  // continuava emitindo com o próprio flag = false e regravava Lojas sem os manuais ao trocar de aba.
  it('o opt-in é lido do window na hora: um escopo criado antes da leitura dos atributos também o aplica', () => {
    const win = fakeWindowWith(undefined); // atributos do customer ainda não lidos
    const antigo = evaluateMain(win);
    expect(antigo._isManualStore(quiosque('q1'))).toBe(false);

    win.MyIOUtils.manualStoresInLojas = true; // leitura dos atributos (por qualquer avaliação)
    const atual = evaluateMain(win);
    for (const scope of [antigo, atual]) {
      const { regular } = scope._splitManualItems([loja, quiosque('q1'), quiosque('q2')]);
      expect(scope.categorizeItemsByGroup(regular).lojas.map((i) => i.id)).toEqual(['loja', 'q1', 'q2']);
    }
  });

  it('desligar o opt-in no window vale para todos os escopos', () => {
    const win = fakeWindowWith(true);
    const a = evaluateMain(win);
    const b = evaluateMain(win);
    win.MyIOUtils.manualStoresInLojas = false;
    expect(a._isManualStore(quiosque('q1'))).toBe(false);
    expect(b._isManualStore(quiosque('q1'))).toBe(false);
  });
});

describe('v-5.2.0 HEADER — relatório geral × *_MANUAL', () => {
  const manualItems = [
    { id: 'tb-q1', ingestionId: 'ing-q1', deviceProfile: '3F_MEDIDOR_MANUAL', identifier: 'STB_QV_L1', label: 'Quiosque 1' },
    { id: 'tb-dup', ingestionId: 'ing-loja', deviceProfile: '3F_MEDIDOR_MANUAL', identifier: 'DUP', label: 'Duplicado' },
    { id: 'tb-x', ingestionId: 'ing-x', deviceProfile: 'ENTRADA_MANUAL', identifier: 'X', label: 'Não é loja' },
  ];
  const aliasList = [{ id: 'ing-loja', identifier: 'L1', label: 'Loja 1' }];

  it('com o opt-in: acrescenta os manuais de loja, por ingestionId e sem duplicar', () => {
    const merge = loadHeaderMerge({
      MyIOUtils: { manualStoresInLojas: true },
      MyIOOrchestratorData: { energy: { manualItems } },
    });
    expect(merge('energy', aliasList)).toEqual([
      ...aliasList,
      { id: 'ing-q1', identifier: 'STB_QV_L1', label: 'Quiosque 1' },
    ]);
    expect(aliasList).toHaveLength(1); // não muta a lista recebida
  });

  it('sem o opt-in: não acrescenta nada e continua excluindo *_MANUAL', () => {
    const merge = loadHeaderMerge({ MyIOUtils: {}, MyIOOrchestratorData: { energy: { manualItems } } });
    const list = [...aliasList, { id: 'm', deviceProfile: '3F_MEDIDOR_MANUAL' }];
    expect(merge('energy', list)).toEqual(aliasList);
    expect(merge('energy', null)).toEqual([]);
  });
});

type OptIn = {
  _manualStoresOptInBegin: (customerId?: string | null) => void;
  _manualStoresOptInSettle: (customerId: string | null | undefined, raw: unknown) => boolean;
};

/** Funções reais do opt-in (início do onInit / fim da leitura dos atributos) sobre o `window` dado. */
function evaluateOptIn(win: { MyIOUtils: Record<string, unknown> }): OptIn {
  const names = ['_manualStoresOptInOwner', '_manualStoresOptInBegin', '_manualStoresOptInSettle'];
  // eslint-disable-next-line no-new-func
  return new Function(
    'window',
    `${names.map((n) => extractFunction(MAIN_SRC, n)).join('\n')}\nreturn { _manualStoresOptInBegin, _manualStoresOptInSettle };`
  )(win);
}

describe('v-5.2.0 MAIN_VIEW — opt-in por customer (início do onInit / fim da leitura)', () => {
  it('corrida: avaliação nova no meio do onInit (leitura pendente) não tira os manuais de Lojas de uma antiga', () => {
    const win = fakeWindowWith(undefined) as FakeWindow & { MyIOUtils: Record<string, unknown> };
    // 1ª avaliação já leu os atributos do customer
    const primeira = evaluateOptIn(win);
    primeira._manualStoresOptInBegin('cust-1');
    primeira._manualStoresOptInSettle('cust-1', true);
    const antiga = evaluateMain(win);

    // avaliação nova (troca de aba / widget recriado): início do onInit, leitura dos atributos pendente
    const nova = evaluateOptIn(win);
    nova._manualStoresOptInBegin('cust-1');

    // a antiga emite nessa janela: os manuais continuam em Lojas
    const { regular } = antiga._splitManualItems([loja, quiosque('q1'), quiosque('q2')]);
    expect(antiga.categorizeItemsByGroup(regular).lojas.map((i) => i.id)).toEqual(['loja', 'q1', 'q2']);

    // a leitura termina com o mesmo valor: nada muda, nada a reemitir
    expect(nova._manualStoresOptInSettle('cust-1', true)).toBe(false);
    expect(antiga._isManualStore(quiosque('q1'))).toBe(true);
  });

  it('customer novo (navegação interna do TB, sem reload): zera já no início do onInit', () => {
    const win = fakeWindowWith(undefined) as FakeWindow & { MyIOUtils: Record<string, unknown> };
    const optIn = evaluateOptIn(win);
    optIn._manualStoresOptInSettle('cust-1', true);
    optIn._manualStoresOptInBegin('cust-2');
    expect(win.MyIOUtils.manualStoresInLojas).toBe(false);
    expect(win.MyIOUtils.manualStoresInLojasCustomerId).toBe('cust-2');
    expect(evaluateMain(win)._isManualStore(quiosque('q1'))).toBe(false);
  });

  it('leitura que falha (ou sem customer/jwt) → false, sem herdar o customer anterior', () => {
    const win = fakeWindowWith(undefined) as FakeWindow & { MyIOUtils: Record<string, unknown> };
    const optIn = evaluateOptIn(win);
    optIn._manualStoresOptInSettle('cust-1', true);
    optIn._manualStoresOptInBegin('cust-2');
    expect(optIn._manualStoresOptInSettle('cust-2', false)).toBe(false); // já estava false: nada a reemitir
    expect(win.MyIOUtils.manualStoresInLojas).toBe(false);

    // mesmo customer: leitura falha depois de um sucesso → desliga e pede reemissão
    optIn._manualStoresOptInSettle('cust-2', true);
    expect(optIn._manualStoresOptInSettle('cust-2', false)).toBe(true);
    expect(win.MyIOUtils.manualStoresInLojas).toBe(false);
  });

  it('valor lido: true / "true" / 1 / "1" ligam, o resto desliga; devolve true só quando muda', () => {
    const win = fakeWindowWith(undefined) as FakeWindow & { MyIOUtils: Record<string, unknown> };
    const { _manualStoresOptInSettle: settle } = evaluateOptIn(win);
    expect(settle('cust-1', 'true')).toBe(true);
    expect(settle('cust-1', true)).toBe(false);
    expect(settle('cust-1', 1)).toBe(false);
    expect(settle('cust-1', '1')).toBe(false);
    expect(settle('cust-1', undefined)).toBe(true);
    expect(settle('cust-1', 'sim')).toBe(false);
    expect(win.MyIOUtils.manualStoresInLojas).toBe(false);
  });
});

describe('v-5.2.0 MAIN_VIEW — reemissão quando o opt-in muda', () => {
  function loadReemit(data: Record<string, unknown>) {
    const emitProvide = vi.fn();
    // eslint-disable-next-line no-new-func
    const reemit = new Function(
      'window',
      'emitProvide',
      `${extractFunction(MAIN_SRC, 'reemitLoadedDomains')}\nreturn reemitLoadedDomains;`
    )({ MyIOOrchestratorData: data }, emitProvide) as (domains: string[], customerId?: string) => void;
    return { reemit, emitProvide };
  }

  it('com customer: reemite só o cache desse customer, com periodKey novo e a lista completa', () => {
    const { reemit, emitProvide } = loadReemit({
      energy: { periodKey: 'cust-1:energy:2026-11-01:2026-11-10:day', allItems: [loja, quiosque('q1')] },
      water: { periodKey: 'cust-0:water:2026-11-01:2026-11-10:day', allItems: [{ id: 'h' }] },
    });
    reemit(['energy', 'water'], 'cust-1');
    expect(emitProvide).toHaveBeenCalledOnce();
    const [domain, key, items] = emitProvide.mock.calls[0];
    expect(domain).toBe('energy');
    expect(key).toMatch(/^cust-1:energy:2026-11-01:2026-11-10:day_recalc_\d+$/);
    expect(items.map((i: { id: string }) => i.id)).toEqual(['loja', 'q1']);
  });

  it('sem customer (filtro Status Disp.): reemite todos os domínios carregados, sem acumular _recalc_', () => {
    const { reemit, emitProvide } = loadReemit({
      energy: { periodKey: 'cust-1:energy:a:b:day_recalc_1', allItems: [loja] },
      water: { periodKey: 'cust-1:water:a:b:day', items: [{ id: 'h' }] },
      temperature: { periodKey: 'cust-1:temperature:a:b:day', allItems: [] },
    });
    reemit(['energy', 'water', 'temperature']);
    expect(emitProvide.mock.calls.map(([d]) => d)).toEqual(['energy', 'water']);
    expect(emitProvide.mock.calls[0][1]).toMatch(/^cust-1:energy:a:b:day_recalc_\d+$/);
  });
});

describe('v-5.2.0 MAIN_VIEW — onInit usa as funções do opt-in', () => {
  const onInit = extractBlockAfter(MAIN_SRC, 'self.onInit = async function');
  const attrsSrc = onInit.slice(onInit.search(/if\s*\(\s*customerTB_ID\s*&&\s*jwt\s*\)/));
  const attrsIf = extractBlockAfter(attrsSrc, 'if');
  const elseBlock = extractBlockAfter(attrsSrc.slice(attrsSrc.indexOf('{') + attrsIf.length), 'else');
  const SETTLE_FALSE = /_manualStoresOptInSettle\(\s*customerTB_ID\s*,\s*false\s*\)/;

  it('Begin antes do 1º await; o onInit não grava o flag direto', () => {
    const begin = onInit.search(/_manualStoresOptInBegin\(/);
    expect(begin).toBeGreaterThan(-1);
    expect(begin).toBeLessThan(onInit.search(/\bawait\b/));
    expect(onInit).not.toMatch(/manualStoresInLojas(CustomerId)?\s*=[^=]/);
  });

  it('Settle no sucesso (antes do parse de exclude_groups_totals, que pode lançar), no catch e no else', () => {
    const success = attrsIf.search(/_manualStoresOptInSettle\(\s*customerTB_ID\s*,\s*attrs\b/);
    expect(success).toBeGreaterThan(-1);
    expect(success).toBeLessThan(attrsIf.search(/attrs\?\.exclude_groups_totals/));
    expect(attrsIf.slice(attrsIf.search(/\bcatch\s*\(/))).toMatch(SETTLE_FALSE);
    expect(elseBlock).toMatch(SETTLE_FALSE);
  });
});

