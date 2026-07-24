// src/utils/devices/classificationNodeTree.ts
//
// RFC-0207 v2/v3.1 — árvore recursiva de nós + WALKER GENÉRICO.
//
// O v1 tem dois modelos planos e paralelos por domínio (`groups` = colunas,
// `categories` = breakdown). O v2 troca isso por UMA árvore ordenada de nós, em
// que subcategoria é simplesmente `children` — de modo que criar "Estacionamento"
// ou "Bombas Hidráulicas" é INSERIR UM NÓ (dado), nunca escrever código
// (§I.3: "membership viaja como DADO, avaliado por um motor genérico").
//
// O que é motor e o que é dado (§A):
//   - MOTOR (aqui, golden-locked): como as regras avaliam — UPPERCASE, precedência
//     exato→solto, `order` explícito, fallback por nível, curto-circuito de ocultos.
//   - ÁRVORE (dado autorado): quais nós existem, labels, ícones, aninhamento,
//     `order` e as listas de membership.
//
// `match()` NUNCA é dado (§A): as regras são LISTAS DE VALORES limitadas
// (`deviceProfiles` / `profileContains` / `identifierExact|Contains|Prefixes`),
// jamais predicados ou expressões.
//
// ESTADO: aditivo. `resolveGroup`/`resolveCategory` (v1) seguem sendo a API que o
// dashboard executa; este walker é provado EQUIVALENTE a eles sobre a árvore
// levantada do seed (tests/deviceClassificationProfile.treeWalker.test.ts). A
// troca do caminho de produção para o walker é um passo separado, com sua própria
// fronteira de reversão.

import {
  type ClassifiableItem,
  type ClassificationDomain,
  type DeviceClassificationProfile,
  type DomainProfile,
  type IdentifierMatch,
  type ConditionalRule,
  getActiveProfile,
} from './deviceClassificationProfile';

// ---------------------------------------------------------------------------
// Node shape (RFC-0207 v2 §C)
// ---------------------------------------------------------------------------

/** Papéis de nó (§R9). `derived` cobre `residual` e `total` do v2. */
export type NodeRole =
  | 'entrada'
  | 'consumer'
  | 'fallback'
  | 'residual'
  | 'total'
  | 'ocultos';

/** Tipos de regra LIMITADOS (§A / §R3) — listas de valores, nunca predicados. */
export interface NodeRules {
  /** Igualdade exata (UPPERCASE) contra `item.deviceProfile`. */
  deviceProfiles?: string[];
  /** Substring sobre `item.deviceProfile`. */
  profileContains?: string[];
  /** `identifier === valor`. */
  identifierExact?: string[];
  /** `identifier.includes(valor)`. */
  identifierContains?: string[];
  /** `identifier.startsWith(valor)`. */
  identifierPrefixes?: string[];
  /**
   * Regra condicional: quando o `deviceProfile` está nesta lista, exige TAMBÉM
   * um hit de identifier (o caso BOMBA/MOTOR + CAG).
   */
  conditional?: ConditionalRule;
}

export interface NodeFormula {
  op: 'subtract' | 'sum';
  /** `subtract`: nó base (ex.: 'entrada'). */
  from?: string;
  /** `subtract`: nós a subtrair. */
  subtract?: string[];
  /** `sum`: nós a somar. */
  of?: string[];
}

export interface ClassificationNode {
  /** Id estável, único na árvore do domínio. É a costura com o GCDR (`entity_key`). */
  key: string;
  /** Rótulo de exibição (dado — nunca hard-coded no controller). */
  label: string;
  description?: string;
  icon?: string;
  role?: NodeRole;
  /**
   * §B.1-1 — inteiro EXPLÍCITO. Irmãos são avaliados por `order` ascendente.
   * Nunca dependa da ordem do array/linhas/chaves JSON: serializadores e o
   * Postgres não garantem estabilidade.
   */
  order: number;
  rules?: NodeRules;
  children?: ClassificationNode[];
  /** Presente só em nós computados (`residual`/`total`). */
  formula?: NodeFormula;
}

