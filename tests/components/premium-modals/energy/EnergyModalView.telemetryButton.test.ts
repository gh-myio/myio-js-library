/**
 * ED-1149 / ED-1251 — the energy modal renders ONE "Telemetrias Instantâneas e
 * Pico de Demanda" button (shown when demandPeak OR instantTelemetry is enabled
 * for the device group) and that button actually opens the real-time modal.
 * Guards the merge regression where two buttons rendered with no click handler.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/components/RealTimeTelemetryModal', () => ({
  openRealTimeTelemetryModal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../src/components/premium-modals/internal/DateRangePickerJQ', () => ({
  attach: vi.fn().mockResolvedValue({ getDates: () => ({}), destroy: vi.fn() }),
}));

import { EnergyModalView } from '../../../../src/components/premium-modals/energy/EnergyModalView';
import { openRealTimeTelemetryModal } from '../../../../src/components/RealTimeTelemetryModal';

const ALL = (v: boolean) => ({ entrada: v, areacomum: v, lojas: v });

function makeView(featureButtons: unknown) {
  const modal = {
    setContent: (el: HTMLElement) => document.body.appendChild(el),
    close: vi.fn(),
    on: vi.fn(),
  };
  const config = {
    params: {
      readingType: 'energy',
      mode: 'single',
      deviceId: 'dev-1',
      deviceProfile: '3F_MEDIDOR',
      featureButtons,
      tbJwtToken: 'tb-jwt',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
    context: { device: { label: 'Loja 1', name: 'LOJA-1' }, resolved: { centralId: 'c1', customerId: 'cu1' } },
    onError: vi.fn(),
  };
  return new EnergyModalView(modal, config as never);
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.setItem('jwt_token', 'tb-jwt');
  vi.mocked(openRealTimeTelemetryModal).mockClear();
});

afterEach(() => {
  localStorage.clear();
});

describe('EnergyModalView — unified telemetry/demand button', () => {
  it('renders a single button when only one of the two features is enabled, and it opens the modal', async () => {
    makeView({ demandPeak: ALL(false), instantTelemetry: ALL(true) });

    expect(document.getElementById('view-demand-btn')).toBeNull();
    expect(document.getElementById('view-telemetry-btn')).toBeNull();
    const btn = document.getElementById('view-telemetry-demand-btn');
    expect(btn).not.toBeNull();

    btn!.click();
    await vi.waitFor(() => expect(openRealTimeTelemetryModal).toHaveBeenCalledTimes(1));
    expect(vi.mocked(openRealTimeTelemetryModal).mock.calls[0][0]).toMatchObject({ deviceId: 'dev-1', token: 'tb-jwt' });
  });

  it('hides the button when both features are disabled for the group', () => {
    makeView({ demandPeak: ALL(false), instantTelemetry: ALL(false) });
    expect(document.getElementById('view-telemetry-demand-btn')).toBeNull();
  });
});
