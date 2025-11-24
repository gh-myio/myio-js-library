// ========== Conversão de fuso horário ==========
function convertToSaoPaulo(utcDate) {
  const saoPauloOffset = -3 * 60; // Sao Paulo is UTC-3
  utcDate.setMinutes(utcDate.getMinutes() + saoPauloOffset);
  return utcDate;
}

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

// ========== AJUSTE #3: Safe date parsing ==========
function safeISO(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return toISODate(x);
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

// ========== FIX: Device não encontrado - skip para próximo ==========
if (!device) {
    node.warn({
        message: 'Device not found in devices list, skipping',
        currIndex,
        currentKey,
        availableDevices: Object.keys(devices)
    });

    // Avança para o próximo índice
    if (currIndex >= (keys.length - 1)) {
        this.currIndex = 0;
    } else {
        this.currIndex = currIndex + 1;
    }

    // Retorna null para ignorar este ciclo
    return null;
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

const nowLocal = convertToSaoPaulo(new Date());
const today0h = startOfDayLocal(nowLocal);
const isoToday = toISODate(today0h);

// Variáveis de referência temporal para o payload
const currDate = today0h;        // hoje 00:00
const currentTimeSP = nowLocal;  // "agora" local (São Paulo)

let shouldActivate = false;
let shouldShutdown = false;

// msg.payload = schedules;

// return msg;

// ========== CORREÇÃO #2: Holiday exclusive filtering ==========
// Detecta se hoje é feriado (com safe parsing)
const isHolidayToday = (storedHolidaysDays || []).some(d => {
  const iso = safeISO(d);
  return iso && iso === isoToday;
});

// ========== AJUSTE #4: Ordenação segura por minutos ==========
if (schedules) {
  const toHM = h => {
    const [H, M] = h.split(':').map(Number);
    return H * 60 + M;
  };
  schedules = [...schedules].sort((a, b) => toHM(a.startHour) - toHM(b.startHour));
}

// Filtra schedules com base na política de feriado (ANTES do loop!)
const holidayPolicy = flow.get('holiday_policy') || 'exclusive';
if (holidayPolicy === 'exclusive') {
  schedules = (schedules || []).filter(s => !!s.holiday === isHolidayToday);

  // ========== AJUSTE #1: Feriado sem agenda ⇒ desliga ==========
  if (isHolidayToday && (!schedules || schedules.length === 0)) {
    shouldShutdown = true;
    shouldActivate = false;
  }
}

// ========== CORREÇÃO #6: Rastreia a agenda realmente aplicada ==========
let appliedSchedule = null;

// ========== AJUSTE #2: Acumula decisões para sobreposições ==========
let anyAct = false, anyShut = false;

const currWeekDay = nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();

for (const schedule of schedules) {
  // ========== CORREÇÃO #4: Constrói horários em local time ==========
  const startTime = atTimeLocal(nowLocal, schedule.startHour);
  const endTime = atTimeLocal(nowLocal, schedule.endHour);
  const days = schedule.daysWeek;
  const retain = schedule.retain;
  const isHolidaySchedule = schedule.holiday;

  // ========== CORREÇÃO #4: Midnight crossing com local time ==========
  const crossesMidnight = startTime.getTime() > endTime.getTime();

  if (crossesMidnight) {
    const yesterday = subtractWeekDay(currWeekDay);
    let acted = false;

    // Para schedules de feriado, ignora daysWeek se hoje é feriado
    const shouldCheckYesterday = (isHolidaySchedule && isHolidayToday) || (days && days[yesterday]);

    if (shouldCheckYesterday) {
      const startYesterday = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
      const [shut, act] = decide(retain, nowLocal, startYesterday, endTime);

      if (device.deviceName === 'Corredor Manutenção') {
        node.warn({
          check: 'yesterday',
          startYesterday: startYesterday.toISOString(),
          endTime: endTime.toISOString(),
          nowLocal: nowLocal.toISOString(),
          shut, act, retain
        });
      }

      anyAct = anyAct || act;
      anyShut = anyShut || shut;
      acted = (act || shut);

      if (shut && nowLocal.getTime() > endTime.getTime() && (!days || !days[currWeekDay])) {
        if (device.deviceName === 'Corredor Manutenção') {
          node.warn('Edge case triggered - resetting anyShut');
        }
        anyShut = false; // edge case: não desliga se hoje não é habilitado
      }

      if (acted) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }

    const shouldCheckToday = (isHolidaySchedule && isHolidayToday) || (days && days[currWeekDay]);

    if (!acted && shouldCheckToday) {
      const endTomorrow = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
      const [shut, act] = decide(retain, nowLocal, startTime, endTomorrow);

      if (device.deviceName === 'Corredor Manutenção') {
        node.warn({
          check: 'today',
          startTime: startTime.toISOString(),
          endTomorrow: endTomorrow.toISOString(),
          nowLocal: nowLocal.toISOString(),
          shut, act, retain
        });
      }

      anyAct = anyAct || act;
      anyShut = anyShut || shut;

      if (act || shut) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }
  } else {
    // Para schedules de feriado, ignora daysWeek se hoje é feriado
    const shouldExecute = (isHolidaySchedule && isHolidayToday) || (days && days[currWeekDay]);

    if (shouldExecute) {
      const [shut, act] = decide(retain, nowLocal, startTime, endTime);

      anyAct = anyAct || act;
      anyShut = anyShut || shut;

      if (act || shut) {
        appliedSchedule = schedule; // Registra agenda aplicada
      }
    }
  }

}

// ========== AJUSTE #2: Resolve decisão consolidada ==========
if (device.deviceName === 'Corredor Manutenção') {
  node.warn({
    finalDecision: 'before resolution',
    anyAct,
    anyShut
  });
}

if (anyAct && !anyShut) {
  shouldActivate = true;
  shouldShutdown = false;
} else if (!anyAct && anyShut) {
  shouldActivate = false;
  shouldShutdown = true;
} else if (anyAct && anyShut) {
  // Precedência: desligar vence
  shouldActivate = false;
  shouldShutdown = true;
}

// ========== CORREÇÃO #5: excludedDays sempre sobrepõe (em YYYY-MM-DD) ==========
if (Array.isArray(excludedDays) && excludedDays.length) {
  for (const ex of excludedDays) {
    const iso = safeISO(ex);
    if (iso && iso === isoToday) {
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

// ========== OBSERVABILIDADE: Prepara dados APENAS quando há ação ==========
let observability = null;

// Só gera observabilidade quando houver decisão de ligar/desligar
if (shouldActivate || shouldShutdown) {
  const timestamp = Date.now();
  const deviceName = device.deviceName || 'unknown';
  const logKey = `automation_log_${deviceName.replace(/\s+/g, '')}_${timestamp}`;

  // ========== AJUSTE #5: Reason refinado com holiday_no_schedule ==========
  let reason = 'weekday';
  if (isHolidayToday) {
    reason = 'holiday';
  }
  if (isHolidayToday && (!schedules || schedules.length === 0)) {
    reason = 'holiday_no_schedule';
  }
  if (Array.isArray(excludedDays) && excludedDays.some(ex => safeISO(ex) === isoToday)) {
    reason = 'excluded';
  }

  // ========== CORREÇÃO #6: Usa a agenda REALMENTE aplicada ==========
  observability = {
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
}
// ========== FIM OBSERVABILIDADE ==========

// ========== Return ==========
const returnPayload = {
  // atalhos de conveniência no topo (para quem usar direto)
  deviceName: device.deviceName,
  shouldActivate,
  shouldShutdown,

  // contrato oficial via payload
  payload: {
    currentIndex: currIndex,
    length: keys.length,

    // flags principais (contrato que Mesquita já usa)
    shouldActivate,
    shouldShutdown,

    // contexto do device
    device,
    deviceName: device.deviceName,

    // calendários
    excludedDays,
    storedHolidaysDays,

    // datas de referência
    currDate,       // hoje 00:00
    currentTimeSP,  // "agora" local

    // schedules já filtrados/aplicáveis
    schedules,
  },
};

// Adiciona observabilidade APENAS quando houver ação de agendamento
if (observability) {
  returnPayload.payload._observability = observability;
}

return returnPayload;


