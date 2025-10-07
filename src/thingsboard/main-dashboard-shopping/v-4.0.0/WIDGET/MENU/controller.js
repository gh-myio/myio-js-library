// Debug configuration
const DEBUG_ACTIVE = true;

// LogHelper utility
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  }
};

self.onInit = function () {
  const settings = self.ctx.settings || {};
  const scope = self.ctx.$scope;

  scope.links = settings.links || [];
  scope.groupDashboardId = settings.groupDashboardId;

  // Fetch and display user info
  fetchUserInfo();

  async function fetchUserInfo() {
    try {
      LogHelper.log("[MENU] Fetching user info from /api/auth/user");

      const response = await fetch('/api/auth/user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const user = await response.json();
      LogHelper.log("[MENU] User info received:", user);

      // Update user info in the UI
      const userNameEl = document.getElementById('user-name');
      const userEmailEl = document.getElementById('user-email');

      if (userNameEl && user) {
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Usuário';
        userNameEl.textContent = fullName;

        LogHelper.log("[MENU] User name set to:", fullName);
      }

      if (userEmailEl && user?.email) {
        userEmailEl.textContent = user.email;
        LogHelper.log("[MENU] User email set to:", user.email);
      }

    } catch (err) {
      LogHelper.error("[MENU] Error fetching user info:", err);

      // Fallback UI
      const userNameEl = document.getElementById('user-name');
      const userEmailEl = document.getElementById('user-email');

      if (userNameEl) {
        userNameEl.textContent = 'Usuário';
      }
      if (userEmailEl) {
        userEmailEl.textContent = '';
      }
    }
  }

  // RFC-0042: State ID to Domain mapping
  const DOMAIN_BY_STATE = {
    telemetry_content: 'energy',
    water_content: 'water',
    temperature_content: 'temperature',
    alarm_content: null // No domain for alarms
  };

  scope.changeDashboardState = function (e, stateId, index) {
    e.preventDefault();

    // Marca o link selecionado e desmarca os outros
    scope.links.forEach((link, i) => link.enableLink = (i === index));

    // RFC-0042: Notify orchestrator of tab change
    const domain = DOMAIN_BY_STATE[stateId];
    if (domain) {
      LogHelper.log(`[MENU] Tab changed to domain: ${domain}`);
      window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
        detail: { tab: domain }
      }));
    }

    try {
      const main = document.getElementsByTagName("main")[0];
      if (!main) {
        LogHelper.error("[menu] Elemento <main> não encontrado.");
        return;
      }

      // Mapeia os stateId para os valores codificados
      let stateParam;
      switch (stateId) {
        case "telemetry_content":
          stateParam = "W3siaWQiOiJ0ZWxlbWV0cnlfY29udGVudCIsInBhcmFtcyI6e319XQ%253D%253D";
          break;
        case "water_content":
          stateParam = "W3siaWQiOiJ3YXRlcl9jb250ZW50IiwicGFyYW1zIjp7fX1d";
          break;
        case "temperature_content":
         stateParam = "W3siaWQiOiJ0ZW1wZXJhdHVyZV9jb250ZW50IiwicGFyYW1zIjp7fX1d";
         break;
        case "alarm_content":
            stateParam = "W3siaWQiOiJhbGFybV9jb250ZW50IiwicGFyYW1zIjp7fX1d";
            break
        default:
          stateParam = undefined;
      }

      // Usa o dashboardId das configurações (se existir) ou fallback fixo
      const dashboardId = settings.groupDashboardId;

      if (!stateParam) {
        LogHelper.warn(`[menu] Nenhum stateParam definido para stateId: ${stateId}`);
        main.innerHTML = `<div style="padding:20px; text-align:center; font-size:16px;">não tem</div>`;
        return;
      }

      // Monta a URL do iframe (embed ThingsBoard)
      const url = `/dashboard/${dashboardId}?embed=true&state=${stateParam}`;

      // Insere o iframe dentro do <main>
      main.innerHTML = `
        <iframe 
          src="${url}" 
          width="100%" 
          height="100%" 
          frameborder="0"
          style="border:0;" 
          allowfullscreen 
          title="Dashboard ThingsBoard"
        >
          Seu navegador não suporta iframes.
        </iframe>`;
    } catch (err) {
      LogHelper.warn("[menu] Falha ao abrir estado:", err);
    }
  };

  // Logout handler
  scope.handleLogout = async function (e) {
    e.preventDefault();

    LogHelper.log("[MENU] Logout button clicked");

    // Confirm before logout
    const confirmed = confirm("Tem certeza que deseja sair?");
    if (!confirmed) {
      LogHelper.log("[MENU] Logout cancelled by user");
      return;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.querySelector('.logout-text').textContent = 'Saindo...';
    }

    try {
      LogHelper.log("[MENU] Sending logout request to /api/auth/logout");

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        },
        credentials: 'include'
      });

      LogHelper.log("[MENU] Logout response status:", response.status);

      if (response.ok || response.status === 200 || response.status === 401) {
        // Clear local storage
        LogHelper.log("[MENU] Clearing local storage and session data");
        localStorage.removeItem('jwt_token');
        sessionStorage.clear();

        // Clear orchestrator cache if available
        if (window.MyIOOrchestrator) {
          try {
            window.MyIOOrchestrator.invalidateCache('*');
            LogHelper.log("[MENU] Orchestrator cache cleared");
          } catch (err) {
            LogHelper.warn("[MENU] Failed to clear orchestrator cache:", err);
          }
        }

        LogHelper.log("[MENU] Redirecting to login page");

        // Redirect to login page
        window.location.href = '/login';
      } else {
        throw new Error(`Logout failed with status: ${response.status}`);
      }
    } catch (err) {
      LogHelper.error("[MENU] Logout error:", err);
      alert('Erro ao fazer logout. Você será redirecionado para a tela de login.');

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
};
