// ============================================================================
// MYIO Scheduling Engine - Refactored Version (MODULE)
// Versão modular para testes unitários
// ============================================================================

// ============================================================================
// 1. LOG HELPER - Sistema de logging estruturado
// ============================================================================

function createLogHelper(node) {
  return {
    logs: [],

    info(message, data = {}) {
      const entry = { level: 'INFO', timestamp: new Date().toISOString(), message, data };
      this.logs.push(entry);
      if (node) node.log(`[INFO] ${message}: ${JSON.stringify(data)}`);
    },

    warn(message, data = {}) {
      const entry = { level: 'WARN', timestamp: new Date().toISOString(), message, data };
      this.logs.push(entry);
      if (node) node.warn(`[WARN] ${message}: ${JSON.stringify(data)}`);
    },

    error(message, error = null) {
      const entry = { level: 'ERROR', timestamp: new Date().toISOString(), message, error: error?.message };
      this.logs.push(entry);
      if (node) node.error(`[ERROR] ${message}: ${error?.message || 'Unknown error'}`);
    },

    getLogs() {
      return [...this.logs];
    },

    clear() {
      this.logs = [];
    }
  };
}

// ============================================================================
// 2. DATE UTILITIES - Funções puras de manipulação de data (max 5 linhas)
// ============================================================================

function safeGetCurrentTime(LogHelper) {
  try {
    return new Date();
  } catch (error) {
    LogHelper.error('Failed to get current time', error);
    return new Date(0); // Fallback: epoch
  }
}

function safeConvertToSaoPaulo(date, LogHelper) {
  try {
    const offset = -3 * 60; // UTC-3
    date.setMinutes(date.getMinutes() + offset);
    return date;
  } catch (error) {
    LogHelper.error('Failed to convert to Sao Paulo time', error);
    return date; // Fallback: return original
  }
}

function safeParseTime(timeString, LogHelper) {
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes, valid: !isNaN(hours) && !isNaN(minutes) };
  } catch (error) {
    LogHelper.error('Failed to parse time', error);
    return { hours: 0, minutes: 0, valid: false }; // Fallback
  }
}

function safeCreateDateWithTime(baseDate, timeString, LogHelper) {
  try {
    const { hours, minutes, valid } = safeParseTime(timeString, LogHelper);
    if (!valid) return null;
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  } catch (error) {
    LogHelper.error('Failed to create date with time', error);
    return null; // Fallback
  }
}

function safeFormatTime(date, LogHelper) {
  try {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  } catch (error) {
    LogHelper.error('Failed to format time', error);
    return '00:00'; // Fallback
  }
}

function safeGetWeekday(date, LogHelper) {
  try {
    return date.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
  } catch (error) {
    LogHelper.error('Failed to get weekday', error);
    return 'mon'; // Fallback: Monday
  }
}

function safePreviousWeekday(day, LogHelper) {
  try {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const index = days.indexOf(day.toLowerCase());
    return days[(index - 1 + days.length) % days.length];
  } catch (error) {
    LogHelper.error('Failed to get previous weekday', error);
    return 'sun'; // Fallback
  }
}

function safeNormalizeDate(dateString, LogHelper) {
  try {
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date;
  } catch (error) {
    LogHelper.error('Failed to normalize date', error);
    return new Date(0); // Fallback: epoch
  }
}

// ============================================================================
// 3. DATA LOADING - Carregamento seguro de dados do flow (max 5 linhas)
// ============================================================================

function safeLoadDevices(flow, LogHelper) {
  try {
    const devices = flow.get('devices') || {};
    LogHelper.info('Devices loaded', { count: Object.keys(devices).length });
    return devices;
  } catch (error) {
    LogHelper.error('Failed to load devices', error);
    return {}; // Fallback: empty object
  }
}

function safeLoadSchedules(flow, LogHelper) {
  try {
    const schedules = flow.get('stored_schedules') || {};
    LogHelper.info('Schedules loaded', { count: Object.keys(schedules).length });
    return schedules;
  } catch (error) {
    LogHelper.error('Failed to load schedules', error);
    return {}; // Fallback: empty object
  }
}

