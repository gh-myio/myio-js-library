/**
 * Schedule Engine - Core Logic
 *
 * Lógica principal de agendamento testável
 */

const {
  convertToSaoPaulo,
  atTimeLocal,
  startOfDayLocal,
  toISODate,
  safeISO,
  subtractWeekDay,
  decide
} = require('./utilities');

/**
 * Processa um dispositivo e determina se deve ligar/desligar
 */
function processDevice(options) {
  const {
    device,
    schedules,
    excludedDays = [],
    storedHolidaysDays = [],
    nowLocal = new Date(),
    holidayPolicy = 'exclusive'
  } = options;

  if (!device || !schedules) {
    return {
      shouldActivate: false,
      shouldShutdown: false,
      appliedSchedule: null,
      reason: 'no_data'
    };
  }

  const today0h = startOfDayLocal(nowLocal);
  const isoToday = toISODate(today0h);

  // Detecta se hoje é feriado (compara strings ISO diretamente)
  const isHolidayToday = (storedHolidaysDays || []).some(d => {
    try {
      // d já é uma string no formato 'YYYY-MM-DD'
      return d === isoToday;
    } catch {
      return false;
    }
  });

  // Ordena schedules por horário
  let sortedSchedules = [...schedules];
  if (sortedSchedules.length > 0) {
    const toHM = h => {
      const [H, M] = h.split(':').map(Number);
      return H * 60 + M;
    };
    sortedSchedules.sort((a, b) => toHM(a.startHour) - toHM(b.startHour));
  }

  // Filtra schedules com base na política de feriado
  if (holidayPolicy === 'exclusive') {
    sortedSchedules = sortedSchedules.filter(s => !!s.holiday === isHolidayToday);

    // Feriado sem agenda ⇒ desliga
    if (isHolidayToday && sortedSchedules.length === 0) {
      return {
        shouldActivate: false,
        shouldShutdown: true,
        appliedSchedule: null,
        reason: 'holiday_no_schedule',
        isHolidayToday,
        totalSchedules: 0
      };
    }
  }

  // Acumula decisões para sobreposições
  let anyAct = false, anyShut = false;
  let appliedSchedule = null;

  const currWeekDay = nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();

  for (const schedule of sortedSchedules) {
    const startTime = atTimeLocal(nowLocal, schedule.startHour);
    const endTime = atTimeLocal(nowLocal, schedule.endHour);
    const days = schedule.daysWeek;
    const retain = schedule.retain;
    const isHolidaySchedule = schedule.holiday;

    const crossesMidnight = startTime.getTime() > endTime.getTime();

    if (crossesMidnight) {
      const yesterday = subtractWeekDay(currWeekDay);
      let acted = false;

      // Para schedules de feriado, ignora daysWeek se hoje é feriado
      const shouldCheckYesterday = (isHolidaySchedule && isHolidayToday) || (days && days[yesterday]);

      if (shouldCheckYesterday) {
        const startYesterday = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
        const [shut, act] = decide(retain, nowLocal, startYesterday, endTime);

        anyAct = anyAct || act;
        anyShut = anyShut || shut;
        acted = (act || shut);

        if (shut && nowLocal.getTime() > endTime.getTime() && (!days || !days[currWeekDay])) {
          anyShut = false; // edge case
        }

        if (acted) {
          appliedSchedule = schedule;
        }
      }

      const shouldCheckToday = (isHolidaySchedule && isHolidayToday) || (days && days[currWeekDay]);

      if (!acted && shouldCheckToday) {
        const endTomorrow = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        const [shut, act] = decide(retain, nowLocal, startTime, endTomorrow);

        anyAct = anyAct || act;
        anyShut = anyShut || shut;

        if (act || shut) {
          appliedSchedule = schedule;
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
          appliedSchedule = schedule;
        }
      }
    }
  }

  // Resolve decisão consolidada
  let shouldActivate = false;
  let shouldShutdown = false;

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

  // Determina reason
  let reason = 'weekday';
  if (isHolidayToday) {
    reason = 'holiday';
  }
  if (isHolidayToday && sortedSchedules.length === 0) {
    reason = 'holiday_no_schedule';
  }

  // excludedDays SEMPRE sobrepõe (aplica depois de tudo)
  const isExcluded = Array.isArray(excludedDays) && excludedDays.some(ex => {
    try {
      // ex já é uma string no formato 'YYYY-MM-DD'
      return ex === isoToday;
    } catch {
      return false;
    }
  });

  if (isExcluded) {
    shouldShutdown = true;
    shouldActivate = false;
    reason = 'excluded';
  }

  return {
    shouldActivate,
    shouldShutdown,
    appliedSchedule,
    reason,
    isHolidayToday,
    currWeekDay,
    holidayPolicy,
    totalSchedules: sortedSchedules.length
  };
}

module.exports = {
  processDevice
};
