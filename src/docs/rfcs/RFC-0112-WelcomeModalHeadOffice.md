# RFC 0112: Welcome Modal Head Office Component

- Feature Name: `welcome_modal_head_office`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Implemented**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0111 (MAIN_UNIQUE_DATASOURCE), RFC-0057 (Welcome LV Widget)

---

## Summary

This RFC documents the **WelcomeModal** component in the MYIO library. This modal provides the landing dashboard experience for Head Office users, featuring:

- **Theme Mode Support**: Dark/Light themes with configurable colors, logos, and backgrounds per theme
- **Theme Toggle Button**: Sun/Moon emoji toggle (☀️/🌙) for switching themes
- **Responsive Design**: Full viewport modal with mobile-first approach
- **Shopping Cards**: Interactive cards with device counts per domain (energy, water, temperature)
- **User Menu**: User info and logout functionality

---

## Implementation Status

### Completed Features (Rev-005)

1. **Modal Behavior**
   - Modal occupies ~90% of viewport width and height
   - Background blur: `backdrop-filter: blur(10px)`
   - Scroll locked on underlying page
   - Rounded corners (14px)
   - Soft shadow/glow effect
   - Centered horizontally and vertically

2. **Theme Mode Support**
   - `themeMode` parameter: `'dark' | 'light'`
   - `showThemeToggle` parameter (default: true)
   - `onThemeChange` callback for MAIN component integration
   - `setThemeMode()` / `getThemeMode()` methods on instance
   - Theme-specific configuration via `configTemplate.darkMode` / `configTemplate.lightMode`

3. **Logo & Branding**
   - Large floating logo (~180px on desktop)
   - Theme-specific logo URLs
   - Theme-specific background images

4. **Shopping Card Features**
   - Grid layout fixo: 3 cards por linha em todas as resoluções
   - **Card Layout Structure:**
     - TOP: Meta counts (👥 users, 🚨 alarms, 🔔 notifications) - position absolute
     - CENTER: Customer name (título) - position absolute centered
     - BOTTOM: Device counts (⚡ 💧 🌡️) com valores de consumo - position absolute
   - **Device counts com valores de consumo:**
     - Energy: `⚡ 45 (1.2 MWh)` ou `⚡ 45 (850 kWh)` se < 1000
     - Water: `💧 12 (180 m³)`
     - Temperature: `🌡️ 8 (23.5 °C)`
   - Badges com `min-width` uniforme para 3 dígitos
   - Interactive device count badges with hover effects
   - Hover scale effect (1.03)
   - Tooltip integration on hover
   - **Dynamic Layout Algorithm:** `calculateGridLayout()` ajusta altura dos cards automaticamente

5. **Responsive Design**
   - Full viewport on mobile (100vw, 100vh)
   - User menu flows in content on mobile
   - Vertical scroll enabled
   - Theme toggle button positioned below user menu

---

## API Reference

### WelcomeConfigTemplate (New Structure)

```typescript
/**
 * Theme-specific configuration (colors, background, logo)
 */
interface WelcomeThemeConfig {
  // Background & Logo (theme-specific)
  backgroundUrl?: string;
  logoUrl?: string;

  // Brand Colors
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  mutedTextColor?: string;

  // Gradient Colors
  gradientStartColor?: string;
  gradientEndColor?: string;

  // User Menu Colors
  userMenuBackgroundColor?: string;
  userMenuBorderColor?: string;
  logoutButtonBackgroundColor?: string;
  logoutButtonBorderColor?: string;

  // Shopping Card Colors
  shoppingCardBackgroundColor?: string;
  shoppingCardBorderColor?: string;
}

/**
 * Configuration template for Welcome Modal
 * Maps to ThingsBoard widget settingsSchema.json
 */
interface WelcomeConfigTemplate {
  // Debug
  enableDebugMode?: boolean;

  // Hero Text Content (shared across themes)
  defaultHeroTitle?: string;
  defaultHeroDescription?: string;
  defaultPrimaryLabel?: string;

  // Navigation & Features (shared across themes)
  defaultPrimaryState?: string;
  showUserMenuByDefault?: boolean;
  enableLazyLoading?: boolean;
  lazyLoadRootMargin?: string;

  // Theme-specific settings
  darkMode?: WelcomeThemeConfig;
  lightMode?: WelcomeThemeConfig;
}
```

