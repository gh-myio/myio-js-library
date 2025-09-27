# RFC 0015: Demand Modal Component (with Token Injection) for MYIO JS Library

- **Feature Name:** `demand-modal-component`
- **Start Date:** 2025-01-26
- **RFC PR:** [myio-js-library#0015](https://github.com/gh-myio/myio-js-library/pull/0015)
- **MYIO Issue:** [myio-js-library#0015](https://github.com/gh-myio/myio-js-library/issues/0015)

## Summary

This RFC proposes a new `openDemandModal` component for the MYIO JS Library that displays a fully-styled modal with a demand/consumption line chart over time. The component will fetch telemetry data from ThingsBoard REST API using token-based authentication, render an interactive chart with zoom/pan capabilities, and provide PDF export functionality. The modal follows the existing design patterns with purple theming, overlay behavior, and comprehensive accessibility features.

## Motivation

Currently, demand visualization functionality exists in ad-hoc implementations across ThingsBoard widgets. This RFC standardizes the demand modal as a reusable component that can be integrated into any web application requiring energy demand visualization. The component addresses several key needs:

1. **Standardization**: Consistent UI/UX across all MYIO applications
2. **Reusability**: Single implementation that can be used in multiple contexts
3. **Security**: Token-based authentication without localStorage dependencies
4. **Accessibility**: Full keyboard navigation and screen reader support
5. **Export Capabilities**: Professional PDF reports for stakeholders
6. **Performance**: Optimized chart rendering and data handling

The component will replace scattered implementations and provide a production-ready solution for demand visualization needs.

## Guide-level explanation

### Product/UX Requirements

The Demand Modal Component presents energy demand data in a professional, interactive interface:

#### Visual Design

**Header Bar (Purple Theme)**
- Title format: "Demanda – {Store/Device Label}"
- Lightning bolt (⚡) icon on the left
- Action buttons on the right:
  - "Exportar PDF" button
  - Fullscreen toggle button
  - Close (×) button

**Period Information**
- Period line displaying: "Período: dd/mm/yyyy → dd/mm/yyyy"
- Formatted according to locale settings

**Peak Highlight Pill (Yellow)**
- Format: "Máxima: {value} kW às {dd/mm/yyyy HH:mm}"
- Prominently displayed above the chart
- Only shown when data points exist

**Main Chart Area**
- Smooth line chart with purple stroke color
- Light purple fill area under the curve
- X-axis: Time progression (hours/days based on range)
- Y-axis: "Demanda (kW)" with appropriate scaling
- Responsive sizing that adapts to modal dimensions

**Interactive Controls**
- Mouse wheel zoom in/out
- Click and drag to zoom to selection
- Ctrl+drag to pan the chart
- "Reset Zoom" button to return to full view
- Small help legend explaining zoom controls

#### Modal Behavior

**Overlay and Focus Management**
- Semi-transparent dark overlay blocks page interaction
- Modal card centered in viewport
- Focus trapped within modal (tab cycling)
- ESC key closes modal
- Clicking backdrop (outside card) closes modal

**Fullscreen Mode**
- Toggle button expands modal to full viewport
- Chart resizes to utilize available space
- All functionality remains available in fullscreen
- Toggle again to return to normal size

**Loading and Error States**
- Loading: Hourglass icon with animated dots and "Carregando dados..."
- Error: Red warning icon with descriptive error message
- Empty data: "Sem pontos de demanda no período selecionado"

#### PDF Export Feature

**Report Generation**
- A4 portrait format
- Professional header with MYIO branding
- Device label and period information
- Peak demand highlight (yellow pill text)
- Chart rendered as high-quality image
- Sample data table (first 10-15 data points)
- Timestamp and footer: "MyIO Energy Management System"

#### Internationalization

**Default Language: Portuguese (pt-BR)**
- All UI text in Portuguese by default
- Date/time formatting follows Brazilian standards
- Number formatting with appropriate decimal separators

**Localization Support**
- Override locale via `locale` parameter
- Supported locales: 'pt-BR', 'en-US', extensible for others
- Automatic date/number formatting based on locale

### Usage Example

```javascript
import { openDemandModal } from '@myio/js-library';

// Basic usage
const modal = openDemandModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  label: 'Loja Centro'
});

// Advanced usage with customization
const modal = openDemandModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  deviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  label: 'Loja Centro',
  container: document.getElementById('modal-container'),
  locale: 'pt-BR',
  onClose: () => console.log('Modal closed'),
  pdf: {
    enabled: true,
    fileName: 'demanda-loja-centro-jan2024.pdf'
  },
  styles: {
    primaryColor: '#4A148C',
    accentColor: '#FFC107',
    borderRadius: '8px'
  }
});

// Clean up when needed
modal.destroy();
```

## Reference-level explanation

### API Design

#### Core Function Signature

```typescript
export function openDemandModal(params: DemandModalParams): DemandModalInstance;
```

#### Type Definitions

```typescript
interface DemandModalParams {
  // Required parameters
  token: string;                       // JWT token for ThingsBoard authentication
  deviceId: string;                    // ThingsBoard device UUID
  startDate: string;                   // ISO date string "YYYY-MM-DD"
  endDate: string;                     // ISO date string "YYYY-MM-DD"
  
  // Optional parameters
  label?: string;                      // Device/store label (default: "Dispositivo")
  container?: HTMLElement | string;    // Mount container (default: document.body)
  onClose?: () => void;                // Callback when modal closes
  locale?: 'pt-BR' | 'en-US' | string; // Locale for formatting (default: 'pt-BR')
  pdf?: DemandModalPdfConfig;          // PDF export configuration
  styles?: Partial<DemandModalStyles>; // Style customization tokens
}

interface DemandModalPdfConfig {
  enabled?: boolean;                   // Enable PDF export (default: true)
  fileName?: string;                   // Custom filename (default: auto-generated)
}

interface DemandModalStyles {
  // Color tokens
  primaryColor: string;                // Main purple color (#4A148C)
  accentColor: string;                 // Yellow highlight color (#FFC107)
  dangerColor: string;                 // Error state color (#f44336)
  infoColor: string;                   // Info elements color (#2196F3)
  textPrimary: string;                 // Primary text color
  textSecondary: string;               // Secondary text color
  backgroundColor: string;             // Modal background
  overlayColor: string;                // Backdrop overlay color
  
  // Layout tokens
  borderRadius: string;                // Card border radius (8px)
  buttonRadius: string;                // Button border radius (6px)
  pillRadius: string;                  // Pill border radius (20px)
  zIndex: number;                      // Modal z-index (10000)
  
  // Spacing tokens
  spacingXs: string;                   // 4px
  spacingSm: string;                   // 8px
  spacingMd: string;                   // 16px
  spacingLg: string;                   // 24px
  spacingXl: string;                   // 32px
  
  // Typography tokens
  fontFamily: string;                  // Font family
  fontSizeXs: string;                  // 12px
  fontSizeSm: string;                  // 14px
  fontSizeMd: string;                  // 16px
  fontSizeLg: string;                  // 18px
  fontSizeXl: string;                  // 20px
  fontWeight: string;                  // Normal weight
  fontWeightBold: string;              // Bold weight
}

interface DemandModalInstance {
  destroy(): void;                     // Clean up modal and resources
}
```

#### Internal Data Structures

```typescript
interface DemandDataPoint {
  x: number;                           // Timestamp in milliseconds
  y: number;                           // Demand value in kW
}

interface DemandPeak {
  value: number;                       // Peak demand value in kW
  timestamp: number;                   // Timestamp of peak in milliseconds
  formattedValue: string;              // Formatted value with units
  formattedTime: string;               // Formatted timestamp
}

interface DemandChartData {
  points: DemandDataPoint[];           // Chart data points
  peak: DemandPeak | null;             // Peak demand information
  isEmpty: boolean;                    // Whether dataset is empty
}
```

### Data & Telemetry Integration

#### ThingsBoard REST API Integration

**Endpoint Configuration**
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
```

**Query Parameters**
```typescript
interface TelemetryQueryParams {
  keys: 'consumption';                 // Telemetry key for consumption data
  startTs: number;                     // Start timestamp in milliseconds
  endTs: number;                       // End timestamp in milliseconds
  limit: 50000;                        // Maximum data points
  intervalType: 'MILLISECONDS';        // Interval type
  interval: 54000000;                  // 15-minute intervals (54M ms)
  agg: 'SUM';                          // Aggregation method
  orderBy: 'ASC';                      // Sort order
}
```

**Authentication**
```typescript
const headers = {
  'X-Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

#### Data Processing Pipeline

**Raw Data Transformation**
1. Fetch consumption telemetry from ThingsBoard
2. Process cumulative consumption values:
   - Calculate deltas between consecutive points
   - Discard negative deltas (meter resets)
   - Convert Wh to kWh when necessary
3. Sort points by timestamp ascending
4. Compute peak demand value and timestamp
5. Format data for Chart.js consumption

**Error Handling**
- Network failures: Show error state with retry option
- Authentication errors: Display appropriate error message
- Empty datasets: Show "no data" message
- Invalid data: Filter out malformed points

### Chart Implementation

#### Chart.js Configuration

```typescript
interface ChartConfiguration {
  type: 'line';
  data: {
    datasets: [{
      label: 'Demanda (kW)';
      data: DemandDataPoint[];
      borderColor: string;             // Primary purple color
      backgroundColor: string;         // Light purple fill
      fill: true;
      tension: 0.4;                    // Smooth curves
      pointRadius: 2;
      pointHoverRadius: 6;
    }];
  };
  options: {
    responsive: true;
    maintainAspectRatio: false;
    plugins: {
      legend: { display: false };
      zoom: ZoomConfiguration;
    };
    scales: {
      x: TimeScaleConfiguration;
      y: DemandScaleConfiguration;
    };
  };
}
```

**Zoom Plugin Configuration**
```typescript
interface ZoomConfiguration {
  zoom: {
    wheel: { enabled: true };
    pinch: { enabled: true };
    drag: { enabled: true, modifierKey: 'ctrl' };
    mode: 'x';
  };
  pan: {
    enabled: true;
    mode: 'x';
    modifierKey: 'ctrl';
  };
}
```

### External Dependencies

#### Dynamic Library Loading

**Chart.js and Plugins**
```typescript
const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
const ZOOM_PLUGIN_CDN = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js';

// Integrity hashes for security
const CHART_JS_INTEGRITY = 'sha384-...';
const ZOOM_PLUGIN_INTEGRITY = 'sha384-...';
```

**jsPDF for Export**
```typescript
const JSPDF_CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
const JSPDF_INTEGRITY = 'sha384-...';
```

**Loading Strategy**
- Check if libraries are already loaded
- Load dependencies in parallel when possible
- Handle loading failures gracefully
- Prevent duplicate script injection
- Use integrity checks for security

### DOM Structure and Styling

#### Modal HTML Structure

```html
<div class="myio-demand-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="myio-demand-modal-card">
    <!-- Header -->
    <div class="myio-demand-modal-header">
      <div class="myio-demand-modal-title-section">
        <span class="myio-demand-modal-icon">⚡</span>
        <h2 id="modal-title" class="myio-demand-modal-title">Demanda – {label}</h2>
      </div>
      <div class="myio-demand-modal-actions">
        <button class="myio-demand-modal-btn myio-demand-modal-btn-pdf" type="button">
          Exportar PDF
        </button>
        <button class="myio-demand-modal-btn myio-demand-modal-btn-fullscreen" type="button" aria-label="Tela cheia">
          ⛶
        </button>
        <button class="myio-demand-modal-btn myio-demand-modal-btn-close" type="button" aria-label="Fechar">
          ×
        </button>
      </div>
    </div>
    
    <!-- Period Info -->
    <div class="myio-demand-modal-period">
      Período: {startDate} → {endDate}
    </div>
    
    <!-- Peak Highlight -->
    <div class="myio-demand-modal-peak" style="display: none;">
      Máxima: {peakValue} kW às {peakTime}
    </div>
    
    <!-- Chart Container -->
    <div class="myio-demand-modal-content">
      <div class="myio-demand-modal-chart-container">
        <canvas class="myio-demand-modal-chart"></canvas>
      </div>
      
      <!-- Zoom Controls -->
      <div class="myio-demand-modal-zoom-controls">
        <button class="myio-demand-modal-btn myio-demand-modal-btn-reset" type="button">
          Reset Zoom
        </button>
        <div class="myio-demand-modal-zoom-help">
          <small>Scroll: zoom | Drag: selecionar | Ctrl+Drag: mover</small>
        </div>
      </div>
    </div>
    
    <!-- Loading State -->
    <div class="myio-demand-modal-loading" style="display: none;">
      <div class="myio-demand-modal-spinner">⧗</div>
      <div class="myio-demand-modal-loading-text">Carregando dados...</div>
    </div>
    
    <!-- Error State -->
    <div class="myio-demand-modal-error" style="display: none;">
      <div class="myio-demand-modal-error-icon">⚠</div>
      <div class="myio-demand-modal-error-text"></div>
    </div>
  </div>
</div>
```

#### CSS Architecture

**Scoped Class Names**
All CSS classes use the `myio-demand-modal-` prefix to avoid conflicts.

**CSS Variables Integration**
```css
.myio-demand-modal-overlay {
  --myio-primary: #4A148C;
  --myio-accent: #FFC107;
  --myio-danger: #f44336;
  --myio-info: #2196F3;
  --myio-text-primary: #212121;
  --myio-text-secondary: #757575;
  --myio-bg: #ffffff;
  --myio-overlay: rgba(0, 0, 0, 0.5);
  --myio-radius: 8px;
  --myio-radius-btn: 6px;
  --myio-radius-pill: 20px;
  --myio-z-index: 10000;
  --myio-spacing-xs: 4px;
  --myio-spacing-sm: 8px;
  --myio-spacing-md: 16px;
  --myio-spacing-lg: 24px;
  --myio-spacing-xl: 32px;
}
```

**Responsive Design**
- Mobile-first approach
- Breakpoints for tablet and desktop
- Touch-friendly button sizes
- Appropriate font scaling

### Accessibility Implementation

#### Keyboard Navigation

**Focus Management**
- Focus trap within modal using `focusTrap` utility
- Tab order: Close → PDF → Fullscreen → Reset Zoom → Chart (if interactive)
- ESC key closes modal
- Enter/Space activates buttons

**Screen Reader Support**
- `role="dialog"` and `aria-modal="true"` on overlay
- `aria-labelledby` pointing to modal title
- `aria-label` attributes on icon buttons
- Live regions for loading/error state announcements

**Visual Accessibility**
- High contrast colors meeting WCAG AA standards
- Focus indicators on all interactive elements
- Sufficient color contrast ratios
- No reliance on color alone for information

### Performance Considerations

#### Optimization Strategies

**Chart Rendering**
- Debounced resize handling (300ms)
- Canvas cleanup on modal destroy
- Efficient data point rendering
- Lazy chart initialization

**Memory Management**
- Event listener cleanup on destroy
- Chart instance disposal
- DOM element removal
- CSS injection cleanup

**Network Optimization**
- Request deduplication
- Appropriate timeout values
- Error retry with exponential backoff
- Efficient data processing

#### Bundle Size Impact

**Core Component**: ~15KB gzipped
**External Dependencies**: Loaded dynamically, not included in bundle
**CSS Styles**: ~3KB gzipped
**Total Impact**: ~18KB added to main bundle

### Security Considerations

#### Token Handling

**Security Requirements**
- Accept token only via parameter
- Never read from localStorage or sessionStorage
- Never write tokens to any storage
- Redact token values from console logs
- Use token only for HTTP Authorization headers

**CORS and HTTPS**
- Assume HTTPS endpoints
- Document CORS requirements for ThingsBoard
- Handle CORS errors gracefully

#### Input Validation

**Parameter Validation**
- Validate deviceId format (UUID)
- Validate date format (ISO YYYY-MM-DD)
- Sanitize label text for XSS prevention
- Validate container element existence

### Error Handling Strategy

#### Error Categories

**Network Errors**
- Connection timeouts
- HTTP error status codes
- CORS failures
- Authentication failures

**Data Errors**
- Empty response datasets
- Malformed telemetry data
- Invalid timestamp formats
- Missing required fields

**Runtime Errors**
- Chart rendering failures
- PDF generation errors
- DOM manipulation errors
- External library loading failures

#### Error Recovery

**User-Facing Errors**
- Clear, actionable error messages
- Retry mechanisms where appropriate
- Graceful degradation of features
- Fallback UI states

**Developer Errors**
- Console warnings for invalid parameters
- Detailed error logging (without sensitive data)
- Error boundary implementation
- Comprehensive error documentation

## Drawbacks

### Implementation Complexity

**External Dependencies**
- Requires Chart.js and jsPDF libraries
- Dynamic loading adds complexity
- Version compatibility management
- Potential for loading failures

**Bundle Size Impact**
- Additional ~18KB to main bundle
- External libraries loaded at runtime
- CSS injection overhead

### Maintenance Overhead

**API Surface**
- Large configuration object
- Multiple optional parameters
- Complex type definitions
- Backward compatibility requirements

**Browser Compatibility**
- Modern browser requirements
- Canvas API dependencies
- ES6+ feature usage
- Polyfill considerations

### Performance Considerations

**Chart Rendering**
- Large datasets may impact performance
- Canvas rendering limitations
- Memory usage with multiple modals
- Mobile device constraints

## Rationale and alternatives

### Design Decisions

#### Token-Based Authentication
**Chosen Approach**: Require token as parameter
**Alternative**: Read from localStorage
**Rationale**: Explicit token passing provides better security, flexibility, and testability

#### Chart.js Selection
**Chosen Approach**: Chart.js with zoom plugin
**Alternatives**: D3.js, Plotly.js, custom canvas implementation
**Rationale**: Chart.js provides excellent balance of features, performance, and bundle size

#### Modal Implementation
**Chosen Approach**: Vanilla DOM with focus trap
**Alternatives**: React Portal, Vue Teleport, existing modal libraries
**Rationale**: Framework-agnostic approach ensures maximum compatibility

#### PDF Export Strategy
**Chosen Approach**: Client-side generation with jsPDF
**Alternatives**: Server-side PDF generation, browser print API
**Rationale**: Client-side approach reduces server load and provides immediate feedback

### Alternative Approaches Considered

#### Component Architecture
1. **React Component**: Would limit usage to React applications
2. **Web Component**: Browser support limitations and complexity
3. **jQuery Plugin**: Adds jQuery dependency
4. **Vanilla Function**: Chosen for maximum compatibility

#### Data Fetching Strategy
1. **Built-in Fetch**: Chosen for simplicity and browser support
2. **Axios Integration**: Would add dependency
3. **Callback-based**: Would complicate error handling
4. **Promise-based**: Chosen for modern async patterns

#### Styling Approach
1. **CSS-in-JS**: Would increase bundle size
2. **External CSS File**: Would require build step
3. **Inline Styles**: Would reduce customization
4. **CSS Variables**: Chosen for flexibility and performance

## Prior art

### Existing Implementations

**ThingsBoard Energy Widget**
- Current ad-hoc implementation in ThingsBoard widgets
- Similar chart functionality and PDF export
- Inconsistent styling and behavior
- Tightly coupled to ThingsBoard widget framework

**MYIO Dashboard Modals**
- Existing modal patterns in MYIO applications
- Similar overlay and focus management
- Consistent purple theming
- Established UX patterns for energy data

**Chart.js Ecosystem**
- Proven chart library with extensive plugin ecosystem
- Zoom plugin provides required interaction patterns
- Well-documented API and community support
- Performance optimizations for large datasets

### Industry Standards

**Modal Design Patterns**
- WAI-ARIA modal guidelines
- Focus management best practices
- Keyboard navigation standards
- Screen reader compatibility

**Energy Data Visualization**
- Time-series chart conventions
- Peak demand highlighting
- Interactive zoom/pan controls
- Export functionality standards

## Unresolved questions

### Technical Decisions

**Chart Performance Optimization**
- What is the optimal data point limit for smooth rendering?
- Should we implement data decimation for large datasets?
- How should we handle real-time data updates?

**PDF Export Quality**
- What resolution should chart images use in PDF exports?
- Should we include raw data tables in exports?
- How should we handle very large date ranges in exports?

**Internationalization Scope**
- Which additional locales should be supported initially?
- Should number formatting be fully customizable?
- How should we handle right-to-left languages?

### API Design Questions

**Configuration Flexibility**
- Should chart type be configurable (line vs. bar)?
- Should aggregation method be user-selectable?
- How granular should styling customization be?

**Error Handling Strategy**
- Should the component provide retry mechanisms?
- How should network timeouts be configured?
- Should error callbacks be provided to consumers?

**Performance Thresholds**
- What is the maximum recommended date range?
- Should we implement automatic data sampling?
- How should we handle slow network connections?

### Future Integration

**ThingsBoard Compatibility**
- How will this integrate with existing ThingsBoard widgets?
- Should we provide ThingsBoard-specific utilities?
- How will authentication tokens be managed in TB context?

**MYIO Ecosystem Integration**
- How will this component integrate with other MYIO components?
- Should we provide shared styling tokens?
- How will this work with existing MYIO authentication systems?

## Future possibilities

### Enhanced Chart Features

**Multi-Series Support**
- Compare multiple devices in single chart
- Different visualization modes (stacked, overlaid)
- Legend management for multiple series
- Color coding for different data sources

**Advanced Analytics**
- Trend line calculations
- Statistical overlays (average, median)
- Anomaly detection highlighting
- Predictive modeling integration

**Real-Time Updates**
- WebSocket integration for live data
- Automatic refresh capabilities
- Real-time peak detection
- Live data streaming visualization

### Export Enhancements

**Multiple Export Formats**
- Excel/CSV data export
- PNG/SVG chart image export
- PowerPoint slide generation
- Email integration for reports

**Advanced PDF Features**
- Multi-page reports with detailed analytics
- Custom branding and templates
- Batch export for multiple devices
- Scheduled report generation

### Accessibility Improvements

**Enhanced Screen Reader Support**
- Audio chart sonification
- Data table alternative views
- Voice navigation commands
- Haptic feedback integration

**Visual Accessibility**
- High contrast mode
- Color blind friendly palettes
- Font size customization
- Motion reduction preferences

### Performance Optimizations

**Data Processing**
- Web Worker integration for large datasets
- Streaming data processing
- Client-side caching strategies
- Progressive data loading

**Rendering Optimizations**
- Canvas virtualization for large datasets
- Level-of-detail rendering
- Adaptive quality based on device capabilities
- GPU acceleration where available

### Integration Possibilities

**Framework Adapters**
- React component wrapper
- Vue.js component wrapper
- Angular component wrapper
- Svelte component wrapper

**Backend Integration**
- Direct database connectivity options
- Multiple data source support
- Custom authentication providers
- API gateway integration

**Mobile Enhancements**
- Touch gesture optimization
- Mobile-specific UI adaptations
- Offline capability
- Progressive Web App features

### Advanced Customization

**Theme System**
- Complete theme customization
- Dark mode support
- Brand-specific styling
- Dynamic theme switching

**Plugin Architecture**
- Custom chart overlays
- Additional export formats
- Custom data processors
- Third-party integrations

**Configuration Management**
- User preference persistence
- Default configuration profiles
- Organization-wide settings
- A/B testing capabilities

---

## Implementation Checklist

### Core Functionality
- [ ] Calling `openDemandModal({ token, deviceId, startDate, endDate })` opens modal with correct header, period, chart, and zoom controls
- [ ] Passing `label` parameter shows "Demanda – {label}" in header
- [ ] Yellow pill displays correct peak value and timestamp when data points exist
- [ ] Fullscreen toggle expands to 100% viewport and chart resizes accordingly
- [ ] "Exportar PDF" downloads A4 report including chart image and metadata
- [ ] Overlay blocks page interaction; ESC/backdrop click closes; focus is trapped
- [ ] `destroy()` method removes DOM, listeners, styles, and restores body scroll
- [ ] All network calls use provided token and succeed with valid credentials
- [ ] No global leaks; no jQuery dependency required

### Quality Assurance
- [ ] Comprehensive TypeScript type definitions
- [ ] Unit tests for all public APIs
- [ ] Integration tests for ThingsBoard connectivity
- [ ] Accessibility testing with screen readers
- [ ] Cross-browser compatibility testing
- [ ] Performance testing with large datasets
- [ ] Security audit of token handling
- [ ] Documentation and usage examples

### Non-goals
- No server-side rendering support
- No persistence of user preferences beyond session
- No multi-series comparison in this RFC (future work)

---

*This RFC provides a complete specification for implementing the Demand Modal Component from scratch, ensuring consistency with existing MYIO design patterns while providing a robust, accessible, and performant solution for energy demand visualization.*
