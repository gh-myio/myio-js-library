/***********************************
 *  MENU PREMIUM + FILTRO MODAL    *
 ***********************************/
const EVT_SWITCH = "myio:switch-main-state";
const EVT_FILTER_OPEN = "myio:open-filter";
const EVT_FILTER_APPLIED = "myio:filter-applied";
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CLIENT_ID;
let CLIENT_SECRET;
let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

function publishSwitch(targetStateId) {
    const detail = { targetStateId, source: "menu", ts: Date.now() };
    window.dispatchEvent(new CustomEvent(EVT_SWITCH, { detail }));
    // console.log("[menu] switch ->", detail);
}

function setActiveTab(btn, root) {
    root
        .querySelectorAll(".tab.is-active")
        .forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    // Reaplicar cores após mudança de tab ativa
    if (typeof applyMenuColors === 'function') {
        setTimeout(() => {
            applyMenuColors();
        }, 50);
    }
}

function computeCustomersFromCtx() {
    const map = new Map();
    (self.ctx.data || []).forEach(d => {
        if (d?.datasource?.aliasName === "Shopping") {
            const name = (d.datasource.entityLabel || "").trim();
            const value = d.data?.[0]?.[1];
            if (name && value && name !== value && !map.has(value)) {
                map.set(value, { name, value });
            }
        }
    });
    const arr = Array.from(map.values());
    self.ctx.$scope.custumer = arr;
    // marca pronto e notifica interessados
    window.__customersReady = arr.length > 0;
    window.dispatchEvent(new CustomEvent("myio:customers-ready", {
        detail: {
            count: arr.length,
            customers: arr // Include full customer data
        }
    }));
    console.log("[MENU] ✅ Dispatched myio:customers-ready with", arr.length, "customers");
    return arr;
}


// RFC-0079: Energy context state management
let currentEnergyContext = 'equipments'; // 'equipments' | 'stores' | 'general'

const ENERGY_CONTEXT_MAP = {
    equipments: {
        label: 'Equipamentos',
        target: 'content_equipments'
    },
    stores: {
        label: 'Lojas',
        target: 'store_telemetry'
    },
    general: {
        label: 'Geral (Energia)',
        target: 'content_energy'
    }
};

/**
 * RFC-0079: Setup energy context dropdown
 */
function setupEnergyContextDropdown() {
    const energyButton = document.getElementById('energyButton');
    const dropdown = document.getElementById('energyContextDropdown');
    const wrapper = document.querySelector('.energy-context-wrapper');
    const contextLabel = document.getElementById('energyContextLabel');

    if (!energyButton || !dropdown || !wrapper) {
        console.warn('[RFC-0079] Energy context elements not found');
        return;
    }

    // Toggle dropdown on context arrow click only (not the entire button)
    const contextArrow = energyButton.querySelector('.context-arrow');
    const contextLabelEl = energyButton.querySelector('.context-label');
    const contextDivider = energyButton.querySelector('.context-divider');

    [contextArrow, contextLabelEl, contextDivider].forEach(el => {
        if (el) {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const isOpen = dropdown.style.display === 'block';

                if (isOpen) {
                    dropdown.style.display = 'none';
                    wrapper.classList.remove('dropdown-open');
                } else {
                    dropdown.style.display = 'block';
                    wrapper.classList.add('dropdown-open');
                }
            });
        }
    });

    // Handle context option clicks
    dropdown.querySelectorAll('.context-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const context = option.getAttribute('data-context');
            const targetState = option.getAttribute('data-target');

            switchEnergyContext(context, targetState);

            // Close dropdown
            dropdown.style.display = 'none';
            wrapper.classList.remove('dropdown-open');
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
            wrapper.classList.remove('dropdown-open');
        }
    });

    console.log('[RFC-0079] Energy context dropdown initialized');
}

/**
 * RFC-0079: Switch energy context
 */
function switchEnergyContext(context, targetStateId) {
    console.log(`[RFC-0079] Switching energy context: ${currentEnergyContext} → ${context}`);

    if (!ENERGY_CONTEXT_MAP[context]) {
        console.error(`[RFC-0079] Invalid context: ${context}`);
        return;
    }

    // Update current context
    currentEnergyContext = context;

    // Update context label in button
    const contextLabel = document.getElementById('energyContextLabel');
    if (contextLabel) {
        contextLabel.textContent = ENERGY_CONTEXT_MAP[context].label;
    }

    // Update active state in dropdown options
    document.querySelectorAll('.context-option').forEach(option => {
        const optionContext = option.getAttribute('data-context');
        if (optionContext === context) {
            option.classList.add('is-active');
        } else {
            option.classList.remove('is-active');
        }
    });

    // Dispatch event to MAIN to switch state
    const detail = { targetStateId, source: 'menu-context', context, ts: Date.now() };
    window.dispatchEvent(new CustomEvent('myio:switch-main-state', { detail }));
    console.log(`[RFC-0079] Dispatched myio:switch-main-state:`, detail);

    // Update energy button data-target
    const energyButton = document.getElementById('energyButton');
    if (energyButton) {
        energyButton.setAttribute('data-target', targetStateId);
    }
}

function bindTabs(root) {
    if (root._tabsBound) return;

    root._tabsBound = true;

    root.addEventListener("click", (ev) => {
        const tab = ev.target.closest?.(".tab");

        // RFC-0079: Don't handle clicks on context arrow/label/divider
        if (ev.target.closest('.context-arrow') ||
            ev.target.closest('.context-label') ||
            ev.target.closest('.context-divider')) {
            return;
        }

        if (tab && root.contains(tab)) {
            const target = tab.getAttribute("data-target");

            if (target) {
                setActiveTab(tab, root);
                publishSwitch(target);
            }
        }
    });

    const initial =
        root.querySelector(".tab.is-active") || root.querySelector(".tab");

    if (initial) {
        publishSwitch(initial.getAttribute("data-target"));
    }

    // RFC-0079: Setup energy context dropdown
    setupEnergyContextDropdown();
}

