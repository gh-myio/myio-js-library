// DeviceReportModal — logic-level tests (no show(): DateRangePicker/jQuery,
// footer clock e participation chart são exercitados nos testes dos componentes).
import { describe, it, expect } from 'vitest';
import {
  DeviceReportModal,
  DeviceReportModalParams,
} from '../../../src/components/premium-modals/report-device/DeviceReportModal';

const baseParams: DeviceReportModalParams = {
  ingestionId: 'dev-1',
  identifier: 'SCM123',
  label: 'Loja Teste',
  domain: 'energy',
  api: {
    clientId: 'client',
    clientSecret: 'secret',
    dataApiBaseUrl: 'https://api.example.com',
    ingestionToken: 'token',
  },
  // Campos estendidos localmente (DeviceReportModalParams) — compile-time check
  customerName: 'Shopping Teste',
  theme: { '--myio-brand-700': '#123456' },
};

describe('DeviceReportModal — temperatura', () => {
  const tempParams: DeviceReportModalParams = { ...baseParams, domain: 'temperature' };

  it('1d: média das leituras do dia (não soma) e dia sem leitura = noData (não 0 °C)', () => {
    const modal = new DeviceReportModal(tempParams) as any;
    const api = [
      {
        deviceId: 'dev-1',
        consumption: [
          { timestamp: '2026-10-02T00:00:00-03:00', value: 24 },
          { timestamp: '2026-10-02T00:00:00-03:00', value: 26 },
          { timestamp: '2026-10-04T00:00:00-03:00', value: 22 },
        ],
      },
    ];
    const rows = modal.processApiResponse(api, ['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(rows).toEqual([
      { date: '2026-10-02', consumption: 25 },
      { date: '2026-10-03', consumption: 0, noData: true },
      { date: '2026-10-04', consumption: 22 },
    ]);

    modal.data = rows;
    const kpis = modal.computeKpis();
    const byLabel = Object.fromEntries(kpis.map((k: any) => [k.label, k]));
    expect(byLabel['Média (°C)'].value).toBe('23,50 °C'); // (25 + 22) / 2 — o dia vazio não entra
    expect(byLabel['Dia com Menor Temperatura (°C)'].value).toBe('22,00');
    expect(byLabel['Dias sem Leitura'].value).toBe('1');
  });

  it('painel direito: ranking dos dias mais quentes (1d) com dias sem leitura no fim', () => {
    const modal = new DeviceReportModal({ ...tempParams, temperatureIdealRange: { min: 23, max: 25.5 } }) as any;
    modal.data = [
      { date: '2026-10-01', consumption: 24.49 },
      { date: '2026-10-02', consumption: 26.1 },
      { date: '2026-10-03', consumption: 0, noData: true },
      { date: '2026-10-04', consumption: 22.5 },
    ];
    const el = document.createElement('div');
    modal.renderTemperatureRanking(el);
    expect(el.textContent).toContain('Dias mais quentes (média do dia)');
    expect(el.textContent).toContain('faixa ideal 23,00–25,50 °C');
    const labels = [...el.querySelectorAll('span[title]')].map((s) => s.getAttribute('title'));
    expect(labels).toEqual(['02/10/2026', '01/10/2026', '04/10/2026', '03/10/2026']);
    expect(el.textContent).toContain('Sem leitura');
  });

  it('painel direito em 1h: top 24 horas mais quentes', () => {
    const modal = new DeviceReportModal({ ...tempParams, granularity: '1h' }) as any;
    modal.data = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 1, i)).toISOString(),
      consumption: 20 + i * 0.1,
    }));
    const el = document.createElement('div');
    modal.renderTemperatureRanking(el);
    expect(el.textContent).toContain('Horas mais quentes (top 24)');
    expect(el.querySelectorAll('span[title]').length).toBe(24);
  });

  it('1h: "Média por Dia" = média das médias diárias (não soma ÷ dias) e sem "Média por Hora"', () => {
    const modal = new DeviceReportModal({ ...tempParams, granularity: '1h' }) as any;
    // dia 1: 24 e 26 (média 25); dia 2: 20, 22, 24 (média 22)
    modal.data = [
      { date: '2026-10-01T12:00:00.000Z', consumption: 24 },
      { date: '2026-10-01T13:00:00.000Z', consumption: 26 },
      { date: '2026-10-02T12:00:00.000Z', consumption: 20 },
      { date: '2026-10-02T13:00:00.000Z', consumption: 22 },
      { date: '2026-10-02T14:00:00.000Z', consumption: 24 },
    ];
    const byLabel = Object.fromEntries(modal.computeKpis().map((k: any) => [k.label, k]));
    expect(byLabel['Média (°C)'].value).toBe('23,20 °C'); // 116 / 5
    expect(byLabel['Média por Dia (°C)'].value).toBe('23,50'); // (25 + 22) / 2 — antes: 116 / 2 = 58
    expect(byLabel['Média por Hora (°C)']).toBeUndefined();
  });

  it('o fetcher customizado recebe a granularidade selecionada', async () => {
    const calls: any[] = [];
    const modal = new DeviceReportModal({
      ...tempParams,
      granularity: '1h',
      fetcher: async (args: any) => {
        calls.push(args);
        return [];
      },
    }) as any;
    await modal.energyFetcher({ baseUrl: 'x', ingestionId: 'dev-1', startISO: 'a', endISO: 'b', granularity: modal.granularity });
    expect(calls[0].granularity).toBe('1h');
  });
});

