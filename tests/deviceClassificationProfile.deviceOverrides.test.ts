/**
 * RFC-0207 "Dispositivos Específicos" — device-level overrides in the breakdown.
 *
 * Cenário real (Shopping da Ilha):
 *   - "Medição Geral CAG" (deviceProfile ENTRADA, identifier CAG) é um TRAFO DE
 *     ENTRADA que mede TODA a alimentação da CAG: 637.560. Ele fica no grupo
 *     `entrada` (correto — conta no total de entrada), mas o operador quer que o
 *     valor apareça TAMBÉM no card de Climatização, porque aquela energia É
 *     climatização.
 *   - As 9 "Bomba CAG" (deviceProfile BOMBA_CAG, identifier CAG) somam 155.671 e
 *     JÁ caem em climatização pela regra de identifier. Elas estão FISICAMENTE
 *     DENTRO dos 637.560 do trafo → precisam sair do breakdown, senão o card
 *     dobra a contagem (793.231).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveGroup,
  resolveCategory,
  validateProfile,
  normalizeProfile,
  collectDeviceOverrides,
  selectBreakdownItems,
  normalizeDeviceOverrideId,
  type DeviceClassificationProfile,
  type ClassifiableItem,
  type CategoryName,
} from '../src/utils/devices/deviceClassificationProfile';

// ---------------------------------------------------------------------------
// Fixture — números reais do Shopping da Ilha
// ---------------------------------------------------------------------------

interface Device extends ClassifiableItem {
  id: string;
  label: string;
  value: number;
}

const TRAFO_CAG_ID = 'a1b2c3d4-0000-0000-0000-00000000cag0';

const GERAL_ENTRADA: Device = {
  id: 'e0000000-0000-0000-0000-000000000001',
  label: 'Geral Entrada',
  deviceProfile: 'ENTRADA',
  identifier: 'ENTRADA-GERAL',
  value: 752677,
};

const MEDICAO_GERAL_CAG: Device = {
  id: TRAFO_CAG_ID,
  label: 'Medição Geral CAG',
  deviceProfile: 'ENTRADA',
  identifier: 'CAG',
  value: 637560,
};

// 9 bombas somando 155.671 (a 9ª fecha a conta).
const BOMBA_VALUES = [17297, 17297, 17297, 17297, 17297, 17297, 17297, 17297, 17295];
const BOMBAS: Device[] = BOMBA_VALUES.map((value, i) => ({
  id: `b0000000-0000-0000-0000-00000000000${i + 1}`,
  label: `Bomba CAG ${i + 3}`,
  deviceProfile: 'BOMBA_CAG',
  identifier: 'CAG',
  value,
}));

const OUTRO_AREACOMUM: Device = {
  id: 'c0000000-0000-0000-0000-000000000001',
  label: 'Iluminação Mall',
  deviceProfile: 'ILUMINACAO',
  identifier: 'ILU-01',
  value: 1000,
};

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

/** Perfil DEFAULT + os overrides pedidos, já normalizado (como no save do modal). */
function profileWithOverrides(
  overrides: { id: string; label?: string; mode: 'include' | 'exclude' }[],
  category: CategoryName = 'climatizacao',
): DeviceClassificationProfile {
  const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
  const rule = p.domains.energy.categories!.rules.find((r) => r.name === category)!;
  rule.deviceOverrides = overrides;
  return normalizeProfile(p);
}

/** Reproduz o laço do breakdown do MAIN_VIEW (buildSummary) sobre os grupos. */
function runBreakdown(groups: Record<string, Device[]>, profile: DeviceClassificationProfile) {
  const buckets: Record<string, Device[]> = {};
  for (const { item, forcedCategory } of selectBreakdownItems<Device>(groups, profile, 'energy')) {
    const cat = forcedCategory || resolveCategory(item, profile, 'energy').category;
    (buckets[cat] ||= []).push(item);
  }
  const totals: Record<string, number> = {};
  for (const [k, list] of Object.entries(buckets)) {
    totals[k] = list.reduce((s, i) => s + i.value, 0);
  }
  return { buckets, totals };
}

/** Agrupa os devices como o categorizeItemsByGroup faria. */
function groupAll(devices: Device[], profile: DeviceClassificationProfile) {
  const groups: Record<string, Device[]> = { lojas: [], entrada: [], areacomum: [], ocultos: [] };
  for (const d of devices) groups[resolveGroup(d, profile, 'energy').group].push(d);
  return groups;
}

