/**
 * RFC-0228 A4 — Honest coverage UI (`coverageView.ts`).
 *
 * Proves the reusable renderer describes each `MoneyOverlay` coverage state
 * honestly: the device-granularity message (never R$ 0), the incomplete badge with
 * covered %, the full uncategorized-devices list as A5a deep-link affordances, the
 * tariff-gaps summary — and that the quiet "complete" state shows none of that
 * noise. Also guards the wording contract (feedback §8): no billing-grade words,
 * ever, and no `NaN`. Pure — jsdom DOM + callbacks, no fetch.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  renderCoverageView,
  buildCoverageHTML,
  coveragePercentLabel,
} from '../../../src/components/financial-goals/coverageView';
import {
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  type MoneyOverlay,
} from '../../../src/components/financial-goals/moneyTypes';

/** Words that would turn this coverage/estimation UX into billing wording. */
const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];

function assertNoForbidden(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) {
    expect(lower).not.toContain(word);
  }
  expect(text).not.toContain('NaN');
}

const unavailable: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

const incomplete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 61320,
  totalHours: 87600, // 61320/87600 = 70%
  tariffCoverageGaps: { missing: ['2026-03-01T00'], truncated: false, missingHours: 24 },
  uncategorizedDevices: [
    { deviceId: 'dev-1', code: 'Q303A_L3', label: 'Loja 303A' },
    { deviceId: 'dev-2', code: 'Q104_L1', label: 'Loja 104' },
  ],
};

const complete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
};

describe('coveragePercentLabel — honest, never NaN', () => {
  it('computes device-hour coverage as a pt-BR percent', () => {
    expect(coveragePercentLabel(61320, 87600)).toBe('70%');
    expect(coveragePercentLabel(43800, 87600)).toBe('50%');
  });

  it('returns the em-dash (not NaN, not R$ 0) for a missing/zero denominator', () => {
    expect(coveragePercentLabel(100, 0)).toBe('—');
    expect(coveragePercentLabel(100, undefined)).toBe('—');
    expect(coveragePercentLabel(undefined, 87600)).toBe('—');
    expect(coveragePercentLabel(NaN, 87600)).toBe('—');
  });
});

describe('unavailable (MONEY_REQUIRES_DEVICE_GRANULARITY)', () => {
  it('renders the device-granularity message — not an error, not R$ 0', () => {
    const el = renderCoverageView(unavailable);
    const text = el.textContent || '';
    expect(el.getAttribute('data-cov-state')).toBe('unavailable');
    expect(text).toContain('Visão em R$ indisponível');
    expect(text.toLowerCase()).toContain('device-granular');
    expect(text.toLowerCase()).toContain('categoria de tarifa');
    // Never a fabricated zero amount.
    expect(text).not.toContain('R$ 0');
    assertNoForbidden(el.outerHTML);
  });

  it('offers the generic manage-categories deep-link only when a callback is given', () => {
    const withoutCb = renderCoverageView(unavailable);
    expect(withoutCb.querySelector('[data-cov-manage]')).toBeNull();

    const onManageCategories = vi.fn();
    const withCb = renderCoverageView(unavailable, { onManageCategories });
    const manageBtn = withCb.querySelector<HTMLElement>('[data-cov-manage]');
    expect(manageBtn).not.toBeNull();
    manageBtn!.click();
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });
});

