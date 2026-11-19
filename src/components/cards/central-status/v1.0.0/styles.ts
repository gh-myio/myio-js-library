/**
 * CentralStatusCard v1.0.0 — injected styles (RFC-0231)
 * Class prefix: myio-cscard__ · theme via [data-theme] attribute + CSS custom properties.
 * Accent palette mirrors createDivCard's ACCENTS vocabulary (emerald/rose/amber/slate).
 */

const STYLE_ID = 'myio-central-status-card-styles';

const CSS = `
.myio-cscard{
  --cscard-surface:#ffffff;
  --cscard-border:#e2e8f0;
  --cscard-text:#1e293b;
  --cscard-muted:#64748b;
  --cscard-head-bg:#f8fafc;
  --cscard-accent-band:#f8fafc;
  --cscard-accent-border:#e2e8f0;
  --cscard-accent-title:#475569;
  /* connectivity axis (header wash + badge) — ONLINE reads confident blue,
     the other three stay deliberately subtle/pastel per spec. */
  --cscard-online:#1d4ed8;
  --cscard-online-bg:#eff6ff;
  --cscard-online-chip-bg:#3b82f6;
  --cscard-online-chip-fg:#ffffff;
  --cscard-warning:#92400e;
  --cscard-warning-bg:#fffbeb;
  --cscard-offline:#9f1239;
  --cscard-offline-bg:#fff1f2;
  --cscard-unknown:#475569;
  --cscard-unknown-bg:#f8fafc;
  /* registry axis (card border) — independent of connectivity. */
  --cscard-border-active:#22c55e;
  --cscard-border-active-glow:rgba(34,197,94,.28);
  --cscard-border-inactive:#94a3b8;
  --cscard-switch-off:#cbd5e1;
  --cscard-switch-on:#2563eb;
  --cscard-danger:#dc2626;
  --cscard-select-ring:#7c3aed;
  /* health axis (GCDR RFC-0085) — ONLY the dot of the v3 badge and the
     "Sistema" pills. Deliberately never the border or the header wash:
     those two already belong to entityStatus and connectivity. */
  --cscard-health-ok:#22c55e;
  --cscard-health-warn:#f59e0b;
  --cscard-health-bad:#ef4444;
  --cscard-health-silent:#94a3b8;
  --cscard-health-pill-bg:#f1f5f9;
  --cscard-health-pill-fg:#334155;
  box-sizing:border-box;
  position:relative;
  display:flex;flex-direction:row;
  border:1px solid var(--cscard-border);
  border-radius:12px;
  font-family:'Nunito', system-ui, sans-serif;
  color:var(--cscard-text);
  transition:border-color .2s, box-shadow .2s;
}
/* The root deliberately does NOT clip (no overflow:hidden) — the notification
   badges (further below) are root-level children positioned to hang half
   outside the visible card, straddling its outer border ("linha limite do
   card"). All the corner-rounded VISUAL surface (header wash, action column
   background, row content) lives one level down in .myio-cscard__surface,
   which does clip — so the badges escape rounding/clipping while the card's
   own look stays identical. */
.myio-cscard__surface{
  position:relative;display:flex;flex-direction:row;flex:1;min-width:0;
  overflow:hidden;border-radius:11px;background:var(--cscard-surface);
}
/* Surface is a row so an optional left action column (v6.0.0-style piano-keys)
   can sit beside the content; the content wrapper carries the card's own
   internal layout (column for 'card', row for 'compact' — see below). */
.myio-cscard__content{position:relative;display:flex;flex-direction:column;flex:1;min-width:0;}
.myio-cscard *{box-sizing:border-box;}
.myio-cscard[data-theme="dark"]{
  --cscard-surface:#0f1a2c;
  --cscard-border:rgba(148,163,184,.22);
  --cscard-text:#e2e8f0;
  --cscard-muted:#94a3b8;
  --cscard-head-bg:#16233a;
  --cscard-online-bg:#122036;
  --cscard-warning-bg:#2a2113;
  --cscard-offline-bg:#2a1420;
  --cscard-unknown-bg:#16233a;
  --cscard-border-active-glow:rgba(34,197,94,.4);
  --cscard-border-inactive:#475569;
  --cscard-switch-off:#475569;
  --cscard-health-pill-bg:#1e2d45;
  --cscard-health-pill-fg:#cbd5e1;
}

/* ── registry axis: card border follows entityStatus, not connectivity ── */
.myio-cscard[data-status="ACTIVE"]{
  border-color:var(--cscard-border-active);
  box-shadow:0 0 0 1px var(--cscard-border-active), 0 6px 18px var(--cscard-border-active-glow),
    inset 0 1px 0 rgba(255,255,255,.3);
}
.myio-cscard[data-status="INACTIVE"],
.myio-cscard[data-status="DELETED"]{
  border-color:var(--cscard-border-inactive);
}

.myio-cscard__titlebar{display:flex;align-items:center;gap:8px;padding-right:12px;
  background:var(--cscard-head-bg);border-bottom:1px solid var(--cscard-border);}
/* ── connectivity axis: header wash follows connectivity, not entityStatus ── */
.myio-cscard[data-connectivity="ONLINE"] .myio-cscard__titlebar{background:var(--cscard-online-bg);}
.myio-cscard[data-connectivity="WARNING"] .myio-cscard__titlebar{background:var(--cscard-warning-bg);}
.myio-cscard[data-connectivity="OFFLINE"] .myio-cscard__titlebar{background:var(--cscard-offline-bg);}
.myio-cscard[data-connectivity="UNKNOWN"] .myio-cscard__titlebar{background:var(--cscard-unknown-bg);}
.myio-cscard__title{
  flex:1;min-width:0;margin:0;padding:8px 12px;font:800 13px/1.35 'Nunito', system-ui, sans-serif;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.myio-cscard__info-btn{
  flex-shrink:0;display:inline-flex;border:none;background:none;cursor:pointer;font-size:12px;
  line-height:1;padding:2px 4px;color:var(--cscard-muted);border-radius:6px;
}
.myio-cscard__info-btn:hover{background:rgba(37,99,235,.1);color:#2563eb;}

/* Selected ring uses outline (not box-shadow) so it never fights the
   entityStatus border's own box-shadow (e.g. the ACTIVE green glow) —
   both render simultaneously, independent properties. */
.myio-cscard--selected{outline:3px solid var(--cscard-select-ring);outline-offset:2px;}

/* Selection checkbox — inline in the titlebar, where the (i) tooltip trigger
   used to sit (that moved down beside the "Status" label instead). Kept
   prominent here on purpose: a future footer-based multi-card comparison
   reads its checked state. */
.myio-cscard__select-checkbox{width:14px;height:14px;cursor:pointer;flex-shrink:0;}

/* Left action column — same visual role as cards/main-view/v6.0.0's
   .card-actions piano-key strip, ported to this card's own icon language. */
.myio-cscard__actioncol{
  display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;
  gap:10px;padding:8px 5px;border-right:1px solid var(--cscard-border);background:var(--cscard-head-bg);
}
.myio-cscard__action-btn{
  flex-shrink:0;border:none;background:none;cursor:pointer;font-size:13px;
  line-height:1;padding:5px;border-radius:6px;color:var(--cscard-muted);
}
.myio-cscard__action-btn:hover{background:rgba(37,99,235,.1);color:#2563eb;}

.myio-cscard[draggable="true"]{cursor:grab;}
.myio-cscard[draggable="true"]:active{cursor:grabbing;}
/* Single flat block now (no more Operação/Cadastro split — same content,
   no internal section border). */
.myio-cscard__block{padding:6px 12px 9px;}
.myio-cscard__row{
  display:flex;align-items:center;gap:7px;min-height:23px;font-size:11.5px;padding:2px 0;
}
.myio-cscard__ico{flex-shrink:0;width:16px;text-align:center;}
.myio-cscard__label{flex:1;min-width:0;color:var(--cscard-muted);font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;}
.myio-cscard__value{font-weight:700;color:var(--cscard-text);white-space:nowrap;}

.myio-cscard__badge{
  display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;
  font:800 10px 'Nunito', system-ui, sans-serif;
}
.myio-cscard__badge--ONLINE{background:var(--cscard-online-chip-bg);color:var(--cscard-online-chip-fg);}
.myio-cscard__badge--OFFLINE{background:var(--cscard-offline-bg);color:var(--cscard-offline);}
.myio-cscard__badge--WARNING{background:var(--cscard-warning-bg);color:var(--cscard-warning);}
.myio-cscard__badge--UNKNOWN{background:var(--cscard-unknown-bg);color:var(--cscard-unknown);}
.myio-cscard__stale{
  display:inline-flex;align-items:center;padding:1px 6px;border-radius:999px;
  font:700 9px 'Nunito', system-ui, sans-serif;background:var(--cscard-unknown-bg);
  color:var(--cscard-muted);margin-left:4px;
}

/* ── health badge (GCDR RFC-0085): "● v3 rc14.1.24" right after the
   connectivity badge. The dot is the ::before so the pill's text stays the
   plain "v3 <firmware>" an operator scans for during a rollout; the health
   status lives in the dot colour only (healthy/degraded/unhealthy/silent). */
.myio-cscard__health-badge{
  display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;
  font:800 10px 'Nunito', system-ui, sans-serif;background:var(--cscard-health-pill-bg);
  color:var(--cscard-health-pill-fg);margin-left:4px;white-space:nowrap;cursor:default;
}
.myio-cscard__health-badge::before{
  content:'';width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;
  background:var(--cscard-health-silent);
}
.myio-cscard__health-badge--healthy::before{background:var(--cscard-health-ok);}
.myio-cscard__health-badge--degraded::before{background:var(--cscard-health-warn);}
.myio-cscard__health-badge--unhealthy::before{background:var(--cscard-health-bad);}
.myio-cscard__health-badge--silent::before{background:var(--cscard-health-silent);}
.myio-cscard__health-badge--silent{color:var(--cscard-muted);}
.myio-cscard__health-mismatch{font-weight:800;margin-left:1px;}

/* ── "Sistema" row (GCDR RFC-0085): three pills under Status — temperature
   (amber tint), uptime (blue tint), load (grey). Informational only (O-10:
   no thresholds yet), so the tints are fixed per pill, not per value. */
.myio-cscard__system .myio-cscard__value{display:inline-flex;align-items:center;gap:4px;}
.myio-cscard__syspill{
  display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:999px;
  font:700 10px 'Nunito', system-ui, sans-serif;background:var(--cscard-health-pill-bg);
  color:var(--cscard-health-pill-fg);white-space:nowrap;cursor:default;
}
.myio-cscard__syspill--temperature{background:var(--cscard-warning-bg);color:var(--cscard-warning);}
.myio-cscard__syspill--uptime{background:var(--cscard-online-bg);color:var(--cscard-online);}
.myio-cscard__syspill--load{background:var(--cscard-unknown-bg);color:var(--cscard-unknown);}
.myio-cscard[data-theme="dark"] .myio-cscard__syspill--temperature{color:#fbbf24;}
.myio-cscard[data-theme="dark"] .myio-cscard__syspill--uptime{color:#93c5fd;}
.myio-cscard[data-theme="dark"] .myio-cscard__syspill--load{color:var(--cscard-muted);}
.myio-cscard--compact .myio-cscard__system{min-height:18px;padding:1px 0;}
.myio-cscard--compact .myio-cscard__syspill{padding:0 6px;font-size:9.5px;}
.myio-cscard__divergence-flag{
  display:inline-flex;align-items:center;justify-content:center;margin-left:4px;cursor:pointer;
  font-size:11px;line-height:1;border-radius:6px;padding:1px 3px;
}
.myio-cscard__divergence-flag:hover,
.myio-cscard__divergence-flag:focus-visible{background:rgba(148,163,184,.18);outline:none;}

.myio-cscard__devicedot{
  display:inline-flex;align-items:center;gap:4px;font-weight:700;margin-right:9px;white-space:nowrap;
}
.myio-cscard__devicedot::before{
  content:'';width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;
}
.myio-cscard__devicedot--total::before{background:var(--cscard-muted);}
.myio-cscard__devicedot--online::before{background:var(--cscard-online-chip-bg);}
.myio-cscard__devicedot--offline::before{background:var(--cscard-offline);}
.myio-cscard__devicedot--unknown::before{background:var(--cscard-unknown);}

/* Latency trend arrow next to "teste de conexão" — compares against the
   PREVIOUS render's latencyMs (tracked internally, not host state). */
.myio-cscard__latency-trend{margin-left:3px;font-size:10px;font-weight:800;cursor:default;}
.myio-cscard__latency-trend--faster{color:#16a34a;}
.myio-cscard__latency-trend--flat{color:var(--cscard-text);}
.myio-cscard__latency-trend--slower{color:#dc2626;}

.myio-cscard__force{
  flex-shrink:0;border:none;background:transparent;cursor:pointer;color:var(--cscard-muted);
  font-size:12px;line-height:1;padding:2px 4px;border-radius:6px;
}
.myio-cscard__force:hover{background:rgba(37,99,235,.1);color:#2563eb;}
.myio-cscard__force:disabled{opacity:.4;cursor:not-allowed;}

.myio-cscard__timeline{
  flex-shrink:0;border:none;background:transparent;cursor:pointer;color:var(--cscard-muted);
  font-size:12px;line-height:1;padding:2px 4px;border-radius:6px;
}
.myio-cscard__timeline:hover{background:rgba(37,99,235,.1);color:#2563eb;}

.myio-cscard__switch{
  appearance:none;-webkit-appearance:none;flex-shrink:0;width:30px;height:17px;border-radius:999px;
  background:var(--cscard-switch-off);position:relative;cursor:pointer;transition:background .15s;
  outline-offset:2px;
}
.myio-cscard__switch::after{
  content:'';position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;
  background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.3);
}
.myio-cscard__switch:checked{background:var(--cscard-switch-on);}
.myio-cscard__switch:checked::after{transform:translateX(13px);}
.myio-cscard__switch:disabled{opacity:.5;cursor:not-allowed;}
.myio-cscard__switch:focus-visible{outline:2px solid #2563eb;}
.myio-cscard__switch-text{
  flex-shrink:0;width:26px;font:700 9.5px 'Nunito', system-ui, sans-serif;color:var(--cscard-muted);
}
/* Status row: the slider position alone reads clearly enough (unlike
   Monitoramento's ON/OFF, kept visible) — text stays in the DOM (screen
   readers, existing text-content tests) but is visually hidden. */
.myio-cscard__status .myio-cscard__switch-text{
  position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0;
}

.myio-cscard__err{
  display:block;width:100%;margin-top:2px;font:600 9.5px 'Nunito', system-ui, sans-serif;
  color:var(--cscard-danger);
}
.myio-cscard__err[hidden]{display:none;}

/* Fixed baseline height for the 'card' variant — optional rows (probe,
   dispositivos, divergência, stale badge) make real content height vary a
   lot from card to card; without a floor, a grid of them looks visually
   broken (some cards much shorter than their neighbors). Compact stays
   auto-height — it's a dense row, not a grid tile. */
.myio-cscard--card{min-height:230px;}

/* compact: two blocks side-by-side, evidence rows collapse into one condensed
   line. The row/column split now lives on .myio-cscard__content — the root
   stays a row always, to make room for the optional left action column. */
.myio-cscard--compact .myio-cscard__content{flex-direction:row;}
.myio-cscard--compact .myio-cscard__titlebar{display:none;}
.myio-cscard--compact .myio-cscard__block{
  flex:1;border-bottom:none;border-right:1px solid var(--cscard-border);
}
.myio-cscard--compact .myio-cscard__block:last-child{border-right:none;}
.myio-cscard--compact .myio-cscard__row--evidence{display:none;}
.myio-cscard__evidence-line{
  font-size:10px;color:var(--cscard-muted);padding:3px 0;
}
.myio-cscard--card .myio-cscard__evidence-line{display:none;}

/* ── Notification badges — faithful port of TELEMETRY/controller.js's
   .myio-alarm-badge / .myio-ticket-badge / .annotation-type-badge(s), same
   colors/icons/behavior. Unlike the device tile (where these corners are empty
   thumbnail space), this card has real text/controls in every corner (title
   top-left, Status row's (i)/checkbox bottom-left, row values right-aligned)
   — so the badges are root-level children (siblings of .myio-cscard__surface,
   NOT nested inside it) positioned to hang OUTSIDE the visible surface,
   straddling the card's own outer border ("linha limite do card"), instead of
   sitting inset on top of that content.
   Alarm sits 18% down from the top edge, ticket 18% up from the bottom edge —
   both hugging the left border — reading as a matched top/bottom pair on the
   same side rather than either overlapping content or crowding into one spot. */
.myio-cscard__alarm-badge{
  position:absolute;top:18%;left:-14px;transform:translateY(-50%);
  background:#dc2626;color:#fff;border-radius:10px;min-width:22px;height:22px;
  padding:0 6px;font:700 10px 'Nunito', system-ui, sans-serif;display:flex;align-items:center;
  justify-content:center;gap:2px;line-height:1;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,.25);
  z-index:10;
}
/* Incident (RFC-0232) sits at the vertical midpoint of the left border —
   below the alarm badge, above the ticket badge — reading as a 3-badge
   stack on the same edge regardless of card height (card vs. compact). */
.myio-cscard__incident-badge{
  position:absolute;top:50%;left:-14px;transform:translateY(-50%);
  background:#7C3AED;color:#fff;border-radius:10px;min-width:22px;height:22px;
  padding:0 6px;font:700 10px 'Nunito', system-ui, sans-serif;display:flex;align-items:center;
  justify-content:center;gap:2px;line-height:1;cursor:default;box-shadow:0 1px 3px rgba(0,0,0,.25);
  z-index:10;
}
.myio-cscard__ticket-badge{
  position:absolute;bottom:18%;left:-14px;transform:translateY(50%);width:24px;height:24px;
  background:rgba(8,145,178,.12);color:#0891b2;border:1px solid rgba(8,145,178,.25);
  border-radius:6px;display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:background .15s,border-color .15s;box-shadow:0 1px 3px rgba(0,0,0,.15);
  z-index:10;
}
.myio-cscard__ticket-badge:hover{background:rgba(8,145,178,.22);border-color:rgba(8,145,178,.45);}
.myio-cscard__ticket-badge-count{
  position:absolute;top:-5px;right:-5px;min-width:14px;height:14px;padding:0 3px;
  border-radius:7px;background:#0891b2;color:#fff;font:700 9px 'Nunito', system-ui, sans-serif;
  line-height:14px;text-align:center;pointer-events:none;
  /* the badge itself is a translucent "ghost" square (12% alpha) by design —
     without a defined edge, the solid count pill sitting right on top of it
     read as washed-out/semi-transparent too. This ring gives it a crisp
     boundary against any backdrop, light or dark. */
  box-shadow:0 0 0 1.5px rgba(0,0,0,.35);
}
.myio-cscard__annotation-badges{
  position:absolute;top:50%;right:-14px;transform:translateY(-50%);display:flex;
  flex-direction:column;align-items:center;gap:4px;z-index:10;
}
.myio-cscard__annotation-badge{
  position:relative;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;
  justify-content:center;font-size:11px;cursor:pointer;transition:all .2s ease;
  box-shadow:0 1px 3px rgba(0,0,0,.15);color:#fff;
}
.myio-cscard__annotation-badge:hover{transform:scale(1.15);box-shadow:0 2px 8px rgba(0,0,0,.25);}
.myio-cscard__annotation-badge-count{
  position:absolute;top:-4px;right:-4px;min-width:14px;height:14px;padding:0 3px;
  background:#1a1a2e;color:#fff;border-radius:7px;font:700 9px 'Nunito', system-ui, sans-serif;
  display:flex;align-items:center;justify-content:center;line-height:1;
}
`;

export function injectCentralStatusCardStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
