/**
 * RFC-0104: Annotation Indicator for Device Cards
 *
 * A floating indicator that shows annotation status on device cards.
 * Colors indicate the highest priority annotation type:
 * - Red: Has pending annotations
 * - Yellow: Has maintenance annotations
 * - Green: Has activity annotations
 * - Blue: Has observation annotations
 * - Gray (50% opacity): No annotations
 */

import type {
  Annotation,
  AnnotationType,
  LogAnnotationsAttribute,
} from '../components/premium-modals/settings/annotations/types';

import {
  ANNOTATION_TYPE_COLORS,
  ANNOTATION_TYPE_LABELS,
} from '../components/premium-modals/settings/annotations/types';

// ============================================
// TYPES
// ============================================

export type AnnotationIndicatorTheme = 'light' | 'dark';

export interface AnnotationIndicatorConfig {
  container: HTMLElement;
  deviceId: string;
  jwtToken?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'middle-right' | 'middle-left';
  size?: 'small' | 'medium' | 'large';
  theme?: AnnotationIndicatorTheme;
  onClick?: () => void;
}

export interface AnnotationSummary {
  total: number;
  pending: number;
  maintenance: number;
  activity: number;
  observation: number;
  overdueCount: number;
  latestAnnotation?: Annotation;
  highestPriorityType: AnnotationType | null;
}

// ============================================
// CSS STYLES
// ============================================

const INDICATOR_STYLES = `
.annotation-indicator {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.annotation-indicator--top-right {
  top: 8px;
  right: 8px;
}

.annotation-indicator--top-left {
  top: 8px;
  left: 8px;
}

.annotation-indicator--bottom-right {
  bottom: 8px;
  right: 8px;
}

.annotation-indicator--bottom-left {
  bottom: 8px;
  left: 8px;
}

.annotation-indicator--middle-right {
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
}

.annotation-indicator--middle-left {
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
}

.annotation-indicator--middle-right:hover,
.annotation-indicator--middle-left:hover {
  transform: translateY(-50%) scale(1.1);
}

.annotation-indicator--small {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.annotation-indicator--medium {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.annotation-indicator--large {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.annotation-indicator__icon {
  width: 60%;
  height: 60%;
}

.annotation-indicator--empty {
  opacity: 0.4;
  background: rgba(0, 0, 0, 0.1);
}

.annotation-indicator:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.annotation-indicator--empty:hover {
  opacity: 0.6;
}

/* Tooltip - Base styles */
.annotation-indicator__tooltip {
  position: fixed;
  min-width: 260px;
  max-width: 320px;
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition: all 0.3s ease;
  z-index: 99999;
  pointer-events: auto;
}

.annotation-indicator__tooltip.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.annotation-indicator__tooltip.closing {
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.4s ease;
}

.annotation-indicator__tooltip.pinned {
  box-shadow: 0 0 0 2px #6366f1, 0 8px 24px rgba(0, 0, 0, 0.2) !important;
}

.annotation-indicator__tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
  min-width: auto !important;
}

.annotation-indicator__tooltip.maximized .annotation-indicator__tooltip-body {
  flex: 1;
  overflow-y: auto;
}

.annotation-indicator__tooltip.dragging {
  transition: none !important;
  cursor: move;
}

/* Tooltip Header */
.annotation-indicator__tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px 10px 0 0;
  cursor: move;
  user-select: none;
}

.annotation-indicator__tooltip-header-title {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.annotation-indicator__tooltip-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.annotation-indicator__tooltip-header-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #64748b;
}

.annotation-indicator__tooltip-header-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #1e293b;
}

.annotation-indicator__tooltip-header-btn.pinned {
  background: #6366f1;
  color: white;
}

.annotation-indicator__tooltip-header-btn.pinned:hover {
  background: #4f46e5;
  color: white;
}

.annotation-indicator__tooltip-header-btn svg {
  width: 12px;
  height: 12px;
}

.annotation-indicator__tooltip-body {
  padding: 12px 14px;
}

.annotation-indicator__tooltip-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.annotation-indicator__tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.annotation-indicator__tooltip-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.annotation-indicator__tooltip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.annotation-indicator__tooltip-value {
  font-weight: 600;
}

.annotation-indicator__tooltip-latest {
  margin-top: 10px;
  padding-top: 10px;
  font-size: 11px;
}

.annotation-indicator__tooltip-latest-label {
  margin-bottom: 4px;
}

.annotation-indicator__tooltip-latest-text {
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.annotation-indicator__tooltip-latest-meta {
  font-size: 10px;
  margin-top: 4px;
}

.annotation-indicator__tooltip-empty {
  text-align: center;
  padding: 8px 0;
}

/* Light Theme (Default) */
.annotation-indicator__tooltip--light {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  color: #1a1a2e;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-header {
  background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-header-title {
  color: #1a1a2e;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #1a1a2e;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-label {
  color: #495057;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-value {
  color: #1a1a2e;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-latest {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-latest-label {
  color: #6c757d;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-latest-text {
  color: #343a40;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-latest-meta {
  color: #868e96;
}

.annotation-indicator__tooltip--light .annotation-indicator__tooltip-empty {
  color: #6c757d;
}

/* Dark Theme */
.annotation-indicator__tooltip--dark {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  color: #fff;
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-header {
  background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-header-title {
  color: #fff;
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-header-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-header-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-title {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-label {
  color: rgba(255, 255, 255, 0.8);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-value {
  color: #fff;
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-latest {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-latest-label {
  color: rgba(255, 255, 255, 0.6);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-latest-text {
  color: rgba(255, 255, 255, 0.9);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-latest-meta {
  color: rgba(255, 255, 255, 0.5);
}

.annotation-indicator__tooltip--dark .annotation-indicator__tooltip-empty {
  color: rgba(255, 255, 255, 0.6);
}
`;

