# RFC-0173: Premium Sidebar Menu Component

## Status
**Draft** | Created: 2026-02-11

## Summary

Create a premium, retractable sidebar menu component for the BAS (Building Automation System) dashboard. The component will provide navigation, filtering, and quick actions with a collapsible design that maximizes screen real estate.

## Motivation

The MAIN_BAS dashboard needs a sophisticated navigation system that:
- Provides quick access to different sections (Ambientes, Devices, Charts, Settings)
- Supports filtering and search across the dashboard
- Offers a premium look and feel consistent with the MYIO design language
- Can be collapsed/expanded to maximize workspace when needed
- Works seamlessly on both desktop and tablet devices

## Detailed Design

### Component Structure

```
src/components/sidebar-menu/
├── index.ts                    # Exports
├── types.ts                    # TypeScript interfaces
├── styles.ts                   # CSS-in-JS styles
├── SidebarMenuView.ts          # DOM rendering
├── SidebarMenuController.ts    # State management & logic
└── icons.ts                    # SVG icons for menu items
```

### TypeScript Interfaces

```typescript
// types.ts

export type SidebarThemeMode = 'light' | 'dark';
export type SidebarState = 'expanded' | 'collapsed';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: string;           // SVG string or emoji
  badge?: number | string; // Optional badge (e.g., count)
  disabled?: boolean;
  children?: SidebarMenuItem[]; // Sub-menu items
}

export interface SidebarMenuSection {
  id: string;
  title?: string;         // Optional section header
  items: SidebarMenuItem[];
  collapsible?: boolean;
}

export interface SidebarMenuConfig {
  /** Theme mode */
  themeMode?: SidebarThemeMode;
  /** Initial state */
  initialState?: SidebarState;
  /** Width when expanded (default: 280px) */
  expandedWidth?: string;
  /** Width when collapsed (default: 64px) */
  collapsedWidth?: string;
  /** Menu sections */
  sections: SidebarMenuSection[];
  /** Header configuration */
  header?: {
    logo?: string;        // Logo URL or SVG
    title?: string;       // App title
    subtitle?: string;    // Optional subtitle
  };
  /** Footer configuration */
  footer?: {
    items?: SidebarMenuItem[];
    showVersion?: boolean;
    version?: string;
  };
  /** Callbacks */
  onItemClick?: (item: SidebarMenuItem, section: SidebarMenuSection) => void;
  onStateChange?: (state: SidebarState) => void;
  onSearch?: (query: string) => void;
  /** Show search bar */
  showSearch?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Persist state in localStorage */
  persistState?: boolean;
  /** localStorage key for state */
  storageKey?: string;
}

export interface SidebarMenuInstance {
  /** Get the root DOM element */
  getElement(): HTMLElement;
  /** Expand the sidebar */
  expand(): void;
  /** Collapse the sidebar */
  collapse(): void;
  /** Toggle expanded/collapsed state */
  toggle(): void;
  /** Get current state */
  getState(): SidebarState;
  /** Set theme mode */
  setThemeMode(mode: SidebarThemeMode): void;
  /** Update menu sections */
  updateSections(sections: SidebarMenuSection[]): void;
  /** Update item badge */
  updateItemBadge(itemId: string, badge: number | string | null): void;
  /** Set active item */
  setActiveItem(itemId: string): void;
  /** Destroy and cleanup */
  destroy(): void;
}
```

### Visual Design

#### Expanded State (280px)
```
┌─────────────────────────────┐
│ [Logo]  MYIO BAS        [<] │  ← Header with collapse button
├─────────────────────────────┤
│ [🔍] Search...              │  ← Search bar
├─────────────────────────────┤
│ NAVEGAÇÃO                   │  ← Section header
│ ├─ [🏠] Dashboard           │
│ ├─ [🏢] Ambientes      (12) │  ← Item with badge
│ ├─ [💧] Água            (5) │
│ ├─ [⚡] Energia         (8) │
│ └─ [❄️] Climatização    (3) │
├─────────────────────────────┤
│ CONFIGURAÇÕES               │
│ ├─ [⚙️] Settings            │
│ └─ [👤] Perfil              │
├─────────────────────────────┤
│ [?] Ajuda    v0.1.374       │  ← Footer
└─────────────────────────────┘
```

#### Collapsed State (64px)
```
┌────┐
│[>] │  ← Expand button
├────┤
│[🔍]│  ← Search icon only
├────┤
│[🏠]│
│[🏢]│ (12)
│[💧]│ (5)
│[⚡]│ (8)
│[❄️]│ (3)
├────┤
│[⚙️]│
│[👤]│
├────┤
│[?] │
└────┘
```

