/**
 * Shopping v-5.2.0 — devices *_MANUAL de loja (3F_MEDIDOR_MANUAL / HIDROMETRO_MANUAL) em Lojas.
 *
 * O MAIN_VIEW é um script de widget ThingsBoard (não importável): as funções são extraídas do
 * código-fonte e avaliadas com o `resolveGroup` real da lib. Garante que os manuais de loja:
 *  - continuam no grupo MANUAL (aba própria) e entram TAMBÉM em `regular` → Lojas/totais/relatórios;
 *  - caem em Lojas (energia e água) — o resolver sozinho mandaria 3F_MEDIDOR_MANUAL p/ Área Comum;
 *  - ficam ACTIVE no filtro "Status Disp." (sem conectividade, status fixo online).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveGroup } from '../../src/utils/devices/deviceClassificationProfile';

const MAIN_SRC = readFileSync(
  resolve(process.cwd(), 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js'),
  'utf8'
);

/** Extrai `function name(...) { ... }` do fonte (chaves balanceadas). */
function extractFunction(name: string): string {
  const start = MAIN_SRC.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} not found in MAIN_VIEW`);
  const open = MAIN_SRC.indexOf('{', MAIN_SRC.indexOf(')', start));
  let depth = 0;
  for (let i = open; i < MAIN_SRC.length; i++) {
    if (MAIN_SRC[i] === '{') depth++;
    else if (MAIN_SRC[i] === '}' && --depth === 0) return MAIN_SRC.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

type Fns = {
  _isManualStore: (item: any) => boolean;
  _splitManualItems: (items: any[]) => { regular: any[]; manual: any[] };
  categorizeItemsByGroup: (items: any[]) => Record<string, any[]>;
  categorizeItemsByGroupWater: (items: any[]) => Record<string, any[]>;
  _resolveDeviceGcdrStatus: (item: any) => string;
};

let fns: Fns;

beforeAll(() => {
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
    `${names.map(extractFunction).join('\n')}\nreturn { ${names.join(', ')} };`
  );
  fns = factory(fakeWindow, LogHelper, gcdrIndex);
});

const quiosque = (id: string) => ({ id, tbId: `tb-${id}`, deviceProfile: '3F_MEDIDOR_MANUAL', value: 12.5 });
const loja = { id: 'loja', tbId: 'tb-loja', deviceProfile: '3F_MEDIDOR', value: 100 };
const entrada = { id: 'ent', tbId: 'tb-ent', deviceProfile: 'ENTRADA', value: 500 };

describe('v-5.2.0 MAIN_VIEW — *_MANUAL de loja em Lojas', () => {
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
