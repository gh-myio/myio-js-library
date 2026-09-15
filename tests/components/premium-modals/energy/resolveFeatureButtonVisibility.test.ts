/**
 * RFC-0229 §1 — resolveFeatureButtonVisibility() unit tests.
 *
 * Pure function (no DOM), so it's tested directly without instantiating
 * EnergyModalView. Uses the library's DEFAULT_DEVICE_CLASSIFICATION_PROFILE
 * (active by default, no setup needed): '3F_MEDIDOR' -> lojas,
 * ENTRADA/TRAFO/RELOGIO/SUBESTACAO -> entrada, anything else -> areacomum,
 * '*ARQUIVADO*' (etc.) -> ocultos.
 */

import { describe, it, expect } from 'vitest';
import { resolveFeatureButtonVisibility } from '../../../../src/components/premium-modals/energy/utils';
import type { FeatureButtonsMatrix } from '../../../../src/components/premium-modals/energy/types';

const MATRIX: FeatureButtonsMatrix = {
  demandPeak: { entrada: true, areacomum: true, lojas: false },
  instantTelemetry: { entrada: false, areacomum: true, lojas: true },
};

describe('resolveFeatureButtonVisibility — early exits', () => {
  it('is false for any non-energy readingType, even with featureButtons present', () => {
    expect(
      resolveFeatureButtonVisibility('demandPeak', {
        readingType: 'water',
        deviceProfile: 'ENTRADA',
        featureButtons: MATRIX,
      })
    ).toBe(false);
  });

  it('is false in comparison mode, even with featureButtons present', () => {
    expect(
      resolveFeatureButtonVisibility('demandPeak', {
        readingType: 'energy',
        mode: 'comparison',
        deviceProfile: 'ENTRADA',
        featureButtons: MATRIX,
      })
    ).toBe(false);
  });
});

describe('resolveFeatureButtonVisibility — featureButtons matrix (RFC-0229 §1)', () => {
  it('resolves demandPeak vs instantTelemetry independently for the same group', () => {
    const params = { readingType: 'energy', deviceProfile: 'ENTRADA', featureButtons: MATRIX };
    expect(resolveFeatureButtonVisibility('demandPeak', params)).toBe(true); // entrada: true
    expect(resolveFeatureButtonVisibility('instantTelemetry', params)).toBe(false); // entrada: false
  });

  it('resolves the "lojas" group from deviceProfile 3F_MEDIDOR', () => {
    const params = { readingType: 'energy', deviceProfile: '3F_MEDIDOR', featureButtons: MATRIX };
    expect(resolveFeatureButtonVisibility('demandPeak', params)).toBe(false); // lojas: false
    expect(resolveFeatureButtonVisibility('instantTelemetry', params)).toBe(true); // lojas: true
  });

  it('resolves the "areacomum" group as the fallback for an unrecognized deviceProfile', () => {
    const params = { readingType: 'energy', deviceProfile: 'CHILLER', featureButtons: MATRIX };
    expect(resolveFeatureButtonVisibility('demandPeak', params)).toBe(true); // areacomum: true
    expect(resolveFeatureButtonVisibility('instantTelemetry', params)).toBe(true); // areacomum: true
  });

  it('hides the button when the device resolves to "ocultos" (no matrix entry), regardless of the matrix content', () => {
    const params = { readingType: 'energy', deviceProfile: 'ARQUIVADO_3F_MEDIDOR', featureButtons: MATRIX };
    expect(resolveFeatureButtonVisibility('demandPeak', params)).toBe(false);
    expect(resolveFeatureButtonVisibility('instantTelemetry', params)).toBe(false);
  });
});

describe('resolveFeatureButtonVisibility — legacy fallback (no featureButtons)', () => {
  it('falls back to the flat canShowDemandButtons boolean when featureButtons is absent', () => {
    expect(
      resolveFeatureButtonVisibility('demandPeak', {
        readingType: 'energy',
        deviceProfile: '3F_MEDIDOR',
        canShowDemandButtons: true,
      })
    ).toBe(true);
    expect(
      resolveFeatureButtonVisibility('instantTelemetry', {
        readingType: 'energy',
        deviceProfile: 'ENTRADA',
        canShowDemandButtons: false,
      })
    ).toBe(false);
  });

  it('falls back to the original deviceProfile rule when neither featureButtons nor canShowDemandButtons is set', () => {
    expect(
      resolveFeatureButtonVisibility('demandPeak', { readingType: 'energy', deviceProfile: '3F_MEDIDOR' })
    ).toBe(false); // stores hidden by default
    expect(
      resolveFeatureButtonVisibility('instantTelemetry', { readingType: 'energy', deviceProfile: 'ENTRADA' })
    ).toBe(true); // non-store shown by default
  });
});
