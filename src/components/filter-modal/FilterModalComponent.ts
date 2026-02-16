/**
 * FilterModalComponent — Premium filter modal for CardGridPanel
 *
 * Features:
 * - Multi-select checkboxes by category/type
 * - "Select All" / "Select None" buttons
 * - Sort options (consumption, level, label)
 * - Group by type with internal sorting
 * - Apply/Cancel actions
 * - Premium dark theme design
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface FilterCategory {
  /** Unique identifier for the category */
  id: string;
  /** Display label */
  label: string;
  /** Icon (emoji or SVG) */
  icon?: string;
  /** Number of items in this category */
  count: number;
  /** Whether this category is selected */
  selected: boolean;
}

export interface FilterSortOption {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Sort field (e.g., 'consumption', 'water_level', 'label') */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

export interface FilterDevice {
  /** Unique identifier for the device */
  id: string;
  /** Display label/name */
  label: string;
  /** Device type (for icon selection) */
  type?: string;
  /** Device context */
  context?: string;
  /** Icon (emoji or SVG) */
  icon?: string;
  /** Whether this device is selected (defaults to true) */
  selected?: boolean;
  /** Status for visual indication */
  status?: string;
}

export interface FilterModalOptions {
  /** Modal title */
  title: string;
  /** Icon for the modal header */
  icon?: string;
  /** Categories to filter by (e.g., device types) */
  categories: FilterCategory[];
  /** Sort options */
  sortOptions: FilterSortOption[];
  /** Currently selected sort option id */
  selectedSortId?: string;
  /** Devices for individual selection (shown in right panel) */
  devices?: FilterDevice[];
  /** Callback when filter is applied */
  onApply: (selectedCategories: string[], sortOption: FilterSortOption | null, selectedDeviceIds?: string[]) => void;
  /** Callback when modal is closed/cancelled */
  onClose: () => void;
  /** Enable grouping by category */
  groupByCategory?: boolean;
  /** Theme mode: 'light' (default) or 'dark' */
  themeMode?: 'light' | 'dark';
  /** Show device grid panel (default: true when devices provided) */
  showDeviceGrid?: boolean;
}

export interface FilterState {
  selectedCategories: string[];
  sortOptionId: string | null;
  selectedDeviceIds: string[];
}

// ────────────────────────────────────────────
// SVG Icons
// ────────────────────────────────────────────

const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

const ICON_SORT_DESC = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/></svg>`;

const ICON_SORT_ASC = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h4M11 9h7M11 13h10M3 17l3-3 3 3M6 14V4"/></svg>`;

// ────────────────────────────────────────────
// CSS
// ────────────────────────────────────────────

const CSS_ID = 'myio-filter-modal-styles';

const MODAL_CSS = `
  .myio-fm-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  /* Light theme overlay (default) */
  .myio-fm-overlay--light {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(8px);
  }

  /* Dark theme overlay */
  .myio-fm-overlay--dark {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  .myio-fm-overlay--visible {
    opacity: 1;
  }

  .myio-fm {
    border-radius: 16px;
    min-width: 360px;
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: scale(0.95) translateY(10px);
    transition: transform 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  /* Two-column layout when device grid is shown */
  .myio-fm--with-devices {
    max-width: 800px;
    min-width: 700px;
  }

  /* Light theme modal (default) */
  .myio-fm--light {
    background: #ffffff;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    border: 1px solid #e2e8f0;
  }

  /* Dark theme modal */
  .myio-fm--dark {
    background: #1a1f2e;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .myio-fm-overlay--visible .myio-fm {
    transform: scale(1) translateY(0);
  }

  /* Header */
  .myio-fm__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
  }

  .myio-fm--light .myio-fm__header {
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  }

  .myio-fm--dark .myio-fm__header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(135deg, #1e2538 0%, #1a1f2e 100%);
  }

  .myio-fm__header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .myio-fm__icon {
    font-size: 20px;
    line-height: 1;
  }

  .myio-fm__title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .myio-fm--light .myio-fm__title {
    color: #1e293b;
  }

  .myio-fm--dark .myio-fm__title {
    color: #e2e8f0;
  }

  .myio-fm__close {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .myio-fm--light .myio-fm__close {
    background: rgba(0, 0, 0, 0.05);
    color: #64748b;
  }

  .myio-fm--light .myio-fm__close:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #1e293b;
  }

  .myio-fm--dark .myio-fm__close {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
  }

  .myio-fm--dark .myio-fm__close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }

  /* Body */
  .myio-fm__body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  /* Two-column body layout */
  .myio-fm__body--two-col {
    display: flex;
    gap: 20px;
    overflow: hidden;
  }

  .myio-fm__left-panel {
    flex: 0 0 280px;
    overflow-y: auto;
    padding-right: 16px;
  }

  .myio-fm--light .myio-fm__left-panel {
    border-right: 1px solid #e2e8f0;
  }

  .myio-fm--dark .myio-fm__left-panel {
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .myio-fm__right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* Device grid */
  .myio-fm__device-grid-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .myio-fm__device-search {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    outline: none;
    transition: all 0.15s ease;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .myio-fm--light .myio-fm__device-search {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #1e293b;
  }

  .myio-fm--light .myio-fm__device-search:focus {
    border-color: #3d7a62;
    box-shadow: 0 0 0 3px rgba(61, 122, 98, 0.1);
  }

  .myio-fm--light .myio-fm__device-search::placeholder {
    color: #94a3b8;
  }

  .myio-fm--dark .myio-fm__device-search {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }

  .myio-fm--dark .myio-fm__device-search:focus {
    border-color: #3d7a62;
    box-shadow: 0 0 0 3px rgba(61, 122, 98, 0.2);
  }

  .myio-fm--dark .myio-fm__device-search::placeholder {
    color: #64748b;
  }

  .myio-fm__device-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .myio-fm__device-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .myio-fm--light .myio-fm__device-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .myio-fm--light .myio-fm__device-item:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .myio-fm--dark .myio-fm__device-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .myio-fm--dark .myio-fm__device-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .myio-fm__device-item--selected {
    background: rgba(61, 122, 98, 0.1) !important;
    border-color: rgba(61, 122, 98, 0.3) !important;
  }

  .myio-fm__device-item--selected:hover {
    background: rgba(61, 122, 98, 0.15) !important;
  }

  .myio-fm__device-item--hidden {
    display: none;
  }

  .myio-fm__device-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid #94a3b8;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
    color: transparent;
  }

  .myio-fm__device-item--selected .myio-fm__device-checkbox {
    background: #3d7a62;
    border-color: #3d7a62;
    color: white;
  }

  .myio-fm__device-icon {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .myio-fm__device-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .myio-fm__device-label {
    font-size: 0.8rem;
    font-weight: 500;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .myio-fm--light .myio-fm__device-label {
    color: #1e293b;
  }

  .myio-fm--dark .myio-fm__device-label {
    color: #e2e8f0;
  }

  .myio-fm__device-type {
    font-size: 0.65rem;
    color: #64748b;
    margin: 0;
  }

  .myio-fm__device-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .myio-fm__device-status--online {
    background: #28a745;
    box-shadow: 0 0 4px rgba(40, 167, 69, 0.5);
  }

  .myio-fm__device-status--offline {
    background: #dc3545;
  }

  .myio-fm__device-status--warning {
    background: #fd7e14;
  }

  .myio-fm__device-count {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 12px;
    margin-left: auto;
  }

  .myio-fm--light .myio-fm__device-count {
    background: #e2e8f0;
    color: #64748b;
  }

  .myio-fm--dark .myio-fm__device-count {
    background: rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  }

  .myio-fm__no-devices {
    text-align: center;
    padding: 24px;
    font-size: 0.85rem;
    color: #64748b;
  }

  .myio-fm__section {
    margin-bottom: 24px;
  }

  .myio-fm__section:last-child {
    margin-bottom: 0;
  }

  .myio-fm__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .myio-fm__section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .myio-fm--light .myio-fm__section-title {
    color: #64748b;
  }

  .myio-fm--dark .myio-fm__section-title {
    color: #64748b;
  }

  .myio-fm__section-actions {
    display: flex;
    gap: 8px;
  }

  .myio-fm__section-btn {
    font-size: 0.7rem;
    color: #3d7a62;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .myio-fm__section-btn:hover {
    background: rgba(61, 122, 98, 0.15);
    color: #2d5a48;
  }

  /* Categories */
  .myio-fm__categories {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .myio-fm__category {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .myio-fm--light .myio-fm__category {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .myio-fm--light .myio-fm__category:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }

  .myio-fm--dark .myio-fm__category {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .myio-fm--dark .myio-fm__category:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .myio-fm__category--selected {
    background: rgba(61, 122, 98, 0.1) !important;
    border-color: rgba(61, 122, 98, 0.3) !important;
  }

  .myio-fm__category--selected:hover {
    background: rgba(61, 122, 98, 0.15) !important;
  }

  .myio-fm__checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid #94a3b8;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
    color: transparent;
  }

  .myio-fm__category--selected .myio-fm__checkbox {
    background: #3d7a62;
    border-color: #3d7a62;
    color: white;
  }

  .myio-fm__category-icon {
    font-size: 18px;
    line-height: 1;
    flex-shrink: 0;
  }

  .myio-fm__category-info {
    flex: 1;
    min-width: 0;
  }

  .myio-fm__category-label {
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0 0 2px 0;
  }

  .myio-fm--light .myio-fm__category-label {
    color: #1e293b;
  }

  .myio-fm--dark .myio-fm__category-label {
    color: #e2e8f0;
  }

  .myio-fm__category-count {
    font-size: 0.7rem;
    color: #64748b;
  }

  /* Sort options */
  .myio-fm__sort-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .myio-fm__sort-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .myio-fm--light .myio-fm__sort-option {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .myio-fm--light .myio-fm__sort-option:hover {
    background: #f1f5f9;
  }

  .myio-fm--dark .myio-fm__sort-option {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .myio-fm--dark .myio-fm__sort-option:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .myio-fm__sort-option--selected {
    background: rgba(61, 122, 98, 0.1) !important;
    border-color: rgba(61, 122, 98, 0.3) !important;
  }

  .myio-fm__sort-radio {
    width: 16px;
    height: 16px;
    border: 2px solid #94a3b8;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .myio-fm__sort-option--selected .myio-fm__sort-radio {
    border-color: #3d7a62;
  }

  .myio-fm__sort-radio::after {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
    transition: background 0.15s ease;
  }

  .myio-fm__sort-option--selected .myio-fm__sort-radio::after {
    background: #3d7a62;
  }

  .myio-fm__sort-icon {
    color: #64748b;
    display: flex;
    align-items: center;
  }

  .myio-fm__sort-label {
    font-size: 0.8rem;
  }

  .myio-fm--light .myio-fm__sort-label {
    color: #475569;
  }

  .myio-fm--dark .myio-fm__sort-label {
    color: #cbd5e1;
  }

  /* Footer */
  .myio-fm__footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
  }

  .myio-fm--light .myio-fm__footer {
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .myio-fm--dark .myio-fm__footer {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
  }

  .myio-fm__btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .myio-fm--light .myio-fm__btn--secondary {
    background: #e2e8f0;
    color: #64748b;
  }

  .myio-fm--light .myio-fm__btn--secondary:hover {
    background: #cbd5e1;
    color: #475569;
  }

  .myio-fm--dark .myio-fm__btn--secondary {
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
  }

  .myio-fm--dark .myio-fm__btn--secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }

  .myio-fm__btn--primary {
    background: linear-gradient(135deg, #3d7a62 0%, #2d5a48 100%);
    color: white;
  }

  .myio-fm__btn--primary:hover {
    background: linear-gradient(135deg, #4a9474 0%, #3d7a62 100%);
  }

  /* Scrollbar - Light */
  .myio-fm--light .myio-fm__body::-webkit-scrollbar {
    width: 6px;
  }

  .myio-fm--light .myio-fm__body::-webkit-scrollbar-track {
    background: transparent;
  }

  .myio-fm--light .myio-fm__body::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .myio-fm--light .myio-fm__body::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  /* Scrollbar - Dark */
  .myio-fm--dark .myio-fm__body::-webkit-scrollbar {
    width: 6px;
  }

  .myio-fm--dark .myio-fm__body::-webkit-scrollbar-track {
    background: transparent;
  }

  .myio-fm--dark .myio-fm__body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .myio-fm--dark .myio-fm__body::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export class FilterModalComponent {
  private overlay: HTMLElement;
  private options: FilterModalOptions;
  private selectedCategories: Set<string>;
  private selectedSortId: string | null;
  private selectedDeviceIds: Set<string>;
  private themeMode: 'light' | 'dark';
  private showDeviceGrid: boolean;
  private deviceSearchQuery: string = '';

  constructor(options: FilterModalOptions) {
    injectStyles();
    this.options = options;
    this.themeMode = options.themeMode || 'light'; // Default to light theme
    this.selectedCategories = new Set(
      options.categories.filter(c => c.selected).map(c => c.id)
    );
    this.selectedSortId = options.selectedSortId || null;

    // Device selection - all selected by default
    const devices = options.devices || [];
    this.selectedDeviceIds = new Set(
      devices.filter(d => d.selected !== false).map(d => d.id)
    );
    this.showDeviceGrid = options.showDeviceGrid ?? (devices.length > 0);

    this.overlay = document.createElement('div');
    this.overlay.className = `myio-fm-overlay myio-fm-overlay--${this.themeMode}`;
    this.render();
    this.bindEvents();
  }

  // ── Public API ────────────────────────────

  public show(): void {
    document.body.appendChild(this.overlay);
    // Trigger animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('myio-fm-overlay--visible');
    });
  }

  public hide(): void {
    this.overlay.classList.remove('myio-fm-overlay--visible');
    setTimeout(() => {
      this.overlay.remove();
    }, 200);
  }

  public getState(): FilterState {
    return {
      selectedCategories: Array.from(this.selectedCategories),
      sortOptionId: this.selectedSortId,
      selectedDeviceIds: Array.from(this.selectedDeviceIds),
    };
  }

  public destroy(): void {
    this.overlay.remove();
  }

  // ── Private ────────────────────────────────

  private render(): void {
    const { title, icon, categories, sortOptions, devices = [] } = this.options;
    const hasDevices = this.showDeviceGrid && devices.length > 0;
    const modalClass = `myio-fm myio-fm--${this.themeMode}${hasDevices ? ' myio-fm--with-devices' : ''}`;
    const bodyClass = `myio-fm__body${hasDevices ? ' myio-fm__body--two-col' : ''}`;

    this.overlay.innerHTML = `
      <div class="${modalClass}">
        <div class="myio-fm__header">
          <div class="myio-fm__header-left">
            ${icon ? `<span class="myio-fm__icon">${icon}</span>` : ''}
            <h2 class="myio-fm__title">${this.escapeHtml(title)}</h2>
          </div>
          <button class="myio-fm__close" title="Fechar">
            ${ICON_CLOSE}
          </button>
        </div>

