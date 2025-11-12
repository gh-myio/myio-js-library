Curto e direto: do jeito que está, feriado NÃO é “mandatório”. O código avalia o bloco de feriado e depois continua avaliando a agenda normal do dia (dias da semana). Isso pode ativar/desativar em duplicidade num feriado — ou seja, pode dar BUG dependendo da regra desejada (se em feriado deveria valer só a agenda de feriado).

Principais pontos de risco

Lógica de feriado não exclui a agenda normal
Se schedule.holiday === true e hoje está em storedHolidaysDays, você decide (decide(...)) — mas em seguida o código segue para o trecho de dias da semana e pode “redecidir”. Se a intenção é “em feriado vale apenas o horário de feriado”, você precisa pular a lógica normal quando for feriado, e pular a lógica de feriado quando não for feriado.

Comparação de horário por string UTC
convertHoursMinutes() usa getUTCHours()/getUTCMinutes() e compara com HH:mm montado de startTime/endTime. Como startTime/endTime são horários locais (São Paulo) e você está convertendo para UTC antes de comparar, pode falhar em bordas (meia-noite, virada de dia, etc.). Melhor comparar milissegundos (>= / <=) ou minutos desde o início do dia no mesmo fuso.

Construção de datas por string “MM/DD/YYYY”
new Date(${month}/${day}/${year} ${time}:00) é dependente de implementação/locale. Em alguns ambientes isso quebra ou interpreta como UTC. Construa com o construtor numérico do Date.

Fuso horário de São Paulo / mutabilidade
convertToSaoPaulo(utcDate) faz utcDate.setMinutes(...) (muta o objeto original) e assume offset fixo -3. Isso é perigoso (efeito colateral) e engessado. Hoje o Brasil não usa horário de verão, mas isso já mudou no passado; se voltar, o -3 fixo erra.

Typos e lixo de código

const now = new Dat+e(); (typo)

Um s solto em convertToUTC.
Pequenos, mas causam crash.

Como deixar feriado “mandatório” (e corrigir os pontos 2–4)

Use uma flag isHolidayToday uma única vez e bifurque a avaliação:

function atTime(baseDate, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    h, m, 0, 0
  ); // evita parse por string
}

function startOfDay(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setHours(0,0,0,0);
  return d;
}

// NÃO mutate o parâmetro; e evite offset fixo se puder.
// Se o ambiente permitir, prefira manter tudo em horário local do servidor
// já considerando que ele está configurado para America/Sao_Paulo.
const nowLocal = new Date();               // assuma servidor em America/Sao_Paulo
const today0h  = startOfDay(nowLocal);

// Descobrir feriado hoje (storedHolidaysDays tipo 'YYYY-MM-DD' ou similar)
const isoToday = today0h.toISOString().slice(0,10);
const isHolidayToday = (storedHolidaysDays || []).some(d => {
  // normaliza “data solta”:
  const onlyYmd = new Date(d); 
  onlyYmd.setHours(0,0,0,0);
  return onlyYmd.toISOString().slice(0,10) === isoToday;
});

for (const schedule of schedulesSorted) {
  const { startHour, endHour, daysWeek: days, retain, holiday: isHolidaySchedule } = schedule;

  // Política: em feriado, só avalia agendas marcadas como feriado;
  // se NÃO for feriado, ignora agendas de feriado.
  if (isHolidayToday && !isHolidaySchedule) continue;
  if (!isHolidayToday && isHolidaySchedule) continue;

  const startTime = atTime(nowLocal, startHour);
  const endTime   = atTime(nowLocal, endHour);

  // janela atravessa a meia-noite?
  const crossesMidnight = startTime.getTime() > endTime.getTime();

  const currentMs = nowLocal.getTime();
  let onWindow = false;

  if (!crossesMidnight) {
    // Janela no mesmo dia
    onWindow = currentMs >= startTime.getTime() && currentMs < endTime.getTime();
    if (days[nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase()]) {
      // decide por intervalo
      if (!retain) {
        if (currentMs === startTime.getTime()) { shouldActivate = true; shouldShutdown = false; }
        else if (currentMs === endTime.getTime()) { shouldShutdown = true; shouldActivate = false; }
      } else {
        shouldActivate = onWindow;
        shouldShutdown = !onWindow;
      }
    }
  } else {
    // Atravessa a meia-noite: divide em [start..23:59] OU [00:00..end]
    const endNext = new Date(endTime.getTime() + 24*60*60*1000);
    const inPart1 = currentMs >= startTime.getTime();            // hoje após start
    const inPart2 = currentMs < endTime.getTime();               // hoje antes de end (amanhã)
    const activeYesterday = days[
      new Date(nowLocal.getTime() - 24*60*60*1000)
        .toLocaleString('en-US', { weekday: 'short' }).toLowerCase()
    ];
    const activeToday = days[
      nowLocal.toLocaleString('en-US', { weekday: 'short' }).toLowerCase()
    ];

    if (activeYesterday && inPart1) {
      if (!retain) {
        if (currentMs === startTime.getTime()) { shouldActivate = true; shouldShutdown = false; }
        else if (currentMs === endTime.getTime()) { /* não ocorre no mesmo dia */ }
      } else {
        shouldActivate = true;
        shouldShutdown = false;
      }
    }

    if (activeToday && inPart2) {
      if (!retain) {
        if (currentMs === endTime.getTime()) { shouldShutdown = true; shouldActivate = false; }
      } else {
        shouldActivate = true;
        shouldShutdown = false;
      }
    }
  }
}

// Exclusões de data SEMPRE prevalecem
for (const excludedDay of excludedDays) {
  const ex = new Date(excludedDay); ex.setHours(0,0,0,0);
  if (ex.toISOString().slice(0,10) === isoToday) {
    shouldShutdown = true;
    shouldActivate = false;
  }
}

O que mudou (essência)

Feriado “mandatório”: isHolidayToday controla um continue que descarta o tipo de agenda indevido.

Sem getUTCHours(): tudo comparado em ms locais.

Data segura: atTime() usa o construtor numérico (new Date(y, m, d, h, min)), sem parse de string.

Sem mutações em funções utilitárias e sem offset fixo aplicado “no escuro”.

Se a sua regra for diferente (ex.: em feriado vale a agenda normal e a de feriado, prevalecendo a mais “restritiva”), dá pra ajustar a política facilmente (em vez de continue, você avalia as duas e resolve conflitos por prioridade).