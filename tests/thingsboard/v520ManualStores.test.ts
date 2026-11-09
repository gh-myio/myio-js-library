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
import { describe, expect, it } from 'vitest';
import { resolveGroup } from '../../src/utils/devices/deviceClassificationProfile';
import { extractFunction, readControllerSource } from './helpers/extractControllerFunction';

const MAIN_SRC = readControllerSource('MAIN_VIEW');
const HEADER_SRC = readControllerSource('HEADER');

type Fns = {
  _isManualStore: (item: any) => boolean;
  _splitManualItems: (items: any[]) => { regular: any[]; manual: any[] };
  categorizeItemsByGroup: (items: any[]) => Record<string, any[]>;
  categorizeItemsByGroupWater: (items: any[]) => Record<string, any[]>;
  _resolveDeviceGcdrStatus: (item: any) => string;
};

function loadMain(manualStoresInLojas: boolean): Fns {
  const names = [
    '_isManualDevice',
    '_isManualStore',
    '_splitManualItems',
    'categorizeItemsByGroup',
    'categorizeItemsByGroupWater',
    '_resolveDeviceGcdrStatus',
  ];
  const fakeWindow = { MyIOLibrary: { resolveGroup } };
  const LogHelper = { log: () => {}, warn: () => {}, error: () => {} };
  const gcdrIndex = { byGcdrId: new Map(), byTbId: new Map([['tb-loja', 'INACTIVE']]) };
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'LogHelper',
    '_gcdrDeviceStatusIndex',
    '_manualStoresInLojas',
    `${names.map((n) => extractFunction(MAIN_SRC, n)).join('\n')}\nreturn { ${names.join(', ')} };`
  );
  return factory(fakeWindow, LogHelper, gcdrIndex, manualStoresInLojas);
}

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
  it('MAIN_VIEW lê o atributo antes do parse que pode lançar e publica para o HEADER', () => {
    const read = MAIN_SRC.indexOf('attrs?.includeManualStoresInLojas');
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(MAIN_SRC.indexOf('attrs?.exclude_groups_totals'));
    expect(MAIN_SRC).toContain('window.MyIOUtils.manualStoresInLojas = _manualStoresInLojas');
    expect(HEADER_SRC).toContain('window.MyIOUtils?.manualStoresInLojas');
  });
});
