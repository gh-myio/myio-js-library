/* global self, localStorage, document, window, sessionStorage, $ */

// Pegar parâmetro da URL
let deviceName = '-';
const TB_HOST = 'https://dashboard.myio-bas.com';

/************************************************************
 * MyIOAuthTB - Auth ThingsBoard (username/password) com cache e refresh
 * Autor: você :)
 * Dependências: nenhuma (usa fetch nativo)
 ************************************************************/
/************************************************************
 * MyIOAuthTB (persistência + usuário em "sessão")
 ************************************************************/
const MyIOAuthTB = (() => {
  const LOGIN_URL = new URL('/api/auth/login', TB_HOST).toString();
  const REFRESH_URL = new URL('/api/auth/token', TB_HOST).toString();
  const ME_URL = new URL('/api/auth/user', TB_HOST).toString();
  const LOGOUT_URL = new URL('/api/auth/logout', TB_HOST).toString(); // opcional (TB >= 3.5/4.x)
  const TB_USERNAME = 'alarmes@myio.com.br';
  const TB_PASSWORD = 'hubmyio@2025!';
  const RENEW_SKEW_S = 60;
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;
  // Chaves de storage
  const LS_AUTH_KEY = 'tb_auth'; // { token, refreshToken, expiresAtMs }
  const SS_USER_KEY = 'tb_user'; // perfil do usuário logado
  // Cache em memória
  let _token = null;
  let _refresh = null;
  let _expiresAtMs = 0;
  let _inFlight = null;
  const _now = () => Date.now();
  const _aboutToExpire = () => !_token || _now() >= _expiresAtMs - RENEW_SKEW_S * 1000;
  // ---------- Storage helpers ----------
  function _saveAuthToLocalStorage() {
    try {
      localStorage.setItem(
        LS_AUTH_KEY,
        JSON.stringify({
          token: _token,
          refreshToken: _refresh,
          expiresAtMs: _expiresAtMs,
        })
      );
    } catch {}
  }
  function _loadAuthFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_AUTH_KEY);
      if (!raw) return false;
      const { token, refreshToken, expiresAtMs } = JSON.parse(raw);
      if (typeof token === 'string' && typeof expiresAtMs === 'number') {
        _token = token;
        _refresh = refreshToken || null;
        _expiresAtMs = expiresAtMs;
        return true;
      }
    } catch {}
    return false;
  }
  function _clearAuthStorage() {
    try {
      localStorage.removeItem(LS_AUTH_KEY);
    } catch {}
  }
  function _saveUserToSession(userObj) {
    try {
      sessionStorage.setItem(SS_USER_KEY, JSON.stringify(userObj));
    } catch {}
  }
  function _loadUserFromSession() {
    try {
      const raw = sessionStorage.getItem(SS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function _clearUserSession() {
    try {
      sessionStorage.removeItem(SS_USER_KEY);
    } catch {}
  }
  // ---------- Utils ----------
  function _decodeJwtExpMillis(jwt) {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return 0;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload && typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }
  async function _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  async function _login() {
    const body = { username: TB_USERNAME, password: TB_PASSWORD };
    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error(`Login falhou: ${resp.status} ${resp.statusText}`);
        const json = await resp.json(); // { token, refreshToken }
        if (!json?.token) throw new Error('Resposta sem token.');
        _token = json.token;
        _refresh = json.refreshToken || null;
        _expiresAtMs = _decodeJwtExpMillis(_token) || _now() + 50 * 60 * 1000;
        _saveAuthToLocalStorage(); // <-- persiste token/refresh
        await _fetchAndCacheUser(); // <-- pega usuário e guarda na sessão
        return _token;
      } catch (err) {
        attempt++;
        if (attempt >= RETRY_MAX_ATTEMPTS) throw err;
        await _sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }
  async function _refreshToken() {
    if (!_refresh) return _login();
    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(REFRESH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: _refresh }),
        });
        if (!resp.ok) throw new Error(`Refresh falhou: ${resp.status} ${resp.statusText}`);
        const json = await resp.json(); // geralmente { token, refreshToken? }
        if (json?.token) _token = json.token;
        if (json?.refreshToken) _refresh = json.refreshToken;
        _expiresAtMs = _decodeJwtExpMillis(_token) || _now() + 50 * 60 * 1000;
        _saveAuthToLocalStorage();
        // usuário geralmente não muda, mas se quiser garantir:
        // await _fetchAndCacheUser();
        return _token;
      } catch (err) {
        attempt++;
        if (attempt >= RETRY_MAX_ATTEMPTS) return _login();
        await _sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }
  }
  async function _ensureValidToken() {
    // tenta carregar do localStorage na primeira chamada
    if (!_token && !_inFlight) {
      _loadAuthFromLocalStorage();
    }
    if (_aboutToExpire()) {
      if (!_inFlight) {
        _inFlight = _token && _refresh ? _refreshToken() : _login();
        try {
          await _inFlight;
        } finally {
          _inFlight = null;
        }
      } else {
        await _inFlight;
      }
    }
    return _token;
  }
  async function _fetchAndCacheUser() {
    // usa token atual para pegar /api/auth/user e guardar no sessionStorage
    const resp = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!resp.ok) throw new Error(`/api/auth/user falhou: ${resp.status}`);
    const user = await resp.json();
    _saveUserToSession(user);
    return user;
  }
  // ---------- API pública ----------
  async function getToken() {
    return _ensureValidToken();
  }
  async function getCurrentUser({ forceRefresh = false } = {}) {
    await _ensureValidToken();
    if (!forceRefresh) {
      const cached = _loadUserFromSession();
      if (cached) return cached;
    }
    return _fetchAndCacheUser();
  }
  function getAuthHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }
  async function fetchWithAuth(url, options = {}) {
    let token = await getToken();
    const doFetch = async (tk) => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${tk}`);
      }
      return fetch(url, { ...options, headers });
    };
    let resp = await doFetch(token);
    if (resp.status === 401) {
      await _ensureValidToken();
      token = _token;
      resp = await doFetch(token);
    }
    return resp;
  }
  async function logout() {
    try {
      // opcional: avisa o TB para invalidar refresh (se suportado)
      await fetch(LOGOUT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${_token}`,
        },
      }).catch(() => {});
    } finally {
      _token = null;
      _refresh = null;
      _expiresAtMs = 0;
      _inFlight = null;
      _clearAuthStorage();
      _clearUserSession();
    }
  }
  function getExpiryInfo() {
    return {
      expiresAt: _expiresAtMs,
      expiresInSeconds: Math.max(0, Math.floor((_expiresAtMs - _now()) / 1000)),
      hasRefresh: Boolean(_refresh),
      loadedFromLocalStorage: Boolean(localStorage.getItem(LS_AUTH_KEY)),
    };
  }
  return {
    getToken,
    getCurrentUser,
    fetchWithAuth,
    getAuthHeader,
    logout,
    getExpiryInfo,
  };
})();

