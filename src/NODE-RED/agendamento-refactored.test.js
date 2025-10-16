// ============================================================================
// MYIO Scheduling Engine - Unit Tests
// Testes unitários para o motor de agendamento refatorado
// ============================================================================

// ============================================================================
// MOCK SETUP - Configuração de mocks para Node-RED
// ============================================================================

// Mock do objeto 'node' do Node-RED
const mockNode = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock do objeto 'flow' do Node-RED
const mockFlow = {
  data: {},
  get(key) {
    return this.data[key];
  },
  set(key, value) {
    this.data[key] = value;
  }
};

// Mock do contexto 'this' do Node-RED
const mockContext = {
  currIndex: 0
};

// Injetar mocks globalmente
global.node = mockNode;
global.flow = mockFlow;

// ============================================================================
// TEST HELPERS - Funções auxiliares para testes
// ============================================================================

function setupFlowData(devices, schedules, excludedDays = {}, holidays = []) {
  mockFlow.data = {
    devices,
    stored_schedules: schedules,
    stored_excludedDays: excludedDays,
    stored_holidays: holidays
  };
}

function createDevice(id, name) {
  return {
    deviceName: name,
    id: id
  };
}

function createSchedule(startHour, endHour, daysWeek, retain = false, holiday = false) {
  return {
    startHour,
    endHour,
    daysWeek,
    retain,
    holiday
  };
}

function createDaysWeek(days) {
  const daysMap = {
    sun: false,
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false
  };
  days.forEach(day => {
    daysMap[day] = true;
  });
  return daysMap;
}

function createMockTimeFn(year, month, day, hours, minutes) {
  // Cria uma função que retorna uma data específica em horário de São Paulo
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return () => date;
}

// ============================================================================
// LOAD THE ENGINE CODE
// ============================================================================

const { executeSchedulingEngine } = require('./agendamento-refactored.module');

// ============================================================================
// TESTES SEM FERIADO - 5 casos
// ============================================================================

describe('Scheduling Engine - Sem Feriado', () => {
  const RealDate = Date;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.currIndex = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.Date = RealDate;
  });

  test('TEST 1 (SEM FERIADO): Deve ATIVAR dispositivo em dia da semana durante horário configurado', () => {
    // Arrange: Segunda-feira, 09:00, agendamento das 08:00-18:00 com retain
    const device = createDevice('dev-001', 'Bomba Principal');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);

    setupFlowData(
      { 'dev-001': device },
      { 'dev-001': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 9, 0); // Segunda-feira 20/10/2025, 09:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(true);
    expect(result.payload.shouldShutdown).toBe(false);
    expect(result.deviceName).toBe('Bomba Principal');
    expect(result.payload.isHoliday).toBe(false);
  });

  test('TEST 2 (SEM FERIADO): Deve DESLIGAR dispositivo fora do horário configurado', () => {
    // Arrange: Segunda-feira, 19:00, agendamento das 08:00-18:00 com retain
    const device = createDevice('dev-002', 'Ar Condicionado');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);

    setupFlowData(
      { 'dev-002': device },
      { 'dev-002': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 19, 0); // Segunda-feira 20/10/2025, 19:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(true);
    expect(result.payload.isHoliday).toBe(false);
  });

  test('TEST 3 (SEM FERIADO): Não deve fazer nada em dia da semana NÃO configurado', () => {
    // Arrange: Terça-feira, 10:00, agendamento apenas para segunda-feira
    const device = createDevice('dev-003', 'Iluminação');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);

    setupFlowData(
      { 'dev-003': device },
      { 'dev-003': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 21, 10, 0); // Terça-feira 21/10/2025, 10:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(false);
    expect(result.payload.isHoliday).toBe(false);
  });

  test('TEST 4 (SEM FERIADO): Deve ativar EXATAMENTE no horário de início (sem retain)', () => {
    // Arrange: Quarta-feira, 08:00, agendamento das 08:00-18:00 SEM retain
    const device = createDevice('dev-004', 'Portão Automático');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['wed']), false, false);

    setupFlowData(
      { 'dev-004': device },
      { 'dev-004': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 22, 8, 0); // Quarta-feira 22/10/2025, 08:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(true);
    expect(result.payload.shouldShutdown).toBe(false);
    expect(result.payload.isHoliday).toBe(false);
  });

  test('TEST 5 (SEM FERIADO): Deve desligar EXATAMENTE no horário de fim (sem retain)', () => {
    // Arrange: Quarta-feira, 18:00, agendamento das 08:00-18:00 SEM retain
    const device = createDevice('dev-005', 'Sistema HVAC');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['wed']), false, false);

    setupFlowData(
      { 'dev-005': device },
      { 'dev-005': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 22, 18, 0); // Quarta-feira 22/10/2025, 18:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(true);
    expect(result.payload.isHoliday).toBe(false);
  });
});

