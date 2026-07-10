/**
 * MYIO Goals Panel Component — GCDR Customer Consumption Goals (RFC-0046)
 *
 * A vanilla-JS modal faithful to the GCDR frontend `CustomerGoalsTab.tsx`:
 *   - read-only summary dashboard (default view)
 *   - drill editor MONTH → DAY → HOUR (breadcrumb navigation)
 *   - CSV import modal (stateless dry-run preview → persist)
 *   - version-history timeline (one node per operation)
 *
 * Metas now live in GCDR (not ThingsBoard attributes). This component talks to
 * the GCDR API (`/api/v1/customers/:id/goals`) for both reads and writes.
 *
 * Wire contract: gcdr.git/docs/rfcs/RFC-0046-Goals-API.md
 * UI reference:  gcdr-frontend.git/docs/RFC-0046-Goals-Frontend.md
 *
 * Domain rules (fixed per domain, never an operator choice):
 *   ENERGY  → kWh · SUM     · negatives rejected
 *   WATER   → m³  · SUM     · negatives rejected
 *   TEMPERATURE → °C · AVERAGE · negatives allowed
 *
 * @version 2.0.0  (GCDR-backed; supersedes the RFC-0075 mock/ThingsBoard panel)
 * @author MYIO Frontend Guild
 */

/* eslint-disable */

import { ModalHeader } from '../utils/ModalHeader';

// =============================================================================
// Domain config (mirrors GOAL_DOMAIN_CONFIG in gcdr-frontend src/types/goals.ts)
// =============================================================================

const DOMAINS = ['ENERGY', 'WATER', 'TEMPERATURE'];

const GOAL_DOMAIN_CONFIG = {
  ENERGY: { unit: 'kWh', aggregationMethod: 'SUM', allowsNegative: false },
  WATER: { unit: 'm3', aggregationMethod: 'SUM', allowsNegative: false },
  TEMPERATURE: { unit: 'C', aggregationMethod: 'AVERAGE', allowsNegative: true },
};

/** Zero-padded month keys "01".."12". */
const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

/** Zero-padded hour keys "00".."23". */
const HOUR_KEYS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

const pad2 = (n) => String(n).padStart(2, '0');

/** Days in a (year, 1-based month), leap-year aware (matches the backend). */
function daysInMonth(year, month) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Current year ± 2, newest-first. */
function buildYearOptions() {
  const now = new Date().getFullYear();
  const out = [];
  for (let y = now + 2; y >= now - 2; y--) out.push(y);
  return out;
}

/** Small HTML escaper for any operator/server-provided text. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// Public entry point
// =============================================================================

/**
 * Opens the GCDR Consumption Goals panel modal.
 *
 * @param {Object} params
 * @param {string} params.customerId          - GCDR customer UUID (required).
 * @param {string} params.apiKey              - X-API-Key (gcdr_cust_*) (required).
 * @param {string} params.baseUrl             - GCDR host, e.g. "https://api.gcdr" — "/api/v1" is appended if absent.
 * @param {('ENERGY'|'WATER'|'TEMPERATURE')} [params.domain='ENERGY'] - initial domain.
 * @param {number} [params.year]              - initial year (default current year).
 * @param {string} [params.locale='pt-BR']    - 'pt-BR' | 'en-US'.
 * @param {Object} [params.styles]            - theme overrides (accent/primaryColor/zIndex/...).
 * @param {Function} [params.onSaved]         - called after a successful write (WriteGoalsResponse).
 * @param {Function} [params.onClose]         - called when the modal closes.
 * @param {HTMLElement} [params.container]    - mount node (default document.body).
 * @returns {Object} instance with { close, refresh, getState }.
 */
