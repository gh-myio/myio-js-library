// tests/components/cards/main-view/v5.2.0/template-card-v5.test.js
// Card V5 — caixa d'água (TANK / CAIXA_DAGUA): o percentual é o destaque e o
// nível (water_level em cm) vai para o badge convertido em M.C.A. Os demais
// domínios (energia, hidrômetro, temperatura) devem renderizar como antes.
/* global window */
import { describe, it, expect, afterEach } from 'vitest';
import { renderCardComponentV5 } from '../../../../../src/components/cards/main-view/v5.2.0/template-card-v5.js';
import { formatEnergy } from '../../../../../src/utils/format/energy.ts';

function render(entityObject, options = {}) {
  const $card = renderCardComponentV5({
    entityObject: { entityId: 'dev-1', labelOrName: 'Device', deviceStatus: 'power_on', ...entityObject },
    enableSelection: false,
    enableDragDrop: false,
    ...options,
  });
  const el = $card[0];
  return {
    headline: el.querySelector('.consumption-value').textContent.trim(),
    badge: el.querySelector('.device-percentage-badge'),
  };
}

afterEach(() => {
  delete window.MyIOUtils;
});

describe("renderCardComponentV5 — caixa d'água (TANK / CAIXA_DAGUA)", () => {
  it('shows the percentage as headline and the level in M.C.A on the badge', () => {
    // Legacy payload shape sent by the TELEMETRY widget (deviceType only, val = waterLevel)
    const { headline, badge } = render({
      deviceType: 'TANK',
      val: 1220.7,
      waterLevel: 1220.7,
      waterPercentage: 1.22,
    });

    expect(headline).toBe('122,00%');
    expect(badge.textContent.trim()).toBe('12,21 M.C.A');
    expect(badge.classList.contains('device-tank-level-badge')).toBe(true);
    expect(badge.classList.contains('percentage-tooltip-trigger')).toBe(false);
  });

  it('falls back to val for the level and to 0% when waterPercentage is missing', () => {
    const { headline, badge } = render({ deviceProfile: 'TANK', val: 1220.7 });

    expect(headline).toBe('0,00%');
    expect(badge.textContent.trim()).toBe('12,21 M.C.A');
  });

  it('treats CAIXA_DAGUA like TANK', () => {
    const { headline, badge } = render({
      deviceProfile: 'CAIXA_DAGUA',
      val: 1220.7,
      waterLevel: 1220.7,
      waterPercentage: 1.22,
    });

    expect(headline).toBe('122,00%');
    expect(badge.textContent.trim()).toBe('12,21 M.C.A');
  });

  it('follows percentDecimals for the headline percentage', () => {
    const { headline } = render(
      { deviceProfile: 'TANK', waterLevel: 1220.7, waterPercentage: 1.22 },
      { percentDecimals: 1 }
    );

    expect(headline).toBe('122,0%');
  });

  it('does not break when the tank has no level nor percentage', () => {
    const { headline, badge } = render({ deviceProfile: 'TANK' });

    expect(headline).toBe('0,00%');
    expect(badge.textContent.trim()).toBe('-');
  });
});

describe('renderCardComponentV5 — other domains keep their rendering', () => {
  it('energy: formatted consumption headline and percentage badge with comparison trigger', () => {
    const { headline, badge } = render({ deviceProfile: '3F_MEDIDOR', val: 1500, perc: 12.5 });

    expect(headline).toBe(formatEnergy(1500));
    expect(badge.textContent.trim()).toBe('12,50%');
    expect(badge.classList.contains('percentage-tooltip-trigger')).toBe(true);
    expect(badge.classList.contains('device-tank-level-badge')).toBe(false);
  });

  it('hidrômetro: m³ headline and percentage badge', () => {
    const { headline, badge } = render({ deviceProfile: 'HIDROMETRO', val: 12.5, perc: 40 });

    expect(headline).toBe('12,50 m³');
    expect(badge.textContent.trim()).toBe('40,00%');
    expect(badge.classList.contains('percentage-tooltip-trigger')).toBe(true);
  });

  it('temperatura: °C headline and deviation badge', () => {
    const { headline, badge } = render({
      deviceProfile: 'TERMOSTATO',
      val: 22.5,
      temperatureMin: 20,
      temperatureMax: 26,
    });

    expect(headline).toBe('22,50 °C');
    expect(badge.classList.contains('temp-deviation-badge')).toBe(true);
    expect(badge.textContent.trim()).toBe('-2.2%');
  });
});

describe('renderCardComponentV5 — temperatura atual do Ingestion (média 2 h)', () => {
  const fetchedAt = new Date(2026, 9, 8, 14, 5).getTime();

  it('sem leitura na janela: "Sem leitura recente", sem badge de desvio e nunca 0 °C', () => {
    const $card = renderCardComponentV5({
      entityObject: {
        entityId: 'dev-1',
        labelOrName: 'Sensor',
        deviceStatus: 'power_on',
        deviceProfile: 'TERMOSTATO',
        val: 0,
        temperatureMin: 20,
        temperatureMax: 26,
        temperatureNoRecentReading: true,
        temperatureSource: 'ingestion-avg-2h',
        temperatureFetchedAt: fetchedAt,
      },
      enableSelection: false,
      enableDragDrop: false,
    });
    const value = $card[0].querySelector('.consumption-value');

    expect(value.textContent.trim()).toBe('Sem leitura recente');
    expect(value.getAttribute('title')).toBe('Nenhuma leitura nas últimas 2 h · Atualizado às 14:05');
    expect($card[0].querySelector('.temp-deviation-badge')).toBeNull();
  });

  it('com leitura: valor em °C com rótulo "média das últimas 2 h"', () => {
    const $card = renderCardComponentV5({
      entityObject: {
        entityId: 'dev-1',
        labelOrName: 'Sensor',
        deviceStatus: 'power_on',
        deviceProfile: 'TERMOSTATO',
        val: 28.06,
        temperatureSource: 'ingestion-avg-2h',
        temperatureFetchedAt: fetchedAt,
      },
      enableSelection: false,
      enableDragDrop: false,
    });
    const value = $card[0].querySelector('.consumption-value');

    expect(value.textContent.trim()).toBe('28,06 °C');
    expect(value.getAttribute('title')).toBe('Temperatura (média das últimas 2 h) · Atualizado às 14:05');
  });

  it('valor do ThingsBoard: sem rótulo de média', () => {
    const { headline } = render({ deviceProfile: 'TERMOSTATO', val: 22.5, temperatureSource: 'thingsboard' });
    const $card = renderCardComponentV5({
      entityObject: { entityId: 'dev-1', labelOrName: 'S', deviceProfile: 'TERMOSTATO', val: 22.5, temperatureSource: 'thingsboard' },
      enableSelection: false,
      enableDragDrop: false,
    });

    expect(headline).toBe('22,50 °C');
    expect($card[0].querySelector('.consumption-value').hasAttribute('title')).toBe(false);
  });
});
