/**
 * RFC-0237 — Painel tab: every number of the dashboard, computed from the rows
 * the list shows (call it with `applyFilters(rows, filters)`), so the Painel and
 * the list can never disagree.
 */

import { getInventoryRule, INVENTORY_RULES } from './rules';
import { NO_CUSTOMER_KEY } from './filters';
import type { AtividadeLevel, CadastroLevel, InventoryRow } from './types';

export interface CustomerProblems {
  key: string;
  critical: number;
  pending: number;
  /** Devices of the customer counted in the indicators (lifecycle active). */
  total: number;
}

export interface RuleCount {
  id: string;
  label: string;
  count: number;
}

export interface CustomerRuleMatrix {
  customers: string[];
  rules: string[];
  /** cells[i][j] = devices of customers[i] failing rules[j]. */
  cells: number[][];
}

export interface InventoryDashboard {
  /** Every row received (including stock / archived). */
  total: number;
  /** Rows counted in the indicators (lifecycle active). */
  inIndicators: number;
  excluded: { stock: number; archived: number };
  cadastro: Record<Exclude<CadastroLevel, 'excluded'>, number>;
  atividade: Record<Exclude<AtividadeLevel, 'excluded'>, number>;
  /** Customers with at least one Crítico/Pendente device, worst first. */
  topCustomers: CustomerProblems[];
  /** Rules with at least one failing device, most failing first (rule order on ties). */
  topRules: RuleCount[];
  matrix: CustomerRuleMatrix;
}

export interface DashboardOptions {
  /** Max customers in `topCustomers` (default 10). */
  topCustomers?: number;
  /** Max customers (rows) in the matrix (default 15). */
  matrixCustomers?: number;
}

export function buildDashboardSummary(rows: readonly InventoryRow[], options: DashboardOptions = {}): InventoryDashboard {
  const cadastro = { ok: 0, pending: 0, critical: 0, partial: 0 };
  const atividade = { ok: 0, inactive: 0, nodata: 0 };
  const excluded = { stock: 0, archived: 0 };
  const byCustomer = new Map<string, CustomerProblems>();
  const ruleCounts = new Map<string, number>();
  const failuresByCustomerRule = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const { lifecycle, cadastro: cad, atividade: atv, failed } = row.evaluation;
    if (lifecycle.status !== 'active') {
      excluded[lifecycle.status]++;
      continue;
    }
    if (cad.level !== 'excluded') cadastro[cad.level]++;
    if (atv.level !== 'excluded') atividade[atv.level]++;

    const customer = byCustomer.get(row.customerKey) || { key: row.customerKey, critical: 0, pending: 0, total: 0 };
    customer.total++;
    if (cad.level === 'critical') customer.critical++;
    if (cad.level === 'pending') customer.pending++;
    byCustomer.set(row.customerKey, customer);

    for (const id of failed) {
      ruleCounts.set(id, (ruleCounts.get(id) || 0) + 1);
      const perRule = failuresByCustomerRule.get(row.customerKey) || new Map<string, number>();
      perRule.set(id, (perRule.get(id) || 0) + 1);
      failuresByCustomerRule.set(row.customerKey, perRule);
    }
  }

  const ruleOrder = new Map(INVENTORY_RULES.map((r, i) => [r.id, i]));
  const topRules: RuleCount[] = [...ruleCounts.entries()]
    .map(([id, count]) => ({ id, label: getInventoryRule(id)?.label || id, count }))
    .sort((a, b) => b.count - a.count || (ruleOrder.get(a.id) ?? 99) - (ruleOrder.get(b.id) ?? 99));

  const worstFirst = (a: CustomerProblems, b: CustomerProblems) =>
    b.critical - a.critical || b.pending - a.pending || a.key.localeCompare(b.key, 'pt-BR');

  const topCustomers = [...byCustomer.values()]
    .filter((c) => c.critical + c.pending > 0)
    .sort(worstFirst)
    .slice(0, options.topCustomers ?? 10);

  // Matrix: customers with any failure, ranked by total failures; rules in topRules order.
  const failureTotal = (key: string) =>
    [...(failuresByCustomerRule.get(key)?.values() || [])].reduce((s, n) => s + n, 0);
  const matrixCustomers = [...failuresByCustomerRule.keys()]
    .sort((a, b) => failureTotal(b) - failureTotal(a) || a.localeCompare(b, 'pt-BR'))
    .slice(0, options.matrixCustomers ?? 15);
  const matrixRules = topRules.map((r) => r.id);

  return {
    total: rows.length,
    inIndicators: rows.length - excluded.stock - excluded.archived,
    excluded,
    cadastro,
    atividade,
    topCustomers,
    topRules,
    matrix: {
      customers: matrixCustomers,
      rules: matrixRules,
      cells: matrixCustomers.map((c) => matrixRules.map((r) => failuresByCustomerRule.get(c)?.get(r) || 0)),
    },
  };
}

/** Display name of a customer key ("Sem cliente" for tenant-owned devices). */
export function customerKeyLabel(key: string): string {
  return key === NO_CUSTOMER_KEY ? 'Sem cliente' : key;
}
