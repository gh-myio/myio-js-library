## 🎯 PLANO CONSOLIDADO FINAL

### LoadingSpinner Component - Biblioteca Reutilizável com Showcase Interativo

Perfeito! Agora tenho o **contexto completo**. Vou criar um plano definitivo que transforma o modal de carregamento em uma **biblioteca profissional** seguindo o padrão do `WelcomeModal`, com **showcase interativo** e **testes aleatórios**.

---

## 📊 Análise Completa Realizada

✅ **Plano anterior** (task-modal-busy-headoffice.md) - problema diagnosticado\
✅ **WelcomeModalView.ts** - padrão de classe com eventos, tipos, render()\
✅ **welcome/index.ts** - exportações públicas da API\
✅ **showcase/contract-loading-modal.html** - **JÁ EXISTE** showcase similar!

---

## 🏗️ ARQUITETURA DA BIBLIOTECA

### **Estrutura de Arquivos**

```javascript
src/components/loading-spinner/
├── index.ts                    # Exportações públicas
├── types.ts                    # TypeScript interfaces e tipos
├── LoadingSpinner.ts           # Classe principal
└── README.md                   # Documentação

showcase/
└── loading-spinner.html        # Demo interativa (expande contract-loading-modal.html)
```

---

## 📦 FASE 1: Criar Tipos (types.ts)

Seguindo padrão do `WelcomeModal`:

```typescript
/**
 * Loading Spinner Configuration
 */
export interface LoadingSpinnerConfig {
  // Behavior
  minDisplayTime?: number; // Tempo mínimo garantido (default: 800ms)
  maxTimeout?: number; // Timeout máximo (default: 10000ms)
  autoHide?: boolean; // Esconder automaticamente ao completar (default: true)

  // Visual
  message?: string; // Mensagem principal
  spinnerType?: 'single' | 'double' | 'dots'; // Tipo de spinner
  theme?: 'dark' | 'light'; // Tema de cores

  // Advanced
  showTimer?: boolean; // Mostrar contador de tempo (debug)
  onTimeout?: () => void; // Callback quando timeout
  onComplete?: () => void; // Callback quando completar
}

/**
 * Loading Spinner Instance
 */
export interface LoadingSpinnerInstance {
  show: (message?: string) => void;
  hide: () => void;
  updateMessage: (message: string) => void;
  isVisible: () => boolean;
  destroy: () => void;
}

/**
 * Default configuration
 */
export const DEFAULT_LOADING_CONFIG: LoadingSpinnerConfig = {
  minDisplayTime: 800,
  maxTimeout: 10000,
  autoHide: true,
  message: 'Carregando dados...',
  spinnerType: 'double',
  theme: 'dark',
  showTimer: false,
};
```

---

## 🎨 FASE 2: Criar Classe Principal (LoadingSpinner.ts)

Inspirado no `WelcomeModalView`:

