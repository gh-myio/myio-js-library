/**
 * ImgGallery — autonomous, dependency-free filterable image gallery.
 *
 * Inspired by the "flip-reveal" pattern (21st.dev/paceui): a grid of images
 * with category filter tabs that animates items in/out with a FLIP transition
 * when the filter changes. The reference uses React + GSAP Flip; this is a
 * vanilla-DOM port using the Web Animations API (no GSAP, no framework — keeps
 * within the library's bundle budget).
 *
 * Features:
 *  - Configurable category tabs via {@link createScrollableTabs} (horizontal
 *    scroll + arrows when they overflow; `tabsMaxVisible` caps the visible set).
 *  - FLIP-lite reveal/hide animation on filter change (persisted items slide,
 *    entering items fade+scale in, leaving items fade+scale out).
 *  - Optional lightbox (click an image → full-size overlay with prev/next).
 *  - Returns a controller; embed anywhere — including inside `openGenericModal`
 *    by mounting into a `<div>` in its body.
 */

import { createScrollableTabs, type ScrollableTabsInstance, type TabItem } from './ScrollableTabs';

/** A single gallery image. */
export interface GalleryImage {
  src: string;
  alt?: string;
  /** One or more category keys this image belongs to. */
  category?: string | string[];
  /** Caption / description (shown under the image and editable when enabled). */
  caption?: string;
  /** Optional full-size source for the lightbox (defaults to `src`). */
  fullSrc?: string;
  /** Stable id, echoed back in callbacks (delete/hide/edit). */
  id?: string;
  /** File name shown in the details block (`enableDisplayDetails`). */
  filename?: string;
  /** File size in bytes; formatted to KB/MB in the details block. */
  sizeBytes?: number;
  /** Pixel width. If omitted, derived from the image's natural size on load. */
  width?: number;
  /** Pixel height. If omitted, derived from the image's natural size on load. */
  height?: number;
}

export interface ImgGalleryOptions {
  /** Images to display. */
  images: GalleryImage[];
  /**
   * Category tabs. Strings or {@link TabItem}s. When omitted, categories are
   * derived from the images' `category` fields. An "all" tab is always shown
   * first (use `allLabel` to localize it; pass `showAll:false` to hide it).
   */
  categories?: Array<string | TabItem>;
  /** Label for the "all" tab. Default: locale-aware ('Todos' / 'All'). */
  allLabel?: string;
  /** Hide the "all" tab. Default: false. */
  showAll?: boolean;
  /** Initially-active category key. Default: 'all'. */
  activeCategory?: string;
  /** Fixed column count. Default: responsive (auto-fill, min 120px). */
  columns?: number;
  /** Grid gap in px. Default: 12. */
  gap?: number;
  /** Thumbnail height in px (width follows the grid cell). Default: 120. */
  itemHeight?: number;
  /** Enable the click-to-zoom lightbox. Default: true. */
  lightbox?: boolean;
  /** Enable FLIP-lite filter animation. Default: true. */
  animate?: boolean;
  /** Forwarded to the tabs (caps visible tabs → scroll + arrows). */
  tabsMaxVisible?: number;
  /** Color theme. Default: 'light'. */
  theme?: 'light' | 'dark';
  /** Accent color. Default: '#7C3AED'. */
  accent?: string;
  /** Locale for built-in labels. Default: 'pt-BR'. */
  locale?: 'pt-BR' | 'en-US';
  /** Mount target. If given, the gallery is appended to it. */
  container?: HTMLElement;

  // ── Per-item controls ──────────────────────────────────────────────────────
  /**
   * Show the description (caption) as fixed read-only text in the card body,
   * independent of editing/details. Without it (and without edit/details) the
   * caption only appears as a hover overlay on the image. Default: false.
   */
  enableDescription?: boolean;
  /** Show a delete (🗑) button on each item. Default: false. */
  enableDeleteButton?: boolean;
  /** Allow editing the description inline (pencil → input). Default: false. */
  enableEditDescription?: boolean;
  /** Show a hide (eye-off) button that removes the item from view. Default: false. */
  enableHide?: boolean;
  /**
   * Show a details block under the description: filename, then size (KB/MB),
   * then dimensions (W×H). Missing dimensions are derived from the loaded image.
   * Default: false.
   */
  enableDisplayDetails?: boolean;