export type NodeMatchedBy =
  | 'ocultos'
  | 'deviceProfile'
  | 'profileContains'
  | 'conditional'
  | 'identifier'
  | 'fallback';

export interface ClassificationResolution {
  /** Chave da folha em que o device foi alocado. */
  key: string;
  /** Caminho da raiz até a folha (`['climatizacao','bombas_hidraulicas']`). */
  nodePath: string[];
  matchedBy: NodeMatchedBy;
}

// ---------------------------------------------------------------------------
// Helpers de match (mesma semântica do motor v1 — UPPERCASE, trim no identifier)
// ---------------------------------------------------------------------------

const up = (v: unknown): string => String(v ?? '').toUpperCase();
const profileOf = (i: ClassifiableItem | null | undefined): string => up(i?.deviceProfile ?? '');
const identifierOf = (i: ClassifiableItem | null | undefined): string =>
  up(i?.identifier ?? '').trim();

function matchesIdentifier(id: string, m: IdentifierMatch | NodeRules | undefined): boolean {
  if (!m) return false;
  for (const v of (m as IdentifierMatch).identifierEquals ?? []) if (id === up(v)) return true;
  for (const v of (m as NodeRules).identifierExact ?? []) if (id === up(v)) return true;
  for (const v of m.identifierContains ?? []) if (id.includes(up(v))) return true;
  for (const p of m.identifierPrefixes ?? []) if (id.startsWith(up(p))) return true;
  return false;
}

/** FASE 1 — `deviceProfile` exato. Autoritativo: vence qualquer sinal solto. */
function matchExact(dp: string, rules: NodeRules | undefined): boolean {
  if (!rules || !dp) return false;
  for (const c of rules.deviceProfiles ?? []) if (dp === up(c)) return true;
  return false;
}

/** FASE 2 — sinais soltos, na ordem: profileContains → conditional → identifier. */
function matchLoose(
  dp: string,
  id: string,
  rules: NodeRules | undefined,
): NodeMatchedBy | null {
  if (!rules) return null;
  if (dp) {
    for (const p of rules.profileContains ?? []) if (dp.includes(up(p))) return 'profileContains';
  }
  const cond = rules.conditional;
  if (cond && (cond.deviceProfiles ?? []).some((t) => dp === up(t))) {
    if (matchesIdentifier(id, cond)) return 'conditional';
  }
  if (matchesIdentifier(id, rules)) return 'identifier';
  return null;
}

function byOrder(a: ClassificationNode, b: ClassificationNode): number {
  const d = (a.order ?? 0) - (b.order ?? 0);
  // §v3.2-F.7 — desempate estável por `key` quando o `order` empata/falta.
  return d !== 0 ? d : String(a.key).localeCompare(String(b.key));
}

/** Nós que participam da classificação (computados não classificam nada). */
function classifiable(nodes: ClassificationNode[]): ClassificationNode[] {
  return nodes.filter((n) => n.role !== 'residual' && n.role !== 'total');
}

// ---------------------------------------------------------------------------
// Walker genérico
// ---------------------------------------------------------------------------

/**
 * Aloca um device na árvore. Group-generic (§C-4): climatização e "Outros" são
 * apenas dois nós com filhos — nenhum caso especial.
 *
 * Semântica, por nível:
 *   0. **Ocultos** — qualquer nó `role:'ocultos'` casa primeiro e curto-circuita.
 *   1. **Fase exata** — irmãos por `order` asc; o primeiro com `deviceProfiles`
 *      exato vence. Isso é o que impede um sinal solto de um irmão anterior de
 *      roubar um device cujo `deviceProfile` casa exatamente em outro nó
 *      (ELEVADOR com identifier "CAG" continua elevador).
 *   2. **Fase solta** — irmãos por `order` asc: profileContains → conditional →
 *      identifier.
 *   3. **Fallback do nível** — o nó `role:'fallback'`, que por invariante é o de
 *      maior `order` no nível (§B.1-1) e portanto nunca sombreia um irmão real.
 *   4. **Descida** — casou um nó com `children`? repete tudo entre os filhos;
 *      o device conta UMA vez, na folha mais profunda (§I.1 D-b).
 */