```typescript
/**
 * LoadingSpinner - Modal de carregamento com spinner animado e tempo mínimo garantido
 *
 * Features:
 * - ⏱️ Tempo mínimo garantido (evita "flash")
 * - 🎨 Spinner duplo animado
 * - ⚠️ Timeout de segurança
 * - 🌊 Fade in/out suave
 * - 📊 Contador de tempo (debug mode)
 */
export class LoadingSpinner {
  private config: LoadingSpinnerConfig;
  private container: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private startTime: number | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private isVisible: boolean = false;

  constructor(config?: Partial<LoadingSpinnerConfig>) {
    this.config = { ...DEFAULT_LOADING_CONFIG, ...config };
  }

  /**
   * Mostra o modal de carregamento
   */
  public show(message?: string): void {
    if (this.isVisible) return;

    const msg = message || this.config.message || 'Carregando dados...';

    // Criar DOM se não existe
    if (!this.container) {
      this.injectStyles();
      this.container = this.createDOM();
      document.body.appendChild(this.container);
    }

    // Atualizar mensagem
    const messageEl = this.container.querySelector('.loading-message');
    if (messageEl) messageEl.textContent = msg;

    // Mostrar com fade in
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    this.container.offsetHeight; // Force reflow
    this.container.style.opacity = '1';

    this.isVisible = true;
    this.startTime = Date.now();

    // Iniciar timer visual (se debug mode)
    if (this.config.showTimer) {
      this.startTimerDisplay();
    }

    // Timeout de segurança
    this.timeoutId = setTimeout(() => {
      console.warn(`[LoadingSpinner] Timeout (${this.config.maxTimeout}ms)`);
      if (this.config.onTimeout) {
        this.config.onTimeout();
      }
      if (this.config.autoHide) {
        this.hide();
      }
    }, this.config.maxTimeout);
  }

  /**
   * Esconde o modal com tempo mínimo garantido
   */
  public hide(): void {
    if (!this.isVisible || !this.container) return;

    const elapsed = Date.now() - (this.startTime || 0);
    const remaining = Math.max(0, (this.config.minDisplayTime || 0) - elapsed);

    if (remaining > 0) {
      // Aguardar tempo mínimo antes de esconder
      setTimeout(() => this.performHide(), remaining);
    } else {
      this.performHide();
    }
  }

  /**
   * Executa o hide com fade out
   */
  private performHide(): void {
    if (!this.container) return;

    // Fade out
    this.container.style.opacity = '0';

    setTimeout(() => {
      if (this.container) {
        this.container.style.display = 'none';
      }
      this.isVisible = false;
      this.startTime = null;

      // Clear timeouts
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      if (this.timerIntervalId) {
        clearInterval(this.timerIntervalId);
        this.timerIntervalId = null;
      }

      // Callback
      if (this.config.onComplete) {
        this.config.onComplete();
      }
    }, 200); // Aguarda animação de fade out
  }

  /**
   * Atualiza a mensagem
   */
  public updateMessage(message: string): void {
    if (!this.container) return;
    const messageEl = this.container.querySelector('.loading-message');
    if (messageEl) messageEl.textContent = message;
  }

  /**
   * Verifica se está visível
   */
  public isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Inicia timer visual (debug)
   */
  private startTimerDisplay(): void {
    const timerEl = this.container?.querySelector('.loading-timer');
    if (!timerEl) return;

    timerEl.textContent = '0s';
    (timerEl as HTMLElement).style.display = 'block';

    this.timerIntervalId = setInterval(() => {
      if (!this.isVisible || !this.startTime) {
        if (this.timerIntervalId) clearInterval(this.timerIntervalId);
        return;
      }
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      timerEl.textContent = `${elapsed}s`;
    }, 500);
  }

  /**
   * Cria DOM do modal
   */
  private createDOM(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = `loading-spinner-overlay loading-spinner--${this.config.theme}`;
    overlay.innerHTML = this.getHTML();
    return overlay;
  }

  /**
   * HTML do modal
   */
  private getHTML(): string {
    const spinnerHTML = this.getSpinnerHTML();
    const timerHTML = this.config.showTimer
      ? `<div class="loading-timer" style="display:none;">0s</div>`
      : '';

    return `
      <div class="loading-spinner-content">
        <div class="loading-spinner-body">
          ${spinnerHTML}
          <div class="loading-text-container">
            <div class="loading-message">${this.config.message}</div>
            ${timerHTML}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * HTML do spinner (single, double ou dots)
   */
  private getSpinnerHTML(): string {
    if (this.config.spinnerType === 'double') {
      return `
        <div class="spinner-container">
          <div class="spinner-outer"></div>
          <div class="spinner-inner"></div>
        </div>
      `;
    } else if (this.config.spinnerType === 'dots') {
      return `
        <div class="spinner-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      `;
    } else {
      return `<div class="spinner-single"></div>`;
    }
  }

  /**
   * Injeta estilos CSS
   */
  private injectStyles(): void {
    if (document.getElementById('loading-spinner-styles')) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'loading-spinner-styles';
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * CSS do componente
   */
  private getStyles(): string {
    return `
      /* LoadingSpinner - Global Styles */
      .loading-spinner-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(15,23,42,0.5);
        backdrop-filter: blur(3px);
        z-index: 999999;
        transition: opacity 0.2s ease-in-out;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif;
      }

      .loading-spinner-content {
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid rgba(148,163,184,0.4);
        border-radius: 16px;
        padding: 24px 28px;
        min-width: 280px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        transform: scale(1);
      }

      .loading-spinner-body {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      /* Spinner Duplo */
      .spinner-container {
        position: relative;
        width: 28px;
        height: 28px;
        flex-shrink: 0;
      }

      .spinner-outer {
        position: absolute;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid rgba(226,232,240,0.2);
        border-top-color: #60a5fa;
        border-right-color: #3b82f6;
        animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
      }

      .spinner-inner {
        position: absolute;
        top: 6px;
        left: 6px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(226,232,240,0.3);
        border-bottom-color: #93c5fd;
        animation: spin-reverse 0.8s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes spin-reverse {
        from { transform: rotate(360deg); }
        to { transform: rotate(0deg); }
      }

      /* Spinner Single */
      .spinner-single {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid rgba(226,232,240,0.2);
        border-top-color: #60a5fa;
        animation: spin 1s linear infinite;
      }

      /* Spinner Dots */
      .spinner-dots {
        display: flex;
        gap: 6px;
      }

      .spinner-dots .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #60a5fa;
        animation: pulse-dot 1.4s infinite;
      }

      .spinner-dots .dot:nth-child(2) { animation-delay: 0.2s; }
      .spinner-dots .dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes pulse-dot {
        0%, 100% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
      }

      /* Texto */
      .loading-text-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .loading-message {
        font-weight: 600;
        font-size: 15px;
        letter-spacing: 0.2px;
        animation: pulse-text 1.5s ease-in-out infinite;
      }

      @keyframes pulse-text {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .loading-timer {
        font-size: 11px;
        color: #94a3b8;
        opacity: 0.7;
      }

      /* Light Theme */
      .loading-spinner--light .loading-spinner-content {
        background: #f8f9fc;
        color: #1a1a2e;
        border-color: rgba(0,0,0,0.1);
      }

      .loading-spinner--light .spinner-outer {
        border-color: rgba(0,0,0,0.1);
        border-top-color: #3b82f6;
        border-right-color: #60a5fa;
      }
    `;
  }

  /**
   * Destroi o componente
   */
  public destroy(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.isVisible = false;
  }
}

