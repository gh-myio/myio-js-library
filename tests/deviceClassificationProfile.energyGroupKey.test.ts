// tests/deviceClassificationProfile.energyGroupKey.test.ts
//
// RFC-0207 / follow-up #3 — Migration snapshot for TELEMETRY's _getEnergyGroupKey
// (the RFC-0196 card-filter classifier).
//
// This is a MIGRATION, not an equivalence: the legacy classifier keys off
// `deviceType` (+ identifier prefixes) and a parallel Set table, whereas the
// single-source resolver is `deviceProfile`-authoritative and A1 widened the CAG
// match to substring. Delegating therefore MOVES some cards between filter
// buckets. Every move is enumerated and reviewed in the table below — any
// unexpected move fails CI.
//
// Contract preserved across the migration: `null` means "not energy-group-
// filterable" → the card is ALWAYS shown (TELEMETRY:898). Water/temperature
// cards (and uncategorized non-3F_MEDIDOR devices) must keep returning `null`.

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  resolveCategory,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
} from '../src/utils/devices/deviceClassificationProfile';

interface Item {
  deviceType?: string;
  deviceProfile?: string;
  identifier?: string;
  label?: string;
}

type Bucket = 'entrada' | 'climatizacao' | 'elevadores' | 'escadasRolantes' | 'lojas' | 'outros' | null;

// ===========================================================================
// LEGACY ORACLE — exact copy of TELEMETRY/_getEnergyGroupKey (controller.js).
// Sets mirror DEVICE_CLASSIFICATION_CONFIG (same values the A0 seed encodes).
// ===========================================================================

const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL']);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(['BOMBA', 'MOTOR']);
const CLIMATIZACAO_IDENTIFIERS_SET = new Set(['CAG', 'FANCOIL']); // EXACT (legacy)
const ELEVADORES_DEVICE_TYPES_SET = new Set(['ELEVADOR']);
const ELEVADORES_IDENTIFIERS_SET = new Set(['ELV', 'ELEVADOR', 'ELEVADORES']);
const ESCADAS_DEVICE_TYPES_SET = new Set(['ESCADA_ROLANTE']);
const ESCADAS_IDENTIFIERS_SET = new Set(['ESC', 'ESCADA', 'ESCADASROLANTES']);

function legacyEnergyGroupKey(it: Item): Bucket {
  const dt = String(it.deviceType || '').toUpperCase();
  const dp = String(it.deviceProfile || '').toUpperCase();
  const id = String(it.identifier || '').toUpperCase();
  const entradaTypes = new Set(['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO']);
  if (entradaTypes.has(dt) || entradaTypes.has(dp)) return 'entrada';
  if (
    CLIMATIZACAO_DEVICE_TYPES_SET.has(dt) ||
    CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(dt) ||
    CLIMATIZACAO_IDENTIFIERS_SET.has(id) ||
    id.startsWith('CAG-') ||
    id.startsWith('FANCOIL-')
  )
    return 'climatizacao';
  if (ELEVADORES_DEVICE_TYPES_SET.has(dt) || ELEVADORES_IDENTIFIERS_SET.has(id) || id.startsWith('ELV-'))
    return 'elevadores';
  if (ESCADAS_DEVICE_TYPES_SET.has(dt) || ESCADAS_IDENTIFIERS_SET.has(id) || id.startsWith('ESC-'))
    return 'escadasRolantes';
  if (dt === '3F_MEDIDOR' && (dp === '3F_MEDIDOR' || !dp)) return 'lojas';
  if (dt === '3F_MEDIDOR') return 'outros';
  return null;
}

// ===========================================================================
// DELEGATED — exact mapping used by the new TELEMETRY/_getEnergyGroupKey.
// ===========================================================================

function delegatedEnergyGroupKey(it: Item): Bucket {
  // entrada is a GROUP (column) decision
  if (resolveGroup(it, DEFAULT_DEVICE_CLASSIFICATION_PROFILE, 'energy').group === 'entrada') {
    return 'entrada';
  }
  const cat = resolveCategory(it, DEFAULT_DEVICE_CLASSIFICATION_PROFILE).category;
  if (cat === 'climatizacao') return 'climatizacao';
  if (cat === 'elevadores') return 'elevadores';
  if (cat === 'escadas_rolantes') return 'escadasRolantes';
  if (cat === 'lojas') return 'lojas';
  // cat === 'outros' (residual do breakdown). Fix 2026-07-24: todo device de
  // ENERGIA nesta categoria é filtrável como 'outros' (antes só 3F_MEDIDOR, então
  // bombas/motores/iluminação ficavam null e o card "Outros" não filtrava). Água
  // (HIDROMETRO/TANK/CAIXA) e temperatura (TERMOSTATO) resolvem para 'outros' no
  // domínio energy mas não são energia — mantêm o contrato null (sempre visíveis).
  const dp = String(it.deviceProfile || '').toUpperCase();
  const isWaterOrTemp = /HIDROMETRO|TANK|CAIXA|TERMOSTATO/.test(dp);
  if (!isWaterOrTemp) return 'outros';
  return null;
}

// ===========================================================================
// MIGRATION TABLE — reviewed artifact. `legacy` / `delegated` are the expected
// bucket for each device; `move` flags an intentional behavior change.
// ===========================================================================