function safeLoadExcludedDays(flow, LogHelper) {
  try {
    const excluded = flow.get('stored_excludedDays') || {};
    LogHelper.info('Excluded days loaded', { count: Object.keys(excluded).length });
    return excluded;
  } catch (error) {
    LogHelper.error('Failed to load excluded days', error);
    return {}; // Fallback: empty object
  }
}

function safeLoadHolidays(flow, LogHelper) {
  try {
    const holidays = flow.get('stored_holidays') || [];
    LogHelper.info('Holidays loaded', { count: holidays.length });
    return holidays;
  } catch (error) {
    LogHelper.error('Failed to load holidays', error);
    return []; // Fallback: empty array
  }
}

// ============================================================================
// 4. VALIDATION - Funções de validação com fallbacks (max 5 linhas)
// ============================================================================

function validateSchedule(schedule, LogHelper) {
  try {
    const valid = schedule && schedule.startHour && schedule.endHour && schedule.daysWeek;
    if (!valid) LogHelper.warn('Invalid schedule detected', { schedule });
    return valid;
  } catch (error) {
    LogHelper.error('Failed to validate schedule', error);
    return false; // Fallback: invalid
  }
}

function validateDevice(device, LogHelper) {
  try {
    const valid = device && device.deviceName;
    if (!valid) LogHelper.warn('Invalid device detected', { device });
    return valid;
  } catch (error) {
    LogHelper.error('Failed to validate device', error);
    return false; // Fallback: invalid
  }
}

function safeGetDevice(devices, key, LogHelper) {
  try {
    const device = devices[key] || devices[key.trim()];
    if (!device) LogHelper.warn('Device not found', { key });
    return device;
  } catch (error) {
    LogHelper.error('Failed to get device', error);
    return null; // Fallback
  }
}

// ============================================================================
// 5. HOLIDAY CHECKING - Verificação de feriados (max 5 linhas)
// ============================================================================

function isHolidayToday(holidays, currentDate, LogHelper) {
  try {
    // Comparar apenas por YYYY-MM-DD para evitar problemas de timezone
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const found = holidays.some(h => {
      const holidayDateStr = new Date(h).toISOString().split('T')[0];
      return holidayDateStr === currentDateStr;
    });
    LogHelper.info('Holiday check', { isHoliday: found, currentDateStr, holidays });
    return found;
  } catch (error) {
    LogHelper.error('Failed to check holiday', error);
    return false; // Fallback: not a holiday
  }
}

function shouldProcessSchedule(schedule, isHoliday, LogHelper) {
  try {
    const holidaySchedule = !!schedule.holiday;
    const shouldProcess = holidaySchedule === isHoliday;
    LogHelper.info('Schedule filter', { holidaySchedule, isHoliday, shouldProcess });
    return shouldProcess;
  } catch (error) {
    LogHelper.error('Failed to filter schedule', error);
    return false; // Fallback: skip schedule
  }
}

// ============================================================================
// 6. EXCLUDED DAYS - Verificação de dias excluídos (max 5 linhas)
// ============================================================================

function getExcludedDaysForDevice(excludedDaysMap, deviceKey, LogHelper) {
  try {
    const excluded = excludedDaysMap[deviceKey] || [];
    const days = excluded.map(item => item.excludedDays).flat();
    LogHelper.info('Excluded days retrieved', { deviceKey, count: days.length });
    return days;
  } catch (error) {
    LogHelper.error('Failed to get excluded days', error);
    return []; // Fallback: no excluded days
  }
}

function isExcludedDay(excludedDays, currentDate, LogHelper) {
  try {
    // Comparar apenas por YYYY-MM-DD para evitar problemas de timezone
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const found = excludedDays.some(d => {
      const excludedDateStr = new Date(d).toISOString().split('T')[0];
      return excludedDateStr === currentDateStr;
    });
    LogHelper.info('Excluded day check', { isExcluded: found, currentDateStr, excludedDays });
    return found;
  } catch (error) {
    LogHelper.error('Failed to check excluded day', error);
    return false; // Fallback: not excluded
  }
}

// ============================================================================
// 7. DECISION ENGINE - Lógica de decisão desacoplada (max 5 linhas)
// ============================================================================

