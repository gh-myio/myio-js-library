// tests/deviceClassificationProfile.profileContains.test.ts
//
// RFC-0207 — MIGRATION SNAPSHOT: `combinedContains` (texto combinado) →
// `profileContains` (substring sobre deviceProfile).
//
// Fecha DOIS achados da auditoria 2026-07-23 no mesmo lote:
//
//   Achado 3a — contrato de regra. `combinedContains` era avaliado pelo motor mas
//   NENHUM campo do editor o renderizava (o handler `cc` era código inalcançável).
//   Resolução escolhida: EXPOR — a regra foi renomeada para `profileContains` e
//   ganhou o campo "deviceProfile contém" no `openDeviceProfileModal`.
//
//   Achado 3b — laço circular do `labelWidget`. O texto combinado era
//   `labelWidget + deviceProfile + label`, e `labelWidget` é a SAÍDA ANTERIOR do
//   próprio classificador (`inferLabelWidget`). Um item carimbado "Climatização"
//   voltava a casar com o padrão `CLIMATIZA` e se auto-sustentava, qualquer que
//   fosse o `deviceProfile` — foi assim que a bomba hidráulica do Moxuara ficou
//   presa em climatização mesmo depois do fix do seed (14ad6257).
//
// A correção é BEHAVIOR-CHANGING (é o ponto). Este arquivo é a evidência: o
// oráculo abaixo é a semântica ANTIGA, byte a byte, e cada device que muda de
// balde está enumerado em EXPECTED_MOVES. CI falha se aparecer um move não
// revisado — ou se um move revisado sumir.

import { describe, it, expect } from 'vitest';
import {
  resolveCategory,
  normalizeProfile,
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  type DeviceClassificationProfile,
  type ClassifiableItem,
} from '../src/utils/devices/deviceClassificationProfile';

// ===========================================================================
// ORÁCULO — resolveCategory com a semântica ANTERIOR (texto combinado).
// Cópia fiel do corpo pré-migração, lendo os MESMOS valores do seed atual
// (que apenas trocaram de chave), de modo que a única variável seja o TEXTO
// sobre o qual os padrões são avaliados.
// ===========================================================================

const up = (v: unknown) => String(v ?? '').toUpperCase();

function legacyCombinedOf(item: ClassifiableItem): string {
  return `${up(item.labelWidget ?? '')} ${up(item.deviceProfile ?? '')} ${up(item.label ?? '')}`;
}

function legacyMatchesIdentifier(id: string, m: Record<string, string[] | undefined> | undefined) {
  if (!m) return false;
  for (const v of m.identifierEquals ?? []) if (id === up(v)) return true;
  for (const v of m.identifierContains ?? []) if (id.includes(up(v))) return true;
  for (const p of m.identifierPrefixes ?? []) if (id.startsWith(up(p))) return true;
  return false;
}

/** resolveCategory PRÉ-migração: pass 2 casava `combinedContains` sobre o texto combinado. */
function legacyResolveCategory(item: ClassifiableItem): string {
  const dom = DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy;
  const cats = dom.categories!;
  const dp = up(item.deviceProfile ?? '');
  if (dp === up(cats.storeDeviceProfile)) return 'lojas';

  for (const rule of cats.rules) {
    for (const c of rule.deviceProfiles) if (dp && dp === up(c)) return rule.name;
  }

  const combined = legacyCombinedOf(item);
  const id = up(item.identifier ?? '').trim();
  for (const rule of cats.rules) {
    // `profileContains` no seed atual carrega EXATAMENTE os valores que a chave
    // `combinedContains` carregava antes — só o alvo do match mudou.
    for (const pattern of rule.profileContains ?? []) {
      if (combined.includes(up(pattern))) return rule.name;
    }
    if (rule.conditional && rule.conditional.deviceProfiles.some((t) => dp === up(t))) {
      if (legacyMatchesIdentifier(id, rule.conditional as never)) return rule.name;
    }
    if (legacyMatchesIdentifier(id, rule.identifierFallback as never)) return rule.name;
  }
  return 'outros';
}

