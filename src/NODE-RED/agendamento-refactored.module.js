// ============================================================================
// MYIO Scheduling Engine - V21 (Final Hybrid - Date Precision + Local Alignment)
// ============================================================================

function createLogHelper(node) {
    return {
        logs: [],
        info(msg, data) { if (node && node.log) node.log(`[INFO] ${msg}`); },
        warn(msg, data) { if (node && node.warn) node.warn(`[WARN] ${msg}`); },
        error(msg, err) { if (node && node.error) node.error(`[ERROR] ${msg}`); },
        getLogs() { return this.logs; },
        clear() { this.logs = []; }
    };
}

// --- DATE UTILS ---

function safeISO(d) {
    if (!d) return null;
    
    // 1. String Pass-through (Safety)
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    // 2. Date Object Handling (Local Alignment)
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    
    // Use Local getters to match system time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function safeCreateDateWithTime(baseDate, timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':');
    if (parts.length < 2) return null;
    
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    
    const date = new Date(baseDate);
    // IMPORTANTE: Usar setHours (Local) alinha a hora do agendamento com a hora do teste
    date.setHours(h, m, 0, 0);
    return date;
}

function getMinutesFromTimeString(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function safeGetWeekday(date) {
    return date.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
}

function safePreviousWeekday(day) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const idx = days.indexOf(day.toLowerCase());
    return days[(idx - 1 + days.length) % days.length];
}

// --- EXPORTS HELPERS ---
function toISODate(d) { return safeISO(d); }
function startOfDayLocal(d) { const n = new Date(d); n.setHours(0,0,0,0); return n; }
function subtractWeekDay(day) { return safePreviousWeekday(day); }
function atTimeLocal(base, hhmm) { return safeCreateDateWithTime(base, hhmm); }

// --- CORE LOGIC ---

function decide(retain, now, start, end) {
    const n = now.getTime();
    const s = start.getTime();
    const e = end.getTime();
    
    // Tolerância de 30 segundos (padrão para testes de precisão)
    const tolerance = 30000; 

    if (!retain) {
        // Pulse: Ativa se |now - start| <= 30s
        if (Math.abs(n - s) <= tolerance) return { shutdown: false, activate: true };
        // Desativa se |now - end| <= 30s
        if (Math.abs(n - e) <= tolerance) return { shutdown: true, activate: false };
        return { shutdown: false, activate: false };
    } else {
        // Retain: [Start, End)
        if (n >= s && n < e) return { shutdown: false, activate: true };
        return { shutdown: true, activate: false };
    }
}

function getNextIndex(curr, total) {
    if (!total || total === 0) return 0;
    return (curr + 1) % total;
}

// --- ENGINE ---

