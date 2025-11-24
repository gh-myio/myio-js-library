/**
 * Testes para func-003-LogCleanup.js
 * Valida a lógica de retenção de logs (D-3, D-2, D-1, D0)
 */

describe('func-003-LogCleanup - Log Retention Strategy', () => {
  const DAYS_TO_KEEP = 4;

  /**
   * Função auxiliar para criar log key com timestamp
   */
  function createLogKey(deviceName, daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(12, 0, 0, 0); // Meio-dia para evitar edge cases de timezone
    return `automation_log_${deviceName}_${date.getTime()}`;
  }

  /**
   * Função auxiliar para criar log data
   */
  function createLogData(deviceName, daysAgo, action = 'ON') {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(12, 0, 0, 0);

    return {
      device: deviceName,
      action,
      shouldActivate: action === 'ON',
      shouldShutdown: action === 'OFF',
      timestamp: date.toISOString(),
      timestampMs: date.getTime()
    };
  }

  /**
   * Função que simula a lógica do func-003-LogCleanup.js
   */
  function cleanupLogs(storedLogs, daysToKeep = DAYS_TO_KEEP) {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - (daysToKeep - 1));
    cutoffDate.setHours(0, 0, 0, 0);
    const cutoffTimestamp = cutoffDate.getTime();

    const filteredLogs = {};
    let deletedCount = 0;

    for (const [key, logData] of Object.entries(storedLogs)) {
      const timestampMatch = key.match(/_(\d+)$/);

      if (!timestampMatch) {
        const logTimestamp = logData.timestampMs || logData.timestamp;

        if (!logTimestamp) {
          filteredLogs[key] = logData;
          continue;
        }

        const logDate = typeof logTimestamp === 'number'
          ? logTimestamp
          : new Date(logTimestamp).getTime();

        if (logDate >= cutoffTimestamp) {
          filteredLogs[key] = logData;
        } else {
          deletedCount++;
        }
      } else {
        const logTimestamp = parseInt(timestampMatch[1], 10);

        if (logTimestamp >= cutoffTimestamp) {
          filteredLogs[key] = logData;
        } else {
          deletedCount++;
        }
      }
    }

    return {
      filteredLogs,
      deletedCount,
      totalBefore: Object.keys(storedLogs).length,
      totalAfter: Object.keys(filteredLogs).length
    };
  }

  describe('Categoria 1: Retenção de Logs Básica 📅', () => {
    test('✅ Mantém logs de hoje (D0)', () => {
      const storedLogs = {
        [createLogKey('Device1', 0)]: createLogData('Device1', 0, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Mantém logs de ontem (D-1)', () => {
      const storedLogs = {
        [createLogKey('Device1', 1)]: createLogData('Device1', 1, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Mantém logs de 2 dias atrás (D-2)', () => {
      const storedLogs = {
        [createLogKey('Device1', 2)]: createLogData('Device1', 2, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Mantém logs de 3 dias atrás (D-3)', () => {
      const storedLogs = {
        [createLogKey('Device1', 3)]: createLogData('Device1', 3, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });

    test('❌ Remove logs de 4 dias atrás (D-4)', () => {
      const storedLogs = {
        [createLogKey('Device1', 4)]: createLogData('Device1', 4, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(0);
      expect(result.deletedCount).toBe(1);
    });

    test('❌ Remove logs de 7 dias atrás (D-7)', () => {
      const storedLogs = {
        [createLogKey('Device1', 7)]: createLogData('Device1', 7, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(0);
      expect(result.deletedCount).toBe(1);
    });

    test('❌ Remove logs de 30 dias atrás (D-30)', () => {
      const storedLogs = {
        [createLogKey('Device1', 30)]: createLogData('Device1', 30, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(0);
      expect(result.deletedCount).toBe(1);
    });
  });

  describe('Categoria 2: Múltiplos Logs 📊', () => {
    test('✅ Mantém todos os logs dentro da janela de 4 dias', () => {
      const storedLogs = {
        [createLogKey('Device1', 0)]: createLogData('Device1', 0, 'ON'),
        [createLogKey('Device2', 1)]: createLogData('Device2', 1, 'OFF'),
        [createLogKey('Device3', 2)]: createLogData('Device3', 2, 'ON'),
        [createLogKey('Device4', 3)]: createLogData('Device4', 3, 'OFF')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(4);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Remove apenas logs antigos, mantém recentes', () => {
      const storedLogs = {
        [createLogKey('Device1', 0)]: createLogData('Device1', 0, 'ON'),
        [createLogKey('Device2', 1)]: createLogData('Device2', 1, 'OFF'),
        [createLogKey('Device3', 4)]: createLogData('Device3', 4, 'ON'),  // Remove
        [createLogKey('Device4', 7)]: createLogData('Device4', 7, 'OFF'),  // Remove
        [createLogKey('Device5', 2)]: createLogData('Device5', 2, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(3);
      expect(result.deletedCount).toBe(2);
    });

    test('✅ Remove logs muito antigos (mix de idades)', () => {
      const storedLogs = {
        [createLogKey('Device1', 0)]: createLogData('Device1', 0, 'ON'),
        [createLogKey('Device2', 5)]: createLogData('Device2', 5, 'OFF'),  // Remove
        [createLogKey('Device3', 10)]: createLogData('Device3', 10, 'ON'), // Remove
        [createLogKey('Device4', 30)]: createLogData('Device4', 30, 'OFF'), // Remove
        [createLogKey('Device5', 1)]: createLogData('Device5', 1, 'ON')
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(2);
      expect(result.deletedCount).toBe(3);
    });
  });

  describe('Categoria 3: Edge Cases 🔧', () => {
    test('✅ Lida com logs vazios', () => {
      const storedLogs = {};

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(0);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Mantém logs sem timestamp no key (usa timestampMs)', () => {
      const now = new Date();
      const storedLogs = {
        'automation_log_Device1_noTimestamp': {
          device: 'Device1',
          action: 'ON',
          timestampMs: now.getTime()
        }
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });

    test('✅ Remove logs sem timestamp no key (timestampMs antigo)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      const storedLogs = {
        'automation_log_Device1_noTimestamp': {
          device: 'Device1',
          action: 'ON',
          timestampMs: oldDate.getTime()
        }
      };

      const result = cleanupLogs(storedLogs);

      expect(result.totalAfter).toBe(0);
      expect(result.deletedCount).toBe(1);
    });

    test('✅ Mantém logs sem timestamp (fallback seguro)', () => {
      const storedLogs = {
        'automation_log_Device1_malformed': {
          device: 'Device1',
          action: 'ON'
          // Sem timestamp
        }
      };

      const result = cleanupLogs(storedLogs);

      // Deve manter por segurança
      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Categoria 4: Volume de Dados 📈', () => {
    test('✅ Processa 100 logs corretamente', () => {
      const storedLogs = {};

      // 50 logs recentes (D0 a D3)
      for (let i = 0; i < 50; i++) {
        const day = i % 4; // 0, 1, 2, 3
        storedLogs[createLogKey(`Device${i}`, day)] = createLogData(`Device${i}`, day);
      }

      // 50 logs antigos (D4 a D30)
      for (let i = 50; i < 100; i++) {
        const day = 4 + (i % 27); // 4 a 30
        storedLogs[createLogKey(`Device${i}`, day)] = createLogData(`Device${i}`, day);
      }

      const result = cleanupLogs(storedLogs);

      expect(result.totalBefore).toBe(100);
      expect(result.totalAfter).toBe(50);
      expect(result.deletedCount).toBe(50);
    });

    test('✅ Lida com 1000 logs sem problemas de performance', () => {
      const storedLogs = {};

      // 250 logs para cada dia (D0, D1, D2, D3)
      for (let i = 0; i < 1000; i++) {
        const day = i % 4;
        storedLogs[createLogKey(`Device${i}`, day)] = createLogData(`Device${i}`, day);
      }

      const startTime = Date.now();
      const result = cleanupLogs(storedLogs);
      const endTime = Date.now();

      expect(result.totalAfter).toBe(1000);
      expect(result.deletedCount).toBe(0);
      expect(endTime - startTime).toBeLessThan(1000); // < 1 segundo
    });
  });

  describe('Categoria 5: Configuração Customizada ⚙️', () => {
    test('✅ Mantém apenas 2 dias quando configurado', () => {
      const storedLogs = {
        [createLogKey('Device1', 0)]: createLogData('Device1', 0),
        [createLogKey('Device2', 1)]: createLogData('Device2', 1),
        [createLogKey('Device3', 2)]: createLogData('Device3', 2), // Remove
        [createLogKey('Device4', 3)]: createLogData('Device4', 3)  // Remove
      };

      const result = cleanupLogs(storedLogs, 2);

      expect(result.totalAfter).toBe(2);
      expect(result.deletedCount).toBe(2);
    });

    test('✅ Mantém 7 dias quando configurado', () => {
      const storedLogs = {
        [createLogKey('Device1', 6)]: createLogData('Device1', 6),
        [createLogKey('Device2', 7)]: createLogData('Device2', 7), // Remove
        [createLogKey('Device3', 8)]: createLogData('Device3', 8)  // Remove
      };

      const result = cleanupLogs(storedLogs, 7);

      expect(result.totalAfter).toBe(1);
      expect(result.deletedCount).toBe(2);
    });
  });
});