// // ---- helpers de UI: modal premium + ocultar botões ----
// function showPremiumErrorModal(msg) {
//   // injeta CSS do modal uma única vez
//   if (!document.getElementById('myio-premium-modal-style')) {
//     const css = document.createElement('style');
//     css.id = 'myio-premium-modal-style';
//     css.textContent = `
//       .myio-modal-backdrop {
//         position: fixed; inset: 0;
//         background: rgba(15, 27, 60, 0.55);
//         -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
//         display: flex; align-items: center; justify-content: center; z-index: 10050;
//       }
//       .myio-modal-card {
//         width: min(520px, 92vw);
//         background: linear-gradient(180deg,#0f1b3c 0%, #17284f 100%);
//         color: #fff;
//         border: 1px solid rgba(230,238,245,0.25);
//         border-radius: 16px;
//         box-shadow: 0 18px 48px rgba(0,0,0,0.35);
//         overflow: hidden;
//       }
//       .myio-modal-header {
//         display:flex; align-items:center; gap:12px;
//         padding:16px 18px; background: rgba(255,255,255,0.06);
//         border-bottom: 1px solid rgba(255,255,255,0.08);
//       }
//       .myio-badge {
//         padding:4px 10px; border-radius:999px;
//         background:#ffe2e2; color:#a31919; font-weight:700; font-size:12px;
//       }
//       .myio-modal-body { padding:18px; line-height:1.5; font-size:15px; }
//       .myio-modal-actions {
//         display:flex; justify-content:flex-end; gap:10px; padding:0 18px 16px 18px;
//       }
//       .myio-btn {
//         appearance:none; border:none; cursor:pointer; border-radius:10px;
//         padding:10px 14px; font-weight:600;
//       }
//       .myio-btn-primary { background:#1DA1F2; color:#fff; }
//       .myio-btn-primary:hover { filter: brightness(1.05); }
//       .myio-kbd { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
//                   background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
//                   padding:2px 6px; border-radius:6px; }
//     `;
//     document.head.appendChild(css);
//   }

//   // constrói modal
//   const backdrop = document.createElement('div');
//   backdrop.className = 'myio-modal-backdrop';
//   backdrop.innerHTML = `
//     <div class="myio-modal-card" role="dialog" aria-modal="true" aria-labelledby="myio-modal-title">
//       <div class="myio-modal-header">
//         <div class="myio-badge">Atenção</div>
//         <div id="myio-modal-title" style="font-weight:800; font-size:16px;">Telemetria indisponível</div>
//       </div>
//       <div class="myio-modal-body">
//         <div style="margin-bottom:10px">
//           Não foi possível habilitar as visualizações de telemetria para este dispositivo porque o
//           <span class="myio-kbd">centralId</span> não está configurado.
//         </div>
//         <div style="opacity:.9">${
//           msg || "Configure o atributo 'centralId' nos atributos do dispositivo e tente novamente."
//         }</div>
//       </div>
//       <div class="myio-modal-actions">
//         <button class="myio-btn myio-btn-primary" id="myio-modal-ok">Ok, entendi</button>
//       </div>
//     </div>
//   `;
//   document.body.appendChild(backdrop);
//   backdrop.querySelector('#myio-modal-ok').addEventListener('click', () => {
//     backdrop.remove();
//   });
// }

