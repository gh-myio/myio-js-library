/**
 * RFC-0215 Phase 3 — openSettingsHubModal unit tests.
 *
 * Covers:
 *   - Regular users see only the 3 non-SuperAdmin options
 *   - SuperAdmin sees all 8 options, in the v-5.2.0 ordering
 *   - SuperAdmin-only options carry the --myio accent class
 *   - Options without a handler are not rendered
 *   - customerName rendered in the title (HTML-escaped)
 *   - Option click closes the hub and routes to the handler after the delay
 *   - Close on overlay / ✕ / Escape (and Esc listener removed after close)
 *   - Styles injected once; reopening replaces the existing modal
 *   - Returned handle.close() closes the hub
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openSettingsHubModal,
  type SettingsHubAction,
  type SettingsHubHandlers,
} from '../../../src/components/settings-hub';

const ALL_ACTIONS: SettingsHubAction[] = [
  'temperature',
  'contract',
  'measurement',
  'integration',
  'user-management',
  'default-dashboard',
  'client-config',
  'device-profile',
];

function makeHandlers(actions: SettingsHubAction[] = ALL_ACTIONS): SettingsHubHandlers {
  const handlers: SettingsHubHandlers = {};
  for (const a of actions) handlers[a] = vi.fn();
  return handlers;
}

function getModal(): HTMLElement | null {
  return document.getElementById('myio-conf-picker');
}

function getOptions(): HTMLButtonElement[] {
  return Array.from(getModal()?.querySelectorAll('.myio-settings-option') ?? []);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  getModal()?.remove();
  document.getElementById('myio-conf-picker-styles')?.remove();
});

describe('openSettingsHubModal — rendering & gating', () => {
  it('renders only the 3 non-SuperAdmin options for regular users', () => {
    openSettingsHubModal({ isSuperAdmin: false, handlers: makeHandlers() });
    const actions = getOptions().map((b) => b.dataset.action);
    expect(actions).toEqual(['temperature', 'contract', 'measurement']);
  });

  it('renders all 8 options for SuperAdmin, in the v-5.2.0 ordering', () => {
    openSettingsHubModal({ isSuperAdmin: true, handlers: makeHandlers() });
    const actions = getOptions().map((b) => b.dataset.action);
    expect(actions).toEqual(ALL_ACTIONS);
  });

  it('marks SuperAdmin-only options with the --myio accent class', () => {
    openSettingsHubModal({ isSuperAdmin: true, handlers: makeHandlers() });
    for (const btn of getOptions()) {
      const isMyio = btn.classList.contains('myio-settings-option--myio');
      expect(isMyio).toBe(!['temperature', 'contract', 'measurement'].includes(btn.dataset.action!));
    }
  });

  it('does not render options without a handler', () => {
    openSettingsHubModal({
      isSuperAdmin: true,
      handlers: makeHandlers(['temperature', 'device-profile']),
    });
    const actions = getOptions().map((b) => b.dataset.action);
    expect(actions).toEqual(['temperature', 'device-profile']);
  });

  it('renders the customerName in the title, HTML-escaped', () => {
    openSettingsHubModal({
      customerName: 'Shopping <b>"X"</b> & Cia',
      handlers: makeHandlers(['measurement']),
    });
    const h3 = getModal()!.querySelector('h3')!;
    expect(h3.textContent).toContain('⚙️ Configurações — Shopping <b>"X"</b> & Cia');
    expect(h3.querySelector('b')).toBeNull();
  });

  it('omits the customerName suffix when empty', () => {
    openSettingsHubModal({ handlers: makeHandlers(['measurement']) });
    expect(getModal()!.querySelector('h3')!.textContent!.trim()).toBe('⚙️ Configurações');
  });
});

describe('openSettingsHubModal — RFC-0241 goals-tariffs (permissions)', () => {
  const withGoals = (): SettingsHubHandlers => ({ ...makeHandlers(), 'goals-tariffs': vi.fn() });

  it('AC-05: the 8 existing options render exactly as before when the new option is not permitted', () => {
    openSettingsHubModal({ isSuperAdmin: true, handlers: withGoals() });
    expect(getOptions().map((b) => b.dataset.action)).toEqual(ALL_ACTIONS);
    openSettingsHubModal({ isSuperAdmin: false, handlers: withGoals(), permissions: { 'goals-tariffs': false } });
    expect(getOptions().map((b) => b.dataset.action)).toEqual(['temperature', 'contract', 'measurement']);
  });

  it('renders "Metas e Tarifas" after measurement when permitted (non-SuperAdmin admin too)', () => {
    openSettingsHubModal({ isSuperAdmin: false, handlers: withGoals(), permissions: { 'goals-tariffs': true } });
    expect(getOptions().map((b) => b.dataset.action)).toEqual([
      'temperature',
      'contract',
      'measurement',
      'goals-tariffs',
    ]);
    const btn = getOptions().find((b) => b.dataset.action === 'goals-tariffs')!;
    expect(btn.textContent).toContain('Metas e Tarifas');
    expect(btn.classList.contains('myio-settings-option--myio')).toBe(false);
  });

  it('does not render the option without a handler even when permitted', () => {
    openSettingsHubModal({ isSuperAdmin: true, handlers: makeHandlers(), permissions: { 'goals-tariffs': true } });
    expect(getOptions().map((b) => b.dataset.action)).not.toContain('goals-tariffs');
  });

  it('routes the click to the goals-tariffs handler', () => {
    const handlers = withGoals();
    openSettingsHubModal({ handlers, permissions: { 'goals-tariffs': true } });
    getOptions().find((b) => b.dataset.action === 'goals-tariffs')!.click();
    vi.advanceTimersByTime(250);
    expect(handlers['goals-tariffs']).toHaveBeenCalledTimes(1);
  });

  it('permissions never re-enable a SuperAdmin-only option for regular users', () => {
    openSettingsHubModal({ isSuperAdmin: false, handlers: makeHandlers(), permissions: { integration: true } });
    expect(getOptions().map((b) => b.dataset.action)).toEqual(['temperature', 'contract', 'measurement']);
  });

  it('AC-05 snapshot: existing option markup is unchanged', () => {
    openSettingsHubModal({ isSuperAdmin: true, handlers: makeHandlers() });
    const markup = getOptions().map((b) => ({
      action: b.dataset.action,
      cls: b.className,
      text: b.textContent!.replace(/\s+/g, ' ').trim(),
    }));
    expect(markup).toMatchInlineSnapshot(`
      [
        {
          "action": "temperature",
          "cls": "myio-settings-option",
          "text": "🌡️ Config. Temperatura Limites e alertas de temperatura",
        },
        {
          "action": "contract",
          "cls": "myio-settings-option",
          "text": "📋 Dispositivos Contratados Quantidade de dispositivos por domínio",
        },
        {
          "action": "measurement",
          "cls": "myio-settings-option",
          "text": "📐 Config. Medidas Unidades e casas decimais",
        },
        {
          "action": "integration",
          "cls": "myio-settings-option myio-settings-option--myio",
          "text": "🔗 Setup de Integração Ingestion · GCDR — apenas MyIO",
        },
        {
          "action": "user-management",
          "cls": "myio-settings-option myio-settings-option--myio",
          "text": "👥 Gestão de Usuários Usuários e perfis — apenas MyIO",
        },
        {
          "action": "default-dashboard",
          "cls": "myio-settings-option myio-settings-option--myio",
          "text": "🏠 Dashboard Padrão Dashboard exibido ao criar novos usuários — apenas MyIO",
        },
        {
          "action": "client-config",
          "cls": "myio-settings-option myio-settings-option--myio",
          "text": "🏢 Configurações Cliente Funcionalidades e senha master — apenas MyIO",
        },
        {
          "action": "device-profile",
          "cls": "myio-settings-option myio-settings-option--myio",
          "text": "🧩 Gestão de Perfil de Dispositivos Regras de classificação (colunas e breakdown) — apenas MyIO",
        },
      ]
    `);
  });
});

describe('openSettingsHubModal — routing', () => {
  it('closes the hub and calls the handler after the close-animation delay', () => {
    const handlers = makeHandlers();
    openSettingsHubModal({ isSuperAdmin: true, handlers });

    const contractBtn = getOptions().find((b) => b.dataset.action === 'contract')!;
    contractBtn.click();

    expect(getModal()!.classList.contains('show')).toBe(false);
    expect(handlers.contract).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(handlers.contract).toHaveBeenCalledTimes(1);
    // Only the clicked option routes.
    expect(handlers.temperature).not.toHaveBeenCalled();
    // Modal removed from the DOM after the close animation.
    expect(getModal()).toBeNull();
  });
});

describe('openSettingsHubModal — closing', () => {
  it('closes on overlay click', () => {
    openSettingsHubModal({ handlers: makeHandlers() });
    (getModal()!.querySelector('.myio-conf-picker__overlay') as HTMLElement).click();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });

  it('closes on ✕ click', () => {
    openSettingsHubModal({ handlers: makeHandlers() });
    (getModal()!.querySelector('.myio-conf-picker__close') as HTMLElement).click();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });

  it('closes on Escape and stops listening afterwards', () => {
    openSettingsHubModal({ handlers: makeHandlers() });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();

    // A second hub must not be affected by the first hub's (removed) listener.
    openSettingsHubModal({ handlers: makeHandlers() });
    expect(getModal()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });

  it('handle.close() closes the hub', () => {
    const handle = openSettingsHubModal({ handlers: makeHandlers() });
    handle.close();
    vi.advanceTimersByTime(200);
    expect(getModal()).toBeNull();
  });
});

describe('openSettingsHubModal — lifecycle', () => {
  it('injects styles only once across multiple opens', () => {
    openSettingsHubModal({ handlers: makeHandlers() });
    openSettingsHubModal({ handlers: makeHandlers() });
    expect(document.querySelectorAll('#myio-conf-picker-styles')).toHaveLength(1);
  });

  it('replaces an existing hub instead of stacking a second one', () => {
    openSettingsHubModal({ customerName: 'A', handlers: makeHandlers() });
    openSettingsHubModal({ customerName: 'B', handlers: makeHandlers() });
    const modals = document.querySelectorAll('#myio-conf-picker');
    expect(modals).toHaveLength(1);
    expect(modals[0].querySelector('h3')!.textContent).toContain('— B');
  });
});
