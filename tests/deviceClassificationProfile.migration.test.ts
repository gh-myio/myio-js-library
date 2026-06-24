// tests/deviceClassificationProfile.migration.test.ts
//
// RFC-0207 / PR A1 — Migration snapshot (replaces the A0 equivalence golden).
//
// A0 proved resolver === legacy (zero diff, bugs preserved). A1 deliberately
// flips the climatizacao identifier match from EXACT (Set.has) to SUBSTRING
// (.includes), fixing BUG #1. That MOVES some devices between buckets — so this
// is NOT an equivalence test. It is a reviewed migration snapshot:
//
//   - resolveGroup (columns) is UNCHANGED — still equivalent to legacy.
//   - resolveCategory (breakdown) moves EXACTLY the devices listed in
//     EXPECTED_MIGRATIONS, and NOTHING else. Any surprise move fails CI.
//
// The EXPECTED_MIGRATIONS table is the human-reviewed artifact (mirror it in the
// PR description as `device | before | after`).

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  resolveCategory,
} from '../src/utils/devices/deviceClassificationProfile';

// ===========================================================================
// LEGACY ORACLE — the "before" (pre-A1, with BUG #1: exact CAG match).
// ===========================================================================

const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];
const ENTRADA_PROFILES = new Set(['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']);

const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL']);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(['BOMBA', 'MOTOR']);
const CLIMATIZACAO_IDENTIFIERS_SET = new Set(['CAG', 'FANCOIL']); // EXACT (the bug)
const ELEVADORES_DEVICE_TYPES_SET = new Set(['ELEVADOR']);
const ELEVADORES_IDENTIFIERS_SET = new Set(['ELV', 'ELEVADOR', 'ELEVADORES']);
const ESCADAS_DEVICE_TYPES_SET = new Set(['ESCADA_ROLANTE']);
const ESCADAS_IDENTIFIERS_SET = new Set(['ESC', 'ESCADA', 'ESCADASROLANTES']);

interface Item {
  deviceProfile?: string | null;
  identifier?: string | null;
}

function isOcultosDevice(item: Item): boolean {
  const dp = String(item.deviceProfile || '').toUpperCase();
  return OCULTOS_PATTERNS.some((pattern) => dp.includes(pattern));
}

function legacyClassifyGroup(item: Item): 'lojas' | 'entrada' | 'areacomum' | 'ocultos' {
  if (isOcultosDevice(item)) return 'ocultos';
  const dp = String(item.deviceProfile || '').toUpperCase();
  if (dp === '3F_MEDIDOR') return 'lojas';
  if (ENTRADA_PROFILES.has(dp)) return 'entrada';
  return 'areacomum';
}

function classifyDeviceByDeviceType(item: Item): string {
  if (!item) return 'outros';
  const deviceProfile = String(item.deviceProfile || '').toUpperCase();
  if (deviceProfile === '3F_MEDIDOR') return 'lojas';
  if (!deviceProfile || deviceProfile === 'N/D') return 'outros';
  if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceProfile)) return 'climatizacao';
  if (CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(deviceProfile)) {
    const identifier = String(item.identifier || '').toUpperCase().trim();
    if (CLIMATIZACAO_IDENTIFIERS_SET.has(identifier)) return 'climatizacao'; // BUG #1 (exact)
    for (const prefix of ['CAG-', 'FANCOIL-']) if (identifier.startsWith(prefix)) return 'climatizacao';
    return 'outros';
  }
  if (ELEVADORES_DEVICE_TYPES_SET.has(deviceProfile)) return 'elevadores';
  if (ESCADAS_DEVICE_TYPES_SET.has(deviceProfile)) return 'escadas_rolantes';
  return 'outros';
}

