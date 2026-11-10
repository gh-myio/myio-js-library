// SettingsModalView — Etiqueta (label) do device sempre em maiúsculas: carga, digitação/colagem,
// título ao lado do ícone e gravação.
import { afterEach, describe, expect, it, vi } from 'vitest';
// central-settings estende SettingsModalView: importar antes evita o ciclo de import no jsdom
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';

const make = (onSave = vi.fn()) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  document.body.innerHTML = '';
  const view = new SettingsModalView({
    deviceId: 'dev-1',
    customerId: 'customer-1',
    jwtToken: 'jwt',
    tbBaseUrl: 'https://thingsboard.test',
    domain: 'energy',
    themeMode: 'light',
    deviceLabel: 'outback',
    deviceName: '3F SCMAL3L4304DEFG',
    onSave,
    onClose: () => undefined,
  } as any);
  view.render({ label: 'outback', floor: 'L3' });
  const label = document.querySelector<HTMLInputElement>('#label')!;
  const title = document.querySelector<HTMLElement>('.identity-name-text')!;
  return { view, label, title, onSave };
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('SettingsModalView — etiqueta em maiúsculas', () => {
  it('carrega o label salvo em maiúsculas no input e no título do ícone', () => {
    const { label, title } = make();
    expect(label.value).toBe('OUTBACK');
    expect(title.textContent).toBe('OUTBACK');
  });

  it('digitação e colagem viram maiúsculas (inclui acentos) e o título acompanha', () => {
    const { label, title } = make();
    label.value = 'café são joão';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    expect(label.value).toBe('CAFÉ SÃO JOÃO');
    expect(title.textContent).toBe('CAFÉ SÃO JOÃO');
  });

  it('getFormData grava o label em maiúsculas; outros campos ficam como digitados', () => {
    const { view, label } = make();
    label.value = 'mc donald´s'; // sem evento input (ex.: valor setado por script)
    const data = view.getFormData();
    expect(data.label).toBe('MC DONALD´S');
    expect(data.floor).toBe('L3');
  });

  it('device.name abaixo da etiqueta tem botão de copiar só o name', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    make();
    const btn = document.querySelector<HTMLButtonElement>('#btnCopyDeviceName')!;
    expect(btn.closest('.device-name-row')!.querySelector('.device-name-subtitle')!.textContent).toBe('3F SCMAL3L4304DEFG');
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith('3F SCMAL3L4304DEFG');
    expect(btn.classList.contains('is-copied')).toBe(true);
  });

  it('central (isGateway) mantém o nome como está', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    document.body.innerHTML = '';
    new SettingsModalView({
      deviceId: 'c-1', customerId: 'customer-1', jwtToken: 'jwt', tbBaseUrl: 'https://thingsboard.test',
      domain: 'energy', themeMode: 'light', isGateway: true, deviceLabel: 'Central Campinas',
      onSave: vi.fn(), onClose: () => undefined,
    } as any).render({ label: 'Central Campinas' });
    expect(document.querySelector<HTMLInputElement>('#label')!.value).toBe('Central Campinas');
  });

  it('toLabelCase trata vazio/nulo', () => {
    expect(SettingsModalView.toLabelCase(undefined)).toBe('');
    expect(SettingsModalView.toLabelCase('outback')).toBe('OUTBACK');
  });
});
