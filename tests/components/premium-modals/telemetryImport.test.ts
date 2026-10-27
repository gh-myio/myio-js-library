// tests/components/premium-modals/telemetryImport.test.ts
// "Importar dados" (widget de dispositivos manuais): planilha → /api/v1/import do Ingestion
// (runbook TELEMETRY-SHEET-IMPORT): modelo, parse/validação local, validate → jobs → poll → cancel.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildTemplateCsv,
  parseCsv,
  rowsFromTable,
  normalizeDate,
  normalizeHour,
  parseDecimal,
  splitImportableDevices,
  createTelemetryImportApi,
  openTelemetryImportModal,
  type TelemetryImportApi,
} from '../../../src/components/premium-modals/telemetry-import';

const GW = '11111111-2222-3333-4444-555555555555';
const DEVICES = [
  { label: 'Loja A', centralId: GW, slaveId: 3 },
  { label: 'Sem central', centralId: null, slaveId: null },
];
// 2026-10-26 10:30 em São Paulo (13:30Z)
const NOW = Date.UTC(2026, 9, 26, 13, 30);

describe('sheet', () => {
  it('splitImportableDevices: só devices com central (UUID) + slave 1–247', () => {
    const { ok, missingKey } = splitImportableDevices(DEVICES);
    expect(ok.map((d) => d.label)).toEqual(['Loja A']);
    expect(missingKey.map((d) => d.label)).toEqual(['Sem central']);
  });

  it('buildTemplateCsv: uma linha por hora FECHADA, separador ; + BOM, colunas do domínio', () => {
    const { csv, rows } = buildTemplateCsv('energy', DEVICES, '2026-10-25', '2026-10-26', NOW);
    // 25/10: 24 h; 26/10: 00..09 (10 h, a hora 10 ainda não fechou)
    expect(rows).toBe(34);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('gateway_id;slave_id;device_name;date;hour;value_kwh;value_reactive_kvarh');
    expect(lines[1]).toBe(`${GW};3;Loja A;2026-10-25;00:00;;`);
    expect(lines.at(-1)).toBe(`${GW};3;Loja A;2026-10-26;09:00;;`);
    const water = buildTemplateCsv('water', DEVICES, '2026-10-25', '2026-10-25', NOW).csv;
    expect(water).toContain('gateway_id;slave_id;device_name;date;hour;value_m3\r\n');
  });

  it('parseCsv: detecta ; ou , e respeita aspas', () => {
    expect(parseCsv('a;b\r\n1;"x;y"\n')).toEqual([['a', 'b'], ['1', 'x;y']]);
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('normalizações de data, hora e decimal', () => {
    expect(normalizeDate('2026-10-5')).toBe('2026-10-05');
    expect(normalizeDate('05/10/2026')).toBe('2026-10-05');
    expect(normalizeDate(46300)).toBe('2026-10-05'); // serial Excel
    expect(normalizeDate('10-05-2026')).toBeNull();
    expect(normalizeHour('7')).toBe('07:00');
    expect(normalizeHour('14:00:00')).toBe('14:00');
    expect(normalizeHour(0.5)).toBe('12:00'); // fração Excel
    expect(normalizeHour('14:30')).toBeNull();
    expect(parseDecimal('1.234,5')).toBe(1234.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('')).toBeNull();
    expect(Number.isNaN(parseDecimal('abc') as number)).toBe(true);
  });

  it('rowsFromTable: valores em branco ignorados, erros por linha, duplicadas', () => {
    const table = [
      ['gateway_id', 'slave_id', 'device_name', 'date', 'hour', 'value_kwh', 'value_reactive_kvarh'],
      [GW, '3', 'Loja A', '2026-10-25', '00:00', '1,5', ''],
      [GW, '3', 'Loja A', '2026-10-25', '01:00', '', ''], // em branco → ignorada
      [GW, '3', 'Loja A', '2026-10-25', '02:30', '2', ''], // hora inválida
      ['x', '300', 'Loja A', '2026-10-25', '03:00', '-1', ''], // vários erros
      [GW, '3', 'Loja A', '25/10/2026', '00:00', '9', ''], // duplicada (mesma data/hora da linha 2)
      ['', '', '', '', '', '', ''], // linha vazia
    ];
    const r = rowsFromTable('energy', table);
    expect(r.rows).toEqual([{ line: 2, gateway_id: GW, slave_id: 3, date: '2026-10-25', hour: '00:00', value_kwh: 1.5 }]);
    expect(r.skippedEmpty).toBe(1);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5, 6]);
    expect(r.errors[0].reason).toContain('hora inválida');
    expect(r.errors[1].reason).toMatch(/gateway_id inválido.*slave_id.*valor deve ser/);
    expect(r.errors[2].reason).toContain('duplicada');
  });

  it('rowsFromTable: coluna obrigatória ausente', () => {
    const r = rowsFromTable('water', [['gateway_id', 'slave_id', 'date', 'hour', 'value_kwh']]);
    expect(r.errors[0].reason).toContain('value_m3');
  });
});

