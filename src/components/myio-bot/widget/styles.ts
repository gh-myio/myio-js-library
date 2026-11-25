/**
 * RFC-0242 — CSS of the widget, injected into its Shadow DOM root (no global
 * CSS, no `!important` wars with the dashboard). Nunito is the MYIO font; the
 * Google Fonts `<link>` goes to `document.head` once unless `theme.fontLink === false`.
 */
export const NUNITO_HREF = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';

export const DEFAULT_ACCENT = '#7C3AED';

export const WIDGET_CSS = `
:host{all:initial}
*{box-sizing:border-box}
.mb{--mb-accent:${DEFAULT_ACCENT};--mb-bg:#fff;--mb-fg:#1f2937;--mb-muted:#6b7280;--mb-soft:#f3f4f6;--mb-line:#e5e7eb;--mb-err:#b91c1c;--mb-errbg:#fef2f2;--mb-warnbg:#fffbeb;
font-family:Nunito,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;color:var(--mb-fg);line-height:1.4}
.mb.dark{--mb-bg:#111827;--mb-fg:#f3f4f6;--mb-muted:#9ca3af;--mb-soft:#1f2937;--mb-line:#374151;--mb-errbg:#3b1219;--mb-err:#fca5a5;--mb-warnbg:#2d2410}
button{font:inherit;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.5}
.launcher{position:fixed;bottom:24px;z-index:2147483000;display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border:0;border-radius:999px;
background:var(--mb-accent);color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .15s,filter .15s}
.launcher:hover{transform:scale(1.04)}
.launcher{touch-action:none;user-select:none;-webkit-user-select:none}
.launcher.dragging{cursor:grabbing;transform:scale(1.06);transition:none;box-shadow:0 14px 32px rgba(0,0,0,.3)}
.launcher.snapping{transition:left .22s cubic-bezier(.2,.8,.2,1),top .22s cubic-bezier(.2,.8,.2,1),transform .15s}
.launcher:focus-visible,.icon:focus-visible,.btn:focus-visible{outline:3px solid rgba(124,58,237,.45);outline-offset:2px}
.right{right:24px}.left{left:24px}
.launcher.muted{filter:grayscale(1);opacity:.7}
.dot{width:9px;height:9px;border-radius:50%;background:#fff;opacity:.85}
.launcher.streaming .dot{animation:mbpulse 1s infinite}
@keyframes mbpulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
.badge{background:#f59e0b;color:#111;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:700}
.panel{position:fixed;bottom:84px;z-index:2147483001;width:min(92vw,400px);height:min(72vh,580px);display:flex;flex-direction:column;overflow:hidden;
background:var(--mb-bg);border:1px solid var(--mb-line);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.28)}
.panel.solo{bottom:24px}
.head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px 10px 16px;background:var(--mb-accent);color:#fff}
.head{cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}
.head .icon{cursor:pointer}
.panel.dragging{box-shadow:0 24px 60px rgba(0,0,0,.35);opacity:.97}
.panel.dragging,.panel.dragging *{user-select:none;-webkit-user-select:none}
.icon:disabled{opacity:.4;cursor:not-allowed}
.panel.maximized{top:20px!important;left:20px!important;right:20px!important;bottom:20px!important;width:auto!important;height:auto!important;max-width:none!important}
.panel.maximized .head{cursor:default}
.head .t{font-weight:700;font-size:15px}
.head .s{font-size:11px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
.head .tools{display:flex;gap:2px;flex-shrink:0}
.icon{background:transparent;border:0;color:#fff;border-radius:6px;padding:4px 7px;font-size:14px;line-height:1;text-decoration:none;display:inline-flex;align-items:center}
.icon:hover{background:rgba(255,255,255,.18)}
.body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.state{margin:auto 0;text-align:center;padding:24px 8px}
.state h3{margin:0 0 6px;font-size:15px}
.state p{margin:0 0 12px;color:var(--mb-muted);font-size:13px;white-space:pre-wrap}
.btn{border:1px solid var(--mb-line);background:var(--mb-bg);color:var(--mb-fg);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600}
.btn.primary{background:var(--mb-accent);border-color:var(--mb-accent);color:#fff}
.btn.danger{color:var(--mb-err)}
.msg{display:flex}.msg.user{justify-content:flex-end}
.bubble{max-width:86%;white-space:pre-wrap;word-wrap:break-word;border-radius:14px;padding:8px 12px;background:var(--mb-soft)}
.msg.user .bubble{background:var(--mb-accent);color:#fff}
.meta{margin-top:6px;padding-top:5px;border-top:1px solid var(--mb-line);display:flex;flex-wrap:wrap;gap:6px;font-size:10px;color:var(--mb-muted)}
.tier{font-weight:700;color:var(--mb-accent)}
.meta details{width:100%}.meta summary{cursor:pointer}
.meta ul{margin:4px 0 0;padding-left:16px}
.empty h3{margin:4px 0;font-size:14px}.empty p{margin:0;color:var(--mb-muted);font-size:12px}
.muted{color:var(--mb-muted);font-size:12px;text-align:center}
.alert{border-radius:10px;padding:8px 10px;font-size:12px;display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.alert.error{background:var(--mb-errbg);color:var(--mb-err)}
.alert.info{background:var(--mb-soft);color:var(--mb-muted)}
.alert.warn{background:var(--mb-warnbg)}
.alert button{background:transparent;border:0;color:inherit;font-weight:700}
.card{border:1px solid var(--mb-line);border-radius:12px;padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:8px}
.card h4{margin:0;font-size:13px}
.card p{margin:0;color:var(--mb-muted)}
.card .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.card .row span{flex:1;min-width:0}
.card .acts{display:flex;gap:6px;flex-shrink:0}
.card.action{border-color:#f59e0b}
.card table{border-collapse:collapse;width:100%}
.card td{border-top:1px solid var(--mb-line);padding:3px 4px;vertical-align:top;word-break:break-word}
.card td:first-child{color:var(--mb-muted);width:38%}
.tag{font-size:10px;color:var(--mb-muted)}
.composer{border-top:1px solid var(--mb-line);padding:10px 12px 8px}
.composer .row{display:flex;gap:8px;align-items:flex-end}
textarea{flex:1;resize:none;min-height:40px;max-height:120px;border:1px solid var(--mb-line);border-radius:10px;padding:9px 10px;font:inherit;color:var(--mb-fg);background:var(--mb-bg)}
textarea:focus{outline:none;border-color:var(--mb-accent)}
.send{height:40px;min-width:40px;border:0;border-radius:10px;background:var(--mb-accent);color:#fff;font-weight:700;padding:0 12px}
.send.stop{background:var(--mb-soft);color:var(--mb-fg)}
.hint{margin-top:4px;font-size:10px;color:var(--mb-muted)}
.spin{display:inline-block;width:14px;height:14px;border:2px solid var(--mb-line);border-top-color:var(--mb-accent);border-radius:50%;animation:mbspin .8s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes mbspin{to{transform:rotate(360deg)}}
@media (max-width:480px){.panel{right:8px!important;left:8px!important;width:auto;bottom:76px}}
@media (prefers-reduced-motion:reduce){.launcher,.launcher.streaming .dot,.spin{animation:none;transition:none}}
`;