// function hideTelemetryButtons() {
//   const btnEnergy = document.getElementById('telemetriesEnergy');
//   const btnWater = document.getElementById('telemetriesWater');
//   if (btnEnergy) btnEnergy.style.display = 'none';
//   if (btnWater) btnWater.style.display = 'none';
// }

async function openDashboardPopupTelemetries(deviceId, response, stateDashboard) {
  console.log('response:', response);
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));

  // Use centralId from response, fallback to default if not found or empty
  const centralId = response?.centralId || '45250d44-bad0-4071-aaa0-8091cfb12691';

  try {
    await $http.get(`https://${centralId}.y.myio.com.br/api/check_device/${deviceName}`).toPromise();
  } catch (e) {
    console.error('Erro ao enviar requisição:', e);
  }

  /*
            const state = [{
              id: `${stateDashboard}`,
              params: {
                entityDashboard: {
                  entityId: {
                    id: deviceId,
                    entityType: 'DEVICE'
                  },
                },
              }
            }];
        
            const dashboardId = "97e75560-7c7a-11f0-a06d-e9509531b1d5";
            const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
            const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
            
            console.log('[DEBUG] Navegando para:', url);
            
            self.ctx.router.navigateByUrl(url);
            */

  const entityType = 'DEVICE';
  const state = [
    {
      id: stateDashboard,
      params: {
        device_selected: {
          entityId: {
            id: deviceId,
            entityType,
          },
        },
      },
    },
  ];
  const dashboardId = '97e75560-7c7a-11f0-a06d-e9509531b1d5';
  const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
  const url = `/dashboard/${dashboardId}?embed=true&state=${stateBase64}`;

  $('#dashboard-popup').remove();
  const $popup = $(
    `
<div
  id="dashboard-popup"
  style="
    position: fixed;
    top: 5%;
    left: 5%;
    width: 90%;
    height: 90%;
    background: white;
    border-radius: 8px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    overflow: hidden;
  "
>
  <!-- Container dos botões -->
  <div
    style="
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 8px;
      z-index: 10001;
    "
  >
    <!-- Botão Fechar (SVG inline com estilos embutidos) -->
    <button
      id="close-dashboard-popup"
      type="button"
      aria-label="Fechar painel"
      title="Fechar"
      style="
        background: #f44336;
        color: #fff;
        border: none;
        border-radius: 6px;
        width: 34px;
        height: 34px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
      "
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style="display: block"
      >
        <!-- círculo leve de fundo (apenas contorno) -->
        <circle
          cx="12"
          cy="12"
          r="9"
          style="
            fill: none;
            stroke: rgba(255, 255, 255, 0.12);
            stroke-width: 1.2;
          "
        />
        <!-- X -->
        <path
          d="M8 8l8 8M16 8l-8 8"
          style="
            fill: none;
            stroke: #ffffff;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
          "
        />
      </svg>
    </button>
  </div>

  <!-- Conteúdo -->
  <iframe src="${url}" style="width: 100%; height: 100%; border: none"></iframe>
</div>
`
  );
  $('body').append($popup);
  $('#close-dashboard-popup').on('click', () => $('#dashboard-popup').remove());
}

function montarObjeto(attributes, chavesDesejadas) {
  const mapa = Object.fromEntries(attributes.map((attr) => [attr.key, attr.value]));
  return chavesDesejadas.reduce((obj, chave) => {
    obj[chave] = mapa[chave] ?? '';
    return obj;
  }, {});
}

async function login(body) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
  const response = await $http.post(`${TB_HOST}/api/auth/login`, body).toPromise();
  return response;
}

