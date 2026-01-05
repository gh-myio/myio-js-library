/**
 * RFC-0113: Header Component Library
 * Filter Modal for shopping selection
 */

import {
  Shopping,
  HeaderFilterModalParams,
  HeaderFilterModalInstance,
  HEADER_CSS_PREFIX,
} from './types';

/**
 * HeaderFilterModal - Modal for filtering shoppings
 */
export class HeaderFilterModal implements HeaderFilterModalInstance {
  private element: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private shoppings: Shopping[] = [];
  private selectedShoppings: Shopping[] = [];
  private searchQuery: string = '';
  private isOpen: boolean = false;

  // Callbacks
  private onApply?: (selection: Shopping[]) => void;
  private onClose?: () => void;

  // DOM references
  private searchInputEl: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private selectedChipsEl: HTMLElement | null = null;

  constructor(params: HeaderFilterModalParams) {
    this.shoppings = params.shoppings || [];
    this.selectedShoppings = params.selectedShoppings || [];
    this.onApply = params.onApply;
    this.onClose = params.onClose;
  }

  /**
   * Open the modal
   */
  public open(): void {
    if (this.isOpen) return;

    // Pre-select all customers by default if none are selected
    if (this.selectedShoppings.length === 0 && this.shoppings.length > 0) {
      this.selectedShoppings = [...this.shoppings];
    }

    this.injectStyles();
    this.render();
    this.bindEvents();
    this.isOpen = true;

    // Focus search input
    setTimeout(() => {
      this.searchInputEl?.focus();
    }, 100);
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (!this.isOpen) return;

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
    this.searchInputEl = null;
    this.listEl = null;
    this.selectedChipsEl = null;
    this.isOpen = false;

    this.onClose?.();
  }

  /**
   * Update available shoppings
   */
  public updateShoppings(shoppings: Shopping[]): void {
    this.shoppings = shoppings;
    if (this.isOpen) {
      this.renderList();
    }
  }

  /**
   * Get current selection
   */
  public getSelection(): Shopping[] {
    return [...this.selectedShoppings];
  }

  /**
   * Destroy the modal
   */
  public destroy(): void {
    this.close();
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    const styleId = `${HEADER_CSS_PREFIX}-filter-modal-styles`;
    if (document.getElementById(styleId)) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = styleId;
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
/* RFC-0113: Header Filter Modal Styles */

.${HEADER_CSS_PREFIX}-filter-modal {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.${HEADER_CSS_PREFIX}-filter-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(16, 24, 40, 0.45);
}

.${HEADER_CSS_PREFIX}-filter-card {
  position: relative;
  z-index: 1;
  width: min(700px, 92vw);
  max-height: 85vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.${HEADER_CSS_PREFIX}-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e6eef5;
}

.${HEADER_CSS_PREFIX}-filter-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1c2743;
  margin: 0;
}

.${HEADER_CSS_PREFIX}-filter-close {
  border: 0;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  color: #6b7a90;
  transition: color 0.2s;
}

.${HEADER_CSS_PREFIX}-filter-close:hover {
  color: #1c2743;
}

.${HEADER_CSS_PREFIX}-filter-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  overflow: hidden;
}

.${HEADER_CSS_PREFIX}-filter-search {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid #bbd0e3;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.${HEADER_CSS_PREFIX}-filter-search:focus-within {
  border-color: #4f93ce;
  box-shadow: 0 0 0 3px rgba(79, 147, 206, 0.15);
}

.${HEADER_CSS_PREFIX}-filter-search svg {
  color: #6b7a90;
  flex-shrink: 0;
}

.${HEADER_CSS_PREFIX}-filter-search input {
  flex: 1;
  border: 0;
  outline: 0;
  font-size: 15px;
  background: transparent;
}

.${HEADER_CSS_PREFIX}-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  min-height: 32px;
}

.${HEADER_CSS_PREFIX}-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e0f2fe;
  color: #0369a1;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.${HEADER_CSS_PREFIX}-filter-chip-remove {
  border: 0;
  background: transparent;
  color: #0369a1;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  margin-left: 2px;
}

.${HEADER_CSS_PREFIX}-filter-chip-remove:hover {
  color: #0c4a6e;
}

.${HEADER_CSS_PREFIX}-filter-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.${HEADER_CSS_PREFIX}-filter-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #cfdce8;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.${HEADER_CSS_PREFIX}-filter-item:hover {
  background: #f7faff;
}

