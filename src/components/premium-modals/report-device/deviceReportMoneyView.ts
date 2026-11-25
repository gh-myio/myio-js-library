/**
 * ED-1390 — Report Device 100% em R$ (RFC-0241 rev. 5).
 *
 * Camada de apresentação **pura** (sem DOM, sem fetch) do DeviceReportModal em modo R$.
 * Cada linha (hora no 1h, dia no 1d) chega com o `money` já valorado pelo modal:
 *  - hora = `valuateBucket(id, h, h + 1h, qty)` (preço exato da hora, inclusive faixa horária);
 *  - dia  = `sumItemMoney(horas do dia)` — completo só se todas as horas estão completas.
 *
 * Regras (decisões do owner, ED-1390):
 *  - linha completa → valor em R$ (`1.234,56`; o cabeçalho diz R$);
 *  - sem tarifa / parcial / sem categoria → `-` + chip;
 *  - linha sem nenhuma leitura → `-` + "Sem dados", **fora** da contagem de cobertura;
 *  - total = `round(Σ raw)` das linhas com dados, só quando **todas** estão completas;
 *    senão `-` + "Cobertura incompleta (n de m)" — nunca soma parcial, nunca `R$ 0`;
 *  - gráfico em R$: só os dias completos (os demais ficam fora, com nota).
 */
import { moneyReasonText, moneyStateChipLabel, roundMoney2, sumItemMoney } from '../../financial-goals/tariffValuation';
import { decimalStringToCents } from '../../financial-goals/reportMoneyColumn';
import { MONEY_INCOMPLETE_LABEL } from '../../financial-goals/moneyDisplay';
import {
  MONEY_NO_VALUE,
  divideMoney,
  moneyCellText,
  moneyNumber,
  moneyText,
  type RowMoneyView,
} from '../report-all/allReportMoneyView';

/** Chip/estado de uma linha sem nenhuma leitura no intervalo. */
export const MONEY_NO_DATA_LABEL = 'Sem dados';
const NO_DATA_TEXT = 'Sem leituras neste intervalo.';

const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
/** Dia civil (America/Sao_Paulo, UTC-3 fixo) de um instante: `YYYY-MM-DD`. */
export const spDayKey = (ts: number): string => new Date(ts - SP_OFFSET_MS).toISOString().slice(0, 10);

const HOUR_MS = 60 * 60 * 1000;

/**
 * A série devolvida pelo fetcher é horária (ou mais fina) o bastante para valorar hora a hora?
 * O modo R$ precifica cada hora pelo preço daquela hora; um fetcher customizado que ignora
 * `granularity: '1h'` (ex.: devolve um ponto por dia) faria cada dia virar "1 hora" — R$
 * errado marcado como completo. Critério: o MENOR intervalo entre timestamps distintos
 * consecutivos é ≤ 1 h (buracos maiores são dias/horas sem leitura, legítimos). Sem pontos
 * → nada a valorar (ok). Um único ponto só é verificável se o período cabe em 1 h.
 */
export function isHourlySeries(
  points: Array<{ timestamp: unknown }>,
  startTs: number,
  endTs: number
): boolean {
  const ts = Array.from(
    new Set(
      points
        .map((p) => (p?.timestamp == null ? NaN : new Date(p.timestamp as string | number).getTime()))
        .filter((t) => Number.isFinite(t))
    )
  ).sort((a, b) => a - b);
  if (ts.length === 0) return true;
  if (ts.length === 1) return endTs - startTs <= HOUR_MS;
  let minGap = Infinity;
  for (let i = 1; i < ts.length; i++) minGap = Math.min(minGap, ts[i] - ts[i - 1]);
  return minGap <= HOUR_MS;
}

/** Money de uma linha: estado do pior bucket + soma crua (DEC-8: round só na exibição). */
export interface RowMoney {
  state: string;
  /** Soma crua (string decimal), só quando `state === 'complete'`. */
  amount?: string;
  reason?: string;
  /** Buckets (horas) completos / total de buckets da linha. */
  covered: number;
  total: number;
}

