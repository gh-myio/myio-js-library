/**
 * ED-1354 — Automação dos poços: estado das bombas (MOTOR) / solenoide,
 * indicadores B1/B2/S no card e na modal do reservatório, modal das bombas.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseBinaryState,
  intervalsFromTelemetry,
  isActive,
  stateSince,
  dayStats,
  timelineSegments,
  indicatorsFromModalData,
  pumpHistoryFromConsumption,
  latestPowerKw,
  PUMP_POWER_KEY,
  VALVE_STATE_KEYS,
  DAY_MS,
  HOUR_MS,
} from '../../../src/components/well-pumps/equipmentState';
import {
  createEquipmentIndicatorStrip,
  renderEquipmentTilesHTML,
  renderEquipmentShortcutHTML,
  indicatorStateClass,
} from '../../../src/components/well-pumps/equipmentIndicators';
import { openWellPumpsModal, renderWellPumpsBodyHTML } from '../../../src/components/well-pumps/WellPumpsModal';
import type { WellPumpsModalData } from '../../../src/components/well-pumps/types';

const NOW = new Date(2026, 9, 23, 15, 0, 0).getTime(); // 23/10/2026 15:00 local
const MIDNIGHT = new Date(2026, 9, 23, 0, 0, 0).getTime();

const sample = (): WellPumpsModalData => ({
  pumps: [
    {
      code: 'B1',
      label: 'Bomba Poço 3',
      wellId: 'poco-3',
      wellLabel: 'Poço 3',
      powerKw: 7.4,
      wellLevelMca: 312,
      wellPercentage: 0.72,
      history: [
        [MIDNIGHT - 2 * HOUR_MS, MIDNIGHT + HOUR_MS], // atravessa a meia-noite: conta 1 h, não conta partida
        [NOW - 47 * 60000, null], // ligada agora
      ],
    },
    { code: 'B2', label: 'Bomba Poço 4', wellId: 'poco-4', powerKw: 5.5, history: [[NOW - 5 * HOUR_MS, NOW - 3 * HOUR_MS]] },
  ],
  valves: [{ code: 'S', label: 'Solenoide Sabesp', description: 'entrada Sabesp', history: [[NOW - 2 * HOUR_MS, null]] }],
});

afterEach(() => {
  document.querySelectorAll('.myio-wp-overlay').forEach((el) => el.remove());
  vi.useRealTimers();
});

describe('equipmentState', () => {
  it('parseBinaryState aceita números, booleanos e palavras pt/en', () => {
    expect([1, '1', true, 'ON', 'ligada', 'open', 'Aberta', 'running'].map(parseBinaryState)).toEqual(Array(8).fill(true));
    expect([0, '0', false, 'off', 'desligada', 'closed', 'fechada', 'stopped'].map(parseBinaryState)).toEqual(Array(8).fill(false));
    expect([null, undefined, '', 'talvez', NaN, {}].map(parseBinaryState)).toEqual(Array(6).fill(null));
  });

  it('intervalsFromTelemetry: ordena, ignora repetidos/ilegíveis e deixa o último aberto', () => {
    const pts = [
      { ts: 500, value: '1' },
      { ts: 100, value: 1 },
      { ts: 200, value: 'x' },
      { ts: 300, value: 0 },
      { ts: 350, value: 0 },
      { ts: 400, value: true },
    ];
    expect(intervalsFromTelemetry(pts)).toEqual([
      [100, 300],
      [400, null],
    ]);
    expect(intervalsFromTelemetry(null)).toEqual([]);
  });

  it('bomba BOMBA_POCO: ligada = consumption (W) > limiar; potência atual em kW', () => {
    const pts = [
      { ts: 100, value: '7380.5' },
      { ts: 200, value: '0' },
      { ts: 300, value: '3' }, // ruído
      { ts: 400, value: '5500' },
    ];
    expect(pumpHistoryFromConsumption(pts)).toEqual([
      [100, 200],
      [300, null],
    ]);
    expect(pumpHistoryFromConsumption(pts, 10)).toEqual([
      [100, 200],
      [400, null],
    ]);
    expect(latestPowerKw(pts)).toBe(5.5);
    expect(latestPowerKw([])).toBeNull();
    expect(PUMP_POWER_KEY).toBe('consumption');
  });

  it("solenoide: state 'on'/'off' (convenção MAIN_BAS)", () => {
    expect(VALVE_STATE_KEYS[0]).toBe('state');
    expect(
      intervalsFromTelemetry([
        { ts: 1, value: 'on' },
        { ts: 2, value: 'off' },
        { ts: 3, value: 'on' },
      ])
    ).toEqual([
      [1, 2],
      [3, null],
    ]);
  });

  it('isActive / stateSince', () => {
    expect(isActive([[1, null]])).toBe(true);
    expect(isActive([[1, 2]])).toBe(false);
    expect(isActive([])).toBe(false);
    expect(stateSince([[1, null]])).toBe(1);
    expect(stateSince([[1, 2]])).toBe(2);
    expect(stateSince([])).toBeNull();
  });

  it('dayStats conta só a parte de hoje e partidas a partir da meia-noite', () => {
    const { activeMs, starts } = dayStats(sample().pumps[0].history, NOW);
    expect(activeMs).toBe(HOUR_MS + 47 * 60000);
    expect(starts).toBe(1);
  });

  it('timelineSegments corta na janela de 24 h e marca o intervalo vivo', () => {
    const segs = timelineSegments(
      [
        [NOW - 30 * HOUR_MS, NOW - 25 * HOUR_MS], // fora da janela
        [NOW - 30 * HOUR_MS, NOW - 12 * HOUR_MS], // começa antes da janela
        [NOW - HOUR_MS, null],
      ],
      NOW,
      DAY_MS
    );
    expect(segs).toHaveLength(2);
    expect(segs[0].leftPct).toBe(0);
    expect(segs[0].widthPct).toBeCloseTo(50);
    expect(segs[1].live).toBe(true);
    expect(segs[1].leftPct + segs[1].widthPct).toBeCloseTo(100);
  });

  it('indicatorsFromModalData gera B1/B2/S com estado', () => {
    const inds = indicatorsFromModalData(sample());
    expect(inds.map((i) => [i.code, i.kind, i.active])).toEqual([
      ['B1', 'pump', true],
      ['B2', 'pump', false],
      ['S', 'valve', true],
    ]);
    expect(inds.map(indicatorStateClass)).toEqual(['on', 'off', 'open']);
    expect(indicatorsFromModalData(null)).toEqual([]);
  });
});

describe('indicadores B1/B2/S', () => {
  it('strip do card: classes de estado, tooltip e clique', () => {
    const onClick = vi.fn();
    const strip = createEquipmentIndicatorStrip(indicatorsFromModalData(sample()), { onClick });
    const items = [...strip.querySelectorAll('.myio-eq-b')];
    expect(items.map((el) => el.className.replace('myio-eq-b ', ''))).toEqual(['on', 'off', 'open']);
    expect(items[0].getAttribute('title')).toContain('B1 · Bomba Poço 3 (BOMBA_POCO): ligada desde');
    expect(items[2].querySelector('svg')).not.toBeNull(); // solenoide = ícone de válvula
    strip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.getElementById('myio-equipment-indicators-styles')).not.toBeNull();
  });

  it('sem leitura → unk; tiles e atalho', () => {
    const inds = [{ code: 'B1', label: 'Bomba', kind: 'pump' as const, active: null }];
    expect(indicatorStateClass(inds[0])).toBe('unk');
    expect(renderEquipmentTilesHTML(inds)).toContain('S/ leit.');
    expect(renderEquipmentTilesHTML([])).toBe('');
    const html = renderEquipmentShortcutHTML(indicatorsFromModalData(sample()));
    expect(html).toContain('myio-eq-spin'); // alguma bomba ligada → rotor gira
    expect(html).toContain('<i class="open">S</i>');
  });

  it('escapa HTML do label', () => {
    const strip = createEquipmentIndicatorStrip([{ code: '<b>', label: '"x"', kind: 'pump', active: false }]);
    expect(strip.querySelector('b')).toBeNull();
    expect(strip.querySelector('.myio-eq-b')!.textContent).toBe('<b>');
  });
});

describe('modal Automação dos Poços', () => {
  it('renderiza KPIs, painéis e destaca o poço de origem', () => {
    const html = renderWellPumpsBodyHTML(sample(), { now: NOW, focusWellId: 'poco-4', footnote: 'Bombas independentes.' });
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('.myio-wp-kpi b')!.textContent).toBe('1 de 2');
    expect(div.textContent).toContain('7,4 kW');
    expect(div.querySelectorAll('.myio-wp-card')).toHaveLength(3);
    expect(div.querySelector('.myio-wp-card.focus')!.getAttribute('data-code')).toBe('B2');
    expect(div.querySelector('[data-code="B1"] .myio-wp-state')!.textContent).toContain('LIGADA');
    expect(div.querySelector('[data-code="S"] .myio-wp-state')!.textContent).toContain('ABERTA');
    expect(div.textContent).toContain('3,12 M.C.A');
    expect(div.textContent).toContain('Bombas independentes.');
  });

  it('N bombas + M solenoides: KPIs agregados, um painel por equipamento, sem leitura tracejado', () => {
    const data: WellPumpsModalData = {
      pumps: [
        { code: 'B1', label: 'Bomba 1', history: [[NOW - HOUR_MS, null]] },
        { code: 'B2', label: 'Bomba 2', history: [] },
        { code: 'B3', label: 'Bomba 3', history: null as any }, // telemetria indisponível
      ],
      valves: [
        { code: 'S1', label: 'Solenoide Sabesp', history: [[NOW - HOUR_MS, null]] },
        { code: 'S2', label: 'Solenoide Reuso', history: [[NOW - 3 * HOUR_MS, NOW - HOUR_MS]] },
      ],
    };
    const div = document.createElement('div');
    div.innerHTML = renderWellPumpsBodyHTML(data, { now: NOW });
    expect(div.querySelectorAll('.myio-wp-card')).toHaveLength(5);
    const kpis = [...div.querySelectorAll('.myio-wp-kpi')].map((k) => k.textContent!.replace(/\s+/g, ' ').trim());
    expect(kpis[0]).toContain('1 de 3');
    expect(kpis[2]).toBe('Solenoides abertas1 de 2');
    expect(div.querySelector('[data-code="B3"] .myio-wp-state')!.className).toContain('unk');
    expect(div.querySelector('[data-code="B3"] .myio-wp-state')!.textContent).toContain('SEM LEITURA');

    const inds = indicatorsFromModalData(data);
    expect(inds.map((i) => [i.code, indicatorStateClass(i)])).toEqual([
      ['B1', 'on'],
      ['B2', 'off'],
      ['B3', 'unk'],
      ['S1', 'open'],
      ['S2', 'closed'],
    ]);
    // várias solenoides → código no lugar do ícone (para distinguir S1 de S2)
    const strip = createEquipmentIndicatorStrip(inds);
    expect(strip.querySelector('[data-code="S1"]')!.textContent).toBe('S1');
  });

  it('sem equipamentos → mensagem vazia', () => {
    expect(renderWellPumpsBodyHTML({ pumps: [] })).toContain('Nenhuma bomba');
  });

  it('abre, atualiza e fecha (ESC e onClose)', () => {
    const onClose = vi.fn();
    const h = openWellPumpsModal({ data: sample(), simulated: true, subtitle: 'Shopping Taboão', onClose });
    expect(document.querySelector('.myio-wp-sim')).not.toBeNull();
    expect(document.querySelectorAll('.myio-wp-card')).toHaveLength(3);

    const d = sample();
    d.pumps[1].history.push([Date.now() - 1000, null]);
    h.update(d);
    expect(document.querySelector('.myio-wp-kpi b')!.textContent).toBe('2 de 2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.myio-wp-overlay')).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('loader async + refresh periódico', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValue(sample());
    const h = openWellPumpsModal({ data: loader, refreshIntervalMs: 10_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelectorAll('.myio-wp-card')).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(loader).toHaveBeenCalledTimes(2);
    h.close();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
