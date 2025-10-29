# RFC-0057: Home "Welcome LV" Widget with Brand Palette, User Menu, and Shopping Shortcuts

**Status:** Approved
**Authors:** MYIO Platform Team
**Date:** 2025-10-29
**Revision:** rev001 - 2025-10-29 (Review feedback incorporated)
**Target:** main-dashboard-shopping v-5.2.0
**Owners:** Frontend (ThingsBoard Widgets) + Library (myio-js-library-PROD)

---

## Table of Contents

1. [Summary](#summary)
2. [Motivation](#motivation)
3. [Guide-Level Explanation](#guide-level-explanation)
4. [Reference-Level Explanation](#reference-level-explanation)
5. [Detailed Design](#detailed-design)
6. [Attribute Schema](#attribute-schema)
7. [Implementation Plan](#implementation-plan)
8. [Testing Strategy](#testing-strategy)
9. [Backward Compatibility](#backward-compatibility)
10. [Alternatives Considered](#alternatives-considered)
11. [Security Considerations](#security-considerations)
12. [Success Metrics](#success-metrics)
13. [Future Work](#future-work)

---

## Summary

This RFC proposes the creation of a new **Last Value widget** called **"Welcome LV"** for the Home dashboard that provides:

- **Hero section** with configurable logo, title, description, and primary CTA button
- **Text overrides** for full localization support without code changes
- **User session info** displaying logged user's name, email, and Logout action
- **Shopping shortcuts** as a horizontal row of cards with flexible navigation options
- **Brand awareness** through Customer-level configuration of colors, gradients, and logos
- **Accessibility-first** design with keyboard navigation and ARIA labels
- **Performance-optimized** with lazy loading and validated CSS injection
- **Fallback mechanism** to MYIO default palette and branding when no configuration exists

This widget is designed as a drop-in replacement for the current welcome hero while adding new functionality without breaking existing dashboards.

**Review rev001 Changes:**
- Added text override attributes for localization
- Added per-card navigation flexibility (state, openInNewTab)
- Enhanced Customer lookup with robust fallbacks
- Implemented accessibility features (tabindex, keyboard handlers, ARIA)
- Added palette validation for security
- Added lazy-loading for card images
- Enhanced test coverage for edge cases

---

## Motivation

### Current Limitations

1. **Existing welcome widget** is static HTML without user context or navigation shortcuts
2. **No partner branding** - cannot customize colors/logos per Customer
3. **Manual navigation** - users must use menu to access shopping dashboards
4. **No user session visibility** - name/email/logout not visible on Home

### Business Requirements

1. **Partner projects** (e.g., Sá Cavalcante, Campinas Shopping) require corporate branding
2. **User experience** - direct shortcuts to shopping dashboards improve efficiency
3. **Session transparency** - users need to see who is logged in
4. **White-label capability** - platform must support multi-tenant branding

### Technical Goals

1. Use ThingsBoard **Last Value widget** type for simplicity
2. Read configuration from **Customer SERVER_SCOPE** attributes
3. Reuse existing **MENU widget** logic for user session management
4. Maintain **zero dependencies** on specific telemetry keys
5. Ensure **responsive design** across all screen sizes

---

## Guide-Level Explanation

### What Users Will See

#### 1. Hero Section
```
┌─────────────────────────────────────────────────────────┐
│ [LOGO]                           [User: João Silva ▼]  │
│                                   joao@example.com       │
│                                   [Logout]               │
│                                                          │
│         Bem-vindo ao MYIO Platform                      │
│         Gestão inteligente de energia e recursos        │
│                                                          │
│              [ACESSAR DASHBOARD]                        │
└─────────────────────────────────────────────────────────┘
```

#### 2. Shopping Shortcuts
```
┌──────────────────────────────────────────────────────────────┐
│  [Campinas Shopping]  [Mestre Álvaro]  [Shopping X]  […]   │
│   Energia & Água       Operações        Manutenção          │
└──────────────────────────────────────────────────────────────┘
```

### Actions & Navigation

| Action | Behavior |
|--------|----------|
| **ACESSAR** button | Navigate → Dashboard State → `main` (or configured state) |
| **Shopping card** click | Navigate → Other Dashboard → configured `dashboardId` |
| **Logout** link | Execute logout → redirect to login page |
| **User menu** dropdown | Show name, email, logout option |

### Configuration Location

All customization is controlled via **Customer SERVER_SCOPE attributes**:

```json
{
  "home.brand.logoUrl": "https://...",
  "home.brand.palette": {
    "primary": "#7A2FF7",
    "secondary": "#5A1FD1",
    "gradientStart": "rgba(10,18,44,0.55)",
    "gradientEnd": "rgba(10,18,44,0.15)",
    "ink": "#F5F7FA",
    "muted": "#B8C2D8"
  },
  "home.hero.title": "Bem-vindo ao MYIO Platform",
  "home.hero.description": "Gestão inteligente de energia...",
  "home.actions.primaryLabel": "ACESSAR DASHBOARD",
  "home.cards": [...],
  "home.actions.primaryState": "main",
  "home.showUserMenu": true
}
```

**Fallback:** If attributes are absent, widget uses MYIO default purple palette, logo, and Portuguese text.

---

## Reference-Level Explanation

### File Structure

```
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\
  src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\
    HOME\
      WelcomeLV\
        controller.js      # Main widget logic
        template.html      # HTML structure
        style.css          # Styling with CSS variables
        settings.schema    # Widget settings schema
        README.md          # Documentation & examples
```

### Dependencies

| Component | Source | Purpose |
|-----------|--------|---------|
| **User Session** | MENU widget | Get user name, email, logout |
| **Navigation** | ThingsBoard ctx | Dashboard state navigation |
| **Attributes** | Customer API | Fetch SERVER_SCOPE config |
| **MyIOLibrary** | CDN/Resources | Shared utilities (optional) |

### Widget Type

- **Type:** Last Value (ThingsBoard)
- **Datasource:** Optional (widget does not require specific keys)
- **Why Last Value?** Simplicity and compatibility with existing dashboard grid

### Key Features

#### 1. Brand Palette Resolution

```javascript
function resolvePalette(customerAttrs) {
  const defaultPalette = {
    primary: '#7A2FF7',
    secondary: '#5A1FD1',
    gradientStart: 'rgba(10,18,44,0.55)',
    gradientEnd: 'rgba(10,18,44,0.15)',
    ink: '#F5F7FA',
    muted: '#B8C2D8'
  };

  return customerAttrs?.['home.brand.palette'] || defaultPalette;
}
```

#### 2. Shopping Cards Rendering

```javascript
function renderCards(cards) {
  if (!cards || cards.length === 0) {
    return ''; // Hide row gracefully
  }

  return cards.map(card => `
    <div class="shopping-card" data-dashboard-id="${card.dashboardId}">
      <div class="card-bg" style="background-image: url(${card.bgImageUrl || ''})"></div>
      <h3>${card.title}</h3>
      <p>${card.subtitle}</p>
    </div>
  `).join('');
}
```

#### 3. User Menu Integration

```javascript
function getUserInfo() {
  // Reuse logic from MENU widget
  const user = ctx.currentUser;
  return {
    name: user?.firstName + ' ' + user?.lastName,
    email: user?.email,
    authority: user?.authority
  };
}

function handleLogout() {
  // Use same logout mechanism as MENU
  ctx.logout();
}
```

---

## Detailed Design

### 1. HTML Structure (template.html)

```html
<section class="welcome-lv">
  <!-- Hero Section -->
  <div class="hero-container">
    <!-- Logo -->
    <div class="brand-logo">
      <img id="welcomeBrandLogo" src="" alt="Logo" />
    </div>

    <!-- User Menu -->
    <div class="user-menu" id="welcomeUserMenu">
      <div class="user-info">
        <span class="user-name" id="welcomeUserName">Loading...</span>
        <span class="user-email" id="welcomeUserEmail"></span>
      </div>
      <button class="btn-logout" id="welcomeLogout">Sair</button>
    </div>

    <!-- Hero Content (rev001: Added IDs for text overrides) -->
    <div class="hero-content">
      <h1 class="hero-title" id="welcomeHeroTitle">Bem-vindo ao MYIO Platform</h1>
      <p class="hero-description" id="welcomeHeroDescription">
        Gestão inteligente de energia, água e recursos para shoppings centers
      </p>
      <button class="btn-primary"
              id="welcomeCTA"
              tabindex="0"
              aria-label="ACESSAR DASHBOARD">
        ACESSAR DASHBOARD
      </button>
    </div>
  </div>

  <!-- Shopping Shortcuts (rev001: Cards have tabindex and aria-labels in JS) -->
  <div class="shortcuts-container"
       id="welcomeShortcuts"
       role="navigation"
       aria-label="Shopping dashboard shortcuts">
    <!-- Cards will be rendered here with accessibility attributes -->
  </div>
</section>
```

### 2. CSS Styling (style.css)

```css
/* CSS Variables (overridable via Customer attributes) */
:root {
  --welcome-ink: #F5F7FA;
  --welcome-muted: #B8C2D8;
  --welcome-primary: #7A2FF7;
  --welcome-secondary: #5A1FD1;
  --welcome-grad-start: rgba(10,18,44,0.55);
  --welcome-grad-end: rgba(10,18,44,0.15);
}

.welcome-lv {
  width: 100%;
  min-height: 400px;
  background: linear-gradient(120deg, var(--welcome-grad-start), var(--welcome-grad-end)),
              url('https://dashboard.myio-bas.com/api/images/public/wntqPf1KcpLX2l182DY86Y4p8pa3bj6F');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color: var(--welcome-ink);
  padding: 32px;
  border-radius: 12px;
}

/* Hero Layout */
.hero-container {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
  gap: 24px;
  min-height: 300px;
}

.brand-logo {
  grid-column: 1;
  grid-row: 1;
}

.brand-logo img {
  max-height: 60px;
  max-width: 200px;
  object-fit: contain;
}

.user-menu {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.user-info {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--welcome-ink);
}

.user-email {
  font-size: 12px;
  color: var(--welcome-muted);
}

.btn-logout {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: var(--welcome-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

/* Hero Content */
.hero-content {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 24px;
}

.hero-title {
  font-size: 48px;
  font-weight: 700;
  margin: 0;
  color: var(--welcome-ink);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.hero-description {
  font-size: 18px;
  font-weight: 400;
  margin: 0;
  color: var(--welcome-muted);
  max-width: 600px;
}

.btn-primary {
  padding: 16px 48px;
  background: linear-gradient(135deg, var(--welcome-primary), var(--welcome-secondary));
  border: none;
  border-radius: 8px;
  color: var(--welcome-ink);
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(122, 47, 247, 0.4);
  transition: all 0.3s;
}

.btn-primary:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(122, 47, 247, 0.6);
}

/* Shopping Shortcuts */
.shortcuts-container {
  margin-top: 32px;
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 16px 0;
  scroll-behavior: smooth;
}

.shortcuts-container::-webkit-scrollbar {
  height: 8px;
}

.shortcuts-container::-webkit-scrollbar-thumb {
  background: var(--welcome-primary);
  border-radius: 4px;
}

.shopping-card {
  flex: 0 0 280px;
  height: 160px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s;
}

.shopping-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  border-color: var(--welcome-primary);
}

.shopping-card .card-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  opacity: 0.3;
  z-index: 0;
}

.shopping-card h3 {
  position: relative;
  z-index: 1;
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--welcome-ink);
}

.shopping-card p {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 14px;
  color: var(--welcome-muted);
}

/* Responsive */
@media (max-width: 1024px) {
  .hero-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }

  .brand-logo {
    grid-column: 1;
    grid-row: 1;
    text-align: center;
  }

  .user-menu {
    grid-column: 1;
    grid-row: 2;
    justify-content: center;
  }

  .hero-content {
    grid-row: 3;
  }

  .hero-title {
    font-size: 36px;
  }
}

@media (max-width: 560px) {
  .hero-title {
    font-size: 28px;
  }

  .hero-description {
    font-size: 16px;
  }

  .btn-primary {
    padding: 12px 32px;
    font-size: 14px;
  }

  .shopping-card {
    flex: 0 0 240px;
    height: 140px;
  }
}
```

### 3. Controller Logic (controller.js)

```javascript
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
 *   "home.cards": [
 *     {
 *       "title": "Campinas Shopping",
 *       "subtitle": "Energia & Água",
 *       "dashboardId": "7a9e2b50-1111-2222-3333-444444444444",
 *       "bgImageUrl": "https://.../campinas.jpg"
 *     }
 *   ],
 *   "home.actions.primaryState": "main",
 *   "home.showUserMenu": true
 * }
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

// State
let customerAttrs = {};
let currentPalette = DEFAULT_PALETTE;

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
 * rev001: Added support for state, openInNewTab, and lazy loading
 */
function renderShortcuts(attrs) {
  const cards = attrs['home.cards'] || [];
  const container = document.getElementById('welcomeShortcuts');

  if (!container) return;

  if (cards.length === 0) {
    container.style.display = 'none';
    LogHelper.log('No cards configured, hiding shortcuts row');
    return;
  }

  container.innerHTML = cards.map((card, index) => `
    <div class="shopping-card"
         data-dashboard-id="${card.dashboardId || ''}"
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

  LogHelper.log('Shortcuts rendered:', cards.length, 'cards');
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

    LogHelper.log('✅ Initialization complete');
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
```

---

## Attribute Schema

### Complete Customer SERVER_SCOPE Attributes

```json
{
  "home.brand.logoUrl": {
    "type": "string",
    "description": "URL to brand logo image",
    "default": "https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG",
    "example": "https://my-bucket.s3.amazonaws.com/logos/campinas-logo.png"
  },
  "home.brand.palette": {
    "type": "object",
    "description": "Brand color palette",
    "properties": {
      "primary": {
        "type": "string",
        "description": "Primary brand color (hex)",
        "default": "#7A2FF7"
      },
      "secondary": {
        "type": "string",
        "description": "Secondary brand color (hex)",
        "default": "#5A1FD1"
      },
      "gradientStart": {
        "type": "string",
        "description": "Hero gradient start (rgba)",
        "default": "rgba(10,18,44,0.55)"
      },
      "gradientEnd": {
        "type": "string",
        "description": "Hero gradient end (rgba)",
        "default": "rgba(10,18,44,0.15)"
      },
      "ink": {
        "type": "string",
        "description": "Text color (hex)",
        "default": "#F5F7FA"
      },
      "muted": {
        "type": "string",
        "description": "Muted text color (hex)",
        "default": "#B8C2D8"
      }
    }
  },
  "home.hero.title": {
    "type": "string",
    "description": "rev001: Hero section title (localization support)",
    "default": "Bem-vindo ao MYIO Platform",
    "example": "Welcome to MYIO Platform"
  },
  "home.hero.description": {
    "type": "string",
    "description": "rev001: Hero section description (localization support)",
    "default": "Gestão inteligente de energia, água e recursos para shoppings centers",
    "example": "Intelligent energy, water and resource management for shopping malls"
  },
  "home.actions.primaryLabel": {
    "type": "string",
    "description": "rev001: Primary CTA button label (localization support)",
    "default": "ACESSAR DASHBOARD",
    "example": "ACCESS DASHBOARD"
  },
  "home.cards": {
    "type": "array",
    "description": "Shopping shortcut cards",
    "items": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Card title",
          "required": true
        },
        "subtitle": {
          "type": "string",
          "description": "Card subtitle"
        },
        "dashboardId": {
          "type": "string",
          "description": "Target dashboard UUID",
          "required": true
        },
        "state": {
          "type": "string",
          "description": "rev001: Optional dashboard state to navigate to",
          "example": "main"
        },
        "openInNewTab": {
          "type": "boolean",
          "description": "rev001: Open dashboard in new tab",
          "default": false
        },
        "bgImageUrl": {
          "type": "string",
          "description": "Background image URL (rev001: lazy loaded)"
        },
        "iconUrl": {
          "type": "string",
          "description": "Icon URL (future use)"
        }
      }
    },
    "example": [
      {
        "title": "Campinas Shopping",
        "subtitle": "Energia & Água",
        "dashboardId": "7a9e2b50-1111-2222-3333-444444444444",
        "bgImageUrl": "https://.../campinas.jpg"
      },
      {
        "title": "Mestre Álvaro",
        "subtitle": "Operações",
        "dashboardId": "1b2c3d4e-aaaa-bbbb-cccc-dddddddddddd"
      }
    ]
  },
  "home.actions.primaryState": {
    "type": "string",
    "description": "Dashboard state for primary CTA",
    "default": "main",
    "example": "overview"
  },
  "home.showUserMenu": {
    "type": "boolean",
    "description": "Show/hide user menu",
    "default": true
  }
}
```

### Example Configurations

#### Partner: Sá Cavalcante (Green Theme)
```json
{
  "home.brand.logoUrl": "https://dashboard.myio-bas.com/api/images/sa-cavalcante-logo.png",
  "home.brand.palette": {
    "primary": "#2E7D32",
    "secondary": "#1B5E20",
    "gradientStart": "rgba(46,125,50,0.6)",
    "gradientEnd": "rgba(27,94,32,0.2)",
    "ink": "#FFFFFF",
    "muted": "#C8E6C9"
  },
  "home.cards": [
    {
      "title": "Shopping Sá Cavalcante",
      "subtitle": "Dashboard Principal",
      "dashboardId": "abc123-...",
      "bgImageUrl": "https://.../sa-cavalcante-bg.jpg"
    }
  ],
  "home.actions.primaryState": "main",
  "home.showUserMenu": true
}
```

#### Partner: Campinas Shopping (Blue Theme)
```json
{
  "home.brand.logoUrl": "https://dashboard.myio-bas.com/api/images/campinas-logo.png",
  "home.brand.palette": {
    "primary": "#1976D2",
    "secondary": "#0D47A1",
    "gradientStart": "rgba(25,118,210,0.65)",
    "gradientEnd": "rgba(13,71,161,0.25)",
    "ink": "#FFFFFF",
    "muted": "#BBDEFB"
  },
  "home.cards": [
    {
      "title": "Campinas Shopping",
      "subtitle": "Energia",
      "dashboardId": "def456-..."
    },
    {
      "title": "Água e Efluentes",
      "subtitle": "Monitoramento",
      "dashboardId": "ghi789-..."
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Core Widget Development (Week 1)

#### Day 1-2: File Structure & Base HTML
- [ ] Create directory structure
- [ ] Implement template.html with basic hero layout
- [ ] Add placeholder for user menu and shortcuts
- [ ] Test rendering in ThingsBoard

#### Day 3-4: Styling & CSS Variables
- [ ] Implement complete style.css with tokens
- [ ] Test responsive breakpoints (≤560px, ≤1024px)
- [ ] Add animations and transitions
- [ ] Test with different color palettes

#### Day 5: Controller Logic
- [ ] Implement attribute fetching
- [ ] Implement palette resolution and application
- [ ] Wire CTA navigation
- [ ] Add comprehensive logging

### Phase 2: Features & Integration (Week 2)

#### Day 1-2: User Menu
- [ ] Implement getUserInfo()
- [ ] Wire logout functionality
- [ ] Test with different user roles
- [ ] Handle edge cases (no user, missing fields)

#### Day 3-4: Shopping Shortcuts
- [ ] Implement card rendering
- [ ] Wire card click navigation
- [ ] Handle empty cards array
- [ ] Test with 0, 1, 5, 10 cards

#### Day 5: Testing & Polish
- [ ] Cross-browser testing (Chrome, Firefox, Edge)
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [ ] Documentation completion

### Phase 3: Deployment & Rollout (Week 3)

#### Day 1: Library Build
- [ ] Build myio-js-library-PROD
- [ ] Publish to CDN/resources
- [ ] Update version tags

#### Day 2: ThingsBoard Integration
- [ ] Import widget into ThingsBoard
- [ ] Configure widget settings
- [ ] Test in development environment

#### Day 3: Pilot Customer
- [ ] Configure attributes for pilot Customer
- [ ] Deploy to pilot dashboard
- [ ] Gather feedback

#### Day 4-5: Refinement & Rollout
- [ ] Address pilot feedback
- [ ] Deploy to production Customers
- [ ] Monitor for issues
- [ ] Document any changes

---

## Testing Strategy

### Unit Tests

```javascript
describe('WelcomeLV Widget', () => {
  describe('resolvePalette', () => {
    it('should return custom palette when provided', () => {
      const attrs = {
        'home.brand.palette': {
          primary: '#FF0000',
          secondary: '#00FF00'
        }
      };
      const palette = resolvePalette(attrs);
      expect(palette.primary).toBe('#FF0000');
    });

    it('should return default palette when not provided', () => {
      const palette = resolvePalette({});
      expect(palette.primary).toBe('#7A2FF7');
    });
  });

  describe('renderShortcuts', () => {
    it('should hide container when no cards', () => {
      const container = document.createElement('div');
      container.id = 'welcomeShortcuts';
      document.body.appendChild(container);

      renderShortcuts({});

      expect(container.style.display).toBe('none');
    });

    it('should render correct number of cards', () => {
      const attrs = {
        'home.cards': [
          { title: 'Card 1', dashboardId: 'id1' },
          { title: 'Card 2', dashboardId: 'id2' }
        ]
      };

      renderShortcuts(attrs);

      const cards = document.querySelectorAll('.shopping-card');
      expect(cards.length).toBe(2);
    });
  });

  // rev001: New tests from review feedback
  describe('applyPalette', () => {
    it('should apply valid colors to CSS variables', () => {
      const palette = {
        primary: '#FF0000',
        secondary: '#00FF00',
        gradientStart: 'rgba(10,18,44,0.55)',
        gradientEnd: 'rgba(10,18,44,0.15)',
        ink: '#FFFFFF',
        muted: '#CCCCCC'
      };

      applyPalette(palette);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--welcome-primary')).toBe('#FF0000');
      expect(root.style.getPropertyValue('--welcome-grad-start')).toBe('rgba(10,18,44,0.55)');
    });

    it('should skip invalid colors', () => {
      const palette = {
        primary: 'invalid-color',
        secondary: '#00FF00',
        gradientStart: 'rgba(10,18,44,0.55)',
        gradientEnd: 'rgba(10,18,44,0.15)',
        ink: '#FFFFFF',
        muted: '#CCCCCC'
      };

      applyPalette(palette);

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--welcome-primary')).toBe('');
      expect(root.style.getPropertyValue('--welcome-secondary')).toBe('#00FF00');
    });
  });

  describe('renderUserMenu', () => {
    it('should show user menu when showUserMenu is true', () => {
      const attrs = { 'home.showUserMenu': true };
      const container = document.createElement('div');
      container.id = 'welcomeUserMenu';
      document.body.appendChild(container);

      renderUserMenu(attrs);

      expect(container.style.display).not.toBe('none');
    });

    it('should hide user menu when showUserMenu is false', () => {
      const attrs = { 'home.showUserMenu': false };
      const container = document.createElement('div');
      container.id = 'welcomeUserMenu';
      document.body.appendChild(container);

      renderUserMenu(attrs);

      expect(container.style.display).toBe('none');
    });
  });

  describe('isValidColor', () => {
    it('should validate hex colors', () => {
      expect(isValidColor('#FF0000')).toBe(true);
      expect(isValidColor('#F00')).toBe(true);
      expect(isValidColor('FF0000')).toBe(false);
    });

    it('should validate rgba colors', () => {
      expect(isValidColor('rgba(10,18,44,0.55)')).toBe(true);
      expect(isValidColor('rgb(10,18,44)')).toBe(true);
      expect(isValidColor('rgba(10,18,44)')).toBe(true);
    });

    it('should reject invalid colors', () => {
      expect(isValidColor('red')).toBe(false);
      expect(isValidColor('invalid')).toBe(false);
      expect(isValidColor('')).toBe(false);
    });
  });
});
```

### Integration Tests

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Default Widget** | 1. Deploy widget with no attributes | Widget renders with MYIO purple theme and default logo |
| **Custom Palette** | 1. Set `home.brand.palette`<br>2. Refresh dashboard | Widget applies custom colors to all elements |
| **Custom Logo** | 1. Set `home.brand.logoUrl`<br>2. Refresh dashboard | Custom logo displays in top-left |
| **Shopping Cards** | 1. Configure 3 cards<br>2. Click each card | Each card navigates to correct dashboard |
| **User Menu** | 1. Check displayed name/email<br>2. Click Logout | Name/email match logged user; logout redirects to login |
| **CTA Button** | 1. Set `primaryState` to "overview"<br>2. Click ACESSAR | Dashboard navigates to "overview" state |
| **No Cards** | 1. Set `home.cards` to empty array | Shortcuts row is hidden |
| **Hide User Menu** | 1. Set `home.showUserMenu` to false | User menu is hidden |
| **Responsive** | 1. Resize to mobile (≤560px)<br>2. Resize to tablet (≤1024px) | Layout adapts correctly at each breakpoint |
| **rev001: No Customer ID** | 1. Remove Customer datasource<br>2. Load widget | Widget renders with default palette and logs warning |
| **rev001: Missing Token** | 1. Clear localStorage JWT<br>2. Refresh widget | Widget renders with defaults gracefully |
| **rev001: Text Overrides** | 1. Set custom title/description/label<br>2. Refresh dashboard | Custom text displays correctly |
| **rev001: Card with State** | 1. Configure card with `state` property<br>2. Click card | Navigates to dashboard with specified state |
| **rev001: Card openInNewTab** | 1. Configure card with `openInNewTab: true`<br>2. Click card | Dashboard opens in new browser tab |
| **rev001: Keyboard Navigation** | 1. Tab to CTA button<br>2. Press Enter<br>3. Tab to cards<br>4. Press Space | All elements navigable and activatable via keyboard |
| **rev001: Lazy Loading** | 1. Configure 10 cards with bg images<br>2. Scroll horizontally | Images load only when visible in viewport |

### Manual Testing Checklist

- [ ] Widget loads without errors in ThingsBoard
- [ ] Default palette applied when no attributes
- [ ] Custom palette overrides all colors correctly
- [ ] Logo loads and displays properly
- [ ] Fallback logo displays on load error
- [ ] User name and email are correct
- [ ] Logout button works and redirects
- [ ] CTA button navigates to configured state
- [ ] Shopping cards render with correct data
- [ ] Card clicks navigate to correct dashboards
- [ ] Empty cards array hides shortcuts row
- [ ] Responsive layout works on mobile/tablet
- [ ] No console errors during any interaction
- [ ] All logs use `[WelcomeLV]` prefix
- [ ] **rev001:** Text overrides work (title, description, primaryLabel)
- [ ] **rev001:** Palette validation prevents invalid colors
- [ ] **rev001:** Cards support state and openInNewTab
- [ ] **rev001:** Keyboard navigation works (Tab, Enter, Space)
- [ ] **rev001:** ARIA labels present and correct
- [ ] **rev001:** Lazy loading works for card images
- [ ] **rev001:** Customer lookup fallbacks work
- [ ] **rev001:** Accessibility score ≥90 (Lighthouse)

---

## Backward Compatibility

### Non-Breaking Changes

1. **Existing welcome widget unchanged** - Old HTML widget remains functional
2. **Additive attributes** - No modification to existing Customer attributes
3. **Optional configuration** - Widget works with zero configuration

### Migration Path

#### Option 1: Side-by-Side (Recommended)
1. Add new Welcome LV widget to Home dashboard
2. Place below or above existing welcome widget
3. Test functionality for 1 week
4. Remove old widget if approved

#### Option 2: Direct Replacement
1. Export current dashboard (backup)
2. Replace old widget with Welcome LV
3. Test all navigation
4. Rollback if issues

### Rollback Plan

If issues are discovered:
1. Keep old widget in widget library as backup
2. Re-add old widget to dashboard
3. Remove Welcome LV widget
4. Investigate and fix issues
5. Retry deployment

---

## Alternatives Considered

### 1. Embed Shortcuts in Existing Widget
**Rejected** - High risk of regression; would require modifying stable HTML widget

### 2. Use Timeseries Widget Type
**Rejected** - Unnecessary complexity; no timeseries data needed

### 3. Separate User Menu Widget
**Rejected** - Would fragment user experience; better to have cohesive hero section

### 4. Client-Side Brand Config (Widget Settings)
**Rejected** - Not multi-tenant friendly; requires per-dashboard configuration instead of per-Customer

### 5. Hardcode Partner Themes
**Rejected** - Not scalable; every new partner requires code change and deployment

---

## Security Considerations

### Authentication & Authorization

1. **User Info Access**
   - Uses ThingsBoard's `ctx.currentUser` API
   - No direct JWT manipulation
   - Respects ThingsBoard's RBAC

2. **Logout Mechanism**
   - Reuses ThingsBoard's `ctx.logout()` method
   - Fallback clears JWT and redirects
   - No custom session management

### Data Access

1. **Customer Attributes**
   - Read-only access to SERVER_SCOPE attributes
   - No write operations
   - No secrets stored in attributes

2. **Dashboard Navigation**
   - Uses ThingsBoard's navigation API
   - No direct URL manipulation
   - Dashboard access controlled by ThingsBoard permissions

### XSS Prevention

1. **Card Rendering**
   - All user-provided text is escaped
   - No `innerHTML` with unescaped content
   - Image URLs validated as HTTPS

2. **CSS Injection**
   - Color values validated as hex/rgba
   - No arbitrary CSS injection
   - CSS variables isolated to widget scope

### Audit Trail

All actions logged with prefix `[WelcomeLV]`:
- User sessions
- Navigation events
- Configuration loading
- Errors and warnings

---

## Success Metrics

### Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Widget Load Time | < 500ms | Chrome DevTools Performance |
| Navigation Success Rate | 100% | Manual testing + logs |
| Palette Override Success | 100% | Visual inspection + computed styles |
| Logo Load Success | ≥ 95% | Error logs + fallback trigger rate |
| Logout Success Rate | 100% | Manual testing + session termination |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Partner Deployments | ≥ 3 | Number of Customers with custom branding |
| User Satisfaction | ≥ 4.0/5.0 | User surveys |
| Support Tickets | 0 critical | Support system |
| Adoption Rate | ≥ 80% | Dashboards using new widget |

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Console Errors | 0 | Browser DevTools |
| Failed Attribute Fetches | < 5% | Error logs |
| Responsive Breakpoints | 100% | Visual testing |
| Accessibility Score | ≥ 90 | Lighthouse audit |

---

## Future Work

### Phase 2 Features (Q1 2026)

1. **"Saiba Mais" Modal**
   - Documentation modal with platform overview
   - Video tutorials
   - Quick start guides

2. **Feature Flags**
   - Server-driven section visibility
   - A/B testing capability
   - Gradual rollout control

3. **Telemetry Integration**
   - Alert badges on shopping cards
   - Real-time status indicators
   - Quick metrics display

4. **Advanced Customization**
   - Custom hero backgrounds per Customer
   - Animated backgrounds
   - Video backgrounds

### Phase 3 Enhancements (Q2 2026)

1. **Analytics Integration**
   - Track CTA clicks
   - Track card navigation
   - Heatmap of user interactions

2. **Personalization**
   - User-specific card ordering
   - Recently visited dashboards
   - Favorite dashboards

3. **Multi-Language Support**
   - i18n for all text
   - Locale-specific formatting
   - RTL language support

4. **Accessibility**
   - Screen reader optimization
   - Keyboard navigation
   - High contrast mode

---

## References

### Related RFCs
- **RFC-0051**: Shopping Dashboard Structure
- **RFC-0052**: Global Widget Settings
- **RFC-0053**: State Management Pattern
- **RFC-0058**: Footer Selection & Comparison

### External Documentation
- [ThingsBoard Widget API](https://thingsboard.io/docs/user-guide/ui/widget-library/)
- [ThingsBoard Actions API](https://thingsboard.io/docs/user-guide/ui/actions/)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)

### Code Repositories
- **myio-js-library-PROD**: Main widget library
- **ThingsBoard CE**: Platform source

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-29 | 1.0.0 | Initial RFC approved |
| 2025-10-29 | 1.0.1-rev001 | **Review feedback incorporated:**<br>• Added text override attributes (home.hero.title, home.hero.description, home.actions.primaryLabel)<br>• Added per-card navigation flexibility (state, openInNewTab)<br>• Enhanced Customer lookup with multiple fallback sources<br>• Implemented palette validation (hex/rgba regex)<br>• Added accessibility features (tabindex, keyboard handlers, ARIA labels)<br>• Implemented lazy loading for card background images<br>• Enhanced user menu with robust guards<br>• Added comprehensive unit tests (applyPalette, renderUserMenu, isValidColor)<br>• Added integration tests (missing customer/token, text overrides, keyboard navigation)<br>• Updated manual testing checklist with accessibility criteria<br>• Fixed timeline in implementation plan (16 days vs 21 days) |

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Tech Lead** | [Name] | [Date] | [Signature] |
| **Product Owner** | [Name] | [Date] | [Signature] |
| **QA Lead** | [Name] | [Date] | [Signature] |

---

**End of RFC-0057**
