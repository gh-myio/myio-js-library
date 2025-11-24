/**
 * Tests for func-002-PersistAdapter.js
 * Validates persistence adapter logic for automation logs
 */

describe('func-002-PersistAdapter - Persistence Adapter', () => {
  let msg, flow, node;

  /**
   * Mock flow context
   */
  function createMockFlow() {
    const storage = {};
    return {
      get: jest.fn((key) => storage[key]),
      set: jest.fn((key, value) => {
        storage[key] = value;
      }),
      _storage: storage
    };
  }

  /**
   * Mock node context
   */
  function createMockNode() {
    const logs = [];
    const errors = [];
    return {
      log: jest.fn((message) => logs.push(message)),
      warn: jest.fn((message) => logs.push(message)),
      error: jest.fn((message) => errors.push(message)),
      _logs: logs,
      _errors: errors
    };
  }

  /**
   * Execute the PersistAdapter function code
   */
  function executePersistAdapter(msg, flow, node) {
    try {
      const payload = msg.payload;

      if (!payload || !payload._observability) {
        return null;
      }

      const obs = payload._observability;

      let storedLogs = flow.get('automation_logs') || {};
      storedLogs[obs.logKey] = obs.logData;
      flow.set('automation_logs', storedLogs);

      const currentTotal = flow.get('automation_metrics_total') || 0;
      flow.set('automation_metrics_total', currentTotal + 1);

      node.log('Persisting automation event: ' + payload.deviceName + ' - ' + obs.logData.action);

      msg.payload = {
        key: obs.logKey,
        value: obs.logData
      };

      return msg;

    } catch (e) {
      node.error('Error in PersistAdapter: ' + e.message);
      return null;
    }
  }

  /**
   * Helper to create observability data
   */
  function createObservability(deviceName, action) {
    const timestamp = Date.now();
    return {
      logKey: `automation_log_${deviceName.replace(/\s+/g, '')}_${timestamp}`,
      logData: {
        device: deviceName,
        deviceId: 'device-1',
        action: action,
        shouldActivate: action === 'ON',
        shouldShutdown: action === 'OFF',
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
        timestamp: new Date().toISOString(),
        timestampMs: timestamp
      }
    };
  }

  beforeEach(() => {
    flow = createMockFlow();
    node = createMockNode();
    msg = {};
  });

  describe('Category 1: Basic Functionality ✅', () => {
    test('✅ Should persist valid observability data', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        shouldActivate: true,
        shouldShutdown: false,
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result).not.toBeNull();
      expect(result.payload).toEqual({
        key: obs.logKey,
        value: obs.logData
      });
    });

    test('✅ Should store log in flow automation_logs', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      executePersistAdapter(msg, flow, node);

      expect(flow.set).toHaveBeenCalledWith('automation_logs', expect.objectContaining({
        [obs.logKey]: obs.logData
      }));
    });

    test('✅ Should increment automation_metrics_total', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      executePersistAdapter(msg, flow, node);

      expect(flow.get).toHaveBeenCalledWith('automation_metrics_total');
      expect(flow.set).toHaveBeenCalledWith('automation_metrics_total', 1);
    });

    test('✅ Should log persistence event', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      executePersistAdapter(msg, flow, node);

      expect(node.log).toHaveBeenCalledWith('Persisting automation event: Device1 - ON');
    });
  });

  describe('Category 2: Multiple Events 📊', () => {
    test('✅ Should persist multiple events sequentially', () => {
      const obs1 = createObservability('Device1', 'ON');
      const obs2 = createObservability('Device2', 'OFF');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs1
      };
      executePersistAdapter(msg, flow, node);

      msg.payload = {
        deviceName: 'Device2',
        _observability: obs2
      };
      executePersistAdapter(msg, flow, node);

      const storedLogs = flow._storage['automation_logs'];
      expect(storedLogs[obs1.logKey]).toEqual(obs1.logData);
      expect(storedLogs[obs2.logKey]).toEqual(obs2.logData);
    });

    test('✅ Should correctly increment counter for multiple events', () => {
      const obs1 = createObservability('Device1', 'ON');
      const obs2 = createObservability('Device2', 'OFF');
      const obs3 = createObservability('Device3', 'ON');

      msg.payload = { deviceName: 'Device1', _observability: obs1 };
      executePersistAdapter(msg, flow, node);

      msg.payload = { deviceName: 'Device2', _observability: obs2 };
      executePersistAdapter(msg, flow, node);

      msg.payload = { deviceName: 'Device3', _observability: obs3 };
      executePersistAdapter(msg, flow, node);

      expect(flow._storage['automation_metrics_total']).toBe(3);
    });

    test('✅ Should maintain log history across multiple calls', () => {
      const events = [];
      for (let i = 1; i <= 10; i++) {
        const obs = createObservability(`Device${i}`, i % 2 === 0 ? 'OFF' : 'ON');
        events.push(obs);

        msg.payload = {
          deviceName: `Device${i}`,
          _observability: obs
        };
        executePersistAdapter(msg, flow, node);
      }

      const storedLogs = flow._storage['automation_logs'];
      expect(Object.keys(storedLogs).length).toBe(10);

      events.forEach(obs => {
        expect(storedLogs[obs.logKey]).toEqual(obs.logData);
      });
    });
  });

  describe('Category 3: Null/Invalid Input Handling ❌', () => {
    test('❌ Should return null when payload is missing', () => {
      msg.payload = null;

      const result = executePersistAdapter(msg, flow, node);

      expect(result).toBeNull();
      expect(flow.set).not.toHaveBeenCalled();
    });

    test('❌ Should return null when payload is undefined', () => {
      msg.payload = undefined;

      const result = executePersistAdapter(msg, flow, node);

      expect(result).toBeNull();
      expect(flow.set).not.toHaveBeenCalled();
    });

    test('❌ Should return null when _observability is missing', () => {
      msg.payload = {
        deviceName: 'Device1',
        shouldActivate: true
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result).toBeNull();
      expect(flow.set).not.toHaveBeenCalled();
    });

    test('❌ Should return null when _observability is null', () => {
      msg.payload = {
        deviceName: 'Device1',
        _observability: null
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result).toBeNull();
      expect(flow.set).not.toHaveBeenCalled();
    });

    test('✅ Should not increment metrics when no observability', () => {
      msg.payload = {
        deviceName: 'Device1',
        shouldActivate: false,
        shouldShutdown: false
      };

      executePersistAdapter(msg, flow, node);

      expect(flow._storage['automation_metrics_total']).toBeUndefined();
    });
  });

  describe('Category 4: Data Format Validation 📝', () => {
    test('✅ Should format output correctly for persist-in node', () => {
      const obs = createObservability('TestDevice', 'ON');

      msg.payload = {
        deviceName: 'TestDevice',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result.payload).toHaveProperty('key');
      expect(result.payload).toHaveProperty('value');
      expect(result.payload.key).toBe(obs.logKey);
      expect(result.payload.value).toEqual(obs.logData);
    });

    test('✅ Should preserve all logData fields', () => {
      const obs = createObservability('TestDevice', 'OFF');

      msg.payload = {
        deviceName: 'TestDevice',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      const expectedFields = [
        'device',
        'deviceId',
        'action',
        'shouldActivate',
        'shouldShutdown',
        'reason',
        'schedule',
        'context',
        'timestamp',
        'timestampMs'
      ];

      expectedFields.forEach(field => {
        expect(result.payload.value).toHaveProperty(field);
      });
    });

    test('✅ Should handle device names with spaces', () => {
      const obs = createObservability('Device With Spaces', 'ON');

      msg.payload = {
        deviceName: 'Device With Spaces',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result.payload.key).toContain('DeviceWithSpaces');
      expect(result.payload.value.device).toBe('Device With Spaces');
    });
  });

  describe('Category 5: Action Types 🔄', () => {
    test('✅ Should handle ON action correctly', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result.payload.value.action).toBe('ON');
      expect(result.payload.value.shouldActivate).toBe(true);
      expect(result.payload.value.shouldShutdown).toBe(false);
    });

    test('✅ Should handle OFF action correctly', () => {
      const obs = createObservability('Device1', 'OFF');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result.payload.value.action).toBe('OFF');
      expect(result.payload.value.shouldActivate).toBe(false);
      expect(result.payload.value.shouldShutdown).toBe(true);
    });
  });

  describe('Category 6: Edge Cases 🔧', () => {
    test('✅ Should handle empty automation_logs initially', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      // Ensure automation_logs doesn't exist
      flow._storage['automation_logs'] = undefined;

      const result = executePersistAdapter(msg, flow, node);

      expect(result).not.toBeNull();
      expect(flow._storage['automation_logs']).toHaveProperty(obs.logKey);
    });

    test('✅ Should handle zero metrics_total initially', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      // Ensure metrics_total doesn't exist
      flow._storage['automation_metrics_total'] = undefined;

      executePersistAdapter(msg, flow, node);

      expect(flow._storage['automation_metrics_total']).toBe(1);
    });

    test('✅ Should handle very long device names', () => {
      const longName = 'A'.repeat(100);
      const obs = createObservability(longName, 'ON');

      msg.payload = {
        deviceName: longName,
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result).not.toBeNull();
      expect(result.payload.value.device).toBe(longName);
    });

    test('✅ Should handle special characters in device names', () => {
      const specialName = 'Device-1_Test@Location#1';
      const obs = createObservability(specialName, 'ON');

      msg.payload = {
        deviceName: specialName,
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result).not.toBeNull();
      expect(result.payload.value.device).toBe(specialName);
    });
  });

  describe('Category 7: Error Handling 🚨', () => {
    test('✅ Should handle malformed observability data gracefully', () => {
      msg.payload = {
        deviceName: 'Device1',
        _observability: {
          // Missing logKey
          logData: {
            device: 'Device1',
            action: 'ON'
          }
        }
      };

      const result = executePersistAdapter(msg, flow, node);

      // Should attempt to process even if malformed
      expect(result).not.toBeNull();
    });

    test('✅ Should handle missing deviceName in payload', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        // Missing deviceName
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      // Should still process observability data
      expect(result).not.toBeNull();
    });
  });

  describe('Category 8: Integration 🔗', () => {
    test('✅ Should match expected persist-in node format', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      // Persist-in expects { key: string, value: object }
      expect(typeof result.payload.key).toBe('string');
      expect(typeof result.payload.value).toBe('object');
      expect(result.payload.key).toMatch(/^automation_log_/);
    });

    test('✅ Should preserve timestamp for time-series queries', () => {
      const obs = createObservability('Device1', 'ON');

      msg.payload = {
        deviceName: 'Device1',
        _observability: obs
      };

      const result = executePersistAdapter(msg, flow, node);

      expect(result.payload.value.timestamp).toBeDefined();
      expect(result.payload.value.timestampMs).toBeDefined();
      expect(typeof result.payload.value.timestampMs).toBe('number');
    });
  });
});