### WelcomeModalParams

```typescript
interface WelcomeModalParams {
  // ThingsBoard context (optional for navigation)
  ctx?: ThingsboardWidgetContext;

  // Configuration template from ThingsBoard widget settings
  configTemplate?: WelcomeConfigTemplate;

  // Theme Mode (controlled by MAIN component)
  themeMode?: 'dark' | 'light';  // default: 'dark'
  showThemeToggle?: boolean;      // default: true

  // Brand Configuration (override configTemplate)
  logoUrl?: string;
  palette?: Partial<WelcomePalette>;
  backgroundUrl?: string;

  // Hero Content
  heroTitle?: string;
  heroDescription?: string;
  ctaLabel?: string;
  ctaState?: string;

  // User Menu
  showUserMenu?: boolean;  // default: true
  userInfo?: UserInfo;

  // Shopping Cards
  shoppingCards?: ShoppingCard[];
  cardVersion?: 'v1' | 'v2';  // Card style: v1=Original, v2=Metro UI (default: 'v1')

  // Modal Behavior
  closeOnBackdrop?: boolean;   // default: false
  closeOnEscape?: boolean;     // default: true
  closeOnCtaClick?: boolean;   // default: true
  closeOnCardClick?: boolean;  // default: true

  // Callbacks
  onClose?: () => void;
  onCtaClick?: () => void;
  onCardClick?: (card: ShoppingCard) => void;
  onLogout?: () => void;
  onThemeChange?: (newTheme: 'dark' | 'light') => void;
}
```

### WelcomeModalInstance

```typescript
interface WelcomeModalInstance {
  /** Close the modal programmatically */
  close: () => void;
  /** The modal's root DOM element */
  element: HTMLElement;
  /** Register event handlers */
  on: (event: 'close', handler: () => void) => void;
  /** Set the theme mode programmatically (from MAIN component) */
  setThemeMode: (mode: 'dark' | 'light') => void;
  /** Get the current theme mode */
  getThemeMode: () => 'dark' | 'light';
}
```

### ShoppingCard (with Device Counts and Consumption)

```typescript
interface ShoppingCardDeviceCounts {
  energy?: number | null;           // Device count (null = spinner)
  energyConsumption?: number | null; // Total kWh (displays as MWh if >= 1000)
  water?: number | null;            // Device count
  waterConsumption?: number | null;  // Total m³
  temperature?: number | null;      // Device count
  temperatureAvg?: number | null;   // Average °C
}

interface ShoppingCardMetaCounts {
  users?: number;        // Number of users
  alarms?: number;       // Active alarms
  notifications?: number; // Unread notifications
}

interface ShoppingCard {
  title: string;
  subtitle?: string;
  dashboardId: string;
  entityId: string;
  entityType?: string;  // default: 'ASSET'
  bgImageUrl?: string;
  buttonId?: string;
  deviceCounts?: ShoppingCardDeviceCounts;  // Shows: ⚡ 45 (1.2 MWh) 💧 12 (180 m³) 🌡️ 8 (23.5 °C)
  metaCounts?: ShoppingCardMetaCounts;      // Shows: 👥 12 🚨 3 🔔 5
}
```

---

## Card Versions

The Welcome Modal supports two different card styles via the `cardVersion` parameter:

### V1 - Original Style (default)

The original card design with background image, device counts as badges, and meta counts.

```javascript
openWelcomeModal({
  cardVersion: 'v1', // or omit (default)
  shoppingCards: [...],
});
```