describe('available + coverageComplete:false — the key honest state', () => {
  it('renders the incomplete badge, covered %, every device, and the gaps summary', () => {
    const el = renderCoverageView(incomplete);
    const text = el.textContent || '';
    expect(el.getAttribute('data-cov-state')).toBe('available-incomplete');
    expect(text).toContain('Cobertura incompleta');
    expect(text).toContain('70%');
    // covered fraction detail (device-hours, pt-BR grouped)
    expect(text).toContain('61.320');
    expect(text).toContain('87.600');
    // partial-sum wording, never a total
    expect(text.toLowerCase()).toContain('soma parcial');
    // every uncategorized device is present as a click affordance
    const deviceBtns = el.querySelectorAll('[data-cov-device]');
    expect(deviceBtns.length).toBe(2);
    expect(text).toContain('Loja 303A');
    expect(text).toContain('Q303A_L3');
    expect(text).toContain('Loja 104');
    // tariff coverage gaps summary
    expect(text).toContain('24');
    expect(text.toLowerCase()).toContain('horas-dispositivo sem tarifa');
    assertNoForbidden(el.outerHTML);
  });

  it('shows the truncated hint only when gaps.truncated is true', () => {
    const truncated: MoneyOverlay = {
      ...(incomplete as Extract<MoneyOverlay, { state: 'available' }>),
      tariffCoverageGaps: { missing: [], truncated: true, missingHours: 999 },
    };
    const el = renderCoverageView(truncated);
    expect((el.textContent || '').toLowerCase()).toContain('truncada');
    // grouped large number, not NaN
    expect(el.textContent).toContain('999');
    assertNoForbidden(el.outerHTML);
  });

  it('fires onCategorizeDevice with the clicked device id (A5a deep-link)', () => {
    const onCategorizeDevice = vi.fn();
    const el = renderCoverageView(incomplete, { onCategorizeDevice });
    const buttons = el.querySelectorAll<HTMLElement>('[data-cov-device]');
    buttons[1].click();
    expect(onCategorizeDevice).toHaveBeenCalledTimes(1);
    expect(onCategorizeDevice).toHaveBeenCalledWith('dev-2');
    buttons[0].click();
    expect(onCategorizeDevice).toHaveBeenCalledWith('dev-1');
    expect(onCategorizeDevice).toHaveBeenCalledTimes(2);
  });

  it('renders badge + note even with no uncategorized devices and no gaps', () => {
    const bare: MoneyOverlay = {
      state: 'available',
      currency: 'BRL',
      coverageComplete: false,
      pricedHours: 10,
      totalHours: 20,
      uncategorizedDevices: [],
    };
    const el = renderCoverageView(bare);
    const text = el.textContent || '';
    expect(text).toContain('Cobertura incompleta');
    expect(text).toContain('50%');
    expect(el.querySelectorAll('[data-cov-device]').length).toBe(0);
    assertNoForbidden(el.outerHTML);
  });
});

describe('available + coverageComplete:true — quiet, no noise', () => {
  it('shows the complete affordance and none of the incomplete/uncategorized noise', () => {
    const el = renderCoverageView(complete);
    const text = el.textContent || '';
    expect(el.getAttribute('data-cov-state')).toBe('available-complete');
    expect(text).toContain('Cobertura completa');
    expect(text).not.toContain('Cobertura incompleta');
    expect(text.toLowerCase()).not.toContain('sem categoria de tarifa');
    expect(el.querySelectorAll('[data-cov-device]').length).toBe(0);
    assertNoForbidden(el.outerHTML);
  });

  it('does not fire onCategorizeDevice when complete (nothing to categorize)', () => {
    const onCategorizeDevice = vi.fn();
    const el = renderCoverageView(complete, { onCategorizeDevice });
    expect(el.querySelectorAll('[data-cov-device]').length).toBe(0);
    expect(onCategorizeDevice).not.toHaveBeenCalled();
  });
});

describe('wording contract (feedback §8) — no billing words, no NaN, across all states', () => {
  it('every state output is free of forbidden billing words and NaN', () => {
    assertNoForbidden(buildCoverageHTML(unavailable, true));
    assertNoForbidden(buildCoverageHTML(incomplete));
    assertNoForbidden(buildCoverageHTML(complete));
    // a malformed/absent overlay degrades to the honest unavailable panel
    assertNoForbidden(buildCoverageHTML(undefined as unknown as MoneyOverlay));
  });

  it('escapes untrusted device label/code (no raw HTML injection)', () => {
    const hostile: MoneyOverlay = {
      state: 'available',
      currency: 'BRL',
      coverageComplete: false,
      pricedHours: 1,
      totalHours: 2,
      uncategorizedDevices: [{ deviceId: 'x', label: '<img src=x onerror=alert(1)>' }],
    };
    const html = buildCoverageHTML(hostile);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('injected styles', () => {
  it('injects the coverage stylesheet once (id-guarded)', () => {
    renderCoverageView(unavailable);
    renderCoverageView(incomplete);
    const styles = document.querySelectorAll('#myio-fin-coverage-styles');
    expect(styles.length).toBe(1);
  });
});
