/**
 * MYIO DraggableCard Component
 * Reusable card component with full drag-and-drop support, checkbox synchronization, and accessibility features
 * 
 * @version 1.0.0
 * @author MYIO Frontend Guild
 */
/* eslint-disable */

class MyIODraggableCard {
  constructor(container, entity, options = {}) {
    if (!container || !entity || !entity.id) {
      throw new Error('Container and entity with id are required');
    }

    this.container = container;
    this.entity = entity;
    this.options = {
      showCheckbox: true,
      draggable: true,
      className: '',
      ...options
    };

    this.cardElement = null;
    this.checkbox = null;
    this.isDragging = false;
    this.touchStartTime = 0;
    this.touchTimer = null;
    this.destroyed = false;

    this._init();
  }

  // Public Methods
  destroy() {
    if (this.destroyed) return;

    this._removeEventListeners();
    
    if (this.cardElement && this.cardElement.parentNode) {
      this.cardElement.parentNode.removeChild(this.cardElement);
    }

    this.destroyed = true;
  }

  updateEntity(newEntity) {
    if (this.destroyed) return;

    this.entity = { ...this.entity, ...newEntity };
    this._updateCardContent();
  }

  setSelected(selected) {
    if (this.destroyed) return;

    if (this.checkbox) {
      this.checkbox.checked = selected;
    }
    
    this._updateSelectionState(selected);
  }

  // Private Methods
  _init() {
    this._createCardElement();
    this._attachEventListeners();
    this._updateSelectionState(this._getSelectionStore()?.isSelected(this.entity.id) || false);
  }

  _createCardElement() {
    if (typeof document === 'undefined') return;
    
    const card = document.createElement('div');
    card.className = `myio-draggable-card ${this.options.className}`.trim();
    card.setAttribute('data-entity-id', this.entity.id);
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    
    if (this.options.draggable) {
      card.draggable = true;
      card.setAttribute('aria-grabbed', 'false');
    }

    card.innerHTML = this._generateCardHTML();
    
    this.cardElement = card;
    this.checkbox = card.querySelector('.card-checkbox');
    
    this.container.appendChild(card);
  }

  _generateCardHTML() {
    const { id, name, icon, group, lastValue, unit, status } = this.entity;
    const checkboxHtml = this.options.showCheckbox 
      ? `<input type="checkbox" class="card-checkbox" aria-label="Select ${name}">` 
      : '';

    return `
      <div class="card-header">
        ${checkboxHtml}
        <div class="card-icon card-icon-${icon}">
          ${this._getIconSvg(icon)}
        </div>
        <div class="card-status card-status-${status}"></div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${this._escapeHtml(name)}</h3>
        <p class="card-group">${this._escapeHtml(group)}</p>
        <div class="card-value">
          <span class="value">${this._formatValue(lastValue)}</span>
          <span class="unit">${this._escapeHtml(unit)}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-id">${this._escapeHtml(id)}</span>
      </div>
    `;
  }

  _attachEventListeners() {
    if (!this.cardElement) return;

    // Mouse events
    this.cardElement.addEventListener('dragstart', this._handleDragStart.bind(this));
    this.cardElement.addEventListener('dragend', this._handleDragEnd.bind(this));
    this.cardElement.addEventListener('click', this._handleClick.bind(this));

    // Touch events for mobile
    this.cardElement.addEventListener('touchstart', this._handleTouchStart.bind(this), { passive: false });
    this.cardElement.addEventListener('touchmove', this._handleTouchMove.bind(this), { passive: false });
    this.cardElement.addEventListener('touchend', this._handleTouchEnd.bind(this));

    // Keyboard events
    this.cardElement.addEventListener('keydown', this._handleKeyDown.bind(this));

    // Checkbox events
    if (this.checkbox) {
      this.checkbox.addEventListener('change', this._handleCheckboxChange.bind(this));
      this.checkbox.addEventListener('click', this._handleCheckboxClick.bind(this));
    }

    // Selection store events
    const store = this._getSelectionStore();
    if (store) {
      this._selectionChangeHandler = (data) => {
        const isSelected = data.selectedIds.includes(this.entity.id);
        this._updateSelectionState(isSelected);
      };
      store.on('selection:change', this._selectionChangeHandler);
    }
  }

  _removeEventListeners() {
    if (!this.cardElement) return;

    // Remove selection store listener
    const store = this._getSelectionStore();
    if (store && this._selectionChangeHandler) {
      store.off('selection:change', this._selectionChangeHandler);
    }

    // Clear the selection change handler reference
    this._selectionChangeHandler = null;
  }

  _handleDragStart(event) {
    if (!this.options.draggable) {
      event.preventDefault();
      return;
    }

    this.isDragging = true;
    this.cardElement.setAttribute('aria-grabbed', 'true');
    this.cardElement.classList.add('dragging');

    // Set drag data
    event.dataTransfer.setData('text/myio-id', this.entity.id);
    event.dataTransfer.setData('text/plain', this.entity.id);
    event.dataTransfer.effectAllowed = 'copy';

    // Track drag start
    const store = this._getSelectionStore();
    if (store) {
      store.startDrag(this.entity.id);
    }

    this._announceToScreenReader(`Started dragging ${this.entity.name}`);
  }