// ============================================
// ANNOTATION INDICATOR CLASS
// ============================================

export class AnnotationIndicator {
  private config: AnnotationIndicatorConfig;
  private element: HTMLElement | null = null;
  private tooltipElement: HTMLElement | null = null;
  private annotations: Annotation[] = [];
  private summary: AnnotationSummary | null = null;
  private styleInjected = false;

  // Tooltip state
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _isMouseOverTooltip = false;
  private _pinnedCounter = 0;

  constructor(config: AnnotationIndicatorConfig) {
    this.config = {
      position: 'middle-right',
      size: 'medium',
      theme: 'light',
      ...config,
    };
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Initialize the indicator - fetches annotations and renders
   */
  public async init(): Promise<void> {
    this.injectStyles();
    await this.loadAnnotations();
    this.render();
  }

  /**
   * Update annotations data and re-render
   */
  public async refresh(): Promise<void> {
    await this.loadAnnotations();
    this.render();
  }

  /**
   * Update with pre-loaded annotations (avoids API call)
   */
  public updateWithAnnotations(annotations: Annotation[]): void {
    this.annotations = annotations;
    this.summary = this.calculateSummary(annotations);
    this.render();
  }

  /**
   * Destroy the indicator
   */
  public destroy(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this.hideTooltip();
    this.tooltipElement?.remove();
    this.tooltipElement = null;
    this.element?.remove();
    this.element = null;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private injectStyles(): void {
    if (this.styleInjected) return;
    if (document.getElementById('annotation-indicator-styles')) {
      this.styleInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'annotation-indicator-styles';
    style.textContent = INDICATOR_STYLES;
    document.head.appendChild(style);
    this.styleInjected = true;
  }

  private async loadAnnotations(): Promise<void> {
    const jwt = this.config.jwtToken || localStorage.getItem('jwt_token');
    if (!jwt) {
      this.annotations = [];
      this.summary = this.calculateSummary([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/plugins/telemetry/DEVICE/${this.config.deviceId}/values/attributes/SERVER_SCOPE?keys=log_annotations`,
        {
          headers: {
            'X-Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        this.annotations = [];
        this.summary = this.calculateSummary([]);
        return;
      }

      const attributes = await response.json();
      const attr = attributes.find((a: { key: string }) => a.key === 'log_annotations');

      if (!attr?.value) {
        this.annotations = [];
        this.summary = this.calculateSummary([]);
        return;
      }

      const data: LogAnnotationsAttribute =
        typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;

      // Filter out archived annotations
      this.annotations = (data.annotations || []).filter((a) => a.status !== 'archived');
      this.summary = this.calculateSummary(this.annotations);
    } catch (error) {
      console.error('[AnnotationIndicator] Error loading annotations:', error);
      this.annotations = [];
      this.summary = this.calculateSummary([]);
    }
  }

  private calculateSummary(annotations: Annotation[]): AnnotationSummary {
    const now = new Date();
    const summary: AnnotationSummary = {
      total: annotations.length,
      pending: 0,
      maintenance: 0,
      activity: 0,
      observation: 0,
      overdueCount: 0,
      latestAnnotation: annotations[0] || undefined,
      highestPriorityType: null,
    };

    annotations.forEach((a) => {
      switch (a.type) {
        case 'pending':
          summary.pending++;
          break;
        case 'maintenance':
          summary.maintenance++;
          break;
        case 'activity':
          summary.activity++;
          break;
        case 'observation':
          summary.observation++;
          break;
      }

      // Check for overdue
      if (a.dueDate && new Date(a.dueDate) < now) {
        summary.overdueCount++;
      }
    });

    // Determine highest priority type (pending > maintenance > activity > observation)
    if (summary.pending > 0) {
      summary.highestPriorityType = 'pending';
    } else if (summary.maintenance > 0) {
      summary.highestPriorityType = 'maintenance';
    } else if (summary.activity > 0) {
      summary.highestPriorityType = 'activity';
    } else if (summary.observation > 0) {
      summary.highestPriorityType = 'observation';
    }

    return summary;
  }

  private render(): void {
    // Remove existing element
    this.element?.remove();
    this.tooltipElement?.remove();

    const { position, size, onClick } = this.config;
    const hasAnnotations = this.summary && this.summary.total > 0;
    const color = hasAnnotations && this.summary!.highestPriorityType
      ? ANNOTATION_TYPE_COLORS[this.summary!.highestPriorityType]
      : '#6c757d';

    // Create indicator element
    this.element = document.createElement('div');
    this.element.className = `annotation-indicator annotation-indicator--${position} annotation-indicator--${size} ${
      hasAnnotations ? '' : 'annotation-indicator--empty'
    }`;
    this.element.style.background = hasAnnotations ? color : 'rgba(0, 0, 0, 0.1)';
    this.element.setAttribute('role', 'button');
    this.element.setAttribute('aria-label', `${this.summary?.total || 0} anotações`);

    // Icon SVG
    this.element.innerHTML = `
      <svg class="annotation-indicator__icon" viewBox="0 0 24 24" fill="none" stroke="${hasAnnotations ? '#fff' : '#6c757d'}" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14,2 14,8 20,8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    `;

    // Create tooltip element (separate from indicator)
    this.tooltipElement = document.createElement('div');
    const themeClass = `annotation-indicator__tooltip--${this.config.theme || 'light'}`;
    this.tooltipElement.className = `annotation-indicator__tooltip ${themeClass}`;
    this.tooltipElement.innerHTML = this.renderTooltipContent();
    document.body.appendChild(this.tooltipElement);

    // Hover events for showing tooltip
    this.element.addEventListener('mouseenter', () => {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
      this.showTooltip();
    });

    this.element.addEventListener('mouseleave', () => {
      this.startDelayedHide();
    });

    // Tooltip hover events
    this.tooltipElement.addEventListener('mouseenter', () => {
      this._isMouseOverTooltip = true;
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    });

    this.tooltipElement.addEventListener('mouseleave', () => {
      this._isMouseOverTooltip = false;
      this.startDelayedHide();
    });

    // Click event listener
    if (onClick) {
      this.element.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    // Ensure parent is positioned
    const parentStyle = getComputedStyle(this.config.container);
    if (parentStyle.position === 'static') {
      this.config.container.style.position = 'relative';
    }

    this.config.container.appendChild(this.element);
  }

  private showTooltip(): void {
    if (!this.tooltipElement || !this.element) return;

    const rect = this.element.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    // Adjust for viewport bounds
    const tooltipWidth = 300;
    const tooltipHeight = 350;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = rect.left - tooltipWidth - 12;
    }
    if (left < 10) left = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = window.innerHeight - tooltipHeight - 10;
    }
    if (top < 10) top = 10;

    this.tooltipElement.style.left = left + 'px';
    this.tooltipElement.style.top = top + 'px';
    this.tooltipElement.classList.add('visible');
    this.tooltipElement.classList.remove('closing');

    // Setup button listeners
    this.setupTooltipButtonListeners(this.tooltipElement);
    this.setupTooltipDragListeners(this.tooltipElement);
  }

  private hideTooltip(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._isMouseOverTooltip = false;

    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
    }
  }

  private startDelayedHide(): void {
    if (this._isMouseOverTooltip) return;
    if (this._hideTimer) clearTimeout(this._hideTimer);

    this._hideTimer = setTimeout(() => {
      this.hideWithAnimation();
    }, 1500);
  }

  private hideWithAnimation(): void {
    if (this.tooltipElement && this.tooltipElement.classList.contains('visible')) {
      this.tooltipElement.classList.add('closing');
      setTimeout(() => {
        if (this.tooltipElement) {
          this.tooltipElement.classList.remove('visible', 'closing');
        }
      }, 400);
    }
  }

  private setupTooltipButtonListeners(tooltip: HTMLElement): void {
    const buttons = tooltip.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      // Remove existing listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode?.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (newBtn as HTMLElement).dataset.action;
        if (action === 'pin') this.createPinnedClone();
        else if (action === 'maximize') this.toggleMaximize(tooltip);
        else if (action === 'close') this.hideTooltip();
      });
    });
  }

  private setupTooltipDragListeners(tooltip: HTMLElement): void {
    const header = tooltip.querySelector('[data-drag-handle]') as HTMLElement;
    if (!header) return;

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let isMaximized = false;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (tooltip.classList.contains('maximized')) return;

      isDragging = true;
      tooltip.classList.add('dragging');

      const rect = tooltip.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newLeft = e.clientX - dragOffset.x;
      const newTop = e.clientY - dragOffset.y;
      const maxLeft = window.innerWidth - tooltip.offsetWidth;
      const maxTop = window.innerHeight - tooltip.offsetHeight;
      tooltip.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      tooltip.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      isDragging = false;
      tooltip.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    // Remove existing listener by cloning header
    const newHeader = header.cloneNode(true) as HTMLElement;
    header.parentNode?.replaceChild(newHeader, header);
    newHeader.addEventListener('mousedown', onMouseDown);

    // Re-setup button listeners after cloning header
    this.setupTooltipButtonListeners(tooltip);
  }

  private toggleMaximize(tooltip: HTMLElement): void {
    const isMaximized = tooltip.classList.toggle('maximized');
    const maxBtn = tooltip.querySelector('[data-action="maximize"]');

    if (maxBtn) {
      if (isMaximized) {
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>';
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
        maxBtn.setAttribute('title', 'Maximizar');
      }
    }
  }

  private createPinnedClone(): void {
    if (!this.tooltipElement) return;

    this._pinnedCounter++;
    const pinnedId = `annotation-tooltip-pinned-${this._pinnedCounter}`;

    const clone = this.tooltipElement.cloneNode(true) as HTMLElement;
    clone.id = pinnedId;
    clone.classList.add('pinned');
    clone.classList.remove('closing');

    // Update PIN button to show it's pinned
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.setAttribute('title', 'Desafixar');
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
          <line x1="12" y1="16" x2="12" y2="21"/>
          <line x1="8" y1="4" x2="16" y2="4"/>
        </svg>
      `;
    }

    document.body.appendChild(clone);
    this.setupPinnedCloneListeners(clone, pinnedId);
    this.hideTooltip();
  }

  private setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
    // PIN button closes the clone
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePinnedClone(cloneId);
      });
    }

    // Close button
    const closeBtn = clone.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePinnedClone(cloneId);
      });
    }

    // Maximize button
    let isMaximized = false;
    let savedPosition: { left: string; top: string } | null = null;
    const maxBtn = clone.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;
        if (isMaximized) savedPosition = { left: clone.style.left, top: clone.style.top };
        clone.classList.toggle('maximized', isMaximized);
        if (isMaximized) {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>';
          maxBtn.setAttribute('title', 'Restaurar');
        } else {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
          maxBtn.setAttribute('title', 'Maximizar');
          if (savedPosition) { clone.style.left = savedPosition.left; clone.style.top = savedPosition.top; }
        }
      });
    }

    // Drag functionality
    const header = clone.querySelector('[data-drag-handle]') as HTMLElement;
    if (header) {
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (isMaximized) return;
        isDragging = true;
        clone.classList.add('dragging');
        const rect = clone.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newLeft = e.clientX - dragOffset.x;
        const newTop = e.clientY - dragOffset.y;
        const maxLeft = window.innerWidth - clone.offsetWidth;
        const maxTop = window.innerHeight - clone.offsetHeight;
        clone.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        clone.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      };

      const onMouseUp = () => {
        isDragging = false;
        clone.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      header.addEventListener('mousedown', onMouseDown);
    }
  }

  private closePinnedClone(cloneId: string): void {
    const clone = document.getElementById(cloneId);
    if (clone) {
      clone.classList.add('closing');
      setTimeout(() => clone.remove(), 400);
    }
  }

  private renderTooltipContent(): string {
    const headerButtons = `
      <div class="annotation-indicator__tooltip-header-actions">
        <button class="annotation-indicator__tooltip-header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="annotation-indicator__tooltip-header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="annotation-indicator__tooltip-header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;

    if (!this.summary) {
      return `
        <div class="annotation-indicator__tooltip-header" data-drag-handle>
          <span class="annotation-indicator__tooltip-header-title">📋 Anotações</span>
          ${headerButtons}
        </div>
        <div class="annotation-indicator__tooltip-body">
          <div class="annotation-indicator__tooltip-empty">
            Carregando...
          </div>
        </div>
      `;
    }

    if (this.summary.total === 0) {
      return `
        <div class="annotation-indicator__tooltip-header" data-drag-handle>
          <span class="annotation-indicator__tooltip-header-title">📋 Anotações</span>
          ${headerButtons}
        </div>
        <div class="annotation-indicator__tooltip-body">
          <div class="annotation-indicator__tooltip-empty">
            Nenhuma anotação registrada
          </div>
        </div>
      `;
    }

    const rows = [
      { type: 'pending' as AnnotationType, count: this.summary.pending, label: ANNOTATION_TYPE_LABELS.pending },
      { type: 'maintenance' as AnnotationType, count: this.summary.maintenance, label: ANNOTATION_TYPE_LABELS.maintenance },
      { type: 'activity' as AnnotationType, count: this.summary.activity, label: ANNOTATION_TYPE_LABELS.activity },
      { type: 'observation' as AnnotationType, count: this.summary.observation, label: ANNOTATION_TYPE_LABELS.observation },
    ].filter((r) => r.count > 0);

    const latestSection = this.summary.latestAnnotation
      ? `
        <div class="annotation-indicator__tooltip-latest">
          <div class="annotation-indicator__tooltip-latest-label">Última anotação:</div>
          <div class="annotation-indicator__tooltip-latest-text">"${this.summary.latestAnnotation.text}"</div>
          <div class="annotation-indicator__tooltip-latest-meta">
            ${this.summary.latestAnnotation.createdBy.name} • ${new Date(this.summary.latestAnnotation.createdAt).toLocaleDateString('pt-BR')}
          </div>
        </div>
      `
      : '';

    const overdueWarning = this.summary.overdueCount > 0
      ? `<div style="color: #ff6b6b; margin-top: 8px; font-size: 11px;">⚠️ ${this.summary.overdueCount} anotação(ões) vencida(s)</div>`
      : '';

    return `
      <div class="annotation-indicator__tooltip-header" data-drag-handle>
        <span class="annotation-indicator__tooltip-header-title">📋 Anotações (${this.summary.total})</span>
        ${headerButtons}
      </div>
      <div class="annotation-indicator__tooltip-body">
        ${rows
          .map(
            (r) => `
          <div class="annotation-indicator__tooltip-row">
            <span class="annotation-indicator__tooltip-label">
              <span class="annotation-indicator__tooltip-dot" style="background: ${ANNOTATION_TYPE_COLORS[r.type]}"></span>
              ${r.label}
            </span>
            <span class="annotation-indicator__tooltip-value">${r.count}</span>
          </div>
        `
          )
          .join('')}
        ${overdueWarning}
        ${latestSection}
      </div>
    `;
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create and initialize an annotation indicator
 *
 * @example
 * ```typescript
 * const indicator = await createAnnotationIndicator({
 *   container: cardElement,
 *   deviceId: 'device-uuid',
 *   position: 'top-right',
 *   onClick: () => openSettingsModal()
 * });
 * ```
 */
export async function createAnnotationIndicator(
  config: AnnotationIndicatorConfig
): Promise<AnnotationIndicator> {
  const indicator = new AnnotationIndicator(config);
  await indicator.init();
  return indicator;
}

export default AnnotationIndicator;
