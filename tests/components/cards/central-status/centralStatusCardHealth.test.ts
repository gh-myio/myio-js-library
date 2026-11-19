/**
 * RFC-0231 amendment — `health` param (GCDR RFC-0085 §5.6):
 * `● v3 <firmware>` badge next to the connectivity badge + "Sistema" row.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../../src/components/premium-modals/dialog', () => ({
  openConfirmDialog: vi.fn().mockResolvedValue('confirm'),
  openGenericModal: vi.fn(),
}));

import { createCentralStatusCard } from '../../../../src/components/cards/central-status/v1.0.0';
import type { CentralHealthInfo } from '../../../../src/components/cards/central-status/v1.0.0';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

const baseParams = () => ({
  container,
  id: 'central-1',
  name: 'Central Shopping Taboão',
  monitoringEnabled: true,
  entityStatus: 'ACTIVE' as const,
  derivedConnectivity: 'ONLINE' as const,
});

const T0 = '2026-11-19T13:00:00.000Z';
const T1 = '2026-11-19T13:24:00.000Z';
const T2 = '2026-11-19T15:30:00.000Z';

const supported = (over: Partial<CentralHealthInfo> = {}): CentralHealthInfo => ({
  support: 'SUPPORTED',
  status: 'healthy',
  firmware: 'rc14.1.24',
  registryFirmware: 'rc14.1.24',
  checkedAt: T1,
  successAt: T1,
  system: { temperatureC: 63.4, uptimeSeconds: 15 * 3600 + 48 * 60, load1m: 0.83 },
  ...over,
});

const badgeOf = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-role="health-badge"]');
const systemRowOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.myio-cscard__system');
const text = (el: Element | null | undefined) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

describe('CentralStatusCard — health (RFC-0085): absence is the signal', () => {
  it('renders neither the badge nor the Sistema row when `health` is omitted', () => {
    const card = createCentralStatusCard(baseParams());
    expect(badgeOf(card.el)).toBeNull();
    expect(systemRowOf(card.el)).toBeNull();
  });

  it.each(['UNSUPPORTED', 'UNREACHABLE', 'UNKNOWN'] as const)(
    'renders nothing new for support = %s, even with firmware + system filled',
    (support) => {
      const card = createCentralStatusCard({ ...baseParams(), health: supported({ support }) });
      expect(badgeOf(card.el)).toBeNull();
      expect(systemRowOf(card.el)).toBeNull();
      expect(card.el.querySelectorAll('.myio-cscard__syspill').length).toBe(0);
    }
  );

  it('renders nothing new for health: null', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: null });
    expect(badgeOf(card.el)).toBeNull();
    expect(systemRowOf(card.el)).toBeNull();
  });
});

describe('CentralStatusCard — health badge (● v3 <firmware>)', () => {
  it('text is "v3 <firmware>" and it sits right after the connectivity badge', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    const badge = badgeOf(card.el);
    expect(badge).toBeTruthy();
    expect(text(badge)).toBe('v3 rc14.1.24');
    expect(badge?.classList.contains('myio-cscard__health-badge')).toBe(true);
    const connBadge = card.el.querySelector('.myio-cscard__connectivity .myio-cscard__badge');
    expect(connBadge?.nextElementSibling).toBe(badge);
  });

  it('shows just "v3" when firmware is null', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported({ firmware: null, registryFirmware: null }) });
    expect(text(badgeOf(card.el))).toBe('v3');
  });

  it.each([
    ['healthy', 'myio-cscard__health-badge--healthy'],
    ['degraded', 'myio-cscard__health-badge--degraded'],
    ['unhealthy', 'myio-cscard__health-badge--unhealthy'],
  ] as const)('status %s → dot modifier %s (and only that one)', (status, cls) => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported({ status }) });
    const badge = badgeOf(card.el)!;
    expect(badge.classList.contains(cls)).toBe(true);
    expect(badge.classList.contains('myio-cscard__health-badge--silent')).toBe(false);
    expect(badge.dataset.healthStatus).toBe(status);
    const others = ['healthy', 'degraded', 'unhealthy'].filter((s) => s !== status);
    others.forEach((s) => expect(badge.classList.contains(`myio-cscard__health-badge--${s}`)).toBe(false));
  });

  it('status null → no colour modifier at all (neutral dot)', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported({ status: null }) });
    const badge = badgeOf(card.el)!;
    expect(badge.className).toBe('myio-cscard__health-badge');
  });

  it('checkedAt later than successAt → grey (--silent) overrides the status colour and the title says "sem resposta desde <successAt>"', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      health: supported({ status: 'healthy', checkedAt: T2, successAt: T1 }),
    });
    const badge = badgeOf(card.el)!;
    expect(badge.classList.contains('myio-cscard__health-badge--silent')).toBe(true);
    expect(badge.classList.contains('myio-cscard__health-badge--healthy')).toBe(false);
    expect(badge.dataset.healthStatus).toBe('silent');
    const title = badge.getAttribute('title') || '';
    expect(title).toContain('sem resposta desde');
    // the formatted successAt (card's own formatSince: dd/mm/yyyy, hh:mm (rel))
    const expectedWhen = new Date(T1).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(title).toContain(expectedWhen);
    expect(title).not.toContain('healthy');
  });

  it('checkedAt equal to or earlier than successAt is NOT silent', () => {
    const same = createCentralStatusCard({ ...baseParams(), health: supported({ checkedAt: T1, successAt: T1 }) });
    expect(badgeOf(same.el)!.classList.contains('myio-cscard__health-badge--silent')).toBe(false);
    same.destroy();
    const earlier = createCentralStatusCard({ ...baseParams(), health: supported({ checkedAt: T0, successAt: T1 }) });
    expect(badgeOf(earlier.el)!.classList.contains('myio-cscard__health-badge--silent')).toBe(false);
    expect(badgeOf(earlier.el)!.classList.contains('myio-cscard__health-badge--healthy')).toBe(true);
  });

  it('language: "en" flips the silent title to "silent since …"', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      language: 'en',
      health: supported({ checkedAt: T2, successAt: T1 }),
    });
    expect(badgeOf(card.el)!.getAttribute('title')).toContain('silent since');
  });

  it('registryFirmware different from firmware → " ≠" appended and both values in the title', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      health: supported({ firmware: 'rc14.1.24', registryFirmware: 'rc14.1.20' }),
    });
    const badge = badgeOf(card.el)!;
    expect(text(badge)).toBe('v3 rc14.1.24 ≠');
    expect(badge.querySelector('.myio-cscard__health-mismatch')).toBeTruthy();
    const title = badge.getAttribute('title') || '';
    expect(title).toContain('rc14.1.24');
    expect(title).toContain('rc14.1.20');
    expect(title).toContain('≠');
  });

  it('no "≠" when registryFirmware matches or is absent', () => {
    const equal = createCentralStatusCard({ ...baseParams(), health: supported() });
    expect(text(badgeOf(equal.el))).toBe('v3 rc14.1.24');
    expect(badgeOf(equal.el)!.querySelector('.myio-cscard__health-mismatch')).toBeNull();
    equal.destroy();
    const absent = createCentralStatusCard({ ...baseParams(), health: supported({ registryFirmware: null }) });
    expect(text(badgeOf(absent.el))).toBe('v3 rc14.1.24');
  });

  it('the healthy title lists badge · status · firmware', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    expect(badgeOf(card.el)!.getAttribute('title')).toBe('v3 · healthy · rc14.1.24');
  });

  it('NEVER touches the two existing axes: data-connectivity, data-status, the connectivity badge class', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      derivedConnectivity: 'ONLINE',
      entityStatus: 'ACTIVE',
      health: supported({ status: 'unhealthy' }),
    });
    expect(card.el.dataset.connectivity).toBe('ONLINE');
    expect(card.el.dataset.status).toBe('ACTIVE');
    const connBadge = card.el.querySelector('.myio-cscard__connectivity .myio-cscard__badge')!;
    expect(connBadge.className).toBe('myio-cscard__badge myio-cscard__badge--ONLINE');
    expect(text(connBadge)).toBe('ONLINE');
    expect(Object.keys(card.el.dataset).sort()).toEqual(['accent', 'connectivity', 'status', 'theme']);
  });

  it('escapes the firmware and the badge label (no markup injection)', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      labels: { health: { badge: '<i>v3</i>' } },
      health: supported({ firmware: '<b>rc14</b>', registryFirmware: null }),
    });
    const badge = badgeOf(card.el)!;
    expect(badge.querySelector('b')).toBeNull();
    expect(badge.querySelector('i')).toBeNull();
    expect(text(badge)).toBe('<i>v3</i> <b>rc14</b>');
  });

  it('labels.health.badge override replaces "v3"', () => {
    const card = createCentralStatusCard({ ...baseParams(), labels: { health: { badge: 'health' } }, health: supported() });
    expect(text(badgeOf(card.el))).toBe('health rc14.1.24');
  });
});

describe('CentralStatusCard — "Sistema" row (🌡 · ⏱ · ⚙)', () => {
  it('renders the three pills right under the Status row with pt formatting', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    const row = systemRowOf(card.el)!;
    expect(row).toBeTruthy();
    expect(row.classList.contains('myio-cscard__row')).toBe(true);
    const statusRow = card.el.querySelector('.myio-cscard__status')!;
    expect(statusRow.nextElementSibling).toBe(row);
    expect(text(row.querySelector('.myio-cscard__label'))).toBe('Sistema');
    const pills = row.querySelectorAll('.myio-cscard__syspill');
    expect(pills.length).toBe(3);
    expect(text(pills[0])).toBe('🌡 63 °C');
    expect(text(pills[1])).toBe('⏱ 15h48');
    expect(text(pills[2])).toBe('⚙ 0,83');
    expect(pills[0].classList.contains('myio-cscard__syspill--temperature')).toBe(true);
    expect(pills[1].classList.contains('myio-cscard__syspill--uptime')).toBe(true);
    expect(pills[2].classList.contains('myio-cscard__syspill--load')).toBe(true);
  });

  it('language: "en" → label "System" and a dot as the load decimal separator', () => {
    const card = createCentralStatusCard({ ...baseParams(), language: 'en', health: supported() });
    const row = systemRowOf(card.el)!;
    expect(text(row.querySelector('.myio-cscard__label'))).toBe('System');
    expect(text(row.querySelector('[data-role="system-load"]'))).toBe('⚙ 0.83');
  });

  it('load always keeps two decimals (1 → "1,00"; 12.345 → "12,35")', () => {
    const one = createCentralStatusCard({ ...baseParams(), health: supported({ system: { load1m: 1 } }) });
    expect(text(one.el.querySelector('[data-role="system-load"]'))).toBe('⚙ 1,00');
    one.destroy();
    const many = createCentralStatusCard({ ...baseParams(), health: supported({ system: { load1m: 12.345 } }) });
    expect(text(many.el.querySelector('[data-role="system-load"]'))).toBe('⚙ 12,35');
  });

  it('temperature is rounded to an integer', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported({ system: { temperatureC: 62.6 } }) });
    expect(text(card.el.querySelector('[data-role="system-temperature"]'))).toBe('🌡 63 °C');
  });

  it.each([
    [12 * 60, '12min'],
    [0, '0min'],
    [59 * 60 + 59, '59min'],
    [60 * 60, '1h00'],
    [15 * 3600 + 48 * 60, '15h48'],
    [23 * 3600 + 59 * 60, '23h59'],
    [24 * 3600, '1d 00h'],
    [3 * 86400 + 2 * 3600 + 30 * 60, '3d 02h'],
    [12 * 86400 + 23 * 3600, '12d 23h'],
  ])('uptime %i s → "%s" (three bands: <60min, <24h, days)', (seconds, expected) => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported({ system: { uptimeSeconds: seconds } }) });
    expect(text(card.el.querySelector('[data-role="system-uptime"]'))).toBe(`⏱ ${expected}`);
  });

  it('each pill is omitted when its value is null/undefined', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      health: supported({ system: { temperatureC: null, uptimeSeconds: 600, load1m: undefined } }),
    });
    const row = systemRowOf(card.el)!;
    expect(row.querySelectorAll('.myio-cscard__syspill').length).toBe(1);
    expect(row.querySelector('[data-role="system-temperature"]')).toBeNull();
    expect(row.querySelector('[data-role="system-uptime"]')).toBeTruthy();
    expect(row.querySelector('[data-role="system-load"]')).toBeNull();
  });

  it('the row is omitted when system is null, or when every value is null', () => {
    const nul = createCentralStatusCard({ ...baseParams(), health: supported({ system: null }) });
    expect(systemRowOf(nul.el)).toBeNull();
    expect(badgeOf(nul.el)).toBeTruthy(); // the badge is independent of the row
    nul.destroy();
    const empty = createCentralStatusCard({ ...baseParams(), health: supported({ system: {} }) });
    expect(systemRowOf(empty.el)).toBeNull();
  });

  it('labels.health.system overrides the row label; icons.system overrides the glyph', () => {
    const card = createCentralStatusCard({
      ...baseParams(),
      labels: { health: { system: 'Board' } },
      icons: { system: '🖥' },
      health: supported(),
    });
    const row = systemRowOf(card.el)!;
    expect(text(row.querySelector('.myio-cscard__label'))).toBe('Board');
    expect(text(row.querySelector('[data-icon-key="system"]'))).toBe('🖥');
  });

  it('variant "compact" still renders the row (density is a CSS concern, not a DOM one)', () => {
    const card = createCentralStatusCard({ ...baseParams(), variant: 'compact', health: supported() });
    expect(systemRowOf(card.el)).toBeTruthy();
    expect(badgeOf(card.el)).toBeTruthy();
  });
});

describe('CentralStatusCard — health through update()', () => {
  it('update({ health }) adds the badge + row to a card that had none', () => {
    const card = createCentralStatusCard(baseParams());
    expect(badgeOf(card.el)).toBeNull();
    card.update({ health: supported() });
    expect(text(badgeOf(card.el))).toBe('v3 rc14.1.24');
    expect(systemRowOf(card.el)).toBeTruthy();
  });

  it('update({ health: null }) / support flip removes them again', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    card.update({ health: null });
    expect(badgeOf(card.el)).toBeNull();
    expect(systemRowOf(card.el)).toBeNull();
    card.update({ health: supported({ support: 'UNSUPPORTED' }) });
    expect(badgeOf(card.el)).toBeNull();
    expect(systemRowOf(card.el)).toBeNull();
  });

  it('update() picks up a status / firmware / silent change like any other param', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    card.update({ health: supported({ status: 'degraded', firmware: 'rc14.1.25', registryFirmware: 'rc14.1.24' }) });
    const badge = badgeOf(card.el)!;
    expect(badge.classList.contains('myio-cscard__health-badge--degraded')).toBe(true);
    expect(text(badge)).toBe('v3 rc14.1.25 ≠');
    card.update({ health: supported({ checkedAt: T2, successAt: T1 }) });
    expect(badgeOf(card.el)!.classList.contains('myio-cscard__health-badge--silent')).toBe(true);
  });

  it('update({ language }) re-renders the health labels too', () => {
    const card = createCentralStatusCard({ ...baseParams(), health: supported() });
    card.update({ language: 'en' });
    expect(text(systemRowOf(card.el)!.querySelector('.myio-cscard__label'))).toBe('System');
    expect(text(card.el.querySelector('[data-role="system-load"]'))).toBe('⚙ 0.83');
  });
});
