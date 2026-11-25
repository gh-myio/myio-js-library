/**
 * RFC-0242 — draggable panel (same idea as InfoTooltip's header drag, RFC-0105),
 * with Pointer Events so mouse, touch and pen all work:
 * - drag by the header; presses on header buttons/links never start a drag;
 * - the panel is clamped to the viewport while dragging, when restored and on resize;
 * - the position persists per host in localStorage (`myio:bot:panelPos:<host.app>`);
 * - `reset()` (also: double-click on the header) returns it to its corner.
 * The launcher pill has its own drag (`enableLauncherSnap`, below): it snaps to the
 * nearest corner / edge midpoint, and the panel's default spot follows it.
 */
import { safeStorage } from './dom';

export const PANEL_POS_PREFIX = 'myio:bot:panelPos:';
/** Below this viewport width the panel is full-width (CSS) and not draggable. */
const MIN_DRAG_VIEWPORT = 480;

export interface PanelDrag {
  /** Re-applies the stored position (clamped). Call after the panel becomes visible. */
  apply(): void;
  /** Forgets the stored position and returns the panel to its corner. */
  reset(): void;
  destroy(): void;
  /** Current custom position, or null when anchored at the corner. */
  position(): { left: number; top: number } | null;
}

function viewport(): { w: number; h: number } {
  return { w: window.innerWidth || document.documentElement.clientWidth || 0, h: window.innerHeight || document.documentElement.clientHeight || 0 };
}

export function enablePanelDrag(
  panel: HTMLElement,
  handle: HTMLElement,
  storageKey: string | null,
  isLocked: () => boolean = () => false,
  /** Places the panel when it has no custom position (e.g. next to the launcher). Default: CSS corner. */
  defaultPlace?: () => void,
): PanelDrag {
  let pos: { left: number; top: number } | null = null;
  let dragging: { dx: number; dy: number; id: number | null } | null = null;

  const read = (): { left: number; top: number } | null => {
    if (!storageKey) return null;
    try {
      const v = JSON.parse(safeStorage.get(storageKey) || 'null');
      return v && Number.isFinite(v.left) && Number.isFinite(v.top) ? { left: v.left, top: v.top } : null;
    } catch {
      return null;
    }
  };

  const clamp = (left: number, top: number) => {
    const { w, h } = viewport();
    const pw = panel.offsetWidth || 0;
    const ph = panel.offsetHeight || 0;
    return {
      left: Math.round(Math.max(0, Math.min(left, Math.max(0, w - pw)))),
      top: Math.round(Math.max(0, Math.min(top, Math.max(0, h - ph)))),
    };
  };

  const clearInline = () => {
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
    panel.classList.remove('moved');
  };

  const place = (p: { left: number; top: number }) => {
    pos = clamp(p.left, p.top);
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.classList.add('moved');
  };

  const small = () => viewport().w <= MIN_DRAG_VIEWPORT;

  const onDown = (e: PointerEvent | MouseEvent) => {
    const target = e.target as Element | null;
    if (!target || target.closest('button, a, input, textarea, [data-no-drag]')) return;
    if ((e as MouseEvent).button !== undefined && (e as MouseEvent).button !== 0) return;
    if (small() || isLocked()) return;
    const r = panel.getBoundingClientRect();
    dragging = { dx: e.clientX - r.left, dy: e.clientY - r.top, id: (e as PointerEvent).pointerId ?? null };
    panel.classList.add('dragging');
    try { if (dragging.id !== null) handle.setPointerCapture?.(dragging.id); } catch { /* not capturable (synthetic) */ }
    e.preventDefault();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const onMove = (e: PointerEvent | MouseEvent) => {
    if (!dragging) return;
    place({ left: e.clientX - dragging.dx, top: e.clientY - dragging.dy });
  };

  const onUp = () => {
    if (!dragging) return;
    try { if (dragging.id !== null) handle.releasePointerCapture?.(dragging.id); } catch { /* ignore */ }
    dragging = null;
    panel.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (pos && storageKey) safeStorage.set(storageKey, JSON.stringify(pos));
  };

  const reset = () => {
    pos = null;
    if (storageKey) safeStorage.remove(storageKey);
    clearInline();
    if (!small()) defaultPlace?.();
  };

  const onDbl = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (target && target.closest('button, a')) return;
    if (isLocked()) return;
    reset();
  };

  const apply = () => {
    if (small()) { clearInline(); return; }
    const p = pos || read();
    if (p) place(p);
    else { clearInline(); defaultPlace?.(); }
  };

  const onResize = () => {
    if (pos || defaultPlace) apply();
  };

  handle.addEventListener('pointerdown', onDown as EventListener);
  handle.addEventListener('dblclick', onDbl as EventListener);
  window.addEventListener('resize', onResize);

  return {
    apply,
    reset,
    position: () => (pos ? { ...pos } : null),
    destroy() {
      onUp();
      handle.removeEventListener('pointerdown', onDown as EventListener);
      handle.removeEventListener('dblclick', onDbl as EventListener);
      window.removeEventListener('resize', onResize);
    },
  };
}

