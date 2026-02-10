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

  // Fetch and display user info
  fetchUserInfo();

  async function fetchUserInfo() {
    // helper local para montar headers sem enviar "Bearer null"
    function buildAuthHeaders() {
      const token = localStorage.getItem('jwt_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['X-Authorization'] = 'Bearer ' + token;
      return headers;
    }

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
    alarm_content: null, // No domain for alarms
  };

  scope.changeDashboardState = function (e, stateId, index) {
    e.preventDefault();

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
    const STYLE_ID = 'myio-settings-modal-styles';
    if (!topDoc.getElementById(STYLE_ID)) {
      const style = topDoc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .myio-settings-modal {
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
        .myio-settings-modal.show {
          opacity: 1;
          pointer-events: auto;
        }
        .myio-settings-modal__overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        .myio-settings-modal__content {
          position: relative;
          z-index: 2;
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          width: min(400px, 90vw);
          max-height: 90vh;
          overflow: hidden;
          transform: translateY(10px) scale(0.98);
          transition: transform 0.2s ease;
        }
        .myio-settings-modal.show .myio-settings-modal__content {
          transform: translateY(0) scale(1);
        }
        .myio-settings-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg, #7B1FA2, #9C27B0);
          color: white;
        }
        .myio-settings-modal__header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .myio-settings-modal__close {
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
        .myio-settings-modal__close:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .myio-settings-modal__body {
          padding: 16px;
          display: flex;
          flex-direction: column;
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
    const existingModal = topDoc.getElementById('myio-settings-modal');
    if (existingModal) existingModal.remove();

    const modal = topDoc.createElement('div');
    modal.id = 'myio-settings-modal';
    modal.className = 'myio-settings-modal';
    modal.innerHTML = `
      <div class="myio-settings-modal__overlay"></div>
      <div class="myio-settings-modal__content">
        <div class="myio-settings-modal__header">
          <h3>⚙️ Configurações</h3>
          <button class="myio-settings-modal__close" aria-label="Fechar">&times;</button>
        </div>
        <div class="myio-settings-modal__body">
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

    modal.querySelector('.myio-settings-modal__overlay').addEventListener('click', closeModal);
    modal.querySelector('.myio-settings-modal__close').addEventListener('click', closeModal);

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
          }
        }, 250);
      });
    });

    LogHelper.log('[MENU] Settings modal opened');
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
      theme: 'dark',
      onSave: (settings) => {
        LogHelper.log('[MENU] Temperature settings saved:', settings);
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

    // Set initial icon (light is default)
    updateThemeIcon('light');
    LogHelper.log('[MENU] RFC-0139: Theme toggle listener initialized');
  })();

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
