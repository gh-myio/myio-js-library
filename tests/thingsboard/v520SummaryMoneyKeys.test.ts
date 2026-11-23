/**
 * ED-1389 — o resumo da MAIN_VIEW (buildSummary / buildSummaryWater) leva a chave da
 * valoração em R$ até o TELEMETRY_INFO.
 *
 * `MyIOUtils.getItemMoney` procura `item.ingestionId`; antes desta correção os devices de
 * `details.devices` só tinham `{id, label, value, deviceStatus}` e o modo R$ do
 * TELEMETRY_INFO caía no físico. Também trava `excludedFromTotal`: o device que soma 0 no
 * kWh (exclude_groups_totals) precisa ficar fora da soma em R$.
 *
 * Executa as funções REAIS do controller com dependências mínimas stubadas.
 */
import { describe, it, expect } from 'vitest';
import { readControllerSource } from './helpers/extractControllerFunction';

/** Extrai uma função top-level (`function NAME(` … linha `}`). */
function extractTopLevel(src: string, name: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  if (start < 0) throw new Error(`função não encontrada: ${name}`);
  const end = lines.findIndex((l, i) => i > start && l === '}');
  return lines.slice(start, end + 1).join('\n');
}

function makeMain() {
  const src = readControllerSource('MAIN_VIEW');
  const body =
    "const SUB_GROUPS = ['climatizacao', 'elevadores', 'escadas_rolantes', 'outros'];\n" +
    'let widgetSettings = {};\nlet _excludeGroupsTotals = null;\nlet _warnedNegativeAreacomumResidual = false;\n' +
    ['isExcludedFromGroup', 'aggregateDeviceStatus', 'buildSummary', 'buildSummaryWater']
      .map((n) => extractTopLevel(src, n))
      .join('\n') +
    '\nreturn { buildSummary, buildSummaryWater };';
  const silent = { log() {}, warn() {}, error() {} };
  // resolveCategory: categoria declarada no próprio item de teste (`__cat`)
  const win = { MyIOLibrary: { resolveCategory: (item: any) => ({ category: item.__cat || 'outros' }) } };
  const classifyDevice = (item: any) => item.__cat || 'outros';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function('window', 'LogHelper', 'console', 'classifyDevice', body)(win, silent, silent, classifyDevice) as {
    buildSummary: (...a: unknown[]) => any;
    buildSummaryWater: (...a: unknown[]) => any;
  };
}

const item = (id: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `tb-${id}`,
  ingestionId: `ING-${id}`,
  label: `Dev ${id}`,
  identifier: id,
  deviceProfile: '3F_MEDIDOR',
  deviceStatus: 'power_on',
  value,
  ...extra,
});

describe('ED-1389 — buildSummary (energia) leva ingestionId e excludedFromTotal', () => {
  const { buildSummary } = makeMain();
  const excludedFromOutros = { enabled: true, groups: { outros: true } };
  const summary = buildSummary(
    [item('L1', 100)],
    [item('E1', 1000)],
    [],
    [
      item('C1', 50, { __cat: 'climatizacao', deviceProfile: 'CHILLER' }),
      item('O1', 30, { __cat: 'outros' }),
      item('O2', 20, { __cat: 'outros', excludeGroupsTotals: excludedFromOutros }),
      item('ELV1', 10, { __cat: 'elevadores' }),
    ],
    'cust:energy:2026-11-01:2026-11-30'
  );

  it('details.devices de cada grupo carregam o ingestionId', () => {
    expect(summary.lojas.details.devices[0]).toMatchObject({ id: 'tb-L1', ingestionId: 'ING-L1' });
    expect(summary.entrada.details.devices[0].ingestionId).toBe('ING-E1');
    expect(summary.climatizacao.details.devices[0].ingestionId).toBe('ING-C1');
    expect(summary.elevadores.details.devices[0].ingestionId).toBe('ING-ELV1');
    expect(summary.climatizacao.subcategories.chillers.details.devices[0].ingestionId).toBe('ING-C1');
  });

  it('Outros: o excluído já sai da lista (regra existente); os demais não levam excludedFromTotal', () => {
    const outros = summary.outros.details.devices;
    expect(outros.find((d: any) => d.ingestionId === 'ING-O2')).toBeUndefined();
    expect(outros.find((d: any) => d.ingestionId === 'ING-O1').excludedFromTotal).toBeUndefined();
    expect(summary.outros.summary.total).toBe(30);
    expect(summary.lojas.details.devices[0].excludedFromTotal).toBeUndefined();
  });

  it('Climatização: o excluído fica na lista (valor bruto) marcado excludedFromTotal, inclusive na subcategoria', () => {
    const s = buildSummary(
      [],
      [item('E1', 1000)],
      [],
      [
        item('C1', 50, { __cat: 'climatizacao', deviceProfile: 'CHILLER' }),
        item('C2', 25, {
          __cat: 'climatizacao',
          deviceProfile: 'CHILLER',
          excludeGroupsTotals: { enabled: true, groups: { climatizacao: true } },
        }),
      ],
      'cust:energy:2026-11-01:2026-11-30'
    );
    const c2 = s.climatizacao.details.devices.find((d: any) => d.ingestionId === 'ING-C2');
    expect(c2).toMatchObject({ value: 25, excludedFromTotal: true });
    const c2Sub = s.climatizacao.subcategories.chillers.details.devices.find((d: any) => d.ingestionId === 'ING-C2');
    expect(c2Sub.excludedFromTotal).toBe(true);
    expect(s.climatizacao.summary.total).toBe(50);
  });

  it('exclusão em Lojas fica marcada no device (lista mostra o bruto, total soma 0)', () => {
    const s = buildSummary(
      [item('L1', 100), item('L2', 40, { excludeGroupsTotals: { enabled: true, groups: { lojas: true } } })],
      [item('E1', 1000)],
      [],
      [],
      'cust:energy:2026-11-01:2026-11-30'
    );
    const l2 = s.lojas.details.devices.find((d: any) => d.ingestionId === 'ING-L2');
    expect(l2).toMatchObject({ value: 40, excludedFromTotal: true });
    expect(s.lojas.summary.total).toBe(100);
  });
});

describe('ED-1389 — buildSummaryWater leva ingestionId', () => {
  it('lojas / banheiros / área comum / entrada', () => {
    const { buildSummaryWater } = makeMain();
    const s = buildSummaryWater(
      [item('WE1', 500, { deviceProfile: 'HIDROMETRO_SHOPPING' })],
      [item('WL1', 200, { deviceProfile: 'HIDROMETRO' })],
      [item('WB1', 50, { deviceProfile: 'HIDROMETRO_AREA_COMUM' })],
      [item('WA1', 100, { deviceProfile: 'HIDROMETRO_AREA_COMUM' })],
      'cust:water:2026-11-01:2026-11-30'
    );
    expect(s.entrada.details.devices[0].ingestionId).toBe('ING-WE1');
    expect(s.lojas.details.devices[0].ingestionId).toBe('ING-WL1');
    expect(s.banheiros.details.devices[0].ingestionId).toBe('ING-WB1');
    expect(s.areaComum.details.devices[0].ingestionId).toBe('ING-WA1');
  });
});
