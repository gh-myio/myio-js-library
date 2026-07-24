/**
 * RFC-0207 "Dispositivos Específicos" — modo `parent` (o device É PAI da composição).
 *
 * Caso real (Moxuara, medido ao vivo):
 *   - `CAG-Entrada` (deviceProfile ENTRADA, identifier CAG) é o medidor de ENTRADA
 *     da CAG: mede TODA a alimentação = 336.600. Fica no grupo `entrada`.
 *   - A composição interna (submedidores no grupo `areacomum`) soma 326.973:
 *     Chillers 3 = 184.661, Fancoils 14 = 96.046, Bombas 13 = 46.266.
 *   - Containment provado: pai 336.600 ≳ filhos 326.973 (~3% de perda de linha).
 *     Os filhos estão A JUSANTE do pai.
 *
 * `parent` CONTÉM a composição (o total do card = valor do pai; os filhos são o
 * breakdown aninhado, NÃO somados por cima). Contraste com `include`, que SOMA.
 *
 * Os testes exercitam o código EMBARCADO da lib (`selectBreakdownItems` +
 * `computeBaseGroupResidual`), com um `runBreakdown` que espelha exatamente o
 * `buildSummary` do MAIN_VIEW no ponto do modo `parent`.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveGroup,
  resolveCategory,
  normalizeProfile,
  validateProfile,
  collectDeviceOverrides,
  selectBreakdownItems,
  computeBaseGroupResidual,
  type DeviceClassificationProfile,
  type ClassifiableItem,
  type DeviceOverrideMode,
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
  overrides: { id: string; label?: string; mode: DeviceOverrideMode }[],
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
 * Espelha o trecho do `buildSummary` do MAIN_VIEW que trata o modo `parent`:
 *   - pais (isParent) vão para um balde à parte e NÃO entram na composição;
 *   - o total do card de climatização = soma dos pais (se houver) OU soma dos
 *     filhos (composição);
 *   - o residual desconta de `areacomumTotal` só os FILHOS de origem-base
 *     (`baseGroupContribution`), nunca o pai (cross-group).
 */
function runBreakdown(groups: Record<string, Device[]>, profile: DeviceClassificationProfile) {
  const climatizacaoChildren: Device[] = [];
  const climatizacaoParents: Device[] = [];
  const outros: Device[] = [];
  const crossOrigin = new Set<Device>();

  for (const { item, forcedCategory, fromBaseGroup, isParent } of selectBreakdownItems<Device>(
    groups,
    profile,
    'energy',
  )) {
    if (fromBaseGroup === false) crossOrigin.add(item);
    const cat = forcedCategory || resolveCategory(item, profile, 'energy').category;
    if (cat === 'climatizacao') {
      if (isParent === true) climatizacaoParents.push(item);
      else climatizacaoChildren.push(item);
    } else {
      outros.push(item);
    }
  }

  const sum = (list: Device[]) => list.reduce((s, d) => s + d.value, 0);
  const crossSum = (list: Device[]) =>
    list.reduce((s, d) => s + (crossOrigin.has(d) ? d.value : 0), 0);

  const childrenTotal = sum(climatizacaoChildren);
  const parentTotal = sum(climatizacaoParents);
  const hasParent = climatizacaoParents.length > 0;
  const climatizacaoTotal = hasParent ? parentTotal : childrenTotal;
  const climatizacaoCross = crossSum(climatizacaoChildren);

  const areacomumTotal = sum(groups.areacomum || []);

  const residual = computeBaseGroupResidual(areacomumTotal, [
    hasParent
      ? {
          category: 'climatizacao',
          total: climatizacaoTotal,
          crossGroupTotal: parentTotal,
          baseGroupContribution: Math.max(0, childrenTotal - climatizacaoCross),
        }
      : { category: 'climatizacao', total: climatizacaoTotal, crossGroupTotal: climatizacaoCross },
    { category: 'outros', total: sum(outros), crossGroupTotal: crossSum(outros) },
  ]);

  // composição por deviceProfile (Chillers/Fancoils/Bombas)
  const byProfile: Record<string, number> = {};
  for (const d of climatizacaoChildren) {
    const p = String(d.deviceProfile || '').toUpperCase();
    byProfile[p] = (byProfile[p] || 0) + d.value;
  }

  return {
    climatizacaoChildren,
    climatizacaoParents,
    childrenTotal,
    parentTotal,
    climatizacaoTotal,
    areacomumTotal,
    residual,
    byProfile,
  };
}

// ---------------------------------------------------------------------------
// Fixture Moxuara — números reais
// ---------------------------------------------------------------------------

const CAG_ENTRADA_ID = '82f010d0-857e-423e-be43-c1e4e51ae25d';

