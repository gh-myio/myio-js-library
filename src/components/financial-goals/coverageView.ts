/**
 * RFC-0228 A4 — Honest coverage UI (reusable renderer for A2a / A3).
 *
 * A pure, framework-agnostic renderer that takes a normalized {@link MoneyOverlay}
 * (from F0, `moneyTypes.ts`) and honestly describes the R$ coverage state. It is
 * the UX face of the backend's honesty discipline (GCDR RFC-0054 DEC-6; API guide
 * §4.2): coverage states are 200-body outcomes, **never errors and never R$ 0**.
 *
 * States rendered:
 *  1. `unavailable` (reason `MONEY_REQUIRES_DEVICE_GRANULARITY`) — a clear panel:
 *     the money view needs a device-granular goal with a tariff category. Offers a
 *     generic deep-link to the categorization UI (A5a) when a callback is given.
 *  2. `available` + `coverageComplete:true` — a quiet "cobertura completa" chip so
 *     the caller can show the R$ with confidence. No uncategorized/gaps noise.
 *  3. `available` + `coverageComplete:false` — the key honest state: an "incomplete"
 *     badge with the covered fraction (`pricedHours`/`totalHours` DEVICE-hours as a
 *     %), the `uncategorizedDevices` list (each a click affordance firing
 *     `onCategorizeDevice(deviceId)` — the A5a deep-link), the `tariffCoverageGaps`
 *     summary, and wording that the R$ is a partial covered sum, never a total.
 *
 * ── WORDING CONTRACT (RFC-0228 feedback §8) — DO NOT DRIFT ──────────────────────
 * This is coverage/estimation UX, not billing. ALLOWED: "Projeção",
 * "Estimativa em R$", "Cobertura incompleta". FORBIDDEN (never emit): "Fatura",
 * "Faturamento", "Valor final", "Total a pagar". Any future edit that introduces a
 * billing-grade word breaks the honesty contract and the wording tests.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Design rules (mirroring the F0/A1 modules on this branch):
 *  - **Pure component.** DOM/HTML output + callbacks only. No `fetch`, no
 *    ThingsBoard, no API calls. It receives a `MoneyOverlay`; it never fetches one.
 *  - **Never render `NaN`/`R$ 0`.** The covered percent is guarded (missing/zero
 *    denominator → `—`); no money amount is fabricated here.
 *  - Theme-aware (light/dark), Nunito, id-guarded CSS-in-JS injection.
 */

import type { MoneyOverlay, UncategorizedDevice, TariffCoverageGaps } from './moneyTypes';
import { MONEY_REQUIRES_DEVICE_GRANULARITY } from './moneyTypes';
import { DASH } from './moneyFormat';
import { injectCoverageStyles } from './coverageStyles';

/** Options for {@link renderCoverageView}. */
export interface CoverageViewOptions {
  /**
   * Deep-link to A5a — fired when the user clicks an uncategorized device in the
   * `coverageComplete:false` state. A4 does NOT implement categorization; it only
   * surfaces the affordance and hands back the `deviceId`.
   */
  onCategorizeDevice?: (deviceId: string) => void;
  /**
   * Generic deep-link for the `unavailable` state (no specific device to point at).
   * When provided, an "Gerenciar categorias de tarifa" button is offered so the
   * user can reach the A5a categorization UI. Kept separate from
   * {@link onCategorizeDevice} so the per-device contract stays a clean `(id)`.
   */
  onManageCategories?: () => void;
  /** Document to build in (defaults to the ambient `document`). */
  document?: Document;
}

/** ---- pt-BR helpers (pure strings; no float round-trips for money) ---- */