describe('DeviceReportModal — header', () => {
  it('mostra o nome do device (sutil) com botão copiar, sem customer (já está no footer)', () => {
    const modal = new DeviceReportModal({ ...baseParams, deviceName: 'Temperatura <Loteria> L2' });
    const html: string = (modal as any).buildHeaderTitleHTML();
    expect(html.startsWith('Relatório - SCM123 - Loja Teste')).toBe(true);
    expect(html).toContain('class="myio-dr-devname"');
    expect(html).toContain('Temperatura &lt;Loteria&gt; L2'); // escapado (título vai por innerHTML)
    expect(html).toContain('class="myio-dr-copy" data-copy="Temperatura &lt;Loteria&gt; L2"');
    expect(html).not.toContain('Shopping Teste');
  });

  it('temperatura com offset ≠ 0 mostra o offset sutil no header; offset 0 não mostra', () => {
    const withOff = new DeviceReportModal({ ...baseParams, domain: 'temperature', temperatureOffset: -2 }) as any;
    expect(withOff.buildHeaderTitleHTML()).toContain('offset −2 °C');
    const noOff = new DeviceReportModal({ ...baseParams, domain: 'temperature', temperatureOffset: 0 }) as any;
    expect(noOff.buildHeaderTitleHTML()).not.toContain('offset');
    const energy = new DeviceReportModal({ ...baseParams, temperatureOffset: -2 }) as any;
    expect(energy.buildHeaderTitleHTML()).not.toContain('offset');
  });

  it('sem deviceName: só o título base', () => {
    const modal = new DeviceReportModal(baseParams);
    expect((modal as any).buildHeaderTitleHTML()).toBe('Relatório - SCM123 - Loja Teste');
  });
});

