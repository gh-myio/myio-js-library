/**
 * RFC-0152 Phase 4: Alarm Annotations Panel
 * Self-contained annotations panel for AlarmDetailsModal.
 * Inspired by AnnotationsTab (settings/annotations/AnnotationsTab.ts).
 */

// =====================================================================
// Types
// =====================================================================

export type AnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
export type ImportanceLevel = 1 | 2 | 3 | 4 | 5;

export interface AlarmAnnotation {
  id: string;
  text: string;
  type: AnnotationType;
  importance: ImportanceLevel;
  createdAt: string;
  createdBy: string;
  dueDate?: string;
  archived: boolean;
}

// =====================================================================
// Module-level store (persists across modal open/close within a session)
// =====================================================================

const _store = new Map<string, AlarmAnnotation[]>();

export function getActiveAnnotationCount(alarmId: string): number {
  return (_store.get(alarmId) ?? []).filter((a) => !a.archived).length;
}

export function getAlarmAnnotations(alarmId: string): AlarmAnnotation[] {
  return _store.get(alarmId) ?? [];
}

export function upsertAlarmAnnotation(alarmId: string, ann: AlarmAnnotation): void {
  const list = _store.get(alarmId) ?? [];
  const idx = list.findIndex((a) => a.id === ann.id);
  if (idx >= 0) list[idx] = ann;
  else list.unshift(ann);
  _store.set(alarmId, list);
}

export function archiveAlarmAnnotation(alarmId: string, annId: string): void {
  const list = _store.get(alarmId) ?? [];
  const ann = list.find((a) => a.id === annId);
  if (ann) ann.archived = true;
  _store.set(alarmId, list);
}

// =====================================================================
// Constants (mirrored from AnnotationsTab)
// =====================================================================

const TYPE_LABELS: Record<AnnotationType, string> = {
  observation: 'Observação',
  pending: 'Pendência',
  maintenance: 'Manutenção',
  activity: 'Atividade',
};

const TYPE_COLORS: Record<AnnotationType, string> = {
  observation: '#339af0',
  pending: '#ff6b6b',
  maintenance: '#ffa94d',
  activity: '#51cf66',
};

const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Normal',
  4: 'Alta',
  5: 'Muito Alta',
};

const IMPORTANCE_COLORS: Record<ImportanceLevel, string> = {
  1: '#74b9ff',
  2: '#81ecec',
  3: '#fdcb6e',
  4: '#fab1a0',
  5: '#ff7675',
};

const ORDERED_TYPES: AnnotationType[] = ['observation', 'pending', 'maintenance', 'activity'];

// =====================================================================
// Helpers
// =====================================================================

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

// =====================================================================
// Card renderer
// =====================================================================

function renderCard(ann: AlarmAnnotation): string {
  const tc = TYPE_COLORS[ann.type];
  const ic = IMPORTANCE_COLORS[ann.importance];
  const darkText = ann.importance >= 4;
  const stars = '★'.repeat(ann.importance) + '☆'.repeat(5 - ann.importance);
  const ini = initials(ann.createdBy);

  return `
    <div class="adm-annot-card${ann.archived ? ' adm-annot-card--archived' : ''}" data-ann-id="${ann.id}">
      <div class="adm-annot-card-header">
        <span class="adm-annot-type-badge" style="background:${tc}18;color:${tc};border:1px solid ${tc}40">${TYPE_LABELS[ann.type]}</span>
        <span class="adm-annot-imp-badge" style="background:${ic};color:${darkText ? '#fff' : '#333'}" title="${IMPORTANCE_LABELS[ann.importance]}">${stars}</span>
        ${ann.archived ? '<span class="adm-annot-archived-badge">Arquivada</span>' : ''}
      </div>
      <div class="adm-annot-card-text">${esc(ann.text)}</div>
      ${ann.dueDate ? `<div class="adm-annot-due">⏰ Prazo: ${new Date(ann.dueDate).toLocaleDateString('pt-BR')}</div>` : ''}
      <div class="adm-annot-card-meta">
        <div class="adm-annot-avatar">${ini}</div>
        <span class="adm-annot-author">${esc(ann.createdBy)}</span>
        <span class="adm-annot-date">${fmtDt(ann.createdAt)}</span>
      </div>
      ${
        !ann.archived
          ? `<div class="adm-annot-actions">
          <button type="button" class="adm-annot-btn adm-annot-btn--edit" data-ann-action="edit" data-ann-id="${ann.id}" title="Editar">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button type="button" class="adm-annot-btn adm-annot-btn--archive" data-ann-action="archive" data-ann-id="${ann.id}" title="Arquivar">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            Arquivar
          </button>
        </div>`
          : ''
      }
    </div>`;
}

