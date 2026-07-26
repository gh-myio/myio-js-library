/**
 * RFC-0228 A7 — per-consumer realized-vs-goal variance in R$ (`moneyVariance.ts`).
 *
 * Proves:
 *  - realized > goal → "Acima da meta (R$)" **unfavorable** chip with the exact
 *    signed R$ string + %; realized < goal → "Abaixo da meta (R$)" **favorable** chip;
 *  - null verdict / incomplete coverage → **withheld** chip ("Variação indisponível"),
 *    NOT green/red, with **no number** (DEC-6);
 *  - the signed subtraction reuses A2a's `subtractDecimals` and has **no float drift**
 *    on a cents case that would drift under `Number()`;
 *  - the GATE: a null config / no `perDeviceGoal` → disabled column (fragments all '')
 *    → a host splicing them is byte-identical when money is off;
 *  - the **naming-bridge** guard: A7 sources money ONLY from `monetaryProjection` /
 *    `currencyBudget` — never from a `budget` (quantity) field;
 *  - the §8 forbidden-wording contract across every state.
 *
 * Pure — jsdom, no fetch.
 */

import { describe, it, expect } from 'vitest';
import {
  computeMoneyVariance,
  buildMoneyVarianceHTML,
  renderMoneyVariance,
  createMoneyVarianceColumn,
  resolveGoalAmount,
  overlayWithholdsVerdict,
  MONEY_VARIANCE_HEADER,
  VARIANCE_LABEL_ABOVE,
  VARIANCE_LABEL_BELOW,
  VARIANCE_LABEL_WITHHELD,
  type MoneyVarianceColumnConfig,
} from '../../../src/components/financial-goals/moneyVariance';
import type { MoneyOverlay } from '../../../src/components/financial-goals/moneyTypes';
import { MONEY_REQUIRES_DEVICE_GRANULARITY } from '../../../src/components/financial-goals/moneyTypes';

/** Words that would turn this projection UX into billing wording (§8). */
const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];

function assertNoForbidden(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) expect(lower).not.toContain(word);
  expect(text).not.toContain('NaN');
}

const complete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
};

const incomplete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 61320,
  totalHours: 87600,
  uncategorizedDevices: [{ deviceId: 'dev-9', code: 'Q9', label: 'Loja 9' }],
};

const unavailable: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

// ── computeMoneyVariance — verdict + signed variance + pct ───────────────────────

