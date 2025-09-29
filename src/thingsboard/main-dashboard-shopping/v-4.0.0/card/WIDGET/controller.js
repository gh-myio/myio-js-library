// ==============================
// Configurações
// ==============================
const CONFIG = {
  valueKeysTry: ["energyTotalMWh", "kwhTotal", "energy", "val"],
  unit: "MWh",
  decimals: 2,
};

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";

let CLIENT_ID;
let CLIENT_SECRET;
let CUSTOMER_INGESTION_ID;

/**
 * Mapa de hierarquia (deviceId -> { parentId, grandparentId })
 * Preenchido por fetchHierarchyMap()
 */
let hierarchyMap = new Map();

// Fallback MyIO
const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary) ||
  (typeof window !== "undefined" && window.MyIOLibrary) || {
    formatNumberReadable: (n, d = 2) =>
      Number(n ?? 0).toLocaleString("pt-BR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }),
    formatEnergy: (v) =>
      `${Number(v || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${CONFIG.unit}`,
  };

// ==============================
// Estado
// ==============================
const STATE = {
  baseEntities: [], // derivado de ctx.data
  searchActive: false,
  searchTerm: "",
  selectedIds: null, // null = todas; caso contrário: Set<string>
  sortMode: "cons_desc", // padrão
};

// ==============================
// Utilitários
// ==============================
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find("#shopsList");
const $count = () => $root().find("#shopsCount");
const $total = () => $root().find("#shopsTotal");
const $searchWrap = () => $root().find("#searchWrap");
const $search = () => $root().find("#shopsSearch");
const $modal = () => $root().find("#filterModal");
const $labelWidgetTag = () => $root().find("#labelWidgetId");
let labelWidgetIdText = "";

// RFC: Global refresh counter to limit data updates to 3 times maximum
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
          headers: {
            "Content-Type": "application/json",
          },
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

  return {
    getToken,
    getExpiryInfo,
    clearCache,
  };
})();

// Helper: aceita number | Date | string e retorna "YYYY-MM-DDTHH:mm:ss-03:00"
function toSpOffsetNoMs(input, endOfDay = false) {
  const d =
    typeof input === "number"
      ? new Date(input)
      : input instanceof Date
      ? input
      : new Date(String(input));

  if (Number.isNaN(d.getTime())) throw new Error("Data inválida");

  if (endOfDay) d.setHours(23, 59, 59, 999);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  const SS = String(d.getSeconds()).padStart(2, "0");

  // São Paulo (sem DST hoje): -03:00
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}-03:00`;
}

// Função para pegar timestamps das datas internas completas
function getTimeWindowRange() {
  let startTs = 0;
  let endTs = 0;

  if (self.startDate) {
    const startDateObj = new Date(self.startDate);

    if (!isNaN(startDateObj)) {
      startDateObj.setHours(0, 0, 0, 0);
      startTs = startDateObj.getTime();
    }
  }

  if (self.endDate) {
    const endDateObj = new Date(self.endDate);

    if (!isNaN(endDateObj)) {
      endDateObj.setHours(23, 59, 59, 999);
      endTs = endDateObj.getTime();
    }
  }

  return {
    startTs,
    endTs,
  };
}

function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper: Authenticated fetch with 401 retry
async function fetchWithAuth(url, opts = {}, retry = true) {
  const token = await MyIOAuth.getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 && retry) {
    console.warn(
      `[fetchWithAuth] 401 on ${
        url.split("?")[0]
      } - refreshing token and retrying`
    );
    MyIOAuth.clearCache(); // Force token refresh
    const token2 = await MyIOAuth.getToken();
    const res2 = await fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${token2}`,
      },
    });
    if (!res2.ok) {
      const errorText = await res2.text().catch(() => "");
      throw new Error(`[HTTP ${res2.status}] ${errorText}`);
    }
    return res2;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`[HTTP ${res.status}] ${errorText}`);
  }

  return res;
}

function latestNumber(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;

  const v = Number(arr[arr.length - 1][1]);

  return Number.isFinite(v) ? v : null;
}

