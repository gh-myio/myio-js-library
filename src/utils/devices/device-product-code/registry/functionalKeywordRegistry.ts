/**
 * RFC-0230 — functionalKeywordRegistry: open, lossy vocabulary mirrored from
 * `src/NODE-RED/CENTRAL_PRE_SETUP/attributes-sync.js`'s `handleDeviceType()`
 * keyword matching. Display/formatting context only — NOT wired into
 * `decodeDeviceProductCode`/`deviceNameToDeviceProductCode`. A name using one
 * of these keywords as its prefix cannot be losslessly converted back to a
 * code, because the product-type byte cannot be derived from a functional
 * keyword alone.
 *
 * This module does not call into, replace, or modify attributes-sync.js —
 * it is a static, hand-mirrored copy of that function's return values for
 * documentation/consistency purposes only.
 */
export const FUNCTIONAL_KEYWORDS: readonly string[] = [
  'COMPRESSOR',
  'VENTILADOR',
  'ESCADA_ROLANTE',
  'ELEVADOR',
  'MOTOR',
  'RELOGIO',
  'ENTRADA',
  '3F_MEDIDOR',
  'HIDROMETRO',
  'CAIXA_DAGUA',
  'TANK',
  'SELETOR_AUTO_MANUAL',
  'TERMOSTATO',
  'SOLENOIDE',
  'GLOBAL_AUTOMACAO',
  'CONTROLE REMOTO',
];

export function isFunctionalKeywordPrefix(prefix: string): boolean {
  return FUNCTIONAL_KEYWORDS.includes(prefix.toUpperCase());
}
