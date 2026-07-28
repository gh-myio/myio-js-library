/**
 * ScrollableTabs — a configurable, dependency-free tab strip.
 *
 * Renders pill tabs in a horizontal row. When the tabs overflow the available
 * width (either naturally, or because `maxVisible` caps the strip width), it
 * shows left/right arrow buttons that scroll the strip; the arrows
 * enable/disable at the extremes and hide entirely when everything fits.
 *
 * Standalone (used by ImgGallery, but exported for reuse). Vanilla DOM, scoped
 * CSS (`myio-tabs-*`), no framework.
 */

export interface TabItem {
  /** Stable key emitted by onChange and matched by setActive. */
  key: string;
  /** Visible label (rendered as text). */
  label: string;
  /** Optional leading icon/emoji or inline SVG/HTML. */
  icon?: string;
  /** When true, the tab is shown but not selectable. */
  disabled?: boolean;
}

export interface ScrollableTabsOptions {
  /** Tab definitions, in display order. */
  tabs: TabItem[];
  /** Initially-active key. Default: first tab. */
  active?: string;
  /** Fired when the active tab changes (user click). */
  onChange?: (key: string) => void;
  /**
   * Cap the strip to roughly N tabs' width, forcing horizontal scroll + arrows
   * once there are more than N tabs. Omit to size to the container.
   */
  maxVisible?: number;
  /** 'auto' (default) shows arrows only on overflow; true/false force it. */
  showArrows?: boolean | 'auto';
  /** Color theme. Default: 'light'. */
  theme?: 'light' | 'dark';
  /** Accent color for the active tab/arrows. Default: '#7C3AED'. */
  accent?: string;
  /** Mount target. If given, the strip is appended to it. */
  container?: HTMLElement;
  /** aria-label for the tablist. */
  ariaLabel?: string;
}

export interface ScrollableTabsInstance {
  /** The root element (a `.myio-tabs`). */
  el: HTMLElement;
  /** Programmatically set the active tab (does not fire onChange). */
  setActive: (key: string) => void;
  /** Current active key. */
  getActive: () => string;
  /** Replace the tab set (keeps active if still present, else first). */
  setTabs: (tabs: TabItem[]) => void;
  /** Re-evaluate arrow visibility (call after a resize you control). */
  refresh: () => void;
  /** Remove listeners/observers and detach the element. */
  destroy: () => void;
}

