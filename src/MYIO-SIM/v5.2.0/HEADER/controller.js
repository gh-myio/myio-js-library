/* global self, window, document, localStorage, MyIOLibrary */

/***********************************
 *  MENU PREMIUM + FILTRO MODAL    *
 ***********************************/
const EVT_SWITCH = 'myio:switch-main-state';

let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
// Use shared utilities from MAIN, with fallback to local implementation
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

// ===== INFOTOOLTIP FROM LIBRARY (RFC-0105) =====
/**
 * Get InfoTooltip from the library
 * @returns {object|null} InfoTooltip component or null if not available
 */
function getInfoTooltip() {
  return window.MyIOLibrary?.InfoTooltip || null;
}

// ===== SHOPPING FILTER STATE =====
let selectedShoppingIds = []; // Shopping ingestionIds selected in filter

// ✅ Check if filter was already applied before HEADER initialized
if (
  window.custumersSelected &&
  Array.isArray(window.custumersSelected) &&
  window.custumersSelected.length > 0
) {
  LogHelper.log('[HEADER] 🔄 Applying pre-existing filter:', window.custumersSelected.length, 'shoppings');
  selectedShoppingIds = window.custumersSelected.map((s) => s.value).filter((v) => v);
}

// RFC: updateTotalConsumption moved to MAIN - use myio:request-total-consumption event
// RFC: updateTotalWaterConsumption moved to MAIN - use myio:request-total-water-consumption event

function publishSwitch(targetStateId) {
  const detail = { targetStateId, source: 'menu_v_1_0_0', ts: Date.now() };
  window.dispatchEvent(new CustomEvent(EVT_SWITCH, { detail }));
  // console.log("[menu] switch ->", detail);
}

