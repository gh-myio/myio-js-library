// premium-modals/internal/PremiumModalChrome.ts
//
// Moldura padrão das modais premium MYIO: cabeçalho RFC-0121 (ModalHeader) sólido no acento
// do tema do dashboard (--myio-brand-700), com claro/escuro, maximizar e fechar, mais o footer
// premium (createModalFooter: customer · relógio · versão | Powered by MYIO | exports).
//
// Diferente do ModalHeader.createController (que usa o `document` global), os botões são
// ligados pelo próprio elemento do header — funciona em modais montadas em window.top.document
// (MENU) ou em qualquer outro documento.

import { ModalHeader } from '../../../utils/ModalHeader';
import { createModalFooter } from '../footer-modal';
import type { ModalFooterInstance, ModalFooterParams } from '../footer-modal';

/** Acento do tema do dashboard, com o roxo MYIO como reserva. */
export const MYIO_ACCENT = 'var(--myio-brand-700, #3e1a7d)';

export type PremiumChromeTheme = 'light' | 'dark';

export interface PremiumModalChromeOptions {
  /** Prefixo dos ids dos botões (`<modalId>-theme-toggle`, `-maximize`, `-close`). */
  modalId: string;
  icon: string;
  title: string;
  /** Caixa da modal: recebe a classe de maximizado e (por padrão) o footer. */
  modalEl: HTMLElement;
  /** Elemento a ser trocado pelo header padrão; sem ele o header entra no topo de modalEl. */
  headerSlot?: HTMLElement | null;
  /** Onde gravar data-theme (default modalEl). */
  themeTarget?: HTMLElement;
  theme?: PremiumChromeTheme;
  /** Só faz sentido quando a modal tem estilos para data-theme="dark". */
  showThemeToggle?: boolean;
  showMaximize?: boolean;
  /** Estado inicial de maximizado (modais que se redesenham e recriam a moldura). */
  maximized?: boolean;
  maximizedClass?: string;
  headerRadius?: string;
  /** Modal cuja caixa é o próprio container de rolagem: header/footer fixos (sticky). */
  sticky?: boolean;
  onClose: () => void;
  onThemeChange?: (theme: PremiumChromeTheme) => void;
  onMaximizeChange?: (maximized: boolean) => void;
  /** Config do footer premium (themeMode é gerido aqui); false = sem footer. */
  footer?: false | Omit<ModalFooterParams, 'themeMode'>;
  /** Onde anexar o footer (default modalEl). */
  footerHost?: HTMLElement;
  /**
   * RFC-0239: paleta a aplicar no modalEl. undefined = comportamento atual (paleta global
   * window.MyIOUtils.theme); null = não aplicar paleta.
   */
  palette?: PaletteSource | null;
  /**
   * RFC-0239: false = nunca consultar globais (paleta, nome do customer, versão da lib),
   * mesmo sem `palette`. Default true.
   */
  useGlobals?: boolean;
}

/** Paleta createMyIOTheme ou mapa plano de CSS vars (--myio-*). */
export type PaletteSource = { cssVars(): Record<string, string> } | Record<string, string>;

export interface PremiumModalChromeInstance {
  header: HTMLElement;
  footer: ModalFooterInstance | null;
  getTheme(): PremiumChromeTheme;
  setTheme(theme: PremiumChromeTheme): void;
  setTitle(title: string): void;
  /** Re-anexa o footer (modais que reconstroem o próprio conteúdo via innerHTML). */
  remountFooter(host?: HTMLElement): void;
  destroy(): void;
}

type WinLike = {
  MyIOUtils?: {
    theme?: { cssVars?(): Record<string, string> } | Record<string, string>;
    customerName?: string;
  };
  MyIOOrchestrator?: { customerName?: string };
  MyIOLibrary?: { version?: string };
};

function win(): WinLike {
  return (typeof window !== 'undefined' ? window : {}) as WinLike;
}

/**
 * Copia a paleta do dashboard (createMyIOTheme / mapa de --myio-*) para o elemento.
 * Sem `opts`: lê window.MyIOUtils.theme (comportamento atual). Com `opts.palette`: usa a
 * paleta dada (null = nenhuma). `opts.useGlobals === false`: nunca lê globais.
 */
