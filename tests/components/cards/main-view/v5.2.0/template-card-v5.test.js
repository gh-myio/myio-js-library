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

describe('renderCardComponentV5 — device *_MANUAL (sem verificação de conectividade)', () => {
  const cardOf = (entityObject) =>
    renderCardComponentV5({
      entityObject: { entityId: 'dev-1', labelOrName: 'Manual', ...entityObject },
      enableSelection: false,
      enableDragDrop: false,
    })[0].querySelector('.device-card-centered');

  it.each(['offline', 'no_info', 'weak_connection'])('3F_MEDIDOR_MANUAL com status %s não fica offline', (st) => {
    const el = cardOf({ deviceProfile: '3F_MEDIDOR_MANUAL', deviceStatus: st, val: 1500 });
    expect(el.classList.contains('offline')).toBe(false);
    expect(el.querySelector('.connection-status-icon').getAttribute('data-conn')).toBe('online');
    expect(el.querySelector('.flash-icon').classList.contains('flash')).toBe(false);
  });

  it('usa o tipo base para formatar o valor (energia / água)', () => {
    const energy = cardOf({ deviceProfile: '3F_MEDIDOR_MANUAL', deviceStatus: 'offline', val: 1500 });
    const base = cardOf({ deviceProfile: '3F_MEDIDOR', deviceStatus: 'power_on', val: 1500 });
    expect(energy.querySelector('.consumption-value').textContent.trim()).toBe(
      base.querySelector('.consumption-value').textContent.trim()
    );

    const water = cardOf({ deviceProfile: 'HIDROMETRO_MANUAL', deviceStatus: 'no_info', val: 12.5 });
    expect(water.classList.contains('offline')).toBe(false);
    expect(water.querySelector('.consumption-value').textContent).toContain('m³');
  });

  it('device não-manual continua offline', () => {
    const el = cardOf({ deviceProfile: 'HIDROMETRO', deviceStatus: 'offline', val: 12.5 });
    expect(el.classList.contains('offline')).toBe(true);
  });
});

// RFC-0241 Part B — modo "R$ em vez de kWh/m³" (entityObject.displayMode / money)
describe('renderCardComponentV5 — RFC-0241 money mode', () => {
  const html = (entityObject) =>
    renderCardComponentV5({
      entityObject: { entityId: 'dev-1', labelOrName: 'Loja 1', deviceStatus: 'power_on', ...entityObject },
      enableSelection: false,
      enableDragDrop: false,
    })[0].outerHTML;
  const COMPLETE = { state: 'complete', amount: '1234.565', currency: 'BRL', coverage: 1 };
  const DEFAULT_CASES = [
    { deviceProfile: '3F_MEDIDOR', val: 1500, perc: 12.5 },
    { deviceProfile: 'HIDROMETRO', val: 12.5, perc: 40 },
    { deviceProfile: 'TANK', val: 1220.7, waterLevel: 1220.7, waterPercentage: 1.22 },
    { deviceProfile: '3F_MEDIDOR', val: null, dataLoading: true },
  ];

  // AC-11: golden HTML captured from the pre-RFC-0241 template (desenv e4e99ac7).
  it.each(DEFAULT_CASES.map((c, i) => [i, c]))('AC-11 default path is byte-identical to the pre-change template (#%i)', async (i, c) => {
    await expect(html(c)).toMatchFileSnapshot(`./__snapshots__/card-v5-default-${i}.html`);
  });

  it('AC-11: displayMode physical (or absent) ignores money → identical HTML', () => {
    for (const c of DEFAULT_CASES) {
      expect(html({ ...c, displayMode: 'physical', money: COMPLETE })).toBe(html(c));
      expect(html({ ...c, money: COMPLETE })).toBe(html(c));
    }
  });

  it('money + complete → "Custo estimado" in R$ (rounded once), physical value in the title', () => {
    const $c = renderCardComponentV5({
      entityObject: { entityId: 'dev-1', labelOrName: 'Loja', deviceProfile: '3F_MEDIDOR', val: 1500, displayMode: 'money', money: COMPLETE },
      enableSelection: false,
      enableDragDrop: false,
    })[0];
    const v = $c.querySelector('.consumption-value');
    expect(v.textContent.trim()).toBe('R$ 1.234,57');
    expect(v.getAttribute('title')).toBe(`Custo estimado — ${formatEnergy(1500)}`);
    expect($c.querySelector('.myio-money-label').textContent).toBe('Custo estimado');
    expect($c.textContent).not.toMatch(/Fatura|Faturamento|Conta de luz/);
  });

  it.each([
    [{ state: 'partial', currency: 'BRL', coverage: 0.4, reason: 'no-tariff' }, 'Tarifa parcial'],
    [{ state: 'missing', currency: 'BRL', coverage: 0, reason: 'no-tariff' }, 'Sem tarifa'],
    [{ state: 'uncategorized', currency: 'BRL', coverage: 0 }, 'Sem categoria'],
  ])('AC-14: money + %o → physical value + chip "%s", never R$ 0', (money, chip) => {
    const $c = renderCardComponentV5({
      entityObject: { entityId: 'd', labelOrName: 'Loja', deviceProfile: 'HIDROMETRO', val: 12.5, displayMode: 'money', money },
      enableSelection: false,
      enableDragDrop: false,
    })[0];
    expect($c.querySelector('.consumption-value').textContent.trim()).toBe('12,50 m³');
    expect($c.querySelector('.myio-money-chip').textContent).toBe(chip);
    expect($c.textContent).not.toContain('R$');
    expect($c.textContent).not.toContain('NaN');
  });

  it('money mode without money (not valued yet / Entrada) → physical, no chip', () => {
    const c = { deviceProfile: '3F_MEDIDOR', val: 1500 };
    const $c = renderCardComponentV5({
      entityObject: { entityId: 'd', labelOrName: 'L', ...c, displayMode: 'money' },
      enableSelection: false,
      enableDragDrop: false,
    })[0];
    expect($c.querySelector('.consumption-value').textContent.trim()).toBe(formatEnergy(1500));
    expect($c.querySelector('.myio-money-chip')).toBeNull();
  });

  it('AC-16: temperature and tank cards are never converted', () => {
    const temp = { deviceProfile: 'TERMOSTATO', val: 22.5, temperatureSource: 'thingsboard' };
    expect(html({ ...temp, displayMode: 'money', money: COMPLETE })).toBe(html(temp));
    const tank = DEFAULT_CASES[2];
    expect(html({ ...tank, displayMode: 'money', money: COMPLETE })).toBe(html(tank));
  });
});