**Features:**
- Background image support via `bgImageUrl`
- Device counts displayed as inline badges: `⚡ 45 💧 12 🌡️ 8`
- Consumption values in parentheses: `⚡ 45 (1.2 MWh)`
- Meta counts (users, alarms, notifications) above title
- Hover scale effect (1.03)
- Dark gradient overlay

### V2 - Metro UI Style

Modern flat design with colored tiles in a 2x3 grid layout, inspired by Windows Metro UI.

```javascript
openWelcomeModal({
  cardVersion: 'v2',
  shoppingCards: [...],
});
```

**Features:**
- Flat, square colored tiles in 2x3 grid
- Color-coded categories:
  - Green: Energy (⚡)
  - Blue: Water (💧)
  - Orange: Temperature (🌡️)
  - Purple: Users (👥)
  - Red: Alarms (🚨)
  - Yellow: Notifications (🔔)
- Title bar at top with shopping name
- Each tile clickable independently via `onTileClick`
- Loading spinner support for tiles with `null` values
- Theme support (dark/light)

For detailed documentation on the CustomerCard components, see [RFC-0127: CustomerCard Component](./RFC-0127-CustomerCardComponent.md).

---

## Usage Examples

### Basic Usage

```javascript
import { openWelcomeModal } from 'myio-js-library';

const modal = openWelcomeModal({
  heroTitle: 'Bem-vindo ao MYIO Platform',
  heroDescription: 'Gestão inteligente de energia, água e recursos.',
  ctaLabel: 'ACESSAR PAINEL',
  shoppingCards: [
    {
      title: 'Mestre Álvaro',
      dashboardId: 'dash-1',
      entityId: 'ent-1',
      deviceCounts: { energy: 45, water: 12, temperature: 8 }
    },
  ],
  onCardClick: (card) => console.log('Navigating to:', card.title),
});

// Close programmatically
modal.close();
```

### With Metro UI Cards (V2)

```javascript
import { openWelcomeModal } from 'myio-js-library';

const modal = openWelcomeModal({
  heroTitle: 'Bem-vindo ao MYIO Platform',
  heroDescription: 'Gestão inteligente de energia, água e recursos.',
  ctaLabel: 'ACESSAR PAINEL',
  cardVersion: 'v2', // Metro UI style
  shoppingCards: [
    {
      title: 'Mestre Álvaro',
      dashboardId: 'dash-1',
      entityId: 'ent-1',
      deviceCounts: { energy: 45, water: 12, temperature: 8 },
      metaCounts: { users: 12, alarms: 3, notifications: 5 }
    },
  ],
  onCardClick: (card) => console.log('Card clicked:', card.title),
});
```

### With Theme Support (MAIN Component Integration)

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js
let currentTheme = 'dark';

const modal = openWelcomeModal({
  themeMode: currentTheme,
  showThemeToggle: true,
  configTemplate: {
    defaultHeroTitle: 'MYIO Platform',
    darkMode: {
      backgroundUrl: 'https://example.com/dark-bg.jpg',
      logoUrl: 'https://example.com/logo-white.png',
      primaryColor: '#7A2FF7',
      textColor: '#F5F7FA',
    },
    lightMode: {
      backgroundUrl: 'https://example.com/light-bg.jpg',
      logoUrl: 'https://example.com/logo-dark.png',
      primaryColor: '#7A2FF7',
      textColor: '#1a1a2e',
    },
  },
  onThemeChange: (newTheme) => {
    currentTheme = newTheme;
    // Update global theme state in MAIN
    console.log('Global theme updated to:', newTheme);
  },
  shoppingCards: SHOPPING_CARDS,
});