export function resolveClassification(
  item: ClassifiableItem | null | undefined,
  tree: ClassificationNode[],
): ClassificationResolution | null {
  if (!Array.isArray(tree) || tree.length === 0) return null;
  const dp = profileOf(item);
  const id = identifierOf(item);

  // 0 — ocultos curto-circuita a árvore inteira (em qualquer profundidade do topo)
  for (const n of [...tree].sort(byOrder)) {
    if (n.role !== 'ocultos') continue;
    if (matchExact(dp, n.rules) || matchLoose(dp, id, n.rules)) {
      return { key: n.key, nodePath: [n.key], matchedBy: 'ocultos' };
    }
  }

  const path: string[] = [];
  let level = classifiable(tree).filter((n) => n.role !== 'ocultos');
  let matchedBy: NodeMatchedBy = 'fallback';
  let current: ClassificationNode | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const siblings = [...level].sort(byOrder);
    let hit: ClassificationNode | null = null;
    let hitBy: NodeMatchedBy | null = null;

    // 1 — fase exata
    for (const n of siblings) {
      if (matchExact(dp, n.rules)) {
        hit = n;
        hitBy = 'deviceProfile';
        break;
      }
    }
    // 2 — fase solta
    if (!hit) {
      for (const n of siblings) {
        const by = matchLoose(dp, id, n.rules);
        if (by) {
          hit = n;
          hitBy = by;
          break;
        }
      }
    }
    // 3 — fallback do nível
    if (!hit) {
      const fb = siblings.find((n) => n.role === 'fallback');
      if (fb) {
        hit = fb;
        hitBy = 'fallback';
      }
    }

    if (!hit) break;
    current = hit;
    matchedBy = hitBy ?? 'fallback';
    path.push(hit.key);

    const kids = classifiable(hit.children ?? []).filter((n) => n.role !== 'ocultos');
    if (kids.length === 0) break;
    level = kids;
  }

  if (!current) return null;
  return { key: current.key, nodePath: path, matchedBy };
}

/**
 * Tier-2 GROUP-GENERIC (§C-4): dado o grupo em que o device caiu, qual
 * subcategoria? Retorna `null` quando o grupo não tem filhos (não é um erro —
 * significa que aquele grupo não é subdividido).
 */
export function resolveSubcategory(
  item: ClassifiableItem | null | undefined,
  groupKey: string,
  tree: ClassificationNode[],
): ClassificationResolution | null {
  const group = findNode(tree, groupKey);
  if (!group) return null;
  const kids = classifiable(group.children ?? []);
  if (kids.length === 0) return null;
  const r = resolveClassification(item, kids);
  return r ? { ...r, nodePath: [groupKey, ...r.nodePath] } : null;
}

/** Busca um nó por `key` em qualquer profundidade. */
export function findNode(
  tree: ClassificationNode[],
  key: string,
): ClassificationNode | null {
  for (const n of tree ?? []) {
    if (n.key === key) return n;
    const deep = findNode(n.children ?? [], key);
    if (deep) return deep;
  }
  return null;
}