// =====================================================================
// Form renderer
// =====================================================================

function renderForm(editAnn?: AlarmAnnotation): string {
  const defType: AnnotationType = editAnn?.type ?? 'observation';
  const defImp: ImportanceLevel = editAnn?.importance ?? 3;

  const typeHtml = ORDERED_TYPES.map(
    (t) =>
      `<button type="button" class="adm-annot-type-opt${t === defType ? ' is-active' : ''}" data-ann-type="${t}" style="--tc:${TYPE_COLORS[t]}">${TYPE_LABELS[t]}</button>`
  ).join('');

  const impHtml = ([1, 2, 3, 4, 5] as ImportanceLevel[]).map(
    (i) =>
      `<button type="button" class="adm-annot-imp-opt${i === defImp ? ' is-active' : ''}" data-ann-imp="${i}" style="--ic:${IMPORTANCE_COLORS[i]}" title="${IMPORTANCE_LABELS[i]}">${'★'.repeat(i)}</button>`
  ).join('');

  return `
    <div class="adm-annot-form" data-edit-id="${editAnn?.id ?? ''}">
      <div class="adm-annot-form-title">${editAnn ? '✏️ Editar Anotação' : '✏️ Nova Anotação'}</div>
      <textarea class="adm-annot-textarea" id="admAnnotText" maxlength="255"
        placeholder="Digite sua anotação (máx. 255 caracteres)...">${editAnn ? esc(editAnn.text) : ''}</textarea>
      <div class="adm-annot-char-count"><span id="admAnnotCC">${editAnn ? editAnn.text.length : 0}</span> / 255</div>
      <div class="adm-annot-form-row">
        <div class="adm-annot-form-field">
          <label class="adm-annot-form-label">Tipo</label>
          <div class="adm-annot-type-sel">${typeHtml}</div>
        </div>
      </div>
      <div class="adm-annot-form-row">
        <div class="adm-annot-form-field">
          <label class="adm-annot-form-label">Importância</label>
          <div class="adm-annot-imp-sel">${impHtml}</div>
        </div>
        <div class="adm-annot-form-field adm-annot-form-field--narrow">
          <label class="adm-annot-form-label">Prazo (opcional)</label>
          <input type="date" class="adm-annot-date-input" id="admAnnotDue"
            value="${editAnn?.dueDate?.substring(0, 10) ?? ''}">
        </div>
      </div>
      <div class="adm-annot-form-actions">
        <button type="button" class="adm-annot-form-btn adm-annot-form-btn--cancel" id="admAnnotCancel">Cancelar</button>
        <button type="button" class="adm-annot-form-btn adm-annot-form-btn--save" id="admAnnotSave"
          ${(editAnn?.text ?? '').trim().length === 0 ? 'disabled' : ''}>
          ${editAnn ? 'Salvar Alterações' : 'Criar Anotação'}
        </button>
      </div>
    </div>`;
}

// =====================================================================
// List HTML (active + archived)
// =====================================================================

function buildListHtml(alarmId: string): string {
  const all = _store.get(alarmId) ?? [];
  const active = all.filter((a) => !a.archived);
  const archived = all.filter((a) => a.archived);

  const activeHtml =
    active.length === 0
      ? `<div class="adm-annot-empty">
           <div class="adm-annot-empty-icon">📋</div>
           <div>Nenhuma anotação registrada.<br>Clique em <strong>Nova Anotação</strong> para começar.</div>
         </div>`
      : active.map(renderCard).join('');

  const archivedHtml =
    archived.length > 0
      ? `<details class="adm-annot-archived-section">
           <summary class="adm-annot-archived-summary">Arquivadas (${archived.length})</summary>
           <div class="adm-annot-archived-list">${archived.map(renderCard).join('')}</div>
         </details>`
      : '';

  return activeHtml + archivedHtml;
}

// =====================================================================
// Public: build panel HTML for template injection
// =====================================================================