/* ====== mock ====== */
const FILTER_DATA = [
    { id: "A", name: "Shopping A", floors: 2 },
    { id: "B", name: "Shopping B", floors: 1 },
    { id: "C", name: "Shopping C", floors: 1 },
];

/* Substitua a função injectModalGlobal existente (aprox. linha 110) */
function injectModalGlobal() {
    // ==== Config & helpers (Simplificado) =======================================
    const PRESET_KEY = "myio_dashboard_filter_presets_v1";

    // Fonte de dados simplificada: usa o escopo dos customers
    function getCustomers() {
        return self.ctx.$scope.custumer || [];
    }
    
    // As seleções agora focam apenas nos customers (shoppings)
    // Inicializa a seleção se ainda não existir
    if (!window.custumersSelected) {
        window.custumersSelected = getCustomers().slice();
    }
    
    // Funções de utilidade
    function renderCount() {
        const c = (window.custumersSelected || []).length;
        // Atualiza o contexto (necessário para o filtro ser aplicado)
        self.ctx.filterCustom = window.custumersSelected;
        elCount.textContent = `${c} selecionado${c === 1 ? "" : "s"}`;
    }

    function updateClearButtonState() {
        const hasCustomers = (window.custumersSelected || []).length > 0;
        if (elClear) {
            elClear.disabled = !hasCustomers;
        }
    }

    // ==== Construção do container (uma única vez) =============================
    let container = document.getElementById("modalGlobal");
    if (!container) {
        container = document.createElement("div");
        container.id = "modalGlobal";
        container.innerHTML = `
        <style>
          .myio-modal {
            position: fixed; inset: 0; display: flex; justify-content: center; align-items: center;
            background: rgba(0,0,0,0.5); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity .2s;
          }
          .custumers {
            display: flex; align-items: center; gap: 10px; border: 1px solid #d9d9d9;
            border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; background: transparent;
            font-weight: 600; color: #344054; cursor: pointer; transition: background 0.2s; width: 100%;
          }
          .custumers:hover { background: #f2f2f2; }
          .custumers .checkbox {
            width: 16px; height: 16px; border: 1px solid #344054; border-radius: 3px;
            flex-shrink: 0; background-color: transparent; display: flex; align-items: center;
            justify-content: center;
          }
          .custumers.selected .checkbox { background-color: #1D4F91; }
          .myio-modal[aria-hidden="false"] { opacity: 1; pointer-events: auto; }
          .myio-modal-card {
            background: #fff; border-radius: 12px; max-width: 600px; width: 92%;
            max-height: 86vh; display:flex; flex-direction:column; box-shadow: 0 4px 16px rgba(0,0,0,.28);
          }
          .myio-modal-hd, .myio-modal-ft { padding: 14px 16px; display:flex; align-items:center; justify-content:space-between; }
          .myio-modal-hd { border-bottom:1px solid #E6EEF5; }
          .myio-modal-ft { border-top:1px solid #E6EEF5; gap: 8px; }
          .myio-modal-body { padding: 14px 16px; display:flex; flex-direction:column; gap: 12px; overflow: hidden; }

          .close-x { cursor:pointer; border:0; background:transparent; font-size:20px; line-height:1; }
          .flt-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
          .flt-search{ position:relative; display:flex; align-items:center; gap:8px; flex:1; border:2px solid #BBD0E3; border-radius:12px; padding:6px 10px; }
          .flt-search:focus-within{ border-color:#4F93CE; box-shadow: 0 0 0 3px rgba(79,147,206,.15); }
          .flt-search input{ width:100%; border:0; outline:0; font-size:15px; padding-left:20px; }
          .flt-search .search-ico{ position:absolute; left:10px; }

          .link-btn{ border:0; background:transparent; font-weight:600; cursor:pointer; color:#344054; }
          .apply-btn{ border:0; background:#1D4F91; color:#fff; font-weight:700; padding:10px 16px; border-radius:10px; cursor:pointer; }
          
          .chips { display:flex; flex-wrap:wrap; gap:8px; }
          .chip { display:inline-flex; align-items:center; gap:6px; border:1px solid #CFDCE8; border-radius:999px; padding:4px 10px; font-size:12px; }
          .chip .rm { cursor:pointer; border:0; background:transparent; opacity:.7; }

          .flt-content { display:flex; gap:12px; overflow:hidden; }
          .flt-list { flex: 1 1 auto; overflow-y:auto; max-height: 46vh; padding-right:4px; display:flex; flex-direction:column; gap:6px; }

          .badge { border:1px solid #CFDCE8; border-radius:999px; padding:2px 8px; font-size:11px; color:#334155; }

          /* ===== Botão de recarregar CUSTOM ===== */
          .myio-reload-btn {
              background: #1D4F91;
              color: #fff;
              border: 0;
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              margin-top: 10px;
              font-weight: 600;
              display: inline-flex;
              align-items: center;
              gap: 8px;
          }
          .myio-reload-btn:hover { opacity: 0.9; }
          /* ===== REMOVIDO: STYLES DE PRESETS E LIMPAR (myio-clear-btn) ===== */

        </style>

        <div class="myio-modal" id="filterModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="fltTitle">
          <div class="myio-modal-backdrop" data-close="true"></div>
          <div class="myio-modal-card">
            <header class="myio-modal-hd">
              <h3 id="fltTitle">Filtro de Shoppings</h3>
              <button class="close-x" data-close="true" aria-label="Fechar">×</button>
            </header>

            <div class="myio-modal-body">
              <div class="flt-row">
                <div class="flt-search">
                  <span class="search-ico">🔎</span>
                  <input id="fltSearch" type="text" placeholder="Buscar shopping…" autocomplete="off">
                </div>
                <button class="link-btn" id="fltClear" title="Limpar seleção">Limpar</button>
                <span id="fltCount" class="badge" title="Total de seleções">0 selecionados</span>
              </div>

              <div id="fltChips" class="chips"></div>

              <div class="flt-content">
                <div class="flt-list" id="fltList" role="listbox" aria-label="Lista de shoppings"></div>

                </div>
            </div>

            <footer class="myio-modal-ft">
              <div style="flex:1; color:#6b7280; font-size:12px;">
                Selecione os shoppings para aplicar o filtro.
              </div>
              <button class="link-btn" data-close="true">Cancelar</button>
              <button class="apply-btn" id="fltApply">Aplicar filtro</button>
            </footer>
          </div>
        </div>
      `;
        document.body.appendChild(container);

        // listeners globais de fechar
        container.querySelectorAll("[data-close]").forEach((btn) => {
            btn.addEventListener("click", () => {
                container
                    .querySelector(".myio-modal")
                    .setAttribute("aria-hidden", "true");
            });
        });
    }

    // ==== Referências do DOM ==================================================
    const modal = container.querySelector(".myio-modal");
    const elSearch = container.querySelector("#fltSearch");
    const elList = container.querySelector("#fltList");
    const elClear = container.querySelector("#fltClear");
    const elApply = container.querySelector("#fltApply");
    const elChips = container.querySelector("#fltChips");
    const elCount = container.querySelector("#fltCount");

    // O listener myio:customers-ready precisa ser global para reagir ao onDataUpdated
    if (!window.__customersReadyListenerBound) {
        window.__customersReadyListenerBound = true;
        window.addEventListener("myio:customers-ready", () => {
            const modal = document.getElementById("filterModal");
            if (modal && modal.getAttribute("aria-hidden") === "false") {
                // Se o modal estiver aberto, atualiza a lista
                renderAll();
            }
        });
    }

    // Sincroniza a seleção inicial com o filterCustom do contexto
    if (Array.isArray(self.ctx.$scope.custumer) && self.ctx.$scope.custumer.length > 0) {
        if (Array.isArray(self.ctx.filterCustom)) {
             // Se já houver filtro aplicado, usa ele como seleção inicial
            window.custumersSelected = self.ctx.filterCustom.slice();
        } else {
             // Caso contrário, seleciona todos
            window.custumersSelected = self.ctx.$scope.custumer.slice();
        }
        renderAll();
    } else {
        renderAll();
    }

    // ==== Render helpers ======================================================
    function renderChips() {
        elChips.innerHTML = "";
        const customers = window.custumersSelected || [];

        for (const customer of customers) {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.innerHTML = `
        <span>${customer.name}</span>
        <button class="rm" title="Remover" aria-label="Remover seleção">×</button>
      `;
            chip.querySelector(".rm").addEventListener("click", () => {
                // Remove este customer da seleção
                window.custumersSelected = window.custumersSelected.filter(c => c.value !== customer.value);
                self.ctx.filterCustom = window.custumersSelected;
                renderAll();
            });
            elChips.appendChild(chip);
        }
    }

    function renderTree() {
        const q = (window.myioFilterQuery || "").toLowerCase();
        elList.innerHTML = "";
        
        // Pega somente customers válidos e filtra pela busca
        const customers = getCustomers()
            .filter(({ name, value }) => name && value && name.trim() !== value.trim())
            .filter(c =>
                !q ||
                c.name.toLowerCase().includes(q) ||
                c.value.toLowerCase().includes(q)
            );

        if (!customers.length) {
            console.warn("[MENU] ⚠️ No customers to display!");
            
            // Container para a mensagem e o botão
            const emptyContainer = document.createElement("div");
            emptyContainer.style.textAlign = "center";
            emptyContainer.style.padding = "20px";
            emptyContainer.innerHTML = `
                <div style="color: #6b7280; font-size: 14px; margin-bottom: 15px;">
                    Nenhum shopping disponível.
                </div>
                <button class="myio-reload-btn">
                    <span style="font-size: 1.2em; line-height: 1;">🔄</span> Tentar Recarregar
                </button>
            `;
            elList.appendChild(emptyContainer);

            // Adiciona a lógica de clique no botão de recarregar
            const reloadBtn = emptyContainer.querySelector(".myio-reload-btn");
            reloadBtn.addEventListener("click", () => {
                console.log("[MENU] 🔃 Tentando recarregar customers do context...");
                
                // 1. Tenta buscar os customers do context novamente
                const reloadedCustomers = computeCustomersFromCtx();
                
                // 2. Tenta re-renderizar o modal com os novos dados
                if (reloadedCustomers.length > 0) {
                     // Seta a seleção inicial para todos os recarregados
                    window.custumersSelected = reloadedCustomers.slice();
                    renderAll(); 
                    console.log("[MENU] ✅ Clientes recarregados e lista atualizada.");
                } else {
                    alert("Não foi possível carregar shoppings. Verifique a fonte de dados e tente novamente.");
                    console.warn("[MENU] ❌ Tentativa de recarga não trouxe clientes.");
                }
            });

            return;
        }
        
        // Se houver shoppings, continua a renderização normal...
        const selectedSet = new Set(window.custumersSelected.map(x => x.value));

        customers.forEach(c => {
            const item = document.createElement("button");
            item.className = "custumers";
            item.custumerData = c;

            const box = document.createElement("div");
            box.className = "checkbox";
            box.innerHTML = selectedSet.has(c.value) ? '✓' : ''; // Exibe o checkmark
            item.appendChild(box);

            const text = document.createElement("span");
            text.textContent = c.name;
            item.appendChild(text);

            if (selectedSet.has(c.value)) item.classList.add("selected");

            item.addEventListener("click", () => {
                if (item.classList.toggle("selected")) {
                    selectedSet.add(c.value);
                    box.innerHTML = '✓'; // Adiciona o checkmark
                } else {
                    selectedSet.delete(c.value);
                    box.innerHTML = ''; // Remove o checkmark
                }
                window.custumersSelected = customers.filter(x => selectedSet.has(x.value));
                self.ctx.filterCustom = window.custumersSelected;
                renderAll(); // Re-renderiza tudo para atualizar contagem e chips
            });

            elList.appendChild(item);
        });
    }

    function renderAll() {
        renderCount();
        renderChips();
        renderTree();
        updateClearButtonState();
    }

    // ==== Bind de eventos de UI ==============================================
    if (!elSearch._bound) {
        elSearch._bound = true;
        elSearch.addEventListener("input", (e) => {
            window.myioFilterQuery = e.target.value || "";
            renderTree();
        });
    }

    if (!elClear._bound) {
        elClear._bound = true;
        elClear.addEventListener("click", () => {
            // Limpa seleção e a query de busca
            window.custumersSelected = [];
            window.myioFilterQuery = "";
            elSearch.value = "";

            // Limpa seleção visual dos customers
            document.querySelectorAll(".custumers.selected").forEach((item) => {
                item.classList.remove("selected");
                item.querySelector(".checkbox").innerHTML = '';
            });

            renderAll();
            console.log("[MENU FILTER] Seleção limpa completamente");
        });
    }

    // Removido o bind para elSave (Salvar Preset)

    if (!elApply._bound) {
        elApply._bound = true;
        elApply.addEventListener("click", async () => {
            console.log("[MENU] 🔥 APPLY FILTER BUTTON CLICKED");
            elApply.disabled = true;

            // Prepara payload do evento
            const eventDetail = {
                selection: window.custumersSelected || [],
                ts: Date.now(),
            };

            // Dispara evento com os custumers selecionados
            window.dispatchEvent(
                new CustomEvent("myio:filter-applied", {
                    detail: eventDetail,
                })
            );

            console.log("[MENU] ✅ Event dispatched successfully with", eventDetail.selection.length, "customers.");

            // Reabilita botão e Fecha modal
            elApply.disabled = false;
            modal.setAttribute("aria-hidden", "true");
        });
    }

    // ==== Abrir modal e sincronizar estado visual ============================
    modal.setAttribute("aria-hidden", "false");

    // repõe valor de busca persistido em memória
    if (elSearch.value !== (window.myioFilterQuery || "")) {
        elSearch.value = window.myioFilterQuery || "";
    }

    renderAll();
    setTimeout(() => elSearch?.focus(), 0);
}