/** Achata a árvore (pré-ordem, por `order`). */
export function flattenTree(tree: ClassificationNode[]): ClassificationNode[] {
  const out: ClassificationNode[] = [];
  for (const n of [...(tree ?? [])].sort(byOrder)) {
    out.push(n);
    out.push(...flattenTree(n.children ?? []));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validação de árvore (§E + §B.1-1)
// ---------------------------------------------------------------------------

/**
 * Invariantes que, se violadas, falham em silêncio na produção:
 *   - `key`/`label` vazios ou `key` duplicada no domínio;
 *   - mais de um `fallback` entre IRMÃOS;
 *   - **o `fallback` não é o de maior `order` do nível** — o caso em que o
 *     catch-all sombreia uma regra real (é a razão de existir o golden de
 *     order-sensitivity, §F);
 *   - `order` ausente ou não-inteiro (§B.1-1 exige explícito);
 *   - alocação não-única: o mesmo `deviceProfile` em mais de um nó (§R5);
 *   - `formula` apontando para uma `key` inexistente.
 */
export function validateTree(tree: ClassificationNode[]): string[] {
  const errors: string[] = [];
  const seenKeys = new Map<string, number>();
  const seenProfiles = new Map<string, string>();

  const walkLevel = (nodes: ClassificationNode[], parentPath: string): void => {
    const fallbacks = nodes.filter((n) => n.role === 'fallback');
    if (fallbacks.length > 1) {
      errors.push(
        `${parentPath}: ${fallbacks.length} nós role:'fallback' entre irmãos (esperado no máximo 1)`,
      );
    }
    if (fallbacks.length === 1) {
      const fb = fallbacks[0];
      // "Irmão real" = nó que CLASSIFICA. `ocultos` curto-circuita antes de tudo
      // e `residual`/`total` são computados (não recebem device), portanto nenhum
      // dos três pode ser sombreado pelo catch-all.
      const maxOther = nodes
        .filter((n) => n !== fb && n.role !== 'ocultos' && n.role !== 'residual' && n.role !== 'total')
        .reduce((m, n) => Math.max(m, n.order ?? 0), Number.NEGATIVE_INFINITY);
      if (maxOther !== Number.NEGATIVE_INFINITY && (fb.order ?? 0) <= maxOther) {
        errors.push(
          `${parentPath}: fallback "${fb.key}" tem order ${fb.order} <= ${maxOther} de um irmão real — o catch-all sombrearia a regra`,
        );
      }
    }
    for (const n of nodes) {
      const path = `${parentPath}/${n.key || '<sem key>'}`;
      if (!n.key) errors.push(`${path}: key vazia`);
      if (!n.label) errors.push(`${path}: label vazio`);
      if (!Number.isInteger(n.order)) {
        errors.push(`${path}: order ausente ou não-inteiro (RFC-0207 §B.1-1 exige explícito)`);
      }
      seenKeys.set(n.key, (seenKeys.get(n.key) ?? 0) + 1);
      for (const dp of n.rules?.deviceProfiles ?? []) {
        const k = up(dp);
        const owner = seenProfiles.get(k);
        if (owner && owner !== n.key) {
          errors.push(`alocação não-única: deviceProfile "${k}" em "${owner}" e "${n.key}"`);
        } else {
          seenProfiles.set(k, n.key);
        }
      }
      if (n.children?.length) walkLevel(n.children, path);
    }
  };
  walkLevel(tree ?? [], '');

  for (const [key, count] of seenKeys) {
    if (count > 1) errors.push(`key duplicada na árvore: "${key}" (${count}x)`);
  }
  for (const n of flattenTree(tree ?? [])) {
    const refs = [...(n.formula?.of ?? []), ...(n.formula?.subtract ?? [])];
    if (n.formula?.from) refs.push(n.formula.from);
    for (const ref of refs) {
      if (!seenKeys.has(ref)) errors.push(`formula de "${n.key}" referencia key inexistente "${ref}"`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Migração v1 → v2 (§J)
// ---------------------------------------------------------------------------

const LABELS: Record<string, string> = {
  ocultos: 'Ocultos',
  entrada: 'Entrada',
  lojas: 'Lojas',
  areacomum: 'Área Comum',
  caixadagua: "Caixa d'Água",
  banheiros: 'Banheiros',
  climatizavel: 'Climatizável',
  nao_climatizavel: 'Não Climatizável',
  climatizacao: 'Climatização',
  elevadores: 'Elevadores',
  escadas_rolantes: 'Escadas Rolantes',
  outros: 'Outros Equipamentos',
};

function labelFor(key: string): string {
  return LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/**
 * Levanta um domínio do documento v1 (`groups` + `categories`) para a árvore v2,
 * com `order` inteiro EXPLÍCITO e o fallback sempre no maior `order` do nível.
 *
 * Modelo do merge (§C do v2): as colunas e o breakdown viram UMA lista de nós de
 * topo. `lojas` e `entrada` são nós de coluna; as categorias do breakdown
 * (climatização/elevadores/escadas) viram nós irmãos; `outros` é o `fallback`;
 * `areacomum` deixa de ser um balde de devices e vira o nó COMPUTADO
 * "Pontos Não-Mapeados" (`residual`), exatamente como o v2 §H descreve.
 *
 * Quando o domínio não tem `categories` (água/temperatura), a árvore é só as
 * colunas — o walker não precisa saber a diferença.
 */
export function liftProfileToTree(
  profile: DeviceClassificationProfile = getActiveProfile(),
  domain: ClassificationDomain = 'energy',
): ClassificationNode[] {
  const dom: DomainProfile | undefined = profile?.domains?.[domain];
  if (!dom) return [];
  const tree: ClassificationNode[] = [];
  let order = 0;

  // ocultos — curto-circuito
  tree.push({
    key: 'ocultos',
    label: labelFor('ocultos'),
    role: 'ocultos',
    order: order++,
    rules: { profileContains: [...(dom.groups?.ocultosProfilePatterns ?? [])] },
  });

  const groupRules = (dom.groups?.rules ?? []).filter((r) => !r.fallback);
  const groupFallback = (dom.groups?.rules ?? []).find((r) => r.fallback);
  const cats = dom.categories;

  for (const r of groupRules) {
    tree.push({
      key: r.name,
      label: labelFor(r.name),
      role: r.name === 'entrada' ? 'entrada' : 'consumer',
      order: order++,
      rules: { deviceProfiles: [...(r.deviceProfiles ?? [])] },
    });
  }

  if (cats) {
    // atalho de loja: o nó `lojas` (coluna) também carrega o storeDeviceProfile
    const lojas = tree.find((n) => n.key === 'lojas');
    if (lojas && cats.storeDeviceProfile) {
      lojas.rules = lojas.rules ?? {};
      const list = lojas.rules.deviceProfiles ?? [];
      if (!list.some((v) => up(v) === up(cats.storeDeviceProfile))) list.push(cats.storeDeviceProfile);
      lojas.rules.deviceProfiles = list;
    }
    for (const r of cats.rules) {
      tree.push({
        key: r.name,
        label: labelFor(r.name),
        role: 'consumer',
        order: order++,
        rules: {
          deviceProfiles: [...(r.deviceProfiles ?? [])],
          profileContains: r.profileContains ? [...r.profileContains] : undefined,
          identifierExact: r.identifierFallback?.identifierEquals
            ? [...r.identifierFallback.identifierEquals]
            : undefined,
          identifierContains: r.identifierFallback?.identifierContains
            ? [...r.identifierFallback.identifierContains]
            : undefined,
          identifierPrefixes: r.identifierFallback?.identifierPrefixes
            ? [...r.identifierFallback.identifierPrefixes]
            : undefined,
          conditional: r.conditional ? { ...r.conditional } : undefined,
        },
      });
    }
    // fallback do nível — SEMPRE o maior order (§B.1-1)
    tree.push({
      key: cats.fallback?.name ?? 'outros',
      label: labelFor(cats.fallback?.name ?? 'outros'),
      role: 'fallback',
      order: order++,
    });
    // residual computado ("Pontos Não-Mapeados" / Área Comum) — §H-1
    if (groupFallback) {
      const consumers = tree
        .filter((n) => n.role === 'consumer' || n.role === 'fallback')
        .map((n) => n.key);
      tree.push({
        key: groupFallback.name,
        label: labelFor(groupFallback.name),
        role: 'residual',
        order: order++,
        formula: { op: 'subtract', from: 'entrada', subtract: consumers },
      });
    }
  } else if (groupFallback) {
    // domínios sem breakdown: o residual das colunas é o fallback de devices
    tree.push({
      key: groupFallback.name,
      label: labelFor(groupFallback.name),
      role: 'fallback',
      order: order++,
    });
  }

  return tree;
}