### CSS Variables

```css
:root {
  /* Dimensions */
  --sidebar-expanded-width: 280px;
  --sidebar-collapsed-width: 64px;
  --sidebar-transition-duration: 0.3s;

  /* Light Theme */
  --sidebar-bg: #ffffff;
  --sidebar-border-color: #e5e7eb;
  --sidebar-header-bg: linear-gradient(135deg, #2F5848 0%, #3d7a62 100%);
  --sidebar-header-color: #ffffff;
  --sidebar-item-color: #374151;
  --sidebar-item-hover-bg: #f3f4f6;
  --sidebar-item-active-bg: #e8f5e9;
  --sidebar-item-active-color: #2F5848;
  --sidebar-section-title-color: #9ca3af;
  --sidebar-badge-bg: #2F5848;
  --sidebar-badge-color: #ffffff;
  --sidebar-search-bg: #f9fafb;
  --sidebar-search-border: #e5e7eb;

  /* Dark Theme */
  --sidebar-dark-bg: #1f2937;
  --sidebar-dark-border-color: #374151;
  --sidebar-dark-header-bg: linear-gradient(135deg, #1a3a2e 0%, #2F5848 100%);
  --sidebar-dark-item-color: #e5e7eb;
  --sidebar-dark-item-hover-bg: #374151;
  --sidebar-dark-item-active-bg: #2F5848;
  --sidebar-dark-item-active-color: #ffffff;
  --sidebar-dark-section-title-color: #6b7280;
  --sidebar-dark-search-bg: #374151;
  --sidebar-dark-search-border: #4b5563;
}
```

### Animation & Transitions

1. **Collapse/Expand Animation**
   - Smooth width transition (0.3s ease)
   - Labels fade out before width shrinks
   - Icons remain centered during transition

2. **Hover Effects**
   - Subtle background color change
   - Icon scale effect (1.05x)
   - Tooltip appears in collapsed state

3. **Active State**
   - Left border indicator (3px)
   - Background highlight
   - Icon color change

### Integration with MAIN_BAS

#### template.html
```html
<div id="bas-root" class="bas-dashboard">
  <div id="bas-sidebar-menu-host"></div>
  <div id="bas-main-content">
    <!-- Existing dashboard content -->
  </div>
</div>
```

#### styles.css
```css
.bas-dashboard {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

#bas-sidebar-menu-host {
  flex-shrink: 0;
  height: 100%;
  z-index: 100;
}

#bas-main-content {
  flex: 1;
  overflow: auto;
  transition: margin-left var(--sidebar-transition-duration) ease;
}

/* Adjust content when sidebar is collapsed */
.bas-dashboard.sidebar-collapsed #bas-main-content {
  margin-left: 0;
}
```

#### controller.js
```javascript
// Module-level reference
let _sidebarMenu = null;

function mountSidebarMenu(host, settings) {
  if (!MyIOLibrary.createSidebarMenu) {
    LogHelper.warn('[MAIN_BAS] SidebarMenu not available');
    return null;
  }

  _sidebarMenu = MyIOLibrary.createSidebarMenu(host, {
    themeMode: settings.themeMode || 'light',
    initialState: settings.sidebarInitialState || 'expanded',
    persistState: true,
    storageKey: 'myio-bas-sidebar-state',
    showSearch: true,
    searchPlaceholder: 'Buscar...',
    header: {
      logo: settings.logoUrl || null,
      title: 'MYIO BAS',
      subtitle: settings.customerName || '',
    },
    sections: [
      {
        id: 'navigation',
        title: 'Navegação',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
          { id: 'ambientes', label: 'Ambientes', icon: '🏢', badge: _ambientesCount },
          { id: 'water', label: 'Água', icon: '💧', badge: _waterDevicesCount },
          { id: 'energy', label: 'Energia', icon: '⚡', badge: _energyDevicesCount },
          { id: 'hvac', label: 'Climatização', icon: '❄️', badge: _hvacDevicesCount },
        ],
      },
      {
        id: 'config',
        title: 'Configurações',
        items: [
          { id: 'settings', label: 'Configurações', icon: '⚙️' },
          { id: 'profile', label: 'Perfil', icon: '👤' },
        ],
      },
    ],
    footer: {
      items: [{ id: 'help', label: 'Ajuda', icon: '❓' }],
      showVersion: true,
      version: '0.1.374',
    },
    onItemClick: function(item, section) {
      LogHelper.log('[MAIN_BAS] Sidebar item clicked:', item.id);
      handleSidebarNavigation(item.id);
    },
    onStateChange: function(state) {
      LogHelper.log('[MAIN_BAS] Sidebar state changed:', state);
      document.querySelector('.bas-dashboard')?.classList.toggle('sidebar-collapsed', state === 'collapsed');
    },
    onSearch: function(query) {
      LogHelper.log('[MAIN_BAS] Sidebar search:', query);
      handleGlobalSearch(query);
    },
  });

  return _sidebarMenu;
}

function handleSidebarNavigation(itemId) {
  switch (itemId) {
    case 'dashboard':
      scrollToSection('bas-overview');
      break;
    case 'ambientes':
      scrollToSection('bas-sidebar-host');
      _ambientesListPanel?.focus?.();
      break;
    case 'water':
      scrollToSection('bas-water-host');
      break;
    case 'energy':
      scrollToSection('bas-motors-host');
      break;
    case 'hvac':
      scrollToSection('bas-ambientes-host');
      break;
    case 'settings':
      openSettingsModal();
      break;
    case 'profile':
      openProfileModal();
      break;
    case 'help':
      openHelpModal();
      break;
  }
}
```

