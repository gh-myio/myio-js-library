import { describe, it, expect } from 'vitest';
import { buildPortfolioSnapshot } from '../../../src/utils/portfolio/buildPortfolioSnapshot';
import { resolveHoldingEnergyCategory } from '../../../src/utils/portfolio/taxonomy';
import type { PortfolioSnapshotInput } from '../../../src/utils/portfolio/types';

const NOW = Date.UTC(2026, 9, 11, 15, 0, 0);
const period = { start: '2026-10-01T03:00:00.000Z', end: '2026-10-11T15:00:00.000Z' };

function fixture(): PortfolioSnapshotInput {
  return {
    now: NOW,
    period,
    temperatureRange: { min: 23, max: 25.5 },
    shoppings: [
      { name: 'Alfa', id: 'a', alarms: 3, alarmDetails: [{ severity: 'CRITICAL' }, { severity: 'LOW' }, { severity: 'LOW' }] },
      { name: 'Beta', id: 'b', alarms: 0, alarmDetails: [] },
      { name: 'Gama', id: 'g', alarms: null },
    ],
    classified: {
      energy: {
        entrada: [{ ownerName: 'Alfa', deviceProfile: 'ENTRADA', value: 9999, deviceStatus: 'power_on' }],
        equipments: [
          { ownerName: 'Alfa', deviceProfile: 'CHILLER', value: 1000, deviceStatus: 'power_on' },
          { ownerName: 'Alfa', deviceProfile: 'ELEVADOR', value: 200, deviceStatus: 'offline' },
          { ownerName: 'Beta', deviceProfile: 'GERADOR_ESPECIAL', value: 50, deviceStatus: 'power_on' },
        ],
        stores: [
          { ownerName: 'Alfa', deviceProfile: '3F_MEDIDOR', value: 500, deviceStatus: 'power_on' },
          { ownerName: 'Beta', deviceProfile: '3F_MEDIDOR', value: 0, deviceStatus: 'power_on' },
        ],
      },
      water: {
        hidrometro_entrada: [{ ownerName: 'Alfa', value: 100, deviceStatus: 'power_on' }],
        hidrometro: [
          { ownerName: 'Alfa', value: 70, deviceStatus: 'power_on' },
          { ownerName: 'Alfa', value: 50, deviceStatus: 'power_on' },
          { ownerName: 'Beta', value: 30, deviceStatus: 'power_on' },
        ],
      },
      temperature: {
        termostato: [
          { ownerName: 'Beta', temperature: 27, deviceStatus: 'power_on' },
          { ownerName: 'Beta', temperature: 26, deviceStatus: 'power_on' },
          { ownerName: 'Beta', temperature: 24, deviceStatus: 'power_on' },
          { ownerName: 'Beta', temperature: '', deviceStatus: 'power_on' },
        ],
      },
    },
  };
}

