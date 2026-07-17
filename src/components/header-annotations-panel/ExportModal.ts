/**
 * RFC-0203 M7 — Export modal (AC-39).
 *
 * Small modal dialog with format radio (PDF/CSV), level checkboxes (PDF only),
 * scope radio (current-tab / all / filtered). Triggers `onExport(opts)` when
 * the user confirms. No external dependencies; rendered into document.body.
 */

import type { AnnotationExportOptions } from '../../services/annotations/types';
import type { PdfLevel } from './ExportPDF';

export interface OpenExportModalOptions {
  /** Whether the user has filters/search active (enables the "filtered" scope). */
  hasActiveFilter: boolean;
  /** Called when the user confirms. */
  onExport: (opts: AnnotationExportOptions) => void;
  /** Optional logger; defaults to console. */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

const MODAL_DOM_ID = 'myio-annotations-export-modal';
const STYLES_ID = 'myio-annotations-export-modal-styles';

const STYLES = `
.${MODAL_DOM_ID}-backdrop {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center;
  animation: myio-anno-export-fade 0.12s ease-out;
}
@keyframes myio-anno-export-fade {
  from { opacity: 0; } to { opacity: 1; }
}
.${MODAL_DOM_ID} {
  width: min(420px, 92vw);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.3);
  padding: 18px 20px;
  font-family: 'Nunito', system-ui, sans-serif;
  color: #1e293b;
}
.${MODAL_DOM_ID} .${MODAL_DOM_ID}__title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 700;
  color: #4c3aac;
}
.${MODAL_DOM_ID} fieldset {
  border: none;
  margin: 0 0 12px 0;
  padding: 0;
}
.${MODAL_DOM_ID} legend {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.${MODAL_DOM_ID} label {
  display: block;
  font-size: 13px;
  padding: 3px 0;
  cursor: pointer;
}
.${MODAL_DOM_ID} input[type="radio"],
.${MODAL_DOM_ID} input[type="checkbox"] {
  margin-right: 6px;
  accent-color: #6c5ce7;
}
.${MODAL_DOM_ID} input[disabled] + span { color: #94a3b8; }
.${MODAL_DOM_ID}-actions {
  display: flex; gap: 8px; justify-content: flex-end;
  margin-top: 8px;
}
.${MODAL_DOM_ID}-actions button {
  font: inherit; font-size: 13px; font-weight: 600;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.${MODAL_DOM_ID}-cancel {
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #475569;
}
.${MODAL_DOM_ID}-confirm {
  background: #6c5ce7;
  border: 1px solid #6c5ce7;
  color: #fff;
}
.${MODAL_DOM_ID}-confirm:disabled {
  background: #cbd5e1; border-color: #cbd5e1; cursor: not-allowed;
}
`;

function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLES_ID)) return;
  const el = document.createElement('style');
  el.id = STYLES_ID;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

/** Track the open modal so a second open() replaces the first cleanly. */
let _activeBackdrop: HTMLDivElement | null = null;

/**
 * Open the export modal. Returns a cleanup function that closes it.
 */
