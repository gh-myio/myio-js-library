/**
 * RFC-0238 — estilos do Portfolio Command Center (prefixo `myio-pcc-`).
 * Acento = paleta do tema do dashboard (--myio-brand-700), fallback roxo MYIO #6D28D9.
 */
export const PCC_STYLE_ID = 'myio-pcc-styles';

export const PCC_CSS = `
.myio-pcc {
  --pcc-accent: var(--myio-brand-700, #6D28D9);
  --pcc-canvas: #F5F7FB;
  --pcc-surface: #FFFFFF;
  --pcc-border: #E2E8F0;
  --pcc-text: #0F172A;
  --pcc-muted: #64748B;
  --pcc-soft: #F1F5F9;
  --pcc-ok: #16A34A;
  --pcc-warn: #D97706;
  --pcc-crit: #DC2626;
  --pcc-info: #2563EB;
  --pcc-nodata: #94A3B8;
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--pcc-canvas);
  color: var(--pcc-text);
  font: 14px/1.4 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-variant-numeric: tabular-nums;
  border-radius: 12px;
  overflow: hidden;
}
.myio-pcc--dark {
  --pcc-canvas: #101827;
  --pcc-surface: #1E293B;
  --pcc-border: #334155;
  --pcc-text: #E2E8F0;
  --pcc-muted: #94A3B8;
  --pcc-soft: #0F172A;
}
.myio-pcc *, .myio-pcc *::before, .myio-pcc *::after { box-sizing: border-box; }
/* O ThingsBoard aplica h2/h3 globais (2rem, peso 400, margens) — neutraliza dentro do componente */
.myio-pcc h2, .myio-pcc h3 {
  font-family: inherit !important; line-height: 1.25 !important; letter-spacing: normal !important; margin: 0 !important; color: inherit;
}
.myio-pcc h2.myio-pcc__h1 { font-size: 24px !important; font-weight: 800 !important; }
.myio-pcc h3.myio-pcc__panel-title { font-size: 14px !important; font-weight: 800 !important; }
.myio-pcc h3.myio-pcc__drawer-title { font-size: 18px !important; font-weight: 800 !important; }
.myio-pcc button { font: inherit; color: inherit; }
.myio-pcc :focus-visible { outline: 2px solid var(--pcc-accent); outline-offset: 2px; }

/* ---------- Main ---------- */
.myio-pcc__main { flex: 1; min-width: 0; overflow-y: auto; padding: 20px 24px 28px; }
.myio-pcc__head {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 16px;
}
.myio-pcc__h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -.2px; }
.myio-pcc__sub { color: var(--pcc-muted); font-size: 12px; margin-top: 2px; }
.myio-pcc__chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.myio-pcc__chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
  background: var(--pcc-surface); border: 1px solid var(--pcc-border); font-size: 12px; font-weight: 600;
}
.myio-pcc__chip--live::before {
  content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--pcc-ok);
}

.myio-pcc__grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 24px; align-items: start; }
.myio-pcc__grid[data-region='kpis'] { align-items: stretch; }
.myio-pcc__span-12 { grid-column: span 12; }
.myio-pcc__span-8 { grid-column: span 8; }
.myio-pcc__span-6 { grid-column: span 6; }
.myio-pcc__span-4 { grid-column: span 4; }
.myio-pcc__span-3 { grid-column: span 3; }

.myio-pcc__panel {
  background: var(--pcc-surface); border: 1px solid var(--pcc-border); border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04); min-width: 0;
}
.myio-pcc__panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 14px 16px 10px; border-bottom: 1px solid var(--pcc-border);
}
.myio-pcc__panel-title { margin: 0; font-size: 14px; font-weight: 800; }
.myio-pcc__panel-note { font-size: 11px; color: var(--pcc-muted); }
.myio-pcc__panel-body { padding: 14px 16px 16px; }

/* ---------- KPI ---------- */
.myio-pcc__kpi {
  display: flex; flex-direction: column; gap: 6px; width: 100%; height: 100%; padding: 16px;
  text-align: left; cursor: pointer; border-radius: 14px; border: 1px solid var(--pcc-border);
  background: var(--pcc-surface); transition: border-color 140ms ease, box-shadow 140ms ease;
  border-top: 3px solid var(--pcc-accent);
}
.myio-pcc__kpi:hover { box-shadow: 0 6px 18px rgba(15, 23, 42, .08); }
.myio-pcc__kpi[data-state='not-configured'], .myio-pcc__kpi[data-state='unavailable'] {
  border-top-color: var(--pcc-nodata);
}
.myio-pcc__kpi-label {
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--pcc-muted);
  display: flex; align-items: center; gap: 6px;
}
.myio-pcc__kpi-value { font-size: 28px; font-weight: 800; line-height: 1.1; }
.myio-pcc__kpi-value--empty { font-size: 15px; font-weight: 700; color: var(--pcc-muted); }
.myio-pcc__kpi-scope { font-size: 12px; color: var(--pcc-muted); }
.myio-pcc__kpi-foot { margin-top: auto; display: flex; flex-wrap: wrap; gap: 6px; }

.myio-pcc__badge {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700; background: var(--pcc-soft); color: var(--pcc-muted);
}
.myio-pcc__badge--ok { background: color-mix(in srgb, var(--pcc-ok) 12%, transparent); color: var(--pcc-ok); }
.myio-pcc__badge--warn { background: color-mix(in srgb, var(--pcc-warn) 14%, transparent); color: var(--pcc-warn); }
.myio-pcc__badge--crit { background: color-mix(in srgb, var(--pcc-crit) 12%, transparent); color: var(--pcc-crit); }
.myio-pcc__badge--info { background: color-mix(in srgb, var(--pcc-info) 12%, transparent); color: var(--pcc-info); }

/* ---------- Trajectory ---------- */
.myio-pcc__seg { display: inline-flex; background: var(--pcc-soft); border-radius: 8px; padding: 2px; }
.myio-pcc__seg button {
  border: 0; background: transparent; padding: 4px 10px; border-radius: 6px; cursor: pointer;
  font-size: 12px; font-weight: 700; color: var(--pcc-muted);
}
.myio-pcc__seg button[aria-pressed='true'] { background: var(--pcc-surface); color: var(--pcc-text); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.myio-pcc__chart { width: 100%; height: auto; max-height: 300px; display: block; }
.myio-pcc__legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; color: var(--pcc-muted); margin-top: 8px; }
.myio-pcc__legend i { display: inline-block; width: 16px; height: 0; border-top: 2px solid var(--pcc-accent); vertical-align: middle; margin-right: 6px; }
.myio-pcc__legend i.bar { height: 8px; border: 0; background: color-mix(in srgb, var(--pcc-accent) 25%, transparent); }
.myio-pcc__legend i.goal { border-top-style: dashed; border-top-color: var(--pcc-muted); }

/* ---------- Priorities ---------- */
.myio-pcc__prio { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.myio-pcc__prio-item {
  border: 1px solid var(--pcc-border); border-left: 4px solid var(--pcc-info); border-radius: 10px; padding: 10px 12px;
}
.myio-pcc__prio-item[data-severity='critical'] { border-left-color: var(--pcc-crit); }
.myio-pcc__prio-item[data-severity='warning'] { border-left-color: var(--pcc-warn); }
.myio-pcc__prio-top { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.myio-pcc__prio-title { font-weight: 800; font-size: 13px; }
.myio-pcc__prio-shop { font-size: 12px; color: var(--pcc-muted); font-weight: 700; }
.myio-pcc__prio-ev { font-size: 12px; margin-top: 4px; }
.myio-pcc__prio-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; font-size: 11px; color: var(--pcc-muted); }
.myio-pcc__link {
  border: 0; background: none; padding: 0; cursor: pointer; color: var(--pcc-accent); font-weight: 700; font-size: 12px;
}
.myio-pcc__link:hover { text-decoration: underline; }
.myio-pcc--dark .myio-pcc__link { color: color-mix(in srgb, var(--pcc-accent) 40%, white); }
.myio-pcc__why { margin-top: 6px; font-size: 11px; color: var(--pcc-muted); background: var(--pcc-soft); border-radius: 6px; padding: 6px 8px; }

/* ---------- Matrix ---------- */
.myio-pcc__table-wrap { overflow-x: auto; }
.myio-pcc__table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.myio-pcc__table th {
  position: sticky; top: 0; background: var(--pcc-surface); text-align: right; font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .4px; color: var(--pcc-muted); padding: 8px 10px; border-bottom: 1px solid var(--pcc-border);
  white-space: nowrap;
}
.myio-pcc__table td { padding: 10px; border-bottom: 1px solid var(--pcc-border); text-align: right; white-space: nowrap; font-size: 13px !important; line-height: 1.35; }
.myio-pcc__table th:first-child, .myio-pcc__table td:first-child {
  text-align: left; position: sticky; left: 0; background: var(--pcc-surface); z-index: 1;
}
.myio-pcc__table tbody tr:hover td { background: var(--pcc-soft); }
.myio-pcc__shop-btn { border: 0; background: none; padding: 0; cursor: pointer; font-weight: 800; color: var(--pcc-text); text-align: left; }
.myio-pcc__shop-btn:hover { color: var(--pcc-accent); text-decoration: underline; }
.myio-pcc__cell-sub { display: block; font-size: 11px; color: var(--pcc-muted); }
.myio-pcc__nd { color: var(--pcc-nodata); font-weight: 700; }
.myio-pcc__neg { color: var(--pcc-crit); font-weight: 700; }
.myio-pcc__sort-rule { font-size: 11px; color: var(--pcc-muted); }

/* ---------- Bars ---------- */
.myio-pcc__bars { display: flex; flex-direction: column; gap: 10px; }
.myio-pcc__bar-row { display: grid; grid-template-columns: 150px 1fr 110px; gap: 10px; align-items: center; font-size: 12px; }
.myio-pcc__bar-label { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.myio-pcc__bar-track { height: 10px; border-radius: 999px; background: var(--pcc-soft); overflow: hidden; }
.myio-pcc__bar-fill { height: 100%; border-radius: 999px; background: var(--pcc-accent); }
.myio-pcc__bar-fill[data-cat='unmapped'] { background: var(--pcc-nodata); }
.myio-pcc__bar-value { text-align: right; font-weight: 700; }

/* ---------- Coverage ---------- */
.myio-pcc__cov { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.myio-pcc__cov-item { background: var(--pcc-soft); border-radius: 10px; padding: 10px 12px; }
.myio-pcc__cov-label { font-size: 11px; font-weight: 800; color: var(--pcc-muted); text-transform: uppercase; letter-spacing: .4px; }
.myio-pcc__cov-value { font-size: 20px; font-weight: 800; margin-top: 2px; }
.myio-pcc__cov-sub { font-size: 11px; color: var(--pcc-muted); }
.myio-pcc__comfort { margin-top: 12px; font-size: 12px; }

/* ---------- Em breve ---------- */
.myio-pcc__upcoming { max-width: 720px; margin: 24px auto; padding: 28px 32px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.myio-pcc__upcoming-icon { font-size: 36px; }
.myio-pcc__upcoming-q { margin: 0; font-size: 16px; color: var(--pcc-muted); }
.myio-pcc__section-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--pcc-muted); margin-top: 6px; }
.myio-pcc__upcoming-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }

/* ---------- States ---------- */
.myio-pcc__empty { padding: 28px 12px; text-align: center; color: var(--pcc-muted); font-size: 13px; }
.myio-pcc__skeleton { height: 220px; border-radius: 10px; background: linear-gradient(90deg, var(--pcc-soft), var(--pcc-border), var(--pcc-soft)); background-size: 200% 100%; animation: myio-pcc-shimmer 1.2s linear infinite; }
@keyframes myio-pcc-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .myio-pcc__skeleton { animation: none; }
  .myio-pcc * { transition: none !important; }
}

/* ---------- Drawer ---------- */
.myio-pcc__drawer-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .35); z-index: 100000; }
.myio-pcc__drawer {
  position: fixed; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); z-index: 100001;
  background: var(--pcc-surface); color: var(--pcc-text); border-left: 1px solid var(--pcc-border);
  box-shadow: -12px 0 40px rgba(15, 23, 42, .18); display: flex; flex-direction: column;
}
.myio-pcc__drawer-head {
  display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--pcc-border);
  background: linear-gradient(90deg, color-mix(in srgb, var(--pcc-accent) 6%, var(--pcc-surface)), color-mix(in srgb, var(--pcc-accent) 14%, var(--pcc-surface)));
}
.myio-pcc__drawer-title { flex: 1; margin: 0; font-size: 18px; font-weight: 800; }
.myio-pcc__icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--pcc-border); background: var(--pcc-surface); cursor: pointer;
}
.myio-pcc__drawer-body { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.myio-pcc__dl { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; margin: 0; font-size: 13px; }
.myio-pcc__dl dt { color: var(--pcc-muted); }
.myio-pcc__dl dd { margin: 0; font-weight: 700; text-align: right; }
.myio-pcc__drawer-foot { padding: 14px 18px; border-top: 1px solid var(--pcc-border); display: flex; gap: 8px; justify-content: flex-end; }
.myio-pcc__btn {
  border: 1px solid var(--pcc-border); background: var(--pcc-surface); border-radius: 10px; padding: 8px 14px; cursor: pointer; font-weight: 700; font-size: 13px;
}
.myio-pcc__btn--primary { background: var(--pcc-accent); border-color: var(--pcc-accent); color: #fff; }

/* ---------- Responsivo (classes aplicadas pela largura do container) ---------- */
.myio-pcc--md .myio-pcc__span-8, .myio-pcc--md .myio-pcc__span-4, .myio-pcc--md .myio-pcc__span-6 { grid-column: span 12; }
.myio-pcc--md .myio-pcc__span-3 { grid-column: span 6; }
.myio-pcc--sm .myio-pcc__span-3 { grid-column: span 12; }
.myio-pcc--sm .myio-pcc__main { padding: 14px 12px 20px; }
.myio-pcc--sm .myio-pcc__grid { gap: 14px; }
.myio-pcc--sm .myio-pcc__cov { grid-template-columns: 1fr; }
.myio-pcc--sm .myio-pcc__bar-row { grid-template-columns: 110px 1fr 80px; }
`;
