/**
 * RFC-0241 — "🎯 Metas e Tarifas" area picker.
 *
 * Extracted from the head-office simulator's inline `pickGoalsArea`
 * (MYIO-SIM/v5.4.0_UNIQUE) so the Shopping dashboard v-5.2.0 (via MAIN_VIEW's
 * `MyIOUtils.openGoalsTariffs`) and the simulator share one component.
 *
 * The picker only renders up to three cards and routes clicks — every target
 * (goals editor, Metas × Consumo, pricing panel) is a caller-provided handler,
 * so the component holds no credentials and makes no API calls:
 *   - `manage`  → 🛠️ Gestão de Metas (caller opens `openGoalsPanel`)
 *   - `compare` → 📊 Metas × Consumo (caller opens its compare modal)
 *   - `tariffs` → 💲 Tarifas (caller opens `openPricingPanel` with `tariffApi`)
 * A card renders only when its handler is provided.
 */

import { createModalFooter, type ModalFooterInstance } from '../premium-modals/footer-modal';

export type GoalsTariffsArea = 'manage' | 'compare' | 'tariffs';

export type GoalsTariffsHandlers = Partial<Record<GoalsTariffsArea, () => void | Promise<void>>>;

/** Same contract as the settings hub: `createMyIOTheme` object or flat `--myio-*` map. */
export type GoalsTariffsThemeSource = { cssVars(): Record<string, string> } | Record<string, string>;

export interface OpenGoalsTariffsHubOptions {
  /** Header title. Default `'🎯 Metas e Tarifas'`. */
  title?: string;
  /** Entity noun used in the default "Gestão de Metas" description. Default `'shopping'`. */
  entityLabel?: string;
  /** One callback per area; areas without a handler are not rendered. */
  handlers: GoalsTariffsHandlers;
  /** Optional per-card description overrides (plain text, HTML-escaped). */
  descriptions?: Partial<Record<GoalsTariffsArea, string>>;
  /** Host palette; falls back to `window.MyIOUtils.theme` when omitted. */
  theme?: GoalsTariffsThemeSource;
  /** Premium footer (customer · clock · lib version). Omitted → no footer. */
  footer?: { customerName?: string; libVersion?: string };
  /** Where to mount. Defaults to the top-level document (falls back on cross-origin frames). */
  targetDocument?: Document;
  /** Called once when the picker closes (any reason, including routing). */
  onClose?: () => void;
  /** Called when a handler throws or rejects. Default: `console.error`. */
  onError?: (err: unknown, area: GoalsTariffsArea) => void;
}

export interface GoalsTariffsHubHandle {
  close(): void;
}

/** Delay between closing the picker and running the handler (close animation). */
const ROUTE_DELAY_MS = 200;

const MODAL_ID = 'myio-goals-tariffs-hub';
const STYLE_ID = 'myio-goals-tariffs-hub-styles';

interface AreaDef {
  area: GoalsTariffsArea;
  icon: string;
  title: string;
  desc: (entity: string) => string;
}

const AREAS: AreaDef[] = [
  {
    area: 'manage',
    icon: '🛠️',
    title: 'Gestão de Metas',
    desc: (entity) =>
      `Criar, atualizar e importar metas por ${entity} (planilha, histórico de versões, margem).`,
  },
  {
    area: 'compare',
    icon: '📊',
    title: 'Metas × Consumo',
    desc: () => 'Comparar o consumo real com as metas, num único painel.',
  },
  {
    area: 'tariffs',
    icon: '💲',
    title: 'Tarifas',
    desc: () => 'Tarifas de energia e água (R$/kWh, R$/m³) por categoria e período.',
  },
];

const HUB_CSS = `
  .myio-gt-hub {
    position: fixed; inset: 0; z-index: 999999;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
    font-family: 'Nunito', system-ui, sans-serif;
  }
  .myio-gt-hub.show { opacity: 1; pointer-events: auto; }
  .myio-gt-hub__overlay {
    position: absolute; inset: 0;
    background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(4px);
  }
  .myio-gt-hub__content {
    position: relative; z-index: 2; background: #FFFFFF; border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    width: min(720px, calc(100% - 32px)); max-height: 90vh; overflow: hidden;
    display: flex; flex-direction: column;
    transform: translateY(10px) scale(0.98); transition: transform 0.2s ease;
  }
  .myio-gt-hub.show .myio-gt-hub__content { transform: translateY(0) scale(1); }
  .myio-gt-hub__header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: var(--myio-brand-700, #3e1a7d);
    color: var(--myio-accent-text, #FFFFFF);
  }
  .myio-gt-hub__header h3 { margin: 0; font-size: 15px; font-weight: 700; }
  .myio-gt-hub__close {
    background: transparent; border: none; color: inherit; font-size: 22px; line-height: 1;
    cursor: pointer; padding: 2px 6px; border-radius: 4px;
  }
  .myio-gt-hub__close:hover { background: rgba(255, 255, 255, 0.15); }
  .myio-gt-hub__body {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px; padding: 18px; overflow-y: auto;
  }
  .myio-gt-hub__card {
    display: flex; flex-direction: column; gap: 8px; padding: 20px 18px;
    border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;
    cursor: pointer; text-align: left; font-family: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .myio-gt-hub__card:hover, .myio-gt-hub__card:focus-visible {
    border-color: var(--myio-brand-700, #3e1a7d);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); outline: none;
  }
  .myio-gt-hub__icon { font-size: 26px; }
  .myio-gt-hub__title { font-size: 14px; font-weight: 700; color: #1E293B; }
  .myio-gt-hub__desc { font-size: 12px; font-weight: 600; color: #64748B; line-height: 1.35; }
`;

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTopDocument(): Document {
  try {
    return ((window.top || window) as Window).document;
  } catch {
    return document;
  }
}

