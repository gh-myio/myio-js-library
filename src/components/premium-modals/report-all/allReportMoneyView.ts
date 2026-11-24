/**
 * ED-1391 — All Report 100% em R$ (RFC-0241 rev. 4).
 *
 * Camada de apresentação **pura** (strings in/out, sem DOM, sem fetch) usada pelo
 * AllReportModal em modo R$: célula por device, total, KPIs e resumo de grupo. O modo
 * físico não passa por aqui (byte-idêntico).
 *
 * Regras (decisões do owner, ED-1391):
 *  - device completo → valor em R$; sem tarifa / parcial / sem categoria → `-` + chip;
 *  - device **fora da valoração** (Entrada / Transformadores, RFC-0241 Q8 — `itemMoney`
 *    devolve `null`) → `-` + "Não valorado", e fica **fora** do total (não conta como
 *    falta de cobertura);
 *  - total = `round(Σ raw)` só dos devices valoráveis, e só quando **todos** estão
 *    completos; senão `-` + "Cobertura incompleta (n de m)" — nunca soma parcial, nunca
 *    `R$ 0`, nunca `NaN` (DEC-8 / RFC-0241 §5.6).
 *
 * Valores monetários são strings decimais; a única aritmética é BigInt em centavos.
 */
import type { AllReportMoneyConfig } from '../types';
import { formatBRL as formatMoneyBRL } from '../../financial-goals/moneyFormat';
import { roundMoney2, moneyReasonText, moneyStateChipLabel } from '../../financial-goals/tariffValuation';
import { decimalStringToCents, centsToDecimalString, sumMoneyDecimals } from '../../financial-goals/reportMoneyColumn';
import { MONEY_NO_VALUE, MONEY_INCOMPLETE_LABEL, MONEY_REPORT_HEADER } from '../../financial-goals/moneyDisplay';

export { MONEY_NO_VALUE };

/** Cabeçalho da coluna de valor em modo R$ (substitui "Consumo (kWh)"). */
export const MONEY_VALUE_HEADER = MONEY_REPORT_HEADER; // 'Custo estimado (R$)'
/** Cabeçalho do % em modo R$ — a participação continua física (ED-1389 / ED-1391 D4). */
export const MONEY_PERC_HEADER = '% consumo';
/** Chip/estado de um device fora da valoração (Entrada / Transformadores). */
export const MONEY_NOT_VALUED_LABEL = 'Não valorado';
export const MONEY_NOT_VALUED_TEXT = 'Entrada e transformadores não são valorados em R$.';

/** Linha mínima que a camada precisa (subset de StoreReading). */
export interface MoneyRowLike {
  id?: string | null;
  name: string;
  consumption: number;
}

type ItemMoneyLike = { state: string; amount?: string; reason?: string };

export interface RowMoneyView {
  /** `out` = fora da valoração (não entra no total nem na contagem de cobertura). */
  scope: 'in' | 'out';
  /** `complete` | `partial` | `missing` | `uncategorized` | `not-valued`. */
  state: string;
  /** Valor 2dp (string decimal) quando completo; senão `null`. */
  amount: string | null;
  /** Texto da célula: `"1.234,56"` (sem prefixo — o cabeçalho diz R$) ou `-`. */
  text: string;
  /** Rótulo do chip (`""` quando completo). */
  chip: string;
  /** Explicação (title / nota do export). */
  reason: string;
}

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** `"1234.5"` → `"1.234,50"` (pt-BR, sem `R$`); inválido/null → `-`. String-only. */
export function moneyCellText(amount: string | null | undefined): string {
  const r = roundMoney2(amount ?? null);
  if (!r) return MONEY_NO_VALUE;
  return formatMoneyBRL(r).replace(/^R\$\s?/, '');
}

/** `"1234.5"` → `"R$ 1.234,50"`; inválido/null → `-` (nunca `—`, nunca `R$ 0`). */
export function moneyText(amount: string | null | undefined): string {
  const r = roundMoney2(amount ?? null);
  return r ? formatMoneyBRL(r) : MONEY_NO_VALUE;
}

/** `"1234.56"` → `"1234,56"` (CSV, vírgula decimal); null → `-`. */
export function moneyCsvText(amount: string | null | undefined): string {
  const r = roundMoney2(amount ?? null);
  return r ? r.replace('.', ',') : MONEY_NO_VALUE;
}

/** Número para ordenação / gráfico / export numérico — só de um valor já 2dp. */
export function moneyNumber(amount: string | null | undefined): number | null {
  const r = roundMoney2(amount ?? null);
  if (!r) return null;
  const n = Number(r);
  return Number.isFinite(n) ? n : null;
}

