/**
 * RFC-0239 — the only module that knows the ThingsBoard dashboard shape. Never throws on
 * creation: missing capabilities only make domains or items unavailable.
 */
import { createGcdrReportJobsApi, createTbEnvelopeStore, tbUserFromJwt } from '../../demand-panel-v2/adapters';
import type {
  AllReportBase,
  DashboardAdapterOptions,
  DemandPanelParams,
  GroupReportDomain,
  ReportsHubContext,
  ReportsHubDevice,
  ReportsHubOrchestrator,
} from './types';

const GETTERS: Record<GroupReportDomain, 'getEnergyGroups' | 'getWaterGroups' | 'getTemperatureGroups'> = {
  energy: 'getEnergyGroups',
  water: 'getWaterGroups',
  temperature: 'getTemperatureGroups',
};

function numericRange(min: unknown, max: unknown): { min: number; max: number } | undefined {
  if (min == null || max == null || min === '' || max === '') return undefined;
  const a = Number(min);
  const b = Number(max);
  return Number.isFinite(a) && Number.isFinite(b) ? { min: a, max: b } : undefined;
}

export function createDashboardReportsHubContext(opts: DashboardAdapterOptions): ReportsHubContext {
  const orch: ReportsHubOrchestrator = opts.orchestrator || {};
  const log = opts.log || { warn: (...a: unknown[]) => console.warn('[ReportsHub adapter]', ...a) };

  const domains = (Object.keys(GETTERS) as GroupReportDomain[]).filter(
    (d) => typeof orch[GETTERS[d]] === 'function',
  );

  const getGroups = (domain: GroupReportDomain): Record<string, ReportsHubDevice[]> => {
    const fn = orch[GETTERS[domain]];
    try {
      return (typeof fn === 'function' ? fn.call(orch) : null) || {};
    } catch (err) {
      log.warn(`${GETTERS[domain]} failed:`, (err as Error)?.message || err);
      return {};
    }
  };

  // P-8: today's semantics — energy is always loaded; water/temperature hydrate on demand;
  // a missing period or a hydration error is logged and the report still opens.
  const ensureDomainLoaded = async (domain: GroupReportDomain): Promise<void> => {
    if (domain === 'energy' || typeof orch.hydrateDomain !== 'function') return;
    if (opts.isDomainLoaded?.(domain)) return;
    const period = orch.getCurrentPeriod?.();
    if (!period) {
      log.warn(`${domain} not loaded and no current period — report may be empty`);
      return;
    }
    try {
      await orch.hydrateDomain(domain, period);
    } catch (err) {
      log.warn(`hydrateDomain(${domain}) failed:`, (err as Error)?.message || err);
    }
  };

  // Read at selection (prepare), so rotated tokens are picked up.
  const getAllReportBase = (): AllReportBase => {
    const creds = orch.getCredentials?.() || {};
    return {
      customerId: creds.CUSTOMER_ING_ID || '',
      debug: 0,
      api: {
        clientId: creds.CLIENT_ID || '',
        clientSecret: creds.CLIENT_SECRET || '',
        dataApiBaseUrl: opts.getDataApiHost?.() || undefined,
        ingestionToken: orch.tokenManager?.getToken('ingestionToken') || '',
      },
      ui: { theme: 'light' },
    } as AllReportBase;
  };

  const validRange = opts.temperatureClampRange
    ? numericRange(opts.temperatureClampRange.min, opts.temperatureClampRange.max)
    : undefined;
  const idealRange = opts.temperatureLimits
    ? numericRange(opts.temperatureLimits.minTemperature, opts.temperatureLimits.maxTemperature)
    : undefined;

  const demandPossible = domains.includes('energy') && !!opts.tbCustomerId;
  const getDemandPanelParams = (): DemandPanelParams | null => {
    const gcdrCustomerId = orch.gcdrCustomerId || '';
    const baseUrl = orch.gcdrApiBaseUrl || '';
    if (!opts.tbCustomerId || !gcdrCustomerId || !baseUrl) return null;
    const jwt = opts.getJwt() || '';
    return {
      customer: { tbCustomerId: opts.tbCustomerId, gcdrCustomerId, name: '' },
      user: tbUserFromJwt(jwt) || { tbUserId: 'unknown', name: 'Usuário' },
      store: createTbEnvelopeStore({
        tbBaseUrl: opts.tbBaseUrl || '',
        customerId: opts.tbCustomerId,
        getToken: () => opts.getJwt() || '',
      }),
      api: createGcdrReportJobsApi({
        baseUrl,
        gcdrCustomerId,
        // read per request: rotated keys are picked up
        getHeaders: () => ({ 'X-API-Key': orch.gcdrApiKey || '', 'X-Tenant-ID': orch.gcdrTenantId || '' }),
      }),
    };
  };

  return {
    domains,
    getGroups,
    ensureDomainLoaded,
    getAllReportBase,
    ...(validRange || idealRange
      ? { temperature: { ...(validRange ? { validRange } : {}), ...(idealRange ? { idealRange } : {}) } }
      : {}),
    ...(demandPossible ? { getDemandPanelParams } : {}),
  };
}