function resolveEntityValue(chunks) {
  for (const key of CONFIG.valueKeysTry) {
    const ch = chunks.find((c) => c.dataKey?.name === key);

    if (ch) {
      const v = latestNumber(ch.data);
      if (v !== null) return v;
    }
  }
  // fallback: primeiro numérico válido
  for (const ch of chunks) {
    const v = latestNumber(ch.data);

    if (v !== null) return v;
  }
  return 0;
}

function buildEntitiesFromCtx(ctx) {
  // 1. Agrupador: Guarda todos os "pedaços" de dados por ID de entidade.
  const byEntity = new Map();

  for (const dataItem of ctx.data || []) {
    const ds = dataItem.datasource || {};
    const id = ds.entityId?.id || ds.entityId;

    if (!id) continue; // Pula se não tiver ID

    if (!byEntity.has(id)) {
      // Se é a primeira vez que vemos essa entidade, criamos a estrutura dela.
      byEntity.set(id, {
        id: id,
        // 'chunks' vai guardar todos os pedaços de dados (slaveId, centralId, etc.)
        chunks: [],
        // Guardamos a primeira datasource que encontrarmos para ter acesso ao label, etc.
        ds: ds,
      });
    }

    byEntity.get(id).chunks.push(dataItem);
  }

  // 2. Montador: Agora, para cada entidade, montamos o objeto completo.
  const entities = [];

  // Helper para buscar um valor de atributo específico dentro dos 'chunks'
  const getAttributeValue = (chunks, attributeName) => {
    const chunk = chunks.find((c) => c.dataKey?.name === attributeName);
    // O valor está sempre em chunk.data[0][1]
    return chunk?.data?.[0]?.[1] ?? null;
  };

  for (const { id, chunks, ds } of byEntity.values()) {
    const slaveId = getAttributeValue(chunks, "slaveId");
    const centralId = getAttributeValue(chunks, "centralId");
    const ingestionId = getAttributeValue(chunks, "ingestionId");
    let deviceType = getAttributeValue(chunks, "deviceType");
    const identifier = getAttributeValue(chunks, "identifier");

    const connectionStatusData = getAttributeValue(chunks, "connectionStatus");

    const val = resolveEntityValue(chunks);

    entities.push({
      entityId: String(id),
      labelOrName:
        ds.entityLabel ||
        ds.entityName ||
        ds.name ||
        `Entidade ${String(id).slice(0, 8)}`,
      slaveId: slaveId,
      centralId: centralId,
      ingestionId: ingestionId,
      deviceType: deviceType,
      identifier: identifier,
      val: val,
      valType: "ENERGY",
      connectionStatus: connectionStatusData || "offline",
    });
  }

  console.log("Entidades montadas com sucesso:", entities);
  return entities;
}

// A sua função resolveEntityValue (para o valor principal) continua a mesma
function resolveEntityValue(chunks) {
  const valueKeysTry = ["energyTotalMWh", "kwhTotal", "energy", "val"];
  for (const key of valueKeysTry) {
    const chunk = chunks.find((c) => c.dataKey?.name === key);
    if (chunk) {
      const value = chunk?.data?.[0]?.[1];
      if (value !== null && value !== undefined) return Number(value);
    }
  }
  return 0;
}

function salvarIdentifiers(filtered) {
  const jobs = filtered.map((e) => {
    const parentName = e.parent.name;
    const grandparentName = e.grandparent.name;
    let finalDeviceIdentifier = null;
    if (
      parentName &&
      grandparentName &&
      parentName.startsWith(grandparentName)
    ) {
      finalDeviceIdentifier = parentName.slice(grandparentName.length);
    }
    // retorna a Promise (não chama IIFE por item)
    return addIdentifierAttribute(e.entityId, finalDeviceIdentifier);
  });
  // um único ponto async para orquestrar tudo
  (async () => {
    const results = await Promise.allSettled(jobs);
    console.table(
      results.map((r, i) => ({
        index: i,
        status: r.status,
        reason: r.status === "rejected" ? String(r.reason) : undefined,
      }))
    );
  })();
}

