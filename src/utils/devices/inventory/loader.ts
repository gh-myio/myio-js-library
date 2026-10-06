/**
 * RFC-0237 — Inventory Panel v2: `entitiesQuery/find` request body and row parsing.
 *
 * Validated on the production tenant (RFC-0237 §10): `ownerName`/`ownerType`
 * come back as entity fields, `ownerId`/`customerId` come back EMPTY, `active`
 * and `lastActivityTime` are SERVER attributes, and every value is a string
 * (a missing key arrives as `{ ts: 0, value: "" }`).
 */

import type { InventoryDevice } from './types';

export const INVENTORY_ENTITY_FIELDS = ['name', 'label', 'type', 'createdTime', 'ownerName', 'ownerType'] as const;

export const INVENTORY_SERVER_ATTRIBUTES = [
  'deviceProfile',
  'identifier',
  'ingestionId',
  'gcdrDeviceId',
  'centralId',
  'slaveId',
  'lifecycleStatus',
  'active',
  'lastActivityTime',
] as const;

/** Body for `POST /api/entitiesQuery/find` — one request per page, sorted by name. */
export function buildEntitiesQueryBody(page: number, pageSize: number) {
  return {
    entityFilter: { type: 'entityType', entityType: 'DEVICE' },
    entityFields: INVENTORY_ENTITY_FIELDS.map((key) => ({ type: 'ENTITY_FIELD', key })),
    latestValues: INVENTORY_SERVER_ATTRIBUTES.map((key) => ({ type: 'SERVER_ATTRIBUTE', key })),
    pageLink: {
      page,
      pageSize,
      sortOrder: { key: { type: 'ENTITY_FIELD', key: 'name' }, direction: 'ASC' },
    },
  };
}

/** Blank = null/undefined, empty or whitespace, or the strings "null"/"undefined". */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === '' || /^(null|undefined)$/i.test(s);
}

/** Trimmed string, or null when blank. */
export function toText(value: unknown): string | null {
  return isBlank(value) ? null : String(value).trim();
}

/** `true` only for "true", `false` only for "false", null otherwise. Never JS truthiness. */
export function toBooleanStrict(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const s = toText(value);
  if (s === null) return null;
  const lower = s.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  return null;
}

/** Positive finite number, or null (0, NaN and blanks are treated as missing). */
export function toTimestamp(value: unknown): number | null {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type LatestBucket = Record<string, { ts?: number; value?: unknown } | undefined>;

interface RawEntityRow {
  entityId?: { id?: string };
  latest?: { ENTITY_FIELD?: LatestBucket; SERVER_ATTRIBUTE?: LatestBucket };
}

export interface ParseOptions {
  /** Customer title → customer id, from `/api/customers` (titles are unique per tenant). */
  customerIdByName?: Map<string, string>;
  /** false when the page holding the MYIO attributes failed to load. */
  attributesLoaded?: boolean;
}

/** Converts one `entitiesQuery/find` data row into an `InventoryDevice`. */
export function parseEntityRow(raw: RawEntityRow, options: ParseOptions = {}): InventoryDevice {
  const fields = raw.latest?.ENTITY_FIELD || {};
  const attrs = raw.latest?.SERVER_ATTRIBUTE || {};
  const field = (key: string) => fields[key]?.value;
  const attr = (key: string) => attrs[key]?.value;

  const ownerName = toText(field('ownerName'));
  const ownerType = toText(field('ownerType'));
  const customerId =
    ownerType === 'CUSTOMER' && ownerName ? options.customerIdByName?.get(ownerName) ?? null : null;

  return {
    id: String(raw.entityId?.id || ''),
    name: toText(field('name')) ?? '',
    label: toText(field('label')),
    type: toText(field('type')),
    createdTime: toTimestamp(field('createdTime')),
    ownerName,
    ownerType: ownerType ? ownerType.toUpperCase() : null,
    customerId,
    deviceProfile: toText(attr('deviceProfile')),
    identifier: toText(attr('identifier')),
    ingestionId: toText(attr('ingestionId')),
    gcdrDeviceId: toText(attr('gcdrDeviceId')),
    centralId: toText(attr('centralId')),
    slaveId: toText(attr('slaveId')),
    lifecycleStatus: toText(attr('lifecycleStatus')),
    active: toBooleanStrict(attr('active')),
    lastActivityTime: toTimestamp(attr('lastActivityTime')),
    attributesLoaded: options.attributesLoaded !== false,
  };
}
