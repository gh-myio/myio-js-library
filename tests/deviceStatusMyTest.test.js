import { describe, it, expect } from 'vitest';
import { calculateDeviceStatusWithRanges, DeviceStatusType } from '../src/utils/deviceStatus.js';

describe('calculateDeviceStatusWithRanges - cenário específico', () => {
  it('deve retornar STANDBY quando connectionStatus=online e lastConsumptionValue=0 dentro de standbyRange', () => {
    const rangesWithSource = {
      standbyRange: { down: 0, up: 1 },
      normalRange: { down: 2, up: 10000000 },
      alertRange: { down: 10000001, up: 10000002 },
      failureRange: { down: 10000003, up: 10000004 },
      source: 'customer',
      tier: 2,
      metadata: {
        name: 'mapInstantaneousPowerMotor',
        description: 'Power limits for MOTOR - consumption',
        version: '1.0.0-test',
        telemetryType: 'consumption',
      },
    };

    const ranges = {
      standbyRange: rangesWithSource.standbyRange,
      normalRange: rangesWithSource.normalRange,
      alertRange: rangesWithSource.alertRange,
      failureRange: rangesWithSource.failureRange,
    };

    const result = calculateDeviceStatusWithRanges({
      connectionStatus: 'online',
      lastConsumptionValue: 0,
      ranges,
    });

    expect(result).toBe(DeviceStatusType.STANDBY);
  });
});