function resolveThemeVars(explicit?: GoalsTariffsThemeSource): Record<string, string> | null {
  const theme =
    explicit ||
    (typeof window !== 'undefined'
      ? (window as { MyIOUtils?: { theme?: GoalsTariffsThemeSource } }).MyIOUtils?.theme
      : undefined);
  if (!theme) return null;
  try {
    const vars =
      typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
        ? (theme as { cssVars(): Record<string, string> }).cssVars()
        : (theme as Record<string, string>);
    return vars && typeof vars === 'object' ? vars : null;
  } catch {
    return null;
  }
}

export function openGoalsTariffsHub(options: OpenGoalsTariffsHubOptions): GoalsTariffsHubHandle {
  const handlers = options.handlers || {};
  const doc = options.targetDocument || resolveTopDocument();
  const title = options.title || '🎯 Metas e Tarifas';
  const entity = options.entityLabel || 'shopping';
  const reportError =
    options.onError ||
    ((err: unknown, area: GoalsTariffsArea) => {
      // eslint-disable-next-line no-console
      console.error(`[GoalsTariffsHub] handler '${area}' falhou:`, err);
    });

  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = HUB_CSS;
    doc.head.appendChild(style);
  }

  // Single instance: replace any existing picker.
  doc.getElementById(MODAL_ID)?.remove();

  const visible = AREAS.filter((a) => typeof handlers[a.area] === 'function');
  const cardsHtml = visible
    .map((a) => {
      const desc = options.descriptions?.[a.area] ?? a.desc(entity);
      return `
      <button type="button" class="myio-gt-hub__card" data-area="${a.area}">
        <span class="myio-gt-hub__icon">${a.icon}</span>
        <span class="myio-gt-hub__title">${a.title}</span>
        <span class="myio-gt-hub__desc">${escapeHtml(desc)}</span>
      </button>`;
    })
    .join('');

  const modal = doc.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'myio-gt-hub';
  modal.innerHTML = `
    <div class="myio-gt-hub__overlay"></div>
    <div class="myio-gt-hub__content" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="myio-gt-hub__header">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="myio-gt-hub__close" aria-label="Fechar">&times;</button>
      </div>
      <div class="myio-gt-hub__body">${cardsHtml}
      </div>
    </div>
  `;
  doc.body.appendChild(modal);

  const themeVars = resolveThemeVars(options.theme);
  if (themeVars) {
    Object.entries(themeVars).forEach(([k, v]) => {
      if (k.startsWith('--') && typeof v === 'string') modal.style.setProperty(k, v);
    });
  }

  let footer: ModalFooterInstance | null = null;
  if (options.footer) {
    try {
      footer = createModalFooter({
        customerName: options.footer.customerName || '',
        libVersion: options.footer.libVersion ? { current: options.footer.libVersion } : false,
        libVersionMode: 'static',
        themeMode: 'light',
      });
      modal.querySelector('.myio-gt-hub__content')?.appendChild(footer.element);
    } catch {
      footer = null; // footer é enfeite — nunca bloqueia o picker
    }
  }

  const raf =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 0);
  raf(() => modal.classList.add('show'));

  let closed = false;
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  function close(): void {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', escHandler);
    modal.classList.remove('show');
    setTimeout(() => {
      footer?.destroy?.();
      modal.remove();
    }, 200);
    try {
      options.onClose?.();
    } catch {
      /* callback errors are isolated */
    }
  }

  modal.querySelector('.myio-gt-hub__overlay')?.addEventListener('click', close);
  modal.querySelector('.myio-gt-hub__close')?.addEventListener('click', close);
  doc.addEventListener('keydown', escHandler);

  modal.querySelectorAll<HTMLButtonElement>('.myio-gt-hub__card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const area = btn.dataset.area as GoalsTariffsArea;
      close();
      setTimeout(() => {
        try {
          const out = handlers[area]?.();
          if (out && typeof (out as Promise<void>).then === 'function') {
            (out as Promise<void>).catch((err) => reportError(err, area));
          }
        } catch (err) {
          reportError(err, area);
        }
      }, ROUTE_DELAY_MS);
    });
  });

  return { close };
}
