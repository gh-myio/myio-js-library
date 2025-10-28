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

const MyIOAuth = (() => {
  // ==== CONFIG ====
  const AUTH_URL = new URL(`${DATA_API_HOST}/api/v1/auth`);

  // ⚠️ Substitua pelos seus valores:

  // Margem para renovar o token antes de expirar (em segundos)
  const RENEW_SKEW_S = 60; // 1 min
  // Em caso de erro, re-tenta com backoff simples
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

  // Cache em memória (por aba). Se quiser compartilhar entre widgets/abas,
  // você pode trocar por localStorage (com os devidos cuidados de segurança).
  let _token = null; // string
  let _expiresAt = 0; // epoch em ms
  let _inFlight = null; // Promise em andamento para evitar corridas

  function _now() {
    return Date.now();
  }

  function _aboutToExpire() {
    // true se não temos token ou se falta pouco para expirar
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
        // Espera formato:
        // { access_token, token_type, expires_in, scope }
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error("Resposta de auth não contem campos esperados.");
        }

        _token = json.access_token;
        // Define expiração absoluta (agora + expires_in)
        _expiresAt = _now() + Number(json.expires_in) * 1000;

        // Logs úteis para depuração (não imprimem o token)
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
    // Evita múltiplas chamadas paralelas de renovação
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

  // Helpers opcionais
  function getExpiryInfo() {
    return {
      expiresAt: _expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((_expiresAt - _now()) / 1000)),
    };
  }

  function clearCache() {
    _token = null;
    _expiresAt = 0;
    _inFlight = null;
  }

  return { getToken, getExpiryInfo, clearCache };
})();

