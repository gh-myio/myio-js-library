/**
 * RFC-0237 §3 — inventory rules, two axes (Cadastro / Atividade).
 *
 * Every rule returns `pass` | `fail` | `unknown` | `notApplicable`:
 *  - fail          — the data came back and the condition is violated;
 *  - unknown       — the data could not be read (failed page / missing activity value);
 *  - notApplicable — the rule does not apply (lifecycle, integration not expected, architecture);
 *  - pass          — condition met.
 */

import { DEVICE_TYPE_CONFIG, getDeviceCategory } from '../deviceTypeConfig';
import type { DeviceTypeCategory } from '../deviceTypeConfig';
import { resolveLifecycle } from './lifecycle';
import type {
  AtividadeLevel,
  CadastroLevel,
  DeviceEvaluation,
  InventoryDevice,
  RuleAxis,
  RuleOutcome,
  RuleResult,
  RuleSeverity,
} from './types';

export interface RuleContext {
  /** Customer names (ownerName) whose devices are expected to be integrated (C2–C5, C7, C8). */
  integratedCustomers: ReadonlySet<string>;
  /** Number of non-archived devices per `ingestionId` / `gcdrDeviceId` (C8). */
  ingestionIdCounts: ReadonlyMap<string, number>;
  gcdrDeviceIdCounts: ReadonlyMap<string, number>;
  /** A2 threshold, in hours. */
  staleHours: number;
  /** Rule ids that are switched off (they evaluate to `notApplicable`). */
  disabledRules: ReadonlySet<string>;
  /** Domains whose devices hang from a central (C7). */
  centralDomains: ReadonlySet<DeviceTypeCategory>;
  /** "Now" in ms — injected so A2 is deterministic. */
  now: number;
}

export interface RuleDefinition {
  id: string;
  axis: RuleAxis;
  severity: RuleSeverity;
  /** pt-BR text shown in the list, the filter and the exports. */
  label: string;
  /** Longer pt-BR explanation (tooltip). */
  description: string;
  evaluate(device: InventoryDevice, ctx: RuleContext): RuleOutcome;
}

/** True when `deviceProfile` is a key of `DEVICE_TYPE_CONFIG` (case-insensitive). */
export function isRecognizedProfile(deviceProfile: string | null): boolean {
  return !!deviceProfile && Object.prototype.hasOwnProperty.call(DEVICE_TYPE_CONFIG, deviceProfile.toUpperCase());
}

function isIntegrated(device: InventoryDevice, ctx: RuleContext): boolean {
  return !!device.ownerName && device.ownerType === 'CUSTOMER' && ctx.integratedCustomers.has(device.ownerName);
}

/** Shared shape of C2–C4: required MYIO attribute on integrated customers. */
function requiredOnIntegrated(pick: (d: InventoryDevice) => string | null) {
  return (device: InventoryDevice, ctx: RuleContext): RuleOutcome => {
    if (!device.attributesLoaded) return 'unknown';
    if (!isIntegrated(device, ctx)) return 'notApplicable';
    return pick(device) === null ? 'fail' : 'pass';
  };
}

