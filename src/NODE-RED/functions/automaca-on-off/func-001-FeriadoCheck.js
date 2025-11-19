// ARQUIVO: src/NODE-RED/functions/automaca-on-off/func-001-FeriadoCheck.js

// ============================================================================
// UTILITIES (Versão Corrigida V21 - Alinhada com o Engine)
// ============================================================================

function safeISO(d) {
    if (!d) return null;
    
    // 1. Blindagem: Se for string YYYY-MM-DD, retorna intacta (Evita o bug do dia 24)
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    // 2. Fallback: Se for Date, usa getters LOCAIS para manter o dia do sistema
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toISODate(d) { return safeISO(d); }

function startOfDayLocal(d) {
    const newD = new Date(d);
    newD.setHours(0, 0, 0, 0);
    return newD;
}

function subtractWeekDay(day) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const idx = days.indexOf(day.toLowerCase());
    return days[(idx - 1 + days.length) % days.length];
}

function atTimeLocal(base, hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
}

// Função decide (Lógica Local + Precisão de 30s)
function decide(retain, now, start, end) {
    const n = now.getTime();
    const s = start.getTime();
    const e = end.getTime();
    const tolerance = 30000; // 30s

    if (!retain) {
        // Pulso
        if (Math.abs(n - s) <= tolerance) return [false, true];
        if (Math.abs(n - e) <= tolerance) return [true, false];
        return [false, false];
    } else {
        // Retain
        if (n >= s && n < e) return [false, true];
        return [true, false];
    }
}

// Exportação
module.exports = {
    safeISO,
    toISODate,
    startOfDayLocal,
    subtractWeekDay,
    atTimeLocal,
    decide
};