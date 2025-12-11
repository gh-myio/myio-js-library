// tests/deviceStatusWithRanges.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDeviceStatusWithRanges, DeviceStatusType } from '../src/utils/deviceStatus.js';

// helper de ranges padrão para vários testes
const baseRanges = {
  standbyRange: { down: 0, up: 150 },
  normalRange: { down: 150, up: 800 },
  alertRange: { down: 800, up: 1200 },
  failureRange: { down: 1200, up: 99999 },
};

describe('calculateDeviceStatusWithRanges', () => {
  describe('validação de connectionStatus', () => {
    it('deve retornar MAINTENANCE para connectionStatus inválido', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'banana',
        lastConsumptionValue: 100,
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.MAINTENANCE);
    });

    it('deve retornar NOT_INSTALLED quando connectionStatus = waiting', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'waiting',
        lastConsumptionValue: null,
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.NOT_INSTALLED);
    });

    it('deve retornar NO_INFO quando connectionStatus = offline', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'offline',
        lastConsumptionValue: null,
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.NO_INFO);
    });

    it('deve retornar POWER_ON quando online e lastConsumptionValue = null/undefined', () => {
      const statusNull = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: null,
        ranges: baseRanges,
      });
      const statusUndefined = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: undefined,
        ranges: baseRanges,
      });

      expect(statusNull).toBe(DeviceStatusType.POWER_ON);
      expect(statusUndefined).toBe(DeviceStatusType.POWER_ON);
    });
  });

  describe('validação de ranges', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('deve retornar MAINTENANCE e logar erro quando ranges faltar campos obrigatórios', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 100,
        ranges: {
          // faltando normalRange, alertRange, failureRange
          standbyRange: { down: 0, up: 150 },
        },
      });

      expect(status).toBe(DeviceStatusType.MAINTENANCE);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('deve retornar MAINTENANCE quando consumo não for numérico (NaN)', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 'não-numérico',
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.MAINTENANCE);
    });
  });

  describe('cálculo de status por faixas (ranges)', () => {
    it('deve retornar STANDBY quando consumo estiver dentro de standbyRange', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 50, // 0–150
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.STANDBY);
    });

    it('deve retornar POWER_ON quando consumo estiver dentro de normalRange', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 500, // 150–800
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.POWER_ON);
    });

    it('deve retornar WARNING quando consumo estiver dentro de alertRange', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 1000, // 800–1200
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.WARNING);
    });

    it('deve retornar FAILURE quando consumo estiver dentro de failureRange', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 2500, // 1200–99999
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.FAILURE);
    });

    it('deve retornar FAILURE quando consumo for maior que failureRange.up', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 200000, // > 99999
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.FAILURE);
    });

    it('deve retornar MAINTENANCE quando consumo for menor que standbyRange.down', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: -10, // < 0
        ranges: baseRanges,
      });

      expect(status).toBe(DeviceStatusType.MAINTENANCE);
    });

    it('deve respeitar valores de borda dos ranges (inclusive)', () => {
      const ranges = baseRanges;

      // bordas standbyRange
      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.standbyRange.down,
          ranges,
        })
      ).toBe(DeviceStatusType.STANDBY);

      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.standbyRange.up,
          ranges,
        })
      ).toBe(DeviceStatusType.STANDBY);

      // bordas normalRange
      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.normalRange.down,
          ranges,
        })
      ).toBe(DeviceStatusType.POWER_ON);

      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.normalRange.up,
          ranges,
        })
      ).toBe(DeviceStatusType.POWER_ON);

      // bordas alertRange
      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.alertRange.down,
          ranges,
        })
      ).toBe(DeviceStatusType.WARNING);

      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.alertRange.up,
          ranges,
        })
      ).toBe(DeviceStatusType.WARNING);

      // bordas failureRange
      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.failureRange.down,
          ranges,
        })
      ).toBe(DeviceStatusType.FAILURE);

      expect(
        calculateDeviceStatusWithRanges({
          connectionStatus: 'online',
          lastConsumptionValue: ranges.failureRange.up,
          ranges,
        })
      ).toBe(DeviceStatusType.FAILURE);
    });
  });

  describe('integração com JSON de configuração (parse de ranges)', () => {
    /**
     * Exemplo de JSON de configuração vindo do Dashboard
     * (você pode ajustar os deviceStatusName conforme sua config real)
     */
    const jsonConfig = {
      version: '1.0.0',
      limitsByInstantaneoustPowerType: [
        {
          telemetryType: 'consumption',
          itemsByDeviceType: [
            {
              deviceType: 'MOTOR',
              name: 'deviceMapInstaneousPowerMotor',
              description: 'Override manual configurado via Dashboard',
              limitsByDeviceStatus: [
                {
                  deviceStatusName: 'standby',
                  limitsValues: { baseValue: 0, topValue: 150 },
                },
                {
                  deviceStatusName: 'normal',
                  limitsValues: { baseValue: 150, topValue: 800 },
                },
                {
                  deviceStatusName: 'alert',
                  limitsValues: { baseValue: 800, topValue: 1200 },
                },
                {
                  deviceStatusName: 'failure',
                  limitsValues: { baseValue: 1200, topValue: 99999 },
                },
              ],
            },
          ],
        },
      ],
    };

    function buildRangesFromJson(config, telemetryType, deviceType) {
      const typeBlock = config.limitsByInstantaneoustPowerType.find((t) => t.telemetryType === telemetryType);
      if (!typeBlock) return null;

      const deviceBlock = typeBlock.itemsByDeviceType.find((item) => item.deviceType === deviceType);
      if (!deviceBlock) return null;

      // defaults (podem ser 0/0 ou algum fallback que você use no código real)
      const ranges = {
        standbyRange: null,
        normalRange: null,
        alertRange: null,
        failureRange: null,
      };

      for (const entry of deviceBlock.limitsByDeviceStatus || []) {
        const { deviceStatusName, limitsValues } = entry;
        const rangeObj = {
          down: limitsValues.baseValue,
          up: limitsValues.topValue,
        };

        switch (deviceStatusName) {
          case 'standby':
            ranges.standbyRange = rangeObj;
            break;
          case 'normal':
            ranges.normalRange = rangeObj;
            break;
          case 'alert':
            ranges.alertRange = rangeObj;
            break;
          case 'failure':
            ranges.failureRange = rangeObj;
            break;
          default:
          // ignora desconhecidos
        }
      }

      return ranges;
    }

    it('deve montar ranges a partir do JSON e classificar corretamente como WARNING', () => {
      const rangesFromJson = buildRangesFromJson(jsonConfig, 'consumption', 'MOTOR');

      expect(rangesFromJson).toEqual({
        standbyRange: { down: 0, up: 150 },
        normalRange: { down: 150, up: 800 },
        alertRange: { down: 800, up: 1200 },
        failureRange: { down: 1200, up: 99999 },
      });

      // consumo dentro do range de alerta -> WARNING
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 1000,
        ranges: rangesFromJson,
      });

      expect(status).toBe(DeviceStatusType.WARNING);
    });

    it('deve montar ranges e classificar corretamente como FAILURE quando consumo > failureRange.up', () => {
      const rangesFromJson = buildRangesFromJson(jsonConfig, 'consumption', 'MOTOR');

      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 200000,
        ranges: rangesFromJson,
      });

      expect(status).toBe(DeviceStatusType.FAILURE);
    });
  });
});