.${HEADER_CSS_PREFIX}-filter-item[data-selected="true"] {
  background: #eff6ff;
  border-color: #3b82f6;
}

.${HEADER_CSS_PREFIX}-filter-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #6991b7;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 0.15s, border-color 0.15s;
}

.${HEADER_CSS_PREFIX}-filter-item[data-selected="true"] .${HEADER_CSS_PREFIX}-filter-checkbox {
  background: #3b82f6;
  border-color: #3b82f6;
}

.${HEADER_CSS_PREFIX}-filter-checkbox svg {
  color: white;
  opacity: 0;
  transition: opacity 0.15s;
}

.${HEADER_CSS_PREFIX}-filter-item[data-selected="true"] .${HEADER_CSS_PREFIX}-filter-checkbox svg {
  opacity: 1;
}

.${HEADER_CSS_PREFIX}-filter-item-name {
  font-weight: 600;
  color: #1c2743;
}

.${HEADER_CSS_PREFIX}-filter-item-id {
  font-size: 12px;
  color: #6b7a90;
  margin-left: auto;
}

.${HEADER_CSS_PREFIX}-filter-empty {
  text-align: center;
  color: #6b7a90;
  padding: 40px 20px;
}

.${HEADER_CSS_PREFIX}-filter-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid #e6eef5;
  gap: 12px;
}

.${HEADER_CSS_PREFIX}-filter-count {
  font-size: 14px;
  color: #6b7a90;
}

.${HEADER_CSS_PREFIX}-filter-actions {
  display: flex;
  gap: 10px;
}

.${HEADER_CSS_PREFIX}-filter-btn {
  border: 0;
  border-radius: 10px;
  padding: 10px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s;
}

.${HEADER_CSS_PREFIX}-filter-btn:hover {
  filter: brightness(0.95);
}

.${HEADER_CSS_PREFIX}-filter-btn:active {
  transform: scale(0.98);
}

.${HEADER_CSS_PREFIX}-filter-btn--clear {
  background: transparent;
  color: #6b7a90;
}

.${HEADER_CSS_PREFIX}-filter-btn--clear:hover {
  color: #1c2743;
}

.${HEADER_CSS_PREFIX}-filter-btn--apply {
  background: #1d4f91;
  color: #fff;
}

.${HEADER_CSS_PREFIX}-filter-btn--apply:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
  }

  /**
   * Render the modal
   */
  private render(): void {
    this.element = document.createElement('div');
    this.element.className = `${HEADER_CSS_PREFIX}-filter-modal`;
    this.element.innerHTML = this.buildHTML();
    document.body.appendChild(this.element);

    // Cache DOM references
    this.searchInputEl = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-search input`);
    this.listEl = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-list`);
    this.selectedChipsEl = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-chips`);

    // Render dynamic content
    this.renderList();
    this.renderChips();
    this.updateCount();
  }

  /**
   * Build HTML structure
   */
  private buildHTML(): string {
    return `
<div class="${HEADER_CSS_PREFIX}-filter-backdrop"></div>
<div class="${HEADER_CSS_PREFIX}-filter-card">
  <header class="${HEADER_CSS_PREFIX}-filter-header">
    <h2 class="${HEADER_CSS_PREFIX}-filter-title">Filtrar Shoppings</h2>
    <button class="${HEADER_CSS_PREFIX}-filter-close" title="Fechar">&times;</button>
  </header>

  <div class="${HEADER_CSS_PREFIX}-filter-body">
    <div class="${HEADER_CSS_PREFIX}-filter-search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
      <input type="text" placeholder="Buscar shopping..." />
    </div>

    <div class="${HEADER_CSS_PREFIX}-filter-chips"></div>

    <div class="${HEADER_CSS_PREFIX}-filter-list"></div>
  </div>

  <footer class="${HEADER_CSS_PREFIX}-filter-footer">
    <span class="${HEADER_CSS_PREFIX}-filter-count">
      ${this.selectedShoppings.length} selecionado(s)
    </span>
    <div class="${HEADER_CSS_PREFIX}-filter-actions">
      <button class="${HEADER_CSS_PREFIX}-filter-btn ${HEADER_CSS_PREFIX}-filter-btn--clear">Limpar</button>
      <button class="${HEADER_CSS_PREFIX}-filter-btn ${HEADER_CSS_PREFIX}-filter-btn--apply">Aplicar Filtro</button>
    </div>
  </footer>
