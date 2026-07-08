/**
 * Adapter for the GCDR Generic Entity Registry (RFC-0047) classification tree.
 *
 * The endpoint `GET /entities/resolve?customerId=…&deep=all` (RFC-0047) returns the
 * customer's EFFECTIVE taxonomy (own override if any, else the system default) as
 * `{ data: { source, version, roots: [...] } }` — a hierarchy of GROUP/PROFILE entities:
 *   - level 0 (parentEntityId=null, GROUP) → DOMAIN        (entityKey 'energy', value 'Energia')
 *   - level 1 (GROUP)                      → COLUMN         (entityKey 'energy-entry', value 'Entrada de Energia')
 *   - deeper GROUPs                        → sub-groups     (entityKey 'climatizacao', value 'Climatização')
 *   - leaves (PROFILE)                     → deviceProfiles (entityKey 'CHILLER', value 'Chiller')
 *
 * This adapter flattens that tree into a domain/column model the dashboard can
 * iterate WITHOUT hard-coding any domain or column name — everything comes from
 * the customer's GCDR data, so a customer may have any domains (gas, only water…)
 * and any number of columns/groups.
 */

export interface EntityNode {
  id?: string;
  entityType?: string; // 'GROUP' | 'PROFILE'
  entityKey?: string; // domain/column key, or deviceProfile for leaves
  entityValue?: string; // display label
  sortOrder?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  children?: EntityNode[];
}

/** A column (level-1 group) of a domain, with every deviceProfile that maps to it. */
export interface ClassificationColumn {
  /** Column key (entityKey, e.g. 'energy-entry'). */
  key: string;
  /** Column display label (entityValue, e.g. 'Entrada de Energia'). */
  label: string;
  /** Sort order. */
  order: number;
  /** All deviceProfile keys (uppercased) that resolve to this column (deep). */
  profiles: string[];
}

/** A domain (level-0 group) with its ordered columns. */
export interface ClassificationDomainNode {
  /** Domain code (entityKey, e.g. 'energy'). */
  code: string;
  /** Domain display label (entityValue, e.g. 'Energia'). */
  label: string;
  /** Sort order. */
  order: number;
  /** Ordered columns. */
  columns: ClassificationColumn[];
}

/** Where a deviceProfile lives in the tree. */
export interface ProfileLocation {
  domain: string;
  column: string;
}

export interface ParsedClassificationTree {
  /** Ordered domains (the dashboard iterates these — never a hard-coded list). */
  domains: ClassificationDomainNode[];
  /** deviceProfile (UPPERCASE) → { domain, column } for O(1) device routing. */
  profileIndex: Record<string, ProfileLocation>;
}

function up(s: unknown): string {
  return String(s ?? '').trim().toUpperCase();
}

function isUsable(node: EntityNode): boolean {
  return node.isActive !== false && node.isDeleted !== true;
}

/** Collect every PROFILE entityKey under a node (deep), in sort order. */
function collectProfiles(node: EntityNode): string[] {
  const out: string[] = [];
  const walk = (n: EntityNode) => {
    const kids = [...(n.children ?? [])]
      .filter(isUsable)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const child of kids) {
      if ((child.entityType ?? '').toUpperCase() === 'PROFILE') {
        const key = up(child.entityKey);
        if (key && !out.includes(key)) out.push(key);
      }
      walk(child); // descend (sub-groups may hold more profiles)
    }
  };
  walk(node);
  return out;
}

/**
 * Parses the entities endpoint response (or its `items` array) into the
 * domain/column model + a deviceProfile index.
 */
export function parseClassificationEntities(
  response: unknown,
): ParsedClassificationTree {
  // Accept every GCDR shape:
  //  - /entities/resolve  → { success, data: { source, version, roots: [...] } }   (the dashboard path)
  //  - paginated list     → { success, data: { items: [...] } }  or  { data: [...] }
  //  - bare array / items  → [...]  or  { items: [...] }  or  { roots: [...] }
  const r = response as Record<string, unknown> | undefined;
  const data = r?.data as Record<string, unknown> | EntityNode[] | undefined;
  const items: EntityNode[] = Array.isArray(response)
    ? (response as EntityNode[])
    : (((data as Record<string, unknown>)?.roots ??
        (data as Record<string, unknown>)?.items ??
        (Array.isArray(data) ? data : undefined) ??
        (r?.roots as unknown) ??
        (r?.items as unknown) ??
        []) as EntityNode[]);

  const domains: ClassificationDomainNode[] = [];
  const profileIndex: Record<string, ProfileLocation> = {};

  const topGroups = [...items]
    .filter((n) => isUsable(n) && (n.entityType ?? '').toUpperCase() === 'GROUP')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const domainNode of topGroups) {
    const code = String(domainNode.entityKey ?? '');
    if (!code) continue;

    const columns: ClassificationColumn[] = [];
    const colNodes = [...(domainNode.children ?? [])]
      .filter((n) => isUsable(n) && (n.entityType ?? '').toUpperCase() === 'GROUP')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const colNode of colNodes) {
      const colKey = String(colNode.entityKey ?? '');
      if (!colKey) continue;
      const profiles = collectProfiles(colNode);
      columns.push({
        key: colKey,
        label: String(colNode.entityValue ?? colKey),
        order: colNode.sortOrder ?? 0,
        profiles,
      });
      for (const p of profiles) {
        // First occurrence wins (unique allocation); don't overwrite.
        if (!profileIndex[p]) profileIndex[p] = { domain: code, column: colKey };
      }
    }

    domains.push({
      code,
      label: String(domainNode.entityValue ?? code),
      order: domainNode.sortOrder ?? 0,
      columns,
    });
  }

  return { domains, profileIndex };
}