function decideWithoutRetain(currentTime, startTime, endTime, LogHelper) {
  try {
    const currTimeStr = safeFormatTime(currentTime, LogHelper);
    const startTimeStr = safeFormatTime(startTime, LogHelper);
    const endTimeStr = safeFormatTime(endTime, LogHelper);

    if (currTimeStr === startTimeStr) return { shutdown: false, activate: true };
    if (currTimeStr === endTimeStr) return { shutdown: true, activate: false };
    return { shutdown: false, activate: false };
  } catch (error) {
    LogHelper.error('Failed to decide without retain', error);
    return { shutdown: false, activate: false }; // Fallback: do nothing
  }
}

function decideWithRetain(currentTime, startTime, endTime, LogHelper) {
  try {
    const inRange = currentTime.getTime() > startTime.getTime() &&
                    currentTime.getTime() < endTime.getTime();
    return inRange ? { shutdown: false, activate: true } : { shutdown: true, activate: false };
  } catch (error) {
    LogHelper.error('Failed to decide with retain', error);
    return { shutdown: false, activate: false }; // Fallback: do nothing
  }
}

function makeDecision(retain, currentTime, startTime, endTime, LogHelper) {
  try {
    const decision = retain
      ? decideWithRetain(currentTime, startTime, endTime, LogHelper)
      : decideWithoutRetain(currentTime, startTime, endTime, LogHelper);
    LogHelper.info('Decision made', { retain, decision });
    return decision;
  } catch (error) {
    LogHelper.error('Failed to make decision', error);
    return { shutdown: false, activate: false }; // Fallback: do nothing
  }
}

// ============================================================================
// 8. SCHEDULE PROCESSING - Processamento de horários (max 5 linhas cada)
// ============================================================================

function processSameDaySchedule(schedule, currentTime, currentWeekday, LogHelper) {
  try {
    if (!schedule.daysWeek[currentWeekday]) return null;
    const start = safeCreateDateWithTime(currentTime, schedule.startHour, LogHelper);
    const end = safeCreateDateWithTime(currentTime, schedule.endHour, LogHelper);
    return makeDecision(schedule.retain, currentTime, start, end, LogHelper);
  } catch (error) {
    LogHelper.error('Failed to process same-day schedule', error);
    return null; // Fallback: skip
  }
}

function processOvernightYesterday(schedule, currentTime, currentWeekday, LogHelper) {
  try {
    const yesterday = safePreviousWeekday(currentWeekday, LogHelper);
    if (!schedule.daysWeek[yesterday]) return null;

    const start = safeCreateDateWithTime(currentTime, schedule.startHour, LogHelper);
    start.setDate(start.getDate() - 1);
    const end = safeCreateDateWithTime(currentTime, schedule.endHour, LogHelper);

    return makeDecision(schedule.retain, currentTime, start, end, LogHelper);
  } catch (error) {
    LogHelper.error('Failed to process overnight yesterday', error);
    return null; // Fallback: skip
  }
}

function processOvernightToday(schedule, currentTime, currentWeekday, LogHelper) {
  try {
    if (!schedule.daysWeek[currentWeekday]) return null;

    const start = safeCreateDateWithTime(currentTime, schedule.startHour, LogHelper);
    const end = safeCreateDateWithTime(currentTime, schedule.endHour, LogHelper);
    end.setDate(end.getDate() + 1);

    return makeDecision(schedule.retain, currentTime, start, end, LogHelper);
  } catch (error) {
    LogHelper.error('Failed to process overnight today', error);
    return null; // Fallback: skip
  }
}

function isOvernightSchedule(schedule, currentTime, LogHelper) {
  try {
    const start = safeCreateDateWithTime(currentTime, schedule.startHour, LogHelper);
    const end = safeCreateDateWithTime(currentTime, schedule.endHour, LogHelper);
    return start > end;
  } catch (error) {
    LogHelper.error('Failed to check overnight schedule', error);
    return false; // Fallback: assume same-day
  }
}

function processSchedule(schedule, currentTime, currentWeekday, LogHelper) {
  try {
    if (!validateSchedule(schedule, LogHelper)) return null;

    if (isOvernightSchedule(schedule, currentTime, LogHelper)) {
      const yesterdayResult = processOvernightYesterday(schedule, currentTime, currentWeekday, LogHelper);
      if (yesterdayResult?.activate) return yesterdayResult;

      return processOvernightToday(schedule, currentTime, currentWeekday, LogHelper);
    }

    return processSameDaySchedule(schedule, currentTime, currentWeekday, LogHelper);
  } catch (error) {
    LogHelper.error('Failed to process schedule', error);
    return null; // Fallback: skip schedule
  }
}

