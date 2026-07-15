/**
 * Goals coverage helpers — RFC-0046 Addendum A (GCDR Goals API, July 2026 release).
 *
 * GET /customers/:id/goals responses now expose `hoursCovered` and, when a goal
 * series covers less than 100% of the year's hour slots, `coverageGaps`:
 *   { missing: string[], truncated: boolean, missingHours: number }
 * `missing` uses the coarsest compact ref per hole — whole month "YYYY-MM",
 * whole day "YYYY-MM-DD", else hour "YYYY-MM-DDThh" — capped at 12 refs.
 *
 * These helpers turn that payload into the pt-BR warning text used by the
 * goals UIs (GoalsPanel, GoalsModal, Metas × Consumo).
 */

export interface GoalsCoverageGaps {
  missing?: string[];
  truncated?: boolean;
  missingHours?: number;
}

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Compact coverage ref → pt-BR label.
 *   "2026-02"        → "Fev"
 *   "2026-04-15"     → "15 Abr"
 *   "2026-05-01T08"  → "1 Mai 08h"
 * Unknown shapes pass through unchanged.
 */
export function formatCoverageRefPtBR(ref: string): string {
  const s = String(ref || '');
  let m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) return MONTHS_PT[Number(m[2]) - 1] || s;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${Number(m[3])} ${MONTHS_PT[Number(m[2]) - 1] || m[2]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(s);
  if (m) return `${Number(m[3])} ${MONTHS_PT[Number(m[2]) - 1] || m[2]} ${m[4]}h`;
  return s;
}

/**
 * Warning sentence for a series with coverage gaps, e.g.:
 * "A meta GERAL deste domínio/ano não cobre 100% dos dias e horas.
 *  Faltam: Fev, Mar, 15 Abr… (~8.016h)"
 *
 * @param gaps        coverageGaps payload from the GET response
 * @param seriesLabel "GERAL" (consolidated) or the meter label ("medidor X")
 */
export function buildCoverageWarningTextPtBR(
  gaps: GoalsCoverageGaps | null | undefined,
  seriesLabel = 'GERAL'
): string {
  const refs = (gaps?.missing || []).map(formatCoverageRefPtBR);
  const hours = Number(gaps?.missingHours) || 0;
  const list = refs.join(', ') + (gaps?.truncated ? '…' : '');
  const hoursTxt = hours > 0 ? ` (~${hours.toLocaleString('pt-BR')}h)` : '';
  const missTxt = list ? ` Faltam: ${list}${hoursTxt}` : hoursTxt ? ` Faltam${hoursTxt}` : '';
  return `A meta ${seriesLabel} deste domínio/ano não cobre 100% dos dias e horas.${missTxt}`;
}

/** True when the payload carries any actionable gap information. */
export function hasCoverageGaps(gaps: GoalsCoverageGaps | null | undefined): boolean {
  return !!(gaps && ((gaps.missing && gaps.missing.length > 0) || (Number(gaps.missingHours) || 0) > 0));
}