function bindFilter(root) {
    if (root._filterBound) return;
    root._filterBound = true;
    const modal = document.getElementById("filterModal");
    if (!modal) return; // se modal não existe, sai

    const listEl = modal.querySelector("#fltList");
    const inp = modal.querySelector("#fltSearch");
    const btnClear = modal.querySelector("#fltClear");
    const btnSave = modal.querySelector("#fltSave");
    const btnApply = modal.querySelector("#fltApply");

    // agora adiciona os listeners
    btnSave?.addEventListener("click", () => {
        const sel = listEl.dataset.selectedId || null;
        //console.log("[filter] salvar preset (mock) selection=", sel);
    });

    btnApply?.addEventListener("click", () => {
        const sel = listEl.dataset.selectedId || null;
        // window.dispatchEvent(
        //   new CustomEvent(EVT_FILTER_APPLIED, { detail: { selectedMallId: sel, ts: Date.now() } })
        // );
        //console.log("[filter] applied:", sel);
        modal.setAttribute("aria-hidden", "true");
    });

    modal.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () =>
            modal.setAttribute("aria-hidden", "true")
        );
    });
}

/* ====== Cards summary (igual antes) ====== */
function setBarPercent(elBarFill, pct, tail = 8) {
    const track = elBarFill?.parentElement;
    if (!elBarFill || !track) return;
    // limita 0–100
    const p = Math.max(0, Math.min(100, pct || 0));
    track.style.setProperty("--pct", p);
    track.style.setProperty("--tail", tail); // % do preenchido que será verde
    elBarFill.style.width = p + "%";
}

