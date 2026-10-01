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
  { byte: 12, prefix: 'HIDR', status: 'ratified', legacyLabel: 'switch' },
  { byte: 14, prefix: 'REM', status: 'ratified' },
  { byte: 15, prefix: '3F', status: 'ratified' },
  // Proposed, not ratified — DEVICE-PRODUCT-CODE-NUMBERING.md.
  { byte: 16, prefix: 'TEMP', status: 'draft' },
  { byte: 17, prefix: 'TANK', status: 'draft' },
  // Ratified 2026-08-25 (GCDR PR #39, DEVICE-NAME-SPEC.md §3a). Type-byte
  // entry only — the BOX device *profile*'s own fields/parsing stay out of
  // scope (RFC-0230 Non-goals). Registered here so a code with B4=18
  // decodes as BOX instead of falling through to the unknown-type
  // (`T{B4}`) fallback.
  { byte: 18, prefix: 'BOX', status: 'ratified' },
  // 19 is reserved in GCDR for BOX_GROUP (RFC-0058, optional) — intentionally
  // not registered here.
  // Central (gateway). Added 2026-10-01 at the owner's request; not yet in
  // GCDR's DEVICE-NAME-SPEC.md / DEVICE-PRODUCT-CODE-NUMBERING.md, so it is
  // carried as draft until ratified there. Type-byte entry only — a code
  // with B4=20 decodes as CENTRAL instead of the unknown-type (`T{B4}`)
  // fallback.
  { byte: 20, prefix: 'CENTRAL', status: 'draft' },
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
