  /**
   * NOTA: Este script depende da biblioteca MyIOLibrary.
   *
   * IMPORTANTE: Adicione a biblioteca como Resource no widget do ThingsBoard:
   * Widget Settings > Resources > Add Resource > External Resource:
   * https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
   *
   * Para os ícones, idealmente, você carregaria uma biblioteca como Font Awesome ou Material Icons.
   * Por simplicidade no exemplo, os ícones '•' e '×' são mantidos, mas estilizaremos para parecerem melhores.
   */

  // CRITICAL DEBUG: Log immediately to confirm script is loaded
  console.log('[FOOTER] 🔵 Script carregado em:', new Date().toISOString());
  console.log('[FOOTER] self object:', typeof self);
  console.log('[FOOTER] self.ctx:', !!self?.ctx);

  // Debug configuration
  const DEBUG_ACTIVE = true;

  // LogHelper utility
  const LogHelper = {
    log: function(...args) {
      if (DEBUG_ACTIVE) {
        console.log(...args);
      }
    },
    warn: function(...args) {
      if (DEBUG_ACTIVE) {
        console.warn(...args);
      }
    },
    error: function(...args) {
      if (DEBUG_ACTIVE) {
        console.error(...args);
      }
    }
  };

  // --- 3. Controlador do Footer (Objeto encapsulado) ---
  const footerController = {
    $root: null,
    $footerEl: null,
    $dock: null,
    $totals: null,
    $compareBtn: null,
    initialized: false,

    // Armazena referências às funções com 'this' vinculado para remoção segura
    boundRenderDock: null,
    boundCompareClick: null,
    boundDragOver: null,
    boundDrop: null,
    boundChipClick: null,

    /**
     * Inicializa o controlador
     */
    init(ctx) {
      LogHelper.log("[MyIO Footer] init() called");

      if (this.initialized) {
        LogHelper.log("[MyIO Footer] Already initialized, skipping");
        return;
      }

      this.$root = ctx?.$container?.[0];
      this.ctx = ctx;
      if (!this.$root) {
        LogHelper.error("[MyIO Footer] Root container not found.");
        return;
      }
      LogHelper.log("[MyIO Footer] Root container found");

      // Verifica se a biblioteca MyIOLibrary está carregada via Resources
      if (!window.MyIOLibrary) {
        LogHelper.error(
          "[MyIO Footer] MyIOLibrary not found. " +
          "Please add the library as a Resource in ThingsBoard widget settings:\n" +
          "https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"
        );
        return;
      }
      LogHelper.log("[MyIO Footer] MyIOLibrary found");

      // IMPORTANTE: NÃO chamamos mountTemplate() porque o ThingsBoard já renderizou template.html!
      // this.mountTemplate(); // ← REMOVIDO
      LogHelper.log("[MyIO Footer] Using ThingsBoard template.html (not mounting manually)");

      this.queryDOMElements(); // Consultar elementos do template.html
      LogHelper.log("[MyIO Footer] DOM elements queried:", {
        dock: !!this.$dock,
        totals: !!this.$totals,
        compareBtn: !!this.$compareBtn
      });

      this.bindEvents();
      LogHelper.log("[MyIO Footer] Events bound");

      this.renderDock(); // Renderização inicial
      LogHelper.log("[MyIO Footer] Initial render complete");

      this.initialized = true;
    },

    /**
     * Monta o template do footer no DOM
     */
    mountTemplate() {
      // Cria o elemento principal do footer
      const footerSection = document.createElement("section");
      footerSection.className = "myio-footer";

      // Habilita modo fixo opcional via settings do widget (ctx.settings.fixedFooter)
      try {
        const fixed = !!(this.ctx && this.ctx.settings && this.ctx.settings.fixedFooter);
        if (fixed) footerSection.classList.add('is-fixed');
      } catch (_) { /* noop */ }

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
      this.$footerEl = this.$root.querySelector(".myio-footer");

      if (!this.$footerEl) {
        LogHelper.error("[MyIO Footer] .myio-footer section not found in template!");
        return;
      }

      // Busca os elementos dentro da section
      this.$dock = this.$footerEl.querySelector("#myioDock");
      this.$totals = this.$footerEl.querySelector("#myioTotals");
      this.$compareBtn = this.$footerEl.querySelector("#myioCompare");

      LogHelper.log("[MyIO Footer] Found elements from ThingsBoard template:", {
        $footerEl: this.$footerEl,
        $dock: this.$dock,
        $totals: this.$totals,
        $compareBtn: this.$compareBtn
      });
    },

    /**
     * Renderiza o conteúdo do "dock" (chips ou mensagem de vazio)
     */
    renderDock() {
      LogHelper.log("[MyIO Footer] renderDock() called");

      if (!this.$dock || !this.$totals || !this.$compareBtn) {
        LogHelper.warn("[MyIO Footer] DOM elements not ready:", {
          dock: !!this.$dock,
          totals: !!this.$totals,
          compareBtn: !!this.$compareBtn
        });
        return;
      }

      // Try both window.MyIOLibrary.MyIOSelectionStore and window.MyIOSelectionStore
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;

      if (!MyIOSelectionStore) {
        LogHelper.error("[MyIO Footer] MyIOSelectionStore not found.");
        return;
      }

      const selected = MyIOSelectionStore.getSelectedEntities();
      const count = selected.length;
      const totals = MyIOSelectionStore.getMultiUnitTotalDisplay();

      LogHelper.log("[MyIO Footer] Rendering dock:", {
        count,
        selected,
        totals
      });

      // DEBUG: Log each entity
      LogHelper.log("[MyIO Footer] Selected entities details:");
      selected.forEach((ent, idx) => {
        LogHelper.log(`[MyIO Footer]   Entity ${idx}:`, ent);
      });

      if (count === 0) {
        LogHelper.log("[MyIO Footer] Count is 0, rendering empty message");
        const emptyEl = document.createElement("span");
        emptyEl.className = "myio-empty";
        emptyEl.textContent = "Arraste itens para cá ou selecione no card";
        this.$dock.replaceChildren(emptyEl); // Mais seguro e performático
        LogHelper.log("[MyIO Footer] Empty message rendered");
      } else {
        LogHelper.log(`[MyIO Footer] Count is ${count}, creating chips...`);
        // Cria chips de forma eficiente e segura
        const chips = selected.map((ent, idx) => {
          LogHelper.log(`[MyIO Footer]   Creating chip ${idx} for entity:`, ent);

          if (!ent || !ent.name) {
            LogHelper.error(`[MyIO Footer]   Entity ${idx} is invalid:`, ent);
            return null;
          }

          const chip = document.createElement("div");
          chip.className = "myio-chip";

          // Conteúdo do chip (nome + valor)
          const content = document.createElement("div");
          content.className = "myio-chip-content";

          const name = document.createElement("span");
          name.className = "myio-chip-name";
          name.textContent = ent.name;

          const value = document.createElement("span");
          value.className = "myio-chip-value";
          // Formata o valor com unidade
          const formattedValue = ent.lastValue
            ? `${this._formatValue(ent.lastValue)} ${ent.unit || ''}`.trim()
            : 'Sem dados';
          value.textContent = formattedValue;

          content.append(name, value);

          // Botão de remover
          const removeBtn = document.createElement("button");
          removeBtn.className = "myio-chip-remove";
          removeBtn.title = `Remover ${ent.name}`;
          removeBtn.setAttribute("aria-label", `Remover ${ent.name}`);
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
        }).filter(chip => chip !== null); // Remove null chips

        LogHelper.log(`[MyIO Footer] Total chips created: ${chips.length}`);
        LogHelper.log("[MyIO Footer] About to call replaceChildren with chips:", chips);

        this.$dock.replaceChildren(...chips); // Renderiza todos de uma vez

        LogHelper.log("[MyIO Footer] replaceChildren completed");
        LogHelper.log("[MyIO Footer] $dock.children.length:", this.$dock.children.length);
        LogHelper.log("[MyIO Footer] $dock.innerHTML:", this.$dock.innerHTML);
      }

      // Atualiza totais e botão
      const deviceText = count === 1 ? 'dispositivo' : 'dispositivos';
      const newTotalsText = `${count} ${deviceText}`;

      LogHelper.log(`[MyIO Footer] Updating totals text to: "${newTotalsText}"`);
      this.$totals.textContent = newTotalsText;
      LogHelper.log("[MyIO Footer] Totals updated. Current text:", this.$totals.textContent);

      this.$compareBtn.disabled = count < 2;
      LogHelper.log("[MyIO Footer] renderDock() completed");
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
          maximumFractionDigits: 2
        }).format(value);
      }

      // Para valores pequenos, mostra até 2 casas decimais
      return value.toFixed(2).replace(/\.?0+$/, '');
    },

    /**
     * Vincula todos os ouvintes de eventos
     */
    bindEvents() {
      LogHelper.log("[MyIO Footer] bindEvents() called");

      // DEBUG: Check which SelectionStore instance we're using
      LogHelper.log("[MyIO Footer] window.MyIOLibrary:", !!window.MyIOLibrary);
      LogHelper.log("[MyIO Footer] window.MyIOLibrary.MyIOSelectionStore:", !!window.MyIOLibrary?.MyIOSelectionStore);
      LogHelper.log("[MyIO Footer] window.MyIOSelectionStore:", !!window.MyIOSelectionStore);

      // Try both window.MyIOLibrary.MyIOSelectionStore and window.MyIOSelectionStore
      const fromMyIOLibrary = window.MyIOLibrary?.MyIOSelectionStore;
      const fromWindow = window.MyIOSelectionStore;
      const MyIOSelectionStore = fromMyIOLibrary || fromWindow;

      // DEBUG: Check which reference we're using
      LogHelper.log("[MyIO Footer] Using reference from:", fromMyIOLibrary ? "window.MyIOLibrary.MyIOSelectionStore" : "window.MyIOSelectionStore");
      LogHelper.log("[MyIO Footer] Are they the same instance?", fromMyIOLibrary === fromWindow);

      if (!MyIOSelectionStore) {
        LogHelper.error("[MyIO Footer] MyIOSelectionStore not available for binding events.");
        return;
      }

      // DEBUG: Verify we have the correct instance
      LogHelper.log("[MyIO Footer] Using SelectionStore instance:", MyIOSelectionStore.constructor.name);
      LogHelper.log("[MyIO Footer] SelectionStore has .on method:", typeof MyIOSelectionStore.on);

      // DEBUG: Check hidden global instance
      try {
        const topWindowInstance = window.top.__MyIOSelectionStore_INSTANCE__;
        LogHelper.log("[MyIO Footer] window.top.__MyIOSelectionStore_INSTANCE__ exists:", !!topWindowInstance);
        LogHelper.log("[MyIO Footer] Using same instance as window.top?", MyIOSelectionStore === topWindowInstance);
      } catch (e) {
        LogHelper.warn("[MyIO Footer] Cannot access window.top:", e.message);
      }

      LogHelper.log("[MyIO Footer] Current listeners count before registration:", {
        'selection:change': MyIOSelectionStore.eventListeners?.get('selection:change')?.length || 0,
        'selection:totals': MyIOSelectionStore.eventListeners?.get('selection:totals')?.length || 0
      });

      // 1. Armazena funções vinculadas (para remoção correta)
      this.boundRenderDock = this.renderDock.bind(this);
      this.boundCompareClick = this.onCompareClick.bind(this);
      this.boundDragOver = (e) => e.preventDefault();
      this.boundDrop = this.onDrop.bind(this);
      this.boundChipClick = this.onChipClick.bind(this);

      // 2. Ouve a store externa
      LogHelper.log("[MyIO Footer] About to register selection:change listener...");
      LogHelper.log("[MyIO Footer] MyIOSelectionStore.on function:", MyIOSelectionStore.on);
      LogHelper.log("[MyIO Footer] Calling MyIOSelectionStore.on('selection:change', boundRenderDock)...");
      const result1 = MyIOSelectionStore.on("selection:change", this.boundRenderDock);
      LogHelper.log("[MyIO Footer] Result from .on() call:", result1);

      LogHelper.log("[MyIO Footer] About to register selection:totals listener...");
      const result2 = MyIOSelectionStore.on("selection:totals", this.boundRenderDock);
      LogHelper.log("[MyIO Footer] Result from .on() call:", result2);

      // DEBUG: Verify registration worked
      LogHelper.log("[MyIO Footer] Current listeners count after registration:", {
        'selection:change': MyIOSelectionStore.eventListeners?.get('selection:change')?.length || 0,
        'selection:totals': MyIOSelectionStore.eventListeners?.get('selection:totals')?.length || 0
      });

      LogHelper.log("[MyIO Footer] Registered listeners on SelectionStore");

      // 3. Ouve elementos do DOM interno
      if (this.$compareBtn) {
        this.$compareBtn.addEventListener("click", this.boundCompareClick);
      }

      // 4. Delegação de evento para cliques nos chips
      if (this.$dock) {
        this.$dock.addEventListener("click", this.boundChipClick);
      }

      // 5. Eventos de Drag and Drop no footer
      if (this.$footerEl) {
        this.$footerEl.addEventListener("dragover", this.boundDragOver);
        this.$footerEl.addEventListener("drop", this.boundDrop);
      }
    },

    /**
     * Manipulador de clique para o "dock" (delegação)
     */
    onChipClick(e) {
      // Verifica se o clique foi em um botão de remover
      const removeBtn = e.target.closest("button[data-entity-id]");
      if (removeBtn) {
        const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        if (MyIOSelectionStore) {
          const id = removeBtn.dataset.entityId;
          MyIOSelectionStore.remove(id);
        }
      }
    },

    /**
     * Manipulador de clique para o botão "Compare"
     */
    onCompareClick() {
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
      if (MyIOSelectionStore) {
        MyIOSelectionStore.openComparison();
      }
    },

    /**
     * Manipulador de evento 'drop'
     */
    onDrop(e) {
      e.preventDefault();
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
      if (MyIOSelectionStore) {
        const id =
          e.dataTransfer?.getData("text/myio-id") ||
          e.dataTransfer?.getData("text/plain");
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
          MyIOSelectionStore.off("selection:change", this.boundRenderDock);
          MyIOSelectionStore.off("selection:totals", this.boundRenderDock);
        }
      } catch (e) {
        LogHelper.warn("MyIO Footer: Error during listener cleanup.", e);
      }

      // 2. Remove listeners do DOM interno
      if (this.$compareBtn) {
        this.$compareBtn.removeEventListener("click", this.boundCompareClick);
      }
      if (this.$dock) {
        this.$dock.removeEventListener("click", this.boundChipClick);
      }
      if (this.$footerEl) {
        this.$footerEl.removeEventListener("dragover", this.boundDragOver);
        this.$footerEl.removeEventListener("drop", this.boundDrop);
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
      this.$compareBtn = null;
    },
  };

  // --- 4. Hooks do Ciclo de Vida do Widget ---

  self.onInit = function () {
    console.log('[FOOTER] 🟢 onInit chamado!');
    console.log('[FOOTER] self.ctx:', self.ctx);
    console.log('[FOOTER] self.ctx.$container:', self.ctx?.$container);
    console.log('[FOOTER] self.ctx.$container[0]:', self.ctx?.$container?.[0]);
    console.log('[FOOTER] MyIOLibrary disponível:', !!window.MyIOLibrary);
    console.log('[FOOTER] SelectionStore disponível:', !!(window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore));

    // Passa o contexto do widget (self.ctx) para o controlador
    try {
      footerController.init(self.ctx);
      console.log('[FOOTER] ✅ Inicialização completa!');
    } catch (error) {
      console.error('[FOOTER] ❌ Erro durante inicialização:', error);
      console.error('[FOOTER] Stack trace:', error.stack);
    }
  };

  self.onDestroy = function () {
    footerController.destroy();
  };