</div>
`;
  }

  /**
   * Bind events
   */
  private bindEvents(): void {
    if (!this.element) return;

    // Backdrop click
    const backdrop = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-backdrop`);
    backdrop?.addEventListener('click', () => this.close());

    // Close button
    const closeBtn = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-close`);
    closeBtn?.addEventListener('click', () => this.close());

    // Search input
    this.searchInputEl?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderList();
    });

    // Clear button
    const clearBtn = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-btn--clear`);
    clearBtn?.addEventListener('click', () => {
      this.selectedShoppings = [];
      this.renderList();
      this.renderChips();
      this.updateCount();
    });

    // Apply button
    const applyBtn = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-btn--apply`);
    applyBtn?.addEventListener('click', () => {
      this.onApply?.(this.selectedShoppings);
      this.close();
    });

    // Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };

  /**
   * Render the shopping list
   */
  private renderList(): void {
    if (!this.listEl) return;

    const filtered = this.shoppings.filter((s) =>
      s.name.toLowerCase().includes(this.searchQuery)
    );

    if (filtered.length === 0) {
      this.listEl.innerHTML = `
        <div class="${HEADER_CSS_PREFIX}-filter-empty">
          ${this.searchQuery ? 'Nenhum shopping encontrado' : 'Nenhum shopping disponivel'}
        </div>
      `;
      return;
    }

    this.listEl.innerHTML = filtered
      .map((shopping) => {
        const isSelected = this.selectedShoppings.some((s) => s.value === shopping.value);
        return `
          <div class="${HEADER_CSS_PREFIX}-filter-item" data-value="${shopping.value}" data-selected="${isSelected}">
            <div class="${HEADER_CSS_PREFIX}-filter-checkbox">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span class="${HEADER_CSS_PREFIX}-filter-item-name">${shopping.name}</span>
            <span class="${HEADER_CSS_PREFIX}-filter-item-id">${shopping.value}</span>
          </div>
        `;
      })
      .join('');

    // Bind click events
    this.listEl.querySelectorAll(`.${HEADER_CSS_PREFIX}-filter-item`).forEach((item) => {
      item.addEventListener('click', () => {
        const value = (item as HTMLElement).dataset.value;
        this.toggleSelection(value!);
      });
    });
  }

  /**
   * Toggle shopping selection
   */
  private toggleSelection(value: string): void {
    const index = this.selectedShoppings.findIndex((s) => s.value === value);
    if (index >= 0) {
      this.selectedShoppings.splice(index, 1);
    } else {
      const shopping = this.shoppings.find((s) => s.value === value);
      if (shopping) {
        this.selectedShoppings.push(shopping);
      }
    }
    this.renderList();
    this.renderChips();
    this.updateCount();
  }

  /**
   * Render selected chips
   */
  private renderChips(): void {
    if (!this.selectedChipsEl) return;

    if (this.selectedShoppings.length === 0) {
      this.selectedChipsEl.innerHTML = '<span style="color: #94a3b8; font-size: 13px;">Nenhum shopping selecionado</span>';
      return;
    }

    this.selectedChipsEl.innerHTML = this.selectedShoppings
      .map((shopping) => `
        <span class="${HEADER_CSS_PREFIX}-filter-chip">
          ${shopping.name}
          <button class="${HEADER_CSS_PREFIX}-filter-chip-remove" data-value="${shopping.value}">&times;</button>
        </span>
      `)
      .join('');

    // Bind remove events
    this.selectedChipsEl.querySelectorAll(`.${HEADER_CSS_PREFIX}-filter-chip-remove`).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = (btn as HTMLElement).dataset.value;
        this.toggleSelection(value!);
      });
    });
  }

  /**
   * Update count display and apply button state
   */
  private updateCount(): void {
    if (!this.element) return;

    const count = this.selectedShoppings.length;

    // Update count text
    const countEl = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-count`);
    if (countEl) {
      countEl.textContent = `${count} selecionado(s)`;
    }

    // Disable apply button if no selection (minimum 1 required)
    const applyBtn = this.element.querySelector(`.${HEADER_CSS_PREFIX}-filter-btn--apply`) as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = count === 0;
    }
  }
}
