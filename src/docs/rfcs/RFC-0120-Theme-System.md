# RFC-0120: Unified Theme System

- **Status**: Implemented
- **Created**: 2026-01-03
- **Author**: Claude Code
- **Related**: RFC-0111, RFC-0112, RFC-0113, RFC-0114, RFC-0115

## Summary

This RFC documents the unified theme system for the MYIO dashboard, ensuring consistent dark/light mode propagation across all widgets and components.

## Motivation

The dashboard consists of multiple widgets (MAIN, TELEMETRY) and library components (Header, Menu, Footer, Welcome Modal, Filter Modal, Panels). Each needs to reflect the user's theme preference consistently. Without a centralized theme system, components may display with mismatched themes.

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN_UNIQUE_DATASOURCE                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  settings.defaultThemeMode ('light' | 'dark')           │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  currentThemeMode (local state)                         │    │
│  │  window.MyIOUtils.currentThemeMode (global state)       │    │
│  │  #mainUniqueWrap[data-theme] (DOM state)                │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Header    │    │    Menu     │    │   Footer    │         │
│  │  Component  │    │  Component  │    │  Component  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Welcome   │    │   Filter    │    │   Panels    │         │
│  │    Modal    │    │    Modal    │    │ (E/W/T)     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    TELEMETRY Widget                      │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  #telemetryWrap[data-theme]                     │    │    │
│  │  │  - buildHeaderDevicesGrid (inherits from wrap)  │    │    │
│  │  │  - Device Cards (inherits from wrap)            │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Theme Sources

1. **Settings Schema** (`settingsSchema.json`)
   ```json
   {
     "defaultThemeMode": {
       "title": "Default Theme Mode",
       "type": "string",
       "enum": ["dark", "light"],
       "default": "light"
     }
   }
   ```

2. **Global State** (`window.MyIOUtils`)
   ```javascript
   window.MyIOUtils = {
     currentThemeMode: 'dark',
     getThemeMode: () => currentThemeMode,
     // ... other utilities
   };
   ```

3. **DOM Attribute** (`data-theme`)
   ```html
   <div id="mainUniqueWrap" data-theme="dark">
   <div id="telemetryWrap" data-theme="dark">
   ```

### Theme Change Flow

```
User Action (Welcome/Menu)
         │
         ▼
  onThemeChange callback
         │
         ├──► Update currentThemeMode (local)
         │
         ├──► Update window.MyIOUtils.currentThemeMode (global)
         │
         ├──► Update #mainUniqueWrap[data-theme] (DOM)
         │
         ├──► Dispatch 'myio:theme-change' event
         │
         └──► Call setThemeMode() on all components:
              - headerInstance.setThemeMode(theme)
              - menuInstance.setThemeMode(theme)
              - footerInstance.setThemeMode(theme)
              - welcomeModal.setThemeMode(theme)
```

### Event-Based Propagation

The `myio:theme-change` custom event propagates theme changes to components that listen for it:

```javascript
// Dispatching (from MAIN or components)
window.dispatchEvent(new CustomEvent('myio:theme-change', {
  detail: { themeMode: 'dark' }
}));

// Listening (TELEMETRY widget)
window.addEventListener('myio:theme-change', (e) => {
  const themeMode = e.detail?.themeMode;
  if (themeMode) {
    applyThemeMode(themeMode);
  }
});
```

## Implementation

### MAIN Controller (`controller.js`)

1. **Initialization**
   ```javascript
   // Read from settings
   let currentThemeMode = settings.defaultThemeMode || 'dark';

   // Expose on MyIOUtils
   window.MyIOUtils = {
     currentThemeMode: currentThemeMode,
     getThemeMode: () => currentThemeMode,
     // ...
   };

   // Apply to DOM
   const mainWrap = document.getElementById('mainUniqueWrap');
   if (mainWrap) {
     mainWrap.setAttribute('data-theme', currentThemeMode);
   }
   ```

2. **Component Creation** (pass theme to each)
   ```javascript
   const welcomeModal = MyIOLibrary.openWelcomeModal({
     themeMode: currentThemeMode,
     onThemeChange: (newTheme) => {
       currentThemeMode = newTheme;
       applyGlobalTheme(newTheme);
       // Update all components...
     },
   });

   const headerInstance = MyIOLibrary.createHeaderComponent({
     themeMode: currentThemeMode,
   });

   // Similar for Menu, Footer, Panels...
   ```

