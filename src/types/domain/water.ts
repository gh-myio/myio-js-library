import type { DomainDescriptor } from './DomainDescriptor';

/** Water domain descriptor (code narrowed to 'water'). */
export interface WaterType extends DomainDescriptor {
  code: 'water';
}

/** Water domain — defaults. */
export const Water: WaterType = {
  code: 'water',
  name: 'Água',
  nameEn: 'Water',
  sigla: 'AG',
  icon: '💧',
  iconToken: 'water',
  unit: 'm³',
  unitInstant: 'L',
  unitLarge: 'dam³',
  largeUnitThreshold: 1_000_000,
  decimalPlaces: 2,
  chartType: 'bar',
  order: 2,
  valueField: 'pulses',
  summaryEvent: 'myio:water-summary-ready',
};
