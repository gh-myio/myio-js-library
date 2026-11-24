/**
 * ED-1391 — FilterOrderingModal: formatValue / emptyValueText / hideShare (modo R$ do All
 * Report). Ausentes → chips idênticos (valor pt-BR + unidade + % de participação).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachFilterOrderingModal } from '../../../src/components/premium-modals/internal/filter-ordering/FilterOrderingModal';

const items = [
  { id: 'a', label: 'Loja A', consumption: 50 },
  { id: 'b', label: 'Trafo', consumption: null },
];

let handle: { destroy(): void } | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.innerHTML = '';
});

const chipMetrics = (label: string) => {
  const chip = Array.from(document.querySelectorAll('.chip')).find((c) => c.querySelector('.label')?.textContent === label);
  return {
    value: chip?.querySelector('.metrics-value')?.textContent?.trim() ?? null,
    perc: chip?.querySelector('.metrics-perc')?.textContent?.trim() ?? null,
  };
};

describe('FilterOrderingModal — money display props (ED-1391)', () => {
  it('formatValue + emptyValueText + hideShare + i18n', () => {
    const h = attachFilterOrderingModal({
      items,
      onApply: vi.fn(),
      formatValue: (v) => `R$ ${v.toFixed(2).replace('.', ',')}`,
      emptyValueText: '-',
      hideShare: true,
      i18n: { consumptionDesc: 'Custo ↓ (padrão)' },
    });
    handle = h;
    h.open();
    expect(chipMetrics('Loja A')).toEqual({ value: 'R$ 50,00', perc: null });
    expect(chipMetrics('Trafo')).toEqual({ value: '-', perc: null });
    expect(document.body.textContent).toContain('Custo ↓ (padrão)');
  });

  it('props absent → value + unit + participation %, nothing for null (unchanged)', () => {
    const h = attachFilterOrderingModal({ items, onApply: vi.fn(), unit: 'kWh' });
    handle = h;
    h.open();
    expect(chipMetrics('Loja A')).toEqual({ value: '50,00 kWh', perc: '100,00%' });
    expect(chipMetrics('Trafo')).toEqual({ value: null, perc: null });
  });
});
