// Temperatura — consolidação em hora fechada e dia civil de São Paulo.
import { describe, it, expect } from 'vitest';
import { aggregateByHour, aggregateByDay } from '../../../src/components/temperature/utils';

const H = 3600_000;

describe('aggregateByHour', () => {
  it('um ponto por hora fechada = média dos blocos da hora (sem preencher horas vazias)', () => {
    const t = Date.UTC(2026, 9, 5, 16); // 13:00 em SP
    const out = aggregateByHour(
      [
        { ts: t, value: 24 },
        { ts: t + 15 * 60_000, value: 26 },
        { ts: t + 45 * 60_000, value: 28 },
        { ts: t + 2 * H + 10 * 60_000, value: 30 }, // 15:10 → hora 15:00 (14:00 vazia)
      ],
      { min: 15, max: 40 }
    );
    expect(out).toEqual([
      { ts: t, value: 26 },
      { ts: t + 2 * H, value: 30 },
    ]);
  });

  it('aplica o offset', () => {
    const t = Date.UTC(2026, 9, 5, 16);
    expect(aggregateByHour([{ ts: t, value: 27 }], { min: 15, max: 40 }, -2)).toEqual([{ ts: t, value: 25 }]);
  });
});

describe('aggregateByDay — dia civil de São Paulo', () => {
  it('22:30 (SP) ainda é o mesmo dia (antes virava às 21:00 pelo dia UTC)', () => {
    const d = aggregateByDay(
      [
        { ts: Date.parse('2026-10-05T10:00:00-03:00'), value: 20 },
        { ts: Date.parse('2026-10-05T22:30:00-03:00'), value: 30 },
      ],
      { min: 15, max: 40 }
    );
    expect(d).toHaveLength(1);
    expect(d[0].date).toBe('2026-10-05');
    expect(d[0].avg).toBe(25);
    expect(d[0].dateTs).toBe(Date.parse('2026-10-05T00:00:00-03:00'));
  });
});