// ===========================================================================
// FIXTURE — cobre deviceProfile exato, substring de deviceProfile, identifier,
// e (crucialmente) os sinais de TEXTO que deixam de valer: labelWidget e label.
// ===========================================================================

interface Case {
  name: string;
  item: ClassifiableItem;
}

const FIXTURE: Case[] = [
  // ---- inalterados: deviceProfile exato (pass 1) ----
  { name: 'CHILLER exato', item: { deviceProfile: 'CHILLER', identifier: 'CH-1' } },
  { name: 'ELEVADOR exato', item: { deviceProfile: 'ELEVADOR', identifier: 'CAG' } },
  { name: 'ESCADA_ROLANTE exato', item: { deviceProfile: 'ESCADA_ROLANTE', identifier: 'X' } },
  { name: 'loja 3F_MEDIDOR', item: { deviceProfile: '3F_MEDIDOR', identifier: 'L-1' } },

  // ---- inalterados: substring de deviceProfile (o que sobrevive como profileContains) ----
  { name: 'CHILLER_SECUNDARIO (substring dp)', item: { deviceProfile: 'CHILLER_SECUNDARIO', identifier: 'X' } },
  { name: 'COMPRESSOR (substring dp)', item: { deviceProfile: 'COMPRESSOR', identifier: 'X' } },
  { name: 'VENTILADOR (substring dp)', item: { deviceProfile: 'VENTILADOR', identifier: 'X' } },
  { name: 'CLIMATIZACAO_GERAL (substring dp CLIMATIZA)', item: { deviceProfile: 'CLIMATIZACAO_GERAL', identifier: 'X' } },
  { name: 'ELEVADOR_SOCIAL (substring dp)', item: { deviceProfile: 'ELEVADOR_SOCIAL', identifier: 'X' } },
  { name: 'ESCADAS_ROLANTES (substring dp)', item: { deviceProfile: 'ESCADAS_ROLANTES', identifier: 'X' } },

  // ---- inalterados: identifier ----
  { name: 'identifier ELV-03', item: { deviceProfile: '', identifier: 'ELV-03' } },
  { name: 'identifier CAG puro', item: { deviceProfile: '', identifier: 'CAG' } },
  { name: 'BOMBA + CAG (conditional)', item: { deviceProfile: 'BOMBA', identifier: 'BOMBA CAG 2' } },
  { name: 'BOMBA + CHILLER- prefixo', item: { deviceProfile: 'BOMBA', identifier: 'CHILLER-1' } },

  // ---- inalterados: órfãos genuínos ----
  { name: 'GENERIC órfão', item: { deviceProfile: 'GENERIC', identifier: 'G-1', label: 'Quadro Geral' } },
  { name: 'MOTOR sem identifier útil', item: { deviceProfile: 'MOTOR', identifier: 'NADA' } },
  { name: 'BOMBA_INCENDIO', item: { deviceProfile: 'BOMBA_INCENDIO', identifier: 'BI-01' } },

  // ---- MOVES: o sinal era APENAS o label (nome livre) ----
  {
    name: 'MOVE label "Climatizador Central" → outros',
    item: { deviceProfile: 'BOMBA', identifier: 'X', label: 'Climatizador Central' },
  },
  {
    name: 'MOVE label "Escada de serviço" → outros',
    item: { deviceProfile: 'MOTOR', identifier: 'X', label: 'Escada de serviço' },
  },
  {
    name: 'MOVE label "Elevador de carga" → outros',
    item: { deviceProfile: 'MOTOR', identifier: 'X', label: 'Elevador de carga' },
  },

  // ---- MOVES: o LAÇO CIRCULAR (labelWidget = saída anterior do classificador) ----
  {
    // Caso exato observado em runtime no Moxuara (achado 3 da auditoria):
    //   combined = "CLIMATIZAÇÃO BOMBA_HIDRAULICA BOMBA HIDRÁULICA 5 L2"
    //              ^^^^^^^^^^^^ labelWidget do próprio item
    name: 'MOVE laço Moxuara: BOMBA_HIDRAULICA carimbada "Climatização" → outros',
    item: {
      deviceProfile: 'BOMBA_HIDRAULICA',
      identifier: 'BH-05',
      labelWidget: 'Climatização',
      label: 'Bomba Hidráulica 5 L2',
    },
  },
  {
    name: 'MOVE laço: profile órfão carimbado "Elevadores" → outros',
    item: { deviceProfile: 'GENERICO', identifier: 'G-9', labelWidget: 'Elevadores' },
  },
];