const TABLE: { name: string; item: Item; legacy: Bucket; delegated: Bucket; move: boolean }[] = [
  // --- unchanged (the common, well-formed cases) ---
  { name: 'entrada by profile', item: { deviceType: 'ENTRADA', deviceProfile: 'ENTRADA' }, legacy: 'entrada', delegated: 'entrada', move: false },
  { name: 'entrada RELOGIO', item: { deviceType: 'RELOGIO', deviceProfile: 'RELOGIO' }, legacy: 'entrada', delegated: 'entrada', move: false },
  { name: 'entrada SUBESTACAO', item: { deviceType: 'SUBESTACAO', deviceProfile: 'SUBESTACAO' }, legacy: 'entrada', delegated: 'entrada', move: false },
  { name: 'loja 3F/3F', item: { deviceType: '3F_MEDIDOR', deviceProfile: '3F_MEDIDOR' }, legacy: 'lojas', delegated: 'lojas', move: false },
  { name: 'climatizacao by profile CHILLER', item: { deviceType: 'CHILLER', deviceProfile: 'CHILLER' }, legacy: 'climatizacao', delegated: 'climatizacao', move: false },
  { name: 'climatizacao conditional BOMBA+CAG', item: { deviceType: 'BOMBA', deviceProfile: 'BOMBA', identifier: 'CAG 01' }, legacy: 'climatizacao', delegated: 'climatizacao', move: false },
  { name: 'elevador by ELV- prefix', item: { deviceType: 'X', deviceProfile: 'X', identifier: 'ELV-01' }, legacy: 'elevadores', delegated: 'elevadores', move: false },
  { name: 'escada by ESC- prefix', item: { deviceType: 'X', deviceProfile: 'X', identifier: 'ESC-1' }, legacy: 'escadasRolantes', delegated: 'escadasRolantes', move: false },
  { name: 'escada by profile', item: { deviceType: 'ESCADA_ROLANTE', deviceProfile: 'ESCADA_ROLANTE' }, legacy: 'escadasRolantes', delegated: 'escadasRolantes', move: false },

  // --- null contract: water/temperature stay always-shown (não filtráveis por energia) ---
  { name: 'temperature TERMOSTATO', item: { deviceType: 'TERMOSTATO', deviceProfile: 'TERMOSTATO', identifier: 'T-1' }, legacy: null, delegated: null, move: false },
  { name: 'water HIDROMETRO', item: { deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO' }, legacy: null, delegated: null, move: false },
  { name: 'water TANK', item: { deviceType: 'TANK', deviceProfile: 'TANK' }, legacy: null, delegated: null, move: false },

  // --- FIX 2026-07-24: energy-outros agora é filtrável pelo card "Outros" ---
  // (antes só 3F_MEDIDOR retornava 'outros'; estes ficavam null → clicar em
  //  "Outros Equipamentos" não filtrava. legacy null → delegated 'outros' = move.)
  { name: 'FIX outros BOMBA_HIDRAULICA', item: { deviceType: 'BOMBA_HIDRAULICA', deviceProfile: 'BOMBA_HIDRAULICA' }, legacy: null, delegated: 'outros', move: true },
  { name: 'FIX outros ILUMINACAO', item: { deviceType: 'ILUMINACAO', deviceProfile: 'ILUMINACAO' }, legacy: null, delegated: 'outros', move: true },
  { name: 'FIX outros GERADOR', item: { deviceType: 'GERADOR', deviceProfile: 'GERADOR' }, legacy: null, delegated: 'outros', move: true },

  // --- intentional MOVES (deviceProfile authority + A1 CAG substring) ---
  // deviceType=TRAFO but deviceProfile=3F_MEDIDOR → profile wins → loja, not entrada.
  { name: 'MOVE conflicting TRAFO/3F', item: { deviceType: 'TRAFO', deviceProfile: '3F_MEDIDOR' }, legacy: 'entrada', delegated: 'lojas', move: true },
  // 3F_MEDIDOR deviceType with empty profile → profile can't confirm loja → outros.
  { name: 'MOVE 3F deviceType, empty profile', item: { deviceType: '3F_MEDIDOR', deviceProfile: '' }, legacy: 'lojas', delegated: 'outros', move: true },
  // climatizacao by deviceProfile the deviceType-keyed legacy missed.
  { name: 'MOVE FANCOIL profile, other deviceType', item: { deviceType: 'MEDIDOR', deviceProfile: 'FANCOIL' }, legacy: null, delegated: 'climatizacao', move: true },
  // "CAG 01" (no dash) — A1 substring catches it; legacy exact-Set missed it.
  { name: 'MOVE CAG 01 by identifier substring', item: { deviceType: 'OTHER', deviceProfile: 'OTHER', identifier: 'CAG 01' }, legacy: null, delegated: 'climatizacao', move: true },
];

describe('RFC-0207 follow-up #3 — _getEnergyGroupKey migration snapshot', () => {
  it('legacy oracle produces the documented "before" buckets', () => {
    for (const row of TABLE) {
      expect(legacyEnergyGroupKey(row.item), row.name).toBe(row.legacy);
    }
  });

  it('delegated resolver produces the documented "after" buckets', () => {
    for (const row of TABLE) {
      expect(delegatedEnergyGroupKey(row.item), row.name).toBe(row.delegated);
    }
  });

  it('moves are exactly the reviewed set (no surprise moves)', () => {
    const actualMoves = TABLE.filter((r) => legacyEnergyGroupKey(r.item) !== delegatedEnergyGroupKey(r.item)).map(
      (r) => r.name,
    );
    const expectedMoves = TABLE.filter((r) => r.move).map((r) => r.name);
    expect(actualMoves.sort()).toEqual(expectedMoves.sort());
  });

  it('preserves the null contract for non-energy cards (always shown)', () => {
    const tempOrWater = TABLE.filter((r) => r.delegated === null);
    expect(tempOrWater.length).toBeGreaterThan(0);
    for (const row of tempOrWater) {
      expect(delegatedEnergyGroupKey(row.item), row.name).toBeNull();
    }
  });
});
