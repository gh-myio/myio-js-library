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
  // No stored schedules, ignoring...
    return null;
}

const currentKey = keys[currIndex];
const schedules = storedSchedules[currentKey];
const device = devices[currentKey];

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

  if (holidayBool) {
    // This schedule is specific to holidays, we should check the list of
    // holidays to see if today is a holiday:
    if (storedHolidaysDays.length > 0) {
      for (const holidayDay of storedHolidaysDays) {
        const holidayDate = new Date(transformDate(holidayDay));

        // This works because we set hours, minutes and seconds to 0
        if (currDate.getTime() === holidayDate.getTime()) {
          // This is a holiday, go ahead and decide whether to turn on
          const [newShouldShutdown, newShouldActivate] = decide(retain, currentTimeSP, startTime, endTime);

          shouldShutdown = newShouldShutdown;
          shouldActivate = newShouldActivate;
        }
      }
    }
  }

  // Tests cases here:
  // Current day of the week: mon
  // Current time: 02:00
  // Schedule: sun, 23h - 04h
  // Expected: shouldActivate: true
 
  // If startTime > endTime, it means that the schedule ends in the next day
  if ((startTime > endTime)
    && (currentTimeSP.getTime() < endTime.getTime())
  ) {
    // Check if last week day was enabled...
    const yesterday = subtractWeekDay(currWeekDay);
    shouldShutdown = false;
    shouldActivate = true;
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

return {
  deviceName: device.name,
  payload: {
    currentIndex: this.currIndex,
    length: keys.length,
    shouldActivate,
    shouldShutdown,
    device,
    excludedDays,
    currDate,
    currentTimeSP,
    storedHolidaysDays,
    schedules,
  }
};
