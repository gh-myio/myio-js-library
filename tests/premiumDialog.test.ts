// RFC-0205: Premium Dialog — openConfirmDialog / openMessageDialog
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  openConfirmDialog,
  openMessageDialog,
} from '../src/components/premium-modals/dialog';

function overlay(): HTMLElement | null {
  return document.querySelector('.myio-dialog-overlay');
}

function clickButtonByLabel(label: string): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.myio-dialog__btn'));
  const btn = buttons.find((b) => b.textContent === label);
  if (!btn) throw new Error(`button not found: ${label}`);
  btn.click();
}

afterEach(() => {
  document.querySelectorAll('.myio-dialog-overlay').forEach((el) => el.remove());
  vi.useRealTimers();
});

describe('openConfirmDialog', () => {
  it('resolves with the value of the clicked button and removes the overlay', async () => {
    const promise = openConfirmDialog({
      title: 'Excluir',
      message: 'Tem certeza?',
      buttons: [
        { label: 'Cancelar', variant: 'secondary', value: 'cancel' },
        { label: 'Excluir', variant: 'danger', value: 'confirm' },
      ],
    });

    expect(overlay()).not.toBeNull();
    clickButtonByLabel('Excluir');

    await expect(promise).resolves.toBe('confirm');
    expect(overlay()).toBeNull();
  });

  it('resolves null on Esc when dismissible (default)', async () => {
    const promise = openConfirmDialog({
      title: 'T',
      message: 'M',
      buttons: [{ label: 'OK', value: 'ok' }],
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on backdrop click and on the × button', async () => {
    const p1 = openConfirmDialog({
      title: 'T',
      message: 'M',
      buttons: [{ label: 'OK', value: 'ok' }],
    });
    overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(p1).resolves.toBeNull();

    const p2 = openConfirmDialog({
      title: 'T',
      message: 'M',
      buttons: [{ label: 'OK', value: 'ok' }],
    });
    document.querySelector<HTMLButtonElement>('.myio-dialog__close')!.click();
    await expect(p2).resolves.toBeNull();
  });

  it('ignores Esc/backdrop and renders no × when dismissible is false', async () => {
    const onResolve = vi.fn();
    const promise = openConfirmDialog({
      title: 'T',
      message: 'M',
      dismissible: false,
      buttons: [{ label: 'OK', value: 'ok' }],
    });
    promise.then(onResolve);

    expect(document.querySelector('.myio-dialog__close')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(onResolve).not.toHaveBeenCalled();
    expect(overlay()).not.toBeNull();

    clickButtonByLabel('OK');
    await expect(promise).resolves.toBe('ok');
  });

  it('throws synchronously when buttons is empty', () => {
    expect(() =>
      openConfirmDialog({ title: 'T', message: 'M', buttons: [] }),
    ).toThrow();
    expect(overlay()).toBeNull();
  });

  it('HTML-escapes title, message and button labels; renders \\n as <br>', async () => {
    const promise = openConfirmDialog({
      title: '<b>Bold</b>',
      message: 'line1\nline2 <script>alert(1)</script>',
      buttons: [{ label: '<i>Go</i>', value: 'go' }],
    });

    const root = document.querySelector('.myio-dialog')!;
    expect(root.querySelector('.myio-dialog__title')!.innerHTML).toContain('&lt;b&gt;');
    const messageHtml = root.querySelector('.myio-dialog__message')!.innerHTML;
    expect(messageHtml).toContain('line1<br>line2');
    expect(messageHtml).not.toContain('<script>');
    expect(root.querySelector('.myio-dialog__btn')!.innerHTML).toContain('&lt;i&gt;');

    clickButtonByLabel('<i>Go</i>');
    await promise;
  });

  it('focuses the autoFocus button on open', async () => {
    const promise = openConfirmDialog({
      title: 'T',
      message: 'M',
      buttons: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b', autoFocus: true },
        { label: 'C', value: 'c' },
      ],
    });

    expect((document.activeElement as HTMLElement).textContent).toBe('B');
    clickButtonByLabel('A');
    await promise;
  });

  it('stacks concurrent dialogs with increasing z-index', async () => {
    const p1 = openConfirmDialog({ title: '1', message: 'M', buttons: [{ label: 'A', value: 'a' }] });
    const p2 = openConfirmDialog({ title: '2', message: 'M', buttons: [{ label: 'B', value: 'b' }] });

    const overlays = Array.from(document.querySelectorAll<HTMLElement>('.myio-dialog-overlay'));
    expect(overlays).toHaveLength(2);
    expect(Number(overlays[1].style.zIndex)).toBeGreaterThan(Number(overlays[0].style.zIndex));

    clickButtonByLabel('A');
    clickButtonByLabel('B');
    await Promise.all([p1, p2]);
  });

  it('mounts into a custom container when provided', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const promise = openConfirmDialog({
      title: 'T',
      message: 'M',
      container: host,
      buttons: [{ label: 'OK', value: 'ok' }],
    });

    expect(host.querySelector('.myio-dialog-overlay')).not.toBeNull();
    clickButtonByLabel('OK');
    await promise;
    expect(host.querySelector('.myio-dialog-overlay')).toBeNull();
    host.remove();
  });

  it('applies the dark theme modifier', async () => {
    const promise = openConfirmDialog({
      title: 'T',
      message: 'M',
      theme: 'dark',
      buttons: [{ label: 'OK', value: 'ok' }],
    });
    expect(overlay()!.classList.contains('myio-dialog-overlay--dark')).toBe(true);
    clickButtonByLabel('OK');
    await promise;
  });
});

describe('openMessageDialog', () => {
  it('resolves void when the acknowledgment button is clicked', async () => {
    const promise = openMessageDialog({ message: 'Salvo com sucesso', severity: 'success' });

    expect(document.querySelector('.myio-dialog--success')).not.toBeNull();
    expect(document.querySelector('.myio-dialog__title')!.textContent).toBe('Sucesso');

    clickButtonByLabel('OK');
    await expect(promise).resolves.toBeUndefined();
  });

  it('uses custom title and buttonLabel when provided', async () => {
    const promise = openMessageDialog({
      title: 'Custom',
      message: 'M',
      buttonLabel: 'Entendi',
    });
    expect(document.querySelector('.myio-dialog__title')!.textContent).toBe('Custom');
    clickButtonByLabel('Entendi');
    await promise;
  });

  it('auto-closes after autoCloseMs', async () => {
    vi.useFakeTimers();
    const promise = openMessageDialog({ message: 'M', autoCloseMs: 3000 });

    expect(overlay()).not.toBeNull();
    vi.advanceTimersByTime(3000);

    await expect(promise).resolves.toBeUndefined();
    expect(overlay()).toBeNull();
  });
});
