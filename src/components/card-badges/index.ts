/**
 * Card alarm/ticket badges — shared decoration helpers (RFC-0183 / RFC-0198).
 *
 * Lifted from the v-5.2.0 TELEMETRY widget controller so every consumer that
 * renders device cards (TELEMETRY, MAIN_BAS, v-5.4.0 grid) can decorate them
 * from a single source instead of keeping private copies.
 *
 * Data sources (window globals, both optional):
 * - `window.AlarmServiceOrchestrator.getAlarmCountForDevice(gcdrDeviceId)`
 * - `window.TicketServiceOrchestrator.getTicketCountForDevice(identifier)`
 *   with a per-device `tickets_items` SERVER_SCOPE JSON fallback, gated by
 *   `window.MyIOUtils.ticketsEnabled === true`.
 *
 * Unlike the original TELEMETRY alarm badge, BOTH badges here are always
 * inserted in the DOM (hidden when count = 0) so the refresh functions can
 * light them up when the orchestrators finish loading after the cards
 * rendered — the common case outside the shopping dashboard, where panels
 * mount before the alarm prefetch resolves.
 */

const ALARM_STYLES_ID = 'myio-alarm-badge-styles';
const TICKET_STYLES_ID = 'myio-ticket-badge-styles';

declare global {
  interface Window {
    AlarmServiceOrchestrator?: {
      getAlarmCountForDevice?: (gcdrDeviceId: string) => number;
    };
    TicketServiceOrchestrator?: {
      getTicketCountForDevice?: (identifier: string) => number;
    };
  }
}

export interface AlarmBadgeOptions {
  /** Custom counter (e.g. to filter offline alarms). Default: AlarmServiceOrchestrator. */
  getCount?: (gcdrDeviceId: string) => number;
}

export interface TicketBadgeOptions {
  /** Overrides the `window.MyIOUtils.ticketsEnabled === true` gate. */
  gateOpen?: boolean;
}

