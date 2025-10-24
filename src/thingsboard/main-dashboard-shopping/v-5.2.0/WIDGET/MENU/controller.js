// Debug configuration
const DEBUG_ACTIVE = true;

// LogHelper utility
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function (...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  },
};

self.onInit = function () {
  const settings = self.ctx.settings || {};
  const scope = self.ctx.$scope;

  scope.links = settings.links || [];

  // Function to get icon for each menu item based on stateId
  scope.getMenuIcon = function (stateId) {
    const icons = {
      telemetry_content: "⚡",
      water_content: "💧",
      temperature_content: "🌡️",
      alarm_content: "🔔",
    };
    return icons[stateId] || "📄";
  };

  // Hamburger menu toggle
  const hamburgerBtn = document.querySelector(".hamburger-btn");
  const menuRoot = document.querySelector(".shops-menu-root");
  let isMenuCollapsed = false;

  if (hamburgerBtn && menuRoot) {
    hamburgerBtn.addEventListener("click", function (e) {
      e.preventDefault();
      isMenuCollapsed = !isMenuCollapsed;

      if (isMenuCollapsed) {
        menuRoot.classList.add("collapsed");
        LogHelper.log("[MENU] Menu collapsed");
      } else {
        menuRoot.classList.remove("collapsed");
        LogHelper.log("[MENU] Menu expanded");
      }

      // Emit event to notify other widgets (like MAIN_VIEW)
      window.dispatchEvent(
        new CustomEvent("myio:menu-toggle", {
          detail: { collapsed: isMenuCollapsed },
        })
      );
    });
  }

  // Fetch and display user info
  fetchUserInfo();

  async function fetchUserInfo() {
    try {
      //LogHelper.log("[MENU] Fetching user info from /api/auth/user");

      const response = await fetch("/api/auth/user", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": "Bearer " + localStorage.getItem("jwt_token"),
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
      }

      const user = await response.json();
      //LogHelper.log("[MENU] User info received:", user);

      // Update user info in the UI
      const userNameEl = document.getElementById("user-name");
      const userEmailEl = document.getElementById("user-email");

      if (userNameEl && user) {
        const firstName = user.firstName || "";
        const lastName = user.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || "Usuário";
        userNameEl.textContent = fullName;

        //LogHelper.log("[MENU] User name set to:", fullName);
      }

      if (userEmailEl && user?.email) {
        userEmailEl.textContent = user.email;
        //LogHelper.log("[MENU] User email set to:", user.email);

        // RFC-0055: Check if user is from sacavalcante.com.br domain
        if (user.email && user.email.endsWith('@sacavalcante.com.br')) {
          LogHelper.log("[MENU] User from sacavalcante.com.br detected - enabling shopping selector");
          addShoppingSelectorButton();
        }
      }
    } catch (err) {
      LogHelper.error("[MENU] Error fetching user info:", err);

      // Fallback UI
      const userNameEl = document.getElementById("user-name");
      const userEmailEl = document.getElementById("user-email");

      if (userNameEl) {
        userNameEl.textContent = "Usuário";
      }
      if (userEmailEl) {
        userEmailEl.textContent = "";
      }
    }
  }

  // RFC-0042: State ID to Domain mapping
  const DOMAIN_BY_STATE = {
    telemetry_content: "energy",
    water_content: "water",
    temperature_content: "temperature",
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
      new CustomEvent("myio:dashboard-state", {
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
      LogHelper.warn("[MENU] RFC-0053: openDashboardState indisponível:", err);
    }

    // RFC-0053: Use content containers with show/hide logic (no iframes!)
    try {
      const main = document.getElementsByTagName("main")[0];
      if (!main) {
        LogHelper.error("[MENU] <main> element not found in DOM");
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
      allContents.forEach(content => {
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
          <p>Available containers: ${Array.from(allContents).map(c => c.getAttribute('data-content-state')).join(', ')}</p>
        </div>`;
      }
    } catch (err) {
      LogHelper.error("[MENU] RFC-0053: Failed to switch content container:", err);
    }
  };

  // Logout handler
  scope.handleLogout = async function (e) {
    e.preventDefault();

    //LogHelper.log("[MENU] Logout button clicked");

    // Confirm before logout
    const confirmed = confirm("Tem certeza que deseja sair?");
    if (!confirmed) {
      LogHelper.log("[MENU] Logout cancelled by user");
      return;
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.querySelector(".logout-text").textContent = "Saindo...";
    }

    try {
      //LogHelper.log("[MENU] Sending logout request to /api/auth/logout");

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": "Bearer " + localStorage.getItem("jwt_token"),
        },
        credentials: "include",
      });

      //LogHelper.log("[MENU] Logout response status:", response.status);

      if (response.ok || response.status === 200 || response.status === 401) {
        // Clear local storage
        LogHelper.log("[MENU] Clearing local storage and session data");
        localStorage.removeItem("jwt_token");
        sessionStorage.clear();

        // Clear orchestrator cache if available
        if (window.MyIOOrchestrator) {
          try {
            window.MyIOOrchestrator.invalidateCache("*");
            LogHelper.log("[MENU] Orchestrator cache cleared");
          } catch (err) {
            LogHelper.warn("[MENU] Failed to clear orchestrator cache:", err);
          }
        }

        LogHelper.log("[MENU] Redirecting to login page");

        // Redirect to login page
        window.location.href = "/login";
      } else {
        throw new Error(`Logout failed with status: ${response.status}`);
      }
    } catch (err) {
      LogHelper.error("[MENU] Logout error:", err);
      alert(
        "Erro ao fazer logout. Você será redirecionado para a tela de login."
      );

      // Force redirect even on error
      localStorage.removeItem("jwt_token");
      sessionStorage.clear();
      window.location.href = "/login";
    } finally {
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.querySelector(".logout-text").textContent = "Sair";
      }
    }
  };

  // RFC-0055: Add shopping selector button for sacavalcante.com.br users
  function addShoppingSelectorButton() {
    // Check if button already exists
    if (document.getElementById('shopping-selector-btn')) {
      LogHelper.log("[MENU] Shopping selector button already exists");
      return;
    }

    // Find the menu footer (where logout button is)
    const menuFooter = document.querySelector('.shops-menu-root .menu-footer');
    const logoutBtn = document.getElementById('logout-btn');

    if (!menuFooter) {
      LogHelper.error("[MENU] Menu footer not found - cannot add shopping selector");
      return;
    }

    // Create shopping selector button
    const shoppingSelectorBtn = document.createElement('button');
    shoppingSelectorBtn.id = 'shopping-selector-btn';
    shoppingSelectorBtn.className = 'shopping-selector-btn';
    shoppingSelectorBtn.innerHTML = `
      <span class="menu-icon">🏢</span>
      <span class="menu-label">Trocar Shopping</span>
    `;

    // Insert before logout button
    if (logoutBtn) {
      menuFooter.insertBefore(shoppingSelectorBtn, logoutBtn);
    } else {
      menuFooter.appendChild(shoppingSelectorBtn);
    }

    // Add click handler
    shoppingSelectorBtn.addEventListener('click', () => {
      LogHelper.log("[MENU] Shopping selector clicked");
      showShoppingModal();
    });

    LogHelper.log("[MENU] Shopping selector button added successfully");
  }

  // RFC-0055: Show modal with shopping options
  function showShoppingModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('shopping-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'shopping-modal';
    modal.className = 'shopping-modal';
    modal.innerHTML = `
      <div class="shopping-modal-overlay"></div>
      <div class="shopping-modal-content">
        <div class="shopping-modal-header">
          <h2>Selecione o Shopping</h2>
          <button class="shopping-modal-close">&times;</button>
        </div>
        <div class="shopping-modal-body">
          <div class="shopping-option" data-url="https://dashboard.myio-bas.com/dashboards/all/ed5a0dd0-a3b7-11f0-afe1-175479a33d89">
            <div class="shopping-icon">🏢</div>
            <div class="shopping-name">Mestre Álvaro</div>
          </div>
          <div class="shopping-option" data-url="https://dashboard.myio-bas.com/dashboards/all/1e785950-af55-11f0-9722-210aa9448abc">
            <div class="shopping-icon">🏢</div>
            <div class="shopping-name">Mont Serrat</div>
          </div>
        </div>
      </div>
    `;

    // Add to body
    document.body.appendChild(modal);

    // Add event listeners
    const closeBtn = modal.querySelector('.shopping-modal-close');
    const overlay = modal.querySelector('.shopping-modal-overlay');
    const options = modal.querySelectorAll('.shopping-option');

    // Close handlers
    const closeModal = () => {
      modal.classList.add('closing');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Shopping selection handlers
    options.forEach(option => {
      option.addEventListener('click', () => {
        const url = option.getAttribute('data-url');
        const name = option.querySelector('.shopping-name').textContent;

        LogHelper.log(`[MENU] Navigating to ${name}: ${url}`);
        window.location.href = url;
      });
    });

    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);

    LogHelper.log("[MENU] Shopping modal displayed");
  }
};
