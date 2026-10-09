// TemperatureComparisonModal — fonte customizada (Ingestion) + offset por sensor.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { openTemperatureComparisonModal } from '../../../src/components/temperature/TemperatureComparisonModal';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('openTemperatureComparisonModal — dataFetcher + temperatureOffset', () => {
  it('usa o dataFetcher por device e aplica o offset de cada sensor nas estatísticas', async () => {
    // canvas do jsdom não tem contexto 2D — o desenho do gráfico é irrelevante aqui
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any);
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
    const calls: string[] = [];
    const t0 = Date.UTC(2026, 9, 5, 15);

    // Não aguarda o open inteiro: o DateRangePicker (jQuery) não inicializa no jsdom.
    // O que importa aqui é a busca + render dos dados, que acontece antes.
    void openTemperatureComparisonModal({
      token: 'tb',
      startDate: new Date(t0 - 3600_000).toISOString(),
      endDate: new Date(t0 + 3 * 3600_000).toISOString(),
      theme: 'light',
      devices: [
        { id: 'a', label: 'Sensor A', ingestionId: 'ing-a', temperatureOffset: -2 },
        { id: 'b', label: 'Sensor B', ingestionId: 'ing-b' },
      ],
      dataFetcher: async (device) => {
        calls.push(device.ingestionId as string);
        return [
          { ts: t0, value: 26 },
          { ts: t0 + 3600_000, value: 28 },
        ];
      },
    });

    await vi.waitFor(() => expect(document.body.textContent || '').toMatch(/27[,.]0/), { timeout: 3000 });
    expect(calls.sort()).toEqual(['ing-a', 'ing-b']);
    expect(fetchSpy).not.toHaveBeenCalled(); // não foi ao ThingsBoard
    const text = document.body.textContent || '';
    expect(text).toContain('Sensor A');
    // média A = (24 + 26)/2 = 25 (offset −2); B = 27 (sem offset)
    expect(text).toMatch(/25[,.]0/);
    expect(text).toMatch(/27[,.]0/);
  });
});