const ALL_DEVICES = [GERAL_ENTRADA, MEDICAO_GERAL_CAG, ...BOMBAS, OUTRO_AREACOMUM];

// ---------------------------------------------------------------------------

describe('RFC-0207 deviceOverrides — schema', () => {
  it('DEFAULT profile não declara deviceOverrides (campo é opt-in)', () => {
    for (const rule of DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy.categories!.rules) {
      expect(rule.deviceOverrides).toBeUndefined();
    }
  });

  it('ausência do campo não gera erro de validação (retrocompat)', () => {
    expect(validateProfile(DEFAULT_DEVICE_CLASSIFICATION_PROFILE)).toEqual([]);
  });

  it('validateProfile aceita uma lista bem formada', () => {
    const p = profileWithOverrides([
      { id: TRAFO_CAG_ID, label: 'Medição Geral CAG', mode: 'include' },
      { id: BOMBAS[0].id, label: 'Bomba CAG 3', mode: 'exclude' },
    ]);
    expect(validateProfile(p)).toEqual([]);
  });

  it('validateProfile acusa deviceOverrides não-array, id vazio, mode inválido e label não-string', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const rules = p.domains.energy.categories!.rules;
    (rules.find((r) => r.name === 'elevadores') as Record<string, unknown>).deviceOverrides =
      'nope';
    rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: '   ', mode: 'include' },
      { id: 'x', mode: 'maybe' as unknown as 'include' },
      { id: 'y', mode: 'include', label: 42 as unknown as string },
    ];
    const errs = validateProfile(p);
    expect(errs.some((e) => e.includes('deviceOverrides: must be an array'))).toBe(true);
    expect(errs.some((e) => e.includes('deviceOverrides[0].id'))).toBe(true);
    expect(errs.some((e) => e.includes('deviceOverrides[1].mode'))).toBe(true);
    expect(errs.some((e) => e.includes('deviceOverrides[2].label'))).toBe(true);
  });

  it('normalizeProfile faz round-trip: preserva id/label, NÃO faz upper-case, dropa entradas sem id', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    p.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: `  ${TRAFO_CAG_ID}  `, label: 'Medição Geral CAG', mode: 'include' },
      { id: '', label: 'lixo', mode: 'include' },
      // duplicata exata → deduplicada
      { id: TRAFO_CAG_ID, label: 'Medição Geral CAG', mode: 'include' },
    ];
    const n = normalizeProfile(p);
    const ovs = n.domains.energy.categories!.rules.find((r) => r.name === 'climatizacao')!
      .deviceOverrides!;
    expect(ovs).toEqual([
      { id: TRAFO_CAG_ID, mode: 'include', label: 'Medição Geral CAG' },
    ]);
    // idempotente
    expect(normalizeProfile(n)).toEqual(n);
  });

  it('normalizeProfile mantém ausência como ausência', () => {
    const n = normalizeProfile(clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE));
    for (const rule of n.domains.energy.categories!.rules) {
      expect(rule.deviceOverrides).toBeUndefined();
    }
  });

  it('normalizeDeviceOverrideId usa a mesma chave de excludeDevicesAtCountSubtotalCAG', () => {
    expect(normalizeDeviceOverrideId('  AbC-123 ')).toBe('abc-123');
    expect(normalizeDeviceOverrideId(null)).toBe('');
  });
});

describe('RFC-0207 deviceOverrides — collectDeviceOverrides', () => {
  it('mapeia include → categoria e exclude → set global', () => {
    const p = profileWithOverrides([
      { id: TRAFO_CAG_ID, label: 'Medição Geral CAG', mode: 'include' },
      { id: BOMBAS[0].id, mode: 'exclude' },
    ]);
    const { includes, excludes, labels } = collectDeviceOverrides(p, 'energy');
    expect(includes.get(TRAFO_CAG_ID)).toBe('climatizacao');
    expect(excludes.has(BOMBAS[0].id)).toBe(true);
    expect(labels.get(TRAFO_CAG_ID)).toBe('Medição Geral CAG');
  });

  it('exclude vence include quando o mesmo device aparece nos dois', () => {
    const p = profileWithOverrides([
      { id: TRAFO_CAG_ID, mode: 'include' },
      { id: TRAFO_CAG_ID, mode: 'exclude' },
    ]);
    const { includes, excludes } = collectDeviceOverrides(p, 'energy');
    expect(includes.has(TRAFO_CAG_ID)).toBe(false);
    expect(excludes.has(TRAFO_CAG_ID)).toBe(true);
  });

  it('exclude vence include mesmo em categorias diferentes', () => {
    const p: DeviceClassificationProfile = clone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const rules = p.domains.energy.categories!.rules;
    rules.find((r) => r.name === 'climatizacao')!.deviceOverrides = [
      { id: TRAFO_CAG_ID, mode: 'include' },
    ];
    rules.find((r) => r.name === 'elevadores')!.deviceOverrides = [
      { id: TRAFO_CAG_ID, mode: 'exclude' },
    ];
    const { includes, excludes } = collectDeviceOverrides(normalizeProfile(p), 'energy');
    expect(includes.has(TRAFO_CAG_ID)).toBe(false);
    expect(excludes.has(TRAFO_CAG_ID)).toBe(true);
  });

  it('perfil sem overrides devolve coleções vazias', () => {
    const { includes, excludes } = collectDeviceOverrides(
      DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
      'energy',
    );
    expect(includes.size).toBe(0);
    expect(excludes.size).toBe(0);
  });
});