export const INVENTORY_RULES: readonly RuleDefinition[] = [
  {
    id: 'C1',
    axis: 'cadastro',
    severity: 'pending',
    label: 'Sem cliente',
    description: 'O dispositivo pertence ao tenant e não está associado a nenhum cliente.',
    evaluate: (d) => {
      if (d.ownerType === null) return 'unknown';
      return d.ownerType === 'TENANT' ? 'fail' : 'pass';
    },
  },
  {
    id: 'C2',
    axis: 'cadastro',
    severity: 'critical',
    label: 'Sem deviceProfile',
    description: 'O atributo deviceProfile não está preenchido; o dispositivo não é classificado nos dashboards.',
    evaluate: requiredOnIntegrated((d) => d.deviceProfile),
  },
  {
    id: 'C3',
    axis: 'cadastro',
    severity: 'critical',
    label: 'Sem ingestionId',
    description: 'Sem ingestionId, os dados do dispositivo não chegam aos relatórios.',
    evaluate: requiredOnIntegrated((d) => d.ingestionId),
  },
  {
    id: 'C4',
    axis: 'cadastro',
    severity: 'pending',
    label: 'Sem gcdrDeviceId',
    description: 'Sem gcdrDeviceId, alarmes e recursos do GCDR ficam indisponíveis para o dispositivo.',
    evaluate: requiredOnIntegrated((d) => d.gcdrDeviceId),
  },
  {
    id: 'C5',
    axis: 'cadastro',
    severity: 'pending',
    label: 'Perfil não reconhecido',
    description: 'O deviceProfile não está na lista de perfis conhecidos; o dispositivo aparece como "Não classificado".',
    evaluate: (d, ctx) => {
      if (!d.attributesLoaded) return 'unknown';
      if (!isIntegrated(d, ctx) || d.deviceProfile === null) return 'notApplicable';
      return isRecognizedProfile(d.deviceProfile) ? 'pass' : 'fail';
    },
  },
  {
    id: 'C6',
    axis: 'cadastro',
    severity: 'info',
    label: 'Perfil diverge do TB',
    description: 'O deviceProfile difere do perfil do dispositivo no ThingsBoard.',
    evaluate: (d) => {
      if (!d.attributesLoaded) return 'unknown';
      if (d.deviceProfile === null || d.type === null) return 'notApplicable';
      return d.deviceProfile.toUpperCase() === d.type.toUpperCase() ? 'pass' : 'fail';
    },
  },
  {
    id: 'C7',
    axis: 'cadastro',
    severity: 'pending',
    label: 'Sem central/slave',
    description: 'Dispositivo de domínio ligado a central sem centralId ou slaveId.',
    evaluate: (d, ctx) => {
      if (!d.attributesLoaded) return 'unknown';
      if (!isIntegrated(d, ctx) || !isRecognizedProfile(d.deviceProfile)) return 'notApplicable';
      if (!ctx.centralDomains.has(getDeviceCategory(d.deviceProfile))) return 'notApplicable';
      return d.centralId === null || d.slaveId === null ? 'fail' : 'pass';
    },
  },
  {
    id: 'C8',
    axis: 'cadastro',
    severity: 'critical',
    label: 'ID duplicado',
    description: 'Outro dispositivo ativo usa o mesmo ingestionId ou gcdrDeviceId.',
    evaluate: (d, ctx) => {
      if (!d.attributesLoaded) return 'unknown';
      if (d.ingestionId === null && d.gcdrDeviceId === null) return 'notApplicable';
      const dupIngestion = d.ingestionId !== null && (ctx.ingestionIdCounts.get(d.ingestionId) || 0) > 1;
      const dupGcdr = d.gcdrDeviceId !== null && (ctx.gcdrDeviceIdCounts.get(d.gcdrDeviceId) || 0) > 1;
      return dupIngestion || dupGcdr ? 'fail' : 'pass';
    },
  },
  {
    id: 'A1',
    axis: 'atividade',
    severity: 'inactive',
    label: 'Inativo no TB',
    description: 'O ThingsBoard marca o dispositivo como inativo (active = false).',
    evaluate: (d) => {
      if (d.active === null) return 'unknown';
      return d.active ? 'pass' : 'fail';
    },
  },
  {
    id: 'A2',
    axis: 'atividade',
    severity: 'inactive',
    label: 'Sem atividade recente',
    description: 'A última atividade registrada é mais antiga que o limite configurado.',
    evaluate: (d, ctx) => {
      if (d.lastActivityTime === null) return 'unknown';
      return ctx.now - d.lastActivityTime > ctx.staleHours * 3600 * 1000 ? 'fail' : 'pass';
    },
  },
];

const RULE_BY_ID = new Map(INVENTORY_RULES.map((r) => [r.id, r]));

export function getInventoryRule(id: string): RuleDefinition | undefined {
  return RULE_BY_ID.get(id);
}

export interface BuildRuleContextOptions {
  now: number;
  staleHours?: number;
  /** Default `['C6']` (RFC-0237: divergence is hygiene until proven otherwise). */
  disabledRules?: Iterable<string>;
  /** Per-customer override of the derived "integrated" flag (customer name → expected). */
  integrationOverrides?: Record<string, boolean>;
  centralDomains?: Iterable<DeviceTypeCategory>;
}