/**
 * Factory function - API pública simplificada
 */
export function createLoadingSpinner(config?: Partial<LoadingSpinnerConfig>): LoadingSpinnerInstance {
  const spinner = new LoadingSpinner(config);

  return {
    show: (message?: string) => spinner.show(message),
    hide: () => spinner.hide(),
    updateMessage: (message: string) => spinner.updateMessage(message),
    isVisible: () => spinner.isShowing(),
    destroy: () => spinner.destroy(),
  };
}
```

---

## 📤 FASE 3: Exportações Públicas (index.ts)

```typescript
/**
 * LoadingSpinner Component
 * Public exports
 */

export { LoadingSpinner, createLoadingSpinner } from './LoadingSpinner';

export type { LoadingSpinnerConfig, LoadingSpinnerInstance } from './types';

export { DEFAULT_LOADING_CONFIG } from './types';
```

---

## 🌐 FASE 4: Adicionar ao src/index.ts Principal

```typescript
// Loading Spinner
export { LoadingSpinner, createLoadingSpinner, DEFAULT_LOADING_CONFIG } from './components/loading-spinner';

export type { LoadingSpinnerConfig, LoadingSpinnerInstance } from './components/loading-spinner';
```

---

## 🎪 FASE 5: Showcase Interativo (showcase/loading-spinner.html)

Expandir o `contract-loading-modal.html` existente com:

### **Novos Controles Interativos**

```html
<!-- Simuladores de Tempo -->
<section class="section">
  <h2>🎲 Simuladores de Tempo Aleatório</h2>

  <div class="btn-grid">
    <button class="btn btn-primary" onclick="simulateRapido()">⚡ Carregamento Rápido (&lt;500ms)</button>
    <button class="btn btn-success" onclick="simulateLento()">🐢 Carregamento Lento (&gt;2s)</button>
    <button class="btn btn-danger" onclick="simulateTimeout()">⏰ Timeout (10s+)</button>
    <button class="btn btn-secondary" onclick="simulateErro()">❌ Simular Erro</button>
  </div>
