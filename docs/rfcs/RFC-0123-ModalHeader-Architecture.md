# RFC-0123: ModalHeader Architecture and Usage Guidelines

- **Feature Name**: `modal_header_architecture`
- **Start Date**: 2026-01-04
- **RFC PR**: N/A
- **Status**: Implemented

## Summary

This RFC documents the two ModalHeader implementations in the library, their differences, use cases, and guidelines for choosing the appropriate one for different modal types.

## Motivation

During the development of premium modals, two ModalHeader implementations emerged to address different requirements:

1. **Simple modals** (filters, settings, configurations) need basic header functionality
2. **Data modals** (charts, reports) need export capabilities in addition to basic functionality

Rather than maintaining a single complex component, two specialized implementations provide better separation of concerns and simpler APIs for each use case.

## Guide-level Explanation

### Two ModalHeader Implementations

The library provides two ModalHeader implementations:

| Location | Purpose | Export Button |
|----------|---------|---------------|
| `src/utils/ModalHeader.ts` | Simple modals | No |
| `src/components/ModalHeader/index.ts` | Data/Report modals | Yes (CSV, XLS, PDF) |

### When to Use Each

#### Use `utils/ModalHeader` for:
- Filter modals
- Settings/Configuration modals
- Simple dialogs
- Any modal that doesn't need data export

#### Use `components/ModalHeader` for:
- Chart modals with export functionality
- Report modals
- Data visualization modals
- Any modal that needs CSV/XLS/PDF export

### Usage: Simple ModalHeader (utils)

```typescript
import { ModalHeader } from 'myio-js-library';

// Option 1: Generate HTML with CSS classes
const headerHtml = ModalHeader.generateHTML({
  icon: '🔍',
  title: 'Filtrar e Ordenar',
  modalId: 'filter-modal',
  theme: 'dark',
  isMaximized: false,
  showThemeToggle: true,
  showMaximize: true,
  showClose: true,
  primaryColor: '#3e1a7d',
});

// Option 2: Generate HTML with inline styles (more compatible)
const headerHtml = ModalHeader.generateInlineHTML({
  icon: '🌡️',
  title: 'Historico de Temperatura',
  modalId: 'temp-modal',
  theme: 'dark',
});

// Setup event handlers manually
ModalHeader.setupHandlers({
  modalId: 'temp-modal',
  onThemeToggle: () => toggleTheme(),
  onMaximize: () => toggleMaximize(),
  onClose: () => closeModal(),
});

// Or use the controller for state management
const controller = ModalHeader.createController({
  modalId: 'temp-modal',
  theme: 'dark',
  maximizeTarget: '.modal-card',
  maximizedClass: 'maximized',
  themeTarget: '.modal-header',
  lightThemeClass: 'header--light',
  onClose: () => modal.close(),
  onThemeChange: (theme) => console.log('Theme:', theme),
  onMaximizeChange: (max) => console.log('Maximized:', max),
});

// Controller methods
controller.toggleTheme();    // Toggle dark/light
controller.toggleMaximize(); // Toggle fullscreen
controller.reset();          // Reset to initial state
controller.destroy();        // Cleanup listeners
```

### Usage: Export ModalHeader (components)

```typescript
import { createModalHeader } from 'myio-js-library';

const header = createModalHeader({
  id: 'consumption-modal',
  title: 'Consumo Ultimos 7 Dias',
  icon: '📊',
  theme: 'light',
  isMaximized: false,
  exportFormats: ['csv', 'xls', 'pdf'],
  onExport: (format) => {
    console.log('Exporting as:', format);
    // Handle export logic
  },
  onThemeToggle: (theme) => {
    console.log('Theme changed:', theme);
  },
  onMaximize: (isMaximized) => {
    console.log('Maximized:', isMaximized);
  },
  onClose: () => {
    modal.close();
  },
});

// Render to DOM
container.innerHTML = header.render();

// Attach event listeners (must be called after DOM insertion)
header.attachListeners();

// Update state
header.update({ theme: 'dark', isMaximized: true });

// Get current state
const state = header.getState();
// { theme: 'dark', isMaximized: true }

// Cleanup
header.destroy();
```

## Reference-level Explanation

### Simple ModalHeader (utils/ModalHeader.ts)

#### API

```typescript
// Static object with methods
const ModalHeader = {
  generateHTML(options: ModalHeaderOptions): string;
  generateInlineHTML(options: ModalHeaderOptions): string;
  setupHandlers(handlers: ModalHeaderHandlers): void;
  updateState(modalId: string, state: { theme?: 'dark' | 'light'; isMaximized?: boolean }): void;
  injectCSS(): void;
  createController(options: ModalHeaderControllerOptions): ModalHeaderController;
};
```

#### Types

```typescript
interface ModalHeaderOptions {
  icon: string;
  title: string;
  modalId: string;
  theme?: 'dark' | 'light';
  isMaximized?: boolean;
  showThemeToggle?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  primaryColor?: string;
  borderRadius?: string;
}

interface ModalHeaderController {
  getTheme(): 'dark' | 'light';
  isMaximized(): boolean;
  toggleTheme(): void;
  setTheme(theme: 'dark' | 'light'): void;
  toggleMaximize(): void;
  setMaximized(maximized: boolean): void;
  reset(): void;
  destroy(): void;
}
```

