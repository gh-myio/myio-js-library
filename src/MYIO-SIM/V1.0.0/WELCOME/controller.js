/* global self, ctx */

/**
 * RFC-0057: Welcome LV Widget
 *
 * Purpose: Home dashboard hero with brand palette, user menu, and shopping shortcuts
 *
 * Customer Attributes (SERVER_SCOPE):
 * {
 *   "home.brand.logoUrl": "https://...",
 *   "home.brand.palette": {
 *     "primary": "#7A2FF7",
 *     "secondary": "#5A1FD1",
 *     "gradientStart": "rgba(10,18,44,0.55)",
 *     "gradientEnd": "rgba(10,18,44,0.15)",
 *     "ink": "#F5F7FA",
 *     "muted": "#B8C2D8"
 *   },
 *   "home.actions.primaryState": "main",
 *   "home.showUserMenu": true
 * }
 *
 * Shopping Cards Source:
 * Cards are automatically generated from ctx.data[] which contains shopping entities
 * Each shopping entity in ctx.data[] should have:
 * - dataKey.label: Shopping name (e.g., "Mestre Álvaro")
 * - dataKey.entityId: Dashboard ID to navigate to
 * - Additional metadata from entity attributes
 */

// Debug configuration
const DEBUG_ACTIVE = true;

const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log('[WelcomeLV]', ...args);
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn('[WelcomeLV]', ...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error('[WelcomeLV]', ...args);
    }
  }
};

// Default MYIO palette
const DEFAULT_PALETTE = {
  primary: '#7A2FF7',
  secondary: '#5A1FD1',
  gradientStart: 'rgba(10,18,44,0.55)',
  gradientEnd: 'rgba(10,18,44,0.15)',
  ink: '#F5F7FA',
  muted: '#B8C2D8'
};

const DEFAULT_LOGO_URL = 'https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG';

// Hardcoded shopping cards
const DEFAULT_SHOPPING_CARDS = [
  {
    title: 'Mestre Álvaro',
    subtitle: 'Dashboard Principal',
    dashboardId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    bgImageUrl: null,
    state: '',
    openInNewTab: false
  },
  {
    title: 'Mont Serrat',
    subtitle: 'Dashboard Principal',
    dashboardId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    bgImageUrl: null,
    state: '',
    openInNewTab: false
  },
  {
    title: 'Moxuara',
    subtitle: 'Dashboard Principal',
    dashboardId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    bgImageUrl: null,
    state: '',
    openInNewTab: false
  },
  {
    title: 'Shopping da Ilha',
    subtitle: 'Dashboard Principal',
    dashboardId: 'd2754480-b668-11f0-be7f-e760d1498268',
    bgImageUrl: null,
    state: '',
    openInNewTab: false
  }
];

// State
let customerAttrs = {};
let currentPalette = DEFAULT_PALETTE;
let shoppingCards = [];

/**
 * Fetch Customer SERVER_SCOPE attributes
 * rev001: Enhanced with robust Customer lookup fallback
 */
