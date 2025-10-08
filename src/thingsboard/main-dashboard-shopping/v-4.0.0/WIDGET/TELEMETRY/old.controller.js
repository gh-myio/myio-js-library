(function (self) {
  /**
   * NOTA: Este script depende de um script externo (MyIOLibrary).
   * https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
   *
   * Para os ícones, idealmente, você carregaria uma biblioteca como Font Awesome ou Material Icons.
   * Por simplicidade no exemplo, os ícones '•' e '×' são mantidos, mas estilizaremos para parecerem melhores.
   */

  // URL da biblioteca externa
  const MYIO_SCRIPT_URL =
    "https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js";
  // ID para a tag <style> injetada
  const FOOTER_STYLE_ID = "myio-footer-styles";

  // --- 1. Template CSS (Formatado e legível com melhorias visuais) ---
  const FOOTER_CSS = `
    /* Importa a fonte Inter do Google Fonts para uma tipografia moderna */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    .myio-footer {
  /* --- Variáveis de Design System (Ajuste aqui para customizar) --- */
  --color-primary: #00e09e; /* Verde vibrante */
  --color-primary-dim: rgba(0, 224, 158, .2); /* Verde mais claro para fundo */
  --color-background-dark: #121a2b; /* Fundo mais escuro */
  --color-background-medium: #1c2743; /* Fundo médio */
  --color-text-light: #fff;
  --color-text-dim: rgba(255, 255, 255, .7);
  --color-border-subtle: rgba(255, 255, 255, .1);
  --font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
  --border-radius-base: 8px;
  --transition-speed: 0.2s ease-in-out;
  
  /* --- Layout Base --- (MODIFICADO) --- */
  position: fixed;   /* ALTERADO */
  bottom: 0;         /* ADICIONADO */
  left: 0;           /* ADICIONADO */
  right: 0;          /* ADICIONADO */
  width: 100%;       
  height: 60px;
  z-index: 1000;     /* ADICIONADO */
  
  display: grid;
  grid-template-columns: 1fr auto; /* Dock flexível, Direita fixa */
  align-items: center;
  padding: 0 15px; /* Mais padding nas laterais */
  box-sizing: border-box; /* Garante que padding não adicione largura */
  
  /* --- Estilo Base --- */
  font-family: var(--font-family-base);
  color: var(--color-text-light);
  background: linear-gradient(90deg, var(--color-background-dark), var(--color-background-medium));
  border-top: 2px solid var(--color-primary);
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.2); /* Sombra sutil para profundidade */
}
    
    .myio-dock {
      display: flex;
      align-items: center;
      gap: 10px; /* Mais espaço entre os chips */
      overflow-x: auto; /* Permite rolagem horizontal */
      padding: 5px 0; /* Pequeno padding para rolagem */
      
      /* Estilização da barra de rolagem para navegadores Webkit */
      scrollbar-width: thin; /* Firefox */
      scrollbar-color: var(--color-primary) var(--color-background-medium); /* Firefox */
    }
    .myio-dock::-webkit-scrollbar {
      height: 6px; /* Altura da barra de rolagem */
    }
    .myio-dock::-webkit-scrollbar-thumb {
      background: var(--color-primary);
      border-radius: 6px;
    }
    .myio-dock::-webkit-scrollbar-track {
      background: var(--color-background-medium);
    }
    
    .myio-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px; /* Mais espaço dentro do chip */
      padding: 7px 12px;
      border-radius: 20px; /* Borda mais arredondada */
      background: rgba(255, 255, 255, .08); /* Fundo um pouco mais visível */
      border: 1px solid var(--color-border-subtle);
      white-space: nowrap;
      font-size: 0.875em; /* Tamanho da fonte ligeiramente menor */
      font-weight: 500; /* Medium weight */
      transition: background var(--transition-speed);
      cursor: default; /* Indica que não é clicável no chip em si */
    }

    .myio-chip:hover {
        background: rgba(255, 255, 255, .12); /* Leve destaque ao passar o mouse */
    }
    
    /* Ícone de remoção do chip */
    .myio-chip button {
      background: none;
      border: none;
      color: var(--color-text-dim); /* Cor mais sutil */
      cursor: pointer;
      padding: 0;
      margin-left: 4px; /* Mais espaço */
      font-size: 1.1em;
      line-height: 1;
      font-family: var(--font-family-base);
      transition: color var(--transition-speed);
    }
    .myio-chip button:hover {
      color: var(--color-text-light); /* Fica branco ao passar o mouse */
    }
    
    .myio-chip-icon {
      color: var(--color-primary); /* Ícone verde vibrante */
      font-size: 1.2em; /* Tamanho do ícone de ponto */
    }

    .myio-right {
      display: flex;
      align-items: center;
      gap: 15px; /* Mais espaço entre elementos da direita */
      padding-left: 15px; /* Garante que não encoste no dock */
    }
    
    .myio-compare {
      height: 40px; /* Altura maior para o botão */
      min-width: 100px; /* Largura mínima */
      padding: 0 18px;
      border-radius: var(--border-radius-base);
      border: none; /* Remove a borda original */
      background: var(--color-primary); /* Fundo verde sólido */
      color: var(--color-background-dark); /* Texto escuro no botão verde */
      cursor: pointer;
      font-weight: 600; /* Semibold */
      font-size: 1em;
      transition: background var(--transition-speed), transform var(--transition-speed);
      box-shadow: 0 2px 8px rgba(0, 224, 158, 0.3); /* Sombra mais destacada */
    }
    .myio-compare:hover:not(:disabled) {
      background: #00ffb5; /* Levemente mais claro ao passar o mouse */
      transform: translateY(-1px); /* Efeito de elevação */
    }
    .myio-compare:active:not(:disabled) {
      transform: translateY(0); /* Efeito de clique */
      box-shadow: 0 1px 4px rgba(0, 224, 158, 0.3);
    }
    .myio-compare:disabled {
      opacity: 0.6; /* Menos opaco, mas ainda visível */
      cursor: not-allowed;
      background: rgba(255, 255, 255, .1); /* Fundo cinza sutil */
      color: var(--color-text-dim);
      box-shadow: none; /* Sem sombra quando desabilitado */
      transform: none;
    }
    
    .myio-meta {
      font-variant-numeric: tabular-nums;
      opacity: 0.85;
      white-space: nowrap;
      font-size: 0.9em;
      font-weight: 500;
    }
    
    .myio-empty {
      color: var(--color-text-dim);
      padding-left: 8px; /* Mais padding para o texto de placeholder */
      font-style: italic;
    }

    /* Responsividade básica */
    @media (max-width: 768px) {
        .myio-footer {
            grid-template-columns: 1fr; /* Stack verticalmente em telas menores */
            height: auto;
            padding: 10px 15px;
            gap: 10px; /* Espaço entre dock e direita */
        }
        .myio-right {
            justify-content: space-between; /* Distribui itens */
            padding-left: 0;
            width: 100%;
        }
        .myio-dock {
            width: 100%;
        }
    }
  `;

  // --- 2. Template HTML (Formatado com estrutura para ícones) ---
  const FOOTER_HTML = `
    <div class="myio-dock" id="myioDock" aria-live="polite"></div>
    <div class="myio-right">
      <div class="myio-meta" id="myioTotals">0 selecionados</div>
      <button id="myioCompare" class="myio-compare" disabled>Compare</button>
    </div>
  `;

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
      if (!this.$root) {
        console.error("MyIO Footer: Root container not found.");
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
        console.error("MyIO Footer: Failed to load MyIOLibrary.");
      document.head.appendChild(s);
    },

    /**
     * Injeta o CSS e o HTML do footer no DOM
     */
    mountTemplate() {
      // Injeta CSS no <head> para garantir prioridade e fácil remoção
      if (!document.getElementById(FOOTER_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = FOOTER_STYLE_ID;
        style.textContent = FOOTER_CSS;
        document.head.appendChild(style);
      }

      // Cria o elemento principal do footer
      const footerSection = document.createElement("section");
      footerSection.className = "myio-footer";
      footerSection.innerHTML = FOOTER_HTML;

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
        console.warn("MyIO Footer: Error during listener cleanup.", e);
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
      const style = document.getElementById(FOOTER_STYLE_ID);
      style?.remove();
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