  // ── Callbacks ───────────────────────────────────────────────────────────────
  /** Called when an image is clicked (before/instead of the lightbox). */
  onSelect?: (image: GalleryImage, index: number) => void;
  /**
   * Gate run before a delete. Return `false` (or a Promise resolving to false)
   * to cancel — e.g. show a confirmation dialog. Resolve `true` to proceed.
   */
  onBeforeDelete?: (image: GalleryImage, index: number) => boolean | Promise<boolean>;
  /** Called after an item is deleted (already removed from the gallery). */
  onDelete?: (image: GalleryImage, index: number) => void;
  /** Called after an item is hidden (removed from view). */
  onHide?: (image: GalleryImage, index: number) => void;
  /** Called after the description is edited. */
  onDescriptionChange?: (image: GalleryImage, index: number, description: string) => void;
}

export interface ImgGalleryInstance {
  /** Root element (`.myio-gallery`). */
  el: HTMLElement;
  /** Programmatically change the active category (animates). */
  setFilter: (category: string) => void;
  /** Current active category key. */
  getFilter: () => string;
  /** Replace the image set (re-derives categories if not fixed). */
  setImages: (images: GalleryImage[]) => void;
  /** Open the lightbox at a given index of the currently-visible images. */
  openLightbox: (index: number) => void;
  /** Tear down (tabs, listeners, lightbox) and detach. */
  destroy: () => void;
}

const STYLE_ID = 'myio-gallery-styles';
const FONT_LINK_ID = 'myio-dialog-font-nunito';

