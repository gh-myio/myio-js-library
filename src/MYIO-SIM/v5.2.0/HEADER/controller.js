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
        } catch {}
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
      const name = prompt('Nome do preset:');
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
      } catch {}
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

      await updateTemperatureCard();

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

  // Aplicar cores personalizadas dos cards (após o DOM estar pronto)
  setTimeout(() => {
    applyCardColors();
  }, 100);

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

  // Formata datas para timezone -03:00
  const startDateISO = timeStart.replace('Z', '-03:00');
  const endDateISO = timeEnd.replace('Z', '-03:00');

  // Dispara evento inicial com as datas
  window.dispatchEvent(
    new CustomEvent('myio:update-date', {
      detail: {
        startDate: startDateISO,
        endDate: endDateISO,
      },
    })
  );

  const custumer = [];

  // não apagar!!
  self.ctx.data.forEach((data) => {
    if (data.datasource.aliasName === 'Shopping') {
      // adiciona no array custumes
      custumer.push({
        name: data.datasource.entityLabel, // ou outro campo que seja o "nome"
        value: data.data[0][1], // ou o dado que você precisa salvar
      });
    }

    // RFC: Request MAIN to update total consumption via CustomEvent
    window.dispatchEvent(
      new CustomEvent('myio:request-total-consumption', {
        detail: {
          customersArray: custumer,
          startDateISO: startDateISO,
          endDateISO: endDateISO,
        },
      })
    );
    // RFC: Request MAIN to update water consumption via CustomEvent
    window.dispatchEvent(
      new CustomEvent('myio:request-total-water-consumption', {
        detail: {
          customersArray: custumer,
          startDateISO: startDateISO,
          endDateISO: endDateISO,
        },
      })
    );
  });

  self.ctx.$scope.custumer = custumer;
  // console.log("custumer",custumer)
};

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

function extractDevicesWithDetails(ctxData) {
  // Usamos um Map para armazenar os dispositivos, usando o ID como chave para garantir a unicidade
  // e facilitar a atualização dos campos (como o ownerName) em iterações subsequentes.
  const deviceMap = new Map();

  if (!Array.isArray(ctxData)) {
    console.warn('[ENERGY] ctxData is not an array');
    return [];
  }

  ctxData.forEach((data) => {
    // Ignorar entradas que não são do alias desejado
    if (data.datasource?.aliasName !== 'AllTemperatureDevices') {
      return;
    }

    const entityId =
      data.datasource?.entityId?.id || data.datasource?.entity?.id?.id || data.datasource?.entityId;

    if (!entityId) {
      return;
    }

    // 1. Extrair o ID do dispositivo e garantir que o objeto está no mapa
    let deviceObject = deviceMap.get(entityId) || { id: entityId, ownerName: null };

    // 2. Tentar extrair o ownerName
    const isOwnerNameData = data.dataKey?.name === 'ownerName';

    if (isOwnerNameData && Array.isArray(data.data) && data.data.length > 0) {
      // O ownerName está na segunda posição (índice 1) do array de dados (ex: [timestamp, 'Shopping da Ilha', array])
      const ownerName = data.data[0] && data.data[0][1];
      if (ownerName) {
        deviceObject.ownerName = ownerName;
      }
    }

    // 3. Atualizar/Adicionar o objeto no mapa
    deviceMap.set(entityId, deviceObject);
  });

  LogHelper.log(`[HEADER] Extracted ${deviceMap.size} unique device entries`);
  // Retornar um array com os valores do Map (os objetos de dispositivo)
  return Array.from(deviceMap.values());
}

/**
 * Calcula a média dos valores de temperatura em um array de objetos.
 * Cada objeto deve ter uma propriedade 'value' contendo o valor numérico.
 *
 * @param {Array<Object>} dataArray O array de objetos de dados (ex: Array(104) na imagem).
 * @returns {number} A média calculada dos valores.
 */
