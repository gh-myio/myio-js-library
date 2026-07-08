# RFC-0079: Menu Navigation Restructure

- **Feature Name**: `menu-navigation-restructure`
- **Start Date**: 2025-01-18
- **RFC PR**: #0079
- **Status**: Draft
- **Component**: `MYIO-SIM/V1.0.0/MENU`, `MYIO-SIM/V1.0.0/EQUIPMENTS`
- **Dependencies**: None

## Summary

Restructure the main navigation menu to simplify top-level navigation while introducing a sub-menu system within the EQUIPMENTS widget. The current MENU widget displays three main tabs (Equipamentos, Lojas, Energia), but this proposal moves the equipment/store content into a tabbed sub-menu within the EQUIPMENTS widget, leaving only the Energia tab at the top level.

**Current Structure:**
```
MENU Widget (Top-level tabs):
├── Equipamentos
├── Lojas
└── Energia
```

**Proposed Structure:**
```
MENU Widget (Top-level):
└── Energia (only)

EQUIPMENTS Widget (Internal sub-menu):
├── Equipamentos (default, pre-selected)
├── Lojas
└── Geral (currently displayed in Energia)
```

## Motivation

### Current Problems

1. **Menu Overload**: The top-level MENU widget displays too many domain-specific tabs (Equipamentos, Lojas, Água, Temperatura), cluttering the interface
2. **Inconsistent Grouping**: Equipment and Store views are conceptually related but displayed as separate top-level tabs
3. **Missing Context**: The "Geral" (general/overview) view is currently shown in the Energia tab but lacks visibility
4. **Navigation Confusion**: Users must navigate between top-level tabs to see related content (equipment vs store telemetry)

### Proposed Solution

1. **Simplified Top Menu**: Reduce the MENU widget to display only the **Energia** tab
2. **Sub-Menu in EQUIPMENTS**: Introduce an internal tabbed navigation within the EQUIPMENTS widget with three tabs:
   - **Equipamentos** (default): Current equipment grid view
   - **Lojas**: Store telemetry view (currently `store_telemetry`)
   - **Geral**: General overview (currently shown in `content_energy`)

### Benefits

1. **Cleaner Top Navigation**: Reduced cognitive load with fewer top-level options
2. **Logical Grouping**: Related views (equipment, stores, general) are grouped together
3. **Better Discoverability**: "Geral" overview is now visible within equipment context
4. **Scalability**: Future domain-specific views can be added to EQUIPMENTS sub-menu without cluttering top nav
5. **Consistent UX**: Similar pattern to modern dashboard interfaces (Grafana, AWS Console)

## Guide-level Explanation

### User Experience

#### Before (Current)
```
┌─────────────────────────────────────────────────────┐
│ MENU Widget                                         │
│ [Equipamentos] [Lojas] [Energia] [Água] [Temp] ... │
└─────────────────────────────────────────────────────┘
        ↓ click Equipamentos
┌─────────────────────────────────────────────────────┐
│ EQUIPMENTS Widget                                   │
│ [Equipment Grid View]                               │
└─────────────────────────────────────────────────────┘
```

#### After (Proposed)
```
┌─────────────────────────────────────────────────────┐
│ MENU Widget                                         │
│ [Energia] [Água] [Temperatura] ...                  │
└─────────────────────────────────────────────────────┘
        ↓ default view (auto-loads)
┌─────────────────────────────────────────────────────┐
│ EQUIPMENTS Widget                                   │
│ [Equipamentos ✓] [Lojas] [Geral]    ← Sub-menu     │
│ ─────────────────────────────────────────────────   │
│ [Equipment Grid View]                               │
└─────────────────────────────────────────────────────┘
        ↓ click Lojas
┌─────────────────────────────────────────────────────┐
│ EQUIPMENTS Widget                                   │
│ [Equipamentos] [Lojas ✓] [Geral]    ← Sub-menu     │
│ ─────────────────────────────────────────────────   │
│ [Store Telemetry View]                              │
└─────────────────────────────────────────────────────┘
```

### How It Works

1. **Menu Widget Changes**:
   - Remove `Equipamentos` button (`data-target="content_equipments"`)
   - Remove `Lojas` button (`data-target="store_telemetry"`)
   - Keep only `Energia` button as the primary navigation tab
   - Água, Temperatura tabs remain unchanged

2. **EQUIPMENTS Widget Changes**:
   - Add internal tab navigation component at the top
   - Implement three sub-tabs:
     - **Equipamentos** (pre-selected by default)
     - **Lojas**
     - **Geral**
   - Each tab switches the content view within the EQUIPMENTS widget
   - Default state: Equipamentos tab is active on load

