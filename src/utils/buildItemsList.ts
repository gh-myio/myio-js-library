/**
 * RFC-0182 — Build the list of `StoreItem` for a given (domain, group) pair.
 *
 * Mirrors the v-5.2.0 production helper at
 * `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js
 * ::_buildItemsList`, but operates on the canonical Phase-1 `STATE.itemsBase`
 * instead of the v-5.2.0 orchestrator's `getEnergyGroups()/getWaterGroups()/
 * getTemperatureGroups()` accessors.
 *
 * The returned `StoreItem.id` is the device `ingestionId` so the
 * `AllReportModal` server-side filter (`orchIdSet`) can match the GCDR API
 * response items by `api.item.id` (RFC-0182).
 *
 * Group-key vocabulary kept in sync with the MENU widget's `DOMAINS` table
 * (`_renderReportsPicker`) and the per-domain `categorizeItemsByGroup*`
 * functions in v-5.2.0/MAIN_VIEW.
 *
 * @public
 */

import type { BaseItem } from '../types/BaseItem';
import type { StoreItem } from '../components/premium-modals/types';

/** Domain bucket. */
export type ItemsListDomain = 'energy' | 'water' | 'temperature';

/**
 * All group keys understood by `buildItemsList`. The canonical mapping to
 * v-5.2.0 categorization (and to the `AllReportModal.resolveTitle()` table)
 * is:
 *
 * Energy   — `entrada`, `lojas`, `area_comum`, `todos`
 * Water    — `entrada`, `lojas`, `area_comum`, `banheiros`, `todos`
 * Temperature — `climatizavel`, `nao_climatizavel`, `todos`
 *
 * For convenience and back-compat with the MenuView taxonomy this type also
 * allows the lower-level RFC-0111 context names (`stores`, `equipments`,
 * `hidrometro`, `hidrometro_entrada`, `hidrometro_area_comum`,
 * `termostato`, `termostato_external`) — they resolve to the same group sets.
 */
export type ItemsListGroup =
  // Cross-domain "all" bucket
  | 'todos'
  // Energy group keys (production: openReportsPickerModal)
  | 'entrada'
  | 'lojas'
  | 'area_comum'
  // Energy aliases (RFC-0111 context names, used by MenuView)
  | 'stores'
  | 'equipments'
  // Water group keys (production)
  | 'banheiros'
  // Water aliases
  | 'hidrometro_entrada'
  | 'hidrometro_area_comum'
  | 'hidrometro'
  // Temperature group keys (production)
  | 'climatizavel'
  | 'nao_climatizavel'
  // Temperature aliases
  | 'termostato'
  | 'termostato_external';

/** Mapping from group key → human-readable section label (RFC-0182, used
 *  when building the "todos" multi-section view in `AllReportModal`). */
const GROUP_LABELS: Record<string, string> = {
  lojas: 'Lojas',
  entrada: 'Entrada',
  area_comum: 'Área Comum',
  banheiros: 'Banheiros',
  climatizavel: 'Climatizável',
  nao_climatizavel: 'Não Climatizável',
};

/** Normalize input to upper-cased string for safe `includes`/equality tests. */
function up(value: unknown): string {
  return String(value ?? '').toUpperCase();
}

/** Energy: entrada predicate — deviceProfile ∈ {ENTRADA, RELOGIO, TRAFO, SUBESTACAO}. */
function isEnergyEntrada(item: BaseItem): boolean {
  const dp = up(item.deviceProfile);
  const dt = up(item.deviceType);
  return (
    dp === 'ENTRADA' ||
    dp === 'RELOGIO' ||
    dp === 'TRAFO' ||
    dp === 'SUBESTACAO' ||
    dt === 'ENTRADA' ||
    dt === 'RELOGIO' ||
    dt === 'TRAFO' ||
    dt === 'SUBESTACAO'
  );
}

/** Energy: lojas predicate — deviceProfile = `3F_MEDIDOR` exact match. */
function isEnergyLojas(item: BaseItem): boolean {
  return up(item.deviceProfile) === '3F_MEDIDOR';
}

/** Energy: area_comum predicate — anything that's energy and not entrada/lojas. */
function isEnergyAreaComum(item: BaseItem): boolean {
  return !isEnergyEntrada(item) && !isEnergyLojas(item);
}

/** Water: entrada predicate — deviceProfile = HIDROMETRO_SHOPPING. */
function isWaterEntrada(item: BaseItem): boolean {
  return up(item.deviceProfile) === 'HIDROMETRO_SHOPPING';
}

/** Water: area_comum predicate — deviceProfile = HIDROMETRO_AREA_COMUM. */
function isWaterAreaComum(item: BaseItem): boolean {
  return up(item.deviceProfile) === 'HIDROMETRO_AREA_COMUM';
}

/** Water: lojas predicate — deviceProfile = HIDROMETRO. */
function isWaterLojas(item: BaseItem): boolean {
  return up(item.deviceProfile) === 'HIDROMETRO';
}

/** Water: banheiros predicate — area-comum profile + identifier 'BANHEIROS'. */
function isWaterBanheiros(item: BaseItem): boolean {
  return up(item.deviceProfile) === 'HIDROMETRO_AREA_COMUM' && up(item.identifier) === 'BANHEIROS';
}