#### Features

- Icon + Title on the left
- Action buttons on the right:
  - Theme toggle (sun/moon icons)
  - Maximize/Restore (window icons)
  - Close (× button)
- Draggable header support
- Dark/Light theme styles
- MyIO Purple primary color (#3e1a7d)

#### Used By

- `TemperatureModal.ts` - Temperature history modal
- `MenuView.ts` - Filter modal in Menu component
- `TelemetryGridView.ts` - Filter modal in TelemetryGrid (showcase)

---

### Export ModalHeader (components/ModalHeader/index.ts)

#### API

```typescript
// Factory function returning instance
function createModalHeader(config: ModalHeaderConfig): ModalHeaderInstance;

interface ModalHeaderInstance {
  render(): string;
  attachListeners(): void;
  update(updates: Partial<Pick<ModalHeaderConfig, 'theme' | 'isMaximized' | 'title'>>): void;
  getState(): { theme: ModalTheme; isMaximized: boolean };
  destroy(): void;
}
```

#### Types

```typescript
type ModalTheme = 'light' | 'dark';
type ExportFormat = 'csv' | 'xls' | 'pdf';

interface ModalHeaderConfig {
  id: string;
  title: string;
  icon?: string;
  theme?: ModalTheme;
  isMaximized?: boolean;
  backgroundColor?: string;
  textColor?: string;
  showThemeToggle?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  borderRadius?: string;
  exportFormats?: ExportFormat[];
  onExport?: (format: ExportFormat) => void;
  onThemeToggle?: (theme: ModalTheme) => void;
  onMaximize?: (isMaximized: boolean) => void;
  onClose?: () => void;
}
```

#### Features

- All features from Simple ModalHeader, plus:
- **Export Button** with dropdown menu
  - Single format: Direct button
  - Multiple formats: Dropdown with CSV, XLS, PDF options
- Format icons and labels
- Automatic dropdown positioning and closing

#### Used By

- `createConsumptionModal.ts` - 7-day consumption chart modal
- `createConsumptionChartWidget.ts` - Consumption chart widget

---

### Comparison Table

| Feature | utils/ModalHeader | components/ModalHeader |
|---------|-------------------|------------------------|
| Icon | Yes | Yes |
| Title | Yes | Yes |
| Theme Toggle | Yes | Yes |
| Maximize | Yes | Yes |
| Close | Yes | Yes |
| Draggable | Yes | No |
| **Export Button** | **No** | **Yes** |
| API Style | Static methods | Factory + instance |
| State Management | createController() | Built-in |
| Inline Styles | generateInlineHTML() | Always inline |
| CSS Classes | generateHTML() | No |

### File Locations

```
src/
├── utils/
│   └── ModalHeader.ts              # Simple modals (RFC-0121)
└── components/
    └── ModalHeader/
        └── index.ts                # Export modals
```

### Exports from Library

```typescript
// src/index.ts

// Simple ModalHeader (Recommended for most modals)
export { ModalHeader } from './utils/ModalHeader';
export type {
  ModalHeaderOptions,
  ModalHeaderHandlers,
  ModalHeaderControllerOptions,
  ModalHeaderController,
} from './utils/ModalHeader';

// Export ModalHeader (For modals with data export)
export { createModalHeader, getModalHeaderStyles } from './components/ModalHeader';
export type {
  ModalHeaderConfig,
  ModalHeaderInstance,
  ModalTheme,
  ExportFormat,
} from './components/ModalHeader';
```

## Drawbacks

1. **Two implementations**: Developers need to understand which one to use
2. **Similar naming**: Both have "ModalHeader" in the name
3. **Feature overlap**: Basic features are duplicated

## Rationale and Alternatives

### Why two implementations?

1. **Separation of concerns**: Export functionality adds complexity
2. **Bundle size**: Simple modals don't need export code
3. **API simplicity**: Each implementation has a focused API
4. **Historical reasons**: Export ModalHeader was created first for chart modals

### Alternatives Considered

1. **Single component with optional export**: Rejected due to increased complexity
2. **Composition pattern**: ModalHeader + ExportButton - Rejected for simpler integration
3. **Merge into one**: Would require breaking changes and increase complexity

### Decision

Keep both implementations as complementary components:
- `ModalHeader` (utils) as the default for simple modals
- `createModalHeader` (components) for modals needing export

## Prior Art

- RFC-0121: TelemetryGrid Component (introduced utils/ModalHeader)
- RFC-0098: Consumption 7 Days Chart (uses components/ModalHeader)

## Unresolved Questions

None - both implementations are stable and in production use.

## Future Possibilities

1. **Unified API**: Create a wrapper that selects the appropriate implementation based on config
2. **Additional export formats**: JSON, PNG (chart image)
3. **Print button**: Direct print functionality
4. **Breadcrumb navigation**: For nested modals
5. **Subtitle support**: Secondary text line in header