export function openExportModal(options: OpenExportModalOptions): () => void {
  injectStyles();
  closeExportModal(); // remove any prior

  const backdrop = document.createElement('div');
  backdrop.className = `${MODAL_DOM_ID}-backdrop`;
  backdrop.setAttribute('role', 'presentation');

  backdrop.innerHTML = `
<div class="${MODAL_DOM_ID}" role="dialog" aria-modal="true" aria-labelledby="${MODAL_DOM_ID}-title">
  <div class="${MODAL_DOM_ID}__title" id="${MODAL_DOM_ID}-title" role="heading" aria-level="3">Exportar anotações</div>

  <fieldset>
    <legend>Formato</legend>
    <label><input type="radio" name="fmt" value="pdf" checked /><span>PDF</span></label>
    <label><input type="radio" name="fmt" value="csv" /><span>CSV</span></label>
  </fieldset>

  <fieldset data-fmt-pdf-only>
    <legend>Níveis (PDF apenas)</legend>
    <label><input type="checkbox" name="lvl-summary" checked /><span>Sumário (totais + KPIs)</span></label>
    <label><input type="checkbox" name="lvl-consolidated" checked /><span>Consolidado (por device)</span></label>
    <label><input type="checkbox" name="lvl-detailed" /><span>Detalhado (anotação por anotação)</span></label>
  </fieldset>

  <fieldset>
    <legend>Escopo</legend>
    <label><input type="radio" name="scope" value="current-tab" checked /><span>Aba atual</span></label>
    <label><input type="radio" name="scope" value="all" /><span>Todas as anotações</span></label>
    <label><input type="radio" name="scope" value="filtered" ${options.hasActiveFilter ? '' : 'disabled'} /><span>Resultado filtrado / buscado</span></label>
  </fieldset>

  <div class="${MODAL_DOM_ID}-actions">
    <button type="button" class="${MODAL_DOM_ID}-cancel">Cancelar</button>
    <button type="button" class="${MODAL_DOM_ID}-confirm">Exportar</button>
  </div>
</div>
`;

  document.body.appendChild(backdrop);
  _activeBackdrop = backdrop;

  const modal = backdrop.querySelector<HTMLDivElement>(`.${MODAL_DOM_ID}`)!;
  const fmtPdfOnly = modal.querySelector<HTMLFieldSetElement>('[data-fmt-pdf-only]');
  const confirmBtn = modal.querySelector<HTMLButtonElement>(`.${MODAL_DOM_ID}-confirm`)!;
  const cancelBtn = modal.querySelector<HTMLButtonElement>(`.${MODAL_DOM_ID}-cancel`)!;

  // Toggle PDF-only fieldset visibility based on format
  const fmtRadios = Array.from(modal.querySelectorAll<HTMLInputElement>('input[name="fmt"]'));
  const updatePdfFieldset = (): void => {
    const isPdf = fmtRadios.find((r) => r.checked)?.value === 'pdf';
    if (fmtPdfOnly) {
      const inputs = Array.from(fmtPdfOnly.querySelectorAll<HTMLInputElement>('input'));
      inputs.forEach((i) => {
        i.disabled = !isPdf;
      });
      fmtPdfOnly.style.opacity = isPdf ? '1' : '0.5';
    }
    // Enable confirm only if PDF has at least one level checked or CSV is chosen
    const enabled =
      !isPdf ||
      modal.querySelector<HTMLInputElement>('input[name="lvl-summary"]')?.checked ||
      modal.querySelector<HTMLInputElement>('input[name="lvl-consolidated"]')?.checked ||
      modal.querySelector<HTMLInputElement>('input[name="lvl-detailed"]')?.checked;
    confirmBtn.disabled = !enabled;
  };

  fmtRadios.forEach((r) => r.addEventListener('change', updatePdfFieldset));
  modal
    .querySelectorAll<HTMLInputElement>('input[name^="lvl-"]')
    .forEach((cb) => cb.addEventListener('change', updatePdfFieldset));
  updatePdfFieldset();

  // Cancel / backdrop click / Esc close
  const close = (): void => closeExportModal();
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  const onEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      close();
      window.removeEventListener('keydown', onEsc);
    }
  };
  window.addEventListener('keydown', onEsc);

  // Confirm
  confirmBtn.addEventListener('click', () => {
    const fmt = fmtRadios.find((r) => r.checked)?.value as 'pdf' | 'csv';
    const scope = (
      modal.querySelector<HTMLInputElement>('input[name="scope"]:checked')?.value ?? 'current-tab'
    ) as AnnotationExportOptions['scope'];
    const levels: PdfLevel[] = [];
    if (fmt === 'pdf') {
      if (modal.querySelector<HTMLInputElement>('input[name="lvl-summary"]')?.checked) levels.push('summary');
      if (modal.querySelector<HTMLInputElement>('input[name="lvl-consolidated"]')?.checked) levels.push('consolidated');
      if (modal.querySelector<HTMLInputElement>('input[name="lvl-detailed"]')?.checked) levels.push('detailed');
    }
    const opts: AnnotationExportOptions = {
      format: fmt,
      levels: fmt === 'pdf' ? levels : undefined,
      scope,
    };
    try {
      options.onExport(opts);
    } catch (err) {
      (options.logger ?? console).warn('[ExportModal] onExport threw:', err);
    }
    close();
  });

  // Initial focus
  setTimeout(() => {
    const focusable = modal.querySelector<HTMLInputElement>('input[name="fmt"]:checked');
    focusable?.focus();
  }, 0);

  return close;
}

export function closeExportModal(): void {
  if (_activeBackdrop && _activeBackdrop.parentNode) {
    _activeBackdrop.parentNode.removeChild(_activeBackdrop);
  }
  _activeBackdrop = null;
}
