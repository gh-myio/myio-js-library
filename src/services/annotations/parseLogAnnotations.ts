/**
 * RFC-0203 M2 (AC-11) — Defensive parser for SERVER_SCOPE `log_annotations`.
 *
 * The attribute value can arrive in several shapes (legacy, new schema, manual
 * edits in TB UI). This parser is tolerant: it accepts string-JSON, object
 * wrappers, plain arrays, null/undefined — and on any failure logs a warning
 * and returns `[]`. It NEVER throws.
 */

import type { Annotation, LogAnnotationsAttribute } from './types';

/**
 * Parse `log_annotations` from a SERVER_SCOPE attribute value.
 *
 * Accepted shapes:
 *   - `null` / `undefined`              → []
 *   - empty string `""`                 → []
 *   - JSON string of `LogAnnotationsAttribute`  → attribute.annotations
 *   - JSON string of `Annotation[]`     → array
 *   - object `{ annotations: [...] }`   → array
 *   - object `LogAnnotationsAttribute`  → attribute.annotations
 *   - direct array `Annotation[]`       → as-is
 *   - anything else                     → []  (with warn)
 *
 * @param raw the value returned by TB attributes API (`attribute.value`)
 * @param ctx optional context string for warning messages (deviceId, etc)
 * @returns Annotation[] — always a real array, never null/undefined.
 */
export function parseLogAnnotations(
  raw: unknown,
  ctx?: string,
  logger: Pick<Console, 'warn'> = console
): Annotation[] {
  if (raw == null || raw === '') return [];

  let value: unknown = raw;

  // String shape — try to parse as JSON
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (err) {
      logger.warn(
        `[parseLogAnnotations] JSON parse failed${ctx ? ` (${ctx})` : ''}:`,
        (err as Error)?.message ?? err
      );
      return [];
    }
  }

  // Array shape — assume Annotation[]
  if (Array.isArray(value)) {
    return _filterArray(value, ctx, logger);
  }

  // Object shape — look for `annotations`
  if (value !== null && typeof value === 'object') {
    const obj = value as Partial<LogAnnotationsAttribute>;
    if (Array.isArray(obj.annotations)) {
      return _filterArray(obj.annotations, ctx, logger);
    }
  }

  logger.warn(
    `[parseLogAnnotations] Unknown shape${ctx ? ` (${ctx})` : ''}; expected array, object{annotations}, or JSON string. Got:`,
    typeof value
  );
  return [];
}

/**
 * Internal: drops entries that are not plausible Annotation objects (defensive).
 * An entry must at minimum have `id`, `text`, `type`, `status` to be kept.
 */
function _filterArray(
  arr: unknown[],
  ctx: string | undefined,
  logger: Pick<Console, 'warn'>
): Annotation[] {
  const kept: Annotation[] = [];
  let dropped = 0;
  for (const item of arr) {
    if (
      item !== null &&
      typeof item === 'object' &&
      typeof (item as Annotation).id === 'string' &&
      typeof (item as Annotation).text === 'string' &&
      typeof (item as Annotation).type === 'string' &&
      typeof (item as Annotation).status === 'string'
    ) {
      kept.push(item as Annotation);
    } else {
      dropped++;
    }
  }
  if (dropped > 0) {
    logger.warn(
      `[parseLogAnnotations] dropped ${dropped} malformed entries${ctx ? ` (${ctx})` : ''}`
    );
  }
  return kept;
}
