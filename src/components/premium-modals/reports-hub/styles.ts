/**
 * RFC-0239 — Reports Hub styles, scoped by `.rh-*`. Colours come from the --myio-* tokens set on
 * the modal by the palette (createMyIOTheme), with neutral fallbacks; dark via data-theme.
 */
export const RH_STYLE_ID = 'myio-reports-hub-styles';

export const RH_CSS = `
.rh-overlay{position:fixed;inset:0;z-index:999998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);font-family:'Nunito',system-ui,sans-serif;}
.rh-modal{--rh-ac:var(--myio-brand-700,#3e1a7d);--rh-bg:#fff;--rh-panel:#f9fafb;--rh-card:#fafafa;--rh-border:#e5e7eb;--rh-text:#1f2937;--rh-muted:#6b7280;--rh-err:#dc2626;
  position:relative;background:var(--rh-bg);color:var(--rh-text);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.25);width:min(680px,92vw);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;font-size:13px;}
.rh-modal[data-theme="dark"]{--rh-bg:#111827;--rh-panel:#0f172a;--rh-card:#1f2937;--rh-border:#334155;--rh-text:#e5e7eb;--rh-muted:#94a3b8;--rh-err:#f87171;
  --rh-ac:color-mix(in srgb,var(--myio-brand-700,#3e1a7d) 45%,#fff);}
.rh-modal.is-maximized{width:100vw;max-height:100vh;height:100vh;border-radius:0;}
.rh-modal *{box-sizing:border-box;}
.rh-tabs{display:flex;border-bottom:1px solid var(--rh-border);background:var(--rh-panel);flex-shrink:0;overflow-x:auto;}
.rh-tab{flex:1 1 auto;padding:12px 8px;border:none;background:transparent;cursor:pointer;font:inherit;font-weight:600;color:var(--rh-muted);border-bottom:3px solid transparent;white-space:nowrap;}
.rh-tab:hover{color:var(--rh-ac);}
.rh-tab[aria-selected="true"]{color:var(--rh-ac);border-bottom-color:var(--rh-ac);background:var(--rh-bg);}
.rh-tab:focus-visible,.rh-card:focus-visible,.rh-retry:focus-visible{outline:2px solid var(--rh-ac);outline-offset:2px;}
.rh-body{padding:20px;overflow-y:auto;flex:1;min-height:0;}
.rh-panel[hidden]{display:none;}
.rh-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;}
.rh-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1.5px solid var(--rh-border);border-radius:12px;background:var(--rh-card);color:inherit;cursor:pointer;position:relative;text-align:left;width:100%;font:inherit;transition:border-color .15s,box-shadow .15s,transform .15s;}
.rh-card[data-state="enabled"]:hover:not([aria-busy="true"]):not(:disabled){border-color:color-mix(in srgb,var(--rh-ac) 45%,transparent);box-shadow:0 4px 12px rgba(0,0,0,.10);transform:translateY(-1px);}
.rh-card[data-state="locked"]{opacity:.6;cursor:not-allowed;}
.rh-card:disabled{cursor:progress;}
.rh-ico{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-size:20px;flex-shrink:0;}
.rh-text{display:flex;flex-direction:column;gap:2px;min-width:0;}
.rh-title{font-size:14px;font-weight:600;}
.rh-desc{font-size:11px;color:var(--rh-muted);}
.rh-lock{position:absolute;top:8px;right:8px;font-size:12px;color:var(--rh-muted);background:var(--rh-panel);border:1px solid var(--rh-border);padding:2px 5px;border-radius:20px;line-height:1.4;}
.rh-hint{font-size:11px;color:var(--rh-muted);}
.rh-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--rh-border);border-top-color:var(--rh-ac);animation:rh-spin .8s linear infinite;margin-left:auto;flex-shrink:0;}
@keyframes rh-spin{to{transform:rotate(360deg);}}
.rh-err{font-size:11px;font-weight:600;color:var(--rh-err);display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.rh-retry{border:none;background:none;color:var(--rh-ac);font:inherit;font-weight:700;cursor:pointer;padding:0;text-decoration:underline;}
.rh-empty{color:var(--rh-muted);text-align:center;padding:40px 12px;}
.rh-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
`;

export function injectReportsHubStyles(doc: Document): void {
  if (doc.getElementById(RH_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = RH_STYLE_ID;
  style.textContent = RH_CSS;
  (doc.head || doc.documentElement).appendChild(style);
}
