# MYIO JS Library - Project Context

## Overview

This is the MYIO JavaScript library (`myio-js-library`) - a component library for ThingsBoard dashboards used in shopping mall energy, water, and temperature monitoring.

## Project Structure

```
src/
├── components/                    # Reusable UI components
│   ├── menu/                      # MenuView.ts - Navigation and filter modal
│   ├── premium-modals/
│   │   ├── header/                # HeaderComponent - KPI cards with tooltips
│   │   ├── welcome/               # WelcomeModal - Landing page for Head Office
│   │   └── settings/              # SettingsModal
│   ├── telemetry-grid/            # TelemetryGridComponent - Device cards grid
│   ├── customer-card-v1/          # Original customer card style
│   └── customer-card-v2/          # Metro UI customer card style
├── MYIO-SIM/v5.2.0/               # ThingsBoard widget controllers
│   ├── MAIN_UNIQUE_DATASOURCE/    # New unified datasource controller
│   ├── MAIN/                      # Legacy main controller
│   ├── HEADER/                    # Legacy header widget
│   ├── MENU/                      # Legacy menu widget
│   └── ...
├── docs/rfcs/                     # RFC documentation
└── index.ts                       # Library exports
```

## Build Commands

```bash
npm run build           # Full build (clean + tsup + umd + minify)
npm run build:tsup      # ESM/CJS build only
npm run build:umd       # UMD bundle only
npm version patch       # Bump version
npm publish             # Publish to npm
```

## Key Patterns

### 1. ThingsBoard Widget Lifecycle

- `onInit()` - Called once when widget loads (async operations here)
- `onDataUpdated()` - Called when datasource data changes (can run DURING onInit awaits!)

**Critical**: `onDataUpdated` fires while `onInit` is still executing async operations. Solution: Register event handlers at module scope BEFORE async operations.

### 2. Module-Level Caching Pattern (RFC-0126)

```javascript
// Module-level variables for timing issues
let _cachedShoppings = [];
let _cachedClassified = null;
let _menuInstanceRef = null;
let _headerInstanceRef = null;

// Register handlers IMMEDIATELY at module scope
window.addEventListener('myio:data-ready', (e) => {
  if (e.detail?.shoppings) _cachedShoppings = e.detail.shoppings;
  if (e.detail?.classified) _cachedClassified = e.detail.classified;
  // Update components if they exist
  if (_menuInstanceRef) _menuInstanceRef.updateShoppings?.(_cachedShoppings);
});
```

### 3. Event-Driven Architecture

Key events dispatched by MAIN_UNIQUE_DATASOURCE:

| Event | Purpose |
|-------|---------|
| `myio:data-ready` | Raw classified data available |
| `myio:energy-summary-ready` | Energy KPIs with `byStatus`, `byCategory` |
| `myio:water-summary-ready` | Water KPIs with `byStatus`, `byCategory` |
| `myio:temperature-data-ready` | Temperature data with devices array |
| `myio:equipment-count-updated` | Equipment counts |
| `myio:customers-ready` | Shopping list available |
| `myio:filter-applied` | User applied filter |

### 4. ModalHeader Button Fallback Pattern

`ModalHeader.createController` uses `document.getElementById()` which fails in shadow DOM. Solution: Direct button binding via `this.root.querySelector()`:

```typescript
private bindUnifiedModalButtonsFallback(): void {
  const closeBtn = this.root.querySelector('#menuUnified-close');
  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeUnifiedModal();
    });
  }
  // Same for maximize and theme buttons...
}
```

### 5. Device Status Classification

Status values from `calculateDeviceStatusMasterRules`:

```javascript
const ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
const OFFLINE_STATUSES = ['offline', 'no_info'];
const WAITING_STATUSES = ['waiting', 'aguardando', 'not_installed', 'pending', 'connecting'];
const WEAK_STATUSES = ['weak_connection', 'conexao_fraca', 'bad'];
```

## Key Files

| File | Description |
|------|-------------|
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Main widget controller (new architecture) |
| `src/components/menu/MenuView.ts` | Menu component with filter modal |
| `src/components/premium-modals/header/createHeaderComponent.ts` | Header KPI cards |
| `src/components/premium-modals/welcome/WelcomeModalView.ts` | Welcome modal |

## Common Issues & Solutions

### Issue: Components show zeros/empty data
**Cause**: `onDataUpdated` fired before component was created
**Solution**: Cache data at module level, check cache after component creation

### Issue: Modal buttons don't work
**Cause**: `ModalHeader.createController` uses `document.getElementById()`
**Solution**: Implement `bind*ButtonsFallback()` with `this.root.querySelector()`

### Issue: Tooltips show all status as "normal"
**Cause**: Status data hardcoded instead of calculated
**Solution**: Use `buildTooltipStatusData()` or `buildByStatusFromDevices()` functions

### Issue: Shoppings list empty in menu
**Cause**: Event handler registered after event was dispatched
**Solution**: Register handler at module scope before any async operations

## Testing

- Showcase files in `showcase/` directory (e.g., `welcome-modal.html`, `menu-component.html`)
- Open with `start "" "path/to/showcase/file.html"` after starting local server

## Documentation

- RFCs in `src/docs/rfcs/`
- Key RFCs:
  - RFC-0112: WelcomeModalHeadOffice
  - RFC-0126: MenuShoppingFilterSync (timing issues)
  - RFC-0127: CustomerCardComponent

## Current Version

- Version: 0.1.301
- Main branch: `main`
