# RFC-0152 Phase 2: Menu Column & Navigation

## Status: ✅ IMPLEMENTED

## Summary

Add a fourth menu column "Indicadores Operacionais" alongside Energy, Water, and Temperature columns. This column only appears when the gating check from Phase 1 passes.

---

## Implementation

### Files Modified

| File | Changes |
|------|---------|
| `src/components/menu/types.ts` | Added `OPERATIONAL_INDICATORS_TAB` constant |
| `src/components/menu/MenuView.ts` | Added event listener, rebuild logic, CSS for 4 columns |

---

## Code Changes

### 1. Tab Configuration (`types.ts`)

**Location**: After `DEFAULT_TABS` constant

```typescript
/**
 * RFC-0152: Operational Indicators Tab Configuration
 * Conditionally shown based on customer attribute 'show-indicators-operational-panels'
 */
export const OPERATIONAL_INDICATORS_TAB: TabConfig = {
  id: 'operational',
  label: 'Indicadores Operacionais',
  icon: '📊',
  contexts: [
    {
      id: 'general-list',
      target: 'operational_general_list',
      title: 'Lista Geral',
      description: 'Visao geral dos equipamentos operacionais',
      icon: '📋',
    },
    {
      id: 'alarms',
      target: 'operational_alarms',
      title: 'Alarmes e Notificacoes',
      description: 'Central de alarmes e alertas',
      icon: '🔔',
    },
    {
      id: 'dashboard',
      target: 'operational_dashboard',
      title: 'Dashboard Gerencial',
      description: 'KPIs e indicadores de gestao',
      icon: '📈',
    },
  ],
  defaultContext: 'general-list',
};
```

---

### 2. State Variables (`MenuView.ts`)

**Location**: After other private state variables

```typescript
// RFC-0152: Operational Indicators tab state
private operationalTabEnabled = false;
private operationalAccessHandler: ((ev: Event) => void) | null = null;
```

---

### 3. Event Listener in `bindEvents()` (`MenuView.ts`)

**Location**: End of `bindEvents()` method

```typescript
// ==========================================
// RFC-0152: Operational Indicators Access
// ==========================================
this.operationalAccessHandler = (ev: Event) => {
  const customEv = ev as CustomEvent<{ enabled: boolean }>;
  const enabled = customEv.detail?.enabled === true;

  if (this.configTemplate.enableDebugMode) {
    console.log('[MenuView] RFC-0152: Operational indicators access event received:', enabled);
  }

  if (enabled && !this.operationalTabEnabled) {
    this.operationalTabEnabled = true;
    // Add operational tab to tabs array
    if (!this.tabs.find((t) => t.id === 'operational')) {
      this.tabs = [...this.tabs, OPERATIONAL_INDICATORS_TAB];
      // Initialize context for the new tab
      this.contextsByTab.set(
        OPERATIONAL_INDICATORS_TAB.id,
        OPERATIONAL_INDICATORS_TAB.defaultContext ?? OPERATIONAL_INDICATORS_TAB.contexts[0]?.id ?? ''
      );
    }
    // Rebuild the unified modal to include the 4th column
    this.rebuildUnifiedModal();
  }
};
window.addEventListener('myio:operational-indicators-access', this.operationalAccessHandler);

// Check if operational indicators is already enabled (e.g., from cached state)
const myioUtils = (window as Window & { MyIOUtils?: { operationalIndicators?: { enabled: boolean } } })
  .MyIOUtils;
if (myioUtils?.operationalIndicators?.enabled) {
  this.operationalAccessHandler(
    new CustomEvent('myio:operational-indicators-access', {
      detail: { enabled: true },
    })
  );
}
```

---

### 4. Methods Added (`MenuView.ts`)

#### `rebuildUnifiedModal()`

```typescript
/**
 * RFC-0152: Rebuild the unified modal to include/exclude operational indicators column
 */
private rebuildUnifiedModal(): void {
  const existingModal = this.root.querySelector('#menuUnifiedContextModal');
  if (!existingModal) return;

  // Close the modal first if it's open
  this.closeUnifiedModal();

  // Clear the header controller to force re-initialization
  this.unifiedModalHeaderController = null;

  // Generate new modal HTML
  const newModalHTML = this.buildUnifiedContextModalHTML();

  // Create a temporary container to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = newModalHTML;
  const newModal = tempDiv.firstElementChild as HTMLElement;

  if (newModal) {
    // Replace the existing modal
    existingModal.replaceWith(newModal);

    // Re-bind events for the new modal
    this.rebindUnifiedModalEvents();

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] RFC-0152: Unified modal rebuilt with', this.tabs.length, 'columns');
    }
  }
}
```

#### `rebindUnifiedModalEvents()`

```typescript
/**
 * RFC-0152: Re-bind event listeners for the unified modal after rebuild
 */
private rebindUnifiedModalEvents(): void {
  // Unified modal backdrop click - close
  const unifiedModal = this.root.querySelector('#menuUnifiedContextModal');
  if (unifiedModal) {
    unifiedModal.addEventListener('click', (e) => {
      if (e.target === unifiedModal) {
        this.closeUnifiedModal();
      }
    });
  }

  // Unified option clicks
  this.root.querySelectorAll('.myio-unified-option').forEach((option) => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = option as HTMLElement;
      const tabId = el.dataset.tabId!;
      const contextId = el.dataset.contextId!;
      const target = el.dataset.target!;
      this.handleUnifiedOptionSelect(tabId, contextId, target);
    });
  });
}
```

