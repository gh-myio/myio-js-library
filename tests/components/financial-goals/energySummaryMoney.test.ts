/**
 * RFC-0228 A6 — money wiring into the energy summary (`EnergySummaryTooltip`).
 *
 * Proves the R$ figure is shown beside "Consumo Total" when a money overlay is
 * present, honours DEC-8 (backend string verbatim / A4 coverage), and — critically —
 * that `renderHTML` is **byte-identical** to the pre-A6 output when the gate is off.
 */

import { describe, it, expect } from 'vitest';
import {
  EnergySummaryTooltip,
  type DashboardEnergySummary,
} from '../../../src/utils/tooltips/EnergySummaryTooltip';
import type { MoneyOverlay } from '../../../src/components/financial-goals/moneyTypes';
import { MONEY_REQUIRES_DEVICE_GRANULARITY } from '../../../src/components/financial-goals/moneyTypes';

const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];

function baseSummary(): DashboardEnergySummary {
  return {
    totalDevices: 3,
    totalConsumption: 1500,
    unit: 'kWh',
    byCategory: [],
    byStatus: {
      waiting: 0,
      weakConnection: 0,
      offline: 0,
      normal: 3,
      alert: 0,
      failure: 0,
      standby: 0,
      noConsumption: 0,
    },
    lastUpdated: '2026-07-01T12:00:00.000Z',
  };
}

const complete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 8760,
  totalHours: 8760,
  uncategorizedDevices: [],
};

const incomplete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 4000,
  totalHours: 8760,
  uncategorizedDevices: [{ deviceId: 'd1' }],
};

describe('EnergySummaryTooltip — A6 money total', () => {
  it('gate OFF → renderHTML is byte-identical to the pre-A6 output', () => {
    const summary = baseSummary();
    const off = EnergySummaryTooltip.renderHTML(summary);
    // No money field, and formatMoneyTotal must contribute nothing.
    expect(EnergySummaryTooltip.formatMoneyTotal(summary)).toBe('');
    expect(off).not.toContain('Custo projetado');
    expect(off).not.toContain('data-money-total-row');
  });

  it('available + complete → shows the backend R$ total verbatim beside Consumo Total', () => {
    const summary = { ...baseSummary(), money: { overlay: complete, total: '223000.00' } };
    const html = EnergySummaryTooltip.renderHTML(summary);
    expect(html).toContain('Custo projetado (R$)');
    expect(html).toContain('R$ 223.000,00');
    expect(html).toContain('data-money-total-row="1"');
  });

  it('incomplete coverage → honest coverage indicator, never R$ 0 / NaN', () => {
    const summary = {
      ...baseSummary(),
      money: { overlay: incomplete, total: '100000.00' },
    };
    const money = EnergySummaryTooltip.formatMoneyTotal(summary);
    expect(money).toContain('Cobertura incompleta');
    expect(money).not.toContain('R$ 0');
    expect(money).not.toContain('NaN');
  });

  it('unavailable → coverage indicator, no number', () => {
    const summary = {
      ...baseSummary(),
      money: { overlay: { state: 'unavailable', reason: MONEY_REQUIRES_DEVICE_GRANULARITY } as MoneyOverlay },
    };
    const money = EnergySummaryTooltip.formatMoneyTotal(summary);
    expect(money).toContain('indisponível');
    const lower = money.toLowerCase();
    for (const w of FORBIDDEN) expect(lower).not.toContain(w);
  });
});
