/**
 * RFC-0228 F0 — normalizeMoneyBlock / normalizeBudgetBlock.
 *
 * Proves the naming-bridge normalizer collapses BOTH ambiguous backend money
 * shapes into one discriminated union, preserves decimal strings, and keeps the
 * budget verdict withheld (null) while coverage is incomplete (GCDR RFC-0054
 * DEC-6). Pure — no fetch, no DOM.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMoneyBlock,
  normalizeBudgetBlock,
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  type RawMoneyBlock,
  type RawBudgetBlock,
} from '../../../src/components/financial-goals/moneyTypes';

describe('normalizeMoneyBlock — collapses the two backend shapes', () => {
  it('money:null (reason out-of-band) → unavailable with canonical reason', () => {
    const overlay = normalizeMoneyBlock(null);
    expect(overlay.state).toBe('unavailable');
    if (overlay.state === 'unavailable') {
      expect(overlay.reason).toBe(MONEY_REQUIRES_DEVICE_GRANULARITY);
    }
  });

  it('money:undefined → unavailable with canonical reason', () => {
    const overlay = normalizeMoneyBlock(undefined);
    expect(overlay.state).toBe('unavailable');
  });

  it('money:{reason} → unavailable carrying that exact reason', () => {
    const overlay = normalizeMoneyBlock({ reason: MONEY_REQUIRES_DEVICE_GRANULARITY });
    expect(overlay.state).toBe('unavailable');
    if (overlay.state === 'unavailable') {
      expect(overlay.reason).toBe(MONEY_REQUIRES_DEVICE_GRANULARITY);
    }
  });

  it('money:{reason:"SOME_OTHER"} → unavailable passes the reason through verbatim', () => {
    const overlay = normalizeMoneyBlock({ reason: 'SOME_OTHER_REASON' });
    expect(overlay).toEqual({ state: 'unavailable', reason: 'SOME_OTHER_REASON' });
  });

  it('populated money block → available with fields intact', () => {
    const raw: RawMoneyBlock = {
      currency: 'BRL',
      coverageComplete: false,
      pricedHours: 61320,
      totalHours: 87600,
      tariffCoverageGaps: { missing: ['2026-03-01T00'], truncated: false, missingHours: 24 },
      uncategorizedDevices: [{ deviceId: 'd1', code: 'Q303A_L3', label: 'Loja 303A' }],
    };
    const overlay = normalizeMoneyBlock(raw);
    expect(overlay.state).toBe('available');
    if (overlay.state === 'available') {
      expect(overlay.currency).toBe('BRL');
      expect(overlay.coverageComplete).toBe(false);
      expect(overlay.pricedHours).toBe(61320);
      expect(overlay.totalHours).toBe(87600);
      expect(overlay.tariffCoverageGaps).toEqual({
        missing: ['2026-03-01T00'],
        truncated: false,
        missingHours: 24,
      });
      expect(overlay.uncategorizedDevices).toHaveLength(1);
      expect(overlay.uncategorizedDevices[0].deviceId).toBe('d1');
    }
  });

  it('available with coverageComplete:true and no gaps', () => {
    const overlay = normalizeMoneyBlock({ currency: 'BRL', coverageComplete: true });
    expect(overlay.state).toBe('available');
    if (overlay.state === 'available') {
      expect(overlay.coverageComplete).toBe(true);
      // uncategorizedDevices defaults to [] (never omitted).
      expect(overlay.uncategorizedDevices).toEqual([]);
    }
  });

  it('folds the sibling budget block; verdict withheld (null) while incomplete (DEC-6)', () => {
    const rawMoney: RawMoneyBlock = { currency: 'BRL', coverageComplete: false };
    const rawBudget: RawBudgetBlock = {
      projected: { amount: '128000.00', source: 'OVERLAY', coverageComplete: false },
      target: { amount: '120000.00', source: 'NATIVE' },
      variance: null,
      withinBudget: null,
    };
    const overlay = normalizeMoneyBlock(rawMoney, rawBudget);
    expect(overlay.state).toBe('available');
    if (overlay.state === 'available') {
      expect(overlay.budget).toBeDefined();
      expect(overlay.budget!.projected.amount).toBe('128000.00'); // decimal string intact
      expect(overlay.budget!.target).toEqual({ amount: '120000.00', source: 'NATIVE' });
      // The whole point of DEC-6: both verdict fields stay null while incomplete.
      expect(overlay.budget!.verdict.withinBudget).toBeNull();
      expect(overlay.budget!.verdict.variance).toBeNull();
    }
  });

  it('fully-covered budget carries a concrete verdict (boolean + string variance)', () => {
    const overlay = normalizeMoneyBlock(
      { currency: 'BRL', coverageComplete: true },
      {
        projected: { amount: '118500.00', source: 'OVERLAY', coverageComplete: true },
        target: { amount: '120000.00', source: 'NATIVE' },
        variance: '-1500.00',
        withinBudget: true,
      }
    );
    expect(overlay.state).toBe('available');
    if (overlay.state === 'available') {
      expect(overlay.budget!.verdict.withinBudget).toBe(true);
      expect(overlay.budget!.verdict.variance).toBe('-1500.00');
    }
  });
});

describe('normalizeBudgetBlock', () => {
  it('returns undefined when no budget block is present', () => {
    expect(normalizeBudgetBlock(null)).toBeUndefined();
    expect(normalizeBudgetBlock(undefined)).toBeUndefined();
  });

  it('returns undefined when projected.amount is missing', () => {
    expect(normalizeBudgetBlock({ target: { amount: '1.00', source: 'NATIVE' } })).toBeUndefined();
  });

  it('wraps variance/withinBudget into a single verdict', () => {
    const b = normalizeBudgetBlock({
      projected: { amount: '100.00', source: 'OVERLAY', coverageComplete: true },
      variance: '5.00',
      withinBudget: false,
    });
    expect(b).toBeDefined();
    expect(b!.verdict).toEqual({ withinBudget: false, variance: '5.00' });
    expect(b!.target).toBeUndefined();
  });
});
