/**
 * Aba "Categorias" do painel 💲 Preços de Energia & Água (RFC-0081 no GCDR).
 *
 * Gestão das categorias de tarifa DO CUSTOMER (as globais, como COMMON_AREA /
 * SPECIFIC, não aparecem aqui): criar, renomear, ativar/desativar, excluir e
 * escolher quais devices pertencem a cada categoria. Um device tem no máximo uma
 * categoria (`devices.tariff_category` no GCDR): marcar um device que está em
 * outra categoria o move para esta.
 *
 * Excluir: lê o uso (`GET /tariff-categories/:key/usage`) e pede confirmação no
 * diálogo premium (`openConfirmDialog`), avisando quantas tarifas e devices serão
 * afetados. Em uso, o DELETE vai com `cascade=true`.
 */

import { openConfirmDialog } from '../premium-modals/dialog';
import {
  categoryKeyFromLabel,
  type GcdrDeviceSummary,
  type TariffApiClient,
  type WireTariffCategory,
} from './tariffApiClient';

export interface CategoriesTabOptions {
  /** Onde a aba desenha. */
  container: HTMLElement;
  client: Pick<
    TariffApiClient,
    | 'listCategories'
    | 'createCategory'
    | 'updateCategory'
    | 'deleteCategory'
    | 'getCategoryUsage'
    | 'listCustomerDevices'
    | 'setDeviceCategory'
  >;
  /** Customer GCDR selecionado no painel. */
  getCustomerId: () => string;
  /** Onde o diálogo de confirmação é montado (dentro do modal, para não ficar atrás). */
  dialogContainer?: HTMLElement;
  /** Avisado após criar/editar/excluir/associar (o painel recarrega o select e as tarifas). */
  onChanged?: () => void;
}

export interface CategoriesTabHandle {
  /** Recarrega categorias (e devices, se já carregados) do customer atual. */
  refresh(): Promise<void>;
}

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Mensagem amigável de um erro do GCDR (TariffApiError tem `code`). */
function errText(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code;
  const map: Record<string, string> = {
    TARIFF_CATEGORY_EXISTS: 'Já existe uma categoria com esse nome.',
    TARIFF_CATEGORY_IN_USE: 'A categoria está em uso (tarifas ou dispositivos) e o servidor recusou a exclusão.',
    TARIFF_CATEGORY_SYSTEM: 'Categoria do sistema não pode ser alterada.',
    TARIFF_CATEGORY_INACTIVE: 'Categoria inativa não recebe novos dispositivos.',
    TARIFF_CATEGORY_SCOPE: 'Categoria de outro cliente.',
  };
  return map[code || ''] || `${fallback}${code ? ` (${code})` : ''}`;
}