async function getDeviceByName(token) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
  const deviceInfoResponse = await $http
    .get(`${TB_HOST}/api/tenant/devices?deviceName=${deviceName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .toPromise();
  return deviceInfoResponse;
}

async function getEntityInfoAndAttributes(token, deviceId) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));

  try {
    const deviceTelemetry = await $http
      .get(
        `${TB_HOST}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?keys=active%2Cfloor%2CNumLoja%2Clabel%2CqrCode%2CcentralId`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .toPromise();

    const resultado = montarObjeto(deviceTelemetry, ['floor', 'NumLoja', 'active', 'qrCode', 'centralId']);

    console.log(resultado);

    // ---- verificação do centralId ----
    const centralId = resultado && typeof resultado.centralId === 'string' ? resultado.centralId.trim() : '';
    if (!centralId) {
      // hideTelemetryButtons();
      //showPremiumErrorModal(
      //    "O atributo 'centralId' está vazio/ausente. Sem ele, não é possível validar o dispositivo no domínio do cliente nem abrir o dashboard de telemetrias."
      //);
      // encerra aqui para não registrar listeners
      //return;
    }

    return resultado;
  } catch (error) {
    console.error('Erro ao buscar dados da entidade/atributos:', error);
    return {};
  }
}

function enviarEmail({ to, subject = '', body = '' }) {
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

self.onInit = async function () {
  const contextDataArray = self.ctx.data;

  // Pegar parâmetro da URL
  const urlParams = new URLSearchParams(window.location.search);
  deviceName = urlParams.get('deviceName');

  setupButtonTypeToDisplay();

  const supportSource = contextDataArray.find((source) => source.dataKey.name === 'supportInfo');

  // GET Device_Selected from DATASOURCE / ALIAS
  const supportInfo = JSON.parse(supportSource?.data?.[0]?.[1]);

  const deviceSource = contextDataArray.find((source) => source.datasource.entityName === deviceName);

  let deviceInfo = null;

  try {
    const rawData = deviceSource?.data?.[0]?.[1];

    if (rawData) {
      deviceInfo = JSON.parse(rawData);
    }

    document.querySelector('#fabrication').innerHTML = deviceInfo
      ? deviceInfo.deviceInfoDetails.FabricationDate
      : 'Sem data de fabricação.';
    document.querySelector('#installation').innerHTML = deviceInfo
      ? deviceInfo.deviceInfoDetails.InstallationDate
      : 'Sem data de instalação.';
    document.querySelector('#floor').innerHTML = deviceInfo
      ? deviceInfo.deviceInfoDetails.InstallationLocal
      : 'Sem informação de Andar';
  } catch (e) {
    console.warn('Não foi possível encontrar as informações do device', e);
  }

  // 1) Obter token puro (string JWT)
  const tokenTB = await MyIOAuthTB.getToken();
  localStorage.setItem('jwt_token', tokenTB);

  const adminCredencials = {
    username: 'victorhjoe@gmail.com',
    password: 'Lennon@10',
  };

  const loginResponse = await login(adminCredencials);
  const token = loginResponse.token;

  if (deviceName) {
    const device = await getDeviceByName(token);
    const deviceLabel = device.label || 'Dispositvo SEM ETIQUETA';
    const deviceName = device.name || 'Dispositivo SEM CÓDIGO';

    document.querySelector('#label').innerHTML = deviceLabel;
    document.querySelector('#code').innerHTML = deviceName;

    const deviceId = device.id.id;
    const response = await getEntityInfoAndAttributes(token, deviceId);

    if (response.active === true) {
      document.querySelector('#active').innerHTML = 'Ativo.';
    } else if (response.active === false) {
      document.querySelector('#active').innerHTML = 'Inativo.';
    }

    if (supportInfo) {
      document.querySelector('#email').innerHTML = supportInfo
        ? supportInfo.supportInfoDetails.email
        : 'Email de contato não encontrado.';
      const divSuporte = document.getElementById('sup');

      divSuporte.addEventListener('click', (event) => {
        enviarEmail({
          to: supportInfo.supportInfoDetails.email,
          subject: `Suporte do dispositivo ${deviceInfo.name}`,
          body: `Olá, preciso de suporte com o dispositivo ${deviceInfo.name}`,
        });
      });
    }

    const divTelemetriaEnergy = document.getElementById('telemetriesEnergy');

    divTelemetriaEnergy.addEventListener('click', async (event) => {
      await openDashboardPopupTelemetries(deviceId, response, 'energy_telemetry_panel');
    });

    const divTelemetriaWater = document.getElementById('telemetriesWater');

    divTelemetriaWater.addEventListener('click', async (event) => {
      await openDashboardPopupTelemetries(deviceId, response, 'water_telemetry_panel');
    });
  } else {
    console.log('Erro de conexão: Device não especificado.');
  }
};

function setupButtonTypeToDisplay() {
  console.log('[setupButtonTypeToDisplay] Device Name:', deviceName);

  if (deviceName && deviceName.toUpperCase().includes('HIDR')) {
    // Se for hidrômetro: mostrar água, esconder energia
    document.getElementById('telemetriesEnergy').style.display = 'none';
    document.getElementById('telemetriesWater').style.display = 'flex';
  } else {
    // Caso contrário: mostrar energia, esconder água
    document.getElementById('telemetriesEnergy').style.display = 'flex';
    document.getElementById('telemetriesWater').style.display = 'none';
  }
}
