Resumo sincero: a função ainda não está “ok” — ela mantém os mesmos riscos que comentamos antes e, do jeito que está, feriado não é exclusivo (o bloco de dias da semana continua executando depois do bloco de feriado). Há também problemas de fuso/parse e de comparação “na vírgula do minuto”.

Aqui vai um checklist objetivo do que corrigir, com trechos prontos pra colar.

1) Pare de “fabricar” datas por string e de aplicar offset fixo

Problemas:

getDateFromTime() cria new Date("MM/DD/YYYY hh:mm:00") (parse dependente de locale).

convertToSaoPaulo(new Date()) muta o Date e soma um offset fixo -3h (pode errar e ainda soma em cima de uma data local, não UTC).

convertHoursMinutes() usa getUTCHours(); você está comparando UTC vs horário local.

Correção (substitui utilitários):

function atTimeLocal(base, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}
function startOfDayLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}


E use apenas new Date() (local do servidor) como “agora”. Nada de convertToSaoPaulo/convertToUTC.

2) Faça feriado ser mandatório/exclusivo

Problema:

Se schedule.holiday === true e hoje é feriado, você decide… e depois o código segue avaliando os horários normais do dia (podendo sobrescrever).

Correção (logo após calcular isoToday):

const nowLocal = new Date();
const today0h  = startOfDayLocal(nowLocal);
const isoToday = today0h.toISOString().slice(0,10);

const isHolidayToday = (storedHolidaysDays || []).some(d => {
  const dd = new Date(d);
  dd.setHours(0,0,0,0);
  return dd.toISOString().slice(0,10) === isoToday;
});

// Filtra o array "schedules" ANTES do for:
const holidayPolicy = (flow.get('holiday_policy') || 'exclusive'); // opcional
if (holidayPolicy === 'exclusive') {
  schedules = (schedules || []).filter(s => !!s.holiday === isHolidayToday);
}


Assim, no loop você só itera o tipo de agenda permitido para hoje. Isso elimina a colisão.

3) Reescreva decide() para comparar ms, não “HH:mm” por string

Problemas:

Igualdade de HH:mm “na vírgula” é frágil (latência de execução); UTC vs local pode falhar.

retain:false em “horas exatas” merece tolerância (ex.: ±30s).

Correção:

function decide(retain, now, start, end, toleranceMs = 30_000) {
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

4) Construa os horários do mesmo dia/local e trate meia-noite sem UTC

Substitua onde você cria startTime/endTime e trata overnight:

const currWeekDay = nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
const startTime = atTimeLocal(nowLocal, schedule.startHour);
const endTime   = atTimeLocal(nowLocal, schedule.endHour);

const crossesMidnight = startTime.getTime() > endTime.getTime();
if (crossesMidnight) {
  const yesterday = subtractWeekDay(currWeekDay);
  let acted = false;

  if (schedule.daysWeek?.[yesterday]) {
    const startYesterday = new Date(startTime.getTime() - 24*60*60*1000);
    const [shut, act] = decide(schedule.retain, nowLocal, startYesterday, endTime);
    shouldShutdown = shut; shouldActivate = act; acted = (act || shut);
    if (shouldShutdown && nowLocal.getTime() > endTime.getTime() && !schedule.daysWeek?.[currWeekDay]) {
      shouldShutdown = false;
    }
  }

  if (!acted && schedule.daysWeek?.[currWeekDay]) {
    const endTomorrow = new Date(endTime.getTime() + 24*60*60*1000);
    const [shut, act] = decide(schedule.retain, nowLocal, startTime, endTomorrow);
    shouldShutdown = shut; shouldActivate = act;
  }
} else {
  if (schedule.daysWeek?.[currWeekDay]) {
    const [shut, act] = decide(schedule.retain, nowLocal, startTime, endTime);
    shouldShutdown = shut; shouldActivate = act;
  }
}

5) excludedDays deve sempre sobrepor (e comparar em YYYY-MM-DD)

Seu bloco já faz isso, mas normalize igual ao feriado:

if (Array.isArray(excludedDays) && excludedDays.length) {
  const todayIso = isoToday;
  for (const ex of excludedDays) {
    const d = new Date(ex); d.setHours(0,0,0,0);
    if (d.toISOString().slice(0,10) === todayIso) {
      shouldShutdown = true; shouldActivate = false;
      break;
    }
  }
}

6) Observabilidade: log da agenda realmente aplicada

Hoje você registra schedules[0], que pode não ser a agenda que disparou. Guarde a agenda aplicada durante o loop:

let appliedSchedule = null;

// ...dentro de cada decisão bem-sucedida:
appliedSchedule = schedule; // quando decidir ligar/desligar para esse schedule


e depois use appliedSchedule no bloco de retorno.

Conclusão

Feriado ainda não é exclusivo na função enviada (você decide no bloco de feriado e depois o bloco “dias da semana” pode sobrescrever).

Há risco de fuso (offset fixo e UTC vs local) e risco de tic (igualdade HH:mm).

Aplicando os 6 passos acima, você elimina esses bugs e alinha o código com o fluxo que desenhamos (holiday exclusive, comparações em ms locais, e observabilidade correta).