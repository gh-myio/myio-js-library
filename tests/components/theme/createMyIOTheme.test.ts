import { describe, it, expect } from 'vitest';
import { createMyIOTheme } from '../../../src/components/theme';

describe('createMyIOTheme', () => {
  it('defaults match the premium modal tokens (no-op when unconfigured)', () => {
    const t = createMyIOTheme();
    expect(t.mode).toBe('light');
    expect(t.accent).toBe('#3e1a7d');
    expect(t.accentDark).toBe('#2d1458');
    expect(t.accentText).toBe('#ffffff');
    expect(t.text).toBe('#333333');
    expect(t.mutedText).toBe('#666666');
  });

  it('resolves dark mode from defaultThemeMode', () => {
    const t = createMyIOTheme({ defaultThemeMode: 'dark' });
    expect(t.mode).toBe('dark');
    expect(t.text).toBe('#ffffff');
    expect(t.background).toBe('#1a1a1a');
  });

  it('mode param overrides defaultThemeMode', () => {
    const t = createMyIOTheme({ defaultThemeMode: 'dark' }, 'light');
    expect(t.mode).toBe('light');
  });

  it('uses mode primaryColor/secondaryColor as accent chain', () => {
    const t = createMyIOTheme({
      defaultThemeMode: 'light',
      lightMode: { primaryColor: '#2f5848', secondaryColor: '#1f3a35' },
    });
    expect(t.accent).toBe('#2f5848');
    expect(t.accentDark).toBe('#1f3a35');
  });

  it('tabSelecionadoBackgroundColor has precedence over primaryColor (UNIQUE chain)', () => {
    const t = createMyIOTheme({
      tabSelecionadoBackgroundColor: '#2f5848',
      tabSelecionadoFontColor: '#f2f2f2',
      lightMode: { primaryColor: '#7A2FF7' },
    });
    expect(t.accent).toBe('#2f5848');
    expect(t.accentText).toBe('#f2f2f2');
  });

  it('background uses image url when backgroundType=image', () => {
    const t = createMyIOTheme({
      lightMode: { backgroundType: 'image', backgroundUrl: 'https://x/y.png' },
    });
    expect(t.background).toContain("url('https://x/y.png')");
  });

  it('tones returns N solid hex colors starting with the accent', () => {
    const t = createMyIOTheme({ lightMode: { primaryColor: '#2f5848' } });
    const tones = t.tones(6);
    expect(tones).toHaveLength(6);
    expect(tones![0]).toBe('#2f5848');
    tones!.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    expect(new Set(tones).size).toBe(6);
  });

  it('tones returns null for non-hex accent (caller falls back to default palette)', () => {
    const t = createMyIOTheme({ lightMode: { primaryColor: 'rebeccapurple' } });
    expect(t.tones(4)).toBeNull();
  });

  it('cssVars maps to the --myio-* custom properties', () => {
    const t = createMyIOTheme({ lightMode: { primaryColor: '#2f5848' } });
    const vars = t.cssVars();
    expect(vars['--myio-brand-700']).toBe('#2f5848');
    expect(vars['--myio-primary']).toBe('#2f5848');
    expect(Object.keys(vars).every((k) => k.startsWith('--myio-'))).toBe(true);
  });

  it('applyTo sets the vars on the given element', () => {
    const el = document.createElement('div');
    const t = createMyIOTheme({ lightMode: { primaryColor: '#2f5848' } });
    t.applyTo(el);
    expect(el.style.getPropertyValue('--myio-brand-700')).toBe('#2f5848');
    expect(el.style.getPropertyValue('--myio-text')).toBe('#333333');
  });
});