function formatDiaMes(date) {
    const dia = String(date.getDate()).padStart(2, "0"); // garante 2 dígitos
    const mes = String(date.getMonth() + 1).padStart(2, "0"); // meses começam em 0
    return `${dia}/${mes}`;
}

function sendFilterOpenEvent() {
    const eventDetail = {
      selection: window.custumersSelected || [],
      ts: Date.now(),
  };

  // Dispara evento com os custumers selecionados
  window.dispatchEvent(
      new CustomEvent("myio:filter-applied", {
          detail: eventDetail,
      })
  );
}

/* ====== Apply Menu Custom Colors ====== */
function applyMenuColors() {
    const settings = self.ctx.settings;

    // Aplicar cores nas tabs (excluindo botões especiais que têm suas próprias configurações)
    const allTabs = document.querySelectorAll('.tab:not(#load-button):not(#myio-clear-btn):not(#myio-goals-btn):not([style*="min-width"])');
    allTabs.forEach(tab => {
        const isActive = tab.classList.contains('is-active');

        if (isActive) {
            const bgColor = settings.tabSelecionadoBackgroundColor || "#2F5848";
            const fontColor = settings.tabSelecionadoFontColor || "#F2F2F2";
            tab.style.setProperty('background-color', bgColor, 'important');
            tab.style.setProperty('color', fontColor, 'important');
        } else {
            const bgColor = settings.tabNaoSelecionadoBackgroundColor || "#FFFFFF";
            const fontColor = settings.tabNaoSelecionadoFontColor || "#1C2743";
            tab.style.setProperty('background-color', bgColor, 'important');
            tab.style.setProperty('color', fontColor, 'important');
        }
    });

    // Aplicar cores no botão Carregar
    const loadButton = document.getElementById('load-button');
    if (loadButton) {
        const bgColor = settings.botaoCarregarBackgroundColor || "#2F5848";
        const fontColor = settings.botaoCarregarFontColor || "#F2F2F2";
        loadButton.style.setProperty('background-color', bgColor, 'important');
        loadButton.style.setProperty('color', fontColor, 'important');

        // Também aplicar nas icons/elementos internos
        const icon = loadButton.querySelector('i');
        if (icon) {
            icon.style.setProperty('color', fontColor, 'important');
        }
    }

    // Aplicar cores no botão Limpar
    const clearButton = document.getElementById('myio-clear-btn');
    if (clearButton) {
        const bgColor = settings.botaoLimparBackgroundColor || "#FFFFFF";
        const fontColor = settings.botaoLimparFontColor || "#1C2743";
        clearButton.style.setProperty('background-color', bgColor, 'important');
        clearButton.style.setProperty('color', fontColor, 'important');

        // Também aplicar nas icons/elementos internos
        const icon = clearButton.querySelector('i');
        if (icon) {
            icon.style.setProperty('color', fontColor, 'important');
        }
    }

    // Aplicar cores no botão Metas
    const goalsButton = document.getElementById('myio-goals-btn');
    if (goalsButton) {
        const bgColor = settings.botaoMetasBackgroundColor || "#6a1b9a";
        const fontColor = settings.botaoMetasFontColor || "#F2F2F2";
        goalsButton.style.setProperty('background-color', bgColor, 'important');
        goalsButton.style.setProperty('color', fontColor, 'important');

        // Também aplicar nas icons/elementos internos
        const icon = goalsButton.querySelector('i');
        if (icon) {
            icon.style.setProperty('color', fontColor, 'important');
        }
    }

    console.log("[MENU] Custom colors applied from settings");
}