// ============================================================================
// 9. MAIN EXECUTION ENGINE - Motor principal (max 5 linhas cada)
// ============================================================================

function sortSchedulesByTime(schedules, LogHelper) {
  try {
    return [...schedules].sort((a, b) => a.startHour.replace(':', '') - b.startHour.replace(':', ''));
  } catch (error) {
    LogHelper.error('Failed to sort schedules', error);
    return schedules; // Fallback: unsorted
  }
}

function processAllSchedules(schedules, currentTime, currentWeekday, isHoliday, LogHelper) {
  try {
    let finalDecision = { shutdown: false, activate: false };

    for (const schedule of schedules) {
      if (!shouldProcessSchedule(schedule, isHoliday, LogHelper)) continue;
      const decision = processSchedule(schedule, currentTime, currentWeekday, LogHelper);
      if (decision) finalDecision = decision;
    }

    return finalDecision;
  } catch (error) {
    LogHelper.error('Failed to process all schedules', error);
    return { shutdown: false, activate: false }; // Fallback: do nothing
  }
}

function applyExcludedDayOverride(decision, isExcluded, LogHelper) {
  try {
    if (!isExcluded) return decision;
    LogHelper.info('Applying excluded day override');
    return { shutdown: true, activate: false };
  } catch (error) {
    LogHelper.error('Failed to apply excluded day override', error);
    return decision; // Fallback: keep original decision
  }
}

// ============================================================================
// 10. RECEIPT GENERATION - Geração de comprovante (max 5 linhas cada)
// ============================================================================

function generateExecutionSummary(data, LogHelper) {
  try {
    return {
      timestamp: new Date().toISOString(),
      device: data.deviceName || 'UNKNOWN',
      currentTime: safeFormatTime(data.currentTime, LogHelper),
      weekday: data.currentWeekday,
      isHoliday: data.isHoliday,
      isExcluded: data.isExcluded
    };
  } catch (error) {
    LogHelper.error('Failed to generate execution summary', error);
    return { timestamp: new Date().toISOString(), error: 'Failed to generate summary' };
  }
}

function generateDecisionSummary(decision, LogHelper) {
  try {
    return {
      shouldActivate: decision.activate,
      shouldShutdown: decision.shutdown,
      action: decision.activate ? 'TURN_ON' : (decision.shutdown ? 'TURN_OFF' : 'NO_ACTION')
    };
  } catch (error) {
    LogHelper.error('Failed to generate decision summary', error);
    return { shouldActivate: false, shouldShutdown: false, action: 'ERROR' };
  }
}

function generateSchedulingSummary(schedules, processedCount, LogHelper) {
  try {
    return {
      totalSchedules: schedules?.length || 0,
      processedSchedules: processedCount || 0,
      skippedSchedules: (schedules?.length || 0) - (processedCount || 0)
    };
  } catch (error) {
    LogHelper.error('Failed to generate scheduling summary', error);
    return { totalSchedules: 0, processedSchedules: 0, skippedSchedules: 0 };
  }
}

function generateReceipt(data, decision, LogHelper) {
  try {
    return {
      receipt: {
        execution: generateExecutionSummary(data, LogHelper),
        decision: generateDecisionSummary(decision, LogHelper),
        scheduling: generateSchedulingSummary(data.schedules, data.processedCount, LogHelper),
        logs: LogHelper.getLogs()
      }
    };
  } catch (error) {
    LogHelper.error('Failed to generate receipt', error);
    return { receipt: { error: 'Failed to generate receipt', logs: LogHelper.getLogs() } };
  }
}

// ============================================================================
// 11. INDEX MANAGEMENT - Gerenciamento de índice do cursor (max 5 linhas)
// ============================================================================

function getNextIndex(currentIndex, totalKeys, LogHelper) {
  try {
    return currentIndex >= (totalKeys - 1) ? 0 : currentIndex + 1;
  } catch (error) {
    LogHelper.error('Failed to get next index', error);
    return 0; // Fallback: reset to 0
  }
}

