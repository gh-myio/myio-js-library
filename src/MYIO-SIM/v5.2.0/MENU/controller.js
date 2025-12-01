/***********************************
 *  MENU PREMIUM + FILTRO MODAL    *
 ***********************************/
const EVT_SWITCH = 'myio:switch-main-state';
const EVT_FILTER_OPEN = 'myio:open-filter';
const EVT_FILTER_APPLIED = 'myio:filter-applied';
// RFC-0086: Get DATA_API_HOST from localStorage (set by WELCOME widget)
function getDataApiHost() {
  return localStorage.getItem('__MYIO_DATA_API_HOST__');
}

// RFC-0086: Get shopping label from localStorage (set by WELCOME widget)
function getShoppingLabel() {
  try {
    const stored = localStorage.getItem('__MYIO_SHOPPING_LABEL__');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

// Debug configuration
const DEBUG_ACTIVE = true;

// LogHelper utility
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function (...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  },
};

function publishSwitch(targetStateId) {
  const detail = { targetStateId, source: 'menu', ts: Date.now() };
  window.dispatchEvent(new CustomEvent(EVT_SWITCH, { detail }));
  // console.log("[menu] switch ->", detail);
}

function setActiveTab(btn, root) {
  root.querySelectorAll('.tab.is-active').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
}

function computeCustomersFromCtx() {
  const map = new Map();
  (self.ctx.data || []).forEach((d) => {
    if (d?.datasource?.aliasName === 'Shopping') {
      const name = (d.datasource.entityLabel || '').trim();
      const value = d.data?.[0]?.[1];
      const customerId = d.datasource.entityId;
      if (name && value && name !== value && !map.has(value)) {
        map.set(value, { name, value, customerId });
      }
    }
  });
  const arr = Array.from(map.values());
  self.ctx.$scope.custumer = arr;

  // --- LÓGICA NOVA: SELECIONAR TODOS AO INICIAR ---
  // Verifica se 'window.custumersSelected' é undefined (significa que é a primeira carga do sistema)
  if (typeof window.custumersSelected === 'undefined' && arr.length > 0) {
    console.log('[MENU] 🚀 Inicializando sistema: Selecionando TODOS os shoppings por padrão.');

    // 1. Define a seleção global como o array completo (arr)
    window.custumersSelected = arr.slice();

    // 2. Atualiza o contexto do widget para consistência
    self.ctx.filterCustom = window.custumersSelected;

    // 3. Dispara o evento IMEDIATAMENTE para que outros widgets (Energy, Water, etc) saibam que devem carregar tudo
    // Usamos um pequeno timeout para garantir que os ouvintes dos outros widgets já estejam registrados
    setTimeout(() => {
      const eventDetail = {
        selection: window.custumersSelected,
        ts: Date.now(),
      };
      window.dispatchEvent(
        new CustomEvent('myio:filter-applied', {
          detail: eventDetail,
        })
      );
      console.log('[MENU] 📡 Evento inicial de filtro (Todos) disparado.');
    }, 500);
  }
  // -------------------------------------------------

  // marca pronto e notifica interessados
  window.__customersReady = arr.length > 0;
  window.dispatchEvent(
    new CustomEvent('myio:customers-ready', {
      detail: {
        count: arr.length,
        customers: arr, // Include full customer data
      },
    })
  );
  // console.log("[MENU] ✅ Dispatched myio:customers-ready with", arr.length, "customers");
  return arr;
}

function bindTabs(root) {
  if (root._tabsBound) return;

  root._tabsBound = true;

  root.addEventListener('click', (ev) => {
    const tab = ev.target.closest?.('.tab');

    if (tab && root.contains(tab)) {
      const target = tab.getAttribute('data-target');

      if (target) {
        setActiveTab(tab, root);
        publishSwitch(target);
      }
    }
  });

  const initial = root.querySelector('.tab.is-active') || root.querySelector('.tab');

  if (initial) {
    publishSwitch(initial.getAttribute('data-target'));
  }
}

/* ====== mock ====== */
const FILTER_DATA = [
  { id: 'A', name: 'Shopping A', floors: 2 },
  { id: 'B', name: 'Shopping B', floors: 1 },
  { id: 'C', name: 'Shopping C', floors: 1 },
];

/* Substitua a função injectModalGlobal existente (aprox. linha 110) */
function injectModalGlobal() {
  // ==== Config & helpers (Simplificado) =======================================
  const PRESET_KEY = 'myio_dashboard_filter_presets_v1';

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
    elCount.textContent = `${c} selecionado${c === 1 ? '' : 's'}`;
  }

  function updateClearButtonState() {
    const hasCustomers = (window.custumersSelected || []).length > 0;
    if (elClear) {
      elClear.disabled = !hasCustomers;
    }
  }

  // ==== Construção do container (uma única vez) =============================
  let container = document.getElementById('modalGlobal');
  if (!container) {
    container = document.createElement('div');
    container.id = 'modalGlobal';
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
    container.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelector('.myio-modal').setAttribute('aria-hidden', 'true');
      });
    });
  }

  // ==== Referências do DOM ==================================================
  const modal = container.querySelector('.myio-modal');
  const elSearch = container.querySelector('#fltSearch');
  const elList = container.querySelector('#fltList');
  const elClear = container.querySelector('#fltClear');
  const elApply = container.querySelector('#fltApply');
  const elChips = container.querySelector('#fltChips');
  const elCount = container.querySelector('#fltCount');

  // O listener myio:customers-ready precisa ser global para reagir ao onDataUpdated
  if (!window.__customersReadyListenerBound) {
    window.__customersReadyListenerBound = true;
    window.addEventListener('myio:customers-ready', () => {
      const modal = document.getElementById('filterModal');
      if (modal && modal.getAttribute('aria-hidden') === 'false') {
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
    elChips.innerHTML = '';
    const customers = window.custumersSelected || [];

    for (const customer of customers) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `
        <span>${customer.name}</span>
        <button class="rm" title="Remover" aria-label="Remover seleção">×</button>
      `;
      chip.querySelector('.rm').addEventListener('click', () => {
        // Remove este customer da seleção
        window.custumersSelected = window.custumersSelected.filter((c) => c.value !== customer.value);
        self.ctx.filterCustom = window.custumersSelected;
        renderAll();
      });
      elChips.appendChild(chip);
    }
  }

  function renderTree() {
    const q = (window.myioFilterQuery || '').toLowerCase();
    elList.innerHTML = '';

    // Pega somente customers válidos e filtra pela busca
    const customers = getCustomers()
      .filter(({ name, value }) => name && value && name.trim() !== value.trim())
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));

    if (!customers.length) {
      console.warn('[MENU] ⚠️ No customers to display!');

      // Container para a mensagem e o botão
      const emptyContainer = document.createElement('div');
      emptyContainer.style.textAlign = 'center';
      emptyContainer.style.padding = '20px';
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
      const reloadBtn = emptyContainer.querySelector('.myio-reload-btn');
      reloadBtn.addEventListener('click', () => {
        console.log('[MENU] 🔃 Tentando recarregar customers do context...');

        // 1. Tenta buscar os customers do context novamente
        const reloadedCustomers = computeCustomersFromCtx();

        // 2. Tenta re-renderizar o modal com os novos dados
        if (reloadedCustomers.length > 0) {
          // Seta a seleção inicial para todos os recarregados
          window.custumersSelected = reloadedCustomers.slice();
          renderAll();
          console.log('[MENU] ✅ Clientes recarregados e lista atualizada.');
        } else {
          alert('Não foi possível carregar shoppings. Verifique a fonte de dados e tente novamente.');
          console.warn('[MENU] ❌ Tentativa de recarga não trouxe clientes.');
        }
      });

      return;
    }

    // Se houver shoppings, continua a renderização normal...
    const selectedSet = new Set(window.custumersSelected.map((x) => x.value));

    customers.forEach((c) => {
      const item = document.createElement('button');
      item.className = 'custumers';
      item.custumerData = c;

      const box = document.createElement('div');
      box.className = 'checkbox';
      box.innerHTML = selectedSet.has(c.value) ? '✓' : ''; // Exibe o checkmark
      item.appendChild(box);

      const text = document.createElement('span');
      text.textContent = c.name;
      item.appendChild(text);

      if (selectedSet.has(c.value)) item.classList.add('selected');

      item.addEventListener('click', () => {
        if (item.classList.toggle('selected')) {
          selectedSet.add(c.value);
          box.innerHTML = '✓'; // Adiciona o checkmark
        } else {
          selectedSet.delete(c.value);
          box.innerHTML = ''; // Remove o checkmark
        }
        window.custumersSelected = customers.filter((x) => selectedSet.has(x.value));
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
    elSearch.addEventListener('input', (e) => {
      window.myioFilterQuery = e.target.value || '';
      renderTree();
    });
  }

  if (!elClear._bound) {
    elClear._bound = true;
    elClear.addEventListener('click', () => {
      // Limpa seleção e a query de busca
      window.custumersSelected = [];
      window.myioFilterQuery = '';
      elSearch.value = '';

      // Limpa seleção visual dos customers
      document.querySelectorAll('.custumers.selected').forEach((item) => {
        item.classList.remove('selected');
        item.querySelector('.checkbox').innerHTML = '';
      });

      renderAll();
      console.log('[MENU FILTER] Seleção limpa completamente');
    });
  }

  // Removido o bind para elSave (Salvar Preset)

  if (!elApply._bound) {
    elApply._bound = true;
    elApply.addEventListener('click', async () => {
      console.log('[MENU] 🔥 APPLY FILTER BUTTON CLICKED');
      elApply.disabled = true;

      // Prepara payload do evento
      const eventDetail = {
        selection: window.custumersSelected || [],
        ts: Date.now(),
      };

      // Dispara evento com os custumers selecionados
      window.dispatchEvent(
        new CustomEvent('myio:filter-applied', {
          detail: eventDetail,
        })
      );

      console.log('[MENU] ✅ Event dispatched successfully with', eventDetail.selection.length, 'customers.');

      // Reabilita botão e Fecha modal
      elApply.disabled = false;
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  // ==== Abrir modal e sincronizar estado visual ============================
  modal.setAttribute('aria-hidden', 'false');

  // repõe valor de busca persistido em memória
  if (elSearch.value !== (window.myioFilterQuery || '')) {
    elSearch.value = window.myioFilterQuery || '';
  }

  renderAll();
  setTimeout(() => elSearch?.focus(), 0);
}

function bindFilter(root) {
  if (root._filterBound) return;
  root._filterBound = true;
  const modal = document.getElementById('filterModal');
  if (!modal) return; // se modal não existe, sai

  const listEl = modal.querySelector('#fltList');
  const inp = modal.querySelector('#fltSearch');
  const btnClear = modal.querySelector('#fltClear');
  const btnSave = modal.querySelector('#fltSave');
  const btnApply = modal.querySelector('#fltApply');

  // agora adiciona os listeners
  btnSave?.addEventListener('click', () => {
    const sel = listEl.dataset.selectedId || null;
    //console.log("[filter] salvar preset (mock) selection=", sel);
  });

  btnApply?.addEventListener('click', () => {
    const sel = listEl.dataset.selectedId || null;
    // window.dispatchEvent(
    //   new CustomEvent(EVT_FILTER_APPLIED, { detail: { selectedMallId: sel, ts: Date.now() } })
    // );
    //console.log("[filter] applied:", sel);
    modal.setAttribute('aria-hidden', 'true');
  });

  modal.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => modal.setAttribute('aria-hidden', 'true'));
  });
}

/* ====== Cards summary (igual antes) ====== */
function setBarPercent(elBarFill, pct, tail = 8) {
  const track = elBarFill?.parentElement;
  if (!elBarFill || !track) return;
  // limita 0–100
  const p = Math.max(0, Math.min(100, pct || 0));
  track.style.setProperty('--pct', p);
  track.style.setProperty('--tail', tail); // % do preenchido que será verde
  elBarFill.style.width = p + '%';
}

function formatDiaMes(date) {
  const dia = String(date.getDate()).padStart(2, '0'); // garante 2 dígitos
  const mes = String(date.getMonth() + 1).padStart(2, '0'); // meses começam em 0
  return `${dia}/${mes}`;
}

function sendFilterOpenEvent() {
  const eventDetail = {
    selection: window.custumersSelected || [],
    ts: Date.now(),
  };

  // Dispara evento com os custumers selecionados
  window.dispatchEvent(
    new CustomEvent('myio:filter-applied', {
      detail: eventDetail,
    })
  );
}

/* ====== Lifecycle ====== */
self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
  // ==============================================================
  // INJETAR CSS GLOBAL PARA O MODAL (Restaura a beleza)
  // Coloque isso no topo do self.onInit
  // ==============================================================
  if (!document.getElementById('myio-energy-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'myio-energy-modal-styles';
    style.innerHTML = `
            /* Container Fundo Escuro */
            #energyContextModal {
                font-family: 'Roboto', 'Segoe UI', sans-serif;
                backdrop-filter: blur(4px);
            }

            /* O Cartão Branco */
            #energyContextModal .energy-modal-content {
                background: #ffffff !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 50px rgba(0,0,0,0.3) !important;
                width: 320px !important;
                max-width: 90vw !important;
                overflow: hidden !important;
                border: none !important;
                padding: 0 !important;
                display: flex !important;
                flex-direction: column !important;
            }

            /* Cabeçalho */
            .energy-modal-header {
                padding: 16px 20px !important;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                font-weight: 700;
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 16px;
            }

            /* Lista de Opções (Isso corrige o layout horizontal quebrado) */
            .energy-modal-options {
                padding: 10px !important;
                display: flex !important;
                flex-direction: column !important; /* Força lista vertical */
                gap: 8px !important;
            }

            /* Cada Botão de Opção */
            .energy-modal-option {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                padding: 12px 16px !important;
                border: 1px solid transparent !important;
                border-radius: 12px !important;
                background: transparent !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                text-align: left !important;
                color: #334155 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            /* Hover (Passar o mouse) */
            .energy-modal-option:hover {
                background: #f1f5f9 !important;
                border-color: #cbd5e1 !important;
            }

            /* Ativo (Selecionado) */
            .energy-modal-option.is-active {
                background: #eff6ff !important;
                border-color: #3b82f6 !important;
                color: #1d4ed8 !important;
            }

            /* Ícones e Textos Internos */
            .option-ico { font-size: 20px; }
            .option-info { flex: 1; display: flex; flex-direction: column; }
            .option-title { font-weight: 600; font-size: 14px; line-height: 1.2; }
            .option-desc { font-size: 12px; color: #64748b; margin-top: 2px; font-weight: 400; }
            
            /* Checkmark */
            .option-check {
                font-weight: bold;
                opacity: 0;
                transform: scale(0.5);
                transition: all 0.2s;
                color: #3b82f6;
            }
            .energy-modal-option.is-active .option-check {
                opacity: 1;
                transform: scale(1);
            }

            /* RFC-0087: Water Modal Styles */
            #waterContextModal {
                font-family: 'Roboto', 'Segoe UI', sans-serif;
                backdrop-filter: blur(4px);
            }

            #waterContextModal .water-modal-content {
                background: #ffffff !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 50px rgba(0,0,0,0.3) !important;
                width: 320px !important;
                max-width: 90vw !important;
                overflow: hidden !important;
                border: none !important;
                padding: 0 !important;
                display: flex !important;
                flex-direction: column !important;
            }

            .water-modal-header {
                padding: 16px 20px !important;
                background: #f0f9ff;
                border-bottom: 1px solid #bae6fd;
                font-weight: 700;
                color: #0c4a6e;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 16px;
            }

            .water-modal-options {
                padding: 10px !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            }

            .water-modal-option {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                padding: 12px 16px !important;
                border: 1px solid transparent !important;
                border-radius: 12px !important;
                background: transparent !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                text-align: left !important;
                color: #334155 !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            .water-modal-option:hover {
                background: #f0f9ff !important;
                border-color: #7dd3fc !important;
            }

            .water-modal-option.is-active {
                background: #e0f2fe !important;
                border-color: #0288d1 !important;
                color: #0369a1 !important;
            }

            .water-modal-option .option-check {
                color: #0288d1;
            }
        `;
    document.head.appendChild(style);
    console.log('[SETUP] CSS Global do Modal injetado com sucesso.');
  }

  // Extrai o segmento após 'all/' da URL
  function getSegmentAfterAll() {
    const match = window.location.href.match(/all\/([^\/?#]+)/i);
    return match ? match[1] : null;
  }

  const dashboardId = getSegmentAfterAll();

  // Mapeamento dos botões → estados
  const dashboards = {
    equipmentsButton: {
      stateId: 'content_equipments',
      state: 'W3siaWQiOiJjb250ZW50X2VxdWlwbWVudHMiLCJwYXJhbXMiOnt9fV0%253D',
    },
    // energyButton: {
    //   stateId: "content_energy",
    //   state: "W3siaWQiOiJjb250ZW50X2VuZXJneSIsInBhcmFtcyI6e319XQ%253D%253D",
    // },
    // RFC-0087: Water states (summary, common area, stores)
    waterButton: {
      stateId: 'content_water',
      state: 'W3siaWQiOiJjb250ZW50X3dhdGVyIiwicGFyYW1zIjp7fX1d',
    },
    waterCommonAreaButton: {
      stateId: 'content_water_common_area',
      state: 'W3siaWQiOiJjb250ZW50X3dhdGVyX2NvbW1vbl9hcmVhIiwicGFyYW1zIjp7fX1d',
    },
    waterStoresButton: {
      stateId: 'content_water_stores',
      state: 'W3siaWQiOiJjb250ZW50X3dhdGVyX3N0b3JlcyIsInBhcmFtcyI6e319XQ==',
    },
    temperatureButton: {
      stateId: 'content_temperature',
      state: 'W3siaWQiOiJjb250ZW50X3RlbXBlcmF0dXJlIiwicGFyYW1zIjp7fX1d',
    },
  };

  const mainView = document.querySelector('#mainView');

  /**
   * RFC-0057: Switch content states using show/hide (no innerHTML manipulation!)
   * This prevents widgets from being destroyed/recreated on every navigation
   * @param {string} stateId - ID do estado do dashboard
   */
  function switchContentState(stateId) {
    try {
      if (!mainView) {
        console.error('[MENU] #mainView element not found in DOM');
        return;
      }

      // Find all content containers with data-content-state attribute
      const allContents = mainView.querySelectorAll('[data-content-state]');

      if (allContents.length === 0) {
        console.error('[MENU] No content containers found with data-content-state attribute');
        return;
      }

      // Hide all content containers
      allContents.forEach((content) => {
        content.style.display = 'none';
      });

      // Show target container
      const targetContent = mainView.querySelector(`[data-content-state="${stateId}"]`);
      if (targetContent) {
        targetContent.style.display = 'block';
        console.log(`[MENU] ✅ RFC-0057: Showing content state: ${stateId} (no dynamic rendering!)`);
      } else {
        console.warn(`[MENU] Content state not found: ${stateId}`);
        console.log(
          `[MENU] Available states: ${Array.from(allContents)
            .map((c) => c.getAttribute('data-content-state'))
            .join(', ')}`
        );
      }
    } catch (err) {
      console.error('[MENU] RFC-0057: Failed to switch content state:', err);
    }
  }

  // Automatiza a atribuição de eventos aos botões
  // RFC-0057: Using switchContentState instead of renderDashboard
  Object.entries(dashboards).forEach(([buttonId, { stateId }]) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', () => switchContentState(stateId));
    }
  });

  // ==============================================================
  // FIX: LISTENER DE TROCA DE ESTADO (Versão Híbrida)
  // ==============================================================
  self._onSwitchState = (ev) => {
    console.log(`[MAIN] [RFC-0079] 🔔 Received myio:switch-main-state event:`, ev.detail);

    const targetStateId = ev.detail?.targetStateId;
    if (!targetStateId) return;

    // VOLTAMOS PARA O SELETOR GLOBAL (Pois o log provou que ele funciona)
    const mainView = document.getElementById('mainView');

    if (!mainView) {
      console.error('[MAIN] ❌ mainView element not found (Global search failed)');
      return;
    }

    // Oculta todos (FORÇA BRUTA)
    const allStates = mainView.querySelectorAll('[data-content-state]');
    allStates.forEach((stateDiv) => {
      // Remove qualquer style inline antigo
      stateDiv.style.display = '';
      // Aplica o none com prioridade máxima
      stateDiv.style.setProperty('display', 'none', 'important');
    });

    // Mostra o alvo (FORÇA BRUTA)
    const targetState = mainView.querySelector(`[data-content-state="${targetStateId}"]`);
    if (targetState) {
      // Aplica o block com prioridade máxima
      targetState.style.setProperty('display', 'block', 'important');

      console.log(`[MAIN] ✅ Switched VISUALLY to: ${targetStateId}`);

      // Atualiza escopo angular se necessário
      if (self.ctx?.$scope) {
        self.ctx.$scope.mainContentStateId = targetStateId;
        if (self.ctx.$scope.$applyAsync) self.ctx.$scope.$applyAsync();
      }
    } else {
      console.error(`[MAIN] ❌ Target state ${targetStateId} not found`);
    }
  };

  // Adiciona o listener na janela
  window.addEventListener('myio:switch-main-state', self._onSwitchState);
  // ==============================================================

  // Inicializa o daterangepicker usando o componente MyIOLibrary
  const TZ = 'America/Sao_Paulo';
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
  if (inputElement && typeof MyIOLibrary !== 'undefined' && MyIOLibrary.createDateRangePicker) {
    MyIOLibrary.createDateRangePicker(inputElement, {
      presetStart: startISO,
      presetEnd: endISO,
      maxRangeDays: 365,
      onApply: (result) => {
        // ✅ FIX: ONLY store dates internally, don't dispatch event
        timeStart = result.startISO;
        timeEnd = result.endISO;

        // Update scope for other components to read (if needed)
        const startISOOffset = result.startISO.replace('Z', '-03:00');
        const endISOOffset = result.endISO.replace('Z', '-03:00');

        self.ctx.$scope.startDateISO = startISOOffset;
        self.ctx.$scope.endDateISO = endISOOffset;

        // Update UI display
        const startDate = new Date(result.startISO);
        const endDate = new Date(result.endISO);
        const timeWindow = `Intervalo: ${formatDiaMes(startDate)} - ${formatDiaMes(endDate)}`;
        const timeinterval = document.getElementById('energy-peak');
        if (timeinterval) {
          timeinterval.innerText = timeWindow;
        }

        console.log('[MENU] Date selection updated (no fetch):', {
          start: result.startISO,
          end: result.endISO,
        });

        // ✅ NO EVENT DISPATCHING - data will only be fetched when user clicks "Carregar" button
      },
    })
      .then((picker) => {
        console.log('[MENU] Date range picker inicializado com MyIOLibrary');
      })
      .catch((err) => {
        console.error('[MENU] Erro ao inicializar date picker:', err);
      });
  } else {
    console.warn('[MENU] MyIOLibrary.createDateRangePicker não disponível');
  }

  // ===== CARREGAR BUTTON HANDLER =====
  const btnCarregar = document.getElementById('load-button');

  if (btnCarregar) {
    btnCarregar.addEventListener('click', async () => {
      console.log('[MENU] Carregar button clicked - fetching data...');

      // Disable button during fetch
      btnCarregar.disabled = true;
      const originalHTML = btnCarregar.innerHTML;
      btnCarregar.innerHTML = '<i class="material-icons">hourglass_empty</i> Carregando...';

      try {
        // Prepare date range with timezone offset
        const startISOOffset = timeStart.replace('Z', '-03:00');
        const endISOOffset = timeEnd.replace('Z', '-03:00');

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
          'myio:date-range',
          JSON.stringify({
            startDate: startISOOffset,
            endDate: endISOOffset,
            startMs,
            endMs,
          })
        );

        console.log('[MENU] Dispatching myio:update-date event:', {
          startDate: startISOOffset,
          endDate: endISOOffset,
        });

        // ✅ NOW dispatch event to trigger data fetch
        window.dispatchEvent(
          new CustomEvent('myio:update-date', {
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

        // RFC: Request MAIN to update total consumption via CustomEvent
        if (window.custumersSelected && window.custumersSelected.length > 0) {
          window.dispatchEvent(
            new CustomEvent('myio:request-total-consumption', {
              detail: {
                customersArray: window.custumersSelected,
                startDateISO: startISOOffset,
                endDateISO: endISOOffset,
              },
            })
          );
          console.log('[MENU] Dispatched myio:request-total-consumption to MAIN');
        }
      } catch (error) {
        console.error('[MENU] Error loading data:', error);
        alert('Erro ao carregar dados. Tente novamente.');
      } finally {
        // Re-enable button
        btnCarregar.disabled = false;
        btnCarregar.innerHTML = originalHTML;
      }
    });

    console.log('[MENU] Carregar button handler registered');
  } else {
    console.warn('[MENU] Carregar button (load-button) not found');
  }

  // ===== LIMPAR BUTTON HANDLER (Force Refresh) =====
  const btnLimpar = document.getElementById('myio-clear-btn');

  if (btnLimpar) {
    btnLimpar.addEventListener('click', (event) => {
      console.log('[MENU] 🔄 Limpar (Force Refresh) clicked');

      // Confirmação do usuário
      const confirmed = confirm('Isso vai limpar todo o cache e recarregar os dados. Continuar?');
      if (!confirmed) {
        console.log('[MENU] Force Refresh cancelado pelo usuário');
        return;
      }

      try {
        // RFC-0057: No longer using localStorage, only memory cache

        // Invalida cache do orquestrador se disponível
        if (window.MyIOOrchestrator && window.MyIOOrchestrator.invalidateCache) {
          window.MyIOOrchestrator.invalidateCache('energy');
          window.MyIOOrchestrator.invalidateCache('water');
          console.log('[MENU] ✅ Cache do orquestrador invalidado');
        }

        // Limpa conteúdo visual dos widgets TELEMETRY
        const clearEvent = new CustomEvent('myio:telemetry:clear', {
          detail: { domain: 'energy' }, // ou pegar do estado atual
        });

        window.dispatchEvent(clearEvent);
        console.log(`[MENU] ✅ Evento de limpeza emitido`);

        // RFC-0057: Removed iframe event dispatch - no longer using iframes

        console.log('[MENU] 🔄 Force Refresh concluído com sucesso');

        // Recarrega a página para limpar todos os widgets visuais
        alert('Cache limpo com sucesso! A página será recarregada para aplicar as mudanças.');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (err) {
        console.error('[MENU] ❌ Erro durante Force Refresh:', err);
        alert('Erro ao limpar cache. Consulte o console para detalhes.');
      }
    });

    console.log('[MENU] Limpar button handler registered');
  } else {
    console.warn('[MENU] Limpar button (myio-clear-btn) not found');
  }

  // ===== METAS BUTTON HANDLER (Goals Panel) =====
  const btnMetas = document.getElementById('myio-goals-btn');

  if (btnMetas) {
    btnMetas.addEventListener('click', () => {
      console.log('[MENU] 🎯 Metas (Goals Panel) clicked');

      // Verifica se MyIOLibrary está disponível
      if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.openGoalsPanel) {
        console.error('[MENU] ❌ MyIOLibrary.openGoalsPanel não está disponível');
        alert('Componente de Metas não está disponível. Verifique a biblioteca MyIO.');
        return;
      }

      try {
        // ✅ Obtém o customerId pai (Holding) do settings
        // Este é o Customer raiz no ThingsBoard que contém os shoppings filhos
        const customerId = self.ctx?.settings?.customerId;

        if (!customerId) {
          console.error('[MENU] ❌ customerId não encontrado em settings');
          alert('Configuração de Customer ID não encontrada. Verifique as configurações do widget.');
          return;
        }

        console.log('[MENU] 📋 Using Holding customerId from settings:', customerId);

        // ✅ Obtém o token do localStorage (padrão do ThingsBoard)
        const token = localStorage.getItem('jwt_token');

        if (!token) {
          console.error('[MENU] ❌ Token JWT não encontrado no localStorage');
          alert('Token de autenticação não encontrado. Faça login novamente.');
          return;
        }

        console.log('[MENU] 🔑 Token JWT obtido do localStorage');

        // ✅ Prepara a lista de shoppings filhos (já computada pelo MENU)
        // Esta lista vem do modal de filtro e representa os Customers filhos
        const shoppingList = (self.ctx.$scope.custumer || [])
          .filter((c) => c.value && c.name && c.name.trim() !== c.value.trim())
          .map((c) => ({
            value: c.value, // UUID do Customer filho (Shopping)
            name: c.name, // Nome do Shopping
          }));

        console.log('[MENU] 🏬 Shopping list prepared:', {
          count: shoppingList.length,
          shoppings: shoppingList.map((s) => s.name),
        });

        // ✅ Determina qual shopping está selecionado no filtro (se algum)
        let selectedShoppingId = null;
        if (window.custumersSelected && window.custumersSelected.length > 0) {
          selectedShoppingId = window.custumersSelected[0].value;
          console.log('[MENU] 🎯 Current filter selection:', window.custumersSelected[0].name);
        }

        console.log('[MENU] 🚀 Opening Goals Panel with:', {
          holdingCustomerId: customerId,
          shoppingCount: shoppingList.length,
          selectedShopping: selectedShoppingId,
        });

        // ✅ Abre o painel de metas usando MyIOLibrary
        const panel = MyIOLibrary.openGoalsPanel({
          customerId: customerId, // Customer pai (Holding)
          token: token, // Token do localStorage
          api: {
            baseUrl: window.location.origin,
          },
          shoppingList: shoppingList, // Lista de shoppings filhos
          locale: 'pt-BR',
          onSave: async (goalsData) => {
            console.log('[MENU] ✅ Goals saved successfully:', {
              version: goalsData.version,
              yearsCount: Object.keys(goalsData.years || {}).length,
            });

            // Dispara evento global para outros widgets reagirem
            window.dispatchEvent(
              new CustomEvent('myio:goals-updated', {
                detail: {
                  goalsData,
                  customerId,
                  timestamp: Date.now(),
                },
              })
            );

            console.log("[MENU] 📊 Event 'myio:goals-updated' dispatched");

            // Feedback visual opcional
            // alert("✅ Metas salvas com sucesso!");
          },
          onClose: () => {
            console.log('[MENU] 🚪 Goals Panel closed');
          },
          styles: {
            primaryColor: '#6a1b9a', // Mesma cor do botão Metas (roxo MYIO)
            accentColor: '#FFC107', // Amarelo de destaque
            successColor: '#28a745', // Verde de sucesso
            errorColor: '#dc3545', // Vermelho de erro
            borderRadius: '8px',
            zIndex: 10000,
          },
        });

        console.log('[MENU] ✅ Goals Panel opened successfully');
      } catch (error) {
        console.error('[MENU] ❌ Error opening Goals Panel:', error);
        alert(`Erro ao abrir o painel de metas:\n${error.message}\n\nConsulte o console para mais detalhes.`);
      }
    });

    console.log('[MENU] Metas button handler registered');
  } else {
    console.warn('[MENU] Metas button (myio-goals-btn) not found');
  }

  const root = (self?.ctx?.$container && self.ctx.$container[0]) || document;

  computeCustomersFromCtx();

  bindTabs(root);
  bindFilter(root);

  // mocks (remova se alimentar via API/telemetria)

  const filterBtn = document.getElementById('filterBtn');

  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      console.log('[MENU] 🔘 Filter button clicked');
      console.log('[MENU] 📋 Current customers in scope:', self.ctx.$scope.custumer?.length || 0);

      if (!Array.isArray(self.ctx.$scope.custumer) || self.ctx.$scope.custumer.length === 0) {
        console.log('[MENU] ⚠️ No customers in scope, computing from ctx...');
        computeCustomersFromCtx();
        console.log('[MENU] 📋 Customers after compute:', self.ctx.$scope.custumer?.length || 0);
      }

      console.log('[MENU] 🚀 Opening filter modal...');
      injectModalGlobal();
      bindFilter(document.body);
      console.log('[MENU] ✅ Filter modal opened');
    });
  } else {
    console.error('[MENU] ❌ Filter button (filterBtn) not found in DOM!');
  }

  // Atualiza escopo com datas iniciais
  self.ctx.$scope.startDateISO = timeStart;
  self.ctx.$scope.endDateISO = timeEnd;

  // Dispara evento inicial com as datas preset
  const startDateFormatted = timeStart.replace('Z', '-03:00');
  const endDateFormatted = timeEnd.replace('Z', '-03:00');

  // ✅ Save initial dates globally for other widgets
  window.myioDateRange = {
    startDate: startDateFormatted,
    endDate: endDateFormatted,
    startMs: new Date(timeStart).getTime(),
    endMs: new Date(timeEnd).getTime(),
  };

  // ✅ Also save to localStorage
  localStorage.setItem('myio:date-range', JSON.stringify(window.myioDateRange));

  console.log('[MENU] Initial dates saved globally:', window.myioDateRange);

  window.addEventListener('myio:equipment-count-updated', (ev) => {
    computeCustomersFromCtx();
  });

  window.dispatchEvent(
    new CustomEvent('myio:update-date', {
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
    if (data.datasource.aliasName === 'Shopping') {
      const name = data.datasource.entityLabel;
      const value = data.data?.[0]?.[1];
      if (value != null && !custumerMap.has(value)) {
        custumerMap.set(value, { name, value });
      }
    }
  });
  computeCustomersFromCtx();

  // console.log("custumer",custumer)

  // ==============================================================
  // MODAL + LIMPEZA DE ABAS + SINCRONIZAÇÃO DE CHECK
  // ==============================================================
  setTimeout(() => {
    console.log('[SETUP] Iniciando fix do Modal V3...');

    const btn = document.getElementById('energyButton');
    let modal = document.getElementById('energyContextModal');
    const mainView = document.querySelector('#mainView') || document.getElementById('mainView');

    if (!btn || !modal) return;

    // 1. CLONAR BOTÃO (Limpar listeners antigos)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // 2. MOVER O MODAL PARA A RAIZ (evita cortes visuais)
    if (modal.parentNode !== document.body) {
      modal.parentNode.removeChild(modal);
      document.body.appendChild(modal);
    }

    // 3. AÇÃO DE CLIQUE DO BOTÃO ENERGIA
    newBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log('[CLICK] Botão Energia Clicado');

      // --- LIMPEZA DE ABAS ---
      const allTabs = document.querySelectorAll('.myio-tabs .tab');
      allTabs.forEach((t) => t.classList.remove('is-active'));
      newBtn.classList.add('is-active');

      // Verifica se vai abrir ou fechar
      const isVisible = modal.style.display === 'flex';

      if (!isVisible) {
        // [NOVO] --- SINCRONIZAÇÃO VISUAL DO MODAL ---
        // Verifica qual tela está ativa no momento (salva no escopo ou padrão)
        const currentState = self.ctx?.$scope?.mainContentStateId || 'content_equipments';

        const modalOptions = modal.querySelectorAll('.energy-modal-option');
        modalOptions.forEach((opt) => {
          // Se o data-target da opção for igual à tela atual, marca como ativo
          if (opt.getAttribute('data-target') === currentState) {
            opt.classList.add('is-active');
          } else {
            opt.classList.remove('is-active');
          }
        });
        // --------------------------------------------

        console.log('[ACTION] Abrindo modal sincronizado...');

        // Abre o modal com CSS forçado
        modal.style.cssText = `
                    display: flex !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background-color: rgba(0,0,0,0.6) !important;
                    z-index: 2147483647 !important;
                    align-items: center !important;
                    justify-content: center !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                `;

        // Estiliza conteúdo interno se necessário
        const content = modal.querySelector('.energy-modal-content');
        if (content) {
          content.style.cssText = `
                        display: flex !important;
                        flex-direction: column !important;
                        background: white !important;
                        padding: 0 !important;
                        border-radius: 16px !important;
                        min-width: 320px !important;
                        z-index: 2147483647 !important;
                        opacity: 1 !important;
                        border: none !important;
                        overflow: hidden !important;
                    `;
        }
      } else {
        modal.style.display = 'none';
      }
    };

    // 4. AÇÃO DAS OPÇÕES (DENTRO DO MODAL)
    const options = modal.querySelectorAll('.energy-modal-option');
    options.forEach((opt) => {
      opt.onclick = function (ev) {
        ev.stopPropagation();
        const targetStateId = this.getAttribute('data-target');
        const contextName = this.querySelector('.option-title')?.innerText;

        // Atualiza label visual
        const label = document.getElementById('energyContextLabel');
        if (label && contextName) label.innerText = `Energia: ${contextName.replace(' (Energia)', '')}`;

        // Fecha modal
        modal.style.display = 'none';

        // Troca de tela
        if (targetStateId && mainView) {
          const allStates = mainView.querySelectorAll('[data-content-state]');
          allStates.forEach((d) => d.style.setProperty('display', 'none', 'important'));

          const targetDiv = mainView.querySelector(`[data-content-state="${targetStateId}"]`);
          if (targetDiv) {
            targetDiv.style.setProperty('display', 'block', 'important');

            // Mantém botão ativo
            newBtn.classList.add('is-active');

            // Atualiza escopo angular (CRUCIAL para a sincronização funcionar na próxima vez)
            if (self.ctx?.$scope) {
              self.ctx.$scope.mainContentStateId = targetStateId;
              if (self.ctx.$scope.$applyAsync) self.ctx.$scope.$applyAsync();
            }

            // RFC: Dispatch myio:update-date to trigger data refresh in target widget (STORES, etc)
            const startDateISO = self.ctx.$scope?.startDateISO;
            const endDateISO = self.ctx.$scope?.endDateISO;
            if (startDateISO && endDateISO) {
              console.log(`[MENU] Dispatching myio:update-date for ${targetStateId}`);
              window.dispatchEvent(
                new CustomEvent('myio:update-date', {
                  detail: {
                    startDate: startDateISO,
                    endDate: endDateISO,
                  },
                })
              );
            }
          }
        }
      };
    });

    // 5. FECHAR AO CLICAR NO FUNDO
    modal.onclick = function (e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    };
  }, 1000);

  // ==============================================================
  // RFC-0087: WATER MODAL SETUP (Similar to Energy Modal)
  // ==============================================================
  setTimeout(() => {
    console.log('[SETUP] RFC-0087: Iniciando fix do Water Modal...');

    const waterBtn = document.getElementById('waterButton');
    let waterModal = document.getElementById('waterContextModal');
    const mainView = document.querySelector('#mainView') || document.getElementById('mainView');

    if (!waterBtn || !waterModal) {
      console.warn('[SETUP] Water button or modal not found');
      return;
    }

    // 1. CLONAR BOTÃO (Limpar listeners antigos)
    const newWaterBtn = waterBtn.cloneNode(true);
    waterBtn.parentNode.replaceChild(newWaterBtn, waterBtn);

    // 2. MOVER O MODAL PARA A RAIZ (evita cortes visuais)
    if (waterModal.parentNode !== document.body) {
      waterModal.parentNode.removeChild(waterModal);
      document.body.appendChild(waterModal);
    }

    // 3. AÇÃO DE CLIQUE DO BOTÃO ÁGUA
    newWaterBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log('[CLICK] Botão Água Clicado');

      // --- LIMPEZA DE ABAS ---
      const allTabs = document.querySelectorAll('.myio-tabs .tab');
      allTabs.forEach((t) => t.classList.remove('is-active'));
      newWaterBtn.classList.add('is-active');

      // Verifica se vai abrir ou fechar
      const isVisible = waterModal.style.display === 'flex';

      if (!isVisible) {
        // --- SINCRONIZAÇÃO VISUAL DO MODAL ---
        const waterStates = ['content_water', 'content_water_common_area', 'content_water_stores'];
        const currentState = self.ctx?.$scope?.mainContentStateId || 'content_water';

        const modalOptions = waterModal.querySelectorAll('.water-modal-option');
        modalOptions.forEach((opt) => {
          if (opt.getAttribute('data-target') === currentState) {
            opt.classList.add('is-active');
          } else {
            opt.classList.remove('is-active');
          }
        });

        console.log('[ACTION] Abrindo water modal sincronizado...');

        // Abre o modal com CSS forçado
        waterModal.style.cssText = `
          display: flex !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background-color: rgba(0,0,0,0.6) !important;
          z-index: 2147483647 !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 1 !important;
          visibility: visible !important;
        `;

        // Estiliza conteúdo interno
        const content = waterModal.querySelector('.water-modal-content');
        if (content) {
          content.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            background: white !important;
            padding: 0 !important;
            border-radius: 16px !important;
            min-width: 320px !important;
            z-index: 2147483647 !important;
            opacity: 1 !important;
            border: none !important;
            overflow: hidden !important;
          `;
        }
      } else {
        waterModal.style.display = 'none';
      }
    };

    // 4. AÇÃO DAS OPÇÕES (DENTRO DO MODAL)
    const waterOptions = waterModal.querySelectorAll('.water-modal-option');
    waterOptions.forEach((opt) => {
      opt.onclick = function (ev) {
        ev.stopPropagation();
        const targetStateId = this.getAttribute('data-target');
        const contextName = this.querySelector('.option-title')?.innerText;

        // Atualiza label visual
        const label = document.getElementById('waterContextLabel');
        if (label && contextName) label.innerText = `Água: ${contextName}`;

        // Atualiza opção ativa
        waterOptions.forEach((o) => o.classList.remove('is-active'));
        this.classList.add('is-active');

        // Fecha modal
        waterModal.style.display = 'none';

        // Troca de tela
        if (targetStateId && mainView) {
          const allStates = mainView.querySelectorAll('[data-content-state]');
          allStates.forEach((d) => d.style.setProperty('display', 'none', 'important'));

          const targetDiv = mainView.querySelector(`[data-content-state="${targetStateId}"]`);
          if (targetDiv) {
            targetDiv.style.setProperty('display', 'block', 'important');

            // Mantém botão ativo
            newWaterBtn.classList.add('is-active');

            // Atualiza escopo angular
            if (self.ctx?.$scope) {
              self.ctx.$scope.mainContentStateId = targetStateId;
              if (self.ctx.$scope.$applyAsync) self.ctx.$scope.$applyAsync();
            }

            // Dispatch myio:update-date to trigger data refresh
            const startDateISO = self.ctx.$scope?.startDateISO;
            const endDateISO = self.ctx.$scope?.endDateISO;
            if (startDateISO && endDateISO) {
              console.log(`[MENU] Dispatching myio:update-date for ${targetStateId}`);
              window.dispatchEvent(
                new CustomEvent('myio:update-date', {
                  detail: {
                    startDate: startDateISO,
                    endDate: endDateISO,
                  },
                })
              );
            }

            console.log(`[MENU] RFC-0087: Switched to water state: ${targetStateId}`);
          }
        }
      };
    });

    // 5. FECHAR AO CLICAR NO FUNDO
    waterModal.onclick = function (e) {
      if (e.target === waterModal) {
        waterModal.style.display = 'none';
      }
    };

    console.log('[SETUP] RFC-0087: Water Modal setup complete');
  }, 1100);

  const originalDestroy = self.onDestroy;
  self.onDestroy = function () {
    if (originalDestroy) originalDestroy();

    // Remove o modal do body se ele existir lá
    const modal = document.getElementById('energyContextModal');
    if (modal && modal.parentNode === document.body) {
      document.body.removeChild(modal);
    }

    // RFC-0087: Remove water modal from body
    const waterModal = document.getElementById('waterContextModal');
    if (waterModal && waterModal.parentNode === document.body) {
      document.body.removeChild(waterModal);
    }
  };

  // ==============================================================
  // FIX VISUAL FINAL: GERENTE DE ABAS (Versão Agressiva)
  // Garante limpeza total antes de selecionar
  // Coloque no FINAL do self.onInit
  // ==============================================================

  const energyStates = ['content_equipments', 'content_energy', 'content_store'];
  // RFC-0087: Water states for tab highlighting
  const waterStates = ['content_water', 'content_water_common_area', 'content_water_stores'];

  window.addEventListener('myio:switch-main-state', (ev) => {
    const targetId = ev.detail?.targetStateId;
    if (!targetId) return;

    console.log(`[TABS] Atualizando abas para: ${targetId}`);

    // 1. LIMPEZA TOTAL (Tática Agressiva)
    // Busca TODOS os elementos com a classe .tab dentro da barra de navegação
    const allTabs = document.querySelectorAll('.myio-tabs .tab');

    // Remove a classe 'is-active' de TODOS eles sem exceção
    allTabs.forEach((tab) => {
      tab.classList.remove('is-active');
    });

    // 2. SELECIONA OS BOTÕES ESPECÍFICOS
    const btnEnergy = document.getElementById('energyButton');
    const btnWater = document.getElementById('waterButton');
    const btnTemp = document.getElementById('temperatureButton');

    // 3. ACENDE APENAS O CORRETO
    if (energyStates.includes(targetId)) {
      if (btnEnergy) btnEnergy.classList.add('is-active');
    } else if (waterStates.includes(targetId)) {
      // RFC-0087: Highlight water button for any water state
      if (btnWater) btnWater.classList.add('is-active');
    } else if (targetId === 'content_temperature') {
      if (btnTemp) btnTemp.classList.add('is-active');
    }
  });
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
    if (status === 'online') onlineDevices++;
  });
  let percentage = totalDevices > 0 ? ((onlineDevices / totalDevices) * 100).toFixed(1) : 0;
  percentage = Number(percentage).toFixed(0);
};

self.onDestroy = function () {
  /* nada a limpar */
  if (self._onDateParams) {
    window.removeEventListener('myio:date-params', self._onDateParams);
  }

  // FIX 3: Remove listener de troca de estado
  if (self._onSwitchState) {
    window.removeEventListener('myio:switch-main-state', self._onSwitchState);
  }
};
