import { describe, it, expect, vi } from 'vitest';
import { detectDeviceType, getAvailableContexts, addDetectionContext } from '../src/utils/deviceType.js';

describe('detectDeviceType', () => {
  describe('building context (default)', () => {
    it('should detect COMPRESSOR', () => {
      expect(detectDeviceType('Compressor 7 Andar')).toBe('COMPRESSOR');
      expect(detectDeviceType('compressor central')).toBe('COMPRESSOR');
      expect(detectDeviceType('COMPRESSOR_01')).toBe('COMPRESSOR');
    });

    it('should detect VENTILADOR', () => {
      expect(detectDeviceType('Ventilador Sala 1')).toBe('VENTILADOR');
      expect(detectDeviceType('VENT_PRINCIPAL')).toBe('VENTILADOR');
    });

    it('should detect TERMOSTATO', () => {
      expect(detectDeviceType('Termostato Ambiente')).toBe('TERMOSTATO');
      expect(detectDeviceType('TERMO_SALA_01')).toBe('TERMOSTATO');
      expect(detectDeviceType('Temperatura Ambiente')).toBe('TERMOSTATO');
      expect(detectDeviceType('TEMP_SENSOR')).toBe('TERMOSTATO');
    });

    it('should detect SELETOR_AUTO_MANUAL', () => {
      expect(detectDeviceType('Modo Automático')).toBe('SELETOR_AUTO_MANUAL');
      expect(detectDeviceType('AUTOMATICO_MANUAL')).toBe('SELETOR_AUTO_MANUAL');
    });

    it('should detect 3F_MEDIDOR', () => {
      expect(detectDeviceType('Medidor 3F Principal')).toBe('3F_MEDIDOR');
      expect(detectDeviceType('3F_ENERGIA')).toBe('3F_MEDIDOR');
    });

    it('should detect HIDROMETRO', () => {
      expect(detectDeviceType('Hidrômetro Principal')).toBe('HIDROMETRO');
      expect(detectDeviceType('HIDR_ENTRADA')).toBe('HIDROMETRO');
    });

    it('should detect SOLENOIDE', () => {
      expect(detectDeviceType('Válvula Abre Água')).toBe('SOLENOIDE');
      expect(detectDeviceType('ABRE_VALVULA')).toBe('SOLENOIDE');
    });

    it('should detect CONTROLE REMOTO', () => {
      expect(detectDeviceType('AC Principal')).toBe('CONTROLE REMOTO');
      expect(detectDeviceType('Controle AC')).toBe('CONTROLE REMOTO');
    });

    it('should detect CAIXA_D_AGUA', () => {
      expect(detectDeviceType('SCD Principal')).toBe('CAIXA_D_AGUA');
      expect(detectDeviceType('Sensor SCD')).toBe('CAIXA_D_AGUA');
    });

    it('should detect MOTOR', () => {
      expect(detectDeviceType('Bomba Recalque')).toBe('MOTOR');
      expect(detectDeviceType('RECALQUE_PRINCIPAL')).toBe('MOTOR');
    });

    it('should detect GLOBAL_AUTOMACAO', () => {
      expect(detectDeviceType('Sistema Automação')).toBe('GLOBAL_AUTOMACAO');
      expect(detectDeviceType('AUTOMACAO_GERAL')).toBe('GLOBAL_AUTOMACAO');
    });

    it('should return default for unknown devices', () => {
      expect(detectDeviceType('Unknown Device')).toBe('default');
      expect(detectDeviceType('Random Name')).toBe('default');
      expect(detectDeviceType('')).toBe('default');
    });
  });

  describe('mall context', () => {
    it('should detect CHILLER', () => {
      expect(detectDeviceType('Chiller Principal', 'mall')).toBe('CHILLER');
      expect(detectDeviceType('CHILLER_01', 'mall')).toBe('CHILLER');
    });

    it('should detect ESCADA_ROLANTE', () => {
      expect(detectDeviceType('Escada Rolante Piso 1', 'mall')).toBe('ESCADA_ROLANTE');
      expect(detectDeviceType('ESCADA_PRINCIPAL', 'mall')).toBe('ESCADA_ROLANTE');
    });

    it('should detect LOJA_SENSOR', () => {
      expect(detectDeviceType('Sensor Loja 101', 'mall')).toBe('LOJA_SENSOR');
      expect(detectDeviceType('LOJA_TEMPERATURA', 'mall')).toBe('LOJA_SENSOR');
    });

    it('should detect ILUMINACAO', () => {
      expect(detectDeviceType('Sistema Iluminação', 'mall')).toBe('ILUMINACAO');
      expect(detectDeviceType('ILUMINACAO_GERAL', 'mall')).toBe('ILUMINACAO');
    });

    it('should return default for unknown devices in mall context', () => {
      expect(detectDeviceType('Unknown Device', 'mall')).toBe('default');
      expect(detectDeviceType('Compressor', 'mall')).toBe('default');
    });
  });

  describe('context fallback', () => {
    it('should fallback to building context for unknown context', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = detectDeviceType('Compressor Test', 'unknown_context');
      
      expect(result).toBe('COMPRESSOR');
      expect(consoleSpy).toHaveBeenCalledWith('[myio-js-library] Context "unknown_context" not found. Using default fallback.');
      
      consoleSpy.mockRestore();
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
    });
  });

  describe('case insensitivity', () => {
    it('should be case insensitive', () => {
      expect(detectDeviceType('compressor')).toBe('COMPRESSOR');
      expect(detectDeviceType('COMPRESSOR')).toBe('COMPRESSOR');
      expect(detectDeviceType('Compressor')).toBe('COMPRESSOR');
      expect(detectDeviceType('CoMpReSSoR')).toBe('COMPRESSOR');
    });
  });
});

describe('getAvailableContexts', () => {
  it('should return available contexts', () => {
    const contexts = getAvailableContexts();
    expect(contexts).toContain('building');
    expect(contexts).toContain('mall');
    expect(Array.isArray(contexts)).toBe(true);
  });
});

describe('addDetectionContext', () => {
  it('should add custom detection context', () => {
    const customDetect = (name) => {
      if (name.toUpperCase().includes('CUSTOM')) return 'CUSTOM_DEVICE';
      return 'default';
    };

    addDetectionContext('custom', customDetect);
    
    expect(getAvailableContexts()).toContain('custom');
    expect(detectDeviceType('Custom Device', 'custom')).toBe('CUSTOM_DEVICE');
    expect(detectDeviceType('Other Device', 'custom')).toBe('default');
  });

  it('should throw error for invalid context name', () => {
    expect(() => addDetectionContext(null, () => {})).toThrow('Context name must be a string.');
    expect(() => addDetectionContext(123, () => {})).toThrow('Context name must be a string.');
  });

  it('should throw error for invalid detection function', () => {
    expect(() => addDetectionContext('test', null)).toThrow('Detection function must be a function.');
    expect(() => addDetectionContext('test', 'not a function')).toThrow('Detection function must be a function.');
  });

  it('should override existing context', () => {
    const newBuildingDetect = (name) => {
      if (name.toUpperCase().includes('TEST')) return 'TEST_DEVICE';
      return 'default';
    };

    addDetectionContext('building', newBuildingDetect);
    
    expect(detectDeviceType('Test Device', 'building')).toBe('TEST_DEVICE');
    expect(detectDeviceType('Compressor', 'building')).toBe('default');
  });
});
