import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectDeviceType, getAvailableContexts, addDetectionContext } from '../src/utils/deviceType.js';

describe('detectDeviceType', () => {
  describe('normalization and accents', () => {
    it('should handle Portuguese diacritics correctly', () => {
      expect(detectDeviceType('Automático Central')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('AUTOMÁTICO')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('Sistema Automação')).toBe('GLOBAL_AUTOMACAO');
      expect(detectDeviceType('AUTOMAÇÃO Geral')).toBe('GLOBAL_AUTOMACAO');
    });

    it('should handle mall context with accents', () => {
      expect(detectDeviceType('Iluminação Central', 'mall')).toBe('ILUMINACAO');
      expect(detectDeviceType('ILUMINAÇÃO Praça', 'mall')).toBe('ILUMINACAO');
    });

    it('should normalize spaces and case', () => {
      expect(detectDeviceType('  COMPRESSOR   CENTRAL  ')).toBe('COMPRESSOR');
      expect(detectDeviceType('compressor')).toBe('COMPRESSOR');
      expect(detectDeviceType('CoMpReSSoR')).toBe('COMPRESSOR');
    });
  });

  describe('priority and ordering - building context', () => {
    it('should prioritize VENTILADOR over TERMOSTATO when both VENT and TEMP are present', () => {
      expect(detectDeviceType('Sala VENT TEMP')).toBe('VENTILADOR');
      expect(detectDeviceType('VENT Sistema TEMP')).toBe('VENTILADOR');
    });

    it('should prioritize exact TERMOSTATO over generic TEMP', () => {
      expect(detectDeviceType('Termostato TEMP Sala')).toBe('TERMOSTATO');
      expect(detectDeviceType('TERMOSTATO Central')).toBe('TERMOSTATO');
    });

    it('should prioritize COMPRESSOR (highest priority)', () => {
      expect(detectDeviceType('Compressor VENT AC')).toBe('COMPRESSOR');
      expect(detectDeviceType('COMPRESSOR Sistema TEMP')).toBe('COMPRESSOR');
    });

    it('should prioritize SELETOR_AUTO_MANUAL over lower priority items', () => {
      expect(detectDeviceType('Automatico TEMP AC')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('AUTOMÁTICO Sistema HIDR')).toBe('SELETOR_AUTO_MANUAL');
    });
  });

  describe('building context - all device types', () => {
    it('should detect COMPRESSOR', () => {
      expect(detectDeviceType('Compressor 7 Andar')).toBe('COMPRESSOR');
      expect(detectDeviceType('compressor central')).toBe('COMPRESSOR');
      expect(detectDeviceType('COMPRESSOR_01')).toBe('COMPRESSOR');
    });

    it('should detect VENTILADOR', () => {
      expect(detectDeviceType('Ventilador Sala 1')).toBe('VENTILADOR');
      expect(detectDeviceType('VENT_PRINCIPAL')).toBe('VENTILADOR');
      expect(detectDeviceType('VENT-XYZ')).toBe('VENTILADOR');
      expect(detectDeviceType('Sistema VENTIL')).toBe('VENTILADOR');
    });

    it('should detect SELETOR_AUTO_MANUAL', () => {
      expect(detectDeviceType('Modo Automático')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('AUTOMATICO_MANUAL')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('Automático Central')).toBe('SELETOR_AUTO_MANUAL');
    });

    it('should detect ESCADA_ROLANTE', () => {
      expect(detectDeviceType('ESRL 02')).toBe('ESCADA_ROLANTE');
      expect(detectDeviceType('Escada Rolante Piso 1')).toBe('ESCADA_ROLANTE');
      expect(detectDeviceType('ESCADA_PRINCIPAL')).toBe('ESCADA_ROLANTE');
    });

    it('should detect ELEVADOR', () => {
      expect(detectDeviceType('ELEV A')).toBe('ELEVADOR');
      expect(detectDeviceType('Elevador Principal')).toBe('ELEVADOR');
      expect(detectDeviceType('Sistema ELEV')).toBe('ELEVADOR');
    });

    it('should detect MOTOR', () => {
      expect(detectDeviceType('MOTR Bomba')).toBe('MOTOR');
      expect(detectDeviceType('Recalque Norte')).toBe('MOTOR');
      expect(detectDeviceType('Bomba Recalque')).toBe('MOTOR');
      expect(detectDeviceType('RECALQUE_PRINCIPAL')).toBe('MOTOR');
      expect(detectDeviceType('Motor MOTR')).toBe('MOTOR');
    });

    it('should detect TERMOSTATO', () => {
      expect(detectDeviceType('Termostato A')).toBe('TERMOSTATO');
      expect(detectDeviceType('Termostato Ambiente')).toBe('TERMOSTATO');
      expect(detectDeviceType('TERMO_SALA_01')).toBe('TERMOSTATO');
      expect(detectDeviceType('Termo SUL')).toBe('TERMOSTATO');
      expect(detectDeviceType('Temperatura Ambiente')).toBe('TERMOSTATO');
      expect(detectDeviceType('TEMP_SENSOR')).toBe('TERMOSTATO');
      expect(detectDeviceType('Temp Sala')).toBe('TERMOSTATO');
    });

    it('should detect 3F_MEDIDOR', () => {
      expect(detectDeviceType('Medidor 3F 12')).toBe('3F_MEDIDOR');
      expect(detectDeviceType('Medidor 3F Principal')).toBe('3F_MEDIDOR');
      expect(detectDeviceType('3F_ENERGIA')).toBe('3F_MEDIDOR');
    });

    it('should detect HIDROMETRO', () => {
      expect(detectDeviceType('HIDR Loja 10')).toBe('HIDROMETRO');
      expect(detectDeviceType('Hidrômetro Principal')).toBe('HIDROMETRO');
      expect(detectDeviceType('HIDR_ENTRADA')).toBe('HIDROMETRO');
    });

    it('should detect SOLENOIDE', () => {
      expect(detectDeviceType('Abre Solenoide')).toBe('SOLENOIDE');
      expect(detectDeviceType('Válvula Abre Água')).toBe('SOLENOIDE');
      expect(detectDeviceType('ABRE_VALVULA')).toBe('SOLENOIDE');
    });

    it('should detect CONTROLE REMOTO', () => {
      expect(detectDeviceType('AC Remoto')).toBe('CONTROLE REMOTO');
      expect(detectDeviceType('AC Principal')).toBe('CONTROLE REMOTO');
      expect(detectDeviceType('Controle AC')).toBe('CONTROLE REMOTO');
    });

    it('should detect CAIXA_D_AGUA', () => {
      expect(detectDeviceType('SCD 05')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('SCD Principal')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('Sensor SCD')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('Caixa D\'Água – Bloco B')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('CAIXA D\'AGUA Central')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('Caixa D Agua Norte')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('CAIXA_D_AGUA Sistema')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('Caixa Dagua Principal')).toBe('CAIXA_D_AGUA');
    });

    it('should detect GLOBAL_AUTOMACAO', () => {
      expect(detectDeviceType('GW_AUTO Reator')).toBe('GLOBAL_AUTOMACAO');
      expect(detectDeviceType('Sistema Automação')).toBe('GLOBAL_AUTOMACAO');
      expect(detectDeviceType('AUTOMACAO_GERAL')).toBe('GLOBAL_AUTOMACAO');
      expect(detectDeviceType('Automação Central')).toBe('GLOBAL_AUTOMACAO');
    });

    it('should return default for unknown devices', () => {
      expect(detectDeviceType('Unknown Device')).toBe('default');
      expect(detectDeviceType('Random Name')).toBe('default');
      expect(detectDeviceType('')).toBe('default');
      expect(detectDeviceType('   ')).toBe('default');
    });
  });

  describe('mall context', () => {
    it('should detect CHILLER', () => {
      expect(detectDeviceType('Chiller Central 01', 'mall')).toBe('CHILLER');
      expect(detectDeviceType('Chiller Principal', 'mall')).toBe('CHILLER');
      expect(detectDeviceType('CHILLER_01', 'mall')).toBe('CHILLER');
    });

    it('should detect ESCADA_ROLANTE', () => {
      expect(detectDeviceType('ESCADA Leste', 'mall')).toBe('ESCADA_ROLANTE');
      expect(detectDeviceType('Escada Rolante Piso 1', 'mall')).toBe('ESCADA_ROLANTE');
      expect(detectDeviceType('ESCADA_PRINCIPAL', 'mall')).toBe('ESCADA_ROLANTE');
    });

    it('should detect LOJA_SENSOR', () => {
      expect(detectDeviceType('Loja 104H', 'mall')).toBe('LOJA_SENSOR');
      expect(detectDeviceType('Sensor Loja 101', 'mall')).toBe('LOJA_SENSOR');
      expect(detectDeviceType('LOJA_TEMPERATURA', 'mall')).toBe('LOJA_SENSOR');
    });

    it('should detect ILUMINACAO', () => {
      expect(detectDeviceType('Iluminação Praça', 'mall')).toBe('ILUMINACAO');
      expect(detectDeviceType('Sistema Iluminação', 'mall')).toBe('ILUMINACAO');
      expect(detectDeviceType('ILUMINACAO_GERAL', 'mall')).toBe('ILUMINACAO');
    });

    it('should return default for unknown devices in mall context', () => {
      expect(detectDeviceType('Unknown Device', 'mall')).toBe('default');
      expect(detectDeviceType('Compressor', 'mall')).toBe('default');
      expect(detectDeviceType('VENT Sistema', 'mall')).toBe('default');
    });
  });

  describe('context fallback', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should fallback to building context for unknown context', () => {
      const result = detectDeviceType('Compressor Test', 'unknown_context');
      
      expect(result).toBe('COMPRESSOR');
      expect(consoleSpy).toHaveBeenCalledWith('[myio-js-library] Context "unknown_context" not found. Using default fallback.');
    });

    it('should only warn once per unknown context', () => {
      const uniqueContext = 'unique_unknown_context_' + Date.now();
      detectDeviceType('Compressor Test', uniqueContext);
      detectDeviceType('VENT Test', uniqueContext);
      detectDeviceType('AC Test', uniqueContext);
      
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(`[myio-js-library] Context "${uniqueContext}" not found. Using default fallback.`);
    });

    it('should use building context as default when no context specified', () => {
      expect(detectDeviceType('Compressor Test')).toBe('COMPRESSOR');
    });
  });

  describe('error handling', () => {
    it('should throw error for non-string device name', () => {
      expect(() => detectDeviceType(null)).toThrow('Device name must be a string.');
      expect(() => detectDeviceType(undefined)).toThrow('Device name must be a string.');
      expect(() => detectDeviceType(123)).toThrow('Device name must be a string.');
      expect(() => detectDeviceType({})).toThrow('Device name must be a string.');
      expect(() => detectDeviceType([])).toThrow('Device name must be a string.');
    });
  });

  describe('edge cases and robustness', () => {
    it('should handle empty and whitespace strings', () => {
      expect(detectDeviceType('')).toBe('default');
      expect(detectDeviceType('   ')).toBe('default');
      expect(detectDeviceType('\t\n')).toBe('default');
    });

    it('should handle special characters', () => {
      expect(detectDeviceType('Compressor-01_Central')).toBe('COMPRESSOR');
      expect(detectDeviceType('VENT@Sistema#123')).toBe('VENTILADOR');
    });

    it('should be deterministic', () => {
      const testName = 'Compressor VENT TEMP AC';
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(detectDeviceType(testName));
      }
      expect(results.every(result => result === 'COMPRESSOR')).toBe(true);
    });
  });
});

