/**
 * Tests for func-004-TelemetryAdapter.js
 * Validates telemetry transformation logic for ThingsBoard
 */

describe('func-004-TelemetryAdapter - Telemetry Transformation', () => {
  let msg, node;

  /**
   * Mock node context
   */
  function createMockNode() {
    const logs = [];
    const warnings = [];
    const errors = [];
    return {
      log: jest.fn((message) => logs.push(message)),
      warn: jest.fn((message) => warnings.push(message)),
      error: jest.fn((message) => errors.push(message)),
      _logs: logs,
      _warnings: warnings,
      _errors: errors
    };
  }

  /**
   * Execute the TelemetryAdapter function code
   */
  function executeTelemetryAdapter(msg, node) {
    try {
      // Validate input
      if (!msg || !msg.payload) {
        node.warn('TelemetryAdapter: Missing message payload');
        return null;
      }

      const logData = msg.payload.value;

      // Validate log data
      if (!logData) {
        node.warn('TelemetryAdapter: Missing log data in payload.value');
        return null;
      }

      // Extract device name
      const deviceName = logData.device;
      if (!deviceName) {
        node.error('TelemetryAdapter: Missing device name in log data');
        return null;
      }

      // Extract timestamp (with fallback)
      const timestampMs = logData.timestampMs || Date.now();

      // Build automation_log object (excluding device name and timestamp)
      const automation_log = {
        action: logData.action,
        shouldActivate: logData.shouldActivate,
        shouldShutdown: logData.shouldShutdown,
        reason: logData.reason
      };

      // Include schedule if present
      if (logData.schedule) {
        automation_log.schedule = logData.schedule;
      }

      // Format as ThingsBoard telemetry
      const telemetryMap = {};
      telemetryMap[deviceName] = [{
        ts: timestampMs,
        values: {
          automation_log: automation_log
        }
      }];

      // Log successful transformation
      node.log(`TelemetryAdapter: Formatted telemetry for device "${deviceName}" - action: ${logData.action}`);

      // Return formatted message
      msg.payload = telemetryMap;
      return msg;

    } catch (error) {
      node.error(`TelemetryAdapter: Error transforming log - ${error.message}`);
      return null;
    }
  }

  /**
   * Helper to create log data (from persister-schedule output)
   */
  function createLogData(deviceName, action, timestampMs = Date.now()) {
    return {
      key: `automation_log_${deviceName.replace(/\s+/g, '')}_${timestampMs}`,
      value: {
        device: deviceName,
        deviceId: `device-${deviceName.toLowerCase().replace(/\s+/g, '-')}`,
        action: action,
        shouldActivate: action === 'ON',
        shouldShutdown: action === 'OFF',
        reason: 'weekday',
        schedule: {
          startHour: '08:00',
          endHour: '18:00',
          retain: true,
          holiday: false,
          daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true }
        },
        context: {
          isHolidayToday: false,
          currentWeekDay: 'mon',
          holidayPolicy: 'exclusive',
          totalSchedules: 1
        },
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs: timestampMs
      }
    };
  }

  beforeEach(() => {
    node = createMockNode();
    msg = {};
  });

  describe('Category 1: Basic Transformation ✅', () => {
    test('✅ Should transform valid log data to ThingsBoard telemetry format', () => {
      const logData = createLogData('Device1', 'ON', 1732445678123);
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result).not.toBeNull();
      expect(result.payload).toHaveProperty('Device1');
      expect(result.payload['Device1']).toHaveLength(1);
    });

    test('✅ Should create telemetry with correct timestamp', () => {
      const timestamp = 1732445678123;
      const logData = createLogData('Device1', 'ON', timestamp);
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload['Device1'][0].ts).toBe(timestamp);
    });

    test('✅ Should include automation_log in values', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload['Device1'][0].values).toHaveProperty('automation_log');
    });

    test('✅ Should exclude device name from automation_log', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).not.toHaveProperty('device');
    });

    test('✅ Should exclude timestamp from automation_log', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).not.toHaveProperty('timestamp');
      expect(automation_log).not.toHaveProperty('timestampMs');
    });

    test('✅ Should exclude deviceId from automation_log', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).not.toHaveProperty('deviceId');
    });
  });

  describe('Category 2: Action Types 🔄', () => {
    test('✅ Should handle ON action correctly', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log.action).toBe('ON');
      expect(automation_log.shouldActivate).toBe(true);
      expect(automation_log.shouldShutdown).toBe(false);
    });

    test('✅ Should handle OFF action correctly', () => {
      const logData = createLogData('Device1', 'OFF');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log.action).toBe('OFF');
      expect(automation_log.shouldActivate).toBe(false);
      expect(automation_log.shouldShutdown).toBe(true);
    });
  });

  describe('Category 3: Device Names 📛', () => {
    test('✅ Should handle device names with spaces', () => {
      const logData = createLogData('HVAC Zone 1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload).toHaveProperty('HVAC Zone 1');
      expect(result.payload['HVAC Zone 1']).toBeDefined();
    });

    test('✅ Should handle device names with special characters', () => {
      const logData = createLogData('Device-1_Test@Location#1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload).toHaveProperty('Device-1_Test@Location#1');
    });

    test('✅ Should handle very long device names', () => {
      const longName = 'A'.repeat(100);
      const logData = createLogData(longName, 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload).toHaveProperty(longName);
    });

    test('✅ Should handle device names with multipliers (x2.5A format)', () => {
      const logData = createLogData('Compressor x2.5A', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      // Should keep original name (no normalization)
      expect(result.payload['Compressor x2.5A']).toBeDefined();
      expect(Object.keys(result.payload)).toContain('Compressor x2.5A');
    });
  });

  describe('Category 4: Schedule Data 📅', () => {
    test('✅ Should include schedule in automation_log', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).toHaveProperty('schedule');
      expect(automation_log.schedule).toHaveProperty('startHour');
      expect(automation_log.schedule).toHaveProperty('endHour');
    });

    test('✅ Should handle missing schedule gracefully', () => {
      const logData = createLogData('Device1', 'ON');
      delete logData.value.schedule;
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result).not.toBeNull();
      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).not.toHaveProperty('schedule');
    });
  });

  describe('Category 5: Timestamp Handling ⏰', () => {
    test('✅ Should use timestampMs from log data', () => {
      const timestamp = 1732445678123;
      const logData = createLogData('Device1', 'ON', timestamp);
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload['Device1'][0].ts).toBe(timestamp);
    });

    test('✅ Should use fallback timestamp if timestampMs missing', () => {
      const logData = createLogData('Device1', 'ON');
      delete logData.value.timestampMs;
      msg.payload = logData;

      const beforeTimestamp = Date.now();
      const result = executeTelemetryAdapter(msg, node);
      const afterTimestamp = Date.now();

      const resultTimestamp = result.payload['Device1'][0].ts;
      expect(resultTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(resultTimestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    test('✅ Should handle zero timestamp', () => {
      const logData = createLogData('Device1', 'ON', 0);
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      // 0 is falsy, should use Date.now() as fallback
      expect(result.payload['Device1'][0].ts).toBeGreaterThan(0);
    });
  });

  describe('Category 6: Null/Invalid Input Handling ❌', () => {
    test('❌ Should return null when msg is null', () => {
      const result = executeTelemetryAdapter(null, node);

      expect(result).toBeNull();
      expect(node.warn).toHaveBeenCalledWith('TelemetryAdapter: Missing message payload');
    });

    test('❌ Should return null when msg.payload is missing', () => {
      msg.payload = null;

      const result = executeTelemetryAdapter(msg, node);

      expect(result).toBeNull();
      expect(node.warn).toHaveBeenCalledWith('TelemetryAdapter: Missing message payload');
    });

    test('❌ Should return null when payload.value is missing', () => {
      msg.payload = { key: 'test' };

      const result = executeTelemetryAdapter(msg, node);

      expect(result).toBeNull();
      expect(node.warn).toHaveBeenCalledWith('TelemetryAdapter: Missing log data in payload.value');
    });

    test('❌ Should return null when device name is missing', () => {
      const logData = createLogData('Device1', 'ON');
      delete logData.value.device;
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result).toBeNull();
      expect(node.error).toHaveBeenCalledWith('TelemetryAdapter: Missing device name in log data');
    });

    test('❌ Should return null when device name is empty string', () => {
      const logData = createLogData('', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result).toBeNull();
      expect(node.error).toHaveBeenCalledWith('TelemetryAdapter: Missing device name in log data');
    });
  });

  describe('Category 7: Required Fields 📋', () => {
    test('✅ Should include action field', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).toHaveProperty('action');
    });

    test('✅ Should include shouldActivate field', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).toHaveProperty('shouldActivate');
    });

    test('✅ Should include shouldShutdown field', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).toHaveProperty('shouldShutdown');
    });

    test('✅ Should include reason field', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const automation_log = result.payload['Device1'][0].values.automation_log;
      expect(automation_log).toHaveProperty('reason');
    });
  });

  describe('Category 8: Logging 📝', () => {
    test('✅ Should log successful transformation', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      executeTelemetryAdapter(msg, node);

      expect(node.log).toHaveBeenCalledWith(
        'TelemetryAdapter: Formatted telemetry for device "Device1" - action: ON'
      );
    });

    test('✅ Should log with correct device name and action', () => {
      const logData = createLogData('HVAC Zone 2', 'OFF');
      msg.payload = logData;

      executeTelemetryAdapter(msg, node);

      expect(node.log).toHaveBeenCalledWith(
        'TelemetryAdapter: Formatted telemetry for device "HVAC Zone 2" - action: OFF'
      );
    });
  });

  describe('Category 9: ThingsBoard Format Compliance 🎯', () => {
    test('✅ Should match ThingsBoard telemetry structure', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      const deviceTelemetry = result.payload['Device1'][0];
      expect(deviceTelemetry).toHaveProperty('ts');
      expect(deviceTelemetry).toHaveProperty('values');
      expect(typeof deviceTelemetry.ts).toBe('number');
      expect(typeof deviceTelemetry.values).toBe('object');
    });

    test('✅ Should create single telemetry entry per device', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(result.payload['Device1']).toHaveLength(1);
    });

    test('✅ Should use device name as map key', () => {
      const logData = createLogData('TestDevice', 'ON');
      msg.payload = logData;

      const result = executeTelemetryAdapter(msg, node);

      expect(Object.keys(result.payload)).toEqual(['TestDevice']);
    });
  });

  describe('Category 10: Integration with Persister 🔗', () => {
    test('✅ Should accept output from func-002-PersistAdapter', () => {
      // Simulate exact output from persister-schedule
      msg.payload = {
        key: 'automation_log_Device1_1732445678123',
        value: {
          device: 'Device1',
          deviceId: 'device-1',
          action: 'ON',
          shouldActivate: true,
          shouldShutdown: false,
          reason: 'weekday',
          schedule: {
            startHour: '17:30',
            endHour: '05:30',
            retain: true,
            holiday: false,
            daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
          },
          context: {
            isHolidayToday: false,
            currentWeekDay: 'sat',
            holidayPolicy: 'exclusive',
            totalSchedules: 1
          },
          timestamp: '2025-11-24T12:00:00.000Z',
          timestampMs: 1732445678123
        }
      };

      const result = executeTelemetryAdapter(msg, node);

      expect(result).not.toBeNull();
      expect(result.payload['Device1']).toBeDefined();
    });
  });

  describe('Category 11: Performance ⚡', () => {
    test('✅ Should process single log in < 10ms', () => {
      const logData = createLogData('Device1', 'ON');
      msg.payload = logData;

      const startTime = process.hrtime.bigint();
      executeTelemetryAdapter(msg, node);
      const endTime = process.hrtime.bigint();

      const durationMs = Number(endTime - startTime) / 1000000;
      expect(durationMs).toBeLessThan(10);
    });

    test('✅ Should handle 100 sequential transformations', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const logData = createLogData(`Device${i}`, i % 2 === 0 ? 'ON' : 'OFF');
        msg.payload = logData;
        executeTelemetryAdapter(msg, node);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // 100 logs in < 100ms
    });
  });
});
