/**
 * RFC-0238 — adaptador puro: dados já carregados pelo HO (classified + cards dos shoppings)
 * → snapshot normalizado do overview executivo.
 *
 * Fronteiras (RFC-0238 §7.4 / §9):
 * - Energia: soma dos submedidores (equipamentos + lojas + demais contextos, exceto `entrada`).
 *   A fronteira de entrada só é usada quando TODOS os shoppings a têm — misturar fronteiras
 *   distintas numa soma de portfólio seria inconsistente.
 * - Água: fronteira = hidrômetros de entrada; consumos medidos (banheiros/área comum/lojas)
 *   formam o balanço `residual = entrada − medidos`, com sinal (nunca truncado em zero).
 * - Demanda contratada e custo: sem contratos/tarifas configurados → `not-configured`.
 */

import type {
  CategoryContribution,
  ClassifiedDomain,
  DomainConnectivity,
  HoldingCategoryId,
  PortfolioMetric,
  PortfolioSnapshot,
  PortfolioSnapshotInput,
  PortfolioSourceDevice,
  PriorityItem,
  ShoppingRow,
} from './types';
import { HOLDING_CATEGORY_LABELS, HOLDING_CATEGORY_ORDER, resolveHoldingEnergyCategory } from './taxonomy';

const OFFLINE_STATUSES = new Set(['offline', 'no_info']);
const CRITICAL_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'CRITICO', 'CRÍTICO', 'ALTA']);
const WATER_SUPPLY_CONTEXT = 'hidrometro_entrada';
const ENERGY_SUPPLY_CONTEXT = 'entrada';

/** Limiares das regras de prioridade (exibidos em "Por que aparece") */
export const PRIORITY_THRESHOLDS = {
  offlineShareWarning: 0.1,
  temperatureOutOfRangeShare: 0.5,
  waterResidualShare: 0.3,
} as const;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const shoppingOf = (d: PortfolioSourceDevice): string => String(d.ownerName || d.customerName || '').trim();
const keyOf = (name: string): string => name.toLowerCase().trim();
const isOnline = (d: PortfolioSourceDevice): boolean =>
  !OFFLINE_STATUSES.has(String(d.deviceStatus || '').toLowerCase());
const energyValue = (d: PortfolioSourceDevice): number | null => num(d.value ?? d.val ?? d.consumption);
const waterValue = (d: PortfolioSourceDevice): number | null => num(d.value ?? d.val ?? d.consumption ?? d.pulses);

function entries(domain: ClassifiedDomain | undefined): Array<[string, PortfolioSourceDevice[]]> {
  return Object.entries(domain || {}).map(([ctx, list]) => [ctx, Array.isArray(list) ? list : []]);
}

const emptyConn = (): DomainConnectivity => ({ online: 0, total: 0 });

interface Acc {
  name: string;
  id?: string;
  energy: number;
  energyDevices: number;
  energyHasValue: boolean;
  waterSupply: number;
  waterSupplyMeters: number;
  waterDownstream: number;
  waterDownstreamMeters: number;
  waterDevices: number;
  temps: number[];
  tempOut: number;
  conn: Record<'energy' | 'water' | 'temperature', DomainConnectivity>;
}