describe('createTelemetryImportApi', () => {
  const mk = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('validate: 422 vira {valid:false} (não lança); Bearer + rota /import', async () => {
    const fetchImpl = vi.fn(async () => mk(422, { valid: false, invalidCount: 1, errors: [{ line: 3, reason: 'open_hour' }] }));
    const api = createTelemetryImportApi({ baseUrl: 'https://x/api/v1/', getToken: async () => 'tk', fetchImpl: fetchImpl as any });
    const r = await api.validate({ customerId: 'c', readingType: 'energy', rows: [] });
    expect(r).toEqual({ valid: false, invalidCount: 1, errors: [{ line: 3, reason: 'open_hour' }] });
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('https://x/api/v1/import/validate');
    expect(init.headers.Authorization).toBe('Bearer tk');
  });

  it('erros HTTP viram mensagens amigáveis (404 = não disponível; 403 = sem escopo)', async () => {
    const api404 = createTelemetryImportApi({ baseUrl: 'https://x', getToken: async () => 't', fetchImpl: (async () => mk(404, {})) as any });
    await expect(api404.startJob({ validationId: 'v' })).rejects.toThrow('ainda não está disponível');
    const api403 = createTelemetryImportApi({ baseUrl: 'https://x', getToken: async () => 't', fetchImpl: (async () => mk(403, {})) as any });
    await expect(api403.getJob('j')).rejects.toThrow('telemetry.import');
  });
});

