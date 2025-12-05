/* global self, localStorage, document, window, jsPDF, FileReader, prompt, QRious */

// ===================== Helpers Centrais / Addressing =====================
window.currentDDD = window.currentDDD || '21';
window.currentCNPJ = window.currentCNPJ || '00000000000000';

// Global flag to bypass provision_central API calls (for development/testing)
window.bypassProvisioning = false; //window.bypassProvisioning || false;

// Global counters for gateway and frequency management
let __globalGatewayCounter = 0; // Sequential gateway counter per client
let __globalFrequencyCounter = 90; // Starting frequency, increments by 2

// Global variable for cached customers list
//let allCustomersGlobal = null;

/************************************************************
 * MyIOAuth - Cache e renovação de access_token para ThingsBoard
 * Autor: você :)
 * Dependências: nenhuma (usa fetch nativo)
 ************************************************************/
const MyIOAuth = (() => {
  // ==== CONFIG ====
  //const AUTH_URL = "https://api.staging.data.apps.myio-bas.com/api/v1/auth";
  const AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';

  // ⚠️ Substitua pelos seus valores:
  //const CLIENT_ID = "ADMIN_DASHBOARD_CLIENT";
  //const CLIENT_SECRET = "admin_dashboard_secret_2025";

  const CLIENT_ID = 'myioadmi_mekj7xw7_sccibe';
  const CLIENT_SECRET = 'KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA';

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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          throw new Error(`Auth falhou: HTTP ${resp.status} ${resp.statusText} ${text}`);
        }

        const json = await resp.json();
        // Espera formato:
        // { access_token, token_type, expires_in, scope }
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error('Resposta de auth não contem campos esperados.');
        }

        _token = json.access_token;
        // Define expiração absoluta (agora + expires_in)
        _expiresAt = _now() + Number(json.expires_in) * 1000;

        // Logs úteis para depuração (não imprimem o token)
        console.log(
          '[MyIOAuth] Novo token obtido. Expira em ~',
          Math.round(Number(json.expires_in) / 60),
          'min'
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

// ---- Server-scope attributes hydrator --------------------------------------
const attrsCache = new Map(); // deviceId -> { slaveId, centralId } ou {}

// ✅ Versão FINAL com logs elucidativos (e concisos)
// 🚀 Versão SUPER DETALHADA com try/catchs extras, logs granulares e resumo final
async function fetchIdentifierAndCentralNameByDevice(deviceEntityList) {
  // ==========================
  // 🔧 Utilitários de tempo/log
  // ==========================
  const hasPerf = typeof performance !== 'undefined' && typeof performance.now === 'function';
  const nowMs = () => (hasPerf ? performance.now() : Date.now());
  const fmtMs = (ms) => `${Math.round(ms)}ms`;
  const TAG = '[BulkFetch]';

  const startedAt = nowMs();

  // ================================
  // 🎛️ Variáveis de estado/resultados
  // ================================
  let finalDeviceIdentifier = null;
  let grandparentName = null;
  let centralName = null;

  // Contadores/telemetria
  let devicesCount = 0;
  let parentsFound = 0;
  let grandparentsFound = 0;
  let assetIdsTotal = 0;
  let batchesTotal = 0;
  let batchesOK = 0;
  let postsPlanned = 0;
  let postsOK = 0;
  let postsFail = 0;

  // “Sub-tempos”
  let tSanity = 0,
    tParents = 0,
    tGrandparents = 0,
    tAssets = 0,
    tCompute = 0,
    tPosts = 0;

  try {
    // ===================
    // 🧪 Sanidade de entrada
    // ===================
    const t0 = nowMs();
    if (!Array.isArray(deviceEntityList)) {
      console.error(`${TAG} 💥 Parâmetro inválido: deviceEntityList não é array. Valor:`, deviceEntityList);
      throw new Error('deviceEntityList precisa ser um array.');
    }
    devicesCount = deviceEntityList.length;
    if (devicesCount === 0) {
      console.warn(`${TAG} ⚠️ Lista de devices vazia. Nada a fazer.`);
      // Resumo final (mesmo em early-return)
      const endedAt = nowMs();
      console.log(
        `${TAG} ✅ Resumo final | devices: 0 | pais: 0 | avós: 0 | assets detalhados: 0 | posts: 0 ok / 0 fail | total: ${fmtMs(
          endedAt - startedAt
        )}`
      );
      return { identifier: null, centralName: null };
    }
    console.log(`${TAG} ▶️ Início | devices recebidos: ${devicesCount}`);
    tSanity = nowMs() - t0;

    // ===============================
    // 🧩 Helpers (com try/catch interno)
    // ===============================
    async function getParentAssetRelation(entityId) {
      const t = nowMs();
      try {
        if (!entityId?.id || !entityId?.entityType) {
          console.warn(`${TAG} ⚠️ entityId inválido`, entityId);
          return null;
        }
        const url = `/api/relations?toId=${entityId.id}&toType=${entityId.entityType}`;
        const relations = await self.ctx.http.get(url).toPromise();
        const assetRel = Array.isArray(relations)
          ? relations.find((r) => r.from?.entityType === 'ASSET' && r.type === 'Contains')
          : null;
        const dt = nowMs() - t;
        if (assetRel) {
          console.log(`${TAG} 🔗 parent ok | to=${entityId.id} <- from=${assetRel.from?.id} | ${fmtMs(dt)}`);
          return assetRel.from;
        } else {
          console.log(`${TAG} 🔗 parent ∅ | to=${entityId.id} | ${fmtMs(dt)}`);
          return null;
        }
      } catch (err) {
        const dt = nowMs() - t;
        console.warn(
          `${TAG} ❌ getParentAssetRelation falhou para to=${entityId?.id} | ${fmtMs(dt)} | erro: ${
            err?.message || err
          }`
        );
        return null;
      }
    }

    async function addIdentifierAttribute(deviceId, identifier) {
      const t = nowMs();
      try {
        if (!deviceId) throw new Error('deviceId é obrigatório');
        if (identifier == null || identifier === '') throw new Error('identifier é obrigatório');

        const token = localStorage.getItem('jwt_token');
        if (!token) throw new Error('jwt_token ausente no localStorage');

        const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
        const headers = {
          'Content-Type': 'application/json',
          'X-Authorization': 'Bearer ' + token,
        };

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ identifier }),
        });

        const bodyText = await res.text().catch(() => '');
        if (!res.ok) {
          throw new Error(`[addIdentifierAttribute] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
        }

        let data = null;
        try {
          data = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          /* pode não ser JSON */
        }
        const dt = nowMs() - t;
        console.log(`${TAG} ✅ POST identifier ok | dev=${deviceId} | "${identifier}" | ${fmtMs(dt)}`);
        return { ok: true, status: res.status, data };
      } catch (err) {
        const dt = nowMs() - t;
        console.error(
          `${TAG} ❌ POST identifier falhou | dev=${deviceId} | "${identifier}" | ${fmtMs(dt)} | erro: ${
            err?.message || err
          }`
        );
        throw err;
      }
    }

    // ==========================================================
    // 🧠 Montagem da hierarquia (pais/avós) e detalhamento de assets
    // ==========================================================
    async function fetchDeviceHierarchyInBulk(list) {
      // ---------- Pais ----------
      const tP = nowMs();
      console.log(`${TAG} 🔎 Buscando pais (${list.length})...`);
      const parentPromises = list.map((d) =>
        getParentAssetRelation({
          id: d.id,
          entityType: d.entityType || 'DEVICE',
        })
      );
      const parentResults = await Promise.allSettled(parentPromises);

      const deviceToParentMap = new Map();
      const parentEntities = [];
      parentResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          const p = r.value;
          deviceToParentMap.set(list[idx].id, p.id);
          parentEntities.push(p);
        }
      });
      parentsFound = deviceToParentMap.size;
      const uniqueParents = [...new Map(parentEntities.map((it) => [it.id, it])).values()];
      tParents = nowMs() - tP;
      console.log(
        `${TAG} 🧩 Pais ok: ${parentsFound}/${list.length} | únicos: ${uniqueParents.length} | ${fmtMs(
          tParents
        )}`
      );

      // ---------- Avós ----------
      const tG = nowMs();
      console.log(`${TAG} 🔎 Buscando avós (${uniqueParents.length})...`);
      const gpPromises = uniqueParents.map((p) =>
        getParentAssetRelation({
          id: p.id,
          entityType: p.entityType || 'ASSET',
        })
      );
      const gpResults = await Promise.allSettled(gpPromises);

      const parentToGrandparentMap = new Map();
      const gpIds = [];
      gpResults.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value) {
          const gp = r.value;
          const parentId = uniqueParents[idx].id;
          parentToGrandparentMap.set(parentId, gp.id);
          gpIds.push(gp.id);
        }
      });
      grandparentsFound = parentToGrandparentMap.size;
      tGrandparents = nowMs() - tG;
      console.log(
        `${TAG} 🧱 Avós ok: ${grandparentsFound}/${uniqueParents.length} | ${fmtMs(tGrandparents)}`
      );

      // ---------- Coleta de IDs ----------
      const allIds = [...new Set([...uniqueParents.map((p) => p.id), ...gpIds])];
      assetIdsTotal = allIds.length;
      if (assetIdsTotal === 0) {
        console.log(`${TAG} ℹ️ Nenhum asset (pai/avô) para detalhar.`);
        return {
          deviceToParentMap,
          parentToGrandparentMap,
          assetDetailsMap: new Map(),
        };
      }

      // ---------- Detalhes (chunked) ----------
      const tA = nowMs();
      console.log(`${TAG} 📦 Detalhando ${assetIdsTotal} assets em lotes...`);
      let assetService;
      try {
        const injector = self?.ctx?.$scope?.$injector;
        const assetServiceName = self?.ctx?.servicesMap?.get('assetService');
        if (!injector || !assetServiceName) throw new Error('Injector ou assetService ausente no contexto.');
        assetService = injector.get(assetServiceName);
      } catch (err) {
        console.error(`${TAG} 💥 Não foi possível obter assetService: ${err?.message || err}`);
        return {
          deviceToParentMap,
          parentToGrandparentMap,
          assetDetailsMap: new Map(),
        };
      }

      const CHUNK_SIZE = 50;
      const promises = [];
      batchesTotal = Math.ceil(assetIdsTotal / CHUNK_SIZE);

      for (let i = 0; i < assetIdsTotal; i += CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + CHUNK_SIZE);
        const batch = i / CHUNK_SIZE + 1;
        console.log(`${TAG} 🧰 Lote ${batch}/${batchesTotal} | size=${chunk.length}`);
        try {
          // cada getAssets pode lançar — capturamos no allSettled também
          promises.push(assetService.getAssets(chunk, {}).toPromise());
        } catch (err) {
          console.warn(`${TAG} ⚠️ Falha ao enfileirar lote ${batch}: ${err?.message || err}`);
        }
      }

      const chunkResults = await Promise.allSettled(promises);
      const allAssets = [];
      chunkResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allAssets.push(...r.value);
          batchesOK++;
        } else {
          console.warn(
            `${TAG} ⚠️ Lote ${i + 1} falhou:`,
            r.status === 'rejected' ? r.reason?.message || r.reason : 'resposta inválida'
          );
        }
      });

      const assetDetailsMap = new Map(allAssets.map((a) => [a?.id?.id ?? a?.id, a]).filter(([k]) => !!k));
      tAssets = nowMs() - tA;
      console.log(
        `${TAG} 📚 Assets detalhados: ${
          assetDetailsMap.size
        } | batches ok: ${batchesOK}/${batchesTotal} | ${fmtMs(tAssets)}`
      );

      return { deviceToParentMap, parentToGrandparentMap, assetDetailsMap };
    }

    // =========================
    // ▶️ Execução principal
    // =========================
    const tC = nowMs();
    const { deviceToParentMap, parentToGrandparentMap, assetDetailsMap } = await fetchDeviceHierarchyInBulk(
      deviceEntityList
    );

    console.log(
      `${TAG} 🗺️ Hierarquia pronta | devices c/pai: ${deviceToParentMap.size} | assets detalhados: ${assetDetailsMap.size}`
    );

    // =========================
    // 🏷️ Cálculo dos identifiers
    // =========================
    const jobs = [];
    for (const dev of deviceEntityList) {
      try {
        const deviceId = dev.id;
        const parentId = deviceToParentMap.get(deviceId);
        const gpId = parentId ? parentToGrandparentMap.get(parentId) : null;

        const parentAsset = parentId ? assetDetailsMap.get(parentId) : null;
        const gpAsset = gpId ? assetDetailsMap.get(gpId) : null;

        const parentName = parentAsset ? parentAsset.label || parentAsset.name || '' : '';
        grandparentName = gpAsset ? gpAsset.label || gpAsset.name || '' : '';

        let identifier = parentName; // default: nome do pai
        if (parentName && grandparentName && parentName.startsWith(grandparentName)) {
          identifier = parentName.slice(grandparentName.length);
        }

        if (!identifier) {
          console.warn(
            `${TAG} ⚠️ Identifier vazio | dev=${deviceId} | parent="${parentName}" | gp="${grandparentName}" | pulando POST`
          );
          continue;
        }

        postsPlanned++;
        jobs.push(
          addIdentifierAttribute(deviceId, identifier)
            .then(() => {
              postsOK++;
              return { deviceId, status: 'fulfilled', identifier };
            })
            .catch((err) => {
              postsFail++;
              return {
                deviceId,
                status: 'rejected',
                identifier,
                reason: err?.message || String(err),
              };
            })
        );

        // Salvar o “último” calculado para retorno (se quiser o do primeiro, mova isso para fora)
        finalDeviceIdentifier = identifier;
      } catch (err) {
        console.error(`${TAG} ❌ Falha ao preparar identifier para dev=${dev?.id}: ${err?.message || err}`);
      }
    }
    tCompute = nowMs() - tC;

    // =========================
    // ☁️ POST dos identifiers
    // =========================
    const tP = nowMs();
    if (postsPlanned === 0) {
      console.log(`${TAG} ℹ️ Nenhum POST a realizar (0 identifiers válidos).`);
    } else {
      console.log(`${TAG} 🚀 Publicando identifiers (SERVER_SCOPE): ${postsPlanned} dispositivos...`);
      try {
        const results = await Promise.allSettled(jobs);
        // Tabela resumida (cap)
        console.table(
          results.slice(0, 50).map((r, idx) => {
            const item = r.value ?? r.reason ?? {};
            return {
              idx,
              deviceId: item.deviceId,
              status: item.status || r.status,
              identifier: item.identifier,
              error: item.status === 'rejected' ? item.reason : undefined,
            };
          })
        );
        if (results.length > 50) {
          console.log(`${TAG} (…+${results.length - 50} linhas ocultas)`);
        }
      } catch (err) {
        console.error(`${TAG} 💥 Falha durante o Promise.allSettled dos POSTs: ${err?.message || err}`);
      }
    }
    tPosts = nowMs() - tP;
  } catch (fatal) {
    console.error(`${TAG} 💥 Erro fatal do método: ${fatal?.message || fatal}`);
  } finally {
    // =========================
    // 🧾 Resumo final SEMPRE
    // =========================
    const totalTime = nowMs() - startedAt;

    // Cálculo “centralName”: seguro contra null/curto
    console.log(`${TAG} ℹ️ Derivando centralName a partir do grandparentName:`, grandparentName);

    try {
      if (typeof grandparentName === 'string' && grandparentName.length >= 2) {
        centralName = grandparentName; // fallback: não corta se muito curto
      } else {
        centralName = null;
      }
    } catch (err) {
      console.warn(`${TAG} ⚠️ Falha ao derivar centralName: ${err?.message || err}`);
      centralName = null;
    }

    // Log de RESUMO FINAL
    console.log(
      `${TAG} ✅ Resumo final` +
        ` | devices=${devicesCount}` +
        ` | pais=${parentsFound}` +
        ` | avós=${grandparentsFound}` +
        ` | assetIds=${assetIdsTotal}` +
        ` | batches=${batchesOK}/${batchesTotal}` +
        ` | posts=${postsOK} ok / ${postsFail} fail / ${postsPlanned} planned` +
        ` | tempos: sanity=${fmtMs(tSanity)}, pais=${fmtMs(tParents)}, avós=${fmtMs(
          tGrandparents
        )}, assets=${fmtMs(tAssets)}, compute=${fmtMs(tCompute)}, post=${fmtMs(tPosts)}, total=${fmtMs(
          totalTime
        )}`
    );

    // Logar também os "finais"
    console.log(`${TAG} ℹ️ Final identifier:`, finalDeviceIdentifier);
    console.log(`${TAG} ℹ️ Final centralName:`, centralName);
  }

  // =========================
  // 🔙 Retorno (sempre após resumo)
  // =========================
  return { identifier: finalDeviceIdentifier, centralName };
}

async function fetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem('jwt_token');
  if (!tbToken) throw new Error('JWT do ThingsBoard não encontrado (localStorage.jwt_token).');

  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${tbToken}`,
    },
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
  } else if (payload && typeof payload === 'object') {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

function createLimiter(fn, limit = 8) {
  let active = 0;
  const q = [];
  const runNext = () => {
    if (active >= limit || q.length === 0) return;
    active++;
    const { args, resolve, reject } = q.shift();
    Promise.resolve(fn(...args))
      .then(resolve, reject)
      .finally(() => {
        active--;
        runNext();
      });
  };
  return (...args) =>
    new Promise((resolve, reject) => {
      q.push({ args, resolve, reject });
      runNext();
    });
}

async function fetchServerScopeAttrs(deviceId) {
  if (!deviceId) return {};
  if (attrsCache.has(deviceId)) return attrsCache.get(deviceId);

  // TB 3.x: retorna array de { key, value, lastUpdateTs }
  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;
  try {
    const token = localStorage.getItem('jwt_token');
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[attrs] ${deviceId} -> HTTP ${res.status}`);
      attrsCache.set(deviceId, {});
      return {};
    }
    const payload = await res.json();

    let map = {};
    if (Array.isArray(payload)) {
      for (const it of payload) map[it.key] = it.value;
    } else if (payload && typeof payload === 'object') {
      // fallback para formatos antigos (chave -> [{value}])
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
      }
    }

    const out = {};
    if (map.slaveId !== undefined) out.slaveId = map.slaveId;
    if (map.centralId !== undefined) out.centralId = map.centralId;

    attrsCache.set(deviceId, out);
    return out;
  } catch (err) {
    console.error(`[attrs] ${deviceId} ->`, err);
    attrsCache.set(deviceId, {});
    return {};
  }
}

const fetchServerScopeAttrsLimited = createLimiter(fetchServerScopeAttrs, 8);

async function hydrateDeviceRecursive(device, path = '') {
  if (!device) return;

  // só busca se ainda não vieram preenchidos
  if (device.id && (device.slaveId == null || device.centralId == null)) {
    const { slaveId, centralId } = await fetchServerScopeAttrsLimited(device.id);
    if (slaveId != null && device.slaveId == null) device.slaveId = slaveId;
    if (centralId != null && device.centralId == null) device.centralId = centralId;
  }

  // desce nos filhos (legado device->devices normalizado para device.children)
  if (Array.isArray(device.children) && device.children.length) {
    await Promise.all(device.children.map((cd, i) => hydrateDeviceRecursive(cd, `${path}.children[${i}]`)));
  }
}

async function hydrateAssetsRecursive(asset, path = '') {
  if (!asset) return;

  // hidrata todos os devices diretos do asset
  if (Array.isArray(asset.devices) && asset.devices.length) {
    await Promise.all(asset.devices.map((d, i) => hydrateDeviceRecursive(d, `${path}.devices[${i}]`)));
  }

  // percorre children e subAssets
  if (Array.isArray(asset.children) && asset.children.length) {
    await Promise.all(asset.children.map((a, i) => hydrateAssetsRecursive(a, `${path}.children[${i}]`)));
  }
  if (Array.isArray(asset.subAssets) && asset.subAssets.length) {
    await Promise.all(asset.subAssets.map((a, i) => hydrateAssetsRecursive(a, `${path}.subAssets[${i}]`)));
  }
}

function tsStampBR(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}/${MM}/${yyyy} ${hh}:${mm}:${ss}`;
}

// CNPJ -> 2-byte hash (0..65535) for stronger uniqueness
function cnpjTo2ByteHash(cnpj) {
  const only = (cnpj || '').replace(/\D/g, '');
  let hash = 0;

  // Use a more robust hash algorithm for 2-byte range
  for (let i = 0; i < only.length; i++) {
    hash = (hash * 37 + only.charCodeAt(i)) % 65536;
  }

  // Ensure we never return 0
  return hash === 0 ? 1 : hash;
}

// Split 2-byte hash into two bytes for YYY and WWW
function splitCnpjHash(cnpj) {
  const hash = cnpjTo2ByteHash(cnpj);
  const yyy = Math.floor(hash / 256); // High byte (0-255)
  const www = hash % 256; // Low byte (0-255)

  // Ensure neither byte is 0
  return {
    yyy: yyy === 0 ? 1 : yyy,
    www: www === 0 ? 1 : www,
  };
}

// Generate central_id in format XXX.YYY.WWW.ZZZ
function gerarCentralId(ddd, cnpj, gatewayId) {
  const xxx = ddd || window.currentDDD || '21';
  const { yyy, www } = splitCnpjHash(cnpj);
  const zzz = gatewayId;

  return `${String(xxx).padStart(3, '0')}.${String(yyy).padStart(3, '0')}.${String(www).padStart(
    3,
    '0'
  )}.${String(zzz).padStart(3, '0')}`;
}

// Get next gateway ID and frequency for a client
function getNextGatewayInfo() {
  __globalGatewayCounter++;
  const gatewayId = __globalGatewayCounter;
  const frequency = __globalFrequencyCounter;
  __globalFrequencyCounter += 2; // Increment by 2 for next gateway
  return { gatewayId, frequency };
}

// Get next device ID for a gateway (resets for each gateway)
function getNextDeviceIdForGateway(gateway) {
  if (!gateway._deviceCount) {
    gateway._deviceCount = 0;
  }
  gateway._deviceCount++;
  return gateway._deviceCount;
}

// Find the gateway that should contain devices for a given asset path
function findGatewayForAsset(assetPath) {
  try {
    const asset = eval(assetPath);

    // Check if this asset has gateways directly
    if (asset.gateways && asset.gateways.length > 0) {
      return asset.gateways[0]; // Use the first gateway
    }

    // Look up the hierarchy for a gateway
    const pathParts = assetPath.split('.');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const testPath = pathParts.slice(0, i).join('.');
      if (testPath) {
        try {
          const testAsset = eval(testPath);
          if (testAsset && testAsset.gateways && testAsset.gateways.length > 0) {
            return testAsset.gateways[0];
          }
        } catch (e) {
          // Continue searching
        }
      }
    }

    return null;
  } catch (e) {
    console.warn('[findGatewayForAsset] Error finding gateway for asset:', assetPath, e);
    return null;
  }
}

// Find the customer data (with DDD and CNPJ) for a given path
function findCustomerForPath(path) {
  try {
    // Extract the customer path from the full path
    const pathParts = path.split('.');

    // Find the structure index (e.g., "structure[0]")
    const structureMatch = pathParts[0].match(/structure\[(\d+)\]/);
    if (!structureMatch) {
      return null;
    }

    const customerIndex = parseInt(structureMatch[1], 10);
    let currentCustomer = window.structure[customerIndex];

    // Navigate through children if the path includes them
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (part.startsWith('children[')) {
        const childMatch = part.match(/children\[(\d+)\]/);
        if (childMatch) {
          const childIndex = parseInt(childMatch[1], 10);
          currentCustomer = currentCustomer.children[childIndex];
        }
      } else {
        // If we hit assets or other non-customer parts, stop here
        break;
      }
    }

    return currentCustomer;
  } catch (e) {
    console.warn('[findCustomerForPath] Error finding customer for path:', path, e);
    return null;
  }
}

// Tipo de device mapeado para "central"
function mapCentralDeviceType(type) {
  return String(type).includes('3F') ? 'three_phase_sensor' : 'outlet';
}

// Map device type to Ingestion API expected values
function mapToIngestionDeviceType(type) {
  const typeStr = String(type || '').toUpperCase();
  if (typeStr.includes('HIDROMETRO') || typeStr.includes('WATER')) {
    return 'water';
  }
  return 'energy'; // Default to energy for all other types
}

// "21.198.002.003" -> [21,198,2,3]
function centralIdToArray(centralIdStr) {
  return centralIdStr.split('.').map((n) => parseInt(n, 10));
}

// --- gerar nome de arquivo: complete-pre-setup-structure-<CUSTOMER>-<YYYY-MM-DD-hh-mm-ss>.pdf
function sanitizeForFile(s) {
  return String(s || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // sem acentos
    .replace(/[^\w\-]+/g, '-') // troca espaços/símbolos por -
    .replace(/-+/g, '-') // colapsa múltiplos -
    .replace(/^[-_]+|[-_]+$/g, '') // trim - _
    .slice(0, 80); // limite de segurança
}

function getTopCustomerName() {
  if (!Array.isArray(window.structure) || !window.structure.length) return 'unknown';
  // se houver vários, usa o primeiro; se quiser, troque por 'multi'
  return window.structure[0]?.name || 'unknown';
}

function tsStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${MM}-${dd}-${hh}-${mm}-${ss}`; // formato internacional até o segundo
}

// Modal de informações (device/gateway)
window.openInfoModal = function (kind, refPath) {
  const data = eval(refPath);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  const title =
    kind === 'device'
      ? 'Informações do Device'
      : kind === 'gateway'
      ? 'Informações da Central (Gateway/Hub)'
      : 'Informações';
  const pretty = JSON.stringify(data, null, 2);
  modal.innerHTML = `
    <div class="modal-content">
      <h3>${title}</h3>
      <pre style="max-height:300px;overflow:auto">${pretty}</pre>
      <button id="modalClose">Fechar</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#modalClose').onclick = () => modal.remove();
};

function encodePayload(payload, xorKey = 73) {
  const bytes = new TextEncoder().encode(payload);
  const encoded = bytes.map((b) => b ^ xorKey);

  return btoa(String.fromCharCode(...encoded));
}

function gerarCodigoUnico() {
  const caracteresPermitidos = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O, I, 0, 1
  let codigo = '';

  for (let i = 0; i < 7; i++) {
    const index = Math.floor(Math.random() * caracteresPermitidos.length);
    codigo += caracteresPermitidos[index];
  }

  return codigo;
}

async function createAssetWithRelation(name, type, originEntityId, originEntityType = 'CUSTOMER') {
  const token = localStorage.getItem('jwt_token');

  // Cria o asset
  const assetResponse = await fetch('/api/asset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ name, type }),
  });

  if (!assetResponse.ok) {
    console.error('[createAssetWithRelation] Erro ao criar asset:', await assetResponse.text());
    return;
  }

  const asset = await assetResponse.json();
  console.log('[createAssetWithRelation] Asset criado com sucesso:', asset);

  // Cria a relação
  const relationResponse = await fetch('/api/relation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({
      from: { entityType: originEntityType, id: originEntityId },
      to: { entityType: 'ASSET', id: asset.id.id },
      type: 'Contains',
      typeGroup: 'COMMON',
    }),
  });

  if (!relationResponse.ok) {
    console.error('[createAssetWithRelation] Erro ao criar relação:', await relationResponse.text());
    return;
  }

  console.log('[createAssetWithRelation] Relação criada com sucesso!');
  return asset; // <-- importante!
}