async function addIdentifierAttribute(deviceId, identifier) {
  if (!deviceId) throw new Error("deviceId é obrigatório");
  if (identifier == null) throw new Error("identifier é obrigatório");
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("jwt_token ausente no localStorage");
  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
  const headers = {
    "Content-Type": "application/json",
    "X-Authorization": "Bearer " + token,
  };
  //console.log("[addIdentifierAttribute] :arrow_forward: POST", { url, deviceId, identifier });
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ identifier }),
  });
  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(
      `[addIdentifierAttribute] :x: HTTP ${res.status} ${res.statusText} - ${bodyText}`
    );
  }
  let data = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    /* pode não ser JSON */
  }
  //console.log("[addIdentifierAttribute] :white_check_mark: OK", { status: res.status, data });
  return { ok: true, status: res.status, data };
}

/**
 * Função principal para buscar dados de pai/avô em massa.
 *
 *
 * @param {Array<Object>} deviceEntityList - Sua lista de entidades de dispositivos.
 * Ex: [{id: "...", entityType: "DEVICE"}, ...]
 *
 * @returns {Map<string, {parent: Object, grandparent: Object}>}
 * Um Mapa onde a chave é o ID do dispositivo e o valor é um objeto
 * com os dados completos do pai e avô.
 */
// async function fetchDeviceHierarchyInBulk(deviceEntityList) {

//   // 1. & 2. Buscar relações de Pais (paralelo) e mapear
//   //console.log(`[BulkFetch] Buscando ${deviceEntityList.length} relações de pais...`);
//   const parentPromises = deviceEntityList.map(getParentAssetRelation);
//   const parentResults = await Promise.allSettled(parentPromises);

//   const deviceToParentMap = new Map();
//   const parentEntities = [];
//   parentResults.forEach((result, index) => {
//     if (result.status === 'fulfilled' && result.value) {
//       const parentAssetEntity = result.value;
//       const deviceId = deviceEntityList[index].id;
//       deviceToParentMap.set(deviceId, parentAssetEntity.id);
//       parentEntities.push(parentAssetEntity);
//     }
//   });
//   const uniqueParentEntities = [...new Map(parentEntities.map(item => [item.id, item])).values()];

//   // 3. & 4. Buscar relações de Avós (paralelo) e mapear
//   //console.log(`[BulkFetch] Buscando ${uniqueParentEntities.length} relações de avós...`);
//   const grandparentPromises = uniqueParentEntities.map(getParentAssetRelation);
//   const grandparentResults = await Promise.allSettled(grandparentPromises);

//   const parentToGrandparentMap = new Map();
//   const grandparentAssetIds = [];
//   grandparentResults.forEach((result, index) => {
//     if (result.status === 'fulfilled' && result.value) {
//       const grandparentAssetEntity = result.value;
//       const parentId = uniqueParentEntities[index].id;
//       parentToGrandparentMap.set(parentId, grandparentAssetEntity.id);
//       grandparentAssetIds.push(grandparentAssetEntity.id);
//     }
//   });

//   // 5. Lista final de TODOS os IDs de assets (pais + avós)
//   const allUniqueAssetIds = [...new Set([
//     ...parentEntities.map(p => p.id),
//     ...grandparentAssetIds
//   ])];

//   if (allUniqueAssetIds.length === 0) {
//     //console.log("[BulkFetch] Nenhum asset (pai ou avô) encontrado para buscar.");
//     return new Map();
//   }

//   // 6. BUSCA EM LOTE (CHUNKED) PARA PEGAR OS DETALHES (NOME, LABEL, ETC.)
//   //console.log(`[BulkFetch] Buscando detalhes de ${allUniqueAssetIds.length} assets em lotes...`);

//   // --- INÍCIO DA CORREÇÃO (Chunking) ---
//   // A API /api/assets?assetIds=... falha com 400 (URL longa) se muitos IDs.
//   // A solução é "fatiar" (chunk) a lista de IDs e fazer várias chamadas paralelas.

//   const injector = self.ctx.$scope.$injector;
//   const assetServiceName = self.ctx.servicesMap.get('assetService');
//   if (!assetServiceName) {
//       throw new Error("Não foi possível encontrar o 'assetService' no servicesMap.");
//   }
//   const assetService = injector.get(assetServiceName);

//   const CHUNK_SIZE = 50; // 50 IDs por requisição (um número seguro)
//   const chunkPromises = [];

