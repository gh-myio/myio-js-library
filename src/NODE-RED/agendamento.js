function getDateFromTime(now, time) {
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();

  return new Date(`${month}/${day}/${year} ${time}:00`);
}

function convertToUTC(time) {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
s
  return new Date(
    new Date(`${month}/${day}/${year} ${time}:00-03:00`).getTime()
  );
}

function convertToSaoPaulo(utcDate) {
  const saoPauloOffset = -3 * 60; // Sao Paulo is UTC-3

  utcDate.setMinutes(utcDate.getMinutes() + saoPauloOffset);

  return utcDate;
}


function transformDate(dateString) {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split('T')[0];
}

function convertHoursMinutes(timestamp) {
  const date = new Date(timestamp)
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return (hours + ':' + minutes)
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

const currentTimeSP = convertToSaoPaulo(new Date());
const currDate = getDateFromTime(currentTimeSP, '00:00');

let shouldActivate = false;
let shouldShutdown = false;

function decide(retain, currentTimeSP, startTime, endTime) {
  if (!retain) {
    if (convertHoursMinutes(currentTimeSP.getTime()) == convertHoursMinutes(startTime.getTime())) {
      return [false, true]; // shouldShutdown, shouldActivate
    } else if (convertHoursMinutes(currentTimeSP.getTime()) == convertHoursMinutes(endTime.getTime())) {
      return [true, false]; 
    } else {
      return [false, false];
    }
  } else {
    if (currentTimeSP.getTime() > startTime.getTime()
      && currentTimeSP.getTime() < endTime.getTime()) {
      return [false, true];
    } else {
      return [true, false];
    }
  }
}

// msg.payload = schedules;

// return msg;

if (schedules) {
  schedules = [...schedules].sort((a, b) => {
    const timeA = a.startHour.replace(':', '');
    const timeB = b.startHour.replace(':', '');
    return timeA - timeB;
  });
}


// Verificar SE hoje é feriado (apenas uma vez, antes do loop)
const isHolidayToday = storedHolidaysDays.length > 0 && storedHolidaysDays.some(holidayDay => {
  const holidayDate = new Date(transformDate(holidayDay));
  return currDate.getTime() === holidayDate.getTime();
});

// Verificar se existe algum schedule de feriado configurado
const hasHolidaySchedule = schedules.some(s => s.holiday === true);

for (const schedule of schedules) {

  const startTime = getDateFromTime(currentTimeSP, schedule.startHour);
  const endTime = getDateFromTime(currentTimeSP, schedule.endHour);
  const days = schedule.daysWeek;
  const retain = schedule.retain;
  const holidayBool = schedule.holiday;
  const currWeekDay = currentTimeSP.toLocaleString(
    'en-US', {
      weekday: 'short',
    },
  ).toLowerCase();

  // ⚠️ FIX CRÍTICO: Filtrar schedules baseado no tipo de dia
  // REGRA 1: Se NÃO é feriado, pular schedules de feriado
  if (holidayBool && !isHolidayToday) {
    continue;
  }

  // REGRA 2: Se É feriado E existe schedule de feriado, pular schedules normais
  // FALLBACK: Se É feriado MAS NÃO existe schedule de feriado, usar schedule normal
  if (!holidayBool && isHolidayToday && hasHolidaySchedule) {
    continue; // Só pula schedule normal se houver alternativa de feriado
  }

  if (holidayBool) {
    // Se chegou aqui, é porque já validamos que hoje É feriado (linhas 142-147)
    // Então processar o agendamento de feriado diretamente
    const [newShouldShutdown, newShouldActivate] = decide(retain, currentTimeSP, startTime, endTime);
    shouldShutdown = newShouldShutdown;
    shouldActivate = newShouldActivate;
    continue; // Não processar lógica de dia de semana para schedules de feriado
  }

  // Tests cases here:
  // Current day of the week: mon
  // Current time: 02:00
  // Schedule: sun, 23h - 04h
  // Expected: shouldActivate: true
  
  // 12:00 -> 11:59
 
  // If startTime > endTime, it means that the schedule ends in the next day
  if (startTime > endTime) {
    const yesterday = subtractWeekDay(currWeekDay);
    let yesterdayActivate = false;

    if (days[yesterday]) {
        const newStartTime = new Date(startTime.getTime());
        newStartTime.setDate(startTime.getDate() - 1);

        const [newShouldShutdown, newShouldActivate] = decide(retain, currentTimeSP, newStartTime, endTime);

        shouldShutdown = newShouldShutdown;
        shouldActivate = newShouldActivate;
        
        yesterdayActivate = shouldActivate;
        
        // Here we should handle an edge case, if currentTime > endTime and days[currWeekDay] is false, we should not shutdown
        if (shouldShutdown
            && currentTimeSP.getTime() > endTime.getTime()
            && !days[currWeekDay]) {
                node.warn('edge case');
                node.warn(currentTimeSP);
                node.warn(endTime);
                
                shouldShutdown = false;
        }
    }
    
    if (days[currWeekDay] && !yesterdayActivate) {
        const newEndTime = new Date(endTime.getTime());
        newEndTime.setDate(endTime.getDate() + 1);

        const [newShouldShutdown, newShouldActivate] = decide(retain, currentTimeSP, startTime, newEndTime);

        shouldShutdown = newShouldShutdown;
        shouldActivate = newShouldActivate;
    }
  } else {
      if (days[currWeekDay]) {
        const [newShouldShutdown, newShouldActivate] = decide(retain, currentTimeSP, startTime, endTime);
        shouldShutdown = newShouldShutdown;
        shouldActivate = newShouldActivate;
      }
  }

  // se tiver dias na lista
  if (excludedDays.length > 0) {
    for (const excludedDay of excludedDays) {
      const excludedDate = new Date(transformDate(excludedDay));
      if (currDate.getTime() === excludedDate.getTime()) {
        shouldShutdown = true;
        shouldActivate = false;
      }
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
    currDate,
    currentTimeSP,
    storedHolidaysDays,
    schedules,
  }
};