async function updateTotalConsumption(customersArray, startDateISO, endDateISO) {
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
    // Pula se value estiver vazio
    if (!c.value) continue;

    try {
      const TOKEN_INJESTION = await MyIOAuth.getToken();

      const response = await fetch(
        `${DATA_API_HOST}/api/v1/telemetry/customers/${c.value}/energy/total?startTime=${encodeURIComponent(startDateISO)}&endTime=${encodeURIComponent(endDateISO)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${TOKEN_INJESTION}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log('response ==============================>', response);

      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      const data = await response.json();
      console.log('data ==============================>', data);      

      totalConsumption += data.total_value;
     //console.log("deu bom aiiii", totalConsumption)
    } catch (err) {
      console.error(`Falha ao buscar dados do customer ${c.value}:`, err);
    }
  }

  // Atualiza o HTML diretamente

  const percentDiference = document.getElementById("energy-trend");

  energyTotal.innerText = `${MyIOLibrary.formatEnergy(totalConsumption)}`;
  percentDiference.innerText = `↑ 100%`; // Se quiser, pode calcular dif percentual de outro jeito
  percentDiference.style.color = "red";  // Exemplo de cor
}

function publishSwitch(targetStateId) {
  const detail = { targetStateId, source: "menu_v_1_0_0", ts: Date.now() };
  window.dispatchEvent(new CustomEvent(EVT_SWITCH, { detail }));
 // console.log("[menu] switch ->", detail);
}

function setActiveTab(btn, root) {
  root
    .querySelectorAll(".tab.is-active")
    .forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
}

function bindTabs(root) {
  if (root._tabsBound) return;

  root._tabsBound = true;

  root.addEventListener("click", (ev) => {
    const tab = ev.target.closest?.(".tab");

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
}

/* ====== mock ====== */
const FILTER_DATA = [
  { id: "A", name: "Shopping A", floors: 2 },
  { id: "B", name: "Shopping B", floors: 1 },
  { id: "C", name: "Shopping C", floors: 1 },
];

function injectModalGlobal() {
  // ==== Config & helpers ====================================================
  const PRESET_KEY = "myio_dashboard_filter_presets_v1";
  // Estado global (compartilhado entre aberturas)
  if (!window.myioFilterSel) {
    window.myioFilterSel = { malls: [], floors: [], places: [] };
  }
  if (!window.myioFilterQuery) {
    window.myioFilterQuery = "";
  }
  if (!window.myioFilterPresets) {
    try {
      window.myioFilterPresets = JSON.parse(localStorage.getItem(PRESET_KEY) || "[]");
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
      return window.FILTER_DATA.map(m => {
        const mallId = m.id || crypto.randomUUID();
        const floors = Array.from({ length: Number(m.floors || 1) }).map((_, i) => {
          const floorId = `${mallId}-F${i + 1}`;
          // sem places reais, colocamos 0..2 mockados
          const places = Array.from({ length: 3 }).map((__, k) => ({
            id: `${floorId}-P${k + 1}`,
            name: `Loja ${k + 1}`
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
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  function countSelected(sel) {
    return (sel.malls?.length || 0) + (sel.floors?.length || 0) + (sel.places?.length || 0);
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
    container.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelector(".myio-modal").setAttribute("aria-hidden", "true");
      });
    });
  }

  // ==== Referências do DOM ==================================================
  const modal = container.querySelector(".myio-modal");
  const elSearch = container.querySelector("#fltSearch");
  const elList = container.querySelector("#fltList");
  const elClear = container.querySelector("#fltClear");
  const elSave = container.querySelector("#fltSave");
  const elApply = container.querySelector("#fltApply");
  const elChips = container.querySelector("#fltChips");
  const elPresets = container.querySelector("#fltPresets");
  const elCount = container.querySelector("#fltCount");

  // ==== Render helpers ======================================================
  const flatMap = new Map(flatten(mallsTree).map(n => [n.id, n.name]));

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
    elCount.textContent = `${c} selecionado${c === 1 ? "" : "s"}`;
  }

  function renderChips() {
    elChips.innerHTML = "";
    const chips = [
      ...window.myioFilterSel.malls.map(id => ({ id, label: flatMap.get(id) })),
      ...window.myioFilterSel.floors.map(id => ({ id, label: flatMap.get(id) })),
      ...window.myioFilterSel.places.map(id => ({ id, label: flatMap.get(id) })),
    ].filter(c => !!c.label);

    for (const c of chips) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `
        <span>${c.label}</span>
        <button class="rm" title="Remover" aria-label="Remover seleção">×</button>
      `;
      chip.querySelector(".rm").addEventListener("click", () => {
        window.myioFilterSel = {
          malls: window.myioFilterSel.malls.filter(x => x !== c.id),
          floors: window.myioFilterSel.floors.filter(x => x !== c.id),
          places: window.myioFilterSel.places.filter(x => x !== c.id),
        };
        renderAll();
      });
      elChips.appendChild(chip);
    }
  }

  function renderTree() {
    const q = window.myioFilterQuery || "";
    elList.innerHTML = "";

    mallsTree.forEach(mall => {
      // floor & place ids
      const floorIds = (mall.children || []).map(f => f.id);
      const placeIds = (mall.children || []).flatMap(f => (f.children || []).map(p => p.id));

      // decide se mall aparece pelos filtros
      const mallMatch = nodeMatchesQuery(mall.name, q);
      // container do mall
      const mallCard = document.createElement("div");
      mallCard.className = "mall-card";
      mallCard.innerHTML = `
        <label class="mall-head">
          <input type="checkbox" ${isMallChecked(window.myioFilterSel, mall.id) ? "checked" : ""} />
          <span class="font-medium">${mall.name}</span>
          <span class="badge" style="margin-left:6px">${(mall.children || []).length} pisos</span>
        </label>
        <div class="sub"></div>
      `;
      const mallCheck = mallCard.querySelector("input");
      const mallSub = mallCard.querySelector(".sub");

      // click no mall: seleciona/deseleciona mall + floors + places
      mallCheck.addEventListener("change", () => {
        const checked = mallCheck.checked;
        window.myioFilterSel = {
          malls: checked
            ? [...new Set([...window.myioFilterSel.malls, mall.id])]
            : window.myioFilterSel.malls.filter(id => id !== mall.id),
          floors: checked
            ? [...new Set([...window.myioFilterSel.floors, ...floorIds])]
            : window.myioFilterSel.floors.filter(id => !floorIds.includes(id)),
          places: checked
            ? [...new Set([...window.myioFilterSel.places, ...placeIds])]
            : window.myioFilterSel.places.filter(id => !placeIds.includes(id)),
        };
        renderAll();
      });

      // floors
      (mall.children || [])
        .filter(fl => {
          const floorMatch = nodeMatchesQuery(fl.name, q);
          const hasPlaceMatch = (fl.children || []).some(p => nodeMatchesQuery(p.name, q));
          // Exibe o floor se: mall já bateu OU floor bate OR alguma loja bate
          return mallMatch || floorMatch || hasPlaceMatch;
        })
        .forEach(fl => {
          const floorCard = document.createElement("div");
          floorCard.className = "floor-card";
          floorCard.innerHTML = `
            <label class="floor-head">
              <input type="checkbox" ${isFloorChecked(window.myioFilterSel, fl.id) ? "checked" : ""} />
              <span>${fl.name}</span>
              <span class="badge" style="margin-left:6px">${(fl.children || []).length} ambientes</span>
            </label>
            <div class="places"></div>
          `;
          const floorCheck = floorCard.querySelector("input");
          const placesBox = floorCard.querySelector(".places");

          floorCheck.addEventListener("change", () => {
            const checked = floorCheck.checked;
            const thisPlaceIds = (fl.children || []).map(p => p.id);
            window.myioFilterSel = {
              malls: checked
                ? [...new Set([...window.myioFilterSel.malls, mall.id])]
                : window.myioFilterSel.malls, // não removemos o mall automaticamente (outros floors podem continuar)
              floors: toggle(window.myioFilterSel.floors, fl.id),
              places: checked
                ? [...new Set([...window.myioFilterSel.places, ...thisPlaceIds])]
                : window.myioFilterSel.places.filter(id => !thisPlaceIds.includes(id)),
            };
            renderAll();
          });

          (fl.children || [])
            .filter(p => {
              const pmatch = nodeMatchesQuery(p.name, q);
              // Exibe place se qualquer nó ancestral/ele mesmo bate
              return mallMatch || nodeMatchesQuery(fl.name, q) || pmatch;
            })
            .forEach(p => {
              const li = document.createElement("label");
              li.className = "place-item";
              li.innerHTML = `
                <input type="checkbox" ${isPlaceChecked(window.myioFilterSel, p.id) ? "checked" : ""} />
                <span class="text-sm">${p.name}</span>
              `;
              const chk = li.querySelector("input");
              chk.addEventListener("change", () => {
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
      if (
        mallMatch ||
        mallSub.children.length > 0
      ) {
        elList.appendChild(mallCard);
      }
    });
    if (!window.custumersSelected) window.custumersSelected = [];

    if (!elList.children.length) {
      if (Array.isArray(self.ctx.$scope.custumer) && self.ctx.$scope.custumer.length) {
        elList.style.textAlign = "left";

        self.ctx.$scope.custumer.forEach(c => {
          const item = document.createElement("button");
          item.className = "custumers";

          // armazenar o dado no próprio botão
          item.custumerData = c;

          // quadrado à esquerda
          const box = document.createElement("div");
          box.className = "checkbox";
          item.appendChild(box);

          // texto do cliente
          const text = document.createElement("span");
          text.textContent = c.name;
          item.appendChild(text);
          window.custumersSelected = []; 
          // clique para selecionar/deselecionar
          item.addEventListener("click", () => {
            const isSelected = item.classList.toggle("selected");
            if (isSelected) {
              window.custumersSelected.push(c); // adiciona ao array
            } else {
              window.custumersSelected = window.custumersSelected.filter(x => x !== c);
            }
           // console.log("Selecionados:", window.custumersSelected);
          });
          self.ctx.filterCustom = window.custumersSelected
          console.log('window.custumersSelected >>>>>>>>>>>>>', window.custumersSelected);
          
          elList.appendChild(item);
        });
      } else {
        const empty = document.createElement("div");
        empty.style.color = "#6b7280";
        empty.style.fontSize = "14px";
        empty.style.textAlign = "left";
        empty.textContent = "Nenhum resultado encontrado para o filtro atual.";
        elList.appendChild(empty);
      }
    }

  }

  function renderPresets() {
    elPresets.innerHTML = "";
    const presets = window.myioFilterPresets || [];
    if (!presets.length) {
      const empty = document.createElement("div");
      empty.style.color = "#6b7280";
      empty.style.fontSize = "12px";
      empty.textContent = "Nenhum preset salvo ainda.";
      elPresets.appendChild(empty);
      return;
    }
    presets.slice(0, 12).forEach(p => {
      const row = document.createElement("div");
      row.className = "preset-item";
      const btnApply = document.createElement("button");
      btnApply.textContent = p.name;
      btnApply.title = "Aplicar preset";
      btnApply.style.textDecoration = "underline";

      const btnDel = document.createElement("button");
      btnDel.innerHTML = "🗑️";
      btnDel.title = "Excluir preset";

      btnApply.addEventListener("click", () => {
        // aplica seleção do preset
        window.myioFilterSel = {
          malls: [...(p.selection?.malls || [])],
          floors: [...(p.selection?.floors || [])],
          places: [...(p.selection?.places || [])],
        };
        renderAll();
      });

      btnDel.addEventListener("click", () => {
        window.myioFilterPresets = (window.myioFilterPresets || []).filter(x => x.id !== p.id);
        try {
          localStorage.setItem(PRESET_KEY, JSON.stringify(window.myioFilterPresets));
        } catch { }
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
    elSearch.addEventListener("input", (e) => {
      window.myioFilterQuery = e.target.value || "";
      renderTree();
    });
  }

  if (!elClear._bound) {
    elClear._bound = true;
    elClear.addEventListener("click", () => {
      window.myioFilterSel = { malls: [], floors: [], places: [] };
      window.myioFilterQuery = "";
      elSearch.value = "";
      renderAll();
    });
  }

  if (!elSave._bound) {
    elSave._bound = true;
    elSave.addEventListener("click", () => {
      const name = prompt("Nome do preset:");
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
      } catch { }
      renderPresets();
    });
  }

  if (!elApply._bound) {
    elApply._bound = true;
    elApply.addEventListener("click", async () => {
      // Itens selecionados
      //console.log("Itens selecionados:", window.custumersSelected);

      const percentDiference = document.getElementById("energy-trend");

      percentDiference.innerText = "";

      // Desabilita botão enquanto carrega
      elApply.disabled = true;

      // Chama a função que atualiza o consumo
      console.log('>>>>>>>>>>>>>>>>>>>>>> pre consumo');
      
      await updateTotalConsumption(
        window.custumersSelected,
        self.ctx.$scope.startDateISO,
        self.ctx.$scope.endDateISO
      );

      // Reabilita botão
      elApply.disabled = false;

      // Dispara evento com os custumers selecionados
      window.dispatchEvent(
        new CustomEvent("myio:filter-applied", {
          detail: {
            selection: window.custumersSelected,
            ts: Date.now(),
          }
        })
      );

      // Fecha modal
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

  // Foco no input de busca
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

  modal.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => modal.setAttribute("aria-hidden", "true"));
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

function setSummary(data = {}) {
  // === Equipamentos ===
  if (data.equip) {
    const pct = Math.max(0, Math.min(100, data.equip.percent ?? 0));
    document.getElementById("equip-kpi").textContent =
      data.equip.totalStr ?? "0/0";
    document.getElementById("equip-sub").textContent = `${pct}% operational`;
    setBarPercent(document.getElementById("equip-bar"), pct, 8);
  }

  // === Energia ===
  if (data.energy) {
    const trendEl = document.getElementById("energy-trend");
    document.getElementById("energy-kpi").textContent = data.energy.kpi ?? "--";
    // trendEl.textContent = (data.energy.trendDir === 'up' ? '↑ ' : '// ') + (data.energy.trendText?.replace(/[↑↓]\s*/,'') || '');
    trendEl.classList.toggle(
      "down",
      (data.energy.trendDir || "down") === "down"
    );
    trendEl.classList.toggle("up", (data.energy.trendDir || "down") === "up");
    document.getElementById("energy-peak").textContent =
      data.energy.peakText ?? "";
  }

  // === Temperatura ===
  if (data.temp) {
    document.getElementById("temp-kpi").textContent = data.temp.kpi ?? "--";
    document.getElementById("temp-range").textContent =
      data.temp.rangeText ?? "";
  }

  // === Água ===
  if (data.water) {
    const pct = Math.max(0, Math.min(100, data.water.percent ?? 0));
    document.getElementById("water-kpi").textContent = `${pct}%`;
    setBarPercent(document.getElementById("water-bar"), pct, 12); // cauda um pouco maior
    if (data.water.alertText) {
      const w = document.getElementById("water-alert");
      w.textContent = data.water.alertText;
      w.classList.add("warn");
    }
  }
}

window.myioSetMenuSummary = setSummary;
function formatDiaMes(date) {
  const dia = String(date.getDate()).padStart(2, "0");   // garante 2 dígitos
  const mes = String(date.getMonth() + 1).padStart(2, "0"); // meses começam em 0
  return `${dia}/${mes}`;
}

/* ====== Lifecycle ====== */
self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {
  // Global busy modal is managed by MAIN orchestrator

  // Define timezone e datas iniciais
  const TZ = 'America/Sao_Paulo';
  const hoje = new Date();

  // Define datas iniciais (início do mês até hoje)
  const startDate = presetStart ? new Date(presetStart) : new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
  const endDate = presetEnd ? new Date(presetEnd) : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

  // Converte para ISO strings
  let timeStart = startDate.toISOString();
  let timeEnd = endDate.toISOString();

  const root = (self?.ctx?.$container && self.ctx.$container[0]) || document;
  CLIENT_ID = self.ctx.settings.clientId;
  CLIENT_SECRET = self.ctx.settings.clientSecret;

  bindTabs(root);
  bindFilter(root);

  // mocks (remova se alimentar via API/telemetria)
  setSummary({
    equip: { totalStr: "24/26", percent: 92 },
    energy: { peakText: "Pico: 1.8 kW às 14:30" },
    temp: { kpi: "22.5°C", rangeText: "Faixa: 20°C – 25°C" },
    water: { percent: 87, alertText: "⚠ Cisterna Principal 2 com 68%" },
  });

  const filterBtn = document.getElementById("filterBtn");


  if (filterBtn) {
    filterBtn.addEventListener("click", () => {
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
  window.dispatchEvent(new CustomEvent('myio:update-date', {
    detail: {
      startDate: startDateISO,
      endDate: endDateISO,
    }
  }));

  // Atualiza intervalo de datas na UI
  const timeWindow = `Intervalo: ${formatDiaMes(startDate)} - ${formatDiaMes(endDate)}`;
  const timeinterval = document.getElementById("energy-peak");
  if (timeinterval) {
    timeinterval.innerText = timeWindow;
  }
  
  const custumer = [];

  // não apagar!!
  self.ctx.data.forEach(data => {
     if (data.datasource.aliasName === "Shopping") {
      // adiciona no array custumes
      custumer.push({
         name: data.datasource.entityLabel, // ou outro campo que seja o "nome"
         value: data.data[0][1]                  // ou o dado que você precisa salvar
      });
     }
     
     updateTotalConsumption(custumer, startDateISO, endDateISO)
  });



  self.ctx.$scope.custumer = custumer
 // console.log("custumer",custumer)



};

// ===== HEADER: Equipment Card Handler =====
function updateEquipmentCard() {
  // Find datasources[0] with aliasName="Equipamentos"
  let totalDevices = 0;
  let onlineDevices = 0;

  self.ctx.data.forEach((data) => {
    if (data.datasource.aliasName === "Equipamentos") {
      totalDevices++;
      const status = String(data.data?.[0]?.[1] || '').toLowerCase();
      if (status === "online") {
        onlineDevices++;
      }
    }
  });

  const percentage = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;

  const statusDevice = document.getElementById("equip-kpi");
  const percentDevice = document.getElementById("equip-sub");

  if (statusDevice) statusDevice.innerText = `${onlineDevices}/${totalDevices}`;
  if (percentDevice) percentDevice.innerText = `${percentage}% operational`;

  console.log("[HEADER] Equipment card updated:", { online: onlineDevices, total: totalDevices, percentage });
}

// ===== HEADER: Energy Card Handler =====
function showEnergyCardLoading(isLoading) {
  const energyKpi = document.getElementById("energy-kpi");
  const energyTrend = document.getElementById("energy-trend");

  if (isLoading) {
    if (energyKpi) {
      energyKpi.innerHTML = `
        <svg style="width:28px; height:28px; animation: spin 1s linear infinite;" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="#6c2fbf" stroke-width="5" stroke-linecap="round"
                  stroke-dasharray="90,150" stroke-dashoffset="0">
          </circle>
        </svg>
      `;
    }
    if (energyTrend) {
      energyTrend.innerText = "Carregando...";
    }
  }
}

function updateEnergyCard(energyCache) {
  const ingestionIds = [];
  const energyKpi = document.getElementById("energy-kpi");
  const energyTrend = document.getElementById("energy-trend");

  // ✅ FIX: Removed early return - always process updates
  console.log("[HEADER] Updating energy card with cache:", energyCache?.size || 0, "devices");

  // RFC-0057: Enhanced safety check with try-catch
  if (Array.isArray(self.ctx.data)) {
    self.ctx.data.forEach((data, index) => {
      try {
        // Skip if data is undefined or null
        if (!data || !data.datasource || !data.data) {
          return;
        }

        //console.log('[HEADER] Processing data row:', data);

        // Extract ingestionId from data
        const ingestionId = data.data?.[0]?.[1]; // data[indexOfIngestionId][1] = value
        if (ingestionId) {
          ingestionIds.push(ingestionId);
        }
      } catch (err) {
        console.warn(`[HEADER] Skipped data item ${index} due to error:`, err.message);
      }
    });
  }

  console.log("[HEADER] Energy card: Found ingestionIds:", ingestionIds.length);

  // Sum consumption from cache for all ingestionIds
  let totalConsumption = 0;
  if (energyCache) {
    ingestionIds.forEach(ingestionId => {
      const cached = energyCache.get(ingestionId);
      if (cached) {
        totalConsumption += cached.total_value || 0;
        //console.log(`[HEADER] Device ${cached.name}: ${cached.total_value} kWh`);
      }
    });
  }

  // ✅ ALWAYS update, even if value is same
  if (energyKpi) {
    const formatted = MyIOLibrary.formatEnergy ? MyIOLibrary.formatEnergy(totalConsumption) : `${totalConsumption.toFixed(2)} kWh`;
    energyKpi.innerText = formatted;
    console.log(`[HEADER] Energy card updated: ${formatted}`);
  }

  // Optional: update trend (can be calculated later based on historical data)
  if (energyTrend) {
    energyTrend.innerText = ""; // Clear for now
  }

  console.log("[HEADER] Energy card update complete:", { totalConsumption, devices: ingestionIds.length });

  // ✅ EMIT EVENT: Notify ENERGY widget of customer total consumption
  window.dispatchEvent(new CustomEvent('myio:customer-total-consumption', {
    detail: {
      customerTotal: totalConsumption,
      deviceCount: ingestionIds.length,
      timestamp: Date.now()
    }
  }));
  console.log(`[HEADER] Emitted customer total consumption: ${totalConsumption} kWh`);
}

// ===== HEADER: Listen for energy data from MAIN orchestrator =====
window.addEventListener('myio:energy-data-ready', (ev) => {
  console.log("[HEADER] Received energy data from orchestrator:", ev.detail);
  updateEnergyCard(ev.detail.cache);
});

self.onDataUpdated = function () {
  if (_dataRefreshCount >= MAX_DATA_REFRESHES) {
    return;
  }

  _dataRefreshCount++;

  // Update Equipment card
  updateEquipmentCard();
};

self.onDestroy = function () {
  /* nada a limpar */
};
