/**
 * RFC-0207 Phase B — Device Classification Profile management modal.
 *
 * Premium UI to view/edit the customer-scoped `deviceClassificationProfile`
 * that drives device classification (columns Entrada/Lojas/Área Comum +
 * breakdown Climatização/Elevadores/Escadas/Outros).
 *
 * - Edits the high-impact chip lists per group/category, per domain tab.
 * - Live preview: classifies the current devices with the working profile.
 * - **RFC-0207 v3: the lib does NOT touch ThingsBoard.** On save it applies the
 *   profile in-memory (`setActiveProfile`) and delegates persistence to the
 *   caller via `onSave` — the profile JSON is stored in the **GCDR endpoint**
 *   (written by MAIN_VIEW, the persistence owner), then `onSaved` is called so
 *   the dashboard re-classifies.
 * - Permission-gated: `canEdit=false` → read-only (view saved/default values).
 *
 * Shell: uses the shared `ModalPremiumShell` (createModal) like the other
 * premium modals (AllReportModal/EnergyModal/DeviceReportModal) — standard
 * header + close, backdrop, focus trap, ESC, scroll lock. Only the body/footer
 * are bespoke (the editor + live preview).
 */

import { createModal, type ModalShellHandle } from '../internal/ModalPremiumShell';
import {
  createDivCard,
  type DivCardAccent,
  type DivCardHandle,
} from '../../div-card/DivCard';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  resolveGroup,
  resolveCategory,
  validateProfile,
  setActiveProfile,
  type DeviceClassificationProfile,
  type DomainProfile,
  type ClassificationDomain,
  type ClassifiableItem,
} from '../../../utils/deviceClassificationProfile';

const DOMAIN_TABS: { key: ClassificationDomain; label: string; icon: string }[] = [
  { key: 'energy', label: 'Energia', icon: '⚡' },
  { key: 'water', label: 'Água', icon: '💧' },
  { key: 'temperature', label: 'Temperatura', icon: '🌡️' },
];

const STYLE_ID = 'myio-device-profile-styles';
const ACCENT = '#7C3AED';

export interface DeviceProfilePreviewDevice extends ClassifiableItem {
  label?: string;
}

export interface OpenDeviceProfileModalParams {
  customerId: string;
  /**
   * @deprecated RFC-0207 v3: the lib never does ThingsBoard I/O. Persistence is
   * delegated to the caller via `onSave` (which writes to the GCDR store through
   * MAIN_VIEW). These are ignored — kept only for call-site backward-compat.
   */
  token?: string;
  /** @deprecated see `token`. */
  tbBaseUrl?: string;
  /** Current profile (defaults to the active/DEFAULT one). */
  profile?: DeviceClassificationProfile | null;
  /** When false the modal is read-only (no save). */
  canEdit?: boolean;
  /**
   * Returns the current devices for the live preview, for the given domain.
   * (Older callers that ignore the argument still work — they just preview the
   * same device set across tabs.)
   */
  getDevices?: (domain: ClassificationDomain) => DeviceProfilePreviewDevice[];
  /** Author recorded in the saved profile (`updatedBy`). */
  userName?: string;
  /**
   * Persistence callback — the caller writes the profile to the store (GCDR
   * endpoint via MAIN_VIEW). The lib does NOT touch ThingsBoard. May be async;
   * throwing surfaces an error in the modal. When omitted, the modal only applies
   * the profile in-memory (`setActiveProfile`) and warns (no persistence).
   */
  onSave?: (profile: DeviceClassificationProfile) => void | Promise<void>;
  /** Called after a successful save with the applied profile. */
  onSaved?: (profile: DeviceClassificationProfile) => void;
  onClose?: () => void;
}

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

