// tests/deviceClassificationProfile.equivalence.test.ts
//
// RFC-0207 / PR A0 — Equivalence golden test.
// The legacy functions (inlined below as the oracle) MUST produce identical
// results to the resolver over the DEFAULT seed for every fixture device.
// ZERO diff. This locks the behavior-preserving extraction (bugs included).

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  resolveCategory,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  validateProfile,
} from '../src/utils/deviceClassificationProfile';

// ===========================================================================
// LEGACY ORACLE — faithful copy of MAIN_VIEW/controller.js classifier logic.
// ===========================================================================

const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];
const ENTRADA_PROFILES = new Set(['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO']);

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
  if (CLIMATIZACAO_IDENTIFIERS_SET.has(id)) return 'climatizacao';
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
// FIXTURE
// ===========================================================================

const FIXTURE: Item[] = [
  // loja
  { deviceProfile: '3F_MEDIDOR', identifier: 'LOJA-101' },
  // entrada (each profile)
  { deviceProfile: 'TRAFO', identifier: 'TR-01' },
  { deviceProfile: 'ENTRADA', identifier: 'ENT-01' },
  { deviceProfile: 'RELOGIO', identifier: 'REL-01' },
  { deviceProfile: 'SUBESTACAO', identifier: 'SUB-01' },
  // ocultos (substring over deviceProfile)
  { deviceProfile: 'MEDIDOR_ARQUIVADO', identifier: 'X-01' },
  { deviceProfile: 'INATIVO', identifier: 'X-02' },
  // climatizacao via deviceProfile
  { deviceProfile: 'CHILLER', identifier: 'CH-01' },
  { deviceProfile: 'FANCOIL', identifier: 'FC-01' },
  { deviceProfile: 'HVAC', identifier: 'HV-01' },
  { deviceProfile: 'AR_CONDICIONADO', identifier: 'AC-01' },
  // elevador / escada via deviceProfile
  { deviceProfile: 'ELEVADOR', identifier: 'E-01' },
  { deviceProfile: 'ESCADA_ROLANTE', identifier: 'ER-01' },
  // BUG cases (conditional BOMBA + identifier)
  { deviceProfile: 'BOMBA', identifier: 'CAG' },            // -> climatizacao (exact hit)
  { deviceProfile: 'BOMBA', identifier: 'CAG 01' },         // -> outros (A0 bug, exact miss)
  { deviceProfile: 'BOMBA', identifier: 'CAG-PRIMARIA' },   // -> climatizacao (prefix)
  { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2' },    // -> outros (A0)
  { deviceProfile: 'MOTOR', identifier: 'FANCOIL' },        // -> climatizacao (exact hit)
  { deviceProfile: 'MOTOR', identifier: 'FANCOIL-2' },      // -> climatizacao (prefix)
  { deviceProfile: 'MOTOR', identifier: 'NADA' },           // -> outros
  // identifier-only fallback (deviceProfile empty)
  { deviceProfile: '', identifier: 'ELV-03' },              // -> elevadores
  { deviceProfile: '', identifier: 'ESCADASROLANTES' },     // -> escadas_rolantes (exact)
  { deviceProfile: '', identifier: 'CAG' },                 // -> climatizacao (exact)
  { deviceProfile: '', identifier: 'ESC-09' },              // -> escadas_rolantes (prefix)
  // empty / N/D / sentinels
  { deviceProfile: 'N/D', identifier: 'N/A' },              // -> outros
  { deviceProfile: '', identifier: 'SEM IDENTIFICADOR' },   // -> outros (sentinel -> null)
  { deviceProfile: '', identifier: '' },                    // -> outros
  // generic outros
  { deviceProfile: 'GENERIC_THING', identifier: 'G-01' },   // -> outros
];

// ===========================================================================
// TESTS
// ===========================================================================

describe('deviceClassificationProfile — A0 equivalence golden', () => {
  it('DEFAULT seed validates clean', () => {
    expect(validateProfile(DEFAULT_DEVICE_CLASSIFICATION_PROFILE)).toEqual([]);
  });

  it('resolveGroup matches legacyClassifyGroup for every fixture (zero diff)', () => {
    for (const d of FIXTURE) {
      expect(resolveGroup(d).group, `group for ${JSON.stringify(d)}`).toBe(
        legacyClassifyGroup(d),
      );
    }
  });

  it('resolveCategory matches legacyClassifyCategory for every fixture (zero diff)', () => {
    for (const d of FIXTURE) {
      expect(resolveCategory(d).category, `category for ${JSON.stringify(d)}`).toBe(
        legacyClassifyCategory(d),
      );
    }
  });

  // ---- matchedBy orphan-signal locks ----

  it('CAG-01 (BOMBA) is the A0 bug: outros via fallback (orphan signal)', () => {
    const d = { deviceProfile: 'BOMBA', identifier: 'CAG 01' };
    expect(legacyClassifyCategory(d)).toBe('outros');
    expect(resolveCategory(d)).toEqual({ category: 'outros', matchedBy: 'fallback' });
  });

  it('CAG (BOMBA) exact hit is conditional', () => {
    const d = { deviceProfile: 'BOMBA', identifier: 'CAG' };
    expect(resolveCategory(d)).toEqual({ category: 'climatizacao', matchedBy: 'conditional' });
  });

  it('CAG-PRIMARIA (BOMBA) prefix hit is conditional', () => {
    const d = { deviceProfile: 'BOMBA', identifier: 'CAG-PRIMARIA' };
    expect(resolveCategory(d)).toEqual({ category: 'climatizacao', matchedBy: 'conditional' });
  });

  it('ELV-03 identifier-only resolves via identifier fallback', () => {
    const d = { deviceProfile: '', identifier: 'ELV-03' };
    expect(resolveCategory(d)).toEqual({ category: 'elevadores', matchedBy: 'identifier' });
  });

  it('generic device is a genuine orphan: outros via fallback', () => {
    const d = { deviceProfile: 'GENERIC_THING', identifier: 'G-01' };
    expect(resolveCategory(d)).toEqual({ category: 'outros', matchedBy: 'fallback' });
  });

  it('3F_MEDIDOR group=lojas matchedBy=deviceProfile; ocultos matchedBy=ocultos', () => {
    expect(resolveGroup({ deviceProfile: '3F_MEDIDOR' })).toEqual({
      group: 'lojas',
      matchedBy: 'deviceProfile',
    });
    expect(resolveGroup({ deviceProfile: 'MEDIDOR_ARQUIVADO' })).toEqual({
      group: 'ocultos',
      matchedBy: 'ocultos',
    });
    expect(resolveGroup({ deviceProfile: 'GENERIC_THING' })).toEqual({
      group: 'areacomum',
      matchedBy: 'fallback',
    });
  });
});
