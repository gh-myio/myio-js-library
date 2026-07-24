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
  /**
   * @deprecated NÃO é lido pelo classificador (RFC-0207, 2026-07-23).
   * `labelWidget` é a SAÍDA ANTERIOR do próprio classificador (inferLabelWidget);
   * lê-lo criava um laço circular auto-sustentado (um item carimbado
   * "Climatização" voltava a casar com o padrão `CLIMATIZA` independentemente do
   * `deviceProfile`). Mantido no tipo só porque os itens do dashboard o carregam.
   */
  labelWidget?: string | null;
  /** @deprecated EM DESUSO (2026-07-14) — nunca é lido; classificação usa só deviceProfile/identifier. */
  deviceType?: string | null;
  /** @deprecated NÃO é lido pelo classificador — classificar por nome/label é proibido (RFC-0207 §J). */
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
  /** Substring hit on `deviceProfile` (rule `profileContains`). */
  | 'profileContains'
  /**
   * @deprecated RFC-0207 (2026-07-23) — nunca mais emitido. Era o hit sobre o
   * texto combinado (labelWidget + deviceProfile + label); o texto combinado foi
   * eliminado (laço circular do `labelWidget` + proibição de casar por nome).
   * Mantido na união só para não quebrar narrowing de consumidores antigos.
   */
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

/**
 * RFC-0207 "Dispositivos Específicos" — modo de um override por dispositivo.
 *
 * - `include` — o device AGREGA nesta categoria do breakdown **mantendo o seu
 *   grupo**. `resolveGroup` não muda: o total da coluna (ex.: Entrada) fica
 *   idêntico. O device é apenas somado a mais na categoria.
 * - `exclude` — o device sai do breakdown **inteiro**. Não cai em `outros` nem em
 *   nenhum outro bucket. Existe para dupla-medição (o submedidor já está dentro
 *   da leitura do trafo); mandá-lo para `outros` seria recontá-lo.
 */
export type DeviceOverrideMode = 'include' | 'exclude';

/**
 * Override explícito por dispositivo (escape hatch topológico).
 *
 * É uma LISTA DE VALORES, nunca um predicado (RFC-0207 §A proíbe
 * predicates-as-data). `id` é o TB entity id — a MESMA chave usada por
 * `excludeDevicesAtCountSubtotalCAG` (`String(item.id)`, comparada
 * trim+lowercase).
 *
 * ⚠️ Escala mal e quebra em re-provisionamento (o entity id do TB muda). Regras
 * por atributo (`deviceProfiles`/`profileContains`/`identifier*`) continuam sendo
 * o caminho padrão; overrides são exceção topológica.
 */
export interface DeviceOverride {
  /** TB entity id do dispositivo. */
  id: string;
  /** Guardado só para exibição/resiliência na UI (o motor NUNCA classifica por nome). */
  label?: string;
  mode: DeviceOverrideMode;
}