export function mountCategoriesTab(opts: CategoriesTabOptions): CategoriesTabHandle {
  const root = opts.container;
  let categories: WireTariffCategory[] = [];
  let devices: GcdrDeviceSummary[] | null = null; // carregados sob demanda
  let openKey: string | null = null; // categoria com o painel de devices aberto
  let editingKey: string | null = null;
  let busy = false;
  let notice: { kind: 'ok' | 'error'; text: string } | null = null;
  let loadError: string | null = null;
  let deviceFilter = '';
  /** Marcação pendente no painel de devices: deviceId → está nesta categoria? */
  let pending = new Map<string, boolean>();

  const customerId = () => opts.getCustomerId();
  const own = () => categories.filter((c) => c.customerId && c.customerId === customerId());
  const labelOf = (key: string | null) =>
    key ? categories.find((c) => c.key === key)?.label || key : '— sem categoria —';

  function deviceCount(key: string): number | null {
    return devices ? devices.filter((d) => d.tariffCategory === key).length : null;
  }

  function render(): void {
    const rows = own();
    root.innerHTML = `
      <div class="myio-pricing__cat" data-testid="categories-tab">
        <p class="myio-pricing__cat-hint">Categorias de tarifa deste cliente. Um dispositivo pertence a no máximo uma categoria.</p>
        <div class="myio-pricing__cat-new">
          <input class="myio-pricing__input" data-testid="cat-new-label" maxlength="120"
                 placeholder="Nome da nova categoria (ex.: Quiosques)" ${busy ? 'disabled' : ''} />
          <button class="myio-pricing__add myio-pricing__cat-btn" data-testid="cat-create" type="button" ${busy ? 'disabled' : ''}>Criar categoria</button>
        </div>
        ${
          notice
            ? `<div class="myio-pricing__cat-notice myio-pricing__cat-notice--${notice.kind}" data-testid="cat-notice" role="status">${esc(notice.text)}</div>`
            : ''
        }
        ${
          loadError
            ? `<div class="myio-pricing__cat-notice myio-pricing__cat-notice--error" data-testid="cat-load-error">${esc(loadError)}</div>`
            : rows.length === 0
              ? '<div class="myio-pricing__empty" data-testid="cat-empty">Nenhuma categoria própria deste cliente.</div>'
              : `<ul class="myio-pricing__list" data-testid="cat-list">${rows.map(rowHtml).join('')}</ul>`
        }
      </div>`;
    wire();
  }

  function rowHtml(c: WireTariffCategory): string {
    const n = deviceCount(c.key);
    const editing = editingKey === c.key;
    return `
      <li class="myio-pricing__cat-item" data-cat="${esc(c.key)}">
        <div class="myio-pricing__cat-row">
          <div class="myio-pricing__cat-main">
            ${
              editing
                ? `<input class="myio-pricing__input" data-testid="cat-edit-label" value="${esc(c.label)}" maxlength="120" />`
                : `<strong>${esc(c.label)}</strong>`
            }
            <small class="myio-pricing__cat-key">${esc(c.key)}</small>
            <span class="myio-pricing__badge${c.isActive === false ? ' myio-pricing__badge--off' : ''}">${
              c.isActive === false ? 'Inativa' : 'Ativa'
            }</span>
          </div>
          <div class="myio-pricing__cat-actions">
            ${
              editing
                ? `<button type="button" data-act="save-edit" data-key="${esc(c.key)}" ${busy ? 'disabled' : ''}>Salvar</button>
                   <button type="button" data-act="cancel-edit">Cancelar</button>`
                : `<button type="button" data-act="devices" data-key="${esc(c.key)}" data-testid="cat-devices">Dispositivos${
                    n == null ? '' : ` (${n})`
                  }</button>
                   <button type="button" data-act="edit" data-key="${esc(c.key)}" ${busy ? 'disabled' : ''}>Editar</button>
                   <button type="button" data-act="toggle" data-key="${esc(c.key)}" ${busy ? 'disabled' : ''}>${
                     c.isActive === false ? 'Ativar' : 'Desativar'
                   }</button>
                   <button type="button" class="myio-pricing__cat-danger" data-act="delete" data-key="${esc(c.key)}" data-testid="cat-delete" ${
                     busy ? 'disabled' : ''
                   }>Excluir</button>`
            }
          </div>
        </div>
        ${openKey === c.key ? devicesHtml(c) : ''}
      </li>`;
  }

  function devicesHtml(c: WireTariffCategory): string {
    if (devices === null) return '<div class="myio-pricing__cat-devices">Carregando dispositivos…</div>';
    const f = deviceFilter.trim().toLowerCase();
    const list = devices
      .filter((d) => !f || `${d.label || ''} ${d.name} ${d.identifier || ''}`.toLowerCase().includes(f))
      .sort((a, b) => {
        const ia = isIn(a, c.key) ? 0 : 1;
        const ib = isIn(b, c.key) ? 0 : 1;
        return ia - ib || (a.label || a.name).localeCompare(b.label || b.name);
      });
    const changed = [...pending.keys()].length;
    return `
      <div class="myio-pricing__cat-devices" data-testid="cat-devices-panel">
        <div class="myio-pricing__cat-devbar">
          <input class="myio-pricing__input" data-testid="cat-dev-filter" placeholder="Buscar dispositivo…" value="${esc(deviceFilter)}" />
          <button type="button" class="myio-pricing__add myio-pricing__cat-btn" data-act="save-devices" data-key="${esc(c.key)}"
                  data-testid="cat-dev-save" ${busy || changed === 0 || c.isActive === false ? 'disabled' : ''}>Salvar (${changed})</button>
        </div>
        ${c.isActive === false ? '<p class="myio-pricing__cat-hint">Categoria inativa: ative para incluir dispositivos.</p>' : ''}
        <ul class="myio-pricing__cat-devlist">${
          list.length
            ? list
                .map((d) => {
                  const checked = isIn(d, c.key);
                  const other = d.tariffCategory && d.tariffCategory !== c.key ? d.tariffCategory : null;
                  return `<li><label>
                    <input type="checkbox" data-dev="${esc(d.id)}" ${checked ? 'checked' : ''} ${busy ? 'disabled' : ''} />
                    <span>${esc(d.label || d.name)}</span>
                    ${d.identifier ? `<small>${esc(d.identifier)}</small>` : ''}
                    ${other ? `<small class="myio-pricing__cat-other">em ${esc(labelOf(other))}${checked ? ' → será movido' : ''}</small>` : ''}
                  </label></li>`;
                })
                .join('')
            : '<li class="myio-pricing__empty">Nenhum dispositivo.</li>'
        }</ul>
      </div>`;
  }

  /** Estado efetivo (pendente sobre o salvo). */
  function isIn(d: GcdrDeviceSummary, key: string): boolean {
    return pending.has(d.id) ? pending.get(d.id)! : d.tariffCategory === key;
  }

  function wire(): void {
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
    q<HTMLButtonElement>('[data-testid="cat-create"]')?.addEventListener('click', () => void create());
    q<HTMLInputElement>('[data-testid="cat-new-label"]')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') void create();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => void onAction(b.dataset.act!, b.dataset.key || ''))
    );
    const filter = q<HTMLInputElement>('[data-testid="cat-dev-filter"]');
    filter?.addEventListener('input', () => {
      deviceFilter = filter.value;
      const pos = filter.selectionStart;
      render();
      const again = root.querySelector<HTMLInputElement>('[data-testid="cat-dev-filter"]');
      again?.focus();
      if (again && pos != null) again.setSelectionRange(pos, pos);
    });
    root.querySelectorAll<HTMLInputElement>('input[data-dev]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const d = devices?.find((x) => x.id === cb.dataset.dev);
        if (!d || !openKey) return;
        const original = d.tariffCategory === openKey;
        if (cb.checked === original) pending.delete(d.id);
        else pending.set(d.id, cb.checked);
        render();
      })
    );
  }

  async function run(fn: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    notice = null;
    render();
    try {
      await fn();
    } finally {
      busy = false;
      render();
    }
  }

  async function create(): Promise<void> {
    const input = root.querySelector<HTMLInputElement>('[data-testid="cat-new-label"]');
    const label = (input?.value || '').trim();
    if (!label) {
      notice = { kind: 'error', text: 'Informe o nome da categoria.' };
      return render();
    }
    const key = categoryKeyFromLabel(label);
    if (!key) {
      notice = { kind: 'error', text: 'Nome inválido para gerar o código da categoria.' };
      return render();
    }
    await run(async () => {
      try {
        const maxSort = categories.reduce((m, c) => Math.max(m, Number(c.sortOrder) || 0), 0);
        await opts.client.createCategory({ key, label, customerId: customerId(), sortOrder: maxSort + 10, isActive: true });
        await reloadCategories();
        notice = { kind: 'ok', text: `Categoria "${label}" criada.` };
        opts.onChanged?.();
      } catch (err) {
        notice = { kind: 'error', text: errText(err, 'Não foi possível criar a categoria') };
      }
    });
  }

  async function onAction(act: string, key: string): Promise<void> {
    const cat = categories.find((c) => c.key === key);
    if (act === 'cancel-edit') {
      editingKey = null;
      return render();
    }
    if (act === 'edit') {
      editingKey = key;
      return render();
    }
    if (!cat && act !== 'cancel-edit') return;
    if (act === 'save-edit') {
      const label = (root.querySelector<HTMLInputElement>('[data-testid="cat-edit-label"]')?.value || '').trim();
      if (!label) {
        notice = { kind: 'error', text: 'Informe o nome da categoria.' };
        return render();
      }
      return run(async () => {
        try {
          await opts.client.updateCategory(key, { label });
          editingKey = null;
          await reloadCategories();
          notice = { kind: 'ok', text: 'Categoria atualizada.' };
          opts.onChanged?.();
        } catch (err) {
          notice = { kind: 'error', text: errText(err, 'Não foi possível salvar a categoria') };
        }
      });
    }
    if (act === 'toggle') {
      return run(async () => {
        try {
          await opts.client.updateCategory(key, { isActive: cat!.isActive === false });
          await reloadCategories();
          opts.onChanged?.();
        } catch (err) {
          notice = { kind: 'error', text: errText(err, 'Não foi possível alterar a categoria') };
        }
      });
    }
    if (act === 'devices') {
      openKey = openKey === key ? null : key;
      pending = new Map();
      deviceFilter = '';
      render();
      if (openKey && devices === null) await loadDevices();
      return;
    }
    if (act === 'save-devices') return saveDevices(key);
    if (act === 'delete') return remove(cat!);
  }

  async function remove(cat: WireTariffCategory): Promise<void> {
    let usage = { devices: 0, tariffs: 0 };
    try {
      usage = await opts.client.getCategoryUsage(cat.key);
    } catch (err) {
      notice = { kind: 'error', text: errText(err, 'Não foi possível verificar o uso da categoria') };
      return render();
    }
    const inUse = usage.devices > 0 || usage.tariffs > 0;
    const parts: string[] = [];
    if (usage.tariffs > 0) parts.push(`${usage.tariffs} tarifa(s) cadastrada(s) — serão apagadas`);
    if (usage.devices > 0) parts.push(`${usage.devices} dispositivo(s) — ficarão sem categoria`);
    const message = inUse
      ? `A categoria "${cat.label}" está em uso: ${parts.join('; ')}. Tem certeza que deseja excluir? Esta ação não pode ser desfeita.`
      : `Tem certeza que deseja excluir a categoria "${cat.label}"? Esta ação não pode ser desfeita.`;
    const choice = await openConfirmDialog({
      title: inUse ? '⚠️ Excluir Categoria' : 'Excluir Categoria',
      message,
      buttons: [
        { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
        { label: 'Excluir', value: 'confirm', variant: 'danger', autoFocus: true },
      ],
      container: opts.dialogContainer,
    });
    if (choice !== 'confirm') return;
    await run(async () => {
      try {
        await opts.client.deleteCategory(cat.key, { cascade: inUse });
        if (openKey === cat.key) openKey = null;
        await reloadCategories();
        if (devices) devices = devices.map((d) => (d.tariffCategory === cat.key ? { ...d, tariffCategory: null } : d));
        notice = { kind: 'ok', text: `Categoria "${cat.label}" excluída.` };
        opts.onChanged?.();
      } catch (err) {
        notice = { kind: 'error', text: errText(err, 'Não foi possível excluir a categoria') };
      }
    });
  }

  async function saveDevices(key: string): Promise<void> {
    if (!devices || pending.size === 0) return;
    const changes = [...pending.entries()];
    await run(async () => {
      const failed: string[] = [];
      for (const [id, inCat] of changes) {
        const d = devices!.find((x) => x.id === id);
        if (!d) continue;
        try {
          const target = inCat ? key : null;
          const updated = await opts.client.setDeviceCategory(id, target);
          d.tariffCategory = updated.id ? updated.tariffCategory : target;
          pending.delete(id);
        } catch (err) {
          failed.push(`${d.label || d.name}: ${errText(err, 'erro')}`);
        }
      }
      notice = failed.length
        ? { kind: 'error', text: `Não foi possível salvar ${failed.length} dispositivo(s): ${failed.join('; ')}` }
        : { kind: 'ok', text: `${changes.length} dispositivo(s) atualizado(s).` };
      opts.onChanged?.();
    });
  }

  async function reloadCategories(): Promise<void> {
    categories = await opts.client.listCategories(customerId(), { includeInactive: true });
  }

  async function loadDevices(): Promise<void> {
    try {
      devices = await opts.client.listCustomerDevices(customerId());
    } catch (err) {
      devices = [];
      notice = { kind: 'error', text: errText(err, 'Não foi possível carregar os dispositivos') };
    }
    render();
  }

  async function refresh(): Promise<void> {
    loadError = null;
    openKey = null;
    editingKey = null;
    pending = new Map();
    devices = null;
    root.innerHTML = '<div class="myio-pricing__empty">Carregando categorias…</div>';
    try {
      await reloadCategories();
    } catch (err) {
      categories = [];
      loadError = errText(err, 'Não foi possível carregar as categorias de tarifa do GCDR');
    }
    render();
    // contagem de devices por categoria (não bloqueia a lista)
    if (!loadError) void loadDevices();
  }

  return { refresh };
}
