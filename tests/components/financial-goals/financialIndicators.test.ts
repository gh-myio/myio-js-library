/**
 * RFC-0228 A2a — R$ money overlay row for one Metas × Consumo card
 * (`financialIndicators.ts`).
 *
 * Proves the renderer maps an `available`+complete `MoneyOverlay` to a R$ row
 * (Realizado / Orçado / Meta em R$ via decimal-string formatting, plus a signed
 * deviation chip), and that it **defers to A4** (`renderCoverageView`) for the
 * incomplete and unavailable states — never inventing `R$ 0`, never a total. Also
 * proves the money-off gate (no overlay → `null`), A5a callback pass-through, and
 * that decimal-string amounts are not `Number()`-drifted. Pure — jsdom DOM +
 * callbacks, no fetch, no ThingsBoard.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderFinancialIndicators,
  buildFinancialRowHTML,
  resolveMoneyRowValues,
  subtractDecimals,
} from '../../../src/components/financial-goals/financialIndicators';
import {
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  type MoneyOverlay,
} from '../../../src/components/financial-goals/moneyTypes';

/** Words that would turn this coverage/estimation UX into billing wording (§8). */
const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];
function assertNoForbidden(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) expect(lower).not.toContain(word);
  expect(text).not.toContain('NaN');
}

const completeOverlay: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
  budget: {
    projected: { amount: '223000.00', source: 'OVERLAY', coverageComplete: true },
    target: { amount: '250000.00', source: 'NATIVE' },
    verdict: { withinBudget: true, variance: '-27000.00' },
  },
};

const incompleteOverlay: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 61320,
  totalHours: 87600,
  tariffCoverageGaps: { missing: ['2026-03-01T00'], truncated: false, missingHours: 24 },
  uncategorizedDevices: [
    { deviceId: 'dev-1', code: 'Q303A_L3', label: 'Loja 303A' },
    { deviceId: 'dev-2', code: 'Q104_L1', label: 'Loja 104' },
  ],
};

const unavailableOverlay: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

describe('renderFinancialIndicators — available + complete → R$ row', () => {
  it('shows Realizado / Orçado / Meta em R$ from decimal strings (formatted, not Number-drifted)', () => {
    const el = renderFinancialIndicators({
      overlay: completeOverlay,
      // Realized R$ is not carried by a goal overlay → supplied explicitly.
      money: { realized: '228123.45', orcado: '223000.00', meta: '250000.00' },
    });
    expect(el).not.toBeNull();
    const root = el as HTMLElement;
    expect(root.getAttribute('data-fin-state')).toBe('available-money');
    const html = root.innerHTML;
    // Decimal strings become pt-BR BRL (grouping + comma decimal), verbatim.
    expect(html).toContain('R$ 228.123,45'); // Realizado
    expect(html).toContain('R$ 223.000,00'); // Orçado
    expect(html).toContain('R$ 250.000,00'); // Meta
    expect(html).toContain('Realizado');
    expect(html).toContain('Orçado');
    expect(html).toContain('Meta');
    assertNoForbidden(root.textContent || '');
  });

  it('preserves full decimal-string precision without float drift', () => {
    const el = renderFinancialIndicators({
      overlay: completeOverlay,
      money: { realized: '1234567.89', orcado: '999999.99', meta: '1000000.01' },
    }) as HTMLElement;
    const html = el.innerHTML;
    expect(html).toContain('R$ 1.234.567,89');
    expect(html).toContain('R$ 999.999,99');
    expect(html).toContain('R$ 1.000.000,01');
  });

  it('deviation chip: Realizado > Meta → over (↑, positive %)', () => {
    // Realizado 264000 vs Meta 250000 → +5.6% over.
    const el = renderFinancialIndicators({
      overlay: completeOverlay,
      money: { realized: '264000.00', orcado: '223000.00', meta: '250000.00' },
    }) as HTMLElement;
    const chip = el.querySelector('[data-fin-chip]') as HTMLElement;
    expect(chip.getAttribute('data-fin-chip')).toBe('over');
    expect(chip.textContent).toContain('↑');
    expect(chip.textContent).toContain('+');
    // signed R$ delta rides in the title (string math, +14.000,00)
    expect(chip.getAttribute('title')).toBe('+R$ 14.000,00');
  });

  it('deviation chip: Realizado < Meta → under (↓, negative %)', () => {
    // Realizado 230000 vs Meta 250000 → −8% under.
    const el = renderFinancialIndicators({
      overlay: completeOverlay,
      money: { realized: '230000.00', orcado: '223000.00', meta: '250000.00' },
    }) as HTMLElement;
    const chip = el.querySelector('[data-fin-chip]') as HTMLElement;
    expect(chip.getAttribute('data-fin-chip')).toBe('under');
    expect(chip.textContent).toContain('↓');
    expect(chip.textContent).toContain('−'); // true minus
    expect(chip.getAttribute('title')).toBe('−R$ 20.000,00');
  });

  it('deviation chip: no realized R$ → neutral dash chip (never R$ 0)', () => {
    const el = renderFinancialIndicators({
      overlay: completeOverlay,
      money: { orcado: '223000.00', meta: '250000.00' },
    }) as HTMLElement;
    const chip = el.querySelector('[data-fin-chip]') as HTMLElement;
    expect(chip.getAttribute('data-fin-chip')).toBe('none');
    expect(chip.textContent).toBe('—');
    // A missing Realizado renders the em-dash figure, not "R$ 0,00".
    expect(el.innerHTML).not.toContain('R$ 0,00');
  });

  it('derives Orçado/Meta em R$ from overlay.budget when money is omitted', () => {
    const el = renderFinancialIndicators({ overlay: completeOverlay }) as HTMLElement;
    const html = el.innerHTML;
    expect(html).toContain('R$ 223.000,00'); // projected → Orçado
    expect(html).toContain('R$ 250.000,00'); // target → Meta
  });
});

