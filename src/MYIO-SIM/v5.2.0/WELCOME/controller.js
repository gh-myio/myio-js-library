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

// Debug configuration (can be overridden by widget settings)
let DEBUG_ACTIVE = true;

// RFC-0086: Shopping label storage key
const MYIO_SHOPPING_LABEL_KEY = '__MYIO_SHOPPING_LABEL__';

const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log('[WelcomeLV]', ...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn('[WelcomeLV]', ...args);
    }
  },
  error: function (...args) {
    // Always log errors regardless of debug mode
    console.error('[WelcomeLV]', ...args);
  },
};

// Default MYIO palette
const DEFAULT_PALETTE = {
  primary: '#7A2FF7',
  secondary: '#5A1FD1',
  gradientStart: 'rgba(10,18,44,0.55)',
  gradientEnd: 'rgba(10,18,44,0.15)',
  ink: '#F5F7FA',
  muted: '#B8C2D8',
};

const DEFAULT_LOGO_URL = 'https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG';

// Hardcoded shopping cards with dashboard navigation
const DEFAULT_SHOPPING_CARDS = [
  {
    title: 'Mestre Álvaro',
    subtitle: 'Dashboard Principal',
    buttonId: 'ShoppingMestreAlvaro',
    dashboardId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityId: '6c188a90-b0cc-11f0-9722-210aa9448abc',
    entityType: 'ASSET',
  },
  {
    title: 'Mont Serrat',
    subtitle: 'Dashboard Principal',
    buttonId: 'ShoppingMontSerrat',
    dashboardId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityId: '39e4ca30-b503-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
  },
  {
    title: 'Moxuara',
    subtitle: 'Dashboard Principal',
    buttonId: 'ShoppingMoxuara',
    dashboardId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityId: '4b53bbb0-b5a7-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
  },
  {
    title: 'Shopping da Ilha',
    subtitle: 'Dashboard Principal',
    buttonId: 'ShoppingDaIlha',
    dashboardId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityId: 'd2754480-b668-11f0-be7f-e760d1498268',
    entityType: 'ASSET',
  },
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

    // Force specific customer ID if default customer is detected
    if (customerId === '13814000-1dd2-11b2-8080-808080808080') {
      customerId = '56614a70-326f-11ef-ad2c-53aeabe7d3fa';
      LogHelper.log('Forced customerId to:', customerId);
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
        'X-Authorization': `Bearer ${tbToken}`,
      },
    });

    if (!response.ok) {
      LogHelper.warn(`Failed to fetch attributes: ${response.status}`);
      return {};
    }

    const data = await response.json();
    LogHelper.log('Customer attributes fetched:', Object.keys(data));

    // Convert array to object
    const attrs = {};
    data.forEach((attr) => {
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
 * Resolve brand palette from widget settings, attributes, or defaults
 * Priority: Widget Settings > Customer Attributes > Defaults
 */
function resolvePalette(attrs) {
  const settings = ctx.settings || {};

  // Build palette with priority: settings > attrs > defaults
  const palette = {
    primary: settings.primaryColor || attrs['home.brand.palette']?.primary || DEFAULT_PALETTE.primary,
    secondary: settings.secondaryColor || attrs['home.brand.palette']?.secondary || DEFAULT_PALETTE.secondary,
    gradientStart: attrs['home.brand.palette']?.gradientStart || DEFAULT_PALETTE.gradientStart,
    gradientEnd: attrs['home.brand.palette']?.gradientEnd || DEFAULT_PALETTE.gradientEnd,
    ink: settings.textColor || attrs['home.brand.palette']?.ink || DEFAULT_PALETTE.ink,
    muted: settings.mutedTextColor || attrs['home.brand.palette']?.muted || DEFAULT_PALETTE.muted,
    userMenuBg: settings.userMenuBackgroundColor || 'rgba(255, 255, 255, 0.15)',
    userMenuBorder: settings.userMenuBorderColor || 'rgba(255, 255, 255, 0.3)',
    logoutBtnBg: settings.logoutButtonBackgroundColor || 'rgba(255, 255, 255, 0.2)',
    logoutBtnBorder: settings.logoutButtonBorderColor || 'rgba(255, 255, 255, 0.4)',
    shoppingCardBg: settings.shoppingCardBackgroundColor || 'rgba(255, 255, 255, 0.1)',
    shoppingCardBorder: settings.shoppingCardBorderColor || 'rgba(255, 255, 255, 0.2)',
  };

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
    '--welcome-muted': palette.muted,
    '--welcome-user-menu-bg': palette.userMenuBg,
    '--welcome-user-menu-border': palette.userMenuBorder,
    '--welcome-logout-btn-bg': palette.logoutBtnBg,
    '--welcome-logout-btn-border': palette.logoutBtnBorder,
    '--welcome-shopping-card-bg': palette.shoppingCardBg,
    '--welcome-shopping-card-border': palette.shoppingCardBorder,
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
 * Priority: Widget Settings > Customer Attributes > Default
 */
function renderLogo(attrs) {
  const settings = ctx.settings || {};
  const logoUrl = settings.defaultLogoUrl || attrs['home.brand.logoUrl'] || DEFAULT_LOGO_URL;
  const logoImg = document.getElementById('welcomeBrandLogo');

  if (logoImg) {
    logoImg.src = logoUrl;
    logoImg.onerror = () => {
      LogHelper.warn('Logo failed to load, using fallback');
      logoImg.src = DEFAULT_LOGO_URL;
    };
    LogHelper.log('Logo set:', logoUrl, '(source: settings)', settings.defaultLogoUrl ? 'YES' : 'NO');
  }
}

/**
 * Apply hero background image
 * Priority: Widget Settings > Customer Attributes
 */
function applyHeroBackground(attrs) {
  const settings = ctx.settings || {};
  const backgroundUrl = settings.defaultBackgroundUrl || attrs['home.hero.backgroundUrl'];

  if (!backgroundUrl) {
    LogHelper.log('No hero background URL configured');
    return;
  }

  const heroContainer = document.querySelector('.hero-container');
  if (heroContainer) {
    heroContainer.style.backgroundImage = `url(${backgroundUrl})`;
    heroContainer.style.backgroundSize = 'cover';
    heroContainer.style.backgroundPosition = 'center';
    heroContainer.style.backgroundRepeat = 'no-repeat';
    LogHelper.log(
      'Hero background set:',
      backgroundUrl,
      '(source: settings)',
      settings.defaultBackgroundUrl ? 'YES' : 'NO'
    );
  }
}

/**
 * Fetch user info from API (same approach as MENU widget)
 * Priority: Widget Settings > Customer Attributes > Default
 */
async function fetchAndRenderUserMenu(attrs) {
  const settings = ctx.settings || {};
  const showUserMenu =
    settings.showUserMenuByDefault !== undefined
      ? settings.showUserMenuByDefault
      : attrs['home.showUserMenu'] !== false;
  const userMenuEl = document.getElementById('welcomeUserMenu');

  if (!userMenuEl) return;

  if (!showUserMenu) {
    userMenuEl.style.display = 'none';
    LogHelper.log(
      'User menu hidden by config (settings:',
      settings.showUserMenuByDefault,
      'attrs:',
      attrs['home.showUserMenu'],
      ')'
    );
    return;
  }

  try {
    const tbToken = localStorage.getItem('jwt_token');
    const headers = { 'Content-Type': 'application/json' };
    if (tbToken) {
      headers['X-Authorization'] = `Bearer ${tbToken}`;
    }

    const response = await fetch('/api/auth/user', {
      method: 'GET',
      headers: headers,
      credentials: 'include',
    });

    if (!response.ok) {
      LogHelper.warn('Failed to fetch user info from API:', response.status);
      // Fallback to ctx.currentUser
      renderUserMenuFallback(attrs);
      return;
    }

    const user = await response.json();
    LogHelper.log('User data from API:', user);

    const userNameEl = document.getElementById('welcomeUserName');
    const userEmailEl = document.getElementById('welcomeUserEmail');

    // Update user name
    if (userNameEl) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Usuário';
      userNameEl.textContent = fullName;
      LogHelper.log('User name set:', fullName);
    }

    // Update user email
    if (userEmailEl && user?.email) {
      userEmailEl.textContent = user.email;
      userEmailEl.style.display = 'block';
      userEmailEl.style.visibility = 'visible';
      LogHelper.log('User email set:', user.email);
    } else {
      LogHelper.warn('No email found in user object');
    }

    // Wire logout button
    const logoutBtn = document.getElementById('welcomeLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    LogHelper.log('User menu rendered with API data');
  } catch (error) {
    LogHelper.error('Error fetching user info:', error);
    // Fallback to ctx.currentUser
    renderUserMenuFallback(attrs);
  }
}

/**
 * Fallback: Get user info from ctx.currentUser
 */
function renderUserMenuFallback(attrs) {
  const user = ctx.currentUser;
  if (!user) {
    LogHelper.warn('No user found in context');
    return;
  }

  const userNameEl = document.getElementById('welcomeUserName');
  const userEmailEl = document.getElementById('welcomeUserEmail');

  if (userNameEl) {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || 'User';
    userNameEl.textContent = name;
  }

  if (userEmailEl && user.email) {
    userEmailEl.textContent = user.email;
    userEmailEl.style.display = 'block';
    userEmailEl.style.visibility = 'visible';
  }

  // Wire logout button
  const logoutBtn = document.getElementById('welcomeLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  LogHelper.log('User menu rendered with fallback data');
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

  ctx.data.forEach((dataItem) => {
    if (!dataItem.datasource) return;

    const datasourceKey = dataItem.datasource.entityId || dataItem.datasource.name;
    if (!datasourceKey) return;

    if (!shoppingMap.has(datasourceKey)) {
      shoppingMap.set(datasourceKey, {
        entityId: dataItem.datasource.entityId,
        entityType: dataItem.datasource.entityType,
        name: dataItem.datasource.name || dataItem.datasource.entityName,
        entityName: dataItem.datasource.entityName,
        attributes: {},
      });
    }

    // Collect attributes from dataKeys
    if (dataItem.dataKey) {
      const keyName = dataItem.dataKey.name;
      const latestValue =
        dataItem.data && dataItem.data.length > 0 ? dataItem.data[dataItem.data.length - 1][1] : null;

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
      openInNewTab: shopping.attributes.openInNewTab === 'true' || shopping.attributes.openInNewTab === true,
    };

    cards.push(card);
    LogHelper.log('Shopping card created:', card.title, '→', card.dashboardId);
  });

  LogHelper.log('Total shopping cards extracted:', cards.length);
  return cards;
}

/**
 * Navigate to shopping dashboard
 */
function navigateToShoppingDashboard(card) {
  try {
    LogHelper.log('Navigating to shopping:', card.title, '→', card.dashboardId);

    const state = [
      {
        id: 'default',
        params: {
          entityId: {
            id: card.entityId,
            entityType: card.entityType,
          },
        },
      },
    ];

    const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
    const url = `/dashboards/${card.dashboardId}?state=${stateBase64}`;

    if (self.ctx && self.ctx.router) {
      self.ctx.router.navigateByUrl(url);
      LogHelper.log('Navigation successful:', url);
    } else {
      LogHelper.error('ctx.router not available');
    }
  } catch (error) {
    LogHelper.error('Navigation error:', error);
  }
}

/**
 * Lazy load card background images (rev001)
 * Uses widget settings for lazy loading config
 */
function setupLazyLoading() {
  const settings = ctx.settings || {};
  const enableLazyLoading = settings.enableLazyLoading !== false; // Default: true
  const rootMargin = settings.lazyLoadRootMargin || '50px';

  if (!enableLazyLoading) {
    // Load all images immediately if lazy loading is disabled
    document.querySelectorAll('.card-bg[data-bg-url]').forEach((bg) => {
      const imageUrl = bg.getAttribute('data-bg-url');
      if (imageUrl) {
        bg.style.backgroundImage = `url(${imageUrl})`;
        bg.removeAttribute('data-bg-url');
      }
    });
    LogHelper.log('Lazy loading disabled, loaded all images immediately');
    return;
  }

  const imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
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
    },
    { rootMargin: rootMargin }
  );

  document.querySelectorAll('.card-bg[data-bg-url]').forEach((bg) => {
    imageObserver.observe(bg);
  });

  LogHelper.log(
    '[rev001] Lazy loading observer set up for',
    document.querySelectorAll('.card-bg[data-bg-url]').length,
    'images (rootMargin:',
    rootMargin,
    ')'
  );
}

/**
 * Render shopping cards
 * Always use DEFAULT_SHOPPING_CARDS with navigation onclick
 */
function renderShortcuts(attrs) {
  // Always use default hardcoded shopping cards with specific button IDs
  const cards = DEFAULT_SHOPPING_CARDS;
  LogHelper.log('Using default hardcoded shopping cards with button IDs:', cards.length);

  const container = document.getElementById('welcomeShortcuts');

  if (!container) return;

  if (cards.length === 0) {
    container.style.display = 'none';
    LogHelper.log('No cards available, hiding shortcuts row');
    return;
  }

  container.innerHTML = cards
    .map(
      (card, index) => `
    <button class="shopping-card"
            id="${card.buttonId || 'Shopping' + index}"
            type="button"
            data-card-index="${index}"
            aria-label="${card.title || 'Shopping'} - ${card.subtitle || ''}">
      ${card.bgImageUrl ? `<div class="card-bg" data-bg-url="${card.bgImageUrl}"></div>` : ''}
      <h3>${card.title || 'Shopping'}</h3>
      <p>${card.subtitle || ''}</p>
    </button>
  `
    )
    .join('');

  // Setup lazy loading for background images
  setupLazyLoading();

  // Wire click handlers for navigation
  cards.forEach((card, index) => {
    const button = document.querySelector(`[data-card-index="${index}"]`);
    if (button) {
      button.addEventListener('click', () => navigateToShoppingDashboard(card));

      // Keyboard navigation
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateToShoppingDashboard(card);
        }
      });
    }
  });

  LogHelper.log(
    'Shopping cards rendered with navigation:',
    cards.map((c) => c.buttonId || c.title).join(', ')
  );
}

