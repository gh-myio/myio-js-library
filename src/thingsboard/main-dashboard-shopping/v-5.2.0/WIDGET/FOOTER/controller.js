/* global self, window, document, localStorage, MyIOLibrary*/

/**
 * NOTA: Este script depende das seguintes bibliotecas:
 *
 * IMPORTANTE: Adicione as bibliotecas como External Resources no widget do ThingsBoard:
 * Widget Settings > Resources > Add Resource > External Resource:
 *
 * 1. MyIO Library (obrigatório):
 *    https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
 *
 * 2. Energy Chart SDK (obrigatório para comparação):
 *    Use a mesma base URL definida em CHARTS_BASE_URL abaixo + /sdk/energy-chart-sdk.umd.js
 *
 * Para os ícones, idealmente, você carregaria uma biblioteca como Font Awesome ou Material Icons.
 * Por simplicidade no exemplo, os ícones '•' e '×' são mantidos, mas estilizaremos para parecerem melhores.
 */

// ============================================================================
// CONFIGURAÇÃO DE AMBIENTE - Altere aqui para trocar entre staging e produção
// ============================================================================
// RFC-0091: Use shared DATA_API_HOST from MAIN widget via window.MyIOUtils
const DATA_API_HOST = window.MyIOUtils?.DATA_API_HOST;
if (!DATA_API_HOST) {
  console.error('[FOOTER] DATA_API_HOST not available from window.MyIOUtils - MAIN widget must load first');
}
const CHARTS_BASE_URL = 'https://graphs.staging.apps.myio-bas.com'; // staging para testes
// const CHARTS_BASE_URL = 'https://graphs.apps.myio-bas.com'; // produção

// RFC-0091: Use shared LogHelper from MAIN widget via window.MyIOUtils
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log('[FOOTER]', ...args),
  warn: (...args) => console.warn('[FOOTER]', ...args),
  error: (...args) => console.error('[FOOTER]', ...args),
};

// --- 2. Injeção de CSS (executada uma vez) ---
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;

  const styleId = 'myio-footer-premium-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
/* ==========================================
   MYIO Footer - Premium Design System
   ========================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.myio-footer {
  /* Design Tokens - Purple Theme */
  --color-primary: #9E8CBE;
  --color-primary-hover: #B8A5D6;
  --color-primary-dark: #8472A8;
  --color-background: #0f1419;
  --color-surface: #1a1f28;
  --color-surface-elevated: #242b36;
  --color-text-primary: #ffffff;
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-text-tertiary: rgba(255, 255, 255, 0.5);
  --color-border: rgba(255, 255, 255, 0.08);
  --color-error: #ff4444;

  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Layout */
  position: relative;
  width: 100%;
  height: 46px;
  z-index: 1000;

  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  box-sizing: border-box;

  /* Visual */
  font-family: var(--font-family);
  color: var(--color-text-primary);
  background: linear-gradient(
    180deg,
    rgba(158, 140, 190, 0.95) 0%,
    rgba(132, 114, 168, 0.98) 100%
  );
  border-top: 2px solid rgba(184, 165, 214, 0.5);
  box-shadow:
    var(--shadow-lg),
    0 -2px 24px rgba(158, 140, 190, 0.3);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.myio-dock {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 0;
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(158, 140, 190, 0.6) transparent;
}

.myio-dock::-webkit-scrollbar {
  height: 6px;
}

.myio-dock::-webkit-scrollbar-track {
  background: rgba(158, 140, 190, 0.08);
  border-radius: 3px;
}

.myio-dock::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(158, 140, 190, 0.4);
}

.myio-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  height: 34px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(158, 140, 190, 0.25) 0%, rgba(158, 140, 190, 0.15) 100%);
  border: 1px solid rgba(184, 165, 214, 0.4);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  cursor: default;
  transition: var(--transition);
  animation: chipSlideIn 0.3s ease-out;
  position: relative;
  overflow: hidden;
}

@keyframes chipSlideIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.myio-chip:hover {
  background: linear-gradient(135deg, rgba(158, 140, 190, 0.35) 0%, rgba(158, 140, 190, 0.25) 100%);
  border-color: rgba(184, 165, 214, 0.6);
  box-shadow: 0 6px 16px rgba(158, 140, 190, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transform: translateY(-3px);
}

.myio-chip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;
}

