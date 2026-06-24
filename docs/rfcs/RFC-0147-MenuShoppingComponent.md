# RFC-0147: MenuShopping Component

- **Feature Name**: MenuShopping Component
- **Start Date**: 2026-01-13
- **RFC PR**: N/A
- **Status**: Draft

## Summary

This RFC describes the migration of the Shopping MENU widget (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU`) to a reusable library component exported from `src/index.ts`. The component provides navigation between domains (Energy, Water, Temperature), user info display, and admin controls.

## Motivation

The current Shopping MENU widget:
- Requires ThingsBoard widget lifecycle management
- Uses Angular syntax (`*ngFor`, `(click)`, `[class.active]`)
- Fetches user info via ThingsBoard API (`/api/auth/user`)
- Cannot be easily tested in isolation

Benefits of component migration:
- Direct instantiation without widget overhead
- Method-based API for navigation and state changes
- Better testability with showcase
- Consistent with other Shopping components
- Mock user data for testing

## Guide-level Explanation

### Architecture

```
MAIN_VIEW_SHOPPING (orchestrator)
├── HeaderShopping Component
├── MenuShopping Component (createMenuShoppingComponent) <-- THIS RFC
├── TelemetryGridShopping Component
└── FooterShopping Component
```

### Basic Usage

```typescript
import { createMenuShoppingComponent } from 'myio-js-library';

const menu = createMenuShoppingComponent({
  container: document.getElementById('menuContainer'),
  themeMode: 'dark',

  // Menu links configuration
  links: [
    { content: 'Energia', stateId: 'telemetry_content', icon: '⚡' },
    { content: 'Água', stateId: 'water_content', icon: '💧' },
    { content: 'Temperatura', stateId: 'temperature_content', icon: '🌡️' },
  ],

  // User info (optional - can be fetched or provided)
  user: {
    name: 'João Silva',
    email: 'joao@example.com',
    isAdmin: true,
  },

  // Current shopping name (for admin selector button)
  currentShoppingName: 'Shopping Center Norte',

  // Callbacks
  onDomainChange: (domain, stateId) => {
    console.log(`Domain changed to: ${domain}`);
    // Notify orchestrator
  },

  onLogout: () => {
    console.log('Logout clicked');
    // Handle logout
  },

  onShoppingChange: () => {
    console.log('Shopping selector clicked');
    // Show shopping modal
  },

  onSettingsClick: () => {
    console.log('Settings clicked');
    // Show settings modal
  },

  onMenuToggle: (collapsed) => {
    console.log(`Menu ${collapsed ? 'collapsed' : 'expanded'}`);
  },
});

// Set active domain
menu.setActiveDomain('energy');

// Update user info
menu.setUser({ name: 'Maria', email: 'maria@example.com', isAdmin: false });

// Update current shopping name
menu.setCurrentShopping('Shopping Iguatemi');

// Set theme mode
menu.setThemeMode('light');

// Toggle collapsed state
menu.toggleCollapsed();

// Cleanup
menu.destroy();
```

## Reference-level Explanation

### Component Structure

```
src/components/menu-shopping/
├── index.ts                         # Exports
├── types.ts                         # TypeScript interfaces
├── styles.ts                        # Embedded CSS styles
├── MenuShoppingController.ts        # Business logic
├── MenuShoppingView.ts              # DOM rendering
└── createMenuShoppingComponent.ts   # Factory function
```

### Types

```typescript
// Menu link configuration
interface MenuLink {
  content: string;     // Display text
  stateId: string;     // ThingsBoard state ID
  icon?: string;       // Emoji or icon
  enabled?: boolean;   // Is link enabled
}

// User info
interface UserInfo {
  name: string;
  email?: string;
  isAdmin?: boolean;
  authority?: string;  // 'TENANT_ADMIN', 'CUSTOMER_USER', etc.
}

// Domain type
type MenuDomain = 'energy' | 'water' | 'temperature' | null;

// State ID to domain mapping
const DOMAIN_BY_STATE: Record<string, MenuDomain> = {
  'telemetry_content': 'energy',
  'water_content': 'water',
  'temperature_content': 'temperature',
  'alarm_content': null,
};

// Component params
interface MenuShoppingParams {
  container: HTMLElement;
  themeMode?: 'dark' | 'light';
  debugActive?: boolean;

  // Links configuration
  links?: MenuLink[];
  initialActiveIndex?: number;

  // User info
  user?: UserInfo;
  fetchUserInfo?: boolean;  // Auto-fetch from API

  // Shopping
  currentShoppingName?: string;
  showShoppingSelector?: boolean;
  showSettingsButton?: boolean;

  // Callbacks
  onDomainChange?: (domain: MenuDomain, stateId: string, index: number) => void;
  onLogout?: () => void;
  onShoppingChange?: () => void;
  onSettingsClick?: () => void;
  onMenuToggle?: (collapsed: boolean) => void;
}

// Component instance
interface MenuShoppingInstance {
  element: HTMLElement;

  // Domain
  setActiveDomain: (domain: MenuDomain) => void;
  setActiveByIndex: (index: number) => void;
  getActiveDomain: () => MenuDomain;

  // User
  setUser: (user: UserInfo) => void;
  getUser: () => UserInfo | null;

  // Shopping
  setCurrentShopping: (name: string) => void;

  // State
  toggleCollapsed: () => void;
  isCollapsed: () => boolean;
  setThemeMode: (mode: 'dark' | 'light') => void;

  // Cleanup
  destroy: () => void;
}
```

### UI Elements

| Element | Description |
|---------|-------------|
| User Info | Name and email display |
| Theme Icon | Current theme indicator (☀️/🌙) |
| Hamburger Button | Toggle collapsed state |
| Menu Links | Navigation items (Energy, Water, etc.) |
| Shopping Selector | Button to change shopping (admin only) |
| Settings Button | Button to open settings (admin only) |
| Logout Button | Exit application |
| Version Display | Library version (via LibraryVersionChecker) |

### Menu Link Icons

| stateId | Domain | Icon |
|---------|--------|------|
| telemetry_content | energy | ⚡ |
| water_content | water | 💧 |
| temperature_content | temperature | 🌡️ |
| alarm_content | null | 🔔 |

### Event Flow

```
User clicks menu item
    └── onDomainChange(domain, stateId, index)
    └── Emit 'myio:dashboard-state' { tab: domain }

User clicks hamburger
    └── toggleCollapsed()
    └── onMenuToggle(collapsed)
    └── Emit 'myio:menu-toggle' { collapsed }

User clicks Shopping Selector
    └── onShoppingChange()
    └── (Parent shows shopping modal)

User clicks Settings
    └── onSettingsClick()
    └── (Parent shows settings modal)

User clicks Logout
    └── onLogout()
    └── (Parent handles logout)
```

### Migration from Widget Files

| Widget File | Component File | Description |
|-------------|----------------|-------------|
| `template.html` | `MenuShoppingView.ts` | HTML generation via TypeScript |
| `styles.css` | `styles.ts` | CSS as embedded string constant |
| `controller.js` | `MenuShoppingController.ts` | Business logic |
| `settingsSchema.json` | `types.ts` | Settings as TypeScript interface |

### Collapsed State

When collapsed:
- Menu width reduces to ~60px
- Text labels hidden
- Only icons visible
- Shopping selector shows only icon
- Logout shows only icon

## Showcase

### Location

```
showcase/menu-shopping/
├── index.html
├── start-server.bat
├── start-server.sh
├── stop-server.bat
└── stop-server.sh
```

### Running the Showcase

```batch
cd showcase\menu-shopping
start-server.bat
```

Server runs on port **3336**.

### Showcase Features

- Menu links navigation with active state
- User info display with mock data
- Admin/non-admin toggle (shows/hides buttons)
- Collapsed/expanded toggle
- Light/dark theme toggle
- Shopping selector button (admin only)
- Settings button (admin only)
- Logout button
- Event log panel

## Drawbacks

- Requires logout logic to be provided by parent
- Shopping modal not included (separate component)
- User info fetch requires API access

## Rationale and Alternatives

### Why separate from RFC-0114?

RFC-0114 (MenuComponent) is for HeadOffice which has a different navigation pattern (shopping list filter modal). Shopping MENU has domain tabs and admin controls.

### Alternatives considered

1. **Extend RFC-0114**: Different UI requirements - rejected
2. **Keep widget**: Testing difficulty - rejected

## Prior Art

- RFC-0114: MenuComponent (HeadOffice version)
- RFC-0145: TelemetryGridShopping Component
- RFC-0146: HeaderShopping Component

## Implementation Checklist

- [ ] Create `src/components/menu-shopping/` directory structure
- [ ] Create `types.ts` with TypeScript interfaces
- [ ] Create `styles.ts` with embedded CSS
- [ ] Create `MenuShoppingView.ts`
- [ ] Create `MenuShoppingController.ts`
- [ ] Create `createMenuShoppingComponent.ts` factory function
- [ ] Create `index.ts` exports
- [ ] Export from `src/index.ts`
- [ ] Create `showcase/menu-shopping/` with scripts
- [ ] Test with mock data
- [ ] Integrate with `showcase/main-view-shopping/`

## Future Possibilities

1. **Keyboard navigation**: Arrow keys, Enter to select
2. **Badge counts**: Show notification counts on menu items
3. **Customizable icons**: Allow SVG icons instead of emojis
4. **Drag to resize**: Allow user to resize menu width