/** `item.money` do device, ou `null` quando fora da valoração. */
export function itemMoneyOf(money: AllReportMoneyConfig | null | undefined, id: string | null | undefined): ItemMoneyLike | null {
  if (!money) return null;
  if (!id) return { state: 'missing', reason: 'no-data' }; // sem id não há como valorar: conta como faltante
  if (typeof money.itemMoney === 'function') return money.itemMoney(id) ?? null;
  // Fallback (configs sem itemMoney): perDevice lista exatamente os devices valoráveis.
  const per = money.perDevice || {};
  if (!Object.prototype.hasOwnProperty.call(per, id)) return null;
  const v = per[id];
  return typeof v === 'string' && v.trim() ? { state: 'complete', amount: v } : { state: 'missing', reason: 'no-tariff' };
}

/** Visão de UM device em modo R$. */
export function rowMoneyView(money: AllReportMoneyConfig | null | undefined, id: string | null | undefined): RowMoneyView {
  const m = itemMoneyOf(money, id);
  if (!m) {
    return {
      scope: 'out',
      state: 'not-valued',
      amount: null,
      text: MONEY_NO_VALUE,
      chip: MONEY_NOT_VALUED_LABEL,
      reason: MONEY_NOT_VALUED_TEXT,
    };
  }
  if (m.state === 'complete') {
    // perDevice já é o round2 do backend (DEC-8); o amount cru é só a reserva.
    const per = id ? money?.perDevice?.[id] : null;
    const amount = roundMoney2(typeof per === 'string' && per.trim() ? per : m.amount ?? null);
    if (amount) return { scope: 'in', state: 'complete', amount, text: moneyCellText(amount), chip: '', reason: '' };
  }
  const state = m.state === 'complete' ? 'missing' : m.state || 'missing';
  return {
    scope: 'in',
    state,
    amount: null,
    text: MONEY_NO_VALUE,
    chip: moneyStateChipLabel(state) || moneyStateChipLabel('missing'),
    reason: moneyReasonText(m.reason) || moneyReasonText('no-tariff'),
  };
}

/** HTML da célula na tela: valor (físico no title) ou `-` + chip. */
export function rowMoneyCellHTML(view: RowMoneyView, physicalTitle: string): string {
  if (view.amount) {
    return `<span data-money-cell="1" data-money-state="complete" title="${esc(physicalTitle)}">${esc(view.text)}</span>`;
  }
  const title = [view.chip, view.reason, physicalTitle].filter(Boolean).join(' — ');
  const notValued = view.scope === 'out';
  const chip =
    `<span class="myio-money-chip" data-money-state="${esc(view.state)}" title="${esc(title)}" ` +
    `style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font:600 10px Nunito,sans-serif;` +
    (notValued ? 'background:#f1f5f9;color:#64748b;' : 'background:#fef3c7;color:#92400e;') +
    `vertical-align:middle;white-space:nowrap;">${esc(view.chip)}</span>`;
  return `<span data-money-cell="1" data-money-state="${esc(view.state)}" title="${esc(title)}">${MONEY_NO_VALUE}</span>${chip}`;
}

export interface MoneyTotalView {
  /** `round(Σ raw)` 2dp dos devices valoráveis, só quando todos completos. */
  amount: string | null;
  /** `"R$ x"` ou `-`. */
  text: string;
  /** Devices valoráveis completos. */
  covered: number;
  /** Devices valoráveis (base do "n de m"). */
  scopeCount: number;
  /** Devices fora da valoração (fora do total). */
  outCount: number;
  /** `"Cobertura incompleta (n de m)"` ou `""`. */
  coverageNote: string;
  /** `"k não valorado(s) fora do total"` ou `""`. */
  outNote: string;
}

function notValuedNote(outCount: number, scopeCount: number): string {
  if (!outCount) return '';
  const word = outCount === 1 ? 'não valorado' : 'não valorados';
  return scopeCount ? `${outCount} ${word} fora do total` : `${outCount} ${word}`;
}

/**
 * Total honesto em R$ de `rows`: `totalFor(ids valoráveis)` (round Σ raw, RFC-0241) quando
 * o caller oferece; senão a soma 2dp em centavos BigInt. Fora da valoração → fora do total.
 */
