// ED-1413 — SettingsModalView: trocar a etiqueta pede confirmação (de → para) antes de salvar.
// Cancelar/Esc não salva nada e mantém a modal aberta com o valor editado.
import { afterEach, describe, expect, it, vi } from 'vitest';
// central-settings estende SettingsModalView: importar antes evita o ciclo de import no jsdom
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';

const flush = () => new Promise((r) => setTimeout(r, 0));

const make = (extra: Record<string, unknown> = {}) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
  document.body.innerHTML = '';
  const onSave = vi.fn(async () => undefined);
  const view = new SettingsModalView({
    deviceId: 'dev-1',
    customerId: 'customer-1',
    jwtToken: 'jwt',
    tbBaseUrl: 'https://thingsboard.test',
    domain: 'energy',
    themeMode: 'light',
    deviceLabel: 'outback',
    userEmail: 'operador@example.com',
    onSave,
    onClose: () => undefined,
    ...extra,
  } as any);
  view.render({ label: 'outback', floor: 'L3' });
  const label = document.querySelector<HTMLInputElement>('#label')!;
  const saveBtn = document.querySelector<HTMLButtonElement>('.btn-save')!;
  const overlay = document.querySelector<HTMLElement>('.myio-device-settings-overlay')!;
  const typeLabel = (value: string) => {
    label.value = value;
    label.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return { view, label, saveBtn, overlay, onSave, typeLabel };
};

const dialog = () => document.querySelector<HTMLElement>('.myio-dialog-overlay');
const dialogButton = (variant: 'primary' | 'secondary') =>
  dialog()!.querySelector<HTMLButtonElement>(`.myio-dialog__btn--${variant}`)!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('SettingsModalView — confirmação da troca de etiqueta (ED-1413)', () => {
  it('etiqueta alterada → abre a confirmação de→para dentro do overlay da modal, sem salvar ainda', async () => {
    const { saveBtn, overlay, onSave, typeLabel } = make();
    typeLabel('nova loja');
    saveBtn.click();
    await flush();

    const d = dialog();
    expect(d).not.toBeNull();
    // montado dentro do overlay da Settings (z-index 9999999), senão ficaria atrás dela
    expect(overlay.contains(d)).toBe(true);
    const message = d!.querySelector('.myio-dialog__message')!.textContent!;
    expect(message).toContain('Trocar a etiqueta de "OUTBACK" para "NOVA LOJA"?');
    expect(message).toContain('Essa alteração fica registrada no histórico do dispositivo.');
    expect(dialogButton('secondary').textContent).toBe('Cancelar');
    expect(dialogButton('primary').textContent).toBe('Confirmar');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Cancelar → nada é salvo e a modal continua aberta com o valor editado', async () => {
    const { label, saveBtn, onSave, typeLabel } = make();
    typeLabel('nova loja');
    saveBtn.click();
    await flush();
    dialogButton('secondary').click();
    await flush();

    expect(onSave).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
    expect(document.querySelector('.myio-device-settings-modal')).not.toBeNull();
    expect(label.value).toBe('NOVA LOJA');
  });

  it('Esc no diálogo equivale a Cancelar e não fecha a modal de Settings', async () => {
    const onClose = vi.fn();
    const { saveBtn, onSave, typeLabel } = make({ onClose });
    typeLabel('nova loja');
    saveBtn.click();
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();

    expect(dialog()).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Confirmar → onSave com o formData e o labelChange (de→para) + autor', async () => {
    const { saveBtn, onSave, typeLabel } = make();
    typeLabel('nova loja');
    saveBtn.click();
    await flush();
    dialogButton('primary').click();
    await flush();

    expect(onSave).toHaveBeenCalledTimes(1);
    const [formData, meta] = onSave.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>];
    expect(formData.label).toBe('NOVA LOJA');
    expect(formData.floor).toBe('L3');
    expect(meta).toEqual({
      labelChange: { from: 'OUTBACK', to: 'NOVA LOJA' },
      changedBy: { id: '', email: 'operador@example.com', name: '' },
    });
  });

  it('o submit do formulário passa pela mesma confirmação', async () => {
    const { onSave, typeLabel } = make();
    typeLabel('nova loja');
    document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(dialog()).not.toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('salvar sem mudar a etiqueta → sem confirmação e sem labelChange', async () => {
    const { saveBtn, onSave } = make();
    saveBtn.click();
    await flush();

    expect(dialog()).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]).toHaveLength(1);
  });

  it('só muda a caixa (outback → OUTBACK) não conta como troca', async () => {
    const { saveBtn, onSave, label } = make();
    label.value = 'outback'; // sem evento input: getFormData normaliza para OUTBACK
    saveBtn.click();
    await flush();

    expect(dialog()).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('clique duplo no Salvar abre um único diálogo', async () => {
    const { saveBtn, typeLabel } = make();
    typeLabel('nova loja');
    saveBtn.click();
    saveBtn.click();
    await flush();

    expect(document.querySelectorAll('.myio-dialog-overlay')).toHaveLength(1);
  });

  it('depois do TB salvar (setLoadedLabel), um novo Salvar com a mesma etiqueta não pede confirmação', async () => {
    const { view, saveBtn, onSave, typeLabel } = make();
    typeLabel('nova loja');
    view.setLoadedLabel('NOVA LOJA');
    saveBtn.click();
    await flush();

    expect(dialog()).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('central (isGateway) não pede confirmação', async () => {
    const { saveBtn, onSave, typeLabel } = make({ isGateway: true, deviceLabel: 'Central Campinas' });
    typeLabel('Central Campinas 2');
    saveBtn.click();
    await flush();

    expect(dialog()).toBeNull();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