function getCurrentIndex(context, LogHelper) {
  try {
    return context.currIndex || 0;
  } catch (error) {
    LogHelper.error('Failed to get current index', error);
    return 0; // Fallback: start from 0
  }
}

function updateIndex(context, newIndex, LogHelper) {
  try {
    context.currIndex = newIndex;
    LogHelper.info('Index updated', { newIndex });
  } catch (error) {
    LogHelper.error('Failed to update index', error);
  }
}

// ============================================================================
// 12. MAIN ORCHESTRATOR - Orquestrador principal
// ============================================================================

function executeSchedulingEngine(context, node, flow, getCurrentTimeFn = null) {
  const LogHelper = createLogHelper(node);
  LogHelper.clear();
  LogHelper.info('=== SCHEDULING ENGINE STARTED ===');

  try {
    // 1. Load data
    const devices = safeLoadDevices(flow, LogHelper);
    const storedSchedules = safeLoadSchedules(flow, LogHelper);
    const storedExcludedDays = safeLoadExcludedDays(flow, LogHelper);
    const storedHolidays = safeLoadHolidays(flow, LogHelper);

    // 2. Get keys
    const keys = Object.keys(storedSchedules);
    if (keys.length === 0) {
      LogHelper.warn('No schedules available');
      return null;
    }

    // 3. Get current device
    const currIndex = getCurrentIndex(context, LogHelper);
    const currentKey = keys[currIndex];
    const device = safeGetDevice(devices, currentKey, LogHelper);

    if (!validateDevice(device, LogHelper)) {
      LogHelper.error('Invalid device, skipping');
      updateIndex(context, getNextIndex(currIndex, keys.length, LogHelper), LogHelper);
      return null;
    }

    // 4. Get schedules and excluded days
    const schedules = sortSchedulesByTime(storedSchedules[currentKey] || [], LogHelper);
    const excludedDays = getExcludedDaysForDevice(storedExcludedDays, currentKey, LogHelper);

    // 5. Get current time info (com injeção de dependência para testes)
    const getTimeFn = getCurrentTimeFn || (() => safeGetCurrentTime(LogHelper));
    const rawTime = getTimeFn();
    const currentTime = getCurrentTimeFn ? rawTime : safeConvertToSaoPaulo(rawTime, LogHelper);
    const currentWeekday = safeGetWeekday(currentTime, LogHelper);
    const isHoliday = isHolidayToday(storedHolidays, currentTime, LogHelper);
    const isExcluded = isExcludedDay(excludedDays, currentTime, LogHelper);

    LogHelper.info('Processing device', {
      device: device.deviceName,
      time: safeFormatTime(currentTime, LogHelper),
      weekday: currentWeekday,
      isHoliday,
      isExcluded
    });

    // 6. Process schedules
    let decision = processAllSchedules(schedules, currentTime, currentWeekday, isHoliday, LogHelper);

    // 7. Apply excluded day override
    decision = applyExcludedDayOverride(decision, isExcluded, LogHelper);

    // 8. Update index
    updateIndex(context, getNextIndex(currIndex, keys.length, LogHelper), LogHelper);

    // 9. Generate receipt
    const receipt = generateReceipt({
      deviceName: device.deviceName,
      currentTime,
      currentWeekday,
      isHoliday,
      isExcluded,
      schedules,
      processedCount: schedules.length
    }, decision, LogHelper);

    LogHelper.info('=== SCHEDULING ENGINE COMPLETED ===', decision);

    // 10. Return result
    return {
      deviceName: device.deviceName,
      payload: {
        currentIndex: currIndex,
        length: keys.length,
        shouldActivate: decision.activate,
        shouldShutdown: decision.shutdown,
        device,
        deviceName: device.deviceName,
        excludedDays,
        currentTime,
        isHoliday,
        isExcluded,
        schedules,
        ...receipt
      }
    };

  } catch (error) {
    LogHelper.error('FATAL: Scheduling engine failed', error);
    return {
      deviceName: 'ERROR',
      payload: {
        error: true,
        message: error?.message || 'Unknown error',
        receipt: { logs: LogHelper.getLogs() }
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  executeSchedulingEngine,
  createLogHelper,
  safeGetCurrentTime,
  safeConvertToSaoPaulo,
  isHolidayToday,
  shouldProcessSchedule,
  processSchedule,
  isOvernightSchedule
};