/** Linha mínima (subset de DailyReading). `money === null` = sem leituras. */
export interface MoneyReportRow {
  date: string;
  consumption: number;
  money?: RowMoney | null;
}

/**
 * Junta o money de vários buckets (horas) numa linha: completa só se todos estão completos;
 * senão herda estado/motivo do primeiro bucket incompleto (o chip explica o porquê).
 */
export function combineBucketMoney(buckets: Array<{ state: string; amount?: string; reason?: string } | null>): RowMoney {
  const list = buckets.map((b) => b || { state: 'uncategorized', reason: 'no-category' });
  const sum = sumItemMoney(list);
  if (sum.state === 'complete') return { state: 'complete', amount: sum.amount, covered: sum.covered, total: sum.total };
  const bad = list.find((b) => b.state !== 'complete');
  return {
    state: bad?.state || 'missing',
    ...(bad?.reason ? { reason: bad.reason } : {}),
    covered: sum.covered,
    total: sum.total,
  };
}

/** Visão de uma linha em modo R$ — mesmo shape do All Report (reusa `rowMoneyCellHTML`). */
export function deviceRowMoneyView(row: MoneyReportRow): RowMoneyView {
  const m = row.money;
  if (!m) {
    // Sem leituras: estilo neutro (cinza) e fora da cobertura — não é "sem tarifa"
    return { scope: 'out', state: 'no-data', amount: null, text: MONEY_NO_VALUE, chip: MONEY_NO_DATA_LABEL, reason: NO_DATA_TEXT };
  }
  const amount = m.state === 'complete' ? roundMoney2(m.amount ?? null) : null;
  if (amount) return { scope: 'in', state: 'complete', amount, text: moneyCellText(amount), chip: '', reason: '' };
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

export interface DeviceMoneyTotal {
  /** `round(Σ raw)` 2dp das linhas com dados, só com todas completas. */
  amount: string | null;
  /** `"R$ x"` ou `-`. */
  text: string;
  covered: number;
  /** Linhas com dados (base do "n de m"). */
  withData: number;
  /** `"Cobertura incompleta (n de m)"` ou `""`. */
  note: string;
}

/** Total honesto do relatório (linhas sem leituras ficam fora). */
export function deviceMoneyTotal(rows: MoneyReportRow[]): DeviceMoneyTotal {
  const withMoney = rows.map((r) => r.money).filter((m): m is RowMoney => !!m);
  const sum = sumItemMoney(withMoney);
  const amount = sum.state === 'complete' ? roundMoney2(sum.amount ?? null) : null;
  return {
    amount,
    text: moneyText(amount),
    covered: sum.covered,
    withData: withMoney.length,
    note: withMoney.length && !amount ? `${MONEY_INCOMPLETE_LABEL} (${sum.covered} de ${withMoney.length})` : '',
  };
}

export interface DeviceMoneyKpiOptions {
  /** 'Dia' (1d) ou 'Hora' (1h). */
  rowLabel: string;
  intraday: boolean;
  /** Data/hora legível da linha (sub dos KPIs Maior/Menor). */
  formatDate: (date: string) => string;
}

/** KPIs do summary em modo R$ (tela + CSV + faixa do PDF/XLS). */
export function deviceMoneyKpis(rows: MoneyReportRow[], opts: DeviceMoneyKpiOptions): Array<{ value: string; label: string; sub?: string }> {
  const total = deviceMoneyTotal(rows);
  const views = rows.map((r) => ({ row: r, view: deviceRowMoneyView(r) }));
  const complete = views
    .filter((x) => !!x.view.amount)
    .map((x) => ({ row: x.row, amount: x.view.amount as string, cents: decimalStringToCents(x.view.amount) as bigint }));
  const maxE = complete.reduce<(typeof complete)[number] | null>((b, e) => (!b || e.cents > b.cents ? e : b), null);
  const minE = complete
    .filter((e) => e.cents > 0n)
    .reduce<(typeof complete)[number] | null>((b, e) => (!b || e.cents < b.cents ? e : b), null);

  const withData = rows.filter((r) => !!r.money);
  const dayCount = new Set(withData.map((r) => (r.date.includes('T') ? spDayKey(Date.parse(r.date)) : r.date))).size;
  const zeroCount = rows.filter((r) => r.consumption <= 0).length;

  const kpis: Array<{ value: string; label: string; sub?: string }> = [
    { value: total.text, label: 'Custo estimado total', ...(total.note ? { sub: total.note } : {}) },
    { value: moneyText(divideMoney(total.amount, dayCount)), label: 'Média por Dia' },
  ];
  if (opts.intraday) kpis.push({ value: moneyText(divideMoney(total.amount, withData.length)), label: 'Média por Hora' });
  kpis.push(
    {
      value: maxE ? moneyText(maxE.amount) : MONEY_NO_VALUE,
      label: `${opts.rowLabel} com Maior Custo`,
      ...(maxE ? { sub: opts.formatDate(maxE.row.date) } : {}),
    },
    {
      value: minE ? moneyText(minE.amount) : MONEY_NO_VALUE,
      label: `${opts.rowLabel} com Menor Custo`,
      ...(minE ? { sub: opts.formatDate(minE.row.date) } : {}),
    },
    { value: String(zeroCount), label: opts.intraday ? 'Horas sem Consumo' : 'Dias sem Consumo' }
  );

  // Linhas com leitura mas sem R$ completo, por motivo ("2 Sem tarifa · 1 Tarifa parcial")
  const missing = views.filter((x) => x.view.scope === 'in' && !x.view.amount);
  if (missing.length) {
    const byChip = new Map<string, number>();
    missing.forEach((x) => byChip.set(x.view.chip, (byChip.get(x.view.chip) || 0) + 1));
    // "sem custo" (alinhado ao KPI "Sem custo" do All Report): conta sem tarifa, tarifa
    // parcial e sem categoria — o detalhe por estado vai no `sub`
    kpis.push({
      value: String(missing.length),
      label: opts.intraday ? 'Horas sem custo' : 'Dias sem custo',
      sub: Array.from(byChip.entries())
        .map(([chip, n]) => `${n} ${chip}`)
        .join(' · '),
    });
  }
  return kpis;
}

export interface DeviceMoneyChart {
  items: Array<{ id: string; label: string; value: number }>;
  /** Dias com leituras mas sem R$ completo (fora do gráfico). */
  excluded: number;
  /** `"k dia(s) sem R$ fora do gráfico"` ou `""`. */
  note: string;
}

/**
 * Itens do gráfico "Custo por Dia": um item por dia civil com R$ completo (no 1h as horas
 * são somadas por dia SP). Barras e % pelo custo; dias sem R$ ficam fora, com nota.
 */
export function deviceMoneyChartItems(rows: MoneyReportRow[]): DeviceMoneyChart {
  const byDay = new Map<string, RowMoney[]>();
  for (const r of rows) {
    if (!r.money) continue;
    const day = r.date.includes('T') ? spDayKey(Date.parse(r.date)) : r.date;
    const list = byDay.get(day) || [];
    list.push(r.money);
    byDay.set(day, list);
  }
  const items: DeviceMoneyChart['items'] = [];
  let excluded = 0;
  Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([day, list]) => {
      const sum = sumItemMoney(list);
      const value = sum.state === 'complete' ? moneyNumber(sum.amount ?? null) : null;
      if (value === null) {
        excluded += 1;
        return;
      }
      const [, m, d] = day.split('-');
      items.push({ id: day, label: `${d}/${m}`, value });
    });
  return { items, excluded, note: excluded ? `${excluded} dia(s) sem R$ fora do gráfico` : '' };
}
