import { describe, it, expect } from 'vitest';
import {
  formatWaterVolumeM3,
  formatTankHeadFromCm,
  calcDeltaPercent,
  formatEnergyByGroup,
  formatAllInSameWaterUnit
} from '../src/format/water';

import {
  formatDateForInput,
  parseInputDateToDate
} from '../src/date/inputDate';

import {
  timeWindowFromInputYMD,
  formatDateWithTimezoneOffset,
  getSaoPauloISOStringFixed
} from '../src/date/timeWindow';

import {
  averageByDay,
  groupByDay
} from '../src/date/averageByDay';

import {
  buildWaterReportCSV,
  buildWaterStoresCSV,
  toCSV
} from '../src/csv/waterReports';

import {
  classifyWaterLabel,
  classifyWaterLabels,
  getWaterCategories,
  isWaterCategory
} from '../src/classify/waterLabel';

describe('Water Formatting Functions', () => {
  describe('formatWaterVolumeM3', () => {
    it('should format water volume with M³ unit', () => {
      expect(formatWaterVolumeM3(12.345)).toBe('12,35 M³');
      expect(formatWaterVolumeM3(1000.5)).toBe('1.000,50 M³');
      expect(formatWaterVolumeM3(0)).toBe('0,00 M³');
    });

    it('should handle null/undefined values', () => {
      expect(formatWaterVolumeM3(null)).toBe('-');
      expect(formatWaterVolumeM3(undefined)).toBe('-');
      expect(formatWaterVolumeM3(NaN)).toBe('-');
    });

    it('should use custom locale', () => {
      expect(formatWaterVolumeM3(12.345, 'en-US')).toBe('12.35 M³');
    });
  });

  describe('formatTankHeadFromCm', () => {
    it('should convert cm to m.c.a.', () => {
      expect(formatTankHeadFromCm(178)).toBe('1,78 m.c.a.');
      expect(formatTankHeadFromCm(250)).toBe('2,50 m.c.a.');
      expect(formatTankHeadFromCm(0)).toBe('0,00 m.c.a.');
    });

    it('should handle null/undefined values', () => {
      expect(formatTankHeadFromCm(null)).toBe('-');
      expect(formatTankHeadFromCm(undefined)).toBe('-');
      expect(formatTankHeadFromCm(NaN)).toBe('-');
    });
  });

  describe('calcDeltaPercent', () => {
    it('should calculate percentage increase', () => {
      const result = calcDeltaPercent(100, 120);
      expect(result.value).toBe(20);
      expect(result.type).toBe('increase');
    });

    it('should calculate percentage decrease', () => {
      const result = calcDeltaPercent(120, 100);
      expect(result.value).toBe(16.666666666666664);
      expect(result.type).toBe('decrease');
    });

    it('should handle neutral case', () => {
      const result = calcDeltaPercent(100, 100);
      expect(result.value).toBe(0);
      expect(result.type).toBe('neutral');
    });

    it('should handle zero previous value', () => {
      const result = calcDeltaPercent(0, 100);
      expect(result.value).toBe(100);
      expect(result.type).toBe('increase');
    });

    it('should handle both zero values', () => {
      const result = calcDeltaPercent(0, 0);
      expect(result.value).toBe(0);
      expect(result.type).toBe('neutral');
    });

    it('should handle null/undefined values', () => {
      const result = calcDeltaPercent(null, 100);
      expect(result.value).toBe(0);
      expect(result.type).toBe('neutral');
    });
  });

  describe('formatEnergyByGroup', () => {
    it('should format Caixas D\'Água as tank head', () => {
      expect(formatEnergyByGroup(178, "Caixas D'Água")).toBe('1,78 m.c.a.');
    });

    it('should format other groups as water volume', () => {
      expect(formatEnergyByGroup(12.345, "Lojas")).toBe('12,35 M³');
      expect(formatEnergyByGroup(12.345, "Área Comum")).toBe('12,35 M³');
    });

    it('should handle large values with scaling', () => {
      expect(formatEnergyByGroup(1000000, "Lojas")).toBe('1,00 M³ (GWh scale)');
      expect(formatEnergyByGroup(1000, "Lojas")).toBe('1,00 M³ (MWh scale)');
    });
  });

  describe('formatAllInSameWaterUnit', () => {
    it('should return format function and unit', () => {
      const result = formatAllInSameWaterUnit([100, 200, 300]);
      expect(result.unit).toBe('M³');
      expect(result.format(150)).toBe('150.00 M³');
    });

    it('should handle large values', () => {
      const result = formatAllInSameWaterUnit([1000000, 2000000]);
      expect(result.unit).toBe('M³');
      expect(result.format(1500000)).toBe('1.50 M³');
    });
  });
});