/** A single (non-fallback) category rule. */
export interface CategoryRule {
  name: Exclude<CategoryName, 'lojas'>; // lojas is handled by the store shortcut
  /** Exact deviceProfile matches (a legacy "deviceTypes" Set). */
  deviceProfiles: string[];
  /**
   * Substring patterns over `deviceProfile` (ex.: `CHILLER` casa
   * `CHILLER_SECUNDARIO`). Value list limitada — nunca um predicado.
   *
   * RFC-0207 (2026-07-23): substitui `combinedContains`, que casava sobre o
   * texto COMBINADO `labelWidget + deviceProfile + label`. Duas coisas estavam
   * erradas ali: (a) `labelWidget` é a saída anterior do próprio classificador →
   * laço circular; (b) `label` é nome livre, e classificar por nome é proibido.
   * `normalizeProfile` migra `combinedContains` → `profileContains` (perfis já
   * salvos continuam válidos).
   */
  profileContains?: string[];
  /**
   * @deprecated RFC-0207 (2026-07-23) — renomeado para `profileContains` e o
   * texto combinado deixou de existir. Perfis persistidos com esta chave são
   * migrados por `normalizeProfile`; o motor NÃO lê este campo.
   */
  combinedContains?: string[];
  /** climatizacao-only conditional ({BOMBA,MOTOR} + identifier hit). */
  conditional?: ConditionalRule;
  /** Identifier-fallback hit list, mirroring classifyDeviceByIdentifier. */
  identifierFallback?: IdentifierMatch;
  /**
   * RFC-0207 "Dispositivos Específicos" — overrides explícitos por dispositivo.
   *
   * OPCIONAL e retrocompatível: ausente ⇒ comportamento idêntico ao de antes
   * (`selectBreakdownItems` tem fast-path para "zero overrides").
   */
  deviceOverrides?: DeviceOverride[];
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
            profileContains: ['ELEVADOR'],
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
            profileContains: ['ESCADA', 'ROLANTE'],
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
            // buildSummary CLIMATIZACAO_PATTERNS (superset of the deviceProfiles).
            // NB: BOMBA_HIDRAULICA/BOMBASHIDRAULICAS foram REMOVIDOS (2026-07-23):
            // bomba hidráulica é recalque de água, não climatização — deve cair em
            // 'outros' (igual a BOMBA_INCENDIO). BOMBA_CAG continua em climatização
            // via `conditional`/`identifierFallback` (CAG), sem depender destas
            // strings. Alinhado a equipmentCategory.js (hvacProfiles NÃO inclui bomba
            // hidráulica) e a openUpsellModal (BOMBA_HIDRAULICA = energy_common_area).
            profileContains: [
              'CHILLER',
              'FANCOIL',
              'HVAC',
              'AR_CONDICIONADO',
              'COMPRESSOR',
              'VENTILADOR',
              'CLIMATIZA',
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
 * RFC-0207 (2026-07-23) — o texto COMBINADO foi eliminado.
 *
 * Antes: `combinedOf(item) = labelWidget + deviceProfile + label`, avaliado
 * contra `rule.combinedContains`. Dois defeitos estruturais:
 *
 *  1. **Laço circular** — `labelWidget` é a SAÍDA ANTERIOR do classificador
 *     (`inferLabelWidget`). Um item carimbado "Climatização" voltava a casar
 *     com o padrão `CLIMATIZA` e se auto-sustentava, independentemente do
 *     `deviceProfile`. Foi assim que uma bomba hidráulica ficou presa em
 *     climatização no Moxuara mesmo depois do fix do seed.
 *  2. **Classificação por nome** — `label` é texto livre do cadastro;
 *     classificar por nome é proibido (`deviceProfile` é a autoridade).
 *
 * O que sobrou é substring sobre `deviceProfile` — hoje a regra
 * `profileContains`, avaliada direto em `profileOf(item)`.
 */

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
//   Pass 2 — loose, in rule order (= buildSummary precedence): profileContains
//            (substring sobre deviceProfile), then conditional (BOMBA/MOTOR +
//            identifier), then the identifier fallback (equals/contains/prefixes
//            — now unconditional, like buildSummary's id-prefix checks).
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
  const id = identifierOf(item);
  for (const rule of rules) {
    // profileContains — substring sobre deviceProfile APENAS.
    // (Nunca sobre labelWidget/label: ver a nota do laço circular acima.)
    if (dp && rule.profileContains) {
      for (const pattern of rule.profileContains) {
        if (dp.includes(up(pattern))) {
          return { category: rule.name, matchedBy: 'profileContains' };
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
// Dispositivos Específicos — device-level overrides for the BREAKDOWN
//
// Por que existem, em uma frase: `resolveGroup` aloca cada device em UM grupo só
// (invariante de coerência dos totais — não é para ser abolida) e o breakdown do
// TELEMETRY_INFO só percorre o grupo residual (`areacomum`). Um trafo de entrada
// que mede TODA a carga da CAG fica, portanto, estruturalmente invisível ao card
// de Climatização — mesmo sendo, fisicamente, climatização.
//
// Os overrides são o escape hatch: por dispositivo, explícito, sem tocar em
// `resolveGroup` e sem inventar predicados novos no JSON.
// ---------------------------------------------------------------------------

/** Chave de comparação de device id — mesma normalização de `excludeDevicesAtCountSubtotalCAG`. */
export function normalizeDeviceOverrideId(id: unknown): string {
  return String(id ?? '').trim().toLowerCase();
}

export interface CollectedDeviceOverrides {
  /** device id normalizado → categoria na qual ele deve ser AGREGADO. */
  includes: Map<string, CategoryName>;
  /** device ids normalizados removidos do breakdown por inteiro. */
  excludes: Set<string>;
  /** device id normalizado → label capturado na edição (exibição/diagnóstico). */
  labels: Map<string, string>;
}

/**
 * Achata os `deviceOverrides` de TODAS as categorias de um domínio.
 *
 * Regras de precedência (decididas, não negociáveis aqui):
 *  - `exclude` vence `include` — se o mesmo device aparecer nos dois, ele sai do
 *    breakdown. `exclude` é global (vale para o breakdown inteiro), `include` é
 *    por categoria.
 *  - Primeiro `include` na ordem das regras vence, caso o device apareça como
 *    `include` em mais de uma categoria (alocação única também no breakdown).
 */
export function collectDeviceOverrides(
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain: ClassificationDomain = 'energy',
): CollectedDeviceOverrides {
  const includes = new Map<string, CategoryName>();
  const excludes = new Set<string>();
  const labels = new Map<string, string>();

  const rules = getDomain(profile, domain).categories?.rules ?? [];
  for (const rule of rules) {
    for (const ov of rule.deviceOverrides ?? []) {
      const key = normalizeDeviceOverrideId(ov?.id);
      if (!key) continue;
      if (ov.label) labels.set(key, String(ov.label));
      if (ov.mode === 'exclude') excludes.add(key);
      else if (!includes.has(key)) includes.set(key, rule.name);
    }
  }
  // exclude vence include
  for (const key of excludes) includes.delete(key);

  return { includes, excludes, labels };
}

/** Um item elegível ao breakdown + a categoria forçada por override (ou `null`). */
export interface BreakdownEntry<T> {
  item: T;
  /**
   * Categoria imposta por um override `include`. `null` ⇒ classificar
   * normalmente com `resolveCategory`.
   */
  forcedCategory: CategoryName | null;
  /** Grupo de onde o item veio (chave de `groups`). */
  sourceGroup: string;
  /**
   * `true` quando o item veio do grupo BASE (e portanto já está dentro do total
   * daquele grupo); `false` quando foi PUXADO de outro grupo por um `include`.
   *
   * O consumidor **precisa** dessa distinção para o residual: o total do grupo
   * base não contém os itens cross-group, então subtrair o subtotal cheio dele
   * produz um residual negativo pelo valor exato do item puxado.
   * Ver `computeBaseGroupResidual`.
   */
  fromBaseGroup: boolean;
}

export interface SelectBreakdownItemsOptions {
  /** Grupo que alimenta o breakdown (default `areacomum`, o residual do energy). */
  baseGroup?: string;
}

/**
 * Monta a lista de itens que o breakdown (TELEMETRY_INFO) deve percorrer,
 * aplicando os Dispositivos Específicos.
 *
 *  - base = `groups[baseGroup]` (hoje `areacomum`), na ordem original;
 *  - itens `exclude` são REMOVIDOS (não caem em `outros`);
 *  - itens `include` são PUXADOS de qualquer grupo (tipicamente `entrada`) e
 *    marcados com `forcedCategory` — o grupo deles NÃO muda, então o total da
 *    coluna Entrada continua idêntico.
 *
 * Função pura: sem DOM, sem fetch. Quando não há nenhum override, devolve
 * exatamente `groups[baseGroup]` (zero mudança de comportamento).
 */
export function selectBreakdownItems<T extends ClassifiableItem>(
  groups: Record<string, T[] | undefined | null>,
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain: ClassificationDomain = 'energy',
  options: SelectBreakdownItemsOptions = {},
): BreakdownEntry<T>[] {
  const baseGroup = options.baseGroup || 'areacomum';
  const base = (groups?.[baseGroup] ?? []) as T[];

  const { includes, excludes } = collectDeviceOverrides(profile, domain);

  // Fast-path: perfil sem Dispositivos Específicos ⇒ o breakdown de sempre.
  if (includes.size === 0 && excludes.size === 0) {
    return base.map((item) => ({
      item,
      forcedCategory: null,
      sourceGroup: baseGroup,
      fromBaseGroup: true,
    }));
  }

  const out: BreakdownEntry<T>[] = [];
  const seen = new Set<string>();

  for (const item of base) {
    const key = normalizeDeviceOverrideId((item as { id?: unknown })?.id);
    if (key) {
      if (excludes.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      const forced = includes.get(key);
      out.push({
        item,
        forcedCategory: forced ?? null,
        sourceGroup: baseGroup,
        fromBaseGroup: true,
      });
      continue;
    }
    out.push({ item, forcedCategory: null, sourceGroup: baseGroup, fromBaseGroup: true });
  }

  if (includes.size === 0) return out;

  // Puxa os `include` que vivem FORA do grupo base (tipicamente `entrada`).
  // Estes NÃO estão dentro do total do grupo base — daí `fromBaseGroup: false`.
  for (const groupKey of Object.keys(groups || {})) {
    if (groupKey === baseGroup) continue;
    for (const item of (groups[groupKey] ?? []) as T[]) {
      const key = normalizeDeviceOverrideId((item as { id?: unknown })?.id);
      if (!key || excludes.has(key) || seen.has(key)) continue;
      const forced = includes.get(key);
      if (!forced) continue;
      seen.add(key);
      out.push({ item, forcedCategory: forced, sourceGroup: groupKey, fromBaseGroup: false });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Residual do grupo base × includes cross-group
// ---------------------------------------------------------------------------

/** Um subtotal do breakdown, decomposto por origem. */
export interface BreakdownSubtotalInput {
  /** Nome da categoria — só diagnóstico. */
  category: string;
  /** Total EXIBIDO no card (inclui a parcela cross-group). */
  total: number;
  /** Parcela de `total` que veio de devices FORA do grupo base. */
  crossGroupTotal: number;
}

export interface BaseGroupResidual {
  /** Soma das parcelas que estão de fato dentro de `baseGroupTotal`. */
  subtotalFromBaseGroup: number;
  /** Soma das parcelas cross-group (informativo). */
  subtotalCrossGroup: number;
  /** Residual ANTES do clamp. Negativo aqui = problema real de dado/config. */
  residualRaw: number;
  /** Residual publicável (clamp em 0). */
  residual: number;
  /** `true` quando `residualRaw < 0`. */
  negative: boolean;
}

/**
 * Residual do grupo base (Área Comum) na presença de includes cross-group.
 *
 * O bug que esta função existe para impedir: `residual = baseGroupTotal −
 * Σ subtotais` assume que TODO subtotal é composto de devices que estão dentro
 * de `baseGroupTotal`. Um `include` cross-group quebra a premissa — o trafo da
 * Ilha (637.560) entra no subtotal de climatização mas vive no grupo `entrada`
 * e nunca fez parte do `areacomumTotal`. O residual ia negativo pelo valor
 * exato do device puxado, e o `Math.max(0, …)` mascarava.
 *
 * A correção: o **card** continua mostrando o total cheio (é o objetivo do
 * recurso), mas o **residual** desconta apenas a parcela de origem-base.
 */
export function computeBaseGroupResidual(
  baseGroupTotal: number,
  subtotals: BreakdownSubtotalInput[],
): BaseGroupResidual {
  let subtotalFromBaseGroup = 0;
  let subtotalCrossGroup = 0;
  for (const s of subtotals ?? []) {
    const total = Number(s?.total) || 0;
    const cross = Number(s?.crossGroupTotal) || 0;
    subtotalFromBaseGroup += total - cross;
    subtotalCrossGroup += cross;
  }
  const residualRaw = (Number(baseGroupTotal) || 0) - subtotalFromBaseGroup;
  return {
    subtotalFromBaseGroup,
    subtotalCrossGroup,
    residualRaw,
    residual: Math.max(0, residualRaw),
    negative: residualRaw < 0,
  };
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
        // RFC-0207 (2026-07-23) — `profileContains` passou a ser contrato vivo E
        // renderizado pelo editor; valida a forma. A chave legada
        // `combinedContains` é TOLERADA aqui (migrada por normalizeProfile) para
        // não invalidar perfis já persistidos — resolveActiveProfile valida ANTES
        // de normalizar.
        if (r.profileContains !== undefined && !Array.isArray(r.profileContains)) {
          errors.push(`${domain}.categories.rules["${r?.name}"].profileContains: must be an array`);
        }
        if (r.combinedContains !== undefined && !Array.isArray(r.combinedContains)) {
          errors.push(`${domain}.categories.rules["${r?.name}"].combinedContains: must be an array`);
        }
        // RFC-0207 "Dispositivos Específicos" — lista de valores por dispositivo.
        // Campo OPCIONAL: ausente não gera erro (retrocompat total).
        if (r.deviceOverrides !== undefined) {
          if (!Array.isArray(r.deviceOverrides)) {
            errors.push(
              `${domain}.categories.rules["${r?.name}"].deviceOverrides: must be an array`,
            );
          } else {
            r.deviceOverrides.forEach((ov, i) => {
              const where = `${domain}.categories.rules["${r?.name}"].deviceOverrides[${i}]`;
              if (!ov || typeof ov !== 'object') {
                errors.push(`${where}: must be an object`);
                return;
              }
              if (!ov.id || typeof ov.id !== 'string' || !ov.id.trim()) {
                errors.push(`${where}.id: missing device id`);
              }
              if (ov.mode !== 'include' && ov.mode !== 'exclude') {
                errors.push(`${where}.mode: must be "include" or "exclude"`);
              }
              if (ov.label !== undefined && typeof ov.label !== 'string') {
                errors.push(`${where}.label: must be a string`);
              }
            });
          }
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
        // RFC-0207 (2026-07-23): migração de chave `combinedContains` →
        // `profileContains`. Os VALORES são preservados 1:1; o que muda é o
        // texto sobre o qual eles são avaliados (só `deviceProfile` agora, sem
        // `labelWidget`/`label`). Perfis já persistidos continuam válidos.
        const _pc = upArr(r.profileContains);
        const _legacy = upArr(r.combinedContains);
        if (_pc || _legacy) {
          const merged = [..._pc ?? [], ..._legacy ?? []];
          r.profileContains = merged.filter((v, i) => merged.indexOf(v) === i);
        }
        delete r.combinedContains;
        if (r.conditional) {
          // Compat: perfis JSON legados usavam a chave "deviceTypes" (que sempre
          // comparou contra o deviceProfile) — normaliza para deviceProfiles.
          r.conditional.deviceProfiles =
            upArr(r.conditional.deviceProfiles) ?? upArr(r.conditional.deviceTypes) ?? [];
          delete r.conditional.deviceTypes;
          upIdMatch(r.conditional);
        }
        upIdMatch(r.identifierFallback);
        // RFC-0207 "Dispositivos Específicos": IDs e labels NUNCA são
        // upper-cased. `id` é um UUID do TB (comparado trim+lowercase, igual a
        // `excludeDevicesAtCountSubtotalCAG`) e `label` é texto de exibição.
        // Só entradas estruturalmente sãs sobrevivem; ausência do campo é
        // preservada como ausência (retrocompat).
        if (r.deviceOverrides !== undefined) {
          r.deviceOverrides = (Array.isArray(r.deviceOverrides) ? r.deviceOverrides : [])
            .filter((ov) => ov && typeof ov === 'object' && String(ov.id ?? '').trim())
            .map((ov) => {
              const out: DeviceOverride = {
                id: String(ov.id).trim(),
                mode: ov.mode === 'exclude' ? 'exclude' : 'include',
              };
              if (ov.label !== undefined && ov.label !== null) out.label = String(ov.label);
              return out;
            })
            // dedupe por (id, mode) mantendo a primeira ocorrência
            .filter((ov, i, arr) => arr.findIndex((o) => o.id === ov.id && o.mode === ov.mode) === i);
        }
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