  _handleDragEnd(event) {
    this.isDragging = false;
    this.cardElement.setAttribute('aria-grabbed', 'false');
    this.cardElement.classList.remove('dragging');

    this._announceToScreenReader(`Finished dragging ${this.entity.name}`);
  }

  _handleTouchStart(event) {
    if (!this.options.draggable) return;

    this.touchStartTime = Date.now();
    
    // Start long-press timer (500ms)
    this.touchTimer = setTimeout(() => {
      this._startTouchDrag(event);
    }, 500);
  }

  _handleTouchMove(event) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    if (this.isDragging) {
      event.preventDefault();
      // Handle touch drag movement here if needed
    }
  }

  _handleTouchEnd(event) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    if (this.isDragging) {
      this._endTouchDrag(event);
    }
  }

  _startTouchDrag(event) {
    if (!this.options.draggable) return;

    this.isDragging = true;
    this.cardElement.classList.add('touch-dragging');
    
    // Provide haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this._announceToScreenReader(`Touch drag started for ${this.entity.name}`);
  }

  _endTouchDrag(event) {
    this.isDragging = false;
    this.cardElement.classList.remove('touch-dragging');

    this._announceToScreenReader(`Touch drag ended for ${this.entity.name}`);
  }

  _handleClick(event) {
    // Don't handle click if it's on the checkbox
    if (event.target === this.checkbox) return;

    // Don't handle click during drag
    if (this.isDragging) return;

    // Toggle selection on card click
    const store = this._getSelectionStore();
    if (store) {
      store.toggle(this.entity.id);
    }
  }

  _handleKeyDown(event) {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (event.shiftKey) {
          // Shift+Enter opens comparison
          const store = this._getSelectionStore();
          if (store) {
            store.openComparison();
          }
        } else {
          // Enter/Space toggles selection
          const store = this._getSelectionStore();
          if (store) {
            store.toggle(this.entity.id);
          }
        }
        break;
      
      case 'Delete':
      case 'Backspace': {
        event.preventDefault();
        const store = this._getSelectionStore();
        if (store) {
          store.remove(this.entity.id);
        }
        break;
      }
    }
  }

  _handleCheckboxChange(event) {
    event.stopPropagation();
    
    const store = this._getSelectionStore();
    if (store) {
      store.syncFromCheckbox(this.entity.id, event.target.checked);
    }
  }

  _handleCheckboxClick(event) {
    event.stopPropagation();
  }

  _updateSelectionState(isSelected) {
    if (this.destroyed) return;

    if (this.checkbox) {
      this.checkbox.checked = isSelected;
    }

    this.cardElement.classList.toggle('selected', isSelected);
    this.cardElement.setAttribute('aria-selected', isSelected.toString());

    // Update ARIA label
    const action = isSelected ? 'selected' : 'not selected';
    this.cardElement.setAttribute('aria-label', 
      `${this.entity.name}, ${this.entity.group}, ${action}`);
  }

  _updateCardContent() {
    if (this.destroyed) return;

    const titleElement = this.cardElement.querySelector('.card-title');
    const groupElement = this.cardElement.querySelector('.card-group');
    const valueElement = this.cardElement.querySelector('.value');
    const unitElement = this.cardElement.querySelector('.unit');
    const idElement = this.cardElement.querySelector('.card-id');

    if (titleElement) titleElement.textContent = this.entity.name || '';
    if (groupElement) groupElement.textContent = this.entity.group || '';
    if (valueElement) valueElement.textContent = this._formatValue(this.entity.lastValue);
    if (unitElement) unitElement.textContent = this.entity.unit || '';
    if (idElement) idElement.textContent = this.entity.id || '';

    // Update icon and status
    const iconElement = this.cardElement.querySelector('.card-icon');
    const statusElement = this.cardElement.querySelector('.card-status');
    
    if (iconElement) {
      iconElement.className = `card-icon card-icon-${this.entity.icon || 'generic'}`;
      iconElement.innerHTML = this._getIconSvg(this.entity.icon || 'generic');
    }
    
    if (statusElement) {
      statusElement.className = `card-status card-status-${this.entity.status || 'unknown'}`;
    }
  }

  _getSelectionStore() {
    // Try to get from global scope
    if (typeof globalThis !== 'undefined' && globalThis.window?.MyIOSelectionStore) {
      return globalThis.window.MyIOSelectionStore;
    }
    
    // Try to get from window
    if (typeof globalThis !== 'undefined' && globalThis.window && globalThis.window.MyIOSelectionStore) {
      return globalThis.window.MyIOSelectionStore;
    }
    
    return null;
  }

  _formatValue(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number(value));
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    if (typeof document === 'undefined') return text;
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _getIconSvg(iconType) {
    const icons = {
      energy: '<svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      water: '<svg viewBox="0 0 24 24"><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"/></svg>',
      temp: '<svg viewBox="0 0 24 24"><path d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4z"/></svg>',
      net: '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
      alert: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      generic: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
    };
    
    return icons[iconType] || icons.generic;
  }

  _announceToScreenReader(message) {
    const store = this._getSelectionStore();
    if (store && store.announceToScreenReader) {
      store.announceToScreenReader(message);
    }
  }
}

// Export to global scope for browser usage
if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  globalThis.window.MyIODraggableCard = MyIODraggableCard;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MyIODraggableCard };
}

// Export for ES modules
export { MyIODraggableCard };
