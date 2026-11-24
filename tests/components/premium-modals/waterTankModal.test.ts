// ED-1375: water tank chart modal — water_level (cm) → m.c.a and unclamped pt-BR percentage
import { describe, it, expect } from 'vitest';
import {
  WaterTankModalView,
  buildWaterTankChartPoints,
  formatWaterTankValue,
} from '../../../src/components/premium-modals/water-tank/WaterTankModalView';
import { WaterTankModal } from '../../../src/components/premium-modals/water-tank/WaterTankModal';
import {
  tankHeadCmToMca,
  formatPtBrFixed,
  formatTankLevelPercent,
  formatTankHeadFromCm,
} from '../../../src/utils/format/water';

const T0 = new Date(2026, 10, 20, 10, 0).getTime();
const H = 3600 * 1000;

function makeView(
  telemetry: Array<{ ts: number; value: number; key?: string }>,
  opts: { currentLevel?: number; displayKey?: 'water_level' | 'water_percentage' } = {}
): any {
  return new WaterTankModalView({
    context: {
      device: { id: 'dev-1', label: 'RESERVATÓRIO 01', type: 'CAIXA_DAGUA', currentLevel: opts.currentLevel },
      metadata: {},
      timeRange: { startTs: T0, endTs: T0 + 24 * H, timezone: 'America/Sao_Paulo' },
    },
    params: {
      deviceId: 'dev-1',
      startTs: T0,
      endTs: T0 + 24 * H,
      displayKey: opts.displayKey,
      limit: 1000,
    } as any,
    data: {
      deviceId: 'dev-1',
      telemetry,
      summary: { avgLevel: 0, minLevel: 0, maxLevel: 0, totalReadings: telemetry.length },
      metadata: { keys: [], aggregation: 'NONE', limit: 1000 },
    } as any,
    onExport: () => {},
    onError: () => {},
    onClose: () => {},
  });
}

describe('ED-1375 shared water-tank helpers', () => {
  it('tankHeadCmToMca divides cm by 100', () => {
    expect(tankHeadCmToMca(709.8)).toBeCloseTo(7.098, 6);
    expect(tankHeadCmToMca(299.86)).toBeCloseTo(2.9986, 6);
  });

  it('formatPtBrFixed uses 2 decimals and comma', () => {
    expect(formatPtBrFixed(tankHeadCmToMca(709.8))).toBe('7,10');
    expect(formatPtBrFixed(tankHeadCmToMca(299.86))).toBe('3,00');
    expect(formatPtBrFixed(NaN)).toBe('-');
  });

  it('formatTankLevelPercent does not clamp and uses pt-BR comma', () => {
    expect(formatTankLevelPercent(121)).toBe('121,00%');
    expect(formatTankLevelPercent(122)).toBe('122,00%');
    expect(formatTankLevelPercent(100)).toBe('100,00%');
    expect(formatTankLevelPercent(45.678)).toBe('45,68%');
  });

  it('card formatter output is unchanged (badge "3,06 M.C.A")', () => {
    expect(formatTankHeadFromCm(306)).toBe('3,06 M.C.A');
    expect(formatTankHeadFromCm(178)).toBe('1,78 M.C.A');
  });
});

describe('ED-1375 chart series conversion', () => {
  const telemetry = [
    { ts: T0, value: 709.8, key: 'water_level' },
    { ts: T0, value: 1.21, key: 'water_percentage' },
    { ts: T0 + H, value: 299.86, key: 'water_level' },
    { ts: T0 + H, value: 0.5, key: 'water_percentage' },
  ];

  it('water_level series is converted from cm to m.c.a', () => {
    const pts = buildWaterTankChartPoints(telemetry, 'water_level');
    expect(pts).toHaveLength(2);
    expect(pts[0].value).toBeCloseTo(7.098, 6);
    expect(pts[1].value).toBeCloseTo(2.9986, 6);
    expect(formatWaterTankValue(pts[0].value, 'water_level')).toBe('7,10 m.c.a');
    expect(formatWaterTankValue(pts[1].value, 'water_level')).toBe('3,00 m.c.a');
  });

  it('water_percentage series keeps values above 100 (no clamp)', () => {
    const pts = buildWaterTankChartPoints(telemetry, 'water_percentage');
    expect(pts.map(p => Math.round(p.value * 100) / 100)).toEqual([121, 50]);
    expect(formatWaterTankValue(pts[0].value, 'water_percentage')).toBe('121,00%');
  });
});

describe('ED-1375 WaterTankModalView rendering', () => {
  const levelTelemetry = [
    { ts: T0, value: 709.8, key: 'water_level' },
    { ts: T0 + H, value: 299.86, key: 'water_level' },
  ];

  it('KPI "Média do período" is in m.c.a (pt-BR) for Nível mode', () => {
    const view = makeView(levelTelemetry, { displayKey: 'water_level' });
    const html: string = view.renderChartKpis();
    // avg of 7.098 and 2.9986 = 5.0483 → "5,05 m.c.a"
    expect(html).toContain('5,05 m.c.a');
    expect(html).toContain('7,10 m.c.a'); // top peak
    expect(html).not.toContain('709');
    expect(html).not.toContain('504');
  });

  it('chart data points (used by the Y axis scale) are in m.c.a', () => {
    const view = makeView(levelTelemetry, { displayKey: 'water_level' });
    const values = view.getChartDataPoints().map((p: any) => p.value);
    expect(Math.max(...values)).toBeCloseTo(7.098, 6);
    expect(Math.min(...values)).toBeCloseTo(2.9986, 6);
  });

  it('percentage KPIs use 2 decimals pt-BR with no clamp', () => {
    const view = makeView(
      [
        { ts: T0, value: 121, key: 'water_percentage' },
        { ts: T0 + H, value: 99, key: 'water_percentage' },
      ],
      { displayKey: 'water_percentage' }
    );
    const html: string = view.renderChartKpis();
    expect(html).toContain('110,00%');
    expect(html).toContain('121,00%');
  });

  it.each([
    [121, '121,00%'],
    [100, '100,00%'],
    [45.5, '45,50%'],
  ])('tank panel shows current level %s as %s', (level, expected) => {
    const view = makeView([], { currentLevel: level });
    const html: string = view.renderTankPanel();
    expect(html).toContain(`>${expected}</div>`);
    expect(html).not.toContain('100.0%');
  });
});

describe('ED-1375 WaterTankModal context uses the real (unclamped) level', () => {
  it('prefers currentLevel over currentLevelClamped', () => {
    const modal: any = new WaterTankModal({
      deviceId: 'dev-1',
      startTs: T0,
      endTs: T0 + H,
      currentLevel: 121,
      currentLevelClamped: 100,
    } as any);
    expect(modal.context.device.currentLevel).toBe(121);
  });

  it('falls back to currentLevelClamped when currentLevel is missing', () => {
    const modal: any = new WaterTankModal({
      deviceId: 'dev-1',
      startTs: T0,
      endTs: T0 + H,
      currentLevelClamped: 80,
    } as any);
    expect(modal.context.device.currentLevel).toBe(80);
  });
});
