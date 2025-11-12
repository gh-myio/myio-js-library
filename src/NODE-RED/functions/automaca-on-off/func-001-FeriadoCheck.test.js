/**
 * @jest-environment node
 *
 * Testes unitários para func-001-FeriadoCheck.js
 *
 * Framework: Jest
 * Cobertura mínima esperada: 90%
 *
 * @see PLANO-DE-ACAO.md
 * @see review.md
 */

const path = require('path');

// Mock do Node-RED context
const createMockContext = () => {
  const flowData = {};

  return {
    flow: {
      get: (key) => flowData[key],
      set: (key, value) => { flowData[key] = value; }
    },
    node: {
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn()
    },
    currIndex: 0
  };
};

// Helper para criar data específica
const createDate = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

// Helper para configurar contexto de teste
const setupTestContext = (options = {}) => {
  const {
    currentDate = '2025-11-13',
    currentTime = '12:00',
    holidays = [],
    excludedDays = [],
    schedules = [],
    devices = {}
  } = options;

  const ctx = createMockContext();

  // Configurar devices
  ctx.flow.set('devices', {
    'device-1': { deviceName: 'Test Device 1' },
    ...devices
  });

  // Configurar schedules
  ctx.flow.set('stored_schedules', {
    'device-1': schedules
  });

  // Configurar excluded days
  ctx.flow.set('stored_excludedDays', {
    'device-1': excludedDays.length > 0 ? [{ excludedDays }] : []
  });

  // Configurar holidays
  ctx.flow.set('stored_holidays', holidays);

  return ctx;
};

// Mock da data atual global
const mockCurrentDate = (dateStr, timeStr) => {
  const mockDate = createDate(dateStr, timeStr);
  const RealDate = Date;

  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return mockDate;
      }
      return new RealDate(...args);
    }

    static now() {
      return mockDate.getTime();
    }
  };

  return () => {
    global.Date = RealDate;
  };
};

