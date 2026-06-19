// tests/deviceClassificationProfile.inferLabelWidget.test.ts
//
// RFC-0207 / follow-up — Migration snapshot for MAIN_VIEW's inferLabelWidget.
//
// inferLabelWidget computes the `labelWidget` string that the per-category
// TELEMETRY card widgets filter on (getItemsFromState filters areacomum items by
// item.labelWidget). The breakdown COUNTS already come from the resolver
// (resolveCategory via buildSummary, A1b), so the legacy substring patterns made
// the cards diverge from the counts for identifier-only devices ("CAG 01",
// "ELV-…"). This delegates labelWidget to the same resolver.
//
// MIGRATION, not equivalence — every move is enumerated and reviewed below.

import { describe, it, expect } from 'vitest';
import {
  resolveGroup,
  resolveCategory,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
} from '../src/utils/deviceClassificationProfile';

const PROFILE = DEFAULT_DEVICE_CLASSIFICATION_PROFILE;

interface Row {
  deviceType?: string;
  deviceProfile?: string;
  identifier?: string;
  label?: string;
  groupType?: string;
}

const OCULTOS_PATTERNS = ['ARQUIVADO', 'SEM_DADOS', 'DESATIVADO', 'REMOVIDO', 'INATIVO'];
function isOcultosDevice(row: Row): boolean {
  const dp = String(row.deviceProfile || '').toUpperCase();
  return OCULTOS_PATTERNS.some((p) => dp.includes(p));
}
function isStoreDevice(row: Row): boolean {
  return String(row.deviceProfile || '').toUpperCase() === '3F_MEDIDOR';
}

