(function (self) {
  /**
   * NOTA: Este script depende de um script externo (MyIOLibrary).
   * https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
   *
   * Para os ícones, idealmente, você carregaria uma biblioteca como Font Awesome ou Material Icons.
   * Por simplicidade no exemplo, os ícones '•' e '×' são mantidos, mas estilizaremos para parecerem melhores.
   */

  // Debug configuration
  const DEBUG_ACTIVE = true;

  // LogHelper utility
  const LogHelper = {
    log: function(...args) {
      if (DEBUG_ACTIVE) {
        LogHelper.log(...args);
      }
    },
    warn: function(...args) {
      if (DEBUG_ACTIVE) {
        LogHelper.warn(...args);
      }
    },
    error: function(...args) {
      if (DEBUG_ACTIVE) {
        LogHelper.error(...args);
      }
    }
  };

  // URL da biblioteca externa
  const MYIO_SCRIPT_URL =
    "https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js";

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
      if (this.initialized) return;

      this.$root = ctx?.$container?.[0];
      this.ctx = ctx;
      if (!this.$root) {
        LogHelper.error("MyIO Footer: Root container not found.");
        return;
      }

      this.ensureLibraryLoaded(() => {
        this.mountTemplate();
        this.queryDOMElements(); // Consultar elementos *após* montar
        this.bindEvents();
        this.renderDock(); // Renderização inicial
        this.initialized = true;
      });
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
      if (!window.MyIOLibrary || !this.$dock || !this.$totals || !this.$compareBtn) {
        return;
      }

      const { MyIOSelectionStore } = window.MyIOLibrary;
      const selected = MyIOSelectionStore.getSelectedEntities();
      const count = selected.length;
      const totals = MyIOSelectionStore.getMultiUnitTotalDisplay();

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
      if (!window.MyIOLibrary) return;
      const { MyIOSelectionStore } = window.MyIOLibrary;

      // 1. Armazena funções vinculadas (para remoção correta)
      this.boundRenderDock = this.renderDock.bind(this);
      this.boundCompareClick = this.onCompareClick.bind(this);
      this.boundDragOver = (e) => e.preventDefault();
      this.boundDrop = this.onDrop.bind(this);
      this.boundChipClick = this.onChipClick.bind(this);

      // 2. Ouve a store externa
      MyIOSelectionStore.on("selection:change", this.boundRenderDock);
      MyIOSelectionStore.on("selection:totals", this.boundRenderDock);

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
     * Manipulador de evento 'drop'
     */
    onDrop(e) {
      e.preventDefault();
      if (window.MyIOLibrary) {
        const id =
          e.dataTransfer?.getData("text/myio-id") ||
          e.dataTransfer?.getData("text/plain");
        if (id) {
          window.MyIOLibrary.MyIOSelectionStore.add(id);
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
        const { MyIOSelectionStore } = window.MyIOLibrary || {};
        MyIOSelectionStore?.off?.("selection:change", this.boundRenderDock);
        MyIOSelectionStore?.off?.("selection:totals", this.boundRenderDock);
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
    // Passa o contexto do widget (self.ctx) para o controlador
    footerController.init(self.ctx);
  };

  self.onDestroy = function () {
    footerController.destroy();
  };
})(self);