function calcularMedia(dataArray) {
  if (!dataArray || dataArray.length === 0) {
    return 0; // Retorna 0 se o array for nulo ou vazio
  }

  // 1. Usar reduce() para somar todos os valores.
  // O valor precisa ser convertido para número, pois aparece como string na imagem.
  const somaDosValores = dataArray.reduce((acumulador, elementoAtual) => {
    // Usa parseFloat para garantir a precisão de ponto flutuante
    const valorNumerico = parseFloat(elementoAtual.value);
    // Verifica se é um número válido antes de somar
    if (!isNaN(valorNumerico)) {
      return acumulador + valorNumerico;
    }
    return acumulador; // Ignora valores não numéricos
  }, 0); // O valor inicial do acumulador é 0

  // 2. Dividir a soma pelo número de elementos para obter a média.
  const media = somaDosValores / dataArray.length;

  return media;
}

// ===== HEADER: Temperature Card Handler =====
/**
 * Extrai faixas de temperatura (min/max) por shopping do ctx.data
 * @returns {Map<string, {min: number, max: number, entityLabel: string}>}
 */
function extractTemperatureRangesByShopping() {
  const rangesMap = new Map();

  self.ctx.data.forEach((data) => {
    const entityLabel = data.datasource?.entityLabel || 'Unknown';
    const entityId = data.datasource?.entityId || entityLabel;

    if (!rangesMap.has(entityId)) {
      rangesMap.set(entityId, { min: null, max: null, entityLabel });
    }

    const entry = rangesMap.get(entityId);

    if (data.dataKey?.name === 'maxTemperature' && data.data?.[0]?.[1] != null) {
      entry.max = Number(data.data[0][1]);
    }
    if (data.dataKey?.name === 'minTemperature' && data.data?.[0]?.[1] != null) {
      entry.min = Number(data.data[0][1]);
    }
  });

  // Filtra apenas shoppings com faixas válidas
  const validRanges = new Map();
  rangesMap.forEach((value, key) => {
    if (value.min != null && value.max != null) {
      validRanges.set(key, value);
    }
  });

  LogHelper.log('[HEADER] Temperature ranges by shopping:', Object.fromEntries(validRanges));
  return validRanges;
}

/**
 * Calcula média de temperatura por shopping
 * @param {number} startTs
 * @param {number} endTs
 * @returns {Promise<Map<string, {avg: number, ownerName: string}>>}
 */