describe('RFC-0207 deviceOverrides — selectBreakdownItems', () => {
  it('sem overrides: devolve exatamente o grupo base (zero mudança de comportamento)', () => {
    const groups = groupAll(ALL_DEVICES, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const entries = selectBreakdownItems<Device>(groups, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(entries.map((e) => e.item)).toEqual(groups.areacomum);
    expect(entries.every((e) => e.forcedCategory === null)).toBe(true);
  });

  it('include puxa um device que NÃO está no grupo base (entrada → breakdown)', () => {
    const p = profileWithOverrides([{ id: TRAFO_CAG_ID, mode: 'include' }]);
    const groups = groupAll(ALL_DEVICES, p);
    expect(groups.entrada).toContain(MEDICAO_GERAL_CAG); // continua na entrada
    const entries = selectBreakdownItems<Device>(groups, p);
    const pulled = entries.find((e) => e.item.id === TRAFO_CAG_ID);
    expect(pulled).toBeDefined();
    expect(pulled!.forcedCategory).toBe('climatizacao');
  });

  it('include NÃO altera o grupo do device (Entrada intacta)', () => {
    const p = profileWithOverrides([{ id: TRAFO_CAG_ID, mode: 'include' }]);
    expect(resolveGroup(MEDICAO_GERAL_CAG, p, 'energy').group).toBe('entrada');
    expect(resolveGroup(MEDICAO_GERAL_CAG, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'energy').group).toBe(
      'entrada',
    );
  });

  it('exclude remove o device do breakdown por completo', () => {
    const p = profileWithOverrides(BOMBAS.map((b) => ({ id: b.id, mode: 'exclude' as const })));
    const groups = groupAll(ALL_DEVICES, p);
    const entries = selectBreakdownItems<Device>(groups, p);
    const ids = entries.map((e) => e.item.id);
    for (const b of BOMBAS) expect(ids).not.toContain(b.id);
    expect(ids).toContain(OUTRO_AREACOMUM.id); // o resto do areacomum segue lá
  });

  it('device sem id nunca é puxado nem excluído (degrada para o caminho normal)', () => {
    const anon = { label: 'sem id', deviceProfile: 'ILUMINACAO', value: 5 } as unknown as Device;
    const p = profileWithOverrides([{ id: TRAFO_CAG_ID, mode: 'include' }]);
    const entries = selectBreakdownItems<Device>({ areacomum: [anon], entrada: [] }, p);
    expect(entries).toEqual([
      { item: anon, forcedCategory: null, sourceGroup: 'areacomum', fromBaseGroup: true },
    ]);
  });

  it('marca a origem de cada entrada (fromBaseGroup / sourceGroup)', () => {
    const p = profileWithOverrides([{ id: TRAFO_CAG_ID, mode: 'include' }]);
    const groups = groupAll(ALL_DEVICES, p);
    const entries = selectBreakdownItems<Device>(groups, p);

    const pulled = entries.find((e) => e.item.id === TRAFO_CAG_ID)!;
    expect(pulled.fromBaseGroup).toBe(false);
    expect(pulled.sourceGroup).toBe('entrada');

    const native = entries.find((e) => e.item.id === OUTRO_AREACOMUM.id)!;
    expect(native.fromBaseGroup).toBe(true);
    expect(native.sourceGroup).toBe('areacomum');
  });

  it('sem overrides, TODA entrada vem do grupo base', () => {
    const groups = groupAll(ALL_DEVICES, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const entries = selectBreakdownItems<Device>(groups, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(entries.every((e) => e.fromBaseGroup === true)).toBe(true);
    expect(entries.every((e) => e.sourceGroup === 'areacomum')).toBe(true);
  });

  it('baseGroup é configurável', () => {
    const p = profileWithOverrides([{ id: OUTRO_AREACOMUM.id, mode: 'include' }]);
    const entries = selectBreakdownItems<Device>(
      { lojas: [OUTRO_AREACOMUM], entrada: [MEDICAO_GERAL_CAG] },
      p,
      'energy',
      { baseGroup: 'lojas' },
    );
    expect(entries.map((e) => e.item.id)).toEqual([OUTRO_AREACOMUM.id]);
  });
});

describe('RFC-0207 deviceOverrides — exclude NÃO vaza para outros', () => {
  it('as bombas excluídas não aparecem em NENHUM bucket do breakdown', () => {
    const p = profileWithOverrides([
      { id: TRAFO_CAG_ID, label: 'Medição Geral CAG', mode: 'include' },
      ...BOMBAS.map((b) => ({ id: b.id, label: b.label, mode: 'exclude' as const })),
    ]);
    const groups = groupAll(ALL_DEVICES, p);
    const { buckets } = runBreakdown(groups, p);
    const allBreakdownIds = Object.values(buckets).flat().map((d) => d.id);
    for (const b of BOMBAS) expect(allBreakdownIds).not.toContain(b.id);
    expect((buckets.outros || []).map((d) => d.id)).not.toContain(BOMBAS[0].id);
  });

  it('sem o override, as bombas CAIRIAM em climatização (prova que o exclude fez trabalho)', () => {
    for (const b of BOMBAS) {
      expect(resolveCategory(b, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'energy').category).toBe(
        'climatizacao',
      );
    }
  });
});

describe('RFC-0207 deviceOverrides — aceitação Shopping da Ilha', () => {
  const p = profileWithOverrides([
    { id: TRAFO_CAG_ID, label: 'Medição Geral CAG', mode: 'include' },
    ...BOMBAS.map((b) => ({ id: b.id, label: b.label, mode: 'exclude' as const })),
  ]);
  const groups = groupAll(ALL_DEVICES, p);

  it('a fixture reproduz os números reais', () => {
    expect(BOMBAS.reduce((s, b) => s + b.value, 0)).toBe(155671);
    expect(MEDICAO_GERAL_CAG.value).toBe(637560);
    expect(GERAL_ENTRADA.value).toBe(752677);
  });

  it('Climatização = 637.560 (NÃO 793.231 — o bug de dupla contagem)', () => {
    const { totals } = runBreakdown(groups, p);
    expect(totals.climatizacao).toBe(637560);
    expect(totals.climatizacao).not.toBe(637560 + 155671);
  });

  it('Entrada = 1.390.237, inalterada pelo override', () => {
    const entradaTotal = groups.entrada.reduce((s, d) => s + d.value, 0);
    expect(entradaTotal).toBe(1390237);
    const baseline = groupAll(ALL_DEVICES, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(baseline.entrada.reduce((s, d) => s + d.value, 0)).toBe(entradaTotal);
  });

  it('as 9 bombas não aparecem em bucket nenhum', () => {
    const { buckets } = runBreakdown(groups, p);
    const ids = Object.values(buckets).flat().map((d) => d.id);
    expect(BOMBAS.every((b) => !ids.includes(b.id))).toBe(true);
  });

  it('o trafo incluído cai numa subcategoria defensável (regras de texto → CAG)', () => {
    // As sub-subcategorias vivem no MAIN_VIEW (combined = labelWidget+profile+label).
    // Aqui só garantimos que o texto do trafo bate em CAG antes de BOMBA/CHILLER.
    const combined = `${''} ${MEDICAO_GERAL_CAG.deviceProfile} ${MEDICAO_GERAL_CAG.label}`.toUpperCase();
    expect(combined.includes('CHILLER')).toBe(false);
    expect(combined.includes('FANCOIL')).toBe(false);
    expect(combined.includes('BOMBA')).toBe(false);
    expect(combined.includes('CAG')).toBe(true);
  });

  it('baseline (perfil DEFAULT) mostraria o bug: climatização = 155.671 sem o trafo', () => {
    const baseGroups = groupAll(ALL_DEVICES, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    const { totals } = runBreakdown(baseGroups, DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(totals.climatizacao).toBe(155671);
  });
});
