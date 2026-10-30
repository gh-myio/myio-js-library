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
  accumulatedRows,
  buildAccumulatedTemplateCsv,
  closedHoursInPeriod,
  distributeTotal,
  entriesFromTable,
  type AccumulatedEntry,
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
  it('splitImportableDevices: só devices com central (UUID) + slave ≥ 1', () => {
    const { ok, missingKey } = splitImportableDevices(DEVICES);
    expect(ok.map((d) => d.label)).toEqual(['Loja A']);
    expect(missingKey.map((d) => d.label)).toEqual(['Sem central']);
  });

  it('splitImportableDevices: slaveId acima de 247 (banco Modbus 249) entra no modelo', () => {
    const { ok } = splitImportableDevices([{ label: 'Manual 323', centralId: GW, slaveId: 323 }]);
    expect(ok.map((d) => d.label)).toEqual(['Manual 323']);
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
      ['x', '0', 'Loja A', '2026-10-25', '03:00', '-1', ''], // vários erros (slave 0 inválido; > 247 é válido)
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

describe('acumulado por período (RFC-0240 §9)', () => {
  const entry = (over: Partial<AccumulatedEntry> = {}): AccumulatedEntry => ({
    line: 2,
    gateway_id: GW,
    slave_id: 3,
    start: '2026-09-01',
    end: '2026-09-30',
    total: 693.4,
    ...over,
  });
  const milli = (rows: Array<{ value_kwh?: number }>) => rows.reduce((a, r) => a + Math.round((r.value_kwh || 0) * 1000), 0);

  it('closedHoursInPeriod: só horas fechadas (hoje até a hora anterior)', () => {
    expect(closedHoursInPeriod('2026-09-01', '2026-09-30', NOW).length).toBe(720);
    // NOW = 26/10 10:30 em São Paulo: 25/10 inteiro + 00h..09h de 26/10
    const slots = closedHoursInPeriod('2026-10-25', '2026-10-26', NOW);
    expect(slots.length).toBe(34);
    expect(slots.at(-1)).toEqual({ date: '2026-10-26', hour: 9 });
  });

  it('distributeTotal: soma EXATA em vários totais, sem valor negativo', () => {
    const slots = closedHoursInPeriod('2026-09-01', '2026-09-30', NOW);
    for (const total of [693.4, 0.001, 0.007, 1, 1234567.891, 33.333]) {
      const parts = distributeTotal(total, slots);
      expect(parts.length).toBe(720);
      expect(parts.reduce((a, v) => a + Math.round(v * 1000), 0)).toBe(Math.round(total * 1000));
      expect(parts.every((v) => v >= 0)).toBe(true);
    }
  });

  it('distributeTotal: 85% no horário de funcionamento (10h–22h)', () => {
    const slots = closedHoursInPeriod('2026-09-01', '2026-09-01', NOW);
    const parts = distributeTotal(100, slots);
    const open = parts.filter((_, i) => slots[i].hour >= 10 && slots[i].hour < 22);
    expect(open.reduce((a, v) => a + Math.round(v * 1000), 0)).toBe(85000);
    expect(parts[12]).toBeGreaterThan(parts[3]);
  });

  it('distributeTotal: período só com horas de um grupo fica uniforme, sem perder o total', () => {
    const parts = distributeTotal(10, [
      { date: '2026-09-01', hour: 1 },
      { date: '2026-09-01', hour: 2 },
    ]);
    expect(parts).toEqual([5, 5]);
    expect(distributeTotal(10, [])).toEqual([]);
  });

  it('accumulatedRows: gera o mesmo formato do modelo hora a hora, com soma exata', () => {
    const r = accumulatedRows('energy', [entry()], undefined, NOW);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBe(720);
    expect(r.devices).toBe(1);
    expect(r.total).toBe(693.4);
    expect(milli(r.rows)).toBe(693400);
    expect(r.rows[0]).toEqual({ line: 2, gateway_id: GW, slave_id: 3, date: '2026-09-01', hour: '00:00', value_kwh: expect.any(Number) });
    const water = accumulatedRows('water', [entry({ total: 10 })], undefined, NOW);
    expect(water.rows[0].value_m3).toBeDefined();
    expect(water.rows[0].value_kwh).toBeUndefined();
  });

  it('accumulatedRows: rejeita início > fim, fim no futuro e período sobreposto', () => {
    const r = accumulatedRows(
      'energy',
      [
        entry({ line: 2, start: '2026-09-10', end: '2026-09-01' }),
        entry({ line: 3, end: '2026-10-27' }),
        entry({ line: 4 }),
        entry({ line: 5, start: '2026-09-30', end: '2026-10-02' }),
        entry({ line: 6, start: '2026-10-01', end: '2026-10-02' }),
      ],
      undefined,
      NOW
    );
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 5]);
    expect(r.errors[1].reason).toContain('futuro');
    expect(r.errors[2].reason).toContain('sobreposto ao da linha 4');
    expect(r.rows.length).toBe(720 + 48); // linhas 4 e 6
  });

  it('accumulatedRows: total zero é aceito e contado; limite de linhas vira erro', () => {
    const zero = accumulatedRows('energy', [entry({ total: 0 })], undefined, NOW);
    expect(zero.errors).toEqual([]);
    expect(zero.zeroEntries).toBe(1);
    expect(zero.rows.every((r) => r.value_kwh === 0)).toBe(true);
    const many = Array.from({ length: 7 }, (_, i) => entry({ line: i + 2, slave_id: i + 1 }));
    const big = accumulatedRows('energy', many, undefined, NOW);
    expect(big.rows.length).toBe(5040);
    expect(big.errors[0].reason).toContain('Máximo de 5000 horas');
  });

  it('modelo CSV: uma linha por device e parse de volta', () => {
    const { csv, rows } = buildAccumulatedTemplateCsv('energy', DEVICES, '2026-09-01', '2026-09-30');
    expect(rows).toBe(1); // "Sem central" fica fora
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('gateway_id;slave_id;device_name;start_date;end_date;total_kwh');
    expect(lines[1]).toBe(`${GW};3;Loja A;2026-09-01;2026-09-30;`);
    const table = parseCsv(csv.replace(/;\r\n$/, ';693,4\r\n'));
    const r = entriesFromTable('energy', table);
    expect(r.errors).toEqual([]);
    expect(r.entries).toEqual([
      { line: 2, gateway_id: GW, slave_id: 3, device_name: 'Loja A', start: '2026-09-01', end: '2026-09-30', total: 693.4 },
    ]);
  });

  it('entriesFromTable: total vazio é ignorado; erros por linha; coluna ausente', () => {
    const header = ['gateway_id', 'slave_id', 'start_date', 'end_date', 'total_kwh'];
    const r = entriesFromTable('energy', [
      header,
      [GW, '3', '2026-09-01', '2026-09-30', ''],
      ['x', '0', 'ontem', '2026-09-30', '-1'],
      ['', '', '', '', ''],
    ]);
    expect(r.skippedEmpty).toBe(1);
    expect(r.errors[0].line).toBe(3);
    expect(r.errors[0].reason).toMatch(/gateway_id ou slave_id inválido.*início inválido.*total deve ser/);
    expect(entriesFromTable('water', [header]).errors[0].reason).toContain('total_m3');
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

  describe('modelo acumulado', () => {
    const pick = () => {
      const radio = document.querySelector<HTMLInputElement>('input[data-field="model"][value="accumulated"]')!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const setPeriod = (start: string, end: string) => {
      for (const [field, value] of [['start', start], ['end', end]]) {
        const el = document.querySelector<HTMLInputElement>(`input[data-field="${field}"]`)!;
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    const typeTotal = (v: string) => {
      const el = document.querySelector<HTMLInputElement>('input[data-total="0"]')!;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el;
    };

    it('escolhe o modelo, digita o total na tela, vê a prévia e valida com sourceRef acumulado', async () => {
      const api = fakeApi();
      openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, now: () => NOW });
      pick();
      setPeriod('2026-09-01', '2026-09-30');
      expect(document.querySelector('.tlmi')!.textContent).toContain('curva por hora é estimada');
      btn('next').click();
      await flush();
      expect(document.querySelector('.tlmi-stepper')!.textContent).toContain('Valores');
      expect(btn('next').disabled).toBe(true); // sem total
      const input = typeTotal('693,4');
      expect(document.activeElement === input || document.contains(input)).toBe(true); // não redesenha o campo
      const text = document.querySelector('[data-role="acc-summary"]')!.textContent!;
      expect(text).toContain('Horas geradas720');
      expect(text).toContain('693,400');
      expect(text).toContain('não use para análise de pico de demanda');
      expect(btn('next').disabled).toBe(false);
      expect(btn('next').textContent).toBe('Validar');
      btn('next').click();
      await flush();
      const arg = (api.validate as any).mock.calls[0][0];
      expect(arg.rows.length).toBe(720);
      expect(arg.sourceRef).toBe('acumulado:tela');
      expect(document.querySelector('.tlmi')!.textContent).toContain('estimados a partir do total');
    });

    it('total inválido na tela bloqueia o envio', async () => {
      const api = fakeApi();
      openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, now: () => NOW });
      pick();
      btn('next').click();
      await flush();
      typeTotal('abc');
      expect(document.querySelector('.tlmi-errors')!.textContent).toContain('Loja A: total deve ser número');
      expect(btn('next').disabled).toBe(true);
    });

    it('planilha de acumulado: usa as entradas do arquivo e permite voltar para a tela', async () => {
      const api = fakeApi();
      openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, now: () => NOW });
      pick();
      btn('next').click();
      await flush();
      await upload(`gateway_id;slave_id;start_date;end_date;total_kwh\n${GW};3;2026-09-01;2026-09-30;100\n`);
      expect(document.querySelector('[data-role="acc-summary"]')!.textContent).toContain('Horas geradas720');
      expect(document.querySelector('.tlmi')!.textContent).toContain('Usando dados.csv');
      btn('next').click();
      await flush();
      expect((api.validate as any).mock.calls[0][0].sourceRef).toBe('acumulado:dados.csv');
      btn('back').click();
      await flush();
      document.querySelector<HTMLButtonElement>('[data-action="use-form"]')!.click();
      expect(document.querySelector('input[data-total="0"]')).not.toBeNull();
      expect(btn('next').disabled).toBe(true);
    });

    it('voltar para hora a hora limpa o que foi calculado', async () => {
      const api = fakeApi();
      openTelemetryImportModal({ domain: 'energy', customerId: 'c', devices: DEVICES, api, now: () => NOW });
      pick();
      setPeriod('2026-09-01', '2026-09-30');
      btn('next').click();
      await flush();
      typeTotal('10');
      btn('back').click();
      const radio = document.querySelector<HTMLInputElement>('input[data-field="model"][value="hourly"]')!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      btn('next').click();
      await flush();
      expect(document.querySelector('[data-role="acc-summary"]')).toBeNull();
      expect(btn('next').textContent).toBe('Validar planilha');
      expect(btn('next').disabled).toBe(true);
    });
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