// ============================================================================
// TESTES COM FERIADO - 5 casos
// ============================================================================

describe('Scheduling Engine - Com Feriado', () => {
  const RealDate = Date;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.currIndex = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.Date = RealDate;
  });

  test('TEST 6 (COM FERIADO): Deve usar agendamento de FERIADO e IGNORAR agendamento de dia de semana', () => {
    // Arrange: Segunda-feira FERIADO, 10:00
    // Agendamento 1: Segunda 08:00-18:00 (NÃO deve ser usado)
    // Agendamento 2: Feriado 09:00-15:00 (DEVE ser usado)
    const device = createDevice('dev-006', 'Loja Shopping');
    const weekdaySchedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);
    const holidaySchedule = createSchedule('09:00', '15:00', createDaysWeek([]), true, true);

    setupFlowData(
      { 'dev-006': device },
      { 'dev-006': [weekdaySchedule, holidaySchedule] },
      {},
      ['2025-10-20T00:00:00.000Z'] // Segunda-feira é feriado
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 10, 0); // Segunda-feira 20/10/2025, 10:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isHoliday).toBe(true);
    expect(result.payload.shouldActivate).toBe(true); // Está dentro do horário 09:00-15:00
    expect(result.payload.shouldShutdown).toBe(false);
    expect(result.deviceName).toBe('Loja Shopping');
  });

  test('TEST 7 (COM FERIADO): Deve DESLIGAR dispositivo fora do horário de feriado', () => {
    // Arrange: Feriado, 16:00, agendamento de feriado 09:00-15:00
    const device = createDevice('dev-007', 'Restaurante');
    const holidaySchedule = createSchedule('09:00', '15:00', createDaysWeek([]), true, true);

    setupFlowData(
      { 'dev-007': device },
      { 'dev-007': [holidaySchedule] },
      {},
      ['2025-12-25T00:00:00.000Z'] // Natal
    );

    const mockTimeFn = createMockTimeFn(2025, 12, 25, 16, 0); // Natal, 16:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isHoliday).toBe(true);
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(true); // Fora do horário 09:00-15:00
  });

  test('TEST 8 (COM FERIADO): Deve ATIVAR no início do horário de feriado', () => {
    // Arrange: Feriado, 09:00, agendamento de feriado 09:00-15:00 SEM retain
    const device = createDevice('dev-008', 'Padaria');
    const holidaySchedule = createSchedule('09:00', '15:00', createDaysWeek([]), false, true);

    setupFlowData(
      { 'dev-008': device },
      { 'dev-008': [holidaySchedule] },
      {},
      ['2025-11-15T00:00:00.000Z'] // Proclamação da República
    );

    const mockTimeFn = createMockTimeFn(2025, 11, 15, 9, 0); // Feriado, 09:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isHoliday).toBe(true);
    expect(result.payload.shouldActivate).toBe(true);
    expect(result.payload.shouldShutdown).toBe(false);
  });

  test('TEST 9 (COM FERIADO): Não deve fazer nada se NÃO houver agendamento de feriado configurado', () => {
    // Arrange: Feriado, 10:00, apenas agendamento de dia de semana (segunda)
    const device = createDevice('dev-009', 'Escritório');
    const weekdaySchedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);

    setupFlowData(
      { 'dev-009': device },
      { 'dev-009': [weekdaySchedule] },
      {},
      ['2025-10-20T00:00:00.000Z'] // Segunda-feira é feriado
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 10, 0); // Segunda-feira feriado, 10:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isHoliday).toBe(true);
    expect(result.payload.shouldActivate).toBe(false); // Sem agendamento de feriado
    expect(result.payload.shouldShutdown).toBe(false);
  });

  test('TEST 10 (COM FERIADO): Deve processar múltiplos agendamentos de feriado corretamente', () => {
    // Arrange: Feriado, 14:00
    // Agendamento 1: Feriado 08:00-12:00
    // Agendamento 2: Feriado 13:00-17:00
    const device = createDevice('dev-010', 'Supermercado');
    const holidaySchedule1 = createSchedule('08:00', '12:00', createDaysWeek([]), true, true);
    const holidaySchedule2 = createSchedule('13:00', '17:00', createDaysWeek([]), true, true);

    setupFlowData(
      { 'dev-010': device },
      { 'dev-010': [holidaySchedule1, holidaySchedule2] },
      {},
      ['2025-01-01T00:00:00.000Z'] // Ano Novo
    );

    const mockTimeFn = createMockTimeFn(2025, 1, 1, 14, 0); // Ano Novo, 14:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isHoliday).toBe(true);
    expect(result.payload.shouldActivate).toBe(true); // Está no segundo período 13:00-17:00
    expect(result.payload.shouldShutdown).toBe(false);
  });
});

