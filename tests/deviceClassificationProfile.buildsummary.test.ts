// tests/deviceClassificationProfile.buildsummary.test.ts
//
// RFC-0207 / PR A1b — buildSummary unification: DUAL-ORACLE migration snapshot.
//
// The unified resolveCategory is now a faithful SUPERSET of BOTH legacy paths:
//   - legacyClassifyCategory  (MAIN_VIEW classifyDevice: deviceProfile + identifier)
//   - legacyBuildSummaryTop    (buildSummary top-level: combined-substring + id prefixes)
// These two legacy paths DISAGREE with each other (that is bug #2). The unified
// resolver reconciles them; this test documents every move vs EACH oracle so a
// human can review (mirror EXPECTED_* in the PR description).
//
// Reviewed deltas are surgical: every move is outros -> climatizacao, caused by
// the combined-text patterns (CLIMATIZA/COMPRESSOR/VENTILADOR/BOMBA_HIDRAULICA),
// the CHILLER- id prefix, or the conditional CAG fix. No device leaves a
// specific bucket for a worse one.

import { describe, it, expect } from 'vitest';
import { resolveCategory, resolveGroup } from '../src/utils/deviceClassificationProfile';

// ===========================================================================
// ORACLE 1 — legacy classifyDevice (deviceProfile + identifier).
// ===========================================================================

const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL']);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(['BOMBA', 'MOTOR']);
const CLIMATIZACAO_IDENTIFIERS_SET = new Set(['CAG', 'FANCOIL']);
const ELEVADORES_DEVICE_TYPES_SET = new Set(['ELEVADOR']);
const ELEVADORES_IDENTIFIERS_SET = new Set(['ELV', 'ELEVADOR', 'ELEVADORES']);
const ESCADAS_DEVICE_TYPES_SET = new Set(['ESCADA_ROLANTE']);
const ESCADAS_IDENTIFIERS_SET = new Set(['ESC', 'ESCADA', 'ESCADASROLANTES']);

interface Item {
  deviceProfile?: string | null;
  identifier?: string | null;
  deviceType?: string | null;
  label?: string | null;
  labelWidget?: string | null;
}

function legacyClassifyDeviceByType(item: Item): string {
  const deviceProfile = String(item.deviceProfile || '').toUpperCase();
  if (deviceProfile === '3F_MEDIDOR') return 'lojas';
  if (!deviceProfile || deviceProfile === 'N/D') return 'outros';
  if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceProfile)) return 'climatizacao';
  if (CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(deviceProfile)) {
    const id = String(item.identifier || '').toUpperCase().trim();
    if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) return 'climatizacao';
    for (const p of ['CAG-', 'FANCOIL-']) if (id.startsWith(p)) return 'climatizacao';
    return 'outros';
  }
  if (ELEVADORES_DEVICE_TYPES_SET.has(deviceProfile)) return 'elevadores';
  if (ESCADAS_DEVICE_TYPES_SET.has(deviceProfile)) return 'escadas_rolantes';
  return 'outros';
}
function legacyClassifyDeviceById(identifier = ''): string | null {
  if (!identifier || identifier === 'N/A' || identifier === 'null' || identifier === 'undefined') return null;
  const id = String(identifier).trim().toUpperCase();
  if (id.includes('SEM IDENTIFICADOR')) return null;
  if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) return 'climatizacao';
  for (const p of ['CAG-', 'FANCOIL-']) if (id.startsWith(p)) return 'climatizacao';
  if (ELEVADORES_IDENTIFIERS_SET.has(id)) return 'elevadores';
  for (const p of ['ELV-', 'ELEVADOR-']) if (id.startsWith(p)) return 'elevadores';
  if (ESCADAS_IDENTIFIERS_SET.has(id)) return 'escadas_rolantes';
  for (const p of ['ESC-', 'ESCADA-', 'ESCADA_']) if (id.startsWith(p)) return 'escadas_rolantes';
  return 'outros';
}
function legacyClassifyCategory(item: Item): string {
  const byType = legacyClassifyDeviceByType(item);
  if (byType !== 'outros') return byType;
  if (item.identifier) {
    const byId = legacyClassifyDeviceById(item.identifier);
    if (byId != null && byId !== 'outros') return byId;
  }
  return 'outros';
}

