// src/utils/deviceClassificationProfile.ts
//
// RFC-0207 / PR A0 — Pure, data-driven device classification profile.
//
// Behavior-preserving extraction of the v-5.2.0 shopping ENERGY classifier
// (MAIN_VIEW/controller.js). The DEFAULT seed reproduces the legacy hard-coded
// behavior EXACTLY, bugs included:
//   - BUG #1 (CAG exact match): conditional climatizacao identifier matching uses
//     EXACT equality (Set.has semantics) via `identifierEquals`. A1 will flip the
//     seed `identifierEquals` -> `identifierContains`; the resolver already
//     supports both. Do NOT "fix" the seed in A0.
//   - BUG #3 (silent []): closed by `validateProfile` flagging a category missing
//     its `deviceProfiles` key.
//
// Pure module: no DOM, no window, no side effects (except an optional once-warn).

// ---------------------------------------------------------------------------
// Domain item shape (structural; only fields the legacy classifier reads)
// ---------------------------------------------------------------------------

export interface ClassifiableItem {
  deviceProfile?: string | null;
  identifier?: string | null;
  /** Free-text fields used by the breakdown's combined-substring matching (RFC-0207 A1b). */
  labelWidget?: string | null;
  /** @deprecated EM DESUSO (2026-07-14) — nunca é lido; classificação usa só deviceProfile/identifier. */
  deviceType?: string | null;
  label?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type GroupName =
  // energy
  | 'lojas'
  | 'entrada'
  | 'areacomum'
  | 'ocultos'
  // water (RFC-0207 follow-up #2)
  | 'banheiros'
  | 'caixadagua'
  // temperature (RFC-0207 follow-up #2)
  | 'climatizavel'
  | 'nao_climatizavel';
export type GroupMatchedBy = 'ocultos' | 'deviceProfile' | 'fallback';

export interface GroupResolution {
  group: GroupName;
  matchedBy: GroupMatchedBy;
}

export type CategoryName =
  | 'lojas'
  | 'climatizacao'
  | 'elevadores'
  | 'escadas_rolantes'
  | 'outros';
export type CategoryMatchedBy =
  | 'deviceProfile'
  | 'combined'
  | 'identifier'
  | 'conditional'
  | 'fallback';

export interface CategoryResolution {
  category: CategoryName;
  matchedBy: CategoryMatchedBy;
}

export type ClassificationDomain = 'energy' | 'water' | 'temperature';

// ---------------------------------------------------------------------------
// Profile schema
// ---------------------------------------------------------------------------

/** Identifier matcher used by conditional rules and identifier fallbacks. */
export interface IdentifierMatch {
  /** Exact (Set.has) match after trim+upper. The A0 default uses this. */
  identifierEquals?: string[];
  /** Substring (.includes) match after trim+upper. A1 flips equals->contains. */
  identifierContains?: string[];
  /** startsWith match after trim+upper. */
  identifierPrefixes?: string[];
}

/** Conditional rule: when deviceProfile is one of these, require an identifier hit. */
export interface ConditionalRule extends IdentifierMatch {
  /** Perfis (deviceProfile) que exigem hit de identifier. */
  deviceProfiles: string[];
  /** @deprecated Nome legado do campo (sempre comparou contra o deviceProfile) — normalizado para deviceProfiles. */
  deviceTypes?: string[];
}

/** A single (non-fallback) category rule. */
export interface CategoryRule {
  name: Exclude<CategoryName, 'lojas'>; // lojas is handled by the store shortcut
  /** Exact deviceProfile matches (the legacy "deviceTypes" Set). */
  deviceProfiles: string[];
  /**
   * Substring patterns over the COMBINED text (labelWidget + deviceProfile +
   * label — deviceType em desuso, removido 2026-07-14), mirroring
   * buildSummary's loose matching (A1b). This is what unifies the breakdown
   * subcategorization into one source.
   */
  combinedContains?: string[];
  /** climatizacao-only conditional ({BOMBA,MOTOR} + identifier hit). */
  conditional?: ConditionalRule;
  /** Identifier-fallback hit list, mirroring classifyDeviceByIdentifier. */
  identifierFallback?: IdentifierMatch;
  fallback?: boolean;
}

export interface CategoriesConfig {
  /** Exact deviceProfile that short-circuits to 'lojas' (3F_MEDIDOR). */
  storeDeviceProfile: string;
  rules: CategoryRule[];
  /** Exactly one fallback rule (the 'outros' bucket). */
  fallback: { name: 'outros' };
}

export interface GroupRule {
  name: Exclude<GroupName, 'ocultos'>;
  /** Exact deviceProfile matches. Empty for the fallback bucket. */
  deviceProfiles: string[];
  fallback?: boolean;
}

export interface GroupsConfig {
  /** Substring patterns over deviceProfile -> ocultos (highest priority). */
  ocultosProfilePatterns: string[];
  rules: GroupRule[];
}

export interface DomainProfile {
  caseInsensitive?: boolean;
  groups: GroupsConfig;
  /**
   * Breakdown subcategorization. Only the `energy` domain has a breakdown
   * (TELEMETRY_INFO). Water/temperature classify by groups only, so this is
   * optional (RFC-0207 follow-up #2).
   */
  categories?: CategoriesConfig;
}

export interface DeviceClassificationProfile {
  schemaVersion: number;
  domains: {
    energy: DomainProfile;
    /** RFC-0207 follow-up #2 — optional; resolver falls back to DEFAULT when absent. */
    water?: DomainProfile;
    /** RFC-0207 follow-up #2 — optional; resolver falls back to DEFAULT when absent. */
    temperature?: DomainProfile;
  };
}

// ---------------------------------------------------------------------------
// DEFAULT seed — faithful encoding of the legacy constants (bugs preserved)
// ---------------------------------------------------------------------------

export const DEFAULT_DEVICE_CLASSIFICATION_PROFILE: DeviceClassificationProfile = {
  schemaVersion: 1,
  domains: {
    energy: {
      caseInsensitive: true,
      groups: {
        // OCULTOS_PATTERNS — substring over deviceProfile
        ocultosProfilePatterns: [
          'ARQUIVADO',
          'SEM_DADOS',
          'DESATIVADO',
          'REMOVIDO',
          'INATIVO',
        ],
        rules: [
          // RULE 1 — lojas: dp === '3F_MEDIDOR'
          { name: 'lojas', deviceProfiles: ['3F_MEDIDOR'] },
          // RULE 2 — entrada: ENTRADA_PROFILES.has(dp)
          { name: 'entrada', deviceProfiles: ['TRAFO', 'ENTRADA', 'RELOGIO', 'SUBESTACAO'] },
          // RULE 3 — areacomum: residual fallback
          { name: 'areacomum', deviceProfiles: [], fallback: true },
        ],
      },
      categories: {
        // isStoreDevice — deviceProfile === '3F_MEDIDOR' -> 'lojas'
        storeDeviceProfile: '3F_MEDIDOR',
        // Rule order = buildSummary's LOOSE precedence (elevador -> escada ->
        // climatizacao). Exact-deviceProfile matching (pass 1) is disjoint so the
        // order is irrelevant there; the order only governs the loose pass 2.
        rules: [
          {
            name: 'elevadores',
            // ELEVADORES_DEVICE_TYPES_SET + buildSummary ELEVADOR_PATTERNS
            deviceProfiles: ['ELEVADOR'],
            combinedContains: ['ELEVADOR'],
            identifierFallback: {
              // ELEVADORES_IDENTIFIERS_SET + buildSummary id prefix ELV-
              identifierEquals: ['ELV', 'ELEVADOR', 'ELEVADORES'],
              identifierPrefixes: ['ELV-', 'ELEVADOR-'],
            },
          },
          {
            name: 'escadas_rolantes',
            // ESCADAS_DEVICE_TYPES_SET + buildSummary ESCADA_PATTERNS
            deviceProfiles: ['ESCADA_ROLANTE'],
            combinedContains: ['ESCADA', 'ROLANTE'],
            identifierFallback: {
              // ESCADAS_IDENTIFIERS_SET + buildSummary id prefix ESC-
              identifierEquals: ['ESC', 'ESCADA', 'ESCADASROLANTES'],
              identifierPrefixes: ['ESC-', 'ESCADA-', 'ESCADA_'],
            },
          },
          {
            name: 'climatizacao',
            // CLIMATIZACAO_DEVICE_TYPES_SET
            deviceProfiles: ['CHILLER', 'AR_CONDICIONADO', 'HVAC', 'FANCOIL'],
            // buildSummary CLIMATIZACAO_PATTERNS (superset of the deviceProfiles)
            combinedContains: [
              'CHILLER',
              'FANCOIL',
              'HVAC',
              'AR_CONDICIONADO',
              'COMPRESSOR',
              'VENTILADOR',
              'CLIMATIZA',
              'BOMBA_HIDRAULICA',
              'BOMBASHIDRAULICAS',
            ],
            // CLIMATIZACAO conditional (perfis BOMBA/MOTOR) + identifier requirement
            conditional: {
              deviceProfiles: ['BOMBA', 'MOTOR'],
              // RFC-0207 A1 — BUG #1 FIX: substring (.includes), unifying with
              // equipmentCategory.js. Catches "CAG 01", "BOMBA CAG 2", etc.
              identifierContains: ['CAG', 'FANCOIL'],
              identifierPrefixes: ['CAG-', 'FANCOIL-'],
            },
            // classifyDeviceByIdentifier + buildSummary id prefixes (CAG-/FANCOIL-/CHILLER-)
            identifierFallback: {
              identifierContains: ['CAG', 'FANCOIL'],
              identifierPrefixes: ['CAG-', 'FANCOIL-', 'CHILLER-'],
            },
          },
        ],
        fallback: { name: 'outros' },
      },
    },

    // -----------------------------------------------------------------------
    // WATER — faithful encoding of categorizeItemsByGroupWater (RFC-0106/0142).
    // Groups only (no breakdown). Note: `areacomum` is BOTH the explicit
    // HIDROMETRO_AREA_COMUM bucket AND the residual fallback in the legacy
    // function; since the residual already lands in areacomum, encoding it as a
    // single fallback rule is exactly equivalent. `banheiros` is never produced
    // here — standalone bathroom meters are extracted by the TELEMETRY widget
    // for TELEMETRY_INFO, so the bucket stays empty (preserved by MAIN).
    // -----------------------------------------------------------------------
    water: {
      caseInsensitive: true,
      groups: {
        ocultosProfilePatterns: [
          'ARQUIVADO',
          'SEM_DADOS',
          'DESATIVADO',
          'REMOVIDO',
          'INATIVO',
        ],
        rules: [
          // ENTRADA — deviceProfile = HIDROMETRO_SHOPPING
          { name: 'entrada', deviceProfiles: ['HIDROMETRO_SHOPPING'] },
          // LOJAS — deviceProfile = HIDROMETRO
          { name: 'lojas', deviceProfiles: ['HIDROMETRO'] },
          // CAIXA D'ÁGUA — deviceProfile = TANK | CAIXA_DAGUA
          { name: 'caixadagua', deviceProfiles: ['TANK', 'CAIXA_DAGUA'] },
          // ÁREA COMUM — HIDROMETRO_AREA_COMUM + residual fallback
          { name: 'areacomum', deviceProfiles: [], fallback: true },
        ],
      },
    },

    // -----------------------------------------------------------------------
    // TEMPERATURE — faithful encoding of categorizeItemsByGroupTemperature
    // (RFC-0182). Groups only. TERMOSTATO_EXTERNAL -> nao_climatizavel; every
    // other (non-ocultos) device -> climatizavel (the residual fallback).
    // -----------------------------------------------------------------------
    temperature: {
      caseInsensitive: true,
      groups: {
        ocultosProfilePatterns: [
          'ARQUIVADO',
          'SEM_DADOS',
          'DESATIVADO',
          'REMOVIDO',
          'INATIVO',
        ],
        rules: [
          // NÃO CLIMATIZÁVEL — deviceProfile = TERMOSTATO_EXTERNAL
          { name: 'nao_climatizavel', deviceProfiles: ['TERMOSTATO_EXTERNAL'] },
          // CLIMATIZÁVEL — TERMOSTATO or any other variant (residual fallback)
          { name: 'climatizavel', deviceProfiles: [], fallback: true },
        ],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Internal helpers (case-insensitive, trim — matching legacy exactly)
// ---------------------------------------------------------------------------

function up(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

/** deviceProfile: legacy does String(item.deviceProfile||'').toUpperCase() (no trim). */
function profileOf(item: ClassifiableItem | null | undefined): string {
  return up(item?.deviceProfile ?? '');
}

/** identifier: legacy does String(item.identifier||'').toUpperCase().trim(). */
function identifierOf(item: ClassifiableItem | null | undefined): string {
  return up(item?.identifier ?? '').trim();
}

/**
 * combined: `${labelWidget} ${deviceProfile} ${label}` (upper-cased).
 * deviceType está EM DESUSO e foi removido do texto combinado (2026-07-14).
 * Identifier is intentionally NOT included (buildSummary keeps it separate).
 */
function combinedOf(item: ClassifiableItem | null | undefined): string {
  return `${up(item?.labelWidget ?? '')} ${up(item?.deviceProfile ?? '')} ${up(item?.label ?? '')}`;
}

/** Mirrors an IdentifierMatch against an already-normalized (trim+upper) id. */
function matchesIdentifier(id: string, m: IdentifierMatch | undefined): boolean {
  if (!m) return false;
  if (m.identifierEquals) {
    for (const v of m.identifierEquals) if (id === up(v)) return true;
  }
  if (m.identifierContains) {
    for (const v of m.identifierContains) if (id.includes(up(v))) return true;
  }
  if (m.identifierPrefixes) {
    for (const p of m.identifierPrefixes) if (id.startsWith(up(p))) return true;
  }
  return false;
}

/**
 * Returns the requested domain's config. If the profile does not define the
 * domain (e.g. a customer profile that overrides only `energy`), falls back to
 * the DEFAULT seed for that domain so water/temperature still classify. `energy`
 * is always present (schema-required), so this only matters for water/temp.
 */
function getDomain(
  profile: DeviceClassificationProfile,
  domain: ClassificationDomain,
): DomainProfile {
  return (
    profile.domains?.[domain] ??
    DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains[domain] ??
    DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy
  );
}

// ---------------------------------------------------------------------------
// resolveGroup — reproduces categorizeItemsByGroup's per-item decision
// ---------------------------------------------------------------------------

export function resolveGroup(
  item: ClassifiableItem | null | undefined,
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain: ClassificationDomain = 'energy',
): GroupResolution {
  const dom = getDomain(profile, domain);
  const dp = profileOf(item);

  // RULE 0 — ocultos: substring over deviceProfile
  for (const pattern of dom.groups.ocultosProfilePatterns) {
    if (dp.includes(up(pattern))) {
      return { group: 'ocultos', matchedBy: 'ocultos' };
    }
  }

  // RULE 1/2 — exact deviceProfile rules (energy: lojas/entrada; water:
  // entrada/lojas/caixadagua; temperature: nao_climatizavel)
  let fallbackName: GroupName =
    dom.groups.rules.find((r) => r.fallback)?.name ?? 'areacomum';
  for (const rule of dom.groups.rules) {
    if (rule.fallback) {
      fallbackName = rule.name;
      continue;
    }
    for (const candidate of rule.deviceProfiles) {
      if (dp === up(candidate)) {
        return { group: rule.name, matchedBy: 'deviceProfile' };
      }
    }
  }

  // RULE 3 — residual fallback (areacomum)
  return { group: fallbackName, matchedBy: 'fallback' };
}

// ---------------------------------------------------------------------------
// resolveCategory — UNIFIED breakdown classifier (RFC-0207 A1b)
//
// Single source for both classifyDevice (column/orchestrator) and buildSummary
// (TELEMETRY_INFO breakdown), closing bug #2. Two passes:
//   Pass 1 — exact deviceProfile (authoritative, disjoint): store -> each rule's
//            deviceProfiles. This keeps precise profile matches winning over the
//            loose text signals (so e.g. an ELEVADOR with a "CAG" label stays an
//            elevador, matching legacy classifyDevice).
//   Pass 2 — loose, in rule order (= buildSummary precedence): combinedContains
//            (text), then conditional (BOMBA/MOTOR + identifier), then the
//            identifier fallback (equals/contains/prefixes — now unconditional,
//            like buildSummary's id-prefix checks).
//   else  — outros / fallback (the genuine-orphan signal).
//
// This is a deliberate behavior change vs BOTH legacy paths; the dual-oracle
// migration snapshot documents every move.
// ---------------------------------------------------------------------------

export function resolveCategory(
  item: ClassifiableItem | null | undefined,
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain: ClassificationDomain = 'energy',
): CategoryResolution {
  if (!item) return { category: 'outros', matchedBy: 'fallback' };

  const dom = getDomain(profile, domain);
  // Only the energy domain has a breakdown; water/temperature have no
  // categories, so any item resolves to the genuine-orphan fallback.
  if (!dom.categories) return { category: 'outros', matchedBy: 'fallback' };

  const dp = profileOf(item);

  // isStoreDevice
  if (dp === up(dom.categories.storeDeviceProfile)) {
    return { category: 'lojas', matchedBy: 'deviceProfile' };
  }

  const rules = dom.categories.rules;

  // Pass 1 — exact deviceProfile (authoritative).
  for (const rule of rules) {
    for (const candidate of rule.deviceProfiles) {
      if (dp && dp === up(candidate)) {
        return { category: rule.name, matchedBy: 'deviceProfile' };
      }
    }
  }

  // Pass 2 — loose, in rule order (buildSummary precedence).
  const combined = combinedOf(item);
  const id = identifierOf(item);
  for (const rule of rules) {
    // combinedContains (text substring)
    if (rule.combinedContains) {
      for (const pattern of rule.combinedContains) {
        if (combined.includes(up(pattern))) {
          return { category: rule.name, matchedBy: 'combined' };
        }
      }
    }
    // conditional ({BOMBA,MOTOR} no PROFILE + identifier hit)
    if (rule.conditional && rule.conditional.deviceProfiles.some((t) => dp === up(t))) {
      if (matchesIdentifier(id, rule.conditional)) {
        return { category: rule.name, matchedBy: 'conditional' };
      }
    }
    // identifier fallback (unconditional)
    if (matchesIdentifier(id, rule.identifierFallback)) {
      return { category: rule.name, matchedBy: 'identifier' };
    }
  }

  return { category: 'outros', matchedBy: 'fallback' };
}

// ---------------------------------------------------------------------------
// validateProfile — structural integrity (closes bug #3)
// ---------------------------------------------------------------------------

export function validateProfile(profile: DeviceClassificationProfile): string[] {
  const errors: string[] = [];

  if (!profile || typeof profile !== 'object') {
    return ['profile: not an object'];
  }
  if (typeof profile.schemaVersion !== 'number') {
    errors.push('profile.schemaVersion: missing or not a number');
  }
  if (!profile.domains?.energy) {
    errors.push('profile.domains.energy: missing');
    return errors;
  }

  // Validate every present domain. `energy` is required and also has a
  // categories family (the breakdown); water/temperature have groups only.
  const domains: ClassificationDomain[] = ['energy', 'water', 'temperature'];
  for (const domain of domains) {
    const dom = profile.domains[domain];
    if (!dom) continue; // water/temperature are optional

    // ---- groups family ----
    const groups = dom.groups;
    if (!groups) {
      errors.push(`${domain}.groups: missing`);
    } else {
      if (!Array.isArray(groups.ocultosProfilePatterns)) {
        errors.push(`${domain}.groups.ocultosProfilePatterns: must be an array`);
      }
      const groupRules = groups.rules ?? [];
      const groupFallbacks = groupRules.filter((r) => r.fallback === true);
      if (groupFallbacks.length !== 1) {
        errors.push(
          `${domain}.groups: expected exactly one fallback rule, found ${groupFallbacks.length}`,
        );
      }
      // each non-fallback group rule must declare deviceProfiles
      for (const r of groupRules) {
        if (!r.fallback && !Array.isArray(r.deviceProfiles)) {
          errors.push(`${domain}.groups.rules["${r?.name}"]: missing deviceProfiles array`);
        }
      }
      // duplicate deviceProfile across groups
      const seen = new Map<string, string>();
      for (const r of groupRules) {
        for (const dp of r.deviceProfiles ?? []) {
          const key = String(dp).toUpperCase();
          if (seen.has(key)) {
            errors.push(
              `${domain}.groups: duplicate deviceProfile "${key}" in "${seen.get(key)}" and "${r.name}"`,
            );
          } else {
            seen.set(key, r.name);
          }
        }
      }
    }

    // ---- categories family (only domains that declare one) ----
    const cats = dom.categories;
    if (!cats) {
      // energy MUST have a breakdown; water/temperature legitimately have none.
      if (domain === 'energy') errors.push('energy.categories: missing');
    } else {
      if (!cats.storeDeviceProfile) {
        errors.push(`${domain}.categories.storeDeviceProfile: missing`);
      }
      const catRules = cats.rules ?? [];
      // every category rule MUST declare its deviceProfiles key (closes bug #3)
      for (const r of catRules) {
        if (!Array.isArray(r.deviceProfiles)) {
          errors.push(`${domain}.categories.rules["${r?.name}"]: missing deviceProfiles array`);
        }
      }
      // exactly one fallback across the category family (the 'outros' bucket)
      const inlineFallbacks = catRules.filter((r) => r.fallback === true).length;
      const hasOutros = cats.fallback && cats.fallback.name === 'outros' ? 1 : 0;
      const totalFallbacks = inlineFallbacks + hasOutros;
      if (totalFallbacks !== 1) {
        errors.push(
          `${domain}.categories: expected exactly one fallback (outros), found ${totalFallbacks}`,
        );
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// normalizeProfile / resolveActiveProfile
// ---------------------------------------------------------------------------

export interface ProfileLogger {
  warn: (message: string) => void;
}

/**
 * Fills defaults and (when caseInsensitive) upper-cases comparands so the
 * resolver can compare directly. The resolver is also defensive (it upper-cases
 * on read), so normalization is idempotent and safe.
 */
export function normalizeProfile(raw: DeviceClassificationProfile): DeviceClassificationProfile {
  const cloned: DeviceClassificationProfile = JSON.parse(JSON.stringify(raw));

  const domains: ClassificationDomain[] = ['energy', 'water', 'temperature'];
  for (const domain of domains) {
    const dom = cloned.domains?.[domain];
    if (!dom) continue;

    const ci = dom.caseInsensitive !== false; // default true
    dom.caseInsensitive = ci;

    const upArr = (arr?: string[]): string[] | undefined =>
      ci && Array.isArray(arr) ? arr.map((s) => String(s).toUpperCase()) : arr;

    const upIdMatch = (m?: IdentifierMatch): void => {
      if (!m) return;
      m.identifierEquals = upArr(m.identifierEquals);
      m.identifierContains = upArr(m.identifierContains);
      m.identifierPrefixes = upArr(m.identifierPrefixes);
    };

    if (dom.groups) {
      dom.groups.ocultosProfilePatterns = upArr(dom.groups.ocultosProfilePatterns) ?? [];
      for (const r of dom.groups.rules ?? []) {
        r.deviceProfiles = upArr(r.deviceProfiles) ?? [];
      }
    }
    if (dom.categories) {
      if (ci && dom.categories.storeDeviceProfile) {
        dom.categories.storeDeviceProfile = dom.categories.storeDeviceProfile.toUpperCase();
      }
      for (const r of dom.categories.rules ?? []) {
        r.deviceProfiles = upArr(r.deviceProfiles) ?? [];
        r.combinedContains = upArr(r.combinedContains);
        if (r.conditional) {
          // Compat: perfis JSON legados usavam a chave "deviceTypes" (que sempre
          // comparou contra o deviceProfile) — normaliza para deviceProfiles.
          r.conditional.deviceProfiles =
            upArr(r.conditional.deviceProfiles) ?? upArr(r.conditional.deviceTypes) ?? [];
          delete r.conditional.deviceTypes;
          upIdMatch(r.conditional);
        }
        upIdMatch(r.identifierFallback);
      }
    }
  }
  return cloned;
}

let _warnedInvalidProfile = false;

/**
 * Returns a usable profile: the normalized `raw` if present and valid,
 * otherwise the DEFAULT (runtime fallback). Warns once on invalid input.
 */
export function resolveActiveProfile(
  raw?: DeviceClassificationProfile | null,
  logger: ProfileLogger = console,
): DeviceClassificationProfile {
  if (!raw) return DEFAULT_DEVICE_CLASSIFICATION_PROFILE;
  const errors = validateProfile(raw);
  if (errors.length > 0) {
    if (!_warnedInvalidProfile) {
      _warnedInvalidProfile = true;
      logger.warn(
        `[deviceClassificationProfile] invalid profile, using DEFAULT. Errors: ${errors.join('; ')}`,
      );
    }
    return DEFAULT_DEVICE_CLASSIFICATION_PROFILE;
  }
  return normalizeProfile(raw);
}

// ---------------------------------------------------------------------------
// Active profile (RFC-0207 Phase B)
//
// Module-level "active" profile so the no-argument resolver calls
// (`resolveGroup(item)` / `resolveCategory(item)`) in the widgets pick up the
// customer-scoped profile loaded by MAIN_VIEW.onInit. Defaults to DEFAULT, so
// behavior is unchanged until `setActiveProfile()` is called — keeps the A0
// equivalence guarantees intact.
// ---------------------------------------------------------------------------

let _activeProfile: DeviceClassificationProfile = DEFAULT_DEVICE_CLASSIFICATION_PROFILE;

/** Current active profile used as the default by resolveGroup/resolveCategory. */
export function getActiveProfile(): DeviceClassificationProfile {
  return _activeProfile;
}

/**
 * Sets the active classification profile from a raw (possibly invalid) JSON,
 * running it through `resolveActiveProfile` (validate → normalize → DEFAULT on
 * failure). Returns the profile actually applied.
 */
export function setActiveProfile(
  raw?: DeviceClassificationProfile | null,
  logger: ProfileLogger = console,
): DeviceClassificationProfile {
  _activeProfile = resolveActiveProfile(raw, logger);
  return _activeProfile;
}

// ---------------------------------------------------------------------------
// Dynamic dashboard engine helpers (domain/group-agnostic)
// ---------------------------------------------------------------------------

/** Group descriptor — one entry per column/section a domain renders. */
export interface GroupDescriptor {
  /** Stable group key = the rule's name (arbitrary, customer-defined). */
  key: string;
  /** True for the residual fallback bucket. */
  fallback: boolean;
}

/**
 * Lists the active domain codes present in a profile.
 * The dashboard iterates THIS instead of any hard-coded domain list — a customer
 * may have any subset/superset (e.g. only water, or gas).
 */
export function listDomains(
  profile: DeviceClassificationProfile = getActiveProfile(),
): string[] {
  return Object.keys(profile?.domains ?? {});
}

/**
 * Lists the ordered groups of a domain (one per `groups.rules[]`). Source of truth
 * for how many columns/sections a domain renders — fully dynamic (1..N, arbitrary names).
 */
export function listGroups(
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain = '',
): GroupDescriptor[] {
  const dom = profile?.domains?.[domain as ClassificationDomain];
  const rules = dom?.groups?.rules ?? [];
  return rules.map((r) => ({ key: r.name, fallback: !!r.fallback }));
}
