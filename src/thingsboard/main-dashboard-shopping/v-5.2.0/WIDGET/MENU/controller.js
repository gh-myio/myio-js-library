/* global self, window, document, localStorage, sessionStorage, requestAnimationFrame */

// RFC-0091: Use shared LogHelper from MAIN widget via window.MyIOUtils
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

self.onInit = function () {
  const settings = self.ctx.settings || {};
  const scope = self.ctx.$scope;

  scope.links = settings.links || [];

  // guarda último nome válido para reaproveitar em edge cases
  const STORAGE_KEY = 'myio:current-shopping-name';

  function updateShoppingLabel() {
    const name = getCurrentDashboardTitle();
    setShoppingButtonLabel(name);
  }

  // pega o título do dashboard de forma resiliente (várias versões do TB)
  function getCurrentDashboardTitle() {
    // Primeiro tenta pegar do dashboard (caso um dia alguém ative o título)
    const name =
      self.ctx?.dashboard?.title ||
      self.ctx?.dashboard?.dashboard?.title ||
      self.ctx?.dashboard?.config?.title ||
      self.ctx?.dashboard?.configuration?.title ||
      null;

    console.log('self.ctx?.dashboard', self.ctx?.dashboard);
    console.log('Dashboard title found:', name);
    console.log('Datasources:', self.ctx?.datasources);

    if (name) return name;

    // ✅ Se não estiver no dashboard, pega do datasource principal
    try {
      const ds = self.ctx?.datasources?.[0];
      if (ds?.name) return ds.name.trim();
    } catch {
      // Ignore datasource access errors
    }

    return null;
  }

  function setShoppingButtonLabel(name) {
    const el = document.getElementById('ssb-current-shopping');
    if (!el) return;
    const has = !!(name && name.trim());
    el.textContent = has ? name.trim() : '';
    el.style.display = has ? 'block' : 'none';
  }

  // chama e persiste o nome atual
  function updateShoppingLabelFromDashboard() {
    const title = getCurrentDashboardTitle();
    if (title) {
      setShoppingButtonLabel(title);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(title));
      } catch {
        // Ignore localStorage errors (quota exceeded, private mode, etc.)
      }
    } else {
      setShoppingButtonLabel(null);
    }
  }

  // Function to get icon for each menu item based on stateId
  scope.getMenuIcon = function (stateId) {
    const icons = {
      telemetry_content: '⚡',
      water_content: '💧',
      temperature_content: '🌡️',
      alarm_content: '🔔',
    };
    return icons[stateId] || '📄';
  };

  // Hamburger menu toggle
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const menuRoot = document.querySelector('.shops-menu-root');
  let isMenuCollapsed = false;

  if (hamburgerBtn && menuRoot) {
    hamburgerBtn.addEventListener('click', function (e) {
      e.preventDefault();
      isMenuCollapsed = !isMenuCollapsed;

      if (isMenuCollapsed) {
        menuRoot.classList.add('collapsed');
        LogHelper.log('[MENU] Menu collapsed');
      } else {
        menuRoot.classList.remove('collapsed');
        LogHelper.log('[MENU] Menu expanded');
      }

      // Emit event to notify other widgets (like MAIN_VIEW)
      window.dispatchEvent(
        new CustomEvent('myio:menu-toggle', {
          detail: { collapsed: isMenuCollapsed },
        })
      );
    });
  }

  // Shared auth headers helper (used by fetchUserInfo and openIntegrationSetupModal)
  function buildAuthHeaders() {
    const token = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Authorization'] = 'Bearer ' + token;
    return headers;
  }

  // Fetch and display user info
  fetchUserInfo();

  async function fetchUserInfo() {

    try {
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        LogHelper.warn('[MENU] /api/auth/user status:', response.status);
        if (response.status === 401) {
          // token expirado/invalidado → força login
          localStorage.removeItem('jwt_token');
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const user = await response.json();
      console.log('user >>>>>>>>>>>>>>>>', user);

      // Atualiza UI do usuário imediatamente (mesmo que a busca de atributos falhe)
      const userNameEl = document.getElementById('user-name');
      const userEmailEl = document.getElementById('user-email');

      if (userNameEl) {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Usuário';
        userNameEl.textContent = fullName;
      }
      if (userEmailEl && user?.email) {
        userEmailEl.textContent = user.email;
      }

      // RFC-0064: Check if user is TENANT_ADMIN first (skip attributes fetch)
      let isUserAdmin = false;
      if (user.authority === 'TENANT_ADMIN') {
        LogHelper.log('[MENU] User is TENANT_ADMIN - granting admin access without attributes check');
        isUserAdmin = true;
      } else {
        // Busca atributos do CUSTOMER (pode dar 400/404 quando não existem atributos)
        try {
          const attrRes = await fetch(
            `/api/plugins/telemetry/CUSTOMER/${user.customerId.id}/values/attributes/SERVER_SCOPE`,
            {
              method: 'GET',
              headers: buildAuthHeaders(),
              credentials: 'include',
            }
          );

          if (attrRes.ok) {
            // pode vir vazio ou não-JSON em alguns casos; defenda o parse
            const userAttributes = await attrRes.json().catch(() => []);
            LogHelper.log('[MENU] User attributes received:', userAttributes);

            if (Array.isArray(userAttributes)) {
              for (const attr of userAttributes) {
                if (attr && attr.key === 'isUserAdmin') {
                  isUserAdmin = !!attr.value;
                  break;
                }
              }
            }
          } else if (attrRes.status === 400 || attrRes.status === 404) {
            // Sem atributos → segue fluxo normal
            LogHelper.warn('[MENU] CUSTOMER attributes not found (400/404). Proceeding without admin.');
          } else if (attrRes.status === 401) {
            // token expirado durante a segunda chamada
            localStorage.removeItem('jwt_token');
            sessionStorage.clear();
            window.location.href = '/login';
            return;
          } else {
            LogHelper.warn('[MENU] Unexpected attributes status:', attrRes.status);
          }
        } catch (attrErr) {
          // Não quebre a exibição do usuário por causa dos atributos
          LogHelper.warn('[MENU] Ignoring attributes error:', attrErr);
        }
      } // End of else block (non-TENANT_ADMIN users)

      // Habilita botão de troca de shopping apenas para admin
      if (isUserAdmin) {
        LogHelper.log('[MENU] User admin detected - enabling shopping selector and settings buttons');
        addShoppingSelectorButton();
        addSettingsMenuButton(user); // RFC-0108: Consolidated settings menu
        updateShoppingLabel();
      }

      // (RFC-0181: reports intercept is handled inside changeDashboardState)
    } catch (err) {
      LogHelper.error('[MENU] Error fetching user info:', err);

      // Fallback UI
      const userNameEl = document.getElementById('user-name');
      const userEmailEl = document.getElementById('user-email');

      if (userNameEl) userNameEl.textContent = 'Usuário';
      if (userEmailEl) userEmailEl.textContent = '';
    }
  }

  // RFC-0042: State ID to Domain mapping
  const DOMAIN_BY_STATE = {
    telemetry_content: 'energy',
    water_content: 'water',
    temperature_content: 'temperature',
    alarm_content: 'alarm',
  };

  scope.changeDashboardState = function (e, stateId, index) {
    e.preventDefault();

    // RFC-0181: Intercept Relatórios link — open picker instead of navigating
    const clickedLink = scope.links[index];
    if (clickedLink && /relat/i.test(clickedLink.content || '')) {
      LogHelper.log('[MENU RFC-0181] Relatórios link clicked – opening reports picker');
      openReportsPickerModal();
      return;
    }

    // Marca o link selecionado e desmarca os outros
    scope.links.forEach((link, i) => (link.enableLink = i === index));

    // RFC-0042: Notify orchestrator of tab change
    const domain = DOMAIN_BY_STATE[stateId];

    // ALWAYS dispatch event, even for null domain (alarms, etc)
    // This ensures HEADER can disable buttons for unsupported domains
    //LogHelper.log(`[MENU] Tab changed to domain: ${domain || 'null (unsupported)'}`);
    window.dispatchEvent(
      new CustomEvent('myio:dashboard-state', {
        detail: { tab: domain },
      })
    );

    // RFC-0053: Navegação via Estados do ThingsBoard (preferido)
    try {
      if (self.ctx?.dashboard && typeof self.ctx.dashboard.openDashboardState === 'function') {
        LogHelper.log(`[MENU] RFC-0053: Navegando para estado TB: ${stateId}`);
        self.ctx.dashboard.openDashboardState(stateId);
        return; // já navegou via TB; não usar fallback
      }
    } catch (err) {
      LogHelper.warn('[MENU] RFC-0053: openDashboardState indisponível:', err);
    }

    // RFC-0053: Use content containers with show/hide logic (no iframes!)
    try {
      const main = document.getElementsByTagName('main')[0];
      if (!main) {
        LogHelper.error('[MENU] <main> element not found in DOM');
        return;
      }

      // Find all content containers with data-content-state attribute
      const allContents = main.querySelectorAll('[data-content-state]');

      if (allContents.length === 0) {
        LogHelper.error('[MENU] No content containers found with data-content-state attribute');
        main.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">
          <p><strong>Error: Content containers not configured</strong></p>
          <p>Expected containers with data-content-state attribute in MAIN_VIEW template.html</p>
        </div>`;
        return;
      }

      // Hide all content containers
      allContents.forEach((content) => {
        content.style.display = 'none';
      });

      // Show target container
      const targetContent = main.querySelector(`[data-content-state="${stateId}"]`);
      if (targetContent) {
        targetContent.style.display = 'block';
        LogHelper.log(`[MENU] ✅ RFC-0053: Showing content container for ${stateId} (no iframe!)`);
      } else {
        LogHelper.warn(`[MENU] Content container not found for ${stateId}`);
        main.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff6b6b;">
          <p><strong>State "${stateId}" not configured</strong></p>
          <p>Available containers: ${Array.from(allContents)
            .map((c) => c.getAttribute('data-content-state'))
            .join(', ')}</p>
        </div>`;
      }
    } catch (err) {
      LogHelper.error('[MENU] RFC-0053: Failed to switch content container:', err);
    }
  };

  // Logout handler
  scope.handleLogout = async function (e) {
    e.preventDefault();

    //LogHelper.log("[MENU] Logout button clicked");

    // Confirm before logout
    const confirmed = window.confirm('Tem certeza que deseja sair?');
    if (!confirmed) {
      LogHelper.log('[MENU] Logout cancelled by user');
      return;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.querySelector('.logout-text').textContent = 'Saindo...';
    }

    try {
      //LogHelper.log("[MENU] Sending logout request to /api/auth/logout");

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
        },
        credentials: 'include',
      });

      //LogHelper.log("[MENU] Logout response status:", response.status);

      if (response.ok || response.status === 200 || response.status === 401) {
        // Clear local storage
        LogHelper.log('[MENU] Clearing local storage and session data');
        localStorage.removeItem('jwt_token');
        sessionStorage.clear();

        // Clear orchestrator cache if available
        if (window.MyIOOrchestrator) {
          try {
            window.MyIOOrchestrator.invalidateCache('*');
            LogHelper.log('[MENU] Orchestrator cache cleared');
          } catch (err) {
            LogHelper.warn('[MENU] Failed to clear orchestrator cache:', err);
          }
        }

        LogHelper.log('[MENU] Redirecting to login page');

        // Redirect to login page
        window.location.href = '/login';
      } else {
        throw new Error(`Logout failed with status: ${response.status}`);
      }
    } catch (err) {
      LogHelper.error('[MENU] Logout error:', err);
      window.alert('Erro ao fazer logout. Você será redirecionado para a tela de login.');

      // Force redirect even on error
      localStorage.removeItem('jwt_token');
      sessionStorage.clear();
      window.location.href = '/login';
    } finally {
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.querySelector('.logout-text').textContent = 'Sair';
      }
    }
  };

  // RFC-0108: Consolidated Settings Menu Button
  function addSettingsMenuButton(user) {
    if (document.getElementById('settings-menu-btn')) {
      LogHelper.log('[MENU] Settings menu button already exists');
      return;
    }

    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');
    if (!menuFooter) {
      LogHelper.error('[MENU] Menu footer not found - cannot add settings menu button');
      return;
    }

    const settingsMenuBtn = document.createElement('button');
    settingsMenuBtn.id = 'settings-menu-btn';
    settingsMenuBtn.className = 'settings-menu-btn';
    settingsMenuBtn.type = 'button';
    settingsMenuBtn.setAttribute('aria-label', 'Configurações');

    settingsMenuBtn.innerHTML = `
      <span class="settings-menu-icon">⚙️</span>
      <span class="settings-menu-text">Configurações</span>
    `;

    // Insert before logout button
    if (logoutBtn) menuFooter.insertBefore(settingsMenuBtn, logoutBtn);
    else menuFooter.appendChild(settingsMenuBtn);

    // Click handler - show settings modal
    settingsMenuBtn.addEventListener('click', () => {
      LogHelper.log('[MENU] Settings menu button clicked');
      showSettingsModal(user);
    });

    LogHelper.log('[MENU] Settings menu button added successfully');
  }

  // RFC-0108: Show centered settings modal with options
  function showSettingsModal(user) {
    // Use top-level document to ensure modal appears above everything
    const topWin = window.top || window;
    const topDoc = (() => {
      try {
        return topWin.document;
      } catch {
        return document;
      }
    })();

    // Inject styles if not present
    const STYLE_ID = 'myio-conf-picker-styles';
    if (!topDoc.getElementById(STYLE_ID)) {
      const style = topDoc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .myio-conf-picker {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }
        .myio-conf-picker.show {
          opacity: 1;
          pointer-events: auto;
        }
        .myio-conf-picker__overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        .myio-conf-picker__content {
          position: relative;
          z-index: 2;
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          width: min(640px, 90vw);
          max-height: 90vh;
          overflow: hidden;
          transform: translateY(10px) scale(0.98);
          transition: transform 0.2s ease;
        }
        .myio-conf-picker.show .myio-conf-picker__content {
          transform: translateY(0) scale(1);
        }
        .myio-conf-picker__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #3e1a7d;
          color: white;
          min-height: 32px;
        }
        .myio-conf-picker__header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .myio-conf-picker__close {
          background: transparent;
          border: none;
          color: white;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.15s ease;
        }
        .myio-conf-picker__close:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .myio-conf-picker__body {
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .myio-settings-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          background: #FAFAFA;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          width: 100%;
        }
        .myio-settings-option:hover {
          background: #F3E5F5;
          border-color: #CE93D8;
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(123, 31, 162, 0.1);
        }
        .myio-settings-option:active {
          transform: translateX(2px);
        }
        .myio-settings-option__icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: white;
          font-size: 22px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .myio-settings-option__text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .myio-settings-option__title {
          font-size: 14px;
          font-weight: 600;
          color: #1F2937;
        }
        .myio-settings-option__desc {
          font-size: 12px;
          color: #6B7280;
          line-height: 1.3;
        }
      `;
      topDoc.head.appendChild(style);
    }

    // Remove existing modal if any
    const existingModal = topDoc.getElementById('myio-conf-picker');
    if (existingModal) existingModal.remove();

    const isSuperAdmin = window.MyIOUtils?.SuperAdmin === true;
    const customerName = user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || '';

    const modal = topDoc.createElement('div');
    modal.id = 'myio-conf-picker';
    modal.className = 'myio-conf-picker';
    modal.innerHTML = `
      <div class="myio-conf-picker__overlay"></div>
      <div class="myio-conf-picker__content">
        <div class="myio-conf-picker__header">
          <h3>⚙️ Configurações${customerName ? ` — ${customerName}` : ''}</h3>
          <button class="myio-conf-picker__close" aria-label="Fechar">&times;</button>
        </div>
        <div class="myio-conf-picker__body">
          <button class="myio-settings-option" data-action="temperature">
            <span class="myio-settings-option__icon">🌡️</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Config. Temperatura</span>
              <span class="myio-settings-option__desc">Limites e alertas de temperatura</span>
            </div>
          </button>
          <button class="myio-settings-option" data-action="contract">
            <span class="myio-settings-option__icon">📋</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Dispositivos Contratados</span>
              <span class="myio-settings-option__desc">Quantidade de dispositivos por domínio</span>
            </div>
          </button>
          <button class="myio-settings-option" data-action="measurement">
            <span class="myio-settings-option__icon">📐</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Config. Medidas</span>
              <span class="myio-settings-option__desc">Unidades e casas decimais</span>
            </div>
          </button>
          ${isSuperAdmin ? `
          <button class="myio-settings-option myio-settings-option--myio" data-action="integration">
            <span class="myio-settings-option__icon">🔗</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Setup de Integração</span>
              <span class="myio-settings-option__desc">Ingestion · GCDR — apenas MyIO</span>
            </div>
          </button>` : ''}
          ${isSuperAdmin ? `
          <button class="myio-settings-option myio-settings-option--myio" data-action="user-management">
            <span class="myio-settings-option__icon">👥</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Gestão de Usuários</span>
              <span class="myio-settings-option__desc">Usuários e perfis — apenas MyIO</span>
            </div>
          </button>` : ''}
          ${isSuperAdmin ? `
          <button class="myio-settings-option myio-settings-option--myio" data-action="default-dashboard">
            <span class="myio-settings-option__icon">🏠</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Dashboard Padrão</span>
              <span class="myio-settings-option__desc">Dashboard exibido ao criar novos usuários — apenas MyIO</span>
            </div>
          </button>` : ''}
          ${isSuperAdmin ? `
          <button class="myio-settings-option myio-settings-option--myio" data-action="client-config">
            <span class="myio-settings-option__icon">🏢</span>
            <div class="myio-settings-option__text">
              <span class="myio-settings-option__title">Configurações Cliente</span>
              <span class="myio-settings-option__desc">Funcionalidades e senha master — apenas MyIO</span>
            </div>
          </button>` : ''}
        </div>
      </div>
    `;

    topDoc.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('show'));

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.myio-conf-picker__overlay').addEventListener('click', closeModal);
    modal.querySelector('.myio-conf-picker__close').addEventListener('click', closeModal);

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        topDoc.removeEventListener('keydown', escHandler);
      }
    };
    topDoc.addEventListener('keydown', escHandler);

    // Option click handlers
    modal.querySelectorAll('.myio-settings-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closeModal();

        // Small delay to let modal close animation complete
        setTimeout(() => {
          if (action === 'temperature') {
            openTemperatureSettings(user);
          } else if (action === 'contract') {
            openContractDevicesSettings(user);
          } else if (action === 'measurement') {
            openMeasurementSettings(user);
          } else if (action === 'integration') {
            openIntegrationSetupModal(user);
          } else if (action === 'user-management') {
            openUserManagementModal(user);
          } else if (action === 'default-dashboard') {
            openDefaultDashboardSettings(user);
          } else if (action === 'client-config') {
            openClientConfigModal(user);
          }
        }, 250);
      });
    });

    LogHelper.log('[MENU] Settings modal opened');
  }

  // ── RFC-0190: Gestão de Usuários (apenas SuperAdmin MyIO) ───────────────────
  function openUserManagementModal(user) {
    if (!window.MyIOLibrary?.openUserManagementModal) {
      LogHelper.warn('[MENU] openUserManagementModal not available in MyIOLibrary');
      return;
    }
    const jwt = localStorage.getItem('jwt_token') || '';
    const orch = window.MyIOOrchestrator;
    window.MyIOLibrary.openUserManagementModal({
      customerId:   orch?.customerTB_ID || self.ctx.settings?.customerTB_ID || '',
      tenantId:     user.tenantId?.id || '',
      customerName: orch?.customerName || '',
      jwtToken:     jwt,
      tbBaseUrl:    self.ctx.settings?.tbBaseUrl || '',
      currentUser:  {
        id:        user.id?.id || '',
        email:     user.email || '',
        firstName: user.firstName || '',
        lastName:  user.lastName  || '',
      },
    });
  }

  // ── RFC-0194: Dashboard Padrão (apenas SuperAdmin MyIO) ──────────────────────
  // Lê/salva customerDefaultDashboard (SERVER_SCOPE) com changelog auditável.
  function openDefaultDashboardSettings(user) {
    const topWin = window.top || window;
    const topDoc = (() => { try { return topWin.document; } catch { return document; } })();

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) { window.alert('Token não encontrado. Faça login novamente.'); return; }

    const orch = window.MyIOOrchestrator;
    const customerId = orch?.customerTB_ID || user?.customerId?.id;
    if (!customerId) { window.alert('ID do cliente não encontrado.'); return; }

    const customerName = orch?.customerName || user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || '';

    const tbBase = self.ctx?.settings?.tbBaseUrl || '';

    // ── CSS ──────────────────────────────────────────────────────────────────
    const STYLE_ID = 'myio-default-dashboard-styles';
    if (!topDoc.getElementById(STYLE_ID)) {
      const s = topDoc.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .mdd-overlay{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        .mdd-overlay.show{opacity:1;pointer-events:auto}
        .mdd-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
        .mdd-card{position:relative;z-index:2;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);width:min(1080px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;transform:translateY(12px) scale(.98);transition:transform .2s ease}
        .mdd-overlay.show .mdd-card{transform:translateY(0) scale(1)}
        /* Header: ModalHeader (RFC-0121) */
        .mdd-card.is-maximized{width:100vw!important;max-width:100vw!important;height:100vh!important;max-height:100vh!important;border-radius:0}
        .mdd-body{overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0}
        .mdd-section{border:1px solid #E9E0FA;border-radius:12px;overflow:hidden}
        .mdd-section-title{background:#F3ECF9;padding:8px 14px;font-size:11px;font-weight:700;color:#5B2D8E;letter-spacing:.6px;text-transform:uppercase}
        .mdd-no-config{margin:12px 14px;font-size:13px;color:#6B7280}
        .mdd-current{padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .mdd-current-name{font-size:14px;font-weight:600;color:#111827}
        .mdd-current-id{font-size:11px;font-family:monospace;color:#6B7280}
        .mdd-current-meta{font-size:12px;color:#9CA3AF;margin-top:2px}
        .mdd-search-row{display:flex;gap:8px;padding:12px 14px}
        .mdd-input{flex:1;border:1px solid #D1D5DB;border-radius:8px;padding:7px 10px;font-size:13px;color:#111827;outline:none;transition:border-color .15s;font-family:inherit}
        .mdd-input:focus{border-color:#7B2FF7;box-shadow:0 0 0 3px rgba(123,47,247,.12)}
        .mdd-results{max-height:200px;overflow-y:auto;padding:0 14px 12px}
        .mdd-result-item{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s}
        .mdd-result-item:hover{background:#F5F3FF}
        .mdd-result-item.selected{background:#EDE9FE;border:1px solid #C4B5FD}
        .mdd-result-name{font-size:13px;font-weight:500;color:#1F2937}
        .mdd-result-id{font-size:11px;font-family:monospace;color:#9CA3AF}
        .mdd-loading,.mdd-empty,.mdd-error{font-size:13px;color:#6B7280;text-align:center;padding:12px 0}
        .mdd-error{color:#DC2626}
        .mdd-btn{padding:7px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s;font-family:inherit}
        .mdd-btn-primary{background:#7B2FF7;color:#fff}.mdd-btn-primary:hover:not(:disabled){background:#6320d4}.mdd-btn-primary:disabled{background:#D1D5DB;color:#9CA3AF;cursor:not-allowed}
        .mdd-btn-secondary{background:#F3F4F6;color:#374151;border:1px solid #E5E7EB}.mdd-btn-secondary:hover{background:#E9EAEC}
        .mdd-btn-search{background:#6B7280;color:#fff}.mdd-btn-search:hover{background:#4B5563}
        .mdd-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #F3F4F6;flex-shrink:0}
        .mdd-selection-label{flex:1;font-size:12px;color:#5B2D8E;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .mdd-changelog{border:1px solid #E9E0FA;border-radius:12px;overflow:hidden}
        .mdd-changelog summary{background:#F3ECF9;padding:8px 14px;font-size:11px;font-weight:700;color:#5B2D8E;letter-spacing:.6px;text-transform:uppercase;cursor:pointer;list-style:none;user-select:none}
        .mdd-changelog summary::after{content:' ▼';font-size:9px}.mdd-changelog[open] summary::after{content:' ▲';font-size:9px}
        .mdd-changelog-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px;max-height:220px;overflow-y:auto}
        .mdd-log-entry{padding:8px 10px;background:#FAFAFA;border-radius:8px;border:1px solid #F3F4F6}
        .mdd-log-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
        .mdd-log-actor{font-size:12px;font-weight:600;color:#374151}
        .mdd-log-ts{font-size:11px;color:#9CA3AF;flex:1}
        .mdd-log-ver{font-size:10px;color:#7B2FF7;font-weight:600;background:#F5F3FF;padding:1px 6px;border-radius:4px}
        .mdd-log-change{font-size:12px;color:#4B5563}
      `;
      topDoc.head.appendChild(s);
    }

    // Remove modal existente
    const existing = topDoc.getElementById('myio-default-dashboard');
    if (existing) existing.remove();

    const currentCfg = orch?.defaultDashboardCfg || null;

    function renderCurrentState() {
      if (!currentCfg) return `<p class="mdd-no-config">Nenhum dashboard padrão configurado.</p>`;
      const last = currentCfg.changelog?.[0];
      const ts = last?.changedAt ? new Date(last.changedAt).toLocaleString('pt-BR') : '—';
      return `
        <div class="mdd-current">
          <div class="mdd-current-name">${currentCfg.dashboardName}</div>
          <div class="mdd-current-id">${currentCfg.dashboardId}</div>
          <div class="mdd-current-meta">Atualizado em ${ts}${last?.changedBy ? ` por ${last.changedBy.name}` : ''}</div>
        </div>`;
    }

    function renderChangelog() {
      const entries = currentCfg?.changelog;
      if (!entries?.length) return '';
      // Filtra entradas válidas (ignorar sentinels ou objetos malformados)
      const valid = entries.filter(e => e && e.changedAt && e.next);
      if (!valid.length) return '';
      const rows = valid.map(e => {
        const d = new Date(e.changedAt);
        const ts = isNaN(d.getTime()) ? e.changedAt : d.toLocaleString('pt-BR');
        const prev = e.previous?.dashboardName || '—';
        const next = e.next?.dashboardName || '—';
        return `
          <div class="mdd-log-entry">
            <div class="mdd-log-header">
              <span class="mdd-log-actor">${e.changedBy?.name || 'Desconhecido'}</span>
              <span class="mdd-log-ts">${ts}</span>
              <span class="mdd-log-ver">v${e.version || '?'}</span>
            </div>
            <div class="mdd-log-change">${prev} → ${next}</div>
          </div>`;
      }).join('');
      return `
        <details class="mdd-changelog">
          <summary>Histórico de Alterações (${valid.length})</summary>
          <div class="mdd-changelog-body">${rows}</div>
        </details>`;
    }

    // ── Modal ──────────────────────────────────────────────────────────────────
    const mddHeaderHtml = window.MyIOLibrary?.ModalHeader?.generateInlineHTML({
      icon: '🏠',
      title: `Dashboard Padrão${customerName ? ` — ${customerName}` : ''}`,
      modalId: 'mdd-modal',
      showThemeToggle: false,
      showMaximize: true,
      showClose: true,
      draggable: false,
    }) ?? `<div style="padding:12px 20px;background:#3e1a7d;color:#fff;font-weight:600">🏠 Dashboard Padrão</div>`;

    const modal = topDoc.createElement('div');
    modal.id = 'myio-default-dashboard';
    modal.className = 'mdd-overlay';
    modal.innerHTML = `
      <div class="mdd-bg"></div>
      <div class="mdd-card">
        ${mddHeaderHtml}
        <div class="mdd-body">
          <div class="mdd-section">
            <div class="mdd-section-title">Configuração Atual</div>
            ${renderCurrentState()}
          </div>
          <div class="mdd-section">
            <div class="mdd-section-title">Alterar Dashboard</div>
            <div class="mdd-search-row">
              <input type="text" class="mdd-input" id="mdd-search-input" placeholder="Buscar por nome..." />
              <button class="mdd-btn mdd-btn-search" id="mdd-search-btn">Buscar</button>
            </div>
            <div id="mdd-results" class="mdd-results"></div>
          </div>
          ${renderChangelog()}
        </div>
        <div class="mdd-footer">
          <span id="mdd-selection-label" class="mdd-selection-label"></span>
          <button class="mdd-btn mdd-btn-secondary mdd-cancel-btn">Cancelar</button>
          <button class="mdd-btn mdd-btn-primary" id="mdd-save-btn" disabled>Salvar</button>
        </div>
      </div>
    `;

    topDoc.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));

    let selectedDashboard = null;

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.mdd-bg').addEventListener('click', closeModal);
    modal.querySelector('.mdd-cancel-btn').addEventListener('click', closeModal);
    modal.querySelector('#mdd-modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('#mdd-modal-maximize')?.addEventListener('click', () => {
      modal.querySelector('.mdd-card').classList.toggle('is-maximized');
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') { closeModal(); topDoc.removeEventListener('keydown', escHandler); }
    };
    topDoc.addEventListener('keydown', escHandler);

    // ── Busca de dashboards ───────────────────────────────────────────────────
    async function searchDashboards(query) {
      const resultsEl = modal.querySelector('#mdd-results');
      resultsEl.innerHTML = '<div class="mdd-loading">Buscando...</div>';
      try {
        const qs = `pageSize=20&page=0&sortProperty=title&sortOrder=ASC${query ? '&textSearch=' + encodeURIComponent(query) : ''}`;
        const res = await fetch(`${tbBase}/api/customer/${customerId}/dashboards?${qs}`, {
          headers: { 'X-Authorization': `Bearer ${jwtToken}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items = json.data || [];
        if (!items.length) {
          resultsEl.innerHTML = '<div class="mdd-empty">Nenhum dashboard encontrado.</div>';
          return;
        }
        resultsEl.innerHTML = items.map(d => `
          <div class="mdd-result-item" data-id="${d.id.id}" data-title="${d.title}">
            <span class="mdd-result-name">${d.title}</span>
            <span class="mdd-result-id">${d.id.id}</span>
          </div>
        `).join('');
        resultsEl.querySelectorAll('.mdd-result-item').forEach(item => {
          item.addEventListener('click', () => {
            resultsEl.querySelectorAll('.mdd-result-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedDashboard = { id: item.dataset.id, title: item.dataset.title };
            modal.querySelector('#mdd-selection-label').textContent = `Selecionado: ${selectedDashboard.title}`;
            modal.querySelector('#mdd-save-btn').disabled = false;
          });
        });
      } catch (err) {
        resultsEl.innerHTML = `<div class="mdd-error">Erro ao buscar: ${err.message}</div>`;
      }
    }

    modal.querySelector('#mdd-search-btn').addEventListener('click', () => {
      searchDashboards(modal.querySelector('#mdd-search-input').value.trim());
    });
    modal.querySelector('#mdd-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); searchDashboards(e.target.value.trim()); }
    });

    // ── Salvar ────────────────────────────────────────────────────────────────
    modal.querySelector('#mdd-save-btn').addEventListener('click', async () => {
      if (!selectedDashboard) return;
      const saveBtn = modal.querySelector('#mdd-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';
      try {
        const version = window.MyIOLibrary?.version || '0.0.0';
        const now = new Date().toISOString();
        const currentUserName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
        const newEntry = {
          changedAt: now,
          version,
          previous: currentCfg ? { dashboardId: currentCfg.dashboardId, dashboardName: currentCfg.dashboardName } : null,
          next: { dashboardId: selectedDashboard.id, dashboardName: selectedDashboard.title },
          changedBy: { userId: user?.id?.id || '', name: currentUserName, email: user?.email || '' },
        };
        const newCfg = {
          dashboardName: selectedDashboard.title,
          dashboardId:   selectedDashboard.id,
          updatedAt:     now,
          changelog:     [newEntry, ...(currentCfg?.changelog || [])],
        };
        const res = await fetch(`${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`, {
          method: 'POST',
          headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerDefaultDashboard: newCfg }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 120) : ''}`);
        }
        // Atualiza orquestrador em memória
        if (window.MyIOOrchestrator) {
          window.MyIOOrchestrator.defaultDashboardId  = selectedDashboard.id;
          window.MyIOOrchestrator.defaultDashboardCfg = newCfg;
        }
        LogHelper.log('[MENU] RFC-0194: customerDefaultDashboard salvo:', newCfg.dashboardName);
        closeModal();
      } catch (err) {
        LogHelper.error('[MENU] RFC-0194: Erro ao salvar customerDefaultDashboard:', err);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
        window.alert('Erro ao salvar: ' + err.message);
      }
    });

    // Busca inicial (sem filtro)
    searchDashboards('');

    LogHelper.log('[MENU] RFC-0194: Default Dashboard settings modal opened');
  }

  // ── Setup de Integração (apenas MyIO) ────────────────────────────────────────
  // Lê/salva integration_setup (SERVER_SCOPE) no customer do ThingsBoard.
  // Schema v1.0.0 — seções: ingestion, gcdr, gateways (tb / ingestion / gcdr).
  function openIntegrationSetupModal(user) {
    const topWin = window.top || window;
    const topDoc = (() => { try { return topWin.document; } catch { return document; } })();

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) { window.alert('Token não encontrado. Faça login novamente.'); return; }

    const customerId = window.MyIOOrchestrator?.customerTB_ID || user?.customerId?.id;
    if (!customerId) { window.alert('ID do cliente não encontrado.'); return; }

    // ── CSS ──────────────────────────────────────────────────────────────────
    const STYLE_ID = 'myio-integration-setup-styles';
    if (!topDoc.getElementById(STYLE_ID)) {
      const s = topDoc.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .myio-isetup{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        .myio-isetup.show{opacity:1;pointer-events:auto}
        .myio-isetup__overlay{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
        .myio-isetup__card{position:relative;z-index:2;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);width:min(860px,97vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;transform:translateY(12px) scale(.98);transition:transform .2s ease}
        .myio-isetup.show .myio-isetup__card{transform:translateY(0) scale(1)}
        /* Header: ModalHeader (RFC-0121) */
        .myio-isetup__card.is-maximized{width:100vw!important;max-width:100vw!important;height:100vh!important;max-height:100vh!important;border-radius:0}
        .myio-isetup__body{overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:16px}
        .myio-isetup__loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px 0;color:#6B7280;font-size:13px}
        .myio-isetup__spinner{width:20px;height:20px;border:2px solid #E9E0FA;border-top-color:#7B2FF7;border-radius:50%;animation:isetup-spin .7s linear infinite}
        @keyframes isetup-spin{to{transform:rotate(360deg)}}
        .myio-isetup__section{border:1px solid #E9E0FA;border-radius:12px;overflow:hidden}
        .myio-isetup__section-title{background:#F3ECF9;padding:9px 14px;font-size:11px;font-weight:700;color:#5B2D8E;letter-spacing:.6px;text-transform:uppercase}
        .myio-isetup__fields{padding:14px;display:flex;flex-direction:column;gap:10px}
        .myio-isetup__row{display:grid;gap:8px}
        .myio-isetup__row--2{grid-template-columns:1fr 1fr}
        .myio-isetup__row--3{grid-template-columns:1fr 1fr 1fr}
        .myio-isetup__row--4{grid-template-columns:1fr 1fr 1fr 1fr}
        .myio-isetup__field{display:flex;flex-direction:column;gap:4px}
        .myio-isetup__label{font-size:11px;font-weight:600;color:#4B5563}
        .myio-isetup__label span{font-weight:400;color:#9CA3AF;margin-left:4px}
        .myio-isetup__input{border:1px solid #D1D5DB;border-radius:8px;padding:7px 10px;font-size:13px;color:#111827;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit;width:100%;box-sizing:border-box}
        .myio-isetup__input:focus{border-color:#7B2FF7;box-shadow:0 0 0 3px rgba(123,47,247,.12)}
        .myio-isetup__input[readonly]{background:#F9FAFB;color:#6B7280;cursor:default}
        .myio-isetup__footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #F3F4F6;flex-shrink:0}
        .myio-isetup__btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
        .myio-isetup__btn--cancel{background:#F3F4F6;color:#374151}
        .myio-isetup__btn--cancel:hover{background:#E5E7EB}
        .myio-isetup__btn--save{background:linear-gradient(135deg,#3E1A7D,#6A2FC0);color:#fff}
        .myio-isetup__btn--save:hover{opacity:.9;transform:translateY(-1px)}
        .myio-isetup__btn--save:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .myio-isetup__status{font-size:12px;margin-right:auto}
        .myio-isetup__status.ok{color:#059669}
        .myio-isetup__status.err{color:#DC2626}
        .myio-settings-option--myio .myio-settings-option__icon{background:linear-gradient(135deg,#3E1A7D22,#6A2FC022)}
        .myio-settings-option--myio .myio-settings-option__desc{color:#7B2FF7}
        /* ── Gateway tabs ── */
        .myio-igw-tabs{display:flex;border-bottom:1px solid #E9E0FA;padding:0 2px}
        .myio-igw-tab{padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;border:none;background:none;color:#6B7280;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;letter-spacing:.3px}
        .myio-igw-tab.active{color:#5B2D8E;border-bottom-color:#7B2FF7}
        .myio-igw-tab:hover:not(.active){color:#374151}
        .myio-igw-panel{display:none;flex-direction:column;gap:8px;padding:14px}
        .myio-igw-panel.active{display:flex}
        /* ── Gateway items ── */
        .myio-igw-item{border:1px solid #E9E0FA;border-radius:10px;overflow:hidden}
        .myio-igw-item__head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#FAFAFA;cursor:pointer;user-select:none;gap:8px}
        .myio-igw-item__head:hover{background:#F3ECF9}
        .myio-igw-item__title{font-size:12px;font-weight:600;color:#374151;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .myio-igw-item__toggle{font-size:10px;color:#9CA3AF;flex-shrink:0}
        .myio-igw-item__del{background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:18px;padding:0 2px;line-height:1;flex-shrink:0;transition:color .15s}
        .myio-igw-item__del:hover{color:#DC2626}
        .myio-igw-item__body{padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff;border-top:1px solid #F3F4F6}
        .myio-igw-item__body.collapsed{display:none}
        .myio-igw-add{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:1.5px dashed #D1D5DB;border-radius:10px;background:none;cursor:pointer;color:#6B7280;font-size:12px;font-weight:600;width:100%;transition:all .15s}
        .myio-igw-add:hover{border-color:#7B2FF7;color:#5B2D8E;background:#F3ECF9}
        .myio-igw-pause{display:flex;align-items:center;gap:8px}
        .myio-igw-pause input[type=checkbox]{width:15px;height:15px;cursor:pointer;accent-color:#7B2FF7}
      `;
      topDoc.head.appendChild(s);
    }

    // ── Render modal imediatamente (loading state) ────────────────────────────
    const existing = topDoc.getElementById('myio-isetup');
    if (existing) existing.remove();

    const isetupHeaderHtml = window.MyIOLibrary?.ModalHeader?.generateInlineHTML({
      icon: '🔗',
      title: 'Setup de Integração',
      modalId: 'isetup-modal',
      showThemeToggle: false,
      showMaximize: true,
      showClose: true,
      draggable: false,
    }) ?? `<div style="padding:8px 12px;background:#3e1a7d;color:#fff;font-weight:600;min-height:32px;display:flex;align-items:center">🔗 Setup de Integração</div>`;

    const modal = topDoc.createElement('div');
    modal.id = 'myio-isetup';
    modal.className = 'myio-isetup';
    modal.innerHTML = `
      <div class="myio-isetup__overlay"></div>
      <div class="myio-isetup__card">
        ${isetupHeaderHtml}
        <div class="myio-isetup__body">

          <div class="myio-isetup__loading" id="isetup-loading">
            <div class="myio-isetup__spinner"></div>
            Carregando configurações…
          </div>

          <div id="isetup-form" style="display:none">

            <!-- Seção 1: Ingestion -->
            <div class="myio-isetup__section">
              <div class="myio-isetup__section-title">1 · Ingestion</div>
              <div class="myio-isetup__fields">
                <div class="myio-isetup__row myio-isetup__row--3">
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">1.1 Ingestion ID <span>UUID</span></label>
                    <input class="myio-isetup__input" id="isetup-ingestionId" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">1.2 Client ID</label>
                    <input class="myio-isetup__input" id="isetup-clientId" type="text" placeholder="client_id" />
                  </div>
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">1.3 Client Secret <span>máx 256</span></label>
                    <input class="myio-isetup__input" id="isetup-clientSecret" type="password" maxlength="256" placeholder="••••••••" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Seção 2: GCDR -->
            <div class="myio-isetup__section">
              <div class="myio-isetup__section-title">2 · GCDR — Base Única</div>
              <div class="myio-isetup__fields">
                <div class="myio-isetup__row myio-isetup__row--2">
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">2.1 GCDR Customer ID <span>UUID</span></label>
                    <input class="myio-isetup__input" id="isetup-gcdrCustomerId" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">2.2 GCDR API Key <span>máx 256</span></label>
                    <input class="myio-isetup__input" id="isetup-gcdrApiKey" type="password" maxlength="256" placeholder="••••••••" />
                  </div>
                </div>
                <div class="myio-isetup__row myio-isetup__row--2">
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">2.3 GCDR Tenant ID <span>UUID</span></label>
                    <input class="myio-isetup__input" id="isetup-gcdrTenantId" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div class="myio-isetup__field">
                    <label class="myio-isetup__label">2.4 GCDR Synced At <span>readonly</span></label>
                    <input class="myio-isetup__input" id="isetup-gcdrSyncedAt" type="text" readonly placeholder="—" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Seção 3: Gateways / Centrais -->
            <div class="myio-isetup__section">
              <div class="myio-isetup__section-title">3 · Gateways / Centrais</div>
              <div class="myio-igw-tabs">
                <button class="myio-igw-tab active" data-gw-tab="tb">ThingsBoard</button>
                <button class="myio-igw-tab" data-gw-tab="ingestion">Ingestion</button>
                <button class="myio-igw-tab" data-gw-tab="gcdr">GCDR</button>
              </div>
              <div id="isetup-gw-tb"        class="myio-igw-panel active"></div>
              <div id="isetup-gw-ingestion"  class="myio-igw-panel"></div>
              <div id="isetup-gw-gcdr"       class="myio-igw-panel"></div>
            </div>

          </div><!-- /isetup-form -->

        </div><!-- /body -->
        <div class="myio-isetup__footer">
          <span class="myio-isetup__status" id="isetup-status"></span>
          <button class="myio-isetup__btn myio-isetup__btn--cancel" id="isetup-cancel">Cancelar</button>
          <button class="myio-isetup__btn myio-isetup__btn--save" id="isetup-save" disabled>Salvar</button>
        </div>
      </div>
    `;

    topDoc.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.myio-isetup__overlay').addEventListener('click', closeModal);
    modal.querySelector('#isetup-modal-close')?.addEventListener('click', closeModal);
    modal.querySelector('#isetup-modal-maximize')?.addEventListener('click', () => {
      modal.querySelector('.myio-isetup__card').classList.toggle('is-maximized');
    });
    modal.querySelector('#isetup-cancel').addEventListener('click', closeModal);

    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); topDoc.removeEventListener('keydown', escHandler); } };
    topDoc.addEventListener('keydown', escHandler);

    // ── Tab switching (gateways) ──────────────────────────────────────────────
    modal.querySelectorAll('.myio-igw-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.myio-igw-tab').forEach((t) => t.classList.remove('active'));
        modal.querySelectorAll('.myio-igw-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector('#isetup-gw-' + tab.dataset.gwTab).classList.add('active');
      });
    });

    // ── Gateway state & helpers ───────────────────────────────────────────────
    const _gwData = { tb: [], ingestion: [], gcdr: [] };

    const GW_DEFAULTS = {
      tb:        () => ({ uuid: '', name: '', assetParent: '', mqtt: { clientId: '', userName: '', password: '' } }),
      ingestion: () => ({ uuid: '', hardwareId: '', name: '', assetParent: '',
                          legacyFetchInterval: 30000, energyFetchInterval: 300000,
                          waterFetchInterval: 300000, temperatureFetchInterval: 60000,
                          pauseGateway: false,
                          lastEnergyFetch: null, lastWaterFetch: null, lastTemperatureFetch: null }),
      gcdr:      () => ({ uuid: '', name: '', assetParent: '', bundleVersion: '' }),
    };

    const fmtDate = (v) => { if (!v) return ''; try { return new Date(v).toLocaleString('pt-BR'); } catch { return String(v); } };
    const e = escHtml;

    function makeGwItem(type, item, idx) {
      const title = e(item.name) || ('Gateway ' + (idx + 1));

      if (type === 'tb') return `
        <div class="myio-igw-item" data-gw-idx="${idx}">
          <div class="myio-igw-item__head">
            <span class="myio-igw-item__title">${title}</span>
            <span class="myio-igw-item__toggle">▼</span>
            <button class="myio-igw-item__del" data-gw-del="${idx}" title="Remover">×</button>
          </div>
          <div class="myio-igw-item__body">
            <div class="myio-isetup__row myio-isetup__row--2">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">UUID</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="uuid" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${e(item.uuid)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Name</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="name" type="text" placeholder="Gateway name" value="${e(item.name)}" />
              </div>
            </div>
            <div class="myio-isetup__field">
              <label class="myio-isetup__label">Asset Parent</label>
              <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="assetParent" type="text" placeholder="UUID or name" value="${e(item.assetParent)}" />
            </div>
            <div class="myio-isetup__row myio-isetup__row--3">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">MQTT Client ID</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="mqtt.clientId" type="text" placeholder="client_id" value="${e(item.mqtt?.clientId ?? '')}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">MQTT User</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="mqtt.userName" type="text" placeholder="username" value="${e(item.mqtt?.userName ?? '')}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">MQTT Password</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="mqtt.password" type="password" placeholder="••••••••" value="${e(item.mqtt?.password ?? '')}" />
              </div>
            </div>
          </div>
        </div>`;

      if (type === 'ingestion') return `
        <div class="myio-igw-item" data-gw-idx="${idx}">
          <div class="myio-igw-item__head">
            <span class="myio-igw-item__title">${title}</span>
            <span class="myio-igw-item__toggle">▼</span>
            <button class="myio-igw-item__del" data-gw-del="${idx}" title="Remover">×</button>
          </div>
          <div class="myio-igw-item__body">
            <div class="myio-isetup__row myio-isetup__row--2">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">UUID</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="uuid" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${e(item.uuid)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Hardware ID</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="hardwareId" type="text" placeholder="hardware_id" value="${e(item.hardwareId)}" />
              </div>
            </div>
            <div class="myio-isetup__row myio-isetup__row--2">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Name</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="name" type="text" placeholder="Gateway name" value="${e(item.name)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Asset Parent</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="assetParent" type="text" placeholder="UUID or name" value="${e(item.assetParent)}" />
              </div>
            </div>
            <div class="myio-isetup__row myio-isetup__row--4">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Legacy <span>ms</span></label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="legacyFetchInterval" type="number" min="0" step="1000" placeholder="30000" value="${item.legacyFetchInterval ?? 30000}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Energy <span>ms</span></label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="energyFetchInterval" type="number" min="0" step="1000" placeholder="300000" value="${item.energyFetchInterval ?? 300000}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Water <span>ms</span></label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="waterFetchInterval" type="number" min="0" step="1000" placeholder="300000" value="${item.waterFetchInterval ?? 300000}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Temp <span>ms</span></label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="temperatureFetchInterval" type="number" min="0" step="1000" placeholder="60000" value="${item.temperatureFetchInterval ?? 60000}" />
              </div>
            </div>
            <div class="myio-isetup__row myio-isetup__row--3">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Last Energy Fetch <span>readonly</span></label>
                <input class="myio-isetup__input" type="text" readonly placeholder="—" value="${fmtDate(item.lastEnergyFetch)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Last Water Fetch <span>readonly</span></label>
                <input class="myio-isetup__input" type="text" readonly placeholder="—" value="${fmtDate(item.lastWaterFetch)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Last Temp Fetch <span>readonly</span></label>
                <input class="myio-isetup__input" type="text" readonly placeholder="—" value="${fmtDate(item.lastTemperatureFetch)}" />
              </div>
            </div>
            <div class="myio-igw-pause">
              <input type="checkbox" data-gw-idx="${idx}" data-gw-field="pauseGateway" id="isetup-pause-ing-${idx}" ${item.pauseGateway ? 'checked' : ''} />
              <label class="myio-isetup__label" for="isetup-pause-ing-${idx}" style="cursor:pointer;margin:0">Pause Gateway</label>
            </div>
          </div>
        </div>`;

      if (type === 'gcdr') return `
        <div class="myio-igw-item" data-gw-idx="${idx}">
          <div class="myio-igw-item__head">
            <span class="myio-igw-item__title">${title}</span>
            <span class="myio-igw-item__toggle">▼</span>
            <button class="myio-igw-item__del" data-gw-del="${idx}" title="Remover">×</button>
          </div>
          <div class="myio-igw-item__body">
            <div class="myio-isetup__row myio-isetup__row--2">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">UUID</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="uuid" type="text" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${e(item.uuid)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Name</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="name" type="text" placeholder="Gateway name" value="${e(item.name)}" />
              </div>
            </div>
            <div class="myio-isetup__row myio-isetup__row--2">
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Asset Parent</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="assetParent" type="text" placeholder="UUID or name" value="${e(item.assetParent)}" />
              </div>
              <div class="myio-isetup__field">
                <label class="myio-isetup__label">Bundle Version</label>
                <input class="myio-isetup__input" data-gw-idx="${idx}" data-gw-field="bundleVersion" type="text" placeholder="1.0.0" value="${e(item.bundleVersion)}" />
              </div>
            </div>
          </div>
        </div>`;

      return '';
    }

    function setNestedField(obj, path, value) {
      const parts = path.split('.');
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]]) cur[parts[i]] = {}; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = value;
    }

    function renderGwList(type) {
      const panel = modal.querySelector('#isetup-gw-' + type);
      const items = _gwData[type];
      panel.innerHTML = items.map((item, idx) => makeGwItem(type, item, idx)).join('') +
        `<button class="myio-igw-add" data-gw-add="${type}">＋ Adicionar gateway</button>`;

      // Collapse toggle
      panel.querySelectorAll('.myio-igw-item__head').forEach((head) => {
        head.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-gw-del]')) return;
          const body = head.nextElementSibling;
          const tog  = head.querySelector('.myio-igw-item__toggle');
          const collapsed = body.classList.toggle('collapsed');
          if (tog) tog.textContent = collapsed ? '▶' : '▼';
        });
      });

      // Field input → update _gwData reactively
      panel.querySelectorAll('[data-gw-field]').forEach((input) => {
        input.addEventListener('input', () => {
          const idx   = parseInt(input.dataset.gwIdx);
          const field = input.dataset.gwField;
          const val   = input.type === 'checkbox' ? input.checked
                      : input.type === 'number'   ? Number(input.value)
                      : input.value;
          setNestedField(_gwData[type][idx], field, val);
          // Update card title if name changed
          if (field === 'name') {
            const titleEl = panel.querySelector(`[data-gw-idx="${idx}"] .myio-igw-item__title`);
            if (titleEl) titleEl.textContent = input.value || ('Gateway ' + (idx + 1));
          }
        });
        // Checkbox change event
        if (input.type === 'checkbox') {
          input.addEventListener('change', () => {
            const idx   = parseInt(input.dataset.gwIdx);
            const field = input.dataset.gwField;
            setNestedField(_gwData[type][idx], field, input.checked);
          });
        }
      });

      // Delete
      panel.querySelectorAll('[data-gw-del]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const idx = parseInt(btn.dataset.gwDel);
          _gwData[type].splice(idx, 1);
          renderGwList(type);
        });
      });

      // Add
      const addBtn = panel.querySelector('[data-gw-add]');
      if (addBtn) addBtn.addEventListener('click', () => {
        _gwData[type].push(GW_DEFAULTS[type]());
        renderGwList(type);
        // scroll last item into view
        const last = panel.querySelector('.myio-igw-item:last-of-type');
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    // ── Fetch dados do customer (SERVER_SCOPE) ────────────────────────────────
    const EMPTY_DATA = {
      schema_version: '1.0.0',
      ingestion: { ingestionId: '', client_id: '', client_secret: '' },
      gcdr: { gcdrCustomerId: '', gcdrApiKey: '', gcdrTenantId: '', gcdrSyncedAt: null },
      gateways: { tb: [], ingestion: [], gcdr: [] },
    };
    let gcdrSyncedAt = null;

    fetch(
      `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=integration_setup`,
      { headers: buildAuthHeaders(), credentials: 'include' }
    )
      .then((res) => (res.ok ? res.json().catch(() => []) : []))
      .then((attrs) => {
        const attr   = Array.isArray(attrs) ? attrs.find((a) => a.key === 'integration_setup') : null;
        const parsed = attr?.value
          ? (typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value)
          : {};

        const ing  = { ...EMPTY_DATA.ingestion, ...(parsed.ingestion || {}) };
        const gcdr = { ...EMPTY_DATA.gcdr,       ...(parsed.gcdr      || {}) };
        const gw   = parsed.gateways || EMPTY_DATA.gateways;
        gcdrSyncedAt = gcdr.gcdrSyncedAt;

        // Seções 1 e 2 — campos simples
        modal.querySelector('#isetup-ingestionId').value    = ing.ingestionId;
        modal.querySelector('#isetup-clientId').value       = ing.client_id;
        modal.querySelector('#isetup-clientSecret').value   = ing.client_secret;
        modal.querySelector('#isetup-gcdrCustomerId').value = gcdr.gcdrCustomerId;
        modal.querySelector('#isetup-gcdrApiKey').value     = gcdr.gcdrApiKey;
        modal.querySelector('#isetup-gcdrTenantId').value   = gcdr.gcdrTenantId;
        modal.querySelector('#isetup-gcdrSyncedAt').value   = fmtDate(gcdr.gcdrSyncedAt);

        // Seção 3 — gateways
        _gwData.tb        = Array.isArray(gw.tb)        ? gw.tb.map((i) => ({ ...GW_DEFAULTS.tb(),        ...i, mqtt: { ...GW_DEFAULTS.tb().mqtt,         ...(i.mqtt || {}) } })) : [];
        _gwData.ingestion = Array.isArray(gw.ingestion) ? gw.ingestion.map((i) => ({ ...GW_DEFAULTS.ingestion(), ...i })) : [];
        _gwData.gcdr      = Array.isArray(gw.gcdr)      ? gw.gcdr.map((i) => ({ ...GW_DEFAULTS.gcdr(),      ...i })) : [];

        renderGwList('tb');
        renderGwList('ingestion');
        renderGwList('gcdr');

        LogHelper.log('[MENU] integration_setup loaded', { ing, gcdr, gw });
      })
      .catch((err) => {
        LogHelper.warn('[MENU] Error loading integration_setup:', err);
        modal.querySelector('#isetup-status').textContent = 'Aviso: não foi possível carregar dados existentes.';
        modal.querySelector('#isetup-status').className   = 'myio-isetup__status err';
        // render empty lists so user can still add items
        renderGwList('tb');
        renderGwList('ingestion');
        renderGwList('gcdr');
      })
      .finally(() => {
        modal.querySelector('#isetup-loading').style.display = 'none';
        modal.querySelector('#isetup-form').style.display    = 'flex';
        modal.querySelector('#isetup-form').style.flexDirection = 'column';
        modal.querySelector('#isetup-form').style.gap        = '16px';
        modal.querySelector('#isetup-save').disabled         = false;
      });

    // ── Save ─────────────────────────────────────────────────────────────────
    modal.querySelector('#isetup-save').addEventListener('click', async () => {
      const statusEl = modal.querySelector('#isetup-status');
      const saveBtn  = modal.querySelector('#isetup-save');

      const payload = {
        schema_version: '1.0.0',
        updated_at:     new Date().toISOString(),
        updated_by:     window.MyIOUtils?.currentUserEmail || user?.email || 'unknown',
        ingestion: {
          ingestionId:   modal.querySelector('#isetup-ingestionId').value.trim(),
          client_id:     modal.querySelector('#isetup-clientId').value.trim(),
          client_secret: modal.querySelector('#isetup-clientSecret').value,
        },
        gcdr: {
          gcdrCustomerId: modal.querySelector('#isetup-gcdrCustomerId').value.trim(),
          gcdrApiKey:     modal.querySelector('#isetup-gcdrApiKey').value,
          gcdrTenantId:   modal.querySelector('#isetup-gcdrTenantId').value.trim(),
          gcdrSyncedAt:   gcdrSyncedAt,
        },
        gateways: {
          tb:        JSON.parse(JSON.stringify(_gwData.tb)),
          ingestion: JSON.parse(JSON.stringify(_gwData.ingestion)),
          gcdr:      JSON.parse(JSON.stringify(_gwData.gcdr)),
        },
      };

      saveBtn.disabled = true;
      statusEl.textContent = 'Salvando…';
      statusEl.className = 'myio-isetup__status';

      try {
        const res = await fetch(
          `/api/plugins/telemetry/CUSTOMER/${customerId}/SERVER_SCOPE`,
          {
            method:      'POST',
            headers:     { ...buildAuthHeaders(), 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ integration_setup: payload }),
          }
        );

        if (res.ok) {
          statusEl.textContent = '✓ Salvo com sucesso';
          statusEl.className = 'myio-isetup__status ok';
          window.dispatchEvent(new CustomEvent('myio:integration-setup-updated', { detail: payload }));
          setTimeout(closeModal, 1200);
        } else {
          const body = await res.text().catch(() => '');
          statusEl.textContent = `Erro ${res.status}${body ? ': ' + body.slice(0, 80) : ''}`;
          statusEl.className = 'myio-isetup__status err';
        }
      } catch (err) {
        statusEl.textContent = 'Erro de rede: ' + (err.message || err);
        statusEl.className = 'myio-isetup__status err';
      } finally {
        saveBtn.disabled = false;
      }
    });

    LogHelper.log('[MENU] Integration setup modal opened for customer:', customerId);
  }

  // Helper: escape HTML for safe insertion in innerHTML
  function escHtml(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // RFC-0108: Open temperature settings modal
  function openTemperatureSettings(user) {
    const MyIOLibrary = window.MyIOLibrary;
    if (!MyIOLibrary?.openTemperatureSettingsModal) {
      LogHelper.error('[MENU] openTemperatureSettingsModal not available');
      window.alert('Componente de configuração de temperatura não disponível.');
      return;
    }

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) {
      window.alert('Token de autenticação não encontrado. Faça login novamente.');
      return;
    }

    const customerId = window.MyIOOrchestrator?.customerTB_ID;
    const customerName = user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || 'Cliente';

    if (!customerId) {
      window.alert('ID do cliente não encontrado. Verifique configuração do dashboard.');
      return;
    }

    MyIOLibrary.openTemperatureSettingsModal({
      token: jwtToken,
      customerId: customerId,
      customerName: customerName,
      theme: 'light',
      isSuperAdmin: window.MyIOUtils?.SuperAdmin || false,
      onSave: (settings) => {
        LogHelper.log('[MENU] Temperature settings saved:', settings);
        // Update in-memory clamp range when superadmin saves new values
        if (settings.temperatureClampMin !== undefined && settings.temperatureClampMax !== undefined) {
          window.MyIOUtils.temperatureClampRange = {
            min: settings.temperatureClampMin,
            max: settings.temperatureClampMax,
          };
        }
        window.dispatchEvent(new CustomEvent('myio:temperature-settings-updated', { detail: settings }));
      },
      onClose: () => LogHelper.log('[MENU] Temperature settings modal closed'),
    });
  }

  // RFC-0108: Open contract devices modal
  function openContractDevicesSettings(user) {
    const MyIOLibrary = window.MyIOLibrary;
    if (!MyIOLibrary?.openContractDevicesModal) {
      LogHelper.error('[MENU] openContractDevicesModal not available');
      window.alert('Componente de dispositivos contratados não disponível.');
      return;
    }

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) {
      window.alert('Token de autenticação não encontrado. Faça login novamente.');
      return;
    }

    const customerId = window.MyIOOrchestrator?.customerTB_ID;
    const customerName = user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || 'Cliente';

    if (!customerId) {
      window.alert('ID do cliente não encontrado. Verifique configuração do dashboard.');
      return;
    }

    MyIOLibrary.openContractDevicesModal({
      customerId: customerId,
      customerName: customerName,
      jwtToken: jwtToken,
      userEmail: user?.email,
      ui: {
        width: 1100,
      },
      onSaved: (result) => {
        LogHelper.log('[MENU] Contract devices saved:', result);
        window.dispatchEvent(new CustomEvent('myio:contract-devices-updated', { detail: result }));
      },
      onClose: () => LogHelper.log('[MENU] Contract devices modal closed'),
      onError: (error) => {
        LogHelper.error('[MENU] Contract devices error:', error);
        window.alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
      },
    });
  }

  // RFC-0108: Open measurement setup modal
  function openMeasurementSettings(user) {
    const MyIOLibrary = window.MyIOLibrary;
    if (!MyIOLibrary?.openMeasurementSetupModal) {
      LogHelper.error('[MENU] openMeasurementSetupModal not available');
      window.alert('Componente de configuração de medidas não disponível.');
      return;
    }

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) {
      window.alert('Token de autenticação não encontrado. Faça login novamente.');
      return;
    }

    const customerId = window.MyIOOrchestrator?.customerTB_ID;
    if (!customerId) {
      window.alert('ID do cliente não encontrado. Verifique configuração do dashboard.');
      return;
    }

    const existingSettings =
      window.MyIOOrchestrator?.measurementDisplaySettings ||
      (window.MyIOUtils?.measurementSettings
        ? {
            water: { ...window.MyIOUtils.measurementSettings.water },
            energy: { ...window.MyIOUtils.measurementSettings.energy },
            temperature: { ...window.MyIOUtils.measurementSettings.temperature },
          }
        : null);

    MyIOLibrary.openMeasurementSetupModal({
      token: jwtToken,
      customerId: customerId,
      existingSettings: existingSettings,
      userName: user?.firstName || user?.email || '',
      onSave: (settings) => {
        LogHelper.log('[MENU] Measurement settings saved:', settings);
        if (window.MyIOUtils?.updateMeasurementSettings) {
          window.MyIOUtils.updateMeasurementSettings(settings);
        }
        if (window.MyIOOrchestrator) {
          window.MyIOOrchestrator.measurementDisplaySettings = settings;
        }
        window.dispatchEvent(new CustomEvent('myio:measurement-settings-updated', { detail: settings }));
      },
      onClose: () => LogHelper.log('[MENU] Measurement setup modal closed'),
    });
  }

  // RFC-0055: Add shopping selector button for sacavalcante.com.br users
  function addShoppingSelectorButton() {
    if (document.getElementById('shopping-selector-btn')) {
      LogHelper.log('[MENU] Shopping selector button already exists');
      return;
    }

    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');
    if (!menuFooter) {
      LogHelper.error('[MENU] Menu footer not found - cannot add shopping selector');
      return;
    }

    const shoppingSelectorBtn = document.createElement('button');
    shoppingSelectorBtn.id = 'shopping-selector-btn';
    shoppingSelectorBtn.className = 'shopping-selector-btn';
    shoppingSelectorBtn.type = 'button';
    shoppingSelectorBtn.setAttribute('aria-label', 'Trocar Shopping');

    // detecta Mac uma vez e injeta direto no template
    const isMac = /mac/i.test(navigator.userAgent);
    shoppingSelectorBtn.innerHTML = `
    <div class="ssb-grid">
      <span class="ssb-icon" aria-hidden="true">🏬</span>
      <div class="ssb-text">
        <span class="ssb-title" style="display: none;">Trocar Shopping</span>
        <span class="ssb-sub" id="ssb-current-shopping"></span>
      </div>
      <span class="ssb-kbd" aria-hidden="true" style="display: none;">${isMac ? '⌘K' : 'Ctrl+K'}</span>
    </div>
  `;

    if (logoutBtn) menuFooter.insertBefore(shoppingSelectorBtn, logoutBtn);
    else menuFooter.appendChild(shoppingSelectorBtn);

    // rótulo inicial
    updateShoppingLabelFromDashboard();

    // clique
    shoppingSelectorBtn.addEventListener('click', () => {
      LogHelper.log('[MENU] Shopping selector clicked');
      //showShoppingModal();
    });

    LogHelper.log('[MENU] Shopping selector button added successfully');
  }

  // RFC-0085: Add temperature settings button for admin users
  function addTemperatureSettingsButton(user) {
    if (document.getElementById('temp-settings-btn')) {
      LogHelper.log('[MENU] Temperature settings button already exists');
      return;
    }

    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');
    if (!menuFooter) {
      LogHelper.error('[MENU] Menu footer not found - cannot add temperature settings');
      return;
    }

    const tempSettingsBtn = document.createElement('button');
    tempSettingsBtn.id = 'temp-settings-btn';
    tempSettingsBtn.className = 'temp-settings-btn';
    tempSettingsBtn.type = 'button';
    tempSettingsBtn.setAttribute('aria-label', 'Configurar Temperatura');
    // Styling handled by CSS in style.css (#temp-settings-btn.temp-settings-btn)

    tempSettingsBtn.innerHTML = `
      <span class="temp-icon">🌡️</span>
      <span class="temp-text">Config. Temperatura</span>
    `;

    // Insert before logout button
    if (logoutBtn) menuFooter.insertBefore(tempSettingsBtn, logoutBtn);
    else menuFooter.appendChild(tempSettingsBtn);

    // Click handler
    tempSettingsBtn.addEventListener('click', () => {
      LogHelper.log('[MENU] Temperature settings clicked');

      const MyIOLibrary = window.MyIOLibrary;
      if (!MyIOLibrary?.openTemperatureSettingsModal) {
        LogHelper.error('[MENU] openTemperatureSettingsModal not available');
        window.alert('Componente de configuração de temperatura não disponível.');
        return;
      }

      const jwtToken = localStorage.getItem('jwt_token');
      if (!jwtToken) {
        window.alert('Token de autenticação não encontrado. Faça login novamente.');
        return;
      }

      // RFC-0085: Get customerTB_ID from MAIN_VIEW orchestrator (single source of truth)
      const customerId = window.MyIOOrchestrator?.customerTB_ID;
      const customerName =
        user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || 'Cliente';

      if (!customerId) {
        LogHelper.error(
          '[MENU] customerTB_ID not found in MyIOOrchestrator - ensure MAIN_VIEW is configured'
        );
        window.alert('ID do cliente não encontrado. Verifique configuração do dashboard.');
        return;
      }

      LogHelper.log('[MENU] Opening temperature settings for customer:', { customerId, customerName });

      MyIOLibrary.openTemperatureSettingsModal({
        token: jwtToken,
        customerId: customerId,
        customerName: customerName,
        theme: 'dark',
        onSave: (settings) => {
          LogHelper.log('[MENU] Temperature settings saved:', settings);
          // Dispatch event to notify other widgets
          window.dispatchEvent(
            new CustomEvent('myio:temperature-settings-updated', {
              detail: settings,
            })
          );
        },
        onClose: () => {
          LogHelper.log('[MENU] Temperature settings modal closed');
        },
      });
    });

    LogHelper.log('[MENU] Temperature settings button added successfully');
  }

  // RFC-0107: Add contract devices button for admin users
  function addContractDevicesButton(user) {
    if (document.getElementById('contract-devices-btn')) {
      LogHelper.log('[MENU] Contract devices button already exists');
      return;
    }

    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');
    if (!menuFooter) {
      LogHelper.error('[MENU] Menu footer not found - cannot add contract devices button');
      return;
    }

    const contractDevicesBtn = document.createElement('button');
    contractDevicesBtn.id = 'contract-devices-btn';
    contractDevicesBtn.className = 'contract-devices-btn';
    contractDevicesBtn.type = 'button';
    contractDevicesBtn.setAttribute('aria-label', 'Dispositivos Contratados');

    contractDevicesBtn.innerHTML = `
      <span class="contract-icon">📋</span>
      <span class="contract-text">Dispositivos Contratados</span>
    `;

    // Insert before logout button
    if (logoutBtn) menuFooter.insertBefore(contractDevicesBtn, logoutBtn);
    else menuFooter.appendChild(contractDevicesBtn);

    // Click handler
    contractDevicesBtn.addEventListener('click', () => {
      LogHelper.log('[MENU] Contract devices clicked');

      const MyIOLibrary = window.MyIOLibrary;
      if (!MyIOLibrary?.openContractDevicesModal) {
        LogHelper.error('[MENU] openContractDevicesModal not available');
        window.alert('Componente de dispositivos contratados nao disponivel.');
        return;
      }

      const jwtToken = localStorage.getItem('jwt_token');
      if (!jwtToken) {
        window.alert('Token de autenticacao nao encontrado. Faca login novamente.');
        return;
      }

      // RFC-0107: Get customerTB_ID from MAIN_VIEW orchestrator (single source of truth)
      const customerId = window.MyIOOrchestrator?.customerTB_ID;
      const customerName =
        user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || 'Cliente';

      if (!customerId) {
        LogHelper.error(
          '[MENU] customerTB_ID not found in MyIOOrchestrator - ensure MAIN_VIEW is configured'
        );
        window.alert('ID do cliente nao encontrado. Verifique configuracao do dashboard.');
        return;
      }

      LogHelper.log('[MENU] Opening contract devices modal for customer:', { customerId, customerName });

      MyIOLibrary.openContractDevicesModal({
        customerId: customerId,
        customerName: customerName,
        jwtToken: jwtToken,
        userEmail: user?.email,
        ui: {
          width: 1100,
        },
        onSaved: (result) => {
          LogHelper.log('[MENU] Contract devices saved:', result);
          // Dispatch event to notify other widgets
          window.dispatchEvent(
            new CustomEvent('myio:contract-devices-updated', {
              detail: result,
            })
          );
        },
        onClose: () => {
          LogHelper.log('[MENU] Contract devices modal closed');
        },
        onError: (error) => {
          LogHelper.error('[MENU] Contract devices error:', error);
          window.alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
        },
      });
    });

    LogHelper.log('[MENU] Contract devices button added successfully');
  }

  // RFC-0108: Add measurement setup button for admin users
  function addMeasurementSetupButton(user) {
    if (document.getElementById('measurement-setup-btn')) {
      LogHelper.log('[MENU] Measurement setup button already exists');
      return;
    }

    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');
    if (!menuFooter) {
      LogHelper.error('[MENU] Menu footer not found - cannot add measurement setup button');
      return;
    }

    const measurementSetupBtn = document.createElement('button');
    measurementSetupBtn.id = 'measurement-setup-btn';
    measurementSetupBtn.className = 'measurement-setup-btn';
    measurementSetupBtn.type = 'button';
    measurementSetupBtn.setAttribute('aria-label', 'Configurar Medidas');

    measurementSetupBtn.innerHTML = `
      <span class="measurement-icon">📐</span>
      <span class="measurement-text">Config. Medidas</span>
    `;

    // Insert before logout button
    if (logoutBtn) menuFooter.insertBefore(measurementSetupBtn, logoutBtn);
    else menuFooter.appendChild(measurementSetupBtn);

    // Click handler
    measurementSetupBtn.addEventListener('click', () => {
      LogHelper.log('[MENU] Measurement setup clicked');

      const MyIOLibrary = window.MyIOLibrary;
      if (!MyIOLibrary?.openMeasurementSetupModal) {
        LogHelper.error('[MENU] openMeasurementSetupModal not available');
        window.alert('Componente de configuração de medidas não disponível.');
        return;
      }

      const jwtToken = localStorage.getItem('jwt_token');
      if (!jwtToken) {
        window.alert('Token de autenticação não encontrado. Faça login novamente.');
        return;
      }

      // RFC-0108: Get customerTB_ID from MAIN_VIEW orchestrator (single source of truth)
      const customerId = window.MyIOOrchestrator?.customerTB_ID;
      const customerName =
        user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || 'Cliente';

      if (!customerId) {
        LogHelper.error(
          '[MENU] customerTB_ID not found in MyIOOrchestrator - ensure MAIN_VIEW is configured'
        );
        window.alert('ID do cliente não encontrado. Verifique configuração do dashboard.');
        return;
      }

      LogHelper.log('[MENU] Opening measurement setup modal for customer:', { customerId, customerName });

      // RFC-0108: Get existing settings from orchestrator or MyIOUtils defaults
      const existingSettings =
        window.MyIOOrchestrator?.measurementDisplaySettings ||
        (window.MyIOUtils?.measurementSettings
          ? {
              water: { ...window.MyIOUtils.measurementSettings.water },
              energy: { ...window.MyIOUtils.measurementSettings.energy },
              temperature: { ...window.MyIOUtils.measurementSettings.temperature },
            }
          : null);

      MyIOLibrary.openMeasurementSetupModal({
        token: jwtToken,
        customerId: customerId,
        existingSettings: existingSettings,
        userName: user?.firstName || user?.email || '',
        onSave: (settings) => {
          LogHelper.log('[MENU] Measurement settings saved:', settings);
          // RFC-0108: Update MyIOUtils shared settings directly
          if (window.MyIOUtils?.updateMeasurementSettings) {
            window.MyIOUtils.updateMeasurementSettings(settings);
          }
          // Update orchestrator with new settings
          if (window.MyIOOrchestrator) {
            window.MyIOOrchestrator.measurementDisplaySettings = settings;
          }
          // Dispatch event to notify other widgets (TELEMETRY, MAIN_VIEW, etc.)
          window.dispatchEvent(
            new CustomEvent('myio:measurement-settings-updated', {
              detail: settings,
            })
          );
        },
        onClose: () => {
          LogHelper.log('[MENU] Measurement setup modal closed');
        },
      });
    });

    LogHelper.log('[MENU] Measurement setup button added successfully');
  }

  function openReportsPickerModal() {
    const orch  = window.MyIOOrchestrator || {};
    const creds = orch.getCredentials?.() || {};
    const baseParams = {
      customerId: creds.CUSTOMER_ING_ID || '',
      debug: 0,
      api: {
        clientId:       creds.CLIENT_ID     || '',
        clientSecret:   creds.CLIENT_SECRET || '',
        dataApiBaseUrl: window.MyIOUtils?.DATA_API_HOST || 'https://api.data.apps.myio-bas.com',
        ingestionToken: orch.tokenManager?.getToken('ingestionToken') || '',
      },
      ui: { theme: 'light' },
    };
    _renderReportsPicker(baseParams);
  }

  function _renderReportsPicker(baseParams) {
    const MODAL_ID = 'myio-reports-picker-modal';
    const STYLE_ID = 'myio-reports-picker-styles';

    // Inject at the highest accessible document level so modal covers full viewport
    const topWin = window.top || window;
    const topDoc = (() => { try { return topWin.document; } catch { return document; } })();

    // Second click on Reports closes the modal
    const existing = topDoc.getElementById(MODAL_ID);
    if (existing) { existing.remove(); return; }

    // Inject styles once
    if (!topDoc.getElementById(STYLE_ID)) {
      const s = topDoc.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .rp-overlay{position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s ease;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
        .rp-overlay.show{opacity:1;}
        .rp-modal{position:relative;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:min(640px,92vw);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;transform:translateY(12px) scale(.98);transition:transform .2s ease;}
        .rp-overlay.show .rp-modal{transform:translateY(0) scale(1);}
        .rp-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;flex-shrink:0;}
        .rp-header h3{margin:0;font-size:16px;font-weight:600;display:flex;align-items:center;gap:8px;}
        .rp-close{background:transparent;border:none;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:4px;border-radius:4px;transition:background .15s;}
        .rp-close:hover{background:rgba(255,255,255,.15);}
        .rp-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#f9fafb;flex-shrink:0;overflow-x:auto;}
        .rp-tab{flex:1 1 auto;padding:12px 8px;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:500;color:#6b7280;border-bottom:3px solid transparent;transition:all .15s;white-space:nowrap;}
        .rp-tab:hover{color:#1565c0;background:#eff6ff;}
        .rp-tab.active{color:#1565c0;border-bottom-color:#1565c0;background:#fff;}
        .rp-body{padding:20px;overflow-y:auto;}
        .rp-panel{display:none;flex-direction:column;gap:12px;}
        .rp-panel.active{display:flex;}
        .rp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;}
        .rp-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid #e5e7eb;border-radius:12px;background:#fafafa;cursor:pointer;transition:all .15s;position:relative;text-align:left;width:100%;}
        .rp-card[data-enabled="true"]:hover{background:#eff6ff;border-color:#90caf9;box-shadow:0 4px 12px rgba(21,101,192,.1);transform:translateY(-1px);}
        .rp-card[data-enabled="false"]{opacity:.55;cursor:not-allowed;}
        .rp-card__icon{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:20px;flex-shrink:0;}
        .rp-card__text{display:flex;flex-direction:column;gap:2px;min-width:0;}
        .rp-card__title{font-size:14px;font-weight:600;color:#1f2937;}
        .rp-card__desc{font-size:11px;color:#6b7280;}
        .rp-badge{position:absolute;top:8px;right:8px;font-size:12px;color:#9ca3af;background:#f3f4f6;border:1px solid #e5e7eb;padding:2px 5px;border-radius:20px;line-height:1.4;}
        .rp-card[data-enabled="true"] .rp-badge{display:none;}
      `;
      topDoc.head.appendChild(s);
    }

    // RFC-0182: read enabled report items from MAIN_VIEW settings (via window.MyIOUtils)
    const enabledItems = window.MyIOUtils?.enabledReportItems || {};
    const ei = (key, def = false) => enabledItems[key] ?? def;

    const DOMAINS = [
      {
        id: 'energy', label: '⚡ Energia',
        items: [
          { id: 'entrada',    label: 'Entrada',            icon: '📥', bg: '#fff8e1', color: '#f57f17', desc: 'Medidores de entrada',    enabled: ei('energy_entrada')    },
          { id: 'area_comum', label: 'Área Comum',         icon: '🏢', bg: '#f3e5f5', color: '#6a1b9a', desc: 'Consumo de áreas comuns', enabled: ei('energy_area_comum') },
          { id: 'lojas',      label: 'Lojas',              icon: '🏬', bg: '#e8f5e9', color: '#2e7d32', desc: 'Consumo por loja',         enabled: ei('energy_lojas', true)},
          { id: 'todos',      label: 'Todos Dispositivos', icon: '📋', bg: '#e3f2fd', color: '#1565c0', desc: 'Todos os medidores',       enabled: ei('energy_todos')      },
        ],
      },
      {
        id: 'water', label: '💧 Água',
        items: [
          { id: 'entrada',    label: 'Entrada',            icon: '📥', bg: '#fff8e1', color: '#f57f17', desc: 'Medidores de entrada',    enabled: ei('water_entrada')    },
          { id: 'area_comum', label: 'Área Comum',         icon: '🏢', bg: '#f3e5f5', color: '#6a1b9a', desc: 'Consumo de áreas comuns', enabled: ei('water_area_comum') },
          { id: 'lojas',      label: 'Lojas',              icon: '🏬', bg: '#e0f2f1', color: '#00695c', desc: 'Consumo por loja',         enabled: ei('water_lojas')      },
          { id: 'todos',      label: 'Todos Dispositivos', icon: '📋', bg: '#e3f2fd', color: '#1565c0', desc: 'Todos os hidrômetros',    enabled: ei('water_todos')      },
        ],
      },
      {
        id: 'temperature', label: '🌡️ Temperatura',
        items: [
          { id: 'climatizavel',     label: 'Ambientes Climatizáveis',     icon: '❄️', bg: '#e1f5fe', color: '#0277bd', desc: 'Ambientes com termostato',    enabled: ei('temperature_climatizavel')     },
          { id: 'nao_climatizavel', label: 'Ambientes Não Climatizáveis', icon: '🌤️', bg: '#fff3e0', color: '#e65100', desc: 'Ambientes sem climatização', enabled: ei('temperature_nao_climatizavel') },
          { id: 'todos',            label: 'Todos Ambientes',             icon: '📋', bg: '#e3f2fd', color: '#1565c0', desc: 'Todos os termostatos',         enabled: ei('temperature_todos')            },
        ],
      },
      {
        id: 'alarms', label: '🔔 Alarmes',
        items: [
          { id: 'por_dispositivo',      label: 'Por Dispositivo',           icon: '📟', bg: '#fce4ec', color: '#880e4f', desc: 'Alarmes por dispositivo',         enabled: ei('alarms_por_dispositivo')      },
          { id: 'dispositivo_x_alarme', label: 'Por Dispositivo × Tipo',   icon: '🔀', bg: '#fff3e0', color: '#bf360c', desc: 'Cruzamento dispositivo × regra',  enabled: ei('alarms_dispositivo_x_alarme') },
          { id: 'por_tipo',             label: 'Por Tipo de Alarme',        icon: '🏷️', bg: '#ede7f6', color: '#4527a0', desc: 'Alarmes agrupados por tipo',      enabled: ei('alarms_por_tipo')             },
        ],
      },
    ];

    const tabsHTML = DOMAINS.map((d, i) =>
      `<button class="rp-tab${i === 0 ? ' active' : ''}" data-domain="${d.id}">${d.label}</button>`
    ).join('');

    const panelsHTML = DOMAINS.map((d, i) => `
      <div class="rp-panel${i === 0 ? ' active' : ''}" data-domain="${d.id}">
        <div class="rp-cards">
          ${d.items.map(item => `
            <button class="rp-card" data-domain="${d.id}" data-item="${item.id}" data-enabled="${item.enabled}" type="button">
              <span class="rp-card__icon" style="background:${item.bg};color:${item.color};">${item.icon}</span>
              <span class="rp-card__text">
                <span class="rp-card__title">${item.label}</span>
                <span class="rp-card__desc">${item.desc}</span>
              </span>
              ${!item.enabled ? '<span class="rp-badge">🔒</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    const overlay = topDoc.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'rp-overlay';
    overlay.innerHTML = `
      <div class="rp-modal">
        <div class="rp-header">
          <h3>📊 Relatórios</h3>
          <button class="rp-close" type="button" aria-label="Fechar">&#215;</button>
        </div>
        <div class="rp-tabs">${tabsHTML}</div>
        <div class="rp-body">${panelsHTML}</div>
      </div>
    `;

    topDoc.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    function closeModal() {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }

    overlay.querySelectorAll('.rp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.rp-tab').forEach(t => t.classList.remove('active'));
        overlay.querySelectorAll('.rp-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        overlay.querySelector(`.rp-panel[data-domain="${tab.dataset.domain}"]`).classList.add('active');
      });
    });

    overlay.querySelectorAll('.rp-card[data-enabled="true"]').forEach(card => {
      card.addEventListener('click', () => {
        const domain = card.dataset.domain;
        const group  = card.dataset.item;
        closeModal();
        _openGroupReport(domain, group, baseParams);
      });
    });

    overlay.querySelector('.rp-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  }

  // RFC-0182: group → itemsList mapping using orchestrator classified groups
  const GROUP_LABELS = {
    lojas:           'Lojas',
    entrada:         'Entrada',
    area_comum:      'Área Comum',
    banheiros:       'Banheiros',
    climatizavel:    'Climatizável',
    nao_climatizavel:'Não Climatizável',
  };

  function _buildItemsList(domain, group) {
    const orch = window.MyIOOrchestrator;
    let groups;
    if (domain === 'water') {
      groups = orch?.getWaterGroups?.()       || {};
    } else if (domain === 'temperature') {
      groups = orch?.getTemperatureGroups?.() || {};
    } else {
      groups = orch?.getEnergyGroups?.()      || {};
    }

    const toItem = (d, groupLabel) => ({
      id:         d.ingestionId || d.id || '',
      identifier: d.identifier  || d.label || d.name || '',
      label:      d.label       || d.name  || d.identifier || '',
      ...(groupLabel ? { groupLabel } : {}),
    });

    if (group === 'todos') {
      // Combine all groups (except ocultos), each item carries its groupLabel
      return Object.entries(groups)
        .filter(([key]) => key !== 'ocultos')
        .flatMap(([key, items]) => (items || []).map(d => toItem(d, GROUP_LABELS[key] || key)));
    }

    // Map group id → key in getXGroups() result
    // 'area_comum' in DOMAINS maps to 'areacomum' key returned by categorizeItemsByGroup
    const groupKey = group === 'area_comum' ? 'areacomum' : group;
    return (groups[groupKey] || []).map(d => toItem(d, null));
  }

  function _openGroupReport(domain, group, baseParams) {
    const MyIOLib = window.MyIOLibrary;
    if (!MyIOLib?.openDashboardPopupAllReport) {
      LogHelper.error('[MENU RFC-0181] openDashboardPopupAllReport not available');
      return;
    }

    const itemsList = _buildItemsList(domain, group);
    LogHelper.log(`[MENU RFC-0181] Opening report domain=${domain} group=${group} items=${itemsList.length}`);

    MyIOLib.openDashboardPopupAllReport({
      ...baseParams,
      domain,
      group,
      itemsList,
    });
  }

  // ─── end RFC-0181 ────────────────────────────────────────────────────────────

  // RFC-0055: Show modal with shopping options
  function showShoppingModal() {
    // tenta usar o documento de nível mais alto (dashboard inteiro)
    const topWin = window.top || window;
    const topDoc = (() => {
      try {
        return topWin.document;
      } catch {
        // Cross-origin access may fail, fallback to current document
        return document;
      }
    })();

    const SCOPE = topDoc; // onde vamos injetar (top-level ou fallback)
    const STYLE_ID = 'myio-shopping-modal-global-styles';
    const MODAL_ID = 'myio-shopping-modal';

    // remove se já existir
    const old = SCOPE.getElementById(MODAL_ID);
    if (old) old.remove();

    // injeta css global uma única vez
    if (!SCOPE.getElementById(STYLE_ID)) {
      const style = SCOPE.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
      /* overlay global, cobre a viewport toda */
      .myio-modal {
        position: fixed;
        inset: 0;
        z-index: 999999; /* bem alto pra passar por cima de tudo */
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity .2s ease;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .myio-modal.show { opacity: 1; pointer-events: auto; }
      .myio-modal__overlay {
        position: absolute; inset: 0;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(3px);
      }
      .myio-modal__window {
        position: relative; z-index: 2;
        background: #fff;
        width: min(480px, 92vw);
        border-radius: 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
        overflow: hidden;
        transform: translateY(12px) scale(.98);
        transition: transform .25s ease;
      }
      .myio-modal.show .myio-modal__window {
        transform: translateY(0) scale(1);
      }
      .myio-modal__header {
        display:flex; align-items:center; justify-content:space-between;
        padding: 14px 18px;
        background: #5B3CC4; color: #fff;
      }
      .myio-modal__header h3 { margin: 0; font-size: 1.05rem; font-weight: 600; }
      .myio-modal__close {
        background: transparent; border: 0; color: #fff;
        font-size: 22px; line-height: 1; cursor: pointer;
      }
      .myio-modal__body {
        padding: 14px;
        display: grid; gap: 10px;
      }
      .myio-shop {
        display:flex; align-items:center; gap: 12px;
        background: #fafafa; border: 1px solid #e6e6e6;
        border-radius: 12px; padding: 12px 14px; cursor:pointer;
        transition: background .15s, transform .15s, border-color .15s;
      }
      .myio-shop:hover { background:#f2ecff; border-color:#7b5dfb; transform: translateY(-1px); }
      .myio-shop__icon { font-size: 26px; }
      .myio-shop__title { margin:0; font-size: 1rem; color:#222; }
      .myio-shop__sub { margin:0; font-size:.8rem; color:#666; }
      @media (max-width: 480px){
        .myio-modal__window{ width: 94vw; }
      }
    `;
      SCOPE.head.appendChild(style);
    }

    // cria o modal no topo
    const modal = SCOPE.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'myio-modal';
    modal.innerHTML = `
    <div class="myio-modal__overlay" role="presentation"></div>
    <div class="myio-modal__window" role="dialog" aria-modal="true" aria-labelledby="myio-modal-title">
      <div class="myio-modal__header">
        <h3 id="myio-modal-title">Selecione o Shopping</h3>
        <button class="myio-modal__close" aria-label="Fechar">&times;</button>
      </div>
      <div class="myio-modal__body">
        <div class="myio-shop" data-url="https://dashboard.myio-bas.com/dashboards/all/ed5a0dd0-a3b7-11f0-afe1-175479a33d89">
          <div class="myio-shop__icon">🏢</div>
          <div>
            <p class="myio-shop__title">Mestre Álvaro</p>
            <p class="myio-shop__sub">Vitória - ES</p>
          </div>
        </div>
        <div class="myio-shop" data-url="https://dashboard.myio-bas.com/dashboards/all/1e785950-af55-11f0-9722-210aa9448abc">
          <div class="myio-shop__icon">🏬</div>
          <div>
            <p class="myio-shop__title">Mont Serrat</p>
            <p class="myio-shop__sub">Serra - ES</p>
          </div>
        </div>
      </div>
    </div>
  `;
    SCOPE.body.appendChild(modal);

    // bloqueia scroll do dashboard enquanto o modal está aberto
    const prevOverflow = SCOPE.body.style.overflow;
    SCOPE.body.style.overflow = 'hidden';

    const overlay = modal.querySelector('.myio-modal__overlay');
    const btnClose = modal.querySelector('.myio-modal__close');

    const close = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
        SCOPE.body.style.overflow = prevOverflow || '';
      }, 220);
    };

    overlay.addEventListener('click', close);
    btnClose.addEventListener('click', close);
    SCOPE.addEventListener('keydown', escCloseOnce, true);
    function escCloseOnce(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        SCOPE.removeEventListener('keydown', escCloseOnce, true);
      }
    }

    modal.querySelectorAll('.myio-shop').forEach((el) => {
      el.addEventListener('click', () => {
        const url = el.getAttribute('data-url');
        LogHelper.log('[MENU] Trocar shopping:', url);
        close();
        setTimeout(() => {
          topWin.location.href = url;
        }, 240);
      });
    });

    // anima
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  // RFC-0056 FIX: Emit initial dashboard-state to prevent race condition
  // The first link is usually the default (energy/telemetry)
  // This ensures HEADER and other widgets know the initial domain immediately
  setTimeout(() => {
    const firstLink = scope.links && scope.links[0];
    if (firstLink && firstLink.enableLink !== false) {
      const firstStateId = firstLink.stateId || 'telemetry_content';
      const firstDomain = DOMAIN_BY_STATE[firstStateId] || 'energy';

      LogHelper.log(`[MENU] RFC-0056 FIX: Emitting initial dashboard-state for domain: ${firstDomain}`);

      window.dispatchEvent(
        new CustomEvent('myio:dashboard-state', {
          detail: { tab: firstDomain },
        })
      );
    } else {
      // Fallback: emit energy as default
      LogHelper.log(`[MENU] RFC-0056 FIX: No first link found, emitting default domain: energy`);

      window.dispatchEvent(
        new CustomEvent('myio:dashboard-state', {
          detail: { tab: 'energy' },
        })
      );
    }
  }, 100); //Small delay to ensure HEADER is ready to listen

  // === Atalho global para abrir o modal (Ctrl+K / ⌘K) ===
  (function attachGlobalHotkey() {
    const topDoc = (window.top && window.top.document) || document;
    const isEditable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

    function onKeyDown(e) {
      // Mac = meta (⌘), Win/Linux = ctrl

      const isMac = /mac/i.test(navigator.userAgent);
      const meta = isMac ? e.metaKey : e.ctrlKey;

      if (!meta) return;
      // aceita 'k' min/maiúscula
      if ((e.key && e.key.toLowerCase() === 'k') || e.code === 'KeyK') {
        // não acione se o foco estiver digitando em um campo
        if (isEditable(e.target)) return;
        e.preventDefault();
        // TODO: showShoppingModal() disabled for now
      }
    }

    topDoc.addEventListener('keydown', onKeyDown, true);

    // garanta limpeza quando o widget sair
    const oldDestroy = self.onDestroy;
    self.onDestroy = function () {
      try {
        topDoc.removeEventListener('keydown', onKeyDown, true);
      } catch {
        // Ignore cleanup errors (topDoc may no longer be accessible)
      }
      if (typeof oldDestroy === 'function') oldDestroy();
    };
  })();

  // RFC-0139: Theme toggle icon listener
  // Listen for theme changes from MAIN and update icon
  // State: 'light' (default) or 'dark'
  let currentTheme = 'light';
  let versionCheckerInstance = null;

  (function initThemeToggleListener() {
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (!themeIcon) {
      LogHelper.warn('[MENU] RFC-0139: theme-toggle-icon element not found');
      return;
    }

    // Update icon based on theme
    function updateThemeIcon(theme) {
      currentTheme = theme;
      themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
      themeIcon.title = theme === 'dark' ? 'Tema escuro ativo' : 'Tema claro ativo';
      LogHelper.log(`[MENU] RFC-0139: Theme icon updated to ${theme === 'dark' ? '🌙' : '☀️'}`);

      // RFC-0139: Update LibraryVersionChecker theme if instance exists
      if (versionCheckerInstance && typeof versionCheckerInstance.setTheme === 'function') {
        versionCheckerInstance.setTheme(theme);
        LogHelper.log(`[MENU] RFC-0139: LibraryVersionChecker theme updated to ${theme}`);
      }
    }

    // Listen for theme changes from MAIN
    window.addEventListener('myio:theme-changed', (ev) => {
      const { theme } = ev.detail || {};
      if (theme === 'dark' || theme === 'light') {
        updateThemeIcon(theme);
      } else {
        LogHelper.warn(`[MENU] RFC-0139: Invalid theme received: ${theme}`);
      }
    });

    // Click handler: toggle theme via MyIOUtils (RFC-0139)
    themeIcon.style.cursor = 'pointer';
    themeIcon.addEventListener('click', () => {
      if (window.MyIOUtils?.toggleTheme) {
        window.MyIOUtils.toggleTheme();
      } else {
        // Fallback if MyIOUtils not yet available
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        updateThemeIcon(newTheme);
        window.dispatchEvent(new CustomEvent('myio:theme-changed', { detail: { theme: newTheme } }));
      }
    });

    // Set initial icon (light is default)
    updateThemeIcon('light');
    LogHelper.log('[MENU] RFC-0139: Theme toggle listener initialized');
  })();

  // ── Configurações Cliente (apenas MyIO @myio.com.br) ─────────────────────────
  // Gerencia atributos SERVER_SCOPE do Customer: canShowDemandButtons, master_admin_password
  function openClientConfigModal(user) {
    const topWin = window.top || window;
    const topDoc = (() => { try { return topWin.document; } catch { return document; } })();

    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) { window.alert('Token não encontrado. Faça login novamente.'); return; }

    const orch = window.MyIOOrchestrator;
    const customerId = orch?.customerTB_ID || user?.customerId?.id;
    if (!customerId) { window.alert('ID do cliente não encontrado.'); return; }

    const customerName = orch?.customerName || user?.customerTitle || user?.customerName || getCurrentDashboardTitle() || '';
    const tbBase = self.ctx?.settings?.tbBaseUrl || '';

    // ── CSS ──────────────────────────────────────────────────────────────────
    const STYLE_ID = 'myio-client-config-styles';
    if (!topDoc.getElementById(STYLE_ID)) {
      const s = topDoc.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .mcc-overlay{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        .mcc-overlay.show{opacity:1;pointer-events:auto}
        .mcc-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
        .mcc-card{position:relative;z-index:2;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);width:min(520px,95vw);display:flex;flex-direction:column;overflow:hidden;transform:translateY(12px) scale(.98);transition:transform .2s ease}
        .mcc-overlay.show .mcc-card{transform:translateY(0) scale(1)}
        .mcc-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#3e1a7d;color:#fff;min-height:36px}
        .mcc-header h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
        .mcc-close{background:transparent;border:none;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:4px;border-radius:4px;transition:background .15s}
        .mcc-close:hover{background:rgba(255,255,255,.15)}
        .mcc-body{padding:20px;display:flex;flex-direction:column;gap:18px}
        .mcc-loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:32px 0;color:#6B7280;font-size:13px}
        .mcc-spinner{width:18px;height:18px;border:2px solid #E9E0FA;border-top-color:#7B2FF7;border-radius:50%;animation:mcc-spin .7s linear infinite;flex-shrink:0}
        @keyframes mcc-spin{to{transform:rotate(360deg)}}
        .mcc-section{border:1px solid #E9E0FA;border-radius:12px;overflow:hidden}
        .mcc-section-title{background:#F3ECF9;padding:8px 14px;font-size:11px;font-weight:700;color:#5B2D8E;letter-spacing:.6px;text-transform:uppercase}
        .mcc-field{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;gap:12px}
        .mcc-field + .mcc-field{border-top:1px solid #F3F4F6}
        .mcc-field-label{display:flex;flex-direction:column;gap:3px;min-width:0}
        .mcc-field-name{font-size:13px;font-weight:600;color:#1F2937}
        .mcc-field-desc{font-size:11px;color:#6B7280;line-height:1.3}
        .mcc-toggle{position:relative;width:42px;height:24px;flex-shrink:0}
        .mcc-toggle input{opacity:0;width:0;height:0;position:absolute}
        .mcc-toggle-track{position:absolute;inset:0;background:#D1D5DB;border-radius:24px;cursor:pointer;transition:background .2s}
        .mcc-toggle input:checked + .mcc-toggle-track{background:#7B2FF7}
        .mcc-toggle-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:transform .2s;pointer-events:none}
        .mcc-toggle input:checked ~ .mcc-toggle-thumb{transform:translateX(18px)}
        .mcc-password-wrap{display:flex;gap:8px;align-items:center}
        .mcc-input{flex:1;padding:8px 10px;border:1px solid #D1D5DB;border-radius:8px;font-size:13px;color:#1F2937;outline:none;transition:border-color .15s}
        .mcc-input:focus{border-color:#7B2FF7;box-shadow:0 0 0 3px rgba(123,47,247,.1)}
        .mcc-footer{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #F3F4F6}
        .mcc-btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;border:none}
        .mcc-btn-cancel{background:#F3F4F6;color:#374151}
        .mcc-btn-cancel:hover{background:#E5E7EB}
        .mcc-btn-save{background:#7B2FF7;color:#fff}
        .mcc-btn-save:hover:not(:disabled){background:#6a25e0}
        .mcc-btn-save:disabled{opacity:.5;cursor:not-allowed}
        .mcc-error{font-size:12px;color:#DC2626;padding:0 20px 12px;text-align:right}
      `;
      topDoc.head.appendChild(s);
    }

    // Remove modal anterior
    const existing = topDoc.getElementById('myio-client-config-modal');
    if (existing) existing.remove();

    const modal = topDoc.createElement('div');
    modal.id = 'myio-client-config-modal';
    modal.className = 'mcc-overlay';
    modal.innerHTML = `
      <div class="mcc-bg"></div>
      <div class="mcc-card">
        <div class="mcc-header">
          <h3>🏢 Configurações Cliente${customerName ? ` — ${customerName}` : ''}</h3>
          <button class="mcc-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="mcc-body">
          <div class="mcc-loading">
            <span class="mcc-spinner"></span>
            Carregando configurações…
          </div>
        </div>
        <div class="mcc-footer" style="display:none">
          <button class="mcc-btn mcc-btn-cancel">Cancelar</button>
          <button class="mcc-btn mcc-btn-save" disabled>Salvar</button>
        </div>
      </div>
    `;
    topDoc.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));

    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 200);
    };
    modal.querySelector('.mcc-bg').addEventListener('click', closeModal);
    modal.querySelector('.mcc-close').addEventListener('click', closeModal);
    modal.querySelector('.mcc-btn-cancel').addEventListener('click', closeModal);
    const escHandler = (e) => { if (e.key === 'Escape') { closeModal(); topDoc.removeEventListener('keydown', escHandler); } };
    topDoc.addEventListener('keydown', escHandler);

    // ── Carrega atributos atuais ──────────────────────────────────────────────
    const KEYS = ['canShowDemandButtons', 'master_admin_password'];
    const fetchUrl = `${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=${KEYS.join(',')}`;

    fetch(fetchUrl, { headers: { 'X-Authorization': `Bearer ${jwtToken}` } })
      .then(r => r.ok ? r.json().catch(() => []) : [])
      .then(attrs => {
        const attrMap = {};
        if (Array.isArray(attrs)) attrs.forEach(a => { attrMap[a.key] = a.value; });

        const currentDemand = attrMap['canShowDemandButtons'] ?? null;
        const currentPassword = attrMap['master_admin_password'] ?? '';

        const body = modal.querySelector('.mcc-body');
        const footer = modal.querySelector('.mcc-footer');

        body.innerHTML = `
          <div class="mcc-section">
            <div class="mcc-section-title">Funcionalidades</div>
            <div class="mcc-field">
              <div class="mcc-field-label">
                <span class="mcc-field-name">Pico de Demanda / Telemetrias Instantâneas</span>
                <span class="mcc-field-desc">
                  Exibe os botões de análise avançada no modal de energia.<br>
                  <em>Atributo:</em> <code>canShowDemandButtons</code>
                  ${currentDemand === null ? ' <span style="color:#F59E0B">(não definido — fallback: deviceProfile)</span>' : ''}
                </span>
              </div>
              <label class="mcc-toggle" title="canShowDemandButtons">
                <input type="checkbox" id="mcc-demand-toggle" ${currentDemand === true ? 'checked' : ''}>
                <span class="mcc-toggle-track"></span>
                <span class="mcc-toggle-thumb"></span>
              </label>
            </div>
          </div>
          <div class="mcc-section">
            <div class="mcc-section-title">Segurança</div>
            <div class="mcc-field">
              <div class="mcc-field-label">
                <span class="mcc-field-name">Senha Master Admin</span>
                <span class="mcc-field-desc">
                  Senha exigida para ações administrativas sensíveis.<br>
                  <em>Atributo:</em> <code>master_admin_password</code>
                </span>
              </div>
              <div class="mcc-password-wrap">
                <input type="password" id="mcc-password-input" class="mcc-input" placeholder="Nova senha…" autocomplete="new-password" style="width:180px">
              </div>
            </div>
          </div>
          <div class="mcc-error" id="mcc-error-msg" style="display:none"></div>
        `;

        footer.style.display = '';
        const saveBtn = footer.querySelector('.mcc-btn-save');

        // Habilita salvar ao detectar qualquer mudança
        const enableSave = () => { saveBtn.disabled = false; };
        modal.querySelector('#mcc-demand-toggle').addEventListener('change', enableSave);
        modal.querySelector('#mcc-password-input').addEventListener('input', enableSave);

        // ── Salvar ────────────────────────────────────────────────────────────
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Salvando…';
          const errEl = modal.querySelector('#mcc-error-msg');
          errEl.style.display = 'none';

          const demandValue = modal.querySelector('#mcc-demand-toggle').checked;
          const passwordValue = modal.querySelector('#mcc-password-input').value.trim();

          const payload = { canShowDemandButtons: demandValue };
          if (passwordValue) payload.master_admin_password = passwordValue;

          try {
            const res = await fetch(
              `${tbBase}/api/plugins/telemetry/CUSTOMER/${customerId}/attributes/SERVER_SCOPE`,
              {
                method: 'POST',
                headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }
            );
            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 120) : ''}`);
            }
            LogHelper.log('[MENU] Configurações Cliente salvas:', payload);
            closeModal();
          } catch (err) {
            LogHelper.error('[MENU] Erro ao salvar Configurações Cliente:', err);
            errEl.textContent = 'Erro ao salvar: ' + err.message;
            errEl.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar';
          }
        });
      })
      .catch(err => {
        LogHelper.error('[MENU] Erro ao carregar Configurações Cliente:', err);
        modal.querySelector('.mcc-body').innerHTML = `<div style="padding:24px;text-align:center;color:#DC2626;font-size:13px">Erro ao carregar configurações: ${err.message}</div>`;
        modal.querySelector('.mcc-footer').style.display = '';
      });

    LogHelper.log('[MENU] Configurações Cliente modal aberta para customer:', customerId);
  }

  // RFC-0137: Initialize LibraryVersionChecker component
  (function initLibraryVersionChecker() {
    const container = document.getElementById('lib-version-display');
    if (!container) {
      LogHelper.warn('[MENU] RFC-0137: lib-version-display container not found');
      return;
    }

    const MyIOLib = window.MyIOLibrary;
    if (MyIOLib && typeof MyIOLib.createLibraryVersionChecker === 'function') {
      // RFC-0139: Store instance for theme updates
      versionCheckerInstance = MyIOLib.createLibraryVersionChecker(container, {
        packageName: 'myio-js-library',
        currentVersion: MyIOLib.version || 'unknown',
        theme: currentTheme, // Use current theme state
        onStatusChange: (status, currentVer, latestVer) => {
          LogHelper.log(
            `[MENU] RFC-0137: Version status: ${status} (current: ${currentVer}, latest: ${latestVer})`
          );
        },
      });
    } else {
      LogHelper.warn('[MENU] RFC-0137: createLibraryVersionChecker not available in MyIOLibrary');
      // Fallback: show version only
      const version = MyIOLib?.version || 'unknown';
      container.innerHTML = `<span style="font-size:12px;color:#9CA3AF;opacity:0.8;">v${version}</span>`;
    }
  })();
};
