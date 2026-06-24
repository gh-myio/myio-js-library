import type { DomainDescriptor } from './DomainDescriptor';

/** Energy domain descriptor (code narrowed to 'energy'). */
export interface EnergyType extends DomainDescriptor {
  code: 'energy';
}

/** Energy domain — defaults. */
export const Energy: EnergyType = {
  code: 'energy',
  name: 'Energia',
  nameEn: 'Energy',
  sigla: 'EN',
  icon: '⚡',
  iconToken: 'energy',
  unit: 'kWh',
  unitInstant: 'kW',
  unitLarge: 'MWh',
  largeUnitThreshold: 1000,
  decimalPlaces: 2,
  chartType: 'bar',
  order: 1,
  valueField: 'consumption',
  summaryEvent: 'myio:energy-summary-ready',
};