// ── launcher snap ──────────────────────────────────────────────────────────
// The pill can be dragged, and on release it snaps to the nearest of 8 anchors:
// the 4 corners and the middle of each edge. The anchor persists per host in
// localStorage (`myio:bot:launcherPos:<host.app>`).

export const LAUNCHER_POS_PREFIX = 'myio:bot:launcherPos:';
export type LauncherAnchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';
export const LAUNCHER_ANCHORS: readonly LauncherAnchor[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
/** Distance from the viewport edge, same as the CSS default (24px). */
export const LAUNCHER_MARGIN = 24;
/** Pointer travel (px) below which a press is a click, not a drag. */
const CLICK_SLOP = 5;

export interface LauncherSnap {
  anchor(): LauncherAnchor;
  /** Re-applies the current anchor (call on resize / after becoming visible). */
  apply(): void;
  reset(): void;
  destroy(): void;
}

/** Top-left of an element of size w×h placed at `anchor` in a vw×vh viewport. */
export function anchorPoint(anchor: LauncherAnchor, w: number, h: number, vw: number, vh: number, m = LAUNCHER_MARGIN): { left: number; top: number } {
  const v = anchor[0];
  const hz = anchor[1];
  const left = hz === 'l' ? m : hz === 'r' ? vw - w - m : (vw - w) / 2;
  const top = v === 't' ? m : v === 'b' ? vh - h - m : (vh - h) / 2;
  return { left: Math.round(Math.max(0, left)), top: Math.round(Math.max(0, top)) };
}

/** The anchor whose slot center is closest to the point (cx, cy). */
export function nearestAnchor(cx: number, cy: number, w: number, h: number, vw: number, vh: number): LauncherAnchor {
  let best: LauncherAnchor = 'br';
  let bestD = Infinity;
  for (const a of LAUNCHER_ANCHORS) {
    const p = anchorPoint(a, w, h, vw, vh);
    const d = (p.left + w / 2 - cx) ** 2 + (p.top + h / 2 - cy) ** 2;
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

export function enableLauncherSnap(
  el: HTMLElement,
  storageKey: string | null,
  defaultAnchor: LauncherAnchor,
  onChange?: (a: LauncherAnchor) => void,
): LauncherSnap {
  const stored = storageKey ? safeStorage.get(storageKey) : null;
  let current: LauncherAnchor = stored && (LAUNCHER_ANCHORS as readonly string[]).includes(stored) ? (stored as LauncherAnchor) : defaultAnchor;
  let press: { x: number; y: number; dx: number; dy: number; id: number | null; moved: boolean } | null = null;
  let suppressClick = false;

  const place = (left: number, top: number) => {
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  };

  const placeAt = (a: LauncherAnchor) => {
    const { w, h } = viewport();
    const p = anchorPoint(a, el.offsetWidth || 0, el.offsetHeight || 0, w, h);
    place(p.left, p.top);
  };

  const apply = () => {
    if (press?.moved) return; // never yank the pill out from under the pointer
    el.setAttribute('data-anchor', current);
    if (current === defaultAnchor && !el.classList.contains('snapping')) {
      // default corner = the CSS placement (.left/.right + bottom), no inline position
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      return;
    }
    placeAt(current);
  };

  const onDown = (e: PointerEvent | MouseEvent) => {
    if ((e as MouseEvent).button !== undefined && (e as MouseEvent).button !== 0) return;
    const r = el.getBoundingClientRect();
    press = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, id: (e as PointerEvent).pointerId ?? null, moved: false };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const onMove = (e: PointerEvent | MouseEvent) => {
    if (!press) return;
    if (!press.moved) {
      if (Math.abs(e.clientX - press.x) < CLICK_SLOP && Math.abs(e.clientY - press.y) < CLICK_SLOP) return;
      press.moved = true;
      el.classList.remove('snapping');
      el.classList.add('dragging');
      try { if (press.id !== null) el.setPointerCapture?.(press.id); } catch { /* synthetic */ }
    }
    e.preventDefault();
    const { w, h } = viewport();
    const left = Math.max(0, Math.min(e.clientX - press.dx, w - (el.offsetWidth || 0)));
    const top = Math.max(0, Math.min(e.clientY - press.dy, h - (el.offsetHeight || 0)));
    place(Math.round(left), Math.round(top));
  };

  const onUp = () => {
    if (!press) return;
    const wasDrag = press.moved;
    try { if (press.id !== null) el.releasePointerCapture?.(press.id); } catch { /* ignore */ }
    press = null;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (!wasDrag) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    el.classList.remove('dragging');
    const { w, h } = viewport();
    const ew = el.offsetWidth || 0;
    const eh = el.offsetHeight || 0;
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    current = nearestAnchor(left + ew / 2, top + eh / 2, ew, eh, w, h);
    if (storageKey) safeStorage.set(storageKey, current);
    el.classList.add('snapping');
    el.setAttribute('data-anchor', current);
    placeAt(current); // animated (inline px) even for the default corner…
    setTimeout(() => { el.classList.remove('snapping'); apply(); }, 260); // …then hand it back to CSS there
    onChange?.(current);
  };

  // a drag must not toggle the panel: swallow the click that follows pointerup
  const onClickCapture = (e: Event) => {
    if (suppressClick) { suppressClick = false; e.stopImmediatePropagation(); e.preventDefault(); }
  };

  const onResize = () => apply();

  el.addEventListener('pointerdown', onDown as EventListener);
  el.addEventListener('click', onClickCapture, true);
  window.addEventListener('resize', onResize);

  return {
    anchor: () => current,
    apply,
    reset() {
      current = defaultAnchor;
      if (storageKey) safeStorage.remove(storageKey);
      apply();
      onChange?.(current);
    },
    destroy() {
      onUp();
      el.removeEventListener('pointerdown', onDown as EventListener);
      el.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('resize', onResize);
    },
  };
}

/**
 * Default (not dragged) panel placement next to the launcher anchor:
 * bottom row → above the pill, top row → below it, middle → beside it.
 */
export function placePanelNearAnchor(panel: HTMLElement, launcher: HTMLElement, anchor: LauncherAnchor, gap = 14): void {
  const { w: vw, h: vh } = viewport();
  const pw = panel.offsetWidth || 0;
  const ph = panel.offsetHeight || 0;
  const r = launcher.getBoundingClientRect();
  const m = LAUNCHER_MARGIN;
  let left: number;
  let top: number;
  const v = anchor[0];
  const hz = anchor[1];
  if (v === 'm') {
    left = hz === 'l' ? r.right + gap : r.left - gap - pw;
    top = (vh - ph) / 2;
  } else {
    left = hz === 'l' ? m : hz === 'r' ? vw - pw - m : (vw - pw) / 2;
    top = v === 'b' ? r.top - gap - ph : r.bottom + gap;
  }
  left = Math.max(0, Math.min(left, vw - pw));
  top = Math.max(0, Math.min(top, vh - ph));
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
}