function classifyDeviceByIdentifier(identifier = ''): string | null {
  if (!identifier || identifier === 'N/A' || identifier === 'null' || identifier === 'undefined') {
    return null;
  }
  const id = String(identifier).trim().toUpperCase();
  if (id.includes('SEM IDENTIFICADOR')) return null;
  if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) return 'climatizacao'; // BUG #1 (exact)
  for (const p of ['CAG-', 'FANCOIL-']) if (id.startsWith(p)) return 'climatizacao';
  if (ELEVADORES_IDENTIFIERS_SET.has(id)) return 'elevadores';
  for (const p of ['ELV-', 'ELEVADOR-']) if (id.startsWith(p)) return 'elevadores';
  if (ESCADAS_IDENTIFIERS_SET.has(id)) return 'escadas_rolantes';
  for (const p of ['ESC-', 'ESCADA-', 'ESCADA_']) if (id.startsWith(p)) return 'escadas_rolantes';
  return 'outros';
}

function legacyClassifyCategory(item: Item): string {
  const byType = classifyDeviceByDeviceType(item);
  if (byType !== 'outros') return byType;
  if (item && item.identifier) {
    const byId = classifyDeviceByIdentifier(item.identifier);
    if (byId != null && byId !== 'outros') return byId;
  }
  return 'outros';
}

// ===========================================================================
// FIXTURE — clean cases (must NOT move) + the CAG bug cases (must move).
// ===========================================================================