function injectAlarmBadgeStyles(): void {
  if (document.getElementById(ALARM_STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = ALARM_STYLES_ID;
  s.textContent = `
    .myio-alarm-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: #dc2626;
      color: #fff;
      border-radius: 10px;
      padding: 2px 5px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 2px;
      z-index: 10;
      pointer-events: none;
      line-height: 1.3;
    }
  `;
  document.head.appendChild(s);
}

function injectTicketBadgeStyles(): void {
  if (document.getElementById(TICKET_STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = TICKET_STYLES_ID;
  s.textContent = `
    /* Mini clone of .tbx-btn-ticket-notif */
    .myio-ticket-badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      width: 24px;
      height: 24px;
      background: rgba(8, 145, 178, 0.12);
      color: #0891b2;
      border: 1px solid rgba(8, 145, 178, 0.25);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .myio-ticket-badge:hover {
      background: rgba(8, 145, 178, 0.22);
      border-color: rgba(8, 145, 178, 0.45);
    }
    /* Count pill — clone of .tbx-ticket-badge */
    .myio-ticket-badge-count {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      border-radius: 7px;
      background: #0891b2;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      line-height: 14px;
      text-align: center;
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(s);
}

function defaultAlarmCount(gcdrDeviceId: string): number {
  const aso = window.AlarmServiceOrchestrator;
  return aso?.getAlarmCountForDevice?.(gcdrDeviceId) ?? 0;
}

function alarmTitle(count: number): string {
  return `${count} alarme${count !== 1 ? 's' : ''} ativo${count !== 1 ? 's' : ''}`;
}

function ticketTitle(count: number): string {
  return count > 0 ? `${count} chamado${count !== 1 ? 's' : ''} aberto${count !== 1 ? 's' : ''}` : 'Chamados';
}

/**
 * RFC-0183: Append an alarm badge (red bell) to a card element. The badge is
 * always inserted (hidden when count = 0) so refreshAlarmBadges() can update
 * it when the AlarmServiceOrchestrator loads later.
 */
export function addAlarmBadge(
  cardElement: HTMLElement | null | undefined,
  gcdrDeviceId: string | null | undefined,
  opts?: AlarmBadgeOptions,
): void {
  if (!cardElement || !gcdrDeviceId) return;
  if (cardElement.querySelector(`[data-alarm-device-id="${gcdrDeviceId}"]`)) return;

  const count = (opts?.getCount ?? defaultAlarmCount)(gcdrDeviceId);

  injectAlarmBadgeStyles();
  if (cardElement.style) cardElement.style.position = 'relative';

  const badge = document.createElement('div');
  badge.className = 'myio-alarm-badge';
  badge.setAttribute('data-alarm-device-id', gcdrDeviceId);
  badge.style.display = count > 0 ? '' : 'none';
  badge.title = alarmTitle(count);
  badge.innerHTML =
    '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>' +
    '</svg>' +
    `<span>${count > 99 ? '99+' : count}</span>`;
  cardElement.appendChild(badge);
}

/**
 * Refresh every alarm badge on the page (e.g. on myio:alarms-updated or after
 * the alarm prefetch resolves) without re-rendering the cards.
 */
export function refreshAlarmBadges(opts?: AlarmBadgeOptions): void {
  const getCount = opts?.getCount ?? defaultAlarmCount;
  document.querySelectorAll<HTMLElement>('.myio-alarm-badge[data-alarm-device-id]').forEach((badge) => {
    const gcdrDeviceId = badge.getAttribute('data-alarm-device-id');
    if (!gcdrDeviceId) return;
    const count = getCount(gcdrDeviceId);
    const span = badge.querySelector('span');
    if (count > 0) {
      badge.style.display = '';
      badge.title = alarmTitle(count);
      if (span) span.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.style.display = 'none';
    }
  });
}

/**
 * RFC-0198: Append a ticket badge (headphone icon + count pill) to a card
 * element. Always inserted (hidden when count = 0 or the tickets gate is
 * closed) so refreshTicketBadges() can update it on myio:tickets-ready.
 * Count source: TicketServiceOrchestrator, falling back to the device's
 * `tickets_items` SERVER_SCOPE JSON (open states: 2, 3, 6).
 */
export function addTicketBadge(
  cardElement: HTMLElement | null | undefined,
  identifier: string | null | undefined,
  ticketsItemsRaw?: unknown,
  opts?: TicketBadgeOptions,
): void {
  if (!cardElement || !identifier) return;
  if (cardElement.querySelector(`[data-ticket-identifier="${identifier}"]`)) return;

  const tso = window.TicketServiceOrchestrator;
  let count = tso?.getTicketCountForDevice?.(identifier) ?? 0;

  if (count === 0 && ticketsItemsRaw) {
    try {
      const parsed =
        typeof ticketsItemsRaw === 'string' ? JSON.parse(ticketsItemsRaw) : ticketsItemsRaw;
      const summaries = Array.isArray(parsed)
        ? parsed
        : ((parsed as { items?: unknown[] })?.items ?? []);
      count = (summaries as Array<{ status?: number }>).filter((t) =>
        [2, 3, 6].includes(t?.status as number),
      ).length;
    } catch {
      /* malformed attribute — keep count = 0 */
    }
  }

  injectTicketBadgeStyles();
  if (cardElement.style) cardElement.style.position = 'relative';

  const gateOpen =
    opts?.gateOpen ?? (window as { MyIOUtils?: { ticketsEnabled?: boolean } }).MyIOUtils?.ticketsEnabled === true;

  const badge = document.createElement('div');
  badge.className = 'myio-ticket-badge';
  badge.setAttribute('data-ticket-identifier', identifier);
  badge.style.display = count > 0 && gateOpen ? '' : 'none';
  badge.title = ticketTitle(count);
  badge.innerHTML =
    '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/>' +
    '<path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>' +
    '<path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>' +
    '</svg>' +
    (count > 0 ? `<span class="myio-ticket-badge-count">${count > 99 ? '99+' : count}</span>` : '');
  cardElement.appendChild(badge);
}

/**
 * Refresh every ticket badge on the page (call on myio:tickets-ready).
 */
export function refreshTicketBadges(opts?: TicketBadgeOptions): void {
  const tso = window.TicketServiceOrchestrator;
  if (!tso?.getTicketCountForDevice) return;
  const gateOpen =
    opts?.gateOpen ?? (window as { MyIOUtils?: { ticketsEnabled?: boolean } }).MyIOUtils?.ticketsEnabled === true;

  if (!gateOpen) {
    document.querySelectorAll<HTMLElement>('.myio-ticket-badge').forEach((el) => {
      el.style.display = 'none';
    });
    return;
  }

  document
    .querySelectorAll<HTMLElement>('.myio-ticket-badge[data-ticket-identifier]')
    .forEach((badge) => {
      const identifier = badge.getAttribute('data-ticket-identifier');
      if (!identifier) return;
      const count = tso.getTicketCountForDevice!(identifier);
      if (count > 0) {
        badge.style.display = '';
        badge.title = ticketTitle(count);
        let pill = badge.querySelector<HTMLElement>('.myio-ticket-badge-count');
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 'myio-ticket-badge-count';
          badge.appendChild(pill);
        }
        pill.textContent = count > 99 ? '99+' : String(count);
      } else {
        badge.style.display = 'none';
      }
    });
}