describe('DeviceReportModal', () => {
  it('defaults granularity to 1d', () => {
    const modal = new DeviceReportModal(baseParams);
    expect((modal as any).granularity).toBe('1d');
  });

  it('honors params.granularity = 1h', () => {
    const modal = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    expect((modal as any).granularity).toBe('1h');
  });

  it('processApiResponse zero-fills the daily range (1d)', () => {
    const modal = new DeviceReportModal(baseParams);
    const api = [
      {
        deviceId: 'dev-1',
        consumption: [
          { timestamp: '2026-07-01T00:00:00Z', value: 10 },
          { timestamp: '2026-07-03T00:00:00Z', value: 5 },
        ],
      },
    ];
    const rows = (modal as any).processApiResponse(api, ['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(rows).toEqual([
      { date: '2026-07-01', consumption: 10 },
      { date: '2026-07-02', consumption: 0 },
      { date: '2026-07-03', consumption: 5 },
    ]);
  });

  it('processApiResponse aggregates multiple points of the same day (1d)', () => {
    const modal = new DeviceReportModal(baseParams);
    const api = [
      {
        consumption: [
          { timestamp: '2026-07-01T10:00:00Z', value: 2 },
          { timestamp: '2026-07-01T11:00:00Z', value: 3 },
        ],
      },
    ];
    const rows = (modal as any).processApiResponse(api, ['2026-07-01']);
    expect(rows).toEqual([{ date: '2026-07-01', consumption: 5 }]);
  });

  it('processApiResponse keeps hourly timestamps and drops null values (1h)', () => {
    const modal = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    const api = [
      {
        consumption: [
          { timestamp: '2026-07-01T10:00:00Z', value: 1.5 },
          { timestamp: '2026-07-01T11:00:00Z', value: null },
        ],
      },
    ];
    const rows = (modal as any).processApiResponse(api, ['2026-07-01']);
    expect(rows).toEqual([{ date: '2026-07-01T10:00:00.000Z', consumption: 1.5 }]);
  });

  it('1h consolida em HORA FECHADA: soma (consumo) e média (temperatura) dos blocos sub-horários', () => {
    const api = [
      {
        consumption: [
          { timestamp: '2026-07-01T10:00:00Z', value: 1 },
          { timestamp: '2026-07-01T10:15:00Z', value: 2 },
          { timestamp: '2026-07-01T10:45:00Z', value: 3 },
          { timestamp: '2026-07-01T11:30:00Z', value: 4 },
        ],
      },
    ];
    const energy = new DeviceReportModal({ ...baseParams, granularity: '1h' }) as any;
    expect(energy.processApiResponse(api, ['2026-07-01'])).toEqual([
      { date: '2026-07-01T10:00:00.000Z', consumption: 6 },
      { date: '2026-07-01T11:00:00.000Z', consumption: 4 },
    ]);
    const temp = new DeviceReportModal({ ...baseParams, domain: 'temperature', granularity: '1h' }) as any;
    expect(temp.processApiResponse(api, ['2026-07-01'])).toEqual([
      { date: '2026-07-01T10:00:00.000Z', consumption: 2 },
      { date: '2026-07-01T11:00:00.000Z', consumption: 4 },
    ]);
  });

  it('processApiResponse returns [] for empty hourly response (no zero-fill in 1h)', () => {
    const modal = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    const rows = (modal as any).processApiResponse([], ['2026-07-01', '2026-07-02']);
    expect(rows).toEqual([]);
  });

  it('processApiResponse zero-fills empty daily response (1d)', () => {
    const modal = new DeviceReportModal(baseParams);
    const rows = (modal as any).processApiResponse([], ['2026-07-01', '2026-07-02']);
    expect(rows).toEqual([
      { date: '2026-07-01', consumption: 0 },
      { date: '2026-07-02', consumption: 0 },
    ]);
  });

  it('calculateTotal sums loaded rows', () => {
    const modal = new DeviceReportModal(baseParams);
    (modal as any).data = [
      { date: '2026-07-01', consumption: 1.25 },
      { date: '2026-07-02', consumption: 2.75 },
    ];
    expect((modal as any).calculateTotal()).toBe(4);
  });

  it('computeKpis (1d energy): Total, Média por Dia, Max/Min com data, Dias sem Consumo', () => {
    const modal = new DeviceReportModal(baseParams);
    (modal as any).data = [
      { date: '2026-07-01', consumption: 10 },
      { date: '2026-07-02', consumption: 0 },
      { date: '2026-07-03', consumption: 5 },
    ];
    const kpis = (modal as any).computeKpis();
    expect(kpis.map((k: any) => k.label)).toEqual([
      'Total (kWh)',
      'Média por Dia (kWh)',
      'Dia com Maior Consumo (kWh)',
      'Dia com Menor Consumo (kWh)',
      'Dias sem Consumo',
    ]);
    expect(kpis[2].sub).toBe('01/07/2026'); // max = dia 01
    expect(kpis[3].sub).toBe('03/07/2026'); // min só entre linhas > 0
    expect(kpis[4].value).toBe('1'); // um dia zerado
  });

  it('computeKpis (1h): adiciona Média por Hora e KPIs por hora', () => {
    const modal = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    (modal as any).data = [
      { date: '2026-07-01T10:00:00', consumption: 2 },
      { date: '2026-07-01T11:00:00', consumption: 0 },
    ];
    const labels = (modal as any).computeKpis().map((k: any) => k.label);
    expect(labels).toContain('Média por Hora (kWh)');
    expect(labels).toContain('Hora com Maior Consumo (kWh)');
    expect(labels).toContain('Horas sem Consumo');
  });

  it('computeKpis (temperature): média, sem KPI de zerados', () => {
    const modal = new DeviceReportModal({ ...baseParams, domain: 'temperature' });
    (modal as any).data = [
      { date: '2026-07-01', consumption: 20 },
      { date: '2026-07-02', consumption: 24 },
    ];
    const labels = (modal as any).computeKpis().map((k: any) => k.label);
    expect(labels[0]).toBe('Média (°C)');
    expect(labels).not.toContain('Dias sem Consumo');
    expect(labels).toContain('Dia com Maior Temperatura (°C)');
  });

  it('buildExportDevices maps rows to TelemetryDevice shape with perc over total', () => {
    const modal = new DeviceReportModal(baseParams);
    (modal as any).data = [
      { date: '2026-07-01', consumption: 30 },
      { date: '2026-07-02', consumption: 10 },
    ];
    const devices = (modal as any).buildExportDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0].labelOrName).toBe('01/07/2026');
    expect(devices[0].val).toBe(30);
    expect(devices[0].perc).toBeCloseTo(75);
    expect(devices[1].perc).toBeCloseTo(25);
  });

  it('buildExportDevices omits perc for temperature (média °C não tem participação)', () => {
    const modal = new DeviceReportModal({ ...baseParams, domain: 'temperature' });
    (modal as any).data = [{ date: '2026-07-01', consumption: 22 }];
    const devices = (modal as any).buildExportDevices();
    expect(devices[0].perc).toBeUndefined();
  });

  it('exportColumnOptions: nameLabel segue a granularidade e oculta Identificador', () => {
    const m1 = new DeviceReportModal(baseParams);
    expect((m1 as any).exportColumnOptions()).toEqual({
      nameLabel: 'Data',
      hideIdentifier: true,
      valueLabel: 'Consumo (kWh)',
      countLabel: 'dia(s)',
    });
    const m2 = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    expect((m2 as any).exportColumnOptions()).toEqual({
      nameLabel: 'Data/Hora',
      hideIdentifier: true,
      valueLabel: 'Consumo (kWh)',
      countLabel: 'hora(s)',
    });
  });

  it('exportColumnOptions (temperatura): rótulo da tela, sem %, "Sem leitura" — não mais "Consumo (°C)"', () => {
    const m = new DeviceReportModal({ ...baseParams, domain: 'temperature' }) as any;
    expect(m.exportColumnOptions()).toEqual({
      nameLabel: 'Data',
      hideIdentifier: true,
      valueLabel: 'Temperatura (°C)',
      countLabel: 'dia(s)',
      hidePerc: true,
      emptyValueText: 'Sem leitura',
    });
  });

  it('título do export inclui nome do device e offset (temperatura)', () => {
    const m = new DeviceReportModal({
      ...baseParams,
      domain: 'temperature',
      deviceName: 'TEMP. SCSDITEMST8',
      temperatureOffset: -2,
    }) as any;
    expect(m.resolveExportTitle()).toBe('Relatório - SCM123 - Loja Teste (TEMP. SCSDITEMST8) · offset −2 °C');
  });

  it('resolveAccentHex: mapa plano (--myio-brand-700) e theme.accent', () => {
    const m1 = new DeviceReportModal(baseParams); // theme plano no baseParams
    expect((m1 as any).resolveAccentHex()).toBe('#123456');
    const m2 = new DeviceReportModal({
      ...baseParams,
      theme: { accent: '#ABCDEF', cssVars: () => ({}) } as any,
    });
    expect((m2 as any).resolveAccentHex()).toBe('#ABCDEF');
    const m3 = new DeviceReportModal({ ...baseParams, theme: undefined });
    expect((m3 as any).resolveAccentHex()).toBeUndefined();
  });

  it('resolveCustomerName: param explícito vence; fallback no MyIOOrchestrator', () => {
    (window as any).MyIOOrchestrator = { customerName: 'Shopping Fallback' };
    try {
      const withParam = new DeviceReportModal(baseParams);
      expect((withParam as any).resolveCustomerName()).toBe('Shopping Teste');

      const { customerName, ...rest } = baseParams;
      const withoutParam = new DeviceReportModal(rest as DeviceReportModalParams);
      expect((withoutParam as any).resolveCustomerName()).toBe('Shopping Fallback');
    } finally {
      delete (window as any).MyIOOrchestrator;
    }
  });

  // West Plaza — ciclo de rateio 15/08→15/09: o picker devolvia fim 15/09T00:00:00, a
  // API (fim exclusivo) não trazia 15/09 e a tabela mostrava 15/09 = 0,00.
  it('loadData (1d): consulta dias inteiros — 15/09 entra no ciclo 15/08→15/09', async () => {
    document.body.innerHTML = '<button id="load-btn"></button><span id="load-spinner"></span>';
    // Valores diários reais da API para o device do ticket (15/08 … 15/09)
    const daily = [
      657.6953015873015, 689.660634920635, 720.5796190476191, 388.0721904761905, 401.92, 899.08,
      891.24, 536.16, 402.3866666666667, 529.5466666666667, 522.0933333333334, 545.2,
      760.6800000000001, 829.4933333333333, 1063.8133333333335, 843.7466666666669, 678.68,
      542.8533333333334, 780.4133333333333, 1069.44, 540.9066666666668, 921.32, 398.96,
      298.25333333333333, 495.6, 736.9599999999999, 404.8, 827.7733333333331, 657.6933333333333,
      361.7200000000001, 428.14666666666665, 506.56,
    ];
    const calls: Array<{ startISO: string; endISO: string }> = [];
    // Emula a API: um ponto por dia, só os com timestamp < endTime (fim exclusivo)
    const fetcher = async ({ startISO, endISO }: { startISO: string; endISO: string }) => {
      calls.push({ startISO, endISO });
      const consumption = daily
        .map((value, i) => {
          const ymd = new Date(Date.UTC(2026, 7, 15 + i)).toISOString().slice(0, 10);
          return { timestamp: `${ymd}T00:00:00-03:00`, value };
        })
        .filter((p) => new Date(p.timestamp).getTime() < new Date(endISO).getTime());
      return [{ consumption }];
    };

    const modal = new DeviceReportModal({ ...baseParams, fetcher });
    (modal as any).dateRangePicker = {
      getDates: () => ({
        startISO: '2026-08-15T00:00:00-03:00',
        endISO: '2026-09-15T00:00:00-03:00', // fim truncado que o picker devolvia
        startLabel: '15/08/2026',
        endLabel: '15/09/2026',
      }),
    };
    await (modal as any).loadData();

    expect(calls).toEqual([{ startISO: '2026-08-15T00:00:00-03:00', endISO: '2026-09-15T23:59:59-03:00' }]);
    const rows = (modal as any).data;
    expect(rows).toHaveLength(32);
    expect(rows[31]).toEqual({ date: '2026-09-15', consumption: 506.56 });
    expect((modal as any).calculateTotal()).toBeCloseTo(20331.45, 2);
    const semConsumo = (modal as any).computeKpis().find((k: any) => k.label === 'Dias sem Consumo');
    expect(semConsumo.value).toBe('0');
  });

  it('resolveQueryWindow (1d): dias inteiros a partir do dia exibido, preservando o offset', () => {
    const modal = new DeviceReportModal(baseParams);
    expect(
      (modal as any).resolveQueryWindow({ startISO: '2026-08-15T00:00:00-03:00', endISO: '2026-09-15T00:00:00-03:00' })
    ).toEqual({ startISO: '2026-08-15T00:00:00-03:00', endISO: '2026-09-15T23:59:59-03:00' });
    // Hora/ms ignorados; offset de cada string preservado
    expect(
      (modal as any).resolveQueryWindow({ startISO: '2026-09-15T10:30:00.000+00:00', endISO: '2026-09-15T12:00:00+00:00' })
    ).toEqual({ startISO: '2026-09-15T00:00:00+00:00', endISO: '2026-09-15T23:59:59+00:00' });
  });

  it('resolveQueryWindow (1h): respeita a hora escolhida no picker', () => {
    const modal = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    const range = { startISO: '2026-08-15T00:00:00-03:00', endISO: '2026-09-15T23:59:00-03:00' };
    expect((modal as any).resolveQueryWindow(range)).toEqual(range);
  });
});
