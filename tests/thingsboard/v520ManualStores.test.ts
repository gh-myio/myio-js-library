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

describe('v-5.2.0 — atributo do opt-in ligado aos dois widgets', () => {
  it('MAIN_VIEW lê o atributo antes do parse que pode lançar e grava só em window.MyIOUtils', () => {
    const read = MAIN_SRC.indexOf('attrs?.includeManualStoresInLojas');
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(MAIN_SRC.indexOf('attrs?.exclude_groups_totals'));
    expect(MAIN_SRC).toContain('window.MyIOUtils.manualStoresInLojas =');
    expect(HEADER_SRC).toContain('window.MyIOUtils?.manualStoresInLojas');
  });

  it('nenhuma cópia do opt-in no escopo do controller (fonte única da página)', () => {
    expect(MAIN_SRC).not.toMatch(/\b_manualStoresInLojas\b/);
    expect(extractFunction(MAIN_SRC, '_isManualStore')).toContain('window.MyIOUtils?.manualStoresInLojas');
  });

  it('MAIN_VIEW conta as próprias avaliações e avisa a partir da segunda', () => {
    expect(MAIN_SRC).toContain('window.__myioMainViewEvaluations = (window.__myioMainViewEvaluations || 0) + 1');
  });
});

describe('v-5.2.0 MAIN_VIEW — opt-in recalculado a cada onInit (navegação interna do TB, sem reload)', () => {
  const onInit = extractBlockAfter(MAIN_SRC, 'self.onInit = async function');
  const RESET = 'window.MyIOUtils.manualStoresInLojas = false;';
  const COND = 'if (customerTB_ID && jwt)';

  /** Trecho REAL do onInit: reset + declarações + `if (customerTB_ID && jwt) {…} else {…}`. */
  function attrsStep(): string {
    const condAt = onInit.indexOf(COND);
    const ifStart = onInit.indexOf('{', condAt);
    const ifBlock = extractBlockAfter(onInit.slice(condAt), COND);
    const rest = onInit.slice(ifStart + ifBlock.length);
    expect(rest).toMatch(/^\s*else\s*\{/);
    const elseBlock = extractBlockAfter(rest, 'else');
    const decls = onInit.slice(onInit.indexOf("let CLIENT_ID = '';"), condAt);
    return `${RESET}\n${decls}\n${COND} ${ifBlock} else ${elseBlock}`;
  }

  async function runAttrsStep(opts: {
    previous: boolean;
    customerTB_ID?: string;
    jwt?: string | null;
    fetchAttrs?: () => Promise<Record<string, unknown>>;
  }) {
    const win: { MyIOUtils: { manualStoresInLojas?: boolean } } = { MyIOUtils: { manualStoresInLojas: opts.previous } };
    const LogHelper = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const fetchAttrs = vi.fn(opts.fetchAttrs || (async () => ({})));
    // eslint-disable-next-line no-new-func
    const run = new Function(
      'window',
      'MyIO',
      'LogHelper',
      'self',
      'customerTB_ID',
      'jwt',
      '_applyTicketsGate',
      '_moneySetCategoryRule',
      'normalizeExcludeGroupsTotals',
      'rfc0207LoadActiveProfile',
      `return (async () => {\n${attrsStep()}\n})();`
    );
    await run(
      win,
      { fetchThingsboardCustomerAttrsFromStorage: fetchAttrs },
      LogHelper,
      { ctx: { settings: {} } },
      opts.customerTB_ID ?? 'customer-2',
      opts.jwt === undefined ? 'jwt' : opts.jwt,
      () => {},
      () => {},
      (raw: unknown) => raw,
      async () => {}
    );
    return { flag: win.MyIOUtils.manualStoresInLojas, fetchAttrs, LogHelper };
  }

  it('o reset é a primeira coisa do onInit: antes de qualquer await e da leitura dos atributos', () => {
    const resetAt = onInit.indexOf(RESET);
    expect(resetAt).toBeGreaterThan(0);
    expect(resetAt).toBeLessThan(onInit.indexOf('await '));
    expect(resetAt).toBeLessThan(onInit.indexOf('fetchThingsboardCustomerAttrsFromStorage('));
    expect(resetAt).toBeLessThan(onInit.indexOf(COND));
  });

  it('leitura dos atributos falha → false, mesmo vindo de um customer com o opt-in ligado', async () => {
    const r = await runAttrsStep({
      previous: true,
      fetchAttrs: async () => {
        throw new Error('HTTP 500');
      },
    });
    expect(r.fetchAttrs).toHaveBeenCalledOnce();
    expect(r.LogHelper.error).toHaveBeenCalled(); // caiu no catch
    expect(r.flag).toBe(false);
  });

  it('sem customerTB_ID ou sem jwt → false, sem ler atributos', async () => {
    const semCustomer = await runAttrsStep({ previous: true, customerTB_ID: '' });
    expect(semCustomer.fetchAttrs).not.toHaveBeenCalled();
    expect(semCustomer.flag).toBe(false);

    const semJwt = await runAttrsStep({ previous: true, jwt: null });
    expect(semJwt.fetchAttrs).not.toHaveBeenCalled();
    expect(semJwt.flag).toBe(false);
  });

  it('customer seguinte sem o atributo → false; com o atributo → true', async () => {
    expect((await runAttrsStep({ previous: true, fetchAttrs: async () => ({}) })).flag).toBe(false);
    expect(
      (await runAttrsStep({ previous: false, fetchAttrs: async () => ({ includeManualStoresInLojas: 'true' }) })).flag
    ).toBe(true);
    expect(
      (await runAttrsStep({ previous: false, fetchAttrs: async () => ({ includeManualStoresInLojas: true }) })).flag
    ).toBe(true);
  });
});