//   for (let i = 0; i < allUniqueAssetIds.length; i += CHUNK_SIZE) {
//       const chunkOfIds = allUniqueAssetIds.slice(i, i + CHUNK_SIZE);
//       //console.log(`[BulkFetch] Criando promise para o lote ${i / CHUNK_SIZE + 1}/${Math.ceil(allUniqueAssetIds.length / CHUNK_SIZE)} (tamanho ${chunkOfIds.length})`);

//       // Adiciona a promise ao array
//       chunkPromises.push(
//           assetService.getAssets(chunkOfIds, {}).toPromise()
//       );
//   }

//   // Executa todas as N requisições (ex: 6 requisições) em paralelo
//   const allAssetChunks = await Promise.all(chunkPromises);

//   // Junta os resultados de todos os lotes em um único array
//   // .flat() achata [ [asset1, asset2], [asset3] ] para [asset1, asset2, asset3]
//   const allAssets = allAssetChunks.flat();

//   // --- FIM DA CORREÇÃO ---

//   // 7. Criar um Mapa de consulta rápida (ID -> Objeto Asset Completo)
//   // Agora 'allAssets' contém os objetos completos com 'name', 'label', etc.
//   const assetDetailsMap = new Map(allAssets.map(asset => [asset.id.id, asset]));
//   //console.log(`[BulkFetch] Mapa de detalhes de ${assetDetailsMap.size} assets criado.`);

//   // 8. Montar o resultado final: Mapa 'DeviceID' -> { parent, grandparent }
//   const finalResultMap = new Map();
//   for (const device of deviceEntityList) {
//     const deviceId = device.id;

//     const parentId = deviceToParentMap.get(deviceId);
//     const parentAsset = parentId ? assetDetailsMap.get(parentId) : null;

//     const grandparentId = parentId ? parentToGrandparentMap.get(parentId) : null;
//     const grandparentAsset = grandparentId ? assetDetailsMap.get(grandparentId) : null;

//     finalResultMap.set(deviceId, {
//       parent: parentAsset,
//       grandparent: grandparentAsset
//     });
//   }

//   //console.log("[BulkFetch] Processamento em massa concluído.");
//   return finalResultMap;
// }

function compareByMode(a, b, mode) {
  const alpha = a.labelOrName.localeCompare(b.labelOrName, "pt-BR", {
    sensitivity: "base",
  });

  if (mode === "cons_desc") {
    if (b.val !== a.val) return b.val - a.val;
    return alpha;
  }
  if (mode === "cons_asc") {
    if (a.val !== b.val) return a.val - b.val;
    return alpha;
  }
  if (mode === "alpha_desc") {
    return -alpha;
  }

  return alpha; // alpha_asc
}

function applyFilters() {
  const term = STATE.searchTerm.trim().toLowerCase();
  const selected = STATE.selectedIds;
  let out = STATE.baseEntities.slice();

  if (selected && selected.size) {
    out = out.filter((e) => selected.has(e.entityId));
  }

  if (term) {
    out = out.filter((e) => e.labelOrName.toLowerCase().includes(term));
  }

  out.sort((a, b) => compareByMode(a, b, STATE.sortMode));

  return out;
}

// async function getLucId(entityList) {
//     const deviceEntities = entityList.map(item => ({
//         id: item.entityId,
//         entityType: 'DEVICE'
//     }));

//     if (!deviceEntities.length) {
//         return new Map(); // Retorna um mapa vazio se não houver entidades
//     }

//     try {
//         //console.log("[getLucId] Iniciando busca em massa da hierarquia...");
//         // Chama a função e a retorna diretamente
//         //const hierarchyDataMap = await fetchDeviceHierarchyInBulk(deviceEntities);
//         //console.log(`[getLucId] Hierarquia carregada. ${hierarchyDataMap.size} dispositivos mapeados.`);
//         return hierarchyDataMap;
//     } catch (e) {
//         console.error("Erro ao buscar hierarquia em massa:", e);
//         // Em caso de erro, retorna um mapa vazio para não quebrar a aplicação
//         return new Map();
//     }
// }

// ==============================
// Render
// ==============================
function renderHeader(filtered) {
  $count().text(`(${filtered.length})`);
  const totalValue = filtered.reduce((acc, e) => acc + (Number(e.val) || 0), 0);
  $total().text(MyIO.formatEnergy(totalValue));
}