describe('func-001-FeriadoCheck - Testes de Feriado Mandatório', () => {

  describe('Categoria 1: Feriados Mandatórios 🎯', () => {

    test('✅ Em feriado com agenda de feriado → Deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-12-25', '12:00'); // Natal, quinta

      const ctx = setupTestContext({
        currentDate: '2025-12-25',
        currentTime: '12:00',
        holidays: ['2025-12-25T00:00:00.000Z'],
        schedules: [
          {
            holiday: true,
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { thu: true }, // Quinta-feira
            retain: true
          }
        ]
      });

      // TODO: Executar função refatorada aqui
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);
      // expect(result.payload.shouldShutdown).toBe(false);

      restoreDate();
    });

    test('❌ Em feriado SEM agenda de feriado → NÃO deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-12-25', '12:00'); // Natal

      const ctx = setupTestContext({
        holidays: ['2025-12-25T00:00:00.000Z'],
        schedules: [
          {
            holiday: false, // Agenda normal (não de feriado)
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { thu: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função refatorada
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(false);
      // expect(result.payload.shouldShutdown).toBe(true);

      restoreDate();
    });

    test('❌ Dia normal com agenda de feriado → NÃO deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00'); // Quarta normal

      const ctx = setupTestContext({
        holidays: ['2025-12-25T00:00:00.000Z'], // Natal está na lista mas hoje não é
        schedules: [
          {
            holiday: true, // Agenda APENAS para feriados
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função refatorada
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(false);

      restoreDate();
    });

    test('✅ Dia normal com agenda normal → Deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00'); // Quarta normal

      const ctx = setupTestContext({
        holidays: [], // Sem feriados
        schedules: [
          {
            holiday: false, // Agenda normal
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função refatorada
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });
  });

  describe('Categoria 2: Comparação de Horários ⏰', () => {

    test('✅ Hora exata de início (retain=false) → Ativa', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '10:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: false // Pontual
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);
      // expect(result.payload.shouldShutdown).toBe(false);

      restoreDate();
    });

    test('✅ Hora exata de fim (retain=false) → Desativa', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '18:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: false
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(false);
      // expect(result.payload.shouldShutdown).toBe(true);

      restoreDate();
    });

    test('✅ Meia-noite (00:00) → Funciona', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '00:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '00:00',
            endHour: '06:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });

    test('✅ 23:59 → Funciona', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '23:59');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '18:00',
            endHour: '23:59',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });
  });

  describe('Categoria 3: Atravessar Meia-Noite 🌙', () => {

    test('✅ Domingo 23h até Segunda 04h → Segunda 02h deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-11-17', '02:00'); // Segunda 02:00

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '23:00',
            endHour: '04:00',
            daysWeek: {
              sun: true,  // Domingo ativo
              mon: false  // Segunda inativa (mas herda de domingo)
            },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });

    test('❌ Domingo 23h até Segunda 04h → Terça 02h NÃO deve ativar', () => {
      const restoreDate = mockCurrentDate('2025-11-18', '02:00'); // Terça 02:00

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '23:00',
            endHour: '04:00',
            daysWeek: {
              sun: true,
              mon: false,
              tue: false
            },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(false);

      restoreDate();
    });

    test('✅ Edge case: Segunda 00:00 com janela Domingo 23h-04h', () => {
      const restoreDate = mockCurrentDate('2025-11-17', '00:00'); // Segunda 00:00

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '23:00',
            endHour: '04:00',
            daysWeek: { sun: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // Deve ativar pois está dentro da janela iniciada no domingo
      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });
  });

  describe('Categoria 4: Dias Excluídos 🚫', () => {

    test('✅ Data excluída → SEMPRE desativa (prevalece sobre tudo)', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00');

      const ctx = setupTestContext({
        excludedDays: ['2025-11-13T00:00:00.000Z'],
        schedules: [
          {
            holiday: false,
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(false);
      // expect(result.payload.shouldShutdown).toBe(true);

      restoreDate();
    });

    test('✅ Data excluída prevalece sobre feriado', () => {
      const restoreDate = mockCurrentDate('2025-12-25', '12:00'); // Natal

      const ctx = setupTestContext({
        holidays: ['2025-12-25T00:00:00.000Z'],
        excludedDays: ['2025-12-25T00:00:00.000Z'], // Excluído mesmo sendo feriado
        schedules: [
          {
            holiday: true,
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { thu: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // Exclusão prevalece
      // expect(result.payload.shouldActivate).toBe(false);
      // expect(result.payload.shouldShutdown).toBe(true);

      restoreDate();
    });
  });

  describe('Categoria 5: Modo Retain 🔄', () => {

    test('✅ Retain=true dentro da janela → Mantém ativo', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });

    test('✅ Retain=true fora da janela → Desativa', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '20:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result.payload.shouldShutdown).toBe(true);

      restoreDate();
    });

    test('✅ Retain=false → Apenas nos horários exatos', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00'); // Meio da janela

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '10:00',
            endHour: '18:00',
            daysWeek: { wed: true },
            retain: false // Pontual
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // Fora dos horários exatos, não faz nada
      // expect(result.payload.shouldActivate).toBe(false);
      // expect(result.payload.shouldShutdown).toBe(false);

      restoreDate();
    });
  });

  describe('Categoria 6: Múltiplas Agendas (Prioridade)', () => {

    test('✅ Múltiplas agendas → Última prevalece', () => {
      const restoreDate = mockCurrentDate('2025-11-13', '12:00');

      const ctx = setupTestContext({
        schedules: [
          {
            holiday: false,
            startHour: '08:00',
            endHour: '14:00', // Termina antes do horário atual
            daysWeek: { wed: true },
            retain: true
          },
          {
            holiday: false,
            startHour: '10:00',
            endHour: '18:00', // Ainda ativo
            daysWeek: { wed: true },
            retain: true
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // Segunda agenda deve prevalecer
      // expect(result.payload.shouldActivate).toBe(true);

      restoreDate();
    });
  });

  describe('Categoria 7: Edge Cases', () => {

    test('❌ Sem agendas → Retorna null', () => {
      const ctx = setupTestContext({
        schedules: []
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(result).toBeNull();
      // expect(ctx.node.warn).toHaveBeenCalledWith('No schedules, ignoring');
    });

    test('❌ Device não encontrado → Loga warning', () => {
      const ctx = setupTestContext({
        devices: {}, // Sem devices
        schedules: [
          {
            holiday: false,
            startHour: '08:00',
            endHour: '18:00',
            daysWeek: { wed: true }
          }
        ]
      });

      // TODO: Executar função
      // const result = executeScheduleFunction(ctx);

      // expect(ctx.node.warn).toHaveBeenCalled();
    });
  });
});

describe('func-001-FeriadoCheck - Testes de Funções Utilitárias', () => {

  describe('atTime() - Construção segura de datas', () => {
    test('✅ Cria data correta para horário válido', () => {
      // TODO: Testar função atTime refatorada
      // const baseDate = new Date(2025, 10, 13); // 13 nov 2025
      // const result = atTime(baseDate, '14:30');

      // expect(result.getHours()).toBe(14);
      // expect(result.getMinutes()).toBe(30);
      // expect(result.getDate()).toBe(13);
    });

    test('✅ Não muta data base', () => {
      // TODO: Garantir imutabilidade
      // const baseDate = new Date(2025, 10, 13);
      // const original = baseDate.getTime();
      // atTime(baseDate, '14:30');

      // expect(baseDate.getTime()).toBe(original);
    });
  });

  describe('startOfDay() - Início do dia', () => {
    test('✅ Retorna 00:00:00.000', () => {
      // TODO: Testar função startOfDay
      // const date = new Date(2025, 10, 13, 14, 30, 45, 123);
      // const result = startOfDay(date);

      // expect(result.getHours()).toBe(0);
      // expect(result.getMinutes()).toBe(0);
      // expect(result.getSeconds()).toBe(0);
      // expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('subtractWeekDay() - Dia anterior', () => {
    test('✅ Segunda → Domingo', () => {
      // TODO: Testar lógica existente
      // expect(subtractWeekDay('mon')).toBe('sun');
    });

    test('✅ Domingo → Sábado (circular)', () => {
      // expect(subtractWeekDay('sun')).toBe('sat');
    });
  });
});

/**
 * TODO: Implementar após refatoração
 *
 * Próximos passos:
 * 1. Refatorar func-001-FeriadoCheck.js seguindo as diretrizes do review.md
 * 2. Exportar funções principais para serem testáveis
 * 3. Descomentar os expects() neste arquivo de teste
 * 4. Executar: npm test
 * 5. Validar coverage: npm run test:coverage
 * 6. Meta: ≥90% coverage
 */
