import { describe, it, expect } from 'vitest';
import {
  buildReportItemsList,
  resolveReportItemStates,
  resolveInitialDomain,
  validateCatalog,
  DEFAULT_REPORTS_CATALOG,
  DEFAULT_ENABLED_REPORT_ITEMS,
} from '../../src/components/premium-modals/reports-hub';
import type { ReportsCatalog } from '../../src/components/premium-modals/reports-hub';
// @ts-ignore - plain JS fixture
import { legacyBuildItemsList, legacyEnabled, LEGACY_KEYS } from '../fixtures/reports-hub/legacy-menu.js';

const groups = {
  lojas: [
    { ingestionId: 'ing-1', id: 'tb-1', identifier: 'L-01', label: 'Loja 1', excludeGroupsTotals: '{"lojas":true}' },
    { id: 'tb-2', name: 'Loja 2' },
    { label: '', name: '', identifier: '' },
  ],
  entrada: [{ ingestionId: 'ing-e', label: 'Entrada', excludeGroupsTotals: { entrada: true } }],
  areacomum: [{ ingestionId: 'ing-a', identifier: 'AC-1' }],
  transformadores: [{ ingestionId: 'ing-t', label: 'Trafo' }],
  ocultos: [{ ingestionId: 'ing-o', label: 'Oculto' }],
};
const tempGroups = {
  climatizavel: [
    { ingestionId: 't-1', label: 'Sala', offSetTemperature: '1.5' },
    { ingestionId: 't-2', label: 'Hall', offSetTemperature: 'abc' },
    { ingestionId: 't-3', label: 'Doca' },
  ],
};

describe('RFC-0239 characterization — buildReportItemsList matches the legacy MENU', () => {
  const cases: Array<[string, Record<string, unknown[]>, 'energy' | 'water' | 'temperature', string]> = [
    ['energy lojas', groups, 'energy', 'lojas'],
    ['energy entrada', groups, 'energy', 'entrada'],
    ['energy area_comum → areacomum', groups, 'energy', 'area_comum'],
    ['water lojas', groups, 'water', 'lojas'],
    ['temperature climatizavel', tempGroups, 'temperature', 'climatizavel'],
    ['unknown group', groups, 'energy', 'nope'],
  ];
  it.each(cases)('%s', (_n, g, domain, group) => {
    const legacy = legacyBuildItemsList(g, domain, group);
    expect(legacy.length).toBeGreaterThanOrEqual(0);
    expect(buildReportItemsList(g as never, domain, group)).toEqual(legacy);
  });

  it('todos: same as legacy except C-2 (areacomum labelled "Área Comum")', () => {
    const legacy = legacyBuildItemsList(groups, 'energy', 'todos');
    const next = buildReportItemsList(groups as never, 'energy', 'todos');
    expect(next).toHaveLength(legacy.length);
    next.forEach((item, i) => {
      if (legacy[i].groupLabel === 'areacomum') expect(item).toEqual({ ...legacy[i], groupLabel: 'Área Comum' });
      else expect(item).toEqual(legacy[i]);
    });
    expect(next.some((i) => i.label === 'Oculto')).toBe(false);
    expect(next.find((i) => i.label === 'Trafo')?.groupLabel).toBe('transformadores');
  });

  it('keeps the || fallbacks: empty strings, NaN offset → 0, missing name → ""', () => {
    const items = buildReportItemsList(groups as never, 'energy', 'lojas');
    expect(items[1]).toEqual({ id: 'tb-2', identifier: 'Loja 2', label: 'Loja 2', excludeGroupsTotals: null });
    expect(items[2]).toEqual({ id: '', identifier: '', label: '', excludeGroupsTotals: null });
    const t = buildReportItemsList(tempGroups as never, 'temperature', 'climatizavel');
    expect(t.map((i) => i.temperatureOffset)).toEqual([1.5, 0, 0]);
    expect(Number('abc') || 0).toBe(0);
  });

  it('excludeGroupsTotals passes as string and as object; inputs are not mutated', () => {
    const snapshot = JSON.stringify(groups);
    const items = buildReportItemsList(groups as never, 'energy', 'todos');
    expect(items.find((i) => i.id === 'ing-1')?.excludeGroupsTotals).toBe('{"lojas":true}');
    expect(items.find((i) => i.id === 'ing-e')?.excludeGroupsTotals).toEqual({ entrada: true });
    expect(JSON.stringify(groups)).toBe(snapshot);
  });

  it('empty or missing groups → []', () => {
    expect(buildReportItemsList({}, 'water', 'lojas')).toEqual([]);
    expect(buildReportItemsList(null, 'water', 'todos')).toEqual([]);
  });

  it('supports MAIN_BAS technical group ids and labels in the combined report', () => {
    const basGroups = {
      setores: [{ ingestionId: 'energy-sector', label: 'Setor A' }],
      equipments: [{ ingestionId: 'equipment-1', label: 'Equipamento 1' }],
      motor: [{ ingestionId: 'motor-1', label: 'Motor 1' }],
      bomba: [{ ingestionId: 'pump-1', label: 'Bomba 1' }],
      hidrometros: [{ ingestionId: 'water-meter-1', label: 'Hidrômetro 1' }],
      banheiros: [{ ingestionId: 'bathroom-meter-1', label: 'Banheiro 1' }],
      areacomum: [{ ingestionId: 'common-meter-1', label: 'Área comum 1' }],
      caixadagua: [{ ingestionId: 'tank-1', label: 'Reservatório 1' }],
      solenoide: [{ ingestionId: 'valve-1', label: 'Válvula 1' }],
    };

    expect(buildReportItemsList(basGroups as never, 'energy', 'setores')[0].id).toBe('energy-sector');
    expect(buildReportItemsList(basGroups as never, 'water', 'hidrometros')[0].id).toBe('water-meter-1');
    expect(buildReportItemsList(basGroups as never, 'water', 'banheiros')[0].id).toBe('bathroom-meter-1');
    expect(buildReportItemsList(basGroups as never, 'energy', 'todos').map((item) => item.groupLabel)).toEqual([
      'Setores',
      'Equipamentos',
      'Motores',
      'Bombas',
      'Hidrômetros',
      'Banheiros',
      'Área Comum',
      'Reservatórios',
      'Válvulas solenoides',
    ]);
  });
});

