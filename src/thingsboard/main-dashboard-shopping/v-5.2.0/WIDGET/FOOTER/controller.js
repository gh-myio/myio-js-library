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

      this.mountTemplate();
      LogHelper.log("[MyIO Footer] Template mounted");

      this.queryDOMElements(); // Consultar elementos *após* montar
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
     */
    queryDOMElements() {
      if (!this.$footerEl) return;
      this.$dock = this.$footerEl.querySelector("#myioDock");
      this.$totals = this.$footerEl.querySelector("#myioTotals");
      this.$compareBtn = this.$footerEl.querySelector("#myioCompare");
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

      if (count === 0) {
        const emptyEl = document.createElement("span");
        emptyEl.className = "myio-empty";
        emptyEl.textContent = "Arraste itens para cá ou selecione no card";
        this.$dock.replaceChildren(emptyEl); // Mais seguro e performático
      } else {
        // Cria chips de forma eficiente e segura
        const chips = selected.map((ent) => {
          const chip = document.createElement("div");
          chip.className = "myio-chip";

          const icon = document.createElement("span");
          icon.className = "myio-chip-icon";
          icon.textContent = "•"; // Pode ser substituído por um SVG/ícone de fonte

          const name = document.createElement("span");
          name.textContent = ent.name; // Usa textContent (seguro contra XSS)

          const removeBtn = document.createElement("button");
          removeBtn.title = `Remover ${ent.name}`;
          removeBtn.setAttribute("aria-label", `Remover ${ent.name}`);
          removeBtn.dataset.entityId = ent.id; // ID para delegação de evento
          removeBtn.textContent = "×"; // Pode ser substituído por um SVG/ícone de fonte

          chip.append(icon, name, removeBtn);
          return chip;
        });
        this.$dock.replaceChildren(...chips); // Renderiza todos de uma vez
      }

      // Atualiza totais e botão
      this.$totals.textContent =
        count > 0 ? `${count} selecionado(s) | ${totals}` : "0 selecionados";
      this.$compareBtn.disabled = count < 2;
    },

    /**
     * Vincula todos os ouvintes de eventos
     */
    bindEvents() {
      LogHelper.log("[MyIO Footer] bindEvents() called");

      // Try both window.MyIOLibrary.MyIOSelectionStore and window.MyIOSelectionStore
      const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;

      if (!MyIOSelectionStore) {
        LogHelper.error("[MyIO Footer] MyIOSelectionStore not available for binding events.");
        return;
      }

      // 1. Armazena funções vinculadas (para remoção correta)
      this.boundRenderDock = this.renderDock.bind(this);
      this.boundCompareClick = this.onCompareClick.bind(this);
      this.boundDragOver = (e) => e.preventDefault();
      this.boundDrop = this.onDrop.bind(this);
      this.boundChipClick = this.onChipClick.bind(this);

      // 2. Ouve a store externa
      MyIOSelectionStore.on("selection:change", this.boundRenderDock);
      MyIOSelectionStore.on("selection:totals", this.boundRenderDock);

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

      // 3. Remove elementos do DOM
      this.$footerEl?.remove();

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