// ===========================================================================
// ORACLE 2 — legacy buildSummary top-level (combined-substring + id prefixes).
// Only ever runs on the areacomum set; returns one of the 4 breakdown buckets.
// ===========================================================================

const CLIMATIZACAO_PATTERNS = [
  'CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'COMPRESSOR',
  'VENTILADOR', 'CLIMATIZA', 'BOMBA_HIDRAULICA', 'BOMBASHIDRAULICAS',
];
const ELEVADOR_PATTERNS = ['ELEVADOR'];
const ESCADA_PATTERNS = ['ESCADA', 'ROLANTE'];

function legacyBuildSummaryTop(item: Item): string {
  const toStr = (v: unknown) => String(v || '').toUpperCase();
  const combined = `${toStr(item.labelWidget)} ${toStr(item.deviceType)} ${toStr(item.deviceProfile)} ${toStr(item.label)}`;
  const id = toStr(item.identifier);
  const isElevadorById = id.startsWith('ELV-');
  const isEscadaById = id.startsWith('ESC-');
  const isClimatById = id.startsWith('CAG-') || id.startsWith('FANCOIL-') || id.startsWith('CHILLER-');
  if (ELEVADOR_PATTERNS.some((p) => combined.includes(p)) || isElevadorById) return 'elevadores';
  if (ESCADA_PATTERNS.some((p) => combined.includes(p)) || isEscadaById) return 'escadas_rolantes';
  if (CLIMATIZACAO_PATTERNS.some((p) => combined.includes(p)) || isClimatById) return 'climatizacao';
  return 'outros';
}

// ===========================================================================
// FIXTURE — exercises deviceProfile, identifier, AND combined-text signals.
// ===========================================================================