export function openGoalsPanel(params) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('GoalsPanel requires a browser environment');
  }

  const p = params || {};
  const customerId = p.customerId;
  // Accept apiKey from params or legacy `api.apiKey`.
  const apiKey = p.apiKey || (p.api && p.api.apiKey) || null;
  // Accept baseUrl from params, `dataApiHost`, or legacy `api.baseUrl`.
  const rawBaseUrl = p.baseUrl || p.dataApiHost || (p.api && p.api.baseUrl) || '';
  const onSaved = typeof p.onSaved === 'function' ? p.onSaved : (typeof p.onSave === 'function' ? p.onSave : null);
  const onClose = typeof p.onClose === 'function' ? p.onClose : null;
  const container = p.container || document.body;
  const locale = p.locale === 'en-US' ? 'en-US' : 'pt-BR';
  const styles = p.styles || {};

  if (!customerId) throw new Error('customerId is required');
  if (!apiKey) throw new Error('apiKey (X-API-Key gcdr_cust_*) is required');
  if (!rawBaseUrl) throw new Error('baseUrl (GCDR host) is required');

  const i18n = getStrings(locale);

  // Emerald is the GCDR Goals identity; honor styles.primaryColor when provided.
  const theme = {
    accent: styles.accent || styles.primaryColor || '#059669',
    accentSoft: styles.accentSoft || 'rgba(5,150,105,0.10)',
    primary: styles.primaryColor || styles.accent || '#059669',
    violet: styles.violet || '#6c5ce7',
    danger: styles.errorColor || '#dc2626',
    amber: styles.warningColor || '#d97706',
    borderRadius: styles.borderRadius || '10px',
    fontFamily: styles.fontFamily || "'Nunito', 'Roboto', Arial, sans-serif",
    zIndex: styles.zIndex || 10000,
  };

  const MODAL_ID = 'goals-gcdr-modal';
  const ROOT_ID = 'myio-goals-gcdr-root';

  // ───────────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────────

  const state = {
    domain: DOMAINS.includes(p.domain) ? p.domain : 'ENERGY',
    year: Number.isFinite(p.year) ? p.year : new Date().getFullYear(),
    level: 'month', // 'month' | 'day' | 'hour'
    selectedMonth: null, // "01".."12"
    selectedDay: null, // "01".."31"
    editing: false,
    goals: null, // GoalTreeResponse
    loading: false,
    error: null,
    saving: false,
    saveError: null,
    conflictVersion: null,
    draft: {}, // current view editable map
    saved: false,
    conflict: false,
    // CSV import modal
    importOpen: false,
    csv: '',
    importPreview: null, // ImportGoalsResponse (dryRun=true)
    importApplied: null, // ImportGoalsResponse (dryRun=false)
  };

  let rootEl = null;

  const instance = {
    close: () => closeModal(),
    refresh: () => reload(),
    getState: () => ({ ...state }),
  };

  // NOTE: mount() + return happen at the END of this function. They used to sit here,
  // which meant every `const` below (svc, targetQuery, …) never executed — statements
  // after `return` are dead code — so mount() → reload() hit "Cannot access 'svc'
  // before initialization" and the modal spun forever.

  // ───────────────────────────────────────────────────────────────────────────
  // GCDR API service (fetch + standard envelope)
  // ───────────────────────────────────────────────────────────────────────────

  function apiBase() {
    let b = String(rawBaseUrl).replace(/\/+$/, '');
    if (!/\/api\/v1$/.test(b)) b += '/api/v1';
    return b;
  }

  async function request(method, path, opts) {
    const o = opts || {};
    let url = apiBase() + path;
    if (o.query) {
      const qs = new URLSearchParams();
      Object.entries(o.query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      });
      const s = qs.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      });
    } catch (e) {
      return { success: false, error: { message: (e && e.message) || 'Network error', code: 'NETWORK' } };
    }
    if (res.status === 204) return { success: true, data: undefined };
    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      json = null;
    }
    if (!res.ok) {
      const err = (json && json.error) || { message: `HTTP ${res.status}`, code: `HTTP_${res.status}` };
      return { success: false, error: err };
    }
    if (json && typeof json.success === 'boolean') return json;
    return { success: true, data: json };
  }

  const targetQuery = () => ({ domain: state.domain, year: state.year });

  const svc = {
    getTree: (granularity, fetchHistory) =>
      request('GET', `/customers/${customerId}/goals`, {
        query: { domain: state.domain, year: state.year, granularity, fetchHistory },
      }),
    replace: (body) =>
      request('PUT', `/customers/${customerId}/goals`, { query: targetQuery(), body }),
    merge: (body) =>
      request('PATCH', `/customers/${customerId}/goals`, { query: targetQuery(), body }),
    importCsv: (body, dryRun) =>
      request('POST', `/customers/${customerId}/goals/import`, {
        query: { domain: state.domain, year: state.year, dryRun: !!dryRun },
        body,
      }),
    // RFC-0052: margem da meta (goalMarginPct) por customer × domínio × ano.
    // Mesmo stream de versão dos buckets — 409 VERSION_CONFLICT no lock otimista.
    setMargin: (pct, version) =>
      request('PUT', `/customers/${customerId}/goals/margin`, {
        query: targetQuery(),
        body: version ? { goalMarginPct: pct, version } : { goalMarginPct: pct },
      }),
    clearMargin: (version) =>
      request('DELETE', `/customers/${customerId}/goals/margin`, {
        query: targetQuery(),
        body: version ? { version } : undefined,
      }),
  };

  /** Pull `currentVersion` out of a 409 VERSION_CONFLICT envelope, if present. */
  function readVersionConflict(res) {
    if (!res || res.success || !res.error) return null;
    if (res.error.code !== 'VERSION_CONFLICT') return null;
    const fromTop = typeof res.error.currentVersion === 'number' ? res.error.currentVersion : undefined;
    const fromDetails =
      res.error.details && typeof res.error.details.currentVersion === 'number'
        ? res.error.details.currentVersion
        : undefined;
    return fromTop != null ? fromTop : fromDetails != null ? fromDetails : null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading
  // ───────────────────────────────────────────────────────────────────────────

  async function reload() {
    // In the summary we want the whole-year daily roll-up (annual+monthly+daily)
    // → fetch at 'day'. While editing, GET granularity follows the drill level.
    const granularity = state.editing ? state.level : 'day';
    state.loading = true;
    state.error = null;
    render();
    const res = await svc.getTree(granularity, true);
    state.loading = false;
    if (!res.success) {
      state.error = (res.error && res.error.message) || 'Failed to fetch goals';
      state.goals = null;
    } else {
      state.goals = res.data || null;
      reseedDraft();
    }
    state.saved = false;
    state.conflict = false;
    render();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tree → editable draft helpers
  // ───────────────────────────────────────────────────────────────────────────

  function monthlyFromTree(tree) {
    const out = {};
    for (const k of MONTH_KEYS) {
      const node = tree && tree.monthly && tree.monthly[k];
      out[k] = node && typeof node.value === 'number' ? String(node.value) : '';
    }
    return out;
  }

  function dailyFromTree(tree, monthKey, dayCount) {
    const out = {};
    for (let d = 1; d <= dayCount; d++) {
      const dd = pad2(d);
      const node = tree && tree.daily && tree.daily[`${monthKey}-${dd}`];
      out[dd] = node && typeof node.value === 'number' ? String(node.value) : '';
    }
    return out;
  }

  function hourlyFromTree(tree, monthKey, dayKey) {
    const out = {};
    for (const hh of HOUR_KEYS) {
      const node = tree && tree.hourly && tree.hourly[`${monthKey}-${dayKey}T${hh}`];
      out[hh] = node && typeof node.value === 'number' ? String(node.value) : '';
    }
    return out;
  }

  function reseedDraft() {
    const tree = state.goals && state.goals.tree;
    if (state.level === 'month') {
      state.draft = monthlyFromTree(tree);
    } else if (state.level === 'day' && state.selectedMonth) {
      state.draft = dailyFromTree(tree, state.selectedMonth, daysInMonth(state.year, Number(state.selectedMonth)));
    } else if (state.level === 'hour' && state.selectedMonth && state.selectedDay) {
      state.draft = hourlyFromTree(tree, state.selectedMonth, state.selectedDay);
    } else {
      state.draft = {};
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived views
  // ───────────────────────────────────────────────────────────────────────────

  function config() {
    return GOAL_DOMAIN_CONFIG[state.domain];
  }
  function isAverage() {
    return config().aggregationMethod === 'AVERAGE';
  }
  function unitLabel() {
    const u = config().unit;
    return u === 'm3' ? 'm³' : u === 'C' ? '°C' : u;
  }
  function fmt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return `${Number(n).toLocaleString(locale, { maximumFractionDigits: 2 })} ${unitLabel()}`;
  }

  function viewKeys() {
    if (state.level === 'month') return MONTH_KEYS;
    if (state.level === 'day') {
      const c = state.selectedMonth ? daysInMonth(state.year, Number(state.selectedMonth)) : 0;
      return Array.from({ length: c }, (_, i) => pad2(i + 1));
    }
    return HOUR_KEYS;
  }

  function monthlyFilledCount() {
    const tree = state.goals && state.goals.tree;
    return MONTH_KEYS.filter((k) => tree && tree.monthly && tree.monthly[k] && tree.monthly[k].value !== undefined).length;
  }

  function buildSummary() {
    const tree = (state.goals && state.goals.tree) || {};
    const monthlyEntries = MONTH_KEYS.map((k) => ({ key: k, value: tree.monthly && tree.monthly[k] && tree.monthly[k].value }))
      .filter((e) => typeof e.value === 'number');
    const dailyEntries = Object.entries(tree.daily || {})
      .map(([key, node]) => ({ key, value: node.value }))
      .filter((e) => typeof e.value === 'number');

    const monthsWithGoal = monthlyEntries.length;
    const daysWithGoal = dailyEntries.length;
    const monthlySum = monthlyEntries.reduce((a, e) => a + e.value, 0);
    const dailySum = dailyEntries.reduce((a, e) => a + e.value, 0);

    const yearValue =
      tree.annual && typeof tree.annual.value === 'number'
        ? tree.annual.value
        : isAverage()
        ? monthsWithGoal
          ? monthlySum / monthsWithGoal
          : null
        : monthlySum;

    return {
      hasData: monthsWithGoal > 0 || daysWithGoal > 0,
      monthsWithGoal,
      daysWithGoal,
      yearValue,
      avgPerMonth: monthsWithGoal ? monthlySum / monthsWithGoal : null,
      avgPerDay: daysWithGoal ? dailySum / daysWithGoal : null,
      topMonths: [...monthlyEntries].sort((a, b) => b.value - a.value).slice(0, 3),
      topDays: [...dailyEntries].sort((a, b) => b.value - a.value).slice(0, 3),
    };
  }

  function computedTotal() {
    const keys = viewKeys();
    const nums = [];
    for (const k of keys) {
      const raw = state.draft[k];
      if (raw === undefined || String(raw).trim() === '') continue;
      const n = Number(raw);
      if (!Number.isNaN(n)) nums.push(n);
    }
    if (nums.length === 0) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return isAverage() ? sum / nums.length : sum;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Drill navigation
  // ───────────────────────────────────────────────────────────────────────────

  function openMonth(monthKey) {
    state.selectedMonth = monthKey;
    state.selectedDay = null;
    state.level = 'day';
    reload();
  }
  function openDay(dayKey) {
    state.selectedDay = dayKey;
    state.level = 'hour';
    reload();
  }
  function goToMonths() {
    state.level = 'month';
    state.selectedMonth = null;
    state.selectedDay = null;
    reload();
  }
  function goToDays() {
    state.level = 'day';
    state.selectedDay = null;
    reload();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Save
  // ───────────────────────────────────────────────────────────────────────────

  async function handleSave() {
    state.saved = false;
    state.conflict = false;
    state.saveError = null;
    state.conflictVersion = null;
    state.saving = true;
    render();

    const ver = state.goals && state.goals.version > 0 ? state.goals.version : null;

    let res;
    if (state.level === 'month') {
      const monthly = {};
      for (const k of MONTH_KEYS) {
        const raw = state.draft[k];
        if (raw === undefined || String(raw).trim() === '') continue;
        const num = Number(raw);
        if (Number.isNaN(num)) continue;
        monthly[k] = { value: num, sourceLevel: 'MONTH' };
      }
      const body = { monthly };
      if (ver) body.expectedVersion = ver;
      res = await svc.replace(body);
    } else {
      const buckets = [];
      if (state.level === 'day' && state.selectedMonth) {
        const dc = daysInMonth(state.year, Number(state.selectedMonth));
        for (let d = 1; d <= dc; d++) {
          const dd = pad2(d);
          const raw = state.draft[dd];
          if (raw === undefined || String(raw).trim() === '') continue;
          const num = Number(raw);
          if (Number.isNaN(num)) continue;
          buckets.push({ level: 'DAY', ref: `${state.year}-${state.selectedMonth}-${dd}`, value: num });
        }
      } else if (state.level === 'hour' && state.selectedMonth && state.selectedDay) {
        for (const hh of HOUR_KEYS) {
          const raw = state.draft[hh];
          if (raw === undefined || String(raw).trim() === '') continue;
          const num = Number(raw);
          if (Number.isNaN(num)) continue;
          buckets.push({ level: 'HOUR', ref: `${state.year}-${state.selectedMonth}-${state.selectedDay}T${hh}`, value: num });
        }
      }
      if (buckets.length === 0) {
        state.saving = false;
        render();
        return;
      }
      const body = { buckets };
      if (ver) body.expectedVersion = ver;
      res = await svc.merge(body);
    }

    state.saving = false;

    if (res.success) {
      state.saved = true;
      if (onSaved) {
        try {
          await onSaved(res.data);
        } catch (_) {}
      }
      // Re-GET so the tree/version/history reflect the write.
      reload();
      return;
    }

    const conflict = readVersionConflict(res);
    if (conflict !== null) {
      state.conflictVersion = conflict;
      state.conflict = true;
      // Reload-and-reapply: re-GET against the new version; operator re-saves.
      reload();
    } else {
      state.saveError = (res.error && res.error.message) || 'Failed to save goals';
      render();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RFC-0052: Margem da meta (goalMarginPct)
  // ───────────────────────────────────────────────────────────────────────────

  /** Margem atual do aggregate (null quando nunca definida). */
  function currentMarginPct() {
    const gm = state.goals && state.goals.goalMargin;
    const v = gm && gm.goalMarginPct != null ? Number(gm.goalMarginPct) : null;
    return Number.isFinite(v) ? v : null;
  }

  async function handleSaveMargin() {
    const input = rootEl && rootEl.querySelector('#myio-goals-margin');
    if (!input) return;
    const raw = String(input.value || '').replace(',', '.').trim();
    const pct = parseFloat(raw);
    if (!Number.isFinite(pct) || pct < -100 || pct > 100) {
      state.saveError = i18n.margin.invalid;
      state.saved = false;
      render();
      return;
    }
    state.saving = true;
    state.saveError = null;
    state.saved = false;
    state.conflict = false;
    render();
    const ver = state.goals && state.goals.version > 0 ? state.goals.version : null;
    const res = await svc.setMargin(Math.round(pct * 100) / 100, ver);
    state.saving = false;
    if (res.success) {
      state.saved = true;
      reload(); // margem bumpa a versão e entra no histórico (source MARGIN)
      return;
    }
    const conflict = readVersionConflict(res);
    if (conflict !== null) {
      state.conflictVersion = conflict;
      state.conflict = true;
      reload();
    } else {
      state.saveError = (res.error && res.error.message) || i18n.margin.saveFailed;
      render();
    }
  }

  async function handleClearMargin() {
    state.saving = true;
    state.saveError = null;
    state.saved = false;
    state.conflict = false;
    render();
    const ver = state.goals && state.goals.version > 0 ? state.goals.version : null;
    const res = await svc.clearMargin(ver);
    state.saving = false;
    if (res.success) {
      state.saved = true;
      reload();
      return;
    }
    const conflict = readVersionConflict(res);
    if (conflict !== null) {
      state.conflictVersion = conflict;
      state.conflict = true;
      reload();
    } else {
      state.saveError = (res.error && res.error.message) || i18n.margin.saveFailed;
      render();
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CSV import
  // ───────────────────────────────────────────────────────────────────────────

  function sampleHourValue() {
    return isAverage() ? 22 : 150;
  }

  function buildTemplateCsv() {
    const avg = isAverage();
    const monthlyValue = avg ? 22 : 100000;
    const dayValue = avg ? 22 : 3200;
    const hourValue = avg ? 22 : 150;
    const lines = ['bucket,value'];
    for (let m = 1; m <= 12; m++) lines.push(`${state.year}-${pad2(m)},${monthlyValue}`);
    lines.push(`${state.year}-03-15,${dayValue}`);
    lines.push(`${state.year}-03-15T08,${hourValue}`);
    return lines.join('\n');
  }

  function buildHourlyExampleCsv() {
    const value = sampleHourValue();
    const day = `${state.year}-03-15`;
    const lines = ['bucket,value'];
    for (let h = 0; h < 24; h++) lines.push(`${day}T${pad2(h)},${value}`);
    return lines.join('\n');
  }

  function downloadCsv(csv, suffix) {
    const blob = new Blob(['﻿', csv, '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goals-${state.domain.toLowerCase()}-${state.year}-${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function levelCountsFromPreview(preview) {
    const counts = { YEAR: 0, MONTH: 0, DAY: 0, HOUR: 0 };
    if (!preview) return counts;
    const bump = (node) => {
      if (node && node.sourceLevel && counts[node.sourceLevel] !== undefined) counts[node.sourceLevel] += 1;
    };
    bump(preview.annual);
    Object.values(preview.monthly || {}).forEach(bump);
    Object.values(preview.daily || {}).forEach(bump);
    Object.values(preview.hourly || {}).forEach(bump);
    return counts;
  }

  async function handleImportPreview() {
    state.importApplied = null;
    state.saveError = null;
    state.conflictVersion = null;
    state.saving = true;
    renderImportBody();
    const res = await svc.importCsv({ csv: state.csv }, true);
    state.saving = false;
    if (res.success) {
      state.importPreview = res.data;
    } else {
      state.saveError = (res.error && res.error.message) || 'Failed to preview import';
    }
    renderImportBody();
  }

  async function handleImportConfirm() {
    state.saveError = null;
    state.conflictVersion = null;
    state.saving = true;
    renderImportBody();
    const ver = state.goals && state.goals.version > 0 ? state.goals.version : null;
    const body = ver ? { csv: state.csv, expectedVersion: ver } : { csv: state.csv };
    const res = await svc.importCsv(body, false);
    state.saving = false;
    if (res.success) {
      state.importApplied = res.data;
      reload(); // refresh tree/version/history under the modal
    } else {
      const conflict = readVersionConflict(res);
      if (conflict !== null) state.conflictVersion = conflict;
      else state.saveError = (res.error && res.error.message) || 'Failed to apply import';
    }
    renderImportBody();
  }

  function openImport() {
    state.importOpen = true;
    state.csv = '';
    state.importPreview = null;
    state.importApplied = null;
    state.saveError = null;
    state.conflictVersion = null;
    render();
  }
  function closeImport() {
    state.importOpen = false;
    state.csv = '';
    state.importPreview = null;
    state.importApplied = null;
    state.saveError = null;
    state.conflictVersion = null;
    render();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Mount / lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  function mount() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();

    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    rootEl.className = 'myio-goals-overlay';
    rootEl.setAttribute('role', 'dialog');
    rootEl.setAttribute('aria-modal', 'true');
    container.appendChild(rootEl);

    injectStyles();

    // Persistent delegated listeners (survive innerHTML rebuilds).
    rootEl.addEventListener('click', onClick);
    rootEl.addEventListener('change', onChange);
    rootEl.addEventListener('input', onInput);

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        if (state.importOpen) closeImport();
        else closeModal();
      }
    };
    document.addEventListener('keydown', escHandler);
    rootEl._escHandler = escHandler;

    render();
    reload();
  }

  function closeModal() {
    if (!rootEl) return;
    if (rootEl._escHandler) document.removeEventListener('keydown', rootEl._escHandler);
    rootEl.remove();
    rootEl = null;
    if (onClose) onClose();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Event delegation
  // ───────────────────────────────────────────────────────────────────────────

  function onClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) {
      // backdrop click
      if (e.target.classList && e.target.classList.contains('myio-goals-backdrop')) {
        if (state.importOpen) closeImport();
        else closeModal();
      }
      return;
    }
    const action = actionEl.dataset.action;
    switch (action) {
      case 'close':
        if (state.importOpen) closeImport();
        else closeModal();
        break;
      case 'enable-edit':
        state.editing = true;
        goToMonths();
        break;
      case 'view-summary':
        state.editing = false;
        goToMonths();
        break;
      case 'save':
        handleSave();
        break;
      case 'save-margin':
        handleSaveMargin();
        break;
      case 'clear-margin':
        handleClearMargin();
        break;
      case 'retry':
        reload();
        break;
      case 'open-import':
        openImport();
        break;
      case 'download-template':
        downloadCsv(buildTemplateCsv(), 'template');
        break;
      case 'download-hourly':
        downloadCsv(buildHourlyExampleCsv(), 'hourly-example');
        break;
      case 'crumb-months':
        goToMonths();
        break;
      case 'crumb-days':
        goToDays();
        break;
      case 'open-month':
        openMonth(actionEl.dataset.key);
        break;
      case 'open-day':
        openDay(actionEl.dataset.key);
        break;
      case 'import-close':
        closeImport();
        break;
      case 'import-preview':
        handleImportPreview();
        break;
      case 'import-confirm':
        handleImportConfirm();
        break;
      case 'import-upload':
        {
          const fi = rootEl.querySelector('#myio-goals-csv-file');
          if (fi) fi.click();
        }
        break;
      default:
        break;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'myio-goals-domain') {
      state.domain = t.value;
      state.editing = state.editing; // unchanged
      goToMonths();
    } else if (t.id === 'myio-goals-year') {
      state.year = Number(t.value);
      goToMonths();
    } else if (t.id === 'myio-goals-csv-file') {
      const file = t.files && t.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          state.csv = typeof reader.result === 'string' ? reader.result : '';
          state.importPreview = null;
          state.importApplied = null;
          renderImportBody();
        };
        reader.readAsText(file);
      }
      t.value = '';
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.matches && t.matches('[data-cell]')) {
      const key = t.dataset.cell;
      state.draft[key] = t.value;
      state.saved = false;
      updateComputedTotalDisplay();
    } else if (t.id === 'myio-goals-csv-textarea') {
      state.csv = t.value;
      state.importPreview = null;
      // toggle preview button disabled state live
      const btn = rootEl.querySelector('[data-action="import-preview"]');
      if (btn) btn.disabled = !(state.csv.trim().length > 0) || state.saving;
    }
  }

  function updateComputedTotalDisplay() {
    const span = rootEl && rootEl.querySelector('#myio-goals-computed-total');
    if (!span) return;
    const total = computedTotal();
    span.textContent = total === null ? '—' : fmt(total);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  function render() {
    if (!rootEl) return;
    const headerHTML = ModalHeader.generateInlineHTML({
      icon: '🎯',
      title: i18n.modalTitle,
      modalId: MODAL_ID,
      theme: 'dark',
      isMaximized: false,
      showThemeToggle: false,
      showMaximize: false,
      showClose: true,
      primaryColor: theme.primary,
      borderRadius: `${theme.borderRadius} ${theme.borderRadius} 0 0`,
    });

    rootEl.innerHTML = `
      <div class="myio-goals-backdrop" aria-hidden="true"></div>
      <div class="myio-goals-dialog">
        <div class="myio-goals-card">
          ${headerHTML}
          <div class="myio-goals-body">
            ${renderToolbar()}
            ${renderMessages()}
            ${renderMain()}
            ${renderHistory()}
          </div>
        </div>
      </div>
      ${state.importOpen ? renderImportModal() : ''}
    `;

    // ModalHeader close handler (its close button uses its own id wiring).
    ModalHeader.setupHandlers({ modalId: MODAL_ID, onClose: () => closeModal() });
  }

  function renderToolbar() {
    const cfg = config();
    const version = state.goals ? state.goals.version : 0;
    const yearOptions = buildYearOptions();
    if (!yearOptions.includes(state.year)) yearOptions.unshift(state.year);

    const actions = state.editing
      ? `
        <button class="myio-goals-btn myio-goals-btn-outline" data-action="open-import" ${state.loading || state.error ? 'disabled' : ''}>
          ${icon('upload')} ${i18n.importBtn}
        </button>
        <button class="myio-goals-btn myio-goals-btn-outline" data-action="view-summary" ${state.loading ? 'disabled' : ''}>
          ${icon('eye')} ${i18n.viewSummary}
        </button>
        <button class="myio-goals-btn myio-goals-btn-primary" data-action="save" ${state.loading || state.error || state.saving ? 'disabled' : ''}>
          ${icon('save')} ${state.saving ? i18n.saving : i18n.save}
        </button>`
      : `
        <button class="myio-goals-btn myio-goals-btn-outline" data-action="download-hourly" ${state.loading ? 'disabled' : ''}>
          ${icon('download')} ${i18n.downloadHourlyExample}
        </button>
        <button class="myio-goals-btn myio-goals-btn-primary" data-action="enable-edit" ${state.loading || state.error ? 'disabled' : ''}>
          ${icon('pencil')} ${i18n.enableEditing}
        </button>`;

    return `
      <div class="myio-goals-toolbar">
        <div class="myio-goals-selects">
          <label class="myio-goals-field">
            <span>${i18n.domainLabel}</span>
            <select id="myio-goals-domain">
              ${DOMAINS.map((d) => `<option value="${d}" ${d === state.domain ? 'selected' : ''}>${i18n.domains[d]}</option>`).join('')}
            </select>
          </label>
          <label class="myio-goals-field">
            <span>${i18n.yearLabel}</span>
            <select id="myio-goals-year">
              ${yearOptions.map((y) => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </label>
          <div class="myio-goals-chips">
            <span class="myio-goals-chip myio-goals-chip-accent">${icon('target')} ${i18n.domains[state.domain]} · ${i18n.aggregation[cfg.aggregationMethod]}</span>
            <span class="myio-goals-chip myio-goals-chip-mono">${unitLabel()}</span>
            <span class="myio-goals-chip myio-goals-chip-violet">${icon('history')} ${i18n.currentVersion.replace('{n}', version)}</span>
            ${renderMarginChip()}
          </div>
        </div>
        <div class="myio-goals-actions">${actions}</div>
      </div>
      ${state.editing ? renderMarginEditor() : ''}
    `;
  }

  // RFC-0052: chip "Margem: −5%" (leitura) — oculto quando margem 0/ausente
  function renderMarginChip() {
    const pct = currentMarginPct();
    if (pct == null || pct === 0) return '';
    const cls = pct < 0 ? 'myio-goals-chip-red' : 'myio-goals-chip-green';
    const txt = `${pct > 0 ? '+' : ''}${pct.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
    return `<span class="myio-goals-chip ${cls}" title="${i18n.margin.chipTitle}">${i18n.margin.chip.replace('{v}', txt)}</span>`;
  }

  // RFC-0052: editor da margem (só em modo edição; salvar é independente do "Salvar"
  // dos buckets — endpoint próprio, mesmo stream de versão)
  function renderMarginEditor() {
    const pct = currentMarginPct();
    return `
      <div class="myio-goals-margin-row">
        <span class="myio-goals-margin-label">${i18n.margin.label}</span>
        <input id="myio-goals-margin" type="number" step="0.01" min="-100" max="100"
               placeholder="0,00" value="${pct == null ? '' : pct}"
               ${state.saving ? 'disabled' : ''} />
        <span class="myio-goals-margin-pct">%</span>
        <button class="myio-goals-btn myio-goals-btn-outline myio-goals-btn-sm" data-action="save-margin" ${state.saving ? 'disabled' : ''}>
          ${icon('save')} ${i18n.margin.save}
        </button>
        ${
          pct != null
            ? `<button class="myio-goals-btn myio-goals-btn-outline myio-goals-btn-sm" data-action="clear-margin" ${state.saving ? 'disabled' : ''}>${i18n.margin.clear}</button>`
            : ''
        }
        <span class="myio-goals-margin-hint">${i18n.margin.hint}</span>
      </div>`;
  }

  function renderMessages() {
    let html = '';
    if (state.conflict) {
      html += `<div class="myio-goals-alert myio-goals-alert-amber">${icon('alert')} ${i18n.versionConflict}</div>`;
    }
    if (state.saveError && !state.conflict) {
      html += `<div class="myio-goals-alert myio-goals-alert-red">${icon('alert')} ${esc(state.saveError)}</div>`;
    }
    if (state.saved && !state.saveError) {
      html += `<div class="myio-goals-alert myio-goals-alert-green">${icon('check')} ${i18n.saveSuccess}</div>`;
    }
    return html;
  }

  function renderMain() {
    if (state.loading) {
      return `<div class="myio-goals-center">${icon('spinner')} <span>${i18n.loading}</span></div>`;
    }
    if (state.error) {
      return `
        <div class="myio-goals-center myio-goals-center-col">
          ${icon('alert-lg')}
          <p>${esc(state.error)}</p>
          <button class="myio-goals-btn myio-goals-btn-outline" data-action="retry">${i18n.retry}</button>
        </div>`;
    }
    if (!state.editing) return renderSummary();
    return renderEditor();
  }

  function renderSummary() {
    const s = buildSummary();
    if (!s.hasData) {
      return `
        <div class="myio-goals-center myio-goals-center-col">
          ${icon('target-lg')}
          <p>${i18n.noData.replace('{year}', state.year)}</p>
          <button class="myio-goals-btn myio-goals-btn-primary" data-action="enable-edit">${icon('pencil')} ${i18n.enableEditing}</button>
        </div>`;
    }
    const avg = isAverage();
    const glyph = avg ? `<span class="myio-goals-glyph">x̄</span>` : icon('sigma');
    const kpis = [
      { ic: icon('calendar'), label: i18n.summary.year, value: String(state.year) },
      { ic: glyph, label: avg ? i18n.summary.yearAverage : i18n.summary.yearTotal, value: fmt(s.yearValue) },
      { ic: icon('calendar-range'), label: i18n.summary.monthsWithGoal, value: `${s.monthsWithGoal} / 12` },
      { ic: icon('calendar-days'), label: i18n.summary.daysWithGoal, value: String(s.daysWithGoal) },
      { ic: icon('trend'), label: i18n.summary.avgPerMonth, value: fmt(s.avgPerMonth) },
      { ic: icon('trend'), label: i18n.summary.avgPerDay, value: fmt(s.avgPerDay) },
    ];
    // RFC-0052: com margem ativa, mostra o total anual AJUSTADO ao lado do cru
    const marginPct = currentMarginPct();
    const adjAnnual =
      state.goals && state.goals.tree && state.goals.tree.annual
        ? state.goals.tree.annual.adjustedValue
        : null;
    if (marginPct != null && marginPct !== 0 && adjAnnual != null) {
      kpis.splice(2, 0, {
        ic: glyph,
        label: `${i18n.summary.yearAdjusted} (${marginPct > 0 ? '+' : ''}${marginPct}%)`,
        value: fmt(adjAnnual),
      });
    }

    const topCol = (title, items, labeler) => `
      <div class="myio-goals-topcard">
        <h4>${icon('trend')} ${title}</h4>
        ${
          items.length === 0
            ? `<p class="myio-goals-muted">—</p>`
            : `<ol>${items
                .map(
                  (e, i) => `
            <li>
              <span class="myio-goals-rank"><span class="myio-goals-rank-num">${i + 1}</span>${labeler(e.key)}</span>
              <span class="myio-goals-rank-val">${fmt(e.value)}</span>
            </li>`
                )
                .join('')}</ol>`
        }
      </div>`;

    return `
      <div class="myio-goals-summary">
        <div class="myio-goals-kpis">
          ${kpis
            .map(
              (k) => `
            <div class="myio-goals-kpi">
              <div class="myio-goals-kpi-label">${k.ic} ${k.label}</div>
              <div class="myio-goals-kpi-value">${k.value}</div>
            </div>`
            )
            .join('')}
        </div>
        <div class="myio-goals-topgrid">
          ${topCol(i18n.summary.topMonths, s.topMonths, (k) => i18n.months[k])}
          ${topCol(i18n.summary.topDays, s.topDays, (k) => dayLabel(k))}
        </div>
        <p class="myio-goals-hint">${i18n.summary.hint}</p>
      </div>`;
  }

  function dayLabel(key) {
    const [mm, dd] = key.split('-');
    return `${Number(dd)} ${i18n.months[mm]}`;
  }

  function renderEditor() {
    const cfg = config();
    const avg = isAverage();
    const keys = viewKeys();
    const tree = (state.goals && state.goals.tree) || {};
    const version = state.goals ? state.goals.version : 0;

    // Breadcrumb
    const crumb = `
      <nav class="myio-goals-crumb">
        <button data-action="crumb-months" class="${state.level === 'month' ? 'active' : ''}">${icon('home')} ${i18n.breadcrumbYear.replace('{year}', state.year)}</button>
        ${
          state.selectedMonth
            ? `${icon('chevron')}<button data-action="crumb-days" class="${state.level === 'day' ? 'active' : ''}">${i18n.months[state.selectedMonth]}</button>`
            : ''
        }
        ${
          state.selectedMonth && state.selectedDay && state.level === 'hour'
            ? `${icon('chevron')}<span class="active">${i18n.breadcrumbDay.replace('{day}', Number(state.selectedDay))}</span>`
            : ''
        }
      </nav>`;

    const emptyHint =
      state.level === 'month' && monthlyFilledCount() === 0 && version === 0
        ? `<p class="myio-goals-muted">${i18n.empty}</p>`
        : '';

    const drillHint =
      state.level !== 'hour'
        ? `<p class="myio-goals-microhint">${state.level === 'month' ? i18n.drill.openMonthHint : i18n.drill.openDayHint}</p>`
        : '';

    const gridClass =
      state.level === 'hour'
        ? 'myio-goals-grid-hour'
        : state.level === 'day'
        ? 'myio-goals-grid-day'
        : 'myio-goals-grid-month';

    const cells = keys
      .map((key) => {
        const node =
          state.level === 'month'
            ? tree.monthly && tree.monthly[key]
            : state.level === 'day' && state.selectedMonth
            ? tree.daily && tree.daily[`${state.selectedMonth}-${key}`]
            : state.selectedMonth && state.selectedDay
            ? tree.hourly && tree.hourly[`${state.selectedMonth}-${state.selectedDay}T${key}`]
            : undefined;
        const confirmed = node && node.derived === false;
        const cellLabel =
          state.level === 'month'
            ? i18n.months[key]
            : state.level === 'day'
            ? i18n.dayCell.replace('{day}', Number(key))
            : `${key}:00`;
        const canDrill = state.level !== 'hour';
        const labelEl = canDrill
          ? `<button class="myio-goals-cell-drill" data-action="${state.level === 'month' ? 'open-month' : 'open-day'}" data-key="${key}" title="${i18n.drill.openTitle}">${cellLabel} ${icon('chevron-sm')}</button>`
          : `<span class="myio-goals-cell-label">${cellLabel}</span>`;
        const val = state.draft[key] !== undefined ? esc(state.draft[key]) : '';
        const minAttr = cfg.allowsNegative ? '' : 'min="0"';
        return `
          <div class="myio-goals-cell">
            <div class="myio-goals-cell-head">
              ${labelEl}
              ${icon('pencil-sm')}
            </div>
            <div class="myio-goals-cell-input">
              <input type="number" step="any" ${minAttr} data-cell="${key}" value="${val}" placeholder="—" />
              <span class="myio-goals-cell-unit">${unitLabel()}</span>
            </div>
            ${confirmed ? `<p class="myio-goals-confirmed">${i18n.confirmedBadge}</p>` : ''}
          </div>`;
      })
      .join('');

    const totalLabel =
      state.level === 'month'
        ? avg
          ? i18n.summary.yearAverage
          : i18n.summary.yearTotal
        : state.level === 'day'
        ? avg
          ? i18n.monthAverage
          : i18n.monthTotal
        : avg
        ? i18n.dayAverage
        : i18n.dayTotal;
    const glyph = avg ? `<span class="myio-goals-glyph">x̄</span>` : icon('sigma');
    const total = computedTotal();

    return `
      <div class="myio-goals-editor">
        ${crumb}
        ${emptyHint}
        ${drillHint}
        <div class="myio-goals-grid ${gridClass}">${cells}</div>
        <div class="myio-goals-total">
          <span class="myio-goals-total-label">${glyph} ${totalLabel}</span>
          <span class="myio-goals-total-val" id="myio-goals-computed-total">${total === null ? '—' : fmt(total)}</span>
        </div>
        <div class="myio-goals-legend">
          <span>${icon('pencil-sm')} ${i18n.legendEditable}</span>
          <span>${glyph} ${i18n.legendComputed}</span>
        </div>
      </div>`;
  }

  // ─── History timeline ───────────────────────────────────────────────────────

  function formatRef(ref) {
    if (/^\d{4}$/.test(ref)) return ref;
    let m = ref.match(/^(\d{4})-(\d{2})$/);
    if (m) return `${m[2]}/${m[1]}`;
    m = ref.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    m = ref.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:00`;
    return ref;
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const T = i18n.time;
    if (s < 60) return T.now;
    if (m < 60) return T.min.replace('{n}', m);
    if (h < 24) return T.hour.replace('{n}', h);
    if (d < 30) return T.day.replace('{n}', d);
    return new Date(iso).toLocaleDateString(locale);
  }

  function renderHistory() {
    if (state.loading || state.error) return '';
    const history = (state.goals && state.goals.history) || [];
    const version = state.goals ? state.goals.version : 0;
    const DETAIL_PREVIEW = 8;

    const items =
      history.length === 0
        ? `<div class="myio-goals-center myio-goals-center-col myio-goals-hist-empty">${icon('clock')}<p>${i18n.history.empty}</p></div>`
        : `<ol class="myio-goals-timeline">${history
            .map((ev, idx) => {
              const actor = ev.actor ? `${String(ev.actor).slice(0, 8)}…` : i18n.history.system;
              const extra = ev.bucketCount - (ev.details ? ev.details.length : 0);
              const chips = (ev.details || [])
                .slice(0, DETAIL_PREVIEW)
                .map(
                  (d) =>
                    `<span class="myio-goals-tl-chip"><span class="myio-goals-tl-ref">${esc(formatRef(d.ref))}</span>${d.value === null ? '—' : fmt(d.value)}</span>`
                )
                .join('');
              const more = extra > 0 ? `<span class="myio-goals-tl-more">${i18n.history.moreDetails.replace('{n}', extra)}</span>` : '';
              return `
                <li class="myio-goals-tl-item">
                  <span class="myio-goals-tl-dot">${icon(ev.source === 'IMPORT' ? 'upload-sm' : ev.source === 'DELETE' ? 'trash-sm' : 'pencil-sm')}</span>
                  <div class="myio-goals-tl-head">
                    <span class="myio-goals-tl-title">${i18n.history.source[ev.source] || i18n.history.source.EDIT}</span>
                    <span class="myio-goals-tl-ver">v${ev.version}</span>
                  </div>
                  <p class="myio-goals-tl-meta" title="${esc(new Date(ev.changedAt).toLocaleString(locale))}">${esc(actor)} · ${esc(timeAgo(ev.changedAt))}</p>
                  <p class="myio-goals-tl-records">${i18n.history.records.replace('{n}', ev.bucketCount)} · ${i18n.levels[ev.actionLevel] || ev.actionLevel}</p>
                  ${chips || more ? `<div class="myio-goals-tl-chips">${chips}${more}</div>` : ''}
                </li>`;
            })
            .join('')}</ol>`;

    return `
      <div class="myio-goals-history">
        <div class="myio-goals-history-head">
          <h3>${icon('clock')} ${i18n.history.title}</h3>
          <span class="myio-goals-history-meta">${i18n.domains[state.domain]} · ${state.year} · ${i18n.currentVersion.replace('{n}', version)}</span>
        </div>
        ${items}
      </div>`;
  }

  // ─── CSV import modal ────────────────────────────────────────────────────────

  function renderImportModal() {
    return `
      <div class="myio-goals-backdrop myio-goals-backdrop-2" aria-hidden="true"></div>
      <div class="myio-goals-import-dialog">
        <div class="myio-goals-import-card">
          <div class="myio-goals-import-header">
            <span class="myio-goals-import-icon">${icon('upload')}</span>
            <div>
              <h3>${i18n.import.title}</h3>
              <p>${i18n.import.subtitle.replace('{domain}', i18n.domains[state.domain]).replace('{year}', state.year)}</p>
            </div>
            <button class="myio-goals-import-x" data-action="import-close" aria-label="${i18n.import.cancel}">×</button>
          </div>
          <div class="myio-goals-import-body" id="myio-goals-import-body">
            ${renderImportInner()}
          </div>
          <div class="myio-goals-import-footer" id="myio-goals-import-footer">
            ${renderImportFooter()}
          </div>
        </div>
      </div>`;
  }

  function renderImportInner() {
    const applied = state.importApplied;
    const result = applied || state.importPreview;
    const counts = state.importPreview ? levelCountsFromPreview(state.importPreview.preview) : null;
    const sample = `bucket,value\n${state.year}-03,9000\n${state.year}-03-15,310\n${state.year}-03-15T08,15`;

    let html = `
      <div class="myio-goals-import-hint">
        <p>${i18n.import.formatHint}</p>
        <code>${esc(sample)}</code>
      </div>`;

    if (!applied) {
      html += `
        <div class="myio-goals-import-input">
          <div class="myio-goals-import-inputhead">
            <label>${i18n.import.csvLabel}</label>
            <div class="myio-goals-import-links">
              <button data-action="download-template">${icon('download')} ${i18n.import.downloadTemplate}</button>
              <button data-action="download-hourly">${icon('download')} ${i18n.import.downloadHourlyExample}</button>
              <button data-action="import-upload">${icon('upload')} ${i18n.import.uploadFile}</button>
              <input type="file" id="myio-goals-csv-file" accept=".csv,.txt,text/csv,text/plain" style="display:none" />
            </div>
          </div>
          <textarea id="myio-goals-csv-textarea" rows="8" spellcheck="false" placeholder="${esc(`bucket,value\n${state.year},100000\n${state.year}-03,9000\n${state.year}-03-15,310\n${state.year}-03-15T08,15`)}">${esc(state.csv)}</textarea>
          <p class="myio-goals-microhint">${i18n.import.unitNote.replace('{unit}', unitLabel())}</p>
        </div>`;
    }

    if (state.saveError && state.conflictVersion === null) {
      html += `<div class="myio-goals-alert myio-goals-alert-red">${icon('alert')} ${esc(state.saveError)}</div>`;
    }
    if (state.conflictVersion !== null) {
      html += `<div class="myio-goals-alert myio-goals-alert-amber">${icon('alert')} ${i18n.import.conflict}</div>`;
    }

    if (result) html += renderImportSummary(result, counts);
    return html;
  }

  function renderImportSummary(result, counts) {
    const persisted = result.dryRun === false;
    const badge = persisted
      ? `<span class="myio-goals-chip myio-goals-chip-accent">${icon('check')} ${i18n.import.appliedBadge.replace('{version}', result.version || 0)}</span>`
      : `<span class="myio-goals-chip myio-goals-chip-mono">${i18n.import.previewBadge}</span>`;

    let html = `
      <div class="myio-goals-import-summary">
        <div class="myio-goals-import-counts">
          <span class="myio-goals-chip myio-goals-chip-accent">${icon('check')} ${i18n.import.okCount.replace('{n}', result.okCount)}</span>
          ${result.errorCount > 0 ? `<span class="myio-goals-chip myio-goals-chip-red">${icon('alert')} ${i18n.import.errorCount.replace('{n}', result.errorCount)}</span>` : ''}
          ${badge}
        </div>`;

    if (!persisted && counts && result.okCount > 0) {
      const chips = ['YEAR', 'MONTH', 'DAY', 'HOUR']
        .filter((l) => counts[l] > 0)
        .map((l) => `<span class="myio-goals-chip myio-goals-chip-mono">${i18n.levels[l]}: ${counts[l]}</span>`)
        .join('');
      if (chips) {
        html += `<div class="myio-goals-import-willapply"><p>${i18n.import.willApply}</p><div>${chips}</div></div>`;
      }
    }

    if (result.diagnostics && result.diagnostics.length > 0) {
      html += `
        <div class="myio-goals-import-diags">
          <p class="myio-goals-import-diags-title">${i18n.import.diagnosticsTitle}</p>
          <ul>${result.diagnostics
            .map(
              (d) =>
                `<li>${icon('alert-sm')} <span><span class="myio-goals-diag-line">${i18n.import.line.replace('{line}', d.line)}</span>${d.bucket ? ` <span class="myio-goals-diag-bucket">[${esc(d.bucket)}]</span>` : ''} ${esc(d.reason)}</span></li>`
            )
            .join('')}</ul>
        </div>`;
    }

    if (persisted && result.log && result.log.length > 0) {
      html += `
        <div class="myio-goals-import-log">
          <p class="myio-goals-import-log-title">${i18n.import.logTitle}</p>
          <ul>${result.log.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
        </div>`;
    }

    html += `</div>`;
    return html;
  }

  function renderImportFooter() {
    if (state.importApplied) {
      return `<button class="myio-goals-btn myio-goals-btn-primary" data-action="import-close">${i18n.import.done}</button>`;
    }
    const canPreview = state.csv.trim().length > 0 && !state.saving;
    const canConfirm = !!state.importPreview && state.importPreview.okCount > 0 && !state.saving && !state.importApplied;
    const right = state.importPreview
      ? `<button class="myio-goals-btn myio-goals-btn-primary" data-action="import-confirm" ${canConfirm ? '' : 'disabled'}>${icon('upload')} ${i18n.import.confirm.replace('{n}', state.importPreview.okCount)}</button>`
      : `<button class="myio-goals-btn myio-goals-btn-primary" data-action="import-preview" ${canPreview ? '' : 'disabled'}>${icon('upload')} ${i18n.import.preview}</button>`;
    return `
      <button class="myio-goals-btn myio-goals-btn-outline" data-action="import-close" ${state.saving ? 'disabled' : ''}>${i18n.import.cancel}</button>
      ${right}`;
  }

  function renderImportBody() {
    if (!rootEl) return;
    const body = rootEl.querySelector('#myio-goals-import-body');
    const footer = rootEl.querySelector('#myio-goals-import-footer');
    if (body) body.innerHTML = renderImportInner();
    if (footer) footer.innerHTML = renderImportFooter();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tiny inline icon set (SVG) — keyed names used above
  // ───────────────────────────────────────────────────────────────────────────

  function icon(name) {
    const S = (p) => `<svg class="myio-goals-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    switch (name) {
      case 'target':
      case 'target-lg':
        return `<svg class="myio-goals-ic ${name === 'target-lg' ? 'myio-goals-ic-lg' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
      case 'history':
      case 'clock':
        return S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
      case 'pencil':
      case 'pencil-sm':
        return `<svg class="myio-goals-ic ${name === 'pencil-sm' ? 'myio-goals-ic-sm' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
      case 'save':
        return S('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>');
      case 'eye':
        return S('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>');
      case 'upload':
      case 'upload-sm':
        return `<svg class="myio-goals-ic ${name === 'upload-sm' ? 'myio-goals-ic-sm' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>`;
      case 'download':
        return S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>');
      case 'calendar':
        return S('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');
      case 'calendar-range':
        return S('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M17 14h-6M9 18H8"/>');
      case 'calendar-days':
        return S('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>');
      case 'trend':
        return S('<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>');
      case 'sigma':
        return S('<path d="M18 7V4H6l6 8-6 8h12v-3"/>');
      case 'home':
        return S('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>');
      case 'chevron':
      case 'chevron-sm':
        return `<svg class="myio-goals-ic ${name === 'chevron-sm' ? 'myio-goals-ic-sm' : 'myio-goals-ic-sm'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
      case 'alert':
      case 'alert-sm':
      case 'alert-lg':
        return `<svg class="myio-goals-ic ${name === 'alert-lg' ? 'myio-goals-ic-lg' : name === 'alert-sm' ? 'myio-goals-ic-sm' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`;
      case 'check':
        return S('<path d="M20 6L9 17l-5-5"/>');
      case 'trash-sm':
        return `<svg class="myio-goals-ic myio-goals-ic-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
      case 'spinner':
        return `<svg class="myio-goals-ic myio-goals-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg>`;
      default:
        return '';
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Styles
  // ───────────────────────────────────────────────────────────────────────────

  function injectStyles() {
    const id = 'myio-goals-gcdr-styles';
    const prev = document.getElementById(id);
    if (prev) prev.remove();
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .myio-goals-overlay { position: fixed; inset: 0; z-index: ${theme.zIndex}; font-family: ${theme.fontFamily}; }
      .myio-goals-backdrop { position: absolute; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(3px); }
      .myio-goals-backdrop-2 { z-index: 1; }
      .myio-goals-dialog { position: relative; z-index: 2; width: 94%; max-width: 1080px; margin: 3vh auto; max-height: 94vh; display: flex; }
      .myio-goals-card { background: #fff; border-radius: ${theme.borderRadius}; box-shadow: 0 24px 70px rgba(0,0,0,.35); display: flex; flex-direction: column; width: 100%; max-height: 94vh; overflow: hidden; }
      .myio-goals-body { padding: 18px 22px 24px; overflow-y: auto; }

      .myio-goals-ic { width: 16px; height: 16px; vertical-align: -3px; }
      .myio-goals-ic-sm { width: 13px; height: 13px; vertical-align: -2px; }
      .myio-goals-ic-lg { width: 40px; height: 40px; }
      .myio-goals-spin { animation: myio-goals-spin 0.9s linear infinite; }
      @keyframes myio-goals-spin { to { transform: rotate(360deg); } }
      .myio-goals-glyph { font-style: italic; font-family: Georgia, serif; font-size: 15px; }

      .myio-goals-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; }
      .myio-goals-selects { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
      .myio-goals-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; font-weight: 600; }
      .myio-goals-field select { padding: 8px 10px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #0f172a; }
      .myio-goals-field select:focus { outline: none; border-color: ${theme.accent}; box-shadow: 0 0 0 3px ${theme.accentSoft}; }
      .myio-goals-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .myio-goals-chip { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 600; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; }
      .myio-goals-chip-accent { color: ${theme.accent}; background: ${theme.accentSoft}; border-color: ${theme.accentSoft}; }
      .myio-goals-chip-violet { color: ${theme.violet}; background: rgba(108,92,231,0.10); border-color: rgba(108,92,231,0.18); }
      .myio-goals-chip-mono { font-family: ui-monospace, Menlo, monospace; }
      .myio-goals-chip-red { color: ${theme.danger}; background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.18); }
      .myio-goals-chip-green { color: #15803d; background: rgba(21,128,61,0.08); border-color: rgba(21,128,61,0.18); }
      .myio-goals-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      /* RFC-0052: linha de edição da margem da meta */
      .myio-goals-margin-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding: 10px 12px; border: 1px dashed rgba(108,92,231,0.35); border-radius: 10px; background: rgba(108,92,231,0.04); }
      .myio-goals-margin-label { font-size: 12px; font-weight: 800; color: ${theme.violet}; }
      .myio-goals-margin-row input { width: 90px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font: 700 13px ${theme.fontFamily}; color: #1e293b; }
      .myio-goals-margin-pct { font-size: 12px; font-weight: 700; color: #64748b; }
      .myio-goals-btn-sm { padding: 6px 10px; font-size: 12px; }
      .myio-goals-margin-hint { font-size: 11px; color: #94a3b8; }

      .myio-goals-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; transition: all .15s; font-family: inherit; }
      .myio-goals-btn:disabled { opacity: .55; cursor: not-allowed; }
      .myio-goals-btn-primary { background: ${theme.accent}; color: #fff; }
      .myio-goals-btn-primary:hover:not(:disabled) { filter: brightness(.94); }
      .myio-goals-btn-outline { background: #fff; color: #334155; border-color: #cbd5e1; }
      .myio-goals-btn-outline:hover:not(:disabled) { background: #f1f5f9; }

      .myio-goals-alert { display: flex; align-items: flex-start; gap: 8px; padding: 11px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; border: 1px solid; }
      .myio-goals-alert-amber { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
      .myio-goals-alert-red { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
      .myio-goals-alert-green { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }

      .myio-goals-center { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 50px 20px; color: #94a3b8; font-size: 14px; }
      .myio-goals-center-col { flex-direction: column; text-align: center; }
      .myio-goals-center-col p { margin: 6px 0 12px; color: #64748b; }

      .myio-goals-kpis { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
      @media (min-width: 640px) { .myio-goals-kpis { grid-template-columns: repeat(3,1fr); } }
      @media (min-width: 1000px) { .myio-goals-kpis { grid-template-columns: repeat(6,1fr); } }
      .myio-goals-kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px; background: #fff; }
      .myio-goals-kpi-label { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 5px; }
      .myio-goals-kpi-label .myio-goals-ic { color: ${theme.accent}; }
      .myio-goals-kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }

      .myio-goals-topgrid { display: grid; gap: 14px; margin-top: 18px; }
      @media (min-width: 768px) { .myio-goals-topgrid { grid-template-columns: 1fr 1fr; } }
      .myio-goals-topcard { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
      .myio-goals-topcard h4 { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 800; color: #334155; margin: 0 0 10px; }
      .myio-goals-topcard h4 .myio-goals-ic { color: ${theme.accent}; }
      .myio-goals-topcard ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .myio-goals-topcard li { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
      .myio-goals-rank { display: flex; align-items: center; gap: 8px; color: #334155; }
      .myio-goals-rank-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 999px; background: ${theme.accentSoft}; color: ${theme.accent}; font-size: 11px; font-weight: 800; }
      .myio-goals-rank-val { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
      .myio-goals-hint { font-size: 11px; color: #94a3b8; margin: 16px 0 0; }
      .myio-goals-muted { color: #94a3b8; font-size: 13px; }

      .myio-goals-crumb { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 13px; margin-bottom: 12px; }
      .myio-goals-crumb button, .myio-goals-crumb span.active { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; border: none; background: transparent; cursor: pointer; color: #64748b; font-family: inherit; font-size: 13px; }
      .myio-goals-crumb button:hover { background: #f1f5f9; color: #334155; }
      .myio-goals-crumb .active { color: ${theme.accent}; font-weight: 800; }
      .myio-goals-crumb .myio-goals-ic { color: #cbd5e1; }
      .myio-goals-microhint { font-size: 11px; color: #94a3b8; margin: 0 0 8px; }

      .myio-goals-grid { display: grid; gap: 10px; }
      .myio-goals-grid-month { grid-template-columns: repeat(2,1fr); }
      .myio-goals-grid-day { grid-template-columns: repeat(3,1fr); }
      .myio-goals-grid-hour { grid-template-columns: repeat(3,1fr); }
      @media (min-width: 640px) { .myio-goals-grid-month { grid-template-columns: repeat(3,1fr); } .myio-goals-grid-day { grid-template-columns: repeat(5,1fr); } .myio-goals-grid-hour { grid-template-columns: repeat(4,1fr); } }
      @media (min-width: 1000px) { .myio-goals-grid-month { grid-template-columns: repeat(4,1fr); } .myio-goals-grid-day { grid-template-columns: repeat(7,1fr); } .myio-goals-grid-hour { grid-template-columns: repeat(6,1fr); } }
      .myio-goals-cell { border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; padding: 10px; }
      .myio-goals-cell-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
      .myio-goals-cell-drill { display: inline-flex; align-items: center; gap: 2px; border: none; background: transparent; cursor: pointer; color: ${theme.accent}; font-size: 12px; font-weight: 700; padding: 0; font-family: inherit; }
      .myio-goals-cell-drill:hover { text-decoration: underline; }
      .myio-goals-cell-label { font-size: 12px; font-weight: 700; color: #64748b; }
      .myio-goals-cell-head .myio-goals-ic { color: ${theme.accent}; opacity: .6; }
      .myio-goals-cell-input { display: flex; align-items: center; gap: 6px; }
      .myio-goals-cell-input input { width: 100%; padding: 6px 8px; font-size: 13px; text-align: right; border: 1px solid #cbd5e1; border-radius: 7px; color: #0f172a; }
      .myio-goals-cell-input input:focus { outline: none; border-color: ${theme.accent}; box-shadow: 0 0 0 3px ${theme.accentSoft}; }
      .myio-goals-cell-unit { font-size: 11px; font-family: ui-monospace, monospace; color: #94a3b8; flex-shrink: 0; }
      .myio-goals-confirmed { margin: 5px 0 0; font-size: 10px; color: ${theme.accent}; font-weight: 700; }

      .myio-goals-total { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding: 11px 16px; border-radius: 10px; border: 1px solid ${theme.accentSoft}; background: ${theme.accentSoft}; }
      .myio-goals-total-label { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: ${theme.accent}; }
      .myio-goals-total-val { font-size: 14px; font-weight: 800; color: #064e3b; font-variant-numeric: tabular-nums; }
      .myio-goals-legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; font-size: 11px; color: #94a3b8; }
      .myio-goals-legend span { display: inline-flex; align-items: center; gap: 5px; }

      .myio-goals-history { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      .myio-goals-history-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; }
      .myio-goals-history-head h3 { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 800; color: ${theme.violet}; margin: 0; }
      .myio-goals-history-meta { font-size: 12px; color: #94a3b8; }
      .myio-goals-hist-empty { padding: 28px 10px; }
      .myio-goals-timeline { list-style: none; margin: 0; padding: 0 0 0 14px; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 20px; }
      .myio-goals-tl-item { position: relative; padding-left: 16px; }
      .myio-goals-tl-dot { position: absolute; left: -27px; top: -2px; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: rgba(108,92,231,0.14); color: ${theme.violet}; box-shadow: 0 0 0 4px #fff; }
      .myio-goals-tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .myio-goals-tl-title { font-size: 13px; font-weight: 800; color: #0f172a; }
      .myio-goals-tl-ver { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; color: #64748b; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; }
      .myio-goals-tl-meta { font-size: 11px; color: #94a3b8; margin: 2px 0 0; }
      .myio-goals-tl-records { font-size: 13px; color: #475569; margin: 4px 0 0; }
      .myio-goals-tl-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .myio-goals-tl-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 2px 7px; font-size: 11px; font-family: ui-monospace, monospace; color: #475569; }
      .myio-goals-tl-ref { color: #94a3b8; }
      .myio-goals-tl-more { font-size: 11px; color: #94a3b8; padding: 2px 4px; }

      /* CSV import modal */
      .myio-goals-import-dialog { position: fixed; inset: 0; z-index: 3; display: flex; align-items: flex-start; justify-content: center; padding: 4vh 16px; pointer-events: none; }
      .myio-goals-import-card { pointer-events: auto; background: #fff; border-radius: ${theme.borderRadius}; box-shadow: 0 24px 70px rgba(0,0,0,.4); width: 100%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
      .myio-goals-import-header { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
      .myio-goals-import-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 999px; background: ${theme.accentSoft}; color: ${theme.accent}; flex-shrink: 0; }
      .myio-goals-import-header h3 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
      .myio-goals-import-header p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
      .myio-goals-import-x { margin-left: auto; border: none; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; color: #94a3b8; }
      .myio-goals-import-x:hover { color: #334155; }
      .myio-goals-import-body { padding: 16px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
      .myio-goals-import-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 18px; border-top: 1px solid #e2e8f0; }
      .myio-goals-import-hint { border: 1px solid ${theme.accentSoft}; background: ${theme.accentSoft}; border-radius: 10px; padding: 11px 13px; }
      .myio-goals-import-hint p { margin: 0 0 6px; font-size: 12px; color: ${theme.accent}; }
      .myio-goals-import-hint code { display: block; white-space: pre; background: rgba(255,255,255,.7); border-radius: 6px; padding: 7px 9px; font-size: 11px; font-family: ui-monospace, monospace; color: #064e3b; }
      .myio-goals-import-inputhead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      .myio-goals-import-inputhead label { font-size: 13px; font-weight: 700; color: #334155; }
      .myio-goals-import-links { display: flex; flex-wrap: wrap; gap: 12px; }
      .myio-goals-import-links button { display: inline-flex; align-items: center; gap: 5px; border: none; background: transparent; cursor: pointer; color: ${theme.accent}; font-size: 12px; font-weight: 700; font-family: inherit; padding: 0; }
      .myio-goals-import-links button:hover { text-decoration: underline; }
      .myio-goals-import-input textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 11px; font-family: ui-monospace, monospace; font-size: 12px; color: #0f172a; resize: vertical; }
      .myio-goals-import-input textarea:focus { outline: none; border-color: ${theme.accent}; box-shadow: 0 0 0 3px ${theme.accentSoft}; }
      .myio-goals-import-summary { display: flex; flex-direction: column; gap: 12px; }
      .myio-goals-import-counts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .myio-goals-import-willapply { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 11px 13px; }
      .myio-goals-import-willapply p { margin: 0 0 7px; font-size: 12px; font-weight: 700; color: #475569; }
      .myio-goals-import-willapply div { display: flex; flex-wrap: wrap; gap: 6px; }
      .myio-goals-import-diags { border: 1px solid #fca5a5; border-radius: 10px; overflow: hidden; }
      .myio-goals-import-diags-title { margin: 0; padding: 8px 12px; background: #fef2f2; border-bottom: 1px solid #fecaca; font-size: 12px; font-weight: 700; color: #991b1b; }
      .myio-goals-import-diags ul { list-style: none; margin: 0; padding: 0; max-height: 190px; overflow-y: auto; }
      .myio-goals-import-diags li { display: flex; align-items: flex-start; gap: 7px; padding: 7px 12px; font-size: 12px; color: #475569; border-bottom: 1px solid #fee2e2; }
      .myio-goals-import-diags li .myio-goals-ic { color: ${theme.danger}; flex-shrink: 0; margin-top: 1px; }
      .myio-goals-diag-line { font-family: ui-monospace, monospace; font-weight: 700; color: ${theme.danger}; }
      .myio-goals-diag-bucket { font-family: ui-monospace, monospace; color: #94a3b8; }
      .myio-goals-import-log { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
      .myio-goals-import-log-title { margin: 0; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #475569; }
      .myio-goals-import-log ul { list-style: none; margin: 0; padding: 8px 12px; max-height: 190px; overflow-y: auto; }
      .myio-goals-import-log li { font-family: ui-monospace, monospace; font-size: 11px; color: #64748b; padding: 2px 0; }
    `;
    document.head.appendChild(style);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // i18n
  // ───────────────────────────────────────────────────────────────────────────

  function getStrings(loc) {
    if (loc === 'en-US') {
      return {
        modalTitle: 'Consumption Goals',
        domainLabel: 'Domain',
        yearLabel: 'Year',
        domains: { ENERGY: 'Energy', WATER: 'Water', TEMPERATURE: 'Temperature' },
        aggregation: { SUM: 'Sum', AVERAGE: 'Average' },
        currentVersion: 'Current version: v{n}',
        enableEditing: 'Enable editing',
        viewSummary: 'View summary',
        save: 'Save',
        saving: 'Saving…',
        importBtn: 'Import CSV',
        downloadHourlyExample: 'Download hourly example',
        loading: 'Loading…',
        retry: 'Retry',
        noData: 'No goals set for {year}.',
        empty: 'No goals set yet. Fill in the months below.',
        saveSuccess: 'Goals saved successfully!',
        versionConflict:
          'The goal was modified by another change. We reloaded the latest version — review and save again.',
        confirmedBadge: 'Confirmed',
        legendEditable: 'Editable',
        legendComputed: 'Computed (read-only)',
        breadcrumbYear: 'Year {year}',
        breadcrumbDay: 'Day {day}',
        dayCell: 'Day {day}',
        monthTotal: 'Month total',
        monthAverage: 'Month average',
        dayTotal: 'Day total',
        dayAverage: 'Day average',
        drill: {
          openMonthHint: 'Click a month to break it down by day.',
          openDayHint: 'Click a day to break it down by hour.',
          openTitle: 'Drill down',
        },
        summary: {
          year: 'Year',
          yearTotal: 'Annual total',
          yearAverage: 'Annual average',
          monthsWithGoal: 'Months with a goal',
          daysWithGoal: 'Days with a goal',
          avgPerMonth: 'Average per month',
          avgPerDay: 'Average per day',
          topMonths: 'Top 3 months',
          topDays: 'Top 3 days',
          hint: 'Read-only summary. Click “Enable editing” to change the goals.',
          yearAdjusted: 'Adjusted annual total',
        },
        margin: {
          label: 'Goal margin',
          chip: 'Margin: {v}',
          chipTitle: 'Management margin applied on top of the imported curve (RFC-0052)',
          save: 'Save margin',
          clear: 'Clear',
          hint: 'Signed % applied to every point of the curve (e.g. −5 → targets at 95%).',
          invalid: 'Margin must be between −100 and +100.',
          saveFailed: 'Failed to save the margin.',
        },
        levels: { YEAR: 'Year', MONTH: 'Month', DAY: 'Day', HOUR: 'Hour' },
        months: {
          '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
          '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
        },
        time: { now: 'just now', min: '{n}m ago', hour: '{n}h ago', day: '{n}d ago' },
        history: {
          title: 'Version history',
          empty: 'No changes recorded.',
          system: 'System',
          records: '{n} records',
          moreDetails: '+{n} more',
          source: {
            IMPORT: 'Spreadsheet import',
            REPLACE: 'Goals edit',
            MERGE: 'Goals edit',
            EDIT: 'Goals edit',
            DELETE: 'Goal removal',
            MARGIN: 'Goal margin',
          },
        },
        import: {
          title: 'Import goals (CSV)',
          subtitle: '{domain} · {year}',
          formatHint: 'Header bucket,value. Refs: 2026 / 2026-03 / 2026-03-15 / 2026-03-15T08.',
          csvLabel: 'CSV',
          downloadTemplate: 'Download template',
          downloadHourlyExample: 'Hourly example',
          uploadFile: 'Upload file',
          unitNote: 'Values in {unit}.',
          preview: 'Preview',
          confirm: 'Apply {n}',
          cancel: 'Cancel',
          done: 'Done',
          okCount: '{n} valid',
          errorCount: '{n} with error',
          appliedBadge: 'Applied (v{version})',
          previewBadge: 'Preview',
          willApply: 'Will apply by level:',
          diagnosticsTitle: 'Rejected lines',
          logTitle: 'Apply log',
          line: 'Line {line}:',
          conflict: 'Version conflict — reload and try again.',
        },
      };
    }
    return {
      modalTitle: 'Metas de Consumo',
      domainLabel: 'Domínio',
      yearLabel: 'Ano',
      domains: { ENERGY: 'Energia', WATER: 'Água', TEMPERATURE: 'Temperatura' },
      aggregation: { SUM: 'Soma', AVERAGE: 'Média' },
      currentVersion: 'Versão atual: v{n}',
      enableEditing: 'Habilitar edição',
      viewSummary: 'Ver resumo',
      save: 'Salvar',
      saving: 'Salvando…',
      importBtn: 'Importar CSV',
      downloadHourlyExample: 'Baixar exemplo horário',
      loading: 'Carregando…',
      retry: 'Tentar novamente',
      noData: 'Nenhuma meta definida para {year}.',
      empty: 'Nenhuma meta definida ainda. Preencha os meses abaixo.',
      saveSuccess: 'Metas salvas com sucesso!',
      versionConflict:
        'A meta foi alterada por outra operação. Recarregamos a versão mais recente — revise e salve novamente.',
      confirmedBadge: 'Confirmado',
      legendEditable: 'Editável',
      legendComputed: 'Calculado (somente leitura)',
      breadcrumbYear: 'Ano {year}',
      breadcrumbDay: 'Dia {day}',
      dayCell: 'Dia {day}',
      monthTotal: 'Total do mês',
      monthAverage: 'Média do mês',
      dayTotal: 'Total do dia',
      dayAverage: 'Média do dia',
      drill: {
        openMonthHint: 'Clique em um mês para detalhar por dia.',
        openDayHint: 'Clique em um dia para detalhar por hora.',
        openTitle: 'Detalhar',
      },
      summary: {
        year: 'Ano',
        yearTotal: 'Total anual',
        yearAverage: 'Média anual',
        monthsWithGoal: 'Meses com meta',
        daysWithGoal: 'Total de registros',
        avgPerMonth: 'Média por mês',
        avgPerDay: 'Média por dia',
        topMonths: 'Top 3 meses',
        topDays: 'Top 3 dias',
        hint: 'Resumo somente leitura. Clique em “Habilitar edição” para alterar as metas.',
        yearAdjusted: 'Total anual ajustado',
      },
      margin: {
        label: 'Margem da meta',
        chip: 'Margem: {v}',
        chipTitle: 'Margem de gestão aplicada sobre a curva importada (RFC-0052)',
        save: 'Salvar margem',
        clear: 'Limpar',
        hint: '% com sinal aplicada a todos os pontos da curva (ex.: −5 → metas a 95%).',
        invalid: 'A margem deve estar entre −100 e +100.',
        saveFailed: 'Falha ao salvar a margem.',
      },
      levels: { YEAR: 'Ano', MONTH: 'Mês', DAY: 'Dia', HOUR: 'Hora' },
      months: {
        '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
        '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
      },
      time: { now: 'agora', min: 'há {n}min', hour: 'há {n}h', day: 'há {n}d' },
      history: {
        title: 'Histórico de versões',
        empty: 'Nenhuma alteração registrada.',
        system: 'Sistema',
        records: '{n} registros',
        moreDetails: '+{n} mais',
        source: {
          IMPORT: 'Importação de planilha',
          REPLACE: 'Edição de metas',
          MERGE: 'Edição de metas',
          EDIT: 'Edição de metas',
          DELETE: 'Remoção de meta',
          MARGIN: 'Margem da meta',
        },
      },
      import: {
        title: 'Importar metas (CSV)',
        subtitle: '{domain} · {year}',
        formatHint: 'Cabeçalho bucket,value. Refs: 2026 / 2026-03 / 2026-03-15 / 2026-03-15T08.',
        csvLabel: 'CSV',
        downloadTemplate: 'Baixar modelo',
        downloadHourlyExample: 'Exemplo horário',
        uploadFile: 'Enviar arquivo',
        unitNote: 'Valores em {unit}.',
        preview: 'Pré-visualizar',
        confirm: 'Aplicar {n}',
        cancel: 'Cancelar',
        done: 'Concluir',
        okCount: '{n} válidas',
        errorCount: '{n} com erro',
        appliedBadge: 'Aplicado (v{version})',
        previewBadge: 'Pré-visualização',
        willApply: 'Será aplicado por nível:',
        diagnosticsTitle: 'Linhas rejeitadas',
        logTitle: 'Log de aplicação',
        line: 'Linha {line}:',
        conflict: 'Conflito de versão — recarregue e tente novamente.',
      },
    };
  }

  mount();
  return instance;
}
