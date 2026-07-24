// tests/deviceClassificationProfile.profileSource.test.ts
//
// RFC-0207 §B.1-4 — degradação **especificada E testada** (fault injection).
//
// "Cadeia: cache válido (304) → resolve() 200 → em throw de resolve()
//  (timeout/5xx/CORS/JSON inválido/validação) **cai no BakedProfileSource**;
//  nunca lança para o render, nunca apaga o dashboard."
//
// Sem estes testes a degradação é prosa. Cada modo de falha abaixo é injetado.

import { describe, it, expect, vi } from 'vitest';
import {
  createBakedProfileSource,
  resolveWithFallback,
  isBakedStale,
  type ProfileSource,
  type ResolvedProfile,
} from '../src/utils/devices/profileSource';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveCategory,
  type DeviceClassificationProfile,
} from '../src/utils/devices/deviceClassificationProfile';
import { BAKED_PROFILE_VERSION } from '../src/utils/devices/bakedProfile.generated';

const silentLogger = { warn: () => {} };

function sourceThatThrows(name: string, err: unknown): ProfileSource {
  return {
    name,
    resolve: async () => {
      throw err;
    },
  };
}

function sourceThatReturns(name: string, r: Partial<ResolvedProfile>): ProfileSource {
  return {
    name,
    resolve: async () =>
      ({
        version: 'v1',
        source: 'customer',
        degraded: false,
        profile: DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
        ...r,
      }) as ResolvedProfile,
  };
}

/** Perfil de customer válido, com uma regra própria, para o caminho feliz. */
function customerProfile(): DeviceClassificationProfile {
  const p = JSON.parse(JSON.stringify(DEFAULT_DEVICE_CLASSIFICATION_PROFILE)) as DeviceClassificationProfile;
  p.domains.energy.categories!.rules[2].deviceProfiles.push('BOMBA_CAG');
  return p;
}

describe('RFC-0207 §B.1-4 — cadeia de degradação do ProfileSource', () => {
  it('caminho feliz: usa o perfil da fonte primária, normalizado, sem degradar', async () => {
    const src = sourceThatReturns('primary', { profile: customerProfile(), version: 'etag-42' });
    const out = await resolveWithFallback(src, { customerId: 'c1', logger: silentLogger });
    expect(out.source).toBe('customer');
    expect(out.version).toBe('etag-42');
    expect(out.degraded).toBe(false);
    // a regra do customer está de fato ativa no perfil devolvido
    expect(resolveCategory({ deviceProfile: 'BOMBA_CAG', identifier: 'X' }, out.profile).category).toBe(
      'climatizacao',
    );
  });

  // ---------------------------------------------------------------- injeções
  it.each([
    ['timeout', new Error('network timeout')],
    ['5xx', new Error('HTTP 500: Internal Server Error')],
    ['CORS', new TypeError('Failed to fetch')],
    ['JSON inválido', new SyntaxError('Unexpected token < in JSON at position 0')],
  ])('resolve() falha (%s) → cai no baked e NÃO lança', async (_label, err) => {
    const out = await resolveWithFallback(sourceThatThrows('gcdr-resolve', err), {
      customerId: 'c1',
      logger: silentLogger,
    });
    expect(out.source).toBe('baked');
    expect(out.degraded).toBe(true);
    expect(out.profile).toBe(DEFAULT_DEVICE_CLASSIFICATION_PROFILE);
    expect(out.reason).toContain('gcdr-resolve');
  });

  it('perfil inválido (schema quebrado) → cai no baked, nunca aplica lixo', async () => {
    const broken = { schemaVersion: 1, domains: {} } as unknown as DeviceClassificationProfile;
    const out = await resolveWithFallback(sourceThatReturns('tb-attribute', { profile: broken }), {
      customerId: 'c1',
      logger: silentLogger,
    });
    expect(out.source).toBe('baked');
    expect(out.reason).toContain('invalid-profile');
  });

  it('resposta vazia → cai no baked', async () => {
    const out = await resolveWithFallback(sourceThatReturns('tb-attribute', { profile: undefined as never }), {
      customerId: 'c1',
      logger: silentLogger,
    });
    expect(out.source).toBe('baked');
    expect(out.reason).toContain('empty-response');
  });

  it('resolve() pendurado além do timeout → cai no baked (o dashboard não trava)', async () => {
    const hung: ProfileSource = { name: 'hung', resolve: () => new Promise<ResolvedProfile>(() => {}) };
    const out = await resolveWithFallback(hung, {
      customerId: 'c1',
      logger: silentLogger,
      timeoutMs: 25,
    });
    expect(out.source).toBe('baked');
    expect(out.reason).toMatch(/timeout/i);
  });

  // ---------------------------------------------------------------- logging
  it('a degradação é logada estruturada e espelhada em onDegraded (telemetria)', async () => {
    const warn = vi.fn();
    const onDegraded = vi.fn();
    await resolveWithFallback(sourceThatThrows('gcdr-resolve', new Error('boom')), {
      customerId: 'cust-77',
      logger: { warn },
      onDegraded,
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('degraded');
    expect(onDegraded).toHaveBeenCalledWith({
      source: 'baked',
      reason: expect.stringContaining('gcdr-resolve'),
      customerId: 'cust-77',
      bakedVersion: BAKED_PROFILE_VERSION,
    });
  });

  it('um onDegraded que explode NÃO derruba a resolução (telemetria não é crítica)', async () => {
    const out = await resolveWithFallback(sourceThatThrows('x', new Error('boom')), {
      customerId: 'c1',
      logger: silentLogger,
      onDegraded: () => {
        throw new Error('telemetry down');
      },
    });
    expect(out.source).toBe('baked');
  });

  // ------------------------------------------------------------ baked estanque
  it('isBakedStale detecta bundle atrasado em relação à version autorada', () => {
    const baked = {
      version: BAKED_PROFILE_VERSION,
      source: 'baked',
      profile: DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
      degraded: true,
    } as ResolvedProfile;
    expect(isBakedStale(baked, 'outra-version')).toBe(true);
    expect(isBakedStale(baked, BAKED_PROFILE_VERSION)).toBe(false);
    expect(isBakedStale(baked, null)).toBe(false); // sem referência ⇒ não afirma nada
  });

  it('o BakedProfileSource nunca lança e sempre entrega um perfil utilizável', async () => {
    const out = await createBakedProfileSource().resolve('qualquer-customer');
    expect(out.profile.domains.energy).toBeDefined();
    expect(resolveCategory({ deviceProfile: 'CHILLER' }, out.profile).category).toBe('climatizacao');
  });
});
