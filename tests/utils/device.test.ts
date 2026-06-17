import { describe, it, expect } from 'vitest';
import {
  generateMercosulPlate,
  getDeviceTypePrefix,
  DEVICE_TYPE_PREFIX_MAP,
  DEFAULT_DEVICE_TYPE_PREFIX,
  deviceTypeToken,
  generateDeviceCode,
  DEFAULT_DEVICE_TYPE_TOKEN,
} from '../../src/utils/device';

// Mercosul format used here: LLL D L DD (3 letters, 1 digit, 1 letter, 2 digits).
// Letters exclude I/O; digits exclude 0/1 (visually ambiguous glyphs).
const PLATE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}$/;

describe('generateMercosulPlate', () => {
  it('returns a 7-character string', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateMercosulPlate()).toHaveLength(7);
    }
  });

  it('always matches the LLLDLDD Mercosul format', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateMercosulPlate()).toMatch(PLATE_RE);
    }
  });

  it('never emits visually ambiguous glyphs (I, O, 0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const plate = generateMercosulPlate();
      expect(plate).not.toMatch(/[IO01]/);
    }
  });

  it('uses only uppercase letters in the letter positions (0,1,2,4)', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateMercosulPlate();
      for (const idx of [0, 1, 2, 4]) {
        expect(p[idx]).toMatch(/[A-Z]/);
      }
      for (const idx of [3, 5, 6]) {
        expect(p[idx]).toMatch(/[2-9]/);
      }
    }
  });

  it('produces varied output (not a constant)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(generateMercosulPlate());
    }
    // With ~4.5B combinations, 200 samples should yield many distinct plates.
    expect(seen.size).toBeGreaterThan(150);
  });

  it('eventually exercises every allowed letter and digit glyph', () => {
    const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
    const DIGITS = '23456789'.split('');
    const lettersSeen = new Set<string>();
    const digitsSeen = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      const p = generateMercosulPlate();
      [0, 1, 2, 4].forEach((idx) => lettersSeen.add(p[idx]));
      [3, 5, 6].forEach((idx) => digitsSeen.add(p[idx]));
    }
    LETTERS.forEach((l) => expect(lettersSeen.has(l), `letter ${l}`).toBe(true));
    DIGITS.forEach((d) => expect(digitsSeen.has(d), `digit ${d}`).toBe(true));
  });
});

describe('getDeviceTypePrefix / DEVICE_TYPE_PREFIX_MAP', () => {
  it('resolves known device-type prefixes exactly', () => {
    expect(getDeviceTypePrefix('3F_MEDIDOR')).toBe('3F');
    expect(getDeviceTypePrefix('COMPRESSOR')).toBe('3F COMP.');
    expect(getDeviceTypePrefix('SELETOR_AUTO_MANUAL')).toBe('S_AUTO_MANUAL.');
    expect(getDeviceTypePrefix('HIDROMETRO')).toBe('HIDR.');
    expect(getDeviceTypePrefix('CAIXA_D_AGUA')).toBe('SCD');
  });

  it('includes the RFC-0003 SW_* board family', () => {
    expect(getDeviceTypePrefix('SW_ILUMINACAO')).toBe('ILUM.');
    expect(getDeviceTypePrefix('SW_COMPRESSOR')).toBe('COMP.');
    expect(getDeviceTypePrefix('SW_GERADOR')).toBe('GER.');
    expect(getDeviceTypePrefix('SW_REDE')).toBe('REDE');
  });

  it('falls back to DEV. for unknown / empty input', () => {
    expect(DEFAULT_DEVICE_TYPE_PREFIX).toBe('DEV.');
    expect(getDeviceTypePrefix('NOT_A_TYPE')).toBe('DEV.');
    expect(getDeviceTypePrefix('')).toBe('DEV.');
    expect(getDeviceTypePrefix(null)).toBe('DEV.');
    expect(getDeviceTypePrefix(undefined)).toBe('DEV.');
  });

  it('lookup is exact (case-sensitive uppercase keys)', () => {
    // lowercase is not normalized — mirrors naming-rules.ts typePrefixFor
    expect(getDeviceTypePrefix('compressor')).toBe('DEV.');
  });

  it('map covers all 17 registered types', () => {
    expect(Object.keys(DEVICE_TYPE_PREFIX_MAP)).toHaveLength(17);
  });
});

// ─── RFC-0206 Phase 3: device code ───────────────────────────────────────────

describe('deviceTypeToken', () => {
  it('applies explicit short-token overrides', () => {
    expect(deviceTypeToken('3F_MEDIDOR')).toBe('3F');
  });

  it('sanitizes unmapped types to an uppercase hyphen-safe token', () => {
    expect(deviceTypeToken('SW_ILUMINACAO')).toBe('SW-ILUMINACAO');
    expect(deviceTypeToken('hidrometro')).toBe('HIDROMETRO');
    expect(deviceTypeToken('  ar condicionado ')).toBe('AR-CONDICIONADO');
    expect(deviceTypeToken('A//B__C')).toBe('A-B-C');
  });

  it('falls back to DEV for unknown/empty input', () => {
    expect(DEFAULT_DEVICE_TYPE_TOKEN).toBe('DEV');
    expect(deviceTypeToken('')).toBe('DEV');
    expect(deviceTypeToken(null)).toBe('DEV');
    expect(deviceTypeToken(undefined)).toBe('DEV');
    expect(deviceTypeToken('---')).toBe('DEV');
  });
});

describe('generateDeviceCode', () => {
  const PLATE = '[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}';

  it('embeds the type token: D-<TYPE>-<plate>-<plate>', () => {
    const re = new RegExp(`^D-3F-${PLATE}-${PLATE}$`);
    for (let i = 0; i < 500; i++) {
      expect(generateDeviceCode('3F_MEDIDOR')).toMatch(re);
    }
  });

  it('uses the sanitized token for unmapped types', () => {
    const re = new RegExp(`^D-SW-ILUMINACAO-${PLATE}-${PLATE}$`);
    expect(generateDeviceCode('SW_ILUMINACAO')).toMatch(re);
  });

  it('uses the DEV token for empty input', () => {
    const re = new RegExp(`^D-DEV-${PLATE}-${PLATE}$`);
    expect(generateDeviceCode('')).toMatch(re);
  });

  it('never emits ambiguous glyphs in the plate positions', () => {
    for (let i = 0; i < 500; i++) {
      // drop the 'D-3F-' prefix; the remaining plates must be glyph-clean
      const plates = generateDeviceCode('3F_MEDIDOR').replace(/^D-3F-/, '');
      expect(plates).not.toMatch(/[IO01]/);
    }
  });
});
