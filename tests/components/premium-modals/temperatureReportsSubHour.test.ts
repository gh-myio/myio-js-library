// Relatórios de temperatura (report-device + report-all): granularidade 15 min e 30 min.
// O Ingestion por device só aceita granularity=1h|1d, mas com 1h devolve blocos de 15 min →
// 15/30 min buscam 1h e agregam no cliente (média da janela fechada).
import { describe, it, expect } from 'vitest';
import { DeviceReportModal } from '../../../src/components/premium-modals/report-device/DeviceReportModal';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import {
  createGranularitySelector,
  TEMPERATURE_GRANULARITY_OPTIONS,
  granularityMinutes,
} from '../../../src/components/granularity-selector';

const MIN = 60_000;
const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com', ingestionToken: 't' };
const t0 = Date.parse('2026-11-08T10:00:00-03:00');
// 1 h de blocos de 15 min: 20, 22, 24, 26
const blocks = [0, 15, 30, 45].map((m, i) => ({ timestamp: new Date(t0 + m * MIN).toISOString(), value: 20 + i * 2 }));

describe('granularity-selector — opções de temperatura', () => {
  it('15m | 30m | 1h | 1d só quando pedidas; default segue 1h | 1d', () => {
    const a = document.createElement('div');
    createGranularitySelector(a, { settings: { options: TEMPERATURE_GRANULARITY_OPTIONS, value: '15m' } });
    expect([...a.querySelectorAll('button')].map((b) => b.dataset.granularity)).toEqual(['15m', '30m', '1h', '1d']);
    expect(a.querySelector('button.active')?.getAttribute('data-granularity')).toBe('15m');

    const b = document.createElement('div');
    createGranularitySelector(b, {});
    expect([...b.querySelectorAll('button')].map((x) => x.dataset.granularity)).toEqual(['1h', '1d']);
    expect([granularityMinutes('15m'), granularityMinutes('30m'), granularityMinutes('1h')]).toEqual([15, 30, 60]);
  });
});

describe('DeviceReportModal — temperatura 15/30 min', () => {
  const make = (g: string) => {
    const m = new DeviceReportModal({ ingestionId: 'd', identifier: 'X', label: 'L', domain: 'temperature', api } as any) as any;
    m.granularity = g;
    return m;
  };

  it('15m: um ponto por bloco; 30m: média de 2 blocos; 1h: média da hora', () => {
    const resp = [{ deviceId: 'd', consumption: blocks }];
    expect(make('15m').processApiResponse(resp, []).map((r: any) => r.consumption)).toEqual([20, 22, 24, 26]);
    const r30 = make('30m').processApiResponse(resp, []);
    expect(r30.map((r: any) => r.consumption)).toEqual([21, 25]);
    expect(new Date(r30[1].date).getTime()).toBe(t0 + 30 * MIN);
    expect(make('1h').processApiResponse(resp, []).map((r: any) => r.consumption)).toEqual([23]);
  });

  it('15/30 min pedem 1h à API (único intradiário aceito) e ligam a hora no seletor de período', () => {
    const m = make('30m');
    expect(m.apiGranularity).toBe('1h');
    expect(m.isIntraday).toBe(true);
    expect(make('1d').apiGranularity).toBe('1d');
  });

  it('rótulos: "Horário com Maior Temperatura", ranking "Horários mais quentes (30 minutos)"', () => {
    const m = make('30m');
    m.data = [
      { date: new Date(t0).toISOString(), consumption: 21 },
      { date: new Date(t0 + 30 * MIN).toISOString(), consumption: 25 },
    ];
    const labels = m.computeKpis().map((k: any) => k.label);
    expect(labels).toContain('Horário com Maior Temperatura (°C)');
    const el = document.createElement('div');
    m.renderTemperatureRanking(el);
    expect(el.textContent).toContain('Horários mais quentes (30 minutos)');
    expect(m.exportColumnOptions().countLabel).toBe('horário(s)');
  });

  it('energia continua só com 1h/1d (15m ignorado no onChange)', () => {
    const m = new DeviceReportModal({ ingestionId: 'd', domain: 'energy', api } as any) as any;
    expect(m.isTemperatureDomain).toBe(false);
  });
});

describe('AllReportModal — temperatura 15/30 min na série (▸) e no CSV', () => {
  const make = () =>
    new AllReportModal({ customerId: 'c', api, domain: 'temperature', group: 'todos' } as any) as any;
  const raw = [0, 15, 30, 45].map((m, i) => ({ timestamp: t0 + m * MIN, value: 20 + i * 2 }));

  it('getDeviceSeries agrega a série crua do sensor na janela escolhida', async () => {
    const m = make();
    m.temperatureStats.set('s1', { series: raw });
    expect((await m.getDeviceSeries('s1', '15m')).map((p: any) => p.value)).toEqual([20, 22, 24, 26]);
    expect((await m.getDeviceSeries('s1', '30m')).map((p: any) => p.value)).toEqual([21, 25]);
    expect((await m.getDeviceSeries('s1', '1h')).map((p: any) => p.value)).toEqual([23]);
    expect((await m.getDeviceSeries('s1', '1d')).map((p: any) => p.value)).toEqual([23]);
  });

  it('textos do ▸ por granularidade', () => {
    const m = make();
    expect(m.granularityNoun('15m')).toBe('15 minutos');
    expect(m.granularityNoun('1h')).toBe('hora');
  });
});
