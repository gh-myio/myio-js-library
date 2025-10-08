/* eslint-disable no-undef, no-unused-vars */
(function (self) {
  /**
   * FOOTER WIDGET - MYIO Selection Dock
   * - Injects CSS and HTML dynamically
   * - Depends on MyIOLibrary (external script)
   * - Listens to MyIOSelectionStore for selection changes
   */

  // Debug configuration
  const DEBUG_ACTIVE = true;

  // LogHelper utility
  const LogHelper = {
    log: function(...args) {
      if (DEBUG_ACTIVE) {
        console.log('[FOOTER]', ...args);
      }
    },
    warn: function(...args) {
      if (DEBUG_ACTIVE) {
        console.warn('[FOOTER]', ...args);
      }
    },
    error: function(...args) {
      if (DEBUG_ACTIVE) {
        console.error('[FOOTER]', ...args);
      }
    }
  };

  // URL da biblioteca externa
  const MYIO_SCRIPT_URL =
    "https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js";

  // --- CSS Template ---
  const FOOTER_CSS = `
/* ===== MYIO Premium Footer - Design System ===== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.myio-footer-widget {
  /* --- Premium Dark Theme Variables --- */
  --footer-primary: #00e09e;
  --footer-primary-glow: rgba(0, 224, 158, 0.4);
  --footer-bg-start: #1a1f35;
  --footer-bg-end: #0a0e1a;
  --footer-text: #ffffff;
  --footer-text-dim: rgba(255, 255, 255, 0.65);
  --footer-border: rgba(255, 255, 255, 0.08);
  --footer-shadow: 0 -12px 48px rgba(0, 0, 0, 0.6);
  --footer-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  /* --- Layout - Ocupa 100% do container --- */
  position: relative !important;
  width: 100% !important;
  height: 60px !important;
  margin: 0 !important;
  padding: 0 24px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;

  /* --- Display Grid --- */
  display: grid !important;
  grid-template-columns: 1fr auto !important;
  align-items: center !important;
  gap: 20px !important;

  /* --- Premium Design --- */
  background: linear-gradient(135deg, var(--footer-bg-start) 0%, var(--footer-bg-end) 100%) !important;
  box-shadow: var(--footer-shadow) !important;
  border-top: 2px solid var(--footer-primary) !important;
  border-radius: 0 !important;
  backdrop-filter: blur(10px) !important;

  /* --- Typography --- */
  color: var(--footer-text) !important;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;

  /* --- Animation --- */
  transition: var(--footer-transition) !important;
}

/* Premium accent shimmer line */
.myio-footer-widget::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--footer-primary) 20%,
    #00b4d8 50%,
    var(--footer-primary) 80%,
    transparent 100%
  );
  animation: shimmer 3s ease-in-out infinite;
  z-index: 1;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Visual feedback when dragging */
.myio-footer-widget.drag-over {
  border-top: 3px solid var(--footer-primary) !important;
  box-shadow: 0 -12px 48px var(--footer-primary-glow), var(--footer-shadow) !important;
  background: linear-gradient(135deg,
    rgba(0, 224, 158, 0.1) 0%,
    var(--footer-bg-start) 50%,
    var(--footer-bg-end) 100%
  ) !important;
}

.myio-footer-widget.drag-over::before {
  height: 3px;
  animation: pulse-glow 0.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.7;
    filter: brightness(1.5);
  }
}

/* ===== Dock Area ===== */
.myio-dock {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding: 0 !important;
  height: 100% !important;

  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--footer-primary) rgba(255, 255, 255, 0.05);
}

.myio-dock::-webkit-scrollbar {
  height: 4px;
}

.myio-dock::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.myio-dock::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, var(--footer-primary), #00b4d8);
  border-radius: 2px;
  transition: var(--footer-transition);
}

.myio-dock::-webkit-scrollbar-thumb:hover {
  background: var(--footer-primary);
}

/* ===== Chip Cards (Premium Design) ===== */
.myio-chip {
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 16px !important;
  border-radius: 24px !important;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  white-space: nowrap !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
  color: var(--footer-text) !important;
  transition: var(--footer-transition) !important;
  cursor: default !important;
  position: relative !important;
  overflow: hidden !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

/* Chip premium shine effect */
.myio-chip::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.myio-chip:hover {
  background: linear-gradient(135deg, rgba(0, 224, 158, 0.15) 0%, rgba(0, 180, 216, 0.1) 100%) !important;
  border-color: var(--footer-primary) !important;
  transform: translateY(-2px) scale(1.02) !important;
  box-shadow: 0 6px 20px rgba(0, 224, 158, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

.myio-chip:hover::before {
  left: 100%;
}

.myio-chip-icon {
  font-size: 16px !important;
  color: var(--footer-primary) !important;
  filter: drop-shadow(0 0 8px var(--footer-primary-glow)) !important;
  animation: pulse-icon 2s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

/* Chip remove button */
.myio-chip button {
  background: none !important;
  border: none !important;
  color: var(--footer-text-dim) !important;
  cursor: pointer !important;
  padding: 4px !important;
  margin: 0 0 0 4px !important;
  font-size: 18px !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  width: 20px !important;
  height: 20px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  transition: var(--footer-transition) !important;
}

.myio-chip button:hover {
  color: #ff4d4f !important;
  background: rgba(255, 77, 79, 0.15) !important;
  transform: rotate(90deg) scale(1.2) !important;
}

.myio-chip button:active {
  transform: rotate(90deg) scale(0.9) !important;
}

/* ===== Right Controls ===== */
.myio-right {
  display: flex !important;
  align-items: center !important;
  gap: 20px !important;
  padding-left: 20px !important;
  border-left: 1px solid var(--footer-border) !important;
  height: 100% !important;
}

/* Meta info (totals) */
.myio-meta {
  font-variant-numeric: tabular-nums !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  color: var(--footer-text) !important;
  white-space: nowrap !important;
  padding: 8px 16px !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-radius: 8px !important;
  border: 1px solid var(--footer-border) !important;
  letter-spacing: 0.5px !important;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

/* Compare button (Premium CTA) */
.myio-compare {
  position: relative !important;
  height: 44px !important;
  min-width: 120px !important;
  padding: 0 24px !important;
  border-radius: 22px !important;
  border: none !important;
  background: linear-gradient(135deg, var(--footer-primary) 0%, #00b4d8 100%) !important;
  color: #0a0e1a !important;
  font-weight: 700 !important;
  font-size: 14px !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
  cursor: pointer !important;
  transition: var(--footer-transition) !important;
  box-shadow: 0 4px 16px var(--footer-primary-glow) !important;
  overflow: hidden !important;
}

.myio-compare::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.myio-compare:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 24px var(--footer-primary-glow), 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  background: linear-gradient(135deg, #00ffb5 0%, #00e09e 100%) !important;
}

.myio-compare:hover:not(:disabled)::before {
  transform: translateX(100%);
}

.myio-compare:active:not(:disabled) {
  transform: translateY(0) scale(0.98) !important;
  box-shadow: 0 2px 8px var(--footer-primary-glow) !important;
}

.myio-compare:disabled {
  opacity: 0.4 !important;
  cursor: not-allowed !important;
  background: rgba(255, 255, 255, 0.1) !important;
  color: var(--footer-text-dim) !important;
  box-shadow: none !important;
  transform: none !important;
}

/* Empty state */
.myio-empty {
  color: var(--footer-text-dim) !important;
  font-size: 13px !important;
  font-style: italic !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.myio-empty::before {
  content: '↓';
  font-size: 18px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ===== Responsive Design ===== */
@media (max-width: 1024px) {
  .myio-footer-widget {
    max-height: none !important;
    height: auto !important;
    grid-template-columns: 1fr !important;
    padding: 12px 16px !important;
    gap: 12px !important;
  }

  .myio-right {
    border-left: none !important;
    border-top: 1px solid var(--footer-border) !important;
    padding-left: 0 !important;
    padding-top: 12px !important;
    width: 100% !important;
    justify-content: space-between !important;
  }

  .myio-dock {
    width: 100% !important;
    height: auto !important;
  }

  .myio-right {
    height: auto !important;
  }
}

@media (max-width: 640px) {
  .myio-footer-widget {
    padding: 10px 12px !important;
  }

  .myio-chip {
    font-size: 12px !important;
    padding: 8px 12px !important;
  }

  .myio-meta {
    font-size: 12px !important;
    padding: 6px 12px !important;
  }

  .myio-compare {
    height: 38px !important;
    min-width: 100px !important;
    font-size: 12px !important;
    padding: 0 16px !important;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .myio-footer-widget {
    --footer-bg-start: #000000;
    --footer-bg-end: #0a0e1a;
  }
}
`;

  // --- HTML Template ---
  const FOOTER_HTML = `
<section class="myio-footer-widget">
  <div class="myio-dock" id="myioDock" aria-live="polite"></div>
  <div class="myio-right">
    <div class="myio-meta" id="myioTotals">0 selecionados</div>
    <button id="myioCompare" class="myio-compare" disabled>Compare</button>
  </div>
</section>
`;

  // --- Controlador do Footer (Objeto encapsulado) ---
  const footerController = {
    $root: null,
    $footerEl: null,
    $dock: null,
    $totals: null,
    $compareBtn: null,
    initialized: false,
    styleId: 'myio-footer-styles',

    // Armazena referências às funções com 'this' vinculado para remoção segura
    boundRenderDock: null,
    boundCompareClick: null,
    boundDragOver: null,
    boundDrop: null,
    boundDragEnter: null,
    boundDragLeave: null,
    boundChipClick: null,

    /**
     * Inicializa o controlador
     */
    init(ctx) {
      if (this.initialized) {
        LogHelper.log("Footer: Already initialized, skipping");
        return;
      }

      this.$root = ctx?.$container?.[0];
      if (!this.$root) {
        LogHelper.error("MyIO Footer: Root container not found.");
        return;
      }

      LogHelper.log("Footer: Initializing...");

      // Inject CSS (apenas uma vez)
      this.injectCSS();

      // Inject HTML (verifica se já existe)
      this.injectHTML();

      // Load library and setup
      this.ensureLibraryLoaded(() => {
        this.queryDOMElements();

        // Só faz bind de eventos se não estiver inicializado
        if (!this.initialized) {
          this.bindEvents();
          this.renderDock();
          this.initialized = true;
          LogHelper.log("Footer: Initialized successfully");
        }
      });
    },

    /**
     * Injeta o CSS na página
     */
    injectCSS() {
      // Remove CSS anterior se existir
      const existingStyle = document.getElementById(this.styleId);
      if (existingStyle) {
        existingStyle.remove();
      }

      // Cria e injeta novo CSS
      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = FOOTER_CSS;
      document.head.appendChild(style);
      LogHelper.log("Footer: CSS injected");
    },

    /**
     * Injeta o HTML no container
     */
    injectHTML() {
      if (!this.$root) return;

      // Verifica se já existe o HTML injetado
      const existingWidget = this.$root.querySelector('.myio-footer-widget');
      if (existingWidget) {
        LogHelper.log("Footer: HTML already exists, skipping injection");
        return;
      }

      this.$root.innerHTML = FOOTER_HTML;
      LogHelper.log("Footer: HTML injected");
    },

    /**
     * Garante que a MyIOLibrary esteja carregada
     */
    ensureLibraryLoaded(onReady) {
      if (window.MyIOLibrary) {
        return onReady();
      }

      const scriptId = "myio-library-script";
      let existingScript = document.getElementById(scriptId);

      if (existingScript) {
        existingScript.addEventListener('load', onReady);
        return;
      }

      const s = document.createElement("script");
      s.id = scriptId;
      s.src = MYIO_SCRIPT_URL;
      s.onload = onReady;
      s.onerror = () =>
        LogHelper.error("MyIO Footer: Failed to load MyIOLibrary.");
      document.head.appendChild(s);
    },

    /**
     * Consulta os elementos do DOM
     */
    queryDOMElements() {
      this.$footerEl = this.$root.querySelector(".myio-footer-widget");
      if (!this.$footerEl) {
        LogHelper.error("MyIO Footer: .myio-footer-widget element not found");
        return;
      }
      this.$dock = this.$footerEl.querySelector("#myioDock");
      this.$totals = this.$footerEl.querySelector("#myioTotals");
      this.$compareBtn = this.$footerEl.querySelector("#myioCompare");

      LogHelper.log("Footer: DOM elements found:", {
        footer: !!this.$footerEl,
        dock: !!this.$dock,
        totals: !!this.$totals,
        compareBtn: !!this.$compareBtn
      });
    },

    /**
     * Renderiza o conteúdo do "dock" (chips ou mensagem de vazio)
     */
    renderDock() {
      if (!window.MyIOLibrary || !this.$dock || !this.$totals || !this.$compareBtn) {
        LogHelper.warn("Footer: renderDock skipped - missing dependencies");
        return;
      }

      const { MyIOSelectionStore } = window.MyIOLibrary;
      const selected = MyIOSelectionStore.getSelectedEntities();
      const count = selected.length;
      const totals = MyIOSelectionStore.getMultiUnitTotalDisplay();

      LogHelper.log("Footer: renderDock", {
        selectedCount: count,
        totals: totals
      });

      if (count === 0) {
        const emptyEl = document.createElement("span");
        emptyEl.className = "myio-empty";
        emptyEl.textContent = "Arraste itens para cá ou selecione no card";
        this.$dock.replaceChildren(emptyEl);
      } else {
        const chips = selected.map((ent) => {
          const chip = document.createElement("div");
          chip.className = "myio-chip";

          const icon = document.createElement("span");
          icon.className = "myio-chip-icon";
          icon.textContent = "•";

          const name = document.createElement("span");
          name.textContent = ent.name;

          const removeBtn = document.createElement("button");
          removeBtn.title = `Remover ${ent.name}`;
          removeBtn.setAttribute("aria-label", `Remover ${ent.name}`);
          removeBtn.dataset.entityId = ent.id;
          removeBtn.textContent = "×";

          chip.append(icon, name, removeBtn);
          return chip;
        });
        this.$dock.replaceChildren(...chips);
      }

      this.$totals.textContent =
        count > 0 ? `${count} selecionado(s) | ${totals}` : "0 selecionados";
      this.$compareBtn.disabled = count < 2;
    },

    /**
     * Vincula todos os ouvintes de eventos
     */
    bindEvents() {
      if (!window.MyIOLibrary) return;
      const { MyIOSelectionStore } = window.MyIOLibrary;

      this.boundRenderDock = this.renderDock.bind(this);
      this.boundCompareClick = this.onCompareClick.bind(this);
      this.boundDragOver = this.onDragOver.bind(this);
      this.boundDrop = this.onDrop.bind(this);
      this.boundDragEnter = this.onDragEnter.bind(this);
      this.boundDragLeave = this.onDragLeave.bind(this);
      this.boundChipClick = this.onChipClick.bind(this);

      MyIOSelectionStore.on("selection:change", this.boundRenderDock);
      MyIOSelectionStore.on("selection:totals", this.boundRenderDock);

      if (this.$compareBtn) {
        this.$compareBtn.addEventListener("click", this.boundCompareClick);
      }

      if (this.$dock) {
        this.$dock.addEventListener("click", this.boundChipClick);
      }

      if (this.$footerEl) {
        this.$footerEl.addEventListener("dragover", this.boundDragOver);
        this.$footerEl.addEventListener("dragenter", this.boundDragEnter);
        this.$footerEl.addEventListener("dragleave", this.boundDragLeave);
        this.$footerEl.addEventListener("drop", this.boundDrop);
      }

      LogHelper.log("Footer: Events bound");
    },

    /**
     * Manipulador de clique para o "dock" (delegação)
     */
    onChipClick(e) {
      const removeBtn = e.target.closest("button[data-entity-id]");
      if (removeBtn && window.MyIOLibrary) {
        const id = removeBtn.dataset.entityId;
        window.MyIOLibrary.MyIOSelectionStore.remove(id);
      }
    },

    /**
     * Manipulador de clique para o botão "Compare"
     */
    onCompareClick() {
      if (window.MyIOLibrary) {
        window.MyIOLibrary.MyIOSelectionStore.openComparison();
      }
    },

    /**
     * Visual feedback quando drag entra no footer
     */
    onDragEnter(e) {
      e.preventDefault();
      if (this.$footerEl) {
        this.$footerEl.classList.add('drag-over');
      }
    },

    /**
     * Remove visual feedback quando drag sai do footer
     */
    onDragLeave(e) {
      e.preventDefault();
      if (e.target === this.$footerEl) {
        this.$footerEl.classList.remove('drag-over');
      }
    },

    /**
     * Previne comportamento padrão durante dragover
     */
    onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },

    /**
     * Manipulador de evento 'drop'
     */
    onDrop(e) {
      e.preventDefault();

      if (this.$footerEl) {
        this.$footerEl.classList.remove('drag-over');
      }

      if (window.MyIOLibrary) {
        const id =
          e.dataTransfer?.getData("text/myio-id") ||
          e.dataTransfer?.getData("text/plain");

        if (id) {
          LogHelper.log("Footer: Item dropped with ID:", id);
          window.MyIOLibrary.MyIOSelectionStore.add(id);
        } else {
          LogHelper.warn("Footer: Drop event without valid ID");
        }
      }
    },

    /**
     * Limpa o widget, removendo listeners e elementos do DOM
     */
    destroy() {
      if (!this.initialized) {
        LogHelper.log("Footer: Not initialized, skipping destroy");
        return;
      }

      LogHelper.log("Footer: Destroying...");

      // Remove listeners da store externa
      try {
        const { MyIOSelectionStore } = window.MyIOLibrary || {};
        MyIOSelectionStore?.off?.("selection:change", this.boundRenderDock);
        MyIOSelectionStore?.off?.("selection:totals", this.boundRenderDock);
      } catch (e) {
        LogHelper.warn("Footer: Error during listener cleanup.", e);
      }

      // Remove listeners do DOM
      if (this.$compareBtn) {
        this.$compareBtn.removeEventListener("click", this.boundCompareClick);
      }
      if (this.$dock) {
        this.$dock.removeEventListener("click", this.boundChipClick);
      }
      if (this.$footerEl) {
        this.$footerEl.removeEventListener("dragover", this.boundDragOver);
        this.$footerEl.removeEventListener("dragenter", this.boundDragEnter);
        this.$footerEl.removeEventListener("dragleave", this.boundDragLeave);
        this.$footerEl.removeEventListener("drop", this.boundDrop);
      }

      // NÃO remove CSS (mantém para próxima inicialização)
      // NÃO limpa HTML (mantém o widget visível)

      // Reseta apenas o estado interno
      this.initialized = false;
      this.$root = null;
      this.$footerEl = null;
      this.$dock = null;
      this.$totals = null;
      this.$compareBtn = null;

      LogHelper.log("Footer: Destroyed successfully (HTML/CSS preserved)");
    },
  };

  // --- ThingsBoard Widget Lifecycle Hooks ---

  self.onInit = function () {
    LogHelper.log("Footer: onInit called");
    footerController.init(self.ctx);
  };

  self.onDataUpdated = function () {
    // Footer não recebe dados do ThingsBoard
  };

  self.onResize = function () {
    // Responsividade tratada via CSS
  };

  self.onDestroy = function () {
    LogHelper.log("Footer: onDestroy called");
    footerController.destroy();
  };
})(self);