export function applyDashboardPalette(
  el: HTMLElement | null | undefined,
  opts?: { palette?: PaletteSource | null; useGlobals?: boolean },
): void {
  if (!el) return;
  const theme =
    opts && opts.palette !== undefined
      ? opts.palette
      : opts?.useGlobals === false
        ? null
        : win().MyIOUtils?.theme;
  if (!theme) return;
  const vars =
    typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (theme as { cssVars(): Record<string, string> }).cssVars()
      : (theme as Record<string, string>);
  if (!vars || typeof vars !== 'object') return;
  Object.entries(vars).forEach(([k, v]) => {
    if (k.startsWith('--') && typeof v === 'string') el.style.setProperty(k, v);
  });
}

export function resolveDashboardCustomerName(): string {
  const w = win();
  return w.MyIOOrchestrator?.customerName || w.MyIOUtils?.customerName || '';
}

export function createPremiumModalChrome(opts: PremiumModalChromeOptions): PremiumModalChromeInstance {
  const doc = opts.modalEl.ownerDocument || document;
  const themeTarget = opts.themeTarget || opts.modalEl;
  const maximizedClass = opts.maximizedClass || 'is-maximized';
  const radius = opts.headerRadius || '12px 12px 0 0';
  let theme: PremiumChromeTheme = opts.theme === 'dark' ? 'dark' : 'light';
  let maximized = opts.maximized === true;
  let title = opts.title;

  const useGlobals = opts.useGlobals !== false;
  applyDashboardPalette(opts.modalEl, { palette: opts.palette, useGlobals });
  themeTarget.setAttribute('data-theme', theme);
  opts.modalEl.classList.toggle(maximizedClass, maximized);

  const buildHeader = (): HTMLElement => {
    const tmp = doc.createElement('div');
    tmp.innerHTML = ModalHeader.generateInlineHTML({
      icon: opts.icon,
      title,
      modalId: opts.modalId,
      theme,
      solid: true, // acento do tema + texto branco nos dois modos
      primaryColor: MYIO_ACCENT,
      showThemeToggle: opts.showThemeToggle === true,
      showMaximize: opts.showMaximize !== false,
      showClose: true,
      isMaximized: maximized,
      borderRadius: radius,
      draggable: false,
    }).trim();
    const el = tmp.firstElementChild as HTMLElement;
    el.classList.add('myio-premium-chrome-header');
    el.style.flexShrink = '0';
    if (opts.sticky) {
      el.style.position = 'sticky';
      el.style.top = '0';
      el.style.zIndex = '3';
    }
    return el;
  };

  let header = buildHeader();
  if (maximized) header.style.borderRadius = '0';
  if (opts.headerSlot) opts.headerSlot.replaceWith(header);
  else opts.modalEl.insertBefore(header, opts.modalEl.firstChild);

  let footer: ModalFooterInstance | null = null;
  if (opts.footer !== false) {
    const f = opts.footer || {};
    footer = createModalFooter({
      ...f,
      customerName: f.customerName ?? (useGlobals ? resolveDashboardCustomerName() : ''),
      libVersion: f.libVersion ?? (useGlobals ? { current: win().MyIOLibrary?.version } : false),
      themeMode: theme,
    });
    footer.element.style.flexShrink = '0';
    if (opts.sticky) {
      footer.element.style.position = 'sticky';
      footer.element.style.bottom = '0';
      footer.element.style.zIndex = '3';
    }
    (opts.footerHost || opts.modalEl).appendChild(footer.element);
  }

  const wire = (): void => {
    header.querySelector(`#${opts.modalId}-close`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClose();
    });
    header.querySelector(`#${opts.modalId}-maximize`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      maximized = !maximized;
      opts.modalEl.classList.toggle(maximizedClass, maximized);
      rebuild();
      opts.onMaximizeChange?.(maximized);
    });
    header.querySelector(`#${opts.modalId}-theme-toggle`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      api.setTheme(theme === 'dark' ? 'light' : 'dark');
    });
  };

  // Reconstrói o header (ícones/raio dependem do estado) mantendo a posição
  const rebuild = (): void => {
    const next = buildHeader();
    header.replaceWith(next);
    header = next;
    if (maximized) header.style.borderRadius = '0';
    wire();
  };

  const api: PremiumModalChromeInstance = {
    get header() {
      return header;
    },
    footer,
    getTheme: () => theme,
    setTheme(next) {
      theme = next === 'dark' ? 'dark' : 'light';
      themeTarget.setAttribute('data-theme', theme);
      footer?.setThemeMode(theme);
      rebuild();
      opts.onThemeChange?.(theme);
    },
    setTitle(next) {
      title = next;
      rebuild();
    },
    remountFooter(host) {
      if (footer) (host || opts.footerHost || opts.modalEl).appendChild(footer.element);
    },
    destroy() {
      footer?.destroy();
      footer = null;
    },
  };

  wire();
  return api;
}