const MEDICAO_GERAL: Device = {
  id: 'mx-medicao-geral',
  label: 'Medição Geral',
  deviceProfile: 'ENTRADA',
  identifier: 'ENTRADA-GERAL',
  value: 783750,
};
const CAG_ENTRADA: Device = {
  id: CAG_ENTRADA_ID,
  label: 'CAG-Entrada',
  deviceProfile: 'ENTRADA',
  identifier: 'CAG',
  value: 336600,
};
// Chillers 3 = 184.661
const CHILLERS: Device[] = [61554, 61554, 61553].map((value, i) => ({
  id: `mx-chiller-${i + 1}`,
  label: `Chiller ${i + 1}`,
  deviceProfile: 'CHILLER',
  identifier: `CHILLER-0${i + 1}`,
  value,
}));
// Fancoils 14 = 96.046  (13×6860 + 6866)
const FANCOILS: Device[] = Array.from({ length: 14 }, (_, i) => ({
  id: `mx-fancoil-${i + 1}`,
  label: `Fancoil ${i + 1}`,
  deviceProfile: 'FANCOIL',
  identifier: `FANCOIL-${i + 1}`,
  value: i === 13 ? 6866 : 6860,
}));
// Bombas 13 = 46.266  (12×3559 + 3558)
const BOMBAS: Device[] = Array.from({ length: 13 }, (_, i) => ({
  id: `mx-bomba-${i + 1}`,
  label: `Bomba CAG ${i + 1}`,
  deviceProfile: 'BOMBA_CAG',
  identifier: 'CAG',
  value: i === 12 ? 3558 : 3559,
}));

const MOXUARA = [MEDICAO_GERAL, CAG_ENTRADA, ...CHILLERS, ...FANCOILS, ...BOMBAS];

// ---------------------------------------------------------------------------

describe('RFC-0207 parent — schema/collect/normalize', () => {
  it('validateProfile aceita mode "parent"', () => {
    const p = profileWithOverrides([{ id: CAG_ENTRADA_ID, label: 'CAG-Entrada', mode: 'parent' }]);
    expect(validateProfile(p)).toEqual([]);
  });

  it('validateProfile rejeita mode inválido com a mensagem dos 3 modos', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    p.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: 'x', mode: 'boss' as unknown as DeviceOverrideMode },
    ];
    const errs = validateProfile(p);
    expect(errs.some((e) => e.includes('"include", "exclude" or "parent"'))).toBe(true);
  });

  it('normalizeProfile preserva "parent" (não coage para include)', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    p.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: CAG_ENTRADA_ID, label: 'CAG-Entrada', mode: 'parent' },
    ];
    const n = normalizeProfile(p);
    expect(
      n.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!.deviceOverrides,
    ).toEqual([{ id: CAG_ENTRADA_ID, mode: 'parent', label: 'CAG-Entrada' }]);
  });

  it('collectDeviceOverrides põe o pai em includes E em parents', () => {
    const p = profileWithOverrides([{ id: CAG_ENTRADA_ID, mode: 'parent' }]);
    const { includes, parents, excludes } = collectDeviceOverrides(p, 'energy');
    expect(includes.get(CAG_ENTRADA_ID)).toBe('climatizacao');
    expect(parents.get(CAG_ENTRADA_ID)).toBe('climatizacao');
    expect(excludes.size).toBe(0);
  });

  it('exclude vence parent (some dos dois mapas)', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const rules = p.domains.energy.categories!.rules;
    rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: CAG_ENTRADA_ID, mode: 'parent' },
    ];
    rules.find((r) => r.name === 'elevadores')!.deviceOverrides = [
      { id: CAG_ENTRADA_ID, mode: 'exclude' },
    ];
    const { includes, parents, excludes } = collectDeviceOverrides(normalizeProfile(p), 'energy');
    expect(includes.has(CAG_ENTRADA_ID)).toBe(false);
    expect(parents.has(CAG_ENTRADA_ID)).toBe(false);
    expect(excludes.has(CAG_ENTRADA_ID)).toBe(true);
  });

  it('selectBreakdownItems marca isParent só no pai (e o puxa da entrada)', () => {
    const p = profileWithOverrides([{ id: CAG_ENTRADA_ID, mode: 'parent' }]);
    const groups = groupAll(MOXUARA, p);
    const entries = selectBreakdownItems<Device>(groups, p, 'energy');
    const parentEntry = entries.find((e) => e.item.id === CAG_ENTRADA_ID)!;
    expect(parentEntry.isParent).toBe(true);
    expect(parentEntry.fromBaseGroup).toBe(false);
    expect(parentEntry.sourceGroup).toBe('entrada');
    // nenhum filho é marcado como pai
    expect(entries.filter((e) => e.isParent === true)).toHaveLength(1);
    // entradas de filhos não carregam a chave isParent (retrocompat)
    const child = entries.find((e) => e.item.id === CHILLERS[0].id)!;
    expect('isParent' in child).toBe(false);
  });
});