describe('getAvailableContexts', () => {
  it('should return available contexts', () => {
    const contexts = getAvailableContexts();
    expect(contexts).toContain('building');
    expect(contexts).toContain('mall');
    expect(Array.isArray(contexts)).toBe(true);
    expect(contexts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('addDetectionContext', () => {
  // Note: These tests modify global state, so they should be run in isolation
  // In a real application, you might want to provide a way to reset contexts
  
  it('should add custom detection context', () => {
    const customDetect = (name) => {
      const normalized = name.toUpperCase().trim();
      if (normalized.includes('CUSTOM')) return 'CUSTOM_DEVICE';
      return 'default';
    };

    addDetectionContext('custom_test_context', customDetect);
    
    expect(getAvailableContexts()).toContain('custom_test_context');
    expect(detectDeviceType('Custom Device', 'custom_test_context')).toBe('CUSTOM_DEVICE');
    expect(detectDeviceType('Other Device', 'custom_test_context')).toBe('default');
  });

  it('should throw error for invalid context name', () => {
    expect(() => addDetectionContext(null, () => {})).toThrow('Context name must be a string.');
    expect(() => addDetectionContext(123, () => {})).toThrow('Context name must be a string.');
    expect(() => addDetectionContext(undefined, () => {})).toThrow('Context name must be a string.');
  });

  it('should throw error for invalid detection function', () => {
    expect(() => addDetectionContext('test_context', null)).toThrow('Detection function must be a function.');
    expect(() => addDetectionContext('test_context', 'not a function')).toThrow('Detection function must be a function.');
    expect(() => addDetectionContext('test_context', 123)).toThrow('Detection function must be a function.');
  });

  it('should work with accent normalization in custom contexts', () => {
    const accentTestDetect = (name) => {
      // Simple normalization for testing
      const normalized = name.toUpperCase()
        .replace(/[ÀÁÂÃÄÅ]/g, 'A')
        .replace(/[ÈÉÊË]/g, 'E')
        .replace(/[ÌÍÎÏ]/g, 'I')
        .replace(/[ÒÓÔÕÖ]/g, 'O')
        .replace(/[ÙÚÛÜ]/g, 'U')
        .replace(/[Ç]/g, 'C')
        .replace(/[Ñ]/g, 'N');
      
      if (normalized.includes('ESPECIAL')) return 'ESPECIAL_DEVICE';
      return 'default';
    };

    addDetectionContext('accent_test_context', accentTestDetect);
    
    expect(detectDeviceType('Especial Device', 'accent_test_context')).toBe('ESPECIAL_DEVICE');
    expect(detectDeviceType('Especiál Device', 'accent_test_context')).toBe('ESPECIAL_DEVICE');
  });
});

describe('table-driven tests for comprehensive coverage', () => {
  const testCases = [
    // Building context priority tests
    { name: 'Compressor VENT TEMP', context: 'building', expected: 'COMPRESSOR' },
    { name: 'VENT Sistema TEMP', context: 'building', expected: 'VENTILADOR' },
    { name: 'Automático TEMP', context: 'building', expected: 'SELETOR_AUTO_MANUAL' },
    { name: 'ESRL Sistema', context: 'building', expected: 'ESCADA_ROLANTE' },
    { name: 'ELEV Principal', context: 'building', expected: 'ELEVADOR' },
    { name: 'MOTR Bomba', context: 'building', expected: 'MOTOR' },
    { name: 'Termostato Central', context: 'building', expected: 'TERMOSTATO' },
    { name: 'Medidor 3F', context: 'building', expected: '3F_MEDIDOR' },
    { name: 'HIDR Sistema', context: 'building', expected: 'HIDROMETRO' },
    { name: 'Válvula ABRE', context: 'building', expected: 'SOLENOIDE' },
    { name: 'Sistema AC', context: 'building', expected: 'CONTROLE REMOTO' },
    { name: 'SCD Principal', context: 'building', expected: 'CAIXA_D_AGUA' },
    { name: 'GW_AUTO Sistema', context: 'building', expected: 'GLOBAL_AUTOMACAO' },
    
    // Mall context tests
    { name: 'Chiller Central', context: 'mall', expected: 'CHILLER' },
    { name: 'ESCADA Leste', context: 'mall', expected: 'ESCADA_ROLANTE' },
    { name: 'Loja 104', context: 'mall', expected: 'LOJA_SENSOR' },
    { name: 'Iluminação Praça', context: 'mall', expected: 'ILUMINACAO' },
    
    // Accent tests
    { name: 'Automático', context: 'building', expected: 'SELETOR_AUTO_MANUAL' },
    { name: 'Automação', context: 'building', expected: 'GLOBAL_AUTOMACAO' },
    { name: 'Iluminação', context: 'mall', expected: 'ILUMINACAO' },
    
    // CAIXA_D_AGUA variants
    { name: 'Caixa D\'Água', context: 'building', expected: 'CAIXA_D_AGUA' },
    { name: 'CAIXA D AGUA', context: 'building', expected: 'CAIXA_D_AGUA' },
    { name: 'Caixa_D_Agua', context: 'building', expected: 'CAIXA_D_AGUA' },
    { name: 'CAIXA DAGUA', context: 'building', expected: 'CAIXA_D_AGUA' },
    
    // Default cases
    { name: 'Unknown Device', context: 'building', expected: 'default' },
    { name: 'Random Name', context: 'mall', expected: 'default' }
  ];

  testCases.forEach(({ name, context, expected }) => {
    it(`should detect "${name}" in ${context} context as ${expected}`, () => {
      expect(detectDeviceType(name, context)).toBe(expected);
    });
  });
});