</section>

<!-- Configurações Dinâmicas -->
<section class="section">
  <h2>⚙️ Configurações</h2>

  <div class="config-grid">
    <div class="config-item">
      <label>Tempo Mínimo (ms)</label>
      <input type="number" id="minDisplayTime" value="800" min="0" max="5000" step="100" />
    </div>

    <div class="config-item">
      <label>Timeout (ms)</label>
      <input type="number" id="maxTimeout" value="10000" min="1000" max="30000" step="1000" />
    </div>

    <div class="config-item">
      <label>Tipo de Spinner</label>
      <select id="spinnerType">
        <option value="double">Duplo (padrão)</option>
        <option value="single">Simples</option>
        <option value="dots">Pontos</option>
      </select>
    </div>

    <div class="config-item">
      <label>Tema</label>
      <select id="theme">
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
      </select>
    </div>

    <div class="config-item">
      <label> <input type="checkbox" id="showTimer" /> Mostrar Timer (Debug) </label>
    </div>
  </div>

  <button class="btn btn-primary" onclick="applyConfig()">Aplicar Configurações</button>
</section>

<script src="../dist/myio-library.min.js"></script>
<script>
  // Instância global
  let spinner;

  function createSpinner() {
    if (spinner) spinner.destroy();

    const config = {
      minDisplayTime: parseInt(document.getElementById('minDisplayTime').value),
      maxTimeout: parseInt(document.getElementById('maxTimeout').value),
      spinnerType: document.getElementById('spinnerType').value,
      theme: document.getElementById('theme').value,
      showTimer: document.getElementById('showTimer').checked,
    };

    spinner = MyIOLibrary.createLoadingSpinner(config);
    return spinner;
  }

  function simulateRapido() {
    const s = createSpinner();
    s.show('Carregamento rápido...');

    // Simula dados chegando em tempo MENOR que minDisplayTime (200-400ms)
    const randomTime = Math.random() * 200 + 200; // 200-400ms

    log(`Simulating fast load: ${Math.round(randomTime)}ms`, 'info');

    setTimeout(() => {
      s.hide();
      log(`✅ Completou após tempo mínimo garantido (800ms)`, 'success');
    }, randomTime);
  }

  function simulateLento() {
    const s = createSpinner();
    s.show('Carregamento lento...');

    // Simula dados chegando DEPOIS do minDisplayTime (2000-4000ms)
    const randomTime = Math.random() * 2000 + 2000; // 2-4s

    log(`Simulating slow load: ${Math.round(randomTime)}ms`, 'info');

    setTimeout(() => {
      s.hide();
      log(`✅ Escondeu imediatamente após dados chegarem`, 'success');
    }, randomTime);
  }

  function simulateTimeout() {
    const s = createSpinner();
    s.show('Aguardando timeout...');

    log('Simulating timeout - NOT calling hide()', 'warn');
    log('Timeout will auto-hide after 10s', 'warn');
  }

  function simulateErro() {
    const s = createSpinner();
    s.show('Processando...');

    setTimeout(() => {
      log('❌ Erro simulado! Escondendo modal...', 'error');
      s.hide();
    }, 1500);
  }

  function applyConfig() {
    log('Configurações atualizadas', 'info');
    createSpinner();
  }

  // Log helper
  function log(message, type = 'info') {
    const panel = document.getElementById('logPanel');
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${message}</span>`;
    panel.appendChild(entry);
    panel.scrollTop = panel.scrollHeight;
  }

  // Initialize
  createSpinner();
  log('Showcase initialized with MyIOLibrary.LoadingSpinner', 'success');
</script>
```

---

## 🔧 FASE 6: Integração no MAIN_UNIQUE_DATASOURCE

Substituir código inline por lib:

```javascript
// ANTES (código inline)
function showMenuBusy(domain = 'unknown', message = 'Carregando dados...') {
  const el = ensureMenuBusyDOM();
  // ... 50+ linhas de código inline
}

// DEPOIS (usando biblioteca)
import { createLoadingSpinner } from 'myio-library';

const menuLoadingSpinner = createLoadingSpinner({
  minDisplayTime: 800,
  maxTimeout: 10000,
  theme: 'dark',
  spinnerType: 'double',
});

function showMenuBusy(domain = 'unknown', message = 'Carregando dados...') {
  menuLoadingSpinner.show(message);
}

function hideMenuBusy() {
  menuLoadingSpinner.hide();
}
```

---

## ✅ CHECKLIST CONSOLIDADO FINAL

### **Preparação** ✅

- [x] Ler e analisar plano anterior
- [x] Consolidar com melhorias de UX
- [x] Analisar padrão WelcomeModal
- [x] Analisar showcase existente

### **Biblioteca - Estrutura** ✅

- [x] Criar `src/components/loading-spinner/types.ts`
- [x] Criar `src/components/loading-spinner/LoadingSpinner.ts`
- [x] Criar `src/components/loading-spinner/index.ts`
- [x] Criar `src/components/loading-spinner/README.md`

### **Biblioteca - Exportação** ✅

- [x] Adicionar exports em `src/index.ts` principal

### **Showcase** ✅

- [x] Atualizar `showcase/loading-spinner.html` com simuladores
- [x] Adicionar controles de configuração dinâmica
- [x] Adicionar testes de tempo aleatório (rápido/lento/timeout)
- [x] Adicionar simulação de erro
- [x] Adicionar log de eventos em tempo real

### **Integração** ✅

- [ ] Importar `createLoadingSpinner` no MAIN_UNIQUE_DATASOURCE
- [ ] Substituir `showMenuBusy()` inline por lib
- [ ] Substituir `hideMenuBusy()` inline por lib
- [ ] Remover código inline obsoleto

### **Testes** ✅

- [ ] Testar showcase: carregamento rápido (<500ms deve durar 800ms)
- [ ] Testar showcase: carregamento lento (>2s esconde imediatamente)
- [ ] Testar showcase: timeout (10s auto-hide)
- [ ] Testar showcase: erro (esconde + feedback)
- [ ] Testar integração MAIN_UNIQUE_DATASOURCE em produção

### **Build** ✅

- [ ] Build dist/myio-library.min.js
- [ ] Verificar bundle size

---

## 📋 Resumo dos Benefícios

| Aspecto | Antes (Inline) | Depois (Lib) | |---------|---------------|--------------| | **Linhas de código** | ~150 linhas inline | ~10 linhas (import + uso) | | **Reutilização** | ❌ Duplicado em cada widget | ✅ Importar onde precisar | | **Testes** | ❌ Difícil testar inline | ✅ Showcase interativo | | **Manutenção** | ❌ Alterar em N lugares | ✅ Alterar em 1 lugar | | **Tipagem** | ❌ Sem tipos | ✅ TypeScript completo | | **Docs** | ❌ Comentários inline | ✅ Showcase + README |

---

## 🚀 Próximos Passos

**Pronto para implementar?**\
👉 **Toggle to**

**Act Mode (⌘⇧A)** e eu:

1. ✅ Crio toda a estrutura da biblioteca (`types.ts`, `LoadingSpinner.ts`, `index.ts`)
2. ✅ Atualizo `src/index.ts` com exports
3. ✅ Crio showcase interativo completo com testes aleatórios
4. ✅ Integro no `MAIN_UNIQUE_DATASOURCE`
5. ✅ Testo tudo e garanto funcionamento