describe('RFC-0207 parent — aceitação Moxuara', () => {
  const p = profileWithOverrides([{ id: CAG_ENTRADA_ID, label: 'CAG-Entrada', mode: 'parent' }]);
  const groups = groupAll(MOXUARA, p);
  const r = runBreakdown(groups, p);

  it('a fixture reproduz os números reais', () => {
    expect(CHILLERS.reduce((s, d) => s + d.value, 0)).toBe(184661);
    expect(FANCOILS.reduce((s, d) => s + d.value, 0)).toBe(96046);
    expect(BOMBAS.reduce((s, d) => s + d.value, 0)).toBe(46266);
    expect(r.childrenTotal).toBe(326973);
    expect(CAG_ENTRADA.value).toBe(336600);
  });

  it('Climatização (card) = 336.600 — o PAI (NÃO 663.573, NÃO 326.973)', () => {
    expect(r.climatizacaoTotal).toBe(336600);
    expect(r.climatizacaoTotal).not.toBe(336600 + 326973); // 663.573 = dupla contagem
    expect(r.climatizacaoTotal).not.toBe(326973); // só os filhos, sem conter o pai
  });

  it('Entrada = 1.120.350, inalterada (o pai NÃO muda de grupo)', () => {
    expect(groups.entrada.reduce((s, d) => s + d.value, 0)).toBe(1120350);
    expect(resolveGroup(CAG_ENTRADA, p, 'energy').group).toBe('entrada');
    const baseline = groupAll(MOXUARA, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(baseline.entrada.reduce((s, d) => s + d.value, 0)).toBe(1120350);
  });

  it('residual sem clamp mascarando negativo (filhos 326.973 são o único desconto)', () => {
    // areacomum = só a composição (326.973) → residual = 0, e é 0 de verdade.
    expect(r.areacomumTotal).toBe(326973);
    expect(r.residual.subtotalFromBaseGroup).toBe(326973); // filhos, uma vez
    expect(r.residual.subtotalCrossGroup).toBe(336600); // pai, informativo, NÃO descontado
    expect(r.residual.residualRaw).toBe(0);
    expect(r.residual.negative).toBe(false);
    // prova da não-dupla-subtração: se o pai TAMBÉM fosse descontado, daria −336.600
    expect(r.residual.residualRaw).not.toBe(326973 - 326973 - 336600);
  });

  it('a composição segue enumerada como breakdown aninhado (Chillers/Fancoils/Bombas)', () => {
    expect(r.climatizacaoParents).toHaveLength(1);
    expect(r.climatizacaoChildren.length).toBe(3 + 14 + 13); // 30 equipamentos
    expect(r.byProfile.CHILLER).toBe(184661);
    expect(r.byProfile.FANCOIL).toBe(96046);
    expect(r.byProfile.BOMBA_CAG).toBe(46266);
  });
});

describe('RFC-0207 parent vs include — CONTÉM × SOMA (totais diferentes)', () => {
  const groups = groupAll(MOXUARA, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);

  it('mesmo device + mesmos dados: parent=336.600, include=663.573', () => {
    const pParent = profileWithOverrides([{ id: CAG_ENTRADA_ID, mode: 'parent' }]);
    const pInclude = profileWithOverrides([{ id: CAG_ENTRADA_ID, mode: 'include' }]);

    const rParent = runBreakdown(groupAll(MOXUARA, pParent), pParent);
    const rInclude = runBreakdown(groupAll(MOXUARA, pInclude), pInclude);

    expect(rParent.climatizacaoTotal).toBe(336600); // CONTÉM
    expect(rInclude.climatizacaoTotal).toBe(336600 + 326973); // SOMA (feed paralelo)
    expect(rParent.climatizacaoTotal).not.toBe(rInclude.climatizacaoTotal);
  });

  it('sem override o grupo/coluna são idênticos nos dois (o modo só muda o breakdown)', () => {
    // sanity: sem overrides, o card de climatização é a composição pura
    const r = runBreakdown(groups, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(r.climatizacaoTotal).toBe(326973);
    expect(r.climatizacaoParents).toHaveLength(0);
  });
});

describe('RFC-0207 parent — caminho sem-override é byte-idêntico', () => {
  it('selectBreakdownItems sem overrides não emite isParent e devolve o grupo base', () => {
    const groups = groupAll(MOXUARA, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const entries = selectBreakdownItems<Device>(groups, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(entries.map((e) => e.item)).toEqual(groups.areacomum);
    expect(entries.every((e) => !('isParent' in e))).toBe(true);
  });

  it('computeBaseGroupResidual sem baseGroupContribution = total − cross (inalterado)', () => {
    const r = computeBaseGroupResidual(1000, [
      { category: 'climatizacao', total: 900, crossGroupTotal: 600 },
    ]);
    expect(r.subtotalFromBaseGroup).toBe(300);
    expect(r.residualRaw).toBe(700);
  });
});
