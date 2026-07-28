/**
 * RFC-0227 — Metas × Consumo guided tour: behavior, fixtures, persistence, a11y.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openMetasGuide,
  ENERGY_FIXTURES,
  WATER_FIXTURES,
  deriveTotal,
  computeChips,
  SERIES_COLORS,
} from '../src/components/metas-guide';

const ROOT = '#myio-metas-guide-root';
const TOTAL_SECTIONS = 11;

function q<T extends Element = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
}

afterEach(() => {
  document.querySelectorAll(ROOT).forEach((el) => el.remove());
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('fixtures — derivation (no divergent pre-computed numbers)', () => {
  it('energy KPIs equal the sum of their per-bucket series', () => {
    for (const s of ENERGY_FIXTURES.shoppings) {
      const sum = (arr: Array<number | null>) =>
        arr.reduce<number>((a, v) => a + (typeof v === 'number' ? v : 0), 0);
      expect(s.aMinus1).toBe(Math.round(sum(s.series.aMinus1)));
      expect(s.realizado).toBe(Math.round(sum(s.series.realizado)));
      expect(s.orcado).toBe(Math.round(sum(s.series.orcado)));
      expect(s.meta).toBe(Math.round(sum(s.series.meta)));
    }
  });

  it('the declared Total equals deriveTotal(shoppings) for both datasets', () => {
    expect(ENERGY_FIXTURES.total).toEqual(deriveTotal(ENERGY_FIXTURES));
    expect(WATER_FIXTURES.total).toEqual(deriveTotal(WATER_FIXTURES));
  });

  it('chips are derived signed ratios from the fixture KPIs', () => {
    const s = ENERGY_FIXTURES.shoppings[0];
    const c = computeChips(s);
    expect(c.vsAMinus1).toBeCloseTo(s.realizado / s.aMinus1 - 1, 10);
    expect(c.vsMeta).toBeCloseTo(s.realizado / s.meta - 1, 10);
    expect(c.vsOrcado).toBeCloseTo(s.realizado / s.orcado - 1, 10);
  });

  it('ships one energy dataset (MWh) and one water dataset (m³)', () => {
    expect(ENERGY_FIXTURES.domain).toBe('energy');
    expect(ENERGY_FIXTURES.unit).toBe('MWh');
    expect(WATER_FIXTURES.domain).toBe('water');
    expect(WATER_FIXTURES.unit).toBe('m³');
    expect(SERIES_COLORS.realizado).toBe('#2563eb');
    expect(SERIES_COLORS.aMinus1).toBe('#94a3b8');
    expect(SERIES_COLORS.orcado).toBe('#f59e0b');
    expect(SERIES_COLORS.meta).toBe('#7c3aed');
  });
});

describe('wizard — sections, order, navigation', () => {
  it('renders exactly 11 sections in the documented order', () => {
    const handle = openMetasGuide();
    expect(q('[data-mg-progress]').textContent).toContain(`1 / ${TOTAL_SECTIONS}`);

    const titles: string[] = [];
    for (let i = 0; i < TOTAL_SECTIONS; i++) {
      titles.push(q('#myio-mg-title').textContent || '');
      if (i < TOTAL_SECTIONS - 1) q<HTMLButtonElement>('[data-mg-next]').click();
    }

    expect(titles).toEqual([
      'Bem-vindo ao Metas × Consumo',
      'Domínio: Energia e Água',
      'Período e presets de Ano',
      'Dashboards × Analítico',
      'O card do shopping — gráfico',
      'O card do shopping — KPIs e chips',
      'Toggles de ano (👁)',
      'Resumo por shopping (sidebar)',
      'Ordenar o resumo',
      'Engine — gestão de metas',
      'Exportar e finalizar',
    ]);
    handle.close();
  });

  it('Prev is disabled on the first section; Next becomes "Concluir" on the last', () => {
    const handle = openMetasGuide();
    expect(q<HTMLButtonElement>('[data-mg-prev]').disabled).toBe(true);
    for (let i = 0; i < TOTAL_SECTIONS - 1; i++) q<HTMLButtonElement>('[data-mg-next]').click();
    expect(q<HTMLButtonElement>('[data-mg-next]').textContent).toBe('Concluir');
    handle.close();
  });

  it('goToStep clamps out-of-range indices', () => {
    const handle = openMetasGuide();
    handle.goToStep(999);
    expect(q('[data-mg-progress]').textContent).toContain(`${TOTAL_SECTIONS} / ${TOTAL_SECTIONS}`);
    handle.goToStep(-5);
    expect(q('[data-mg-progress]').textContent).toContain(`1 / ${TOTAL_SECTIONS}`);
    handle.close();
  });

  it('ArrowRight / ArrowLeft navigate; Escape closes', () => {
    const handle = openMetasGuide();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(q('[data-mg-progress]').textContent).toContain(`2 / ${TOTAL_SECTIONS}`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(q('[data-mg-progress]').textContent).toContain(`1 / ${TOTAL_SECTIONS}`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector(ROOT)).toBeNull();
    void handle;
  });

  it('Concluir on the last section calls onFinish then closes', () => {
    let finished = 0;
    let closed = 0;
    const handle = openMetasGuide({ onFinish: () => (finished += 1), onClose: () => (closed += 1) });
    for (let i = 0; i < TOTAL_SECTIONS - 1; i++) q<HTMLButtonElement>('[data-mg-next]').click();
    q<HTMLButtonElement>('[data-mg-next]').click(); // Concluir
    expect(finished).toBe(1);
    expect(closed).toBe(1);
    expect(document.querySelector(ROOT)).toBeNull();
    void handle;
  });

  it('Skip closes without calling onFinish', () => {
    let finished = 0;
    const handle = openMetasGuide({ onFinish: () => (finished += 1) });
    q<HTMLButtonElement>('[data-mg-skip]').click();
    expect(finished).toBe(0);
    expect(document.querySelector(ROOT)).toBeNull();
    void handle;
  });
});

describe('wizard — snapshot content derives from fixtures', () => {
  it('renders the Total row with deriveTotal values on the sidebar section', () => {
    const handle = openMetasGuide();
    handle.goToStep(7); // "Resumo por shopping (sidebar)"
    const totalRow = q('.myio-mg-side__row.is-total');
    const total = deriveTotal(ENERGY_FIXTURES);
    const text = totalRow.textContent || '';
    // pt-BR thousands separators — assert each derived value appears
    for (const v of [total.aMinus1, total.realizado, total.orcado, total.meta]) {
      expect(text).toContain(v.toLocaleString('pt-BR'));
    }
    handle.close();
  });
});

describe('persistence — opt-in only (RFC §6)', () => {
  it('never writes localStorage without a persistKey', () => {
    const handle = openMetasGuide(); // no persistKey
    // no checkbox is even shown on the last section
    for (let i = 0; i < TOTAL_SECTIONS - 1; i++) q<HTMLButtonElement>('[data-mg-next]').click();
    expect((q('[data-mg-persist-wrap]') as HTMLElement).hidden).toBe(true);
    q<HTMLButtonElement>('[data-mg-next]').click(); // Concluir
    expect(window.localStorage.length).toBe(0);
    void handle;
  });

  it('never writes when persistKey is set but the box is left unchecked', () => {
    const key = 'myio:metas-guide:seen:v1';
    const handle = openMetasGuide({ persistKey: key });
    for (let i = 0; i < TOTAL_SECTIONS - 1; i++) q<HTMLButtonElement>('[data-mg-next]').click();
    expect((q('[data-mg-persist-wrap]') as HTMLElement).hidden).toBe(false); // checkbox visible
    q<HTMLButtonElement>('[data-mg-next]').click(); // Concluir, box unchecked
    expect(window.localStorage.getItem(key)).toBeNull();
    void handle;
  });

  it('writes the versioned key only when persistKey is set AND the box is ticked', () => {
    const key = 'myio:metas-guide:seen:v1';
    const handle = openMetasGuide({ persistKey: key });
    for (let i = 0; i < TOTAL_SECTIONS - 1; i++) q<HTMLButtonElement>('[data-mg-next]').click();
    q<HTMLInputElement>('[data-mg-persist]').checked = true;
    q<HTMLButtonElement>('[data-mg-next]').click(); // Concluir
    expect(window.localStorage.getItem(key)).not.toBeNull();
    expect(JSON.parse(window.localStorage.getItem(key)!).seen).toBe(true);
    void handle;
  });
});

describe('accessibility (RFC §7)', () => {
  it('returns focus to the opener ("?" button) on close', () => {
    const opener = document.createElement('button');
    opener.setAttribute('data-help', '');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const handle = openMetasGuide();
    // focus moved into the dialog
    expect(document.activeElement).not.toBe(opener);
    handle.close();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('exposes a dialog role, aria-modal and an aria-live progress', () => {
    const handle = openMetasGuide();
    const dialog = q('.myio-mg-modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(q('[data-mg-progress]').getAttribute('aria-live')).toBe('polite');
    handle.close();
  });

  it('applies the inherited theme accent and dark mode', () => {
    const handle = openMetasGuide({
      theme: { accent: '#123456', accentDark: '#654321', accentText: '#fff', mode: 'dark' },
    });
    const dialog = q<HTMLElement>('.myio-mg-modal');
    expect(dialog.classList.contains('is-dark')).toBe(true);
    expect(dialog.style.getPropertyValue('--mg-accent')).toBe('#123456');
    handle.close();
  });
});

describe('copy — dynamic years, not hardcoded (RFC §P1)', () => {
  it('uses live getFullYear() labels in the presets section', () => {
    const handle = openMetasGuide();
    handle.goToStep(2); // "Período e presets de Ano"
    const body = q('[data-mg-body]').textContent || '';
    const cur = new Date().getFullYear();
    expect(body).toContain(`Ano ${cur}`);
    expect(body).toContain(`Ano ${cur - 1}`);
    handle.close();
  });
});