export function buildPortfolioSnapshot(input: PortfolioSnapshotInput): PortfolioSnapshot {
  const now = input.now ?? Date.now();
  const range = input.temperatureRange ?? null;
  const accs = new Map<string, Acc>();

  const acc = (name: string): Acc => {
    const k = keyOf(name);
    let a = accs.get(k);
    if (!a) {
      a = {
        name,
        energy: 0,
        energyDevices: 0,
        energyHasValue: false,
        waterSupply: 0,
        waterSupplyMeters: 0,
        waterDownstream: 0,
        waterDownstreamMeters: 0,
        waterDevices: 0,
        temps: [],
        tempOut: 0,
        conn: { energy: emptyConn(), water: emptyConn(), temperature: emptyConn() },
      };
      accs.set(k, a);
    }
    return a;
  };

  // Shoppings selecionados primeiro (aparecem mesmo sem devices — "sem dados" é um estado).
  // Com lista informada, só ela define o escopo; devices de outros donos ficam fora (e contados).
  const scope = input.shoppings?.length ? new Set(input.shoppings.map((s) => keyOf(s.name))) : null;
  let excludedDevices = 0;
  const inScope = (name: string): boolean => {
    if (!name) return false;
    if (scope && !scope.has(keyOf(name))) {
      excludedDevices++;
      return false;
    }
    return true;
  };
  for (const s of input.shoppings || []) {
    if (s.name) acc(s.name).id = s.id;
  }

  // ---- Energia (submedidores) + categorias da holding
  const catTotals = new Map<HoldingCategoryId, { value: number; devices: number }>();
  for (const [ctx, list] of entries(input.classified.energy)) {
    for (const d of list) {
      const name = shoppingOf(d);
      if (!inScope(name)) continue;
      const a = acc(name);
      a.conn.energy.total++;
      if (isOnline(d)) a.conn.energy.online++;
      if (ctx === ENERGY_SUPPLY_CONTEXT) continue; // fronteira de entrada: fora da soma de submedidores
      const v = energyValue(d);
      a.energyDevices++;
      const cat = resolveHoldingEnergyCategory(d.deviceProfile, ctx);
      const c = catTotals.get(cat) || { value: 0, devices: 0 };
      c.devices++;
      if (v !== null) {
        a.energy += v;
        a.energyHasValue = true;
        c.value += v;
      }
      catTotals.set(cat, c);
    }
  }

  // ---- Água (entrada × medidos)
  for (const [ctx, list] of entries(input.classified.water)) {
    for (const d of list) {
      const name = shoppingOf(d);
      if (!inScope(name)) continue;
      const a = acc(name);
      a.waterDevices++;
      a.conn.water.total++;
      if (isOnline(d)) a.conn.water.online++;
      const v = waterValue(d);
      if (ctx === WATER_SUPPLY_CONTEXT) {
        a.waterSupplyMeters++;
        if (v !== null) a.waterSupply += v;
      } else {
        a.waterDownstreamMeters++;
        if (v !== null) a.waterDownstream += v;
      }
    }
  }

  // ---- Temperatura
  for (const [, list] of entries(input.classified.temperature)) {
    for (const d of list) {
      const name = shoppingOf(d);
      if (!inScope(name)) continue;
      const a = acc(name);
      a.conn.temperature.total++;
      if (isOnline(d)) a.conn.temperature.online++;
      const t = num(d.temperature);
      if (t === null || t <= 0) continue; // sem leitura válida
      a.temps.push(t);
      if (range && (t < range.min || t > range.max)) a.tempOut++;
    }
  }

  const alarmsByShopping = new Map(
    (input.shoppings || []).map((s) => {
      const details = s.alarmDetails || [];
      const critical =
        s.alarms === null || s.alarms === undefined
          ? null
          : details.filter((a) => CRITICAL_SEVERITIES.has(String(a.severity || '').toUpperCase())).length;
      return [keyOf(s.name), { open: s.alarms ?? null, critical }];
    })
  );

  // ---- Linhas da matriz
  const rows: ShoppingRow[] = [...accs.values()].map((a) => {
    const conns = [a.conn.energy, a.conn.water, a.conn.temperature];
    const total = conns.reduce((s, c) => s + c.total, 0);
    const online = conns.reduce((s, c) => s + c.online, 0);
    const hasSupply = a.waterSupplyMeters > 0;
    const alarms = alarmsByShopping.get(keyOf(a.name)) || { open: null, critical: null };
    const row: ShoppingRow = {
      name: a.name,
      id: a.id,
      energy: { value: a.energyHasValue ? a.energy : null, devices: a.energyDevices },
      water: {
        supply: hasSupply ? a.waterSupply : null,
        downstream: a.waterDownstreamMeters > 0 ? a.waterDownstream : null,
        residual: hasSupply && a.waterDownstreamMeters > 0 ? a.waterSupply - a.waterDownstream : null,
        devices: a.waterDevices,
      },
      temperature: {
        avg: a.temps.length ? a.temps.reduce((s, t) => s + t, 0) / a.temps.length : null,
        outOfRange: a.tempOut,
        sensors: a.temps.length,
      },
      alarms,
      connectivity: a.conn,
      offlineShare: total > 0 ? (total - online) / total : 0,
      attention: null,
    };
    return row;
  });

  const priorities = buildPriorities(rows, range);
  const firstByShopping = new Map<string, PriorityItem>();
  for (const p of priorities) if (!firstByShopping.has(p.shopping)) firstByShopping.set(p.shopping, p);
  rows.forEach((r) => (r.attention = firstByShopping.get(r.name)?.title ?? null));

  // Ordenação visível: alarmes críticos → alarmes abertos → % offline → nome
  rows.sort(
    (x, y) =>
      (y.alarms.critical ?? -1) - (x.alarms.critical ?? -1) ||
      (y.alarms.open ?? -1) - (x.alarms.open ?? -1) ||
      y.offlineShare - x.offlineShare ||
      x.name.localeCompare(y.name, 'pt-BR')
  );

  // ---- KPIs
  const total = rows.length;
  const energyCovered = rows.filter((r) => r.energy.value !== null);
  const energyKpi: PortfolioMetric = {
    key: 'energy',
    state: energyCovered.length === 0 ? 'unavailable' : energyCovered.length < total ? 'partial' : 'available',
    value: energyCovered.length ? energyCovered.reduce((s, r) => s + (r.energy.value as number), 0) : null,
    unit: 'kWh',
    scopeLabel: 'Soma dos submedidores (equipamentos + lojas)',
    coverage: {
      covered: energyCovered.length,
      total,
      note: 'Fronteira de entrada não validada para todos os shoppings — totais de submedição.',
    },
    reasons: energyCovered.length < total ? ['Shoppings sem consumo de energia no período ficam fora da soma.'] : [],
  };

  const waterCovered = rows.filter((r) => r.water.supply !== null);
  const waterKpi: PortfolioMetric = {
    key: 'water',
    state: waterCovered.length === 0 ? 'unavailable' : waterCovered.length < total ? 'partial' : 'available',
    value: waterCovered.length ? waterCovered.reduce((s, r) => s + (r.water.supply as number), 0) : null,
    unit: 'm3',
    scopeLabel: 'Hidrômetros de entrada',
    coverage: { covered: waterCovered.length, total },
    reasons:
      waterCovered.length < total
        ? [`${total - waterCovered.length} shopping(s) sem hidrômetro de entrada — fora da soma.`]
        : [],
  };

  const notConfigured = (key: string, unit: PortfolioMetric['unit'], scopeLabel: string, reason: string): PortfolioMetric => ({
    key,
    state: 'not-configured',
    value: null,
    unit,
    scopeLabel,
    coverage: { covered: 0, total },
    reasons: [reason],
  });

  const allCats = [...catTotals.values()].reduce((s, c) => s + c.value, 0);
  const categories: CategoryContribution[] = HOLDING_CATEGORY_ORDER.filter((id) => catTotals.has(id)).map((id) => {
    const c = catTotals.get(id)!;
    return { id, label: HOLDING_CATEGORY_LABELS[id], value: c.value, devices: c.devices, share: allCats > 0 ? c.value / allCats : 0 };
  });
  categories.sort((a, b) => b.value - a.value);

  const byDomain = {
    energy: sumConn(rows.map((r) => r.connectivity.energy)),
    water: sumConn(rows.map((r) => r.connectivity.water)),
    temperature: sumConn(rows.map((r) => r.connectivity.temperature)),
  };

  return {
    computedAt: now,
    period: { start: input.period.start, end: input.period.end, timezone: input.period.timezone || 'America/Sao_Paulo' },
    kpis: {
      energy: energyKpi,
      water: waterKpi,
      demand: notConfigured(
        'demand',
        'count',
        'Pontos de suprimento com contrato',
        'Contratos de demanda por ponto de suprimento ainda não cadastrados (RFC-0238 fase 3).'
      ),
      cost: notConfigured(
        'cost',
        'count',
        'Projeção elegível (BRL)',
        'Cobertura tarifária não configurada — não estimamos custo sem tarifa validada.'
      ),
    },
    shoppings: rows,
    sortRule: 'Alarmes críticos → alarmes abertos → % de dispositivos offline → nome',
    categories,
    priorities: priorities.slice(0, 5),
    coverage: {
      connectivity: { ...sumConn(Object.values(byDomain)), byDomain },
      temperature: {
        sensors: rows.reduce((s, r) => s + r.temperature.sensors, 0),
        outOfRange: rows.reduce((s, r) => s + r.temperature.outOfRange, 0),
        range,
      },
      waterSupplyShoppings: waterCovered.length,
      excludedDevices,
    },
  };
}

