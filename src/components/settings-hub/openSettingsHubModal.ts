/**
 * RFC-0215 Phase 3 — Settings hub modal ("⚙️ Configurações" picker).
 *
 * Single source for the consolidated settings menu (RFC-0108) used by the
 * main-dashboard-shopping controllers (v-5.2.0 MENU and v-5.4.0). The hub only
 * renders the option grid and routes clicks — each option's target modal is a
 * caller-provided handler, so the component stays version-agnostic (v-5.2.0
 * handlers read the MyIOUtils bridge; v-5.4.0 handlers call MyIOLibrary).
 *
 * Options are fixed (same ids, icons, labels and ordering as v-5.2.0
 * showSettingsModal); a card renders only when its handler is provided and,
 * for the MyIO-only options, when `isSuperAdmin` is true.
 */

export type SettingsHubAction =
  | 'temperature'
  | 'contract'
  | 'measurement'
  | 'integration'
  | 'user-management'
  | 'default-dashboard'
  | 'client-config'
  | 'device-profile';

export type SettingsHubHandlers = Partial<Record<SettingsHubAction, () => void>>;

/**
 * Host dashboard palette: either a `createMyIOTheme` object (exposes `cssVars()`)
 * or a flat map of `--myio-*` CSS custom properties. Applied to the hub root so
 * the header/accent follow the dashboard palette.
 */
export type SettingsHubThemeSource = { cssVars(): Record<string, string> } | Record<string, string>;

export interface OpenSettingsHubModalOptions {
  /** Shown in the header as "⚙️ Configurações — <customerName>" (omitted when empty). */
  customerName?: string;
  /** Renders the MyIO-only options (integration, user-management, default-dashboard, client-config, device-profile). */
  isSuperAdmin?: boolean;
  /** One callback per option; options without a handler are not rendered. */
  handlers: SettingsHubHandlers;
  /** Where to mount the modal. Defaults to the top-level document (falls back to the current one on cross-origin frames). */
  targetDocument?: Document;
  /**
   * Host dashboard palette (createMyIOTheme or flat `--myio-*` map). When omitted,
   * falls back to `window.MyIOUtils.theme`. Applied to the hub root; sub-modals
   * opened by the option handlers inherit the same palette through the global
   * (they read `window.MyIOUtils.theme` themselves).
   */
  theme?: SettingsHubThemeSource;
}

export interface SettingsHubModalHandle {
  close(): void;
}

/** Delay between closing the hub and opening the target modal (close animation). */
const ROUTE_DELAY_MS = 250;

const MODAL_ID = 'myio-conf-picker';
const STYLE_ID = 'myio-conf-picker-styles';

interface HubOptionDef {
  action: SettingsHubAction;
  icon: string;
  title: string;
  desc: string;
  superAdminOnly: boolean;
}

// Same cards, ordering and gating as v-5.2.0 MENU showSettingsModal (RFC-0108).
const HUB_OPTIONS: HubOptionDef[] = [
  {
    action: 'temperature',
    icon: '🌡️',
    title: 'Config. Temperatura',
    desc: 'Limites e alertas de temperatura',
    superAdminOnly: false,
  },
  {
    action: 'contract',
    icon: '📋',
    title: 'Dispositivos Contratados',
    desc: 'Quantidade de dispositivos por domínio',
    superAdminOnly: false,
  },
  {
    action: 'measurement',
    icon: '📐',
    title: 'Config. Medidas',
    desc: 'Unidades e casas decimais',
    superAdminOnly: false,
  },
  {
    action: 'integration',
    icon: '🔗',
    title: 'Setup de Integração',
    desc: 'Ingestion · GCDR — apenas MyIO',
    superAdminOnly: true,
  },
  {
    action: 'user-management',
    icon: '👥',
    title: 'Gestão de Usuários',
    desc: 'Usuários e perfis — apenas MyIO',
    superAdminOnly: true,
  },
  {
    action: 'default-dashboard',
    icon: '🏠',
    title: 'Dashboard Padrão',
    desc: 'Dashboard exibido ao criar novos usuários — apenas MyIO',
    superAdminOnly: true,
  },
  {
    action: 'client-config',
    icon: '🏢',
    title: 'Configurações Cliente',
    desc: 'Funcionalidades e senha master — apenas MyIO',
    superAdminOnly: true,
  },
  {
    action: 'device-profile',
    icon: '🧩',
    title: 'Gestão de Perfil de Dispositivos',
    desc: 'Regras de classificação (colunas e breakdown) — apenas MyIO',
    superAdminOnly: true,
  },
];

