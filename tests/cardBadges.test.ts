// RFC-0183/RFC-0198: shared card alarm/ticket badge helpers
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  addAlarmBadge,
  refreshAlarmBadges,
  addTicketBadge,
  refreshTicketBadges,
} from '../src/components/card-badges';

declare global {
  interface Window {
    MyIOUtils?: { ticketsEnabled?: boolean };
  }
}

let card: HTMLElement;

beforeEach(() => {
  card = document.createElement('div');
  document.body.appendChild(card);
});

afterEach(() => {
  card.remove();
  delete (window as any).AlarmServiceOrchestrator;
  delete (window as any).TicketServiceOrchestrator;
  delete (window as any).MyIOUtils;
});

describe('addAlarmBadge', () => {
  it('inserts a hidden badge when the orchestrator is absent (count 0)', () => {
    addAlarmBadge(card, 'gcdr-1');
    const badge = card.querySelector<HTMLElement>('[data-alarm-device-id="gcdr-1"]');
    expect(badge).not.toBeNull();
    expect(badge!.style.display).toBe('none');
  });

  it('shows the count when the orchestrator reports alarms', () => {
    (window as any).AlarmServiceOrchestrator = {
      getAlarmCountForDevice: () => 3,
    };
    addAlarmBadge(card, 'gcdr-2');
    const badge = card.querySelector<HTMLElement>('[data-alarm-device-id="gcdr-2"]')!;
    expect(badge.style.display).toBe('');
    expect(badge.querySelector('span')!.textContent).toBe('3');
    expect(badge.title).toContain('3 alarmes');
  });

  it('does nothing without gcdrDeviceId and avoids duplicates', () => {
    addAlarmBadge(card, null);
    expect(card.querySelector('.myio-alarm-badge')).toBeNull();

    addAlarmBadge(card, 'gcdr-3');
    addAlarmBadge(card, 'gcdr-3');
    expect(card.querySelectorAll('[data-alarm-device-id="gcdr-3"]')).toHaveLength(1);
  });

  it('refreshAlarmBadges lights hidden badges up when alarms arrive later', () => {
    addAlarmBadge(card, 'gcdr-4');
    expect(card.querySelector<HTMLElement>('.myio-alarm-badge')!.style.display).toBe('none');

    (window as any).AlarmServiceOrchestrator = {
      getAlarmCountForDevice: () => 120,
    };
    refreshAlarmBadges();

    const badge = card.querySelector<HTMLElement>('.myio-alarm-badge')!;
    expect(badge.style.display).toBe('');
    expect(badge.querySelector('span')!.textContent).toBe('99+');
  });
});

describe('addTicketBadge', () => {
  it('counts open tickets (status 2/3/6) from the tickets_items fallback when gate is open', () => {
    (window as any).MyIOUtils = { ticketsEnabled: true };
    const ticketsItems = JSON.stringify([
      { status: 2 },
      { status: 3 },
      { status: 5 }, // closed — not counted
      { status: 6 },
    ]);
    addTicketBadge(card, 'DEV-001', ticketsItems);
    const badge = card.querySelector<HTMLElement>('[data-ticket-identifier="DEV-001"]')!;
    expect(badge.style.display).toBe('');
    expect(badge.querySelector('.myio-ticket-badge-count')!.textContent).toBe('3');
  });

  it('stays hidden when the tickets gate is closed even with open tickets', () => {
    const ticketsItems = JSON.stringify([{ status: 2 }]);
    addTicketBadge(card, 'DEV-002', ticketsItems);
    const badge = card.querySelector<HTMLElement>('[data-ticket-identifier="DEV-002"]')!;
    expect(badge.style.display).toBe('none');
  });

  it('prefers the TicketServiceOrchestrator count over the attribute fallback', () => {
    (window as any).MyIOUtils = { ticketsEnabled: true };
    (window as any).TicketServiceOrchestrator = {
      getTicketCountForDevice: () => 7,
    };
    addTicketBadge(card, 'DEV-003', JSON.stringify([{ status: 2 }]));
    const badge = card.querySelector<HTMLElement>('[data-ticket-identifier="DEV-003"]')!;
    expect(badge.querySelector('.myio-ticket-badge-count')!.textContent).toBe('7');
  });

  it('tolerates malformed tickets_items JSON', () => {
    (window as any).MyIOUtils = { ticketsEnabled: true };
    addTicketBadge(card, 'DEV-004', '{not json');
    const badge = card.querySelector<HTMLElement>('[data-ticket-identifier="DEV-004"]')!;
    expect(badge.style.display).toBe('none');
  });

  it('refreshTicketBadges updates counts and hides everything when the gate closes', () => {
    (window as any).MyIOUtils = { ticketsEnabled: true };
    (window as any).TicketServiceOrchestrator = {
      getTicketCountForDevice: () => 2,
    };
    addTicketBadge(card, 'DEV-005', null);
    const badge = card.querySelector<HTMLElement>('[data-ticket-identifier="DEV-005"]')!;
    expect(badge.querySelector('.myio-ticket-badge-count')!.textContent).toBe('2');

    (window as any).MyIOUtils.ticketsEnabled = false;
    refreshTicketBadges();
    expect(badge.style.display).toBe('none');
  });
});