---

### 5. Cleanup in `destroy()` (`MenuView.ts`)

```typescript
// RFC-0152: Cleanup operational indicators event listener
if (this.operationalAccessHandler) {
  window.removeEventListener('myio:operational-indicators-access', this.operationalAccessHandler);
  this.operationalAccessHandler = null;
}
```

---

### 6. CSS for 4-Column Layout (`MenuView.ts`)

**Location**: In `getStyles()` method, after temperature column styles

```css
/* RFC-0152: Operational Indicators Column Styling */
.myio-unified-column.operational .myio-unified-column-header {
  background: linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%);
}

.myio-unified-option.operational:hover {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
}

.myio-unified-option.operational.is-active {
  background: rgba(139, 92, 246, 0.12);
  border-color: #8b5cf6;
}

.myio-unified-option.operational .option-check {
  color: #8b5cf6;
}

/* RFC-0152: 4-column layout when operational tab is enabled */
.myio-unified-modal-body.four-columns {
  min-width: 900px;
}

.myio-unified-modal-body.four-columns .myio-unified-column {
  min-width: 220px;
}

/* Responsive - 4 columns to 2x2 grid */
@media (max-width: 900px) {
  .myio-unified-modal-body.four-columns {
    flex-wrap: wrap;
    min-width: auto;
  }

  .myio-unified-modal-body.four-columns .myio-unified-column {
    flex: 1 1 calc(50% - 1px);
    min-width: 200px;
    border-bottom: 1px solid var(--menu-modal-border, #e2e8f0);
  }
}

/* Responsive - Stack all columns */
@media (max-width: 700px) {
  .myio-unified-modal-body.four-columns {
    flex-wrap: nowrap;
  }

  .myio-unified-modal-body.four-columns .myio-unified-column {
    flex: none;
    width: 100%;
  }
}
```

---

### 7. Header Color for Operational Column

**Location**: In `buildUnifiedColumnHTML()` method

```typescript
// Define header background colors per domain
// RFC-0152: Added operational indicators column color
const headerColors: Record<string, string> = {
  energy: 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)',      // Orange
  water: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',       // Blue
  temperature: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', // Red
  operational: 'linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%)', // Purple
};
```

---

## Navigation Events

When user selects an operational context:

| Event | Detail |
|-------|--------|
| `context-change` | `{ tabId: 'operational', contextId: string, target: string }` |
| `tab-change` | `{ tabId: 'operational', contextId: string, target: string }` |

### Target State IDs

| Context | Target State ID |
|---------|-----------------|
| Lista Geral | `operational_general_list` |
| Alarmes e Notificações | `operational_alarms` |
| Dashboard Gerencial | `operational_dashboard` |

---

## Visual Reference

### Menu Modal with 4 Columns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 Selecione a visualização                              [🌙] [🗖] [✕]      │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────┤
│ ⚡ Energia      │ 💧 Água         │ 🌡️ Temperatura  │ 📊 Ind. Operacionais│
│ (orange bg)     │ (blue bg)       │ (red bg)        │ (purple bg)         │
├─────────────────┼─────────────────┼─────────────────┼─────────────────────┤
│ ⚙️ Equipamentos │ 🏢 Área Comum   │ ❄️ Climatizáveis│ 📋 Lista Geral      │
│ 🏬 Lojas        │ 🏬 Lojas        │ ☀️ Não Climat.  │ 🔔 Alarmes          │
│ ⚡ Geral        │ 📊 Resumo       │ 📊 Resumo Geral │ 📈 Dashboard        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────┘
```

---

## Testing Checklist

- [ ] Enable `show-indicators-operational-panels` attribute
  - [ ] Verify 4th column appears in menu modal
  - [ ] Verify purple gradient on column header
  - [ ] Verify 3 context options are visible

- [ ] Click "Lista Geral"
  - [ ] Verify `context-change` event with `target: 'operational_general_list'`
  - [ ] Verify modal closes

- [ ] Click "Alarmes e Notificações"
  - [ ] Verify `context-change` event with `target: 'operational_alarms'`

- [ ] Click "Dashboard Gerencial"
  - [ ] Verify `context-change` event with `target: 'operational_dashboard'`

- [ ] Disable attribute (or use customer without it)
  - [ ] Verify 4th column is NOT visible
  - [ ] Verify only 3 columns show

- [ ] Test responsive layout
  - [ ] 900px+ → 4 columns side by side
  - [ ] 700-900px → 2x2 grid
  - [ ] <700px → stacked vertically

---

## Dependencies

- **Phase 1**: Must be implemented first (provides the `myio:operational-indicators-access` event)

---

## Rollback

To rollback this phase:

1. Remove `OPERATIONAL_INDICATORS_TAB` from `types.ts`
2. Remove state variables from `MenuView.ts`
3. Remove event listener code from `bindEvents()`
4. Remove `rebuildUnifiedModal()` and `rebindUnifiedModalEvents()` methods
5. Remove cleanup code from `destroy()`
6. Remove CSS for 4-column layout
7. Remove `operational` entry from `headerColors`