async function fetchTemperatureAveragesByShopping(startTs, endTs) {
  const tbToken = localStorage.getItem('jwt_token');
  if (!tbToken) {
    LogHelper.warn('[HEADER] JWT not found');
    return new Map();
  }

  const devices = extractDevicesWithDetails(self.ctx.data);
  const shoppingTemps = new Map(); // ownerName -> { temps: [], ownerName }

  for (const device of devices) {
    try {
      const url =
        `/api/plugins/telemetry/DEVICE/${device.id}/values/timeseries` +
        `?keys=temperature` +
        `&startTs=${encodeURIComponent(startTs)}` +
        `&endTs=${encodeURIComponent(endTs)}` +
        `&limit=50000` +
        `&intervalType=MILLISECONDS` +
        `&interval=7200000` +
        `&agg=AVG`;

      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${tbToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const temperatureData = data.temperature || [];
      const avgTemp = calcularMedia(temperatureData);

      if (avgTemp != null && !isNaN(avgTemp)) {
        const ownerName = device.ownerName || 'Unknown';
        if (!shoppingTemps.has(ownerName)) {
          shoppingTemps.set(ownerName, { temps: [], ownerName });
        }
        shoppingTemps.get(ownerName).temps.push(avgTemp);
      }
    } catch (err) {
      LogHelper.error(`[HEADER] Error fetching temperature for device ${device.id}:`, err);
    }
  }

  // Calcula média por shopping
  const result = new Map();
  shoppingTemps.forEach((value, key) => {
    const sum = value.temps.reduce((a, b) => a + b, 0);
    const avg = value.temps.length > 0 ? sum / value.temps.length : null;
    result.set(key, { avg, ownerName: value.ownerName });
  });

  LogHelper.log('[HEADER] Temperature averages by shopping:', Object.fromEntries(result));
  return result;
}

async function updateTemperatureCard() {
  const tempKpi = document.getElementById('temp-kpi');
  const tempChip = document.querySelector('#card-temp .chip');

  const startTs = self.ctx?.$scope?.startDateISO
    ? new Date(self.ctx.$scope.startDateISO).getTime()
    : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const endTs = self.ctx.$scope?.endDateISO ? new Date(self.ctx.$scope.endDateISO).getTime() : Date.now();

  // 1. Extrair faixas de temperatura por shopping
  const rangesByShopping = extractTemperatureRangesByShopping();

  // 2. Calcular médias de temperatura por shopping
  const avgsByShopping = await fetchTemperatureAveragesByShopping(startTs, endTs);

  // 3. Comparar cada shopping com sua própria faixa
  const shoppingsInRange = [];
  const shoppingsOutOfRange = [];
  let totalSum = 0;
  let totalCount = 0;

  avgsByShopping.forEach((avgData, ownerName) => {
    if (avgData.avg == null) return;

    totalSum += avgData.avg;
    totalCount++;

    // Normaliza para matching (lowercase, sem acentos)
    const normalize = (str) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const normalizedOwnerName = normalize(ownerName);

    // Encontra a faixa correspondente a este shopping
    let matchedRange = null;
    rangesByShopping.forEach((range) => {
      const normalizedLabel = normalize(range.entityLabel);
      // Match exato ou parcial (normalizado)
      if (
        normalizedLabel === normalizedOwnerName ||
        normalizedLabel.includes(normalizedOwnerName) ||
        normalizedOwnerName.includes(normalizedLabel)
      ) {
        matchedRange = range;
      }
    });

    // Se não encontrou por nome, usa a faixa default (primeira disponível)
    if (!matchedRange && rangesByShopping.size > 0) {
      matchedRange = rangesByShopping.values().next().value;
      LogHelper.log(`[HEADER] Using default range for ${ownerName}:`, matchedRange);
    }

    const shoppingInfo = {
      name: ownerName,
      avg: avgData.avg,
      min: matchedRange?.min,
      max: matchedRange?.max,
    };

    if (matchedRange && avgData.avg >= matchedRange.min && avgData.avg <= matchedRange.max) {
      shoppingsInRange.push(shoppingInfo);
    } else {
      shoppingsOutOfRange.push(shoppingInfo);
    }
  });

  const totalAvg = totalCount > 0 ? totalSum / totalCount : null;

  LogHelper.log('[HEADER] Temperature analysis:', {
    totalAvg,
    shoppingsInRange: shoppingsInRange.length,
    shoppingsOutOfRange: shoppingsOutOfRange.length,
  });

  // 4. Atualizar KPI (média geral)
  if (totalAvg != null) {
    tempKpi.innerText = `${totalAvg.toFixed(1)}°C`;
  } else {
    tempKpi.innerText = '--°C';
  }

  // 5. Atualizar chip de status baseado na análise por shopping
  if (!tempChip) return;

  const totalShoppings = shoppingsInRange.length + shoppingsOutOfRange.length;

  // Estilo inline para reduzir tamanho da fonte
  const chipStyle = 'font-size: 10px; display: flex; align-items: center; gap: 4px;';

  if (totalShoppings === 0) {
    // Sem dados
    tempChip.innerHTML = `<span style="${chipStyle}">-- Sem dados
      <span class="info-icon" id="temp-info-icon" title="Aguardando dados de temperatura">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span></span>`;
    tempChip.className = 'chip';
  } else if (shoppingsOutOfRange.length === 0) {
    // Todos dentro da faixa
    const tooltipDetails = shoppingsInRange
      .map((s) => `✔ ${s.name}: ${s.avg?.toFixed(1)}°C (${s.min}–${s.max}°C)`)
      .join('\n');
    tempChip.innerHTML = `<span style="${chipStyle}">✔ Todos na faixa
      <span class="info-icon" id="temp-info-icon" title="${tooltipDetails}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span></span>`;
    tempChip.className = 'chip ok';
  } else if (shoppingsInRange.length === 0) {
    // Todos fora da faixa
    const tooltipDetails = shoppingsOutOfRange
      .map((s) => `⚠ ${s.name}: ${s.avg?.toFixed(1)}°C (faixa: ${s.min}–${s.max}°C)`)
      .join('\n');
    tempChip.innerHTML = `<span style="${chipStyle}">⚠ Todos fora da faixa
      <span class="info-icon" id="temp-info-icon" title="${tooltipDetails}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span></span>`;
    tempChip.className = 'chip warn';
  } else {
    // Alguns dentro, outros fora
    const inRangeDetails = shoppingsInRange.map((s) => `✔ ${s.name}: ${s.avg?.toFixed(1)}°C`).join('\n');
    const outOfRangeDetails = shoppingsOutOfRange
      .map((s) => `⚠ ${s.name}: ${s.avg?.toFixed(1)}°C (faixa: ${s.min}–${s.max}°C)`)
      .join('\n');
    const tooltipDetails = `DENTRO DA FAIXA:\n${inRangeDetails}\n\nFORA DA FAIXA:\n${outOfRangeDetails}`;

    tempChip.innerHTML = `<span style="${chipStyle}">⚠ Alguns fora da faixa
      <span class="info-icon" id="temp-info-icon" title="${tooltipDetails}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span></span>`;
    tempChip.className = 'chip warn';
  }
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

    // Reduce font size for the KPI
    energyKpi.style.fontSize = '0.9em';

    // Show "filtered / total" only when filter is active AND values are different
    const showComparative =
      isFiltered && unfilteredConsumption > 0 && Math.abs(filteredConsumption - unfilteredConsumption) > 0.01;

    if (showComparative) {
      const formattedFiltered = formatEnergy(filteredConsumption);
      const formattedTotal = formatEnergy(unfilteredConsumption);
      const percentage = Math.round((filteredConsumption / unfilteredConsumption) * 100);

      energyKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.7em; color: #666;">/ ${formattedTotal}</span>`;

      // Show percentage in trend element
      if (energyTrend) {
        energyTrend.innerText = `${percentage}%`;
        energyTrend.className = 'chip trend';
        energyTrend.style.display = '';
      }
      LogHelper.log(
        `[HEADER] Energy card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
      );
    } else {
      // Show only total when no filter or values are the same
      const formatted = formatEnergy(filteredConsumption);
      energyKpi.innerText = formatted;

      // Hide percentage when not filtered
      if (energyTrend) {
        energyTrend.innerText = '';
        energyTrend.style.display = 'none';
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

  // ✅ Get filtered and unfiltered water consumption from orchestrator
  let filteredConsumption = 0;
  let unfilteredConsumption = 0;
  let isFiltered = false;
  let deviceCount = 0;

  if (typeof window.MyIOOrchestrator?.getTotalWaterConsumption === 'function') {
    filteredConsumption = window.MyIOOrchestrator.getTotalWaterConsumption();
    unfilteredConsumption =
      window.MyIOOrchestrator.getUnfilteredTotalWaterConsumption?.() || filteredConsumption;
    isFiltered = window.MyIOOrchestrator.isFilterActive?.() || false;
    LogHelper.log('[HEADER] Water consumption:', { filteredConsumption, unfilteredConsumption, isFiltered });
  } else {
    LogHelper.warn('[HEADER] MyIOOrchestrator.getTotalWaterConsumption not available');
    // Fallback: sum all from cache (old behavior)
    if (waterCache) {
      waterCache.forEach((cached) => {
        if (cached && cached.total_value) {
          filteredConsumption += cached.total_value || 0;
          deviceCount++;
        }
      });
      unfilteredConsumption = filteredConsumption;
    }
  }

  // ✅ Format and display
  if (waterKpi) {
    const formatWater = (val) =>
      typeof MyIOLibrary?.formatWaterVolumeM3 === 'function'
        ? MyIOLibrary.formatWaterVolumeM3(val)
        : `${val.toFixed(2)} m³`;

    // Reduce font size for the KPI
    waterKpi.style.fontSize = '0.9em';

    // Show "filtered / total" only when filter is active AND values are different
    const showComparative =
      isFiltered && unfilteredConsumption > 0 && Math.abs(filteredConsumption - unfilteredConsumption) > 0.01;

    if (showComparative) {
      const formattedFiltered = formatWater(filteredConsumption);
      const formattedTotal = formatWater(unfilteredConsumption);
      const percentage = Math.round((filteredConsumption / unfilteredConsumption) * 100);

      waterKpi.innerHTML = `${formattedFiltered} <span style="font-size: 0.7em; color: #666;">/ ${formattedTotal}</span>`;

      // Show percentage in trend element
      if (waterTrend) {
        waterTrend.innerText = `${percentage}%`;
        waterTrend.className = 'chip trend';
        waterTrend.style.display = '';
      }
      LogHelper.log(
        `[HEADER] Water card updated (filtered): ${formattedFiltered} / ${formattedTotal} (${percentage}%)`
      );
    } else {
      // Show only total when no filter or values are the same
      const formatted = formatWater(filteredConsumption);
      waterKpi.innerText = formatted;

      // Hide percentage when not filtered
      if (waterTrend) {
        waterTrend.innerText = '';
        waterTrend.style.display = 'none';
      }
      LogHelper.log(`[HEADER] Water card updated: ${formatted}`);
    }
  } else {
    LogHelper.error('[HEADER] waterKpi element not found!');
  }

  // ✅ EMIT EVENT
  const customerTotalEvent = {
    customerTotal: filteredConsumption,
    unfilteredTotal: unfilteredConsumption,
    isFiltered,
    deviceCount,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent('myio:customer-total-water-consumption', {
      detail: customerTotalEvent,
    })
  );

  LogHelper.log(`[HEADER] ✅ Emitted myio:customer-total-water-consumption:`, customerTotalEvent);
}

// ===== HEADER: Listen for energy data from MAIN orchestrator =====
window.addEventListener('myio:energy-data-ready', (ev) => {
  LogHelper.log('[HEADER] Received energy data from orchestrator:', ev.detail);
  updateEnergyCard(ev.detail.cache);
});

window.addEventListener('myio:water-data-ready', (ev) => {
  LogHelper.log('[HEADER] ✅ Dados de ÁGUA recebidos do Orchestrator:', ev.detail);

  // Se 'ev.detail.cache' existir, atualiza o card
  if (ev.detail && ev.detail.cache) {
    updateWaterCard(ev.detail.cache);
  }
});

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
  // This ensures the orchestrator has already processed the filter

  updateTemperatureCard();
});

// ===== HEADER: Listen for orchestrator filter update (after MAIN processes the filter) =====
window.addEventListener('myio:orchestrator-filter-updated', (ev) => {
  LogHelper.log('[HEADER] 🔄 heard myio:orchestrator-filter-updated:', ev.detail);

  // Now orchestrator has the updated filter, safe to update cards
  if (window.MyIOOrchestrator?.getEnergyCache) {
    updateEnergyCard(window.MyIOOrchestrator.getEnergyCache());
  }
  if (window.MyIOOrchestrator?.getWaterCache) {
    updateWaterCard(window.MyIOOrchestrator.getWaterCache());
  }
});

self.onDataUpdated = function () {
  if (_dataRefreshCount >= MAX_DATA_REFRESHES) {
    return;
  }

  _dataRefreshCount++;

  // Equipment card will be updated via myio:equipment-count-updated event from EQUIPMENTS widget
  // No need to call updateEquipmentCard() here anymore

  // Update Temperature card
  updateTemperatureCard();
};

self.onDestroy = function () {
  /* nada a limpar */
};
