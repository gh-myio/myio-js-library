/**
 * Utility Functions for Automation Schedule
 *
 * Módulo com funções auxiliares testáveis
 */

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
  const daysOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentDayIndex = daysOfWeek.indexOf(day.toLowerCase());
  const previousDayIndex = (currentDayIndex - 1 + daysOfWeek.length) % daysOfWeek.length;
  return daysOfWeek[previousDayIndex];
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

module.exports = {
  convertToSaoPaulo,
  atTimeLocal,
  startOfDayLocal,
  toISODate,
  safeISO,
  subtractWeekDay,
  decide
};
