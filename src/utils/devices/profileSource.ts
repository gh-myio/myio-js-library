// src/utils/devices/profileSource.ts
//
// RFC-0207 v3.1 — Engine × store seam.
//
// A tese central do v3 é separar o MOTOR (como as regras avaliam — código
// golden-locked) da ÁRVORE (quais nós existem e quais valores casam — dado
// autorado). Este módulo é a costura: um `ProfileSource` entrega o dado; o motor
// (`resolveGroup`/`resolveCategory`) não sabe nem se importa de onde ele veio.
//
// LIMITE PURO × I/O (RFC-0207 §B/§D — TRAVADO):
//   - A LIB é dona da INTERFACE `ProfileSource`, do `BakedProfileSource` (piso
//     offline, derivado do seed in-code) e da cadeia de degradação. **A lib NUNCA
//     faz `fetch` e NUNCA escreve no ThingsBoard.**
//   - O MAIN_VIEW é dono das fontes CONCRETAS de I/O (`TbAttributeProfileSource`,
//     `GcdrResolveProfileSource`). Trocar TB→GCDR é trocar a fonte primária —
//     o consumidor é idêntico.
//
// Este arquivo não importa nada além do próprio módulo de perfil.

import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  validateProfile,
  normalizeProfile,
  type DeviceClassificationProfile,
  type ProfileLogger,
} from './deviceClassificationProfile';
import { BAKED_PROFILE_VERSION } from './bakedProfile.generated';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** De onde o perfil efetivo veio. `baked` = piso offline (estado DEGRADADO). */
export type ProfileSourceKind = 'customer' | 'system' | 'baked';

export interface ResolvedProfile {
  /** Etag/versão da árvore resolvida para este customer. */
  version: string;
  source: ProfileSourceKind;
  /** O documento de classificação (schemaVersion 1) que o motor consome. */
  profile: DeviceClassificationProfile;
  /**
   * True quando o perfil NÃO é a verdade autorada e sim o piso embutido
   * (RFC-0207 §v3.2-F.4: "offline (baked) sempre sinalizado como degradado,
   * nunca apresentado como verdade").
   */
  degraded: boolean;
  /** Motivo da degradação, quando `degraded` (timeout/5xx/parse/validate/absent). */
  reason?: string;
}

/**
 * Store trocável. Uma implementação pode fazer I/O (MAIN_VIEW) ou não
 * (`BakedProfileSource`). `resolve` PODE lançar — a cadeia de degradação
 * (`resolveWithFallback`) é quem trata.
 */
export interface ProfileSource {
  /** Nome curto para log/telemetria (ex.: 'tb-attribute', 'gcdr-resolve', 'baked'). */
  readonly name: string;
  resolve(customerId: string): Promise<ResolvedProfile>;
}

// ---------------------------------------------------------------------------
// BakedProfileSource — piso offline, versionado, derivado do seed in-code
// ---------------------------------------------------------------------------

/**
 * RFC-0207 §B.1-3: "gerado em build-time a partir do seed in-code (artefato
 * derivado, nunca editado à mão → **nunca uma 5ª cópia**); carrega sua version."
 *
 * A leitura literal de "nunca uma 5ª cópia" manda NÃO duplicar a árvore no
 * bundle. O artefato gerado (`bakedProfile.generated.ts`, escrito por
 * `scripts/gen-baked-profile.mjs`) carrega portanto a **version** (hash do
 * conteúdo do seed) e o **manifesto de chaves** — que é o que o golden de
 * key-parity precisa —, e o `BakedProfileSource` serve o próprio seed sob essa
 * version. Efeito: o baked é versionado, detecta "baked estanque" e custa ~0 KB
 * de bundle além do seed que já existe.
 */
export function createBakedProfileSource(): ProfileSource {
  return {
    name: 'baked',
    async resolve(): Promise<ResolvedProfile> {
      return {
        version: BAKED_PROFILE_VERSION,
        source: 'baked',
        profile: DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
        degraded: true,
        reason: 'baked-default',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Degradação — especificada E testável (RFC-0207 §B.1-4)
// ---------------------------------------------------------------------------

export interface ResolveWithFallbackOptions {
  customerId: string;
  /** Piso. Default: `createBakedProfileSource()`. */
  baked?: ProfileSource;
  logger?: ProfileLogger;
  /** Timeout do source primário, em ms. 0/omitido = sem timeout. */
  timeoutMs?: number;
  /** Chamado quando a resolução degradou para o baked (telemetria). */
  onDegraded?: (info: { source: string; reason: string; customerId: string; bakedVersion: string }) => void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (!ms || ms <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`profile source timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Cadeia de degradação do RFC-0207 §B.1-4:
 *
 *   `primary.resolve()` OK e válido → usa
 *   `primary.resolve()` lança (timeout / 5xx / CORS / JSON inválido) → **baked**
 *   `primary.resolve()` devolve um perfil que não passa em `validateProfile` → **baked**
 *
 * **Nunca lança para o render, nunca apaga o dashboard.** Loga estruturado e
 * espelha em `onDegraded` para telemetria.
 */
export async function resolveWithFallback(
  primary: ProfileSource,
  opts: ResolveWithFallbackOptions,
): Promise<ResolvedProfile> {
  const baked = opts.baked ?? createBakedProfileSource();
  const logger = opts.logger ?? console;
  const degrade = async (reason: string): Promise<ResolvedProfile> => {
    const floor = await baked.resolve(opts.customerId);
    const info = {
      source: 'baked',
      reason,
      customerId: opts.customerId,
      bakedVersion: floor.version,
    };
    logger.warn(`[RFC-0207] profile degraded → baked ${JSON.stringify(info)}`);
    try {
      opts.onDegraded?.(info);
    } catch {
      /* telemetria nunca derruba o render */
    }
    return { ...floor, degraded: true, reason };
  };

  let resolved: ResolvedProfile;
  try {
    resolved = await withTimeout(primary.resolve(opts.customerId), opts.timeoutMs ?? 0);
  } catch (err) {
    return degrade(`${primary.name}:${(err as Error)?.message || 'resolve threw'}`);
  }

  if (!resolved || !resolved.profile) {
    return degrade(`${primary.name}:empty-response`);
  }

  const errors = validateProfile(resolved.profile);
  if (errors.length > 0) {
    return degrade(`${primary.name}:invalid-profile:${errors.slice(0, 3).join('; ')}`);
  }

  return {
    ...resolved,
    profile: normalizeProfile(resolved.profile),
    degraded: resolved.degraded ?? false,
  };
}

/**
 * True quando o baked embutido não corresponde à version que a fonte autorada
 * declara — sinal de "baked estanque" (o bundle publicado ficou para trás).
 */
export function isBakedStale(resolved: ResolvedProfile, authoredVersion?: string | null): boolean {
  if (!authoredVersion) return false;
  return resolved.source === 'baked' && resolved.version !== authoredVersion;
}
