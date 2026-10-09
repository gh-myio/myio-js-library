// ColumnSummaryTooltip — modo 'average' (temperatura): offline fora das médias/listas.
import { describe, it, expect, afterEach } from 'vitest';
import { ColumnSummaryTooltip } from '../../../src/utils/tooltips/ColumnSummaryTooltip';

afterEach(() => {
  ColumnSummaryTooltip.hide();
  document.body.innerHTML = '';
});

function showAndRead(data: Parameters<typeof ColumnSummaryTooltip.show>[1]): string {
  const trigger = document.createElement('span');
  document.body.appendChild(trigger);
  ColumnSummaryTooltip.show(trigger, data);
  return document.body.textContent || '';
}

describe('ColumnSummaryTooltip — modo average (temperatura)', () => {
  const devices = [
    { name: 'Loja A', value: 24 },
    { name: 'Loja B', value: 26 },
    { name: 'Loja C', value: 22 },
    { name: 'Marisa L2', value: 0, offline: true },
    { name: 'Praça', value: 0, offline: true },
  ];
  const fmt = (v: number) => `${v.toFixed(1)}°C`;

  it('conta online/offline e calcula média/mín/máx só dos online; sem total nem %', () => {
    const text = showAndRead({ title: 'Sensores', devices, mode: 'average', measureLabel: 'Temperatura', formatValue: fmt });
    expect(text).toContain('3 online · 2 offline');
    expect(text).toContain('Temperatura média');
    expect(text).toContain('24.0°C'); // (24+26+22)/3
    expect(text).toContain('22.0°C · 26.0°C');
    expect(text).not.toContain('Consumo total');
    expect(text).not.toContain('Consumo médio');
    expect(text).not.toMatch(/\d+,\d+%/);
    expect(text).toContain('Offline / sem leitura (2)');
  });

  it('"3 menores" não inclui sensores offline (antes apareciam com 0,0 °C)', () => {
    showAndRead({ devices, mode: 'average', formatValue: fmt });
    const groups = [...document.querySelectorAll('.myio-col-summary__group')];
    const menores = groups.find((g) => g.textContent?.includes('3 menores'))?.textContent || '';
    expect(menores).not.toContain('Marisa L2');
    expect(menores).not.toContain('Praça');
    expect(menores).toContain('Loja C');
  });

  it('modo consumo (default) continua com Consumo médio/total', () => {
    const text = showAndRead({ devices: [{ name: 'X', value: 10 }], unit: 'kWh' });
    expect(text).toContain('Consumo médio');
    expect(text).toContain('Consumo total');
  });
});
