// tests/deviceClassificationProfile.water-temperature.test.ts
//
// RFC-0207 / follow-up #2 — Water + Temperature equivalence golden.
//
// Phase B added water/temperature domains to the single-source resolver. Unlike
// the energy breakdown (A1), these are behavior-PRESERVING extractions: the
// DEFAULT seed must reproduce MAIN_VIEW's categorizeItemsByGroupWater and
// categorizeItemsByGroupTemperature EXACTLY (zero diff), just like A0 did for
// energy groups. This file is the equivalence proof.
//
// Oracles below are inline copies of the legacy MAIN_VIEW functions
// (controller.js, categorizeItemsByGroupWater :3269 / Temperature :3334).
// `banheiros` is intentionally never produced by the water oracle — standalone
// bathroom meters are extracted later by the TELEMETRY widget, not here.

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
} from '../src/utils/deviceClassificationProfile';

const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];

interface Item {
  deviceProfile?: string | null;
  identifier?: string | null;
  label?: string | null;
}

function isOcultosDevice(item: Item): boolean {
  const dp = String(item.deviceProfile || '').toUpperCase();
  return OCULTOS_PATTERNS.some((pattern) => dp.includes(pattern));
}

// ---- WATER oracle (categorizeItemsByGroupWater) --------------------------
type WaterGroup = 'entrada' | 'lojas' | 'banheiros' | 'areacomum' | 'caixadagua' | 'ocultos';

function legacyWaterGroup(item: Item): WaterGroup {
  if (isOcultosDevice(item)) return 'ocultos';
  const dp = String(item.deviceProfile || '').toUpperCase();
  if (dp === 'HIDROMETRO_SHOPPING') return 'entrada';
  if (dp === 'HIDROMETRO_AREA_COMUM') return 'areacomum';
  if (dp === 'HIDROMETRO') return 'lojas';
  if (dp === 'TANK' || dp === 'CAIXA_DAGUA') return 'caixadagua';
  return 'areacomum';
}

// ---- TEMPERATURE oracle (categorizeItemsByGroupTemperature) --------------
type TempGroup = 'climatizavel' | 'nao_climatizavel' | 'ocultos';

function legacyTempGroup(item: Item): TempGroup {
  if (isOcultosDevice(item)) return 'ocultos';
  const dp = String(item.deviceProfile || '').toUpperCase();
  if (dp === 'TERMOSTATO_EXTERNAL') return 'nao_climatizavel';
  return 'climatizavel';
}

// ---- Fixtures ------------------------------------------------------------

const WATER_FIXTURES: Item[] = [
  { deviceProfile: 'HIDROMETRO_SHOPPING', identifier: 'ENT-01' },
  { deviceProfile: 'hidrometro_shopping', identifier: 'ent-lower' }, // case-insensitive
  { deviceProfile: 'HIDROMETRO_AREA_COMUM', identifier: 'AC-01' },
  { deviceProfile: 'HIDROMETRO', identifier: 'LOJA-12' },
  { deviceProfile: 'TANK', identifier: 'CX-01' },
  { deviceProfile: 'CAIXA_DAGUA', identifier: 'CX-02' },
  { deviceProfile: 'HIDROMETRO_ARQUIVADO', identifier: 'OLD-1' }, // ocultos
  { deviceProfile: 'SEM_DADOS', identifier: 'OLD-2' }, // ocultos
  { deviceProfile: 'UNKNOWN_PROFILE', identifier: 'X' }, // residual -> areacomum
  { deviceProfile: '', identifier: 'EMPTY' }, // residual -> areacomum
  { deviceProfile: null, identifier: 'NULLP' },
  { deviceProfile: 'BANHEIRO_HIDROMETRO', identifier: 'WC-1' }, // residual -> areacomum (not banheiros)
];

const TEMP_FIXTURES: Item[] = [
  { deviceProfile: 'TERMOSTATO', identifier: 'T-01' },
  { deviceProfile: 'TERMOSTATO_EXTERNAL', identifier: 'T-EXT-01' },
  { deviceProfile: 'termostato_external', identifier: 't-lower' }, // case-insensitive
  { deviceProfile: 'TERMOSTATO_VARIANT', identifier: 'T-02' }, // -> climatizavel
  { deviceProfile: 'TERMOSTATO_DESATIVADO', identifier: 'OLD-T' }, // ocultos
  { deviceProfile: 'REMOVIDO', identifier: 'OLD-T2' }, // ocultos
  { deviceProfile: '', identifier: 'EMPTY-T' }, // -> climatizavel
  { deviceProfile: null, identifier: 'NULL-T' },
];

describe('RFC-0207 follow-up #2 — water domain equivalence', () => {
  it('resolveGroup(item, DEFAULT, "water") matches legacy categorizeItemsByGroupWater', () => {
    for (const item of WATER_FIXTURES) {
      const got = resolveGroup(item, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'water').group;
      expect(got, `deviceProfile=${item.deviceProfile}`).toBe(legacyWaterGroup(item));
    }
  });

  it('never produces "banheiros" (extracted by TELEMETRY, not the resolver)', () => {
    for (const item of WATER_FIXTURES) {
      expect(resolveGroup(item, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'water').group).not.toBe(
        'banheiros',
      );
    }
  });
});

describe('RFC-0207 follow-up #2 — temperature domain equivalence', () => {
  it('resolveGroup(item, DEFAULT, "temperature") matches legacy categorizeItemsByGroupTemperature', () => {
    for (const item of TEMP_FIXTURES) {
      const got = resolveGroup(item, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'temperature').group;
      expect(got, `deviceProfile=${item.deviceProfile}`).toBe(legacyTempGroup(item));
    }
  });
});

describe('RFC-0207 follow-up #2 — domain isolation', () => {
  it('energy resolution is unchanged by the added domains (regression guard)', () => {
    // A 3F_MEDIDOR is lojas in energy; in water it falls through to areacomum.
    const store: Item = { deviceProfile: '3F_MEDIDOR', identifier: 'L-1' };
    expect(resolveGroup(store, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'energy').group).toBe('lojas');
    expect(resolveGroup(store, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'water').group).toBe(
      'areacomum',
    );
  });

  it('falls back to the DEFAULT domain when a custom profile omits water/temperature', () => {
    // A profile that only overrides energy still classifies water via DEFAULT.
    const energyOnly = {
      schemaVersion: 1,
      domains: { energy: DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy },
    } as typeof DEFAULT_DEVICE_CLASSIFICATION_PROFILE;
    const hydro: Item = { deviceProfile: 'HIDROMETRO', identifier: 'L-9' };
    expect(resolveGroup(hydro, energyOnly, 'water').group).toBe('lojas');
  });
});
