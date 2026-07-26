/**
 * RFC-0228 A3 — Native CURRENCY budget view (`budgetView.ts`).
 *
 * Proves the renderer shows the committed Target and the Projected R$ (decimal
 * strings via formatBRL), and — the **headline invariant** (GCDR RFC-0054 DEC-6) —
 * that it declares in/over budget **only** when `withinBudget` is a strict boolean;
 * a `null` verdict (coverage incomplete) is explicitly WITHHELD, carries no
 * in/over-budget word, and defers to A4 for the why. No `budget` block → empty
 * state (never an error, never `R$ 0`). Guards the wording contract (feedback §8):
 * no billing-grade words, no `NaN`. Pure — jsdom DOM + callbacks, no fetch.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderBudgetView,
  buildBudgetHTML,
  buildVerdictHTML,
  resolveBudget,
} from '../../../src/components/financial-goals/budgetView';
import {
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  type MoneyOverlay,
  type BudgetOverlay,
} from '../../../src/components/financial-goals/moneyTypes';

/** Words that would turn this coverage/estimation UX into billing wording. */
const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];
/** In/over-budget conclusions that must NEVER appear over a withheld verdict. */
const CONCLUSIONS = ['dentro do orçamento', 'acima do orçamento'];

function assertNoForbidden(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) expect(lower).not.toContain(word);
  expect(text).not.toContain('NaN');
}

/** A complete, within-budget overlay: projected < target, verdict resolved true. */
const within: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
  budget: {
    projected: { amount: '110000.00', source: 'OVERLAY', coverageComplete: true },
    target: { amount: '120000.00', source: 'NATIVE' },
    verdict: { withinBudget: true, variance: '-10000.00' },
  },
};

/** A complete, over-budget overlay: projected > target, verdict resolved false. */
const over: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
  budget: {
    projected: { amount: '138000.00', source: 'OVERLAY', coverageComplete: true },
    target: { amount: '120000.00', source: 'NATIVE' },
    verdict: { withinBudget: false, variance: '18000.00' },
  },
};

/** An INCOMPLETE overlay: budget present but verdict withheld (DEC-6). */
const withheld: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 61320,
  totalHours: 87600,
  tariffCoverageGaps: { missing: ['2026-03-01T00'], truncated: false, missingHours: 24 },
  uncategorizedDevices: [
    { deviceId: 'dev-1', code: 'Q303A_L3', label: 'Loja 303A' },
  ],
  budget: {
    projected: { amount: '128000.00', source: 'OVERLAY', coverageComplete: false },
    target: { amount: '120000.00', source: 'NATIVE' },
    verdict: { withinBudget: null, variance: null },
  },
};

/** Available + complete but NO native budget block. */
const noBudget: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
};

/** Unavailable overlay (customer-granular). No budget. */
const unavailable: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

describe('resolveBudget — extracts the native budget honestly', () => {
  it('returns the budget block for an available overlay that carries one', () => {
    expect(resolveBudget(within)).toBe((within as any).budget);
  });
  it('returns undefined for available-without-budget, unavailable, and null', () => {
    expect(resolveBudget(noBudget)).toBeUndefined();
    expect(resolveBudget(unavailable)).toBeUndefined();
    expect(resolveBudget(null)).toBeUndefined();
    expect(resolveBudget(undefined)).toBeUndefined();
  });
});

describe('renderBudgetView — Target + Projected figures', () => {
  it('renders both R$ figures via formatBRL (decimal strings preserved)', () => {
    const el = renderBudgetView({ overlay: within })!;
    expect(el).not.toBeNull();
    expect(el.getAttribute('data-budget-state')).toBe('budget');
    const html = el.innerHTML;
    expect(html).toContain('R$ 120.000,00'); // target
    expect(html).toContain('R$ 110.000,00'); // projected
    assertNoForbidden(el.textContent || '');
  });
});

