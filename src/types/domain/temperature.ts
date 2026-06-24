import type { DomainDescriptor } from './DomainDescriptor';

/** Temperature domain descriptor (code narrowed to 'temperature'). */
export interface TemperatureType extends DomainDescriptor {
  code: 'temperature';
}

/** Temperature domain — defaults. */
export const Temperature: TemperatureType = {
  code: 'temperature',
  name: 'Temperatura',
  nameEn: 'Temperature',
  sigla: 'TMP',
  icon: '🌡️',
  iconToken: 'temperature',
  unit: '°C',
  decimalPlaces: 1,
  chartType: 'line',
  order: 3,
};