/**
 * Handle primary CTA click
 * Priority: Widget Settings > Customer Attributes > Default
 */
function handleCTAClick(attrs) {
  const settings = ctx.settings || {};
  const primaryState = settings.defaultPrimaryState || attrs['home.actions.primaryState'] || 'main';
  LogHelper.log(
    'CTA clicked → state:',
    primaryState,
    '(source: settings)',
    settings.defaultPrimaryState ? 'YES' : 'NO'
  );

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
  // Get widget settings
  const settings = ctx.settings || {};

  // Default texts
  const defaultTitle = 'Bem-vindo ao MYIO Platform';
  const defaultDescription = 'Gestão inteligente de energia, água e recursos para shoppings centers';
  const defaultPrimaryLabel = 'ACESSAR PAINEL';

  // Priority: Widget Settings > Customer Attributes > Defaults
  const title = settings.defaultHeroTitle || attrs['home.hero.title'] || defaultTitle;
  const description = settings.defaultHeroDescription || attrs['home.hero.description'] || defaultDescription;
  const primaryLabel =
    settings.defaultPrimaryLabel || attrs['home.actions.primaryLabel'] || defaultPrimaryLabel;

  LogHelper.log('Hero settings:', { title, description, primaryLabel });

  // Update DOM
  const titleEl = document.getElementById('welcomeHeroTitle');
  const descEl = document.getElementById('welcomeHeroDescription');
  const ctaBtn = document.getElementById('welcomeCTA');

  if (titleEl) {
    titleEl.textContent = title;
    LogHelper.log('Hero title set to:', title);
  }

  if (descEl) {
    descEl.textContent = description;
  }

  if (ctaBtn) {
    ctaBtn.textContent = primaryLabel;
    ctaBtn.setAttribute('aria-label', primaryLabel);
  }

  LogHelper.log('Hero content rendered with text overrides');
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
 * RFC-0086: Get current dashboard title from ThingsBoard context
 */
function getCurrentDashboardTitle() {
  try {
    // Try multiple sources for dashboard title
    const title = ctx.stateController?.dashboardCtx?.name ||
                  ctx.stateController?.dashboardCtx?.dashboard?.title ||
                  ctx.dashboard?.title ||
                  null;
    return title;
  } catch (error) {
    LogHelper.warn('Error getting dashboard title:', error);
    return null;
  }
}

/**
 * RFC-0086: Set shopping label in window global (for other widgets)
 */
function setShoppingButtonLabel(label) {
  window[MYIO_SHOPPING_LABEL_KEY] = label;
  LogHelper.log('RFC-0086: Shopping label set to:', label);
}

/**
 * RFC-0086: Get shopping label (for other widgets to use)
 */
function getShoppingLabel() {
  // Try window first, then localStorage
  if (window[MYIO_SHOPPING_LABEL_KEY]) {
    return window[MYIO_SHOPPING_LABEL_KEY];
  }
  try {
    const stored = localStorage.getItem(MYIO_SHOPPING_LABEL_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * RFC-0086: Update and persist shopping label from current dashboard
 */
function updateShoppingLabelFromDashboard() {
  const title = getCurrentDashboardTitle();
  if (title) {
    setShoppingButtonLabel(title);
    try {
      localStorage.setItem(MYIO_SHOPPING_LABEL_KEY, JSON.stringify(title));
    } catch {}
  } else {
    setShoppingButtonLabel(null);
  }
}

/**
 * Initialize widget
 * rev001: Added text overrides rendering
 * rev002: Added settings.schema.json support for all configurations
 * rev003: RFC-0086 - Share DATA_API_HOST globally
 * rev004: RFC-0086 - Share shopping label globally
 */
async function init() {
  // Apply debug mode from settings
  const settings = ctx.settings || {};
  if (settings.enableDebugMode !== undefined) {
    DEBUG_ACTIVE = settings.enableDebugMode;
  }

  // RFC-0086: Save DATA_API_HOST to localStorage for all widgets
  try {
    localStorage.setItem('__MYIO_DATA_API_HOST__', settings.dataApiHost);
    LogHelper.log('RFC-0086: DATA_API_HOST saved to localStorage:', settings.dataApiHost);
  } catch (e) {
    LogHelper.warn('RFC-0086: Failed to save DATA_API_HOST to localStorage:', e);
  }

  // RFC-0086: Update and persist shopping label
  updateShoppingLabelFromDashboard();

  LogHelper.log('init() called');
  LogHelper.log('Debug mode:', DEBUG_ACTIVE, '(from settings)');
  LogHelper.log('Widget settings:', ctx.settings);

  try {
    // Fetch customer attributes
    customerAttrs = await fetchCustomerAttributes();

    // Resolve and apply palette (Widget Settings > Customer Attrs > Defaults)
    currentPalette = resolvePalette(customerAttrs);
    applyPalette(currentPalette);

    // Render components
    applyHeroBackground(customerAttrs); // Apply hero background image
    renderLogo(customerAttrs);
    renderHeroContent(customerAttrs); // rev001: Text overrides
    await fetchAndRenderUserMenu(customerAttrs); // Fetch user from API
    renderShortcuts(customerAttrs);
    wireCTA(customerAttrs);

    LogHelper.log('✅ Initialization complete');
  } catch (error) {
    LogHelper.error('Initialization error:', error);
  }
}

// Widget lifecycle hooks
self.onInit = function () {
  LogHelper.log('onInit() called');
  init();
};

self.onDataUpdated = function () {
  // Widget doesn't depend on data updates
  LogHelper.log('onDataUpdated() called (no-op)');
};

self.onDestroy = function () {
  LogHelper.log('onDestroy() called');
};
