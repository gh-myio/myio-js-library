/**
 * Customer naming & code utilities (RFC-0206, Phase 1).
 *
 * A cohesive per-entity module (mirrors `device.ts`) for everything related to
 * turning a customer name into a stable code:
 *
 *  - `generateCustomerCode()` — the authoritative opaque code `C-<plate>-<plate>`.
 *  - `slugifyCustomerName()`  — a legacy name-derived abbreviation for
 *     suggestions/display only (ported from gcdr-frontend `generateCode`).
 *  - `checkCustomerCodeAvailable()` / `pickUniqueCustomerCode()` — uniqueness
 *     verification against the GCDR customers API (config injected, no hard-coded
 *     host, framework-neutral).
 *
 * @module customer
 * @see RFC-0206
 */

import { generateMercosulPlate } from './device';

/**
 * Generates an opaque, collision-resistant customer code: `C-<plate>-<plate>`
 * (e.g. `C-XDN5R48-JQE6K43`), where each `<plate>` is a 7-char Mercosul plate
 * (alphabet without the ambiguous glyphs `I/O/0/1`).
 *
 * The double-plate keyspace (~2.9 x 10^16 combinations) makes accidental
 * collisions effectively impossible. For authoritative uniqueness against
 * existing records use {@link pickUniqueCustomerCode}.
 */
export function generateCustomerCode(): string {
  return `C-${generateMercosulPlate()}-${generateMercosulPlate()}`;
}

/** Matches a well-formed customer code: `C-<plate>-<plate>`. */
export const CUSTOMER_CODE_RE =
  /^C-[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}-[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}$/;

/** Returns `true` when `code` is a syntactically valid customer code. */
export function isCustomerCode(code?: string | null): boolean {
  return typeof code === 'string' && CUSTOMER_CODE_RE.test(code);
}

/**
 * Portuguese/English stopwords dropped by {@link slugifyCustomerName}.
 * Exported so consumers can build an extended set if needed.
 */
export const CUSTOMER_NAME_STOPWORDS: ReadonlySet<string> = new Set([
  'de', 'da', 'do', 'dos', 'das', 'e', 'a', 'o', 'em',
  'the', 'of', 'and', 'in',
]);

/**
 * Legacy name-derived abbreviation, ported verbatim from the gcdr-frontend
 * `generateCode`: strip diacritics -> drop stopwords -> UPPERCASE -> keep the
 * first 5 alphanumeric chars of each remaining word -> join with `-`.
 *
 * Example: `"Shopping Patio Central"` -> `"SHOPP-PATIO-CENTR"`.
 *
 * This is a **display/suggestion** helper, NOT the authoritative code: it is
 * neither collision-resistant nor stable across renames. Mint the real code
 * with {@link generateCustomerCode} / {@link pickUniqueCustomerCode}.
 *
 * @param name        raw customer name
 * @param stopwords   optional override for the dropped-word set
 */
export function slugifyCustomerName(
  name: string,
  stopwords: ReadonlySet<string> = CUSTOMER_NAME_STOPWORDS
): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopwords.has(w.toLowerCase()))
    .map((w) => w.replace(/[^A-Z0-9]/g, '').slice(0, 5))
    .filter(Boolean)
    .join('-');
}

/** Injected configuration for the customer code uniqueness check. */
export interface CodeCheckConfig {
  /** Base URL of the GCDR API, e.g. `https://gcdr.api.example` (trailing slash optional). */
  baseUrl: string;
  /** Bearer token, sent as `Authorization: Bearer <token>` when present. */
  token?: string;
  /** Injectable fetch (defaults to the global `fetch`) — for tests / non-browser hosts. */
  fetch?: typeof fetch;
  /** Optional abort signal forwarded to the request. */
  signal?: AbortSignal;
  /**
   * Max attempts for {@link pickUniqueCustomerCode} before giving up.
   * @default 256
   */
  maxAttempts?: number;
}

/** Pulls a customer array out of the various GCDR response envelopes. */
function extractItems(json: unknown): Array<Record<string, unknown>> {
  const j = json as Record<string, unknown> | null;
  if (!j || typeof j !== 'object') return [];
  const candidates = [
    (j as { items?: unknown }).items,
    (j as { data?: { items?: unknown } }).data?.items,
    (j as { data?: unknown }).data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Array<Record<string, unknown>>;
  }
  return [];
}

/**
 * Returns `true` when no existing customer carries this exact `code`.
 *
 * Strategy A (no backend change): queries `GET /customers?search=<code>` and
 * checks the returned page for an exact `code` match. Tolerant of the common
 * GCDR response envelopes (`{ items }`, `{ data: { items } }`, `{ data: [...] }`).
 * If/when the backend adds a dedicated `GET /customers/check-code` endpoint
 * (RFC-0206 Unresolved Q1), only this function changes.
 *
 * @throws if the HTTP request fails (non-2xx) — callers decide how to degrade.
 */
export async function checkCustomerCodeAvailable(
  code: string,
  cfg: CodeCheckConfig
): Promise<boolean> {
  const doFetch = cfg.fetch || fetch;
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const url = `${base}/customers?search=${encodeURIComponent(code)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const res = await doFetch(url, { headers, signal: cfg.signal });
  if (!res.ok) {
    throw new Error(`checkCustomerCodeAvailable: HTTP ${res.status}`);
  }
  const json = await res.json();
  const items = extractItems(json);
  return !items.some((it) => String(it.code) === code);
}

/**
 * Generates customer codes and verifies them against the API, returning the
 * first available one. Retries on collision up to `cfg.maxAttempts` (default
 * 256), mirroring presetup's `pickUniqueMercosul`.
 *
 * @throws if no free code is found within the attempt budget.
 */
export async function pickUniqueCustomerCode(cfg: CodeCheckConfig): Promise<string> {
  const maxAttempts = cfg.maxAttempts ?? 256;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCustomerCode();
    // eslint-disable-next-line no-await-in-loop -- sequential by design: stop at first free code
    if (await checkCustomerCodeAvailable(code, cfg)) return code;
  }
  throw new Error(
    `pickUniqueCustomerCode: no available code after ${maxAttempts} attempts`
  );
}
