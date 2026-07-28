/**
 * RFC-0207 — residual de Área Comum × includes cross-group.
 *
 * O defeito que estes testes travam: `residual = areacomumTotal − Σ subtotais`
 * assume que todo subtotal é feito de devices que estão DENTRO de
 * `areacomumTotal`. Um `include` cross-group quebra a premissa — o trafo da Ilha
 * (637.560) entra no subtotal de climatização mas vive no grupo `entrada` e
 * nunca fez parte do `areacomumTotal`. O residual ia negativo pelo valor exato
 * do device puxado, e o `Math.max(0, …)` mascarava (na Ilha o residual já é 0,
 * então nada parecia errado — mas qualquer cliente com Área Comum positiva
 * veria o número encolher sem motivo).
 *
 * Os testes exercitam o código EMBARCADO: `selectBreakdownItems` (origem) +
 * `computeBaseGroupResidual` (aritmética), que é exatamente o par que o
 * `buildSummary` do MAIN_VIEW chama.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveGroup,
  resolveCategory,
  normalizeProfile,
  selectBreakdownItems,
  computeBaseGroupResidual,
  type DeviceClassificationProfile,
  type ClassifiableItem,
} from '../src/utils/devices/deviceClassificationProfile';

interface Device extends ClassifiableItem {
  id: string;
  label: string;
  value: number;
}

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function profileWithOverrides(
  overrides: { id: string; label?: string; mode: 'include' | 'exclude' }[],
): DeviceClassificationProfile {
  const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
  p.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!.deviceOverrides =
    overrides;
  return normalizeProfile(p);
}

function groupAll(devices: Device[], profile: DeviceClassificationProfile) {
  const groups: Record<string, Device[]> = { lojas: [], entrada: [], areacomum: [], ocultos: [] };
  for (const d of devices) groups[resolveGroup(d, profile, 'energy').group].push(d);
  return groups;
}

/**
 * Espelha o trecho do `buildSummary` (MAIN_VIEW) que importa: monta os baldes do
 * breakdown, soma os totais CHEIOS (o que os cards exibem), soma em paralelo a
 * parcela cross-group de cada balde, e delega o residual a
 * `computeBaseGroupResidual` — a mesma função que o controller chama.
 */
function runBreakdown(groups: Record<string, Device[]>, profile: DeviceClassificationProfile) {
  const buckets: Record<string, Device[]> = {
    climatizacao: [],
    elevadores: [],
    escadas_rolantes: [],
    outros: [],
  };
  const cross = new Set<Device>();

  for (const { item, forcedCategory, fromBaseGroup } of selectBreakdownItems<Device>(
    groups,
    profile,
    'energy',
  )) {
    if (fromBaseGroup === false) cross.add(item);
    const cat = forcedCategory || resolveCategory(item, profile, 'energy').category;
    (buckets[cat] ||= []).push(item);
  }

  const sum = (list: Device[]) => list.reduce((s, d) => s + d.value, 0);
  const crossSum = (list: Device[]) =>
    list.reduce((s, d) => s + (cross.has(d) ? d.value : 0), 0);

  const totals = {
    climatizacao: sum(buckets.climatizacao),
    elevadores: sum(buckets.elevadores),
    escadas_rolantes: sum(buckets.escadas_rolantes),
    outros: sum(buckets.outros),
  };
  const crossTotals = {
    climatizacao: crossSum(buckets.climatizacao),
    elevadores: crossSum(buckets.elevadores),
    escadas_rolantes: crossSum(buckets.escadas_rolantes),
    outros: crossSum(buckets.outros),
  };

  // `areacomumTotal` é o total do GRUPO — não é afetado por override nenhum
  // (é exatamente o que o MAIN_VIEW passa para buildSummary).
  const areacomumTotal = sum(groups.areacomum || []);

  const residual = computeBaseGroupResidual(areacomumTotal, [
    { category: 'climatizacao', total: totals.climatizacao, crossGroupTotal: crossTotals.climatizacao },
    { category: 'elevadores', total: totals.elevadores, crossGroupTotal: crossTotals.elevadores },
    {
      category: 'escadas_rolantes',
      total: totals.escadas_rolantes,
      crossGroupTotal: crossTotals.escadas_rolantes,
    },
    { category: 'outros', total: totals.outros, crossGroupTotal: crossTotals.outros },
  ]);

  /** A fórmula ANTIGA (buggy), para provar que o fix fez trabalho. */
  const legacyResidualRaw =
    areacomumTotal -
    (totals.climatizacao + totals.elevadores + totals.escadas_rolantes + totals.outros);

  return { buckets, totals, crossTotals, areacomumTotal, residual, legacyResidualRaw };
}

// ---------------------------------------------------------------------------
// CENÁRIO 1 — Shopping da Ilha, números reais medidos em produção, INCLUDE-ONLY
// ---------------------------------------------------------------------------