/* ====== Lifecycle ====== */
self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
    // Extrai o segmento após 'all/' da URL
    function getSegmentAfterAll() {
        const match = window.location.href.match(/all\/([^\/?#]+)/i);
        return match ? match[1] : null;
    }

    const dashboardId = getSegmentAfterAll();

    // Mapeamento dos botões → estados
    // RFC-0079: energyButton now maps to content_equipments (which has sub-menu for Equipamentos/Lojas/Geral)
    const dashboards = {
        energyButton: {
            stateId: "content_equipments",
            state: "W3siaWQiOiJjb250ZW50X2VxdWlwbWVudHMiLCJwYXJhbXMiOnt9fV0%253D",
        },
        waterButton: {
            stateId: "content_water",
            state: "W3siaWQiOiJjb250ZW50X3dhdGVyIiwicGFyYW1zIjp7fX1d",
        },
        temperatureButton: {
            stateId: "content_temperature",
            state: "W3siaWQiOiJjb250ZW50X3RlbXBlcmF0dXJlIiwicGFyYW1zIjp7fX1d",
        }
    };

    const mainView = document.querySelector("#mainView");

    /**
     * RFC-0057: Switch content states using show/hide (no innerHTML manipulation!)
     * This prevents widgets from being destroyed/recreated on every navigation
     * @param {string} stateId - ID do estado do dashboard
     */
    function switchContentState(stateId) {
        try {
            if (!mainView) {
                console.error("[MENU] #mainView element not found in DOM");
                return;
            }

            // Find all content containers with data-content-state attribute
            const allContents = mainView.querySelectorAll("[data-content-state]");

            if (allContents.length === 0) {
                console.error(
                    "[MENU] No content containers found with data-content-state attribute"
                );
                return;
            }

            // Hide all content containers
            allContents.forEach((content) => {
                content.style.display = "none";
            });

            // Show target container
            const targetContent = mainView.querySelector(
                `[data-content-state="${stateId}"]`
            );
            if (targetContent) {
                targetContent.style.display = "block";
                console.log(
                    `[MENU] ✅ RFC-0057: Showing content state: ${stateId} (no dynamic rendering!)`
                );
            } else {
                console.warn(`[MENU] Content state not found: ${stateId}`);
                console.log(
                    `[MENU] Available states: ${Array.from(allContents)
                        .map((c) => c.getAttribute("data-content-state"))
                        .join(", ")}`
                );
            }
        } catch (err) {
            console.error("[MENU] RFC-0057: Failed to switch content state:", err);
        }
    }

    // Automatiza a atribuição de eventos aos botões
    // RFC-0057: Using switchContentState instead of renderDashboard
    Object.entries(dashboards).forEach(([buttonId, { stateId }]) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener("click", () => switchContentState(stateId));
        }
    });

    // Inicializa o daterangepicker usando o componente MyIOLibrary
    const TZ = "America/Sao_Paulo";
    const hoje = new Date();

    // RFC: Define datas iniciais (início do mês até hoje) usando UTC para evitar conversão de timezone
    // Fix: Usar Date.UTC ao invés de new Date local para garantir horário correto (00:00:00 UTC)
    const startDate = presetStart
        ? new Date(presetStart)
        : new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0));
    const endDate = presetEnd
        ? new Date(presetEnd)
        : new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999));

    // Converte para ISO strings (já em UTC, não adiciona offset)
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    let timeStart = startISO;
    let timeEnd = endISO;

    // Encontra o input existente
    const inputElement = document.querySelector('input[name="startDatetimes"]');

    // Inicializa o date range picker do MyIOLibrary (sem container, apenas no input)
    // Usando a biblioteca diretamente no input existente
    if (
        inputElement &&
        typeof MyIOLibrary !== "undefined" &&
        MyIOLibrary.createDateRangePicker
    ) {
        MyIOLibrary.createDateRangePicker(inputElement, {
            presetStart: startISO,
            presetEnd: endISO,
            maxRangeDays: 365,
            onApply: (result) => {
                // ✅ FIX: ONLY store dates internally, don't dispatch event
                timeStart = result.startISO;
                timeEnd = result.endISO;

                // Update scope for other components to read (if needed)
                const startISOOffset = result.startISO.replace("Z", "-03:00");
                const endISOOffset = result.endISO.replace("Z", "-03:00");

                self.ctx.$scope.startDateISO = startISOOffset;
                self.ctx.$scope.endDateISO = endISOOffset;

                // Update UI display
                const startDate = new Date(result.startISO);
                const endDate = new Date(result.endISO);
                const timeWindow = `${formatDiaMes(
                    startDate
                )} - ${formatDiaMes(endDate)}`;
                // Removido: não mostramos mais o intervalo nos cards
                // const timeinterval = document.getElementById("energy-peak");
                // if (timeinterval) {
                //     timeinterval.innerText = timeWindow;
                // }

                console.log("[MENU] Date selection updated (no fetch):", {
                    start: result.startISO,
                    end: result.endISO,
                });

                // ✅ NO EVENT DISPATCHING - data will only be fetched when user clicks "Carregar" button
            },
        })
            .then((picker) => {
                console.log("[MENU] Date range picker inicializado com MyIOLibrary");
            })
            .catch((err) => {
                console.error("[MENU] Erro ao inicializar date picker:", err);
            });
    } else {
        console.warn("[MENU] MyIOLibrary.createDateRangePicker não disponível");
    }

    // ===== CARREGAR BUTTON HANDLER =====
    const btnCarregar = document.getElementById("load-button");

    if (btnCarregar) {
        btnCarregar.addEventListener("click", async () => {
            console.log("[MENU] Carregar button clicked - fetching data...");

            // Disable button during fetch
            btnCarregar.disabled = true;
            const originalHTML = btnCarregar.innerHTML;
            btnCarregar.innerHTML =
                '<i class="material-icons">hourglass_empty</i> Carregando...';

            try {
                // Prepare date range with timezone offset
                const startISOOffset = timeStart.replace("Z", "-03:00");
                const endISOOffset = timeEnd.replace("Z", "-03:00");

                const startMs = new Date(timeStart).getTime();
                const endMs = new Date(timeEnd).getTime();

                // Update scope
                self.ctx.$scope.startDateISO = startISOOffset;
                self.ctx.$scope.endDateISO = endISOOffset;

                // ✅ Save dates globally for ENERGY widget to access
                window.myioDateRange = {
                    startDate: startISOOffset,
                    endDate: endISOOffset,
                    startMs,
                    endMs,
                };

                // ✅ Also save to localStorage as backup
                localStorage.setItem(
                    "myio:date-range",
                    JSON.stringify({
                        startDate: startISOOffset,
                        endDate: endISOOffset,
                        startMs,
                        endMs,
                    })
                );

                console.log("[MENU] Dispatching myio:update-date event:", {
                    startDate: startISOOffset,
                    endDate: endISOOffset,
                });

                // ✅ NOW dispatch event to trigger data fetch
                window.dispatchEvent(
                    new CustomEvent("myio:update-date", {
                        detail: {
                            startDate: startISOOffset,
                            endDate: endISOOffset,
                            startUtc: timeStart,
                            endUtc: timeEnd,
                            startMs,
                            endMs,
                            tz: TZ,
                        },
                    })
                );

                // Also update customer consumption if applicable
                if (window.custumersSelected && window.custumersSelected.length > 0) {
                    const MyIOAuth = (() => {
                        const AUTH_URL = new URL(`${DATA_API_HOST}/api/v1/auth`);
                        const RENEW_SKEW_S = 60;
                        const RETRY_BASE_MS = 500;
                        const RETRY_MAX_ATTEMPTS = 3;

                        let _token = null;
                        let _expiresAt = 0;
                        let _inFlight = null;

                        function _now() {
                            return Date.now();
                        }

                        function _aboutToExpire() {
                            if (!_token) return true;
                            const skewMs = RENEW_SKEW_S * 1000;
                            return _now() >= _expiresAt - skewMs;
                        }

                        async function _sleep(ms) {
                            return new Promise((res) => setTimeout(res, ms));
                        }

                        async function _requestNewToken() {
                            const body = {
                                client_id: CLIENT_ID,
                                client_secret: CLIENT_SECRET,
                            };

                            let attempt = 0;
                            while (true) {
                                try {
                                    const resp = await fetch(AUTH_URL, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(body),
                                    });

                                    if (!resp.ok) {
                                        const text = await resp.text().catch(() => "");
                                        throw new Error(
                                            `Auth falhou: HTTP ${resp.status} ${resp.statusText} ${text}`
                                        );
                                    }

                                    const json = await resp.json();
                                    if (!json || !json.access_token || !json.expires_in) {
                                        throw new Error(
                                            "Resposta de auth não contem campos esperados."
                                        );
                                    }

                                    _token = json.access_token;
                                    _expiresAt = _now() + Number(json.expires_in) * 1000;

                                    console.log(
                                        "[MyIOAuth] Novo token obtido. Expira em ~",
                                        Math.round(Number(json.expires_in) / 60),
                                        "min"
                                    );

                                    return _token;
                                } catch (err) {
                                    attempt++;
                                    console.warn(
                                        `[MyIOAuth] Erro ao obter token (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`,
                                        err?.message || err
                                    );
                                    if (attempt >= RETRY_MAX_ATTEMPTS) {
                                        throw err;
                                    }
                                    const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
                                    await _sleep(backoff);
                                }
                            }
                        }

                        async function getToken() {
                            if (_inFlight) {
                                return _inFlight;
                            }

                            if (_aboutToExpire()) {
                                _inFlight = _requestNewToken().finally(() => {
                                    _inFlight = null;
                                });
                                return _inFlight;
                            }

                            return _token;
                        }

                        return { getToken };
                    })();

                    async function updateTotalConsumption(
                        customersArray,
                        startDateISO,
                        endDateISO
                    ) {
                        const energyTotal = document.getElementById("energy-kpi");
                        energyTotal.innerHTML = `
              <svg style="width:28px; height:28px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                        stroke-dasharray="90,150" stroke-dashoffset="0">
                </circle>
              </svg>
            `;

                        let totalConsumption = 0;

                        for (const c of customersArray) {
                            if (!c.value) continue;

                            try {
                                const TOKEN_INJESTION = await MyIOAuth.getToken();

                                const response = await fetch(
                                    `${DATA_API_HOST}/api/v1/telemetry/customers/${c.value
                                    }/energy/total?startTime=${encodeURIComponent(
                                        startDateISO
                                    )}&endTime=${encodeURIComponent(endDateISO)}`,
                                    {
                                        method: "GET",
                                        headers: {
                                            Authorization: `Bearer ${TOKEN_INJESTION}`,
                                            "Content-Type": "application/json",
                                        },
                                    }
                                );

                                if (!response.ok)
                                    throw new Error(`Erro na API: ${response.status}`);
                                const data = await response.json();

                                totalConsumption += data.total_value;
                            } catch (err) {
                                console.error(
                                    `Falha ao buscar dados do customer ${c.value}:`,
                                    err
                                );
                            }
                        }

                        const percentDiference = document.getElementById("energy-trend");

                        energyTotal.innerText = `${MyIOLibrary.formatEnergy(
                            totalConsumption
                        )}`;
                        percentDiference.innerText = `↑ 100%`;
                        percentDiference.style.color = "red";
                    }

                    await updateTotalConsumption(
                        window.custumersSelected,
                        startISOOffset,
                        endISOOffset
                    );
                }
            } catch (error) {
                console.error("[MENU] Error loading data:", error);
                alert("Erro ao carregar dados. Tente novamente.");
            } finally {
                // Re-enable button
                btnCarregar.disabled = false;
                btnCarregar.innerHTML = originalHTML;
            }
        });

        console.log("[MENU] Carregar button handler registered");
    } else {
        console.warn("[MENU] Carregar button (load-button) not found");
    }


    // ===== LIMPAR BUTTON HANDLER (Force Refresh) =====
    const btnLimpar = document.getElementById("myio-clear-btn");

    if (btnLimpar) {
        btnLimpar.addEventListener("click", (event) => {
            console.log("[MENU] 🔄 Limpar (Force Refresh) clicked");

            // Confirmação do usuário
            const confirmed = confirm(
                "Isso vai limpar todo o cache e recarregar os dados. Continuar?"
            );
            if (!confirmed) {
                console.log("[MENU] Force Refresh cancelado pelo usuário");
                return;
            }

            try {
                // RFC-0057: No longer using localStorage, only memory cache

                // Invalida cache do orquestrador se disponível
                if (
                    window.MyIOOrchestrator &&
                    window.MyIOOrchestrator.invalidateCache
                ) {
                    window.MyIOOrchestrator.invalidateCache("energy");
                    window.MyIOOrchestrator.invalidateCache("water");
                    console.log("[MENU] ✅ Cache do orquestrador invalidado");
                }

                // Limpa conteúdo visual dos widgets TELEMETRY
                const clearEvent = new CustomEvent("myio:telemetry:clear", {
                    detail: { domain: "energy" }, // ou pegar do estado atual
                });

                window.dispatchEvent(clearEvent);
                console.log(`[MENU] ✅ Evento de limpeza emitido`);

                // RFC-0057: Removed iframe event dispatch - no longer using iframes

                console.log("[MENU] 🔄 Force Refresh concluído com sucesso");

                // Recarrega a página para limpar todos os widgets visuais
                alert(
                    "Cache limpo com sucesso! A página será recarregada para aplicar as mudanças."
                );
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } catch (err) {
                console.error("[MENU] ❌ Erro durante Force Refresh:", err);
                alert("Erro ao limpar cache. Consulte o console para detalhes.");
            }
        });

        console.log("[MENU] Limpar button handler registered");
    } else {
        console.warn("[MENU] Limpar button (myio-clear-btn) not found");
    }

    // ===== METAS BUTTON HANDLER (Goals Panel) =====
    const btnMetas = document.getElementById("myio-goals-btn");

    if (btnMetas) {
        btnMetas.addEventListener("click", () => {
            console.log("[MENU] 🎯 Metas (Goals Panel) clicked");

            // Verifica se MyIOLibrary está disponível
            if (typeof MyIOLibrary === "undefined" || !MyIOLibrary.openGoalsPanel) {
                console.error("[MENU] ❌ MyIOLibrary.openGoalsPanel não está disponível");
                alert("Componente de Metas não está disponível. Verifique a biblioteca MyIO.");
                return;
            }

            try {
                // ✅ Obtém o customerId pai (Holding) do settings
                // Este é o Customer raiz no ThingsBoard que contém os shoppings filhos
                const customerId = self.ctx?.settings?.customerId;

                if (!customerId) {
                    console.error("[MENU] ❌ customerId não encontrado em settings");
                    alert("Configuração de Customer ID não encontrada. Verifique as configurações do widget.");
                    return;
                }

                console.log("[MENU] 📋 Using Holding customerId from settings:", customerId);

                // ✅ Obtém o token do localStorage (padrão do ThingsBoard)
                const token = localStorage.getItem("jwt_token");

                if (!token) {
                    console.error("[MENU] ❌ Token JWT não encontrado no localStorage");
                    alert("Token de autenticação não encontrado. Faça login novamente.");
                    return;
                }

                console.log("[MENU] 🔑 Token JWT obtido do localStorage");

                // ✅ Prepara a lista de shoppings filhos (já computada pelo MENU)
                // Esta lista vem do modal de filtro e representa os Customers filhos
                const shoppingList = (self.ctx.$scope.custumer || [])
                    .filter(c => c.value && c.name && c.name.trim() !== c.value.trim())
                    .map(c => ({
                        value: c.value,  // UUID do Customer filho (Shopping)
                        name: c.name     // Nome do Shopping
                    }));

                console.log("[MENU] 🏬 Shopping list prepared:", {
                    count: shoppingList.length,
                    shoppings: shoppingList.map(s => s.name)
                });

                // ✅ Determina qual shopping está selecionado no filtro (se algum)
                let selectedShoppingId = null;
                if (window.custumersSelected && window.custumersSelected.length > 0) {
                    selectedShoppingId = window.custumersSelected[0].value;
                    console.log("[MENU] 🎯 Current filter selection:", window.custumersSelected[0].name);
                }

                console.log("[MENU] 🚀 Opening Goals Panel with:", {
                    holdingCustomerId: customerId,
                    shoppingCount: shoppingList.length,
                    selectedShopping: selectedShoppingId
                });

                // ✅ Abre o painel de metas usando MyIOLibrary
                const panel = MyIOLibrary.openGoalsPanel({
                    customerId: customerId,  // Customer pai (Holding)
                    token: token,            // Token do localStorage
                    api: {
                        baseUrl: window.location.origin
                    },
                    shoppingList: shoppingList,  // Lista de shoppings filhos
                    locale: 'pt-BR',
                    onSave: async (goalsData) => {
                        console.log("[MENU] ✅ Goals saved successfully:", {
                            version: goalsData.version,
                            yearsCount: Object.keys(goalsData.years || {}).length
                        });

                        // Dispara evento global para outros widgets reagirem
                        window.dispatchEvent(new CustomEvent("myio:goals-updated", {
                            detail: {
                                goalsData,
                                customerId,
                                timestamp: Date.now()
                            }
                        }));

                        console.log("[MENU] 📊 Event 'myio:goals-updated' dispatched");

                        // Feedback visual opcional
                        // alert("✅ Metas salvas com sucesso!");
                    },
                    onClose: () => {
                        console.log("[MENU] 🚪 Goals Panel closed");
                    },
                    styles: {
                        primaryColor: '#6a1b9a',  // Mesma cor do botão Metas (roxo MYIO)
                        accentColor: '#FFC107',   // Amarelo de destaque
                        successColor: '#28a745',  // Verde de sucesso
                        errorColor: '#dc3545',    // Vermelho de erro
                        borderRadius: '8px',
                        zIndex: 10000
                    }
                });

                console.log("[MENU] ✅ Goals Panel opened successfully");

            } catch (error) {
                console.error("[MENU] ❌ Error opening Goals Panel:", error);
                alert(`Erro ao abrir o painel de metas:\n${error.message}\n\nConsulte o console para mais detalhes.`);
            }
        });

        console.log("[MENU] Metas button handler registered");
    } else {
        console.warn("[MENU] Metas button (myio-goals-btn) not found");
    }

    const root = (self?.ctx?.$container && self.ctx.$container[0]) || document;
    CLIENT_ID = self.ctx.settings.clientId;
    CLIENT_SECRET = self.ctx.settings.clientSecret;
    computeCustomersFromCtx();


    bindTabs(root);
    bindFilter(root);

    // mocks (remova se alimentar via API/telemetria)

    const filterBtn = document.getElementById("filterBtn");

    if (filterBtn) {
        filterBtn.addEventListener("click", () => {
            console.log("[MENU] 🔘 Filter button clicked");
            console.log("[MENU] 📋 Current customers in scope:", self.ctx.$scope.custumer?.length || 0);

            if (!Array.isArray(self.ctx.$scope.custumer) || self.ctx.$scope.custumer.length === 0) {
                console.log("[MENU] ⚠️ No customers in scope, computing from ctx...");
                computeCustomersFromCtx();
                console.log("[MENU] 📋 Customers after compute:", self.ctx.$scope.custumer?.length || 0);
            }

            console.log("[MENU] 🚀 Opening filter modal...");
            injectModalGlobal();
            bindFilter(document.body);
            console.log("[MENU] ✅ Filter modal opened");
        });
    } else {
        console.error("[MENU] ❌ Filter button (filterBtn) not found in DOM!");
    }

    // Atualiza escopo com datas iniciais
    self.ctx.$scope.startDateISO = timeStart;
    self.ctx.$scope.endDateISO = timeEnd;

    // Dispara evento inicial com as datas preset
    const startDateFormatted = timeStart.replace("Z", "-03:00");
    const endDateFormatted = timeEnd.replace("Z", "-03:00");

    // ✅ Save initial dates globally for other widgets
    window.myioDateRange = {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        startMs: new Date(timeStart).getTime(),
        endMs: new Date(timeEnd).getTime(),
    };

    // ✅ Also save to localStorage
    localStorage.setItem("myio:date-range", JSON.stringify(window.myioDateRange));

    console.log("[MENU] Initial dates saved globally:", window.myioDateRange);

    window.dispatchEvent(
        new CustomEvent("myio:update-date", {
            detail: {
                startDate: startDateFormatted,
                endDate: endDateFormatted,
            },
        })
    );

    const custumer = [];

    // não apagar!!
    const custumerMap = new Map();
    self.ctx.data.forEach((data) => {
        if (data.datasource.aliasName === "Shopping") {
            const name = data.datasource.entityLabel;
            const value = data.data?.[0]?.[1];
            if (value != null && !custumerMap.has(value)) {
                custumerMap.set(value, { name, value });
            }
        }
    });
    computeCustomersFromCtx();

    // Aplicar cores personalizadas (após o DOM estar pronto)
    setTimeout(() => {
        applyMenuColors();
    }, 100);

    // console.log("custumer",custumer)
};

self.onDataUpdated = function () {
    // 1) SEMPRE reconstrói customers a partir do self.ctx.data atual
    computeCustomersFromCtx();

    // 2) O restante do fluxo pode continuar limitado por MAX_DATA_REFRESHES
    if (_dataRefreshCount >= MAX_DATA_REFRESHES) return;
    _dataRefreshCount++;

    const totalDevices = self.ctx.data.length;
    let onlineDevices = 0;
    self.ctx.data.forEach((device) => {
        const status = device.data?.[0]?.[1];
        if (status === "online") onlineDevices++;
    });
    let percentage = totalDevices > 0 ? ((onlineDevices / totalDevices) * 100).toFixed(1) : 0;
    percentage = Number(percentage).toFixed(0);
};


self.onDestroy = function () {
    /* nada a limpar */
};