export function moneyTotalView(money: AllReportMoneyConfig | null | undefined, rows: MoneyRowLike[]): MoneyTotalView {
  const views = rows.map((r) => rowMoneyView(money, r.id));
  const inIdx = views.map((v, i) => (v.scope === 'in' ? i : -1)).filter((i) => i >= 0);
  const scopeCount = inIdx.length;
  const outCount = rows.length - scopeCount;
  const covered = inIdx.filter((i) => !!views[i].amount).length;

  let amount: string | null = null;
  if (scopeCount > 0 && covered === scopeCount) {
    const ids = inIdx.map((i) => rows[i].id).filter((id): id is string => !!id);
    if (typeof money?.totalFor === 'function' && ids.length === scopeCount) {
      amount = roundMoney2(money.totalFor(ids));
    } else {
      amount = sumMoneyDecimals(inIdx.map((i) => views[i].amount));
    }
  }
  return {
    amount,
    text: moneyText(amount),
    covered,
    scopeCount,
    outCount,
    coverageNote: scopeCount > 0 && !amount ? `${MONEY_INCOMPLETE_LABEL} (${covered} de ${scopeCount})` : '',
    outNote: notValuedNote(outCount, scopeCount),
  };
}

/** Notas do total juntas (`"Cobertura incompleta (2 de 3) · 1 não valorado fora do total"`). */
export function moneyTotalNotes(total: MoneyTotalView): string {
  return [total.coverageNote, total.outNote].filter(Boolean).join(' · ');
}

/** Média em centavos, half-up — `"100.00" / 3` → `"33.33"`. null quando não há base. */
export function divideMoney(amount: string | null | undefined, n: number): string | null {
  const cents = decimalStringToCents(roundMoney2(amount ?? null));
  if (cents == null || !Number.isInteger(n) || n <= 0) return null;
  const d = BigInt(n);
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const q = (abs * 2n + d) / (2n * d); // round half up (away from zero)
  return centsToDecimalString(neg ? -q : q);
}

export interface MoneyKpi {
  value: string;
  label: string;
  sub?: string;
}

/** KPIs do summary em modo R$ (tela + faixa do PDF/XLS). */
export function moneyKpis(money: AllReportMoneyConfig | null | undefined, rows: MoneyRowLike[]): MoneyKpi[] {
  const total = moneyTotalView(money, rows);
  const complete = rows
    .map((r) => ({ row: r, view: rowMoneyView(money, r.id) }))
    .filter((x) => !!x.view.amount)
    .map((x) => ({ row: x.row, cents: decimalStringToCents(x.view.amount) as bigint, amount: x.view.amount as string }));

  const maxEntry = complete.reduce<(typeof complete)[number] | null>((b, e) => (!b || e.cents > b.cents ? e : b), null);
  const minEntry = complete
    .filter((e) => e.cents > 0n)
    .reduce<(typeof complete)[number] | null>((b, e) => (!b || e.cents < b.cents ? e : b), null);
  const zeroCount = rows.filter((r) => r.consumption <= 0).length;
  const avg = total.amount ? divideMoney(total.amount, total.scopeCount) : null;

  const notes = moneyTotalNotes(total);
  const kpis: MoneyKpi[] = [
    { value: String(rows.length), label: 'Dispositivos' },
    { value: total.text, label: 'Custo estimado total', ...(notes ? { sub: notes } : {}) },
    { value: moneyText(avg), label: 'Média por Dispositivo' },
    { value: maxEntry ? moneyText(maxEntry.amount) : MONEY_NO_VALUE, label: 'Máximo', ...(maxEntry?.row.name ? { sub: maxEntry.row.name } : {}) },
    { value: minEntry ? moneyText(minEntry.amount) : MONEY_NO_VALUE, label: 'Mínimo', ...(minEntry?.row.name ? { sub: minEntry.row.name } : {}) },
    { value: String(zeroCount), label: 'Sem Consumo' },
  ];

  // Devices valoráveis sem R$ completo, por estado ("2 Sem tarifa · 1 Tarifa parcial")
  const missing = rows.map((r) => rowMoneyView(money, r.id)).filter((v) => v.scope === 'in' && !v.amount);
  if (missing.length) {
    const byChip = new Map<string, number>();
    missing.forEach((v) => byChip.set(v.chip, (byChip.get(v.chip) || 0) + 1));
    const sub = Array.from(byChip.entries())
      .map(([chip, n]) => `${n} ${chip}`)
      .join(' · ');
    kpis.push({ value: String(missing.length), label: 'Sem tarifa', sub });
  }
  return kpis;
}

/**
 * Resumo do cabeçalho de grupo (tela e exports): `"3 dispositivos · R$ 1.234,56"`,
 * `"2 dispositivos · - · Cobertura incompleta (1 de 2)"` ou `"1 dispositivos · - · não valorado"`.
 */
export function moneyGroupSummary(money: AllReportMoneyConfig | null | undefined, rows: MoneyRowLike[]): string {
  const total = moneyTotalView(money, rows);
  const head = `${rows.length} dispositivos · ${total.text}`;
  if (total.scopeCount === 0) return `${head} · ${total.outCount === 1 ? 'não valorado' : 'não valorados'}`;
  const notes = moneyTotalNotes(total);
  return notes ? `${head} · ${notes}` : head;
}
