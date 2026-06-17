import { describe, it, expect } from 'vitest';
import {
  generateAssetCode,
  ASSET_CODE_RE,
  isAssetCode,
  ASSET_TYPE_CONFIG,
  getAssetTypeConfig,
  applyCustomerCodeToAssetName,
  assetLocalToken,
} from '../../src/utils/asset';

const PLATE = '[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}';
const CODE_RE = new RegExp(`^A-${PLATE}-${PLATE}$`);

describe('generateAssetCode', () => {
  it('always matches the A-<plate>-<plate> grammar', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateAssetCode();
      expect(code).toMatch(CODE_RE);
      expect(code).toMatch(ASSET_CODE_RE);
      expect(isAssetCode(code)).toBe(true);
    }
  });

  it('never emits ambiguous glyphs (I, O, 0, 1) in the plates', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateAssetCode().slice(2)).not.toMatch(/[IO01]/);
    }
  });
});

describe('isAssetCode', () => {
  it('rejects a customer code and malformed input', () => {
    expect(isAssetCode('C-XDN5R48-JQE6K43')).toBe(false);
    expect(isAssetCode('A-ABC1D23')).toBe(false);
    expect(isAssetCode(null)).toBe(false);
  });
});

describe('ASSET_TYPE_CONFIG / getAssetTypeConfig', () => {
  it('stores icon NAMES (strings), not components, with hex colors', () => {
    for (const [, cfg] of Object.entries(ASSET_TYPE_CONFIG)) {
      expect(typeof cfg.icon).toBe('string');
      expect(cfg.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(ASSET_TYPE_CONFIG.EQUIPMENT).toEqual({ icon: 'Settings2', color: '#ef4444' });
    expect(ASSET_TYPE_CONFIG.LOCATION.icon).toBe('MapPin');
  });

  it('covers exactly the 6 canonical asset types', () => {
    expect(Object.keys(ASSET_TYPE_CONFIG).sort()).toEqual(
      ['BUILDING', 'EQUIPMENT', 'FLOOR', 'LOCATION', 'OTHER', 'ROOM']
    );
  });

  it('resolves case-insensitively and falls back to OTHER', () => {
    expect(getAssetTypeConfig('equipment')).toEqual(ASSET_TYPE_CONFIG.EQUIPMENT);
    expect(getAssetTypeConfig('NOPE')).toEqual(ASSET_TYPE_CONFIG.OTHER);
    expect(getAssetTypeConfig('')).toEqual(ASSET_TYPE_CONFIG.OTHER);
    expect(getAssetTypeConfig(null)).toEqual(ASSET_TYPE_CONFIG.OTHER);
  });
});

describe('applyCustomerCodeToAssetName', () => {
  const CODE = 'C-XDN5R48-JQE6K43';

  it('prefixes the asset name with the customer code', () => {
    expect(applyCustomerCodeToAssetName('Reservatorio Geral', CODE)).toBe(
      `${CODE} Reservatorio Geral`
    );
  });

  it('is idempotent (does not double-prefix)', () => {
    const once = applyCustomerCodeToAssetName('Reservatorio Geral', CODE);
    expect(applyCustomerCodeToAssetName(once, CODE)).toBe(once);
  });

  it('returns the trimmed name when the code is empty', () => {
    expect(applyCustomerCodeToAssetName('  Bomba 1  ', '')).toBe('Bomba 1');
  });

  it('returns the code alone when the name is empty', () => {
    expect(applyCustomerCodeToAssetName('', CODE)).toBe(CODE);
  });
});

describe('assetLocalToken', () => {
  it('strips a leading customer-code prefix', () => {
    expect(assetLocalToken('C-XDN5R48-JQE6K43 Reservatorio Geral')).toBe('Reservatorio Geral');
  });

  it('round-trips with applyCustomerCodeToAssetName', () => {
    const CODE = 'C-XDN5R48-JQE6K43';
    const local = 'Bomba CAG 2';
    expect(assetLocalToken(applyCustomerCodeToAssetName(local, CODE))).toBe(local);
  });

  it('leaves names without a code prefix untouched', () => {
    expect(assetLocalToken('Reservatorio Geral')).toBe('Reservatorio Geral');
    expect(assetLocalToken('SCP0D009 Havaianas')).toBe('SCP0D009 Havaianas');
    expect(assetLocalToken('SingleWord')).toBe('SingleWord');
  });
});