async function renderList(filtered) {
  const $mainList = $list().empty();

  //Esta chamada foi executada apenas uma única vez para salvar os identifiers
  //salvarIdentifiers(filtered);
  const ingestionIdToken =  await MyIOAuth.getToken()
  
  filtered.forEach((e) => {
    // Use os dados do pai/avô para preencher o card
    // (Ex: Pega o 'label' ou 'name' do pai como 'deviceIdentifier')
    //const parentName = e.parent.name;
    //console.log(parentName, 'parentName');

    // (Ex: Pega o 'label' ou 'name' do avô como 'centralName')
    //const grandparentName = e.grandparent.name;
    //console.log(grandparentName, 'grandparentName');

    let finalDeviceIdentifier = null;

    // if (parentName && grandparentName && parentName.startsWith(grandparentName)) {
    //     finalDeviceIdentifier = parentName.slice(grandparentName.length);
    // }

    const isOn = e.val > 0;
    const connectionStatus = isOn ? "power_on" : "power_off";
    const entityObject = {
      entityId: e.entityId,
      labelOrName: e.labelOrName,
      deviceType: e.deviceType,
      val: e.val,
      valType: e.valType,
      perc: e.perc ?? 0,
      deviceStatus: connectionStatus,
      entityType: "DEVICE",
      deviceIdentifier: e.identifier,
      slaveId: e.slaveId || "N/A",
      ingestionId: e.ingestionId || "N/A",
      centralId: e.centralId || "N/A",
      updatedIdentifiers: e.updatedIdentifiers || {},
      handInfo: true,
      centralName: "N/A",
      connectionStatusTime: new Date().getTime(),
      timaVal: new Date().getTime(),
    };
    const $card = MyIOLibrary.renderCardComponentV2({
      entityObject,
      handleActionDashboard: (ent) => console.log("[dashboard]", ent.labelOrName),
      handleActionReport: (ent) => MyIOLibrary.openDashboardPopupReport({
                ingestionId: e.ingestionId,
                identifier:e.identifier,
                label: e.labelOrName,
                api: { 
                    clientId: CLIENT_ID,
                    clientSecret: CLIENT_SECRET,
                    dataApiBaseUrl: DATA_API_HOST,
                    ingestionToken :ingestionIdToken
                }
            }),
      handleActionSettings: (ent) => console.log("[settings]", ent.labelOrName),
      handleSelect: () => console.log("select"),
      handInfo: true,
      handleClickCard: () => {},
    });

    $mainList.append($card);
  });
}

// ==============================
// Interações Header / Modal
// ==============================
function bindHeader() {
  $root().on("click", "#btnSearch", () => {
    STATE.searchActive = !STATE.searchActive;
    $searchWrap().toggleClass("active", STATE.searchActive);

    if (STATE.searchActive) {
      setTimeout(() => $search().trigger("focus"), 50);
    }
  });

  $root().on("input", "#shopsSearch", (e) => {
    STATE.searchTerm = e.target.value || "";
    const filtered = applyFilters();
    renderHeader(filtered);
    renderList(filtered);
  });

  $root().on("click", "#btnFilter", () => {
    openFilterModal();
  });
}