async function createDeviceWithCustomerAndAsset(
  name,
  type,
  customerId,
  assetId,
  identifier = null,
  customerName = null
) {
  const token = localStorage.getItem('jwt_token');
  const headers = {
    'Content-Type': 'application/json',
    'X-Authorization': 'Bearer ' + token,
  };

  try {
    // Construct dynamic device profile name with customer name
    const deviceProfileName = customerName ? `${type} ${customerName}` : type;

    // 1. Criar device com customerId direto no body
    const deviceResponse = await fetch('/api/device', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        type: deviceProfileName,
        customerId: { id: customerId, entityType: 'CUSTOMER' },
      }),
    });

    if (!deviceResponse.ok) {
      const text = await deviceResponse.text();
      throw new Error('[createDeviceWithCustomerAndAsset] Erro ao criar device: ' + text);
    }

    const device = await deviceResponse.json();

    const deviceId = typeof device.id === 'object' && device.id !== null ? device.id.id : device.id;

    // 2. Criar relação asset -> device
    const relationResponse = await fetch('/api/relation', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: { entityType: 'ASSET', id: assetId },
        to: { entityType: 'DEVICE', id: deviceId },
        type: 'Contains',
        typeGroup: 'COMMON',
      }),
    });

    if (!relationResponse.ok) {
      const text = await relationResponse.text();
      throw new Error('[createDeviceWithCustomerAndAsset] Erro ao criar relação asset->device: ' + text);
    }

    // 3. Adicionar IDENTIFIER como Server Attribute se fornecido
    if (identifier) {
      const attributeResponse = await fetch(
        `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            identifier: identifier,
          }),
        }
      );

      if (!attributeResponse.ok) {
        const text = await attributeResponse.text();
        console.warn(
          '[createDeviceWithCustomerAndAsset] Aviso: Não foi possível salvar o identifier como atributo:',
          text
        );
        // Não falha a criação do device por causa disso
      }
    }

    return device;
  } catch (error) {
    console.error('[createDeviceWithCustomerAndAsset]', error);
    throw error;
  }
}

async function createAssetWithParentAsset(name, type, parentAssetId) {
  const token = localStorage.getItem('jwt_token');

  // Cria o novo asset
  const assetResponse = await fetch('/api/asset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ name, type }),
  });

  if (!assetResponse.ok) {
    console.error('[createAssetWithParentAsset] Erro ao criar asset:', await assetResponse.text());
    return;
  }

  const asset = await assetResponse.json();
  console.log('[createAssetWithParentAsset] Asset criado com sucesso:', asset);

  // Cria a relação com o asset pai
  const relationResponse = await fetch('/api/relation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({
      from: { entityType: 'ASSET', id: parentAssetId },
      to: { entityType: 'ASSET', id: asset.id.id },
      type: 'Contains',
      typeGroup: 'COMMON',
    }),
  });

  if (!relationResponse.ok) {
    console.error(
      '[createAssetWithParentAsset] Erro ao criar relação com asset pai:',
      await relationResponse.text()
    );
    return;
  }

  console.log('[createAssetWithParentAsset] Relação com asset pai criada com sucesso!');
  return asset;
}

// ===================== Importar Cliente já existente =====================
async function importedTree(tbCustomerId) {
  const token = localStorage['jwt_token'];
  if (!token) {
    console.warn('[importedTree] Token JWT não disponível');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${token}`,
  };

  // Modal de progresso com monitor detalhado
  const loading = document.createElement('div');
  loading.className = 'modal-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.width = '1360px'; // 4x da largura padrão (340px)
  modalContent.style.maxHeight = '510px'; // 3x da altura padrão (~170px)
  modalContent.style.display = 'flex';
  modalContent.style.flexDirection = 'column';

  const heading = document.createElement('h3');
  heading.textContent = '⏳ Importando estrutura...';
  heading.style.margin = '0 0 15px 0';
  modalContent.appendChild(heading);

  // Monitor de progresso (máximo 5 linhas)
  const progressMonitor = document.createElement('div');
  progressMonitor.id = 'importProgressMonitor';
  progressMonitor.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  progressMonitor.style.fontSize = '13px';
  progressMonitor.style.lineHeight = '1.6';
  progressMonitor.style.backgroundColor = '#F8FAFC';
  progressMonitor.style.border = '1px solid #E2E8F0';
  progressMonitor.style.borderRadius = '8px';
  progressMonitor.style.padding = '12px';
  progressMonitor.style.minHeight = '130px';
  progressMonitor.style.maxHeight = '130px'; // 5 linhas * ~26px
  progressMonitor.style.overflow = 'auto';
  progressMonitor.style.flex = '1';
  modalContent.appendChild(progressMonitor);

  loading.appendChild(modalContent);
  document.body.appendChild(loading);

  // Helper para adicionar logs ao monitor (mantém apenas últimas 5 linhas)
  const logProgress = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
    const icon = icons[type] || '•';

    const logLine = document.createElement('div');
    logLine.style.marginBottom = '4px';
    logLine.style.color = type === 'error' ? '#DC2626' : type === 'success' ? '#059669' : '#334155';
    logLine.innerHTML = `<span style="color:#64748B">${timestamp}</span> ${icon} ${message}`;

    progressMonitor.appendChild(logLine);

    // Manter apenas últimas 5 linhas
    while (progressMonitor.children.length > 5) {
      progressMonitor.removeChild(progressMonitor.firstChild);
    }

    // Auto-scroll para última linha
    progressMonitor.scrollTop = progressMonitor.scrollHeight;
  };

  logProgress('Iniciando importação da estrutura...', 'info');

  //const visited = new Set();

  const visitedEntities = new Set(); // Trocar 'visited' por algo global a qualquer entityId
  const visitedDeviceEdges = new Set(); // evita reprocessar mesma aresta device->device

  async function fetchRelations(fromId, fromType) {
    const res = await fetch(`/api/relations/info?fromId=${fromId}&fromType=${fromType}`, { headers });
    return res.ok ? await res.json() : [];
  }

  async function buildDeviceTree(deviceId) {
    if (visitedEntities.has(`DEVICE:${deviceId}`)) {
      return null; // já processado
    }
    visitedEntities.add(`DEVICE:${deviceId}`);

    const dev = await fetchEntity(deviceId, 'DEVICE');
    const node = {
      id: deviceId,
      name: dev.name,
      label: dev.label || '',
      type: dev.type || 'default',
      children: [], // devices filhos
    };

    const rels = await fetchRelations(deviceId, 'DEVICE');
    for (const rel of rels) {
      const to = rel.to;
      if (!to || to.entityType !== 'DEVICE') continue;

      const edgeKey = `${deviceId}->${to.id}`;
      if (visitedDeviceEdges.has(edgeKey)) continue;
      visitedDeviceEdges.add(edgeKey);

      // Recursão em DEVICE->DEVICE
      const child = await buildDeviceTree(to.id);
      if (child) node.children.push(child);
    }
    return node;
  }

  async function buildAssetTree(assetId) {
    if (visitedEntities.has(`ASSET:${assetId}`)) return null;
    visitedEntities.add(`ASSET:${assetId}`);

    const asset = await fetchEntity(assetId, 'ASSET');
    const assetNode = { name: asset.name, children: [], devices: [] };

    const relations = await fetchRelations(assetId, 'ASSET');

    for (const rel of relations) {
      const child = rel.to;
      if (!child) continue;

      if (child.entityType === 'ASSET') {
        const subAsset = await buildAssetTree(child.id);
        if (subAsset) assetNode.children.push(subAsset);
      } else if (child.entityType === 'DEVICE') {
        // << alteração principal: agora cada DEVICE pode ter filhos DEVICE >>
        const devTree = await buildDeviceTree(child.id);
        if (devTree) assetNode.devices.push(devTree);
      }
    }
    return assetNode;
  }

  async function buildTree(entityId, entityType) {
    if (visitedEntities.has(`${entityType}:${entityId}`)) return null;
    visitedEntities.add(`${entityType}:${entityId}`);

    const entity = await fetchEntity(entityId, entityType);
    const node = {
      name: entity.name || entity.title || `${entityType} ${entityId}`,
      gateways: [],
      assets: [],
      children: [],
    };

    const relations = await fetchRelations(entityId, entityType);
    for (const rel of relations) {
      const child = rel.to;
      if (!child) continue;

      if (child.entityType === 'CUSTOMER') {
        const childTree = await buildTree(child.id, 'CUSTOMER');
        if (childTree) node.children.push(childTree);
      } else if (child.entityType === 'ASSET') {
        const assetTree = await buildAssetTree(child.id);
        if (assetTree) node.assets.push(assetTree);
      } else if (child.entityType === 'DEVICE') {
        // Se houver DEVICE diretamente sob CUSTOMER/ASSET, tratar como “gateway” ou device raiz
        const devTree = await buildDeviceTree(child.id);
        if (devTree) node.gateways.push(devTree); // mantém compatibilidade estrutural
      }
    }
    return node;
  }

  async function fetchEntity(id, type) {
    const res = await fetch(`/api/${type.toLowerCase()}/${id}`, { headers });
    if (!res.ok) return { name: `${type} ${id}`, id };
    const data = await res.json();
    return { ...data, id };
  }

  function contarResumo(estrutura) {
    let totalCustomers = 0;
    let totalAssets = 0;
    let totalDevices = 0;
    let totalGateways = 0;

    function processNode(node) {
      totalCustomers++;

      (node.gateways || []).forEach((dev) => {
        if ((dev.type || '').toLowerCase() === 'gateway') totalGateways++;
        else totalDevices++;
      });

      (node.assets || []).forEach((asset) => {
        totalAssets++;
        (asset.devices || []).forEach((dev) => {
          if ((dev.type || '').toLowerCase() === 'gateway') totalGateways++;
          else totalDevices++;
        });
        processAssets(asset.children || []);
      });

      (node.children || []).forEach(processNode);
    }

    function processAssets(subAssets) {
      subAssets.forEach((asset) => {
        totalAssets++;
        (asset.devices || []).forEach((dev) => {
          if ((dev.type || '').toLowerCase() === 'gateway') totalGateways++;
          else totalDevices++;
        });
        processAssets(asset.children || []);
      });
    }

    estrutura.forEach(processNode);

    console.log(`📊 [contarResumo] Resumo da Estrutura Importada:`);
    console.log(`👥 [contarResumo] Clientes: ${totalCustomers}`);
    console.log(`📦 [contarResumo] Ativos: ${totalAssets}`);
    console.log(`🔌 [contarResumo] Dispositivos: ${totalDevices}`);
    console.log(`🌐 [contarResumo] Gateways: ${totalGateways}`);
    document.getElementById('information').style.display = 'block';
    self.ctx.$scope.totalCustomers = totalCustomers;
    self.ctx.$scope.totalAssets = totalAssets;
    self.ctx.$scope.totalDevices = totalDevices;
    self.ctx.$scope.totalGateways = totalGateways;
  }

  try {
    logProgress('Buscando hierarquia do cliente...', 'info');
    const root = await buildTree(tbCustomerId, 'CUSTOMER');
    if (!root) throw new Error('Cliente sem hierarquia.');

    logProgress(`Cliente encontrado: ${root.name}`, 'success');

    // 1) estrutura na memória
    window.structure = [root];
    contarResumo(window.structure);

    logProgress('Calculando resumo da estrutura...', 'info');

    // 2) já deixa o TB customerId global
    window.currentTbCustomerId = tbCustomerId;

    // 3) hidrate assets e busque attrs do CUSTOMER em paralelo
    logProgress('Carregando atributos e assets...', 'info');

    const hydratePromise = Promise.all(
      (root.assets || []).map((a, i) => hydrateAssetsRecursive(a, `structure[0].assets[${i}]`))
    );
    const attrsPromise = fetchCustomerServerScopeAttrs(tbCustomerId).catch((err) => {
      console.warn('[importedTree] Falha ao buscar attrs do CUSTOMER:', err);
      logProgress('Aviso: Attrs do cliente não encontrados', 'warning');
      return {};
    });

    const [attrs] = await Promise.all([attrsPromise, hydratePromise]);

    // 4) extraia o customerId da Ingestion (várias chaves possíveis)
    const ingestionCustomerId = attrs.customerId || null;

    // 5) salve global para uso em qualquer parte (ex.: modal Ingestion Sync)
    window.currentIngestionCustomerId = ingestionCustomerId;

    // log amigável
    if (ingestionCustomerId) {
      console.log(`[importedTree] Ingestion customerId: ${ingestionCustomerId}`);
      logProgress('Ingestion Customer ID configurado', 'success');
    } else {
      console.log('[importedTree] Ingestion customerId não encontrado no SERVER_SCOPE do CUSTOMER.');
      logProgress('Ingestion ID não encontrado', 'warning');
    }

    // 6) render UI
    logProgress('Renderizando árvore na interface...', 'info');
    window.renderTree();

    logProgress('✨ Importação concluída com sucesso!', 'success');

    // Aguardar 1.5s para usuário ver mensagem de sucesso antes de fechar
    await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch (err) {
    console.error('❌ [contarResumo] Erro ao importar estrutura:', err);
    logProgress(`Erro: ${err.message}`, 'error');

    // Aguardar 3s para usuário ler o erro antes de fechar
    await new Promise((resolve) => setTimeout(resolve, 3000));

    window.alert('❌ Erro ao importar estrutura: ' + err.message);
  } finally {
    document.body.removeChild(loading);
  }
}

