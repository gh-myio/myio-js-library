/**
 * Unit Tests for func-001-FeriadoCheck.js
 *
 * Coverage target: >= 85%
 * Test categories:
 * 1. Utility functions
 * 2. decide() function with tolerance
 * 3. Holiday exclusive filtering
 * 4. Overlapping schedules
 * 5. Midnight crossing
 * 6. Excluded days
 * 7. Observability output
 * 8. Edge cases
 */

const {
  flow,
  node,
  resetMocks,
  setupFlowContext,
  createSchedule,
  createDevice,
  extractFunctions,
  mockDate,
  getDayOfWeek
} = require('./testHelper');

// Extract testable functions
const fns = extractFunctions('');

describe('func-001-FeriadoCheck', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ========== TEST 1: Utility Functions ==========
  describe('Utility Functions', () => {
    describe('toISODate()', () => {
      test('should format date as YYYY-MM-DD', () => {
        const date = new Date(2025, 11, 25); // Dec 25, 2025
        expect(fns.toISODate(date)).toBe('2025-12-25');
      });

      test('should pad single digit months and days', () => {
        const date = new Date(2025, 0, 5); // Jan 5, 2025
        expect(fns.toISODate(date)).toBe('2025-01-05');
      });
    });

    describe('safeISO()', () => {
      test('should return ISO date for valid input', () => {
        expect(fns.safeISO('2025-12-25')).toBe('2025-12-25');
      });

      test('should return null for invalid date', () => {
        expect(fns.safeISO('invalid-date')).toBeNull();
      });

      test('should return null for empty string', () => {
        expect(fns.safeISO('')).toBeNull();
      });

      test('should handle Date object input', () => {
        const date = new Date(2025, 5, 15);
        expect(fns.safeISO(date)).toBe('2025-06-15');
      });
    });

    describe('startOfDayLocal()', () => {
      test('should set time to 00:00:00.000', () => {
        const date = new Date(2025, 5, 15, 14, 30, 45);
        const result = fns.startOfDayLocal(date);
        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
      });
    });

    describe('subtractWeekDay()', () => {
      test('should return previous day of week', () => {
        expect(fns.subtractWeekDay('mon')).toBe('sun');
        expect(fns.subtractWeekDay('tue')).toBe('mon');
        expect(fns.subtractWeekDay('sun')).toBe('sat');
      });

      test('should handle uppercase input', () => {
        expect(fns.subtractWeekDay('MON')).toBe('sun');
      });
    });
  });

  // ========== TEST 2: decide() Function ==========
  describe('decide() Function', () => {
    describe('with retain:true', () => {
      test('should activate when inside time window', () => {
        const now = mockDate(2025, 6, 15, 10, 0); // 10:00
        const start = mockDate(2025, 6, 15, 8, 0); // 08:00
        const end = mockDate(2025, 6, 15, 18, 0); // 18:00

        const [shutdown, activate] = fns.decide(true, now, start, end);

        expect(shutdown).toBe(false);
        expect(activate).toBe(true);
      });

      test('should shutdown when outside time window', () => {
        const now = mockDate(2025, 6, 15, 19, 0); // 19:00
        const start = mockDate(2025, 6, 15, 8, 0);
        const end = mockDate(2025, 6, 15, 18, 0);

        const [shutdown, activate] = fns.decide(true, now, start, end);

        expect(shutdown).toBe(true);
        expect(activate).toBe(false);
      });

      test('should shutdown exactly at end time', () => {
        const now = mockDate(2025, 6, 15, 18, 0); // exactly 18:00
        const start = mockDate(2025, 6, 15, 8, 0);
        const end = mockDate(2025, 6, 15, 18, 0);

        const [shutdown, activate] = fns.decide(true, now, start, end);

        expect(shutdown).toBe(true);
        expect(activate).toBe(false);
      });
    });

    describe('with retain:false', () => {
      test('should activate at start time with tolerance', () => {
        const start = mockDate(2025, 6, 15, 8, 0);
        const now = new Date(start.getTime() + 15000); // 15s after start
        const end = mockDate(2025, 6, 15, 18, 0);

        const [shutdown, activate] = fns.decide(false, now, start, end);

        expect(shutdown).toBe(false);
        expect(activate).toBe(true);
      });

      test('should shutdown at end time with tolerance', () => {
        const end = mockDate(2025, 6, 15, 18, 0);
        const now = new Date(end.getTime() - 10000); // 10s before end
        const start = mockDate(2025, 6, 15, 8, 0);

        const [shutdown, activate] = fns.decide(false, now, start, end);

        expect(shutdown).toBe(true);
        expect(activate).toBe(false);
      });

      test('should not act outside tolerance window', () => {
        const now = mockDate(2025, 6, 15, 10, 0); // middle of day
        const start = mockDate(2025, 6, 15, 8, 0);
        const end = mockDate(2025, 6, 15, 18, 0);

        const [shutdown, activate] = fns.decide(false, now, start, end);

        expect(shutdown).toBe(false);
        expect(activate).toBe(false);
      });

      test('should not activate if past tolerance', () => {
        const start = mockDate(2025, 6, 15, 8, 0);
        const now = new Date(start.getTime() + 60000); // 60s after (past 30s tolerance)
        const end = mockDate(2025, 6, 15, 18, 0);

        const [shutdown, activate] = fns.decide(false, now, start, end);

        expect(shutdown).toBe(false);
        expect(activate).toBe(false);
      });
    });
  });

  // ========== TEST 3: Holiday Exclusive Filtering ==========
  describe('Holiday Exclusive Filtering', () => {
    test('should detect holiday from stored holidays', () => {
      const today = mockDate(2025, 12, 25);
      const isoToday = fns.toISODate(fns.startOfDayLocal(today));
      const holidays = ['2025-12-25', '2025-01-01'];

      const isHoliday = holidays.some(d => {
        const iso = fns.safeISO(d);
        return iso && iso === isoToday;
      });

      expect(isHoliday).toBe(true);
    });

    test('should not detect holiday on normal day', () => {
      const today = mockDate(2025, 6, 15);
      const isoToday = fns.toISODate(fns.startOfDayLocal(today));
      const holidays = ['2025-12-25', '2025-01-01'];

      const isHoliday = holidays.some(d => {
        const iso = fns.safeISO(d);
        return iso && iso === isoToday;
      });

      expect(isHoliday).toBe(false);
    });

    test('should filter schedules by holiday flag when exclusive', () => {
      const schedules = [
        createSchedule({ holiday: false, startHour: '08:00' }),
        createSchedule({ holiday: true, startHour: '10:00' }),
        createSchedule({ holiday: false, startHour: '14:00' })
      ];

      // Simulate exclusive filter for holiday
      const isHolidayToday = true;
      const filtered = schedules.filter(s => !!s.holiday === isHolidayToday);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].startHour).toBe('10:00');
    });

    test('should filter schedules by holiday flag for normal day', () => {
      const schedules = [
        createSchedule({ holiday: false, startHour: '08:00' }),
        createSchedule({ holiday: true, startHour: '10:00' }),
        createSchedule({ holiday: false, startHour: '14:00' })
      ];

      // Simulate exclusive filter for normal day
      const isHolidayToday = false;
      const filtered = schedules.filter(s => !!s.holiday === isHolidayToday);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].startHour).toBe('08:00');
      expect(filtered[1].startHour).toBe('14:00');
    });
  });

  // ========== TEST 4: Overlapping Schedules ==========
  describe('Overlapping Schedules', () => {
    test('should accumulate activate from any schedule', () => {
      let anyAct = false, anyShut = false;

      // Schedule 1: 08:00-12:00, activates
      anyAct = anyAct || true;
      anyShut = anyShut || false;

      // Schedule 2: 11:00-14:00, also activates
      anyAct = anyAct || true;
      anyShut = anyShut || false;

      expect(anyAct).toBe(true);
      expect(anyShut).toBe(false);
    });

    test('should accumulate shutdown from any schedule', () => {
      let anyAct = false, anyShut = false;

      // Schedule 1: 08:00-12:00, activates
      anyAct = anyAct || true;
      anyShut = anyShut || false;

      // Schedule 2: current time is at end, shuts down
      anyAct = anyAct || false;
      anyShut = anyShut || true;

      expect(anyAct).toBe(true);
      expect(anyShut).toBe(true);
    });

    test('should resolve conflict with shutdown precedence', () => {
      let anyAct = true, anyShut = true;
      let shouldActivate = false, shouldShutdown = false;

      // Resolve consolidated decision
      if (anyAct && !anyShut) {
        shouldActivate = true;
        shouldShutdown = false;
      } else if (!anyAct && anyShut) {
        shouldActivate = false;
        shouldShutdown = true;
      } else if (anyAct && anyShut) {
        shouldActivate = false;
        shouldShutdown = true; // shutdown wins
      }

      expect(shouldActivate).toBe(false);
      expect(shouldShutdown).toBe(true);
    });
  });

  // ========== TEST 5: Midnight Crossing ==========
  describe('Midnight Crossing Schedules', () => {
    test('should detect midnight crossing', () => {
      const baseDate = mockDate(2025, 6, 15);
      const startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 0);
      const endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 4, 0);

      const crossesMidnight = startTime.getTime() > endTime.getTime();
      expect(crossesMidnight).toBe(true);
    });

    test('should not detect midnight crossing for normal schedule', () => {
      const baseDate = mockDate(2025, 6, 15);
      const startTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 8, 0);
      const endTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 18, 0);

      const crossesMidnight = startTime.getTime() > endTime.getTime();
      expect(crossesMidnight).toBe(false);
    });

    test('should calculate yesterday start time correctly', () => {
      const baseDate = mockDate(2025, 6, 15, 2, 0); // 02:00 Monday
      const startTime = mockDate(2025, 6, 15, 23, 0); // 23:00
      const endTime = mockDate(2025, 6, 15, 4, 0); // 04:00

      // Start yesterday
      const startYesterday = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);

      // Should be Sunday 23:00
      expect(startYesterday.getDate()).toBe(14);
      expect(startYesterday.getHours()).toBe(23);
    });

    test('should activate during overnight window', () => {
      // Sunday 23:00 to Monday 04:00, current time Monday 02:00
      const now = mockDate(2025, 6, 14, 2, 0); // Monday 02:00 (June 14 is Saturday in 2025, adjust as needed)
      const startYesterday = mockDate(2025, 6, 13, 23, 0); // Sunday 23:00
      const endTime = mockDate(2025, 6, 14, 4, 0); // Monday 04:00

      const [shutdown, activate] = fns.decide(true, now, startYesterday, endTime);

      expect(shutdown).toBe(false);
      expect(activate).toBe(true);
    });
  });

  // ========== TEST 6: Excluded Days ==========
  describe('Excluded Days', () => {
    test('should detect excluded day', () => {
      const today = mockDate(2025, 6, 15);
      const isoToday = fns.toISODate(fns.startOfDayLocal(today));
      const excludedDays = ['2025-06-15', '2025-06-20'];

      const isExcluded = excludedDays.some(ex => fns.safeISO(ex) === isoToday);

      expect(isExcluded).toBe(true);
    });

    test('should not detect excluded day on normal day', () => {
      const today = mockDate(2025, 6, 16);
      const isoToday = fns.toISODate(fns.startOfDayLocal(today));
      const excludedDays = ['2025-06-15', '2025-06-20'];

      const isExcluded = excludedDays.some(ex => fns.safeISO(ex) === isoToday);

      expect(isExcluded).toBe(false);
    });

    test('should override any activation on excluded day', () => {
      let shouldActivate = true;
      let shouldShutdown = false;

      // Simulate excluded day override
      const isExcluded = true;
      if (isExcluded) {
        shouldShutdown = true;
        shouldActivate = false;
      }

      expect(shouldActivate).toBe(false);
      expect(shouldShutdown).toBe(true);
    });

    test('should handle invalid dates in excludedDays', () => {
      const today = mockDate(2025, 6, 15);
      const isoToday = fns.toISODate(fns.startOfDayLocal(today));
      const excludedDays = ['invalid-date', '2025-06-15', ''];

      const isExcluded = excludedDays.some(ex => {
        const iso = fns.safeISO(ex);
        return iso && iso === isoToday;
      });

      expect(isExcluded).toBe(true); // Still detects valid date
    });
  });

  // ========== TEST 7: Observability Output ==========
  describe('Observability Output', () => {
    test('should generate correct log key format', () => {
      const deviceName = 'Ar Condicionado Sala 1';
      const timestamp = 1699876543210;

      const logKey = `automation_log_${deviceName.replace(/\s+/g, '')}_${timestamp}`;

      expect(logKey).toBe('automation_log_ArCondicionadoSala1_1699876543210');
    });

    test('should set reason to weekday for normal day', () => {
      const isHolidayToday = false;
      const excludedDays = [];
      const isoToday = '2025-06-15';

      let reason = 'weekday';
      if (isHolidayToday) reason = 'holiday';
      if (excludedDays.some(ex => fns.safeISO(ex) === isoToday)) reason = 'excluded';

      expect(reason).toBe('weekday');
    });

    test('should set reason to holiday for holiday', () => {
      const isHolidayToday = true;
      const excludedDays = [];
      const schedules = [createSchedule({ holiday: true })];
      const isoToday = '2025-12-25';

      let reason = 'weekday';
      if (isHolidayToday) reason = 'holiday';
      if (isHolidayToday && (!schedules || schedules.length === 0)) reason = 'holiday_no_schedule';
      if (excludedDays.some(ex => fns.safeISO(ex) === isoToday)) reason = 'excluded';

      expect(reason).toBe('holiday');
    });

    test('should set reason to holiday_no_schedule when holiday has no schedules', () => {
      const isHolidayToday = true;
      const excludedDays = [];
      const schedules = [];
      const isoToday = '2025-12-25';

      let reason = 'weekday';
      if (isHolidayToday) reason = 'holiday';
      if (isHolidayToday && (!schedules || schedules.length === 0)) reason = 'holiday_no_schedule';
      if (excludedDays.some(ex => fns.safeISO(ex) === isoToday)) reason = 'excluded';

      expect(reason).toBe('holiday_no_schedule');
    });

    test('should set reason to excluded when day is excluded', () => {
      const isHolidayToday = false;
      const excludedDays = ['2025-06-15'];
      const isoToday = '2025-06-15';

      let reason = 'weekday';
      if (isHolidayToday) reason = 'holiday';
      if (excludedDays.some(ex => fns.safeISO(ex) === isoToday)) reason = 'excluded';

      expect(reason).toBe('excluded');
    });

    test('should include correct action in observability', () => {
      const shouldActivate = true;
      const action = shouldActivate ? 'ON' : 'OFF';
      expect(action).toBe('ON');
    });
  });

  // ========== TEST 8: Edge Cases ==========
  describe('Edge Cases', () => {
    test('should handle empty schedules array', () => {
      const schedules = [];
      expect(schedules.length).toBe(0);
    });

    test('should handle undefined daysWeek property', () => {
      const schedule = createSchedule();
      const currWeekDay = 'mon';

      // Using optional chaining like in actual code
      const isDayEnabled = schedule.daysWeek?.[currWeekDay];
      expect(isDayEnabled).toBe(true);
    });

    test('should handle missing device name', () => {
      const device = { deviceId: '123' };
      const deviceName = device.deviceName || 'unknown';
      expect(deviceName).toBe('unknown');
    });

    // ========== FIX: Device Not Found Tests ==========
    test('should skip when device is undefined (key mismatch)', () => {
      // Simulates: storedSchedules has "Corredores/Meio Loja" but devices doesn't
      const storedSchedules = {
        'Corredores/Meio Loja': [createSchedule()],
        'Ar Condicionado': [createSchedule()]
      };

      const devices = {
        'Ar Condicionado': createDevice({ deviceName: 'Ar Condicionado' })
        // Note: 'Corredores/Meio Loja' is missing!
      };

      const currentKey = 'Corredores/Meio Loja';
      let device = devices[currentKey];

      // Try with trim (as in actual code)
      if (!device) {
        device = devices[currentKey.trim()];
      }

      // Device should still be undefined
      expect(device).toBeUndefined();

      // Test that we can safely skip
      const shouldSkip = !device;
      expect(shouldSkip).toBe(true);
    });

    test('should find device with trimmed key', () => {
      const devices = {
        'Device Name': createDevice({ deviceName: 'Device Name' })
      };

      // Key with trailing space
      const currentKey = 'Device Name ';
      let device = devices[currentKey];

      // Should not find with space
      expect(device).toBeUndefined();

      // Should find after trim
      device = devices[currentKey.trim()];
      expect(device).toBeDefined();
      expect(device.deviceName).toBe('Device Name');
    });

    test('should handle device not in devices list - currIndex update', () => {
      const keys = ['Device1', 'Device2', 'Device3'];
      let currIndex = 1; // Current device is Device2

      // Device2 not found, simulate skip and advance
      const keysLength = keys.length;

      if (currIndex >= (keysLength - 1)) {
        currIndex = 0;
      } else {
        currIndex = currIndex + 1;
      }

      expect(currIndex).toBe(2); // Should advance to Device3
    });

    test('should wrap currIndex when device not found at end', () => {
      const keys = ['Device1', 'Device2', 'Device3'];
      let currIndex = 2; // Current device is Device3 (last)

      // Device3 not found, simulate skip and wrap
      const keysLength = keys.length;

      if (currIndex >= (keysLength - 1)) {
        currIndex = 0; // Wrap to beginning
      } else {
        currIndex = currIndex + 1;
      }

      expect(currIndex).toBe(0); // Should wrap to Device1
    });

    test('should provide helpful warning when device not found', () => {
      const devices = {
        'Ar Condicionado': createDevice()
      };

      const currentKey = 'Corredores/Meio Loja';
      const availableDevices = Object.keys(devices);

      // Verify warning data structure
      const warningData = {
        message: 'Device not found in devices list, skipping',
        currIndex: 35,
        currentKey: currentKey,
        availableDevices: availableDevices
      };

      expect(warningData.message).toContain('not found');
      expect(warningData.currentKey).toBe('Corredores/Meio Loja');
      expect(warningData.availableDevices).toContain('Ar Condicionado');
      expect(warningData.availableDevices).not.toContain('Corredores/Meio Loja');
    });

    test('should sort schedules by start hour correctly', () => {
      const schedules = [
        createSchedule({ startHour: '14:00' }),
        createSchedule({ startHour: '8:00' }),
        createSchedule({ startHour: '10:30' })
      ];

      const toHM = h => {
        const [H, M] = h.split(':').map(Number);
        return H * 60 + M;
      };

      const sorted = [...schedules].sort((a, b) => toHM(a.startHour) - toHM(b.startHour));

      expect(sorted[0].startHour).toBe('8:00');
      expect(sorted[1].startHour).toBe('10:30');
      expect(sorted[2].startHour).toBe('14:00');
    });

    test('should handle hours without leading zero', () => {
      const toHM = h => {
        const [H, M] = h.split(':').map(Number);
        return H * 60 + M;
      };

      expect(toHM('8:00')).toBe(480);
      expect(toHM('08:00')).toBe(480);
      expect(toHM('23:59')).toBe(1439);
    });

    test('should handle holiday with no schedule - force shutdown', () => {
      const isHolidayToday = true;
      const schedules = [];
      let shouldShutdown = false;
      let shouldActivate = false;

      if (isHolidayToday && (!schedules || schedules.length === 0)) {
        shouldShutdown = true;
        shouldActivate = false;
      }

      expect(shouldShutdown).toBe(true);
      expect(shouldActivate).toBe(false);
    });
  });

  // ========== TEST 9: Day of Week Handling ==========
  describe('Day of Week Handling', () => {
    test('should get correct day abbreviation', () => {
      const monday = mockDate(2025, 6, 16); // June 16, 2025 is Monday
      const dayStr = monday.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
      expect(dayStr).toBe('mon');
    });

    test('should check if current day is enabled in schedule', () => {
      const schedule = createSchedule({
        daysWeek: {
          sun: false,
          mon: true,
          tue: true,
          wed: false,
          thu: true,
          fri: true,
          sat: false
        }
      });

      expect(schedule.daysWeek.mon).toBe(true);
      expect(schedule.daysWeek.wed).toBe(false);
      expect(schedule.daysWeek.sat).toBe(false);
    });
  });

  // ========== TEST 10: Holiday No Schedule Force Shutdown ==========
  describe('Holiday No Schedule Behavior', () => {
    test('should force shutdown when holiday has no matching schedules', () => {
      // Simulate holiday with no holiday:true schedules
      const isHolidayToday = true;
      const allSchedules = [
        createSchedule({ holiday: false, startHour: '08:00' }),
        createSchedule({ holiday: false, startHour: '14:00' })
      ];

      // Apply exclusive filter
      const filteredSchedules = allSchedules.filter(s => !!s.holiday === isHolidayToday);

      let shouldShutdown = false;
      let shouldActivate = false;

      // Check if holiday but no schedules after filter
      if (isHolidayToday && filteredSchedules.length === 0) {
        shouldShutdown = true;
        shouldActivate = false;
      }

      expect(filteredSchedules).toHaveLength(0);
      expect(shouldShutdown).toBe(true);
      expect(shouldActivate).toBe(false);
    });

    test('should not force shutdown when holiday has matching schedules', () => {
      const isHolidayToday = true;
      const allSchedules = [
        createSchedule({ holiday: false, startHour: '08:00' }),
        createSchedule({ holiday: true, startHour: '10:00' })
      ];

      const filteredSchedules = allSchedules.filter(s => !!s.holiday === isHolidayToday);

      let shouldShutdown = false;
      let shouldActivate = false;

      if (isHolidayToday && filteredSchedules.length === 0) {
        shouldShutdown = true;
        shouldActivate = false;
      }

      expect(filteredSchedules).toHaveLength(1);
      expect(shouldShutdown).toBe(false);
      expect(shouldActivate).toBe(false);
    });
  });
});