const FIXTURE: Item[] = [
  // --- unchanged: column buckets ---
  { deviceProfile: '3F_MEDIDOR', identifier: 'LOJA-101' },
  { deviceProfile: 'TRAFO', identifier: 'TR-01' },
  { deviceProfile: 'ENTRADA', identifier: 'ENT-01' },
  { deviceProfile: 'RELOGIO', identifier: 'REL-01' },
  { deviceProfile: 'SUBESTACAO', identifier: 'SUB-01' },
  { deviceProfile: 'MEDIDOR_ARQUIVADO', identifier: 'X-01' },
  { deviceProfile: 'INATIVO', identifier: 'X-02' },
  // --- unchanged: climatizacao via deviceProfile ---
  { deviceProfile: 'CHILLER', identifier: 'CH-01' },
  { deviceProfile: 'FANCOIL', identifier: 'FC-01' },
  { deviceProfile: 'HVAC', identifier: 'HV-01' },
  { deviceProfile: 'AR_CONDICIONADO', identifier: 'AC-01' },
  { deviceProfile: 'ELEVADOR', identifier: 'E-01' },
  { deviceProfile: 'ESCADA_ROLANTE', identifier: 'ER-01' },
  // --- unchanged: already matched exactly or by prefix pre-A1 ---
  { deviceProfile: 'BOMBA', identifier: 'CAG' },            // exact (still hits via contains)
  { deviceProfile: 'BOMBA', identifier: 'CAG-PRIMARIA' },   // prefix (still hits)
  { deviceProfile: 'MOTOR', identifier: 'FANCOIL' },        // exact
  { deviceProfile: 'MOTOR', identifier: 'FANCOIL-2' },      // prefix
  { deviceProfile: 'MOTOR', identifier: 'NADA' },           // no match -> outros (stays)
  { deviceProfile: '', identifier: 'ELV-03' },              // elevadores (exact set / prefix)
  { deviceProfile: '', identifier: 'ESCADASROLANTES' },     // escadas (exact)
  { deviceProfile: '', identifier: 'CAG' },                 // climatizacao via fallback (exact)
  { deviceProfile: '', identifier: 'ESC-09' },              // escadas (prefix)
  { deviceProfile: 'N/D', identifier: 'N/A' },              // outros (stays)
  { deviceProfile: '', identifier: 'SEM IDENTIFICADOR' },   // outros (stays)
  { deviceProfile: '', identifier: '' },                    // outros (stays)
  { deviceProfile: 'GENERIC_THING', identifier: 'G-01' },   // genuine orphan (stays)
  // --- THE BUG CASES (must move outros -> climatizacao under A1) ---
  { deviceProfile: 'BOMBA', identifier: 'CAG 01' },         // conditional + space
  { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2' },    // conditional + embedded
  { deviceProfile: 'MOTOR', identifier: 'CAG PRINCIPAL' },  // conditional + space
  { deviceProfile: '', identifier: 'CAG 01' },              // identifier-fallback + space
];

// ===========================================================================
// EXPECTED MIGRATION — the human-reviewed snapshot.
// device identifier | deviceProfile | before -> after
// ===========================================================================

const EXPECTED_MIGRATIONS: Array<{
  deviceProfile: string;
  identifier: string;
  before: string;
  after: string;
}> = [
  { deviceProfile: 'BOMBA', identifier: 'CAG 01', before: 'outros', after: 'climatizacao' },
  { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2', before: 'outros', after: 'climatizacao' },
  { deviceProfile: 'MOTOR', identifier: 'CAG PRINCIPAL', before: 'outros', after: 'climatizacao' },
  { deviceProfile: '', identifier: 'CAG 01', before: 'outros', after: 'climatizacao' },
];

function keyOf(d: Item): string {
  return `${d.deviceProfile ?? ''}|${d.identifier ?? ''}`;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('deviceClassificationProfile — A1 migration snapshot', () => {
  it('resolveGroup (columns) is UNCHANGED vs legacy (A1 does not touch grouping)', () => {
    for (const d of FIXTURE) {
      expect(resolveGroup(d).group, `group for ${JSON.stringify(d)}`).toBe(
        legacyClassifyGroup(d),
      );
    }
  });

  it('resolveCategory moves EXACTLY the expected devices — no surprise moves', () => {
    const expectedKeys = new Set(EXPECTED_MIGRATIONS.map((m) => `${m.deviceProfile}|${m.identifier}`));
    const actualMoves: Array<{ key: string; before: string; after: string }> = [];

    for (const d of FIXTURE) {
      const before = legacyClassifyCategory(d);
      const after = resolveCategory(d).category;
      if (before !== after) {
        actualMoves.push({ key: keyOf(d), before, after });
      }
    }

    // 1. every actual move is an expected move (no surprise reclassification)
    for (const move of actualMoves) {
      expect(expectedKeys.has(move.key), `unexpected move: ${move.key} (${move.before} -> ${move.after})`).toBe(true);
    }
    // 2. every expected move actually happened
    expect(actualMoves.map((m) => m.key).sort()).toEqual([...expectedKeys].sort());
  });

  it('each expected migration lands exactly as reviewed (before -> after)', () => {
    for (const m of EXPECTED_MIGRATIONS) {
      const d: Item = { deviceProfile: m.deviceProfile, identifier: m.identifier };
      expect(legacyClassifyCategory(d), `legacy before for ${m.identifier}`).toBe(m.before);
      expect(resolveCategory(d).category, `A1 after for ${m.identifier}`).toBe(m.after);
    }
  });

  it('CAG 01 (BOMBA) is now climatizacao via conditional (bug #1 fixed)', () => {
    expect(resolveCategory({ deviceProfile: 'BOMBA', identifier: 'CAG 01' })).toEqual({
      category: 'climatizacao',
      matchedBy: 'conditional',
    });
  });

  it('CAG 01 (no profile) is now climatizacao via identifier fallback', () => {
    expect(resolveCategory({ deviceProfile: '', identifier: 'CAG 01' })).toEqual({
      category: 'climatizacao',
      matchedBy: 'identifier',
    });
  });

  it('non-CAG orphan still falls through to outros/fallback (fix is surgical)', () => {
    expect(resolveCategory({ deviceProfile: 'GENERIC_THING', identifier: 'G-01' })).toEqual({
      category: 'outros',
      matchedBy: 'fallback',
    });
    expect(resolveCategory({ deviceProfile: 'MOTOR', identifier: 'NADA' })).toEqual({
      category: 'outros',
      matchedBy: 'fallback',
    });
  });
});
