/**
 * RFC-0228 A2b — broad-rollout gate (`moneyRolloutGate.ts`).
 *
 * Proves the per-customer eligibility layer that decides whether the R$ money overlay
 * turns on:
 *  - defaults **OFF for the whole production base** (no allowlist → `not-eligible`);
 *  - composes with A2a as an AND: (feature available) × (customer curated) × (coverage
 *    sane), and names the first failing layer in `reason`;
 *  - never enables a broken (`unavailable`) overlay → `coverage-gap`;
 *  - never enables a customer by inference (name/domain/size), only explicit allowlist /
 *    curated flag / base-wide flip;
 *  - the wiring helper routes `!enabled` to A4 coverage and the feature-off path to
 *    render-nothing (byte-identical to pre-A2b).
 * Pure — no fetch, no ThingsBoard; the DOM helper uses jsdom-injected renderers.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolveMoneyRollout,
  routeMoneyRender,
  renderGatedMoney,
} from '../../../src/components/financial-goals/moneyRolloutGate';
import {
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  type MoneyOverlay,
} from '../../../src/components/financial-goals/moneyTypes';

const completeOverlay: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
};

const unavailableOverlay: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

const FEATURE_ON = { goalsMoneyApi: { baseUrl: 'https://x', apiKey: 'k' } };

describe('resolveMoneyRollout — layer (a): global feature flag', () => {
  it('feature off → disabled regardless of allowlist (via settings)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { goalsMoneyRolloutAllowlist: ['cust-1'] }, // no goalsMoneyApi
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('feature off → disabled even with base-wide flip and allowlisted id', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { goalsMoneyRolloutBaseWide: true, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('explicit featureAvailable:false wins over a truthy goalsMoneyApi (composed A2a gate)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      featureAvailable: false,
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'disabled' });
  });
});

describe('resolveMoneyRollout — layer (b): explicit customer eligibility (base defaults OFF)', () => {
  it('feature on + customer NOT in allowlist → not-eligible (the base-wide default)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: FEATURE_ON, // no allowlist at all
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'not-eligible' });
  });

  it('feature on + empty allowlist → not-eligible', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: [] },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'not-eligible' });
  });

  it('feature on + allowlisted + complete overlay → eligible (pilot curated customer)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-9', 'cust-1'] },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });

  it('eligible with no overlay sample at all (coverage deferred to per-card A2a/A4)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });

  it('explicit allowlist param overrides settings allowlist', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['other'] },
      allowlist: ['cust-1'],
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });

  it('accepts a Set allowlist and numeric customerId (String-normalized)', () => {
    const d = resolveMoneyRollout({
      customerId: 42,
      settings: FEATURE_ON,
      allowlist: new Set(['42']),
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });
});

describe('resolveMoneyRollout — layer (c): coverage sanity', () => {
  it('allowlisted + unavailable overlay → coverage-gap (never enable a broken overlay)', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: unavailableOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'coverage-gap' });
  });

  it('allowlisted + MONEY_REQUIRES_DEVICE_GRANULARITY reason → coverage-gap', () => {
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: { state: 'unavailable', reason: MONEY_REQUIRES_DEVICE_GRANULARITY },
    });
    expect(d.enabled).toBe(false);
    expect(d.reason).toBe('coverage-gap');
  });

  it('available-but-incomplete overlay is NOT "broken" → still eligible (A4 handles per-card)', () => {
    const partial: MoneyOverlay = {
      state: 'available',
      currency: 'BRL',
      coverageComplete: false,
      pricedHours: 61320,
      totalHours: 87600,
      uncategorizedDevices: [{ deviceId: 'd1' }],
    };
    const d = resolveMoneyRollout({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: partial,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });
});

describe('resolveMoneyRollout — no inference (RFC-0207 explicit-only)', () => {
  it('a customer is NEVER enabled by name/domain/size — only explicit allowlist', () => {
    // Rich, "obviously a big energy mall" context — must still be not-eligible.
    const d = resolveMoneyRollout({
      customerId: 'shopping-flagship-energy-XL',
      settings: FEATURE_ON,
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'not-eligible' });
  });

  it('missing customerId is unverifiable → not-eligible even with a populated allowlist', () => {
    const d = resolveMoneyRollout({
      customerId: null,
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'not-eligible' });
  });
});

describe('resolveMoneyRollout — B1 base-wide flip (one-line policy change)', () => {
  it('goalsMoneyRolloutBaseWide:true enables any customer (post-B1)', () => {
    const d = resolveMoneyRollout({
      customerId: 'any-customer',
      settings: { ...FEATURE_ON, goalsMoneyRolloutBaseWide: true },
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });

  it("'*' sentinel in the allowlist enables any customer", () => {
    const d = resolveMoneyRollout({
      customerId: 'any-customer',
      settings: FEATURE_ON,
      allowlist: ['*'],
      overlaySample: completeOverlay,
    });
    expect(d).toEqual({ enabled: true, reason: 'eligible' });
  });

  it('base-wide still respects coverage sanity (unavailable → coverage-gap)', () => {
    const d = resolveMoneyRollout({
      customerId: 'any-customer',
      settings: { ...FEATURE_ON, goalsMoneyRolloutBaseWide: true },
      overlaySample: unavailableOverlay,
    });
    expect(d).toEqual({ enabled: false, reason: 'coverage-gap' });
  });
});

describe('routeMoneyRender — wiring helper', () => {
  it('disabled → render-nothing (byte-identical to pre-A2b: no coverage panel added)', () => {
    const r = routeMoneyRender({
      customerId: 'cust-1',
      settings: {}, // feature off
      overlaySample: completeOverlay,
    });
    expect(r.action).toBe('render-nothing');
    expect(r.coverageOverlay).toBeUndefined();
    expect(r.decision).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('eligible → render-money', () => {
    const r = routeMoneyRender({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: completeOverlay,
    });
    expect(r.action).toBe('render-money');
  });

  it('not-eligible → render-coverage with a synthesized unavailable overlay (A4)', () => {
    const r = routeMoneyRender({
      customerId: 'cust-1',
      settings: FEATURE_ON, // no allowlist
      overlaySample: completeOverlay, // real overlay is complete, but customer not curated
    });
    expect(r.action).toBe('render-coverage');
    expect(r.coverageOverlay).toEqual({
      state: 'unavailable',
      reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
    });
  });

  it('coverage-gap → render-coverage reusing the real unavailable overlay', () => {
    const sample: MoneyOverlay = { state: 'unavailable', reason: 'SOME_OTHER_REASON' };
    const r = routeMoneyRender({
      customerId: 'cust-1',
      settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
      overlaySample: sample,
    });
    expect(r.action).toBe('render-coverage');
    expect(r.coverageOverlay).toBe(sample); // reused verbatim, not synthesized
  });
});

describe('renderGatedMoney — DOM composition (A2a money × A4 coverage)', () => {
  function makeRenderers() {
    const moneyEl = document.createElement('div');
    moneyEl.setAttribute('data-money', '1');
    const covEl = document.createElement('div');
    covEl.setAttribute('data-coverage', '1');
    return {
      moneyEl,
      covEl,
      renderMoney: vi.fn(() => moneyEl),
      renderCoverage: vi.fn(() => covEl),
    };
  }

  it('eligible → calls renderMoney with the overlay sample, returns its element', () => {
    const r = makeRenderers();
    const el = renderGatedMoney(
      {
        customerId: 'cust-1',
        settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
        overlaySample: completeOverlay,
      },
      r
    );
    expect(el).toBe(r.moneyEl);
    expect(r.renderMoney).toHaveBeenCalledWith(completeOverlay);
    expect(r.renderCoverage).not.toHaveBeenCalled();
  });

  it('!enabled (not-eligible) → routes to A4 renderCoverage, never money', () => {
    const r = makeRenderers();
    const el = renderGatedMoney(
      { customerId: 'cust-1', settings: FEATURE_ON, overlaySample: completeOverlay },
      r
    );
    expect(el).toBe(r.covEl);
    expect(r.renderCoverage).toHaveBeenCalledTimes(1);
    expect(r.renderCoverage.mock.calls[0][0]).toEqual({
      state: 'unavailable',
      reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
    });
    expect(r.renderMoney).not.toHaveBeenCalled();
  });

  it('coverage-gap → routes to A4 renderCoverage', () => {
    const r = makeRenderers();
    const el = renderGatedMoney(
      {
        customerId: 'cust-1',
        settings: { ...FEATURE_ON, goalsMoneyRolloutAllowlist: ['cust-1'] },
        overlaySample: unavailableOverlay,
      },
      r
    );
    expect(el).toBe(r.covEl);
    expect(r.renderMoney).not.toHaveBeenCalled();
  });

  it('feature off → renders nothing (null); neither renderer is called (byte-identical off)', () => {
    const r = makeRenderers();
    const el = renderGatedMoney(
      { customerId: 'cust-1', settings: {}, overlaySample: completeOverlay },
      r
    );
    expect(el).toBeNull();
    expect(r.renderMoney).not.toHaveBeenCalled();
    expect(r.renderCoverage).not.toHaveBeenCalled();
  });
});
