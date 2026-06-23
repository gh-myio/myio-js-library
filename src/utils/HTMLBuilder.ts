/**
 * HTMLBuilder — a tiny, dependency-free DOM/HTML construction helper.
 *
 * Build real DOM trees declaratively (no JSX, no template-string soup), then
 * either use the `HTMLElement` directly or serialize it to an HTML string with
 * `toHtml`. Children may be strings, numbers, `Node`s, arrays, or **component
 * instances** (any object exposing `.el`, `.getRoot()` or `.getBodyEl()`), so
 * it composes naturally with this library's components (e.g. ImgGallery) and
 * with `openGenericModal` (pass `toHtml(...)` as `bodyHtml`, or build a `<div>`
 * and mount components into it).
 *
 * @example
 *   import { HTMLBuilder } from 'myio-js-library';
 *   const { h, toHtml } = HTMLBuilder;
 *   const card = h('div', { class: 'card', style: { padding: '12px' } },
 *     h('h3', null, 'Ficha Técnica'),
 *     h('hr'),
 *     h('img', { src: url, alt: 'Equipamento' }),
 *   );
 *   openGenericModal({ title: 'Ficha', bodyHtml: toHtml(card) });
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Anything that can become a child node. */
export type HTMLChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | Node
  | { el?: HTMLElement; getRoot?: () => HTMLElement; getBodyEl?: () => HTMLElement }
  | HTMLChild[];

/** Attribute map accepted by {@link h}. */
export interface HTMLAttrs {
  /** Class as a string or array of (falsy-filtered) strings. */
  class?: string | Array<string | false | null | undefined>;
  /** Alias of `class`. */
  className?: string | Array<string | false | null | undefined>;
  /** Inline style as a CSS string or a style object. */
  style?: string | Partial<CSSStyleDeclaration> | Record<string, string | number>;
  /** `data-*` attributes. */
  dataset?: Record<string, string | number | boolean>;
  /** Raw inner HTML (caller-trusted — sanitize untrusted input). */
  html?: string;
  /** Alias of `html`. */
  innerHTML?: string;
  /** Event handlers keyed by event name (without the `on` prefix). */
  on?: Record<string, EventListenerOrEventListenerObject>;
  /** Any other attribute (or `onClick`-style handler / boolean attribute). */
  [key: string]: any;
}

/** HTML-escape a string for safe interpolation into markup. */
export function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveNode(child: any): Node | null {
  if (child == null || child === false || child === true) return null;
  if (child instanceof Node) return child;
  if (typeof child === 'string' || typeof child === 'number') {
    return document.createTextNode(String(child));
  }
  if (typeof child === 'object') {
    const node =
      (typeof child.getRoot === 'function' && child.getRoot()) ||
      child.el ||
      (typeof child.getBodyEl === 'function' && child.getBodyEl());
    if (node instanceof Node) return node;
  }
  return null;
}

function appendChildren(el: Node, children: HTMLChild[]): void {
  for (const child of children) {
    if (Array.isArray(child)) {
      appendChildren(el, child);
      continue;
    }
    const node = resolveNode(child);
    if (node) el.appendChild(node);
  }
}

function applyAttrs(el: HTMLElement, attrs: HTMLAttrs): void {
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (value == null || value === false) continue;

    if (key === 'class' || key === 'className') {
      el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value);
    } else if (key === 'style') {
      if (typeof value === 'string') {
        el.setAttribute('style', value);
      } else {
        for (const [prop, v] of Object.entries(value as Record<string, any>)) {
          (el.style as any)[prop] = typeof v === 'number' ? `${v}px` : String(v);
        }
      }
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(value as Record<string, any>)) {
        el.dataset[dk] = String(dv);
      }
    } else if (key === 'html' || key === 'innerHTML') {
      el.innerHTML = String(value);
    } else if (key === 'on' && typeof value === 'object') {
      for (const [ev, handler] of Object.entries(value as Record<string, any>)) {
        el.addEventListener(ev, handler as EventListenerOrEventListenerObject);
      }
    } else if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      // onClick → 'click', onMouseEnter → 'mouseenter'
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

/**
 * Create an element with attributes and children.
 * @param tag    Tag name (e.g. 'div', 'img').
 * @param attrs  Attribute map (see {@link HTMLAttrs}) or null.
 * @param children Child nodes/strings/components/arrays.
 */
export function h(tag: string, attrs?: HTMLAttrs | null, ...children: HTMLChild[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  appendChildren(el, children);
  return el;
}

/** Create a text node. */
export function text(value: string | number): Text {
  return document.createTextNode(String(value));
}

/** Build a `DocumentFragment` from children (no wrapper element). */
export function frag(...children: HTMLChild[]): DocumentFragment {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

/**
 * Parse an HTML string into a single element (or a fragment when it has
 * multiple roots). Useful for turning a stored snippet into a real node.
 */
export function fromHtml(htmlString: string): HTMLElement | DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(htmlString).trim();
  const content = tpl.content;
  if (content.childNodes.length === 1 && content.firstElementChild) {
    return content.firstElementChild as HTMLElement;
  }
  return content;
}

/** Serialize an element/fragment (or component instance) to an HTML string. */
export function toHtml(node: Node | { getRoot?: () => HTMLElement; el?: HTMLElement }): string {
  const resolved = resolveNode(node as any);
  if (!resolved) return '';
  if (resolved instanceof Element) return resolved.outerHTML;
  const wrap = document.createElement('div');
  wrap.appendChild(resolved.cloneNode(true));
  return wrap.innerHTML;
}

/**
 * Append children into a parent (clearing it first unless `append` is true).
 * Accepts components, nodes, strings — returns the parent.
 */
export function mount(
  parent: HTMLElement,
  children: HTMLChild | HTMLChild[],
  append = false,
): HTMLElement {
  if (!append) parent.innerHTML = '';
  appendChildren(parent, Array.isArray(children) ? children : [children]);
  return parent;
}

/** Namespace export so callers can do `HTMLBuilder.h(...)`. */
export const HTMLBuilder = { h, text, frag, fromHtml, toHtml, mount, escapeHtml };

export default HTMLBuilder;
