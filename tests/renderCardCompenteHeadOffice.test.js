// tests/renderCardCompenteHeadOffice.test.js

/* eslint-env browser */
/* eslint-disable */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderCardCompenteHeadOffice } from '../src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.js';

// Mock DOM environment
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;

// Mock da função de modal, pois ela interage com o DOM global
const showInfoModal = vi.fn();
global.window.showInfoModal = showInfoModal;

describe('renderCardCompenteHeadOffice', () => {
  let container;
  let mockEntityObject;

  beforeEach(() => {
    // Cria um container novo para cada teste
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock do objeto de entidade, agora incluindo valores de consumo
    mockEntityObject = {
      entityId: 'TEST-001',
      labelOrName: 'Test Device',
      deviceIdentifier: 'TEST-001',
      deviceType: 'ELEVADOR',
      val: 25.0,
      valType: 'power_kw',
      connectionStatus: 'RUNNING',
      temperatureC: 26,
      operationHours: '12h 30m', // Exemplo de como pode vir do backend
      timaVal: Date.now() - 60000 * 5, // 5 minutos atrás
      consumptionTargetValue: 100.0,
      consumptionToleranceValue: 110.0,
      consumptionExcessValue: 120.0
    };
  });

  afterEach(() => {
    // Limpa o DOM e os mocks
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar um card com o objeto de entidade mínimo', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      expect(container.children.length).toBe(1);
      expect(container.querySelector('.myio-ho-card')).toBeTruthy();
      expect(card).toHaveProperty('update');
      expect(card).toHaveProperty('destroy');
      expect(card).toHaveProperty('getRoot');
    });

    it('deve lançar um erro se o container for nulo', () => {
      expect(() => {
        renderCardCompenteHeadOffice(null, { entityObject: mockEntityObject });
      }).toThrow('renderCardCompenteHeadOffice: containerEl is required');
    });

    it('deve lançar um erro se entityObject estiver faltando', () => {
      expect(() => {
        renderCardCompenteHeadOffice(container, {});
      }).toThrow('renderCardCompenteHeadOffice: entityObject is required');
    });

    it('deve gerar um ID temporário se entityId estiver faltando', () => {
      const entityWithoutId = { ...mockEntityObject };
      delete entityWithoutId.entityId;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: entityWithoutId
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('entityId is missing')
      );
      expect(card.getRoot().getAttribute('data-entity-id')).toMatch(/^temp-/);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Estrutura do DOM', () => {
    it('deve criar a estrutura correta do DOM', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const card = container.querySelector('.myio-ho-card');
      expect(card).toBeTruthy();
      expect(card.getAttribute('data-entity-id')).toBe('TEST-001');

      // Checa as seções principais
      expect(card.querySelector('.myio-ho-card__header')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__status')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__primary')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__eff')).toBeTruthy();
      expect(card.querySelector('.myio-ho-card__footer')).toBeTruthy();
    });

    it('deve exibir o nome e o identificador do dispositivo', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const nameEl = container.querySelector('.myio-ho-card__name');
      const codeEl = container.querySelector('.myio-ho-card__code');

      expect(nameEl.textContent).toBe('Test Device');
      expect(codeEl.textContent).toBe('TEST-001');
    });
  });
  
  describe('Exibição de Status', () => {
    it('deve exibir o chip de status correto para RUNNING', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'RUNNING' }
      });

      const chip = container.querySelector('.chip');
      expect(chip.classList.contains('chip--ok')).toBe(true);
      expect(chip.textContent).toBe('Em operação');
    });

    it('deve exibir o chip de status correto para ALERT e adicionar classe ao card', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, connectionStatus: 'ALERT' }
      });

      const chip = container.querySelector('.chip');
      const card = container.querySelector('.myio-ho-card');
      
      expect(chip.classList.contains('chip--alert')).toBe(true);
      expect(chip.textContent).toBe('Alerta');
      expect(card.classList.contains('is-alert')).toBe(true);
    });
  });

  describe('Formatação de Valores', () => {
    it('deve formatar valores de potência corretamente', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, val: 25.567, valType: 'power_kw' }
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const unitSpan = container.querySelector('.myio-ho-card__value .unit');

      expect(numSpan.textContent).toBe('25.6');
      expect(unitSpan.textContent).toBe('kW');
    });
    
    it('deve formatar temperatura corretamente', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, temperatureC: 26.7 }
      });

      const tempVal = container.querySelector('.myio-ho-card__footer .metric:nth-child(1) .val');
      expect(tempVal.textContent).toBe('27°C');
    });

    it('deve exibir as horas de operação como vêm do objeto', () => {
      // Nota: O código fonte não usa a função `formatOperationHours`. Ele exibe o valor bruto.
      // O teste reflete o comportamento real do código.
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, operationHours: '1.250h' }
      });

      const opTimeVal = container.querySelector('.myio-ho-card__footer .metric:nth-child(2) .val');
      expect(opTimeVal.textContent).toBe('1.250h');
    });

    it('deve formatar o tempo relativo corretamente', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: { ...mockEntityObject, timaVal: Date.now() - 1000 * 60 * 3 } // 3 minutos atrás
      });

      const updatedVal = container.querySelector('.myio-ho-card__footer .metric:nth-child(3) .val');
      expect(updatedVal.textContent).toBe('3m');
    });
  });

  describe('Exibição da Barra de Consumo', () => {
    it('deve exibir e calcular a barra de consumo quando `consumptionTargetValue` existe', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: {
          ...mockEntityObject,
          val: 25,
          consumptionTargetValue: 100,
        }
      });
      
      const barContainer = container.querySelector('.bar');
      const percSpan = container.querySelector('.myio-ho-card__eff .perc');
      const barFill = container.querySelector('.bar__fill');

      expect(barContainer.style.display).not.toBe('none');
      expect(percSpan.textContent).toBe('25%');
      expect(barFill.style.width).toBe('25%');
      expect(barContainer.getAttribute('aria-valuenow')).toBe('25');
    });

    it('deve esconder a barra de consumo quando `consumptionTargetValue` é nulo ou zero', () => {
      renderCardCompenteHeadOffice(container, {
        entityObject: {
          ...mockEntityObject,
          consumptionTargetValue: null,
        }
      });
      
      const barContainer = container.querySelector('.bar');
      const effContainer = container.querySelector('.myio-ho-card__eff');

      expect(barContainer.style.display).toBe('none');
      // O contêiner de eficiência inteiro (incluindo o texto "%") deve ser escondido
      expect(effContainer.style.display).toBe('none'); 
    });
  });

  describe('Eventos e Ações', () => {
    it('deve chamar handleActionDashboard quando o item de menu do dashboard é clicado', () => {
      const handleActionDashboard = vi.fn();
      
      // CRIA o card
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject,
        handleActionDashboard
      });

      container.querySelector('.myio-ho-card__kebab').click();
      container.querySelector('[data-action="dashboard"]').click();

      expect(handleActionDashboard).toHaveBeenCalledWith(
        expect.any(Event),
        mockEntityObject
      );
      
      // LIMPA (destroy) o card ao final do teste
      card.destroy();
    });

    it('deve alternar a visibilidade do menu ao clicar no botão kebab', () => {
      // CRIA o card
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      const kebabBtn = container.querySelector('.myio-ho-card__kebab');
      const menu = container.querySelector('.myio-ho-card__menu');

      expect(menu.hasAttribute('hidden')).toBe(true);

      kebabBtn.click();
      expect(menu.hasAttribute('hidden')).toBe(false);

      kebabBtn.click();
      expect(menu.hasAttribute('hidden')).toBe(true);

      // LIMPA (destroy) o card ao final do teste
      card.destroy();
    });
  });

  describe('Funcionalidade de Update', () => {
    it('deve atualizar os valores quando update() é chamado', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });
      
      // Estado inicial
      expect(container.querySelector('.myio-ho-card__value .num').textContent).toBe('25.0');
      expect(container.querySelector('.myio-ho-card__eff .perc').textContent).toBe('25%');

      card.update({
        val: 50.0,
        connectionStatus: 'ALERT',
        consumptionTargetValue: 200.0
      });

      const numSpan = container.querySelector('.myio-ho-card__value .num');
      const percSpan = container.querySelector('.myio-ho-card__eff .perc');
      const chip = container.querySelector('.chip');
      const cardEl = container.querySelector('.myio-ho-card');

      expect(numSpan.textContent).toBe('50.0');
      // A porcentagem deve ser recalculada: (50 / 200) * 100 = 25%
      expect(percSpan.textContent).toBe('25%'); 
      expect(chip.classList.contains('chip--alert')).toBe(true);
      expect(cardEl.classList.contains('is-alert')).toBe(true);
    });
  });

  describe('Limpeza (Cleanup)', () => {
    it('deve remover o elemento do DOM quando destroy() é chamado', () => {
      const card = renderCardCompenteHeadOffice(container, {
        entityObject: mockEntityObject
      });

      expect(container.children.length).toBe(1);
      card.destroy();
      expect(container.children.length).toBe(0);
    });
  });
});