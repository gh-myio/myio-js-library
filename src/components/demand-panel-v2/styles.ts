/**
 * RFC-0238 — Demand Panel v2 styles. Scoped by `.dp2-root`; colours come from the modal shell
 * tokens (`--myio-*`), so the dashboard theme (createMyIOTheme / MyIOUtils.theme) applies.
 */
export const DP2_STYLE_ID = 'myio-demand-panel-v2-styles';

export const DP2_CSS = `
.dp2-root { --dp2-ac: var(--myio-brand-700, #3e1a7d); --dp2-ac-soft: color-mix(in srgb, var(--dp2-ac) 10%, transparent);
  --dp2-ok: var(--myio-success, #16a34a); --dp2-warn: var(--myio-warning, #d97706); --dp2-err: var(--myio-danger, #dc2626); --dp2-info: var(--myio-info, #2563eb);
  font-family: Nunito, var(--myio-font, system-ui, sans-serif); color: var(--myio-text, #1e293b); font-size: 13px;
  height: 100%; display: flex; flex-direction: column; min-height: 0; }
.dp2-root * { box-sizing: border-box; }
.dp2-root p, .dp2-root li, .dp2-root dt, .dp2-root dd, .dp2-root label { font-size: inherit; line-height: 1.45; letter-spacing: normal; }
.dp2-root p { margin: 8px 0 0; }
.dp2-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--myio-border, #e2e8f0); margin: -4px 0 0; }
.dp2-tab { border: none; background: none; font: inherit; font-weight: 700; color: var(--myio-text-muted, #64748b); padding: 9px 14px; cursor: pointer; border-bottom: 3px solid transparent; }
.dp2-tab[aria-selected="true"] { color: var(--dp2-ac); border-bottom-color: var(--dp2-ac); }
.dp2-count { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 4px; border-radius: 9px; background: var(--dp2-info); color: #fff; font-size: 11px; }
.dp2-stepper { display: flex; gap: 6px; padding: 10px 0; }
.dp2-stepper[hidden] { display: none; }
.dp2-step { flex: 1; display: flex; align-items: center; gap: 8px; border: none; background: none; font: inherit; color: var(--myio-text-muted, #64748b); padding: 6px 8px; border-radius: 10px; text-align: left; cursor: default; }
.dp2-step b { width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 2px solid var(--myio-border, #e2e8f0); font-size: 12px; flex-shrink: 0; }
.dp2-step[data-state="current"] { color: var(--dp2-ac); font-weight: 800; background: var(--dp2-ac-soft); }
.dp2-step[data-state="current"] b { border-color: var(--dp2-ac); background: var(--dp2-ac); color: #fff; }
.dp2-step[data-state="done"] { color: var(--myio-text, #1e293b); cursor: pointer; }
.dp2-step[data-state="done"] b { border-color: var(--dp2-ok); background: var(--dp2-ok); color: #fff; }
.dp2-banner { margin: 0 0 10px; padding: 9px 12px; border-radius: 10px; background: color-mix(in srgb, var(--dp2-warn) 12%, transparent); border: 1px solid color-mix(in srgb, var(--dp2-warn) 40%, transparent); }
.dp2-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 2px 8px; }
.dp2-nav { display: flex; align-items: center; gap: 10px; padding: 10px 0 0; border-top: 1px solid var(--myio-border, #e2e8f0); }
.dp2-nav .hint { flex: 1; color: var(--myio-text-muted, #64748b); }
.dp2-btn { border: 1px solid var(--myio-border, #e2e8f0); background: var(--myio-card, #fff); color: var(--myio-text, #1e293b); border-radius: 9px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
.dp2-btn:hover:not([disabled]) { border-color: var(--dp2-ac); }
.dp2-btn[disabled] { opacity: .45; cursor: not-allowed; }
.dp2-btn.primary { background: var(--dp2-ac); color: #fff; border-color: var(--dp2-ac); }
.dp2-btn.sm { padding: 4px 9px; font-size: 12px; }
.dp2-btn.link { border: none; background: none; color: var(--dp2-ac); padding: 4px 6px; }
.dp2-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.dp2-s1 { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; height: 100%; min-height: 380px; }
.dp2-col { display: flex; flex-direction: column; min-height: 0; background: var(--myio-card, #fff); border: 1px solid var(--myio-border, #e2e8f0); border-radius: 12px; }
.dp2-col-head { padding: 12px; border-bottom: 1px solid var(--myio-border, #e2e8f0); display: flex; flex-direction: column; gap: 8px; }
.dp2-col-head h3 { margin: 0; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
.dp2-search { width: 100%; border: 1px solid var(--myio-border, #e2e8f0); background: var(--myio-bg, #f8fafc); color: var(--myio-text, #1e293b); border-radius: 9px; padding: 9px 12px; font: inherit; font-size: 14px; }
.dp2-search:focus { outline: 2px solid var(--dp2-ac); outline-offset: -1px; }
.dp2-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dp2-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--myio-border, #e2e8f0); background: var(--myio-card, #fff); color: var(--myio-text, #1e293b); border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.dp2-chip[aria-pressed="true"] { background: var(--dp2-ac-soft); border-color: var(--dp2-ac); color: var(--dp2-ac); font-weight: 700; }
.dp2-chip[disabled] { opacity: .4; cursor: not-allowed; }
.dp2-list { flex: 1; overflow: auto; padding: 6px; min-height: 0; }
.dp2-item { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 8px; border-radius: 9px; }
.dp2-item:hover { background: var(--dp2-ac-soft); }
.dp2-item.blocked { opacity: .6; }
.dp2-ico { width: 32px; height: 32px; object-fit: contain; }
.dp2-name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dp2-sub { color: var(--myio-text-muted, #64748b); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dp2-tag { display: inline-block; border-radius: 999px; padding: 0 7px; font-size: 11px; background: var(--dp2-ac-soft); color: var(--dp2-ac); margin-right: 4px; }
.dp2-tag.warn { background: color-mix(in srgb, var(--dp2-warn) 15%, transparent); color: var(--dp2-warn); }
.dp2-tag.block { background: color-mix(in srgb, var(--dp2-err) 12%, transparent); color: var(--dp2-err); }
.dp2-added { color: var(--dp2-ok); font-weight: 700; font-size: 12px; }
.dp2-empty { color: var(--myio-text-muted, #64748b); text-align: center; padding: 30px 12px; }
.dp2-mark { background: #fde68a; color: inherit; border-radius: 2px; }
.dp2-card { background: var(--myio-card, #fff); border: 1px solid var(--myio-border, #e2e8f0); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.dp2-card h3 { margin: 0 0 10px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
.dp2-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.dp2-field { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 12px; color: var(--myio-text-muted, #64748b); }
.dp2-field input { border: 1px solid var(--myio-border, #e2e8f0); background: var(--myio-bg, #f8fafc); color: var(--myio-text, #1e293b); border-radius: 8px; padding: 7px 9px; font: inherit; }
.dp2-root .dp2-info { color: var(--myio-text-muted, #64748b); font-size: 12px; }
.dp2-root .dp2-err { color: var(--dp2-err); font-weight: 600; font-size: 12px; }
.dp2-root p.dp2-err { padding: 7px 10px; border-radius: 8px; background: color-mix(in srgb, var(--dp2-err) 8%, transparent); border: 1px solid color-mix(in srgb, var(--dp2-err) 30%, transparent); }
.dp2-fix { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.dp2-tgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.dp2-check { display: flex; align-items: center; gap: 8px; padding: 6px 4px; cursor: pointer; border-radius: 7px; }
.dp2-check:hover { background: var(--dp2-ac-soft); }
.dp2-check input { width: 16px; height: 16px; accent-color: var(--dp2-ac); }
.dp2-check .u { margin-left: auto; color: var(--myio-text-muted, #64748b); font-size: 11px; }
.dp2-sum { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 8px 14px; margin: 0; }
.dp2-sum dt { color: var(--myio-text-muted, #64748b); font-weight: 700; }
.dp2-sum dd { margin: 0; }
.dp2-pills { display: flex; flex-wrap: wrap; gap: 5px; }
.dp2-pill { border-radius: 999px; padding: 2px 9px; font-size: 12px; background: var(--dp2-ac-soft); color: var(--dp2-ac); }
.dp2-size { display: inline-block; border-radius: 999px; padding: 2px 10px; font-weight: 800; color: #fff; background: var(--dp2-ok); }
.dp2-size.medio { background: var(--dp2-warn); } .dp2-size.grande { background: var(--dp2-err); }
.dp2-json { background: #0f172a; color: #e2e8f0; border-radius: 9px; padding: 10px 12px; font: 11.5px/1.45 ui-monospace, Consolas, monospace; max-height: 260px; overflow: auto; white-space: pre; margin: 8px 0 0; }
.dp2-meter { height: 8px; background: var(--myio-border, #e2e8f0); border-radius: 4px; overflow: hidden; margin-top: 6px; }
.dp2-meter span { display: block; height: 100%; background: var(--dp2-ok); }
.dp2-details summary { cursor: pointer; color: var(--dp2-ac); font-weight: 700; }
.dp2-job { background: var(--myio-card, #fff); border: 1px solid var(--myio-border, #e2e8f0); border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
.dp2-job.ghost { border-style: dashed; }
.dp2-job-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dp2-job-title { font-weight: 800; }
.dp2-status { border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 800; color: #fff; background: #94a3b8; }
.dp2-status.running, .dp2-status.sending, .dp2-status.send_uncertain { background: var(--dp2-info); }
.dp2-status.succeeded { background: var(--dp2-ok); }
.dp2-status.failed, .dp2-status.not_received, .dp2-status.rejected { background: var(--dp2-err); }
.dp2-status.query_unavailable { background: var(--dp2-warn); }
.dp2-status.queued { background: color-mix(in srgb, var(--dp2-info) 70%, #64748b); }
.dp2-banner.info { background: color-mix(in srgb, var(--dp2-info) 10%, transparent); border-color: color-mix(in srgb, var(--dp2-info) 35%, transparent); }
.dp2-bar { height: 6px; background: var(--myio-border, #e2e8f0); border-radius: 3px; overflow: hidden; margin-top: 8px; }
.dp2-bar span { display: block; height: 100%; background: var(--dp2-info); transition: width .4s; }
.dp2-job-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
.dp2-skel { height: 74px; border-radius: 12px; margin-bottom: 10px; background: linear-gradient(90deg, var(--myio-border, #e2e8f0), var(--myio-card, #fff), var(--myio-border, #e2e8f0)); background-size: 200% 100%; animation: dp2sk 1.2s infinite; }
@keyframes dp2sk { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.dp2-audit-warn { color: var(--dp2-warn); font-size: 12px; font-weight: 700; margin-top: 4px; }
.dp2-root[data-narrow="true"] .dp2-s1 { grid-template-columns: 1fr; }
.dp2-root[data-narrow="true"] .dp2-sum { grid-template-columns: 1fr; }
`;

export function injectDemandPanelStyles(doc: Document = document): void {
  if (doc.getElementById(DP2_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = DP2_STYLE_ID;
  style.textContent = DP2_CSS;
  doc.head.appendChild(style);
}