/** Group an integer with pt-BR thousands dots: `61320` → `"61.320"`. */
function groupInt(n: number): string {
  return String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Covered fraction as a pt-BR percent string, or {@link DASH} when it cannot be
 * computed honestly (missing or non-positive denominator). Never `NaN`.
 */
export function coveragePercentLabel(
  pricedHours: number | undefined,
  totalHours: number | undefined
): string {
  if (
    typeof pricedHours !== 'number' ||
    typeof totalHours !== 'number' ||
    !Number.isFinite(pricedHours) ||
    !Number.isFinite(totalHours) ||
    totalHours <= 0
  ) {
    return DASH;
  }
  const pct = (pricedHours / totalHours) * 100;
  if (!Number.isFinite(pct)) return DASH;
  const rounded = Math.round(pct * 10) / 10;
  // Drop a trailing ",0" for whole percentages.
  const txt = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${txt}%`;
}

/** Escape untrusted device label/code text for safe HTML interpolation. */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Human display name for a device: label → code → id, all escaped. */
function deviceDisplayName(d: UncategorizedDevice): string {
  return esc(d.label || d.code || d.deviceId || 'Dispositivo');
}

/** ---- HTML builders (pure; no callbacks, no DOM) ---- */

function unavailableHTML(reason: string, offerDeepLink: boolean): string {
  // Only the device-granularity reason gets the tailored copy; any other reason
  // still renders honestly (no error, no R$ 0) with the generic message.
  const isGranularity = reason === MONEY_REQUIRES_DEVICE_GRANULARITY;
  const msg = isGranularity
    ? 'A meta precisa ser por dispositivo (device-granular) com categoria de tarifa.'
    : 'Visão em R$ não disponível para esta meta.';
  const deepLink = offerDeepLink
    ? `<button type="button" class="myio-cov__deeplink" data-cov-manage="1">Gerenciar categorias de tarifa</button>`
    : '';
  return (
    `<div class="myio-cov__panel" role="status">` +
    `<div class="myio-cov__panel-title"><span aria-hidden="true">💸</span>Visão em R$ indisponível</div>` +
    `<p class="myio-cov__panel-msg">${msg}</p>` +
    deepLink +
    `</div>`
  );
}

function completeHTML(): string {
  return (
    `<span class="myio-cov__complete" role="status">` +
    `<span aria-hidden="true">✓</span>Cobertura completa` +
    `</span>`
  );
}

function devicesHTML(devices: UncategorizedDevice[]): string {
  if (!devices.length) return '';
  const items = devices
    .map((d) => {
      const name = deviceDisplayName(d);
      const code = d.code ? `<span class="myio-cov__device-code">${esc(d.code)}</span>` : '';
      return (
        `<li>` +
        `<button type="button" class="myio-cov__device" data-cov-device="${esc(d.deviceId)}">` +
        `<span class="myio-cov__device-label">${name}</span>` +
        code +
        `<span class="myio-cov__device-cta">Categorizar →</span>` +
        `</button>` +
        `</li>`
      );
    })
    .join('');
  return (
    `<div class="myio-cov__section-title">Dispositivos sem categoria de tarifa</div>` +
    `<ul class="myio-cov__devices">${items}</ul>`
  );
}

function gapsHTML(gaps: TariffCoverageGaps | undefined): string {
  if (!gaps) return '';
  const hours =
    typeof gaps.missingHours === 'number' && Number.isFinite(gaps.missingHours)
      ? groupInt(gaps.missingHours)
      : DASH;
  const truncated = gaps.truncated
    ? `<span class="myio-cov__gaps-truncated">Lista de horas resumida (truncada).</span>`
    : '';
  return (
    `<div class="myio-cov__gaps" role="status">` +
    `<span><strong>${hours}</strong> horas-dispositivo sem tarifa.</span>` +
    truncated +
    `</div>`
  );
}

function incompleteHTML(
  overlay: Extract<MoneyOverlay, { state: 'available' }>
): string {
  const pctLabel = coveragePercentLabel(overlay.pricedHours, overlay.totalHours);
  const hoursDetail =
    typeof overlay.pricedHours === 'number' && typeof overlay.totalHours === 'number'
      ? `<span class="myio-cov__hours">${groupInt(overlay.pricedHours)} / ${groupInt(
          overlay.totalHours
        )} horas-dispositivo cobertas</span>`
      : '';
  return (
    `<span class="myio-cov__badge" role="status">` +
    `<span aria-hidden="true">⚠️</span>Cobertura incompleta` +
    `<span class="myio-cov__badge-pct">${pctLabel}</span>` +
    `</span>` +
    hoursDetail +
    `<p class="myio-cov__note">A Estimativa em R$ é uma soma parcial coberta, não um total.</p>` +
    devicesHTML(overlay.uncategorizedDevices) +
    gapsHTML(overlay.tariffCoverageGaps)
  );
}

/**
 * Build the coverage UI as an HTML **string** (pure — no DOM, no callbacks). Used
 * internally by {@link renderCoverageView} and directly testable for wording.
 * `offerDeepLink` only affects the `unavailable` state's generic manage button.
 */
export function buildCoverageHTML(
  overlay: MoneyOverlay,
  offerDeepLink = false
): string {
  if (!overlay || (overlay as { state?: string }).state == null) {
    // Defensive: an absent overlay is treated as unavailable, never an error.
    return unavailableHTML(MONEY_REQUIRES_DEVICE_GRANULARITY, offerDeepLink);
  }
  if (overlay.state === 'unavailable') {
    return unavailableHTML(overlay.reason, offerDeepLink);
  }
  // available
  if (overlay.coverageComplete) {
    return completeHTML();
  }
  return incompleteHTML(overlay);
}

/**
 * Render the honest coverage UI for a {@link MoneyOverlay} as a live DOM element,
 * wiring the A5a deep-link callbacks. Injects the (id-guarded) stylesheet.
 *
 * The returned element carries a `data-cov-state` attribute (`available-complete`
 * | `available-incomplete` | `unavailable`) for callers/tests.
 */
export function renderCoverageView(
  overlay: MoneyOverlay,
  options: CoverageViewOptions = {}
): HTMLElement {
  const doc = options.document || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    throw new Error('renderCoverageView requires a document (pass options.document in non-DOM envs).');
  }
  injectCoverageStyles(doc);

  const offerDeepLink =
    (!overlay || overlay.state === 'unavailable') && typeof options.onManageCategories === 'function';

  const root = doc.createElement('div');
  root.className = 'myio-cov';
  root.setAttribute(
    'data-cov-state',
    !overlay || overlay.state === 'unavailable'
      ? 'unavailable'
      : overlay.coverageComplete
      ? 'available-complete'
      : 'available-incomplete'
  );
  root.innerHTML = buildCoverageHTML(overlay, offerDeepLink);

  // Wire per-device deep-links (A5a). A4 only fires the callback with the id.
  if (typeof options.onCategorizeDevice === 'function') {
    const cb = options.onCategorizeDevice;
    root.querySelectorAll<HTMLElement>('[data-cov-device]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = btn.getAttribute('data-cov-device') || '';
        cb(id);
      });
    });
  }

  // Wire the generic manage-categories deep-link (unavailable state).
  if (offerDeepLink && typeof options.onManageCategories === 'function') {
    const mcb = options.onManageCategories;
    const manageBtn = root.querySelector<HTMLElement>('[data-cov-manage]');
    if (manageBtn) {
      manageBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        mcb();
      });
    }
  }

  return root;
}