describe('computeMoneyVariance — verdict, signed R$, %', () => {
  it('realized > goal → "above" (unfavorable) with exact signed R$ + %', () => {
    // 1200.00 − 1000.00 = +200.00 ; pct = +20%.
    const r = computeMoneyVariance({
      overlay: complete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('above');
    expect(r.variance).toBe('200.00');
    expect(r.pct).toBeCloseTo(20, 6);
  });

  it('realized < goal → "below" (favorable) with exact signed R$ + %', () => {
    // 800.00 − 1000.00 = −200.00 ; pct = −20%.
    const r = computeMoneyVariance({
      overlay: complete,
      monetaryProjection: '800.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('below');
    expect(r.variance).toBe('-200.00');
    expect(r.pct).toBeCloseTo(-20, 6);
  });

  it('realized == goal → "onTarget" with variance 0,00 (a real number, not withheld)', () => {
    const r = computeMoneyVariance({
      overlay: complete,
      monetaryProjection: '1000.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('onTarget');
    expect(r.variance).toBe('0.00');
    expect(r.pct).toBeCloseTo(0, 6);
  });

  it('goal is zero → variance present but % is null (no divide-by-zero)', () => {
    const r = computeMoneyVariance({
      overlay: complete,
      monetaryProjection: '50.00',
      currencyBudget: '0.00',
    });
    expect(r.verdict).toBe('above');
    expect(r.variance).toBe('50.00');
    expect(r.pct).toBeNull();
  });

  it('resolveGoalAmount defaults to the overlay native budget target', () => {
    const overlayWithBudget: MoneyOverlay = {
      ...complete,
      budget: {
        projected: { amount: '900.00', source: 'OVERLAY', coverageComplete: true },
        target: { amount: '1000.00', source: 'NATIVE' },
        verdict: { withinBudget: true, variance: '-100.00' },
      },
    };
    expect(resolveGoalAmount({ overlay: overlayWithBudget })).toBe('1000.00');
    const r = computeMoneyVariance({
      overlay: overlayWithBudget,
      monetaryProjection: '1200.00',
      // no explicit currencyBudget → falls back to target 1000.00
    });
    expect(r.verdict).toBe('above');
    expect(r.variance).toBe('200.00');
  });
});

// ── DEC-6 withholding — indeterminate / incomplete → withheld, no number ─────────

describe('computeMoneyVariance — DEC-6 withholding', () => {
  it('incomplete coverage → withheld (no variance, no pct)', () => {
    const r = computeMoneyVariance({
      overlay: incomplete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('withheld');
    expect(r.variance).toBeNull();
    expect(r.pct).toBeNull();
  });

  it('unavailable coverage → withheld', () => {
    const r = computeMoneyVariance({
      overlay: unavailable,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('withheld');
  });

  it('explicit withheld override → withheld even with valid amounts', () => {
    const r = computeMoneyVariance({
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
      withheld: true,
    });
    expect(r.verdict).toBe('withheld');
    expect(r.variance).toBeNull();
  });

  it('a null native budget verdict withholds even under a complete overlay', () => {
    const nullVerdict: MoneyOverlay = {
      ...complete,
      budget: {
        projected: { amount: '900.00', source: 'OVERLAY', coverageComplete: false },
        target: { amount: '1000.00', source: 'NATIVE' },
        verdict: { withinBudget: null, variance: null },
      },
    };
    expect(overlayWithholdsVerdict(nullVerdict)).toBe(true);
    const r = computeMoneyVariance({
      overlay: nullVerdict,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(r.verdict).toBe('withheld');
  });

  it('missing amounts → withheld', () => {
    expect(computeMoneyVariance({ overlay: complete, currencyBudget: '1000.00' }).verdict).toBe(
      'withheld'
    );
    expect(computeMoneyVariance({ overlay: complete, monetaryProjection: '1200.00' }).verdict).toBe(
      'withheld'
    );
  });

  it('an absent overlay does NOT gate — confident amounts still resolve', () => {
    expect(overlayWithholdsVerdict(undefined)).toBe(false);
    const r = computeMoneyVariance({ monetaryProjection: '1200.00', currencyBudget: '1000.00' });
    expect(r.verdict).toBe('above');
  });
});

// ── no float drift — the signed subtraction reuses A2a's integer-cent math ────────

describe('computeMoneyVariance — no float drift (A2a subtractDecimals reuse)', () => {
  it('a cents case that drifts under Number() stays exact', () => {
    // 0.10 − (−0.20) = 0.30. Naive Number(0.10) + Number(0.20) = 0.30000000000000004.
    const r = computeMoneyVariance({ monetaryProjection: '0.10', currencyBudget: '-0.20' });
    expect(r.variance).toBe('0.30');
    // Prove the float path WOULD have drifted (guards the test's own premise).
    const floatDiff = Number('0.10') - Number('-0.20');
    expect(floatDiff).not.toBe(0.3); // 0.30000000000000004
  });

  it('a one-cent negative flip is exact and drives the "below" verdict', () => {
    // 1_000_000.00 − 1_000_000.02 = −0.02 (a single-cent shortfall). The sign is
    // resolved from the variance string via A6's BigInt cents — exact, no rounding.
    const r = computeMoneyVariance({
      monetaryProjection: '1000000.00',
      currencyBudget: '1000000.02',
    });
    expect(r.variance).toBe('-0.02');
    expect(r.verdict).toBe('below');
  });
});

// ── naming-bridge guard — money never sourced from a `budget` (quantity) field ────

describe('computeMoneyVariance — naming-bridge guard', () => {
  it('ignores a `budget` (quantity) field entirely — no money without money names', () => {
    // A caller that mistakenly hands a quantity `budget` (kWh) must NOT be priced as R$.
    const r = computeMoneyVariance({
      overlay: complete,
      // @ts-expect-error — `budget` is not a MoneyVarianceInput field (quantity, not money).
      budget: [200, 200, 200],
    });
    expect(r.verdict).toBe('withheld'); // no monetaryProjection/currencyBudget → nothing to price
    expect(r.variance).toBeNull();
  });
});

// ── buildMoneyVarianceHTML — chip wording + colors ───────────────────────────────

describe('buildMoneyVarianceHTML — chip', () => {
  it('above → red unfavorable chip with "Acima da meta (R$)" + signed R$', () => {
    const html = buildMoneyVarianceHTML({
      overlay: complete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(html).toContain('data-money-variance="above"');
    expect(html).toContain(VARIANCE_LABEL_ABOVE);
    expect(html).toContain('+R$ 200,00');
    expect(html).toContain('#b91c1c'); // over/red text — an unfavorable judgment
    assertNoForbidden(html);
  });

  it('below → green favorable chip with "Abaixo da meta (R$)"', () => {
    const html = buildMoneyVarianceHTML({
      overlay: complete,
      monetaryProjection: '800.00',
      currencyBudget: '1000.00',
    });
    expect(html).toContain('data-money-variance="below"');
    expect(html).toContain(VARIANCE_LABEL_BELOW);
    expect(html).toContain('−R$ 200,00'); // true-minus signed delta
    expect(html).toContain('#15803d'); // under/green text — a favorable judgment
    assertNoForbidden(html);
  });

  it('withheld → grey "Variação indisponível", NO number, NO green/red judgment', () => {
    const html = buildMoneyVarianceHTML({
      overlay: incomplete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
    });
    expect(html).toContain('data-money-variance="withheld"');
    expect(html).toContain(VARIANCE_LABEL_WITHHELD);
    // No fabricated R$ number, no percent, no favorable/unfavorable color.
    expect(html).not.toContain('R$');
    expect(html).not.toContain('%');
    expect(html).not.toContain('#b91c1c');
    expect(html).not.toContain('#15803d');
    assertNoForbidden(html);
  });

  it('emits no billing word / NaN across above, below, withheld', () => {
    const inputs = [
      { overlay: complete, monetaryProjection: '1200.00', currencyBudget: '1000.00' },
      { overlay: complete, monetaryProjection: '800.00', currencyBudget: '1000.00' },
      { overlay: unavailable, monetaryProjection: '1200.00', currencyBudget: '1000.00' },
    ];
    for (const input of inputs) assertNoForbidden(buildMoneyVarianceHTML(input));
  });
});

// ── renderMoneyVariance — DOM readout + gate ─────────────────────────────────────

describe('renderMoneyVariance — DOM element / gate', () => {
  it('returns null when there is nothing to show (money off)', () => {
    expect(renderMoneyVariance({ document })).toBeNull();
    expect(renderMoneyVariance({} as any)).toBeNull();
  });

  it('renders the chip element with a label when amounts are present', () => {
    const el = renderMoneyVariance({
      overlay: complete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
      label: 'Variação vs meta (R$)',
      document,
    });
    expect(el).not.toBeNull();
    expect(el!.getAttribute('data-money-variance-row')).toBe('1');
    expect(el!.querySelector('[data-money-variance="above"]')).not.toBeNull();
    expect(el!.textContent).toContain('Variação vs meta (R$)');
  });

  it('renders the withheld chip when coverage is incomplete', () => {
    const el = renderMoneyVariance({
      overlay: incomplete,
      monetaryProjection: '1200.00',
      currencyBudget: '1000.00',
      document,
    });
    expect(el!.querySelector('[data-money-variance="withheld"]')).not.toBeNull();
  });
});

// ── createMoneyVarianceColumn — report column + gate ─────────────────────────────

function cfg(over: Partial<MoneyVarianceColumnConfig> = {}): MoneyVarianceColumnConfig {
  return {
    overlay: complete,
    perDeviceRealized: { a: '1200.00', b: '800.00', c: '1000.00' },
    perDeviceGoal: { a: '1000.00', b: '1000.00', c: '1000.00' },
    ...over,
  };
}

describe('createMoneyVarianceColumn — per-consumer variance cell', () => {
  it('renders an above chip for a consumer over goal and below for one under', () => {
    const col = createMoneyVarianceColumn(cfg());
    expect(col.enabled).toBe(true);
    expect(col.bodyCellHTML('a')).toContain('data-money-variance="above"');
    expect(col.bodyCellHTML('a')).toContain('+R$ 200,00');
    expect(col.bodyCellHTML('b')).toContain('data-money-variance="below"');
    expect(col.bodyCellHTML('a').startsWith('<td')).toBe(true);
  });

  it('header uses the allowed §8 label', () => {
    const col = createMoneyVarianceColumn(cfg());
    expect(col.headerCellHTML()).toContain(MONEY_VARIANCE_HEADER);
    expect(MONEY_VARIANCE_HEADER).toBe('Variação vs meta (R$)');
    assertNoForbidden(col.headerCellHTML());
  });

  it('withholds every consumer under an incomplete overlay (DEC-6)', () => {
    const col = createMoneyVarianceColumn(cfg({ overlay: incomplete }));
    expect(col.bodyCellHTML('a')).toContain('data-money-variance="withheld"');
    // The chip inner (no <td> data-label noise) carries no fabricated R$ amount.
    expect(col.cellValueHTML('a')).not.toContain('R$');
  });

  it('a consumer with no goal renders withheld (never a fabricated number)', () => {
    const col = createMoneyVarianceColumn(cfg({ perDeviceGoal: { a: '1000.00' } }));
    expect(col.bodyCellHTML('b')).toContain('data-money-variance="withheld"');
    expect(col.cellValueHTML('b')).not.toContain('R$');
  });
});

describe('createMoneyVarianceColumn — GATE OFF is byte-identical', () => {
  it('null config OR missing perDeviceGoal → disabled column (fragments all "")', () => {
    const disabled = [
      createMoneyVarianceColumn(null),
      createMoneyVarianceColumn(undefined),
      // config present but no goal map → no variance possible → disabled.
      createMoneyVarianceColumn({
        overlay: complete,
        perDeviceRealized: { a: '1200.00' },
      } as unknown as MoneyVarianceColumnConfig),
    ];
    for (const col of disabled) {
      expect(col.enabled).toBe(false);
      expect(col.headerCellHTML()).toBe('');
      expect(col.bodyCellHTML('a')).toBe('');
      expect(col.cellValueHTML('a')).toBe('');
    }
  });

  it('splicing the disabled fragments into a host row changes nothing', () => {
    const col = createMoneyVarianceColumn(null);
    const baseline = `<tr><td>ID</td><td>Name</td><td>123 kWh</td><td>10%</td></tr>`;
    const spliced = `<tr><td>ID</td><td>Name</td><td>123 kWh</td>${col.bodyCellHTML(
      'a'
    )}<td>10%</td></tr>`;
    expect(spliced).toBe(baseline); // byte-identical when the money gate is off
  });
});