const HUB_CSS = `
  .myio-conf-picker {
    position: fixed;
    inset: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    font-family: 'Nunito', system-ui, sans-serif;
  }
  .myio-conf-picker.show {
    opacity: 1;
    pointer-events: auto;
  }
  .myio-conf-picker__overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
  .myio-conf-picker__content {
    position: relative;
    z-index: 2;
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    width: min(640px, 90vw);
    max-height: 90vh;
    overflow: hidden;
    transform: translateY(10px) scale(0.98);
    transition: transform 0.2s ease;
  }
  .myio-conf-picker.show .myio-conf-picker__content {
    transform: translateY(0) scale(1);
  }
  .myio-conf-picker__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--myio-brand-700, #3e1a7d);
    color: white;
    min-height: 32px;
  }
  .myio-conf-picker__header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .myio-conf-picker__close {
    background: transparent;
    border: none;
    color: white;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background 0.15s ease;
  }
  .myio-conf-picker__close:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .myio-conf-picker__body {
    padding: 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .myio-settings-option {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    background: #FAFAFA;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }
  .myio-settings-option:hover {
    background: #F3E5F5;
    border-color: #CE93D8;
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(123, 31, 162, 0.1);
  }
  .myio-settings-option:active {
    transform: translateX(2px);
  }
  .myio-settings-option__icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: white;
    font-size: 22px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  .myio-settings-option__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .myio-settings-option__title {
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
  }
  .myio-settings-option__desc {
    font-size: 12px;
    color: #6B7280;
    line-height: 1.3;
  }
  .myio-settings-option--myio .myio-settings-option__icon {
    background: linear-gradient(135deg, #3E1A7D22, #6A2FC022);
  }
  .myio-settings-option--myio .myio-settings-option__desc {
    color: var(--myio-brand-700, #7B2FF7);
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTopDocument(): Document {
  try {
    const topWin = (window.top || window) as Window;
    return topWin.document;
  } catch {
    return document;
  }
}

// Paleta efetiva: option explícita OU o global do dashboard (MyIOUtils.theme).
function resolveHubThemeVars(explicit?: SettingsHubThemeSource): Record<string, string> | null {
  const theme =
    explicit ||
    (typeof window !== 'undefined'
      ? (window as { MyIOUtils?: { theme?: SettingsHubThemeSource } }).MyIOUtils?.theme
      : undefined);
  if (!theme) return null;
  const vars =
    typeof (theme as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (theme as { cssVars(): Record<string, string> }).cssVars()
      : (theme as Record<string, string>);
  return vars && typeof vars === 'object' ? vars : null;
}

export function openSettingsHubModal(options: OpenSettingsHubModalOptions): SettingsHubModalHandle {
  const { customerName = '', isSuperAdmin = false, handlers } = options;
  const doc = options.targetDocument || resolveTopDocument();

  // Inject styles once per document.
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = HUB_CSS;
    doc.head.appendChild(style);
  }

  // Single instance: replace any existing hub.
  doc.getElementById(MODAL_ID)?.remove();

  const visibleOptions = HUB_OPTIONS.filter(
    (opt) => typeof handlers[opt.action] === 'function' && (!opt.superAdminOnly || isSuperAdmin)
  );

  const cardsHtml = visibleOptions
    .map(
      (opt) => `
      <button class="myio-settings-option${opt.superAdminOnly ? ' myio-settings-option--myio' : ''}" data-action="${opt.action}">
        <span class="myio-settings-option__icon">${opt.icon}</span>
        <div class="myio-settings-option__text">
          <span class="myio-settings-option__title">${opt.title}</span>
          <span class="myio-settings-option__desc">${opt.desc}</span>
        </div>
      </button>`
    )
    .join('');

  const modal = doc.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'myio-conf-picker';
  modal.innerHTML = `
    <div class="myio-conf-picker__overlay"></div>
    <div class="myio-conf-picker__content">
      <div class="myio-conf-picker__header">
        <h3>⚙️ Configurações${customerName ? ` — ${escapeHtml(customerName)}` : ''}</h3>
        <button class="myio-conf-picker__close" aria-label="Fechar">&times;</button>
      </div>
      <div class="myio-conf-picker__body">${cardsHtml}
      </div>
    </div>
  `;

  doc.body.appendChild(modal);

  // Aplica a paleta do dashboard no root do hub: header/accent leem
  // var(--myio-brand-700). Sub-modais abertos pelos handlers herdam a mesma
  // paleta via window.MyIOUtils.theme (leem o global por conta própria).
  const themeVars = resolveHubThemeVars(options.theme);
  if (themeVars) {
    Object.entries(themeVars).forEach(([k, v]) => {
      if (k.startsWith('--') && typeof v === 'string') modal.style.setProperty(k, v);
    });
  }

  // Animate in.
  requestAnimationFrame(() => modal.classList.add('show'));

  // Close handlers (overlay / ✕ / Esc).
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  };
  const closeModal = () => {
    doc.removeEventListener('keydown', escHandler);
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.myio-conf-picker__overlay')?.addEventListener('click', closeModal);
  modal.querySelector('.myio-conf-picker__close')?.addEventListener('click', closeModal);
  doc.addEventListener('keydown', escHandler);

  // Option routing: close the hub, then open the target after the close animation.
  modal.querySelectorAll<HTMLButtonElement>('.myio-settings-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action as SettingsHubAction;
      closeModal();
      setTimeout(() => handlers[action]?.(), ROUTE_DELAY_MS);
    });
  });

  return { close: closeModal };
}