        <div class="${bodyClass}">
          ${hasDevices ? '<div class="myio-fm__left-panel">' : ''}

          <!-- Categories Section -->
          <div class="myio-fm__section">
            <div class="myio-fm__section-header">
              <h3 class="myio-fm__section-title">Tipos</h3>
              <div class="myio-fm__section-actions">
                <button class="myio-fm__section-btn" data-action="select-all">Todos</button>
                <button class="myio-fm__section-btn" data-action="select-none">Nenhum</button>
              </div>
            </div>
            <div class="myio-fm__categories">
              ${categories.map(cat => this.renderCategory(cat)).join('')}
            </div>
          </div>

          <!-- Sort Section -->
          ${sortOptions.length > 0 ? `
            <div class="myio-fm__section">
              <div class="myio-fm__section-header">
                <h3 class="myio-fm__section-title">Ordenar por</h3>
              </div>
              <div class="myio-fm__sort-options">
                ${sortOptions.map(opt => this.renderSortOption(opt)).join('')}
              </div>
            </div>
          ` : ''}

          ${hasDevices ? '</div>' : ''}

          ${hasDevices ? this.renderDeviceGrid(devices) : ''}
        </div>

        <div class="myio-fm__footer">
          <button class="myio-fm__btn myio-fm__btn--secondary" data-action="cancel">Cancelar</button>
          <button class="myio-fm__btn myio-fm__btn--primary" data-action="apply">Aplicar</button>
        </div>
      </div>
    `;
  }

  private renderDeviceGrid(devices: FilterDevice[]): string {
    const selectedCount = this.selectedDeviceIds.size;
    const totalCount = devices.length;

    return `
      <div class="myio-fm__right-panel">
        <div class="myio-fm__section" style="height: 100%; display: flex; flex-direction: column;">
          <div class="myio-fm__section-header">
            <h3 class="myio-fm__section-title">Dispositivos</h3>
            <div class="myio-fm__section-actions">
              <span class="myio-fm__device-count">${selectedCount}/${totalCount}</span>
              <button class="myio-fm__section-btn" data-action="select-all-devices">Todos</button>
              <button class="myio-fm__section-btn" data-action="select-no-devices">Nenhum</button>
            </div>
          </div>
          <input
            type="text"
            class="myio-fm__device-search"
            placeholder="Buscar dispositivo..."
            data-action="device-search"
          />
          <div class="myio-fm__device-list">
            ${devices.length > 0
              ? devices.map(device => this.renderDeviceItem(device)).join('')
              : '<div class="myio-fm__no-devices">Nenhum dispositivo disponível</div>'
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderDeviceItem(device: FilterDevice): string {
    const isSelected = this.selectedDeviceIds.has(device.id);
    const statusClass = device.status ? `myio-fm__device-status--${device.status}` : '';
    const icon = device.icon || this.getDefaultDeviceIcon(device.type, device.context);

    return `
      <div class="myio-fm__device-item${isSelected ? ' myio-fm__device-item--selected' : ''}"
           data-device-id="${device.id}"
           data-device-label="${this.escapeHtml(device.label || '').toLowerCase()}">
        <div class="myio-fm__device-checkbox">
          ${ICON_CHECK}
        </div>
        ${icon ? `<span class="myio-fm__device-icon">${icon}</span>` : ''}
        <div class="myio-fm__device-info">
          <p class="myio-fm__device-label" title="${this.escapeHtml(device.label)}">${this.escapeHtml(device.label)}</p>
          ${device.type ? `<p class="myio-fm__device-type">${this.escapeHtml(device.type)}</p>` : ''}
        </div>
        ${device.status ? `<div class="myio-fm__device-status ${statusClass}"></div>` : ''}
      </div>
    `;
  }

  private getDefaultDeviceIcon(type?: string, context?: string): string {
    const t = (type || '').toLowerCase();
    const c = (context || '').toLowerCase();

    if (t.includes('hidro') || c.includes('hidro')) return '💧';
    if (t.includes('caixa') || t.includes('tank')) return '🛢️';
    if (t.includes('solenoide')) return '🚰';
    if (t.includes('termostato') || c.includes('termostato')) return '🌡️';
    if (t.includes('3f_medidor') || c === 'stores') return '🏬';
    if (c === 'entrada') return '📥';
    if (c === 'equipments') return '⚙️';
    if (t.includes('lamp')) return '💡';
    if (t.includes('remote')) return '🔘';
    return '📟';
  }

  private renderCategory(cat: FilterCategory): string {
    const isSelected = this.selectedCategories.has(cat.id);
    return `
      <div class="myio-fm__category${isSelected ? ' myio-fm__category--selected' : ''}" data-category-id="${cat.id}">
        <div class="myio-fm__checkbox">
          ${ICON_CHECK}
        </div>
        ${cat.icon ? `<span class="myio-fm__category-icon">${cat.icon}</span>` : ''}
        <div class="myio-fm__category-info">
          <p class="myio-fm__category-label">${this.escapeHtml(cat.label)}</p>
          <span class="myio-fm__category-count">${cat.count} ${cat.count === 1 ? 'item' : 'itens'}</span>
        </div>
      </div>
    `;
  }

  private renderSortOption(opt: FilterSortOption): string {
    const isSelected = this.selectedSortId === opt.id;
    const sortIcon = opt.direction === 'desc' ? ICON_SORT_DESC : ICON_SORT_ASC;
    return `
      <div class="myio-fm__sort-option${isSelected ? ' myio-fm__sort-option--selected' : ''}" data-sort-id="${opt.id}">
        <div class="myio-fm__sort-radio"></div>
        <span class="myio-fm__sort-icon">${sortIcon}</span>
        <span class="myio-fm__sort-label">${this.escapeHtml(opt.label)}</span>
      </div>
    `;
  }

  private bindEvents(): void {
    // Close button
    this.overlay.querySelector('.myio-fm__close')?.addEventListener('click', () => {
      this.hide();
      this.options.onClose();
    });

    // Overlay click (outside modal)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
        this.options.onClose();
      }
    });

    // Category clicks
    this.overlay.querySelectorAll('.myio-fm__category').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-category-id');
        if (id) {
          this.toggleCategory(id);
        }
      });
    });

    // Sort option clicks
    this.overlay.querySelectorAll('.myio-fm__sort-option').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-sort-id');
        if (id) {
          this.selectSortOption(id);
        }
      });
    });

    // Select all/none categories
    this.overlay.querySelector('[data-action="select-all"]')?.addEventListener('click', () => {
      this.selectAllCategories();
    });

    this.overlay.querySelector('[data-action="select-none"]')?.addEventListener('click', () => {
      this.selectNoCategories();
    });

    // Device grid events
    this.overlay.querySelectorAll('.myio-fm__device-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-device-id');
        if (id) {
          this.toggleDevice(id);
        }
      });
    });

    // Select all/none devices
    this.overlay.querySelector('[data-action="select-all-devices"]')?.addEventListener('click', () => {
      this.selectAllDevices();
    });

    this.overlay.querySelector('[data-action="select-no-devices"]')?.addEventListener('click', () => {
      this.selectNoDevices();
    });

    // Device search
    const searchInput = this.overlay.querySelector('[data-action="device-search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDevices((e.target as HTMLInputElement).value);
      });
    }

    // Cancel button
    this.overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.hide();
      this.options.onClose();
    });

    // Apply button
    this.overlay.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
      this.applyFilter();
    });

    // Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.hide();
      this.options.onClose();
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  };

  private toggleCategory(id: string): void {
    if (this.selectedCategories.has(id)) {
      this.selectedCategories.delete(id);
    } else {
      this.selectedCategories.add(id);
    }
    this.updateCategoryUI(id);
  }

  private updateCategoryUI(id: string): void {
    const el = this.overlay.querySelector(`[data-category-id="${id}"]`);
    if (el) {
      el.classList.toggle('myio-fm__category--selected', this.selectedCategories.has(id));
    }
  }

  private selectAllCategories(): void {
    this.options.categories.forEach(cat => {
      this.selectedCategories.add(cat.id);
      this.updateCategoryUI(cat.id);
    });
  }

  private selectNoCategories(): void {
    this.selectedCategories.clear();
    this.options.categories.forEach(cat => {
      this.updateCategoryUI(cat.id);
    });
  }

  private selectSortOption(id: string): void {
    this.selectedSortId = id;
    // Update UI
    this.overlay.querySelectorAll('.myio-fm__sort-option').forEach(el => {
      el.classList.toggle('myio-fm__sort-option--selected', el.getAttribute('data-sort-id') === id);
    });
  }

  // Device selection methods
  private toggleDevice(id: string): void {
    if (this.selectedDeviceIds.has(id)) {
      this.selectedDeviceIds.delete(id);
    } else {
      this.selectedDeviceIds.add(id);
    }
    this.updateDeviceUI(id);
    this.updateDeviceCount();
  }

  private updateDeviceUI(id: string): void {
    const el = this.overlay.querySelector(`[data-device-id="${id}"]`);
    if (el) {
      el.classList.toggle('myio-fm__device-item--selected', this.selectedDeviceIds.has(id));
    }
  }

  private updateDeviceCount(): void {
    const countEl = this.overlay.querySelector('.myio-fm__device-count');
    if (countEl) {
      const totalCount = this.options.devices?.length || 0;
      countEl.textContent = `${this.selectedDeviceIds.size}/${totalCount}`;
    }
  }

  private selectAllDevices(): void {
    const devices = this.options.devices || [];
    // Only select visible devices (not filtered out by search)
    const visibleDevices = devices.filter(d => {
      const el = this.overlay.querySelector(`[data-device-id="${d.id}"]`);
      return el && !el.classList.contains('myio-fm__device-item--hidden');
    });

    visibleDevices.forEach(device => {
      this.selectedDeviceIds.add(device.id);
      this.updateDeviceUI(device.id);
    });
    this.updateDeviceCount();
  }

  private selectNoDevices(): void {
    const devices = this.options.devices || [];
    // Only deselect visible devices (not filtered out by search)
    const visibleDevices = devices.filter(d => {
      const el = this.overlay.querySelector(`[data-device-id="${d.id}"]`);
      return el && !el.classList.contains('myio-fm__device-item--hidden');
    });

    visibleDevices.forEach(device => {
      this.selectedDeviceIds.delete(device.id);
      this.updateDeviceUI(device.id);
    });
    this.updateDeviceCount();
  }

  private filterDevices(query: string): void {
    this.deviceSearchQuery = query.toLowerCase().trim();
    this.overlay.querySelectorAll('.myio-fm__device-item').forEach(el => {
      const label = el.getAttribute('data-device-label') || '';
      const matches = !this.deviceSearchQuery || label.includes(this.deviceSearchQuery);
      el.classList.toggle('myio-fm__device-item--hidden', !matches);
    });
  }

  private applyFilter(): void {
    const selectedSort = this.options.sortOptions.find(o => o.id === this.selectedSortId) || null;
    const selectedDeviceIds = this.showDeviceGrid ? Array.from(this.selectedDeviceIds) : undefined;
    this.options.onApply(Array.from(this.selectedCategories), selectedSort, selectedDeviceIds);
    this.hide();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ────────────────────────────────────────────
// Default sort options for common domains
// ────────────────────────────────────────────

export const WATER_SORT_OPTIONS: FilterSortOption[] = [
  { id: 'consumption-desc', label: 'Maior consumo (m³)', field: 'consumption', direction: 'desc' },
  { id: 'consumption-asc', label: 'Menor consumo (m³)', field: 'consumption', direction: 'asc' },
  { id: 'level-desc', label: 'Maior nível (%)', field: 'water_level', direction: 'desc' },
  { id: 'level-asc', label: 'Menor nível (%)', field: 'water_level', direction: 'asc' },
  { id: 'label-asc', label: 'Nome (A-Z)', field: 'label', direction: 'asc' },
  { id: 'label-desc', label: 'Nome (Z-A)', field: 'label', direction: 'desc' },
];

export const ENERGY_SORT_OPTIONS: FilterSortOption[] = [
  { id: 'consumption-desc', label: 'Maior consumo (kWh)', field: 'consumption', direction: 'desc' },
  { id: 'consumption-asc', label: 'Menor consumo (kWh)', field: 'consumption', direction: 'asc' },
  { id: 'label-asc', label: 'Nome (A-Z)', field: 'label', direction: 'asc' },
  { id: 'label-desc', label: 'Nome (Z-A)', field: 'label', direction: 'desc' },
];

export const TEMPERATURE_SORT_OPTIONS: FilterSortOption[] = [
  { id: 'temp-desc', label: 'Maior temperatura', field: 'temperature', direction: 'desc' },
  { id: 'temp-asc', label: 'Menor temperatura', field: 'temperature', direction: 'asc' },
  { id: 'label-asc', label: 'Nome (A-Z)', field: 'label', direction: 'asc' },
  { id: 'label-desc', label: 'Nome (Z-A)', field: 'label', direction: 'desc' },
];

export const MOTOR_SORT_OPTIONS: FilterSortOption[] = [
  { id: 'consumption-desc', label: 'Maior consumo', field: 'consumption', direction: 'desc' },
  { id: 'consumption-asc', label: 'Menor consumo', field: 'consumption', direction: 'asc' },
  { id: 'label-asc', label: 'Nome (A-Z)', field: 'label', direction: 'asc' },
  { id: 'label-desc', label: 'Nome (Z-A)', field: 'label', direction: 'desc' },
];

// ────────────────────────────────────────────
// Water device type categories
// ────────────────────────────────────────────

export const WATER_DEVICE_CATEGORIES = {
  HIDROMETRO: { id: 'HIDROMETRO', label: 'Hidrômetros', icon: '💧' },
  CAIXA_DAGUA: { id: 'CAIXA_DAGUA', label: 'Caixas d\'Água', icon: '🛢️' },
  SOLENOIDE: { id: 'SOLENOIDE', label: 'Solenoides', icon: '🔌' },
};

export default FilterModalComponent;