function openFilterModal() {
  const $m = $modal();
  const $chk = $m.find("#deviceChecklist");

  // limpa busca e itens escondidos
  $m.find("#filterDeviceSearch").val("");
  $chk.empty();

  // fonte de dados: STATE.baseEntities (já preenchida no hydrateAndRender)
  const list = (STATE.baseEntities || []).slice().sort((a, b) =>
    a.labelOrName.localeCompare(b.labelOrName, "pt-BR", {
      sensitivity: "base",
    })
  );

  if (!list.length) {
    $chk.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass("hidden");
    return;
  }

  // monta fragment DOM (rápido)
  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const e of list) {
    const idSafe =
      String(e.entityId || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 60) || "id" + Math.random().toString(36).slice(2);
    const checked = !selected || !selected.size || selected.has(e.entityId);

    const label = document.createElement("label");
    label.className = "check-item";
    label.setAttribute("role", "option");
    label.innerHTML = `<input type="checkbox" id="chk-${idSafe}" data-entity="${escapeHtml(
      e.entityId
    )}" ${checked ? "checked" : ""}>
       <span>${escapeHtml(e.labelOrName)}</span>`;
    frag.appendChild(label);
  }

  $chk[0].appendChild(frag);

  // garante tudo visível (caso o filtro anterior tenha escondido)
  $chk.find(".check-item").show();

  // sort mode
  $modal()
    .find(`input[name="sortMode"][value="${STATE.sortMode}"]`)
    .prop("checked", true);

  // Ensure modal footer buttons are visible
  const $footer = $m.find(".shops-modal-footer");

  if ($footer.length) {
    $footer.show();
    // Ensure buttons are visible
    $footer.find("#applyFilters, #resetFilters").show();
  }

  // aplica visual selecionado
  syncChecklistSelectionVisual();

  // exibe modal
  $m.removeClass("hidden");
}

function closeFilterModal() {
  $modal().addClass("hidden");
}

function bindModal() {
  $root().on("click", "#closeFilter", closeFilterModal);
  $root().on("click", "#selectAll", (e) => {
    e.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop("checked", true);
    syncChecklistSelectionVisual();
  });

  $root().on("click", "#clearAll", (e) => {
    e.preventDefault();
    $modal().find('.check-item input[type="checkbox"]').prop("checked", false);
    syncChecklistSelectionVisual();
  });

  $root().on("click", "#resetFilters", (e) => {
    e.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = "cons_desc";
    $modal().find('.check-item input[type="checkbox"]').prop("checked", true);
    $modal()
      .find('input[name="sortMode"][value="cons_desc"]')
      .prop("checked", true);
    syncChecklistSelectionVisual();

    const filtered = applyFilters();
    renderHeader(filtered);
    renderList(filtered);
  });

  $root().on("click", "#applyFilters", (e) => {
    e.preventDefault();
    // coletar selecionados
    _dataRefreshCount = 0;
    const set = new Set();

    $modal()
      .find('.check-item input[type="checkbox"]:checked')
      .each((_, el) => set.add($(el).data("entity")));

    STATE.selectedIds =
      set.size === 0 || set.size === STATE.baseEntities.length ? null : set;

    // sort mode
    STATE.sortMode = String(
      $modal().find('input[name="sortMode"]:checked').val() || "cons_desc"
    );

    const filtered = applyFilters();
    renderHeader(filtered);
    renderList(filtered);
    closeFilterModal();
  });

  // Filtro em tempo real da checklist da modal
  $root().on("input", "#filterDeviceSearch", (e) => {
    const q = (e.target.value || "").trim().toLowerCase();

    $modal()
      .find(".check-item")
      .each((_, el) => {
        const txt = $(el).text().trim().toLowerCase();
        $(el).toggle(txt.includes(q));
      });
  });

  // Botão limpar
  $root().on("click", "#filterDeviceClear", (e) => {
    e.preventDefault();
    const $inp = $modal().find("#filterDeviceSearch");
    $inp.val("");
    $modal().find(".check-item").show();
    $inp.trigger("focus");
  });
}