### Library Export (index.ts)

```typescript
// RFC-0173: Premium Sidebar Menu Component
export { createSidebarMenu, SidebarMenuController, SidebarMenuView } from './components/sidebar-menu';

export type {
  SidebarThemeMode,
  SidebarState,
  SidebarMenuItem,
  SidebarMenuSection,
  SidebarMenuConfig,
  SidebarMenuInstance,
} from './components/sidebar-menu';

export {
  SIDEBAR_MENU_CSS_PREFIX,
  injectSidebarMenuStyles,
} from './components/sidebar-menu';
```

### Accessibility

1. **Keyboard Navigation**
   - `Tab` to navigate between items
   - `Enter`/`Space` to activate item
   - `Escape` to collapse sidebar
   - `Arrow Up/Down` to navigate within section

2. **ARIA Attributes**
   - `role="navigation"` on sidebar
   - `role="menu"` on item lists
   - `role="menuitem"` on items
   - `aria-expanded` for collapse state
   - `aria-current="page"` for active item

3. **Screen Reader Support**
   - Descriptive labels for icons
   - Badge counts announced
   - State changes announced

### Mobile/Responsive Behavior

- On screens < 768px: sidebar becomes an overlay
- Swipe gesture to open/close
- Backdrop overlay when open on mobile
- Auto-collapse when item selected on mobile

## Implementation Plan

1. **Phase 1: Core Component**
   - Create types.ts with interfaces
   - Implement styles.ts with CSS injection
   - Build SidebarMenuView.ts for rendering
   - Create SidebarMenuController.ts for state

2. **Phase 2: Features**
   - Add search functionality
   - Implement badge updates
   - Add keyboard navigation
   - Implement localStorage persistence

3. **Phase 3: Integration**
   - Export from index.ts
   - Update MAIN_BAS template.html
   - Add styles.css adjustments
   - Integrate in controller.js

4. **Phase 4: Polish**
   - Add animations
   - Mobile responsive behavior
   - Accessibility audit
   - Documentation

## Files to Create/Modify

### New Files
- `src/components/sidebar-menu/index.ts`
- `src/components/sidebar-menu/types.ts`
- `src/components/sidebar-menu/styles.ts`
- `src/components/sidebar-menu/SidebarMenuView.ts`
- `src/components/sidebar-menu/SidebarMenuController.ts`
- `src/components/sidebar-menu/icons.ts`

### Modified Files
- `src/index.ts` - Add exports
- `src/thingsboard/bas-components/MAIN_BAS/template.html` - Add host element
- `src/thingsboard/bas-components/MAIN_BAS/styles.css` - Add layout styles
- `src/thingsboard/bas-components/MAIN_BAS/controller.js` - Mount sidebar

## References

- RFC-0128: Energy Equipment Subcategorization (category patterns)
- RFC-0167: On/Off Device Modal (modal patterns)
- RFC-0170: Ambiente Group Modal (styling patterns)
- Material Design Navigation Rail guidelines
- Apple Human Interface Guidelines - Sidebars

## Open Questions

1. Should the sidebar support drag-to-resize?
2. Should there be a "pin" option to prevent auto-collapse?
3. Should sub-menus expand inline or as flyouts?
4. What animations are appropriate for mobile overlay?