export function openDeviceProfileModal(params: OpenDeviceProfileModalParams) {
  const {
    customerId,
    canEdit = false,
    getDevices = () => [],
    userName = 'user',
    onSave,
    onSaved,
    onClose,
  } = params;
  void customerId; // retained in the public params for call-site compat; not used for I/O

  // Working copy (never mutate the live profile until save)
  const working: DeviceClassificationProfile = deepClone(
    params.profile || DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  );
  working.domains = working.domains || ({} as DeviceClassificationProfile['domains']);
  // Seed any missing domain from DEFAULT so every tab is editable. A custom
  // profile that only overrode `energy` still gets editable water/temperature.
  if (!working.domains.energy) {
    working.domains.energy = deepClone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.energy);
  }
  if (!working.domains.water) {
    working.domains.water = deepClone(DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.water!);
  }
  if (!working.domains.temperature) {
    working.domains.temperature = deepClone(
      DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.temperature!,
    );
  }

  let activeDomain: ClassificationDomain = 'energy';
  const dom = (): DomainProfile | undefined => working.domains?.[activeDomain];

  // Collapse state persisted across body re-renders (chip edits rebuild the editor).
  const collapsedIds = new Set<string>();
  // Live DivCard instances mounted in the editor — destroyed before each re-mount.
  let cardHandles: DivCardHandle[] = [];
  // Card ids parallel to cardHandles (for expand-all / collapse-all).
  let cardIds: string[] = [];

  injectStyles();

  // Defensive: clear any orphaned DivCard maximize backdrop/card left in <body>
  // by a previous session (so a stale overlay never blanks the screen on open).
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.myio-divcard__backdrop').forEach((el) => el.remove());
    document.querySelectorAll('.myio-divcard.is-maximized').forEach((el) => {
      if (el.parentElement === document.body) el.remove();
    });
  }

  // Standard premium shell (backdrop, header + ×, focus trap, ESC, scroll lock).
  const handle: ModalShellHandle = createModal({
    title: 'Gestão de Perfil de Dispositivos',
    width: 'min(960px, 94vw)',
    theme: 'light',
    // Standard MyIO header (RFC-0121) — same bar as the MENU "Setup de Integração".
    useStandardHeader: true,
    icon: '⚙️',
    showMaximize: true,
  });
  const body = handle.element;
  // On close, destroy the DivCards so a maximized (portaled-to-body) card and its
  // backdrop don't leak into document.body and cover the screen on the next open.
  handle.on('close', () => {
    cardHandles.forEach((h) => h.destroy());
    cardHandles = [];
    onClose?.();
  });

  // Footer is stable across re-renders (only the editor body re-renders).
  handle.setFooter(renderFooter());
  bindFooter();

  rerenderBody();

  return { close: () => handle.close() };

  // ---------------------------------------------------------------- rendering

  function renderBody(): string {
    const d = dom();
    const ro = !canEdit;
    const tabs = DOMAIN_TABS.map(
      (t) =>
        `<button class="mdp-tab ${t.key === activeDomain ? 'is-active' : ''}" data-domain="${t.key}">${t.icon} ${t.label}</button>`,
    ).join('');

    if (!d) {
      return `<div class="mdp-root">
        <div class="mdp-tabs">${tabs}</div>
        <p class="mdp-empty">Domínio <code>${escHtml(activeDomain)}</code> ausente no perfil.</p>
      </div>`;
    }

    const cats = d.categories; // only energy has a breakdown

    return `<div class="mdp-root">
      <div class="mdp-tabs">${tabs}</div>
      <div class="mdp-subhead">
        ${
          ro
            ? `<span class="mdp-badge mdp-badge-ro">Somente leitura — sem permissão para editar</span>`
            : `<span class="mdp-badge mdp-badge-edit">Editável</span>`
        }
        <span class="mdp-hint">Define como cada device é classificado ${
          cats ? 'nas colunas e no breakdown' : 'nas colunas'
        } (domínio <b>${escHtml(activeDomain)}</b>).</span>
      </div>

      <div class="mdp-cols">
        <div class="mdp-editor"></div>

        <div class="mdp-preview">
          <h3 class="mdp-sec-title">Preview ao vivo</h3>
          <div class="mdp-hint mdp-hint-sm">Classificação dos devices atuais com este perfil.</div>
          <div id="mdp-preview-groups"></div>
          <div id="mdp-preview-cats"></div>
          <div id="mdp-errors" class="mdp-errors" style="display:none"></div>
        </div>
      </div>
    </div>`;
  }

  /**
   * Mounts the section DivCards (reusable createDivCard component) into the
   * string-rendered `.mdp-editor`. Chip/field bodies stay as HTML strings written
   * into each card's body slot. Collapse state persists via `collapsedIds`.
   */
  function mountCards(): void {
    cardHandles.forEach((h) => h.destroy());
    cardHandles = [];
    cardIds = [];
    const d = dom();
    const editor = body.querySelector('.mdp-editor') as HTMLElement | null;
    if (!d || !editor) return;
    const ro = !canEdit;
    const groupRules = d.groups.rules.filter((r) => !r.fallback);
    const fallbackName = d.groups.rules.find((r) => r.fallback)?.name || 'área comum';
    const cats = d.categories;

    // Toolbar: expand-all / collapse-all (operates on every mounted card).
    const toolbar = document.createElement('div');
    toolbar.className = 'mdp-toolbar';
    toolbar.innerHTML = `
      <button type="button" class="mdp-toolbtn" data-act="expand-all" title="Expandir todos os cards">⊕ Expandir tudo</button>
      <button type="button" class="mdp-toolbtn" data-act="collapse-all" title="Recolher todos os cards">⊖ Recolher tudo</button>`;
    toolbar
      .querySelector('[data-act="expand-all"]')
      ?.addEventListener('click', () => setAllCollapsed(false));
    toolbar
      .querySelector('[data-act="collapse-all"]')
      ?.addEventListener('click', () => setAllCollapsed(true));
    editor.appendChild(toolbar);

    const addCard = (
      id: string,
      opts: {
        title: string;
        accent: DivCardAccent;
        infoIcon?: string;
        infoHtml?: string;
        muted?: boolean;
      },
      bodyHtml: string,
    ) => {
      const card = createDivCard({
        ...opts,
        collapsed: collapsedIds.has(id),
        onToggle: (c) => (c ? collapsedIds.add(id) : collapsedIds.delete(id)),
      });
      card.body.innerHTML = bodyHtml;
      editor.appendChild(card.element);
      cardHandles.push(card);
      cardIds.push(id);
    };
    const sep = (text: string) => {
      const h = document.createElement('h3');
      h.className = 'mdp-sep-title';
      h.textContent = text;
      editor.appendChild(h);
    };

    sep('Colunas (grupos)');
    addCard(
      'grp-ocultos',
      {
        title: 'Ocultos',
        accent: 'rose',
        infoIcon: '🚫',
        infoHtml: cardInfoText(
          'Padrões (<b>substring</b>) no <b>deviceProfile</b> que marcam o device como Oculto (arquivado/inativo). Ex.: ARQUIVADO, SEM_DADOS.',
        ),
      },
      chipList('grp-ocultos', d.groups.ocultosProfilePatterns, ro),
    );
    groupRules.forEach((r, i) =>
      addCard(
        `grp-${i}`,
        {
          title: capitalize(r.name),
          accent: accentFor(r.name),
          infoIcon: '🏷️',
          infoHtml: cardInfoText(
            `Classificado como <b>${escHtml(r.name)}</b> quando o <b>deviceProfile</b> for exatamente um destes valores.`,
          ),
        },
        chipList(`grp-${i}`, r.deviceProfiles || [], ro),
      ),
    );
    addCard(
      'grp-fallback',
      { title: capitalize(fallbackName), accent: 'slate', muted: true },
      'Residual — tudo que não casar nas regras acima cai aqui.',
    );

    if (activeDomain === 'water') {
      const note = document.createElement('div');
      note.className = 'mdp-note';
      note.innerHTML =
        '💡 <b>banheiros</b> é preenchido pelo widget TELEMETRY (medidores de banheiro isolados), não por este perfil.';
      editor.appendChild(note);
    }

    if (cats) {
      sep('Breakdown (categorias)');
      addCard(
        'cat-store',
        {
          title: 'Loja (store)',
          accent: 'emerald',
          infoIcon: '🏪',
          infoHtml: cardInfoText('Loja: <b>deviceProfile</b> exatamente igual a este valor (atalho de loja).'),
        },
        chipList('cat-store', [cats.storeDeviceProfile], ro, true),
      );
      cats.rules.forEach((r, i) =>
        addCard(
          `cat-${i}`,
          {
            title: capitalize(r.name),
            accent: accentFor(r.name),
            infoIcon: '🔧',
            infoHtml: cardInfoText(
              `Breakdown <b>${escHtml(r.name)}</b> (precedência): 1) deviceProfile exato; 2) identifier contém/prefixo.`,
            ),
          },
          `
            <div class="mdp-field"><label>deviceProfile</label>${chipList(`cat-${i}-dp`, r.deviceProfiles || [], ro)}</div>
            <div class="mdp-field"><label>identifier contém</label>${chipList(`cat-${i}-idc`, r.identifierFallback?.identifierContains || [], ro)}</div>
            <div class="mdp-field"><label>identifier prefixo</label>${chipList(`cat-${i}-idp`, r.identifierFallback?.identifierPrefixes || [], ro)}</div>`,
        ),
      );
      addCard(
        'cat-fallback',
        { title: capitalize(cats.fallback?.name || 'outros'), accent: 'slate', muted: true },
        'Residual — devices que não casam em nenhuma categoria acima.',
      );
    }
  }

  function renderFooter(): string {
    const ro = !canEdit;
    return `<div class="mdp-root mdp-footer-inner">
      <button id="mdp-cancel" class="mdp-btn mdp-btn-secondary">${ro ? 'Fechar' : 'Cancelar'}</button>
      ${ro ? '' : `<button id="mdp-save" class="mdp-btn mdp-btn-primary">Salvar perfil</button>`}
    </div>`;
  }

  function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function cardInfoText(html: string): string {
    return `<div style="max-width:320px;font-size:13px;line-height:1.5">${html}</div>`;
  }

  function accentFor(name: string): DivCardAccent {
    const n = String(name).toLowerCase();
    if (n === 'ocultos') return 'rose';
    if (n === 'entrada' || n === 'caixadagua') return 'sky';
    if (n === 'climatizacao' || n === 'climatizavel') return 'violet';
    if (n === 'nao_climatizavel') return 'slate';
    if (n === 'elevadores' || n === 'escadas_rolantes') return 'amber';
    if (n === 'store' || n === 'loja') return 'emerald';
    return 'blue'; // lojas + default
  }

  function chipList(key: string, values: string[], readOnly: boolean, single = false): string {
    const chips = (values || [])
      .filter((v) => v != null && v !== '')
      .map(
        (v) => `<span class="mdp-chip" data-val="${escHtml(v)}">${escHtml(v)}${
          readOnly ? '' : `<button class="mdp-chip-x" data-key="${key}" data-val="${escHtml(v)}" aria-label="remover">×</button>`
        }</span>`,
      )
      .join('');
    const adder = readOnly || (single && (values || []).filter(Boolean).length >= 1)
      ? ''
      : `<input class="mdp-chip-input" data-key="${key}" type="text" placeholder="+ adicionar" />`;
    return `<div class="mdp-chips" data-key="${key}">${chips}${adder}</div>`;
  }

  // ---------------------------------------------------------------- editing

  function listFor(key: string): string[] | null {
    const d = dom();
    if (!d) return null;
    if (key === 'grp-ocultos') return d.groups.ocultosProfilePatterns;
    if (key === 'cat-store') {
      // single value modeled specially in add/removeValue
      return null;
    }
    let m = key.match(/^grp-(\d+)$/);
    if (m) {
      const rule = d.groups.rules.filter((r) => !r.fallback)[Number(m[1])];
      return (rule.deviceProfiles = rule.deviceProfiles || []);
    }
    // cat-* keys only ever render on the energy tab (only energy has categories)
    const cats = d.categories;
    if (!cats) return null;
    m = key.match(/^cat-(\d+)-(dp|cc|idc|idp)$/);
    if (m) {
      const rule = cats.rules[Number(m[1])];
      if (m[2] === 'dp') return (rule.deviceProfiles = rule.deviceProfiles || []);
      if (m[2] === 'cc') return (rule.combinedContains = rule.combinedContains || []);
      rule.identifierFallback = rule.identifierFallback || {};
      if (m[2] === 'idc')
        return (rule.identifierFallback.identifierContains = rule.identifierFallback.identifierContains || []);
      if (m[2] === 'idp')
        return (rule.identifierFallback.identifierPrefixes = rule.identifierFallback.identifierPrefixes || []);
    }
    m = key.match(/^cat-(\d+)-(cdt|cidc|cidp)$/);
    if (m) {
      const rule = cats.rules[Number(m[1])];
      rule.conditional = rule.conditional || { deviceTypes: [] };
      if (m[2] === 'cdt') return (rule.conditional.deviceTypes = rule.conditional.deviceTypes || []);
      if (m[2] === 'cidc')
        return (rule.conditional.identifierContains = rule.conditional.identifierContains || []);
      if (m[2] === 'cidp')
        return (rule.conditional.identifierPrefixes = rule.conditional.identifierPrefixes || []);
    }
    return null;
  }

  function addValue(key: string, raw: string) {
    const v = raw.trim().toUpperCase();
    const d = dom();
    if (!v || !d) return;
    if (key === 'cat-store') {
      if (d.categories) d.categories.storeDeviceProfile = v;
    } else {
      const list = listFor(key);
      if (!list) return;
      if (!list.includes(v)) list.push(v);
    }
    rerenderBody();
  }

  function removeValue(key: string, val: string) {
    const d = dom();
    if (!d) return;
    if (key === 'cat-store') {
      if (d.categories) d.categories.storeDeviceProfile = '';
    } else {
      const list = listFor(key);
      if (!list) return;
      const idx = list.indexOf(val);
      if (idx >= 0) list.splice(idx, 1);
    }
    rerenderBody();
  }

  function rerenderBody() {
    handle.setContent(renderBody());
    mountCards(); // build the DivCard sections into .mdp-editor (before chip binding)
    bindTabs();
    bindChipEditors();
    refreshPreview();
  }

  function bindTabs() {
    body.querySelectorAll<HTMLButtonElement>('.mdp-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const next = tab.dataset.domain as ClassificationDomain;
        if (!next || next === activeDomain) return;
        activeDomain = next;
        rerenderBody();
      });
    });
  }

  function bindChipEditors() {
    if (!canEdit) return;
    body.querySelectorAll<HTMLInputElement>('.mdp-chip-input').forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addValue(inp.dataset.key!, inp.value);
        }
      });
      inp.addEventListener('blur', () => {
        if (inp.value.trim()) addValue(inp.dataset.key!, inp.value);
      });
    });
    body.querySelectorAll<HTMLButtonElement>('.mdp-chip-x').forEach((btn) => {
      btn.addEventListener('click', () => removeValue(btn.dataset.key!, btn.dataset.val!));
    });
  }

  // ---------------------------------------------------------------- preview

  /** Expand (false) or collapse (true) every mounted card; persists the state. */
  function setAllCollapsed(collapsed: boolean): void {
    if (collapsed) cardIds.forEach((id) => collapsedIds.add(id));
    else collapsedIds.clear();
    cardHandles.forEach((h) => h.setCollapsed(collapsed));
  }

  function refreshPreview() {
    const hasCats = !!dom()?.categories;
    const devices = (getDevices(activeDomain) || []).filter(Boolean);
    const groups: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const groupDevices: Record<string, string[]> = {};
    const catDevices: Record<string, string[]> = {};
    for (const d of devices) {
      const g = resolveGroup(d, working, activeDomain).group;
      groups[g] = (groups[g] || 0) + 1;
      (groupDevices[g] ||= []).push(deviceLabel(d));
      if (hasCats) {
        const c = resolveCategory(d, working, activeDomain).category;
        cats[c] = (cats[c] || 0) + 1;
        (catDevices[c] ||= []).push(deviceLabel(d));
      }
    }
    // residual buckets per domain (highlight what fell through to the fallback)
    const residual = activeDomain === 'temperature' ? ['climatizavel'] : ['areacomum'];
    const gEl = body.querySelector('#mdp-preview-groups');
    const cEl = body.querySelector('#mdp-preview-cats');
    if (gEl) gEl.innerHTML = previewBlock('Colunas', groups, groupDevices, devices.length, residual);
    if (cEl)
      cEl.innerHTML = hasCats
        ? previewBlock('Breakdown', cats, catDevices, devices.length, ['outros'])
        : '';

    const errors = dom() ? validateProfile(working) : ['profile inválido'];
    const errEl = body.querySelector('#mdp-errors') as HTMLElement | null;
    const saveBtn = document.getElementById('mdp-save') as HTMLButtonElement | null;
    if (errEl) {
      if (errors.length) {
        errEl.style.display = '';
        errEl.innerHTML =
          '<strong>Validação:</strong><ul>' + errors.map((e) => `<li>${escHtml(e)}</li>`).join('') + '</ul>';
      } else {
        errEl.style.display = 'none';
      }
    }
    if (saveBtn) saveBtn.disabled = errors.length > 0;
  }

  function previewBlock(
    title: string,
    counts: Record<string, number>,
    deviceMap: Record<string, string[]>,
    total: number,
    residualKeys: string[],
  ): string {
    const MAX_LIST = 60; // cap the popover list; show "+N mais" beyond this
    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const residual = residualKeys.includes(k);
        const list = deviceMap[k] || [];
        // (i)/"+" info popover listing the devices inside this group/category —
        // mirrors the TELEMETRY_INFO (i) breakdown ("produtos dentro").
        let info = '';
        if (list.length) {
          const shown = list
            .slice(0, MAX_LIST)
            .map((name) => `<li>${escHtml(name)}</li>`)
            .join('');
          const more =
            list.length > MAX_LIST
              ? `<li class="mdp-pv-more">+${list.length - MAX_LIST} mais</li>`
              : '';
          info = `<span class="mdp-pv-info" tabindex="0" role="button" aria-label="Ver dispositivos de ${escHtml(
            k,
          )}">+
            <span class="mdp-pv-pop">
              <span class="mdp-pv-pop-title">${escHtml(k)} · ${n}</span>
              <ul>${shown}${more}</ul>
            </span>
          </span>`;
        }
        return `<div class="mdp-pv-row ${residual ? 'mdp-pv-residual' : ''}">
          <span class="mdp-pv-name">${escHtml(k)}</span>
          <span class="mdp-pv-meta"><span class="mdp-pv-count">${n}</span>${info}</span>
        </div>`;
      })
      .join('');
    return `<div class="mdp-pv">
      <div class="mdp-pv-title">${escHtml(title)} <small>(${total} devices)</small></div>
      ${
        rows ||
        '<div class="mdp-pv-row mdp-pv-residual"><span class="mdp-pv-name">—</span><span class="mdp-pv-meta"><span class="mdp-pv-count">0</span></span></div>'
      }
    </div>`;
  }

  /** Best display label for a preview device. */
  function deviceLabel(d: DeviceProfilePreviewDevice): string {
    return (
      d.label ||
      (d as { name?: string }).name ||
      (d as { identifier?: string }).identifier ||
      (d as { id?: string }).id ||
      '—'
    );
  }

  // ---------------------------------------------------------------- footer / save

  function bindFooter() {
    document.getElementById('mdp-cancel')?.addEventListener('click', () => handle.close());

    if (!canEdit) return;
    const btn = document.getElementById('mdp-save') as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const errors = validateProfile(working);
      if (errors.length) {
        refreshPreview();
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Salvando…';
      try {
        // updatedAt/updatedBy are additive JSON metadata (not in the type) — keep
        // them at runtime via an assertion so the saved attribute carries the audit.
        const toSave = {
          ...working,
          updatedAt: new Date().toISOString(),
          updatedBy: userName,
        } as DeviceClassificationProfile;
        // RFC-0207 v3: the lib never writes to ThingsBoard. Persistence is delegated
        // to the caller (which stores the JSON in the GCDR endpoint via MAIN_VIEW).
        if (onSave) {
          await onSave(toSave);
        } else {
          console.warn(
            '[openDeviceProfileModal] no onSave provided — applying in-memory only, NOT persisted',
          );
        }
        const applied = setActiveProfile(toSave); // in-memory only (pure)
        onSaved?.(applied);
        handle.close();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Salvar perfil';
        const errEl = body.querySelector('#mdp-errors') as HTMLElement | null;
        if (errEl) {
          errEl.style.display = '';
          errEl.innerHTML = `<strong>Erro ao salvar:</strong> ${escHtml((err as Error).message)}`;
        }
      }
    });
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  // Only the bespoke body/footer content is styled here — the shell
  // (ModalPremiumShell) provides backdrop, header, body container and footer.
  s.textContent = `
  .mdp-root, .mdp-root * { box-sizing: border-box; font-family: 'Nunito', sans-serif; }
  .mdp-tabs { display: flex; gap: 4px; margin-bottom: 10px; border-bottom: 1px solid #eee; }
  .mdp-tab { border: 1px solid transparent; border-bottom: none; background: none; cursor: pointer;
    font-size: 13px; font-weight: 700; color: #64748b; padding: 8px 14px; border-radius: 8px 8px 0 0; }
  .mdp-tab:hover { color: ${ACCENT}; }
  .mdp-tab.is-active { color: ${ACCENT}; background: #faf9ff; border-color: #ede9fe; border-bottom: 1px solid #faf9ff; margin-bottom: -1px; }
  .mdp-note { font-size: 11px; color: #6d28d9; background: #faf9ff; border: 1px dashed #ddd6fe;
    border-radius: 8px; padding: 8px 10px; margin: 4px 0 8px; }
  .mdp-subhead { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #eee; }
  .mdp-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .mdp-badge-ro { background: #fef3c7; color: #92400e; }
  .mdp-badge-edit { background: #ede9fe; color: ${ACCENT}; }
  .mdp-hint { font-size: 12px; color: #64748b; }
  .mdp-hint-sm { font-size: 11px; }
  .mdp-cols { display: grid; grid-template-columns: 1fr 300px; gap: 18px; }
  @media (max-width: 720px) { .mdp-cols { grid-template-columns: 1fr; } }
  .mdp-sec-title { font-size: 13px; font-weight: 800; color: #1e293b; margin: 6px 0 8px; }
  .mdp-sep-title { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; margin: 8px 0 6px; }
  .mdp-toolbar { display: flex; gap: 6px; justify-content: flex-end; margin-bottom: 8px; }
  .mdp-toolbtn { font-family: inherit; font-size: 11px; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 7px; padding: 5px 10px; cursor: pointer; transition: background .15s, color .15s; }
  .mdp-toolbtn:hover { background: #e2e8f0; color: ${ACCENT}; }
  .mdp-rule { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
  .mdp-rule-muted { background: #f8fafc; color: #94a3b8; }
  .mdp-rule-name { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; }
  .mdp-rule-name small { font-weight: 500; color: #94a3b8; }
  .mdp-field { margin-top: 6px; }
  .mdp-field label { display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
  .mdp-cond { margin-top: 8px; padding: 8px 10px; border-left: 3px solid #c4b5fd; background: #faf9ff; border-radius: 6px; }
  .mdp-cond-hint { font-size: 11px; color: #6d28d9; margin-bottom: 6px; }
  .mdp-chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .mdp-chip { display: inline-flex; align-items: center; gap: 4px; background: #f1f5f9; border: 1px solid #cbd5e1;
    border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: 600; color: #334155; }
  .mdp-chip-x { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 13px; line-height: 1; padding: 0; }
  .mdp-chip-x:hover { color: #dc2626; }
  .mdp-chip-input { border: 1px dashed #cbd5e1; border-radius: 12px; padding: 2px 8px; font-size: 11px; width: 110px; outline: none; }
  .mdp-chip-input:focus { border-color: ${ACCENT}; }
  .mdp-preview { background: #faf9ff; border: 1px solid #ede9fe; border-radius: 10px; padding: 12px; height: fit-content; position: sticky; top: 0; }
  .mdp-pv { margin-bottom: 12px; }
  .mdp-pv-title { font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 6px; }
  .mdp-pv-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; padding: 3px 6px; border-radius: 5px; }
  .mdp-pv-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mdp-pv-meta { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .mdp-pv-count { font-weight: 700; }
  .mdp-pv-residual { background: #fff7ed; color: #9a3412; }
  /* (i)/"+" info popover — devices inside this group/category */
  .mdp-pv-info {
    position: relative; display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; cursor: pointer;
    background: ${ACCENT}; color: #fff; font-size: 12px; font-weight: 700; line-height: 1;
    user-select: none;
  }
  .mdp-pv-info:hover, .mdp-pv-info:focus-visible { filter: brightness(.92); outline: none; }
  .mdp-pv-pop {
    position: absolute; right: 0; top: 22px; z-index: 50;
    display: none; width: 240px; max-height: 280px; overflow-y: auto;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0,0,0,.18); padding: 8px 10px; text-align: left;
    cursor: default;
  }
  .mdp-pv-info:hover .mdp-pv-pop, .mdp-pv-info:focus .mdp-pv-pop, .mdp-pv-info:focus-within .mdp-pv-pop { display: block; }
  .mdp-pv-pop-title { display: block; font-size: 11px; font-weight: 800; color: #1e293b; margin-bottom: 6px; }
  .mdp-pv-pop ul { list-style: none; margin: 0; padding: 0; }
  .mdp-pv-pop li { font-size: 11px; color: #475569; padding: 2px 0; border-bottom: 1px solid #f1f5f9; white-space: normal; word-break: break-word; }
  .mdp-pv-pop li:last-child { border-bottom: none; }
  .mdp-pv-pop .mdp-pv-more { color: #94a3b8; font-style: italic; }
  .mdp-errors { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #991b1b; margin-top: 8px; }
  .mdp-errors ul { margin: 4px 0 0 16px; }
  .mdp-footer-inner { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .mdp-btn { padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
  .mdp-btn-secondary { background: #e2e8f0; color: #334155; }
  .mdp-btn-primary { background: ${ACCENT}; color: #fff; }
  .mdp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .mdp-empty { color: #94a3b8; font-size: 13px; }
  `;
  document.head.appendChild(s);
}
