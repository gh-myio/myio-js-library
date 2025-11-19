/**
 * Test Helper for Node-RED Function Tests
 *
 * Provides mocks for Node-RED globals (flow, node, msg, this)
 * and utilities for testing func-001-FeriadoCheck.js
 */

// Mock storage for flow context
let flowContext = {};
let nodeContext = {};

// Mock flow object
const flow = {
  get: jest.fn((key) => flowContext[key]),
  set: jest.fn((key, value) => { flowContext[key] = value; })
};

// Mock node object
const node = {
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn()
};

// Reset all mocks and contexts
function resetMocks() {
  flowContext = {};
  nodeContext = {};
  flow.get.mockClear();
  flow.set.mockClear();
  node.warn.mockClear();
  node.log.mockClear();
  node.error.mockClear();
}

// Setup flow context with test data
function setupFlowContext(data) {
  flowContext = { ...data };
}

// Create a schedule object
function createSchedule(options = {}) {
  return {
    startHour: options.startHour || '08:00',
    endHour: options.endHour || '18:00',
    retain: options.retain !== undefined ? options.retain : true,
    holiday: options.holiday || false,
    daysWeek: options.daysWeek || {
      sun: false,
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: false
    }
  };
}

// Create a device object
function createDevice(options = {}) {
  return {
    deviceName: options.deviceName || 'Test Device',
    deviceId: options.deviceId || 'device-123'
  };
}

// Execute the function with mocked context
function executeFunction(code, thisContext = {}) {
  // Create function from code string with globals injected
  const wrappedCode = `
    return (function(flow, node, msg) {
      ${code}
    })(flow, node, msg);
  `;

  const fn = new Function('flow', 'node', 'msg', wrappedCode);

  // Bind this context (for currIndex)
  const boundThis = { currIndex: 0, ...thisContext };

  try {
    return fn.call(boundThis, flow, node, {});
  } catch (error) {
    return { error: error.message };
  }
}

// Parse the function file and extract testable functions
function extractFunctions(code) {
  const functions = {};

  // Extract atTimeLocal
  const atTimeLocalMatch = code.match(/function atTimeLocal\([^)]*\)\s*{[\s\S]*?^}/m);
  if (atTimeLocalMatch) {
    functions.atTimeLocal = new Function('base', 'hhmm', `
      const [h, m] = hhmm.split(':').map(Number);
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
    `);
  }

  // Extract startOfDayLocal
  functions.startOfDayLocal = function(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  // Extract toISODate
  functions.toISODate = function(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Extract safeISO
  functions.safeISO = function(d) {
    const x = new Date(d);
    if (isNaN(x.getTime())) return null;
    x.setHours(0, 0, 0, 0);
    return functions.toISODate(x);
  };

  // Extract subtractWeekDay
  functions.subtractWeekDay = function(day) {
    const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDayIndex = daysOfWeek.indexOf(day.toLowerCase());
    const previousDayIndex = (currentDayIndex - 1 + daysOfWeek.length) % daysOfWeek.length;
    return daysOfWeek[previousDayIndex];
  };

  // Extract decide
  functions.decide = function(retain, now, start, end, toleranceMs = 30000) {
    const n = now.getTime(), a = start.getTime(), b = end.getTime();
    if (!retain) {
      if (Math.abs(n - a) <= toleranceMs) return [false, true];
      if (Math.abs(n - b) <= toleranceMs) return [true, false];
      return [false, false];
    } else {
      if (n >= a && n < b) return [false, true];
      return [true, false];
    }
  };

  return functions;
}

// Create a mock Date for testing specific times
function mockDate(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

// Get day of week string (sun, mon, etc.)
function getDayOfWeek(date) {
  return date.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
}

module.exports = {
  flow,
  node,
  resetMocks,
  setupFlowContext,
  createSchedule,
  createDevice,
  executeFunction,
  extractFunctions,
  mockDate,
  getDayOfWeek
};
