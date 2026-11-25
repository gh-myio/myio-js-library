/**
 * RFC-0242 — composer: textarea (Enter sends, Shift+Enter breaks the line),
 * `/think` `/tools` hints, cancel button while a turn streams. Kept alive
 * across renders so the draft and the focus survive state changes.
 */
import { h } from './dom';
import type { Translator } from './i18n';

export interface ComposerView {
  el: HTMLElement;
  setBusy(busy: boolean): void;
  setMode(mode: 'edit' | 'readonly' | 'none'): void;
  value(): string;
  setValue(v: string): void;
  focus(): void;
  /** Inserts text at the caret (used to redirect stray keystrokes into the composer). */
  insertText(text: string): void;
  readonly input: HTMLTextAreaElement;
  /** True when the textarea is visible and editable. */
  editable(): boolean;
}

export function createComposer(t: Translator, onSend: (text: string) => void, onCancel: () => void): ComposerView {
  let busy = false;
  const ta = h('textarea', { rows: 1, maxlength: 4000, placeholder: t('placeholder'), 'aria-label': t('placeholder'), 'data-part': 'input' });
  const btn = h('button', { type: 'button', class: 'send', 'data-part': 'send', 'aria-label': t('send'), title: t('send') }, '➤');
  const readOnly = h('p', { class: 'muted', 'data-part': 'readonly' }, t('readOnly'));
  const form = h('div', { class: 'row' }, ta, btn);
  const el = h('div', { class: 'composer', 'data-part': 'composer' }, form, h('div', { class: 'hint' }, t('hints')));

  const submit = () => {
    if (busy) return;
    const v = ta.value.trim();
    if (!v) return;
    ta.value = '';
    onSend(v);
  };
  ta.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter' && !ke.shiftKey && !ke.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  btn.addEventListener('click', () => (busy ? onCancel() : submit()));

  return {
    el,
    setBusy(b) {
      busy = b;
      btn.classList.toggle('stop', b);
      btn.textContent = b ? '■' : '➤';
      btn.setAttribute('aria-label', b ? t('cancel') : t('send'));
      btn.title = b ? t('cancel') : t('send');
      btn.setAttribute('data-part', b ? 'cancel' : 'send');
    },
    setMode(mode) {
      el.style.display = mode === 'none' ? 'none' : '';
      const ro = mode === 'readonly';
      form.style.display = ro ? 'none' : '';
      (el.querySelector('.hint') as HTMLElement).style.display = ro ? 'none' : '';
      if (ro && !readOnly.parentNode) el.appendChild(readOnly);
      if (!ro && readOnly.parentNode) el.removeChild(readOnly);
    },
    value: () => ta.value,
    setValue(v) { ta.value = v; },
    focus() { try { ta.focus(); } catch { /* ignore */ } },
    insertText(text) {
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      ta.value = (ta.value.slice(0, start) + text + ta.value.slice(end)).slice(0, 4000);
      const caret = Math.min(start + text.length, ta.value.length);
      try { ta.setSelectionRange(caret, caret); } catch { /* ignore */ }
    },
    input: ta,
    editable: () => el.style.display !== 'none' && form.style.display !== 'none',
  };
}
