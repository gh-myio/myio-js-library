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

### 6. Device Domain & Context Classification (RFC-0111)

Three domains with their contexts:

| Domain | Contexts | Classification |
|--------|----------|----------------|
| **energy** | `equipments`, `stores`, `entrada` | deviceType/Profile = 3F_MEDIDOR or ENTRADA/RELOGIO/TRAFO/SUBESTACAO |
| **water** | `hidrometro_entrada`, `banheiros`, `hidrometro_area_comum`, `hidrometro` | deviceType includes HIDROMETRO |
| **temperature** | `termostato`, `termostato_external` | deviceType includes TERMOSTATO |

```javascript
import { detectDomain, detectContext, detectDomainAndContext } from 'myio-js-library';

const { domain, context } = detectDomainAndContext(device);
// domain: 'energy' | 'water' | 'temperature'
// context: 'equipments' | 'stores' | 'entrada' | 'hidrometro' | etc.
```

### 7. Energy Equipment Subcategorization (RFC-0128)

Detailed equipment classification for energy domain:

| Category | Classification Rule | Icon |
|----------|---------------------|------|
| **Entrada** | deviceType/Profile contains ENTRADA, RELOGIO, TRAFO, SUBESTACAO | 📥 |
| **Lojas** | deviceType = deviceProfile = '3F_MEDIDOR' (exact match) | 🏬 |
| **Climatizacao** | CHILLER, FANCOIL, HVAC, AR_CONDICIONADO, BOMBA_CAG, or identifier contains CAG | ❄️ |
| **Elevadores** | ELEVADOR or identifier starts with ELV- | 🛗 |
| **Escadas Rolantes** | ESCADA_ROLANTE or identifier starts with ESC- | 🎢 |
| **Outros** | Remaining 3F_MEDIDOR equipment | ⚙️ |
| **Area Comum** | Calculated: Entrada - (Lojas + Climatizacao + Elevadores + Esc. Rolantes + Outros) | 🏢 |

```javascript
import {
  classifyEquipment,
  buildEquipmentCategorySummary,
  buildEquipmentCategoryDataForTooltip,
  EquipmentCategory
} from 'myio-js-library';

// Classify single device
const category = classifyEquipment(device); // 'climatizacao', 'lojas', etc.

// Build summary for tooltip
const summary = buildEquipmentCategorySummary(devices);
// { entrada: { count, consumption, percentage, subcategories }, ... }

// Get tooltip-ready data
const categories = buildEquipmentCategoryDataForTooltip(devices);
// [{ id, name, icon, deviceCount, consumption, percentage, children }, ...]
```

**Subcategories:**
- **Climatizacao**: Chillers, Fancoils, CAG, Bombas Hidraulicas, Outros HVAC
- **Outros**: Iluminacao, Bombas de Incendio, Geradores/Nobreaks, Geral

### 8. Device Annotation Schema

Annotations are stored per device with full audit trail:

```json
{
  "schemaVersion": "1.0.0",
  "deviceId": "48bf3660-9011-11f0-a06d-e9509531b1d5",
  "lastModified": "2026-01-29T18:15:54.029Z",
  "lastModifiedBy": {
    "id": "37e6b1e0-1fb6-11f0-9baa-8137e6ac9d72",
    "email": "user@example.com",
    "name": "User Name"
  },
  "annotations": [
    {
      "id": "c56d772c-075d-4f3c-b0d7-9f24540f627b",
      "version": 2,
      "text": "Annotation text",
      "type": "observation",
      "importance": 3,
      "status": "created",
      "createdAt": "2026-01-29T18:14:42.554Z",
      "createdBy": { "id": "...", "email": "...", "name": "..." },
      "acknowledged": true,
      "acknowledgedBy": { "id": "...", "email": "...", "name": "..." },
      "acknowledgedAt": "2026-01-29T18:15:54.028Z",
      "responses": [
        {
          "id": "cee5d426-1160-48e2-a22e-438793b832ce",
          "annotationId": "c56d772c-075d-4f3c-b0d7-9f24540f627b",
          "type": "approved",
          "text": "",
          "createdAt": "2026-01-29T18:15:54.028Z",
          "createdBy": { "id": "...", "email": "...", "name": "..." }
        }
      ],
      "history": [
        {
          "timestamp": "2026-01-29T18:14:42.554Z",
          "userId": "...",
          "userName": "User Name",
          "userEmail": "user@example.com",
          "action": "created"
        },
        {
          "timestamp": "2026-01-29T18:15:54.028Z",
          "userId": "...",
          "userName": "User Name",
          "userEmail": "user@example.com",
          "action": "approved",
          "previousVersion": 1
        }
      ]
    }
  ]
}
```

**Annotation Types**: `observation`, `issue`, `maintenance`, `alert`
**Response Types**: `approved`, `rejected`, `comment`, `resolved`
**Actions in History**: `created`, `approved`, `rejected`, `edited`, `deleted`, `archived`

**Business Rules**:
- Annotations with status `approved` or `rejected` can always be archived
- Archived annotations are removed from active view but preserved in history

## Key Files

| File | Description |
|------|-------------|
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Main widget controller (new architecture) |
| `src/components/menu/MenuView.ts` | Menu component with filter modal |
| `src/components/header/createHeaderComponent.ts` | Header KPI cards (moved from premium-modals per RFC-0128) |
| `src/components/premium-modals/welcome/WelcomeModalView.ts` | Welcome modal |
| `src/utils/deviceInfo.js` | Domain/context detection (RFC-0111) |
| `src/utils/equipmentCategory.js` | Energy equipment subcategorization (RFC-0128) |
| `src/components/premium-modals/settings/annotations/AnnotationsTab.ts` | Device annotations component |

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
  - RFC-0111: Unified device domain/context classification
  - RFC-0112: WelcomeModalHeadOffice
  - RFC-0126: MenuShoppingFilterSync (timing issues)
  - RFC-0127: CustomerCardComponent
  - RFC-0128: Energy equipment subcategorization

## Current Version

- Version: 0.1.301
- Main branch: `main`
