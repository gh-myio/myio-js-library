// ED-996: locks the summaryType behavior in the "Relatório Geral" summary card —
// temperature (summaryType: 'average') must show the average across devices,
// energy/water (summaryType: 'total') must keep summing. Regression guard so a
// future change can't silently bring back the "sum labeled as average" bug.
import { describe, it, expect } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import type { OpenAllReportParams } from '../../../src/components/premium-modals/types';

function baseParams(domain: OpenAllReportParams['domain']): OpenAllReportParams {
  return {
    customerId: 'customer-1',
    domain,
    api: {},
  };
}

// domainConfig.totalLabel per domain (see DOMAIN_CONFIG in AllReportModal.ts):
// energy -> 'Total kWh', water -> 'Total m³', temperature -> 'Média °C'.
function summaryValueFor(label: string): string {
  const container = document.getElementById('summary-container')!;
  const cardCells = Array.from(container.querySelectorAll(':scope > div > div > div'));
  const labelDiv = cardCells.find((el) => el.textContent === label);
  if (!labelDiv) throw new Error(`summary card not found for label: ${label}`);
  return (labelDiv.previousElementSibling as HTMLElement).textContent!;
}

describe('AllReportModal — summaryType (ED-996)', () => {
  it('temperature (average): summary card shows the average across devices, not the sum', () => {
    const modal = new AllReportModal(baseParams('temperature'));
    modal.show();

    (modal as any).data = [
      { identifier: 'T1', name: 'Sensor 1', consumption: 20 },
      { identifier: 'T2', name: 'Sensor 2', consumption: 30 },
    ];
    (modal as any).renderSummary();

    // (20 + 30) / 2 = 25, not the sum (50).
    expect(summaryValueFor('Média °C')).toBe('25,00');
  });

  it('energy (total): summary card keeps summing across devices', () => {
    const modal = new AllReportModal(baseParams('energy'));
    modal.show();

    (modal as any).data = [
      { identifier: 'E1', name: 'Loja 1', consumption: 20 },
      { identifier: 'E2', name: 'Loja 2', consumption: 30 },
    ];
    (modal as any).renderSummary();

    expect(summaryValueFor('Total kWh')).toBe('50,00');
  });

  it('water (total): summary card keeps summing across devices', () => {
    const modal = new AllReportModal(baseParams('water'));
    modal.show();

    (modal as any).data = [
      { identifier: 'W1', name: 'Hidrômetro 1', consumption: 1.5 },
      { identifier: 'W2', name: 'Hidrômetro 2', consumption: 2.5 },
    ];
    (modal as any).renderSummary();

    expect(summaryValueFor('Total m³')).toBe('4,00');
  });
});