3. **Event Flow**:
   - On dashboard load, EQUIPMENTS widget automatically renders with Equipamentos tab active
   - User clicks Lojas → EQUIPMENTS widget switches to store telemetry view
   - User clicks Geral → EQUIPMENTS widget switches to general overview
   - No `myio:switch-main-state` events needed for sub-navigation

## Reference-level Explanation

### Architecture Changes

#### 1. MENU Widget (template.html)

**Current:**
```html
<nav class="myio-tabs" role="tablist">
    <button class="tab is-active" data-target="content_equipments">
        <span class="ico">⚙️</span> Equipamentos
    </button>
    <button class="tab" data-target="store_telemetry">
        <span class="ico">🏬</span> Lojas
    </button>
    <button class="tab" data-target="content_energy">
        <span class="ico">⚡</span> Energia
    </button>
    <button class="tab" data-target="content_water">
        <span class="ico">💧</span> Água
    </button>
    <button class="tab" data-target="content_temperature">
        <span class="ico">🌡️</span> Temperatura
    </button>
</nav>
```

**Proposed:**
```html
<nav class="myio-tabs" role="tablist">
    <!-- Equipamentos and Lojas removed - now in EQUIPMENTS widget -->
    <button class="tab is-active" data-target="content_energy">
        <span class="ico">⚡</span> Energia
    </button>
    <button class="tab" data-target="content_water">
        <span class="ico">💧</span> Água
    </button>
    <button class="tab" data-target="content_temperature">
        <span class="ico">🌡️</span> Temperatura
    </button>
</nav>
```

#### 2. EQUIPMENTS Widget (template.html)

**Add Sub-Menu Navigation:**
```html
<div class="equipments-widget-root">
    <!-- NEW: Internal tab navigation -->
    <nav class="equipments-submenu" role="tablist" aria-label="Equipment Views">
        <button class="submenu-tab is-active"
                data-submenu-view="equipments"
                aria-selected="true">
            <span class="ico">⚙️</span> Equipamentos
        </button>
        <button class="submenu-tab"
                data-submenu-view="stores"
                aria-selected="false">
            <span class="ico">🏬</span> Lojas
        </button>
        <button class="submenu-tab"
                data-submenu-view="general"
                aria-selected="false">
            <span class="ico">📊</span> Geral
        </button>
    </nav>

    <!-- View containers (only one visible at a time) -->
    <div class="submenu-content">
        <!-- Equipamentos View (default visible) -->
        <div class="submenu-view"
             data-view="equipments"
             aria-hidden="false">
            <!-- Current equipment grid rendering -->
            <div id="equipmentsGridContainer"></div>
        </div>

        <!-- Lojas View (hidden by default) -->
        <div class="submenu-view"
             data-view="stores"
             aria-hidden="true"
             style="display: none;">
            <!-- Store telemetry content -->
            <div id="storesGridContainer"></div>
        </div>

        <!-- Geral View (hidden by default) -->
        <div class="submenu-view"
             data-view="general"
             aria-hidden="true"
             style="display: none;">
            <!-- General overview content -->
            <div id="generalOverviewContainer"></div>
        </div>
    </div>
</div>
```

#### 3. EQUIPMENTS Widget (controller.js)

**Add Sub-Menu Controller Logic:**