function escapeHtml(value: string): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRM = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function injectStyles(): void {
  if (!document.getElementById(FONT_LINK_ID)) {
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.myio-gallery {
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.myio-gallery__grid { display: grid; width: 100%; }
.myio-gallery__item {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  will-change: transform, opacity;
}
.myio-gallery__thumb {
  position: relative;
  width: 100%;
  border: none;
  padding: 0;
  margin: 0;
  background: #f3f4f6;
  cursor: pointer;
  overflow: hidden;
  display: block;
}
.myio-gallery__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform .35s ease;
}
.myio-gallery__thumb:hover img { transform: scale(1.06); }
.myio-gallery__thumb:focus-visible { outline: 2px solid var(--myio-gallery-accent, #7C3AED); outline-offset: -2px; }
.myio-gallery__cap {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 14px 8px 6px;
  font-size: 11px; color: #fff;
  background: linear-gradient(to top, rgba(0,0,0,.6), transparent);
  opacity: 0; transition: opacity .2s ease;
  text-align: left; line-height: 1.3; pointer-events: none;
}
.myio-gallery__item:hover .myio-gallery__cap { opacity: 1; }

/* Per-item action buttons (delete / edit / hide) */
.myio-gallery__actions {
  position: absolute; top: 6px; right: 6px;
  display: flex; gap: 4px; z-index: 2;
  opacity: 0; transition: opacity .15s ease;
}
.myio-gallery__item:hover .myio-gallery__actions,
.myio-gallery__item:focus-within .myio-gallery__actions { opacity: 1; }
.myio-gallery__abtn {
  width: 26px; height: 26px; border-radius: 7px; border: none;
  background: rgba(255,255,255,.92); color: #374151; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
}
.myio-gallery__abtn:hover { background: #fff; }
.myio-gallery__abtn svg { width: 15px; height: 15px; }
.myio-gallery__abtn--danger:hover { color: #dc2626; }

/* Body: description + details */
.myio-gallery__body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 4px; }
.myio-gallery__desc { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; font-weight: 600; color: #1f2937; line-height: 1.35; }
.myio-gallery__desc-text { flex: 1; min-width: 0; word-break: break-word; }
.myio-gallery__desc-text--empty { color: #9ca3af; font-weight: 400; font-style: italic; }
.myio-gallery__editpen { flex-shrink: 0; border: none; background: transparent; color: #9ca3af; cursor: pointer; padding: 0; }
.myio-gallery__editpen:hover { color: var(--myio-gallery-accent, #7C3AED); }
.myio-gallery__editpen svg { width: 14px; height: 14px; }
.myio-gallery__edit { display: flex; gap: 4px; align-items: center; }
.myio-gallery__edit input { flex: 1; min-width: 0; font-family: inherit; font-size: 13px; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; }
.myio-gallery__edit input:focus { outline: none; border-color: var(--myio-gallery-accent, #7C3AED); }
.myio-gallery__edit button { border: none; border-radius: 6px; cursor: pointer; padding: 5px 8px; font-size: 12px; font-weight: 700; }
.myio-gallery__edit .ok { background: var(--myio-gallery-accent, #7C3AED); color: #fff; }
.myio-gallery__edit .cancel { background: #e5e7eb; color: #374151; }
.myio-gallery__details { display: flex; flex-direction: column; gap: 1px; font-size: 11px; color: #6b7280; line-height: 1.45; }
.myio-gallery__details span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.myio-gallery__empty { padding: 30px; text-align: center; color: #9ca3af; font-size: 13px; }

/* ── Dark ── */
.myio-gallery--dark .myio-gallery__item { background: #1f2937; border-color: #374151; }
.myio-gallery--dark .myio-gallery__thumb { background: #111827; }
.myio-gallery--dark .myio-gallery__desc { color: #f3f4f6; }
.myio-gallery--dark .myio-gallery__details { color: #9ca3af; }
.myio-gallery--dark .myio-gallery__abtn { background: rgba(31,41,55,.92); color: #e5e7eb; }
.myio-gallery--dark .myio-gallery__abtn:hover { background: #374151; }
.myio-gallery--dark .myio-gallery__edit input { background: #111827; color: #e5e7eb; border-color: #4b5563; }
.myio-gallery--dark .myio-gallery__edit .cancel { background: #374151; color: #e5e7eb; }
.myio-gallery--dark .myio-gallery__empty { color: #6b7280; }

/* Lightbox */
.myio-gallery-lb {
  position: fixed; inset: 0; z-index: 10800;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.82);
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.myio-gallery-lb__img { max-width: 88vw; max-height: 82vh; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.myio-gallery-lb__cap {
  position: absolute; left: 0; right: 0; bottom: 34px;
  text-align: center; color: #f3f4f6; font-size: 14px; font-weight: 600; padding: 0 16px;
}
.myio-gallery-lb__details {
  position: absolute; left: 0; right: 0; bottom: 12px;
  text-align: center; color: #cbd5e1; font-size: 12px; padding: 0 16px;
  font-family: ui-monospace, Menlo, monospace;
}
.myio-gallery-lb__btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 999px; border: none;
  background: rgba(255,255,255,.14); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.myio-gallery-lb__btn:hover { background: rgba(255,255,255,.26); }
.myio-gallery-lb__btn svg { width: 22px; height: 22px; }
.myio-gallery-lb__prev { left: 18px; }
.myio-gallery-lb__next { right: 18px; }
.myio-gallery-lb__close {
  position: absolute; top: 16px; right: 18px;
  width: 40px; height: 40px; border-radius: 999px; border: none;
  background: rgba(255,255,255,.14); color: #fff; font-size: 22px; cursor: pointer;
}
.myio-gallery-lb__close:hover { background: rgba(255,255,255,.26); }
`;
  document.head.appendChild(style);
}

const ICON_PREV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const ICON_NEXT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const ICON_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const ICON_PENCIL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_EYE_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.6 6.6A13.3 13.3 0 0 0 2 12s3 8 10 8a9.3 9.3 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';

/** Format a byte count as B / KB / MB / GB. */
function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 100 || Number.isInteger(val) ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`;
}

function catsOf(img: GalleryImage): string[] {
  if (!img.category) return [];
  return Array.isArray(img.category) ? img.category : [img.category];
}

export function createImgGallery(options: ImgGalleryOptions): ImgGalleryInstance {
  if (typeof document === 'undefined') {
    throw new Error('[createImgGallery] requires a browser environment');
  }
  injectStyles();

  const locale = options.locale === 'en-US' ? 'en-US' : 'pt-BR';
  const theme = options.theme ?? 'light';
  const accent = options.accent ?? '#7C3AED';
  const gap = options.gap ?? 12;
  const itemHeight = options.itemHeight ?? 120;
  const lightboxEnabled = options.lightbox ?? true;
  const animateEnabled = (options.animate ?? true) && !PRM();
  const allLabel = options.allLabel ?? (locale === 'en-US' ? 'All' : 'Todos');
  const showAll = options.showAll ?? true;

  // Per-item controls
  const enableDescriptionText = options.enableDescription ?? false;
  const enableDelete = options.enableDeleteButton ?? false;
  const enableEdit = options.enableEditDescription ?? false;
  const enableHideBtn = options.enableHide ?? false;
  const enableDetails = options.enableDisplayDetails ?? false;
  const hasActions = enableDelete || enableEdit || enableHideBtn;
  // Description + details live in a visible body (vs. the hover overlay caption).
  // enableDescription shows the caption read-only; the edit pencil only appears
  // when enableEditDescription is set (handled inside renderDescription).
  const showBody = enableDescriptionText || enableEdit || enableDetails;

  let images = options.images.slice();
  let active = options.activeCategory ?? 'all';
  // Session-hidden ids/refs (enableHide) — filtered out of every render/filter.
  const hidden = new WeakSet<GalleryImage>();

  const root = document.createElement('div');
  root.className = `myio-gallery${theme === 'dark' ? ' myio-gallery--dark' : ''}`;
  root.style.setProperty('--myio-gallery-accent', accent);

  const grid = document.createElement('div');
  grid.className = 'myio-gallery__grid';
  grid.style.gap = `${gap}px`;
  grid.style.gridTemplateColumns = options.columns
    ? `repeat(${options.columns}, 1fr)`
    : `repeat(auto-fill, minmax(120px, 1fr))`;

  function buildCategories(): TabItem[] {
    let cats: TabItem[];
    if (options.categories && options.categories.length) {
      cats = options.categories.map((c) => (typeof c === 'string' ? { key: c, label: c } : c));
    } else {
      const seen = new Set<string>();
      for (const img of images) for (const c of catsOf(img)) seen.add(c);
      cats = Array.from(seen).map((k) => ({ key: k, label: k }));
    }
    return showAll ? [{ key: 'all', label: allLabel }, ...cats] : cats;
  }

  let tabs: ScrollableTabsInstance = createScrollableTabs({
    tabs: buildCategories(),
    active,
    theme,
    accent,
    maxVisible: options.tabsMaxVisible,
    ariaLabel: locale === 'en-US' ? 'Filter by category' : 'Filtrar por categoria',
    onChange: (key) => setFilter(key),
  });

  root.appendChild(tabs.el);
  root.appendChild(grid);

  // ── details block (filename / size / dimensions) ───────────────────────────
  function detailsHtml(img: GalleryImage): string {
    const lines: string[] = [];
    if (img.filename) lines.push(`<span title="${escapeHtml(img.filename)}">${escapeHtml(img.filename)}</span>`);
    if (typeof img.sizeBytes === 'number') lines.push(`<span>${escapeHtml(formatSize(img.sizeBytes))}</span>`);
    const dims =
      typeof img.width === 'number' && typeof img.height === 'number'
        ? `${img.width} × ${img.height}px`
        : '';
    lines.push(`<span data-dims>${escapeHtml(dims)}</span>`);
    return lines.join('');
  }

  // ── description (text or inline editor) ─────────────────────────────────────
  function renderDescription(body: HTMLElement, img: GalleryImage, index: number): void {
    const desc = document.createElement('div');
    desc.className = 'myio-gallery__desc';
    const text = document.createElement('span');
    text.className = `myio-gallery__desc-text${img.caption ? '' : ' myio-gallery__desc-text--empty'}`;
    text.textContent = img.caption || (locale === 'en-US' ? 'No description' : 'Sem descrição');
    desc.appendChild(text);

    if (enableEdit) {
      const pen = document.createElement('button');
      pen.type = 'button';
      pen.className = 'myio-gallery__editpen';
      pen.setAttribute('aria-label', locale === 'en-US' ? 'Edit description' : 'Editar descrição');
      pen.innerHTML = ICON_PENCIL;
      pen.addEventListener('click', (e) => {
        e.stopPropagation();
        startEdit(body, desc, img, index);
      });
      desc.appendChild(pen);
    }
    body.insertBefore(desc, body.firstChild);
  }

  function startEdit(body: HTMLElement, desc: HTMLElement, img: GalleryImage, index: number): void {
    const editor = document.createElement('div');
    editor.className = 'myio-gallery__edit';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = img.caption || '';
    input.placeholder = locale === 'en-US' ? 'Description…' : 'Descrição…';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'ok';
    ok.textContent = '✓';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cancel';
    cancel.textContent = '✕';
    editor.append(input, ok, cancel);

    const finishCancel = () => {
      editor.replaceWith(desc);
    };
    const finishSave = () => {
      const value = input.value.trim();
      img.caption = value;
      options.onDescriptionChange?.(img, index, value);
      const fresh = document.createElement('div');
      // rebuild description node in place
      editor.replaceWith(fresh);
      renderDescription(body, img, index);
      fresh.remove();
    };
    ok.addEventListener('click', (e) => {
      e.stopPropagation();
      finishSave();
    });
    cancel.addEventListener('click', (e) => {
      e.stopPropagation();
      finishCancel();
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishSave();
      else if (e.key === 'Escape') finishCancel();
    });
    desc.replaceWith(editor);
    input.focus();
    input.select();
  }

  // ── grid items ──────────────────────────────────────────────────────────
  function renderItems(): void {
    grid.innerHTML = '';
    const visImages = images.filter((img) => !hidden.has(img));
    if (visImages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'myio-gallery__empty';
      empty.textContent = locale === 'en-US' ? 'No images.' : 'Nenhuma imagem.';
      grid.appendChild(empty);
      return;
    }
    images.forEach((img, index) => {
      if (hidden.has(img)) return;
      const item = document.createElement('figure');
      item.className = 'myio-gallery__item';
      item.dataset.cats = catsOf(img).join(',');
      item.dataset.index = String(index);
      const visible = active === 'all' || catsOf(img).includes(active);
      item.style.display = visible ? '' : 'none';

      // Thumb (clickable → lightbox)
      const thumb = document.createElement('div');
      thumb.className = 'myio-gallery__thumb';
      thumb.style.height = `${itemHeight}px`;
      thumb.setAttribute('role', 'button');
      thumb.tabIndex = 0;
      thumb.setAttribute('aria-label', img.alt || img.caption || 'Imagem');
      const imgEl = document.createElement('img');
      imgEl.src = img.src;
      imgEl.alt = img.alt || '';
      imgEl.loading = 'lazy';
      // Fill missing dimensions from the natural size once loaded.
      imgEl.addEventListener('load', () => {
        if (img.width == null) img.width = imgEl.naturalWidth;
        if (img.height == null) img.height = imgEl.naturalHeight;
        if (enableDetails) {
          const dimsEl = item.querySelector<HTMLElement>('[data-dims]');
          if (dimsEl && !dimsEl.textContent) dimsEl.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
        }
      });
      thumb.appendChild(imgEl);
      if (!showBody && img.caption) {
        const cap = document.createElement('span');
        cap.className = 'myio-gallery__cap';
        cap.textContent = img.caption;
        thumb.appendChild(cap);
      }
      const openIt = () => {
        options.onSelect?.(img, index);
        if (lightboxEnabled) openLightboxByItem(item);
      };
      thumb.addEventListener('click', openIt);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openIt();
        }
      });
      item.appendChild(thumb);

      // Action buttons overlay (delete / hide / edit)
      if (hasActions) {
        const actions = document.createElement('div');
        actions.className = 'myio-gallery__actions';
        if (enableEdit) {
          actions.appendChild(
            actionBtn(ICON_PENCIL, locale === 'en-US' ? 'Edit description' : 'Editar descrição', false, (e) => {
              e.stopPropagation();
              const body = item.querySelector<HTMLElement>('.myio-gallery__body');
              const desc = item.querySelector<HTMLElement>('.myio-gallery__desc');
              if (body && desc) startEdit(body, desc, img, index);
            }),
          );
        }
        if (enableHideBtn) {
          actions.appendChild(
            actionBtn(ICON_EYE_OFF, locale === 'en-US' ? 'Hide' : 'Ocultar', false, (e) => {
              e.stopPropagation();
              hidden.add(img);
              fadeOutAndReflow(item, () => {
                options.onHide?.(img, index);
              });
            }),
          );
        }
        if (enableDelete) {
          actions.appendChild(
            actionBtn(ICON_TRASH, locale === 'en-US' ? 'Delete' : 'Excluir', true, async (e) => {
              e.stopPropagation();
              if (options.onBeforeDelete) {
                const proceed = await options.onBeforeDelete(img, index);
                if (!proceed) return;
              }
              fadeOutAndReflow(item, () => {
                const at = images.indexOf(img);
                if (at >= 0) images.splice(at, 1);
                tabs.setTabs(buildCategories());
                tabs.setActive(active);
                options.onDelete?.(img, index);
              });
            }),
          );
        }
        item.appendChild(actions);
      }

      // Body: description + details
      if (showBody) {
        const body = document.createElement('figcaption');
        body.className = 'myio-gallery__body';
        if (enableDetails) {
          const det = document.createElement('div');
          det.className = 'myio-gallery__details';
          det.innerHTML = detailsHtml(img);
          body.appendChild(det);
        }
        item.appendChild(body);
        renderDescription(body, img, index); // inserts description before details
      }

      grid.appendChild(item);
    });
  }

  /** Build a small action button. */
  function actionBtn(
    icon: string,
    label: string,
    danger: boolean,
    onClick: (e: MouseEvent) => void,
  ): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `myio-gallery__abtn${danger ? ' myio-gallery__abtn--danger' : ''}`;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = icon;
    b.addEventListener('click', onClick);
    return b;
  }

  /** Fade an item out (WAAPI) then run `after` and re-render the grid. */
  function fadeOutAndReflow(item: HTMLElement, after: () => void): void {
    const done = () => {
      after();
      renderItems();
    };
    if (!animateEnabled) {
      done();
      return;
    }
    const anim = item.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'scale(.6)' },
      ],
      { duration: 260, easing: 'ease-in' },
    );
    anim.onfinish = done;
    anim.oncancel = done;
  }

  // ── FLIP-lite filter ──────────────────────────────────────────────────────
  function setFilter(next: string): void {
    if (next === active) return;
    const prev = active;
    active = next;
    tabs.setActive(next);

    const items = Array.from(grid.children).filter(
      (c) => c instanceof HTMLElement && c.classList.contains('myio-gallery__item'),
    ) as HTMLElement[];

    const isVisible = (it: HTMLElement) =>
      next === 'all' || (it.dataset.cats || '').split(',').includes(next);

    if (!animateEnabled) {
      items.forEach((it) => {
        it.style.display = isVisible(it) ? '' : 'none';
      });
      return;
    }

    // FIRST — current rects of items visible under the previous filter.
    const wasVisible = (it: HTMLElement) =>
      prev === 'all' || (it.dataset.cats || '').split(',').includes(prev);
    const firstRects = new Map<HTMLElement, DOMRect>();
    items.forEach((it) => {
      if (it.style.display !== 'none' && wasVisible(it)) firstRects.set(it, it.getBoundingClientRect());
    });

    // Reveal everything that should now be visible so we can measure LAST.
    items.forEach((it) => {
      if (isVisible(it)) it.style.display = '';
    });
    const lastRects = new Map<HTMLElement, DOMRect>();
    items.forEach((it) => {
      if (isVisible(it)) lastRects.set(it, it.getBoundingClientRect());
    });

    items.forEach((it) => {
      const show = isVisible(it);
      const first = firstRects.get(it);
      const last = lastRects.get(it);
      if (show && first && last) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        const sx = first.width && last.width ? first.width / last.width : 1;
        const sy = first.height && last.height ? first.height / last.height : 1;
        if (dx || dy || sx !== 1 || sy !== 1) {
          it.animate(
            [
              { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
              { transformOrigin: 'top left', transform: 'none' },
            ],
            { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' },
          );
        }
      } else if (show && !first) {
        it.animate(
          [
            { opacity: 0, transform: 'scale(.55)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' },
        );
      } else if (!show && first) {
        const anim = it.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'scale(.55)' },
          ],
          { duration: 280, easing: 'ease-in' },
        );
        anim.onfinish = () => {
          it.style.display = 'none';
        };
      } else {
        it.style.display = 'none';
      }
    });
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────
  let lbOverlay: HTMLElement | null = null;
  let lbList: GalleryImage[] = [];
  let lbIndex = 0;

  function visibleImages(): { img: GalleryImage; index: number }[] {
    return images
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => !hidden.has(img) && (active === 'all' || catsOf(img).includes(active)));
  }

  function openLightboxByItem(item: HTMLElement): void {
    const idx = Number(item.dataset.index);
    const vis = visibleImages();
    const pos = vis.findIndex((v) => v.index === idx);
    lbList = vis.map((v) => v.img);
    openLightbox(pos >= 0 ? pos : 0);
  }

  function lbDetailsText(img: GalleryImage): string {
    const parts: string[] = [];
    if (img.filename) parts.push(img.filename);
    if (typeof img.sizeBytes === 'number') parts.push(formatSize(img.sizeBytes));
    if (typeof img.width === 'number' && typeof img.height === 'number') {
      parts.push(`${img.width} × ${img.height}px`);
    }
    return parts.join('  ·  ');
  }

  function renderLightbox(): void {
    if (!lbOverlay) return;
    const img = lbList[lbIndex];
    if (!img) return;
    const imgEl = lbOverlay.querySelector<HTMLImageElement>('.myio-gallery-lb__img')!;
    imgEl.src = img.fullSrc || img.src;
    imgEl.alt = img.alt || '';
    const cap = lbOverlay.querySelector<HTMLElement>('.myio-gallery-lb__cap')!;
    cap.textContent = img.caption || img.alt || '';
    cap.style.display = img.caption || img.alt ? '' : 'none';

    // Details (filename · size · dimensions) — only when enabled.
    const det = lbOverlay.querySelector<HTMLElement>('.myio-gallery-lb__details')!;
    if (enableDetails) {
      const setText = () => {
        det.textContent = lbDetailsText(img);
        det.style.display = det.textContent ? '' : 'none';
      };
      setText();
      // Fill missing dimensions from the loaded full image, then refresh.
      imgEl.onload = () => {
        if (img.width == null) img.width = imgEl.naturalWidth;
        if (img.height == null) img.height = imgEl.naturalHeight;
        setText();
      };
    } else {
      det.style.display = 'none';
      imgEl.onload = null;
    }

    const multi = lbList.length > 1;
    lbOverlay.querySelector<HTMLElement>('.myio-gallery-lb__prev')!.style.display = multi ? '' : 'none';
    lbOverlay.querySelector<HTMLElement>('.myio-gallery-lb__next')!.style.display = multi ? '' : 'none';
  }

  function closeLightbox(): void {
    if (!lbOverlay) return;
    document.removeEventListener('keydown', onLbKey, true);
    lbOverlay.remove();
    lbOverlay = null;
  }

  function onLbKey(e: KeyboardEvent): void {
    if (!lbOverlay) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      lbIndex = (lbIndex + 1) % lbList.length;
      renderLightbox();
    } else if (e.key === 'ArrowLeft') {
      lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
      renderLightbox();
    }
  }

  function openLightbox(index: number): void {
    if (!lbList.length) lbList = visibleImages().map((v) => v.img);
    if (!lbList.length) return;
    lbIndex = Math.max(0, Math.min(index, lbList.length - 1));
    if (!lbOverlay) {
      lbOverlay = document.createElement('div');
      lbOverlay.className = 'myio-gallery-lb';
      lbOverlay.innerHTML = `
        <button type="button" class="myio-gallery-lb__close" aria-label="Fechar">✕</button>
        <button type="button" class="myio-gallery-lb__btn myio-gallery-lb__prev" aria-label="Anterior">${ICON_PREV}</button>
        <img class="myio-gallery-lb__img" src="" alt="" />
        <button type="button" class="myio-gallery-lb__btn myio-gallery-lb__next" aria-label="Próximo">${ICON_NEXT}</button>
        <div class="myio-gallery-lb__cap"></div>
        <div class="myio-gallery-lb__details"></div>
      `;
      lbOverlay.querySelector('.myio-gallery-lb__close')!.addEventListener('click', closeLightbox);
      lbOverlay.querySelector('.myio-gallery-lb__prev')!.addEventListener('click', (e) => {
        e.stopPropagation();
        lbIndex = (lbIndex - 1 + lbList.length) % lbList.length;
        renderLightbox();
      });
      lbOverlay.querySelector('.myio-gallery-lb__next')!.addEventListener('click', (e) => {
        e.stopPropagation();
        lbIndex = (lbIndex + 1) % lbList.length;
        renderLightbox();
      });
      lbOverlay.addEventListener('click', (e) => {
        if (e.target === lbOverlay) closeLightbox();
      });
      document.addEventListener('keydown', onLbKey, true);
      document.body.appendChild(lbOverlay);
    }
    renderLightbox();
  }

  renderItems();
  if (options.container) options.container.appendChild(root);

  return {
    el: root,
    setFilter,
    getFilter: () => active,
    setImages: (next: GalleryImage[]) => {
      images = next.slice();
      tabs.setTabs(buildCategories());
      if (active !== 'all' && !images.some((i) => catsOf(i).includes(active))) active = 'all';
      tabs.setActive(active);
      renderItems();
    },
    openLightbox: (index: number) => {
      lbList = visibleImages().map((v) => v.img);
      openLightbox(index);
    },
    destroy: () => {
      closeLightbox();
      tabs.destroy();
      root.remove();
    },
  };
}