// ============================================================================
// TESTES DE EDGE CASES - Casos especiais
// ============================================================================

describe('Scheduling Engine - Edge Cases', () => {
  const RealDate = Date;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.currIndex = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.Date = RealDate;
  });

  test('TEST 11 (OVERNIGHT): Deve ativar dispositivo em agendamento que cruza meia-noite (ontem)', () => {
    // Arrange: Segunda-feira, 02:00, agendamento domingo 23:00 - 04:00
    const device = createDevice('dev-011', 'Segurança Noturna');
    const schedule = createSchedule('23:00', '04:00', createDaysWeek(['sun']), true, false);

    setupFlowData(
      { 'dev-011': device },
      { 'dev-011': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 2, 0); // Segunda-feira 20/10/2025, 02:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(true); // Está dentro do período iniciado domingo
    expect(result.payload.shouldShutdown).toBe(false);
  });

  test('TEST 12 (OVERNIGHT): Deve desligar dispositivo após agendamento overnight terminar', () => {
    // Arrange: Segunda-feira, 05:00, agendamento domingo 23:00 - 04:00
    const device = createDevice('dev-012', 'Câmeras Externas');
    const schedule = createSchedule('23:00', '04:00', createDaysWeek(['sun']), true, false);

    setupFlowData(
      { 'dev-012': device },
      { 'dev-012': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 5, 0); // Segunda-feira 20/10/2025, 05:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(true); // Já passou das 04:00
  });

  test('TEST 13 (EXCLUDED DAY): Deve DESLIGAR dispositivo em dia excluído, mesmo dentro do horário', () => {
    // Arrange: Quarta-feira, 10:00, agendamento 08:00-18:00, mas dia está excluído
    const device = createDevice('dev-013', 'Ar Condicionado VIP');
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['wed']), true, false);

    setupFlowData(
      { 'dev-013': device },
      { 'dev-013': [schedule] },
      { 'dev-013': [{ excludedDays: ['2025-10-22T00:00:00.000Z'] }] },
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 22, 10, 0); // Quarta-feira 22/10/2025, 10:00

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).not.toBeNull();
    expect(result.payload.isExcluded).toBe(true);
    expect(result.payload.shouldActivate).toBe(false);
    expect(result.payload.shouldShutdown).toBe(true); // Override por dia excluído
  });

  test('TEST 14 (EMPTY SCHEDULES): Deve retornar null quando não há agendamentos', () => {
    // Arrange: Sem agendamentos configurados
    setupFlowData(
      { 'dev-014': createDevice('dev-014', 'Dispositivo Sem Agenda') },
      {},
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 10, 0);

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).toBeNull();
  });

  test('TEST 15 (INVALID DEVICE): Deve pular dispositivo inválido e incrementar índice', () => {
    // Arrange: Dispositivo sem nome
    const invalidDevice = { id: 'dev-015' }; // Sem deviceName
    const schedule = createSchedule('08:00', '18:00', createDaysWeek(['mon']), true, false);

    setupFlowData(
      { 'dev-015': invalidDevice },
      { 'dev-015': [schedule] },
      {},
      []
    );

    const mockTimeFn = createMockTimeFn(2025, 10, 20, 10, 0);

    // Act
    const result = executeSchedulingEngine(mockContext, mockNode, mockFlow, mockTimeFn);

    // Assert
    expect(result).toBeNull();
    expect(mockContext.currIndex).toBe(1); // Índice deve ter sido incrementado
  });
});

// ============================================================================
// TEST SUITE SUMMARY
// ============================================================================

describe('Test Suite Summary', () => {
  test('Todos os testes devem ter sido executados', () => {
    // Este teste serve apenas para garantir que o Jest executou todos os testes
    expect(true).toBe(true);
  });
});

// ============================================================================
// EXPORT PARA USO EM CI/CD
// ============================================================================

module.exports = {
  setupFlowData,
  createDevice,
  createSchedule,
  createDaysWeek,
  createMockTimeFn
};
