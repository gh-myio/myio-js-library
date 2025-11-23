/**
 * Unit Tests for func-001-FeriadoCheck
 * Com cobertura de código real
 */

const { processDevice } = require('../lib/scheduleEngine');
const {
  convertToSaoPaulo,
  atTimeLocal,
  startOfDayLocal,
  toISODate,
  safeISO,
  subtractWeekDay,
  decide
} = require('../lib/utilities');

describe('func-001-FeriadoCheck - Testes de Feriado Mandatório', () => {

  describe('Categoria 1: Feriados Mandatórios 🎯', () => {
    const device = { deviceName: 'Ar Condicionado', deviceId: 'device-1' };

    test('✅ Em feriado com agenda de feriado → Deve ativar', () => {
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: true,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-12-25'],
        nowLocal: new Date(2025, 11, 25, 10, 0), // 25/12/2025 10:00 (dentro da janela)
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(true);
      expect(result.reason).toBe('holiday');
    });

    test('❌ Em feriado SEM agenda de feriado → NÃO deve ativar', () => {
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: false, // Agenda normal
        daysWeek: { mon: true, tue: true, wed: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-12-25'],
        nowLocal: new Date(2025, 11, 25, 10, 0),
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
      expect(result.reason).toBe('holiday_no_schedule');
    });

    test('❌ Dia normal com agenda de feriado → NÃO deve ativar', () => {
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: true, // Só para feriados
        daysWeek: { mon: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-12-25'], // Hoje não é feriado
        nowLocal: new Date(2025, 6, 15, 10, 0), // 15/06/2025 (terça normal)
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(false);
    });

    test('✅ Dia normal com agenda normal → Deve ativar', () => {
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: false,
        daysWeek: { tue: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 17, 10, 0), // 17/06/2025 terça 10:00
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(true);
    });
  });

  describe('Categoria 2: Comparação de Horários ⏰', () => {
    test('✅ Hora exata de início (retain=false) → Ativa', () => {
      const now = new Date(2025, 5, 15, 8, 0, 0); // 08:00:00
      const start = new Date(2025, 5, 15, 8, 0, 0);
      const end = new Date(2025, 5, 15, 18, 0, 0);

      const [shutdown, activate] = decide(false, now, start, end);
      expect(activate).toBe(true);
      expect(shutdown).toBe(false);
    });

    test('✅ Hora exata de fim (retain=false) → Desativa', () => {
      const now = new Date(2025, 5, 15, 18, 0, 0);
      const start = new Date(2025, 5, 15, 8, 0, 0);
      const end = new Date(2025, 5, 15, 18, 0, 0);

      const [shutdown, activate] = decide(false, now, start, end);
      expect(shutdown).toBe(true);
      expect(activate).toBe(false);
    });

    test('✅ Meia-noite (00:00) → Funciona', () => {
      const baseDate = new Date(2025, 5, 15);
      const midnight = atTimeLocal(baseDate, '00:00');
      expect(midnight.getHours()).toBe(0);
      expect(midnight.getMinutes()).toBe(0);
    });

    test('✅ 23:59 → Funciona', () => {
      const baseDate = new Date(2025, 5, 15);
      const time = atTimeLocal(baseDate, '23:59');
      expect(time.getHours()).toBe(23);
      expect(time.getMinutes()).toBe(59);
    });
  });

  describe('Categoria 3: Atravessar Meia-Noite 🌙', () => {
    test('✅ Domingo 23h até Segunda 04h → Segunda 02h deve ativar', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [{
        startHour: '23:00',
        endHour: '04:00',
        retain: true,
        holiday: false,
        daysWeek: { sun: true, mon: false }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 16, 2, 0), // Segunda 02:00
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(true);
    });

    test('❌ Domingo 23h até Segunda 04h → Terça 02h NÃO deve ativar', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [{
        startHour: '23:00',
        endHour: '04:00',
        retain: true,
        holiday: false,
        daysWeek: { sun: true, mon: false }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 17, 2, 0), // Terça 02:00
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(false);
    });

    test('✅ Edge case: Segunda 00:00 com janela Domingo 23h-04h', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [{
        startHour: '23:00',
        endHour: '04:00',
        retain: true,
        holiday: false,
        daysWeek: { sun: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 16, 0, 0), // Segunda 00:00
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(true);
    });
  });

  describe('Categoria 4: Dias Excluídos 🚫', () => {
    test('✅ Data excluída → SEMPRE desativa (prevalece sobre tudo)', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: false,
        daysWeek: { mon: true, tue: true, wed: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: ['2025-06-17'],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 17, 10, 0), // 17/06 excluído
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
      expect(result.reason).toBe('excluded');
    });

    test('✅ Data excluída prevalece sobre feriado', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: true,
        daysWeek: { mon: true }
      }];

      const result = processDevice({
        device,
        schedules,
        excludedDays: ['2025-12-25'],
        storedHolidaysDays: ['2025-12-25'],
        nowLocal: new Date(2025, 11, 25, 10, 0),
        holidayPolicy: 'exclusive'
      });

      expect(result.reason).toBe('excluded');
      expect(result.shouldShutdown).toBe(true);
    });
  });

  describe('Categoria 5: Modo Retain 🔄', () => {
    test('✅ Retain=true dentro da janela → Mantém ativo', () => {
      const now = new Date(2025, 5, 15, 10, 0);
      const start = new Date(2025, 5, 15, 8, 0);
      const end = new Date(2025, 5, 15, 18, 0);

      const [shutdown, activate] = decide(true, now, start, end);
      expect(activate).toBe(true);
      expect(shutdown).toBe(false);
    });

    test('✅ Retain=true fora da janela → Desativa', () => {
      const now = new Date(2025, 5, 15, 19, 0);
      const start = new Date(2025, 5, 15, 8, 0);
      const end = new Date(2025, 5, 15, 18, 0);

      const [shutdown, activate] = decide(true, now, start, end);
      expect(shutdown).toBe(true);
      expect(activate).toBe(false);
    });

    test('✅ Retain=false → Apenas nos horários exatos', () => {
      const now = new Date(2025, 5, 15, 10, 0); // Meio do dia
      const start = new Date(2025, 5, 15, 8, 0);
      const end = new Date(2025, 5, 15, 18, 0);

      const [shutdown, activate] = decide(false, now, start, end);
      expect(activate).toBe(false);
      expect(shutdown).toBe(false);
    });
  });

  describe('Categoria 6: Múltiplas Agendas (Prioridade)', () => {
    test('✅ Múltiplas agendas → Última prevalece', () => {
      const device = { deviceName: 'Device Test' };
      const schedules = [
        {
          startHour: '08:00',
          endHour: '12:00',
          retain: true,
          holiday: false,
          daysWeek: { tue: true }
        },
        {
          startHour: '11:00',
          endHour: '14:00',
          retain: true,
          holiday: false,
          daysWeek: { tue: true }
        }
      ];

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(2025, 5, 17, 11, 30), // 11:30 - overlap
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(true);
      expect(result.appliedSchedule).toBeDefined();
    });
  });

  describe('Categoria 7: Edge Cases', () => {
    test('❌ Sem agendas → Retorna null', () => {
      const result = processDevice({
        device: null,
        schedules: null,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(),
        holidayPolicy: 'exclusive'
      });

      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(false);
      expect(result.reason).toBe('no_data');
    });

    test('❌ Device não encontrado → Loga warning', () => {
      const result = processDevice({
        device: undefined,
        schedules: [],
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal: new Date(),
        holidayPolicy: 'exclusive'
      });

      expect(result.reason).toBe('no_data');
    });
  });

  describe('func-001-FeriadoCheck - Testes de Funções Utilitárias', () => {
    describe('atTime() - Construção segura de datas', () => {
      test('✅ Cria data correta para horário válido', () => {
        const base = new Date(2025, 5, 15);
        const time = atTimeLocal(base, '14:30');

        expect(time.getFullYear()).toBe(2025);
        expect(time.getMonth()).toBe(5);
        expect(time.getDate()).toBe(15);
        expect(time.getHours()).toBe(14);
        expect(time.getMinutes()).toBe(30);
      });

      test('✅ Não muta data base', () => {
        const base = new Date(2025, 5, 15, 10, 0);
        const originalTime = base.getTime();

        atTimeLocal(base, '14:30');

        expect(base.getTime()).toBe(originalTime);
      });
    });

    describe('startOfDay() - Início do dia', () => {
      test('✅ Retorna 00:00:00.000', () => {
        const date = new Date(2025, 5, 15, 14, 30, 45, 123);
        const result = startOfDayLocal(date);

        expect(result.getHours()).toBe(0);
        expect(result.getMinutes()).toBe(0);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
      });
    });

    describe('subtractWeekDay() - Dia anterior', () => {
      test('✅ Segunda → Domingo', () => {
        expect(subtractWeekDay('mon')).toBe('sun');
      });

      test('✅ Domingo → Sábado (circular)', () => {
        expect(subtractWeekDay('sun')).toBe('sat');
      });
    });

    describe('convertToSaoPaulo() - Conversão de timezone', () => {
      test('✅ Converte UTC para São Paulo (UTC-3)', () => {
        // Simula servidor em UTC às 10:20
        const utcDate = new Date(Date.UTC(2025, 10, 20, 10, 20, 0));
        const spDate = convertToSaoPaulo(new Date(utcDate));

        // Deve resultar em 07:20 (10:20 - 3h)
        expect(spDate.getUTCHours()).toBe(7);
        expect(spDate.getUTCMinutes()).toBe(20);
      });

      test('✅ Conversão preserva a data', () => {
        const utcDate = new Date(Date.UTC(2025, 10, 20, 10, 0, 0));
        const spDate = convertToSaoPaulo(new Date(utcDate));

        expect(spDate.getUTCDate()).toBe(20);
        expect(spDate.getUTCMonth()).toBe(10);
        expect(spDate.getUTCFullYear()).toBe(2025);
      });
    });
  });

  describe('Categoria 8: Casos Reais de Produção 🎯', () => {
    test('✅ review-001.md: Feriado 07:20, antes da janela 07:30-19:40', () => {
      const device = { deviceName: 'Splitão 04', deviceId: 'split-04' };

      // Schedule de feriado com todos daysWeek = false
      const schedules = [{
        startHour: '07:30',
        endHour: '19:40',
        retain: true,
        holiday: true,
        daysWeek: {
          sun: false, mon: false, tue: false, wed: false,
          thu: false, fri: false, sat: false
        }
      }];

      // Simula UTC 10:20 que vira 07:20 em SP
      const utcDate = new Date(Date.UTC(2025, 10, 20, 10, 20, 26));
      const nowLocal = convertToSaoPaulo(new Date(utcDate));

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // 07:20 < 07:30 → fora da janela, ainda não começou
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
      expect(result.reason).toBe('holiday');
    });

    test('✅ real-sample.log: Feriado 10:11, dentro da janela 07:30-19:40', () => {
      const device = { deviceName: 'Splitão 05', deviceId: 'split-05' };

      const schedules = [{
        startHour: '07:30',
        endHour: '19:40',
        retain: true,
        holiday: true,
        daysWeek: {
          sun: false, mon: false, tue: false, wed: false,
          thu: false, fri: false, sat: false
        }
      }];

      // Horário local direto: 20/11/2025 10:11
      const nowLocal = new Date(2025, 10, 20, 10, 11, 36);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // 07:30 < 10:11 < 19:40 → dentro da janela
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
      expect(result.reason).toBe('holiday');
      expect(result.appliedSchedule).toBeDefined();
    });

    test('✅ Holiday schedule ignora daysWeek quando é feriado', () => {
      const device = { deviceName: 'Test Device' };

      // Schedule de feriado para domingo, mas hoje é quinta
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: true,
        daysWeek: { sun: true, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
      }];

      // Quinta-feira 10:00, é feriado
      const nowLocal = new Date(2025, 10, 20, 10, 0); // 20/11/2025 quinta 10:00

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // Mesmo sendo quinta (não domingo), deve ativar porque é feriado
      expect(result.shouldActivate).toBe(true);
      expect(result.isHolidayToday).toBe(true);
    });

    test('✅ Múltiplos schedules filtrados por exclusive policy', () => {
      const device = { deviceName: 'Splitão 04' };

      // 3 schedules: 2 normais + 1 de feriado
      const schedules = [
        {
          startHour: '06:30',
          endHour: '20:40',
          retain: true,
          holiday: false,
          daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
        },
        {
          startHour: '08:30',
          endHour: '16:30',
          retain: true,
          holiday: false,
          daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
        },
        {
          startHour: '07:30',
          endHour: '19:40',
          retain: true,
          holiday: true,
          daysWeek: { sun: false, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
        }
      ];

      const nowLocal = new Date(2025, 10, 20, 10, 0); // Feriado 10:00

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // Deve usar apenas o schedule de feriado
      expect(result.shouldActivate).toBe(true);
      expect(result.totalSchedules).toBe(1); // Filtrou para 1 schedule
      expect(result.appliedSchedule.holiday).toBe(true);
    });

    test('❌ Feriado sem schedule de feriado → desliga tudo', () => {
      const device = { deviceName: 'Test Device' };

      // Apenas schedules normais (holiday: false)
      const schedules = [{
        startHour: '08:00',
        endHour: '18:00',
        retain: true,
        holiday: false,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true }
      }];

      const nowLocal = new Date(2025, 10, 20, 10, 0); // Feriado 10:00

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // Feriado sem agenda de feriado = desliga
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
      expect(result.reason).toBe('holiday_no_schedule');
      expect(result.totalSchedules).toBe(0);
    });
  });

  describe('Categoria 9: Midnight Crossing Avançado 🌙🎯', () => {
    test('✅ Feriado com agenda 22h-06h (midnight crossing)', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-1' };

      // Schedule de feriado que cruza meia-noite
      const schedules = [{
        startHour: '22:00',
        endHour: '06:00',
        retain: true,
        holiday: true,
        daysWeek: {
          sun: false, mon: false, tue: false, wed: false,
          thu: false, fri: false, sat: false
        }
      }];

      // Feriado quinta 02:00 (meio da janela 22h-06h)
      const nowLocal = new Date(2025, 10, 20, 2, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-20'],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // 22:00 < 02:00 < 06:00 (mas cruza meia-noite)
      // Como é feriado e tem schedule de feriado, deve ativar
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
      expect(result.reason).toBe('holiday');
      expect(result.isHolidayToday).toBe(true);
    });

    test('✅ Excluded day sobrepõe midnight crossing', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-2' };

      const schedules = [{
        startHour: '20:00',
        endHour: '08:00',
        retain: true,
        holiday: false,
        daysWeek: { sun: true, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
      }];

      // Segunda 02:00 (dentro da janela domingo 20h até segunda 08h)
      // Mas segunda está excluída
      const nowLocal = new Date(2025, 5, 16, 2, 0); // 16/06/2025 segunda 02:00

      const result = processDevice({
        device,
        schedules,
        excludedDays: ['2025-06-16'],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // Excluded day prevalece sobre midnight crossing
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
      expect(result.reason).toBe('excluded');
    });

    test('✅ Múltiplas agendas midnight crossing com overlap', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-3' };

      // Duas agendas que cruzam meia-noite com overlap
      const schedules = [
        {
          startHour: '22:00',
          endHour: '02:00',
          retain: true,
          holiday: false,
          daysWeek: { sun: true, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
        },
        {
          startHour: '01:00',
          endHour: '05:00',
          retain: true,
          holiday: false,
          daysWeek: { sun: false, mon: true, tue: false, wed: false, thu: false, fri: false, sat: false }
        }
      ];

      // Segunda 01:30 (overlap de ambas as agendas)
      // Agenda 1: domingo 22h-02h (segunda) → dentro
      // Agenda 2: segunda 01h-05h → dentro
      const nowLocal = new Date(2025, 5, 16, 1, 30); // 16/06/2025 segunda 01:30

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // Ambas as agendas dizem ativar → acumula
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
      expect(result.appliedSchedule).toBeDefined();
    });

    test('✅ Midnight crossing fora do horário (antes de começar)', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-4' };

      const schedules = [{
        startHour: '23:00',
        endHour: '06:00',
        retain: true,
        holiday: false,
        daysWeek: { sun: true, mon: false, tue: false, wed: false, thu: false, sat: false }
      }];

      // Segunda 10:00 (fora da janela domingo 23h-06h)
      // Segunda não está habilitada, então não faz nada
      const nowLocal = new Date(2025, 5, 16, 10, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // 10:00 está fora da janela E segunda não está nos daysWeek
      // Comportamento: não ativa, não desliga (dia não habilitado)
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(false);
    });

    test('✅ Midnight crossing edge: exatamente no startTime', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-5' };

      const schedules = [{
        startHour: '22:00',
        endHour: '06:00',
        retain: false, // Modo pulse (só ativa no horário exato)
        holiday: false,
        daysWeek: { mon: true, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false }
      }];

      // Segunda 22:00 (exatamente no startTime)
      const nowLocal = new Date(2025, 5, 16, 22, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // retain=false → só ativa no horário exato
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
    });

    test('✅ Midnight crossing edge: exatamente no endTime', () => {
      const device = { deviceName: 'Test Device', deviceId: 'dev-6' };

      const schedules = [{
        startHour: '22:00',
        endHour: '06:00',
        retain: false, // Modo pulse
        holiday: false,
        daysWeek: { sun: true, mon: false, tue: false, wed: false, thu: false, fri: false, sat: false }
      }];

      // Segunda 06:00 (exatamente no endTime)
      const nowLocal = new Date(2025, 5, 16, 6, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // retain=false → desliga no horário exato
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
    });

    test('🐛 BUG: Sábado 18:14 com schedule 17:45-05:30 (todos dias ativos)', () => {
      const device = { deviceName: 'Totem Publicidade', deviceId: 'totem-1' };

      const schedules = [{
        startHour: '17:45',
        endHour: '05:30',
        retain: true,
        holiday: false,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
      }];

      // Sábado 18:14 (após início 17:45, antes do fim 05:30 de domingo)
      const nowLocal = new Date(2025, 10, 22, 18, 14, 38);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // 17:45 < 18:14 < 05:30 (amanhã) → DENTRO da janela
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
      expect(result.currWeekDay).toBe('sat');
    });

    test('Schedule 17:30-05:30 (todos dias) - múltiplos horários', () => {
      const device = { deviceName: 'Test Device', deviceId: 'test-1' };

      const schedules = [{
        startHour: '17:30',
        endHour: '05:30',
        retain: true,
        holiday: false,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
      }];

      // Caso 1: Antes do início (17:00) → Deve desativar
      let nowLocal = new Date(2025, 10, 22, 17, 0, 0); // Sábado 17:00
      let result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);

      // Caso 2: Exatamente no início (17:30) → Deve ativar
      nowLocal = new Date(2025, 10, 22, 17, 30, 0); // Sábado 17:30
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);

      // Caso 3: Durante período noturno (22:00) → Deve ativar
      nowLocal = new Date(2025, 10, 22, 22, 0, 0); // Sábado 22:00
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);

      // Caso 4: Após meia-noite (02:00) → Deve ativar
      nowLocal = new Date(2025, 10, 23, 2, 0, 0); // Domingo 02:00
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);

      // Caso 5: No horário de fim (05:30) → Deve desativar (endTime não está incluído com retain)
      // Com retain: true, a condição é n >= a && n < b, então 05:30 não está incluído
      nowLocal = new Date(2025, 10, 23, 5, 30, 0); // Domingo 05:30
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);

      // Caso 6: Após o fim (06:00) → Deve desativar
      nowLocal = new Date(2025, 10, 23, 6, 0, 0); // Domingo 06:00
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);

      // Caso 7: Durante manhã/tarde (12:00) → Deve desativar
      nowLocal = new Date(2025, 10, 23, 12, 0, 0); // Domingo 12:00
      result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [],
        nowLocal,
        holidayPolicy: 'exclusive'
      });
      expect(result.shouldActivate).toBe(false);
      expect(result.shouldShutdown).toBe(true);
    });
  });

  // Categoria 10: Bug - Holiday com daysWeek 🐛
  describe('Categoria 10: Bug - Holiday com daysWeek 🐛', () => {
    test('🐛 BUG: Agenda com holiday=true + daysWeek deve funcionar em dias normais', () => {
      const device = { deviceName: 'Test Device', deviceId: 'test-1' };

      // Agenda com holiday=true E daysWeek configurado
      const schedules = [{
        startHour: '17:30',
        endHour: '05:30',
        retain: true,
        holiday: true,  // ← Marcado como holiday
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
      }];

      // Sábado normal (NÃO é feriado) às 18:00
      const nowLocal = new Date(2025, 10, 22, 18, 0, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: [], // ← Lista vazia = não é feriado
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // ✅ ESPERADO: Deveria usar daysWeek e ativar (sábado está marcado)
      // Com o fix aplicado, schedules com holiday=true TAMBÉM funcionam em dias normais
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
    });

    test('✅ Agenda com holiday=true deve funcionar EM FERIADO também', () => {
      const device = { deviceName: 'Test Device', deviceId: 'test-1' };

      const schedules = [{
        startHour: '17:30',
        endHour: '05:30',
        retain: true,
        holiday: true,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
      }];

      // Feriado às 18:00
      const nowLocal = new Date(2025, 10, 22, 18, 0, 0);

      const result = processDevice({
        device,
        schedules,
        excludedDays: [],
        storedHolidaysDays: ['2025-11-22'], // ← É feriado
        nowLocal,
        holidayPolicy: 'exclusive'
      });

      // ✅ Esse caso JÁ funciona corretamente
      expect(result.shouldActivate).toBe(true);
      expect(result.shouldShutdown).toBe(false);
    });
  });
});
