/**
 * RFC-0239 — default handlers. Destinations are imported from the library modules (never from
 * window.MyIOUtils), so the hub works without the TB bridge and the bundle holds one copy.
 */
import { openDashboardPopupAllReport } from '../report-all/openDashboardPopupAllReport';
import { openDemandPanelV2 } from '../../demand-panel-v2/openDemandPanelV2';
import { demandDevicesFromItems } from '../../demand-panel-v2/adapters';
import { buildReportItemsList } from './items';
import type { GroupReportDomain, ReportsHubDevice, ReportsHubHandlerDef } from './types';

/** Error whose message is shown to the user as is. */
export class ReportsHubUserError extends Error {}

const GROUP_DOMAINS: GroupReportDomain[] = ['energy', 'water', 'temperature'];

export const groupReportHandler: ReportsHubHandlerDef = {
  domains: GROUP_DOMAINS,
  isAvailable: (ctx, domain) => (ctx.domains || []).includes(domain as GroupReportDomain),
  async prepare({ domain, item, context, visual, signal }) {
    const d = domain as GroupReportDomain;
    if (!context.domains.includes(d)) throw new ReportsHubUserError('Relatório indisponível para este cliente.');
    await context.ensureDomainLoaded?.(d, signal);
    const base = context.getAllReportBase();
    const itemsList = buildReportItemsList(context.getGroups(d), d, item.id);
    const temperature =
      d === 'temperature'
        ? {
            ...(context.temperature?.validRange ? { temperatureValidRange: context.temperature.validRange } : {}),
            ...(context.temperature?.idealRange ? { temperatureIdealRange: context.temperature.idealRange } : {}),
          }
        : {};
    const theme = visual.palette ?? base.theme;
    const customerName = visual.customerName || base.customerName;
    return () => {
      openDashboardPopupAllReport({
        ...base,
        ...temperature,
        domain: d,
        group: item.id,
        itemsList,
        ...(theme ? { theme } : {}),
        ...(customerName ? { customerName } : {}),
      });
    };
  },
};

export const demandPanelHandler: ReportsHubHandlerDef = {
  domains: ['energy'],
  isAvailable: (ctx) => (ctx.domains || []).includes('energy') && typeof ctx.getDemandPanelParams === 'function',
  prepare({ context, visual }) {
    const dp = context.getDemandPanelParams?.();
    if (!dp) throw new ReportsHubUserError('Relatório de demanda indisponível para este cliente.');
    const items = Object.entries(context.getGroups('energy') || {})
      .filter(([key]) => key !== 'ocultos')
      .flatMap(([, list]) => (list || []) as ReportsHubDevice[]);
    const devices = demandDevicesFromItems(items as Parameters<typeof demandDevicesFromItems>[0]);
    const theme = visual.palette ?? dp.theme;
    const name = visual.customerName || dp.customer.name;
    return () => {
      openDemandPanelV2({ ...dp, devices, theme, customer: { ...dp.customer, name } });
    };
  },
};

export const DEFAULT_HANDLERS: Readonly<Record<string, ReportsHubHandlerDef>> = {
  'group-report': groupReportHandler,
  'demand-panel': demandPanelHandler,
};