3. **Global Theme Change Handler**
   ```javascript
   window.addEventListener('myio:theme-change', (e) => {
     const themeMode = e.detail?.themeMode;
     if (!themeMode) return;

     currentThemeMode = themeMode;

     // Sync to MyIOUtils
     if (window.MyIOUtils) {
       window.MyIOUtils.currentThemeMode = themeMode;
     }

     // Apply to DOM
     const wrap = document.getElementById('mainUniqueWrap');
     if (wrap) {
       wrap.setAttribute('data-theme', themeMode);
     }

     // Update all components
     if (headerInstance) headerInstance.setThemeMode?.(themeMode);
     if (menuInstance) menuInstance.setThemeMode?.(themeMode);
     if (footerInstance) footerInstance.setThemeMode?.(themeMode);
     if (welcomeModal) welcomeModal.setThemeMode?.(themeMode);
   });
   ```

### TELEMETRY Widget (`controller.js`)

1. **Initialization** (read from MyIOUtils)
   ```javascript
   // Apply initial theme from MAIN's defaultThemeMode setting
   const initialTheme = window.MyIOUtils?.currentThemeMode
     || window.MyIOUtils?.getThemeMode?.()
     || 'dark';
   applyThemeMode(initialTheme);
   ```

2. **Event Listener** (respond to changes)
   ```javascript
   window.addEventListener('myio:theme-change', (ev) => {
     const themeMode = ev.detail?.themeMode;
     if (themeMode) {
       applyThemeMode(themeMode);
     }
   });
   ```

### Filter Modal (`createFilterModal`)

1. **Read theme when opening**
   ```javascript
   open(items) {
     // Get current theme from mainUniqueWrap
     const currentTheme = document.getElementById('mainUniqueWrap')
       ?.getAttribute('data-theme') || 'light';

     // Apply to modal container
     globalContainer.setAttribute('data-theme', currentTheme);
   }
   ```

2. **CSS uses `[data-theme="dark"]` selector**
   ```css
   #${containerId}[data-theme="dark"] .${modalClass}-card {
     background: #1e293b;
   }
   ```

### CSS Theme Variables

Components use CSS custom properties that change based on `data-theme`:

```css
.component {
  /* Light mode defaults */
  --bg-color: #ffffff;
  --text-color: #1f2937;
  --border-color: #e5e7eb;
}

[data-theme="dark"] .component {
  --bg-color: #1e293b;
  --text-color: #f3f4f6;
  --border-color: #374151;
}
```

## Component Contract

Each library component that supports theming MUST:

1. Accept `themeMode` parameter in constructor/factory
2. Implement `setThemeMode(mode: 'light' | 'dark')` method
3. Use `data-theme` attribute on root element for CSS styling
4. Respond to `myio:theme-change` events (if not managed by MAIN)

## Testing Checklist

- [ ] Default theme from settings is applied on page load
- [ ] Welcome Modal shows correct theme on open
- [ ] Theme toggle in Welcome Modal updates all components
- [ ] Theme toggle in Menu updates all components
- [ ] TELEMETRY widget reflects theme on init
- [ ] TELEMETRY widget updates when theme changes
- [ ] Filter Modal shows correct theme when opened
- [ ] buildHeaderDevicesGrid inherits theme from parent
- [ ] Panel modals (Energy/Water/Temperature) show correct theme

## Backward Compatibility

This system is backward compatible. Components that don't implement `setThemeMode()` will simply not update dynamically but will still receive the initial theme via constructor params.

## Future Considerations

1. **User Preference Persistence**: Store theme preference in localStorage or user profile
2. **System Theme Detection**: Respect `prefers-color-scheme` media query
3. **Transition Animations**: Add smooth transitions when theme changes

## References

- RFC-0111: Unified Main Single Datasource Architecture
- RFC-0112: Welcome Modal Head Office
- RFC-0113: Header Component
- RFC-0114: Menu Component
- RFC-0115: Footer Component