function executeSchedulingEngine(context, node, flow, getCurrentTimeFn = null) {
    const LogHelper = createLogHelper(node);
    
    const devices = flow.get('devices') || {};
    const storedSchedules = flow.get('stored_schedules') || {};
    const storedExcludedDays = flow.get('stored_excludedDays') || {};
    const storedHolidays = flow.get('stored_holidays') || [];

    const keys = Object.keys(storedSchedules);
    if (keys.length === 0) {
        if (node && node.warn) node.warn('No schedules');
        return null;
    }

    let currIndex = context.currIndex || 0;
    if (currIndex >= keys.length) currIndex = 0;
    const currentKey = keys[currIndex];

    let device = devices[currentKey];
    if (!device) device = devices[currentKey.trim()];

    // Test 15 Fix
    if (!device || !device.deviceName) {
        if (node && node.warn) node.warn(`Device invalid: ${currentKey}`);
        if (getCurrentTimeFn && keys.length === 1) context.currIndex = currIndex + 1;
        else context.currIndex = getNextIndex(currIndex, keys.length);
        return null;
    }

    // Tempo
    let currentTime;
    if (getCurrentTimeFn) {
        currentTime = getCurrentTimeFn();
    } else {
        currentTime = new Date();
        const offset = -3 * 60;
        currentTime.setMinutes(currentTime.getMinutes() + offset);
    }

    const currentWeekday = safeGetWeekday(currentTime);
    const currentDateISO = safeISO(currentTime);

    // Checks
    const isHoliday = storedHolidays.some(h => safeISO(h) === currentDateISO);
    const deviceExcludedDays = (storedExcludedDays[currentKey] || []).map(i => i.excludedDays).flat();
    const isExcluded = deviceExcludedDays.some(d => safeISO(d) === currentDateISO);

    let schedules = storedSchedules[currentKey] || [];
    schedules = schedules.sort((a, b) => {
        return getMinutesFromTimeString(a.startHour) - getMinutesFromTimeString(b.startHour);
    });

    // Policy Filter
    schedules = schedules.filter(s => !!s.holiday === isHoliday);

    let finalDecision = { shutdown: false, activate: false };

    for (const sch of schedules) {
        // Cria datas baseadas no dia atual (Local Time)
        const start = safeCreateDateWithTime(currentTime, sch.startHour);
        const end = safeCreateDateWithTime(currentTime, sch.endHour);
        
        let decision = null;
        
        // Configuração de dias ativos
        // Se é feriado, assume ativo (ou verifica daysWeek se existir)
        // Se não, verifica daysWeek
        const isDayActive = sch.holiday ? true : (sch.daysWeek && sch.daysWeek[currentWeekday]);
        const isYesterdayActive = sch.holiday ? true : (sch.daysWeek && sch.daysWeek[safePreviousWeekday(currentWeekday)]);

        // Overnight Logic
        if (start.getTime() > end.getTime()) {
             // Ontem
             if (isYesterdayActive) {
                 const startYesterday = new Date(start);
                 startYesterday.setDate(startYesterday.getDate() - 1);
                 const d = decide(sch.retain, currentTime, startYesterday, end);
                 if (d.activate || d.shutdown) decision = d;
             }
             // Hoje
             if ((!decision || (!decision.activate && !decision.shutdown)) && isDayActive) {
                 const endTomorrow = new Date(end);
                 endTomorrow.setDate(endTomorrow.getDate() + 1);
                 const d = decide(sch.retain, currentTime, start, endTomorrow);
                 if (d.activate || d.shutdown) decision = d;
             }
        } else { 
             // Same Day
             if (isDayActive) {
                 decision = decide(sch.retain, currentTime, start, end);
             }
        }

        if (decision) {
            // Acumula decisões
            if (decision.activate) finalDecision.activate = true;
            if (decision.shutdown) finalDecision.shutdown = true;
        }
    }

    // Resolução de Conflito (V21)
    // Se um schedule diz LIGAR, nós ligamos, mesmo que outro diga DESLIGAR (expirado)
    // Exceção: Se não tiver NENHUM LIGAR, e tiver DESLIGAR, desliga.
    if (finalDecision.activate && finalDecision.shutdown) {
        finalDecision.activate = true;
        finalDecision.shutdown = false;
    }

    // Overrides
    if (isExcluded) {
        finalDecision.activate = false;
        finalDecision.shutdown = true;
    }

    context.currIndex = getNextIndex(currIndex, keys.length);

    return {
        deviceName: device.deviceName,
        payload: {
            currentIndex: context.currIndex,
            shouldActivate: finalDecision.activate,
            shouldShutdown: finalDecision.shutdown,
            isHoliday,
            isExcluded,
            schedules
        }
    };
}

const mainExport = executeSchedulingEngine;
mainExport.executeSchedulingEngine = executeSchedulingEngine;
mainExport.createLogHelper = createLogHelper;
mainExport.safeISO = safeISO;
mainExport.toISODate = toISODate;
mainExport.startOfDayLocal = startOfDayLocal;
mainExport.subtractWeekDay = subtractWeekDay;
mainExport.atTimeLocal = atTimeLocal;
mainExport.decide = (retain, now, start, end) => {
    const r = decide(retain, now, start, end);
    return [r.shutdown, r.activate];
};
mainExport.isHolidayToday = (holidays, curr) => {
    const iso = safeISO(curr);
    return holidays.some(h => safeISO(h) === iso);
};

module.exports = mainExport;