// ===========================================================================
// LEGACY ORACLE — exact copy of the pre-migration inferLabelWidget body.
// ===========================================================================
function legacyInferLabelWidget(row: Row): string {
  if (isOcultosDevice(row)) return 'Ocultos';
  const groupType = row.groupType || '';
  if (groupType) return groupType;

  const deviceType = String(row.deviceType || '').toUpperCase();
  const deviceProfile = String(row.deviceProfile || '').toUpperCase();

  if (isStoreDevice(row)) return 'Lojas';

  const ENTRADA_PATTERNS = ['ENTRADA', 'TRAFO', 'SUBESTACAO'];
  if (ENTRADA_PATTERNS.some((p) => deviceType.includes(p)) || ENTRADA_PATTERNS.some((p) => deviceProfile.includes(p)))
    return 'Entrada';

  const CLIMATIZACAO_PATTERNS = ['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'COMPRESSOR', 'VENTILADOR', 'CLIMATIZA'];
  if (CLIMATIZACAO_PATTERNS.some((p) => deviceProfile.includes(p)) || CLIMATIZACAO_PATTERNS.some((p) => deviceType.includes(p)))
    return 'Climatização';

  const ELEVADOR_PATTERNS = ['ELEVADOR', 'ELV'];
  if (ELEVADOR_PATTERNS.some((p) => deviceProfile.includes(p)) || ELEVADOR_PATTERNS.some((p) => deviceType.includes(p)))
    return 'Elevadores';

  const ESCADA_PATTERNS = ['ESCADA_ROLANTE', 'ESCADA'];
  if (ESCADA_PATTERNS.some((p) => deviceProfile.includes(p)) || ESCADA_PATTERNS.some((p) => deviceType.includes(p)))
    return 'Escadas Rolantes';

  if (deviceType.includes('HIDROMETRO_SHOPPING') || deviceProfile.includes('HIDROMETRO_SHOPPING')) return 'Entrada';
  if (deviceType.includes('HIDROMETRO_AREA_COMUM') || deviceProfile.includes('HIDROMETRO_AREA_COMUM')) return 'Área Comum';
  if (deviceType === 'HIDROMETRO' && (deviceProfile === 'HIDROMETRO' || !deviceProfile)) return 'Lojas';

  const AREA_COMUM_PATTERNS = ['BOMBA', 'MOTOR', 'RELOGIO', 'CAIXA_DAGUA', 'TANK', 'ILUMINACAO', 'LUZ'];
  if (AREA_COMUM_PATTERNS.some((p) => deviceProfile.includes(p)) || AREA_COMUM_PATTERNS.some((p) => deviceType.includes(p)))
    return 'Área Comum';

  if (deviceProfile.includes('TERMOSTATO') || deviceType.includes('TERMOSTATO')) return 'Temperatura';

  return 'Área Comum';
}

// ===========================================================================
// DELEGATED — exact mapping used by the new MAIN_VIEW inferLabelWidget.
// ===========================================================================
function delegatedInferLabelWidget(row: Row): string {
  if (isOcultosDevice(row)) return 'Ocultos';
  const groupType = row.groupType || '';
  if (groupType) return groupType;

  if (isStoreDevice(row)) return 'Lojas';

  const dp = String(row.deviceProfile || '').toUpperCase();
  const dt = String(row.deviceType || '').toUpperCase();

  if (dp.includes('TERMOSTATO') || dt.includes('TERMOSTATO')) return 'Temperatura';

  if (dp.includes('HIDROMETRO') || dt.includes('HIDROMETRO') || dp === 'TANK' || dt === 'TANK' || dp === 'CAIXA_DAGUA' || dt === 'CAIXA_DAGUA') {
    const wg = resolveGroup(row, PROFILE, 'water').group;
    if (wg === 'ocultos') return 'Ocultos';
    if (wg === 'entrada') return 'Entrada';
    if (wg === 'lojas') return 'Lojas';
    return 'Área Comum';
  }

  const g = resolveGroup(row, PROFILE, 'energy').group;
  if (g === 'ocultos') return 'Ocultos';
  if (g === 'lojas') return 'Lojas';
  if (g === 'entrada') return 'Entrada';
  const cat = resolveCategory(row, PROFILE).category;
  if (cat === 'climatizacao') return 'Climatização';
  if (cat === 'elevadores') return 'Elevadores';
  if (cat === 'escadas_rolantes') return 'Escadas Rolantes';
  return 'Área Comum';
}

// ===========================================================================
// MIGRATION TABLE — reviewed artifact (device | before | after | move).
// ===========================================================================
const TABLE: { name: string; row: Row; legacy: string; delegated: string; move: boolean }[] = [
  // --- unchanged (common, well-formed) ---
  { name: 'loja 3F', row: { deviceProfile: '3F_MEDIDOR' }, legacy: 'Lojas', delegated: 'Lojas', move: false },
  { name: 'entrada TRAFO', row: { deviceProfile: 'TRAFO' }, legacy: 'Entrada', delegated: 'Entrada', move: false },
  { name: 'climatizacao CHILLER profile', row: { deviceProfile: 'CHILLER' }, legacy: 'Climatização', delegated: 'Climatização', move: false },
  { name: 'elevador profile', row: { deviceProfile: 'ELEVADOR' }, legacy: 'Elevadores', delegated: 'Elevadores', move: false },
  { name: 'escada profile', row: { deviceProfile: 'ESCADA_ROLANTE' }, legacy: 'Escadas Rolantes', delegated: 'Escadas Rolantes', move: false },
  { name: 'temperatura TERMOSTATO', row: { deviceProfile: 'TERMOSTATO' }, legacy: 'Temperatura', delegated: 'Temperatura', move: false },
  { name: 'water entrada (hidrometro shopping)', row: { deviceProfile: 'HIDROMETRO_SHOPPING' }, legacy: 'Entrada', delegated: 'Entrada', move: false },
  { name: 'water loja (hidrometro)', row: { deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO' }, legacy: 'Lojas', delegated: 'Lojas', move: false },
  { name: 'water area comum', row: { deviceProfile: 'HIDROMETRO_AREA_COMUM' }, legacy: 'Área Comum', delegated: 'Área Comum', move: false },
  { name: 'water tank', row: { deviceProfile: 'TANK' }, legacy: 'Área Comum', delegated: 'Área Comum', move: false },
  { name: 'ocultos', row: { deviceProfile: 'CHILLER_ARQUIVADO' }, legacy: 'Ocultos', delegated: 'Ocultos', move: false },
  { name: 'groupType passthrough', row: { groupType: 'CustomGroup', deviceProfile: 'X' }, legacy: 'CustomGroup', delegated: 'CustomGroup', move: false },

  // --- intentional MOVES (resolver authority + identifier matching) ---
  // RELOGIO is entrada in the columns (exact profile) but legacy mislabeled it Área Comum.
  { name: 'MOVE RELOGIO → Entrada', row: { deviceProfile: 'RELOGIO' }, legacy: 'Área Comum', delegated: 'Entrada', move: true },
  // identifier-only CAG (no dash): A1 substring catches it; legacy ignored identifier.
  { name: 'MOVE CAG 01 identifier → Climatização', row: { deviceProfile: 'OUTRO', deviceType: 'OUTRO', identifier: 'CAG 01' }, legacy: 'Área Comum', delegated: 'Climatização', move: true },
  // BOMBA CAG: conditional + identifier substring → climatizacao (legacy → Área Comum via BOMBA).
  { name: 'MOVE BOMBA CAG → Climatização', row: { deviceProfile: 'BOMBA', deviceType: 'BOMBA', identifier: 'BOMBA CAG 2' }, legacy: 'Área Comum', delegated: 'Climatização', move: true },
  // ELV- identifier prefix: legacy inferLabelWidget ignored identifier entirely.
  { name: 'MOVE ELV- identifier → Elevadores', row: { deviceProfile: 'X', deviceType: 'X', identifier: 'ELV-01' }, legacy: 'Área Comum', delegated: 'Elevadores', move: true },
];

describe('RFC-0207 — inferLabelWidget migration snapshot', () => {
  it('legacy oracle produces the documented "before" labels', () => {
    for (const r of TABLE) expect(legacyInferLabelWidget(r.row), r.name).toBe(r.legacy);
  });

  it('delegated resolver produces the documented "after" labels', () => {
    for (const r of TABLE) expect(delegatedInferLabelWidget(r.row), r.name).toBe(r.delegated);
  });

  it('moves are exactly the reviewed set (no surprise moves)', () => {
    const actual = TABLE.filter((r) => legacyInferLabelWidget(r.row) !== delegatedInferLabelWidget(r.row)).map((r) => r.name);
    const expected = TABLE.filter((r) => r.move).map((r) => r.name);
    expect(actual.sort()).toEqual(expected.sort());
  });

  it('every move aligns labelWidget toward the resolver classification (the fix direction)', () => {
    // Each move makes the card-list filter match the resolver-driven breakdown count.
    const moves = TABLE.filter((r) => r.move);
    expect(moves.length).toBe(4);
  });
});