const ILHA_TRAFO_ID = 'a1b2c3d4-0000-0000-0000-00000000cag0';

const ILHA: Device[] = [
  // ---- grupo `entrada` ----
  {
    id: 'e-geral',
    label: 'Geral Entrada',
    deviceProfile: 'ENTRADA',
    identifier: 'ENTRADA-GERAL',
    value: 752677,
  },
  {
    id: ILHA_TRAFO_ID,
    label: 'Medição Geral CAG',
    deviceProfile: 'ENTRADA',
    identifier: 'CAG',
    value: 637560,
  },
  // ---- grupo `areacomum` — climatização soma 1.152.603 ----
  { id: 'ac-chiller', label: 'Chiller 1', deviceProfile: 'CHILLER', identifier: 'CHILLER-01', value: 996932 },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `ac-bomba-${i + 1}`,
    label: `Bomba CAG ${i + 3}`,
    deviceProfile: 'BOMBA_CAG',
    identifier: 'CAG',
    value: i === 8 ? 17295 : 17297, // 8×17.297 + 17.295 = 155.671
  })),
  // ---- resto do areacomum ----
  { id: 'ac-elev', label: 'Elevadores', deviceProfile: 'ELEVADOR', identifier: 'ELV-01', value: 25559 },
  { id: 'ac-esc', label: 'Escadas', deviceProfile: 'ESCADA_ROLANTE', identifier: 'ESC-01', value: 51942 },
  { id: 'ac-ilum', label: 'Iluminação Mall', deviceProfile: 'ILUMINACAO', identifier: 'ILU-01', value: 10399 },
];