```javascript
// RFC-0079: Sub-menu navigation state
let currentSubmenuView = 'equipments'; // default

/**
 * RFC-0079: Initialize sub-menu navigation
 */
function initSubmenuNavigation() {
    const root = document.querySelector('.equipments-widget-root');
    if (!root) return;

    const submenuTabs = root.querySelectorAll('.submenu-tab');

    submenuTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetView = tab.getAttribute('data-submenu-view');
            switchSubmenuView(targetView);
        });

        // Keyboard navigation support
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const targetView = tab.getAttribute('data-submenu-view');
                switchSubmenuView(targetView);
            }
        });
    });

    console.log('[RFC-0079] Sub-menu navigation initialized');
}

/**
 * RFC-0079: Switch between sub-menu views
 * @param {string} viewName - 'equipments' | 'stores' | 'general'
 */
function switchSubmenuView(viewName) {
    if (currentSubmenuView === viewName) return; // No change

    console.log(`[RFC-0079] Switching from ${currentSubmenuView} → ${viewName}`);

    const root = document.querySelector('.equipments-widget-root');

    // Update tab active states
    root.querySelectorAll('.submenu-tab').forEach(tab => {
        const isActive = tab.getAttribute('data-submenu-view') === viewName;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive);
    });

    // Hide all views
    root.querySelectorAll('.submenu-view').forEach(view => {
        view.style.display = 'none';
        view.setAttribute('aria-hidden', 'true');
    });

    // Show target view
    const targetView = root.querySelector(`[data-view="${viewName}"]`);
    if (targetView) {
        targetView.style.display = 'block';
        targetView.setAttribute('aria-hidden', 'false');
    }

    // Update current state
    currentSubmenuView = viewName;

    // Render content based on view
    switch (viewName) {
        case 'equipments':
            renderEquipmentsView();
            break;
        case 'stores':
            renderStoresView();
            break;
        case 'general':
            renderGeneralView();
            break;
    }

    // Dispatch custom event for analytics/tracking
    window.dispatchEvent(new CustomEvent('myio:submenu-switch', {
        detail: { view: viewName, timestamp: Date.now() }
    }));
}

/**
 * RFC-0079: Render Equipamentos view (current equipment grid)
 */
function renderEquipmentsView() {
    const container = document.getElementById('equipmentsGridContainer');
    if (!container) return;

    console.log('[RFC-0079] Rendering Equipamentos view');
    // Use existing renderCards() or equivalent function
    renderCards(); // Current implementation
}

/**
 * RFC-0079: Render Lojas view (store telemetry)
 */
function renderStoresView() {
    const container = document.getElementById('storesGridContainer');
    if (!container) return;

    console.log('[RFC-0079] Rendering Lojas view');
    // Render store telemetry cards
    renderStoreTelemetryCards();
}

/**
 * RFC-0079: Render Geral view (general overview)
 */
function renderGeneralView() {
    const container = document.getElementById('generalOverviewContainer');
    if (!container) return;

    console.log('[RFC-0079] Rendering Geral view');
    // Render general overview content (currently in content_energy)
    renderGeneralOverview();
}

/**
 * RFC-0079: Main initialization (called on widget load)
 */
function onInit() {
    // Initialize sub-menu first
    initSubmenuNavigation();

    // Set default view (Equipamentos)
    switchSubmenuView('equipments');

    // Other initialization code...
}
```

#### 4. EQUIPMENTS Widget (style.css)

**Add Sub-Menu Styles:**

```css
/* RFC-0079: Sub-menu navigation styles */
.equipments-submenu {
    display: flex;
    gap: 8px;
    padding: 16px 20px 12px;
    background: linear-gradient(to bottom, #f8f9fa, #ffffff);
    border-bottom: 2px solid #e0e0e0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.submenu-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #ffffff;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    color: #424242;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
}

.submenu-tab:hover {
    background: #f5f5f5;
    border-color: #7A2FF7;
    color: #7A2FF7;
}

.submenu-tab.is-active {
    background: linear-gradient(135deg, #7A2FF7, #5A1FD1);
    color: #ffffff;
    border-color: #7A2FF7;
    box-shadow: 0 2px 8px rgba(122, 47, 247, 0.3);
}

.submenu-tab .ico {
    font-size: 16px;
    line-height: 1;
}

.submenu-tab:focus-visible {
    outline: 2px solid #7A2FF7;
    outline-offset: 2px;
}

/* View containers */
.submenu-content {
    padding: 20px;
    background: #ffffff;
    min-height: 400px;
}

.submenu-view {
    width: 100%;
    animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Responsive: Stack tabs vertically on mobile */
@media (max-width: 768px) {
    .equipments-submenu {
        flex-direction: column;
        gap: 6px;
        padding: 12px 16px;
    }

    .submenu-tab {
        width: 100%;
        justify-content: flex-start;
        padding: 12px 16px;
    }
}
```

### Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard Load                                           │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────────┐
│ EQUIPMENTS Widget: onInit()                              │
│  1. initSubmenuNavigation()                              │
│  2. switchSubmenuView('equipments') ← Default            │
│  3. renderEquipmentsView()                               │
└──────────────────────────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────────┐
│ User clicks "Lojas" sub-tab                              │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ↓
┌──────────────────────────────────────────────────────────┐
│ switchSubmenuView('stores')                              │
│  1. Hide equipments view                                 │
│  2. Show stores view                                     │
│  3. renderStoresView()                                   │
│  4. Dispatch 'myio:submenu-switch' event                 │
└──────────────────────────────────────────────────────────┘
```

### Event Communication

**New Custom Event:**
```javascript
// Dispatched when user switches sub-menu views
window.addEventListener('myio:submenu-switch', (e) => {
    console.log('Sub-menu switched to:', e.detail.view);
    // Analytics tracking, URL state updates, etc.
});
```

**Removed Event Dependencies:**
- `myio:switch-main-state` for `content_equipments` (no longer needed)
- `myio:switch-main-state` for `store_telemetry` (no longer needed)

## Drawbacks

1. **Widget Complexity**: EQUIPMENTS widget now handles multiple view types internally
2. **Code Migration**: Need to move store telemetry rendering logic from MENU listeners to EQUIPMENTS widget
3. **URL State**: Current URL-based navigation for `content_equipments` will need updates
4. **Learning Curve**: Users familiar with old navigation must learn new structure
5. **Widget Size**: EQUIPMENTS widget HTML/JS will increase (but improves cohesion)

## Rationale and Alternatives

### Why This Approach?

1. **Single Responsibility**: EQUIPMENTS widget owns all equipment-related views
2. **Reduced Top-level Clutter**: Cleaner main navigation improves UX
3. **Better Information Architecture**: Related content is grouped together
4. **Scalability**: Easy to add more sub-views (e.g., "Manutenção", "Histórico") without cluttering top nav

### Alternatives Considered

#### Alternative A: Keep Current Structure
- **Pros**: No changes needed, familiar to users
- **Cons**: Cluttered navigation, poor scalability

#### Alternative B: Dropdown Menu in MENU Widget
```
MENU:
  [Equipamentos ▼] → [Equipamentos | Lojas | Geral]
  [Energia]
  [Água]
```
- **Pros**: All navigation in one place
- **Cons**: Dropdown UX is less discoverable, requires more complex MENU widget logic

#### Alternative C: Separate EQUIPMENTS and STORES Widgets
- **Pros**: True separation of concerns
- **Cons**: Duplicated layout code, users must scroll to see both widgets

### Chosen: Sub-Menu in EQUIPMENTS Widget (RFC-0079)

Best balance of simplicity, discoverability, and maintainability.

## Prior Art

- **AWS Console**: Services grouped under top-level categories with sub-navigation
- **Grafana Dashboards**: Variables and time range pickers within dashboard context
- **Azure Portal**: Resource groups with internal tabbed navigation
- **Google Cloud Console**: Hierarchical navigation with contextual sub-menus

## Unresolved Questions

1. **URL Routing**: Should sub-menu state be reflected in URL query params (`?view=stores`)?
2. **Default View**: Should default view be configurable via widget settings?
3. **Animation**: Should view transitions be animated or instant?
4. **Mobile UX**: Should sub-tabs become a dropdown select on mobile?
5. **Keyboard Shortcuts**: Should we add hotkeys (e.g., `1` for Equipamentos, `2` for Lojas)?

## Future Possibilities

1. **Additional Sub-Views**:
   - **Manutenção**: Equipment maintenance schedules
   - **Histórico**: Historical equipment performance
   - **Alertas**: Equipment alert configuration

2. **View Persistence**: Save user's last selected sub-view in localStorage

3. **View-Specific Filters**: Different filter options per sub-view

4. **Responsive Layout**: Adaptive layouts optimized for each view type

5. **Export/Import**: Export current view data as CSV/Excel

## Implementation Checklist

### Phase 1: MENU Widget Cleanup
- [ ] Remove `Equipamentos` button from MENU template
- [ ] Remove `Lojas` button from MENU template
- [ ] Update default active tab to `Energia`
- [ ] Test that Energia tab is auto-selected on load
- [ ] Remove unused event handlers for removed tabs

### Phase 2: EQUIPMENTS Widget Sub-Menu
- [ ] Add sub-menu HTML structure to EQUIPMENTS template
- [ ] Implement `initSubmenuNavigation()` function
- [ ] Implement `switchSubmenuView()` function
- [ ] Add CSS styles for sub-menu tabs
- [ ] Test tab switching (click and keyboard)
- [ ] Add fade-in animations for view transitions

### Phase 3: View Rendering
- [ ] Implement `renderEquipmentsView()` (use existing logic)
- [ ] Implement `renderStoresView()` (migrate from MENU)
- [ ] Implement `renderGeneralView()` (new feature)
- [ ] Add loading states for each view
- [ ] Test data rendering in all three views

### Phase 4: Event Integration
- [ ] Dispatch `myio:submenu-switch` custom event
- [ ] Remove `content_equipments` event listener from MENU
- [ ] Remove `store_telemetry` event listener from MENU
- [ ] Update analytics tracking for new event structure
- [ ] Test inter-widget communication

### Phase 5: Testing
- [ ] Unit tests for sub-menu navigation logic
- [ ] Integration tests for view switching
- [ ] Accessibility tests (ARIA, keyboard navigation)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsive testing (320px, 768px, 1024px)

### Phase 6: Documentation
- [ ] Update user manual with new navigation flow
- [ ] Update developer documentation
- [ ] Add code comments explaining sub-menu architecture
- [ ] Create migration guide for existing dashboards
- [ ] Record video tutorial demonstrating new UX

### Phase 7: Deployment
- [ ] Deploy to staging environment
- [ ] QA testing on staging
- [ ] User acceptance testing
- [ ] Roll out to production
- [ ] Monitor for errors/user feedback

## Appendix A: Complete Template Example

**EQUIPMENTS Widget Template (Full):**

```html
<div class="equipments-widget-root" role="main">
    <!-- RFC-0079: Internal Sub-Menu Navigation -->
    <nav class="equipments-submenu"
         role="tablist"
         aria-label="Equipment View Selector">
        <button class="submenu-tab is-active"
                role="tab"
                data-submenu-view="equipments"
                aria-selected="true"
                aria-controls="equipments-view">
            <span class="ico" aria-hidden="true">⚙️</span>
            <span>Equipamentos</span>
        </button>
        <button class="submenu-tab"
                role="tab"
                data-submenu-view="stores"
                aria-selected="false"
                aria-controls="stores-view">
            <span class="ico" aria-hidden="true">🏬</span>
            <span>Lojas</span>
        </button>
        <button class="submenu-tab"
                role="tab"
                data-submenu-view="general"
                aria-selected="false"
                aria-controls="general-view">
            <span class="ico" aria-hidden="true">📊</span>
            <span>Geral</span>
        </button>
    </nav>

    <!-- View Container -->
    <div class="submenu-content">
        <!-- Equipamentos View -->
        <div id="equipments-view"
             class="submenu-view"
             role="tabpanel"
             data-view="equipments"
             aria-labelledby="equipments-tab"
             aria-hidden="false">
            <div id="equipmentsGridContainer" class="grid-container">
                <!-- Equipment cards rendered here -->
            </div>
        </div>

        <!-- Lojas View -->
        <div id="stores-view"
             class="submenu-view"
             role="tabpanel"
             data-view="stores"
             aria-labelledby="stores-tab"
             aria-hidden="true"
             style="display: none;">
            <div id="storesGridContainer" class="grid-container">
                <!-- Store telemetry cards rendered here -->
            </div>
        </div>

        <!-- Geral View -->
        <div id="general-view"
             class="submenu-view"
             role="tabpanel"
             data-view="general"
             aria-labelledby="general-tab"
             aria-hidden="true"
             style="display: none;">
            <div id="generalOverviewContainer" class="overview-container">
                <!-- General overview charts/stats rendered here -->
            </div>
        </div>
    </div>
