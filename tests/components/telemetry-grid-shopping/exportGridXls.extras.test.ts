// exportGridXls — colunas extras, "Sem leitura", nota no nome, grupos e KPIs (= tela).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportGridXls } from '../../../src/components/telemetry-grid-shopping/export';

afterEach(() => vi.restoreAllMocks());

async function captureXls(run: () => void): Promise<string> {
  let blob: Blob | null = null;
  (URL as any).createObjectURL = vi.fn((b: Blob) => {
    blob = b;
    return 'blob:x';
  });
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  run();
  expect(blob).not.toBeNull();
  // jsdom: Blob sem .text() → FileReader
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsText(blob as unknown as Blob);
  });
}

describe('exportGridXls — reproduz a tabela da modal', () => {
  it('grupo, Mín/Máx, offset no nome, "Sem leitura", sem % e KPIs', async () => {
    const xml = await captureXls(() =>
      exportGridXls(
        [
          { groupHeader: 'CLIMATIZÁVEL · 2 sensores · média 30,06 °C' },
          { labelOrName: 'Área externa', val: 30.06, extraCells: ['15,06', '36,75'], nameNote: 'offset −2,00 °C' },
          { labelOrName: 'Praça', val: null, extraCells: ['—', '—'] },
        ] as any,
        'Relatório Geral - Temperatura',
        '°C',
        { startISO: '2026-10-01T00:00:00-03:00', endISO: '2026-10-09T23:59:59-03:00' },
        'Shopping Teste',
        {
          columns: {
            nameLabel: 'Sensor',
            valueLabel: 'Média (°C)',
            hidePerc: true,
            hideIdentifier: true,
            extraColumns: [{ label: 'Mín (°C)' }, { label: 'Máx (°C)' }],
            emptyValueText: 'Sem leitura',
          },
          kpis: [{ label: 'Média geral', value: '25,89 °C', sub: 'média das médias dos sensores' }],
        }
      )
    );
    expect(xml).toContain('Média geral');
    expect(xml).toContain('25,89 °C  (média das médias dos sensores)');
    expect(xml).toContain('CLIMATIZÁVEL · 2 sensores · média 30,06 °C');
    expect(xml).toContain('Área externa  (offset −2,00 °C)');
    expect(xml).toContain('>Mín (°C)<');
    expect(xml).toContain('>15,06<');
    expect(xml).toContain('>Sem leitura<');
    expect(xml).not.toContain('>%<');
    expect(xml).not.toContain('Consumo');
  });
});
