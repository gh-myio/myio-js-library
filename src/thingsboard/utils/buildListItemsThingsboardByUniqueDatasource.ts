/**
 * Utility for building a list of items from ThingsBoard datasources and data
 * 
 * This module extracts and processes ThingsBoard widget context data to create
 * a standardized list of items with id, identifier, and label properties.
 */

/**
 * Item structure returned by the main function
 */
export interface ThingsBoardItem {
  id: string | null;
  identifier: string;
  label: string;
}

/**
 * Internal entity record structure used during processing
 */
interface EntityRecord {
  id: string | null;
  identifier: string | null;
  label: string | null;
  expectedKeys: Set<string>;
  attrs: Record<string, any>;
}

/**
 * Normalizes attribute keys to standard naming conventions
 * @param raw - Raw attribute key from ThingsBoard
 * @returns Normalized attribute key
 */
function normalizeAttrKey(raw: any): string {
  const k = String(raw || '').trim();
  const lower = k.toLowerCase();
  
  if (lower === 'ingestionid') return 'ingestionId';
  if (lower === 'identifier') return 'identifier';
  if (lower === 'label') return 'label';
  if (lower === 'id') return 'id';
  
  return k;
}

/**
 * Builds a map of entities from ThingsBoard datasources
 * @param datasources - Array of ThingsBoard datasources
 * @returns Map of entity records keyed by entityId
 */
function buildEntityMapFromDatasource(datasources: any[]): Map<string, EntityRecord> {
  const dsArray = Array.isArray(datasources) ? datasources : [];
  const map = new Map<string, EntityRecord>();

  dsArray.forEach((ds) => {
    const entityId = ds?.entityId;
    if (!entityId) return;

    if (!map.has(entityId)) {
      const entity = ds?.entity;
      const draftLabel = entity?.label || entity?.name || ds?.name || null;
      
      map.set(entityId, {
        id: entityId,
        identifier: null,
        label: draftLabel,
        expectedKeys: new Set(),
        attrs: {}
      });
    }

    const keys = Array.isArray(ds?.dataKeys) ? ds.dataKeys : [];
    const rec = map.get(entityId)!;
    
    keys.forEach((k) => {
      if (k?.name) {
        rec.expectedKeys.add(String(k.name).toLowerCase());
      }
    });
  });

  return map;
}

/**
 * Hydrates the entity map with actual data from ThingsBoard context
 * @param data - Array of data rows from ThingsBoard context
 * @param map - Entity map to hydrate
 */
function hydrateEntityMapWithCtxData(data: any[], map: Map<string, EntityRecord>): void {
  const rows = Array.isArray(data) ? data : [];

  rows.forEach((row) => {
    const entityId = row?.datasource?.entityId || null;
    if (!entityId || !map.has(entityId)) return;

    const rawKey = row?.dataKey?.name || '';
    if (!rawKey) return;

    const val = Array.isArray(row?.data) && Array.isArray(row.data[0]) ? row.data[0][1] : null;
    if (val == null) return;

    const rec = map.get(entityId)!;
    const attrKey = normalizeAttrKey(rawKey);

    if (attrKey === 'identifier') {
      rec.identifier = val;
    } else if (attrKey === 'label') {
      rec.label = val;
    } else if (attrKey === 'ingestionId') {
      rec.id = val;
    } else {
      rec.attrs[attrKey] = val;
    }
  });
}

/**
 * Builds a list of standardized items from ThingsBoard datasources and data
 * 
 * This function processes ThingsBoard widget context data to extract entity information
 * and create a standardized list of items. It handles attribute normalization,
 * entity mapping, and data hydration.
 * 
 * @param datasources - Array of ThingsBoard datasources from ctx.datasources
 * @param data - Array of data rows from ctx.data
 * @returns Array of standardized items with id, identifier, and label properties
 * 
 * @example
 * ```typescript
 * const items = buildListItemsThingsboardByUniqueDatasource(
 *   ctx.datasources,
 *   ctx.data
 * );
 * console.log(items); // [{ id: "123", identifier: "STORE001", label: "Store Name" }, ...]
 * ```
 */
export function buildListItemsThingsboardByUniqueDatasource(
  datasources: any[],
  data: any[]
): ThingsBoardItem[] {
  // Build entity map from datasources
  const map = buildEntityMapFromDatasource(datasources);
  
  // Hydrate map with actual data
  hydrateEntityMapWithCtxData(data, map);

  // Convert map to standardized items array
  const items = Array.from(map.values()).map((rec): ThingsBoardItem => ({
    id: rec.id,
    identifier: rec.identifier ?? rec.label ?? '',
    label: rec.label ?? rec.identifier ?? ''
  }));

  // Sort by label using Portuguese locale
  items.sort((a, b) => 
    String(a.label).localeCompare(String(b.label), "pt-BR")
  );

  return items;
}