describe('openTelemetryImportModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const flush = async (n = 4) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const btn = (value: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('.myio-stdmodal__btn')).find((b) => b.dataset.value === value)!;
  const csvFile = (text: string) => new File([text], 'dados.csv', { type: 'text/csv' });
  const upload = async (text: string) => {
    const input = document.querySelector<HTMLInputElement>('input[data-field="file"]')!;
    Object.defineProperty(input, 'files', { value: [csvFile(text)], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50)); // File.text() do jsdom é assíncrono
    await flush();
  };
  const SHEET = `gateway_id;slave_id;date;hour;value_kwh\n${GW};3;2026-10-25;00:00;1,5\n${GW};3;2026-10-25;01:00;2\n`;

  function fakeApi(over: Partial<TelemetryImportApi> = {}): TelemetryImportApi & { calls: string[] } {
    const calls: string[] = [];
    let polls = 0;
    return {
      calls,
      validate: vi.fn(async (b) => {
        calls.push(`validate:${b.rows.length}`);
        return { valid: true, validationId: 'val-1', preview: { targetSlots: 2, devices: 1, totalValue: 3.5, existingReadingsInTarget: 2, existingRealReadings: 2 } };
      }),
      startJob: vi.fn(async (b) => {
        calls.push(`start:${b.validationId}:${b.confirmReplaceReal}`);
        return { jobId: 'job-1', status: 'queued' };
      }),
      getJob: vi.fn(async () => {
        polls++;
        calls.push('poll');
        return polls < 2 ? { status: 'executing', progress: 50, deleted: 2, inserted: 1 } : { status: 'completed', progress: 100, deleted: 2, inserted: 2, refreshStatus: 'started' };
      }),
      cancelJob: vi.fn(async () => ({ status: 'cancelled' })),
      ...over,
    } as any;
  }

  it('fluxo completo: planilha → validação → confirma leituras reais → importa → acompanha até concluir', async () => {
    const api = fakeApi();
    const onCompleted = vi.fn();
    openTelemetryImportModal({ domain: 'energy', customerId: 'cust-ing', devices: DEVICES, api, pollMs: 1, onCompleted, now: () => NOW });

    expect(document.querySelector('.myio-modal-header__title')!.textContent).toBe('Importar dados de energia');
    expect(document.querySelector('.tlmi-banner.warn')!.textContent).toContain('1 dispositivo(s) sem central');
    btn('next').click(); // → Planilha
    await flush();
    expect(btn('next').disabled).toBe(true);
    await upload(SHEET);
    expect(document.querySelector('.tlmi')!.textContent).toContain('Linhas para importar2');
    btn('next').click(); // valida
    await flush();
    expect(api.calls).toContain('validate:2');
    // leituras reais → precisa confirmar
    expect(btn('next').textContent).toBe('Importar');
    expect(btn('next').disabled).toBe(true);
    const chk = document.querySelector<HTMLInputElement>('input[data-field="confirmReal"]')!;
    chk.checked = true;
    chk.dispatchEvent(new Event('change', { bubbles: true }));
    expect(btn('next').disabled).toBe(false);
    btn('next').click(); // importa
    await flush(10);
    await new Promise((r) => setTimeout(r, 20));
    await flush(10);
    expect(api.calls.slice(0, 2)).toEqual(['validate:2', 'start:val-1:true']);
    expect(document.querySelector('.tlmi')!.textContent).toContain('Importação concluída');
    btn('next').click(); // Concluir
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(document.querySelector('.myio-stdmodal')).toBeNull();
  });

  it('erros locais bloqueiam o envio (nada vai para a API)', async () => {
    const api = fakeApi();
    openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, now: () => NOW });
    btn('next').click();
    await flush();
    await upload(`gateway_id;slave_id;date;hour;value_kwh\n${GW};3;2026-10-25;00:30;1\n`);
    expect(document.querySelector('.tlmi-errors')!.textContent).toContain('hora inválida');
    expect(btn('next').disabled).toBe(true);
    expect(api.calls).toEqual([]);
  });

  it('servidor recusa (tudo-ou-nada): mostra os erros e não oferece importar', async () => {
    const api = fakeApi({
      validate: vi.fn(async () => ({ valid: false as const, invalidCount: 1, errors: [{ line: 2, reason: 'unknown_device' }] })),
    });
    openTelemetryImportModal({ domain: 'water', customerId: 'c', devices: DEVICES, api, now: () => NOW });
    btn('next').click();
    await flush();
    await upload(`gateway_id;slave_id;date;hour;value_m3\n${GW};3;2026-10-25;00:00;1\n`);
    btn('next').click();
    await flush();
    expect(document.querySelector('.tlmi')!.textContent).toContain('A planilha foi recusada');
    expect(document.querySelector('.tlmi-errors')!.textContent).toContain('unknown_device');
    expect(btn('next').style.display).toBe('none');
  });

  it('cancelar importação em andamento', async () => {
    const api = fakeApi({
      validate: vi.fn(async () => ({ valid: true as const, validationId: 'v', preview: { targetSlots: 1 } })),
      getJob: vi.fn(async () => ({ status: 'executing', progress: 10 })),
    });
    openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, pollMs: 60000, now: () => NOW });
    btn('next').click();
    await flush();
    await upload(SHEET);
    btn('next').click();
    await flush();
    btn('next').click(); // sem leituras reais → importa direto
    await flush(10);
    document.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
    await flush();
    expect(api.cancelJob).toHaveBeenCalledWith('job-1');
    expect(document.querySelector('.tlmi')!.textContent).toContain('Importação cancelada');
  });
});
