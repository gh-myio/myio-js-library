// AllReportModal — modo temperatura: offset por sensor, descarte de leituras inválidas,
// KPIs de média (nunca soma), sem "%" e Identificador genérico oculto.
import { describe, it, expect } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';

const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com' };
const H = 3600_000;

function make(params: Record<string, unknown> = {}): any {
  return new AllReportModal({ customerId: 'cust-1', api, domain: 'temperature', group: 'todos', ...params } as any);
}

describe('AllReportModal temperatura — estatística por sensor', () => {
  it('soma o offset e descarta leituras fora da faixa válida (default 15–40 °C)', () => {
    const m = make();
    const raw = [
      { timestamp: 0, value: 26 },
      { timestamp: H, value: 28 },
      { timestamp: 2 * H, value: -6.4 }, // sensor com defeito
      { timestamp: 3 * H, value: 99 }, // idem
    ];
    const s = m.computeTemperatureStats(raw, -2, m.temperatureValidRange);
    expect(s.readings).toBe(2);
    expect(s.discarded).toBe(2);
    expect(s.avg).toBe(25); // (24 + 26) / 2
    expect(s.min).toBe(24);
    expect(s.max).toBe(26);
    expect(s.series.map((p: any) => p.value)).toEqual([24, 26]);
  });

  it('guarda o instante do mín e do máx; tooltip mostra dia/hora (SP) e alerta leitura isolada', () => {
    const m = make();
    const t0 = Date.UTC(2026, 9, 5, 16, 45); // 05/10 13:45 -03:00
    const raw = [
      { timestamp: t0 - H, value: 32 },
      { timestamp: t0, value: 17.06 }, // dip isolado (15,06 c/ offset)
      { timestamp: t0 + H, value: 38.75 },
    ];
    const s = m.computeTemperatureStats(raw, -2, m.temperatureValidRange);
    expect(s.minTs).toBe(t0);
    expect(s.maxTs).toBe(t0 + H);

    const row = { name: 'Área externa (17)', consumption: 30.06, min: 15.06, minTs: t0, max: 36.75, maxTs: t0 + H, id: 'a' };
    const tip = m.buildMinMaxTooltip(row, 'min');
    expect(tip.title).toBe('Menor leitura — Área externa (17)');
    expect(tip.content).toContain('15,06 °C');
    expect(tip.content).toContain('05/10/2026');
    expect(tip.content).toContain('13:45');
    expect(tip.content).toContain('possível leitura isolada'); // 15,06 vs média 30,06
    expect(m.buildMinMaxTooltip(row, 'max').content).not.toContain('possível leitura isolada');
  });

  it('todas as leituras inválidas → sem média (Sem leitura, nunca 0 °C)', () => {
    const m = make();
    const s = m.computeTemperatureStats([{ timestamp: 0, value: -6 }], 0, m.temperatureValidRange);
    expect(s.avg).toBeNull();
    const row = m.decorateTemperatureRow({ identifier: 'x', name: 'Praça', consumption: 0, id: 'p' }, { total_value: null });
    expect(row.noData).toBe(true);
  });

  it('respeita temperatureValidRange do cliente', () => {
    const m = make({ temperatureValidRange: { min: -30, max: 10 } });
    const s = m.computeTemperatureStats([{ timestamp: 0, value: -18 }, { timestamp: H, value: 25 }], 0, m.temperatureValidRange);
    expect(s.readings).toBe(1);
    expect(s.avg).toBe(-18);
  });

  it('usa o temperatureOffset do itemsList', () => {
    const m = make({ itemsList: [{ id: 'a', identifier: 'Temperatura', label: 'A', temperatureOffset: -2 }] });
    expect(m.temperatureOffsetFor('a')).toBe(-2);
    expect(m.temperatureOffsetFor('desconhecido')).toBe(0);
  });

  it('agrega a série horária por dia civil de São Paulo (média)', () => {
    const m = make();
    const d1 = Date.UTC(2026, 9, 1, 3); // 01/10 00:00 -03:00
    const pts = [
      { timestamp: d1 + 1 * H, value: 20 },
      { timestamp: d1 + 2 * H, value: 22 },
      { timestamp: d1 + 25 * H, value: 30 }, // 02/10
    ];
    const daily = m.aggregateDaily(pts, 'avg');
    expect(daily).toEqual([
      { timestamp: d1, value: 21 },
      { timestamp: d1 + 24 * H, value: 30 },
    ]);
  });
});

describe('AllReportModal temperatura — enriquecimento por sensor', () => {
  it('com itemsList, enriquece mesmo sensor cadastrado no Ingestion como deviceType "energy"', async () => {
    const m = make({ itemsList: [{ id: 'a', identifier: 'Temperatura', label: 'Área externa', temperatureOffset: -2 }] });
    const data = { data: [{ id: 'a', deviceType: 'energy', total_value: 32.68 }, { id: 'z', deviceType: 'temperature', total_value: 20 }] };
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => [{ consumption: [{ timestamp: '2026-10-02T12:00:00Z', value: 32 }, { timestamp: '2026-10-02T13:00:00Z', value: -6 }] }],
      };
    }) as any;
    try {
      await m.enrichTemperatureAverages(data, '2026-10-02T00:00:00-03:00', '2026-10-08T23:59:59-03:00', 'tok', 'https://api');
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(calls).toHaveLength(1); // só o sensor do itemsList ('z' fica de fora)
    expect(calls[0]).toContain('/telemetry/devices/a/temperature?');
    expect(calls[0]).toContain('granularity=1h');
    expect(data.data[0].total_value).toBe(30); // 32 − 2; o −6 (−8 c/ offset) foi descartado
    const stats = m.temperatureStats.get('a');
    expect(stats.discarded).toBe(1);
    expect(stats.min).toBe(30);
  });
});

