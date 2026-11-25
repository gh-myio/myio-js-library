// ColumnSummaryTooltip — ED-1406: rótulo da grandeza no modo 'consumption' (Custo) e
// marcador "Cobertura incompleta" (moneyCoverage). Sem os campos novos: HTML byte-idêntico.
import { describe, it, expect, afterEach } from 'vitest';
import { ColumnSummaryTooltip } from '../../../src/utils/tooltips/ColumnSummaryTooltip';

afterEach(() => {
  ColumnSummaryTooltip.hide();
  document.body.innerHTML = '';
});

type Data = Parameters<typeof ColumnSummaryTooltip.show>[1];

function showAndGetHTML(data: Data): string {
  const trigger = document.createElement('span');
  document.body.appendChild(trigger);
  ColumnSummaryTooltip.show(trigger, data);
  const roots = document.querySelectorAll('.myio-col-summary');
  return roots.length ? roots[roots.length - 1].outerHTML : '';
}

const DEVICES = [
  { name: 'C&A', value: 1500 },
  { name: 'Loja L1', value: 200 },
  { name: 'Loja L2', value: 100 },
  { name: 'Loja L3', value: 50 },
  { name: 'Loja L5', value: 0 },
  { name: 'Loja L6', value: 300 },
];

describe('ColumnSummaryTooltip — modo consumption sem os campos novos (byte-idêntico)', () => {
  it('formatador padrão (unit)', () => {
    expect(
      showAndGetHTML({
        title: 'Lojas',
        periodLabel: '01/11/2026 — 25/11/2026',
        unit: 'kWh',
        devices: DEVICES,
      })
    ).toMatchSnapshot();
  });

  it('formatValue próprio', () => {
    expect(
      showAndGetHTML({ title: 'Lojas', devices: DEVICES, formatValue: (v: number) => `${v.toFixed(3)} kWh` })
    ).toMatchSnapshot();
  });

  it('sem dispositivos', () => {
    expect(showAndGetHTML({ title: 'Lojas', unit: 'kWh', devices: [] })).toMatchSnapshot();
  });
});

const kpi = (label: string) =>
  [...document.querySelectorAll('.myio-col-summary__kpi')]
    .find((k) => k.querySelector('.myio-col-summary__kpi-label')?.textContent?.trim() === label)
    ?.querySelector('.myio-col-summary__kpi-value');

describe('ColumnSummaryTooltip — ED-1406 (modo R$)', () => {
  const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  it('measureLabel "Custo" no modo consumption → Custo médio / total / footer; nenhum "Consumo"', () => {
    const html = showAndGetHTML({
      title: 'Lojas',
      unit: '',
      devices: DEVICES,
      formatValue: brl,
      measureLabel: 'Custo',
    });
    expect(kpi('Custo médio')?.textContent).toBe('R$ 358,33');
    expect(kpi('Custo total')?.textContent).toBe('R$ 2150,00');
    expect(document.querySelector('.myio-col-summary__footer-label')?.textContent).toBe(
      'Custo Total · 6 dispositivos'
    );
    expect(html).not.toContain('Consumo');
    expect(html).not.toContain('Cobertura incompleta');
  });

  it('moneyCoverage → "Cobertura incompleta (n de m)" no total (KPI e footer), valores físicos', () => {
    const html = showAndGetHTML({
      title: 'Lojas',
      unit: 'kWh',
      devices: DEVICES,
      moneyCoverage: { covered: 5, total: 6 },
    });
    expect(kpi('Consumo total')?.textContent).toBe('2.150 kWhCobertura incompleta (5 de 6)');
    expect(document.querySelector('.myio-col-summary__footer-value .myio-money-coverage')?.textContent).toBe(
      'Cobertura incompleta (5 de 6)'
    );
    expect(kpi('Consumo médio')?.textContent).not.toContain('Cobertura');
    expect(html).not.toContain('R$');
  });
});