const FIXTURE: Item[] = [
  // exact deviceProfile (unchanged across all paths)
  { deviceProfile: 'CHILLER', identifier: 'CH-1' },
  { deviceProfile: 'ELEVADOR', identifier: 'CAG' },            // pass1 protects: stays elevador
  { deviceProfile: 'ESCADA_ROLANTE', identifier: 'X' },
  // identifier-driven (unchanged)
  { deviceProfile: '', identifier: 'ELV-03' },
  { deviceProfile: '', identifier: 'CAG' },
  // genuine orphans (unchanged)
  { deviceProfile: 'GENERIC', identifier: 'G-1', label: 'Quadro Geral' },
  { deviceProfile: 'MOTOR', identifier: 'NADA' },
  // === MOVES vs classifyDevice (combined-text catches them; buildSummary already did) ===
  { deviceProfile: 'BOMBA', identifier: 'X', label: 'Climatizador Central' }, // CLIMATIZA
  { deviceProfile: 'MOTOR', identifier: 'Y', deviceType: 'COMPRESSOR' },       // COMPRESSOR
  { deviceProfile: 'BOMBA', identifier: 'Z', label: 'BOMBA_HIDRAULICA' },      // BOMBA_HIDRAULICA
  { deviceProfile: '', identifier: 'W', deviceType: 'VENTILADOR' },            // VENTILADOR
  { deviceProfile: 'BOMBA', identifier: 'CHILLER-1' },                         // CHILLER- id prefix
  // === MOVES vs buildSummary (conditional CAG; buildSummary misses bare CAG) ===
  { deviceProfile: 'BOMBA', identifier: 'CAG' },                               // conditional
  { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2' },                       // conditional + space
];

function keyOf(d: Item): string {
  return `${d.deviceProfile ?? ''}|${d.identifier ?? ''}|${d.deviceType ?? ''}|${d.label ?? ''}`;
}

// Reviewed expected deltas (the migration snapshot). Every entry verified
// outros -> climatizacao by the per-move assertions below.
//
// vs classifyDevice (pre-A1 oracle: exact CAG) — combines A1 (conditional CAG
// substring) + A1b (combined-text + CHILLER- prefix) moves:
const EXPECTED_VS_CLASSIFYDEVICE = new Set([
  'BOMBA|BOMBA CAG 2||',          // A1: conditional CAG substring
  'BOMBA|X||Climatizador Central', // A1b: combined CLIMATIZA
  'MOTOR|Y|COMPRESSOR|',           // A1b: combined COMPRESSOR
  'BOMBA|Z||BOMBA_HIDRAULICA',     // A1b: combined BOMBA_HIDRAULICA
  '|W|VENTILADOR|',                // A1b: combined VENTILADOR
  'BOMBA|CHILLER-1||',             // A1b: CHILLER- id prefix
]);
// vs buildSummary (only catches CAG-/FANCOIL-/CHILLER- prefixes, never bare CAG):
const EXPECTED_VS_BUILDSUMMARY = new Set([
  'BOMBA|CAG||',                   // conditional bare CAG
  'BOMBA|BOMBA CAG 2||',           // conditional CAG substring
  '|CAG||',                        // identifier bare CAG (no profile)
]);

// ===========================================================================
// TESTS
// ===========================================================================

describe('deviceClassificationProfile — A1b buildSummary unification (dual-oracle)', () => {
  it('resolveGroup (columns) is untouched by A1b', () => {
    // grouping does not use combined/category logic; spot-check a few
    expect(resolveGroup({ deviceProfile: '3F_MEDIDOR' }).group).toBe('lojas');
    expect(resolveGroup({ deviceProfile: 'TRAFO' }).group).toBe('entrada');
    expect(resolveGroup({ deviceProfile: 'BOMBA' }).group).toBe('areacomum');
  });

  it('moves vs legacy classifyDevice match the reviewed snapshot exactly', () => {
    const moves = new Set<string>();
    for (const d of FIXTURE) {
      const before = legacyClassifyCategory(d);
      const after = resolveCategory(d).category;
      if (before !== after) {
        expect(before, `move ${keyOf(d)} must be outros->climatizacao`).toBe('outros');
        expect(after).toBe('climatizacao');
        moves.add(keyOf(d));
      }
    }
    expect([...moves].sort()).toEqual([...EXPECTED_VS_CLASSIFYDEVICE].sort());
  });

  it('moves vs legacy buildSummary match the reviewed snapshot exactly (areacomum only)', () => {
    const moves = new Set<string>();
    for (const d of FIXTURE) {
      // buildSummary only processes areacomum devices
      if (resolveGroup(d).group !== 'areacomum') continue;
      const before = legacyBuildSummaryTop(d);
      const after = resolveCategory(d).category;
      if (before !== after) {
        expect(before, `move ${keyOf(d)} must be outros->climatizacao`).toBe('outros');
        expect(after).toBe('climatizacao');
        moves.add(keyOf(d));
      }
    }
    expect([...moves].sort()).toEqual([...EXPECTED_VS_BUILDSUMMARY].sort());
  });

  it('unified is a SUPERSET: never sends a device buildSummary classified to a worse bucket', () => {
    // for every areacomum device, if buildSummary gave a specific category,
    // unified must give the SAME specific category (no regressions to outros).
    for (const d of FIXTURE) {
      if (resolveGroup(d).group !== 'areacomum') continue;
      const bs = legacyBuildSummaryTop(d);
      if (bs !== 'outros') {
        expect(resolveCategory(d).category, `regression for ${keyOf(d)}`).toBe(bs);
      }
    }
  });

  it('precedence: exact deviceProfile wins over loose text (ELEVADOR with CAG id stays elevador)', () => {
    expect(resolveCategory({ deviceProfile: 'ELEVADOR', identifier: 'CAG' })).toEqual({
      category: 'elevadores',
      matchedBy: 'deviceProfile',
    });
  });

  it('combined-text match reports matchedBy: combined', () => {
    expect(resolveCategory({ deviceProfile: 'BOMBA', identifier: 'X', label: 'Climatizador' })).toEqual({
      category: 'climatizacao',
      matchedBy: 'combined',
    });
  });
});
