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
    expect(rows).toEqual([{ date: '2026-07-01T10:00:00Z', consumption: 1.5 }]);
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
    expect((m1 as any).exportColumnOptions()).toEqual({ nameLabel: 'Data', hideIdentifier: true });
    const m2 = new DeviceReportModal({ ...baseParams, granularity: '1h' });
    expect((m2 as any).exportColumnOptions()).toEqual({ nameLabel: 'Data/Hora', hideIdentifier: true });
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
});