describe('renderFinancialIndicators — defers to A4 for non-confident states', () => {
  it('available + coverageComplete:false → A4 incomplete view, NOT R$ numbers', () => {
    const el = renderFinancialIndicators({ overlay: incompleteOverlay }) as HTMLElement;
    expect(el).not.toBeNull();
    // A4's element carries data-cov-state, not our R$ data-fin-state.
    expect(el.getAttribute('data-cov-state')).toBe('available-incomplete');
    expect(el.getAttribute('data-fin-state')).toBeNull();
    const html = el.innerHTML;
    expect(html).toContain('Cobertura incompleta');
    // The R$ figures/labels of the money row are absent (deferred, not priced).
    expect(html).not.toContain('data-fin-row');
    assertNoForbidden(el.textContent || '');
  });

  it('unavailable → A4 unavailable view, no R$ 0', () => {
    const el = renderFinancialIndicators({ overlay: unavailableOverlay }) as HTMLElement;
    expect(el.getAttribute('data-cov-state')).toBe('unavailable');
    expect(el.getAttribute('data-fin-state')).toBeNull();
    const html = el.innerHTML;
    expect(html).not.toContain('R$ 0');
    expect(html).not.toContain('data-fin-row');
    assertNoForbidden(el.textContent || '');
  });
});

describe('renderFinancialIndicators — A5a callback pass-through', () => {
  it('onCategorizeDevice fires with the deviceId from the incomplete view', () => {
    const onCategorizeDevice = vi.fn();
    const el = renderFinancialIndicators({
      overlay: incompleteOverlay,
      onCategorizeDevice,
    }) as HTMLElement;
    const btn = el.querySelector('[data-cov-device="dev-1"]') as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onCategorizeDevice).toHaveBeenCalledWith('dev-1');
  });

  it('onManageCategories is offered in the unavailable state and fires', () => {
    const onManageCategories = vi.fn();
    const el = renderFinancialIndicators({
      overlay: unavailableOverlay,
      onManageCategories,
    }) as HTMLElement;
    const btn = el.querySelector('[data-cov-manage]') as HTMLElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });
});

describe('renderFinancialIndicators — money-off gate', () => {
  it('returns null when there is no overlay (money disabled → no R$ row)', () => {
    expect(renderFinancialIndicators({ overlay: null })).toBeNull();
    expect(renderFinancialIndicators({ overlay: undefined })).toBeNull();
    // A malformed overlay (no state) is treated as off, not an error.
    expect(
      renderFinancialIndicators({ overlay: {} as unknown as MoneyOverlay })
    ).toBeNull();
  });
});

describe('resolveMoneyRowValues — explicit wins, else derive from budget', () => {
  it('derives orcado/meta from overlay.budget; realized/prevYear only from explicit', () => {
    const v = resolveMoneyRowValues(completeOverlay);
    expect(v.orcado).toBe('223000.00');
    expect(v.meta).toBe('250000.00');
    expect(v.realized).toBeNull();
    expect(v.prevYear).toBeNull();
  });

  it('explicit money.* overrides the derived budget amounts', () => {
    const v = resolveMoneyRowValues(completeOverlay, {
      orcado: '1.00',
      meta: '2.00',
      realized: '3.00',
    });
    expect(v.orcado).toBe('1.00');
    expect(v.meta).toBe('2.00');
    expect(v.realized).toBe('3.00');
  });

  it('unavailable overlay carries no budget → all null unless explicit', () => {
    const v = resolveMoneyRowValues(unavailableOverlay);
    expect(v).toEqual({ realized: null, orcado: null, meta: null, prevYear: null });
  });
});

describe('subtractDecimals — string cents math (no float drift)', () => {
  it('subtracts two decimal strings preserving 2dp and sign', () => {
    expect(subtractDecimals('264000.00', '250000.00')).toBe('14000.00');
    expect(subtractDecimals('230000.00', '250000.00')).toBe('-20000.00');
    expect(subtractDecimals('0.30', '0.10')).toBe('0.20'); // classic float trap avoided
    expect(subtractDecimals('0.10', '0.30')).toBe('-0.20');
  });

  it('returns null on invalid input', () => {
    expect(subtractDecimals('abc', '1.00')).toBeNull();
    expect(subtractDecimals('1.00', null)).toBeNull();
  });
});

describe('buildFinancialRowHTML — pure string builder', () => {
  it('renders the three figures and a chip; no billing words, no NaN', () => {
    const html = buildFinancialRowHTML(
      { realized: '228123.45', orcado: '223000.00', meta: '250000.00', prevYear: null },
      'meta',
      {
        overBg: '#fee2e2',
        overText: '#b91c1c',
        underBg: '#dcfce7',
        underText: '#15803d',
        neutralBg: '#f1f5f9',
        neutralText: '#64748b',
      },
      { realized: '#2563eb', orcado: '#f59e0b', meta: '#7c3aed', prevYear: '#94a3b8' }
    );
    expect(html).toContain('R$ 228.123,45');
    expect(html).toContain('data-fin-row');
    expect(html).toContain('Estimativa em R$');
    assertNoForbidden(html);
  });
});
