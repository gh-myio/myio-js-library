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
  }, 200);

  // mocks (remova se alimentar via API/telemetria)
  setSummary({
    equip: { totalStr: '24/26', percent: 92 },
    energy: {}, // Removido peakText - não mostramos mais no rodapé
    temp: { kpi: '22.5°C' }, // Removido rangeText - agora está apenas no tooltip
    water: { percent: 87 }, // Removido alertText - não mostramos mais no rodapé
  });

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
  // Only use this if we haven't received a summary yet
  // The summary will have the correct total after EQUIPMENTS identifies devices
  if (ev.detail && ev.detail.cache) {
    // Show a loading indicator or partial data
    const energyKpi = document.getElementById('energy-kpi');
    if (energyKpi && energyKpi.innerText === '0,00 kWh') {
      // Only update if still showing zero (summary not received yet)
      updateEnergyCard(ev.detail.cache);
    }
  }
});

window.addEventListener('myio:water-data-ready', (ev) => {
  //LogHelper.log('[HEADER] ✅ Dados de ÁGUA recebidos do Orchestrator:', ev.detail);

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

  const {
    filteredTotal = 0,
    unfilteredTotal = 0,
    isFiltered = false,
  } = summary;

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
    LogHelper.log(`[HEADER] Water card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`);
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
window.addEventListener('myio:equipment-count-updated', (ev) => {
  //console.log('[HEADER] Received equipment count from EQUIPMENTS widget:', ev.detail);
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
  if (window.MyIOOrchestrator?.getWaterCache) {
    updateWaterCard(window.MyIOOrchestrator.getWaterCache());
  }
});

// ===== HEADER: Listen for water totals calculated from valid TB aliases =====
// Este evento é disparado quando widgets WATER_COMMON_AREA ou WATER_STORES registram seus IDs
window.addEventListener('myio:water-totals-updated', (ev) => {
  const { commonArea, stores, total } = ev.detail || {};
  LogHelper.log('[HEADER] 💧 heard myio:water-totals-updated:', { commonArea, stores, total });

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
 * Premium Temperature Tooltip - Creates and manages the tooltip
 */
function createTemperatureTooltip() {
  // Remove existing tooltip if any
  const existing = document.getElementById('temp-premium-tooltip');
  if (existing) existing.remove();

  // Inject CSS if not already present
  if (!document.getElementById('temp-tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'temp-tooltip-styles';
    style.textContent = `
      .temp-tooltip-container {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        transform: translateY(5px);
      }
      .temp-tooltip-container.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .temp-tooltip {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
        min-width: 340px;
        max-width: 420px;
        font-size: 12px;
        color: #1e293b;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .temp-tooltip__header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 18px;
        background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
        border-bottom: 1px solid #fed7aa;
      }
      .temp-tooltip__icon { font-size: 18px; }
      .temp-tooltip__title {
        font-weight: 700;
        font-size: 14px;
        color: #c2410c;
        letter-spacing: 0.3px;
      }
      .temp-tooltip__content {
        padding: 16px 18px;
        max-height: 600px;
        overflow-y: auto;
      }
      .temp-tooltip__section {
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #f1f5f9;
      }
      .temp-tooltip__section:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .temp-tooltip__section-title {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .temp-tooltip__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        gap: 12px;
      }
      .temp-tooltip__label {
        color: #64748b;
        font-size: 12px;
        flex-shrink: 0;
      }
      .temp-tooltip__value {
        color: #1e293b;
        font-weight: 600;
        text-align: right;
      }
      .temp-tooltip__value--highlight {
        color: #ea580c;
        font-weight: 700;
        font-size: 14px;
      }
      .temp-tooltip__badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .temp-tooltip__badge--ok {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }
      .temp-tooltip__badge--warn {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }
      .temp-tooltip__badge--info {
        background: #e0e7ff;
        color: #4338ca;
        border: 1px solid #c7d2fe;
      }
      .temp-tooltip__list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
      }
      .temp-tooltip__list-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #f8fafc;
        border-radius: 8px;
        font-size: 12px;
      }
      .temp-tooltip__list-item--ok { border-left: 3px solid #22c55e; background: #f0fdf4; }
      .temp-tooltip__list-item--warn { border-left: 3px solid #f59e0b; background: #fffbeb; }
      .temp-tooltip__list-icon { font-size: 14px; flex-shrink: 0; }
      .temp-tooltip__list-name { flex: 1; color: #334155; font-weight: 600; }
      .temp-tooltip__list-value { color: #475569; font-size: 12px; font-weight: 500; }
      .temp-tooltip__list-range { color: #94a3b8; font-size: 11px; }
      .temp-tooltip__notice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        margin-top: 14px;
      }
      .temp-tooltip__notice-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
      .temp-tooltip__notice-text { font-size: 11px; color: #1e40af; line-height: 1.6; }
      .temp-tooltip__notice-text strong { font-weight: 700; color: #1e3a8a; }
    `;
    document.head.appendChild(style);
    LogHelper.log('[HEADER] Tooltip CSS injected');
  }

  const container = document.createElement('div');
  container.id = 'temp-premium-tooltip';
  container.className = 'temp-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showTemperatureTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showTemperatureTooltip called', { triggerElement, data });

  let container = document.getElementById('temp-premium-tooltip');
  if (!container) {
    container = createTemperatureTooltip();
    LogHelper.log('[HEADER] Created new tooltip container');
  }

  const {
    globalAvg,
    filteredAvg,
    isFiltered,
    shoppingsInRange = [],
    shoppingsOutOfRange = [],
    devices = [],
  } = data || {};
  const totalShoppings = shoppingsInRange.length + shoppingsOutOfRange.length;

  // Build shopping list HTML
  let shoppingListHtml = '';

  if (shoppingsInRange.length > 0) {
    shoppingListHtml += `
      <div class="temp-tooltip__section">
        <div class="temp-tooltip__section-title">
          <span>✅</span> Dentro da Faixa (${shoppingsInRange.length})
        </div>
        <div class="temp-tooltip__list">
          ${shoppingsInRange
            .map((s) => {
              const rangeText = s.min != null && s.max != null ? `(faixa: ${s.min}–${s.max}°C)` : '';
              return `
            <div class="temp-tooltip__list-item temp-tooltip__list-item--ok">
              <span class="temp-tooltip__list-icon">✔</span>
              <span class="temp-tooltip__list-name">${
                s.name
              } <span class="temp-tooltip__list-range">${rangeText}</span></span>
              <span class="temp-tooltip__list-value">${s.avg?.toFixed(1)}°C</span>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  if (shoppingsOutOfRange.length > 0) {
    shoppingListHtml += `
      <div class="temp-tooltip__section">
        <div class="temp-tooltip__section-title">
          <span>⚠️</span> Fora da Faixa (${shoppingsOutOfRange.length})
        </div>
        <div class="temp-tooltip__list">
          ${shoppingsOutOfRange
            .map((s) => {
              const rangeText = s.min != null && s.max != null ? `(faixa: ${s.min}–${s.max}°C)` : '';
              return `
            <div class="temp-tooltip__list-item temp-tooltip__list-item--warn">
              <span class="temp-tooltip__list-icon">⚠</span>
              <span class="temp-tooltip__list-name">${
                s.name
              } <span class="temp-tooltip__list-range">${rangeText}</span></span>
              <span class="temp-tooltip__list-value">${s.avg?.toFixed(1)}°C</span>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // Status badge
  let statusBadge = '';
  if (totalShoppings === 0) {
    statusBadge = '<span class="temp-tooltip__badge temp-tooltip__badge--info">Aguardando dados</span>';
  } else if (shoppingsOutOfRange.length === 0) {
    statusBadge = '<span class="temp-tooltip__badge temp-tooltip__badge--ok">✔ Todos na faixa</span>';
  } else if (shoppingsInRange.length === 0) {
    statusBadge = '<span class="temp-tooltip__badge temp-tooltip__badge--warn">⚠ Todos fora da faixa</span>';
  } else {
    statusBadge = '<span class="temp-tooltip__badge temp-tooltip__badge--warn">⚠ Alguns fora da faixa</span>';
  }

  container.innerHTML = `
    <div class="temp-tooltip">
      <div class="temp-tooltip__header">
        <span class="temp-tooltip__icon">🌡️</span>
        <span class="temp-tooltip__title">Detalhes de Temperatura</span>
      </div>
      <div class="temp-tooltip__content">
        <div class="temp-tooltip__section">
          <div class="temp-tooltip__section-title">
            <span>📊</span> Resumo Geral
          </div>
          <div class="temp-tooltip__row">
            <span class="temp-tooltip__label">Média Global:</span>
            <span class="temp-tooltip__value temp-tooltip__value--highlight">${
              globalAvg != null ? globalAvg.toFixed(1) + '°C' : '--'
            }</span>
          </div>
          ${
            isFiltered && filteredAvg != null
              ? `
          <div class="temp-tooltip__row">
            <span class="temp-tooltip__label">Média Filtrada:</span>
            <span class="temp-tooltip__value">${filteredAvg.toFixed(1)}°C</span>
          </div>
          `
              : ''
          }
          <div class="temp-tooltip__row">
            <span class="temp-tooltip__label">Sensores Ativos:</span>
            <span class="temp-tooltip__value">${devices.length || 0}</span>
          </div>
          <div class="temp-tooltip__row">
            <span class="temp-tooltip__label">Status:</span>
            ${statusBadge}
          </div>
        </div>

        ${shoppingListHtml}

        <div class="temp-tooltip__notice">
          <span class="temp-tooltip__notice-icon">ℹ️</span>
          <span class="temp-tooltip__notice-text">
            São considerados apenas os <strong>sensores em ambientes climatizáveis</strong> que estejam <strong>ativos</strong>.
            Sensores inativos ou em áreas não climatizadas são excluídos do cálculo.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - 160; // Center tooltip (320px / 2)
  let top = rect.bottom + 8;

  // Adjust if tooltip goes off screen
  if (left < 10) left = 10;
  if (left + 320 > window.innerWidth - 10) left = window.innerWidth - 330;
  if (top + 600 > window.innerHeight) {
    top = rect.top - 8 - 600; // Show above
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideTemperatureTooltip() {
  const container = document.getElementById('temp-premium-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
}

// ===== ENERGY TOOLTIP FUNCTIONS =====

/**
 * Premium Energy Tooltip - Creates and manages the tooltip
 */
function createEnergyTooltip() {
  const existing = document.getElementById('energy-premium-tooltip');
  if (existing) existing.remove();

  // Inject CSS if not already present
  if (!document.getElementById('energy-tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'energy-tooltip-styles';
    style.textContent = `
      .energy-info-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: help;
        opacity: 0.5;
        transition: opacity 0.2s ease;
        position: relative;
        margin-left: 4px;
        vertical-align: middle;
      }
      .energy-info-trigger:hover { opacity: 1; }
      .energy-tooltip-container {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        transform: translateY(5px);
      }
      .energy-tooltip-container.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .energy-tooltip {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
        min-width: 340px;
        max-width: 420px;
        font-size: 12px;
        color: #1e293b;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .energy-tooltip__header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 18px;
        background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%);
        border-bottom: 1px solid #a7f3d0;
      }
      .energy-tooltip__icon { font-size: 18px; }
      .energy-tooltip__title {
        font-weight: 700;
        font-size: 14px;
        color: #047857;
        letter-spacing: 0.3px;
      }
      .energy-tooltip__content {
        padding: 16px 18px;
        max-height: 600px;
        overflow-y: auto;
      }
      .energy-tooltip__section {
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #f1f5f9;
      }
      .energy-tooltip__section:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .energy-tooltip__section-title {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .energy-tooltip__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        gap: 12px;
      }
      .energy-tooltip__label {
        color: #64748b;
        font-size: 12px;
        flex-shrink: 0;
      }
      .energy-tooltip__value {
        color: #1e293b;
        font-weight: 600;
        text-align: right;
      }
      .energy-tooltip__value--highlight {
        color: #059669;
        font-weight: 700;
        font-size: 14px;
      }
      .energy-tooltip__value--secondary {
        color: #64748b;
        font-size: 11px;
      }
      .energy-tooltip__table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 11px;
      }
      .energy-tooltip__table th {
        text-align: left;
        padding: 8px 10px;
        background: #f1f5f9;
        color: #64748b;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #e2e8f0;
      }
      .energy-tooltip__table th:not(:first-child) {
        text-align: right;
      }
      .energy-tooltip__table td {
        padding: 8px 10px;
        border-bottom: 1px solid #f1f5f9;
        color: #475569;
      }
      .energy-tooltip__table td:first-child {
        font-weight: 500;
        color: #334155;
      }
      .energy-tooltip__table td:not(:first-child) {
        text-align: right;
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 10px;
        color: #64748b;
      }
      .energy-tooltip__table tr:last-child td {
        border-bottom: none;
      }
      .energy-tooltip__table tr:hover td {
        background: #f8fafc;
      }
      .energy-tooltip__notice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        border-radius: 8px;
        margin-top: 14px;
      }
      .energy-tooltip__notice-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
      .energy-tooltip__notice-text { font-size: 11px; color: #047857; line-height: 1.6; }
      .energy-tooltip__notice-text strong { font-weight: 700; color: #065f46; }
    `;
    document.head.appendChild(style);
    LogHelper.log('[HEADER] Energy tooltip CSS injected');
  }

  const container = document.createElement('div');
  container.id = 'energy-premium-tooltip';
  container.className = 'energy-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showEnergyTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showEnergyTooltip called', { triggerElement, data });

  let container = document.getElementById('energy-premium-tooltip');
  if (!container) {
    container = createEnergyTooltip();
    LogHelper.log('[HEADER] Created new energy tooltip container');
  }

  const {
    customerTotal = 0,
    unfilteredTotal = 0,
    equipmentsTotal = 0,
    lojasTotal = 0,
    deviceCount = 0,
    isFiltered = false,
    shoppingsEnergy = [],
  } = data || {};

  // Format energy value
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
    shoppingTableHtml = `
      <div class="energy-tooltip__section">
        <div class="energy-tooltip__section-title">
          <span>🏢</span> Consumo por Shopping
        </div>
        <table class="energy-tooltip__table">
          <thead>
            <tr>
              <th>Shopping</th>
              <th>Equipamentos</th>
              <th>Lojas</th>
            </tr>
          </thead>
          <tbody>
            ${shoppingsEnergy
              .sort((a, b) => ((b.equipamentos || 0) + (b.lojas || 0)) - ((a.equipamentos || 0) + (a.lojas || 0)))
              .map((s) => `
                <tr>
                  <td>${s.name}</td>
                  <td>${formatEnergy(s.equipamentos)}</td>
                  <td>${formatEnergy(s.lojas)}</td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="energy-tooltip">
      <div class="energy-tooltip__header">
        <span class="energy-tooltip__icon">⚡</span>
        <span class="energy-tooltip__title">Detalhes de Consumo de Energia</span>
      </div>
      <div class="energy-tooltip__content">
        <div class="energy-tooltip__section">
          <div class="energy-tooltip__section-title">
            <span>📊</span> Resumo Geral
          </div>
          <div class="energy-tooltip__row">
            <span class="energy-tooltip__label">Consumo Total:</span>
            <span class="energy-tooltip__value energy-tooltip__value--highlight">${formatEnergy(customerTotal)}</span>
          </div>
          <div class="energy-tooltip__row">
            <span class="energy-tooltip__label">Equipamentos:</span>
            <span class="energy-tooltip__value">${formatEnergy(equipmentsTotal)}</span>
          </div>
          <div class="energy-tooltip__row">
            <span class="energy-tooltip__label">Lojas:</span>
            <span class="energy-tooltip__value">${formatEnergy(lojasTotal)}</span>
          </div>
          <div class="energy-tooltip__row">
            <span class="energy-tooltip__label">Dispositivos:</span>
            <span class="energy-tooltip__value">${deviceCount || 0}</span>
          </div>
        </div>

        ${shoppingTableHtml}

        <div class="energy-tooltip__notice">
          <span class="energy-tooltip__notice-icon">ℹ️</span>
          <span class="energy-tooltip__notice-text">
            O consumo total inclui <strong>equipamentos de área comum</strong> e <strong>medidores de lojas</strong>.
            Valores em tempo real podem variar conforme a disponibilidade dos dados.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - 170;
  let top = rect.bottom + 8;

  if (left < 10) left = 10;
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (top + 600 > window.innerHeight) {
    top = rect.top - 8 - 600;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideEnergyTooltip() {
  const container = document.getElementById('energy-premium-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
}

// ============================================
// WATER TOOLTIP FUNCTIONS
// ============================================

function createWaterTooltip() {
  const existing = document.getElementById('water-premium-tooltip');
  if (existing) existing.remove();

  // Inject CSS if not already present
  if (!document.getElementById('water-tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'water-tooltip-styles';
    style.textContent = `
      .water-info-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: help;
        opacity: 0.5;
        transition: opacity 0.2s ease;
        position: relative;
        margin-left: 4px;
        vertical-align: middle;
      }
      .water-info-trigger:hover { opacity: 1; }
      .water-tooltip-container {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        transform: translateY(5px);
      }
      .water-tooltip-container.visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .water-tooltip {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
        min-width: 340px;
        max-width: 420px;
        font-size: 12px;
        color: #1e293b;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .water-tooltip__header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 18px;
        background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
        border-bottom: 1px solid #93c5fd;
      }
      .water-tooltip__icon { font-size: 18px; }
      .water-tooltip__title {
        font-weight: 700;
        font-size: 14px;
        color: #1d4ed8;
        letter-spacing: 0.3px;
      }
      .water-tooltip__content {
        padding: 16px 18px;
        max-height: 600px;
        overflow-y: auto;
      }
      .water-tooltip__section {
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #f1f5f9;
      }
      .water-tooltip__section:last-child {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
      }
      .water-tooltip__section-title {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .water-tooltip__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        gap: 12px;
      }
      .water-tooltip__label {
        color: #64748b;
        font-size: 12px;
        flex-shrink: 0;
      }
      .water-tooltip__value {
        color: #1e293b;
        font-weight: 600;
        text-align: right;
      }
      .water-tooltip__value--highlight {
        color: #2563eb;
        font-weight: 700;
        font-size: 14px;
      }
      .water-tooltip__value--secondary {
        color: #64748b;
        font-size: 11px;
      }
      .water-tooltip__table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 11px;
      }
      .water-tooltip__table th {
        text-align: left;
        padding: 8px 10px;
        background: #f1f5f9;
        color: #64748b;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #e2e8f0;
      }
      .water-tooltip__table th:not(:first-child) {
        text-align: right;
      }
      .water-tooltip__table td {
        padding: 8px 10px;
        border-bottom: 1px solid #f1f5f9;
        color: #475569;
      }
      .water-tooltip__table td:first-child {
        font-weight: 500;
        color: #334155;
      }
      .water-tooltip__table td:not(:first-child) {
        text-align: right;
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 10px;
        color: #64748b;
      }
      .water-tooltip__table tr:last-child td {
        border-bottom: none;
      }
      .water-tooltip__table tr:hover td {
        background: #f8fafc;
      }
      .water-tooltip__notice {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        background: #eff6ff;
        border: 1px solid #93c5fd;
        border-radius: 8px;
        margin-top: 14px;
      }
      .water-tooltip__notice-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
      .water-tooltip__notice-text { font-size: 11px; color: #1d4ed8; line-height: 1.6; }
      .water-tooltip__notice-text strong { font-weight: 700; color: #1e40af; }
    `;
    document.head.appendChild(style);
    LogHelper.log('[HEADER] Water tooltip CSS injected');
  }

  const container = document.createElement('div');
  container.id = 'water-premium-tooltip';
  container.className = 'water-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showWaterTooltip(triggerElement, data) {
  LogHelper.log('[HEADER] showWaterTooltip called', { triggerElement, data });

  let container = document.getElementById('water-premium-tooltip');
  if (!container) {
    container = createWaterTooltip();
    LogHelper.log('[HEADER] Created new water tooltip container');
  }

  const {
    filteredTotal = 0,
    unfilteredTotal = 0,
    commonArea = 0,
    stores = 0,
    deviceCount = 0,
    isFiltered = false,
    shoppingsWater = [],
  } = data || {};

  // Format water value
  const formatWater = (val) => {
    if (val == null || isNaN(val)) return '--';
    if (typeof MyIOLibrary?.formatWaterVolumeM3 === 'function') {
      return MyIOLibrary.formatWaterVolumeM3(val);
    }
    return `${val.toFixed(2)} m³`;
  };

  // Build shopping table HTML if available
  let shoppingTableHtml = '';
  if (shoppingsWater && shoppingsWater.length > 0) {
    shoppingTableHtml = `
      <div class="water-tooltip__section">
        <div class="water-tooltip__section-title">
          <span>🏢</span> Consumo por Shopping
        </div>
        <table class="water-tooltip__table">
          <thead>
            <tr>
              <th>Shopping</th>
              <th>Área Comum</th>
              <th>Lojas</th>
            </tr>
          </thead>
          <tbody>
            ${shoppingsWater
              .sort((a, b) => ((b.areaComum || 0) + (b.lojas || 0)) - ((a.areaComum || 0) + (a.lojas || 0)))
              .map((s) => `
                <tr>
                  <td>${s.name}</td>
                  <td>${formatWater(s.areaComum)}</td>
                  <td>${formatWater(s.lojas)}</td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="water-tooltip">
      <div class="water-tooltip__header">
        <span class="water-tooltip__icon">💧</span>
        <span class="water-tooltip__title">Detalhes de Consumo de Água</span>
      </div>
      <div class="water-tooltip__content">
        <div class="water-tooltip__section">
          <div class="water-tooltip__section-title">
            <span>📊</span> Resumo Geral
          </div>
          <div class="water-tooltip__row">
            <span class="water-tooltip__label">Consumo Total:</span>
            <span class="water-tooltip__value water-tooltip__value--highlight">${formatWater(filteredTotal)}</span>
          </div>
          <div class="water-tooltip__row">
            <span class="water-tooltip__label">Área Comum:</span>
            <span class="water-tooltip__value">${formatWater(commonArea)}</span>
          </div>
          <div class="water-tooltip__row">
            <span class="water-tooltip__label">Lojas:</span>
            <span class="water-tooltip__value">${formatWater(stores)}</span>
          </div>
          <div class="water-tooltip__row">
            <span class="water-tooltip__label">Dispositivos:</span>
            <span class="water-tooltip__value">${deviceCount || 0}</span>
          </div>
        </div>

        ${shoppingTableHtml}

        <div class="water-tooltip__notice">
          <span class="water-tooltip__notice-icon">ℹ️</span>
          <span class="water-tooltip__notice-text">
            O consumo total considera <strong>hidrômetros de área comum</strong> e <strong>hidrômetros de lojas</strong>.
            Valores em tempo real podem variar conforme a disponibilidade dos dados.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - 170;
  let top = rect.bottom + 8;

  if (left < 10) left = 10;
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (top + 600 > window.innerHeight) {
    top = rect.top - 8 - 600;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideWaterTooltip() {
  const container = document.getElementById('water-premium-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
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