// ==============================
// NEW — move everything that used to be inside onDataUpdated here
// ==============================
async function hydrateAndRender() {
  // Guarda de segurança para evitar erros iniciais
  if (!self.ctx.datasources || self.ctx.datasources.length === 0) {
    return;
  }

  if (_dataRefreshCount >= MAX_DATA_REFRESHES) {
    return;
  }
  _dataRefreshCount++;

  // 1. Monta a lista de entidades com os dados do ThingsBoard (val ainda é 0)
  STATE.baseEntities = buildEntitiesFromCtx(self.ctx);

  // Se não houver entidades, não há o que fazer.
  if (STATE.baseEntities.length === 0) {
    renderHeader([]);
    renderList([]);
    return;
  }

  // ✨ NOVO: Bloco de busca de dados da API externa ✨
  try {
    // const { startTs, endTs } = getTimeWindowRange(); // Pega o período de tempo atual

    const startTs = "2025-09-01T00:00:00.000Z";
    const endTs = "2025-09-24T00:00:00.000Z";

    const url = new URL(
      `${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_INGESTION_ID}/energy/devices/totals`
    );
    url.searchParams.set("startTime", toSpOffsetNoMs(startTs));
    url.searchParams.set("endTime", toSpOffsetNoMs(endTs, true));
    url.searchParams.set("deep", "1");

    const DATA_API_TOKEN = await MyIOAuth.getToken();
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${DATA_API_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const dataList = Array.isArray(payload) ? payload : payload.data || [];

    // Cria um mapa para busca rápida usando o ingestionId
    const deviceDataMap = new Map();
    dataList.forEach((device) => {
      if (device.id) {
        deviceDataMap.set(String(device.id), device);
      }
    });

    console.log(
      `[API Fetch] Encontrados ${deviceDataMap.size} dispositivos com totais de consumo.`
    );

    // ✨ ATUALIZA O 'val' DAS ENTIDADES COM OS DADOS DA API ✨
    STATE.baseEntities.forEach((item) => {
      if (item.ingestionId && isValidUUID(item.ingestionId)) {
        const apiDevice = deviceDataMap.get(String(item.ingestionId));
        if (apiDevice) {
          item.val = Number(apiDevice.total_value || 0); // O 'val' é atualizado aqui!
        } else {
          item.val = 0; // Zera se não encontrou na API
        }
      } else {
        item.val = 0; // Zera se não tem ingestionId válido
      }
    });
  } catch (err) {
    console.error("Falha ao buscar dados de consumo da API:", err);
    // Em caso de erro, todos os valores 'val' permanecerão 0.
  }

  // O resto da função continua como antes, mas agora com STATE.baseEntities atualizado
  if (STATE.selectedIds && STATE.selectedIds.size) {
    const allIds = new Set(STATE.baseEntities.map((e) => e.entityId));
    STATE.selectedIds = new Set(
      [...STATE.selectedIds].filter((id) => allIds.has(id))
    );
    if (!STATE.selectedIds.size) STATE.selectedIds = null;
  }

  const filtered = applyFilters();
  renderHeader(filtered);
  renderList(filtered);

  if ($root().find("#filterModal").length) {
    syncChecklistSelectionVisual?.();
  }
}

// ==============================
// Lifecycle TB
// ==============================
self.onDataUpdated = function () {
  if (this.ctx.data.length > 0) {
    // ATUALIZADO: Usando o alias 'AreaComum_Asset'
    const datasource = this.ctx.datasources.find(
      (ds) => ds.aliasName === "AreaComum_Asset"
    );

    if (!datasource) {
      return;
    }

    const identifierDataKey = datasource.dataKeys.find(
      (dk) => dk.name === "identifier"
    );
    if (!identifierDataKey) return;

    const data = this.ctx.data.find(
      (d) => d.datasource.entityAliasId === datasource.entityAliasId
    );

    const attributeData = data ? data.data[identifierDataKey.key] : null;

    if (
      attributeData &&
      attributeData.length > 0 &&
      attributeData[0].length > 1
    ) {
      const identifierValue = attributeData[0][1];
      console.log("✅ Valor do atributo identifier é:", identifierValue);
    }
  }
};

self.onResize = function () {};
self.onDestroy = function () {};

// ==============================
// Helper functions
// ==============================
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function syncChecklistSelectionVisual() {
  $modal()
    .find(".check-item")
    .each(function () {
      const $item = $(this);
      const $checkbox = $item.find('input[type="checkbox"]');
      const checked = $checkbox.prop("checked");

      // Apply multiple methods to ensure visibility
      $item.toggleClass("selected", !!checked);
      $item.attr("data-checked", checked ? "true" : "false");

      // Force style update
      if (checked) {
        $item.css({
          background: "rgba(62,26,125,.08)",
          "border-color": "#3E1A7D",
          "box-shadow": "0 8px 18px rgba(62,26,125,.15)",
        });
      } else {
        $item.css({
          background: "#fff",
          "border-color": "#D6E1EC",
          "box-shadow": "0 6px 14px rgba(0,0,0,.05)",
        });
      }
    });
}

// async function getParentAssetRelation(entityId) {
//   if (!entityId?.id || !entityId?.entityType) {
//     return null;
//   }

//   const url = `/api/relations?toId=${entityId.id}&toType=${entityId.entityType}`;

//   try {
//     const relations = await self.ctx.http.get(url).toPromise();
//     const assetRel = relations.find(
//       (r) => r.from?.entityType === "ASSET" && r.type === "Contains"
//     );

//     return assetRel ? assetRel.from : null;
//   } catch (err) {
//     console.warn(`Falha ao buscar pai de ${entityId.id}:`, err?.message || err);
//     return null;
//   }
// }


async function fetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem("jwt_token");
  if (!tbToken) throw new Error("JWT do ThingsBoard não encontrado (localStorage.jwt_token).");

  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${tbToken}`
    }
  });
  if (!res.ok) {
    console.warn(`[customer attrs] HTTP ${res.status}`);
    return {};
  }
  const payload = await res.json();

  // Pode vir como array [{key,value}] OU como objeto { key: [{value}] }
  const map = {};
  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === "object") {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

// ==============================
// onInit - Register all DOM/event bindings and initial render
// ==============================
self.onInit = async function () {
  console.log("self.ctx:", self.ctx);
  const CUSTOMER_TB_ID = self.ctx.settings.customerTB_ID || " ";

  const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_TB_ID);

  CLIENT_ID =  customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  CUSTOMER_INGESTION_ID = customerCredentials.ingestionId || " ";
 
  console.log("CLIENT_ID:", CLIENT_ID);
  console.log("CLIENT_SECRET:", CLIENT_SECRET);
  console.log("CUSTOMER_INGESTION_ID:", CUSTOMER_INGESTION_ID);
  

  // Keep your container CSS safeguard
  labelWidgetIdText = self.ctx.settings.labelWidget;

  $labelWidgetTag().text(labelWidgetIdText);

  $(self.ctx.$container).css({
    height: "100%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  });

  // Register all header/modal/listeners ONLY here
  bindHeader?.();
  bindModal?.();

  // Optimized checkbox event handlers - NO DELAYS
  $root().on("change", '#deviceChecklist input[type="checkbox"]', function () {
    const $item = $(this).closest(".check-item");
    const checked = this.checked;

    // Apply visual changes immediately
    $item.toggleClass("selected", checked);
    $item.attr("data-checked", checked ? "true" : "false");

    // Immediate style update - no timeout
    if (checked) {
      $item.css({
        background: "rgba(62,26,125,.08)",
        "border-color": "#3E1A7D",
        "box-shadow": "0 8px 18px rgba(62,26,125,.15)",
      });
    } else {
      $item.css({
        background: "#fff",
        "border-color": "#D6E1EC",
        "box-shadow": "0 6px 14px rgba(0,0,0,.05)",
      });
    }
  });

  // Optimized click handler for check-item
  $root().on("click", "#deviceChecklist .check-item", function (e) {
    // Prevent if clicking directly on the checkbox input
    if (e.target && e.target.tagName.toLowerCase() === "input") {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const $item = $(this);
    const $checkbox = $item.find('input[type="checkbox"]');
    const newState = !$checkbox.prop("checked");

    // Update checkbox state and trigger change event immediately
    $checkbox.prop("checked", newState).trigger("change");
  });


  $root().on("click", "#deviceChecklist .check-item", function (e) {
    // Prevent if clicking directly on the checkbox input
    if (e.target && e.target.tagName.toLowerCase() === "input") {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const $item = $(this);
    const $checkbox = $item.find('input[type="checkbox"]');
    const newState = !$checkbox.prop("checked");

    // Update checkbox state and trigger change event immediately
    $checkbox.prop("checked", newState).trigger("change");
  });
  // First attempt (data may already be present)
  try {
    await hydrateAndRender();
  } catch (e) {
    /* ignore; will retry when data arrives */
  }

  // If data not ready yet, poll briefly until it arrives, then render once
  if (!Array.isArray(self.ctx.data) || self.ctx.data.length === 0) {
    const waitForData = setInterval(async () => {
      if (Array.isArray(self.ctx.data) && self.ctx.data.length > 0) {
        clearInterval(waitForData);
        await hydrateAndRender();
      }
    }, 150);
  }
};