function sumConn(list: DomainConnectivity[]): DomainConnectivity {
  return list.reduce((s, c) => ({ online: s.online + c.online, total: s.total + c.total }), emptyConn());
}

const SEVERITY_RANK: Record<PriorityItem['severity'], number> = { critical: 0, warning: 1, info: 2 };
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const fmt1 = (x: number): string => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Regras determinísticas (RFC-0238 §5.5): candidatos a investigação, não diagnósticos */
export function buildPriorities(
  rows: ShoppingRow[],
  range: { min: number; max: number } | null
): PriorityItem[] {
  const out: Array<PriorityItem & { weight: number }> = [];
  for (const r of rows) {
    if ((r.alarms.critical ?? 0) > 0) {
      out.push({
        id: `${r.name}:alarms-critical`,
        shopping: r.name,
        severity: 'critical',
        title: 'Tratar alarmes críticos',
        evidence: `${r.alarms.critical} crítico(s) de ${r.alarms.open} alarme(s) aberto(s)`,
        rule: 'Há ao menos 1 alarme aberto com severidade CRÍTICA/ALTA.',
        target: 'alarms',
        weight: r.alarms.critical ?? 0,
      });
    } else if ((r.alarms.open ?? 0) > 0) {
      out.push({
        id: `${r.name}:alarms-open`,
        shopping: r.name,
        severity: 'info',
        title: 'Acompanhar alarmes abertos',
        evidence: `${r.alarms.open} alarme(s) aberto(s), nenhum crítico`,
        rule: 'Há alarmes abertos sem severidade crítica.',
        target: 'alarms',
        weight: r.alarms.open ?? 0,
      });
    }

    for (const [domain, label] of [
      ['energy', 'energia'],
      ['water', 'água'],
      ['temperature', 'temperatura'],
    ] as const) {
      const c = r.connectivity[domain];
      if (c.total === 0) continue;
      const share = (c.total - c.online) / c.total;
      if (share >= PRIORITY_THRESHOLDS.offlineShareWarning) {
        out.push({
          id: `${r.name}:offline-${domain}`,
          shopping: r.name,
          severity: 'warning',
          title: `Verificar conectividade de ${label}`,
          evidence: `${c.total - c.online} de ${c.total} dispositivo(s) offline (${pct(share)})`,
          rule: `≥ ${pct(PRIORITY_THRESHOLDS.offlineShareWarning)} dos dispositivos do domínio sem telemetria recente.`,
          target: 'connectivity',
          weight: share,
        });
      }
    }

    if (range && r.temperature.sensors > 0) {
      const share = r.temperature.outOfRange / r.temperature.sensors;
      if (share >= PRIORITY_THRESHOLDS.temperatureOutOfRangeShare) {
        out.push({
          id: `${r.name}:comfort`,
          shopping: r.name,
          severity: 'warning',
          title: 'Revisar conforto térmico',
          evidence: `${r.temperature.outOfRange} de ${r.temperature.sensors} sensores fora de ${range.min}–${range.max} °C (média ${fmt1(
            r.temperature.avg ?? 0
          )} °C)`,
          rule: `≥ ${pct(PRIORITY_THRESHOLDS.temperatureOutOfRangeShare)} dos sensores fora da faixa ideal.`,
          target: 'temperature',
          weight: share,
        });
      }
    }

    const { supply, residual } = r.water;
    if (supply !== null && residual !== null) {
      if (residual < 0) {
        out.push({
          id: `${r.name}:water-negative`,
          shopping: r.name,
          severity: 'warning',
          title: 'Reconciliar balanço de água',
          evidence: `Consumos medidos superam a entrada em ${fmt1(-residual)} m³`,
          rule: 'Residual negativo (entrada − medidos < 0) indica sobreposição de medidores ou fluxo não modelado.',
          target: 'water',
          weight: supply > 0 ? -residual / supply : 1,
        });
      } else if (supply > 0 && residual / supply >= PRIORITY_THRESHOLDS.waterResidualShare) {
        out.push({
          id: `${r.name}:water-residual`,
          shopping: r.name,
          severity: 'info',
          title: 'Investigar consumo de água não medido',
          evidence: `${fmt1(residual)} m³ (${pct(residual / supply)} da entrada) sem medição a jusante`,
          rule: `Residual ≥ ${pct(PRIORITY_THRESHOLDS.waterResidualShare)} da entrada. Candidato a investigação — não é prova de vazamento.`,
          target: 'water',
          weight: residual / supply,
        });
      }
    }
  }

  return out
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.weight - a.weight)
    .map(({ weight: _w, ...p }) => p);
}