async function fetchCustomerAttributes() {
  try {
    // Try multiple sources for customerId (rev001)
    let customerId = ctx.defaultSubscription?.configuredDatasources?.[0]?.entityId;

    // Fallback 1: Try stateController (rev001)
    if (!customerId && ctx.stateController?.dashboardCtx) {
      customerId = ctx.stateController.dashboardCtx.currentCustomerId;
    }

    // Fallback 2: Try currentUser customer (rev001)
    if (!customerId && ctx.currentUser?.customerId) {
      customerId = ctx.currentUser.customerId;
    }

    if (!customerId) {
      LogHelper.warn('[rev001] No customer ID found via any method, using defaults');
      return {};
    }

    const tbToken = localStorage.getItem('jwt_token');
    if (!tbToken) {
      LogHelper.error('JWT token not found');
      return {};
    }

    const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${tbToken}`
      }
    });

    if (!response.ok) {
      LogHelper.warn(`Failed to fetch attributes: ${response.status}`);
      return {};
    }

    const data = await response.json();
    LogHelper.log('Customer attributes fetched:', Object.keys(data));

    // Convert array to object
    const attrs = {};
    data.forEach(attr => {
      try {
        attrs[attr.key] = JSON.parse(attr.value);
      } catch (e) {
        attrs[attr.key] = attr.value;
      }
    });

    return attrs;
  } catch (error) {
    LogHelper.error('Error fetching customer attributes:', error);
    return {};
  }
}

/**
 * Resolve brand palette from attributes or use defaults
 */
function resolvePalette(attrs) {
  const palette = attrs['home.brand.palette'] || DEFAULT_PALETTE;
  LogHelper.log('Palette resolved:', palette);
  return palette;
}

/**
 * Validate color value (hex or rgba) (rev001)
 */
function isValidColor(color) {
  if (!color) return false;

  // Hex validation: #RGB or #RRGGBB
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (hexRegex.test(color)) return true;

  // RGBA validation: rgba(r,g,b,a)
  const rgbaRegex = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
  if (rgbaRegex.test(color)) return true;

  return false;
}

/**
 * Apply palette to CSS variables
 * rev001: Added validation before injection
 */
function applyPalette(palette) {
  const root = document.documentElement;

  // Validate and apply each color (rev001)
  const colorMap = {
    '--welcome-primary': palette.primary,
    '--welcome-secondary': palette.secondary,
    '--welcome-grad-start': palette.gradientStart,
    '--welcome-grad-end': palette.gradientEnd,
    '--welcome-ink': palette.ink,
    '--welcome-muted': palette.muted
  };

  Object.entries(colorMap).forEach(([cssVar, color]) => {
    if (isValidColor(color)) {
      root.style.setProperty(cssVar, color);
    } else {
      LogHelper.warn(`[rev001] Invalid color for ${cssVar}: ${color}, skipping`);
    }
  });

  LogHelper.log('Palette applied to CSS variables');
}

/**
 * Render brand logo
 */
function renderLogo(attrs) {
  const logoUrl = attrs['home.brand.logoUrl'] || DEFAULT_LOGO_URL;
  const logoImg = document.getElementById('welcomeBrandLogo');

  if (logoImg) {
    logoImg.src = logoUrl;
    logoImg.onerror = () => {
      LogHelper.warn('Logo failed to load, using fallback');
      logoImg.src = DEFAULT_LOGO_URL;
    };
    LogHelper.log('Logo set:', logoUrl);
  }
}

/**
 * Get current user info
 */
function getUserInfo() {
  const user = ctx.currentUser;
  if (!user) {
    LogHelper.warn('No user found in context');
    return { name: 'User', email: '' };
  }

  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name = `${firstName} ${lastName}`.trim() || 'User';
  const email = user.email || '';

  LogHelper.log('User info:', { name, email });
  return { name, email };
}

/**
 * Render user menu
 */
function renderUserMenu(attrs) {
  const showUserMenu = attrs['home.showUserMenu'] !== false;
  const userMenuEl = document.getElementById('welcomeUserMenu');

  if (!userMenuEl) return;

  if (!showUserMenu) {
    userMenuEl.style.display = 'none';
    LogHelper.log('User menu hidden by config');
    return;
  }

  const userInfo = getUserInfo();
  const userNameEl = document.getElementById('welcomeUserName');
  const userEmailEl = document.getElementById('welcomeUserEmail');

  if (userNameEl) userNameEl.textContent = userInfo.name;
  if (userEmailEl) userEmailEl.textContent = userInfo.email;

  // Wire logout button
  const logoutBtn = document.getElementById('welcomeLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  LogHelper.log('User menu rendered');
}

/**
 * Handle logout
 */
function handleLogout() {
  LogHelper.log('Logout clicked');
  try {
    // Use ThingsBoard's built-in logout
    if (ctx.logout) {
      ctx.logout();
    } else {
      // Fallback: clear tokens and redirect
      localStorage.removeItem('jwt_token');
      window.location.href = '/login';
    }
  } catch (error) {
    LogHelper.error('Logout error:', error);
  }
}

/**
 * Extract shopping cards from ctx.data[]
 * Each entity in ctx.data[] represents a shopping center
 */
function extractShoppingCardsFromCtxData() {
  const cards = [];

  if (!ctx.data || !Array.isArray(ctx.data)) {
    LogHelper.warn('No ctx.data available or not an array');
    return cards;
  }

  LogHelper.log('Processing ctx.data[] for shopping cards, entries:', ctx.data.length);

  // Group data by datasource (each datasource = one shopping)
  const shoppingMap = new Map();

  ctx.data.forEach(dataItem => {
    if (!dataItem.datasource) return;

    const datasourceKey = dataItem.datasource.entityId || dataItem.datasource.name;
    if (!datasourceKey) return;

    if (!shoppingMap.has(datasourceKey)) {
      shoppingMap.set(datasourceKey, {
        entityId: dataItem.datasource.entityId,
        entityType: dataItem.datasource.entityType,
        name: dataItem.datasource.name || dataItem.datasource.entityName,
        entityName: dataItem.datasource.entityName,
        attributes: {}
      });
    }

    // Collect attributes from dataKeys
    if (dataItem.dataKey) {
      const keyName = dataItem.dataKey.name;
      const latestValue = dataItem.data && dataItem.data.length > 0
        ? dataItem.data[dataItem.data.length - 1][1]
        : null;

      shoppingMap.get(datasourceKey).attributes[keyName] = latestValue;
    }
  });

  // Convert map to cards array
  shoppingMap.forEach((shopping, key) => {
    const card = {
      title: shopping.entityName || shopping.name || 'Shopping',
      subtitle: shopping.attributes.description || shopping.attributes.subtitle || 'Dashboard',
      dashboardId: shopping.attributes.dashboardId || shopping.entityId,
      entityId: shopping.entityId,
      entityType: shopping.entityType,
      bgImageUrl: shopping.attributes.bgImageUrl || shopping.attributes.imageUrl || null,
      state: shopping.attributes.defaultState || '',
      openInNewTab: shopping.attributes.openInNewTab === 'true' || shopping.attributes.openInNewTab === true
    };

    cards.push(card);
    LogHelper.log('Shopping card created:', card.title, '→', card.dashboardId);
  });

  LogHelper.log('Total shopping cards extracted:', cards.length);
  return cards;
}

/**
 * Lazy load card background images (rev001)
 */
function setupLazyLoading() {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const cardBg = entry.target;
        const imageUrl = cardBg.getAttribute('data-bg-url');
        if (imageUrl) {
          cardBg.style.backgroundImage = `url(${imageUrl})`;
          cardBg.removeAttribute('data-bg-url');
          imageObserver.unobserve(cardBg);
        }
      }
    });
  }, { rootMargin: '50px' });

  document.querySelectorAll('.card-bg[data-bg-url]').forEach(bg => {
    imageObserver.observe(bg);
  });

  LogHelper.log('[rev001] Lazy loading observer set up for', document.querySelectorAll('.card-bg[data-bg-url]').length, 'images');
}

/**
 * Render shopping cards
 * Priority:
 * 1. Cards from ctx.data[] (if available)
 * 2. Cards from home.cards attribute (if configured)
 * 3. Default hardcoded shopping cards
 */
function renderShortcuts(attrs) {
  // Priority 1: Extract cards from ctx.data[]
  let cards = extractShoppingCardsFromCtxData();

  // Priority 2: Fallback to configured cards in attributes
  if (cards.length === 0 && attrs['home.cards']) {
    cards = attrs['home.cards'];
    LogHelper.log('Using cards from attributes:', cards.length);
  }

  // Priority 3: Use default hardcoded shopping cards
  if (cards.length === 0) {
    cards = DEFAULT_SHOPPING_CARDS;
    LogHelper.log('Using default hardcoded shopping cards:', cards.length);
  }

  const container = document.getElementById('welcomeShortcuts');

  if (!container) return;

  if (cards.length === 0) {
    container.style.display = 'none';
    LogHelper.log('No cards available, hiding shortcuts row');
    return;
  }

  container.innerHTML = cards.map((card, index) => `
    <div class="shopping-card"
         data-dashboard-id="${card.dashboardId || card.entityId || ''}"
         data-entity-id="${card.entityId || ''}"
         data-state="${card.state || ''}"
         data-open-new-tab="${card.openInNewTab || false}"
         tabindex="0"
         role="button"
         aria-label="${card.title || 'Shopping'} - ${card.subtitle || ''}"
         data-card-index="${index}">
      ${card.bgImageUrl ? `<div class="card-bg" data-bg-url="${card.bgImageUrl}"></div>` : ''}
      <h3>${card.title || 'Shopping'}</h3>
      <p>${card.subtitle || ''}</p>
    </div>
  `).join('');

  // Wire card clicks (rev001)
  container.querySelectorAll('.shopping-card').forEach(cardEl => {
    const dashboardId = cardEl.getAttribute('data-dashboard-id');
    const state = cardEl.getAttribute('data-state');
    const openNewTab = cardEl.getAttribute('data-open-new-tab') === 'true';
    const title = cardEl.querySelector('h3')?.textContent;

    const handleClick = () => handleCardClick(dashboardId, state, openNewTab, title);

    // Mouse click
    cardEl.addEventListener('click', handleClick);

    // Keyboard navigation (rev001)
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    });
  });

  // Setup lazy loading for background images (rev001)
  setupLazyLoading();

  LogHelper.log('Shortcuts rendered:', cards.length, 'cards from ctx.data[]');
}

/**
 * Handle shopping card click
 * rev001: Added support for state and openInNewTab
 */
function handleCardClick(dashboardId, state, openNewTab, title) {
  LogHelper.log('[rev001] Card clicked:', title, '→', {dashboardId, state, openNewTab});

  try {
    if (openNewTab) {
      // Open in new tab (rev001)
      const url = `/dashboard/${dashboardId}${state ? `?state=${state}` : ''}`;
      window.open(url, '_blank');
      LogHelper.log('[rev001] Opened in new tab:', url);
    } else if (state) {
      // Navigate to dashboard with state (rev001)
      ctx.actionsApi.navigateToDashboard(dashboardId, {
        openInSeparateDialog: false,
        openInPopover: false,
        targetState: state
      });
      LogHelper.log('[rev001] Navigated to dashboard with state:', state);
    } else {
      // Default navigation
      ctx.actionsApi.navigateToDashboard(dashboardId, {
        openInSeparateDialog: false,
        openInPopover: false
      });
    }
  } catch (error) {
    LogHelper.error('Navigation error:', error);

    // Fallback navigation
    const url = `/dashboard/${dashboardId}${state ? `?state=${state}` : ''}`;
    if (openNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }
}

/**
 * Handle primary CTA click
 */
function handleCTAClick(attrs) {
  const primaryState = attrs['home.actions.primaryState'] || 'main';
  LogHelper.log('CTA clicked → state:', primaryState);

  try {
    ctx.stateController.openState(primaryState, {}, false);
  } catch (error) {
    LogHelper.error('State navigation error:', error);
  }
}

/**
 * Render hero content with text overrides (rev001)
 */
function renderHeroContent(attrs) {
  // Default texts
  const defaultTitle = 'Bem-vindo ao MYIO Platform';
  const defaultDescription = 'Gestão inteligente de energia, água e recursos para shoppings centers';
  const defaultPrimaryLabel = 'ACESSAR DASHBOARD';

  // Apply text overrides (rev001)
  const title = attrs['home.hero.title'] || defaultTitle;
  const description = attrs['home.hero.description'] || defaultDescription;
  const primaryLabel = attrs['home.actions.primaryLabel'] || defaultPrimaryLabel;

  // Update DOM
  const titleEl = document.getElementById('welcomeHeroTitle');
  const descEl = document.getElementById('welcomeHeroDescription');
  const ctaBtn = document.getElementById('welcomeCTA');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;
  if (ctaBtn) {
    ctaBtn.textContent = primaryLabel;
    ctaBtn.setAttribute('aria-label', primaryLabel);
  }

  LogHelper.log('[rev001] Hero content rendered with text overrides');
}

/**
 * Wire primary CTA button
 */
function wireCTA(attrs) {
  const ctaBtn = document.getElementById('welcomeCTA');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => handleCTAClick(attrs));

    // Keyboard navigation (rev001)
    ctaBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCTAClick(attrs);
      }
    });

    LogHelper.log('CTA button wired');
  }
}

/**
 * Initialize widget
 * rev001: Added text overrides rendering
 */
async function init() {
  LogHelper.log('init() called');

  try {
    // Fetch customer attributes
    customerAttrs = await fetchCustomerAttributes();

    // Resolve and apply palette
    currentPalette = resolvePalette(customerAttrs);
    applyPalette(currentPalette);

    // Render components
    renderLogo(customerAttrs);
    renderHeroContent(customerAttrs);  // rev001: Text overrides
    renderUserMenu(customerAttrs);
    renderShortcuts(customerAttrs);
    wireCTA(customerAttrs);

    LogHelper.log('Initialization complete');
  } catch (error) {
    LogHelper.error('Initialization error:', error);
  }
}

// Widget lifecycle hooks
self.onInit = function() {
  LogHelper.log('onInit() called');
  init();
};

self.onDataUpdated = function() {
  // Widget doesn't depend on data updates
  LogHelper.log('onDataUpdated() called (no-op)');
};

self.onDestroy = function() {
  LogHelper.log('onDestroy() called');
};
