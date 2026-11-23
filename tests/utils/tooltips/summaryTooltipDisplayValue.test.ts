/**
 * ED-1389 — overrides opcionais de exibição no resumo ℹ️ (Energy/WaterSummaryTooltip),
 * usados pelo modo R$ do TELEMETRY_INFO v5.2.0:
 *   - `CategorySummary.displayValue` substitui o consumo formatado da linha;
 *   - `totalDisplayValue` substitui o "Consumo Total";
 *   - `valueLabel` / `totalLabel` trocam os rótulos "Consumo" / "Consumo Total".
 * Sem eles, o HTML é exatamente o de antes.
 */
import { describe, it, expect } from 'vitest';
import { EnergySummaryTooltip, type DashboardEnergySummary } from '../../../src/utils/tooltips/EnergySummaryTooltip';
import { WaterSummaryTooltip, type DashboardWaterSummary } from '../../../src/utils/tooltips/WaterSummaryTooltip';

const status = {
  waiting: 0,
  weakConnection: 0,
  offline: 0,
  normal: 2,
  alert: 0,
  failure: 0,
  standby: 0,
  noConsumption: 0,
};

function energy(): DashboardEnergySummary {
  return {
    totalDevices: 2,
    totalConsumption: 1500,
    unit: 'kWh',
    byCategory: [
      { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 1, consumption: 1500, percentage: 100 },
      {
        id: 'areaComum',
        name: 'Área Comum',
        icon: '🏢',
        deviceCount: 1,
        consumption: 500,
        percentage: 33,
        children: [{ id: 'climatizacao', name: 'Climatização', icon: '❄️', deviceCount: 1, consumption: 500, percentage: 33 }],
      },
    ],
    byStatus: status as DashboardEnergySummary['byStatus'],
    lastUpdated: '2026-11-23T12:00:00.000Z',
  };
}

function water(): DashboardWaterSummary {
  return {
    totalDevices: 2,
    totalConsumption: 300,
    unit: 'm³',
    byCategory: [
      { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 1, consumption: 300, percentage: 100 },
      { id: 'lojas', name: 'Lojas', icon: '🏪', deviceCount: 1, consumption: 120, percentage: 40 },
    ],
    byStatus: status as unknown as DashboardWaterSummary['byStatus'],
    lastUpdated: '2026-11-23T12:00:00.000Z',
  };
}

const cells = (html: string, cls: string) =>
  [...html.matchAll(new RegExp(`class="${cls}">\\s*([^<]*?)\\s*</span>`, 'g'))].map((m) => m[1]);

describe('ED-1389 — EnergySummaryTooltip display overrides', () => {
  it('sem overrides: rótulos e valores físicos de sempre (campos undefined não mudam nada)', () => {
    const base = EnergySummaryTooltip.renderHTML(energy());
    const withUndefined = EnergySummaryTooltip.renderHTML({
      ...energy(),
      totalDisplayValue: undefined,
      valueLabel: undefined,
      totalLabel: undefined,
    });
    expect(withUndefined).toBe(base);
    expect(base).toContain('<span>Consumo</span>');
    expect(base).toContain('>Consumo Total<');
    expect(cells(base, 'energy-summary-tooltip__category-consumption').every((v) => /kWh|MWh/.test(v))).toBe(true);
  });

  it('com overrides: linhas, total e rótulos em R$/"-", sem unidade física', () => {
    const s = energy();
    s.byCategory[0].displayValue = '-';
    s.byCategory[1].displayValue = 'R$ 1.234,56';
    s.byCategory[1].children![0].displayValue = 'R$ 999,00';
    const html = EnergySummaryTooltip.renderHTML({
      ...s,
      totalDisplayValue: '-',
      valueLabel: 'Custo estimado',
      totalLabel: 'Custo estimado total',
    });
    expect(cells(html, 'energy-summary-tooltip__category-consumption')).toEqual(['-', 'R$ 1.234,56', 'R$ 999,00']);
    expect(html).toContain('<span>Custo estimado</span>');
    expect(html).toContain('>Custo estimado total<');
    expect(cells(html, 'energy-summary-tooltip__total-value')).toEqual(['-']);
    expect(html).not.toMatch(/\d kWh|\d MWh/);
  });

  it('override é escapado', () => {
    const s = energy();
    s.byCategory[0].displayValue = '<b>x</b>';
    expect(EnergySummaryTooltip.renderHTML(s)).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('ED-1389 — WaterSummaryTooltip display overrides', () => {
  it('sem overrides: igual ao de sempre', () => {
    const base = WaterSummaryTooltip.renderHTML(water());
    expect(WaterSummaryTooltip.renderHTML({ ...water(), totalDisplayValue: undefined })).toBe(base);
    expect(base).toContain('<span>Consumo</span>');
    expect(base).toContain('>Consumo Total<');
  });

  it('com overrides: R$/"-" no lugar de m³', () => {
    const s = water();
    s.byCategory[0].displayValue = '-';
    s.byCategory[1].displayValue = 'R$ 10,00';
    const html = WaterSummaryTooltip.renderHTML({
      ...s,
      totalDisplayValue: '-',
      valueLabel: 'Custo estimado',
      totalLabel: 'Custo estimado total',
    });
    expect(cells(html, 'water-summary-tooltip__category-consumption')).toEqual(['-', 'R$ 10,00']);
    expect(cells(html, 'water-summary-tooltip__total-value')).toEqual(['-']);
    expect(html).toContain('>Custo estimado total<');
    expect(html).not.toMatch(/\d m³/);
  });
});