describe('RFC-0207 residual — Shopping da Ilha (include-only, números reais)', () => {
  const p = profileWithOverrides([
    { id: ILHA_TRAFO_ID, label: 'Medição Geral CAG', mode: 'include' },
  ]);
  const groups = groupAll(ILHA, p);
  const r = runBreakdown(groups, p);

  it('a fixture reproduz a medição de produção', () => {
    expect(r.areacomumTotal).toBe(1240503);
    expect(r.totals.elevadores).toBe(25559);
    expect(r.totals.escadas_rolantes).toBe(51942);
    expect(r.totals.outros).toBe(10399);
    // climatização de origem areacomum = chiller 996.932 + 9 bombas 155.671
    expect(r.totals.climatizacao - r.crossTotals.climatizacao).toBe(1152603);
  });

  it('o card de Climatização mostra o total CHEIO: 1.790.163', () => {
    expect(r.totals.climatizacao).toBe(1790163);
    expect(r.crossTotals.climatizacao).toBe(637560);
  });

  it('a Entrada continua 1.390.237 (o include não move o grupo)', () => {
    expect(groups.entrada.reduce((s, d) => s + d.value, 0)).toBe(1390237);
  });

  it('residual = 0 SEM depender do clamp (pré-clamp é 0, não negativo)', () => {
    expect(r.residual.residualRaw).toBe(0);
    expect(r.residual.residual).toBe(0);
    expect(r.residual.negative).toBe(false);
    expect(r.residual.subtotalFromBaseGroup).toBe(1240503);
    expect(r.residual.subtotalCrossGroup).toBe(637560);
  });

  it('a fórmula ANTIGA daria −637.560, mascarado pelo clamp', () => {
    expect(r.legacyResidualRaw).toBe(-637560);
    expect(Math.max(0, r.legacyResidualRaw)).toBe(0); // exatamente o mascaramento
  });

  it('sem o override, o cenário base fecha em residual 0 do mesmo jeito', () => {
    const base = groupAll(ILHA, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const rb = runBreakdown(base, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(rb.areacomumTotal).toBe(1240503);
    expect(rb.totals.climatizacao).toBe(1152603);
    expect(rb.crossTotals.climatizacao).toBe(0);
    expect(rb.residual.residualRaw).toBe(0);
    expect(rb.legacyResidualRaw).toBe(0); // as duas fórmulas coincidem sem override
  });
});

// ---------------------------------------------------------------------------
// CENÁRIO 2 — shopping com Área Comum GENUINAMENTE positiva (sintético)
//
// É o caso que teria quebrado em silêncio: hoje o residual é positivo; adicionar
// um include cross-group NÃO pode encolhê-lo. A Área Comum positiva é produzida
// aqui por um device que sai do breakdown (exclude) mas continua no total do
// grupo — estruturalmente idêntico a qualquer outra divergência
// `areacomumTotal > Σ subtotais`.
// ---------------------------------------------------------------------------

const SINT_TRAFO_ID = 'sint-trafo-clima';
const SINT_FORA_ID = 'sint-fora-do-breakdown';

const SINTETICO: Device[] = [
  { id: 'sx-entrada', label: 'Entrada Geral', deviceProfile: 'ENTRADA', identifier: 'ENT-1', value: 900000 },
  {
    id: SINT_TRAFO_ID,
    label: 'Trafo Climatização',
    deviceProfile: 'ENTRADA',
    identifier: 'CAG',
    value: 200000,
  },
  { id: 'sx-chiller', label: 'Chiller', deviceProfile: 'CHILLER', identifier: 'CHILLER-1', value: 300000 },
  { id: 'sx-elev', label: 'Elevador', deviceProfile: 'ELEVADOR', identifier: 'ELV-1', value: 100000 },
  { id: 'sx-esc', label: 'Escada', deviceProfile: 'ESCADA_ROLANTE', identifier: 'ESC-1', value: 50000 },
  { id: 'sx-ilum', label: 'Iluminação', deviceProfile: 'ILUMINACAO', identifier: 'ILU-1', value: 50000 },
  // fica no total do grupo (1.000.000) mas fora do breakdown → residual 500.000
  { id: SINT_FORA_ID, label: 'Medidor Redundante', deviceProfile: 'ILUMINACAO', identifier: 'RED-1', value: 500000 },
];

describe('RFC-0207 residual — shopping com Área Comum positiva', () => {
  const semInclude = profileWithOverrides([{ id: SINT_FORA_ID, mode: 'exclude' }]);
  const comInclude = profileWithOverrides([
    { id: SINT_FORA_ID, mode: 'exclude' },
    { id: SINT_TRAFO_ID, label: 'Trafo Climatização', mode: 'include' },
  ]);

  const antes = runBreakdown(groupAll(SINTETICO, semInclude), semInclude);
  const depois = runBreakdown(groupAll(SINTETICO, comInclude), comInclude);

  it('linha de base: Área Comum genuinamente positiva (500.000)', () => {
    expect(antes.areacomumTotal).toBe(1000000);
    expect(antes.totals.climatizacao).toBe(300000);
    expect(antes.residual.residualRaw).toBe(500000);
    expect(antes.residual.residual).toBe(500000);
  });

  it('o include cross-group FAZ o card crescer: 300.000 → 500.000', () => {
    expect(depois.totals.climatizacao).toBe(500000);
    expect(depois.crossTotals.climatizacao).toBe(200000);
  });

  it('e NÃO mexe no residual: continua 500.000', () => {
    expect(depois.residual.residualRaw).toBe(500000);
    expect(depois.residual.residual).toBe(500000);
    expect(depois.residual.negative).toBe(false);
    expect(depois.residual.residual).toBe(antes.residual.residual);
  });

  it('a fórmula ANTIGA teria encolhido o residual em exatamente 200.000', () => {
    expect(antes.legacyResidualRaw).toBe(500000);
    expect(depois.legacyResidualRaw).toBe(300000); // 500.000 − 200.000 → o bug silencioso
  });

  it('o total do grupo areacomum não muda com o include', () => {
    expect(depois.areacomumTotal).toBe(antes.areacomumTotal);
  });
});

// ---------------------------------------------------------------------------
// computeBaseGroupResidual — unidade
// ---------------------------------------------------------------------------

describe('computeBaseGroupResidual', () => {
  it('sem parcela cross-group é a subtração de sempre', () => {
    const r = computeBaseGroupResidual(1000, [
      { category: 'climatizacao', total: 300, crossGroupTotal: 0 },
      { category: 'outros', total: 200, crossGroupTotal: 0 },
    ]);
    expect(r.subtotalFromBaseGroup).toBe(500);
    expect(r.subtotalCrossGroup).toBe(0);
    expect(r.residualRaw).toBe(500);
    expect(r.residual).toBe(500);
    expect(r.negative).toBe(false);
  });

  it('desconta apenas a parcela de origem-base', () => {
    const r = computeBaseGroupResidual(1000, [
      { category: 'climatizacao', total: 900, crossGroupTotal: 600 },
      { category: 'outros', total: 200, crossGroupTotal: 0 },
    ]);
    expect(r.subtotalFromBaseGroup).toBe(500); // (900−600) + 200
    expect(r.subtotalCrossGroup).toBe(600);
    expect(r.residualRaw).toBe(500);
  });

  it('lista vazia devolve o total do grupo', () => {
    expect(computeBaseGroupResidual(1234, []).residualRaw).toBe(1234);
  });

  it('negativo REAL é sinalizado e clampado (não some)', () => {
    const r = computeBaseGroupResidual(100, [
      { category: 'climatizacao', total: 250, crossGroupTotal: 0 },
    ]);
    expect(r.residualRaw).toBe(-150);
    expect(r.residual).toBe(0);
    expect(r.negative).toBe(true);
  });

  it('valores não-numéricos degradam para 0 em vez de NaN', () => {
    const r = computeBaseGroupResidual(100, [
      { category: 'x', total: undefined as unknown as number, crossGroupTotal: null as unknown as number },
    ]);
    expect(r.residualRaw).toBe(100);
    expect(Number.isNaN(r.residual)).toBe(false);
  });
});