// External theme control from MAIN
function setGlobalTheme(theme) {
  currentTheme = theme;
  modal.setThemeMode(theme);
}
```

### With Full configTemplate (ThingsBoard Settings)

```javascript
const configTemplate = {
  enableDebugMode: true,
  defaultHeroTitle: 'MYIO Premium Dashboard',
  defaultHeroDescription: 'Acesse todos os recursos premium.',
  defaultPrimaryLabel: 'INICIAR SESSÃO',
  showUserMenuByDefault: true,
  enableLazyLoading: true,

  darkMode: {
    backgroundUrl: 'https://dashboard.myio-bas.com/api/images/public/dark-bg',
    logoUrl: 'https://dashboard.myio-bas.com/api/images/public/logo-white',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    textColor: '#fffbeb',
    mutedTextColor: '#fde68a',
    userMenuBackgroundColor: 'rgba(251, 191, 36, 0.2)',
    shoppingCardBackgroundColor: 'rgba(251, 191, 36, 0.15)',
  },

  lightMode: {
    backgroundUrl: 'https://dashboard.myio-bas.com/api/images/public/light-bg',
    logoUrl: 'https://dashboard.myio-bas.com/api/images/public/logo-dark',
    primaryColor: '#f59e0b',
    secondaryColor: '#d97706',
    textColor: '#78350f',
    mutedTextColor: '#92400e',
    userMenuBackgroundColor: 'rgba(254, 243, 199, 0.9)',
    shoppingCardBackgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
};

const modal = openWelcomeModal({
  configTemplate,
  shoppingCards: SHOPPING_CARDS,
  onThemeChange: (theme) => console.log('Theme:', theme),
});
```

---

## File Structure

```
src/components/premium-modals/welcome/
├── index.ts                    # Public exports
├── openWelcomeModal.ts         # Main entry function
├── WelcomeModalView.ts         # View rendering + styles
└── types.ts                    # TypeScript interfaces
```

## Exports

```typescript
// From src/components/premium-modals/index.ts

export { openWelcomeModal } from './welcome/openWelcomeModal';

export type {
  WelcomeModalParams,
  WelcomeModalInstance,
  WelcomePalette,
  WelcomeConfigTemplate,
  WelcomeThemeConfig,
  WelcomeThemeMode,
  ShoppingCard,
  ShoppingCardDeviceCounts,
  UserInfo,
} from './welcome/types';

export {
  DEFAULT_PALETTE,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_SHOPPING_CARDS,
} from './welcome/types';
```

---

## Theme Toggle Button

The theme toggle button is positioned below the user menu on the right side:

- **Icon**: Sun emoji (☀️) in dark mode, Moon emoji (🌙) in light mode
- **Position**: Absolute, `top: 90px`, `right: 32px` on desktop
- **Responsive**: Adjusts position for tablet and mobile
- **Callback**: Triggers `onThemeChange` with the new theme mode

When clicked:
1. Modal updates its CSS class (`myio-welcome-modal--dark` or `myio-welcome-modal--light`)
2. CSS variables are updated for colors
3. Background image and logo are updated from theme config
4. `onThemeChange` callback is fired

---

## CSS Classes

| Class | Description |
|-------|-------------|
| `.myio-welcome-modal` | Root container |
| `.myio-welcome-modal--dark` | Dark theme modifier |
| `.myio-welcome-modal--light` | Light theme modifier |
| `.myio-welcome-modal-container` | Inner modal (90% viewport) |
| `.myio-welcome-hero` | Hero section with background |
| `.myio-welcome-logo` | Logo container (absolute) |
| `.myio-welcome-user-menu` | User info + logout |
| `.myio-welcome-theme-toggle` | Theme toggle button |
| `.myio-welcome-hero-content` | Title, description, CTA |
| `.myio-welcome-shortcuts` | Shopping cards section |
| `.myio-welcome-card` | Individual shopping card |
| `.myio-welcome-card-device-counts` | Device count badges |

---

## Responsive Breakpoints

| Breakpoint | Modal Size | Grid Layout | Badge min-width |
|------------|------------|-------------|-----------------|
| Desktop (>768px) | 90vw × 90vh | 3 colunas fixas | 52px |
| Tablet (≤768px) | 95vw × 95vh | 3 colunas fixas | 44px |
| Mobile (≤480px) | 100vw × 100vh | 3 colunas fixas | 36px |

---

## Dynamic Layout Algorithm (Rev-003)

O componente implementa um algoritmo de cálculo dinâmico de layout que otimiza o uso do espaço disponível:

### `calculateGridLayout()`

```
Algoritmo:
1. Obter altura do modal container (90vh)
2. Obter altura da hero section
3. Calcular altura disponível = modal - hero
4. Descontar padding (40px) e título (40px)
5. Calcular número de linhas = ceil(cards / 3)
6. Calcular gaps entre linhas = (linhas - 1) * 16px
7. Altura ideal do card = (altura disponível - gaps) / linhas
8. Aplicar constraints: min=100px, max=200px
```

### Características:
- **Resize listener**: Recalcula layout com debounce de 100ms ao redimensionar janela
- **Dynamic update**: Recalcula ao chamar `updateShoppingCards()`
- **Debug mode**: Logs detalhados quando `enableDebugMode: true`
- **Constraints**: Cards nunca menores que 100px ou maiores que 200px

---

## Document History

- 2026-01-02: Initial RFC created from WELCOME widget reverse engineering
- 2026-01-02: Updated with library modal component specification
- 2026-01-02: **Rev-001**: Added theme mode support (dark/light)
- 2026-01-02: Added `configTemplate` structure with `darkMode`/`lightMode`
- 2026-01-02: Added theme toggle button (☀️/🌙)
- 2026-01-02: Added `onThemeChange` callback and `setThemeMode`/`getThemeMode` methods
- 2026-01-02: Added device counts per shopping card
- 2026-01-02: Improved responsive layout for mobile
- 2026-01-04: **Rev-002**: Grid fixo em 3 colunas por linha
- 2026-01-04: Badges de dispositivos com `min-width` uniforme (52px desktop, 44px tablet, 36px mobile)
- 2026-01-04: Badges de meta counts (users, alarms, notifications) com mesmo tratamento
- 2026-01-04: **Rev-003**: Algoritmo de layout dinâmico `calculateGridLayout()`
- 2026-01-04: Altura dos cards calculada automaticamente baseado no espaço disponível
- 2026-01-04: Resize listener com debounce para recalcular em redimensionamento
- 2026-01-04: **Rev-004**: Exibição de consumo/média nos badges
- 2026-01-04: Energy: `⚡ 45 (1.2 MWh)` ou `⚡ 45 (850 kWh)` se < 1000
- 2026-01-04: Water: `💧 12 (180 m³)`
- 2026-01-04: Temperature: `🌡️ 8 (23.5 °C)`
- 2026-01-04: **Rev-005**: Novo layout de card com posicionamento absoluto
- 2026-01-04: Meta counts no TOP, título no CENTER, device counts no BOTTOM
- 2026-01-04: Font size do título aumentado (22px desktop, 16px tablet, 14px mobile)
- 2026-01-04: Padding lateral do grid ajustado (12px desktop, 10px tablet, 8px mobile)
- 2026-01-04: **Rev-006**: Card Version Support (V1/V2)
- 2026-01-04: Added `cardVersion` parameter: `'v1'` (Original) or `'v2'` (Metro UI)
- 2026-01-04: V2 uses CustomerCardV2 component with 2x3 colored tile grid
- 2026-01-04: See RFC-0127 for CustomerCard component details

---

## References

- [RFC-0057 MYIO SIM Welcome](./RFC-0057-MYIO-SIM-Welcome.rev001.md)
- [RFC-0111 Unified Main Single Datasource](./RFC-0111-Unified-Main-Single-Datasource-Architecture.md)
- [RFC-0127 CustomerCard Component](./RFC-0127-CustomerCardComponent.md) - V1 and V2 card implementations
- [Showcase: welcome-modal.html](../../showcase/welcome-modal.html)
- [Showcase: customer-card-v1.html](../../showcase/customer-card-v1.html)
- [Showcase: customer-card-v2.html](../../showcase/customer-card-v2.html)
- [WELCOME Widget Source](../../MYIO-SIM/v5.2.0/WELCOME/)