describe('Date Input Functions', () => {
  describe('formatDateForInput', () => {
    it('should format date for HTML input', () => {
      const date = new Date(2025, 7, 26); // August 26, 2025
      expect(formatDateForInput(date)).toBe('2025-08-26');
    });

    it('should handle invalid dates', () => {
      expect(formatDateForInput(new Date('invalid'))).toBe('');
      expect(formatDateForInput(null)).toBe('');
    });
  });

  describe('parseInputDateToDate', () => {
    it('should parse input date string', () => {
      const result = parseInputDateToDate('2025-08-26');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(7); // 0-indexed
      expect(result.getDate()).toBe(26);
      expect(result.getHours()).toBe(0);
    });

    it('should handle invalid input', () => {
      expect(parseInputDateToDate('')).toBe(null);
      expect(parseInputDateToDate('invalid')).toBe(null);
      expect(parseInputDateToDate('2025-13-32')).not.toBe(null); // Date constructor handles this
    });
  });
});

describe('Time Window Functions', () => {
  describe('timeWindowFromInputYMD', () => {
    it('should create time window from date strings', () => {
      const result = timeWindowFromInputYMD('2025-08-01', '2025-08-26');
      expect(result.startTs).toBeGreaterThan(0);
      expect(result.endTs).toBeGreaterThan(result.startTs);
    });

    it('should handle invalid dates', () => {
      const result = timeWindowFromInputYMD('', '2025-08-26');
      expect(result.startTs).toBe(0);
      expect(result.endTs).toBe(0);
    });
  });

  describe('getSaoPauloISOStringFixed', () => {
    it('should format with São Paulo timezone', () => {
      expect(getSaoPauloISOStringFixed('2025-08-26')).toBe('2025-08-26T00:00:00.000-03:00');
      expect(getSaoPauloISOStringFixed('2025-08-26', true)).toBe('2025-08-26T23:59:59.999-03:00');
    });

    it('should handle empty input', () => {
      expect(getSaoPauloISOStringFixed('')).toBe('');
    });
  });
});

describe('Average By Day Functions', () => {
  describe('averageByDay', () => {
    it('should calculate daily averages', () => {
      const data = [
        { ts: new Date('2025-08-26T10:00:00'), value: 100 },
        { ts: new Date('2025-08-26T14:00:00'), value: 200 },
        { ts: new Date('2025-08-27T10:00:00'), value: 150 }
      ];
      
      const result = averageByDay(data);
      expect(result).toHaveLength(2);
      expect(result[0].day).toBe('2025-08-26');
      expect(result[0].average).toBe(150);
      expect(result[1].day).toBe('2025-08-27');
      expect(result[1].average).toBe(150);
    });

    it('should handle empty data', () => {
      expect(averageByDay([])).toEqual([]);
      expect(averageByDay(null)).toEqual([]);
    });

    it('should filter invalid values', () => {
      const data = [
        { ts: new Date('2025-08-26T10:00:00'), value: 100 },
        { ts: new Date('2025-08-26T14:00:00'), value: null },
        { ts: new Date('2025-08-26T16:00:00'), value: 200 }
      ];
      
      const result = averageByDay(data);
      expect(result[0].average).toBe(150); // (100 + 200) / 2
    });
  });
});