function keyOf(c: Case): string {
  return c.name;
}

// Snapshot revisado: TODO move é "categoria específica → outros", causado
// exclusivamente por um sinal de texto que o motor não tem mais o direito de ler
// (`label` = nome livre; `labelWidget` = saída anterior do classificador).
const EXPECTED_MOVES = [
  'MOVE label "Climatizador Central" → outros',
  'MOVE label "Escada de serviço" → outros',
  'MOVE label "Elevador de carga" → outros',
  'MOVE laço Moxuara: BOMBA_HIDRAULICA carimbada "Climatização" → outros',
  'MOVE laço: profile órfão carimbado "Elevadores" → outros',
];

describe('RFC-0207 — migração combinedContains → profileContains', () => {
  it('o oráculo legado reproduz a classificação por texto combinado', () => {
    // sanity do próprio oráculo: sem ele o snapshot abaixo não prova nada
    expect(legacyResolveCategory({ deviceProfile: 'BOMBA', identifier: 'X', label: 'Climatizador Central' })).toBe(
      'climatizacao',
    );
    expect(
      legacyResolveCategory({ deviceProfile: 'BOMBA_HIDRAULICA', identifier: 'BH-05', labelWidget: 'Climatização' }),
    ).toBe('climatizacao');
  });

  it('os moves são exatamente o conjunto revisado (nenhum move surpresa)', () => {
    const moves: string[] = [];
    for (const c of FIXTURE) {
      const before = legacyResolveCategory(c.item);
      const after = resolveCategory(c.item).category;
      if (before !== after) {
        // todo move é "categoria específica → outros"
        expect(after, `move ${keyOf(c)} deve ir para outros`).toBe('outros');
        expect(before, `move ${keyOf(c)} devia vir de uma categoria específica`).not.toBe('outros');
        moves.push(keyOf(c));
      }
    }
    expect(moves.sort()).toEqual([...EXPECTED_MOVES].sort());
  });

  it('nenhum device muda de balde quando o sinal é deviceProfile ou identifier', () => {
    for (const c of FIXTURE) {
      if (EXPECTED_MOVES.includes(c.name)) continue;
      expect(resolveCategory(c.item).category, c.name).toBe(legacyResolveCategory(c.item));
    }
  });

  // ------------------------------------------------------------------ laço
  it('LAÇO FECHADO: labelWidget não realimenta mais a classificação', () => {
    const base: ClassifiableItem = { deviceProfile: 'BOMBA_HIDRAULICA', identifier: 'BH-05' };
    const semCarimbo = resolveCategory(base).category;
    const comCarimbo = resolveCategory({ ...base, labelWidget: 'Climatização' }).category;
    const comCarimboErrado = resolveCategory({ ...base, labelWidget: 'Elevadores' }).category;
    // a classificação é IDÊNTICA com ou sem carimbo — não há mais realimentação
    expect(semCarimbo).toBe('outros');
    expect(comCarimbo).toBe(semCarimbo);
    expect(comCarimboErrado).toBe(semCarimbo);
  });

  it('LABEL não classifica: o nome livre do device é irrelevante', () => {
    const base: ClassifiableItem = { deviceProfile: 'MOTOR', identifier: 'M-1' };
    expect(resolveCategory(base).category).toBe('outros');
    for (const label of ['Chiller da praça', 'FANCOIL do piso 2', 'Escada Rolante Sul', 'Elevador Social']) {
      expect(resolveCategory({ ...base, label }).category, label).toBe('outros');
    }
  });

  // ------------------------------------------------- profileContains exposto
  it('profileContains casa substring de deviceProfile e reporta matchedBy', () => {
    expect(resolveCategory({ deviceProfile: 'CHILLER_SECUNDARIO', identifier: 'X' })).toEqual({
      category: 'climatizacao',
      matchedBy: 'profileContains',
    });
    expect(resolveCategory({ deviceProfile: 'ELEVADOR_SOCIAL', identifier: 'X' })).toEqual({
      category: 'elevadores',
      matchedBy: 'profileContains',
    });
  });

  it('deviceProfile vazio nunca casa profileContains (string vazia não é curinga)', () => {
    // `''.includes('CHILLER')` é false, mas `dp &&` protege contra padrões vazios
    // vindos de um perfil de customer mal preenchido.
    const profile = normalizeProfile(
      JSON.parse(JSON.stringify(DEFAULT_DEVICE_CLASSIFICATION_PROFILE)) as DeviceClassificationProfile,
    );
    profile.domains.energy.categories!.rules[2].profileContains = [''];
    expect(resolveCategory({ deviceProfile: '', identifier: 'NADA' }, profile).category).toBe('outros');
    expect(resolveCategory({ deviceProfile: 'GENERIC', identifier: 'NADA' }, profile).category).toBe(
      // padrão vazio casa qualquer profile não-vazio — é lixo do operador, mas é
      // determinístico e visível no editor (campo renderizado), não invisível.
      'climatizacao',
    );
  });

  // ------------------------------------------------- migração de chave (dados)
  it('normalizeProfile migra combinedContains → profileContains preservando valores', () => {
    const legacy = {
      schemaVersion: 1,
      domains: {
        energy: {
          groups: {
            ocultosProfilePatterns: ['ARQUIVADO'],
            rules: [
              { name: 'lojas', deviceProfiles: ['3F_MEDIDOR'] },
              { name: 'areacomum', deviceProfiles: [], fallback: true },
            ],
          },
          categories: {
            storeDeviceProfile: '3F_MEDIDOR',
            rules: [{ name: 'climatizacao', deviceProfiles: ['CHILLER'], combinedContains: ['hvac', 'CLIMATIZA'] }],
            fallback: { name: 'outros' },
          },
        },
      },
    } as unknown as DeviceClassificationProfile;

    const norm = normalizeProfile(legacy);
    const rule = norm.domains.energy.categories!.rules[0];
    expect(rule.profileContains).toEqual(['HVAC', 'CLIMATIZA']);
    expect(rule.combinedContains).toBeUndefined();
    // e o motor passa a avaliar esses valores sobre o deviceProfile
    expect(resolveCategory({ deviceProfile: 'HVAC_ROOFTOP', identifier: 'X' }, norm).category).toBe('climatizacao');
  });

  it('normalizeProfile deduplica quando as duas chaves coexistem', () => {
    const both = {
      schemaVersion: 1,
      domains: {
        energy: {
          groups: {
            ocultosProfilePatterns: [],
            rules: [{ name: 'areacomum', deviceProfiles: [], fallback: true }],
          },
          categories: {
            storeDeviceProfile: '3F_MEDIDOR',
            rules: [
              {
                name: 'climatizacao',
                deviceProfiles: [],
                profileContains: ['CHILLER'],
                combinedContains: ['chiller', 'FANCOIL'],
              },
            ],
            fallback: { name: 'outros' },
          },
        },
      },
    } as unknown as DeviceClassificationProfile;
    const rule = normalizeProfile(both).domains.energy.categories!.rules[0];
    expect(rule.profileContains).toEqual(['CHILLER', 'FANCOIL']);
  });
});