async function fetchAllCustomers() {
  const token = localStorage['jwt_token']; // Seu token de autenticação
  if (!token) throw new Error('Token JWT não disponível');

  const headers = {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${token}`,
  };

  let customers = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const response = await fetch(`/api/customers?pageSize=${pageSize}&page=${page}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      throw new Error(`Erro ao buscar clientes: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    customers = customers.concat(data.data);

    if (!data.hasNext) break; // Se não tem próxima página, para o loop
    page++;
  }
  const simplified = {};
  customers.forEach((c) => {
    simplified[c.title] = { id: c.id.id, name: c.title };
  });

  return simplified;
}

// ===================== Status Sync Functions =====================

// Function to add status_sync attribute to all nodes
function addStatusSyncToStructure(structure) {
  function createStatusSync() {
    return {
      central: 'not_started',
      thingsboard: 'not_started',
      ingestion: 'not_started',
      central_log: [],
      thingsboard_log: [],
      ingestion_log: [],
    };
  }

  function addStatusSyncToNode(node) {
    if (!node.status_sync) {
      node.status_sync = createStatusSync();
    }

    // Process gateways
    if (node.gateways && Array.isArray(node.gateways)) {
      node.gateways.forEach((gateway) => {
        if (!gateway.status_sync) {
          gateway.status_sync = createStatusSync();
        }
      });
    }

    // Process assets
    if (node.assets && Array.isArray(node.assets)) {
      node.assets.forEach((asset) => addStatusSyncToAsset(asset));
    }

    // Process children (sub-customers)
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child) => addStatusSyncToNode(child));
    }
  }

  function addStatusSyncToAsset(asset) {
    if (!asset.status_sync) {
      asset.status_sync = createStatusSync();
    }

    // Process devices
    if (asset.devices && Array.isArray(asset.devices)) {
      asset.devices.forEach((device) => {
        if (!device.status_sync) {
          device.status_sync = createStatusSync();
        }
      });
    }

    // Process gateways in assets
    if (asset.gateways && Array.isArray(asset.gateways)) {
      asset.gateways.forEach((gateway) => {
        if (!gateway.status_sync) {
          gateway.status_sync = createStatusSync();
        }
      });
    }

    // Process children assets
    if (asset.children && Array.isArray(asset.children)) {
      asset.children.forEach((child) => addStatusSyncToAsset(child));
    }

    // Process subAssets
    if (asset.subAssets && Array.isArray(asset.subAssets)) {
      asset.subAssets.forEach((subAsset) => addStatusSyncToAsset(subAsset));
    }
  }

  // Apply to all root customers
  if (Array.isArray(structure)) {
    structure.forEach((customer) => addStatusSyncToNode(customer));
  }

  return structure;
}

// Function to update status and log
function updateStatusSync(node, scope, status, logMessage) {
  if (!node.status_sync) {
    node.status_sync = {
      central: 'not_started',
      thingsboard: 'not_started',
      ingestion: 'not_started',
      central_log: [],
      thingsboard_log: [],
      ingestion_log: [],
    };
  }

  // Update status
  node.status_sync[scope] = status;

  // Add log entry
  const logKey = scope + '_log';
  if (node.status_sync[logKey]) {
    node.status_sync[logKey].push({
      timestamp: tsStampBR(),
      message: logMessage,
    });
  }
}

// ===================== Importar estrutura a partir de JSON =====================
/**
 * importHierarchy(jsonInput, options)
 * - jsonInput: string JSON ou objeto já parseado (array de clientes)
 * - options:
 *    - mode: 'replace' | 'append'  (padrão: 'replace')
 *    - validate: true|false        (padrão: true)
 */
window.importHierarchy = function importHierarchy(jsonInput, options = {}) {
  const { mode = 'replace', validate = true } = options;

  // ---- parse ----
  let data;
  try {
    data = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
  } catch (e) {
    window.alert('JSON inválido: ' + e.message);
    return;
  }
  if (!Array.isArray(data)) {
    window.alert('O JSON raiz deve ser um array de clientes.');
    return;
  }

  // ---- normalização leve + validação opcional ----
  let warnings = [];

  const toStr = (v) => (v == null ? '' : String(v));

  const toInt = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };

  function ensureArray(a) {
    return Array.isArray(a) ? a : [];
  }

  function normCentralId(arr) {
    const a = ensureArray(arr).slice(0, 4).map(toInt);
    if (a.length !== 4) {
      while (a.length < 4) a.push(0);
    }
    return a;
  }

  function inferCentralDeviceType(type) {
    return String(type || '').includes('3F') ? 'three_phase_sensor' : 'outlet';
  }

  function normalizeDevice(d, path) {
    d.name = toStr(d.name);
    d.label = toStr(d.label);
    d.identifier = toStr(d.identifier || '');
    d.type = toStr(d.type || 'default');

    // Coerções e defaults
    d.addr_low = toStr(d.addr_low ?? d.central_device_id ?? '');
    d.addr_high = toStr(d.addr_high ?? '248');
    d.frequency = toStr(d.frequency ?? '90');

    // central_id como [21, XXX, YYY, ZZZ]
    d.central_id = normCentralId(d.central_id);

    // ✅ SUPORTE A DEVICE->DEVICE
    // Aceita legado "devices" dentro de device, e unifica em "children"
    d.children = ensureArray(d.children);
    const nestedLegacy = ensureArray(d.devices); // caso venha "devices" dentro de device
    if (nestedLegacy.length) {
      d.children = d.children.concat(nestedLegacy);
      delete d.devices; // opcional: evita duplicidade
    }

    // Normaliza os filhos recursivamente
    d.children.forEach((cd, i) => normalizeDevice(cd, `${path}.children[${i}]`));

    // Preenche campos derivados se faltarem
    if (!d.central_device_type) d.central_device_type = inferCentralDeviceType(d.type);
    if (!d.central_device_id) d.central_device_id = d.addr_low;

    // Validação opcional
    if (validate) {
      if (!d.name) warnings.push(`Device sem nome em ${path}`);
      if (d.central_id.length !== 4) warnings.push(`central_id inválido em ${path}`);
    }
  }

  function normalizeGateway(g, path) {
    g.name = toStr(g.name);
    g.frequency = toInt(g.frequency || 90);
    g.central_id = normCentralId(g.central_id);
    g.credentials = g.credentials || { mqtt: {} };

    if (validate && !g.name) warnings.push(`Gateway sem nome em ${path}`);
  }

  function normalizeAsset(a, path) {
    a.name = toStr(a.name);
    a.children = ensureArray(a.children);
    a.subAssets = ensureArray(a.subAssets);
    a.devices = ensureArray(a.devices);
    a.gateways = ensureArray(a.gateways);

    // ✅ compat: alguns JSONs vêm com 'assets' dentro de asset
    a.assets = ensureArray(a.assets); // <— novo
    if (a.assets.length) {
      // <— novo
      a.children = a.children.concat(a.assets); // <— novo
      a.assets = []; // <— novo
    }

    a.devices.forEach((d, i) => normalizeDevice(d, `${path}.devices[${i}]`));
    a.gateways.forEach((g, i) => normalizeGateway(g, `${path}.gateways[${i}]`));
    a.children.forEach((c, i) => normalizeAsset(c, `${path}.children[${i}]`));
    a.subAssets.forEach((s, i) => normalizeAsset(s, `${path}.subAssets[${i}]`));
  }

  function normalizeCustomer(c, idx) {
    c.name = toStr(c.name);
    c.gateways = ensureArray(c.gateways);
    c.assets = ensureArray(c.assets);
    c.children = ensureArray(c.children);

    c.gateways.forEach((g, i) => normalizeGateway(g, `[${idx}].gateways[${i}]`));
    c.assets.forEach((a, i) => normalizeAsset(a, `[${idx}].assets[${i}]`));
    c.children.forEach((ch, i) => normalizeCustomer(ch, `${idx} > child[${i}]`));

    if (validate && !c.name) warnings.push(`Cliente sem nome em [${idx}]`);
  }

  data.forEach((c, i) => normalizeCustomer(c, i));

  // ---- aplica na estrutura atual ----
  if (mode === 'replace') {
    window.structure = data;
  } else {
    window.structure = Array.isArray(window.structure) ? window.structure : [];
    window.structure.push(...data);
  }

  // ---- (opcional) recalcula resumo e mostra o botão ℹ️ ----
  try {
    let totalCustomers = 0,
      totalAssets = 0,
      totalDevices = 0,
      totalGateways = 0;

    const walkAsset = (a) => {
      totalAssets++;
      (a.devices || []).forEach(() => totalDevices++);
      (a.gateways || []).forEach(() => totalGateways++);
      (a.children || []).forEach(walkAsset);
      (a.subAssets || []).forEach(walkAsset);
    };

    const walkCustomer = (c) => {
      totalCustomers++;
      (c.gateways || []).forEach(() => totalGateways++);
      (c.assets || []).forEach(walkAsset);
      (c.children || []).forEach(walkCustomer);
    };

    (window.structure || []).forEach(walkCustomer);

    // expõe no escopo do widget (se existir)
    if (self?.ctx?.$scope) {
      self.ctx.$scope.totalCustomers = totalCustomers;
      self.ctx.$scope.totalAssets = totalAssets;
      self.ctx.$scope.totalDevices = totalDevices;
      self.ctx.$scope.totalGateways = totalGateways;
    }
    const infoBtn = document.getElementById('information');
    if (infoBtn) infoBtn.style.display = 'inline-flex';
  } catch (_) {}

  // ---- re-render ----
  if (typeof window.renderTree === 'function') {
    window.renderTree();
  }

  // ---- feedback de validação ----
  if (warnings.length) {
    console.warn('[importHierarchy] Import concluído com avisos:\n- ' + warnings.join('\n- '));
  } else {
    console.info('[importHierarchy] Import concluído sem avisos.');
  }
};

// function normalizeHydrometer(str = '') {
//   return String(str)
//     .normalize('NFD')
//     .replace(/[\u0300-\u036f]/g, '')
//     .toLowerCase();
// }

// Regra solicitada: se o nome contém "hidr." (case-insensitive)
// function isHydrometerName(name = '') {
//   const n = normalizeHydrometer(name);
//   return n.includes('hidr.');
// }

// ==============================================
// Modal Handler: Ingestion Sync
// ==============================================
function handleIngestionSyncModal(modal) {
  // esqueleto inicial enquanto buscamos dados
  // 1) garante o backdrop ocupar a tela e centralizar o conteúdo
  Object.assign(modal.style, {
    position: 'fixed',
    inset: '0',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: 'rgba(16,24,40,.45)', // backdrop
    zIndex: 9999,
  });

  // esqueleto inicial enquanto buscamos dados
  modal.innerHTML = `
    <div class="modal-content"
         style="
           width: min(96vw, 1800px);   /* 💡 bem larga e responsiva */
           max-width: none;            /* remove o limite */
           background: #fff;
           border-radius: 14px;
           padding: 20px 22px;
           box-shadow: 0 24px 64px rgba(0,0,0,.18);
         ">
      <h3>🔄 Ingestion Sync</h3>
      <p class="muted">Sincroniza devices desta árvore com a Ingestion API e grava <code>ingestionId</code> em <b>SERVER_SCOPE</b> no ThingsBoard.</p>

      <div id="ing-body">
        <style>
          /* grid fica mais ampla quando houver espaço */
          .form-grid{
            display:grid;
            gap:12px;
            grid-template-columns: repeat(2, minmax(0,1fr));
          }
          @media (min-width:1200px){
            .form-grid{ grid-template-columns: repeat(3, minmax(0,1fr)); }
          }
          .modal-actions{ display:flex; flex-wrap:wrap; }
          .modal-content h3{ margin: 4px 0 8px; }
          .modal-content .muted{ color:#6b7a90; margin-bottom:12px; }
        </style>

        <div class="form-grid">
          <label>Customer ID (Ingestion)
            <input id="ing-customerId" type="text" placeholder="uuid..." required>
          </label>
          <label>JWT (Ingestion API)
            <div style="display:flex; gap:6px; align-items:center;">
              <input id="ing-token" type="password" placeholder="••••••••••••" readonly style="flex:1;">
              <button id="ing-toggle" class="btn btn-ghost" title="Mostrar/ocultar token"><i>👁️</i></button>
            </div>
          </label>
          <label>Central ID (opcional)
            <div style="display:flex; gap:6px; align-items:center;">
              <input id="ing-centralId" type="text" placeholder="uuid... (deixe vazio para usar atributo do device)" style="flex:1;">
              <select id="ing-centralMode" style="width:auto; padding:8px;">
                <option value="none">Usar atributo</option>
                <option value="fallback">Fallback</option>
                <option value="force">Forçar</option>
              </select>
            </div>
            <small style="color:#6b7a90; font-size:12px; margin-top:4px; display:block;">
              <b>Usar atributo:</b> lê centralId/centralID do device<br>
              <b>Fallback:</b> usa este valor se device não tiver centralId<br>
              <b>Forçar:</b> ignora atributo do device e sempre usa este valor
            </small>
          </label>
          <label>Central Name (opcional)
            <div style="display:flex; gap:6px; align-items:center;">
              <input id="ing-centralName" type="text" placeholder="Nome da central... (deixe vazio para usar derivado)" style="flex:1;">
              <select id="ing-centralNameMode" style="width:auto; padding:8px;">
                <option value="none">Usar derivado</option>
                <option value="fallback">Fallback</option>
                <option value="force">Forçar</option>
              </select>
            </div>
            <small style="color:#6b7a90; font-size:12px; margin-top:4px; display:block;">
              <b>Usar derivado:</b> deriva do grandparent do device<br>
              <b>Fallback:</b> usa este valor se derivação falhar<br>
              <b>Forçar:</b> ignora derivação e sempre usa este valor
            </small>
          </label>
        </div>

        <div class="modal-actions" style="gap:8px; margin-bottom:10px;">
          <button id="ing-run" class="btn btn-primary"><i>🚀</i> Sync agora (API)</button>
          <button id="ing-close" class="btn btn-ghost"><i>✖</i> Fechar</button>
        </div>

        <div class="divider" style="margin:8px 0; opacity:.6;">ou</div>

        <div class="form-grid">
          <label>Sync by File (JSON de retorno da API)
            <input id="ing-file" type="file" accept="application/json">
          </label>
        </div>
        <div class="modal-actions" style="gap:8px">
          <button id="ing-run-file" class="btn"><i>📄</i> Sync por Arquivo</button>
        </div>

        <pre id="ing-log"
             style="
               max-height: 48vh;       /* 💡 aumentado em 20% (40vh -> 48vh) */
               overflow: auto;
               background:#f8f9fb;
               padding:10px;
               border-radius:8px;
               margin-top:10px"></pre>

        <div class="modal-actions" style="gap:8px; justify-content:flex-end; margin-top:6px;">
          <button id="ing-clear" class="btn btn-ghost" title="Limpar log">
            <i>🧹</i> Limpar Log
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // garante o limiter mesmo que a definição global ainda não exista
  // --- Garantir helpers globais: salvar atributo + limiter --------------------
  if (typeof window.saveIngestionIdAttribute !== 'function') {
    // Shim para ThingsBoard SERVER_SCOPE
    window.saveIngestionIdAttribute = async function (entityId, entityType, value, attributeName) {
      const token = localStorage.getItem('jwt_token');
      if (!token) throw new Error('JWT do ThingsBoard não encontrado (localStorage.jwt_token).');
      const headers = {
        'Content-Type': 'application/json',
        'X-Authorization': 'Bearer ' + token,
      };
      const body = {};
      body[attributeName] = value;

      const res = await fetch(`/api/plugins/telemetry/${entityType}/${entityId}/attributes/SERVER_SCOPE`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha ao salvar attr (HTTP ${res.status}) ${txt}`);
      }
    };
  }

  if (typeof window.saveIngestionAttrLimited !== 'function') {
    window.saveIngestionAttrLimited = createLimiter(
      (deviceId, attrName, value) => window.saveIngestionIdAttribute(deviceId, 'DEVICE', value, attrName),
      8
    );
  }

  const $file = modal.querySelector('#ing-file');
  const $runFile = modal.querySelector('#ing-run-file');

  // Botão Sync por Arquivo
  $runFile.onclick = async () => {
    const f = $file.files && $file.files[0];
    if (!f) {
      window.alert('Selecione um arquivo JSON (retorno da API).');
      $file.click();
      return;
    }

    try {
      $runFile.disabled = true;
      const old = $runFile.innerHTML;
      $runFile.innerHTML = `<i>⏳</i> Processando arquivo...`;

      const txt = await f.text();
      let parsed;
      try {
        parsed = JSON.parse(txt);
      } catch (e) {
        throw new Error('Arquivo não é um JSON válido.');
      }

      const list = normalizeIngestionListFromJson(parsed);
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('JSON não contém lista de devices (esperado: { data: [...] } ou [...]).');
      }

      await runIngestionSyncFromList(list);
      logIngestion('✅ Sync (arquivo) finalizado.');
      $runFile.innerHTML = old;
    } catch (err) {
      console.error(err);
      logIngestion(`❌ Erro no Sync por Arquivo: ${err.message || err}`);
    } finally {
      $runFile.disabled = false;
    }
  };

  const $cid = modal.querySelector('#ing-customerId');
  const $tok = modal.querySelector('#ing-token');
  const $eye = modal.querySelector('#ing-toggle');
  const $run = modal.querySelector('#ing-run');
  const $close = modal.querySelector('#ing-close');
  const $clear = modal.querySelector('#ing-clear');
  const $centralId = modal.querySelector('#ing-centralId');
  const $centralMode = modal.querySelector('#ing-centralMode');
  const $centralName = modal.querySelector('#ing-centralName');
  const $centralNameMode = modal.querySelector('#ing-centralNameMode');

  $clear.onclick = () => {
    const el = modal.querySelector('#ing-log');
    if (el) {
      el.textContent = '';
      el.scrollTop = 0;
    }
  };

  // Fechar
  $close.onclick = () => modal.remove();

  // Mostrar/ocultar token
  $eye.onclick = (e) => {
    e.preventDefault();
    const show = $tok.type === 'password';
    $tok.type = show ? 'text' : 'password';
    $eye.innerHTML = show ? '<i>🙈</i>' : '<i>👁️</i>';
  };

  // Enter envia
  modal.addEventListener('keydown', (e) => {
    const target = e.target;
    if (e.key === 'Enter' && !e.shiftKey && !(target && target.id === 'ing-file')) {
      e.preventDefault();
      $run.click();
    }
  });

  function logIngestion(msg) {
    const el = modal.querySelector('#ing-log');
    if (el) {
      el.textContent += (el.textContent ? '\n' : '') + msg;
      el.scrollTop = el.scrollHeight;
    } else {
      console.log('[IngestionSync]', msg);
    }
  }

  // ✅ Versão correta usando GET com query params e paginação
  // ================= Ingestion API =================
  // const ING_API_BASE = 'https://api.data.apps.myio-bas.com/api/v1/management';

  // GET /devices com querystring + paginação
  // async function fetchIngestionDevicesAll(customerId, jwt, opts = {}) {
  //   if (!jwt) throw new Error('JWT da Ingestion API ausente.');
  //   if (!customerId) throw new Error('customerId ausente.');

  //   const {
  //     limit = 200,
  //     includeInactive = false,
  //     gatewayId,
  //     assetId,
  //     deviceType,
  //     search,
  //     sortBy = 'name',
  //     sortOrder = 'asc',
  //   } = opts;

  //   let page = 1;
  //   const out = [];

  //   while (true) {
  //     const qs = new URLSearchParams();
  //     qs.set('customerId', customerId);
  //     if (search) qs.set('search', search);
  //     if (gatewayId) qs.set('gatewayId', gatewayId);
  //     if (assetId) qs.set('assetId', assetId);
  //     if (deviceType) qs.set('deviceType', deviceType);

  //     // zod no backend provavelmente usa coerce => envie strings
  //     qs.set('includeInactive', includeInactive ? 'true' : 'false');
  //     qs.set('page', String(page));
  //     qs.set('limit', String(limit));
  //     qs.set('sortBy', sortBy);
  //     qs.set('sortOrder', sortOrder);

  //     const url = `${ING_API_BASE}/devices?${qs.toString()}`;
  //     const res = await fetch(url, {
  //       method: 'GET',
  //       headers: { Authorization: `Bearer ${jwt}` }, // sem Content-Type
  //     });

  //     if (!res.ok) {
  //       const txt = await res.text().catch(() => '');
  //       throw new Error(`Ingestion API falhou (HTTP ${res.status}) ${txt}`);
  //     }

  //     const json = await res.json();
  //     const data = Array.isArray(json?.data) ? json.data : [];
  //     out.push(...data);

  //     const pages =
  //       json?.pagination?.pages ??
  //       (json?.pagination?.total && json?.pagination?.limit
  //         ? Math.ceil(json.pagination.total / json.pagination.limit)
  //         : 1);

  //     if (page >= pages) break;
  //     page++;
  //   }

  //   return out;
  // }

  // Converte o conteúdo lido do arquivo em uma lista de devices de ingestion.
  // Aceita:
  //  - Objeto único: { data: [...], pagination: {...} }
  //  - Array de páginas: [{ data: [...] }, { data: [...] }, ...]
  //  - Array direto de devices: [{...}, {...}]
  function normalizeIngestionListFromJson(json) {
    if (!json) return [];
    if (Array.isArray(json)) {
      if (json.length && typeof json[0] === 'object' && Array.isArray(json[0]?.data)) {
        return json.flatMap((p) => p?.data || []);
      }
      return json;
    }
    if (Array.isArray(json?.data)) return json.data;
    return [];
  }

  // ---- config knobs ----
  const ATTR_WRITE_CONCURRENCY = 5; // parallel TB writes
  const ATTR_WRITE_RETRY = 3; // retries per device
  const ATTR_WRITE_BACKOFF_MS = 400; // base backoff

  // ---- tiny limiter (no deps) ----
  function createLimiterInternal(max) {
    const queue = [];
    let active = 0;

    const next = () => {
      if (!queue.length || active >= max) return;
      const { fn, resolve, reject } = queue.shift();
      active++;
      Promise.resolve()
        .then(fn)
        .then((res) => resolve(res))
        .catch((err) => reject(err))
        .finally(() => {
          active--;
          next();
        });
    };

    return function limit(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
    };
  }

  // ---- Cache simples por deviceId para evitar chamadas repetidas ----
  const _deviceServerScopeCache = new Map();

  // Limite de concorrência de fetch de attrs
  const limitFetchAttrs = createLimiterInternal(10);

  // TB GET SERVER_SCOPE de DEVICE
  async function fetchDeviceServerScopeAttrs(tbDeviceId) {
    const tbToken = localStorage.getItem('jwt_token');
    if (!tbDeviceId) return {};
    if (_deviceServerScopeCache.has(tbDeviceId)) return _deviceServerScopeCache.get(tbDeviceId);

    const url = `/api/plugins/telemetry/DEVICE/${encodeURIComponent(
      tbDeviceId
    )}/values/attributes/SERVER_SCOPE`;
    const doFetch = async () => {
      const res = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${tbToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`[fetchDeviceServerScopeAttrs] HTTP ${res.status} ${res.statusText} ${text}`);
        return {};
      }
      const payload = await res.json();

      // Pode vir como array [{key,value}] ou objeto { key: [{value}] }
      const raw = {};
      if (Array.isArray(payload)) {
        for (const it of payload) raw[it.key] = it.value;
      } else if (payload && typeof payload === 'object') {
        for (const k of Object.keys(payload)) {
          const v = payload[k];
          raw[k] = Array.isArray(v) && v.length ? v[0]?.value ?? v[0] : v;
        }
      }
      return raw;
    };

    const attrs = await limitFetchAttrs(doFetch);
    _deviceServerScopeCache.set(tbDeviceId, attrs);
    return attrs;
  }

  // Normaliza chaves e extrai centralId/slaveId com tolerância a variações
  function resolveCentralAndSlave(attrs = {}, fallback = {}) {
    // junta atributos do device (server) com possíveis props já existentes
    const merged = { ...fallback, ...attrs };

    // cria um mapa case-insensitive/underscore-insensitive
    const byNorm = {};
    for (const [k, v] of Object.entries(merged)) {
      const norm = String(k)
        .toLowerCase()
        .replace(/[_\s-]/g, '');
      byNorm[norm] = v;
    }

    // aliases comuns
    const centralId =
      byNorm['centralid'] ??
      byNorm['central_id'] ??
      byNorm['central'] ??
      byNorm['gatewayid'] ?? // às vezes usam gatewayId como central
      null;

    const slaveId =
      byNorm['slaveid'] ??
      byNorm['slave_id'] ??
      byNorm['id_slave'] ??
      byNorm['channel'] ?? // às vezes o "canal" vem como slave
      null;

    return {
      centralId: centralId != null ? String(centralId).trim() : '',
      slaveId: slaveId != null ? String(slaveId).trim() : '',
    };
  }

  const limitWrite = createLimiterInternal(ATTR_WRITE_CONCURRENCY);

  // ---- low-level TB call ----
  async function writeServerScopeAttributes(deviceId, attrs) {
    const tbToken = localStorage.getItem('jwt_token');
    const url = `/api/plugins/telemetry/DEVICE/${encodeURIComponent(
      deviceId
    )}/attributes/SERVER_SCOPE`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Authorization': `Bearer ${tbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attrs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[writeServerScopeAttributes] ${res.status} ${res.statusText} ${text}`);
    }
  }

  // ---- retry + rate limit wrapper ----
  async function writeServerScopeAttributesLimited(deviceId, attrs) {
    for (let attempt = 1; attempt <= ATTR_WRITE_RETRY; attempt++) {
      try {
        return await limitWrite(() => writeServerScopeAttributes(deviceId, attrs));
      } catch (err) {
        const sleep = ATTR_WRITE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[ingestionSync] write attempt ${attempt} failed for TB:${deviceId}. Retrying in ${sleep}ms. Reason: ${err.message}`
        );
        if (attempt === ATTR_WRITE_RETRY) throw err;
        await new Promise((r) => setTimeout(r, sleep));
      }
    }
  }

  // async function fetchAllIngestionPages({ dataApiBaseUrl, token, customerId, limit = 200 }) {
  //   const pages = [];
  //   let totalDevices = 0;

  //   console.info(`[fetchAllIngestionPages] Starting pagination for customerId=${customerId}, limit=${limit}`);

  //   for (let page = 1; ; page++) {
  //     const url =
  //       `${dataApiBaseUrl}/api/v1/management/devices` +
  //       `?page=${page}&limit=${limit}&customerId=${encodeURIComponent(customerId)}` +
  //       `&includeInactive=true&sortBy=name&sortOrder=asc`;

  //     console.info(`[fetchAllIngestionPages] Fetching page ${page}...`);
  //     const res = await fetch(url, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     if (!res.ok) throw new Error(`[fetchIngestionPage] ${res.status} ${res.statusText}`);

  //     const json = await res.json();
  //     const pageDevices = json.data?.length || 0;
  //     totalDevices += pageDevices;

  //     console.info(
  //       `[fetchAllIngestionPages] Page ${page}: ${pageDevices} devices (total so far: ${totalDevices})`
  //     );
  //     pages.push(json);

  //     // Stop when we get fewer devices than the limit (last page)
  //     if (!json.data || json.data.length < limit) {
  //       console.info(
  //         `[fetchAllIngestionPages] Completed pagination: ${pages.length} pages, ${totalDevices} total devices`
  //       );
  //       break;
  //     }

  //     // Safety check to prevent infinite loops (adjust as needed for your max expected devices)
  //     if (page > 50) {
  //       console.warn(`[fetchAllIngestionPages] Safety break at page ${page} - check pagination logic`);
  //       break;
  //     }
  //   }

  //   return pages;
  // }

  async function maybePersistAttributes(tbDevice, ingestionRec, { dryRun = false } = {}) {
    const desired = {
      ingestionId: ingestionRec.id,
      ingestionGatewayId: ingestionRec?.gateway?.id || ingestionRec.gatewayId,
      ingestionDeviceType: ingestionRec.deviceType,
    };

    // Optional: avoid write if values already equal
    const current = tbDevice?.serverAttributes || {};
    const unchanged =
      current.ingestionId === desired.ingestionId &&
      current.ingestionGatewayId === desired.ingestionGatewayId &&
      current.ingestionDeviceType === desired.ingestionDeviceType;

    if (unchanged) {
      console.info(
        `[ingestionSync] up-to-date TB:${tbDevice.id} (${tbDevice.name}) -> ${desired.ingestionId}`
      );
      return { wrote: false, skipped: 'already up-to-date' };
    }

    if (dryRun) {
      console.info(`[ingestionSync][dry-run] would write TB:${tbDevice.id} (${tbDevice.name}) ->`, desired);
      return { wrote: false, skipped: 'dry-run' };
    }

    await writeServerScopeAttributesLimited(tbDevice.id, desired);
    console.info(`[ingestionSync] wrote TB:${tbDevice.id} (${tbDevice.name}) -> ${desired.ingestionId}`);
    return { wrote: true };
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function processOneDeviceEnrichment(device) {
    console.debug(`[enrich] Fetch SERVER_SCOPE -> "${device.name}" (TB:${device.id})`);
    const server = await fetchDeviceServerScopeAttrs(device.id);
    console.debug(`[enrich] SERVER_SCOPE raw -> "${device.name}":`, server);

    device.attributes = device.attributes && typeof device.attributes === 'object' ? device.attributes : {};

    const { centralId, slaveId } = resolveCentralAndSlave(server, device.attributes);
    console.debug(
      `[enrich] Resolved -> "${device.name}" (TB:${device.id}): centralId="${centralId}", slaveId="${slaveId}"`
    );

    if (centralId) {
      device.attributes.centralId = centralId;
      console.debug(`[enrich] Set centralId="${centralId}" on "${device.name}"`);
    }
    if (slaveId) {
      device.attributes.slaveId = slaveId;
      console.debug(`[enrich] Set slaveId="${slaveId}" on "${device.name}"`);
    }
  }

  async function enrichAllDevicesWithServerAttrs(
    toProcess,
    {
      concurrency = 5, // <= ajuste aqui (1 = totalmente sequencial)
      pauseMsBetweenBatches = 100, // pausa entre lotes para "respirar"
      progressEvery = 25, // loga progresso a cada N devices
    } = {}
  ) {
    const total = toProcess.length;
    let ok = 0,
      fail = 0;

    console.info(
      `[enrichAllDevicesWithServerAttrs] Iniciando enriquecimento de ${total} devices com concurrency=${concurrency}...`
    );

    // processa em chunks de 'concurrency'
    for (let start = 0; start < total; start += concurrency) {
      const end = Math.min(start + concurrency, total);
      const batch = toProcess.slice(start, end);

      const results = await Promise.allSettled(
        batch.map(async ({ device }, idx) => {
          const ordinal = start + idx + 1;
          try {
            await processOneDeviceEnrichment(device);
            ok++;
            if (ok % progressEvery === 0 || ordinal === total) {
              console.info(`[enrich] Progresso: ${ordinal}/${total} (ok=${ok}, fail=${fail})`);
            }
          } catch (e) {
            fail++;
            console.warn(`[enrich] ❌ "${device?.name}" (TB:${device?.id}) -> ${e.message || e}`);
          }
        })
      );

      // (Opcional) Log por lote:
      const batchOk = results.filter((r) => r.status === 'fulfilled').length;
      const batchFail = results.length - batchOk;
      console.debug(`[enrich] Lote ${Math.floor(start / concurrency) + 1}: ok=${batchOk}, fail=${batchFail}`);

      if (pauseMsBetweenBatches > 0 && end < total) {
        await sleep(pauseMsBetweenBatches);
      }
    }

    console.info(
      `[enrichAllDevicesWithServerAttrs] ✅ Concluído. Enriquecidos=${ok}, Falhas=${fail}, Total=${total}`
    );
  }

  // Executa o mesmo fluxo do Sync, mas usando uma lista já carregada (arquivo)
  async function runIngestionSyncFromList(ingestionList) {
    logIngestion(`➡️ Processando lista local: ${ingestionList.length} registros (arquivo).`);
    const pages = [{ data: ingestionList }];
    const ingestionIndex = buildIngestionIndex(pages);

    const roots = Array.isArray(window.structure) ? window.structure : [];
    if (!roots.length) {
      logIngestion('⚠️ Nenhuma árvore carregada em memória (window.structure vazia).');
      return;
    }

    const toProcess = [];
    roots.forEach((root, ri) => {
      (root.assets || []).forEach((a, ai) =>
        collectAllDevicesFromAsset(a, toProcess, `structure[${ri}].assets[${ai}]`)
      );
    });
    logIngestion(`➡️ Varredura local encontrou ${toProcess.length} devices na árvore.`);

    // ⬇️⬇️ ENRIQUECE ANTES DE MATCH ⬇️⬇️
    await enrichAllDevicesWithServerAttrs(toProcess, {
      concurrency: 4,
      pauseMsBetweenBatches: 150,
      progressEvery: 20,
    });

    // ⬇️⬇️ RFC-0071: SYNC DEVICE PROFILES ⬇️⬇️
    await syncDeviceProfileAttributes(toProcess);

    let bound = 0,
      skipped = 0,
      errors = 0;
    for (const { device: tb } of toProcess) {
      try {
        const { rec, reason } = matchIngestionRecord(tb, ingestionIndex);

        if (!rec) {
          logIngestion(`- ❓ NO MATCH: "${tb.name}" (TB:${tb.id}) -> ${reason}`);
          skipped++;
          continue;
        }

        const { wrote } = await maybePersistAttributes(tb, rec, { dryRun: false });

        if (wrote) {
          bound++;
          logIngestion(`- ✅ SAVED: "${tb.name}" (TB:${tb.id}) <= ingestionId=${rec.id} [via ${reason}]`);
        } else {
          skipped++;
          logIngestion(`- 🔸 SKIP: "${tb.name}" (TB:${tb.id}) already up-to-date`);
        }
      } catch (err) {
        console.error(`[ingestionSync:file] ERROR ${tb.name}: ${err.message}`);
        logIngestion(`- ❌ SAVE ERR: "${tb.name}" (TB:${tb.id}) => ${err.message || err}`);
        errors++;
      }
    }

    logIngestion(
      `\n📊 Resultado (arquivo): bound=${bound}, skipped=${skipped}, errors=${errors}, indexed=${ingestionIndex.size}`
    );
  }

  // Indexa retorno da ingestion para match rápido (RFC-compliant strict matching)
  function buildIngestionIndex(pagedResponseArray) {
    // Map<"centralId#slaveId", ingestionDeviceObject>
    const ingestionIndexByCentralSlave = new Map();

    for (const page of pagedResponseArray) {
      for (const d of page.data || []) {
        // Only energy/water
        if (d.deviceType !== 'energy' && d.deviceType !== 'water') continue;

        const centralId = String(d?.gateway?.id || d?.gatewayId || '').trim();
        const slaveId = String(d?.slaveId ?? '').trim();

        if (!centralId || !slaveId) {
          console.warn(
            `[buildIngestionIndex] skipping device without centralId/slaveId: id=${d.id}, gw=${
              d?.gateway?.id || d.gatewayId
            }, slave=${d.slaveId}`
          );
          continue;
        }

        const key = `${centralId}#${slaveId}`;
        // last-write-wins is fine; log duplicates to detect anomalies
        if (ingestionIndexByCentralSlave.has(key)) {
          console.warn(
            `[buildIngestionIndex] duplicate key ${key} — overwriting previous entry with id=${d.id}`
          );
        }

        ingestionIndexByCentralSlave.set(key, d);
      }
    }

    console.info(`[buildIngestionIndex] indexed ${ingestionIndexByCentralSlave.size} energy/water devices`);
    return ingestionIndexByCentralSlave;
  }

  function collectAllDevicesFromDevice(dev, out, basePath) {
    const kids = dev.devices || dev.children || [];

    for (let i = 0; i < kids.length; i++) {
      const cd = kids[i];
      out.push({ device: cd, path: `${basePath}.devices[${i}]` });
      collectAllDevicesFromDevice(cd, out, `${basePath}.devices[${i}]`);
    }
  }

  // Varredura da árvore atual para coletar todos os devices (inclui device->devices)
  function collectAllDevicesFromAsset(asset, out, basePath) {
    const path = basePath || '';
    for (let i = 0; i < (asset.devices || []).length; i++) {
      const d = asset.devices[i];
      out.push({ device: d, path: `${path}.devices[${i}]` });
      collectAllDevicesFromDevice(d, out, `${path}.devices[${i}]`);
    }
    for (let i = 0; i < (asset.children || []).length; i++) {
      const a = asset.children[i];
      collectAllDevicesFromAsset(a, out, `${path}.children[${i}]`);
    }
    for (let i = 0; i < (asset.subAssets || []).length; i++) {
      const a = asset.subAssets[i];
      collectAllDevicesFromAsset(a, out, `${path}.subAssets[${i}]`);
    }
  }

  // 🔒 RFC-compliant strict matching by centralId + slaveId
  function matchIngestionRecord(tbDevice, ingestionIndexByCentralSlave) {
    console.log('[matchIngestionRecord] matching TB device:', tbDevice);

    const tbCentralId = String(tbDevice?.attributes?.centralId ?? '').trim();
    const tbSlaveId = String(tbDevice?.attributes?.slaveId ?? '').trim();

    if (!tbCentralId || !tbSlaveId) {
      return { rec: null, reason: 'missing centralId or slaveId on TB device' };
    }

    const key = `${tbCentralId}#${tbSlaveId}`;
    const rec = ingestionIndexByCentralSlave.get(key);
    if (!rec) return { rec: null, reason: `no ingestion match for key=${key}` };

    return { rec, reason: 'centralId+slaveId' };
  }

  // GET one page from Ingestion API
  async function fetchIngestionDevicesPage({
    baseUrl,
    token,
    customerId,
    page,
    limit,
    includeInactive,
    sortBy,
    sortOrder,
  }) {
    console.info(
      `[fetchIngestionDevicesPage] Fetching page ${page} for customerId=${customerId}, limit=${limit}`
    );
    console.info(
      `[fetchIngestionDevicesPage] URL params: includeInactive=${includeInactive}, sortBy=${sortBy}, sortOrder=${sortOrder}`
    );
    console.info(
      `[fetchIngestionDevicesPage] Full URL: ${baseUrl}/management/devices?page=${page}&limit=${limit}&customerId=${encodeURIComponent(
        customerId
      )}&includeInactive=${includeInactive}&sortBy=${sortBy}&sortOrder=${sortOrder}`
    );

    const url =
      `${baseUrl}/management/devices` +
      `?page=${page}` +
      `&limit=${limit}` +
      `&customerId=${encodeURIComponent(customerId)}` +
      `&includeInactive=${includeInactive ? 'true' : 'false'}` +
      `&sortBy=${encodeURIComponent(sortBy || 'name')}` +
      `&sortOrder=${encodeURIComponent(sortOrder || 'asc')}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`[fetchIngestionDevicesPage] ${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
  }

  // Iterate pages until pagination.pages
  async function fetchIngestionDevicesAllPaged({
    baseUrl,
    token,
    customerId,
    limit = 100,
    includeInactive = false,
    sortBy = 'name',
    sortOrder = 'asc',
  }) {
    const pages = [];
    // First page to learn total pages
    console.log(
      `[fetchIngestionDevicesAllPaged] Starting paged fetch for customerId=${customerId}, limit=${limit}`
    );
    console.log(`[fetchIngestionDevicesAllPaged] Fetching first page to determine total pages...`);
    console.log(
      `[fetchIngestionDevicesAllPaged] Full URL: ${baseUrl}/management/devices?page=1&limit=${limit}&customerId=${encodeURIComponent(
        customerId
      )}&includeInactive=${includeInactive}&sortBy=${sortBy}&sortOrder=${sortOrder}`
    );

    const first = await fetchIngestionDevicesPage({
      baseUrl,
      token,
      customerId,
      page: 1,
      limit,
      includeInactive,
      sortBy,
      sortOrder,
    });
    pages.push(first);

    const totalPages = Number(first?.pagination?.pages || 1);

    for (let p = 2; p <= totalPages; p++) {
      const next = await fetchIngestionDevicesPage({
        baseUrl,
        token,
        customerId,
        page: p,
        limit,
        includeInactive,
        sortBy,
        sortOrder,
      });
      pages.push(next);
    }

    return pages;
  }

  function safeValue(val, fallback) {
    return val ?? fallback;
  }

  function buildAttrs(rec, centralName, identifier) {
    if (!rec || typeof rec !== 'object') {
      console.warn('[buildAttrs] Registro inválido:', rec);

      return {
        ingestionId: -1,
        ingestionGatewayId: null,
        ingestionDeviceType: null,
        centralName: 'Sem central identificada',
        identifier: 'Sem Identificador',
      };
    }

    return {
      ingestionId: safeValue(rec.id, -1),
      ingestionGatewayId: safeValue(rec?.gateway?.id, rec?.gatewayId ?? 'Sem Gateway'),
      ingestionDeviceType: safeValue(rec.deviceType, 'Tipo não definido'),
      centralName: safeValue(centralName, 'Sem central identificada'),
      identifier: safeValue(identifier, 'Sem Identificador'),
    };
  }

  // ============================================
  // RFC-0071: DEVICE PROFILE SYNC FUNCTIONS
  // Copied from TELEMETRY widget and adapted for Pre-Setup-Constructor
  // ============================================

  /**
   * Fetches all device profiles from ThingsBoard
   * @param {string} tbToken - ThingsBoard JWT token
   * @returns {Promise<Map<string, string>>} Map of profileId -> profileName
   */
  async function fetchDeviceProfiles() {
    const tbToken = localStorage.getItem('jwt_token');
    if (!tbToken) throw new Error('[RFC-0071] JWT token not provided');

    const url = '/api/deviceProfile/names?activeOnly=true';

    logIngestion('[RFC-0071] Fetching device profiles...');

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${tbToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
    }

    const profiles = await response.json();

    // Build Map: profileId -> profileName
    const profileMap = new Map();
    profiles.forEach((profile) => {
      const profileId = profile.id.id;
      const profileName = profile.name;
      profileMap.set(profileId, profileName);
    });

    logIngestion(
      `[RFC-0071] Loaded ${profileMap.size} device profiles: ${Array.from(profileMap.values()).join(', ')}`
    );

    return profileMap;
  }

  /**
   * Fetches device details including deviceProfileId
   * @param {string} deviceId - Device entity ID
   * @returns {Promise<Object>}
   */
  async function fetchDeviceDetails(deviceId) {
    const tbToken = localStorage.getItem('jwt_token');
    if (!tbToken) throw new Error('[RFC-0071] JWT token not provided');

    const url = `/api/device/${deviceId}`;

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${tbToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Saves deviceProfile as a server-scope attribute on the device
   * @param {string} deviceId - Device entity ID
   * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
   * @returns {Promise<{ok: boolean, status: number, data: any}>}
   */
  async function addDeviceProfileAttribute(deviceId, deviceProfile) {
    const tbToken = localStorage.getItem('jwt_token');
    const t = Date.now();

    try {
      if (!deviceId) throw new Error('deviceId is required');
      if (deviceProfile == null || deviceProfile === '') {
        throw new Error('deviceProfile is required');
      }
      if (!tbToken) throw new Error('tbToken is required');

      const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${tbToken}`,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deviceProfile }),
      });

      const bodyText = await res.text().catch(() => '');

      if (!res.ok) {
        throw new Error(`[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
      }

      let data = null;
      try {
        data = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        // Response may not be JSON
      }

      const dt = Date.now() - t;
      logIngestion(`[RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`);

      return { ok: true, status: res.status, data };
    } catch (err) {
      const dt = Date.now() - t;
      logIngestion(
        `[RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${
          err?.message || err
        }`
      );
      throw err;
    }
  }

  /**
   * Synchronizes deviceProfile attributes for devices that don't have them
   * @param {Array} devices - Array of device objects from window.structure
   * @returns {Promise<{synced: number, skipped: number, errors: number}>}
   */
  async function syncDeviceProfileAttributes(devices) {
    const tbToken = localStorage.getItem('jwt_token');
    logIngestion('[RFC-0071] 🔄 Starting device profile synchronization...');

    try {
      // Step 1: Fetch all device profiles
      const profileMap = await fetchDeviceProfiles();

      let synced = 0;
      let skipped = 0;
      let errors = 0;

      // Step 2: Filter devices that need sync (no deviceProfile attribute)
      const devicesToSync = devices.filter((d) => {
        const hasProfile = d.serverAttrs?.deviceProfile || d.deviceProfile;
        if (hasProfile) {
          skipped++;
          return false;
        }
        return true;
      });

      logIngestion(`[RFC-0071] Found ${devicesToSync.length} devices without deviceProfile attribute`);
      logIngestion(`[RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

      if (devicesToSync.length === 0) {
        logIngestion('[RFC-0071] ✅ All devices already synchronized!');
        return { synced: 0, skipped, errors: 0 };
      }

      // Step 3: Process each device
      let processed = 0;
      for (const device of devicesToSync) {
        processed++;
        const deviceId = device.id?.id || device.id;
        const deviceLabel = device.label || device.name || deviceId;

        if (!deviceId) {
          logIngestion(`[RFC-0071] ⚠️ Device without ID: ${deviceLabel}`);
          errors++;
          continue;
        }

        try {
          logIngestion(`[RFC-0071] Processing ${processed}/${devicesToSync.length}: ${deviceLabel}`);

          // Fetch device details to get deviceProfileId
          const deviceDetails = await fetchDeviceDetails(deviceId);
          const deviceProfileId = deviceDetails.deviceProfileId?.id;

          if (!deviceProfileId) {
            logIngestion(`[RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
            errors++;
            continue;
          }

          // Look up profile name from map
          const profileName = profileMap.get(deviceProfileId);

          if (!profileName) {
            logIngestion(`[RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
            errors++;
            continue;
          }

          // Save attribute
          await addDeviceProfileAttribute(deviceId, profileName);
          synced++;

          logIngestion(`[RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

          // Small delay to avoid overwhelming the API
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          logIngestion(`[RFC-0071] ❌ Failed to sync device ${deviceLabel}: ${error?.message || error}`);
          errors++;
        }
      }

      logIngestion(`[RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

      return { synced, skipped, errors };
    } catch (error) {
      logIngestion(`[RFC-0071] ❌ Fatal error during sync: ${error?.message || error}`);
      throw error;
    }
  }

  async function runIngestionSync(customerId, ingestionJwt, opts = {}) {
    const {
      dataApiBaseUrl = 'https://api.data.apps.myio-bas.com/api/v1',
      includeInactive = false,
      dryRun = false,
      centralIdConfig = null, // { mode: 'none'|'fallback'|'force', value: 'uuid...' }
      centralNameConfig = null, // { mode: 'none'|'fallback'|'force', value: 'Nome da Central' }
    } = opts;

    logIngestion(`➡️ Buscando devices na Ingestion API (paginado 100) para customerId=${customerId} ...`);

    const pages = await fetchIngestionDevicesAllPaged({
      baseUrl: dataApiBaseUrl,
      token: ingestionJwt,
      customerId,
      limit: 100,
      includeInactive,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    console.info(`[runIngestionSync] fetched ${pages.length} pages from Ingestion API`);
    console.log('[runIngestionSync] pages:', pages);

    const totalItems = pages.reduce((acc, p) => acc + (p && p.data ? p.data.length : 0), 0);
    console.log(`[runIngestionSync] total devices fetched: ${totalItems}`);

    logIngestion(`ℹ️ Ingestion retornou ${totalItems} devices em ${pages.length} página(s).`);

    const index = buildIngestionIndex(pages); // strict centralId#slaveId, energy/water only

    console.log('[runIngestionSync] ingestion index built:', index);

    // Coleta todos os devices da(s) árvore(s)
    const roots = Array.isArray(window.structure) ? window.structure : [];
    if (!roots.length) {
      logIngestion('⚠️ Nenhuma árvore carregada (window.structure vazia).');
      return;
    }

    const toProcess = [];

    roots.forEach((root, ri) => {
      (root.assets || []).forEach((a, ai) =>
        collectAllDevicesFromAsset(a, toProcess, `structure[${ri}].assets[${ai}]`)
      );
    });

    logIngestion(`➡️ Varredura local encontrou ${toProcess.length} devices.`);

    // ⬇️⬇️ ENRIQUECE ANTES DE MATCH ⬇️⬇️
    await enrichAllDevicesWithServerAttrs(toProcess, {
      concurrency: 4,
      pauseMsBetweenBatches: 150,
      progressEvery: 20,
    });

    // ⬇️⬇️ RFC-0071: SYNC DEVICE PROFILES ⬇️⬇️
    await syncDeviceProfileAttributes(toProcess);

    let matched = 0,
      saved = 0,
      skipped = 0,
      errors = 0;
    const tasks = [];

    for (const { device: d } of toProcess) {
      const tbId = d.id;
      const slave = d.slaveId ?? d.slaveID ?? null;

      // Lógica de CentralID baseada na configuração da modal
      let central;
      if (centralIdConfig?.mode === 'force' && centralIdConfig?.value) {
        // Forçar: ignora atributo do device e sempre usa o valor configurado
        central = centralIdConfig.value;
        // Popular d.attributes.centralId para matchIngestionRecord usar
        if (!d.attributes) d.attributes = {};
        d.attributes.centralId = central;
      } else if (centralIdConfig?.mode === 'fallback' && centralIdConfig?.value) {
        // Fallback: usa atributo do device, se não tiver usa o valor configurado
        central = d.centralId ?? d.centralID ?? centralIdConfig.value;
        // Popular d.attributes.centralId se não existir
        if (!d.attributes) d.attributes = {};
        if (!d.attributes.centralId) {
          d.attributes.centralId = central;
        }
      } else {
        // Usar atributo: comportamento original (lê do device, null se não tiver)
        central = d.centralId ?? d.centralID ?? null;
        // Garantir que d.attributes.centralId existe se temos centralId
        if (central && !d.attributes) d.attributes = {};
        if (central && !d.attributes.centralId) {
          d.attributes.centralId = central;
        }
      }

      if (!tbId) {
        skipped;
        logIngestion(`- 🔸 SKIP: "${d.name}" sem TB id.`);
        continue;
      }

      if (slave == null || central == null) {
        skipped;
        logIngestion(`- 🔸 SKIP: "${d.name}" (TB:${tbId}) sem slaveId/centralId.`);
        continue;
      }

      const { rec, reason } = matchIngestionRecord(d, index); // strict centralId#slaveId lookup (agora com d.attributes.centralId populado)

      if (!rec) {
        skipped;
        logIngestion(
          `- ❓ NO MATCH: "${d.name}" (TB:${tbId}) slaveId=${slave} centralId=${
            central ?? '-'
          } -> não encontrado.`
        );
        continue;
      }

      matched;

      // const forceHydr = isHydrometerName(d.name); //TODO linha comentada para foçar ingestionId nos hidrometros
      const listaOneItem = [{ id: tbId }];
      //  const { identifier, centralName } = await fetchIdentifierAndCentralNameByDevice(listaOneItem);//TODo Linha comentada para teste
      let identifier = '';
      let centralName = '';

      const resultFetch = await fetchIdentifierAndCentralNameByDevice(listaOneItem);
      identifier = resultFetch.identifier;
      centralName = resultFetch.centralName;

      console.log('[RETURN fetchIdentifierAndCentralNameByDevice] Retorno da função:', {
        identifier,
        centralName,
      });

      // Lógica de CentralName baseada na configuração da modal
      if (centralNameConfig?.mode === 'force' && centralNameConfig?.value) {
        // Forçar: ignora valor derivado do device e sempre usa o valor configurado
        centralName = centralNameConfig.value;
        logIngestion(`- 🔧 CentralName forçado para "${d.name}": ${centralName}`);
      } else if (centralNameConfig?.mode === 'fallback' && centralNameConfig?.value) {
        // Fallback: usa valor derivado do device, se não tiver usa o valor configurado
        if (!centralName || centralName === 'Sem central identificada') {
          centralName = centralNameConfig.value;
          logIngestion(`- 🔧 CentralName fallback para "${d.name}": ${centralName}`);
        }
      }
      // Se mode === 'none' ou sem configuração, mantém o valor original de fetchIdentifierAndCentralNameByDevice

      /*
      const attrs = {
        ingestionId:  rec.id, //forceHydr ? -1 : rec.id,
        ingestionGatewayId: rec?.gateway?.id || rec.gatewayId, 
        ingestionDeviceType: rec.deviceType,
        centralName: centralName !=null? centralName : 'Sem central identificada',
        identifier:identifier !=null? identifier : 'Sem Identificador identificado'
      };
      */

      const attrs = buildAttrs(rec, centralName, identifier);

      if (dryRun) {
        skipped;
        logIngestion(`- 🧪 DRY-RUN: "${d.name}" (TB:${tbId}) <= ${JSON.stringify(attrs)}`);
        continue;
      }

      tasks.push(
        writeServerScopeAttributesLimited(tbId, attrs)
          .then(() => {
            saved;
            logIngestion(`- ✅ SAVED: "${d.name}" (TB:${tbId}) <= ingestionId=${rec.id} [via ${reason}]`);
          })
          .catch((e) => {
            errors;
            logIngestion(`- ❌ SAVE ERR: "${d.name}" (TB:${tbId}) => ${e.message || e}`);
          })
      );
    }

    await Promise.allSettled(tasks);
    logIngestion(
      `\n📊 Resultado: matched=${matched}, salvos=${saved}, ignorados=${skipped}, erros=${errors}`
    );
  }

  // ----- Carregar valores (customerId do CUSTOMER.SERVER_SCOPE e JWT do MyIOAuth)
  (async () => {
    try {
      const prefillCustomerId = window.currentIngestionCustomerId || '';
      $cid.value = prefillCustomerId;

      // 3) JWT da Ingestion via MyIOAuth
      let ingestionJwt = '';
      try {
        ingestionJwt = await MyIOAuth.getToken();
      } catch (e) {
        logIngestion?.('❌ Erro obtendo JWT da Ingestion via MyIOAuth.getToken()');
        console.error(e);
      }

      $tok.value = ingestionJwt || ''; // ficará mascarado (password)

      // Botão RUN
      $run.onclick = async () => {
        const customerId = ($cid.value || '').trim();

        if (!customerId) {
          window.alert('Informe o Customer ID (atributo do CUSTOMER em SERVER_SCOPE).');
          $cid.focus();
          return;
        }

        let freshJwt = '';

        try {
          freshJwt = await MyIOAuth.getToken();
          $tok.value = freshJwt || ''; // atualiza visualmente (mas continua mascarado)
        } catch (e) {
          console.error(e);
          window.alert('Não foi possível obter o JWT via MyIOAuth.getToken().');
          return;
        }

        try {
          $run.disabled = true;
          const old = $run.innerHTML;
          $run.innerHTML = `<i>⏳</i> Sincronizando...`;

          // Ler configuração de CentralID da modal
          const centralIdMode = $centralMode.value;
          const centralIdValue = ($centralId.value || '').trim();

          let centralIdConfig = null;
          if (centralIdMode !== 'none' && centralIdValue) {
            centralIdConfig = {
              mode: centralIdMode, // 'fallback' ou 'force'
              value: centralIdValue,
            };
            logIngestion?.(`ℹ️ CentralID: modo="${centralIdMode}", valor="${centralIdValue}"`);
          } else if (centralIdMode !== 'none' && !centralIdValue) {
            window.alert(
              `Para usar CentralID em modo "${centralIdMode}", é necessário preencher o campo Central ID.`
            );
            $centralId.focus();
            $run.disabled = false;
            $run.innerHTML = old;
            return;
          }

          // Ler configuração de CentralName da modal
          const centralNameMode = $centralNameMode.value;
          const centralNameValue = ($centralName.value || '').trim();

          let centralNameConfig = null;
          if (centralNameMode !== 'none' && centralNameValue) {
            centralNameConfig = {
              mode: centralNameMode, // 'fallback' ou 'force'
              value: centralNameValue,
            };
            logIngestion?.(`ℹ️ CentralName: modo="${centralNameMode}", valor="${centralNameValue}"`);
          } else if (centralNameMode !== 'none' && !centralNameValue) {
            window.alert(
              `Para usar CentralName em modo "${centralNameMode}", é necessário preencher o campo Central Name.`
            );
            $centralName.focus();
            $run.disabled = false;
            $run.innerHTML = old;
            return;
          }

          await runIngestionSync(customerId, freshJwt, { centralIdConfig, centralNameConfig });
          logIngestion?.('✅ Sync finalizado.');
          $run.innerHTML = old;
        } catch (err) {
          console.error(err);
          logIngestion?.(`❌ Erro: ${err.message || err}`);
        } finally {
          $run.disabled = false;
        }
      };
    } catch (err) {
      console.error(err);
      logIngestion?.(`❌ Erro ao preparar modal: ${err.message || err}`);
    }
  })();
}

self.onInit = function () {
  const jsPdfScript = document.createElement('script');

  jsPdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  jsPdfScript.onload = () => {
    window.jsPDF = window.jspdf.jsPDF;
  };

  document.head.appendChild(jsPdfScript);

  function drawPremiumHeader(doc, pageW, headerH, customerName, summaryLine) {
    doc.setFillColor(245, 246, 250);
    doc.rect(0, 0, pageW, headerH, 'F');

    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(10, headerH - 0.8, pageW - 10, headerH - 0.8);

    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Pre-Setup Constructor — Etiquetas', 12, headerH / 2 + 1.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(`Gerado em: ${tsStampBR()}`, pageW - 14, headerH / 2 + 1.2, {
      align: 'right',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`${customerName}  •  ${summaryLine}`, 12, headerH - 2.2);
  }

  function drawPremiumFooter(doc, pageW, pageH, footerH, pageNo, pageCount) {
    // Limpa a faixa do rodapé e dá contraste
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageH - footerH, pageW, footerH, 'F');

    // Linha superior do rodapé
    doc.setDrawColor(210);
    doc.setLineWidth(0.25);
    doc.line(10, pageH - footerH + 1.2, pageW - 10, pageH - footerH + 1.2);

    // Linha-base segura para textos (≈5 mm acima da borda)
    const baseline = pageH - footerH + 5.2;

    // Texto à esquerda (branding)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(55);
    doc.text('MyIO — Pre-Setup Constructor v1.0.8', 12, baseline);

    // Página X de Y (direita) com “badge” para leitura
    const label = `Página ${pageNo} de ${pageCount}`;
    const padX = 2.6,
      padY = 1.6;
    doc.setFont('helvetica', 'bold');
    const textW = doc.getTextWidth(label);
    const badgeW = textW + padX * 2;
    const badgeH = 2 + padY * 2;

    const rightSafe = 12; // margem segura da direita
    const x = pageW - rightSafe - badgeW;
    const y = baseline - 4; // topo do badge

    doc.setFillColor(245, 246, 250);
    doc.setDrawColor(230);
    doc.roundedRect(x, y, badgeW, badgeH, 1.6, 1.6, 'FD');

    doc.setTextColor(40);
    doc.text(label, x + padX, baseline);
  }

  function summarizeStructure(structure) {
    let customers = 0,
      assets = 0,
      devices = 0,
      gateways = 0;
    function walkAsset(a) {
      assets++;
      (a.devices || []).forEach(() => devices++);
      (a.gateways || []).forEach(() => gateways++);
      (a.children || []).forEach(walkAsset);
      (a.subAssets || []).forEach(walkAsset);
    }
    function walkCustomer(c) {
      customers++;
      (c.gateways || []).forEach(() => gateways++);
      (c.assets || []).forEach(walkAsset);
      (c.children || []).forEach(walkCustomer);
    }
    (structure || []).forEach(walkCustomer);
    return { customers, assets, devices, gateways };
  }

  window.exportPdf = async function () {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Resumo de Estrutura', pageWidth / 2, 20, { align: 'center' });

    let y = 35;

    function sanitize(text) {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\u0000-\u007F]/g, '');
    }

    async function generateQRCodeBase64(url) {
      return new Promise((resolve, reject) => {
        if (typeof QRious === 'undefined') {
          console.warn('[generateQRCodeBase64] QRious library not loaded, using placeholder');
          resolve(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          );
          return;
        }

        try {
          const qr = new QRious({
            value: url,
            size: 60,
            level: 'M',
          });

          resolve(qr.toDataURL());
        } catch (err) {
          console.error('[generateQRCodeBase64] QR Code generation error:', err);
          resolve(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
          );
        }
      });
    }

    async function writeDeviceTableFixed(device, assetName, idl) {
      const tableX = margin;
      const tableWidth = pageWidth - 2 * margin;
      const tableHeight = 30;
      const qrWidth = 30;
      const productWidth = tableWidth - qrWidth;

      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }

      // IDL
      //const idh = 248;
      //const freq = getUniqueFrequency();
      //const hubIndex = 1; // ou derive a posição do asset
      //const centralId = gerarCentralId(window.currentCNPJ, hubIndex, idl);

      const deviceIdl = parseInt(device.addr_low, 10);
      const idh = parseInt(device.addr_high, 10);
      const freq = parseInt(device.frequency, 10);
      const arr = device.central_id; // [21,XXX,YYY,ZZZ]
      const centralId = `${arr[0]}.${String(arr[1]).padStart(3, '0')}.${String(arr[2]).padStart(
        3,
        '0'
      )}.${String(arr[3]).padStart(3, '0')}`;
      const identifier = device.identifier || '';
      const payload = `${deviceIdl}/${idh}/${freq}/${centralId}/${identifier}`;
      const encodedPayload = encodePayload(payload);
      const url = `https://produto.myio.com.br/${device.name
        .replace(/\s+/g, '_')
        .replace(/[^\w\-_.]/g, '')}/${encodedPayload}`;

      // 🔲 Gera o QR Code
      let qrDataURL;
      try {
        qrDataURL = await generateQRCodeBase64(url);
      } catch (e) {
        console.warn('[writeDeviceTableFixed] Erro gerando QR:', e);
        qrDataURL = null;
      }

      // 🔲 Caixa da tabela
      doc.setDrawColor(180);
      doc.setLineWidth(0.2);
      doc.rect(tableX, y, productWidth, tableHeight); // texto
      doc.rect(tableX + productWidth, y, qrWidth, tableHeight); // qr

      // 🔲 Nome e Label
      const textX = tableX + 3;
      let textY = y + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const nome = sanitize(device.name);
      const nameLines = doc.splitTextToSize(nome, productWidth - 6);

      nameLines.forEach((line) => {
        doc.text(line, textX, textY);
        textY += 5;
      });

      if (device.label) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text(`(${sanitize(device.label)})`, textX, textY);
        doc.setTextColor(0); // reset
        textY += 5;
      }

      if (device.identifier) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(`ID: ${sanitize(device.identifier)}`, textX, textY);
        doc.setTextColor(0); // reset
        textY += 5;
      }

      // 🔲 QR
      if (qrDataURL) {
        try {
          const qrSize = 20;
          const qrX = tableX + productWidth + (qrWidth - qrSize) / 2;
          const qrY = y + (tableHeight - qrSize) / 2;
          doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
        } catch (e) {
          console.warn('[writeDeviceTableFixed] Erro add QR ao PDF:', e);
        }
      } else {
        doc.setFontSize(8);
        doc.text('Erro QR', tableX + productWidth + 2, y + 10);
      }

      y += tableHeight + 5;
    }

    function writeHeader(text, level = 0) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      const indent = level * 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(sanitize(text), margin + indent, y);
      y += 8;
    }

    async function processAssetRecursive(asset, level = 0) {
      writeHeader(`Asset: ${asset.name}`, level);

      if (asset.devices && Array.isArray(asset.devices)) {
        for (let i = 0; i < asset.devices.length; i++) {
          const idl = i + 1; // sequencial de 1 a 255
          await writeDeviceTableFixed(asset.devices[i], asset.name, idl);
        }
      }

      for (const child of asset.children || []) {
        await processAssetRecursive(child, level + 1);
      }

      for (const sub of asset.subAssets || []) {
        await processAssetRecursive(sub, level + 1);
      }
    }

    async function processNode(node, level = 0) {
      writeHeader(`Cliente: ${node.name}`, level);

      for (const g of node.gateways || []) {
        writeHeader(`Gateway: ${g.name}`, level + 1);
      }

      for (const asset of node.assets || []) {
        await processAssetRecursive(asset, level + 1);
      }

      for (const child of node.children || []) {
        await processNode(child, level + 1);
      }
    }

    if (Array.isArray(window.structure)) {
      for (const root of window.structure) {
        await processNode(root);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('⚠️ Estrutura não encontrada.', margin, y);
    }

    const customerSafe = sanitizeForFile(getTopCustomerName());
    const stamp = tsStamp();
    const filename = `complete-pre-setup-structure-${customerSafe}-${stamp}.pdf`;

    doc.save(filename);
  };

  function collectAllDevicesWithAsset(structure) {
    const out = [];
    function walkAsset(a) {
      (a.devices || []).forEach((d) => out.push({ device: d, assetName: a.name || '' }));
      (a.children || []).forEach(walkAsset);
      (a.subAssets || []).forEach(walkAsset);
    }
    function walkCustomer(c) {
      (c.assets || []).forEach(walkAsset);
      (c.children || []).forEach(walkCustomer);
    }
    (structure || []).forEach(walkCustomer);
    return out;
  }

  // Gera QR (reaproveita QRious se presente, senão placeholder)
  async function makeQrDataUrl(value) {
    return new Promise((resolve) => {
      if (typeof QRious === 'undefined') {
        resolve(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        );
        return;
      }
      try {
        const qr = new QRious({ value, size: 520, level: 'M' }); // grande; será redimensionado no PDF
        resolve(qr.toDataURL());
      } catch {
        resolve(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        );
      }
    });
  }

  // Monta a URL do QR para um device (usa seus campos atuais)
  function buildDeviceQrUrl(device) {
    const deviceIdl = parseInt(device.addr_low, 10);
    const idh = parseInt(device.addr_high, 10);
    const freq = parseInt(device.frequency, 10);
    const arr = device.central_id || [21, 0, 0, 0];
    const centralId = `${arr[0]}.${String(arr[1]).padStart(3, '0')}.${String(arr[2]).padStart(
      3,
      '0'
    )}.${String(arr[3]).padStart(3, '0')}`;
    const identifier = device.identifier || '';
    const payload = `${deviceIdl}/${idh}/${freq}/${centralId}/${identifier}`;
    const encodedPayload = encodePayload(payload);
    const url = `https://produto.myio.com.br/${device.name
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '')}/${encodedPayload}`;
    return url;
  }

  // Desenha UMA etiqueta simples na posição indicada
  async function drawSimpleTag(doc, x, y, w, h, device, assetName) {
    const FRAME_SCALE_Y = 1.05; // +5% de altura da moldura
    const QR_SCALE = 1.7; // você já usava 1.7
    const QR_SHIFT_Y = 3; // desloca o QR para baixo (mm)
    const GAP_AFTER_QR = 6;
    const frameH = h * FRAME_SCALE_Y;
    const frameY = y - (frameH - h) / 2; // expande 2.5% para cima e 2.5% para baixo

    // borda
    doc.setDrawColor(235);
    doc.setLineWidth(0.15);
    doc.rect(x, frameY, w, frameH);

    const pad = Math.max(2, h * 0.05);
    const innerX = x + pad;
    const innerW = w - pad * 2;

    // Reserva 25% da altura para o título (nome do device)
    const titleAreaH = h * 0.15;
    const qrAreaTop = y + titleAreaH;
    const qrAreaH = h - titleAreaH - 12; // reserva p/ textos abaixo

    // ---------- TÍTULO ----------
    let nameFont = Math.max(6, Math.min(11, titleAreaH * 0.45));
    const rawName = (device.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(nameFont);
    let nameLines = doc.splitTextToSize(rawName, innerW);

    if (nameLines.length > 2) nameLines = [nameLines[0], nameLines[1] + '…'];
    const titleY = y + titleAreaH / 2 - (nameLines.length - 1) * nameFont * 0.5;
    doc.text(nameLines, innerX + innerW / 2, titleY + nameFont / 2, {
      align: 'center',
    });

    // ---------- QR (+35%) ----------
    const qrUrl = buildDeviceQrUrl(device);
    const qrData = await makeQrDataUrl(qrUrl);
    const baseSize = Math.min(qrAreaH, innerW);
    const qrSize = Math.min(baseSize * QR_SCALE, innerW, qrAreaH);
    // empurra o QR no eixo Y
    const qrX = innerX + (innerW - qrSize) / 2;
    let qrY = qrAreaTop + (qrAreaH - qrSize) / 2 + QR_SHIFT_Y;

    // evita passar do rodapé da moldura
    const qrBottom = qrY + qrSize;
    const frameBottom = frameY + frameH - 12; // deixa espaço para textos

    if (qrBottom > frameBottom) {
      qrY -= qrBottom - frameBottom;
    }

    try {
      doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {}

    // ---------- TEXTOS ABAIXO DO QR ----------
    // RFC: Only show device identifier below QR code
    const ident = (device.identifier ? String(device.identifier) : '').trim();
    let currentY = qrY + qrSize + GAP_AFTER_QR; // espaço logo após o QR

    // Identifier (negrito) - Only text below QR code as per RFC
    if (ident) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const tw = doc.getTextWidth(ident);
      doc.text(ident, innerX + innerW / 2 - tw / 2, currentY - 2.5);
    }
  }

  window.exportPdfTagsSimple = async function (mode = 'grid', layout = { cols: 4, rows: 7 }) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Header/Footer alturas
    const headerH = 16;
    const footerH = 14;

    // Margens internas do grid
    const marginX = 8;
    const marginY = 8;
    const gutterX = 3;
    const gutterY = 3;

    // Coleta devices com asset
    const items = collectAllDevicesWithAsset(window.structure);
    if (!items.length) {
      window.alert('Nenhum device encontrado na estrutura.');
      return;
    }

    // Resumo + cliente
    const customerSafe = sanitizeForFile(getTopCustomerName());
    const stamp = tsStamp();
    const filename = `complete-pre-setup-structure-tags-${customerSafe}-${stamp}.pdf`;
    const s = summarizeStructure(window.structure);
    const summaryLine = `Clientes: ${s.customers} • Ativos: ${s.assets} • Dispositivos: ${s.devices} • Gateways: ${s.gateways}`;

    // Função para (re)desenhar header/footer por página
    function paintHF(pageNo, total) {
      drawPremiumHeader(doc, pageW, headerH, getTopCustomerName(), summaryLine);
      drawPremiumFooter(doc, pageW, pageH, footerH, pageNo, total);
    }

    // área útil abaixo do header e acima do footer
    const usableX = marginX;
    const usableY = headerH + marginY;
    const usableW = pageW - marginX * 2;
    const usableH = pageH - headerH - footerH - marginY * 2;

    if (mode === 'per_page') {
      for (let i = 0; i < items.length; i++) {
        if (i > 0) doc.addPage();
        paintHF(doc.internal.getNumberOfPages(), items.length); // paginar
        const tagW = usableW;
        const tagH = usableH;
        await drawSimpleTag(doc, usableX, usableY, tagW, tagH, items[i].device, items[i].assetName);
      }
      // Preenche footer da última página com contagem correta
      const totalPages = doc.internal.getNumberOfPages();
      doc.setPage(totalPages);
      drawPremiumFooter(doc, pageW, pageH, footerH, totalPages, totalPages);
      doc.save(filename);
      return;
    }

    // GRID
    const cols = Math.max(1, layout.cols || 4);
    const rows = Math.max(1, layout.rows || 7);

    const tagW = (usableW - gutterX * (cols - 1)) / cols;
    const tagH = (usableH - gutterY * (rows - 1)) / rows;

    let idx = 0;
    let pageNo = 1;
    paintHF(pageNo); // primeira página

    while (idx < items.length) {
      for (let r = 0; r < rows && idx < items.length; r++) {
        for (let c = 0; c < cols && idx < items.length; c++) {
          const x = usableX + c * (tagW + gutterX);
          const y = usableY + r * (tagH + gutterY);
          const { device, assetName } = items[idx];
          await drawSimpleTag(doc, x, y, tagW, tagH, device, assetName);
          idx++;
        }
      }
      if (idx < items.length) {
        doc.addPage();
        pageNo++;
        paintHF(pageNo);
      }
    }

    // garantir numeração no rodapé com total
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawPremiumFooter(doc, pageW, pageH, footerH, p, totalPages);
    }

    doc.save(filename);
  };

  const container = self.ctx.$container[0];
  container.innerHTML = '';
  const style = document.createElement('style');

  style.textContent = `
    :root{
      --myio-primary:#6932A8;
      --myio-green:#00D775;
      --myio-blue:#4F8EF7;
      --myio-bg:#F6F7FB;
      --myio-card:#FFFFFF;
      --myio-text:#1F2937;
      --myio-muted:#6B7280;
      --myio-border:#E5E7EB;
    }

    .layout-container{
      display:grid;
      grid-template-columns: 7fr 3fr; /* 70% / 30% */
      gap:20px;
    }
    .left-panel{
      max-height:80vh; overflow-y:auto;
      border-right:1px solid var(--myio-border); padding-right:20px;
    }
    .right-panel{
      max-height:80vh; overflow-y:auto;
    }
    
    /* opcional: em telas pequenas empilha */
    @media (max-width: 1100px){
      .layout-container{ grid-template-columns: 1fr; }
      .left-panel{ border-right:none; padding-right:0; }
    }
    .wizard-container{ font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:20px; background:var(--myio-bg); color:var(--myio-text); }
    .tree-block{
      background:var(--myio-card);
      border:1px solid var(--myio-border);
      border-radius:14px;
      padding:14px;
      margin:10px 0 10px 0;
      box-shadow: 0 1px 2px rgba(16,24,40,.06);
    }
    .tree-block > strong{ font-weight:600; }
    .tree-block .tree-block{ margin-left:12px; border-left:2px dashed #e9e9ef; }

    /* ------- Buttons (estilo do print) ------- */
    .btnbar{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .btn{
      display:inline-flex; align-items:center; gap:8px;
      height:32px; padding:0 12px;
      font-size:12.5px; font-weight:600; letter-spacing:.2px;
      border-radius:999px; border:1px solid var(--myio-border);
      background:#fff; color:#374151;
      box-shadow:0 1px 2px rgba(0,0,0,.04);
      transition:all .18s ease;
      cursor:pointer; user-select:none;
    }
    .btn:hover{ transform:translateY(-1px); box-shadow:0 4px 10px rgba(0,0,0,.06); }
    .btn:active{ transform:translateY(0); box-shadow:0 1px 2px rgba(0,0,0,.04); }

    .btn-primary{
      background:linear-gradient(180deg, #7B47C4 0%, var(--myio-primary) 100%);
      color:#fff; border-color:#6F35B5;
    }
    .btn-primary:hover{ filter:brightness(1.03); }
    .btn-outline{
      background:#fff; color:#4B5563; border-color:#D1D5DB;
    }
    .btn-ghost{
      background:transparent; color:#4B5563; border-color:transparent;
    }
    .btn-success{
      background:linear-gradient(180deg, #24E08C 0%, var(--myio-green) 100%);
      color:#064E3B; border-color:#16C47F;
    }
    .btn-danger{
      background:#fff; color:#B91C1C; border-color:#F3C0C0;
    }
    .btn i{ font-style:normal; font-size:14px; line-height:0; }

    /* Botões de topo */
    .toolbar { display:flex; align-items:center; gap:8px; margin:10px 0 16px; }
    .toolbar .btn{ height:34px; font-size:13px; }

    .modal-actions{
      display:flex; justify-content:flex-end; gap:8px; margin-top:12px;
    }
    .modal-content h3{ margin:0 0 10px 0; font-weight:700; }

    .modal-content textarea{
      width:100%; min-height:180px; resize:vertical;
      padding:10px; border:1px solid var(--myio-border); border-radius:10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size:12.5px; line-height:1.4;
    }
    .small-note{ color:var(--myio-muted); font-size:12px; margin-top:6px; }    

    pre{ background:#F8FAFC; padding:10px; max-height:300px; overflow:auto; border:1px solid var(--myio-border); border-radius:10px; }
    .modal-overlay{ position:fixed; inset:0; background:rgba(15,23,42,.4); display:flex; align-items:center; justify-content:center; z-index:9999; }
    .modal-content{ background:#fff; padding:18px; border-radius:14px; width:340px; box-shadow:0 10px 30px rgba(0,0,0,.15); }
    .modal-content input, .modal-content select{ width:100%; margin-bottom:10px; padding:8px 10px; border:1px solid var(--myio-border); border-radius:10px; }
  `;

  document.head.appendChild(style);

  container.insertAdjacentHTML(
    'beforeend',
    `
    <div class="wizard-container">
      <div class="layout-container">
        <div class="left-panel">
          <h2>🌳 Estrutura Hierárquica</h2>
          <div class="toolbar">
            <button id="add-root" class="btn btn-primary"><i>＋</i> Cliente Raiz</button>
            <button id="import-root" class="btn btn-outline"><i>⤓</i> Importar Cliente</button>
            <button id="import-json" class="btn btn-outline"><i>📥</i> Importar JSON</button>
            <button id="ingestion-sync" class="btn btn-outline"><i>🔄</i> Ingestion Sync</button>
            <button id="information" class="btn btn-ghost" style="display:none;"><i>ℹ️</i> Informações</button>
          </div>
          <div id="treeContainer"></div>
        </div>
        <div class="right-panel">
          <h3>📋 Resumo</h3>
          <div class="toolbar">
            <button class="btn btn-success" onclick="createOrUpdateStructure()"><i>🚀</i> Criar/Atualizar</button>
            <button class="btn btn-outline" onclick="exportJson()"><i>⬇️</i> Exportar JSON</button>
            <button class="btn btn-outline" onclick="exportPdfTagsSimple('grid', {cols:4, rows:7})"><i>🏷️</i> Etiquetas (4×7)</button>
            <button class="btn btn-ghost" onclick="showModal('config')"><i>⚙️</i> SETUP</button>
          </div>
          <pre id="summary"></pre>
        </div>
      </div>
    </div>
  `
  );

  window.structure = [];
  window.deviceCounter = 1;
  window.currentDDD = '21';
  window.currentCNPJ = '12345678000199'; // apenas números

  document.getElementById('information').onclick = () => window.showModal('information', null);
  document.getElementById('add-root').onclick = () => window.showModal('addCustomer', null);
  document.getElementById('import-root').onclick = () => window.showModal('importCustomer', null);
  document.getElementById('import-json').onclick = () => window.showModal('importJson', null);
  document.getElementById('ingestion-sync').onclick = () => window.showModal('ingestionSync', null);

  window.renderTree = function () {
    const treeContainer = document.getElementById('treeContainer');
    treeContainer.innerHTML = '';

    window.structure.forEach((customer, i) => {
      treeContainer.appendChild(renderCustomer(customer, `structure[${i}]`));
    });

    document.getElementById('summary').textContent = JSON.stringify(window.structure, null, 2);
  };

  window.copySummaryJson = function () {
    const text = JSON.stringify(window.structure, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      window.alert('Estrutura copiada!');
    });
  };

  window.exportJson = function () {
    try {
      const json = JSON.stringify(window.structure || [], null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const customerSafe = sanitizeForFile(getTopCustomerName());
      const filename = `pre-setup-structure-${customerSafe}-${tsStamp()}.json`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      }, 0);
    } catch (e) {
      console.error(e);
      window.alert('[exportJson] Não foi possível exportar o JSON.');
    }
  };

  window.showModal = function (type, path) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    let title =
      {
        addSubAsset: 'sub-assets',
        addCustomer: 'Novo Cliente',
        addGateway: 'Novo Gateway',
        addAsset: 'Novo Asset',
        addDevice: 'Novo Device',
        importCustomer: 'Cliente Antigo',
      }[type] || 'Adicionar';

    // Create modal content container
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    if (type === 'ingestionSync') {
      handleIngestionSyncModal(modal);
      return;
    } else if (type === 'information') {
      const heading = document.createElement('h3');
      heading.textContent = title;
      modalContent.appendChild(heading);

      const infoList = document.createElement('ul');
      infoList.style.cssText = 'list-style: none; padding-left: 0; font-size: 16px;';

      const infoItems = [
        `👥 Clientes: ${self.ctx.$scope.totalCustomers}`,
        `📦 Ativos: ${self.ctx.$scope.totalAssets}`,
        `🔌 Dispositivos: ${self.ctx.$scope.totalDevices}`,
        `🌐 Gateways: ${self.ctx.$scope.totalGateways}`,
      ];

      infoItems.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        infoList.appendChild(li);
      });

      modalContent.appendChild(infoList);

      const closeBtn = document.createElement('button');
      closeBtn.id = 'modalClose';
      closeBtn.style.marginTop = '10px';
      closeBtn.textContent = 'Fechar';
      modalContent.appendChild(closeBtn);
    } else if (type === 'importCustomer') {
      // Ajuste de largura da modal para o dobro
      modalContent.style.width = '680px';

      const heading = document.createElement('h3');
      heading.textContent = title;
      modalContent.appendChild(heading);

      // Campo de busca/filtro
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.id = 'importClientSearch';
      searchInput.placeholder = '🔍 Buscar cliente por nome...';
      searchInput.style.marginBottom = '10px';
      modalContent.appendChild(searchInput);

      const select = document.createElement('select');
      select.id = 'importClientSelect';
      select.size = '15'; // Mostra 15 itens de uma vez
      select.style.minHeight = '300px';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Carregando clientes...';
      select.appendChild(defaultOption);
      modalContent.appendChild(select);

      const modalActions = document.createElement('div');
      modalActions.className = 'modal-actions';

      const closeBtn = document.createElement('button');
      closeBtn.id = 'modalClose';
      closeBtn.className = 'btn btn-ghost';
      closeBtn.innerHTML = '<i>✖</i> Fechar';
      modalActions.appendChild(closeBtn);

      const confirmBtn = document.createElement('button');
      confirmBtn.id = 'modalConfirm';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.innerHTML = '<i>⤓</i> Importar Cliente';
      modalActions.appendChild(confirmBtn);

      modalContent.appendChild(modalActions);

      // Load customers asynchronously
      fetchAllCustomers().then((allCustomers) => {
        //allCustomersGlobal = allCustomers;

        // Ordenar clientes alfabeticamente por nome
        const sortedCustomers = Object.entries(allCustomers).sort((a, b) => {
          const nameA = (a[1].name || '').toLowerCase();
          const nameB = (b[1].name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        // Função para popular o select
        const populateSelect = (filter = '') => {
          select.innerHTML = '';

          const filterLower = filter.toLowerCase();
          const filtered = sortedCustomers.filter(([key, client]) => {
            return (client.name || '').toLowerCase().includes(filterLower);
          });

          if (filtered.length === 0) {
            const noResults = document.createElement('option');
            noResults.value = '';
            noResults.textContent = 'Nenhum cliente encontrado';
            noResults.disabled = true;
            select.appendChild(noResults);
          } else {
            filtered.forEach(([key, client]) => {
              const opt = document.createElement('option');
              opt.value = client.id;
              opt.textContent = client.name;
              select.appendChild(opt);
            });
          }
        };

        // Popular inicialmente
        populateSelect();

        // Adicionar listener de busca
        searchInput.addEventListener('input', (e) => {
          populateSelect(e.target.value);
        });
      });
    } else if (type === 'config') {
      const heading = document.createElement('h3');
      heading.textContent = '⚙️ Configurar DDD e CNPJ';
      modalContent.appendChild(heading);

      const dddLabel = document.createElement('label');
      dddLabel.textContent = 'DDD:';
      modalContent.appendChild(dddLabel);

      const dddInput = document.createElement('input');
      dddInput.type = 'text';
      dddInput.id = 'inputDDD';
      dddInput.value = window.currentDDD || '';
      dddInput.placeholder = 'Ex: 21';
      modalContent.appendChild(dddInput);

      const cnpjLabel = document.createElement('label');
      cnpjLabel.textContent = 'CNPJ:';
      modalContent.appendChild(cnpjLabel);

      const cnpjInput = document.createElement('input');
      cnpjInput.type = 'text';
      cnpjInput.id = 'inputCNPJ';
      cnpjInput.value = window.currentCNPJ || '';
      cnpjInput.placeholder = 'Ex: 12345678000199';
      modalContent.appendChild(cnpjInput);

      // Add bypass provisioning checkbox
      const bypassLabel = document.createElement('label');
      bypassLabel.textContent = 'Bypass Provisioning:';
      bypassLabel.style.marginTop = '15px';
      modalContent.appendChild(bypassLabel);

      const bypassCheckbox = document.createElement('input');
      bypassCheckbox.type = 'checkbox';
      bypassCheckbox.id = 'inputBypassProvisioning';
      bypassCheckbox.checked = window.bypassProvisioning || false;
      bypassCheckbox.style.marginLeft = '10px';
      modalContent.appendChild(bypassCheckbox);

      const bypassDescription = document.createElement('div');
      bypassDescription.textContent =
        'Quando ativado, simula o provisionamento sem chamar a API real (para desenvolvimento/teste)';
      bypassDescription.style.fontSize = '12px';
      bypassDescription.style.color = '#666';
      bypassDescription.style.marginTop = '5px';
      modalContent.appendChild(bypassDescription);

      const modalActions = document.createElement('div');
      modalActions.className = 'modal-actions';

      const closeBtn = document.createElement('button');
      closeBtn.id = 'modalClose';
      closeBtn.className = 'btn btn-ghost';
      closeBtn.innerHTML = '<i>✖</i> Cancelar';
      modalActions.appendChild(closeBtn);

      const confirmBtn = document.createElement('button');
      confirmBtn.id = 'modalConfirm';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.innerHTML = '<i>💾</i> Salvar';
      modalActions.appendChild(confirmBtn);

      modalContent.appendChild(modalActions);
    } else {
      // Standard form modal (addCustomer, addGateway, addAsset, addDevice)
      const heading = document.createElement('h3');
      heading.textContent = title;
      modalContent.appendChild(heading);

      // Label input (common for all types)
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.id = 'inputLabel';
      labelInput.placeholder = 'Label';
      modalContent.appendChild(labelInput);

      // Customer-specific fields (DDD and CNPJ)
      if (type === 'addCustomer') {
        const dddInput = document.createElement('input');
        dddInput.type = 'text';
        dddInput.id = 'inputDDD';
        dddInput.placeholder = 'DDD (ex: 21)';
        dddInput.maxLength = '3';
        modalContent.appendChild(dddInput);

        const cnpjInput = document.createElement('input');
        cnpjInput.type = 'text';
        cnpjInput.id = 'inputCNPJ';
        cnpjInput.placeholder = 'CNPJ (apenas números)';
        cnpjInput.maxLength = '14';
        modalContent.appendChild(cnpjInput);
      }

      // Gateway-specific fields
      if (type === 'addGateway') {
        const ipv6Input = document.createElement('input');
        ipv6Input.type = 'text';
        ipv6Input.id = 'inputIpv6Yggdrasil';
        ipv6Input.placeholder = 'IPv6 Yggdrasil';
        modalContent.appendChild(ipv6Input);

        const uuidInput = document.createElement('input');
        uuidInput.type = 'text';
        uuidInput.id = 'inputUuid';
        uuidInput.placeholder = 'UUID';
        modalContent.appendChild(uuidInput);

        const provisioningEndpointInput = document.createElement('input');
        provisioningEndpointInput.type = 'text';
        provisioningEndpointInput.id = 'inputProvisioningEndpoint';
        provisioningEndpointInput.placeholder = 'Provisioning Endpoint (opcional)';
        modalContent.appendChild(provisioningEndpointInput);
      }

      // Device-specific fields
      if (type === 'addDevice') {
        const identifierInput = document.createElement('input');
        identifierInput.type = 'text';
        identifierInput.id = 'inputIdentifier';
        identifierInput.placeholder = 'Identifier';
        modalContent.appendChild(identifierInput);

        const typeSelect = document.createElement('select');
        typeSelect.id = 'inputType';

        const deviceTypes = [
          'COMPRESSOR',
          'VENTILADOR',
          'SELETOR_AUTO_MANUAL',
          'TERMOSTATO',
          '3F_MEDIDOR',
          'MOTOR',
          'ESCADA_ROLANTE',
          'ELEVADOR',
          'HIDROMETRO',
          'SOLENOIDE',
          'CONTROLE_REMOTO',
          'CAIXA_D_AGUA',
          'CONTROLE_AUTOMACAO',
        ];

        deviceTypes.forEach((deviceType) => {
          const option = document.createElement('option');
          option.value = deviceType;
          option.textContent = deviceType;
          typeSelect.appendChild(option);
        });

        modalContent.appendChild(typeSelect);
      }

      // Action buttons
      const closeBtn = document.createElement('button');
      closeBtn.id = 'modalClose';
      closeBtn.className = 'btn btn-ghost';
      closeBtn.innerHTML = '<i>✖</i> Fechar';
      modalContent.appendChild(closeBtn);

      const confirmBtn = document.createElement('button');
      confirmBtn.id = 'modalConfirm';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.innerHTML = '<i>✔</i> Confirmar';
      modalContent.appendChild(confirmBtn);
    }

    modal.appendChild(modalContent);

    // Fechar modal no botão quando for 'information'
    if (type === 'information') {
      const btnClose = modal.querySelector('#modalClose');
      if (btnClose) {
        btnClose.onclick = () => {
          modal.remove();
        };
      }
    }

    // Depois que o modal for criado, adiciona o evento para fechar quando for tipo "information":
    if (type === 'information') {
      const btnClose = modal.querySelector('#modalClose');
      if (btnClose) {
        btnClose.onclick = () => {
          modal.remove();
        };
      }
    }

    if (type === 'config') {
      modal.innerHTML = `
        <div class="modal-content">
          <h3>⚙️ Configurar DDD e CNPJ</h3>
          <label>DDD:</label>
          <input type="text" id="inputDDD" value="${window.currentDDD || ''}" placeholder="Ex: 21" />
          <label>CNPJ:</label>
          <input type="text" id="inputCNPJ" value="${
            window.currentCNPJ || ''
          }" placeholder="Ex: 12345678000199" />
          <div class="modal-actions">
            <button id="modalClose"   class="btn btn-ghost"><i>✖</i> Cancelar</button>
            <button id="modalConfirm" class="btn btn-primary"><i>💾</i> Salvar</button>
          </div>
        </div>`;
    }

    document.body.appendChild(modal);

    modal.querySelector('#modalConfirm').onclick = () => {
      const inputLabel = modal.querySelector('#inputLabel');
      const label = inputLabel ? inputLabel.value : null;
      if (type !== 'importCustomer' && !label) return window.alert('Preencha o campo!');

      if (type === 'addCustomer') {
        const ddd = modal.querySelector('#inputDDD')?.value.trim();
        const cnpj = modal.querySelector('#inputCNPJ')?.value.replace(/\D/g, ''); // só números

        // Validate DDD and CNPJ
        if (ddd && !/^\d{2,3}$/.test(ddd)) {
          return window.alert('DDD deve ter 2 ou 3 dígitos!');
        }
        if (cnpj && !/^\d{14}$/.test(cnpj)) {
          return window.alert('CNPJ deve ter 14 dígitos!');
        }

        const newCustomer = {
          name: label,
          ddd: ddd || window.currentDDD || '21',
          cnpj: cnpj || window.currentCNPJ || '00000000000000',
          gateways: [],
          assets: [],
          children: [],
        };
        if (!path) window.structure.push(newCustomer);
        else eval(path).children.push(newCustomer);
      }

      if (type === 'importCustomer') {
        const selectedId = modal.querySelector('#importClientSelect')?.value;
        console.log('ID selecionado:', selectedId);

        const customerEntity = {
          id: selectedId,
          entityType: 'CUSTOMER',
        };

        importedTree(customerEntity.id);
      }

      if (type === 'addGateway') {
        const target = eval(path); // customer OU asset
        const label = modal.querySelector('#inputLabel')?.value;
        const ipv6Yggdrasil = modal.querySelector('#inputIpv6Yggdrasil')?.value;
        const uuid = modal.querySelector('#inputUuid')?.value;
        //const provisioningEndpoint = "provisioning.apps.myio-bas.com"; // modal.querySelector("#inputProvisioningEndpoint")?.value; // TODO TROCAR LOCAL
        const provisioningEndpoint = 'https://a9bd04b0db2e.ngrok-free.app'; // modal.querySelector("#inputProvisioningEndpoint")?.value;

        if (!label) return window.alert('Preencha o campo!');

        // Get next gateway info (sequential ID and frequency)
        const { gatewayId, frequency } = getNextGatewayInfo();

        // Find the customer's DDD and CNPJ by traversing up the hierarchy
        const customerData = findCustomerForPath(path);
        const customerDDD = customerData?.ddd || window.currentDDD || '21';
        const customerCNPJ = customerData?.cnpj || window.currentCNPJ || '00000000000000';

        // Generate central_id in format XXX.YYY.WWW.ZZZ using customer's CNPJ
        const centralIdStr = gerarCentralId(customerDDD, customerCNPJ, gatewayId);

        const gatewayObj = {
          name: label,
          central_id: centralIdToArray(centralIdStr),
          frequency: frequency,
          gatewayId: gatewayId, // Store for reference
          _deviceCount: 0, // Initialize device counter
          'ipv6-yggdrasil': ipv6Yggdrasil || '', // Add IPv6 Yggdrasil field
          uuid: uuid || '', // Add UUID field
          provisioningEndpoint: provisioningEndpoint || '', // Add provisioning endpoint field
          credentials: {
            mqtt: {
              server: 'mqtt://mqtt.myio-bas.com',
              clientId: 'client_a_ser_gerado_no_futuro',
              username: 'username_a_ser_gerado_no_futuro',
              password: 'password_a_ser_gerado_no_futuro',
            },
          },
        };

        target.gateways = target.gateways || [];
        target.gateways.push(gatewayObj);

        modal.remove();
        window.renderTree();
        return;
      }

      if (type === 'addAsset') {
        eval(path).assets.push({
          name: label,
          children: [],
          subAssets: [],
          devices: [],
        });
      }

      if (type === 'addSubAsset') {
        console.log('eval', eval(path));
        eval(path).subAssets = eval(path).subAssets || [];
        eval(path).subAssets.push({
          name: label,
          children: [],
          subAssets: [],
          devices: [],
        });
      }

      if (type === 'addDevice') {
        const targetAsset = eval(path);
        const label = modal.querySelector('#inputLabel')?.value;
        const identifier = modal.querySelector('#inputIdentifier')?.value;
        const deviceType = modal.querySelector('#inputType')?.value || 'default';
        if (!label) return window.alert('Preencha o campo Label!');
        if (!identifier) return window.alert('Preencha o campo Identifier!');

        // Find the gateway that should contain this device
        const gateway = findGatewayForAsset(path);
        if (!gateway) {
          return window.alert(
            'Erro: Não foi possível encontrar um gateway para este dispositivo. Adicione um gateway primeiro.'
          );
        }

        // Get next device ID for this gateway (resets for each gateway)
        const deviceId = getNextDeviceIdForGateway(gateway);

        // Devices share the SAME central_id as their gateway
        const centralIdStr = `${gateway.central_id[0]}.${String(gateway.central_id[1]).padStart(
          3,
          '0'
        )}.${String(gateway.central_id[2]).padStart(3, '0')}.${String(gateway.central_id[3]).padStart(
          3,
          '0'
        )}`;

        // nome gerado (mantenha seu padrão)
        const ymd = gerarCodigoUnico();
        const incremental = window.deviceCounter.toString().padStart(3, '0');
        window.deviceCounter++;
        const prefixMap = {
          COMPRESSOR: '3F COMP.',
          VENTILADOR: '3F VENT.',
          SELETOR_AUTO_MANUAL: 'S_AUTO_MANUAL.',
          TERMOSTATO: 'TEMP.',
          '3F_MEDIDOR': '3F',
          MOTOR: '3F MOTR.',
          ESCADA_ROLANTE: '3F ESRL.',
          ELEVADOR: '3F ELEV.',
          HIDROMETRO: 'HIDR.',
          SOLENOIDE: 'ABFE.',
          CONTROLE_REMOTO: 'AC',
          CAIXA_D_AGUA: 'SCD',
          CONTROLE_AUTOMACAO: 'GW_AUTO.',
        };
        const prefix = prefixMap[deviceType] || 'DEV.';
        const generatedName = `${prefix} ${ymd}${incremental}`;

        const idh = 248; // fixo

        const device = {
          name: generatedName,
          label,
          identifier,
          type: deviceType,
          addr_low: String(deviceId), // = deviceId (zzz from central_id)
          addr_high: String(idh), // "248"
          frequency: String(gateway.frequency), // same as gateway
          central_id: centralIdToArray(centralIdStr),
          central_device_type: mapCentralDeviceType(deviceType),
          central_device_id: String(deviceId), // = addr_low
        };

        targetAsset.devices.push(device);
        modal.remove();
        window.renderTree();
        return;
      }

      if (type === 'config') {
        const dddInput = modal.querySelector('#inputDDD')?.value.trim();
        const cnpjInput = modal.querySelector('#inputCNPJ')?.value.replace(/\D/g, ''); // só números
        const bypassProvisioningInput = modal.querySelector('#inputBypassProvisioning')?.checked;

        if (!/^\d{2,3}$/.test(dddInput)) return window.alert('DDD inválido!');
        if (!/^\d{14}$/.test(cnpjInput)) return window.alert('CNPJ deve ter 14 dígitos!');

        window.currentDDD = dddInput;
        window.currentCNPJ = cnpjInput;
        window.bypassProvisioning = bypassProvisioningInput;

        window.alert('Configurações salvas!');
      }

      if (type === 'importJson') {
        modal.innerHTML = `
          <div class="modal-content">
            <h3>📥 Importar estrutura via JSON</h3>

            <input type="file" id="importJsonFile" accept=".json,application/json" />
            <div class="small-note">Abra um arquivo .json ou cole o conteúdo abaixo.</div>

            <textarea id="importJsonText" placeholder='Cole aqui o JSON gerado (array de clientes)'></textarea>

            <div class="modal-actions">
              <button id="modalClose"   class="btn btn-ghost"><i>✖</i> Fechar</button>
              <button id="pasteClipboard" class="btn btn-outline"><i>📋</i> Colar do Clipboard</button>
              <button id="modalConfirm" class="btn btn-primary"><i>✔</i> Importar</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        // Fechar
        const closeBtn = modal.querySelector('#modalClose');

        if (closeBtn) closeBtn.onclick = () => modal.remove();

        // Ler arquivo e preencher textarea
        const fileInput = modal.querySelector('#importJsonFile');
        const textArea = modal.querySelector('#importJsonText');

        if (fileInput) {
          fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              textArea.value = String(reader.result || '');
            };
            reader.readAsText(file, 'utf-8');
          });
        }

        // Colar do clipboard (se permitido)
        const pasteBtn = modal.querySelector('#pasteClipboard');
        if (pasteBtn && navigator.clipboard?.readText) {
          pasteBtn.onclick = async () => {
            try {
              textArea.value = await navigator.clipboard.readText();
            } catch (e) {
              window.alert('Não foi possível ler do clipboard neste navegador.');
            }
          };
        }

        // Confirmar import
        const confirmBtn = modal.querySelector('#modalConfirm');
        confirmBtn.onclick = () => {
          const raw = textArea.value?.trim();
          if (!raw) {
            window.alert('Cole o JSON ou selecione um arquivo.');
            return;
          }
          try {
            // se já existir importHierarchy, usa; senão, parse básico
            if (typeof window.importHierarchy === 'function') {
              window.importHierarchy(raw, { mode: 'replace', validate: true });
            } else {
              const parsed = JSON.parse(raw);
              window.structure = parsed;
              if (typeof window.renderTree === 'function') window.renderTree();
            }
            modal.remove();
            window.alert('✅ Importado com sucesso!');
          } catch (err) {
            console.error(err);
            window.alert('❌ [confirmBtn.onclick] JSON inválido: ' + err.message);
          }
        };

        return; // importante: encerra o branch do importJson
      }

      modal.remove();
      window.renderTree();
    };

    modal.querySelector('#modalClose').onclick = () => {
      modal.remove();
    };
  };

  // ===================== Ingestion API Functions =====================

  // Function to create customer in Ingestion API
  async function createCustomerInIngestion(customerData) {
    try {
      const token = await MyIOAuth.getToken();
      const response = await fetch('https://api.staging.data.apps.myio-bas.com/api/v1/management/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(customerData),
      });

      if (!response.ok) {
        throw new Error(
          `'[createCustomerInIngestion] Ingestion API error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('[createCustomerInIngestion] Error creating customer in Ingestion:', error);
      throw error;
    }
  }

  // Function to create asset in Ingestion API
  async function createAssetInIngestion(assetData) {
    try {
      const token = await MyIOAuth.getToken();
      const response = await fetch('https://api.staging.data.apps.myio-bas.com/api/v1/management/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assetData),
      });

      if (!response.ok) {
        throw new Error(`Ingestion API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[createAssetInIngestion] Error creating asset in Ingestion:', error);
      throw error;
    }
  }

  // Function to create device in Ingestion API
  async function createDeviceInIngestion(deviceData) {
    try {
      const token = await MyIOAuth.getToken();
      const response = await fetch('https://api.staging.data.apps.myio-bas.com/api/v1/management/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        throw new Error(`Ingestion API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[createDeviceInIngestion] Error creating device in Ingestion:', error);
      throw error;
    }
  }

  // Function to create gateway in Ingestion API
  // Function to create gateway in Ingestion API
  async function createGatewayInIngestion(gatewayData) {
    try {
      // 1) Garante hardwareUuid
      const DEFAULT_HW_UUID = 'a77ac87c-addd-4172-a65f-0f6f6038e98e';
      const isUuidLike = (v) =>
        typeof v === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      if (!gatewayData || typeof gatewayData !== 'object') {
        throw new Error('[createGatewayInIngestion] gatewayData inválido (esperado objeto).');
      }

      if (!isUuidLike(gatewayData.hardwareUuid)) {
        console.warn('[createGatewayInIngestion] hardwareUuid ausente/ inválido — aplicando default.');
        gatewayData.hardwareUuid = DEFAULT_HW_UUID;
      }

      // 2) Token + POST
      const token = await MyIOAuth.getToken();
      const response = await fetch('https://api.staging.data.apps.myio-bas.com/api/v1/management/gateways', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(gatewayData),
      });

      if (!response.ok) {
        throw new Error(`Ingestion API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[createGatewayInIngestion] Error creating gateway in Ingestion:', error);
      throw error;
    }
  }

  // Function to save Ingestion ID as SERVER_SCOPE attribute
  async function saveIngestionIdAttribute(entityId, entityType, ingestionId, attributeName) {
    try {
      const token = localStorage.getItem('jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        'X-Authorization': 'Bearer ' + token,
      };

      const attributeData = {};
      attributeData[attributeName] = ingestionId;

      const response = await fetch(
        `/api/plugins/telemetry/${entityType}/${entityId}/attributes/SERVER_SCOPE`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(attributeData),
        }
      );

      if (!response.ok) {
        throw new Error(`Error saving ${attributeName}: ${response.status} ${response.statusText}`);
      }

      console.log(
        `[saveIngestionIdAttribute] Successfully saved ${attributeName}: ${ingestionId} for ${entityType} ${entityId}`
      );
    } catch (error) {
      console.error(`[saveIngestionIdAttribute] Error saving ${attributeName}:`, error);
      throw error;
    }
  }

  // Create limited version of saveIngestionIdAttribute for concurrent calls
  // const saveIngestionAttrLimited = createLimiter(
  //   (deviceId, attrName, ingestionId) => saveIngestionIdAttribute(deviceId, 'DEVICE', ingestionId, attrName),
  //   8
  // );

  // ===================== Sync Status Functions =====================

  // Function to sync gateway status (mocked for now as per RFC)
  async function syncGatewayStatus(gateway) {
    try {
      // For now, use mocked response as per RFC requirements
      // In the future, this will call the actual status endpoint

      const mockStatuses = ['pending', 'in_progress', 'completed', 'failed'];
      const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];

      // Update the latest job status in central_log
      if (gateway.central_log && gateway.central_log.length > 0) {
        const latestJob = gateway.central_log[gateway.central_log.length - 1];
        latestJob.status = randomStatus;
        latestJob.message = `Status atualizado: ${randomStatus} (MOCK)`;
        latestJob.lastChecked = tsStampBR();
      }

      // Update status_sync based on job status
      if (randomStatus === 'completed') {
        updateStatusSync(gateway, 'central', 'sync_ok', `Job concluído com sucesso (MOCK)`);
      } else if (randomStatus === 'failed') {
        updateStatusSync(gateway, 'central', 'sync_failed', `Job falhou (MOCK)`);
      } else {
        updateStatusSync(gateway, 'central', 'sync_pending', `Job em andamento: ${randomStatus} (MOCK)`);
      }

      return {
        status: randomStatus,
        message: `Status sincronizado: ${randomStatus}`,
        timestamp: tsStampBR(),
      };
    } catch (error) {
      updateStatusSync(gateway, 'central', 'sync_failed', `Erro ao sincronizar status: ${error.message}`);
      throw error;
    }
  }

  // Function to show sync status modal
  window.showSyncStatusModal = function (gatewayPath) {
    const gateway = eval(gatewayPath);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.width = '500px';

    const heading = document.createElement('h3');
    heading.textContent = `🔄 Status de Sincronização - ${gateway.name}`;
    modalContent.appendChild(heading);

    // Status display area
    const statusArea = document.createElement('div');
    statusArea.id = 'statusArea';
    statusArea.style.cssText =
      'margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;';

    function updateStatusDisplay() {
      const centralLog = gateway.central_log || [];
      const latestJob = centralLog[centralLog.length - 1];

      let statusHtml = '<h4>📊 Status Atual:</h4>';

      if (latestJob) {
        statusHtml += `
        <p><strong>Job ID:</strong> ${latestJob.jobId}</p>
        <p><strong>Status:</strong> <span style="color: ${getStatusColor(latestJob.status)}">${
          latestJob.status
        }</span></p>
        <p><strong>Mensagem:</strong> ${latestJob.message}</p>
        <p><strong>Última Verificação:</strong> ${latestJob.lastChecked || latestJob.timestamp}</p>
      `;
      } else {
        statusHtml += '<p>Nenhum job de provisionamento encontrado.</p>';
      }

      if (centralLog.length > 1) {
        statusHtml += '<h4>📋 Histórico:</h4><ul>';
        centralLog.slice(-5).forEach((log) => {
          statusHtml += `<li><small>${log.timestamp}: ${log.message}</small></li>`;
        });
        statusHtml += '</ul>';
      }

      statusArea.innerHTML = statusHtml;
    }

    function getStatusColor(status) {
      switch (status) {
        case 'completed':
          return '#28a745';
        case 'failed':
          return '#dc3545';
        case 'in_progress':
          return '#ffc107';
        case 'pending':
          return '#6c757d';
        default:
          return '#6c757d';
      }
    }

    updateStatusDisplay();
    modalContent.appendChild(statusArea);

    // Action buttons
    const buttonArea = document.createElement('div');
    buttonArea.className = 'modal-actions';
    buttonArea.style.marginTop = '20px';

    const syncButton = document.createElement('button');
    syncButton.className = 'btn btn-primary';
    syncButton.innerHTML = '<i>🔄</i> Sincronizar Status';
    syncButton.onclick = async () => {
      syncButton.disabled = true;
      syncButton.innerHTML = '<i>⏳</i> Sincronizando...';

      try {
        await syncGatewayStatus(gateway);
        updateStatusDisplay();
        window.renderTree(); // Update the main tree view
      } catch (error) {
        window.alert('Erro ao sincronizar status: ' + error.message);
      } finally {
        syncButton.disabled = false;
        syncButton.innerHTML = '<i>🔄</i> Sincronizar Status';
      }
    };

    const closeButton = document.createElement('button');
    closeButton.className = 'btn btn-ghost';
    closeButton.innerHTML = '<i>✖</i> Fechar';
    closeButton.onclick = () => modal.remove();

    buttonArea.appendChild(syncButton);
    buttonArea.appendChild(closeButton);
    modalContent.appendChild(buttonArea);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  };

  // ================== INGESTION SYNC: HELPERS ==================

  // Busca devices na Ingestion API por customerId
  // async function fetchIngestionDevices(customerId, ingestionJwt) {
  //   if (!ingestionJwt) throw new Error('JWT da Ingestion API ausente.');
  //   const url = 'https://api.staging.data.apps.myio-bas.com/api/internal-mgmt/devices';
  //   const res = await fetch(url, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       Authorization: `Bearer ${ingestionJwt}`,
  //     },
  //     body: JSON.stringify({ customerId }),
  //   });
  //   if (!res.ok) {
  //     const t = await res.text().catch(() => '');
  //     throw new Error(`Ingestion API falhou (HTTP ${res.status}) ${t}`);
  //   }
  //   const json = await res.json();
  //   const list = Array.isArray(json?.data) ? json.data : [];
  //   return list;
  // }

  // ===================== Helper Functions =====================

  // ===================== New Create/Update Structure Function =====================

  window.createOrUpdateStructure = async function () {
    const token = localStorage['jwt_token'];
    if (!token) {
      window.alert('⚠️ Token de autenticação não disponível. Verifique permissões ou tipo de widget.');
      return;
    }

    if (!window.structure || !Array.isArray(window.structure) || window.structure.length === 0) {
      window.alert('⚠️ Nenhuma estrutura encontrada para processar.');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const loading = document.createElement('div');
    loading.className = 'modal-overlay';
    loading.innerHTML = `<div class="modal-content"><h3>⏳ Processando estrutura...</h3><div id="loadingStatus">Iniciando...</div></div>`;
    document.body.appendChild(loading);

    const updateLoadingStatus = (message) => {
      const statusDiv = loading.querySelector('#loadingStatus');
      if (statusDiv) {
        statusDiv.textContent = message;
      }
    };

    try {
      // Step 0: Add status_sync to all nodes
      updateLoadingStatus('Adicionando status_sync aos nós...');
      addStatusSyncToStructure(window.structure);

      // Step 1: Create hierarchy in ThingsBoard (customers, assets, devices, relations)
      updateLoadingStatus('Criando hierarquia no ThingsBoard...');
      await createHierarchyInternal(headers, updateLoadingStatus);

      // Step 2: Save structure to AllCustomersSetupStructure device
      updateLoadingStatus('Salvando estrutura no ThingsBoard...');
      await saveStructureToThingsBoard(window.structure, headers, updateLoadingStatus);

      // Step 3: Process each gateway
      updateLoadingStatus('Processando gateways...');
      await processAllGateways(window.structure, headers, updateLoadingStatus);

      updateLoadingStatus('Processo concluído com sucesso!');
      setTimeout(() => {
        document.body.removeChild(loading);
        window.alert('✅ Estrutura criada/atualizada com sucesso!');
        window.renderTree(); // Re-render to show updated status
      }, 1500);
    } catch (err) {
      console.error('[createOrUpdateStructure] Erro no processo:', err);
      window.alert('❌ Erro: ' + err.message);
      document.body.removeChild(loading);
    }
  };

  // Function to save structure as attribute in AllCustomersSetupStructure device
  async function saveStructureToThingsBoard(structure, headers, updateStatus) {
    try {
      // Generate attribute name based on customer name
      const customerName = getTopCustomerName();
      const attributeName =
        customerName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w]+/g, '_')
          .replace(/^_+|_+$/g, '') + '_setup_structure';

      updateStatus(`Usando device AllCustomersSetupStructure...`);

      // Use the hardcoded device ID to avoid permission issues
      const deviceId = 'b0554730-7ce1-11f0-a06d-e9509531b1d5';

      updateStatus(`Device configurado. Salvando como atributo: ${attributeName}`);

      const attributeData = {};
      attributeData[attributeName] = JSON.stringify(structure);

      const response = await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, {
        method: 'POST',
        headers,
        body: JSON.stringify(attributeData),
      });

      if (!response.ok) {
        throw new Error(`Erro ao salvar atributo: ${response.status} ${response.statusText}`);
      }

      // Update status for all root customers
      structure.forEach((customer) => {
        updateStatusSync(customer, 'thingsboard', 'sync_ok', 'Estrutura salva como atributo no ThingsBoard');
      });

      updateStatus('Estrutura salva com sucesso!');
    } catch (error) {
      // Update status for all root customers
      structure.forEach((customer) => {
        updateStatusSync(
          customer,
          'thingsboard',
          'sync_failed',
          `Erro ao salvar estrutura: ${error.message}`
        );
      });
      throw error;
    }
  }

  // Function to process all gateways in the structure
  async function processAllGateways(structure, headers, updateStatus) {
    const allGateways = collectAllGateways(structure);

    for (let i = 0; i < allGateways.length; i++) {
      const gateway = allGateways[i];
      updateStatus(`Processando gateway ${i + 1}/${allGateways.length}: ${gateway.name}`);

      try {
        // Step: Create gateway device in ThingsBoard and get credentials
        await createGatewayInThingsBoard(gateway, headers);

        // Step: Call provision_central API
        await provisionCentralAPI(gateway, structure);
      } catch (error) {
        console.error(`[processAllGateways] Erro ao processar gateway ${gateway.name}:`, error);
        updateStatusSync(gateway, 'central', 'sync_failed', `Erro: ${error.message}`);
        updateStatusSync(gateway, 'thingsboard', 'sync_failed', `Erro: ${error.message}`);
      }
    }
  }

  // Function to collect all gateways from structure
  function collectAllGateways(structure) {
    const gateways = [];

    function walkCustomer(customer) {
      (customer.gateways || []).forEach((gateway) => gateways.push(gateway));
      (customer.assets || []).forEach((asset) => walkAsset(asset));
      (customer.children || []).forEach((child) => walkCustomer(child));
    }

    function walkAsset(asset) {
      (asset.gateways || []).forEach((gateway) => gateways.push(gateway));
      (asset.children || []).forEach((child) => walkAsset(child));
      (asset.subAssets || []).forEach((subAsset) => walkAsset(subAsset));
    }

    structure.forEach((customer) => walkCustomer(customer));
    return gateways;
  }

  async function setMqttBasicCredentials(device, headers) {
    // 1) Buscar o objeto de credenciais (para obter o id interno)
    const getRes = await fetch(`/api/device/${device.id.id}/credentials`, {
      method: 'GET',
      headers,
    });
    if (!getRes.ok) {
      throw new Error(`Erro ao obter credenciais (GET): ${getRes.status}`);
    }
    const currentCreds = await getRes.json();
    const credentialsId = currentCreds?.id?.id;
    if (!credentialsId) {
      throw new Error('ID de credenciais não encontrado.');
    }

    // 2) Gerar clientId/userName/password (usa WebCrypto se disponível)
    function randString(len = 24) {
      if (window.crypto?.getRandomValues) {
        const arr = new Uint8Array(len);
        window.crypto.getRandomValues(arr);
        return Array.from(arr)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
      // fallback simples
      return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
    const clientId = randString(16);
    const userName = randString(20);
    const password = randString(24);

    const credsValue = JSON.stringify({ clientId, userName, password });

    // 3) POST para definir MQTT_BASIC
    const payload = {
      id: { id: credentialsId },
      deviceId: {
        entityType: device.id.entityType.toUpperCase(),
        id: device.id.id,
      },
      credentialsType: 'MQTT_BASIC',
      credentialsId: null, // para MQTT_BASIC fica null
      credentialsValue: credsValue, // JSON com clientId/userName/password
      version: 1,
    };

    const postRes = await fetch(`/api/device/credentials`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!postRes.ok) {
      const t = await postRes.text();
      throw new Error(`Erro definindo credenciais (POST): ${postRes.status} ${t}`);
    }

    // Retorna os valores prontos para você guardar no gateway
    return { clientId, userName, password };
  }

  // Function to get MQTT credentials for existing gateway device in ThingsBoard
  async function createGatewayInThingsBoard(gateway, headers) {
    try {
      updateStatusSync(
        gateway,
        'thingsboard',
        'not_started',
        'Obtendo credenciais do gateway no ThingsBoard'
      );

      // Check if gateway device was already created during hierarchy creation
      if (!gateway.thingsboard_device_id) {
        throw new Error(
          'Gateway device ID não encontrado. O device deve ter sido criado durante a criação da hierarquia.'
        );
      }

      const deviceId = gateway.thingsboard_device_id;

      // Get device credentials (this will create MQTT credentials)
      const credentialsResponse = await fetch(`/api/device/${deviceId}/credentials`, {
        method: 'GET',
        headers,
      });

      if (!credentialsResponse.ok) {
        throw new Error(`Erro ao obter credenciais: ${credentialsResponse.status}`);
      }

      const credentials = await credentialsResponse.json();

      // Update gateway with real credentials
      gateway.credentials.mqtt.clientId = credentials.credentialsId || `client_${deviceId}`;
      gateway.credentials.mqtt.username = credentials.credentialsId || `user_${deviceId}`;
      gateway.credentials.mqtt.password = credentials.credentialsValue || `pass_${deviceId}`;

      updateStatusSync(gateway, 'thingsboard', 'sync_ok', 'Credenciais do gateway obtidas com sucesso');
    } catch (error) {
      updateStatusSync(gateway, 'thingsboard', 'sync_failed', `Erro ao obter credenciais: ${error.message}`);
      throw error;
    }
  }
  // Helper: tenta montar a lista de devices para provisionamento
  function buildProvisionDevicesForGateway(gw) {
    console.log('[buildProvisionDevicesForGateway] Processing gateway:', gw.name, 'UUID:', gw.uuid);

    // Caso o gateway já tenha uma lista "pronta", respeite-a
    if (Array.isArray(gw.provisionDevices) && gw.provisionDevices.length) {
      console.log(
        '[buildProvisionDevicesForGateway] Using pre-defined provisionDevices:',
        gw.provisionDevices.length
      );
      return gw.provisionDevices.map((d) => ({
        id: Number(d.central_device_id ?? d.addr_low ?? d.id ?? 0),
        name: d.name,
        type: mapCentralDeviceType(d.name || d.type),
        addr_low: Number(d.addr_low ?? d.central_device_id ?? d.id ?? 0),
        addr_high: Number(d.addr_high ?? 248),
      }));
    }

    // Caso contrário, tente aproveitar devices pendurados diretamente no objeto (quando existir)
    if (Array.isArray(gw.devices) && gw.devices.length) {
      console.log('[buildProvisionDevicesForGateway] Using gateway.devices:', gw.devices.length);
      return gw.devices.map((d) => ({
        id: Number(d.central_device_id ?? d.addr_low ?? d.id ?? 0),
        name: d.name,
        type: mapCentralDeviceType(d.name || d.type),
        addr_low: Number(d.addr_low ?? d.central_device_id ?? d.id ?? 0),
        addr_high: Number(d.addr_high ?? 248),
      }));
    }

    // Se não há devices diretos no gateway, procure na estrutura global
    // Encontre todos os devices que pertencem ao mesmo asset que contém este gateway
    const devices = [];
    console.log('[buildProvisionDevicesForGateway] Searching in global structure for gateway:', gw.name);

    function findDevicesInStructure(structure) {
      if (!Array.isArray(structure)) return;

      structure.forEach((customer, customerIndex) => {
        console.log('[buildProvisionDevicesForGateway] Checking customer:', customer.name);

        // Procurar em assets do customer
        if (Array.isArray(customer.assets)) {
          customer.assets.forEach((asset, assetIndex) => {
            console.log('[buildProvisionDevicesForGateway] Checking asset:', asset.name);
            findDevicesInAsset(asset, `customer[${customerIndex}].assets[${assetIndex}]`);
          });
        }

        // Procurar em sub-customers
        if (Array.isArray(customer.children)) {
          findDevicesInStructure(customer.children);
        }
      });
    }

    function findDevicesInAsset(asset, assetPath) {
      console.log('[buildProvisionDevicesForGateway] Checking asset:', asset.name, 'at path:', assetPath);

      // Verificar se este asset contém o gateway
      const hasThisGateway =
        Array.isArray(asset.gateways) &&
        asset.gateways.some((g) => {
          const match =
            g.uuid === gw.uuid ||
            g.name === gw.name ||
            (g.thingsboard_device_id && g.thingsboard_device_id === gw.thingsboard_device_id);
          if (match) {
            console.log('[buildProvisionDevicesForGateway] Found matching gateway in asset:', asset.name);
          }
          return match;
        });

      if (hasThisGateway) {
        console.log(
          '[buildProvisionDevicesForGateway] Asset contains target gateway, collecting devices from:',
          asset.name
        );

        // Se este asset contém o gateway, coletar todos os devices deste asset
        if (Array.isArray(asset.devices)) {
          console.log('[buildProvisionDevicesForGateway] Found', asset.devices.length, 'devices in asset');
          asset.devices.forEach((device, deviceIndex) => {
            console.log(
              '[buildProvisionDevicesForGateway] Processing device:',
              device.name,
              'addr_low:',
              device.addr_low
            );

            const deviceData = {
              id: Number(device.central_device_id ?? device.addr_low ?? device.id ?? 0),
              name: device.name,
              type: mapCentralDeviceType(device.name || device.type),
              addr_low: Number(device.addr_low ?? device.central_device_id ?? device.id ?? 0),
              addr_high: Number(device.addr_high ?? 248),
            };

            devices.push(deviceData);
            console.log('[buildProvisionDevicesForGateway] Added device:', deviceData);

            // Também coletar devices filhos (device->device)
            collectDeviceChildren(device, `${assetPath}.devices[${deviceIndex}]`);
          });
        }

        // Também coletar devices de sub-assets deste asset
        if (Array.isArray(asset.children)) {
          asset.children.forEach((subAsset, subIndex) => {
            console.log(
              '[buildProvisionDevicesForGateway] Collecting from sub-asset (children):',
              subAsset.name
            );
            collectDevicesFromAssetRecursive(subAsset, `${assetPath}.children[${subIndex}]`);
          });
        }

        if (Array.isArray(asset.subAssets)) {
          asset.subAssets.forEach((subAsset, subIndex) => {
            console.log(
              '[buildProvisionDevicesForGateway] Collecting from sub-asset (subAssets):',
              subAsset.name
            );
            collectDevicesFromAssetRecursive(subAsset, `${assetPath}.subAssets[${subIndex}]`);
          });
        }
      } else {
        // Continuar procurando em sub-assets mesmo se este asset não contém o gateway
        if (Array.isArray(asset.children)) {
          asset.children.forEach((subAsset, subIndex) => {
            findDevicesInAsset(subAsset, `${assetPath}.children[${subIndex}]`);
          });
        }

        if (Array.isArray(asset.subAssets)) {
          asset.subAssets.forEach((subAsset, subIndex) => {
            findDevicesInAsset(subAsset, `${assetPath}.subAssets[${subIndex}]`);
          });
        }
      }
    }

    function collectDevicesFromAssetRecursive(asset, assetPath) {
      console.log('[buildProvisionDevicesForGateway] Recursively collecting from asset:', asset.name);

      if (Array.isArray(asset.devices)) {
        asset.devices.forEach((device, deviceIndex) => {
          const deviceData = {
            id: Number(device.central_device_id ?? device.addr_low ?? device.id ?? 0),
            name: device.name,
            type: mapCentralDeviceType(device.name || device.type),
            addr_low: Number(device.addr_low ?? device.central_device_id ?? device.id ?? 0),
            addr_high: Number(device.addr_high ?? 248),
          };

          devices.push(deviceData);
          console.log('[buildProvisionDevicesForGateway] Added device from sub-asset:', deviceData);

          // Também coletar devices filhos (device->device)
          collectDeviceChildren(device, `${assetPath}.devices[${deviceIndex}]`);
        });
      }

      // Continuar recursivamente
      if (Array.isArray(asset.children)) {
        asset.children.forEach((subAsset, subIndex) => {
          collectDevicesFromAssetRecursive(subAsset, `${assetPath}.children[${subIndex}]`);
        });
      }

      if (Array.isArray(asset.subAssets)) {
        asset.subAssets.forEach((subAsset, subIndex) => {
          collectDevicesFromAssetRecursive(subAsset, `${assetPath}.subAssets[${subIndex}]`);
        });
      }
    }

    function collectDeviceChildren(device, devicePath) {
      if (Array.isArray(device.children)) {
        console.log('[buildProvisionDevicesForGateway] Collecting device children from:', device.name);
        device.children.forEach((childDevice, childIndex) => {
          const childDeviceData = {
            id: Number(childDevice.central_device_id ?? childDevice.addr_low ?? childDevice.id ?? 0),
            name: childDevice.name,
            type: mapCentralDeviceType(childDevice.name || childDevice.type),
            addr_low: Number(childDevice.addr_low ?? childDevice.central_device_id ?? childDevice.id ?? 0),
            addr_high: Number(childDevice.addr_high ?? 248),
          };

          devices.push(childDeviceData);
          console.log('[buildProvisionDevicesForGateway] Added child device:', childDeviceData);

          // Recursivamente coletar devices filhos
          collectDeviceChildren(childDevice, `${devicePath}.children[${childIndex}]`);
        });
      }
    }

    // Procurar na estrutura global
    if (window.structure) {
      findDevicesInStructure(window.structure);
    }

    console.log('[buildProvisionDevicesForGateway] Final devices collected:', devices.length, devices);
    return devices;
  }

  // Helper: ambients opcionais (enviar vazio se não mapeados)
  function buildProvisionAmbientsForGateway(gw) {
    if (Array.isArray(gw.ambients) && gw.ambients.length) {
      return gw.ambients.map((a) => ({
        id: Number(a.id ?? 0),
        name: a.name ?? '',
        devices: Array.isArray(a.devices) ? a.devices.map(Number) : [],
      }));
    }
    return [];
  }

  // Helper: polling de job até terminal (COMPLETED/FAILED/CANCELED) ou timeout
  async function pollProvisioningJob(baseUrl, jobId, onTick) {
    const url = `${baseUrl.replace(/\/$/, '')}/jobs/${jobId}`;
    const started = Date.now();
    const timeoutMs = 90_000; // 90s
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    let lastProgress = '';

    for (;;) {
      const r = await fetch(url, { method: 'GET' });
      if (!r.ok) throw new Error(`Falha ao consultar job ${jobId}: HTTP ${r.status}`);
      const j = await r.json();

      const status = String(j.status || '').toUpperCase();
      const progress = String(j.progress || '');
      const msg = `Job ${jobId}: ${status}${progress && progress !== lastProgress ? ` • ${progress}` : ''}`;
      if (onTick) onTick({ status, progress, payload: j, message: msg });
      lastProgress = progress;

      if (['COMPLETED', 'FAILED', 'CANCELED'].includes(status)) return j;
      if (Date.now() - started > timeoutMs) throw new Error(`Timeout consultando job ${jobId}`);
      await delay(2000);
    }
  }

  async function provisionCentralAPI(gw, logFn = console.log) {
    try {
      updateStatusSync(gw, 'central', 'not_started', 'Iniciando provisionamento da central');

      // BYPASS para ambiente de dev
      // Validações mínimas
      if (!gw['ipv6-yggdrasil']) throw new Error('IPv6 Yggdrasil não encontrado no gateway');
      if (!gw.uuid) throw new Error('UUID não encontrado no gateway');

      // Endpoint
      /* TODO TROCAR LOCAL
        const baseProvisioning = (gw.provisioningEndpoint && gw.provisioningEndpoint.trim())
        ? gw.provisioningEndpoint.trim()
        : `https://provisioning.apps.myio-bas.com`;
        const endpoint = `${baseProvisioning.replace(/\/$/, "")}/centrals/${gw.uuid}/provision`;
        */

      const baseProvisioning =
        gw.provisioningEndpoint && gw.provisioningEndpoint.trim()
          ? gw.provisioningEndpoint.trim()
          : `https://a9bd04b0db2e.ngrok-free.app`;
      const endpoint = `${baseProvisioning.replace(/\/$/, '')}/centrals/${gw.uuid}/provision`;

      // central_id (array de 4 números). Se vier string "21.154.131.001", converte; se não vier, gera.
      const centralIdStr =
        gw.centralId ||
        (typeof gw.central_id === 'string' ? gw.central_id : null) ||
        gerarCentralId(window.currentDDD, window.currentCNPJ, gw.gatewayId || 1);
      const centralIdArr = Array.isArray(gw.central_id) ? gw.central_id : centralIdToArray(centralIdStr);

      // frequency e nome
      const frequency = Number(gw.frequency || 90);
      const name = gw.name || `Central ${centralIdStr}`;

      // Credenciais MQTT (já preenchidas quando pegamos do TB)
      // (Se não existir, caímos no default do host MQTT)
      const mqttCreds = {
        server: gw.credentials?.mqtt?.server || 'mqtt://mqtt.myio-bas.com',
        clientId: gw.credentials?.mqtt?.clientId || `client_${gw.thingsboard_device_id || gw.uuid}`,
        username: gw.credentials?.mqtt?.username || `user_${gw.thingsboard_device_id || gw.uuid}`,
        password: gw.credentials?.mqtt?.password || `pass_${gw.thingsboard_device_id || gw.uuid}`,
      };

      // Devices & Ambients
      const devices = buildProvisionDevicesForGateway(gw);
      const ambients = buildProvisionAmbientsForGateway(gw);

      // Add channels logic only during POST call to central
      const devicesWithChannels = devices.map((device) => {
        const deviceData = { ...device };

        // Check if device name starts with "Hidr" (case insensitive)
        if (device.name && device.name.toLowerCase().includes('hidr')) {
          deviceData.channels = [
            {
              name: device.name + ' Sensor',
              channel: 0,
              type: 'presence_sensor',
            },
            {
              name: device.name,
              channel: 1,
              type: 'flow_sensor',
            },
          ];
        }

        return deviceData;
      });

      // Corpo da requisição (conforme contrato)
      const body = {
        central_id: centralIdArr, // [DDD, YYY, WWW, GGG]
        frequency,
        name,
        ipv6: gw['ipv6-yggdrasil'],
        credentials: { mqtt: mqttCreds },
        devices: devicesWithChannels,
        ambients,
      };

      // Chamada ao endpoint
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Erro na API de provisionamento: HTTP ${res.status} ${res.statusText} ${txt}`);
      }
      const json = await res.json().catch(() => ({}));
      const jobId = json?.jobId;
      if (!jobId) throw new Error('JobID não retornado pela API de provisionamento');

      // Log inicial + status_ok (iniciado)
      gw.central_log ||= [];
      gw.central_log.push({
        timestamp: tsStampBR(),
        jobId,
        status: 'pending',
        message: 'Provisionamento iniciado',
      });
      updateStatusSync(gw, 'central', 'sync_ok', `Provisionamento iniciado - JobID: ${jobId}`);
      updateStatusSync(gw, 'ingestion', 'sync_ok', 'Ingestion configurada automaticamente');

      // Polling do job para refletir progresso/estado
      try {
        const job = await pollProvisioningJob(baseProvisioning, jobId, (tick) => {
          gw.central_log.push({
            timestamp: tsStampBR(),
            jobId,
            status: tick.status,
            message: tick.message,
          });
        });
        const terminal = String(job.status || '').toUpperCase();
        if (terminal === 'COMPLETED') {
          updateStatusSync(gw, 'central', 'sync_ok', `Provisionamento concluído - JobID: ${jobId}`);
        } else {
          updateStatusSync(
            gw,
            'central',
            'sync_failed',
            `Provisionamento terminou como ${terminal} - JobID: ${jobId}`
          );
        }
      } catch (pollErr) {
        updateStatusSync(gw, 'central', 'sync_failed', `Erro ao acompanhar job: ${pollErr.message}`);
        throw pollErr;
      }
    } catch (err) {
      updateStatusSync(gw, 'central', 'sync_failed', `Erro no provisionamento: ${err.message}`);
      updateStatusSync(gw, 'ingestion', 'sync_failed', `Erro no provisionamento: ${err.message}`);
      throw err;
    }
  }

  // Internal function to create hierarchy (used by createOrUpdateStructure)
  async function createHierarchyInternal(headers, updateStatus) {
    window.lastCreatedCustomerId = null; // Guarda o último customer criado
    let currentCustomerName = null; // Guarda o nome do customer atual
    window.lastCreatedIngestionCustomerId = null; // Guarda o último customer ID do Ingestion

    async function post(path, data, retries = 3) {
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error(`Erro ${res.status}`);

        const text = await res.text();
        if (!text) return {};

        try {
          return JSON.parse(text);
        } catch (jsonErr) {
          console.warn('[createHierarchyInternal | post] Resposta não é JSON válido:', text);
          return {};
        }
      } catch (err) {
        if (retries > 0) return await post(path, data, retries - 1);
        throw err;
      }
    }

    async function createRecursive(customerObj, parentCustomerId = null, parentIngestionCustomerId = null) {
      updateStatus(`Criando cliente no Ingestion: ${customerObj.name}`);

      // Step 1: Create customer in Ingestion API first
      const ingestionCustomerData = {
        name: customerObj.name,
        description: customerObj.description || `Customer ${customerObj.name}`,
        parentId: parentIngestionCustomerId,
      };

      if (!parentIngestionCustomerId) {
        delete ingestionCustomerData.parentId;
      }

      const ingestionCustomer = await createCustomerInIngestion(ingestionCustomerData);
      const ingestionCustomerId = ingestionCustomer.data.id;
      window.lastCreatedIngestionCustomerId = ingestionCustomerId;

      updateStatus(`Criando cliente no ThingsBoard: ${customerObj.name}`);

      // Step 2: Create customer in ThingsBoard
      const customer = await post('/api/customer', { title: customerObj.name });
      const customerId = customer.id.id;
      window.lastCreatedCustomerId = customerId;
      currentCustomerName = customerObj.name;
      customerObj._created = true;

      // Step 3: Save Ingestion customer ID as SERVER_SCOPE attribute
      await saveIngestionIdAttribute(customerId, 'CUSTOMER', ingestionCustomerId, 'customerId');

      if (parentCustomerId) {
        await post('/api/relation', {
          from: { entityType: 'CUSTOMER', id: parentCustomerId },
          to: { entityType: 'CUSTOMER', id: customerId },
          type: 'Contains',
          typeGroup: 'COMMON',
        });
      }

      for (const g of customerObj.gateways || []) {
        updateStatus(`Criando gateway no Ingestion: ${g.name}`);

        // Step 1: Create gateway in Ingestion API first
        const ingestionGatewayData = {
          id: g.uuid || g['ipv6-yggdrasil'] || `gateway-${Date.now()}`,
          name: g.name,
          description: `Gateway ${g.name}`,
          customerId: ingestionCustomerId,
          hardwareUuid: g.uuid,
        };

        const ingestionGateway = await createGatewayInIngestion(ingestionGatewayData);
        const ingestionGatewayId = ingestionGateway.data.id;

        updateStatus(`Criando gateway no ThingsBoard: ${g.name}`);

        // Step 2: Create gateway asset and device in ThingsBoard
        const gatewayAsset = await createAssetWithRelation(g.name, 'gateway', customerId, 'CUSTOMER');

        const gatewayDevice = await createDeviceWithCustomerAndAsset(
          g.name,
          'Gateway',
          window.lastCreatedCustomerId,
          gatewayAsset.id.id,
          null,
          currentCustomerName
        );

        // Step 3: Save Ingestion gateway ID as SERVER_SCOPE attribute
        await saveIngestionIdAttribute(gatewayDevice.id.id, 'DEVICE', ingestionGatewayId, 'gatewayId');

        g._created = true;
        g.thingsboard_device_id = gatewayDevice.id.id;
        g.ingestion_gateway_id = ingestionGatewayId;
      }

      for (const assetObj of customerObj.assets || []) {
        await createAssetRecursive(assetObj, customerId, null, ingestionCustomerId);
      }

      for (const child of customerObj.children || []) {
        await createRecursive(child, customerId, ingestionCustomerId);
      }
    }

    async function createAssetRecursive(
      assetObj,
      customerId,
      parentAssetId = null,
      ingestionCustomerId = null,
      parentIngestionAssetId = null,
      parentGatewayIdIngestion = null
    ) {
      updateStatus(`Criando asset no Ingestion: ${assetObj.name}`);

      // Step 1: Create asset in Ingestion API first
      const ingestionAssetData = {
        label: assetObj.name,
        description: `Asset ${assetObj.name}`,
        parentId: parentIngestionAssetId,
        customerId: ingestionCustomerId,
        status: 'active',
      };

      if (!parentIngestionAssetId) {
        delete ingestionAssetData.parentId;
      }

      const ingestionAsset = await createAssetInIngestion(ingestionAssetData);
      const ingestionAssetId = ingestionAsset.data.id;

      updateStatus(`Criando asset no ThingsBoard: ${assetObj.name}`);

      let gatewayIdIngestionMappedByAssetWithNoAssetParent = parentGatewayIdIngestion;
      //let gatewayIdThingsBoardMappedByAssetWithNoAssetParent;

      // Step 2: Create asset in ThingsBoard
      let asset;
      let assetId;

      if (parentAssetId === null) {
        asset = await createAssetWithRelation(assetObj.name, 'default', customerId, 'CUSTOMER');
        assetId = asset.id.id;

        for (const g of assetObj.gateways || []) {
          updateStatus(`Criando gateway no Ingestion: ${g.name}`);

          // Step 1: Create gateway in Ingestion API first
          const ingestionGatewayData = {
            id: g.uuid || g['ipv6-yggdrasil'] || `gateway-${Date.now()}`,
            name: g.name,
            description: `Gateway ${g.name}`,
            customerId: ingestionCustomerId,
            assetId: ingestionAssetId,
          };

          const ingestionGateway = await createGatewayInIngestion(ingestionGatewayData);
          const ingestionGatewayId = ingestionGateway.data.id;
          gatewayIdIngestionMappedByAssetWithNoAssetParent = ingestionGatewayId;

          updateStatus(`Criando gateway no ThingsBoard: ${g.name}`);

          // Step 2: Create gateway device in ThingsBoard
          const gatewayDevice = await createDeviceWithCustomerAndAsset(
            g.name,
            'Gateway',
            window.lastCreatedCustomerId,
            assetId,
            null,
            currentCustomerName
          );

          // Step 3: Save Ingestion gateway ID as SERVER_SCOPE attribute
          await saveIngestionIdAttribute(gatewayDevice.id.id, 'DEVICE', ingestionGatewayId, 'gatewayId');

          g._created = true;
          g.thingsboard_device_id = gatewayDevice.id.id;
          //gatewayIdThingsBoardMappedByAssetWithNoAssetParent = g.thingsboard_device_id;
          g.ingestion_gateway_id = ingestionGatewayId;

          // Set MQTT credentials for the gateway
          try {
            const mqttCreds = await setMqttBasicCredentials(gatewayDevice, headers);
            if (!g.credentials) g.credentials = { mqtt: {} };
            g.credentials.mqtt.clientId = mqttCreds.clientId;
            g.credentials.mqtt.username = mqttCreds.userName;
            g.credentials.mqtt.password = mqttCreds.password;
          } catch (credError) {
            console.warn('[createAssetRecursive | 5 params] Erro ao configurar credenciais MQTT:', credError);
            // Set default credentials if MQTT setup fails
            if (!g.credentials) g.credentials = { mqtt: {} };
            g.credentials.mqtt.clientId = `client_${gatewayDevice.id.id}`;
            g.credentials.mqtt.username = `user_${gatewayDevice.id.id}`;
            g.credentials.mqtt.password = `pass_${gatewayDevice.id.id}`;
          }
        }
      } else {
        asset = await createAssetWithParentAsset(assetObj.name, 'default', parentAssetId);
        assetId = asset.id.id;
      }

      if (!asset || !asset.id || !asset.id.id) {
        throw new Error(`Failed to create asset "${assetObj.name}" or get its ID.`);
      }

      assetObj._created = true;

      // Step 3: Save Ingestion asset ID as SERVER_SCOPE attribute
      await saveIngestionIdAttribute(assetId, 'ASSET', ingestionAssetId, 'assetId');

      for (const device of assetObj.devices || []) {
        updateStatus(`Criando device no Ingestion: ${device.name}`);

        // Step 1: Create device in Ingestion API first
        const ingestionDeviceData = {
          name: device.identifier,
          description: `${device.name}`,
          deviceType: mapToIngestionDeviceType(device.type),
          customerId: ingestionCustomerId,
          assetId: ingestionAssetId,
          slaveId: Number(device.addr_low) || 0,
        };

        // Only add gatewayId if we have one
        if (gatewayIdIngestionMappedByAssetWithNoAssetParent) {
          ingestionDeviceData.gatewayId = gatewayIdIngestionMappedByAssetWithNoAssetParent;
        }

        // Debug log to verify data types
        console.log('[createAssetRecursive] Device data for Ingestion API:', {
          name: device.identifier,
          deviceType: mapToIngestionDeviceType(device.type),
          slaveId: Number(device.addr_low) || 0,
          slaveIdType: typeof (Number(device.addr_low) || 0),
          gatewayId: gatewayIdIngestionMappedByAssetWithNoAssetParent,
          originalAddrLow: device.addr_low,
          originalType: device.type,
        });

        const ingestionDevice = await createDeviceInIngestion(ingestionDeviceData);
        const ingestionDeviceId = ingestionDevice.data.id;

        updateStatus(`Criando device no ThingsBoard: ${device.name}`);

        // Step 2: Create device in ThingsBoard
        const dev = await createDeviceWithCustomerAndAsset(
          device.name,
          device.type,
          window.lastCreatedCustomerId,
          assetId,
          device.identifier,
          currentCustomerName
        );

        // Step 3: Save Ingestion device ID as SERVER_SCOPE attribute
        await saveIngestionIdAttribute(dev.id.id, 'DEVICE', ingestionDeviceId, 'deviceId');

        device._created = true;
        device.thingsboard_device_id = dev.id.id;
        device.ingestion_device_id = ingestionDeviceId;
      }

      for (const subAsset of assetObj.subAssets || []) {
        await createAssetRecursive(
          subAsset,
          customerId,
          assetId,
          ingestionCustomerId,
          ingestionAssetId,
          gatewayIdIngestionMappedByAssetWithNoAssetParent
        );
        subAsset._created = true;
      }

      for (const sub of assetObj.children || []) {
        await createAssetRecursive(
          sub,
          customerId,
          assetId,
          ingestionCustomerId,
          ingestionAssetId,
          gatewayIdIngestionMappedByAssetWithNoAssetParent
        );
      }
    }

    // Process all root customers
    for (const root of window.structure) {
      await createRecursive(root);
    }
  }

  window.createHierarchy = async function () {
    const token = localStorage['jwt_token'];
    if (!token) {
      window.alert('⚠️ Token de autenticação não disponível. Verifique permissões ou tipo de widget.');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const loading = document.createElement('div');
    loading.className = 'modal-overlay';
    loading.innerHTML = `<div class="modal-content"><h3>⏳ Enviando estrutura...</h3></div>`;
    document.body.appendChild(loading);

    async function post(path, data, retries = 3) {
      console.log(path);
      console.log('data', data);
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error(`Erro ${res.status}`);

        const text = await res.text();
        if (!text) return {};

        try {
          return JSON.parse(text);
        } catch (jsonErr) {
          console.warn('Resposta não é JSON válido:', text);
          return {};
        }
      } catch (err) {
        if (retries > 0) return await post(path, data, retries - 1);
        throw err;
      }
    }

    async function createRecursive(customerObj, parentCustomerId = null) {
      const customer = await post('/api/customer', { title: customerObj.name });
      const customerId = customer.id.id;
      window.lastCreatedCustomerId = customerId; // Atualiza o último customer criado
      customerObj._created = true;

      if (parentCustomerId) {
        await post('/api/relation', {
          from: { entityType: 'CUSTOMER', id: parentCustomerId },
          to: { entityType: 'CUSTOMER', id: customerId },
          type: 'Contains',
          typeGroup: 'COMMON',
        });
      }

      for (const g of customerObj.gateways || []) {
        const asset = await post('/api/asset', {
          name: g.name,
          type: 'gateway',
          customerId,
        });
        g._created = true;
        await post(`/api/customer/${customerId}/asset/${asset.id.id}`, {});
      }

      for (const assetObj of customerObj.assets || []) {
        await createAssetRecursive(assetObj, customerId, null);
      }

      for (const child of customerObj.children || []) {
        await createRecursive(child, customerId);
      }
    }

    async function createAssetRecursive(assetObj, customerId, parentAssetId = null) {
      console.log('[createAssetRecursive | 3 params] asset', assetObj);

      let asset;

      if (parentAssetId === null) {
        asset = await createAssetWithRelation(assetObj.name, 'default', customerId, 'CUSTOMER');
      } else {
        asset = await createAssetWithParentAsset(assetObj.name, 'default', parentAssetId);
      }

      const assetId = asset.id.id;
      assetObj._created = true;

      for (const device of assetObj.devices || []) {
        console.log('[createAssetRecursive | 3 params] customerId', customerId);
        console.log('[createAssetRecursive | 3 params] assetId', assetId);
        // Agora passa o lastCreatedCustomerId para criação do device
        device._created = true;
      }

      for (const subAsset of assetObj.subAssets || []) {
        console.log('[createAssetRecursive | 3 params] Criando sub-asset:', subAsset.name);
        await createAssetRecursive(subAsset, customerId, assetId);
        subAsset._created = true;
      }

      for (const sub of assetObj.children || []) {
        await createAssetRecursive(sub, customerId, assetId);
      }

      for (const g of assetObj.gateways || []) {
        const gatewayAsset = await post('/api/asset', {
          name: g.name,
          type: 'gateway',
        });
        g._created = true;

        // Cria relação com asset pai
        await post('/api/relation', {
          from: { entityType: 'ASSET', id: assetId },
          to: { entityType: 'ASSET', id: gatewayAsset.id.id },
          type: 'Contains',
          typeGroup: 'COMMON',
        });
      }
    }

    // A função createDeviceWithCustomerAndAsset deve estar no seu código, conforme te passei antes.

    try {
      for (const root of window.structure) {
        await createRecursive(root);
      }
      window.alert('✅ Estrutura criada com sucesso!');
    } catch (err) {
      window.alert('❌ Erro: ' + err.message);
    } finally {
      document.body.removeChild(loading);
      window.renderTree();
    }
  };

  window.removeNode = function (path) {
    const parentPath = path.replace(/\[\d+\]$/, '');
    const key = path.match(/\[(\d+)\]$/)[1];
    const arr = eval(parentPath);
    arr.splice(key, 1);
    window.renderTree();
  };

  window.getIconPrefix = function (type) {
    const map = {
      COMPRESSOR: '🌀',
      VENTILADOR: '🌬️',
      SELETOR_AUTO_MANUAL: '🔀',
      TERMOSTATO: '🌡️',
      '3F_MEDIDOR': '📊',
      MOTOR: '⚙️',
      ESCADA_ROLANTE: '↕️',
      ELEVADOR: '🏗️',
      HIDROMETRO: '💧',
      SOLENOIDE: '🧲',
      CONTROLE_REMOTO: '🎮',
      CAIXA_D_AGUA: '🛢️',
      CONTROLE_AUTOMACAO: '🌐',
    };
    return map[type] || '🔌';
  };

  function renderDevice(device, path) {
    const dev = document.createElement('div');
    dev.className = 'tree-block';

    //const identifierText = device.identifier ? ` [ID: ${device.identifier}]` : '';
    const extras = [
      device.slaveId != null ? `slaveId: ${device.slaveId}` : null,
      device.centralId != null ? `centralId: ${device.centralId}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    dev.innerHTML = `
        ${window.getIconPrefix(device.type)} ${device.name} (${device.label}) → ${device.type}
        ${extras ? `<div class="meta small mt-1">${extras}</div>` : ''}
        <div class="btnbar" style="margin-top:8px;">
          <button class="btn btn-ghost"  onclick="openInfoModal('device','${path}')"><i>ℹ️</i> Detalhes</button>
          <button class="btn btn-danger" onclick="removeNode('${path}')"><i>🗑️</i> Remover</button>
        </div>
      `;

    // 🔁 filhos de device (device.children)
    (device.children || []).forEach((childDev, ci) => {
      dev.appendChild(renderDevice(childDev, `${path}.children[${ci}]`));
    });

    return dev;
  }

  function renderCustomer(customer, path) {
    const div = document.createElement('div');
    div.className = 'tree-block';

    const header = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `🧑‍💼 ${customer.name}`;
    title.style.cursor = 'pointer';
    title.onclick = () => {
      const n = prompt('Novo nome:', customer.name);
      if (n) {
        customer.name = n;
        window.renderTree();
      }
    };
    header.appendChild(title);
    div.appendChild(header);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btnbar';
    btnGroup.innerHTML = `
      <button class="btn btn-primary"  onclick="showModal('addCustomer','${path}')"><i>＋</i> Subcliente</button>
      <button class="btn btn-outline"  onclick="showModal('addGateway','${path}')"><i>🌐</i> Gateway</button>
      <button class="btn btn-outline"  onclick="showModal('addAsset','${path}')"><i>📦</i> Asset</button>
      <button class="btn btn-danger"   onclick="removeNode('${path}')"><i>🗑️</i> Remover</button>
    `;

    div.appendChild(btnGroup);

    customer.gateways.forEach((g) => {
      const gw = document.createElement('div');
      gw.className = 'tree-block';
      gw.textContent = `🌐 Gateway: ${g.name}`;
      div.appendChild(gw);
    });

    customer.assets.forEach((a, i) => {
      div.appendChild(renderAsset(a, `${path}.assets[${i}]`));
    });

    customer.children.forEach((child, i) => {
      div.appendChild(renderCustomer(child, `${path}.children[${i}]`));
    });

    return div;
  }

  function renderAsset(asset, path) {
    const div = document.createElement('div');
    div.className = 'tree-block';

    const header = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `📦 ${asset.name}`;
    title.style.cursor = 'pointer';
    title.onclick = () => {
      const n = prompt('Novo nome do asset:', asset.name);
      if (n) {
        asset.name = n;
        window.renderTree();
      }
    };

    header.appendChild(title);
    div.appendChild(header);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btnbar';
    btnGroup.innerHTML = `
      <button class="btn btn-primary" onclick="showModal('addSubAsset','${path}')"><i>＋</i> Subasset</button>
      <button class="btn btn-outline" onclick="showModal('addDevice','${path}')"><i>🔌</i> Device</button>
      <button class="btn btn-outline" onclick="showModal('addGateway','${path}')"><i>🌐</i> Gateway</button>
      <button class="btn btn-danger"  onclick="removeNode('${path}')"><i>🗑️</i> Remover</button>
    `;

    div.appendChild(btnGroup);

    // Gateways dentro do asset (se houver)
    (asset.gateways || []).forEach((g, gi) => {
      const gw = document.createElement('div');
      gw.className = 'tree-block';
      gw.innerHTML = `🌐 Gateway: ${g.name}
        <div class="btnbar" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="openInfoModal('gateway','${path}.gateways[${gi}]')"><i>ℹ️</i> Detalhes</button>
        </div>`;
      div.appendChild(gw);
    });

    asset.devices.forEach((d, di) => {
      div.appendChild(renderDevice(d, `${path}.devices[${di}]`));
    });

    asset.children.forEach((sub, i) => {
      div.appendChild(renderAsset(sub, `${path}.children[${i}]`));
    });

    // ✅ compat: se algum JSON ainda vier com 'assets'
    (asset.assets || []).forEach((sub, i) => {
      div.appendChild(renderAsset(sub, `${path}.assets[${i}]`));
    });

    (asset.subAssets || []).forEach((sub, i) => {
      div.appendChild(renderAsset(sub, `${path}.subAssets[${i}]`));
    });

    return div;
  }

  window.renderTree();
};