describe('renderBudgetView — verdict: withinBudget:true + complete', () => {
  it('shows "Dentro do orçamento" with the R$ and % variance', () => {
    const el = renderBudgetView({ overlay: within })!;
    const chip = el.querySelector('[data-budget-verdict="within"]')!;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Dentro do orçamento');
    const html = el.innerHTML;
    // variance = projected − target = −10000.00; pct = −8,3%
    expect(html).toContain('−R$ 10.000,00');
    expect(html).toContain('−8,3%');
    // No withheld / over language.
    expect((el.textContent || '').toLowerCase()).not.toContain('acima do orçamento');
    expect((el.textContent || '').toLowerCase()).not.toContain('veredito indisponível');
    assertNoForbidden(el.textContent || '');
  });
});

describe('renderBudgetView — verdict: withinBudget:false + complete', () => {
  it('shows "Acima do orçamento" with the R$ and % variance', () => {
    const el = renderBudgetView({ overlay: over })!;
    const chip = el.querySelector('[data-budget-verdict="over"]')!;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Acima do orçamento');
    const html = el.innerHTML;
    // variance = +18000.00; pct = +15,0%
    expect(html).toContain('+R$ 18.000,00');
    expect(html).toContain('+15,0%');
    expect((el.textContent || '').toLowerCase()).not.toContain('dentro do orçamento');
    assertNoForbidden(el.textContent || '');
  });
});

describe('renderBudgetView — DEC-6: withinBudget:null → verdict WITHHELD', () => {
  it('shows the withheld message, NO in/over-budget word, and defers to A4', () => {
    const onCategorizeDevice = vi.fn();
    const el = renderBudgetView({ overlay: withheld, onCategorizeDevice })!;
    const text = (el.textContent || '').toLowerCase();

    // The headline invariant: never a conclusion over a partial projection.
    for (const word of CONCLUSIONS) expect(text).not.toContain(word);

    // The explicit withheld chip.
    const chip = el.querySelector('[data-budget-verdict="withheld"]')!;
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain('Veredito indisponível');
    expect(chip.textContent).toContain('cobertura incompleta');

    // Defers to A4 for the why (the coverage element is appended).
    const why = el.querySelector('[data-budget-why="1"]');
    expect(why).not.toBeNull();
    expect(why!.getAttribute('data-cov-state')).toBe('available-incomplete');

    // The A5a deep-link is wired through to A4.
    const deviceBtn = el.querySelector<HTMLElement>('[data-cov-device="dev-1"]')!;
    expect(deviceBtn).not.toBeNull();
    deviceBtn.click();
    expect(onCategorizeDevice).toHaveBeenCalledWith('dev-1');

    assertNoForbidden(el.textContent || '');
  });

  it('buildVerdictHTML never emits a conclusion when withinBudget is null', () => {
    const budget = (withheld as any).budget as BudgetOverlay;
    const html = buildVerdictHTML(budget, {
      overBg: '#f', overText: '#f', withinBg: '#f', withinText: '#f',
      neutralBg: '#f', neutralText: '#f',
    }).toLowerCase();
    for (const word of CONCLUSIONS) expect(html).not.toContain(word);
    expect(html).toContain('veredito indisponível');
    expect(html).toContain('data-budget-verdict="withheld"');
  });

  it('withholds even if variance is (wrongly) populated while withinBudget is null', () => {
    // Defense in depth: a stray non-null variance must NOT unlock a conclusion.
    const budget: BudgetOverlay = {
      projected: { amount: '128000.00', source: 'OVERLAY', coverageComplete: false },
      target: { amount: '120000.00', source: 'NATIVE' },
      verdict: { withinBudget: null, variance: '8000.00' },
    };
    const html = buildVerdictHTML(budget, {
      overBg: '#f', overText: '#f', withinBg: '#f', withinText: '#f',
      neutralBg: '#f', neutralText: '#f',
    }).toLowerCase();
    for (const word of CONCLUSIONS) expect(html).not.toContain(word);
    expect(html).toContain('withheld');
  });
});

