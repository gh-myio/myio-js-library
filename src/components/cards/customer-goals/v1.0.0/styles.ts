/**
 * CustomerGoalsCard v1.0.0 — injected styles (RFC-0217)
 * Class prefix: myio-cgc__ · theme via [data-theme] attribute + CSS custom properties.
 */

const STYLE_ID = 'myio-customer-goals-card-css';

const CSS = `
.myio-cgc{
  --cgc-surface:#ffffff;
  --cgc-border:#e2e8f0;
  --cgc-text:#1e293b;
  --cgc-muted:#64748b;
  --cgc-grid:rgba(100,116,139,.18);
  --cgc-realized:#2563eb;
  --cgc-prev:#94a3b8;
  --cgc-budget:#7c3aed;
  --cgc-orcado:#f59e0b;
  --cgc-good:#16a34a;
  --cgc-bad:#ef4444;
  display:flex;flex-direction:column;
  background:var(--cgc-surface);
  border:1px solid var(--cgc-border);
  border-radius:12px;
  overflow:hidden;
  font-family:'Nunito', system-ui, sans-serif;
  transition:transform .15s ease, box-shadow .15s ease;
}
.myio-cgc[data-theme="dark"]{
  --cgc-surface:#0f1a2c;
  --cgc-border:rgba(148,163,184,.22);
  --cgc-text:#e2e8f0;
  --cgc-muted:#94a3b8;
  --cgc-grid:rgba(148,163,184,.14);
  --cgc-good:#22c55e;
}
.myio-cgc{position:relative;}
.myio-cgc:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(15,23,42,.18);}
.myio-cgc--full{
  position:fixed;inset:18px;z-index:99999;
  transform:none!important;
  box-shadow:0 24px 64px rgba(2,6,23,.5)!important;
}
.myio-cgc--full .myio-cgc__chart{flex:1;height:auto;min-height:200px;}
.myio-cgc__expand{
  position:absolute;top:6px;right:8px;z-index:2;
  border:none;background:transparent;cursor:pointer;
  color:var(--cgc-muted);font:700 13px 'Nunito', system-ui, sans-serif;line-height:1;
  padding:3px 5px;border-radius:6px;opacity:.55;transition:opacity .15s, background .15s;
}
.myio-cgc__expand:hover{opacity:1;background:rgba(124,58,237,.12);color:#7C3AED;}
/* Especificidade + !important para vencer o CSS global de h4 do host (TB injeta
   font-size/margin grandes em h4, cortando o título dentro do card). */
.myio-cgc h4.myio-cgc__title{
  margin:0!important;padding:10px 26px 4px;
  font:800 14px/1.4 'Nunito', system-ui, sans-serif!important;color:var(--cgc-text);
  text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.myio-cgc__title--clickable{cursor:pointer;}
.myio-cgc__title--clickable:hover{text-decoration:underline;}
.myio-cgc__chart{position:relative;height:120px;padding:2px 8px 0;}
.myio-cgc__chart canvas{width:100%!important;height:100%!important;}
.myio-cgc__chart-empty{
  display:flex;align-items:center;justify-content:center;height:100%;
  font:600 11px 'Nunito', system-ui, sans-serif;color:var(--cgc-muted);
}
.myio-cgc__totals{
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--cgc-border);margin-top:6px;
}
.myio-cgc__total{padding:6px 3px;text-align:center;border-right:1px solid var(--cgc-border);min-width:0;}
.myio-cgc__total:last-child{border-right:none;}
.myio-cgc__total-label{display:block;font:700 9.5px 'Nunito', system-ui, sans-serif;line-height:1.35;white-space:nowrap;}
.myio-cgc__total-label--realized{color:var(--cgc-realized);}
.myio-cgc__total-label--prev{color:var(--cgc-prev);}
.myio-cgc__total-label--budget{color:var(--cgc-budget);}
.myio-cgc__total-label--orcado{color:var(--cgc-orcado);}
.myio-cgc__total-value{
  display:block;font:700 11px 'Nunito', system-ui, sans-serif;color:var(--cgc-text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.myio-cgc__deltas{
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--cgc-border);
}
.myio-cgc__delta{padding:5px 3px 8px;text-align:center;border-right:1px solid var(--cgc-border);min-width:0;}
.myio-cgc__delta:last-child{border-right:none;}
.myio-cgc__delta-label{display:block;font:600 9px 'Nunito', system-ui, sans-serif;color:var(--cgc-muted);line-height:1.4;margin-bottom:2px;}
.myio-cgc__delta-value{display:block;font:800 11.5px 'Nunito', system-ui, sans-serif;}
/* Coluna A-1: dois chips pequenos empilhados (Orçado vs A-1, Meta vs A-1). */
.myio-cgc__delta-dual{display:flex;flex-direction:column;gap:2px;align-items:center;}
.myio-cgc__delta-mini{display:inline-flex;align-items:center;gap:3px;line-height:1.2;}
.myio-cgc__delta-mini-label{font:700 8px 'Nunito', system-ui, sans-serif;color:var(--cgc-muted);}
.myio-cgc__delta-mini .myio-cgc__delta-value{display:inline;font-size:9.5px;}
.myio-cgc__delta-value--good{color:var(--cgc-good);}
.myio-cgc__delta-value--bad{color:var(--cgc-bad);}
.myio-cgc__delta-value--neutral{color:var(--cgc-muted);}
/* Linhas "vs <ref>" (col2/3/4): "vs" na cor da coluna, ref na sua cor, + chip.
   col1 mostra "<ref> SEM DADOS". */
.myio-cgc__delta-lines{display:flex;flex-direction:column;gap:2px;align-items:center;}
.myio-cgc__vsline{display:inline-flex;align-items:center;gap:3px;line-height:1.25;font:800 8.5px 'Nunito',sans-serif;white-space:nowrap;}
.myio-cgc__vs,.myio-cgc__vsref{font-weight:800;}
.myio-cgc__vsline .myio-cgc__delta-value{font-size:9.5px;}
.myio-cgc__nodata{color:var(--cgc-muted);font-weight:600;font-size:8px;letter-spacing:.3px;}
`;

export function injectCustomerGoalsCardStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