/**
 * Derives the cross-device context: integrated customers (≥ 1 device with
 * `ingestionId` or `gcdrDeviceId`, then overrides) and duplicate indexes over
 * devices whose lifecycle is not `archived`.
 */
export function buildRuleContext(devices: readonly InventoryDevice[], options: BuildRuleContextOptions): RuleContext {
  const integrated = new Set<string>();
  const ingestionIdCounts = new Map<string, number>();
  const gcdrDeviceIdCounts = new Map<string, number>();

  for (const d of devices) {
    if (d.ownerType === 'CUSTOMER' && d.ownerName && (d.ingestionId !== null || d.gcdrDeviceId !== null)) {
      integrated.add(d.ownerName);
    }
    if (resolveLifecycle(d).status === 'archived') continue;
    if (d.ingestionId !== null) ingestionIdCounts.set(d.ingestionId, (ingestionIdCounts.get(d.ingestionId) || 0) + 1);
    if (d.gcdrDeviceId !== null) gcdrDeviceIdCounts.set(d.gcdrDeviceId, (gcdrDeviceIdCounts.get(d.gcdrDeviceId) || 0) + 1);
  }

  for (const [name, expected] of Object.entries(options.integrationOverrides || {})) {
    if (expected) integrated.add(name);
    else integrated.delete(name);
  }

  return {
    integratedCustomers: integrated,
    ingestionIdCounts,
    gcdrDeviceIdCounts,
    staleHours: options.staleHours ?? 24,
    disabledRules: new Set(options.disabledRules ?? ['C6']),
    centralDomains: new Set(options.centralDomains ?? ['energy', 'water']),
    now: options.now,
  };
}

const CADASTRO_RANK: Record<string, number> = { critical: 2, pending: 1 };

/**
 * Evaluates every rule for one device and aggregates the two axes.
 *
 * - Lifecycle `stock`/`archived`: every rule is `notApplicable`, both axes `excluded`.
 * - Cadastro: worst known severity among failures (`info` ignored). With no known
 *   failure, any applicable `unknown` gives `partial`; otherwise `ok`. A known
 *   failure plus an `unknown` keeps the failure level with `partial: true`.
 * - Atividade: any failure → `inactive`; else any `unknown` → `nodata`; else `ok`.
 */
export function evaluateDevice(device: InventoryDevice, ctx: RuleContext): DeviceEvaluation {
  const lifecycle = resolveLifecycle(device);

  if (lifecycle.status !== 'active') {
    return {
      lifecycle,
      results: INVENTORY_RULES.map((r) => ({ id: r.id, outcome: 'notApplicable' as RuleOutcome })),
      failed: [],
      cadastro: { level: 'excluded', partial: false },
      atividade: { level: 'excluded', partial: false },
    };
  }

  const results: RuleResult[] = INVENTORY_RULES.map((rule) => ({
    id: rule.id,
    outcome: ctx.disabledRules.has(rule.id) ? 'notApplicable' : rule.evaluate(device, ctx),
  }));

  const failed = results.filter((r) => r.outcome === 'fail').map((r) => r.id);

  let cadastroRank = 0;
  let cadastroUnknown = false;
  let atividadeFail = false;
  let atividadeUnknown = false;

  for (const result of results) {
    const rule = RULE_BY_ID.get(result.id)!;
    if (rule.axis === 'cadastro') {
      if (rule.severity === 'info') continue;
      if (result.outcome === 'fail') cadastroRank = Math.max(cadastroRank, CADASTRO_RANK[rule.severity] || 0);
      if (result.outcome === 'unknown') cadastroUnknown = true;
    } else {
      if (result.outcome === 'fail') atividadeFail = true;
      if (result.outcome === 'unknown') atividadeUnknown = true;
    }
  }

  const cadastroLevel: CadastroLevel =
    cadastroRank === 2 ? 'critical' : cadastroRank === 1 ? 'pending' : cadastroUnknown ? 'partial' : 'ok';
  const atividadeLevel: AtividadeLevel = atividadeFail ? 'inactive' : atividadeUnknown ? 'nodata' : 'ok';

  return {
    lifecycle,
    results,
    failed,
    cadastro: { level: cadastroLevel, partial: cadastroRank > 0 && cadastroUnknown },
    atividade: { level: atividadeLevel, partial: atividadeFail && atividadeUnknown },
  };
}