.myio-chip-name {
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.myio-chip-value {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.myio-chip-remove {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin-left: 5px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.myio-chip-remove:hover {
  background: linear-gradient(135deg, rgba(255, 68, 68, 0.25) 0%, rgba(255, 68, 68, 0.15) 100%);
  border-color: rgba(255, 68, 68, 0.5);
  color: #ff4444;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
}

.myio-chip-remove svg {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 16px;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.myio-empty {
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 600;
  padding: 12px 24px;
  opacity: 0.9;
  background: linear-gradient(135deg, rgba(158, 140, 190, 0.15) 0%, transparent 100%);
  border: 1px dashed rgba(184, 165, 214, 0.4);
  border-radius: var(--radius-md);
  text-shadow: 0 0 8px rgba(158, 140, 190, 0.3);
  animation: pulseGlow 2s ease-in-out infinite;
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.7; box-shadow: 0 0 0 rgba(158, 140, 190, 0.3); }
  50% { opacity: 1; box-shadow: 0 0 16px rgba(158, 140, 190, 0.3); }
}

.myio-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.myio-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0px;
  padding: 4px 9px;
  min-width: 100px;
  background: linear-gradient(135deg, rgba(158, 140, 190, 0.15) 0%, rgba(158, 140, 190, 0.08) 100%);
  border: 1px solid rgba(184, 165, 214, 0.3);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.myio-meta-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px rgba(158, 140, 190, 0.4);
}

#myioTotals {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.myio-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: linear-gradient(135deg, rgba(200, 200, 200, 0.2) 0%, rgba(200, 200, 200, 0.1) 100%);
  border: 1px solid rgba(200, 200, 200, 0.3);
  border-radius: var(--radius-md);
  color: #cccccc;
  cursor: pointer;
  transition: var(--transition);
}

.myio-clear-btn:hover {
  background: linear-gradient(135deg, rgba(200, 200, 200, 0.3) 0%, rgba(200, 200, 200, 0.2) 100%);
  border-color: rgba(200, 200, 200, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(200, 200, 200, 0.3);
}

.myio-clear-btn:disabled {
  background: var(--color-surface);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.myio-clear-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

.myio-clear-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.myio-compare {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  min-width: 100px;
  padding: 0 16px;
  font-family: var(--font-family);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  background: #3E1A7D;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(62, 26, 125, 0.5), 0 4px 16px rgba(62, 26, 125, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: var(--transition);
}

.myio-compare:hover {
  background: linear-gradient(135deg, #5A2CB8 0%, #3E1A7D 100%);
  box-shadow: 0 0 0 1px rgba(62, 26, 125, 0.7), 0 6px 24px rgba(62, 26, 125, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.myio-compare:disabled {
  background: var(--color-surface);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

.myio-compare::after {
  content: '→';
  font-size: 14px;
  margin-left: 2px;
  transition: transform 0.2s;
}

.myio-compare:hover::after {
  transform: translateX(4px);
}

.myio-compare:disabled::after {
  display: none;
}

.myio-alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.myio-alert-box {
  position: relative;
  max-width: 480px;
  width: 90%;
  padding: 32px;
  background: linear-gradient(135deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.myio-alert-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%);
  border: 2px solid rgba(255, 193, 7, 0.5);
  border-radius: 50%;
  color: #ffc107;
  font-size: 32px;
}

.myio-alert-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  letter-spacing: -0.02em;
}

.myio-alert-message {
  margin: 0 0 28px;
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.6;
}

.myio-alert-button {
  width: 100%;
  height: 48px;
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  border: none;
  border-radius: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(158, 140, 190, 0.4);
  transition: var(--transition);
}

.myio-alert-button:hover {
  background: linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%);
  box-shadow: 0 6px 24px rgba(158, 140, 190, 0.5);
  transform: translateY(-2px);
}
    `;

  document.head.appendChild(style);
  cssInjected = true;
  LogHelper.log('[MyIO Footer] ✅ CSS injected successfully');
}

// --- 3. Controlador do Footer (Objeto encapsulado) ---
const footerController = {
  $root: null,
  $footerEl: null,
  $dock: null,
  $totals: null,
  $compareBtn: null,
  $clearBtn: null,
  $alertOverlay: null,
  initialized: false,
  currentUnitType: null, // Tracks current unit type (energy, water, tank, etc)

  // Armazena referências às funções com 'this' vinculado para remoção segura
  boundRenderDock: null,
  boundCompareClick: null,
  boundClearClick: null,
  boundDragOver: null,
  boundDrop: null,
  boundChipClick: null,
  boundLimitReached: null,
  boundDashboardStateChange: null,

  /**
   * Inicializa o controlador
   */
  init(ctx) {
    LogHelper.log('[MyIO Footer] init() called');

    if (this.initialized) {
      LogHelper.log('[MyIO Footer] Already initialized, skipping');
      return;
    }

    // Injeta o CSS primeiro
    injectCSS();

    this.$root = ctx?.$container?.[0];
    this.ctx = ctx;
    if (!this.$root) {
      LogHelper.error('[MyIO Footer] Root container not found.');
      return;
    }
    LogHelper.log('[MyIO Footer] Root container found');

    // Verifica se a biblioteca MyIOLibrary está carregada via Resources
    if (!window.MyIOLibrary) {
      LogHelper.error(
        '[MyIO Footer] MyIOLibrary not found. ' +
          'Please add the library as a Resource in ThingsBoard widget settings:\n' +
          'https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js'
      );
      return;
    }
    LogHelper.log('[MyIO Footer] MyIOLibrary found');

    // IMPORTANTE: NÃO chamamos mountTemplate() porque o ThingsBoard já renderizou template.html!
    // this.mountTemplate(); // ← REMOVIDO
    LogHelper.log('[MyIO Footer] Using ThingsBoard template.html (not mounting manually)');

    this.queryDOMElements(); // Consultar elementos do template.html
    LogHelper.log('[MyIO Footer] DOM elements queried:', {
      dock: !!this.$dock,
      totals: !!this.$totals,
      compareBtn: !!this.$compareBtn,
    });

    this.bindEvents();
    LogHelper.log('[MyIO Footer] Events bound');

    this.renderDock(); // Renderização inicial
    LogHelper.log('[MyIO Footer] Initial render complete');

    this.initialized = true;
  },

  /**
   * Monta o template do footer no DOM
   */
  mountTemplate() {
    // Cria o elemento principal do footer
    const footerSection = document.createElement('section');
    footerSection.className = 'myio-footer';

    // Habilita modo fixo opcional via settings do widget (ctx.settings.fixedFooter)
    try {
      const fixed = !!(this.ctx && this.ctx.settings && this.ctx.settings.fixedFooter);
      if (fixed) footerSection.classList.add('is-fixed');
    } catch (_) {
      /* noop */
    }

    // Insere o conteúdo do template explicitamente
    footerSection.innerHTML = `
        <div class="myio-dock" id="myioDock" aria-live="polite"></div>
        <div class="myio-right">
          <div class="myio-meta" id="myioTotals">0 selecionados</div>
          <button id="myioCompare" class="myio-compare" disabled>Compare</button>
        </div>
      `;

    this.$root.appendChild(footerSection);
    this.$footerEl = footerSection; // Armazena a referência ao footer
  },

  /**
   * Consulta os elementos do DOM *uma vez* e armazena as referências
   * IMPORTANTE: Como não montamos o template manualmente, buscamos direto do $root
   */
  queryDOMElements() {
    // Busca a section do footer (renderizada pelo template.html do ThingsBoard)
    this.$footerEl = this.$root.querySelector('.myio-footer');

    if (!this.$footerEl) {
      LogHelper.error('[MyIO Footer] .myio-footer section not found in template!');
      return;
    }

    // Busca os elementos dentro da section
    this.$dock = this.$footerEl.querySelector('#myioDock');
    this.$totals = this.$footerEl.querySelector('#myioTotals');
    this.$clearBtn = this.$footerEl.querySelector('#myioClear');
    this.$compareBtn = this.$footerEl.querySelector('#myioCompare');

    LogHelper.log('[MyIO Footer] Found elements from ThingsBoard template:', {
      $footerEl: this.$footerEl,
      $dock: this.$dock,
      $totals: this.$totals,
      $clearBtn: this.$clearBtn,
      $compareBtn: this.$compareBtn,
    });
  },

  /**
   * Detecta o tipo de unidade (icon) das entidades selecionadas
   * Retorna: 'energy', 'water', 'tank', 'mixed', ou null
   */
  _detectUnitType(entities) {
    if (!entities || entities.length === 0) return null;

    const types = new Set();
    entities.forEach((entity) => {
      if (entity && entity.icon) {
        types.add(entity.icon);
      }
    });

    if (types.size === 0) return null;
    if (types.size > 1) return 'mixed'; // Tipos misturados!
    return Array.from(types)[0]; // Um único tipo
  },

  /**
   * Renderiza o conteúdo do "dock" (chips ou mensagem de vazio)
   */
  renderDock() {
    LogHelper.log('[MyIO Footer] renderDock() called');

    if (!this.$dock || !this.$totals || !this.$compareBtn) {
      LogHelper.warn('[MyIO Footer] DOM elements not ready:', {
        dock: !!this.$dock,
        totals: !!this.$totals,
        compareBtn: !!this.$compareBtn,
      });
      return;
    }

    // Try both window.MyIOLibrary.MyIOSelectionStore and window.MyIOSelectionStore
    const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;

    if (!MyIOSelectionStore) {
      LogHelper.error('[MyIO Footer] MyIOSelectionStore not found.');
      return;
    }

    const selected = MyIOSelectionStore.getSelectedEntities();
    const count = selected.length;

    // INTELIGÊNCIA: Detecta tipo de unidade e reseta se houver mudança
    const detectedType = this._detectUnitType(selected);

    // Se detectou tipos misturados, limpa a seleção automaticamente
    if (detectedType === 'mixed') {
      LogHelper.warn(
        '[MyIO Footer] ⚠️ Mixed unit types detected! Clearing selection to prevent invalid comparison.'
      );
      this.showMixedUnitsAlert();
      MyIOSelectionStore.clear();
      return; // renderDock será chamado novamente após o clear
    }

    // Se mudou o tipo de unidade (ex: de 'energy' para 'water'), limpa a seleção
    if (detectedType && this.currentUnitType && detectedType !== this.currentUnitType) {
      LogHelper.warn(
        `[MyIO Footer] ⚠️ Unit type changed from '${this.currentUnitType}' to '${detectedType}'! Clearing selection.`
      );
      this.currentUnitType = detectedType;
      MyIOSelectionStore.clear();
      return; // renderDock será chamado novamente após o clear
    }

    // Atualiza o tipo atual
    this.currentUnitType = detectedType;

    // Calcula os totais/média manualmente a partir dos lastValue das entidades
    let totalValue = 0;
    let validValuesCount = 0;

    selected.forEach((entity) => {
      if (entity && typeof entity.lastValue === 'number') {
        totalValue += entity.lastValue;
        validValuesCount++;
      }
    });

    // Para temperatura, calcula média ao invés de soma
    let displayValue = totalValue;
    if (detectedType === 'temperature' && validValuesCount > 0) {
      displayValue = totalValue / validValuesCount;
    }

    // Formata o valor usando formatação brasileira
    const totals = this._formatValue(displayValue);

    LogHelper.log('[MyIO Footer] Rendering dock:', {
      count,
      selected,
      totalValue,
      totalsFormatted: totals,
    });

    // DEBUG: Log each entity
    LogHelper.log('[MyIO Footer] Selected entities details:');
    selected.forEach((ent, idx) => {
      LogHelper.log(`[MyIO Footer]   Entity ${idx}:`, ent);
    });

    if (count === 0) {
      LogHelper.log('[MyIO Footer] Count is 0, rendering empty message');
      const emptyEl = document.createElement('span');
      emptyEl.className = 'myio-empty';
      emptyEl.textContent = 'Arraste itens para cá ou selecione no card';
      this.$dock.replaceChildren(emptyEl); // Mais seguro e performático
      LogHelper.log('[MyIO Footer] Empty message rendered');
    } else {
      LogHelper.log(`[MyIO Footer] Count is ${count}, creating chips...`);
      // Cria chips de forma eficiente e segura
      const chips = selected
        .map((ent, idx) => {
          LogHelper.log(`[MyIO Footer]   Creating chip ${idx} for entity:`, ent);

          if (!ent || !ent.name) {
            LogHelper.error(`[MyIO Footer]   Entity ${idx} is invalid:`, ent);
            return null;
          }

          const chip = document.createElement('div');
          chip.className = 'myio-chip';

          // Conteúdo do chip (nome + valor)
          const content = document.createElement('div');
          content.className = 'myio-chip-content';

          const name = document.createElement('span');
          name.className = 'myio-chip-name';
          name.textContent = ent.name;

          const value = document.createElement('span');
          value.className = 'myio-chip-value';
          // Formata o valor com unidade
          const formattedValue = ent.lastValue
            ? `${this._formatValue(ent.lastValue)} ${ent.unit || ''}`.trim()
            : 'Sem dados';
          value.textContent = formattedValue;

          content.append(name, value);

          // Botão de remover
          const removeBtn = document.createElement('button');
          removeBtn.className = 'myio-chip-remove';
          removeBtn.title = `Remover ${ent.name}`;
          removeBtn.setAttribute('aria-label', `Remover ${ent.name}`);
          removeBtn.dataset.entityId = ent.id;
          removeBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          `;

          chip.append(content, removeBtn);
          LogHelper.log(`[MyIO Footer]   Chip ${idx} created successfully`);
          return chip;
        })
        .filter((chip) => chip !== null); // Remove null chips

      LogHelper.log(`[MyIO Footer] Total chips created: ${chips.length}`);
      LogHelper.log('[MyIO Footer] About to call replaceChildren with chips:', chips);

      this.$dock.replaceChildren(...chips); // Renderiza todos de uma vez

      LogHelper.log('[MyIO Footer] replaceChildren completed');
      LogHelper.log('[MyIO Footer] $dock.children.length:', this.$dock.children.length);
      LogHelper.log('[MyIO Footer] $dock.innerHTML:', this.$dock.innerHTML);

      // DEBUG: Check if CSS is being applied
      if (this.$dock.children.length > 0) {
        const dockStyles = window.getComputedStyle(this.$dock);
        const firstChip = this.$dock.children[0];
        const chipStyles = window.getComputedStyle(firstChip);

        LogHelper.log('[MyIO Footer] 🎨 CSS DIAGNOSTICS:');
        LogHelper.log('  $dock display:', dockStyles.display);
        LogHelper.log('  $dock flexDirection:', dockStyles.flexDirection);
        LogHelper.log('  $dock gap:', dockStyles.gap);
        LogHelper.log('  firstChip display:', chipStyles.display);
        LogHelper.log('  firstChip className:', firstChip.className);
        LogHelper.log('  firstChip background:', chipStyles.background);
        LogHelper.log('  firstChip border:', chipStyles.border);

        const removeBtn = firstChip.querySelector('.myio-chip-remove');
        if (removeBtn) {
          const btnStyles = window.getComputedStyle(removeBtn);
          LogHelper.log('  removeBtn background:', btnStyles.background);
          LogHelper.log('  removeBtn border:', btnStyles.border);
          LogHelper.log('  removeBtn width:', btnStyles.width);
          LogHelper.log('  removeBtn height:', btnStyles.height);
        }
      }
    }

    // Atualiza totais e botão
    const itemText = count === 1 ? 'item' : 'itens';

    // Se não houver seleção, mostra mensagem padrão
    let newTotalsText;
    if (count === 0) {
      newTotalsText = '0 itens';
    } else {
      // Para temperatura, indica que é média
      const prefix = detectedType === 'temperature' ? 'Média: ' : '';
      newTotalsText = `${count} ${itemText} (${prefix}${totals})`;
    }

    LogHelper.log(`[MyIO Footer] Updating totals text to: "${newTotalsText}"`);
    this.$totals.textContent = newTotalsText;
    LogHelper.log('[MyIO Footer] Totals updated. Current text:', this.$totals.textContent);

    this.$compareBtn.disabled = count < 2;
    this.$clearBtn.disabled = count === 0;
    LogHelper.log('[MyIO Footer] renderDock() completed');
  },

  /**
   * Formata valores numéricos para exibição
   */
  _formatValue(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0';

    // Para valores grandes (>= 1000), usa notação com separadores
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }

    // Para valores pequenos, mostra até 2 casas decimais
    return value.toFixed(2).replace(/\.?0+$/, '');
  },

  /**
   * Mostra o alerta premium quando tipos de unidades são misturados
   */
  showMixedUnitsAlert() {
    LogHelper.log('[MyIO Footer] Showing mixed units alert');

    // Remove qualquer alerta existente
    if (this.$alertOverlay) {
      this.hideAlert();
    }

    // Cria o overlay do alerta
    const overlay = document.createElement('div');
    overlay.className = 'myio-alert-overlay';

    overlay.innerHTML = `
        <div class="myio-alert-box">
          <div class="myio-alert-icon">⚠</div>
          <h2 class="myio-alert-title">Tipos Incompatíveis</h2>
          <p class="myio-alert-message">
            Você não pode comparar dispositivos de <strong>tipos diferentes</strong>
            (ex: energia vs água). A seleção foi limpa automaticamente.
            <br><br>
            Selecione apenas dispositivos do mesmo tipo para comparação.
          </p>
          <button class="myio-alert-button">Entendi</button>
        </div>
      `;

    // Adiciona ao body para que fique acima de tudo
    document.body.appendChild(overlay);
    this.$alertOverlay = overlay;

    // Adiciona listener no botão e no overlay (clique fora)
    const closeBtn = overlay.querySelector('.myio-alert-button');
    const closeAlert = () => this.hideAlert();

    closeBtn.addEventListener('click', closeAlert);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAlert();
      }
    });

    LogHelper.log('[MyIO Footer] Mixed units alert displayed');
  },

  /**
   * Mostra o alerta premium quando o limite de seleção é atingido
   */
  showLimitAlert() {
    LogHelper.log('[MyIO Footer] Showing limit alert');

    // Remove qualquer alerta existente
    if (this.$alertOverlay) {
      this.hideAlert();
    }

    // Cria o overlay do alerta
    const overlay = document.createElement('div');
    overlay.className = 'myio-alert-overlay';

    overlay.innerHTML = `
        <div class="myio-alert-box">
          <div class="myio-alert-icon">⚠</div>
          <h2 class="myio-alert-title">Limite Atingido</h2>
          <p class="myio-alert-message">
            Você pode selecionar no máximo <strong>6 dispositivos</strong> para comparação.
            Remova um dispositivo antes de adicionar outro.
          </p>
          <button class="myio-alert-button">FECHAR</button>
        </div>
      `;

    // Adiciona ao body para que fique acima de tudo
    document.body.appendChild(overlay);
    this.$alertOverlay = overlay;

    // Adiciona listener no botão e no overlay (clique fora)
    const closeBtn = overlay.querySelector('.myio-alert-button');
    const closeAlert = () => this.hideAlert();

    closeBtn.addEventListener('click', closeAlert);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAlert();
      }
    });

    LogHelper.log('[MyIO Footer] Limit alert displayed');
  },

  /**
   * Esconde o alerta premium (genérico)
   */
  hideAlert() {
    if (this.$alertOverlay && this.$alertOverlay.parentNode) {
      this.$alertOverlay.remove();
      this.$alertOverlay = null;
      LogHelper.log('[MyIO Footer] Alert hidden');
    }
  },

  /**
   * Alias para compatibilidade com código antigo
   */
  hideLimitAlert() {
    this.hideAlert();
  },

  /**
   * Handler para evento de limite atingido
   */
  onLimitReached(data) {
    LogHelper.log('[MyIO Footer] Limit reached event received:', data);
    this.showLimitAlert();
  },

  /**
   * Handler para evento de mudança de dashboard (troca de aba no MENU)
   * Limpa a seleção do FOOTER quando o usuário troca entre energy/water/tank
   */
  onDashboardStateChange(event) {
    const newTab = event.detail?.tab;

    LogHelper.log(`[MyIO Footer] Dashboard state changed to: ${newTab}`);

    // Se mudou para uma aba válida (energy, water, temperature)
    // Limpa a seleção para evitar comparações inválidas
    if (
      newTab &&
      (newTab === 'energy' || newTab === 'water' || newTab === 'temperature' || newTab === 'tank')
    ) {
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;

      if (MyIOSelectionStore) {
        const count = MyIOSelectionStore.getSelectionCount();

        // Só limpa se houver algo selecionado
        if (count > 0) {
          LogHelper.log(`[MyIO Footer] Clearing ${count} selected items due to tab change`);
          MyIOSelectionStore.clear();

          // Reseta o tipo atual
          this.currentUnitType = null;
        }
      }
    }
  },

  /**
   * Vincula todos os ouvintes de eventos
   */
  bindEvents() {
    LogHelper.log('[MyIO Footer] bindEvents() called');

    // DEBUG: Check which SelectionStore instance we're using
    LogHelper.log('[MyIO Footer] window.MyIOLibrary:', !!window.MyIOLibrary);
    LogHelper.log(
      '[MyIO Footer] window.MyIOLibrary.MyIOSelectionStore:',
      !!window.MyIOLibrary?.MyIOSelectionStore
    );
    LogHelper.log('[MyIO Footer] window.MyIOSelectionStore:', !!window.MyIOSelectionStore);

    // Try both window.MyIOLibrary.MyIOSelectionStore and window.MyIOSelectionStore
    const fromMyIOLibrary = window.MyIOLibrary?.MyIOSelectionStore;
    const fromWindow = window.MyIOSelectionStore;
    const MyIOSelectionStore = fromMyIOLibrary || fromWindow;

    // DEBUG: Check which reference we're using
    LogHelper.log(
      '[MyIO Footer] Using reference from:',
      fromMyIOLibrary ? 'window.MyIOLibrary.MyIOSelectionStore' : 'window.MyIOSelectionStore'
    );
    LogHelper.log('[MyIO Footer] Are they the same instance?', fromMyIOLibrary === fromWindow);

    if (!MyIOSelectionStore) {
      LogHelper.error('[MyIO Footer] MyIOSelectionStore not available for binding events.');
      return;
    }

    // DEBUG: Verify we have the correct instance
    LogHelper.log('[MyIO Footer] Using SelectionStore instance:', MyIOSelectionStore.constructor.name);
    LogHelper.log('[MyIO Footer] SelectionStore has .on method:', typeof MyIOSelectionStore.on);

    // DEBUG: Check hidden global instance
    try {
      const topWindowInstance = window.top.__MyIOSelectionStore_INSTANCE__;
      LogHelper.log('[MyIO Footer] window.top.__MyIOSelectionStore_INSTANCE__ exists:', !!topWindowInstance);
      LogHelper.log(
        '[MyIO Footer] Using same instance as window.top?',
        MyIOSelectionStore === topWindowInstance
      );
    } catch (e) {
      LogHelper.warn('[MyIO Footer] Cannot access window.top:', e.message);
    }

    LogHelper.log('[MyIO Footer] Current listeners count before registration:', {
      'selection:change': MyIOSelectionStore.eventListeners?.get('selection:change')?.length || 0,
      'selection:totals': MyIOSelectionStore.eventListeners?.get('selection:totals')?.length || 0,
    });

    // 1. Armazena funções vinculadas (para remoção correta)
    this.boundRenderDock = this.renderDock.bind(this);
    this.boundCompareClick = this.onCompareClick.bind(this);
    this.boundClearClick = this.onClearClick.bind(this);
    this.boundDragOver = (e) => e.preventDefault();
    this.boundDrop = this.onDrop.bind(this);
    this.boundChipClick = this.onChipClick.bind(this);
    this.boundLimitReached = this.onLimitReached.bind(this);
    this.boundDashboardStateChange = this.onDashboardStateChange.bind(this);

    // 2. Ouve a store externa
    LogHelper.log('[MyIO Footer] About to register selection:change listener...');
    LogHelper.log('[MyIO Footer] MyIOSelectionStore.on function:', MyIOSelectionStore.on);
    LogHelper.log("[MyIO Footer] Calling MyIOSelectionStore.on('selection:change', boundRenderDock)...");
    const result1 = MyIOSelectionStore.on('selection:change', this.boundRenderDock);
    LogHelper.log('[MyIO Footer] Result from .on() call:', result1);

    LogHelper.log('[MyIO Footer] About to register selection:totals listener...');
    const result2 = MyIOSelectionStore.on('selection:totals', this.boundRenderDock);
    LogHelper.log('[MyIO Footer] Result from .on() call:', result2);

    LogHelper.log('[MyIO Footer] About to register selection:limit-reached listener...');
    const result3 = MyIOSelectionStore.on('selection:limit-reached', this.boundLimitReached);
    LogHelper.log('[MyIO Footer] Result from .on() call:', result3);

    // DEBUG: Verify registration worked
    LogHelper.log('[MyIO Footer] Current listeners count after registration:', {
      'selection:change': MyIOSelectionStore.eventListeners?.get('selection:change')?.length || 0,
      'selection:totals': MyIOSelectionStore.eventListeners?.get('selection:totals')?.length || 0,
      'selection:limit-reached':
        MyIOSelectionStore.eventListeners?.get('selection:limit-reached')?.length || 0,
    });

    LogHelper.log('[MyIO Footer] Registered listeners on SelectionStore');

    // 3. Ouve elementos do DOM interno
    if (this.$compareBtn) {
      this.$compareBtn.addEventListener('click', this.boundCompareClick);
    }

    if (this.$clearBtn) {
      this.$clearBtn.addEventListener('click', this.boundClearClick);
    }

    // 4. Delegação de evento para cliques nos chips
    if (this.$dock) {
      this.$dock.addEventListener('click', this.boundChipClick);
    }

    // 5. Eventos de Drag and Drop no footer
    if (this.$footerEl) {
      this.$footerEl.addEventListener('dragover', this.boundDragOver);
      this.$footerEl.addEventListener('drop', this.boundDrop);
    }

    // 6. Evento de mudança de aba no MENU (limpa seleção ao trocar entre energy/water/tank)
    window.addEventListener('myio:dashboard-state', this.boundDashboardStateChange);
    LogHelper.log('[MyIO Footer] Registered listener for myio:dashboard-state (tab change from MENU)');
  },

  /**
   * Manipulador de clique para o "dock" (delegação)
   */
  onChipClick(e) {
    // Verifica se o clique foi em um botão de remover
    const removeBtn = e.target.closest('button[data-entity-id]');
    if (removeBtn) {
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
      if (MyIOSelectionStore) {
        const id = removeBtn.dataset.entityId;
        MyIOSelectionStore.remove(id);
      }
    }
  },

  /**
   * Abre a modal de comparação premium usando openDashboardPopupEnergy
   * NOVO: Usa o modo 'comparison' do EnergyModalView
   * Para temperatura: usa modal customizada com Chart.js (não SDK)
   */
  async openComparisonModal() {
    LogHelper.log('[MyIO Footer] Opening comparison modal...');

    const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
    if (!MyIOSelectionStore) {
      LogHelper.error('[MyIO Footer] SelectionStore not found');
      return;
    }

    const selected = MyIOSelectionStore.getSelectedEntities();
    const count = selected.length;

    if (count < 2) {
      LogHelper.warn('[MyIO Footer] Need at least 2 devices for comparison');
      window.alert('Selecione pelo menos 2 dispositivos para comparar.');
      return;
    }

    try {
      // Detecta o tipo de unidade e o readingType
      const unitType = this.currentUnitType || this._detectUnitType(selected);
      const readingType = this._mapUnitTypeToReadingType(unitType);

      LogHelper.log(`[MyIO Footer] Comparison readingType: ${readingType}`);

      // Temperature uses custom comparison modal (not SDK-based)
      if (readingType === 'temperature') {
        LogHelper.log('[MyIO Footer] Using temperature comparison modal (not SDK)');
        await this._openTemperatureComparisonModal(selected);
        return;
      }

      // ⭐ NOVO: Prepara dataSources com ingestionId
      // IMPORTANTE: Usa ingestionId, não o ID do ThingsBoard
      const dataSources = selected.map((entity) => ({
        type: 'device',
        id: entity.ingestionId || entity.id, // Prioriza ingestionId
        label: entity.name || entity.id,
      }));

      // Obtém credenciais e período
      const ctx = self.ctx || {};
      const startDate = ctx.scope?.startDateISO || new Date(new Date().setDate(1)).toISOString();
      const endDate = ctx.scope?.endDateISO || new Date().toISOString();

      // Calcula granularidade baseada no período
      const granularity = this._calculateGranularity(startDate, endDate);

      // ⭐ Obtém credenciais de autenticação com fallback
      const clientId = window.__MYIO_CLIENT_ID__ || 'mestreal_mfh4e642_4flnuh';
      const clientSecret =
        window.__MYIO_CLIENT_SECRET__ || 'gv0zfmdekNxYA296OcqFrnBAVU4PhbUBhBwNlMCamk2oXDHeXJqu1K6YtpVOZ5da';

      // Log se estiver usando fallback
      if (!window.__MYIO_CLIENT_ID__) {
        LogHelper.warn('[MyIO Footer] Using fallback clientId');
      }
      if (!window.__MYIO_CLIENT_SECRET__) {
        LogHelper.warn('[MyIO Footer] Using fallback clientSecret');
      }

      LogHelper.log('[MyIO Footer] Opening modal with config:', {
        dataSources: dataSources.length,
        readingType,
        startDate,
        endDate,
        granularity,
        clientId,
      });

      // ⭐ NOVO: Usa openDashboardPopupEnergy em modo comparison
      // Substitui a modal customizada (_createComparisonModalOverlay)
      if (!window.MyIOLibrary?.openDashboardPopupEnergy) {
        LogHelper.error('[MyIO Footer] openDashboardPopupEnergy not available');
        window.alert('Biblioteca MyIO não está carregada. Recarregue a página.');
        return;
      }

      // ⭐ Usa as variáveis com fallback (já definidas acima)
      const MyIOAuthFooter = MyIOLibrary.buildMyioIngestionAuth({
        dataApiHost: DATA_API_HOST,
        clientId: clientId, // ← Usa a variável com fallback
        clientSecret: clientSecret, // ← Usa a variável com fallback
      });

      const myTbTokenDashBoardFooter = localStorage.getItem('jwt_token');
      const tokenIngestionDashBoardComparison = await MyIOAuthFooter.getToken();

      const modal = window.MyIOLibrary.openDashboardPopupEnergy({
        mode: 'comparison', // ← MODO COMPARISON
        tbJwtToken: myTbTokenDashBoardFooter,
        ingestionToken: tokenIngestionDashBoardComparison,
        dataSources: dataSources,
        readingType: readingType,
        startDate: startDate,
        endDate: endDate,
        granularity: granularity, // ← OBRIGATÓRIO para comparison
        clientId: clientId,
        clientSecret: clientSecret,
        dataApiHost: DATA_API_HOST,
        chartsBaseUrl: CHARTS_BASE_URL, // ← URL base para iframes do SDK
        theme: 'dark', // ← Tema inicial (toggle disponível na modal)
        deep: false,
        onOpen: (context) => {
          LogHelper.log('[FOOTER] Comparison modal opened:', context);
        },
        onClose: () => {
          LogHelper.log('[FOOTER] Comparison modal closed');
        },
        onError: (error) => {
          LogHelper.error('[FOOTER] Comparison modal error:', error);
          window.alert(`Erro: ${error.message}`);
        },
      });

      LogHelper.log('[MyIO Footer] Modal opened successfully:', modal);
    } catch (error) {
      LogHelper.error('[MyIO Footer] Error opening comparison modal:', error);
      window.alert('Erro ao abrir modal de comparação. Verifique o console.');
    }
  },

  /**
   * Mapeia unitType (icon) para readingType do SDK
   */
  _mapUnitTypeToReadingType(unitType) {
    const mapping = {
      energy: 'energy',
      water: 'water',
      tank: 'tank',
      temperature: 'temperature',
    };
    return mapping[unitType] || 'energy';
  },

  /**
   * Calcula a granularidade ideal baseada no período
   */
  _calculateGranularity(startISO, endISO) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return '1h'; // 1 dia: granularidade horária
    if (diffDays <= 7) return '1d'; // 1 semana: diária
    if (diffDays <= 31) return '1d'; // 1 mês: diária
    if (diffDays <= 90) return '1w'; // 3 meses: semanal
    return '1M'; // Mais de 3 meses: mensal
  },

  /**
   * Opens temperature comparison modal using MyIOLibrary
   * RFC-0085: Uses the library component instead of inline implementation
   * @param {Array} selectedEntities - Array of selected entity objects
   */
  async _openTemperatureComparisonModal(selectedEntities) {
    LogHelper.log(
      '[MyIO Footer] Opening temperature comparison modal for',
      selectedEntities.length,
      'devices'
    );

    const jwtToken = localStorage.getItem('jwt_token');

    if (!jwtToken) {
      window.alert('Token de autenticação não encontrado. Faça login novamente.');
      return;
    }

    // Get date range from context
    const ctx = self.ctx || {};
    const startDateISO =
      ctx.scope?.startDateISO || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();
    const endDateISO = ctx.scope?.endDateISO || new Date().toISOString();

    // Map entities to the expected device format with per-device temperature ranges
    // Each device can have its own ideal range from its customer's SERVER_SCOPE attributes
    const devices = selectedEntities.map((entity) => {
      // Get temperature range for this specific device/customer
      const min = entity.minTemperature ?? entity.temperatureMin ?? entity.tempMin;
      const max = entity.maxTemperature ?? entity.temperatureMax ?? entity.tempMax;

      return {
        id: entity.id || entity.entityId,
        label: entity.name || entity.label || entity.id,
        tbId: entity.tbId || entity.entityId,
        customerName: entity.customerTitle || entity.customerName || entity.customer || null,
        temperatureMin: min !== undefined && min !== null ? Number(min) : undefined,
        temperatureMax: max !== undefined && max !== null ? Number(max) : undefined,
      };
    });

    // Check if devices have different temperature ranges (different customers)
    const uniqueRanges = new Set(
      devices
        .filter((d) => d.temperatureMin !== undefined && d.temperatureMax !== undefined)
        .map((d) => `${d.temperatureMin}-${d.temperatureMax}`)
    );

    if (uniqueRanges.size > 1) {
      LogHelper.log(
        '[MyIO Footer] Devices have different temperature ranges (multiple customers):',
        devices.map((d) => ({
          label: d.label,
          customer: d.customerName,
          range: `${d.temperatureMin}-${d.temperatureMax}`,
        }))
      );
    }

    // Fallback global range from ctx.scope (if no per-device ranges)
    let globalTemperatureMin = null;
    let globalTemperatureMax = null;

    if (ctx.scope?.minTemperature !== undefined) {
      globalTemperatureMin = Number(ctx.scope.minTemperature);
    }
    if (ctx.scope?.maxTemperature !== undefined) {
      globalTemperatureMax = Number(ctx.scope.maxTemperature);
    }

    LogHelper.log('[MyIO Footer] Temperature ranges:', {
      perDevice: devices.map((d) => ({ label: d.label, min: d.temperatureMin, max: d.temperatureMax })),
      global: { min: globalTemperatureMin, max: globalTemperatureMax },
    });

    // Use MyIOLibrary.openTemperatureComparisonModal
    const MyIOLibrary = window.MyIOLibrary;
    if (!MyIOLibrary?.openTemperatureComparisonModal) {
      LogHelper.error('[MyIO Footer] MyIOLibrary.openTemperatureComparisonModal not available');
      window.alert('Componente de comparação de temperatura não disponível.');
      return;
    }

    try {
      MyIOLibrary.openTemperatureComparisonModal({
        token: jwtToken,
        devices: devices,
        startDate: startDateISO,
        endDate: endDateISO,
        theme: 'dark',
        locale: 'pt-BR',
        granularity: 'hour',
        // Global fallback range (used only if devices don't have individual ranges)
        temperatureMin: globalTemperatureMin,
        temperatureMax: globalTemperatureMax,
      });

      LogHelper.log('[MyIO Footer] Temperature comparison modal opened via MyIOLibrary');
    } catch (error) {
      LogHelper.error('[MyIO Footer] Error opening temperature comparison modal:', error);
      window.alert('Erro ao abrir modal de comparação de temperatura: ' + error.message);
    }
  },

  /**
   * Manipulador de clique para o botão "Compare"
   */
  onCompareClick() {
    this.openComparisonModal();
  },

  /**
   * Manipulador de clique para o botão "Clear" (limpar tudo)
   */
  onClearClick() {
    const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
    if (MyIOSelectionStore) {
      LogHelper.log('[MyIO Footer] Clearing all selections');
      MyIOSelectionStore.clear();
    }
  },

  /**
   * Manipulador de evento 'drop'
   */
  onDrop(e) {
    e.preventDefault();
    const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
    if (MyIOSelectionStore) {
      const id = e.dataTransfer?.getData('text/myio-id') || e.dataTransfer?.getData('text/plain');
      if (id) {
        MyIOSelectionStore.add(id);
      }
    }
  },

  /**
   * Limpa o widget, removendo listeners e elementos do DOM
   */
  destroy() {
    if (!this.initialized) return;

    // 1. Remove listeners da store externa
    try {
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
      if (MyIOSelectionStore) {
        MyIOSelectionStore.off('selection:change', this.boundRenderDock);
        MyIOSelectionStore.off('selection:totals', this.boundRenderDock);
        MyIOSelectionStore.off('selection:limit-reached', this.boundLimitReached);
      }
    } catch (e) {
      LogHelper.warn('MyIO Footer: Error during listener cleanup.', e);
    }

    // Remove o alerta se estiver visível
    this.hideLimitAlert();

    // 2. Remove listeners do DOM interno
    if (this.$compareBtn) {
      this.$compareBtn.removeEventListener('click', this.boundCompareClick);
    }
    if (this.$clearBtn) {
      this.$clearBtn.removeEventListener('click', this.boundClearClick);
    }
    if (this.$dock) {
      this.$dock.removeEventListener('click', this.boundChipClick);
    }
    if (this.$footerEl) {
      this.$footerEl.removeEventListener('dragover', this.boundDragOver);
      this.$footerEl.removeEventListener('drop', this.boundDrop);
    }

    // 3. Remove listener do evento de mudança de aba do MENU
    if (this.boundDashboardStateChange) {
      window.removeEventListener('myio:dashboard-state', this.boundDashboardStateChange);
    }

    // 3. Limpa conteúdo (mas não remove elementos, pois são do template.html do ThingsBoard)
    if (this.$dock) this.$dock.innerHTML = '';
    if (this.$totals) this.$totals.textContent = '0 selecionados';

    // 4. Reseta o estado interno
    this.initialized = false;
    this.$root = null;
    this.$footerEl = null;
    this.$dock = null;
    this.$totals = null;
    this.$clearBtn = null;
    this.$compareBtn = null;
  },
};

