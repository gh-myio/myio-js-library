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
    expect(badge.textContent.trim()).toBe('na faixa'); // 22,5 dentro de 20–26
  });

  it('temperatura: badge = desvio em °C em relação à faixa ideal (não % do centro)', () => {
    const above = render({ deviceProfile: 'TERMOSTATO', val: 30.7, temperatureMin: 23, temperatureMax: 25.5 }).badge;
    expect(above.textContent.trim()).toBe('+5,2 °C'); // 30,7 − 25,5 (antes "+26,6%")
    expect(above.getAttribute('title')).toBe('Faixa ideal 23,0–25,5 °C · 5,2 °C acima do limite');
    expect(above.style.color).toBe('rgb(239, 68, 68)');

    const below = render({ deviceProfile: 'TERMOSTATO', val: 21.8, temperatureMin: 23, temperatureMax: 25.5 }).badge;
    expect(below.textContent.trim()).toBe('−1,2 °C');
    expect(below.getAttribute('title')).toContain('abaixo do limite');

    const inside = render({ deviceProfile: 'TERMOSTATO', val: 24, temperatureMin: 23, temperatureMax: 25.5 }).badge;
    expect(inside.textContent.trim()).toBe('na faixa');
  });
});

describe('renderCardComponentV5 — temperatura: hora mais recente (24 h) + frescor + offset', () => {
  const H = 3600_000;
  const card = (extra) =>
    renderCardComponentV5({
      entityObject: {
        entityId: 'dev-1',
        labelOrName: 'Sensor',
        deviceStatus: 'power_on',
        deviceProfile: 'TERMOSTATO',
        val: 25.5,
        temperatureSource: 'ingestion-hourly',
        temperatureFetchedAt: Date.now(),
        ...extra,
      },
      enableSelection: false,
      enableDragDrop: false,
    });

  it('até 10 h: normal, sem borda de aviso; tooltip com a hora da média e a última leitura', () => {
    const $c = card({ temperatureFreshness: 'ok', temperatureHourTs: Date.now() - H, temperatureLastTs: Date.now() - 30 * 60_000 });
    expect($c[0].classList.contains('myio-card-temp-warning')).toBe(false);
    expect($c[0].querySelector('.myio-temp-warn-icon')).toBeNull();
    const title = $c[0].querySelector('.consumption-value').getAttribute('title');
    expect(title).toMatch(/^Média da hora /);
    expect(title).toContain('última leitura');
  });

  it('10–12 h: borda laranja + ⚠ piscando ao lado da temperatura (valor continua visível)', () => {
    const $c = card({ temperatureFreshness: 'warning', temperatureHourTs: Date.now() - 11 * H, temperatureLastTs: Date.now() - 11 * H });
    expect($c[0].classList.contains('myio-card-temp-warning')).toBe(true);
    expect($c[0].querySelector('.myio-temp-warn-icon')).not.toBeNull();
    expect($c[0].querySelector('.consumption-value').textContent.trim()).toBe('25,50 °C');
  });

  it('12–24 h: "Sem leitura recente" com a data da última leitura no tooltip', () => {
    const $c = card({ val: 0, temperatureFreshness: 'stale', temperatureNoRecentReading: true, temperatureLastTs: Date.now() - 15 * H });
    const v = $c[0].querySelector('.consumption-value');
    expect(v.textContent.trim()).toBe('Sem leitura recente');
    expect(v.getAttribute('title')).toMatch(/^Sem leitura nas últimas 12 h — última leitura/);
  });

  it('> 24 h: tooltip "Nenhuma leitura nas últimas 24 h"', () => {
    const $c = card({ val: 0, temperatureFreshness: 'offline', temperatureNoRecentReading: true, deviceStatus: 'offline' });
    expect($c[0].querySelector('.consumption-value').getAttribute('title')).toBe('Nenhuma leitura nas últimas 24 h');
  });

  it('offset ≠ 0: mesmo marcador da exclusão de totais; offset 0: sem marcador', () => {
    expect(card({ temperatureFreshness: 'ok', temperatureLastTs: Date.now(), temperatureOffset: -2 })[0].classList.contains('myio-card-excluded')).toBe(true);
    expect(card({ temperatureFreshness: 'ok', temperatureLastTs: Date.now(), temperatureOffset: 0 })[0].classList.contains('myio-card-excluded')).toBe(false);
  });
});

describe('renderCardComponentV5 — telemetria ainda carregando (dataLoading)', () => {
  it('spinner no valor, sem selo e status neutro (não marca offline)', () => {
    const $card = renderCardComponentV5({
      entityObject: {
        entityId: 'dev-1',
        labelOrName: 'Loja',
        deviceProfile: '3F_MEDIDOR',
        deviceStatus: 'offline',
        val: null,
        dataLoading: true,
      },
      enableSelection: false,
      enableDragDrop: false,
    });
    const el = $card[0];
    const value = el.querySelector('.consumption-value');

    expect(value.classList.contains('myio-value-loading')).toBe(true);
    expect(value.textContent.trim()).toBe('Carregando…');
    expect(el.querySelector('.myio-value-spinner')).not.toBeNull();
    expect(el.querySelector('.device-percentage-badge')).toBeNull();
    expect(el.classList.contains('myio-card-data-loading')).toBe(true);
    expect(el.querySelector('.device-card-centered').classList.contains('offline')).toBe(false);
  });

  it('sem dataLoading: valor normal', () => {
    const { headline, badge } = render({ deviceProfile: '3F_MEDIDOR', val: 1500, perc: 12.5 });
    expect(headline).toBe(formatEnergy(1500));
    expect(badge).not.toBeNull();
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
