// ========== CORREÇÃO #1: Date handling sem string parsing ==========
function atTimeLocal(base, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

function startOfDayLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractWeekDay(day) {
  // Define the days of the week in an array with 3-letter abbreviations
  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  const currentDayIndex = daysOfWeek.indexOf(day.toLowerCase());

  const previousDayIndex = (currentDayIndex - 1 + daysOfWeek.length) % daysOfWeek.length;

  return daysOfWeek[previousDayIndex];
}


let currIndex = this.currIndex || 0;

const devices = flow.get('devices') || {};
const storedSchedules = flow.get('stored_schedules') || {};
const storedExcludedDays = flow.get('stored_excludedDays') || {}; // pegar do flow dias para excluir
const storedHolidaysDays = flow.get('stored_holidays') || []; // pegar do flow feriados

const keys = Object.keys(storedSchedules);

if (keys.length === 0) {
    node.warn('No schedules, ignoring');
  // No stored schedules, ignoring...
    return null;
}

const currentKey = keys[currIndex];
let schedules = storedSchedules[currentKey];
let device = devices[currentKey];
if (!device) {
    device = devices[currentKey.trim()];
}

let excludedDays = [];
if (currentKey in storedExcludedDays) {
  excludedDays = storedExcludedDays[currentKey].map((item) => item.excludedDays) // Dias pra excluir
}

// ========== CORREÇÃO #3: decide() com comparação em ms e tolerância ==========
function decide(retain, now, start, end, toleranceMs = 30000) {
  const n = now.getTime(), a = start.getTime(), b = end.getTime();
  if (!retain) {
    if (Math.abs(n - a) <= toleranceMs) return [false, true];   // ligar
    if (Math.abs(n - b) <= toleranceMs) return [true,  false];  // desligar
    return [false, false];
  } else {
    if (n >= a && n < b) return [false, true];
    return [true, false];
  }
}

const nowLocal = new Date();
const today0h = startOfDayLocal(nowLocal);
const isoToday = toISODate(today0h);

let shouldActivate = false;
let shouldShutdown = false;

// msg.payload = schedules;

// return msg;

// ========== CORREÇÃO #2: Holiday exclusive filtering ==========
// Detecta se hoje é feriado
const isHolidayToday = (storedHolidaysDays || []).some(d => {
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return toISODate(dd) === isoToday;
});

if (schedules) {
  schedules = [...schedules].sort((a, b) => {
    const timeA = a.startHour.replace(':', '');
    const timeB = b.startHour.replace(':', '');
    return timeA - timeB;
  });
}

// Filtra schedules com base na política de feriado (ANTES do loop!)
const holidayPolicy = flow.get('holiday_policy') || 'exclusive';
if (holidayPolicy === 'exclusive') {
  schedules = (schedules || []).filter(s => !!s.holiday === isHolidayToday);
}

// ========== CORREÇÃO #6: Rastreia a agenda realmente aplicada ==========
let appliedSchedule = null;

const currWeekDay = nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();

for (const schedule of schedules) {
  // ========== CORREÇÃO #4: Constrói horários em local time ==========
  const startTime = atTimeLocal(nowLocal, schedule.startHour);
  const endTime = atTimeLocal(nowLocal, schedule.endHour);
  const days = schedule.daysWeek;
  const retain = schedule.retain;

  // ========== CORREÇÃO #4: Midnight crossing com local time ==========
  const crossesMidnight = startTime.getTime() > endTime.getTime();

  if (crossesMidnight) {
    const yesterday = subtractWeekDay(currWeekDay);
    let acted = false;

    if (days?.[yesterday]) {
      const startYesterday = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
      const [shut, act] = decide(retain, nowLocal, startYesterday, endTime);
      shouldShutdown = shut;
      shouldActivate = act;
      acted = (act || shut);

      if (shouldShutdown && nowLocal.getTime() > endTime.getTime() && !days?.[currWeekDay]) {
        shouldShutdown = false;
      }

      if (acted) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }

    if (!acted && days?.[currWeekDay]) {
      const endTomorrow = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
      const [shut, act] = decide(retain, nowLocal, startTime, endTomorrow);
      shouldShutdown = shut;
      shouldActivate = act;

      if (act || shut) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }
  } else {
    if (days?.[currWeekDay]) {
      const [shut, act] = decide(retain, nowLocal, startTime, endTime);
      shouldShutdown = shut;
      shouldActivate = act;

      if (act || shut) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }
  }

}

// ========== CORREÇÃO #5: excludedDays sempre sobrepõe (em YYYY-MM-DD) ==========
if (Array.isArray(excludedDays) && excludedDays.length) {
  for (const ex of excludedDays) {
    const d = new Date(ex);
    d.setHours(0, 0, 0, 0);
    if (toISODate(d) === isoToday) {
      shouldShutdown = true;
      shouldActivate = false;
      break;
    }
  }
}

if (currIndex >= (keys.length -1)) {
  currIndex = 0;
} else {
  currIndex += 1;
}

this.currIndex = currIndex;

if (!device || !device.deviceName) {
    node.warn({
        currIndex,
        device,
        currentKey
    })
}

// ========== OBSERVABILIDADE: Prepara dados para persistência ==========
const timestamp = Date.now();
const deviceName = device.deviceName || 'unknown';
const logKey = `automation_log_${deviceName.replace(/\s+/g, '')}_${timestamp}`;

// Detecta o motivo da decisão
let reason = 'weekday';
if (Array.isArray(excludedDays) && excludedDays.length > 0) {
  for (const ex of excludedDays) {
    const d = new Date(ex);
    d.setHours(0, 0, 0, 0);
    if (toISODate(d) === isoToday) {
      reason = 'excluded';
      break;
    }
  }
}
if (reason === 'weekday' && isHolidayToday) {
  reason = 'holiday';
}

// ========== CORREÇÃO #6: Usa a agenda REALMENTE aplicada ==========
const observability = {
  logKey: logKey,
  logData: {
    device: deviceName,
    deviceId: device.deviceId || currentKey,
    action: shouldActivate ? 'ON' : 'OFF',
    shouldActivate: shouldActivate,
    shouldShutdown: shouldShutdown,
    reason: reason,
    schedule: appliedSchedule ? {
      startHour: appliedSchedule.startHour,
      endHour: appliedSchedule.endHour,
      retain: appliedSchedule.retain,
      holiday: appliedSchedule.holiday || false,
      daysWeek: appliedSchedule.daysWeek
    } : null,
    context: {
      isHolidayToday: isHolidayToday,
      currentWeekDay: currWeekDay,
      holidayPolicy: holidayPolicy,
      totalSchedules: schedules ? schedules.length : 0
    },
    timestamp: nowLocal.toISOString(),
    timestampMs: timestamp
  }
};
// ========== FIM OBSERVABILIDADE ==========

return {
  deviceName: device.deviceName,
  payload: {
    currentIndex: currIndex,
    length: keys.length,
    shouldActivate,
    shouldShutdown,
    device,
    deviceName: device.deviceName,
    excludedDays,
    currDate: today0h,
    currentTimeSP: nowLocal,
    storedHolidaysDays,
    schedules,

    // ========== NOVO: Campo de observabilidade ==========
    _observability: observability
  }
};