// CRITICAL DEBUG: Log immediately to confirm script is loaded
LogHelper.log('[FOOTER] 🔵 Script carregado em:', new Date().toISOString());
LogHelper.log('[FOOTER] self object:', typeof self);
LogHelper.log('[FOOTER] self.ctx:', !!self?.ctx);

// --- 4. Hooks do Ciclo de Vida do Widget ---

self.onInit = function () {
  LogHelper.log('[FOOTER] 🟢 onInit chamado!');
  LogHelper.log('[FOOTER] self.ctx:', self.ctx);
  LogHelper.log('[FOOTER] self.ctx.$container:', self.ctx?.$container);
  LogHelper.log('[FOOTER] self.ctx.$container[0]:', self.ctx?.$container?.[0]);
  LogHelper.log('[FOOTER] MyIOLibrary disponível:', !!window.MyIOLibrary);
  LogHelper.log(
    '[FOOTER] SelectionStore disponível:',
    !!(window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore)
  );

  // Passa o contexto do widget (self.ctx) para o controlador
  try {
    footerController.init(self.ctx);
    LogHelper.log('[FOOTER] ✅ Inicialização completa!');
  } catch (error) {
    console.error('[FOOTER] ❌ Erro durante inicialização:', error);
    console.error('[FOOTER] Stack trace:', error.stack);
  }
};

self.onDestroy = function () {
  footerController.destroy();
};