/** Temperature: climatizavel predicate (everything not external). */
function isTemperatureClimatizavel(item: BaseItem): boolean {
  return up(item.deviceProfile) !== 'TERMOSTATO_EXTERNAL';
}

/** Temperature: nao_climatizavel predicate. */
function isTemperatureNaoClimatizavel(item: BaseItem): boolean {
  return up(item.deviceProfile) === 'TERMOSTATO_EXTERNAL';
}

/** Convert a `BaseItem` to the `StoreItem` shape expected by `AllReportModal`. */
function toStoreItem(item: BaseItem, groupLabel?: string): StoreItem {
  const id = String(item.ingestionId || item.id || '');
  const identifier = String(item.identifier || item.label || item.name || '');
  const label = String(item.label || item.labelOrName || item.name || item.identifier || '');

  const result: StoreItem = { id, identifier, label };
  if (groupLabel) {
    (result as StoreItem & { groupLabel?: string }).groupLabel = groupLabel;
  }
  return result;
}

/**
 * Build the list of `StoreItem` for the requested (domain, group) pair from
 * the canonical `STATE.itemsBase` baseline.
 *
 * Behaviour:
 * - Filters `itemsBase` by `domain` first.
 * - Applies the group predicate (or "all groups" when `group === 'todos'`).
 * - Maps each surviving `BaseItem` to `StoreItem` with `id = ingestionId`.
 *
 * `'todos'` returns every item in the domain's recognised groups, each
 * tagged with a `groupLabel` so `AllReportModal` can render section headers.
 *
 * @param domain  Target domain bucket (`'energy' | 'water' | 'temperature'`).
 * @param group   Group key (see `ItemsListGroup`).
 * @param itemsBase Canonical baseline from `window.STATE.itemsBase`.
 * @returns `StoreItem[]` matching the (domain, group) pair.
 *
 * @public
 */
export function buildItemsList(
  domain: ItemsListDomain,
  group: ItemsListGroup,
  itemsBase: BaseItem[],
): StoreItem[] {
  if (!Array.isArray(itemsBase) || itemsBase.length === 0) return [];

  const inDomain = itemsBase.filter((it) => it && it.domain === domain);

  // "todos" — every recognised group, tagged with its label.
  if (group === 'todos') {
    if (domain === 'energy') {
      const out: StoreItem[] = [];
      for (const item of inDomain) {
        if (isEnergyEntrada(item)) out.push(toStoreItem(item, GROUP_LABELS.entrada));
        else if (isEnergyLojas(item)) out.push(toStoreItem(item, GROUP_LABELS.lojas));
        else out.push(toStoreItem(item, GROUP_LABELS.area_comum));
      }
      return out;
    }
    if (domain === 'water') {
      const out: StoreItem[] = [];
      for (const item of inDomain) {
        if (isWaterEntrada(item)) out.push(toStoreItem(item, GROUP_LABELS.entrada));
        else if (isWaterBanheiros(item)) out.push(toStoreItem(item, GROUP_LABELS.banheiros));
        else if (isWaterAreaComum(item)) out.push(toStoreItem(item, GROUP_LABELS.area_comum));
        else if (isWaterLojas(item)) out.push(toStoreItem(item, GROUP_LABELS.lojas));
        else out.push(toStoreItem(item, GROUP_LABELS.area_comum));
      }
      return out;
    }
    // temperature
    const out: StoreItem[] = [];
    for (const item of inDomain) {
      if (isTemperatureNaoClimatizavel(item)) {
        out.push(toStoreItem(item, GROUP_LABELS.nao_climatizavel));
      } else {
        out.push(toStoreItem(item, GROUP_LABELS.climatizavel));
      }
    }
    return out;
  }

  // Single-group filter — no groupLabel. Some keys are shared across domains
  // (`entrada`, `lojas`, `area_comum`) so the predicate is domain-aware.
  let predicate: (item: BaseItem) => boolean;

  switch (group) {
    // Shared keys — predicate selected by domain.
    case 'entrada':
      predicate = domain === 'water' ? isWaterEntrada : isEnergyEntrada;
      break;
    case 'lojas':
    case 'stores':
      predicate = domain === 'water' ? isWaterLojas : isEnergyLojas;
      break;
    case 'area_comum':
      predicate = domain === 'water' ? isWaterAreaComum : isEnergyAreaComum;
      break;

    // Energy-only RFC-0111 alias.
    case 'equipments':
      // "everything that is not stores/entrada" — the v-5.2.0 area_comum bucket.
      predicate = isEnergyAreaComum;
      break;

    // Water-only keys.
    case 'banheiros':
      predicate = isWaterBanheiros;
      break;
    case 'hidrometro_entrada':
      predicate = isWaterEntrada;
      break;
    case 'hidrometro_area_comum':
      predicate = isWaterAreaComum;
      break;
    case 'hidrometro':
      predicate = isWaterLojas;
      break;

    // Temperature keys.
    case 'climatizavel':
    case 'termostato':
      predicate = isTemperatureClimatizavel;
      break;
    case 'nao_climatizavel':
    case 'termostato_external':
      predicate = isTemperatureNaoClimatizavel;
      break;

    default: {
      // Unknown group — be defensive and return [].
      return [];
    }
  }

  return inDomain.filter(predicate).map((item) => toStoreItem(item));
}