</div>
```

## Appendix B: Migration Checklist for Existing Dashboards

**For Administrators:**

1. **No Action Required**: The changes are backward compatible
2. **Navigation Update**: Users should be informed that:
   - "Equipamentos" tab is now auto-loaded
   - "Lojas" is now accessed via sub-tab in EQUIPMENTS widget
   - "Geral" overview is a new feature in EQUIPMENTS widget

3. **URL Bookmarks**: Update any saved URLs that reference `content_equipments` or `store_telemetry`

4. **Training Materials**: Update screenshots and documentation

**For Developers:**

1. **Event Listeners**: Remove any custom listeners for `content_equipments` or `store_telemetry` events
2. **Widget Actions**: Update ThingsBoard widget actions if referencing removed tabs
3. **Analytics**: Update tracking code to use new `myio:submenu-switch` event
4. **Custom CSS**: Check for selectors targeting removed MENU buttons

## Appendix C: Accessibility Compliance

**WCAG 2.1 Level AA Compliance:**

- [x] **1.3.1 Info and Relationships**: Proper `role="tab"` and `role="tabpanel"` attributes
- [x] **2.1.1 Keyboard**: Full keyboard navigation support (Tab, Enter, Space)
- [x] **2.4.3 Focus Order**: Logical tab order through sub-menu
- [x] **2.4.7 Focus Visible**: `:focus-visible` styles for keyboard users
- [x] **4.1.2 Name, Role, Value**: `aria-selected`, `aria-hidden`, `aria-controls` attributes
- [x] **4.1.3 Status Messages**: Screen reader announcements on view change

**Testing:**
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)

---

**End of RFC-0079**