describe('AllReportModal temperatura — KPIs, colunas e exports', () => {
  const rows = [
    { identifier: 'Temperatura', name: 'Área externa', consumption: 30.71, id: 'a' },
    { identifier: 'Temperatura', name: 'Loja A', consumption: 24, id: 'b' },
    { identifier: 'Temperatura', name: 'Loja B', consumption: 22, id: 'c' },
    { identifier: 'Temperatura', name: 'Praça', consumption: 0, id: 'd', noData: true, discarded: 5 },
  ];

  it('KPI de média é MÉDIA dos sensores com leitura, não soma', () => {
    const m = make({ temperatureIdealRange: { min: 23, max: 25.5 } });
    m.data = rows;
    const kpis = m.computeKpis();
    const byLabel = Object.fromEntries(kpis.map((k: any) => [k.label, k]));
    expect(byLabel['Sensores'].value).toBe('4');
    expect(byLabel['Sensores'].sub).toBe('1 sem leitura no período');
    expect(byLabel['Média geral'].value).toBe('25,57 °C'); // (30,71 + 24 + 22) / 3
    expect(byLabel['Maior média'].sub).toBe('Área externa');
    expect(byLabel['Menor média'].sub).toBe('Loja B');
    expect(byLabel['Fora da faixa ideal'].value).toBe('2');
    expect(byLabel['Leituras descartadas'].value).toBe('5');
  });

  it('linha do sensor mostra o offset (sutil) só quando ≠ 0 e há leitura', () => {
    const m = make({
      itemsList: [
        { id: 'a', identifier: 'Temperatura', label: 'Área externa', temperatureOffset: -2 },
        { id: 'b', identifier: 'Temperatura', label: 'Loja A', temperatureOffset: 0 },
        { id: 'd', identifier: 'Temperatura', label: 'Praça', temperatureOffset: -2 },
      ],
    });
    const html = (r: any) => m.renderRowHTML(r, 0, false);
    expect(html(rows[0])).toContain('offset −2,00 °C');
    expect(html(rows[1])).not.toContain('offset');
    expect(html(rows[3])).not.toContain('offset'); // sem leitura → offset não foi aplicado
  });

  it('identifier genérico "Temperatura" esconde a coluna Identificador; código real mantém', () => {
    const m = make();
    expect(m.showIdentifierColumn(rows)).toBe(false);
    expect(m.showIdentifierColumn([...rows, { identifier: 'TMP-402', name: 'Sensor 402', consumption: 25 }])).toBe(true);
  });

  it('PDF/XLS de temperatura: sem %, rótulo de média, sem Identificador genérico', () => {
    const m = make();
    m.data = rows;
    expect(m.exportColumns()).toEqual({
      nameLabel: 'Sensor',
      valueLabel: 'Média (°C)',
      hidePerc: true,
      hideIdentifier: true,
      extraColumns: [
        { label: 'Mín (°C)', pdfW: 35 },
        { label: 'Máx (°C)', pdfW: 35 },
      ],
      emptyValueText: 'Sem leitura',
      countLabel: 'sensor(es)',
    });
    const devices = m.buildExportDevices();
    expect(devices.map((d: any) => d.name)).toEqual(['Área externa', 'Loja A', 'Loja B', 'Praça']);
    expect(devices[3].val).toBeNull();
    expect(devices[0].perc).toBeUndefined();
  });

  it('linhas do export = tabela da tela: grupos com média, Mín/Máx e offset', () => {
    const m = make({
      itemsList: [
        { id: 'a', identifier: 'Temperatura', label: 'Área externa', temperatureOffset: -2 },
        { id: 'b', identifier: 'Temperatura', label: 'Loja A', temperatureOffset: 0 },
      ],
    });
    m.data = [
      { identifier: 'Temperatura', name: 'Área externa', consumption: 30.06, min: 15.06, max: 36.75, id: 'a', groupLabel: 'Climatizável' },
      { identifier: 'Temperatura', name: 'Loja A', consumption: 24, min: 22, max: 26, id: 'b', groupLabel: 'Climatizável' },
    ];
    const devices = m.buildExportDevices();
    expect(devices[0].groupHeader).toBe('CLIMATIZÁVEL  ·  2 sensores · média 27,03 °C');
    expect(devices[1].name).toBe('Área externa');
    expect(devices[1].extraCells).toEqual(['15,06', '36,75']);
    expect(devices[1].nameNote).toBe('offset −2,00 °C');
    expect(devices[2].nameNote).toBeUndefined();
  });

  it('energia não muda: colunas default e % de participação', () => {
    const m = new AllReportModal({ customerId: 'c', api, domain: 'energy' } as any) as any;
    m.data = [
      { identifier: 'L1', name: 'Loja 1', consumption: 75 },
      { identifier: 'L2', name: 'Loja 2', consumption: 25 },
    ];
    expect(m.exportColumns()).toBeNull();
    expect(m.buildExportDevices().map((d: any) => d.perc)).toEqual([75, 25]);
    expect(m.computeKpis()[1].label).toBe('Total kWh');
  });
});
