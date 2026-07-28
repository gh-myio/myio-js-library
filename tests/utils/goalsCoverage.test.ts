/**
 * RFC-0046 Addendum A — goals coverage-gap warning helpers (GCDR Goals 2026-07)
 */
import { describe, it, expect } from 'vitest';
import {
  formatCoverageRefPtBR,
  buildCoverageWarningTextPtBR,
  hasCoverageGaps,
} from '../../src/utils/goalsCoverage';

describe('formatCoverageRefPtBR', () => {
  it('month ref YYYY-MM → month name pt-BR', () => {
    expect(formatCoverageRefPtBR('2026-02')).toBe('Fev');
    expect(formatCoverageRefPtBR('2026-12')).toBe('Dez');
  });

  it('day ref YYYY-MM-DD → "DD Mmm" (no leading zero)', () => {
    expect(formatCoverageRefPtBR('2026-04-15')).toBe('15 Abr');
    expect(formatCoverageRefPtBR('2026-05-01')).toBe('1 Mai');
  });

  it('hour ref YYYY-MM-DDThh → "DD Mmm HHh"', () => {
    expect(formatCoverageRefPtBR('2026-05-01T08')).toBe('1 Mai 08h');
  });

  it('unknown shapes pass through unchanged', () => {
    expect(formatCoverageRefPtBR('2026')).toBe('2026');
    expect(formatCoverageRefPtBR('')).toBe('');
  });
});

describe('buildCoverageWarningTextPtBR', () => {
  it('matches the release-notes example shape (refs + truncation ellipsis + ~hours)', () => {
    const txt = buildCoverageWarningTextPtBR({
      missing: ['2026-02', '2026-03', '2026-04-15'],
      truncated: true,
      missingHours: 8016,
    });
    expect(txt).toBe(
      'A meta GERAL deste domínio/ano não cobre 100% dos dias e horas. Faltam: Fev, Mar, 15 Abr… (~8.016h)'
    );
  });

  it('no ellipsis when not truncated; custom series label', () => {
    const txt = buildCoverageWarningTextPtBR(
      { missing: ['2026-02'], truncated: false, missingHours: 672 },
      'do medidor Geral Entrada'
    );
    expect(txt).toBe(
      'A meta do medidor Geral Entrada deste domínio/ano não cobre 100% dos dias e horas. Faltam: Fev (~672h)'
    );
  });
});

describe('hasCoverageGaps', () => {
  it('true only with actionable content', () => {
    expect(hasCoverageGaps(undefined)).toBe(false);
    expect(hasCoverageGaps(null)).toBe(false);
    expect(hasCoverageGaps({})).toBe(false);
    expect(hasCoverageGaps({ missing: [], missingHours: 0 })).toBe(false);
    expect(hasCoverageGaps({ missing: ['2026-02'] })).toBe(true);
    expect(hasCoverageGaps({ missingHours: 24 })).toBe(true);
  });
});