describe('renderBudgetView — no budget block → empty state', () => {
  it('renders an empty state (no error, no R$ 0) when the budget is absent', () => {
    const el = renderBudgetView({ overlay: noBudget })!;
    expect(el).not.toBeNull();
    expect(el.getAttribute('data-budget-state')).toBe('empty');
    const text = el.textContent || '';
    expect(text).not.toContain('R$ 0');
    expect(text).not.toContain('NaN');
    // No verdict chips at all.
    expect(el.querySelector('[data-budget-verdict]')).toBeNull();
    assertNoForbidden(text);
  });

  it('renders empty state for an unavailable overlay too (no budget there)', () => {
    const el = renderBudgetView({ overlay: unavailable })!;
    expect(el.getAttribute('data-budget-state')).toBe('empty');
    expect(el.querySelector('[data-budget-verdict]')).toBeNull();
    assertNoForbidden(el.textContent || '');
  });
});

describe('renderBudgetView — no overlay → null (money off)', () => {
  it('returns null when there is no overlay / no state', () => {
    expect(renderBudgetView({ overlay: null })).toBeNull();
    expect(renderBudgetView({ overlay: undefined })).toBeNull();
    expect(renderBudgetView({ overlay: {} as MoneyOverlay })).toBeNull();
  });
});

describe('renderBudgetView — missing amounts render — (never R$ 0 / NaN)', () => {
  it('renders the em-dash for absent target/projected amounts', () => {
    const partial: MoneyOverlay = {
      state: 'available',
      currency: 'BRL',
      coverageComplete: true,
      pricedHours: 87600,
      totalHours: 87600,
      uncategorizedDevices: [],
      budget: {
        projected: { amount: '', source: 'OVERLAY', coverageComplete: true },
        verdict: { withinBudget: true, variance: null },
      } as BudgetOverlay,
    };
    const el = renderBudgetView({ overlay: partial })!;
    const text = el.textContent || '';
    expect(text).toContain('—'); // DASH for the missing amounts
    expect(text).not.toContain('R$ 0');
    expect(text).not.toContain('NaN');
    assertNoForbidden(text);
  });
});

describe('renderBudgetView — decimal-string amounts preserved (no float)', () => {
  it('formats large decimal strings by grouping the string, not summing floats', () => {
    const big: MoneyOverlay = {
      state: 'available',
      currency: 'BRL',
      coverageComplete: true,
      pricedHours: 87600,
      totalHours: 87600,
      uncategorizedDevices: [],
      budget: {
        projected: { amount: '9007199254740991.10', source: 'OVERLAY', coverageComplete: true },
        target: { amount: '9007199254740992.20', source: 'NATIVE' },
        verdict: { withinBudget: true, variance: '-1.10' },
      },
    };
    const html = renderBudgetView({ overlay: big })!.innerHTML;
    expect(html).toContain('R$ 9.007.199.254.740.991,10');
    expect(html).toContain('R$ 9.007.199.254.740.992,20');
    expect(html).not.toContain('NaN');
  });
});

describe('renderBudgetView — optional stub edit affordance', () => {
  it('fires onSaveBudget with a best-effort annual tree echo of the target', () => {
    const onSaveBudget = vi.fn();
    const el = renderBudgetView({ overlay: within, onSaveBudget })!;
    const btn = el.querySelector<HTMLElement>('[data-budget-edit="1"]')!;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onSaveBudget).toHaveBeenCalledTimes(1);
    expect(onSaveBudget).toHaveBeenCalledWith({ annual: { value: 120000 } });
  });

  it('omits the edit button when no onSaveBudget is given', () => {
    const el = renderBudgetView({ overlay: within })!;
    expect(el.querySelector('[data-budget-edit]')).toBeNull();
  });
});

describe('buildBudgetHTML — pure, testable, honest', () => {
  it('emits both figures and the resolved verdict as a string', () => {
    const budget = (within as any).budget as BudgetOverlay;
    const html = buildBudgetHTML(budget);
    expect(html).toContain('R$ 120.000,00');
    expect(html).toContain('R$ 110.000,00');
    expect(html.toLowerCase()).toContain('dentro do orçamento');
    assertNoForbidden(html);
  });
});
