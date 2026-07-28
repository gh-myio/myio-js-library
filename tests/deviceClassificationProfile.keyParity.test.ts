// tests/deviceClassificationProfile.keyParity.test.ts
//
// RFC-0207 §F — golden **key-parity**: `keys(engine) === keys(baked)`.
//
// A costura do v3 é o `key` do nó (== `entity_key` no GCDR). Se o motor produz
// uma chave que o artefato baked não conhece — ou o contrário — a classificação
// e o store falam idiomas diferentes e o sintoma aparece só em produção, mudo.
//
// HERMÉTICO POR CONSTRUÇÃO (§B.1-3 / §G): a paridade é reconciliada por ARQUIVO
// COMMITADO (`bakedProfile.generated.ts`), nunca por rede. Quando o GCDR entrar
// (v3.2), o mesmo manifesto passa a ser confrontado com a lista `is_system`
// publicada — também por arquivo commitado.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveGroup,
  resolveCategory,
  type ClassificationDomain,
} from '../src/utils/devices/deviceClassificationProfile';
import {
  BAKED_PROFILE_KEYS,
  BAKED_PROFILE_VERSION,
} from '../src/utils/devices/bakedProfile.generated';
import { createBakedProfileSource } from '../src/utils/devices/profileSource';

/**
 * Chaves que o MOTOR é capaz de produzir, derivadas do seed que ele executa.
 * Deliberadamente calculada aqui de forma independente do gerador — se as duas
 * derivações concordarem, o artefato reflete o motor.
 */
function engineKeys(): string[] {
  const out: string[] = [];
  const profile = DEFAULT_DEVICE_CLASSIFICATION_PROFILE;
  for (const domain of Object.keys(profile.domains).sort()) {
    const dom = profile.domains[domain as ClassificationDomain];
    if (!dom) continue;
    out.push(domain);
    out.push(`${domain}.groups.ocultos`); // grupo implícito (ocultosProfilePatterns)
    for (const r of dom.groups.rules) out.push(`${domain}.groups.${r.name}`);
    if (dom.categories) {
      out.push(`${domain}.categories.lojas`); // atalho de loja (storeDeviceProfile)
      for (const r of dom.categories.rules) out.push(`${domain}.categories.${r.name}`);
      out.push(`${domain}.categories.${dom.categories.fallback.name}`);
    }
  }
  return [...new Set(out)].sort();
}

describe('RFC-0207 §F — golden key-parity (engine × baked)', () => {
  it('keys(engine) === keys(baked)', () => {
    expect(engineKeys()).toEqual([...BAKED_PROFILE_KEYS]);
  });

  it('toda chave de grupo que o motor pode RETORNAR está no manifesto', () => {
    // Confronto por comportamento, não por leitura do seed: dispara o resolver
    // com entradas que provocam cada bucket e confere a chave resultante.
    const probes: { domain: ClassificationDomain; item: Record<string, string> }[] = [
      { domain: 'energy', item: { deviceProfile: '3F_MEDIDOR' } },
      { domain: 'energy', item: { deviceProfile: 'TRAFO' } },
      { domain: 'energy', item: { deviceProfile: 'QUALQUER' } }, // fallback
      { domain: 'energy', item: { deviceProfile: 'CHILLER_ARQUIVADO' } }, // ocultos
      { domain: 'water', item: { deviceProfile: 'HIDROMETRO_SHOPPING' } },
      { domain: 'water', item: { deviceProfile: 'HIDROMETRO' } },
      { domain: 'water', item: { deviceProfile: 'TANK' } },
      { domain: 'water', item: { deviceProfile: 'QUALQUER' } },
      { domain: 'temperature', item: { deviceProfile: 'TERMOSTATO_EXTERNAL' } },
      { domain: 'temperature', item: { deviceProfile: 'TERMOSTATO' } },
    ];
    for (const p of probes) {
      const key = `${p.domain}.groups.${resolveGroup(p.item, undefined, p.domain).group}`;
      expect(BAKED_PROFILE_KEYS, `${key} ausente no manifesto`).toContain(key);
    }
  });

  it('toda chave de categoria que o motor pode RETORNAR está no manifesto', () => {
    const probes = [
      { deviceProfile: '3F_MEDIDOR' }, // lojas
      { deviceProfile: 'CHILLER' }, // climatizacao
      { deviceProfile: 'ELEVADOR' }, // elevadores
      { deviceProfile: 'ESCADA_ROLANTE' }, // escadas_rolantes
      { deviceProfile: 'GENERICO', identifier: 'NADA' }, // outros (fallback)
    ];
    for (const item of probes) {
      const key = `energy.categories.${resolveCategory(item).category}`;
      expect(BAKED_PROFILE_KEYS, `${key} ausente no manifesto`).toContain(key);
    }
  });

  it('o baked é versionado e serve o seed do motor', async () => {
    expect(BAKED_PROFILE_VERSION).toMatch(/^[0-9a-f]{12}$/);
    const resolved = await createBakedProfileSource().resolve('any-customer');
    expect(resolved.version).toBe(BAKED_PROFILE_VERSION);
    expect(resolved.source).toBe('baked');
    // §v3.2-F.4 — baked é sempre sinalizado como DEGRADADO, nunca como verdade
    expect(resolved.degraded).toBe(true);
    expect(resolved.profile).toBe(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
  });

  it('não há chave órfã no manifesto (nenhum nó fantasma)', () => {
    const engine = new Set(engineKeys());
    for (const k of BAKED_PROFILE_KEYS) {
      expect(engine.has(k), `chave "${k}" existe no baked mas o motor não a produz`).toBe(true);
    }
  });
});
