import { describe, it, expect } from 'vitest';
import {
  normalizeTelemetryValue,
  formatPeakValue,
  formatTelemetryValue,
  formatAxisTick,
} from '../../src/components/RealTimeTelemetryModal';

// Regression: "Por Período" divided power keys by 1000 while every display path
// (TELEMETRY_CONFIG unit 'W', formatPower, axis ticks, tooltip) treats the value as W,
// so the Rio Poty Entrada Geral (~2,37 MW) showed "Máxima: 2,372 kW".

describe('RealTimeTelemetryModal — period power scale', () => {
  it('keeps total power in W (no /1000)', () => {
    expect(normalizeTelemetryValue('consumption', 2_372_000)).toBe(2_372_000);
    expect(normalizeTelemetryValue('power', 790_000)).toBe(790_000);
  });

  it('keeps phase power (a/b/c) in W (no /1000)', () => {
    expect(normalizeTelemetryValue('a', 14_230)).toBe(14_230);
    expect(normalizeTelemetryValue('b', 812_000)).toBe(812_000);
    expect(normalizeTelemetryValue('c', 5)).toBe(5);
  });

  it('peak label for 2_372_000 W raw reads 2,372 MW', () => {
    const y = normalizeTelemetryValue('consumption', 2_372_000);
    expect(formatPeakValue('consumption', y)).toBe('2,372 MW');
  });

  it('peak label for a phase in kW range', () => {
    const y = normalizeTelemetryValue('a', 790_000);
    expect(formatPeakValue('a', y)).toBe('790,000 kW');
  });

  it('accepts string values from the ThingsBoard API', () => {
    expect(normalizeTelemetryValue('consumption', '2372000' as unknown as number)).toBe(2_372_000);
  });

  it('keeps the correct conversions: currents mA -> A (incl. phases), fp 0–255 -> 0–1', () => {
    expect(normalizeTelemetryValue('total_current', 12_500)).toBe(12.5);
    expect(normalizeTelemetryValue('current', 1_000)).toBe(1);
    expect(normalizeTelemetryValue('current_a', 3_400)).toBe(3.4);
    expect(normalizeTelemetryValue('current_b', 3_400)).toBe(3.4);
    expect(normalizeTelemetryValue('current_c', 3_400)).toBe(3.4);
    expect(normalizeTelemetryValue('powerFactor', 255)).toBe(1);
    expect(normalizeTelemetryValue('fp_a', 0)).toBe(0);
    expect(normalizeTelemetryValue('voltage_a', 220.4)).toBe(220.4);
  });

  it('tooltip / history values scale W -> kW -> MW', () => {
    expect(formatTelemetryValue('consumption', 790)).toBe('790 W');
    expect(formatTelemetryValue('consumption', 14_230)).toBe('14.23 kW');
    expect(formatTelemetryValue('consumption', 2_372_000)).toBe('2.37 MW');
    expect(formatTelemetryValue('a', 812_000)).toBe('812.00 kW');
    expect(formatTelemetryValue('voltage_a', 220.44)).toBe('220.4 V');
  });

  it('axis ticks scale W -> kW -> MW', () => {
    expect(formatAxisTick('W', 500)).toBe('500 W');
    expect(formatAxisTick('W', 14_000)).toBe('14.0 kW');
    expect(formatAxisTick('W', 2_500_000)).toBe('2.5 MW');
    expect(formatAxisTick('A', 12)).toBe('12 A');
  });
});
