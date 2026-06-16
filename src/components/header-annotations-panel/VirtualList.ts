/**
 * RFC-0203 M6 — Virtual scroll helper.
 *
 * Vanilla DOM-only virtual list: keeps a fixed-height spacer that reflects
 * the total content height, and renders only the rows currently visible
 * (+ a small buffer above/below). Designed for the HeaderAnnotationsPanel
 * body, which receives a flat list of rows (group headers + items).
 *
 * AC-28: only activates when row count > 100 (caller decides; see
 *        `VirtualList.shouldUse(itemCount)`).
 * AC-29/AC-30: minimal DOM cost during scroll — render only visible window.
 *
 * NOTE: this implementation assumes uniform row heights per "row kind"
 * (header vs item). Mixed heights are handled by storing an explicit
 * height per row in the input array.
 */

export const VIRTUAL_SCROLL_THRESHOLD = 100;

export interface VirtualRow {
  /** Stable key for diff/identification (e.g. annotation id or group key). */
  key: string;
  /** Estimated pixel height for this row. */
  height: number;
  /** Renderer — pure HTML string. */
  render: () => string;
}

export interface VirtualListOptions {
  /** Container that will host the scrollable list. Will be styled. */
  container: HTMLElement;
  /** All rows in render order. */
  rows: VirtualRow[];
  /** Number of rows to render above/below the viewport (default 6). */
  overscan?: number;
}

/**
 * Static helper to decide whether to use virtualization (AC-28).
 */
export function shouldVirtualize(itemCount: number): boolean {
  return itemCount > VIRTUAL_SCROLL_THRESHOLD;
}

export class VirtualList {
  private readonly container: HTMLElement;
  private readonly rows: VirtualRow[];
  private readonly overscan: number;

  private spacer: HTMLDivElement;
  private viewport: HTMLDivElement;

  /** Cumulative pixel offset for each row (offsets[i] = top of row i). */
  private readonly offsets: number[];
  /** Total content height. */
  private readonly totalHeight: number;

  private _onScroll: () => void;
  private _rafScheduled = false;
  private _destroyed = false;

  constructor(opts: VirtualListOptions) {
    this.container = opts.container;
    this.rows = opts.rows;
    this.overscan = opts.overscan ?? 6;

    // Pre-compute offsets for binary search of visible range
    this.offsets = new Array(this.rows.length);
    let acc = 0;
    for (let i = 0; i < this.rows.length; i++) {
      this.offsets[i] = acc;
      acc += this.rows[i].height;
    }
    this.totalHeight = acc;

    // Prepare container
    this.container.classList.add('myio-vlist-container');
    this.container.style.position = 'relative';
    this.container.style.overflowY = 'auto';

    // Spacer = ghost div sized to the full content height; keeps scrollbar correct
    this.spacer = document.createElement('div');
    this.spacer.className = 'myio-vlist-spacer';
    this.spacer.style.position = 'relative';
    this.spacer.style.width = '100%';
    this.spacer.style.height = `${this.totalHeight}px`;

    // Viewport = positioned absolute inside spacer; receives the rendered HTML
    this.viewport = document.createElement('div');
    this.viewport.className = 'myio-vlist-viewport';
    this.viewport.style.position = 'absolute';
    this.viewport.style.top = '0px';
    this.viewport.style.left = '0';
    this.viewport.style.right = '0';

    this.spacer.appendChild(this.viewport);
    this.container.innerHTML = '';
    this.container.appendChild(this.spacer);

    this._onScroll = () => this._scheduleRender();
    this.container.addEventListener('scroll', this._onScroll, { passive: true });

    // Initial render
    this._renderVisible();
  }

  /** Re-render the visible window (e.g. after a DOM resize). Idempotent. */
  refresh(): void {
    if (this._destroyed) return;
    this._renderVisible();
  }

  /** Remove the spacer/viewport and detach listeners. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.container.removeEventListener('scroll', this._onScroll);
    this.container.classList.remove('myio-vlist-container');
    this.container.innerHTML = '';
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private _scheduleRender(): void {
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    requestAnimationFrame(() => {
      this._rafScheduled = false;
      this._renderVisible();
    });
  }

  private _renderVisible(): void {
    if (this._destroyed) return;
    const scrollTop = this.container.scrollTop;
    const viewportH = this.container.clientHeight || 1;

    const startIdx = Math.max(0, this._findRowAt(scrollTop) - this.overscan);
    const endIdx = Math.min(
      this.rows.length - 1,
      this._findRowAt(scrollTop + viewportH) + this.overscan
    );

    const html: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      html.push(this.rows[i].render());
    }

    const topOffset = this.offsets[startIdx] ?? 0;
    this.viewport.style.transform = `translateY(${topOffset}px)`;
    this.viewport.innerHTML = html.join('');
  }

  /** Binary search for the row whose offset contains `y`. */
  private _findRowAt(y: number): number {
    if (this.rows.length === 0) return 0;
    let lo = 0;
    let hi = this.rows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsets[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