describe('CSV Water Reports Functions', () => {
  describe('buildWaterReportCSV', () => {
    it('should build CSV for water reports', () => {
      const rows = [
        {
          formattedDate: '26/08/2025',
          day: 'Segunda-feira',
          avgConsumption: '12,50',
          minDemand: '10,00',
          maxDemand: '15,00',
          totalConsumption: '300,00'
        }
      ];
      
      const meta = {
        issueDate: '26/08/2025 - 23:19',
        name: 'Loja A',
        identifier: 'SCP001'
      };
      
      const result = buildWaterReportCSV(rows, meta);
      expect(result).toContain('DATA EMISSÃO;26/08/2025 - 23:19');
      expect(result).toContain('Total;300.00');
      expect(result).toContain('Loja:;Loja A;SCP001');
      expect(result).toContain('26/08/2025;Segunda-feira;12,50;10,00;15,00;300,00');
    });

    it('should handle empty rows', () => {
      const result = buildWaterReportCSV([], { issueDate: '26/08/2025' });
      expect(result).toBe('');
    });
  });

  describe('buildWaterStoresCSV', () => {
    it('should build CSV for stores', () => {
      const rows = [
        {
          entityLabel: 'Loja A',
          deviceId: 'DEV001',
          consumptionM3: 150.5
        }
      ];
      
      const meta = {
        issueDate: '26/08/2025 - 23:19'
      };
      
      const result = buildWaterStoresCSV(rows, meta);
      expect(result).toContain('DATA EMISSÃO;26/08/2025 - 23:19');
      expect(result).toContain('Loja A;DEV001;150,50');
    });

    it('should handle backward compatibility with consumptionKwh', () => {
      const rows = [
        {
          entityLabel: 'Loja A',
          deviceId: 'DEV001',
          consumptionKwh: 150.5
        }
      ];
      
      const result = buildWaterStoresCSV(rows, { issueDate: '26/08/2025' });
      expect(result).toContain('150,50');
    });
  });

  describe('toCSV', () => {
    it('should convert 2D array to CSV', () => {
      const rows = [
        ['Header1', 'Header2'],
        ['Value1', 'Value2'],
        ['Value3', 'Value4']
      ];
      
      const result = toCSV(rows);
      expect(result).toBe('Header1;Header2\nValue1;Value2\nValue3;Value4');
    });

    it('should handle values with delimiters', () => {
      const rows = [
        ['Value with; semicolon', 'Normal value']
      ];
      
      const result = toCSV(rows);
      expect(result).toContain('"Value with; semicolon"');
    });
  });
});

describe('Water Classification Functions', () => {
  describe('classifyWaterLabel', () => {
    it('should classify water tanks', () => {
      expect(classifyWaterLabel('Caixa Superior')).toBe("Caixas D'Água");
      expect(classifyWaterLabel('Relógio de Água')).toBe("Caixas D'Água");
      expect(classifyWaterLabel('nível_terraço')).toBe("Caixas D'Água");
    });

    it('should classify common areas', () => {
      expect(classifyWaterLabel('Administração')).toBe('Área Comum');
      expect(classifyWaterLabel('Bomba Central')).toBe('Área Comum');
      expect(classifyWaterLabel('Chiller')).toBe('Área Comum');
    });

    it('should default to stores', () => {
      expect(classifyWaterLabel('Loja 101')).toBe('Lojas');
      expect(classifyWaterLabel('McDonald\'s')).toBe('Lojas');
      expect(classifyWaterLabel('')).toBe('Lojas');
    });
  });

  describe('classifyWaterLabels', () => {
    it('should classify multiple labels', () => {
      const labels = ['Caixa Superior', 'Loja 101', 'Administração'];
      const result = classifyWaterLabels(labels);
      
      expect(result["Caixas D'Água"]).toBe(1);
      expect(result["Lojas"]).toBe(1);
      expect(result["Área Comum"]).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe('getWaterCategories', () => {
    it('should return all categories', () => {
      const categories = getWaterCategories();
      expect(categories).toEqual(["Caixas D'Água", "Lojas", "Área Comum"]);
    });
  });

  describe('isWaterCategory', () => {
    it('should check if label belongs to category', () => {
      expect(isWaterCategory('Caixa Superior', "Caixas D'Água")).toBe(true);
      expect(isWaterCategory('Loja 101', "Caixas D'Água")).toBe(false);
    });
  });
});