const STYLE_ID = 'myio-tabs-styles';
const FONT_LINK_ID = 'myio-dialog-font-nunito';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
.myio-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Nunito', system-ui, sans-serif;
  max-width: 100%;
}
.myio-tabs__arrow {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: opacity .15s ease, background .15s ease;
}
.myio-tabs__arrow svg { width: 16px; height: 16px; }
.myio-tabs__arrow:hover:not(:disabled) { background: #f3f4f6; }
.myio-tabs__arrow:disabled { opacity: .35; cursor: default; }
.myio-tabs--overflow .myio-tabs__arrow { display: inline-flex; }
.myio-tabs__scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1 1 auto;
  min-width: 0;
}
.myio-tabs__scroll::-webkit-scrollbar { display: none; }
.myio-tabs__tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.myio-tabs__tab:hover:not(.myio-tabs__tab--active):not(:disabled) { background: #f3f4f6; }
.myio-tabs__tab:disabled { opacity: .45; cursor: default; }
.myio-tabs__tab:focus-visible { outline: 2px solid var(--myio-tabs-accent, #7C3AED); outline-offset: 2px; }

/* ── Dark theme ── */
.myio-tabs--dark .myio-tabs__arrow { background: #1f2937; color: #e5e7eb; border-color: #4b5563; }
.myio-tabs--dark .myio-tabs__arrow:hover:not(:disabled) { background: #374151; }
.myio-tabs--dark .myio-tabs__tab { background: #1f2937; color: #e5e7eb; border-color: #4b5563; }
.myio-tabs--dark .myio-tabs__tab:hover:not(.myio-tabs__tab--active):not(:disabled) { background: #374151; }
`;
  document.head.appendChild(style);
}

const CHEVRON_LEFT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const CHEVRON_RIGHT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';

export function createScrollableTabs(options: ScrollableTabsOptions): ScrollableTabsInstance {
  if (typeof document === 'undefined') {
    throw new Error('[createScrollableTabs] requires a browser environment');
  }
  injectStyles();

  const theme = options.theme ?? 'light';
  const accent = options.accent ?? '#7C3AED';
  const showArrows = options.showArrows ?? 'auto';

  let tabs = options.tabs.slice();
  let active = options.active ?? (tabs[0] ? tabs[0].key : '');

  const root = document.createElement('div');
  root.className = `myio-tabs${theme === 'dark' ? ' myio-tabs--dark' : ''}`;
  root.style.setProperty('--myio-tabs-accent', accent);
  root.setAttribute('role', 'tablist');
  if (options.ariaLabel) root.setAttribute('aria-label', options.ariaLabel);

  const left = document.createElement('button');
  left.type = 'button';
  left.className = 'myio-tabs__arrow myio-tabs__arrow--left';
  left.setAttribute('aria-label', 'Anterior');
  left.innerHTML = CHEVRON_LEFT;

  const scroll = document.createElement('div');
  scroll.className = 'myio-tabs__scroll';

  const right = document.createElement('button');
  right.type = 'button';
  right.className = 'myio-tabs__arrow myio-tabs__arrow--right';
  right.setAttribute('aria-label', 'Próximo');
  right.innerHTML = CHEVRON_RIGHT;

  root.appendChild(left);
  root.appendChild(scroll);
  root.appendChild(right);

  function styleTab(btn: HTMLButtonElement, isActive: boolean): void {
    btn.classList.toggle('myio-tabs__tab--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      btn.style.background = accent;
      btn.style.color = '#fff';
      btn.style.borderColor = accent;
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }

  function renderTabs(): void {
    scroll.innerHTML = '';
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'myio-tabs__tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.key = t.key;
      if (t.disabled) btn.disabled = true;
      btn.innerHTML = `${t.icon ? `<span aria-hidden="true">${t.icon}</span>` : ''}<span>${escapeHtml(t.label)}</span>`;
      styleTab(btn, t.key === active);
      btn.addEventListener('click', () => {
        if (t.disabled || t.key === active) return;
        setActive(t.key);
        options.onChange?.(t.key);
        // keep the selected tab visible
        btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      });
      scroll.appendChild(btn);
    });
    applyMaxVisible();
    requestAnimationFrame(updateArrows);
  }

  function applyMaxVisible(): void {
    scroll.style.maxWidth = '';
    if (!options.maxVisible || tabs.length <= options.maxVisible) return;
    const children = Array.from(scroll.children) as HTMLElement[];
    const gap = 6;
    let width = 0;
    for (let i = 0; i < options.maxVisible && i < children.length; i++) {
      width += children[i].offsetWidth + (i > 0 ? gap : 0);
    }
    // + a hint of the next tab so it's clearly scrollable
    if (children[options.maxVisible]) width += 28;
    if (width > 0) scroll.style.maxWidth = `${Math.ceil(width)}px`;
  }

  function updateArrows(): void {
    const overflow = scroll.scrollWidth - scroll.clientWidth > 1;
    const wantArrows = showArrows === true || (showArrows === 'auto' && overflow);
    root.classList.toggle('myio-tabs--overflow', wantArrows);
    if (!wantArrows) return;
    left.disabled = scroll.scrollLeft <= 0;
    right.disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
  }

  function setActive(key: string): void {
    active = key;
    Array.from(scroll.children).forEach((c) => {
      const btn = c as HTMLButtonElement;
      styleTab(btn, btn.dataset.key === key);
    });
  }

  left.addEventListener('click', () => {
    scroll.scrollBy({ left: -Math.round(scroll.clientWidth * 0.8), behavior: 'smooth' });
  });
  right.addEventListener('click', () => {
    scroll.scrollBy({ left: Math.round(scroll.clientWidth * 0.8), behavior: 'smooth' });
  });
  scroll.addEventListener('scroll', updateArrows, { passive: true });

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      applyMaxVisible();
      updateArrows();
    });
    ro.observe(root);
    ro.observe(scroll);
  }
  const onWinResize = () => {
    applyMaxVisible();
    updateArrows();
  };
  window.addEventListener('resize', onWinResize);

  renderTabs();

  if (options.container) options.container.appendChild(root);

  return {
    el: root,
    setActive,
    getActive: () => active,
    setTabs: (next: TabItem[]) => {
      tabs = next.slice();
      if (!tabs.some((t) => t.key === active)) active = tabs[0] ? tabs[0].key : '';
      renderTabs();
    },
    refresh: () => {
      applyMaxVisible();
      updateArrows();
    },
    destroy: () => {
      ro?.disconnect();
      window.removeEventListener('resize', onWinResize);
      root.remove();
    },
  };
}
