/**
 * RFC-0207 Phase B — Device Classification Profile management modal.
 *
 * Premium UI to view/edit the customer-scoped `deviceClassificationProfile`
 * (SERVER_SCOPE attribute) that drives device classification (columns
 * Entrada/Lojas/Área Comum + breakdown Climatização/Elevadores/Escadas/Outros).
 *
 * - Edits the high-impact chip lists per group/category, per domain tab.
 * - Live preview: classifies the current devices with the working profile.
 * - Saves to the customer's SERVER_SCOPE attribute, applies it via
 *   `setActiveProfile`, and calls `onSaved` so the dashboard re-classifies.
 * - Permission-gated: `canEdit=false` → read-only (view saved/default values).
 *
 * Shell: uses the shared `ModalPremiumShell` (createModal) like the other
 * premium modals (AllReportModal/EnergyModal/DeviceReportModal) — standard
 * header + close, backdrop, focus trap, ESC, scroll lock. Only the body/footer
 * are bespoke (the editor + live preview).
 */

import { createModal, type ModalShellHandle } from '../internal/ModalPremiumShell';
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
  token?: string;
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
    token = (typeof localStorage !== 'undefined' && localStorage.getItem('jwt_token')) || '',
    tbBaseUrl = '',
    canEdit = false,
    getDevices = () => [],
    userName = 'user',
    onSaved,
    onClose,
  } = params;

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

  injectStyles();

  // Standard premium shell (backdrop, header + ×, focus trap, ESC, scroll lock).
  const handle: ModalShellHandle = createModal({
    title: '⚙️ Gestão de Perfil de Dispositivos',
    width: 'min(960px, 94vw)',
    theme: 'light',
  });
  const body = handle.element;
  handle.on('close', () => onClose?.());

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

    const groupRules = d.groups.rules.filter((r) => !r.fallback);
    const fallbackName = d.groups.rules.find((r) => r.fallback)?.name || 'área comum';
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
        <div class="mdp-editor">
          <h3 class="mdp-sec-title">Colunas (grupos)</h3>
          <div class="mdp-rule">
            <div class="mdp-rule-name">Ocultos <small>(padrões no deviceProfile, substring)</small></div>
            ${chipList('grp-ocultos', d.groups.ocultosProfilePatterns, ro)}
          </div>
          ${groupRules
            .map(
              (r, i) => `
          <div class="mdp-rule">
            <div class="mdp-rule-name">${escHtml(r.name)} <small>(deviceProfile exato)</small></div>
            ${chipList(`grp-${i}`, r.deviceProfiles || [], ro)}
          </div>`,
            )
            .join('')}
          <div class="mdp-rule mdp-rule-muted">
            <div class="mdp-rule-name">${escHtml(fallbackName)} <small>(residual — tudo que não casar acima)</small></div>
          </div>
          ${
            activeDomain === 'water'
              ? `<div class="mdp-note">💡 <b>banheiros</b> é preenchido pelo widget TELEMETRY (medidores de banheiro isolados), não por este perfil.</div>`
              : ''
          }

          ${
            cats
              ? `<h3 class="mdp-sec-title">Breakdown (categorias)</h3>
          <div class="mdp-rule">
            <div class="mdp-rule-name">Loja (store) <small>(deviceProfile exato)</small></div>
            ${chipList('cat-store', [cats.storeDeviceProfile], ro, true)}
          </div>
          ${cats.rules
            .map(
              (r, i) => `
          <div class="mdp-rule">
            <div class="mdp-rule-name">${escHtml(r.name)}</div>
            <div class="mdp-field"><label>deviceProfile</label>${chipList(`cat-${i}-dp`, r.deviceProfiles || [], ro)}</div>
            <div class="mdp-field"><label>texto contém</label>${chipList(`cat-${i}-cc`, r.combinedContains || [], ro)}</div>
            <div class="mdp-field"><label>identifier contém</label>${chipList(`cat-${i}-idc`, r.identifierFallback?.identifierContains || [], ro)}</div>
            <div class="mdp-field"><label>identifier prefixo</label>${chipList(`cat-${i}-idp`, r.identifierFallback?.identifierPrefixes || [], ro)}</div>
            ${
              r.conditional
                ? `<div class="mdp-cond">
              <div class="mdp-cond-hint">Condicional: entra só se o <b>deviceType</b> casar <b>E</b> o identifier casar.</div>
              <div class="mdp-field"><label>cond · deviceType</label>${chipList(`cat-${i}-cdt`, r.conditional.deviceTypes || [], ro)}</div>
              <div class="mdp-field"><label>cond · identifier contém</label>${chipList(`cat-${i}-cidc`, r.conditional.identifierContains || [], ro)}</div>
              <div class="mdp-field"><label>cond · identifier prefixo</label>${chipList(`cat-${i}-cidp`, r.conditional.identifierPrefixes || [], ro)}</div>
            </div>`
                : ''
            }
          </div>`,
            )
            .join('')}
          <div class="mdp-rule mdp-rule-muted">
            <div class="mdp-rule-name">${escHtml(cats.fallback?.name || 'outros')} <small>(residual)</small></div>
          </div>`
              : ''
          }
        </div>

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

  function renderFooter(): string {
    const ro = !canEdit;
    return `<div class="mdp-root mdp-footer-inner">
      <button id="mdp-cancel" class="mdp-btn mdp-btn-secondary">${ro ? 'Fechar' : 'Cancelar'}</button>
      ${ro ? '' : `<button id="mdp-save" class="mdp-btn mdp-btn-primary">Salvar perfil</button>`}
    </div>`;
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

  function refreshPreview() {
    const hasCats = !!dom()?.categories;
    const devices = (getDevices(activeDomain) || []).filter(Boolean);
    const groups: Record<string, number> = {};
    const cats: Record<string, number> = {};
    for (const d of devices) {
      const g = resolveGroup(d, working, activeDomain).group;
      groups[g] = (groups[g] || 0) + 1;
      if (hasCats) {
        const c = resolveCategory(d, working, activeDomain).category;
        cats[c] = (cats[c] || 0) + 1;
      }
    }
    // residual buckets per domain (highlight what fell through to the fallback)
    const residual = activeDomain === 'temperature' ? ['climatizavel'] : ['areacomum'];
    const gEl = body.querySelector('#mdp-preview-groups');
    const cEl = body.querySelector('#mdp-preview-cats');
    if (gEl) gEl.innerHTML = previewBlock('Colunas', groups, devices.length, residual);
    if (cEl)
      cEl.innerHTML = hasCats ? previewBlock('Breakdown', cats, devices.length, ['outros']) : '';

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
    total: number,
    residualKeys: string[],
  ): string {
    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => {
        const residual = residualKeys.includes(k);
        return `<div class="mdp-pv-row ${residual ? 'mdp-pv-residual' : ''}">
          <span>${escHtml(k)}</span><span>${n}</span></div>`;
      })
      .join('');
    return `<div class="mdp-pv">
      <div class="mdp-pv-title">${escHtml(title)} <small>(${total} devices)</small></div>
      ${rows || '<div class="mdp-pv-row mdp-pv-residual"><span>—</span><span>0</span></div>'}
    </div>`;
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
        const url = `${tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/SERVER_SCOPE`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
          body: JSON.stringify({ deviceClassificationProfile: toSave }),
        });
        if (!resp.ok) throw new Error(`TB ${resp.status}`);
        const applied = setActiveProfile(toSave);
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
  .mdp-pv-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 6px; border-radius: 5px; }
  .mdp-pv-row span:last-child { font-weight: 700; }
  .mdp-pv-residual { background: #fff7ed; color: #9a3412; }
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