describe('buildPortfolioSnapshot (RFC-0238)', () => {
  it('soma energia só nos submedidores — a entrada fica fora (sem dupla contagem)', () => {
    const s = buildPortfolioSnapshot(fixture());
    const alfa = s.shoppings.find((r) => r.name === 'Alfa')!;
    expect(alfa.energy.value).toBe(1700);
    expect(s.kpis.energy.value).toBe(1750);
    expect(s.kpis.energy.scopeLabel).toMatch(/submedidores/i);
  });

  it('shopping sem devices aparece com "sem dados" (null), não zero, e torna o KPI parcial', () => {
    const s = buildPortfolioSnapshot(fixture());
    const gama = s.shoppings.find((r) => r.name === 'Gama')!;
    expect(gama.energy.value).toBeNull();
    expect(gama.alarms.open).toBeNull();
    expect(s.kpis.energy.state).toBe('partial');
    expect(s.kpis.energy.coverage).toMatchObject({ covered: 2, total: 3 });
  });

  it('consumo medido 0 é zero (não "sem dados")', () => {
    const s = buildPortfolioSnapshot(fixture());
    const beta = s.shoppings.find((r) => r.name === 'Beta')!;
    expect(beta.energy.value).toBe(50);
  });

  it('balanço de água preserva residual negativo e exclui shopping sem entrada da soma', () => {
    const s = buildPortfolioSnapshot(fixture());
    const alfa = s.shoppings.find((r) => r.name === 'Alfa')!;
    const beta = s.shoppings.find((r) => r.name === 'Beta')!;
    expect(alfa.water).toMatchObject({ supply: 100, downstream: 120, residual: -20 });
    expect(beta.water.supply).toBeNull();
    expect(beta.water.residual).toBeNull();
    expect(s.kpis.water.value).toBe(100);
    expect(s.kpis.water.state).toBe('partial');
    expect(s.priorities.some((p) => p.id === 'Alfa:water-negative')).toBe(true);
  });

  it('demanda e custo ficam "não configurado" — nunca zero inventado', () => {
    const s = buildPortfolioSnapshot(fixture());
    expect(s.kpis.demand).toMatchObject({ state: 'not-configured', value: null });
    expect(s.kpis.cost).toMatchObject({ state: 'not-configured', value: null });
  });

  it('temperatura ignora leitura vazia e conta fora da faixa', () => {
    const s = buildPortfolioSnapshot(fixture());
    const beta = s.shoppings.find((r) => r.name === 'Beta')!;
    expect(beta.temperature.sensors).toBe(3);
    expect(beta.temperature.outOfRange).toBe(2);
    expect(beta.temperature.avg).toBeCloseTo(25.667, 2);
    expect(s.priorities.some((p) => p.id === 'Beta:comfort')).toBe(true);
  });

  it('ordena a matriz por alarmes críticos e prioriza o crítico primeiro', () => {
    const s = buildPortfolioSnapshot(fixture());
    expect(s.shoppings[0].name).toBe('Alfa');
    expect(s.shoppings[0].alarms).toEqual({ open: 3, critical: 1 });
    expect(s.priorities[0]).toMatchObject({ shopping: 'Alfa', severity: 'critical', target: 'alarms' });
    expect(s.priorities.length).toBeLessThanOrEqual(5);
  });

  it('conectividade por domínio e sinal de offline ≥ 10%', () => {
    const s = buildPortfolioSnapshot(fixture());
    const alfa = s.shoppings.find((r) => r.name === 'Alfa')!;
    expect(alfa.connectivity.energy).toEqual({ online: 3, total: 4 });
    expect(s.priorities.some((p) => p.id === 'Alfa:offline-energy')).toBe(true);
  });

  it('categorias da holding: lojas, climatização, transporte vertical e não mapeado visível', () => {
    const s = buildPortfolioSnapshot(fixture());
    const ids = s.categories.map((c) => c.id);
    expect(ids).toContain('hvac');
    expect(ids).toContain('tenants');
    expect(ids).toContain('vertical-transport');
    expect(ids).toContain('unmapped');
    expect(ids).not.toContain('supply');
    const total = s.categories.reduce((x, c) => x + c.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('com lista de shoppings, devices de outros donos ficam fora do escopo e são contados', () => {
    const input = fixture();
    input.classified.energy!.equipments!.push({ ownerName: 'Delta Desativar', deviceProfile: 'CHILLER', value: 5000 });
    const s = buildPortfolioSnapshot(input);
    expect(s.shoppings.map((r) => r.name)).not.toContain('Delta Desativar');
    expect(s.coverage.excludedDevices).toBe(1);
    expect(s.kpis.energy.value).toBe(1750);
  });

  it('é determinístico com relógio fixo', () => {
    expect(buildPortfolioSnapshot(fixture())).toEqual(buildPortfolioSnapshot(fixture()));
    expect(buildPortfolioSnapshot(fixture()).computedAt).toBe(NOW);
  });
});

describe('resolveHoldingEnergyCategory', () => {
  it('usa o contexto e o deviceProfile, nunca o nome', () => {
    expect(resolveHoldingEnergyCategory('3F_MEDIDOR', 'stores')).toBe('tenants');
    expect(resolveHoldingEnergyCategory('BOMBA_CAG', 'equipments')).toBe('hvac');
    expect(resolveHoldingEnergyCategory('BOMBA_HIDRAULICA', 'equipments')).toBe('pumping');
    expect(resolveHoldingEnergyCategory('ESCADA_ROLANTE', 'equipments')).toBe('vertical-transport');
    expect(resolveHoldingEnergyCategory('', 'equipments')).toBe('unmapped');
    expect(resolveHoldingEnergyCategory('XPTO', 'equipments')).toBe('unmapped');
  });
});