describe('RFC-0239 characterization — enablement defaults match the legacy MENU', () => {
  const all = () => true;
  it('the 15 legacy keys exist with the same defaults (only energy_lojas on)', () => {
    expect(Object.keys(DEFAULT_ENABLED_REPORT_ITEMS).sort()).toEqual([...LEGACY_KEYS].sort());
    const states = resolveReportItemStates(DEFAULT_REPORTS_CATALOG, {}, all);
    LEGACY_KEYS.forEach((k: string) => {
      expect(states.get(k as never) === 'enabled').toBe(legacyEnabled({}, k));
    });
  });

  it('boolean overrides match the legacy result', () => {
    const raw = { energy_lojas: false, water_todos: true, temperature_todos: true };
    const states = resolveReportItemStates(DEFAULT_REPORTS_CATALOG, raw, all);
    LEGACY_KEYS.forEach((k: string) => {
      expect(states.get(k as never) === 'enabled').toBe(legacyEnabled(raw, k));
    });
  });

  it('C-9: only booleans count — "true", "false", null, 1 fall to the default', () => {
    const states = resolveReportItemStates(
      DEFAULT_REPORTS_CATALOG,
      { energy_lojas: 'false', water_lojas: 'true', water_todos: 1, energy_entrada: null },
      all,
    );
    expect(states.get('energy_lojas')).toBe('enabled');
    expect(states.get('water_lojas')).toBe('locked');
    expect(states.get('water_todos')).toBe('locked');
    expect(states.get('energy_entrada')).toBe('locked');
  });
});

describe('RFC-0239 resolveReportItemStates / catalog', () => {
  const custom: ReportsCatalog = [
    { id: 'water', label: 'Água', items: [{ id: 'x', label: 'X', description: '', icon: '💧', tint: { bg: '#fff', fg: '#000' }, kind: 'group-report' }] },
    { id: 'energy', label: 'Energia', items: [{ id: 'y', label: 'Y', description: '', icon: '⚡', tint: { bg: '#fff', fg: '#000' }, kind: 'group-report' }] },
  ];

  it('custom item locked by default, enabled by its key; unknown keys ignored', () => {
    expect(resolveReportItemStates(custom, { whatever_key: true }, () => true).get('water_x')).toBe('locked');
    expect(resolveReportItemStates(custom, { water_x: true }, () => true).get('water_x')).toBe('enabled');
  });

  it('unavailable → hidden regardless of the flag', () => {
    const s = resolveReportItemStates(DEFAULT_REPORTS_CATALOG, { energy_lojas: true }, (d) => d !== 'energy');
    expect(s.get('energy_lojas')).toBe('hidden');
  });

  it('validateCatalog drops unknown/duplicate domains and duplicate items, keeping order', () => {
    const drops: string[] = [];
    const bad = [
      ...custom,
      { id: 'water', label: 'dup', items: [] },
      { id: 'nope', label: 'n', items: [] },
      { id: 'temperature', label: 'T', items: [custom[0].items[0], custom[0].items[0]] },
    ] as unknown as ReportsCatalog;
    const out = validateCatalog(bad, (w) => drops.push(w));
    expect(out.map((d) => d.id)).toEqual(['water', 'energy', 'temperature']);
    expect(out[2].items).toHaveLength(1);
    expect(drops).toHaveLength(3);
  });

  it('initial tab: Energia when enabled; only Água enabled → Água; none → first visible; nothing → null', () => {
    const cat = DEFAULT_REPORTS_CATALOG;
    const all = () => true;
    expect(resolveInitialDomain(cat, resolveReportItemStates(cat, {}, all))).toBe('energy');
    const onlyWater = { energy_lojas: false, water_todos: true };
    expect(resolveInitialDomain(cat, resolveReportItemStates(cat, onlyWater, all))).toBe('water');
    expect(resolveInitialDomain(cat, resolveReportItemStates(cat, { energy_lojas: false }, all))).toBe('energy');
    expect(resolveInitialDomain(cat, resolveReportItemStates(cat, {}, () => false))).toBeNull();
    expect(resolveInitialDomain(cat, resolveReportItemStates(cat, onlyWater, all), 'temperature')).toBe('temperature');
  });

  it('custom catalog keeps its own order', () => {
    const s = resolveReportItemStates(custom, { water_x: true, energy_y: true }, () => true);
    expect(resolveInitialDomain(custom, s)).toBe('water');
  });
});