export function buildAnnotationsPanelHtml(alarmId: string): string {
  const n = getActiveAnnotationCount(alarmId);
  return `
    <div class="adm-annot-toolbar">
      <span class="adm-annot-count" id="admAnnotCount">${n} anotaç${n !== 1 ? 'ões' : 'ão'}</span>
      <button type="button" class="adm-annot-create-btn" id="admAnnotNewBtn">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nova Anotação
      </button>
    </div>
    <div class="adm-annot-form-wrap" id="admAnnotFormWrap" style="display:none"></div>
    <div class="adm-annot-list" id="admAnnotList">${buildListHtml(alarmId)}</div>`;
}

// =====================================================================
// Public: bind interactive events after DOM is ready
// =====================================================================

export function bindAnnotationsPanelEvents(
  panel: HTMLElement,
  alarmId: string,
  currentUser: string,
  onCountChange: (n: number) => void
): void {
  const refresh = () => {
    const listEl = panel.querySelector<HTMLElement>('#admAnnotList');
    if (listEl) listEl.innerHTML = buildListHtml(alarmId);
    const n = (_store.get(alarmId) ?? []).filter((a) => !a.archived).length;
    const countEl = panel.querySelector<HTMLElement>('#admAnnotCount');
    if (countEl) countEl.textContent = `${n} anotaç${n !== 1 ? 'ões' : 'ão'}`;
    onCountChange(n);
    bindCardBtns();
  };

  const openForm = (editAnn?: AlarmAnnotation) => {
    const wrap = panel.querySelector<HTMLElement>('#admAnnotFormWrap');
    if (!wrap) return;
    wrap.innerHTML = renderForm(editAnn);
    wrap.style.display = 'block';
    bindFormBtns(editAnn);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const closeForm = () => {
    const wrap = panel.querySelector<HTMLElement>('#admAnnotFormWrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
  };

  const bindFormBtns = (editAnn?: AlarmAnnotation) => {
    const form = panel.querySelector<HTMLElement>('.adm-annot-form');
    if (!form) return;

    const ta = form.querySelector<HTMLTextAreaElement>('#admAnnotText')!;
    const cc = form.querySelector<HTMLElement>('#admAnnotCC')!;
    const saveBtn = form.querySelector<HTMLButtonElement>('#admAnnotSave')!;

    ta?.addEventListener('input', () => {
      if (cc) cc.textContent = String(ta.value.length);
      saveBtn.disabled = ta.value.trim().length === 0;
    });

    form.querySelectorAll<HTMLButtonElement>('[data-ann-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        form.querySelectorAll('[data-ann-type]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });

    form.querySelectorAll<HTMLButtonElement>('[data-ann-imp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        form.querySelectorAll('[data-ann-imp]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });

    form.querySelector('#admAnnotCancel')?.addEventListener('click', closeForm);

    saveBtn?.addEventListener('click', () => {
      const text = ta.value.trim();
      if (!text) return;
      const type = (form.querySelector<HTMLButtonElement>('[data-ann-type].is-active')?.dataset.annType ?? 'observation') as AnnotationType;
      const imp = parseInt(form.querySelector<HTMLButtonElement>('[data-ann-imp].is-active')?.dataset.annImp ?? '3') as ImportanceLevel;
      const dueDate = form.querySelector<HTMLInputElement>('#admAnnotDue')?.value || undefined;

      if (editAnn) {
        upsertAlarmAnnotation(alarmId, { ...editAnn, text, type, importance: imp, dueDate });
      } else {
        upsertAlarmAnnotation(alarmId, {
          id: uid(),
          text,
          type,
          importance: imp,
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          dueDate,
          archived: false,
        });
      }
      closeForm();
      refresh();
    });
  };

  const bindCardBtns = () => {
    panel.querySelectorAll<HTMLButtonElement>('[data-ann-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ann = (_store.get(alarmId) ?? []).find((a) => a.id === btn.dataset.annId);
        if (ann) openForm(ann);
      });
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-ann-action="archive"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        archiveAlarmAnnotation(alarmId, btn.dataset.annId!);
        closeForm();
        refresh();
      });
    });
  };

  // Toggle form on "Nova Anotação"
  panel.querySelector('#admAnnotNewBtn')?.addEventListener('click', () => {
    const wrap = panel.querySelector<HTMLElement>('#admAnnotFormWrap');
    const isOpen = wrap?.style.display !== 'none' && (wrap?.innerHTML ?? '') !== '';
    if (isOpen) closeForm(); else openForm();
  });

  bindCardBtns();
}