function setActiveTab(btn, root) {
  root.querySelectorAll('.tab.is-active').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
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

function injectModalGlobal() {
  // ==== Config & helpers ====================================================
  const PRESET_KEY = 'myio_dashboard_filter_presets_v1';
  // Estado global (compartilhado entre aberturas)
  if (!window.myioFilterSel) {
    window.myioFilterSel = { malls: [], floors: [], places: [] };
  }
  if (!window.myioFilterQuery) {
    window.myioFilterQuery = '';
  }
  if (!window.myioFilterPresets) {
    try {
      window.myioFilterPresets = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]');
    } catch {
      window.myioFilterPresets = [];
    }
  }

  // Fonte de dados: preferir window.mallsTree (formato do original)
  // Se não existir, converte um FILTER_DATA simples em uma árvore mínima.
  function getTree() {
    if (Array.isArray(window.mallsTree) && window.mallsTree.length) {
      return window.mallsTree;
    }
    // fallback a partir de FILTER_DATA = [{id,name,floors:n}]
    if (Array.isArray(window.FILTER_DATA) && window.FILTER_DATA.length) {
      return window.FILTER_DATA.map((m) => {
        const mallId = m.id || crypto.randomUUID();
        const floors = Array.from({ length: Number(m.floors || 1) }).map((_, i) => {
          const floorId = `${mallId}-F${i + 1}`;
          // sem places reais, colocamos 0..2 mockados
          const places = Array.from({ length: 3 }).map((__, k) => ({
            id: `${floorId}-P${k + 1}`,
            name: `Loja ${k + 1}`,
          }));
          return { id: floorId, name: `Piso ${i + 1}`, children: places };
        });
        return { id: mallId, name: m.name || `Shopping ${mallId}`, children: floors };
      });
    }
    // último fallback vazio
    return [];
  }

  const mallsTree = getTree();

  // Flatten para mapa id->nome (chips)
  function flatten(tree) {
    const list = [];
    for (const mall of tree) {
      list.push({ id: mall.id, name: mall.name });
      for (const fl of mall.children || []) {
        list.push({ id: fl.id, name: fl.name });
        for (const pl of fl.children || []) list.push({ id: pl.id, name: pl.name });
      }
    }
    return list;
  }

  function nodeMatchesQuery(nodeName, q) {
    if (!q) return true;
    return nodeName.toLowerCase().includes(q.toLowerCase());
  }

  function toggle(arr, val) {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  function countSelected(sel) {
    return (sel.malls?.length || 0) + (sel.floors?.length || 0) + (sel.places?.length || 0);
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
          display: flex;              /* horizontal: quadrado + texto */
          align-items: center;
          gap: 10px;                  /* espaço entre quadrado e texto */
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 6px 10px;
          margin-bottom: 6px;
          background: transparent;
          font-weight: 600;
          color: #344054;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .custumers:hover {
          background: #f2f2f2;
        }
        
        .custumers .checkbox {
          width: 16px;
          height: 16px;
          border: 1px solid #344054;
          border-radius: 3px;
          flex-shrink: 0;
          background-color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .custumers.selected .checkbox {
          background-color: #1D4F91; /* quadrado preenchido quando selecionado */
        }

        .myio-modal[aria-hidden="false"] { opacity: 1; pointer-events: auto; }
        .myio-modal-card {
          background: #fff; border-radius: 12px; max-width: 980px; width: 92%;
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
        .save-btn{ border:0; background:#B7D14B; color:#1C2743; font-weight:700; padding:8px 12px; border-radius:10px; cursor:pointer; }
        .apply-btn{ border:0; background:#1D4F91; color:#fff; font-weight:700; padding:10px 16px; border-radius:10px; cursor:pointer; }

        .chips { display:flex; flex-wrap:wrap; gap:8px; }
        .chip { display:inline-flex; align-items:center; gap:6px; border:1px solid #CFDCE8; border-radius:999px; padding:4px 10px; font-size:12px; }
        .chip .rm { cursor:pointer; border:0; background:transparent; opacity:.7; }

        .flt-content { display:flex; gap:12px; overflow:hidden; }
        .flt-tree { flex: 1 1 auto; overflow:auto; max-height: 46vh; padding-right:4px; display:flex; flex-direction:column; gap:12px; }
        .mall-card { border:1px solid #CFDCE8; border-radius:12px; padding:12px; }
        .mall-head { display:flex; align-items:center; gap:8px; }
        .sub { margin-top:10px; padding-left:22px; display:flex; flex-direction:column; gap:10px; }
        .floor-card{ border:1px solid #E6EEF5; border-radius:10px; padding:10px; }
        .floor-head{ display:flex; align-items:center; gap:8px; }
        .places { margin-top:8px; padding-left:20px; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; }
        .place-item{ display:flex; align-items:center; gap:8px; border:1px solid #E6EEF5; border-radius:8px; padding:6px 8px; font-size:13px; }

        .presets { flex: 0 0 auto; width: 260px; border-left:1px dashed #E6EEF5; padding-left:12px; }
        .preset-title{ font-size:12px; color:#6b7280; display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .preset-list{ display:flex; flex-direction:column; gap:6px; }
        .preset-item{ display:flex; align-items:center; justify-content:space-between; border:1px solid #E6EEF5; border-radius:8px; padding:6px 8px; }
        .preset-item button{ border:0; background:transparent; cursor:pointer; }

        .kbd { background:#f5f7fa; border:1px solid #e6eef5; padding:2px 6px; border-radius:6px; font-size:11px; color:#475467; }
        .badge { border:1px solid #CFDCE8; border-radius:999px; padding:2px 8px; font-size:11px; color:#334155; }
      </style>

      <div class="myio-modal" id="filterModal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="fltTitle">
        <div class="myio-modal-backdrop" data-close="true"></div>
        <div class="myio-modal-card">
          <header class="myio-modal-hd">
            <h3 id="fltTitle">Filtro avançado</h3>
            <button class="close-x" data-close="true" aria-label="Fechar">×</button>
          </header>

          <div class="myio-modal-body">
            <!-- Barra de busca e ações -->
            <div class="flt-row">
              <div class="flt-search">
                <span class="search-ico">🔎</span>
                <input id="fltSearch" type="text" placeholder="Buscar shopping, piso, loja/ambiente…" autocomplete="off">
              </div>
              <button class="link-btn" id="fltClear">🧹 Limpar</button>
              <button class="save-btn" id="fltSave">💾 Salvar preset</button>
              <span id="fltCount" class="badge" title="Total de seleções">0 selecionados</span>
            </div>

            <!-- Chips -->
            <div id="fltChips" class="chips"></div>

            <div class="flt-content">
              <!-- Árvore -->
              <div class="flt-tree" id="fltList" role="listbox" aria-label="Árvore de seleção"></div>

              <!-- Presets -->
              <aside class="presets">
                <div class="preset-title">★ Presets salvos</div>
                <div id="fltPresets" class="preset-list"></div>
                <div style="margin-top:8px; font-size:12px; color:#6b7280;">
                  Dica: salve até <span class="kbd">12</span> presets.
                </div>
              </aside>
            </div>
          </div>

          <footer class="myio-modal-ft">
            <div style="flex:1; color:#6b7280; font-size:12px;">
              Use <span class="kbd">Buscar</span> para filtrar nós rapidamente.
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
  const elSave = container.querySelector('#fltSave');
  const elApply = container.querySelector('#fltApply');
  const elChips = container.querySelector('#fltChips');
  const elPresets = container.querySelector('#fltPresets');
  const elCount = container.querySelector('#fltCount');

  // ==== Render helpers ======================================================
  const flatMap = new Map(flatten(mallsTree).map((n) => [n.id, n.name]));

  function isMallChecked(sel, mallId) {
    return sel.malls.includes(mallId);
  }
  function isFloorChecked(sel, floorId) {
    return sel.floors.includes(floorId);
  }
  function isPlaceChecked(sel, placeId) {
    return sel.places.includes(placeId);
  }

  function renderCount() {
    const c = countSelected(window.myioFilterSel);
    elCount.textContent = `${c} selecionado${c === 1 ? '' : 's'}`;
  }

  function renderChips() {
    elChips.innerHTML = '';
    const chips = [
      ...window.myioFilterSel.malls.map((id) => ({ id, label: flatMap.get(id) })),
      ...window.myioFilterSel.floors.map((id) => ({ id, label: flatMap.get(id) })),
      ...window.myioFilterSel.places.map((id) => ({ id, label: flatMap.get(id) })),
    ].filter((c) => !!c.label);

    for (const c of chips) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `
        <span>${c.label}</span>
        <button class="rm" title="Remover" aria-label="Remover seleção">×</button>
      `;
      chip.querySelector('.rm').addEventListener('click', () => {
        window.myioFilterSel = {
          malls: window.myioFilterSel.malls.filter((x) => x !== c.id),
          floors: window.myioFilterSel.floors.filter((x) => x !== c.id),
          places: window.myioFilterSel.places.filter((x) => x !== c.id),
        };
        renderAll();
      });
      elChips.appendChild(chip);
    }
  }

  function renderTree() {
    const q = window.myioFilterQuery || '';
    elList.innerHTML = '';

    mallsTree.forEach((mall) => {
      // floor & place ids
      const floorIds = (mall.children || []).map((f) => f.id);
      const placeIds = (mall.children || []).flatMap((f) => (f.children || []).map((p) => p.id));

      // decide se mall aparece pelos filtros
      const mallMatch = nodeMatchesQuery(mall.name, q);
      // container do mall
      const mallCard = document.createElement('div');
      mallCard.className = 'mall-card';
      mallCard.innerHTML = `
        <label class="mall-head">
          <input type="checkbox" ${isMallChecked(window.myioFilterSel, mall.id) ? 'checked' : ''} />
          <span class="font-medium">${mall.name}</span>
          <span class="badge" style="margin-left:6px">${(mall.children || []).length} pisos</span>
        </label>
        <div class="sub"></div>
      `;
      const mallCheck = mallCard.querySelector('input');
      const mallSub = mallCard.querySelector('.sub');

      // click no mall: seleciona/deseleciona mall + floors + places
      mallCheck.addEventListener('change', () => {
        const checked = mallCheck.checked;
        window.myioFilterSel = {
          malls: checked
            ? [...new Set([...window.myioFilterSel.malls, mall.id])]
            : window.myioFilterSel.malls.filter((id) => id !== mall.id),
          floors: checked
            ? [...new Set([...window.myioFilterSel.floors, ...floorIds])]
            : window.myioFilterSel.floors.filter((id) => !floorIds.includes(id)),
          places: checked
            ? [...new Set([...window.myioFilterSel.places, ...placeIds])]
            : window.myioFilterSel.places.filter((id) => !placeIds.includes(id)),
        };
        renderAll();
      });

      // floors
      (mall.children || [])
        .filter((fl) => {
          const floorMatch = nodeMatchesQuery(fl.name, q);
          const hasPlaceMatch = (fl.children || []).some((p) => nodeMatchesQuery(p.name, q));
          // Exibe o floor se: mall já bateu OU floor bate OR alguma loja bate
          return mallMatch || floorMatch || hasPlaceMatch;
        })
        .forEach((fl) => {
          const floorCard = document.createElement('div');
          floorCard.className = 'floor-card';
          floorCard.innerHTML = `
            <label class="floor-head">
              <input type="checkbox" ${isFloorChecked(window.myioFilterSel, fl.id) ? 'checked' : ''} />
              <span>${fl.name}</span>
              <span class="badge" style="margin-left:6px">${(fl.children || []).length} ambientes</span>
            </label>
            <div class="places"></div>
          `;
          const floorCheck = floorCard.querySelector('input');
          const placesBox = floorCard.querySelector('.places');

          floorCheck.addEventListener('change', () => {
            const checked = floorCheck.checked;
            const thisPlaceIds = (fl.children || []).map((p) => p.id);
            window.myioFilterSel = {
              malls: checked
                ? [...new Set([...window.myioFilterSel.malls, mall.id])]
                : window.myioFilterSel.malls, // não removemos o mall automaticamente (outros floors podem continuar)
              floors: toggle(window.myioFilterSel.floors, fl.id),
              places: checked
                ? [...new Set([...window.myioFilterSel.places, ...thisPlaceIds])]
                : window.myioFilterSel.places.filter((id) => !thisPlaceIds.includes(id)),
            };
            renderAll();
          });

          (fl.children || [])
            .filter((p) => {
              const pmatch = nodeMatchesQuery(p.name, q);
              // Exibe place se qualquer nó ancestral/ele mesmo bate
              return mallMatch || nodeMatchesQuery(fl.name, q) || pmatch;
            })
            .forEach((p) => {
              const li = document.createElement('label');
              li.className = 'place-item';
              li.innerHTML = `
                <input type="checkbox" ${isPlaceChecked(window.myioFilterSel, p.id) ? 'checked' : ''} />
                <span class="text-sm">${p.name}</span>
              `;
              const chk = li.querySelector('input');
              chk.addEventListener('change', () => {
                const checked = chk.checked;
                window.myioFilterSel = {
                  malls: checked
                    ? [...new Set([...window.myioFilterSel.malls, mall.id])]
                    : window.myioFilterSel.malls,
                  floors: checked
                    ? [...new Set([...window.myioFilterSel.floors, fl.id])]
                    : window.myioFilterSel.floors,
                  places: toggle(window.myioFilterSel.places, p.id),
                };
                renderAll();
              });
              placesBox.appendChild(li);
            });

          mallSub.appendChild(floorCard);
        });

      // Só adiciona o mallCard se ele próprio ou seus filhos batem a busca
      if (mallMatch || mallSub.children.length > 0) {
        elList.appendChild(mallCard);
      }
    });
    if (!window.custumersSelected) window.custumersSelected = [];

    if (!elList.children.length) {
      if (Array.isArray(self.ctx.$scope.custumer) && self.ctx.$scope.custumer.length) {
        elList.style.textAlign = 'left';

        self.ctx.$scope.custumer.forEach((c) => {
          const item = document.createElement('button');
          item.className = 'custumers';

          // armazenar o dado no próprio botão
          item.custumerData = c;

          // quadrado à esquerda
          const box = document.createElement('div');
          box.className = 'checkbox';
          item.appendChild(box);

          // texto do cliente
          const text = document.createElement('span');
          text.textContent = c.name;
          item.appendChild(text);
          window.custumersSelected = [];
          // clique para selecionar/deselecionar
          item.addEventListener('click', () => {
            const isSelected = item.classList.toggle('selected');
            if (isSelected) {
              window.custumersSelected.push(c); // adiciona ao array
            } else {
              window.custumersSelected = window.custumersSelected.filter((x) => x !== c);
            }
            // console.log("Selecionados:", window.custumersSelected);
          });
          self.ctx.filterCustom = window.custumersSelected;

          elList.appendChild(item);
        });
      } else {
        const empty = document.createElement('div');
        empty.style.color = '#6b7280';
        empty.style.fontSize = '14px';
        empty.style.textAlign = 'left';
        empty.textContent = 'Nenhum resultado encontrado para o filtro atual.';
        elList.appendChild(empty);
      }
    }
  }

  function renderPresets() {
    elPresets.innerHTML = '';
    const presets = window.myioFilterPresets || [];
    if (!presets.length) {
      const empty = document.createElement('div');
      empty.style.color = '#6b7280';
      empty.style.fontSize = '12px';
      empty.textContent = 'Nenhum preset salvo ainda.';
      elPresets.appendChild(empty);
      return;
    }
    presets.slice(0, 12).forEach((p) => {
      const row = document.createElement('div');
      row.className = 'preset-item';
      const btnApply = document.createElement('button');
      btnApply.textContent = p.name;
      btnApply.title = 'Aplicar preset';
      btnApply.style.textDecoration = 'underline';

      const btnDel = document.createElement('button');
      btnDel.innerHTML = '🗑️';
      btnDel.title = 'Excluir preset';

      btnApply.addEventListener('click', () => {
        // aplica seleção do preset
        window.myioFilterSel = {
          malls: [...(p.selection?.malls || [])],
          floors: [...(p.selection?.floors || [])],
          places: [...(p.selection?.places || [])],
        };
        renderAll();
      });

      btnDel.addEventListener('click', () => {
        window.myioFilterPresets = (window.myioFilterPresets || []).filter((x) => x.id !== p.id);
        try {
          localStorage.setItem(PRESET_KEY, JSON.stringify(window.myioFilterPresets));
        } catch {
          LogHelper.warn('[HEADER] Erro ao salvar presets no localStorage');
        }
        renderPresets();
      });

      row.appendChild(btnApply);
      row.appendChild(btnDel);
      elPresets.appendChild(row);
    });
  }

  function renderAll() {
    renderCount();
    renderChips();
    renderTree();
    // não precisa re-render presets a cada clique, mas aqui é seguro:
    renderPresets();
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
      window.myioFilterSel = { malls: [], floors: [], places: [] };
      window.myioFilterQuery = '';
      elSearch.value = '';
      renderAll();
    });
  }

  if (!elSave._bound) {
    elSave._bound = true;
    elSave.addEventListener('click', () => {
      const name = window.prompt('Nome do preset:');
      if (!name) return;
      const preset = {
        id: crypto.randomUUID(),
        name,
        selection: {
          malls: [...window.myioFilterSel.malls],
          floors: [...window.myioFilterSel.floors],
          places: [...window.myioFilterSel.places],
        },
        createdAt: Date.now(),
      };
      const next = [preset, ...(window.myioFilterPresets || [])].slice(0, 12);
      window.myioFilterPresets = next;
      try {
        localStorage.setItem(PRESET_KEY, JSON.stringify(next));
      } catch {
        LogHelper.warn('[HEADER] Erro ao salvar presets no localStorage');
      }
      renderPresets();
    });
  }

  if (!elApply._bound) {
    elApply._bound = true;
    elApply.addEventListener('click', async () => {
      // Itens selecionados
      //console.log("Itens selecionados:", window.custumersSelected);

      const percentDiference = document.getElementById('energy-trend');

      percentDiference.innerText = '';

      // Desabilita botão enquanto carrega
      elApply.disabled = true;

      // RFC: Request MAIN to update total consumption via CustomEvent
      window.dispatchEvent(
        new CustomEvent('myio:request-total-consumption', {
          detail: {
            customersArray: window.custumersSelected,
            startDateISO: self.ctx.$scope.startDateISO,
            endDateISO: self.ctx.$scope.endDateISO,
          },
        })
      );

      // RFC: Request MAIN to update water consumption via CustomEvent
      window.dispatchEvent(
        new CustomEvent('myio:request-total-water-consumption', {
          detail: {
            customersArray: window.custumersSelected,
            startDateISO: self.ctx.$scope.startDateISO,
            endDateISO: self.ctx.$scope.endDateISO,
          },
        })
      );

      // RFC-0100: Temperature will be updated via myio:filter-applied -> MAIN orchestrator
      // No need to call updateTemperatureCard() directly anymore

      // Reabilita botão
      elApply.disabled = false;

      // Dispara evento com os custumers selecionados
      window.dispatchEvent(
        new CustomEvent('myio:filter-applied', {
          detail: {
            selection: window.custumersSelected,
            ts: Date.now(),
          },
        })
      );

      // Fecha modal
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

  // Foco no input de busca
  setTimeout(() => elSearch?.focus(), 0);
}

function bindFilter(root) {
  if (root._filterBound) return;
  root._filterBound = true;
  const modal = document.getElementById('filterModal');
  if (!modal) return; // se modal não existe, sai

  const btnApply = modal.querySelector('#fltApply');

  btnApply?.addEventListener('click', () => {
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

function setSummary(data = {}) {
  // === Equipamentos ===
  if (data.equip) {
    const pct = Math.max(0, Math.min(100, data.equip.percent ?? 0));
    document.getElementById('equip-kpi').textContent = data.equip.totalStr ?? '0/0';
    document.getElementById('equip-sub').textContent = `${pct}% operational`;
    setBarPercent(document.getElementById('equip-bar'), pct, 8);
  }

  // === Energia ===
  if (data.energy) {
    const trendEl = document.getElementById('energy-trend');
    document.getElementById('energy-kpi').textContent = data.energy.kpi ?? '--';
    // trendEl.textContent = (data.energy.trendDir === 'up' ? '↑ ' : '// ') + (data.energy.trendText?.replace(/[↑↓]\s*/,'') || '');
    trendEl.classList.toggle('down', (data.energy.trendDir || 'down') === 'down');
    trendEl.classList.toggle('up', (data.energy.trendDir || 'down') === 'up');
    // Removido: não mostramos mais textos no rodapé dos cards
    // document.getElementById("energy-peak").textContent =
    //     data.energy.peakText ?? "";
  }

  // === Temperatura ===
  if (data.temp) {
    document.getElementById('temp-kpi').textContent = '--';
    // Removido: faixa ideal agora é mostrada apenas no tooltip
    // document.getElementById("temp-range").textContent =
    //     data.temp.rangeText ?? "";
  }

  // === Água ===
  if (data.water) {
    const pct = Math.max(0, Math.min(100, data.water.percent ?? 0));
    document.getElementById('water-kpi').textContent = `${pct}%`;
    setBarPercent(document.getElementById('water-bar'), pct, 12); // cauda um pouco maior
  }
}

window.myioSetMenuSummary = setSummary;

/* ====== Apply Card Custom Colors ====== */
function applyCardColors() {
  const settings = self.ctx.settings;

  // Card Equipamentos
  const cardEquip = document.getElementById('card-equip');
  if (cardEquip) {
    const bgColor = settings.cardEquipamentosBackgroundColor || '#1F3A35';
    const fontColor = settings.cardEquipamentosFontColor || '#F2F2F2';
    cardEquip.style.setProperty('background', bgColor, 'important');
    cardEquip.style.setProperty('background-color', bgColor, 'important');
    cardEquip.style.setProperty('color', fontColor, 'important');
  }

  // Card Energia
  const cardEnergy = document.getElementById('card-energy');
  if (cardEnergy) {
    const bgColor = settings.cardEnergiaBackgroundColor || '#1F3A35';
    const fontColor = settings.cardEnergiaFontColor || '#F2F2F2';
    cardEnergy.style.setProperty('background', bgColor, 'important');
    cardEnergy.style.setProperty('background-color', bgColor, 'important');
    cardEnergy.style.setProperty('color', fontColor, 'important');
  }

  // Card Temperatura
  const cardTemp = document.getElementById('card-temp');
  if (cardTemp) {
    const bgColor = settings.cardTemperaturaBackgroundColor || '#1F3A35';
    const fontColor = settings.cardTemperaturaFontColor || '#F2F2F2';
    cardTemp.style.setProperty('background', bgColor, 'important');
    cardTemp.style.setProperty('background-color', bgColor, 'important');
    cardTemp.style.setProperty('color', fontColor, 'important');
  }

  // Card Água
  const cardWater = document.getElementById('card-water');
  if (cardWater) {
    const bgColor = settings.cardAguaBackgroundColor || '#1F3A35';
    const fontColor = settings.cardAguaFontColor || '#F2F2F2';
    cardWater.style.setProperty('background', bgColor, 'important');
    cardWater.style.setProperty('background-color', bgColor, 'important');
    cardWater.style.setProperty('color', fontColor, 'important');
  }

  LogHelper.log('[HEADER] Card colors applied from settings');
}

/* ====== Lifecycle ====== */
self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
  // Define timezone e datas iniciais
  const hoje = new Date();

  // Define datas iniciais (início do mês até hoje)
  const startDate = presetStart
    ? new Date(presetStart)
    : new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
  const endDate = presetEnd
    ? new Date(presetEnd)
    : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  // Converte para ISO strings
  let timeStart = startDate.toISOString();
  let timeEnd = endDate.toISOString();

  const root = (self?.ctx?.$container && self.ctx.$container[0]) || document;

  LogHelper.log('[HEADER] self.ctx', self.ctx);

  bindTabs(root);
  bindFilter(root);

  // Aplicar cores personalizadas dos cards e setup do tooltip (após o DOM estar pronto)
  setTimeout(() => {
    applyCardColors();

    // Setup temperature tooltip directly here
    const tempTrigger = root.querySelector('#temp-info-trigger');
    if (tempTrigger && !tempTrigger._tooltipBound) {
      tempTrigger._tooltipBound = true;
      LogHelper.log('[HEADER] Temperature tooltip trigger found in onInit');

      tempTrigger.addEventListener('mouseenter', (e) => {
        LogHelper.log(
          '[HEADER] Tooltip mouseenter - currentTemperatureData:',
          window._headerTempData ? 'available' : 'not available'
        );
        if (window._headerTempData) {
          showTemperatureTooltip(tempTrigger, window._headerTempData);
        } else {
          // Show tooltip even without data
          showTemperatureTooltip(tempTrigger, {
            globalAvg: null,
            shoppingsInRange: [],
            shoppingsOutOfRange: [],
            devices: [],
          });
        }
      });

      tempTrigger.addEventListener('mouseleave', () => {
        hideTemperatureTooltip();
      });
    } else {
      LogHelper.warn('[HEADER] Temperature tooltip trigger NOT found in onInit');
    }

    // Setup energy tooltip
    const energyTrigger = root.querySelector('#energy-info-trigger');
    if (energyTrigger && !energyTrigger._tooltipBound) {
      energyTrigger._tooltipBound = true;
      LogHelper.log('[HEADER] Energy tooltip trigger found in onInit');

      energyTrigger.addEventListener('mouseenter', (e) => {
        LogHelper.log(
          '[HEADER] Energy tooltip mouseenter - data:',
          window._headerEnergyData ? 'available' : 'not available'
        );
        if (window._headerEnergyData) {
          showEnergyTooltip(energyTrigger, window._headerEnergyData);
        } else {
          showEnergyTooltip(energyTrigger, {
            customerTotal: null,
            unfilteredTotal: null,
            equipmentsTotal: null,
            lojasTotal: null,
            shoppingsEnergy: [],
          });
        }
      });

      energyTrigger.addEventListener('mouseleave', () => {
        hideEnergyTooltip();
      });
    } else {
      LogHelper.warn('[HEADER] Energy tooltip trigger NOT found in onInit');
    }

    // Setup water tooltip
    const waterTrigger = root.querySelector('#water-info-trigger');
    if (waterTrigger && !waterTrigger._tooltipBound) {
      waterTrigger._tooltipBound = true;
      LogHelper.log('[HEADER] Water tooltip trigger found in onInit');

      waterTrigger.addEventListener('mouseenter', (e) => {
        LogHelper.log(
          '[HEADER] Water tooltip mouseenter - data:',
          window._headerWaterData ? 'available' : 'not available'
        );
        if (window._headerWaterData) {
          showWaterTooltip(waterTrigger, window._headerWaterData);
        } else {
          showWaterTooltip(waterTrigger, {
            filteredTotal: null,
            unfilteredTotal: null,
            commonArea: null,
            stores: null,
            shoppingsWater: [],
          });
        }
      });

      waterTrigger.addEventListener('mouseleave', () => {
        hideWaterTooltip();
      });
    } else {
      LogHelper.warn('[HEADER] Water tooltip trigger NOT found in onInit');
    }

    // Setup equipment tooltip
    const equipTrigger = root.querySelector('#equip-info-trigger');
    if (equipTrigger && !equipTrigger._tooltipBound) {
      equipTrigger._tooltipBound = true;
      LogHelper.log('[HEADER] Equipment tooltip trigger found in onInit');

      equipTrigger.addEventListener('mouseenter', (e) => {
        LogHelper.log(
          '[HEADER] Equipment tooltip mouseenter - data:',
          window._headerEquipData ? 'available' : 'not available'
        );
        if (window._headerEquipData) {
          showEquipmentTooltip(equipTrigger, window._headerEquipData);
        } else {
          showEquipmentTooltip(equipTrigger, {
            totalEquipments: 0,
            filteredEquipments: 0,
            allShoppingsSelected: true,
            categories: null,
          });
        }
      });

      equipTrigger.addEventListener('mouseleave', () => {
        hideEquipmentTooltip();
      });
    } else {
      LogHelper.warn('[HEADER] Equipment tooltip trigger NOT found in onInit');
    }
  }, 200);

  // RFC-0103: Removed mock values - real data comes from orchestrator events
  // setSummary only sets initial placeholder text, real values come from:
  // - myio:energy-summary-ready for energy
  // - myio:water-summary-ready for water
  // - myio:temperature-data-ready for temperature
  // - myio:equipment-count-updated for equipment

  const filterBtn = document.getElementById('filterBtn');

  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      injectModalGlobal(); // cria o modal se ainda não existe
      bindFilter(document.body); // agora os elementos existem
    });
  }

  // Atualiza escopo com datas iniciais
  self.ctx.$scope.startDateISO = timeStart;
  self.ctx.$scope.endDateISO = timeEnd;

  // RFC-0093: Removed myio:update-date dispatch - MENU is the single source of truth for dates
  // The HEADER should NOT dispatch date events, only MENU controls the date range

  // RFC-0100: Request shoppings data from MAIN orchestrator
  // HEADER no longer extracts from ctx.data directly - MAIN is the source of truth
  window.dispatchEvent(new CustomEvent('myio:request-shoppings-data'));
};

// ===== RFC-0100: HEADER receives shoppings data from MAIN =====
window.addEventListener('myio:shoppings-data-ready', (ev) => {
  LogHelper.log('[HEADER] RFC-0100: Received shoppings data from MAIN:', ev.detail);

  const { shoppings = [] } = ev.detail || {};

  // Store in scope for other functions
  self.ctx.$scope.custumer = shoppings;

  // RFC: Request MAIN to update total consumption via CustomEvent
  window.dispatchEvent(
    new CustomEvent('myio:request-total-consumption', {
      detail: {
        customersArray: shoppings,
        startDateISO: self.ctx.$scope.startDateISO,
        endDateISO: self.ctx.$scope.endDateISO,
      },
    })
  );

  // RFC: Request MAIN to update water consumption via CustomEvent
  window.dispatchEvent(
    new CustomEvent('myio:request-total-water-consumption', {
      detail: {
        customersArray: shoppings,
        startDateISO: self.ctx.$scope.startDateISO,
        endDateISO: self.ctx.$scope.endDateISO,
      },
    })
  );

  LogHelper.log(`[HEADER] RFC-0100: Stored ${shoppings.length} shoppings and requested consumption data`);
});

// ===== HEADER: Equipment Card Handler =====
/**
 * RFC: Update equipment card - now receives data from EQUIPMENTS widget via event
 * Shows total equipment count (MOTOR, ELEVADOR, ESCADA_ROLANTE, etc)
 * Format: "X / Total" when filtered, or just "Total" when all shoppings selected
 */
function updateEquipmentCard(eventData = null) {
  const statusDevice = document.getElementById('equip-kpi');
  const subtitleDevice = document.getElementById('equip-sub');

  if (!eventData) {
    // Show loading state
    if (statusDevice) statusDevice.innerText = '-';
    if (subtitleDevice) subtitleDevice.innerText = 'Aguardando dados...';
    return;
  }

  const { totalEquipments, filteredEquipments, allShoppingsSelected } = eventData;

  // RFC: Show "Total" when all selected, or "Filtered / Total" with percentage when filtered
  if (allShoppingsSelected) {
    if (statusDevice) statusDevice.innerText = `${totalEquipments}`;
    if (subtitleDevice) subtitleDevice.innerText = 'Total de equipamentos';
  } else {
    // Calculate percentage
    const percentage = totalEquipments > 0 ? Math.round((filteredEquipments / totalEquipments) * 100) : 0;

    if (statusDevice) statusDevice.innerText = `${filteredEquipments} / ${totalEquipments}`;
    if (subtitleDevice) subtitleDevice.innerText = `${percentage}%`;
  }

  LogHelper.log('[HEADER] Equipment card updated:', {
    total: totalEquipments,
    filtered: filteredEquipments,
    allSelected: allShoppingsSelected,
  });
}

// ============================================
// RFC-0100: Temperature data fetching functions REMOVED
// All temperature API calls are now handled by MAIN orchestrator
// HEADER only receives data via myio:temperature-data-ready event
// See: updateTemperatureCardFromOrchestrator() for display logic
// ============================================

// RFC-0093: Update energy card with total from energy-summary-ready event
// Now accepts full summary object with customerTotal, unfilteredTotal, isFiltered
function updateEnergyCardWithTotal(summary) {
  const energyKpi = document.getElementById('energy-kpi');
  const energyTrend = document.getElementById('energy-trend');

  if (!energyKpi) return;

  // Handle both old format (just number) and new format (object)
  const customerTotal = typeof summary === 'object' ? summary.customerTotal : summary;
  const unfilteredTotal = typeof summary === 'object' ? summary.unfilteredTotal : customerTotal;
  const isFiltered = typeof summary === 'object' ? summary.isFiltered : false;

  const formatEnergy = (val) =>
    typeof MyIOLibrary?.formatEnergy === 'function' ? MyIOLibrary.formatEnergy(val) : `${val.toFixed(2)} kWh`;

  // RFC-0093: Use same pattern as Equipment card - show "filtered / total" with percentage
  const showComparative =
    isFiltered && unfilteredTotal > 0 && Math.abs(customerTotal - unfilteredTotal) > 0.01;

  if (showComparative) {
    const formattedFiltered = formatEnergy(customerTotal);
    const formattedTotal = formatEnergy(unfilteredTotal);
    const percentage = Math.round((customerTotal / unfilteredTotal) * 100);

    // RFC-0093: Reduced font size and show filtered/total format
    energyKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.65em; color: #666;">/ ${formattedTotal}</span>`;
    energyKpi.style.fontSize = '0.85em';

    // Show percentage in subrow (same style as Equipment card)
    if (energyTrend) {
      energyTrend.innerText = `${percentage}%`;
    }

    LogHelper.log(
      `[HEADER] Energy card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
    );
  } else {
    // Show only total when no filter or values are the same
    const formatted = formatEnergy(customerTotal);
    energyKpi.innerText = formatted;
    energyKpi.style.fontSize = '0.85em';

    // Clear subrow when not filtered
    if (energyTrend) {
      energyTrend.innerText = '';
    }

    LogHelper.log(`[HEADER] Energy card updated from summary: ${formatted}`);
  }
  // RFC-0093: Removed dispatch of myio:customer-total-consumption to prevent infinite loop
}

function updateEnergyCard(energyCache) {
  const energyKpi = document.getElementById('energy-kpi');
  const energyTrend = document.getElementById('energy-trend');

  LogHelper.log('[HEADER] Updating energy card | cache devices:', energyCache?.size || 0);

  // ✅ Get filtered and unfiltered consumption from orchestrator
  let filteredConsumption = 0;
  let unfilteredConsumption = 0;
  let isFiltered = false;
  let deviceCount = 0;

  if (typeof window.MyIOOrchestrator?.getTotalConsumption === 'function') {
    filteredConsumption = window.MyIOOrchestrator.getTotalConsumption();
    unfilteredConsumption = window.MyIOOrchestrator.getUnfilteredTotalConsumption?.() || filteredConsumption;
    isFiltered = window.MyIOOrchestrator.isFilterActive?.() || false;
    LogHelper.log('[HEADER] Energy consumption:', { filteredConsumption, unfilteredConsumption, isFiltered });
  } else {
    LogHelper.warn('[HEADER] MyIOOrchestrator.getTotalConsumption not available');
    // Fallback: sum all from cache (old behavior)
    if (energyCache) {
      energyCache.forEach((cached) => {
        if (cached && cached.total_value) {
          filteredConsumption += cached.total_value || 0;
          deviceCount++;
        }
      });
      unfilteredConsumption = filteredConsumption;
    }
  }

  // ✅ Format and display
  if (energyKpi) {
    const formatEnergy = (val) =>
      typeof MyIOLibrary?.formatEnergy === 'function'
        ? MyIOLibrary.formatEnergy(val)
        : `${val.toFixed(2)} kWh`;

    // RFC-0093: Reduced font size for the KPI
    energyKpi.style.fontSize = '0.85em';

    // Show "filtered / total" only when filter is active AND values are different
    const showComparative =
      isFiltered && unfilteredConsumption > 0 && Math.abs(filteredConsumption - unfilteredConsumption) > 0.01;

    if (showComparative) {
      const formattedFiltered = formatEnergy(filteredConsumption);
      const formattedTotal = formatEnergy(unfilteredConsumption);
      const percentage = Math.round((filteredConsumption / unfilteredConsumption) * 100);

      energyKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.65em; color: #666;">/ ${formattedTotal}</span>`;

      // Show percentage in subrow (same style as Equipment card)
      if (energyTrend) {
        energyTrend.innerText = `${percentage}%`;
      }
      LogHelper.log(
        `[HEADER] Energy card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
      );
    } else {
      // Show only total when no filter or values are the same
      const formatted = formatEnergy(filteredConsumption);
      energyKpi.innerText = formatted;

      // Clear subrow when not filtered
      if (energyTrend) {
        energyTrend.innerText = '';
      }
      LogHelper.log(`[HEADER] Energy card updated: ${formatted}`);
    }
  } else {
    LogHelper.error('[HEADER] energyKpi element not found!');
  }

  // ✅ EMIT EVENT: Notify ENERGY widget of customer total consumption
  const customerTotalEvent = {
    customerTotal: filteredConsumption,
    unfilteredTotal: unfilteredConsumption,
    isFiltered,
    deviceCount,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent('myio:customer-total-consumption', {
      detail: customerTotalEvent,
    })
  );

  LogHelper.log(`[HEADER] ✅ Emitted myio:customer-total-consumption:`, customerTotalEvent);
}

function updateWaterCard(waterCache) {
  const waterKpi = document.getElementById('water-kpi');
  const waterTrend = document.getElementById('water-trend');

  LogHelper.log('[HEADER] Updating water card | cache devices:', waterCache?.size || 0);

  // ✅ Get water consumption from Orchestrator waterTotals (only valid TB aliases)
  // RFC-0097: The API may return devices not configured in any TB alias
  // We should show only the sum of devices from HidrometrosAreaComum + Todos Hidrometros Lojas
  let filteredConsumption = 0;
  let unfilteredConsumption = 0;
  let isFiltered = false;

  // PRIORIDADE 1: Usar getWaterTotals() que calcula apenas IDs válidos dos Aliases TB
  const waterTotals = window.MyIOOrchestrator?.getWaterTotals?.();
  if (waterTotals && waterTotals.total > 0) {
    filteredConsumption = waterTotals.total;
    unfilteredConsumption = waterTotals.total; // Totais válidos são o unfiltrado também
    isFiltered = window.MyIOOrchestrator?.isFilterActive?.() || false;
    LogHelper.log('[HEADER] Water consumption (from valid TB aliases):', {
      filteredConsumption,
      commonArea: waterTotals.commonArea,
      stores: waterTotals.stores,
    });
  } else {
    // FALLBACK: Se ainda não tiver totais calculados, não mostrar nada
    LogHelper.warn('[HEADER] No valid water totals available yet');
    filteredConsumption = 0;
    unfilteredConsumption = 0;
  }

  // ✅ Format and display - RFC-0093: Use same pattern as Equipment card
  if (waterKpi) {
    const formatWater = (val) =>
      typeof MyIOLibrary?.formatWaterVolumeM3 === 'function'
        ? MyIOLibrary.formatWaterVolumeM3(val)
        : `${val.toFixed(2)} m³`;

    // RFC-0093: Reduced font size for the KPI (matching energy card)
    waterKpi.style.fontSize = '0.85em';

    // RFC-0093: Show "filtered / total" only when filter is active AND values are different
    const showComparative =
      isFiltered && unfilteredConsumption > 0 && Math.abs(filteredConsumption - unfilteredConsumption) > 0.01;

    if (showComparative) {
      const formattedFiltered = formatWater(filteredConsumption);
      const formattedTotal = formatWater(unfilteredConsumption);
      const percentage = Math.round((filteredConsumption / unfilteredConsumption) * 100);

      // RFC-0093: Use same font sizes as energy card (0.65em for comparison)
      waterKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.65em; color: #666;">/ ${formattedTotal}</span>`;

      // Show percentage in subrow (same style as Equipment card)
      if (waterTrend) {
        waterTrend.innerText = `${percentage}%`;
      }
      LogHelper.log(
        `[HEADER] Water card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
      );
    } else {
      // Show only total when no filter or values are the same
      const formatted = formatWater(filteredConsumption);
      waterKpi.innerText = formatted;

      // Clear subrow when not filtered
      if (waterTrend) {
        waterTrend.innerText = '';
      }
      LogHelper.log(`[HEADER] Water card updated: ${formatted}`);
    }
  } else {
    LogHelper.error('[HEADER] waterKpi element not found!');
  }
}

// ===== HEADER: Listen for energy data from MAIN orchestrator =====
// RFC-0093: Listen for energy-summary-ready for the correct total (equipments + lojas)
window._headerEnergyData = null; // Global for tooltip access

window.addEventListener('myio:energy-summary-ready', (ev) => {
  LogHelper.log('[HEADER] 📊 heard myio:energy-summary-ready:', ev.detail);
  const summary = ev.detail || {};

  // Store for tooltip
  window._headerEnergyData = summary;

  if (typeof summary.customerTotal === 'number') {
    // RFC-0093: Pass full summary object to show comparative (filtered/total) like Equipment card
    updateEnergyCardWithTotal(summary);
  }
});

// RFC-0093: Also listen for energy-data-ready as initial fallback (shows loading/partial data)
window.addEventListener('myio:energy-data-ready', (ev) => {
  LogHelper.log('[HEADER] ⚡ heard myio:energy-data-ready:', ev.detail?.cache?.size || 0, 'items');
  // Only use this if we haven't received a summary yet
  // The summary will have the correct total after EQUIPMENTS identifies devices
  if (ev.detail && ev.detail.cache) {
    // RFC-0103: Skip if summary already received (it has the correct total)
    if (window._headerEnergyData?.customerTotal !== undefined) {
      LogHelper.log('[HEADER] ⚡ Skipping energy-data-ready - summary already received');
      return;
    }
    // Show initial data (summary not received yet)
    LogHelper.log('[HEADER] ⚡ Calling updateEnergyCard (no summary yet)...');
    updateEnergyCard(ev.detail.cache);
  }
});

window.addEventListener('myio:water-data-ready', (ev) => {
  LogHelper.log('[HEADER] 💧 heard myio:water-data-ready:', ev.detail?.cache?.size || 0, 'items');

  // RFC: Skip update if water-summary-ready already set comparative display
  // The water-summary-ready event has priority as it includes filtered/unfiltered comparison
  if (window._headerWaterData?.isFiltered) {
    LogHelper.log('[HEADER] Skipping water-data-ready - summary with filter already applied');
    return;
  }

  // Se 'ev.detail.cache' existir, atualiza o card
  if (ev.detail && ev.detail.cache) {
    updateWaterCard(ev.detail.cache);
  }
});

// ===== HEADER: Listen for water summary (for tooltip and comparative) =====
window._headerWaterData = null; // Global for tooltip access

window.addEventListener('myio:water-summary-ready', (ev) => {
  LogHelper.log('[HEADER] 💧 heard myio:water-summary-ready:', ev.detail);
  const summary = ev.detail || {};

  // Store for tooltip
  window._headerWaterData = summary;

  // Update water card with summary data (includes comparative)
  if (typeof summary.filteredTotal === 'number') {
    updateWaterCardWithSummary(summary);
  }
});

/**
 * Update water card with summary data (includes comparative filter/total)
 * @param {Object} summary - Water summary from myio:water-summary-ready
 */
function updateWaterCardWithSummary(summary) {
  const waterKpi = document.getElementById('water-kpi');
  const waterTrend = document.getElementById('water-trend');

  if (!waterKpi) return;

  const { filteredTotal = 0, unfilteredTotal = 0, isFiltered = false } = summary;

  const formatWater = (val) =>
    typeof MyIOLibrary?.formatWaterVolumeM3 === 'function'
      ? MyIOLibrary.formatWaterVolumeM3(val)
      : `${val.toFixed(2)} m³`;

  // Show comparative when filtered and values differ
  const showComparative =
    isFiltered && unfilteredTotal > 0 && Math.abs(filteredTotal - unfilteredTotal) > 0.01;

  waterKpi.style.fontSize = '0.85em';

  if (showComparative) {
    const formattedFiltered = formatWater(filteredTotal);
    const formattedTotal = formatWater(unfilteredTotal);
    const percentage = Math.round((filteredTotal / unfilteredTotal) * 100);

    waterKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.65em; color: #666;">/ ${formattedTotal}</span>`;

    if (waterTrend) {
      waterTrend.innerText = `${percentage}%`;
    }
    LogHelper.log(
      `[HEADER] Water card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
    );
  } else {
    const formatted = formatWater(filteredTotal);
    waterKpi.innerText = formatted;

    if (waterTrend) {
      waterTrend.innerText = '';
    }
    LogHelper.log(`[HEADER] Water card updated from summary: ${formatted}`);
  }
}

// ===== HEADER: Listen for equipment count updates from EQUIPMENTS widget =====
window._headerEquipData = null; // Global for tooltip access

window.addEventListener('myio:equipment-count-updated', (ev) => {
  LogHelper.log('[HEADER] 🔧 heard myio:equipment-count-updated:', ev.detail);

  // Store for tooltip
  window._headerEquipData = ev.detail;

  updateEquipmentCard(ev.detail);
});

// ===== HEADER: Listen for shopping filter =====
window.addEventListener('myio:filter-applied', (ev) => {
  LogHelper.log('[HEADER] 🔥 heard myio:filter-applied:', ev.detail);

  const selection = ev.detail?.selection || [];
  selectedShoppingIds = selection.map((s) => s.value).filter((v) => v);

  LogHelper.log(
    '[HEADER] Applying shopping filter:',
    selectedShoppingIds.length === 0 ? 'ALL' : `${selectedShoppingIds.length} shoppings`
  );
  if (selectedShoppingIds.length > 0) {
    LogHelper.log('[HEADER] Selected shopping IDs:', selectedShoppingIds);
  }

  // Equipment card will be updated via myio:equipment-count-updated event from EQUIPMENTS widget
  // Energy/Water cards will be updated via myio:orchestrator-filter-updated event
  // RFC-0100: Temperature card will be updated via myio:temperature-data-ready event from MAIN
  // This ensures the orchestrator has already processed the filter
});

// ===== HEADER: Listen for orchestrator filter update (after MAIN processes the filter) =====
window.addEventListener('myio:orchestrator-filter-updated', (ev) => {
  LogHelper.log('[HEADER] 🔄 heard myio:orchestrator-filter-updated:', ev.detail);

  // Update cards with current cache - energy-summary-ready will correct the total later
  if (window.MyIOOrchestrator?.getEnergyCache) {
    updateEnergyCard(window.MyIOOrchestrator.getEnergyCache());
  }
  // RFC: Water card is now updated via water-summary-ready event which includes comparative
  // Don't call updateWaterCard here as it would overwrite the comparative display
});

// ===== HEADER: Listen for water totals calculated from valid TB aliases =====
// Este evento é disparado quando widgets WATER_COMMON_AREA ou WATER_STORES registram seus IDs
window.addEventListener('myio:water-totals-updated', (ev) => {
  const { commonArea, stores, total } = ev.detail || {};
  LogHelper.log('[HEADER] 💧 heard myio:water-totals-updated:', { commonArea, stores, total });

  // RFC: Skip update if water-summary-ready already set comparative display
  // The water-summary-ready event has priority as it includes filtered/unfiltered comparison
  if (window._headerWaterData?.isFiltered) {
    LogHelper.log('[HEADER] Skipping water-totals-updated - summary with filter already applied');
    return;
  }

  // Atualizar card de água com total calculado (apenas IDs válidos dos Aliases TB)
  const waterKpi = document.getElementById('water-kpi');
  if (waterKpi && total > 0) {
    // Usar MyIOLibrary.formatWaterVolumeM3 diretamente (formatWater é local à função updateWaterCard)
    const formatted =
      typeof MyIOLibrary?.formatWaterVolumeM3 === 'function'
        ? MyIOLibrary.formatWaterVolumeM3(total)
        : `${total.toFixed(2)} m³`;
    waterKpi.innerText = formatted;
    LogHelper.log(`[HEADER] Water card updated from valid aliases: ${formatted}`);
  }
});

// ===== RFC-0100: HEADER listens for temperature data from MAIN orchestrator =====
let currentTemperatureData = null;
window._headerTempData = null; // Global for tooltip access

window.addEventListener('myio:temperature-data-ready', (ev) => {
  LogHelper.log('[HEADER] RFC-0100: Received temperature data from MAIN:', ev.detail);
  const data = ev.detail;
  if (data) {
    currentTemperatureData = data;
    window._headerTempData = data; // Store globally for tooltip
    updateTemperatureCardFromOrchestrator(data);
  }
});

/**
 * RFC-0105: Build temperature tooltip content HTML
 * Uses InfoTooltip CSS classes for consistent styling
 */
function buildTemperatureTooltipContent(data) {
  const {
    globalAvg,
    filteredAvg,
    isFiltered,
    shoppingsInRange = [],
    shoppingsOutOfRange = [],
    shoppingsUnknownRange = [],
  } = data || {};

  const totalShoppings = shoppingsInRange.length + shoppingsOutOfRange.length + shoppingsUnknownRange.length;

  // Build shopping list HTML
  let shoppingListHtml = '';

  if (shoppingsInRange.length > 0) {
    shoppingListHtml += `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          <span>✅</span> Dentro da Faixa (${shoppingsInRange.length})
        </div>
        ${shoppingsInRange.map((s) => {
          const rangeText = s.min != null && s.max != null ? `(${s.min}–${s.max}°C)` : '';
          return `
          <div class="myio-info-tooltip__row">
            <span class="myio-info-tooltip__label">✔ ${s.name} <span style="color:#94a3b8;font-size:10px;">${rangeText}</span></span>
            <span class="myio-info-tooltip__value" style="color:#22c55e;">${s.avg?.toFixed(1)}°C</span>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  if (shoppingsOutOfRange.length > 0) {
    shoppingListHtml += `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          <span>⚠️</span> Fora da Faixa (${shoppingsOutOfRange.length})
        </div>
        ${shoppingsOutOfRange.map((s) => {
          const rangeText = s.min != null && s.max != null ? `(${s.min}–${s.max}°C)` : '';
          return `
          <div class="myio-info-tooltip__row">
            <span class="myio-info-tooltip__label">⚠ ${s.name} <span style="color:#94a3b8;font-size:10px;">${rangeText}</span></span>
            <span class="myio-info-tooltip__value" style="color:#f59e0b;">${s.avg?.toFixed(1)}°C</span>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  if (shoppingsUnknownRange.length > 0) {
    shoppingListHtml += `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          <span>❓</span> Faixa Não Definida (${shoppingsUnknownRange.length})
        </div>
        ${shoppingsUnknownRange.map((s) => `
          <div class="myio-info-tooltip__row">
            <span class="myio-info-tooltip__label">? ${s.name} <span style="color:#94a3b8;font-size:10px;">(sem configuração)</span></span>
            <span class="myio-info-tooltip__value" style="color:#6b7280;">${s.avg?.toFixed(1)}°C</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Status badge
  const okCount = shoppingsInRange.length;
  const warnCount = shoppingsOutOfRange.length;
  const unknownCount = shoppingsUnknownRange.length;

  let statusHtml = '';
  if (totalShoppings > 0) {
    const okPerc = Math.round((okCount / totalShoppings) * 100);
    const warnPerc = Math.round((warnCount / totalShoppings) * 100);
    const unknownPerc = Math.round((unknownCount / totalShoppings) * 100);

    statusHtml = `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">📊 Resumo</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">
            ✅ ${okCount} OK (${okPerc}%)
          </span>
          ${warnCount > 0 ? `<span style="background:#fef3c7;color:#b45309;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">
            ⚠️ ${warnCount} Alerta (${warnPerc}%)
          </span>` : ''}
          ${unknownCount > 0 ? `<span style="background:#f3f4f6;color:#6b7280;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">
            ❓ ${unknownCount} N/D (${unknownPerc}%)
          </span>` : ''}
        </div>
      </div>
    `;
  }

  // Averages section
  const avgValue = isFiltered ? (filteredAvg || globalAvg || '--') : (globalAvg || '--');
  const avgLabel = isFiltered ? 'Média Filtrada' : 'Média Geral';
  const avgFormatted = typeof avgValue === 'number' ? avgValue.toFixed(1) + '°C' : avgValue;

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">🌡️ ${avgLabel}</div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Temperatura:</span>
        <span class="myio-info-tooltip__value myio-info-tooltip__value--highlight">${avgFormatted}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Shoppings:</span>
        <span class="myio-info-tooltip__value">${totalShoppings}</span>
      </div>
    </div>

    ${statusHtml}
    ${shoppingListHtml}

    <div class="myio-info-tooltip__notice">
      <span class="myio-info-tooltip__notice-icon">ℹ️</span>
      <div class="myio-info-tooltip__notice-text">
        São considerados apenas os <strong>sensores em ambientes climatizáveis</strong> que estejam <strong>ativos</strong>.
      </div>
    </div>
  `;
}

function showTemperatureTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showTemperatureTooltip called', { triggerElement, data });

  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot show temperature tooltip');
    return;
  }

  const content = buildTemperatureTooltipContent(data);
  InfoTooltip.show(triggerElement, {
    icon: '🌡️',
    title: 'Temperatura - Visão Geral',
    content: content
  });
}

function hideTemperatureTooltip() {
  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot hide temperature tooltip');
    return;
  }
  InfoTooltip.startDelayedHide();
}

// ===== ENERGY TOOLTIP FUNCTIONS =====

/**
 * RFC-0105: Build energy tooltip content HTML
 */
function buildEnergyTooltipContent(data) {
  const {
    customerTotal = 0,
    equipmentsTotal = 0,
    lojasTotal = 0,
    deviceCount = 0,
    shoppingsEnergy = [],
  } = data || {};

  const formatEnergy = (val) => {
    if (val == null || isNaN(val)) return '--';
    if (typeof MyIOLibrary?.formatEnergy === 'function') {
      return MyIOLibrary.formatEnergy(val);
    }
    return val >= 1000 ? `${(val / 1000).toFixed(2)} MWh` : `${val.toFixed(2)} kWh`;
  };

  // Build shopping table HTML if available
  let shoppingTableHtml = '';
  if (shoppingsEnergy && shoppingsEnergy.length > 0) {
    const rows = shoppingsEnergy
      .sort((a, b) => (b.equipamentos || 0) + (b.lojas || 0) - ((a.equipamentos || 0) + (a.lojas || 0)))
      .map((s) => `
        <div class="myio-info-tooltip__row" style="font-size:11px;">
          <span class="myio-info-tooltip__label">${s.name}</span>
          <span class="myio-info-tooltip__value">${formatEnergy((s.equipamentos || 0) + (s.lojas || 0))}</span>
        </div>
      `).join('');

    shoppingTableHtml = `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          <span>🏢</span> Por Shopping
        </div>
        ${rows}
      </div>
    `;
  }

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span>📊</span> Resumo Geral
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Consumo Total:</span>
        <span class="myio-info-tooltip__value myio-info-tooltip__value--highlight">${formatEnergy(customerTotal)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Equipamentos:</span>
        <span class="myio-info-tooltip__value">${formatEnergy(equipmentsTotal)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Lojas:</span>
        <span class="myio-info-tooltip__value">${formatEnergy(lojasTotal)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Dispositivos:</span>
        <span class="myio-info-tooltip__value">${deviceCount || 0}</span>
      </div>
    </div>

    ${shoppingTableHtml}

    <div class="myio-info-tooltip__notice">
      <span class="myio-info-tooltip__notice-icon">ℹ️</span>
      <div class="myio-info-tooltip__notice-text">
        O consumo total inclui <strong>equipamentos de área comum</strong> e <strong>medidores de lojas</strong>.
      </div>
    </div>
  `;
}

function showEnergyTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showEnergyTooltip called', { triggerElement, data });

  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot show energy tooltip');
    return;
  }

  const content = buildEnergyTooltipContent(data);
  InfoTooltip.show(triggerElement, {
    icon: '⚡',
    title: 'Detalhes de Consumo de Energia',
    content: content
  });
}

function hideEnergyTooltip() {
  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot hide energy tooltip');
    return;
  }
  InfoTooltip.startDelayedHide();
}

// ============================================
// WATER TOOLTIP FUNCTIONS
// ============================================

/**
 * RFC-0105: Build water tooltip content using InfoTooltip classes
 */
function buildWaterTooltipContent(data) {
  const { filteredTotal = 0, commonArea = 0, stores = 0, deviceCount = 0, shoppingsWater = [] } = data || {};

  // Format water value
  const formatWater = (val) => {
    if (val == null || isNaN(val)) return '--';
    if (typeof MyIOLibrary?.formatWaterVolumeM3 === 'function') {
      return MyIOLibrary.formatWaterVolumeM3(val);
    }
    return `${val.toFixed(2)} m³`;
  };

  // Build shopping list HTML if available
  let shoppingListHtml = '';
  if (shoppingsWater && shoppingsWater.length > 0) {
    const rows = shoppingsWater
      .sort((a, b) => (b.areaComum || 0) + (b.lojas || 0) - ((a.areaComum || 0) + (a.lojas || 0)))
      .map((s) => `
        <div class="myio-info-tooltip__row" style="font-size:11px;">
          <span class="myio-info-tooltip__label">${s.name}</span>
          <span class="myio-info-tooltip__value">${formatWater((s.areaComum || 0) + (s.lojas || 0))}</span>
        </div>
      `).join('');

    shoppingListHtml = `
      <div class="myio-info-tooltip__section">
        <div class="myio-info-tooltip__section-title">
          <span>🏢</span> Por Shopping
        </div>
        ${rows}
      </div>
    `;
  }

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span>📊</span> Resumo Geral
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Consumo Total:</span>
        <span class="myio-info-tooltip__value myio-info-tooltip__value--highlight">${formatWater(filteredTotal)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Área Comum:</span>
        <span class="myio-info-tooltip__value">${formatWater(commonArea)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Lojas:</span>
        <span class="myio-info-tooltip__value">${formatWater(stores)}</span>
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Dispositivos:</span>
        <span class="myio-info-tooltip__value">${deviceCount || 0}</span>
      </div>
    </div>

    ${shoppingListHtml}

    <div class="myio-info-tooltip__notice">
      <span class="myio-info-tooltip__notice-icon">ℹ️</span>
      <div class="myio-info-tooltip__notice-text">
        O consumo total considera <strong>hidrômetros de área comum</strong> e <strong>hidrômetros de lojas</strong>.
      </div>
    </div>
  `;
}

function showWaterTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showWaterTooltip called', { triggerElement, data });

  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot show water tooltip');
    return;
  }

  const content = buildWaterTooltipContent(data);
  InfoTooltip.show(triggerElement, {
    icon: '💧',
    title: 'Detalhes de Consumo de Água',
    content: content
  });
}

function hideWaterTooltip() {
  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot hide water tooltip');
    return;
  }
  InfoTooltip.startDelayedHide();
}

// ============================================
// EQUIPMENT TOOLTIP FUNCTIONS
// ============================================

/**
 * RFC-0105: Build equipment tooltip content using InfoTooltip classes
 */
function buildEquipmentTooltipContent(data) {
  const {
    totalEquipments = 0,
    filteredEquipments = 0,
    allShoppingsSelected = true,
    categories = null,
  } = data || {};

  // Category colors for badges
  const categoryColors = {
    climatizacao: { bg: '#ecfeff', border: '#06b6d4', text: '#0891b2' },
    elevadores: { bg: '#f5f3ff', border: '#8b5cf6', text: '#7c3aed' },
    escadasRolantes: { bg: '#fffbeb', border: '#f59e0b', text: '#d97706' },
    outros: { bg: '#f1f5f9', border: '#64748b', text: '#475569' },
  };

  // Build categories HTML
  let categoriesHtml = '';
  if (categories) {
    const categoryOrder = ['climatizacao', 'elevadores', 'escadasRolantes', 'outros'];

    categoryOrder.forEach((key) => {
      const cat = categories[key];
      if (cat) {
        const colors = categoryColors[key] || categoryColors.outros;
        const displayValue = allShoppingsSelected ? cat.total : `${cat.filtered} / ${cat.total}`;
        const percentage = cat.total > 0 ? Math.round((cat.filtered / cat.total) * 100) : 0;
        const percentText = !allShoppingsSelected ? ` (${percentage}%)` : '';

        categoriesHtml += `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${colors.bg};border-radius:8px;margin-bottom:8px;border-left:3px solid ${colors.border};">
            <span style="font-size:16px;">${cat.icon}</span>
            <div style="flex:1;">
              <div style="font-weight:600;color:#334155;font-size:12px;">${cat.label}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${
                allShoppingsSelected ? 'Total' : `Filtrados${percentText}`
              }</div>
            </div>
            <span style="font-weight:700;color:${colors.text};font-size:14px;">${displayValue}</span>
          </div>
        `;
      }
    });
  }

  // Summary values
  const summaryDisplay = allShoppingsSelected
    ? `${totalEquipments}`
    : `${filteredEquipments} / ${totalEquipments}`;
  const percentageTotal = totalEquipments > 0 ? Math.round((filteredEquipments / totalEquipments) * 100) : 0;

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span>📊</span> Resumo Geral
      </div>
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Total de Equipamentos:</span>
        <span class="myio-info-tooltip__value myio-info-tooltip__value--highlight">${summaryDisplay}</span>
      </div>
      ${!allShoppingsSelected ? `
      <div class="myio-info-tooltip__row">
        <span class="myio-info-tooltip__label">Percentual Filtrado:</span>
        <span class="myio-info-tooltip__value">${percentageTotal}%</span>
      </div>
      ` : ''}
    </div>

    ${categoriesHtml ? `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span>📋</span> Por Categoria
      </div>
      ${categoriesHtml}
    </div>
    ` : ''}

    <div class="myio-info-tooltip__notice">
      <span class="myio-info-tooltip__notice-icon">ℹ️</span>
      <div class="myio-info-tooltip__notice-text">
        Equipamentos monitorados: <strong>Escadas Rolantes</strong>, <strong>Elevadores</strong>,
        <strong>Chillers</strong>, <strong>Bombas</strong>, <strong>Fancoils</strong>, e outros
        equipamentos de <strong>Climatização</strong>.
      </div>
    </div>
  `;
}

function showEquipmentTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showEquipmentTooltip called', { triggerElement, data });

  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot show equipment tooltip');
    return;
  }

  const content = buildEquipmentTooltipContent(data);
  InfoTooltip.show(triggerElement, {
    icon: '⚙️',
    title: 'Detalhes de Equipamentos',
    content: content
  });
}

function hideEquipmentTooltip() {
  // RFC-0105: Use InfoTooltip from library (required)
  const InfoTooltip = getInfoTooltip();
  if (!InfoTooltip) {
    console.error('[HEADER] InfoTooltip not available - cannot hide equipment tooltip');
    return;
  }
  InfoTooltip.startDelayedHide();
}

// Setup tooltip trigger events
function setupTemperatureTooltip() {
  // Try to find trigger in widget container first, then fallback to document
  const root = (self?.ctx?.$container && self.ctx.$container[0]) || document;
  const trigger = root.querySelector
    ? root.querySelector('#temp-info-trigger')
    : document.getElementById('temp-info-trigger');

  if (!trigger || trigger._tooltipBound) return;

  trigger._tooltipBound = true;
  LogHelper.log('[HEADER] Temperature tooltip trigger found and bound');

  trigger.addEventListener('mouseenter', () => {
    LogHelper.log(
      '[HEADER] Temperature tooltip mouseenter, data:',
      currentTemperatureData ? 'available' : 'not available'
    );
    if (currentTemperatureData) {
      showTemperatureTooltip(trigger, currentTemperatureData);
    }
  });

  trigger.addEventListener('mouseleave', () => {
    hideTemperatureTooltip();
  });

  // Also hide on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.temp-tooltip-container') && !e.target.closest('#temp-info-trigger')) {
      hideTemperatureTooltip();
    }
  });
}

/**
 * RFC-0100: Simplified temperature card update - receives data from MAIN orchestrator
 * @param {Object} data - Temperature data from myio:temperature-data-ready event
 */
function updateTemperatureCardFromOrchestrator(data) {
  const tempKpi = document.getElementById('temp-kpi');
  const tempTrend = document.getElementById('temp-trend');
  const tempChip = document.querySelector('#card-temp .chip');

  const { globalAvg, filteredAvg, isFiltered, shoppingsInRange = [], shoppingsOutOfRange = [] } = data || {};

  // Setup tooltip on first update
  setupTemperatureTooltip();

  // RFC-0099/RFC-0100: Update KPI with comparative display when filtered
  if (tempKpi) {
    tempKpi.style.fontSize = '0.85em';

    const showComparative =
      isFiltered && globalAvg != null && filteredAvg != null && Math.abs(filteredAvg - globalAvg) > 0.05;

    if (showComparative) {
      tempKpi.innerHTML = `${filteredAvg.toFixed(
        1
      )}°C <span style="font-size: 0.65em; color: #666;">/ ${globalAvg.toFixed(1)}°C</span>`;

      const percentageDiff = ((filteredAvg - globalAvg) / globalAvg) * 100;
      const absDiff = Math.abs(percentageDiff).toFixed(0);
      const isAbove = percentageDiff > 0;

      if (tempTrend) {
        const diffLabel = isAbove ? 'acima da média' : 'abaixo da média';
        const diffColor = isAbove ? '#f57c00' : '#0288d1';
        tempTrend.innerHTML = `<span style="color: ${diffColor};">${absDiff}% ${diffLabel}</span>`;
      }

      LogHelper.log(
        `[HEADER] RFC-0100: Temperature card updated (filtered): ${filteredAvg.toFixed(
          1
        )}°C / ${globalAvg.toFixed(1)}°C (${absDiff}% ${isAbove ? 'above' : 'below'})`
      );
    } else {
      tempKpi.innerText = globalAvg != null ? `${globalAvg.toFixed(1)}°C` : '--°C';
      if (tempTrend) tempTrend.innerText = '';
    }
  }

  // Update chip status (simplified - detailed info is now in the premium tooltip)
  if (!tempChip) return;

  const totalShoppings = shoppingsInRange.length + shoppingsOutOfRange.length;
  const chipStyle = 'font-size: 10px; display: flex; align-items: center; gap: 4px;';

  if (totalShoppings === 0) {
    tempChip.innerHTML = `<span style="${chipStyle}">-- Sem dados</span>`;
    tempChip.className = 'chip';
  } else if (shoppingsOutOfRange.length === 0) {
    tempChip.innerHTML = `<span style="${chipStyle}">✔ Todos na faixa</span>`;
    tempChip.className = 'chip ok';
  } else if (shoppingsInRange.length === 0) {
    tempChip.innerHTML = `<span style="${chipStyle}">⚠ Todos fora da faixa</span>`;
    tempChip.className = 'chip warn';
  } else {
    tempChip.innerHTML = `<span style="${chipStyle}">⚠ ${shoppingsOutOfRange.length} fora da faixa</span>`;
    tempChip.className = 'chip warn';
  }
}

self.onDataUpdated = function () {
  if (_dataRefreshCount >= MAX_DATA_REFRESHES) {
    return;
  }

  _dataRefreshCount++;

  // Equipment card will be updated via myio:equipment-count-updated event from EQUIPMENTS widget
  // No need to call updateEquipmentCard() here anymore

  // RFC-0100: Request temperature data from MAIN orchestrator instead of fetching directly
  // Temperature card will be updated via myio:temperature-data-ready event
  window.dispatchEvent(
    new CustomEvent('myio:request-temperature-data', {
      detail: {
        startTs: self.ctx?.$scope?.startDateISO
          ? new Date(self.ctx.$scope.startDateISO).getTime()
          : Date.now() - 30 * 24 * 60 * 60 * 1000,
        endTs: self.ctx.$scope?.endDateISO ? new Date(self.ctx.$scope.endDateISO).getTime() : Date.now(),
      },
    })
  );
};

self.onDestroy = function () {
  /* nada a limpar */
};
