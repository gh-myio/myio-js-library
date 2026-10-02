/**
 * RFC-0230 — productTypeRegistry: closed, bijective map between a device
 * product code's B4 (product type) byte and its canonical device-name
 * prefix. This is the ONLY mapping used by encode/decode/format — it is
 * what makes the code<->name conversion lossless. Do not confuse with
 * `functionalKeywordRegistry`, which is open/lossy and display-only.
 */

export type ProductTypeStatus = 'ratified' | 'draft';

export interface ProductTypeEntry {
  readonly byte: number;
  readonly prefix: string;
  readonly status: ProductTypeStatus;
  /** Legacy/internal label for the byte, if any — never emitted as a name prefix. */
  readonly legacyLabel?: string;
}

const ENTRIES: readonly ProductTypeEntry[] = [
  // DEVICE-NAME-SPEC.md §3a. `12` was originally documented as `switch`;
  // GCDR reconciled it to the hydrometer device type. The decodable name
  // prefix is HIDR — `switch` survives only as the byte's legacy/internal
  // label (GCDR's own generator UI shows it as "12 · switch/HIDR").
  // Thermostats and tank-level sensors are manufactured on this same switch
  // hardware, so they are also 12 — they have no type byte of their own
  // (the former 16=TEMP / 17=TANK drafts were a misreading; removed 2026-10-01).
  { byte: 12, prefix: 'HIDR', status: 'ratified', legacyLabel: 'switch' },
  { byte: 14, prefix: 'REM', status: 'ratified' },
  { byte: 15, prefix: '3F', status: 'ratified' },
  // 16, 17 and 18 are intentionally not registered (see above for 16/17; 18
  // was BOX until it moved to 50). 19 is reserved in GCDR for BOX_GROUP
  // (RFC-0058, optional). All of them fall through to the `T{B4}` fallback.
  // Central (gateway). Ratified by the owner on 2026-10-01. Type-byte entry
  // only — a code with B4=20 decodes as CENTRAL instead of the unknown-type
  // (`T{B4}`) fallback.
  { byte: 20, prefix: 'CENTRAL', status: 'ratified' },
  // BOX (device enclosure, GCDR RFC-0058). Ratified by the owner on 2026-10-01
  // as byte 50; GCDR's docs had only ever *proposed* 18. Type-byte entry only
  // — the BOX device *profile*'s own fields/parsing stay out of scope
  // (RFC-0230 Non-goals).
  // GCDR's specs are being updated to match (see
  // gcdr.git/docs/specs/rules-devices-code/v2/DEVICE-NAME-SPEC-updates-draft.md).
  { byte: 50, prefix: 'BOX', status: 'ratified' },
];

const BY_BYTE = new Map<number, ProductTypeEntry>(ENTRIES.map((e) => [e.byte, e]));
const BY_PREFIX = new Map<string, ProductTypeEntry>(ENTRIES.map((e) => [e.prefix, e]));

export function getProductTypeEntryByByte(byte: number): ProductTypeEntry | undefined {
  return BY_BYTE.get(byte);
}

export function getProductTypeEntryByPrefix(prefix: string): ProductTypeEntry | undefined {
  return BY_PREFIX.get(prefix);
}

export function listProductTypeEntries(): readonly ProductTypeEntry[] {
  return ENTRIES;
}
