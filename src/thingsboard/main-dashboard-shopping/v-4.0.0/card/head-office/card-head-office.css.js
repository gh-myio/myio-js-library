// src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.css.ts
// Atomic CSS injection for Head Office cards

export const CSS_STRING = `
/* CSS Variables for theming */
:root {
  --myio-card-radius: 16px;
  --myio-card-shadow: 0 2px 8px rgba(10, 31, 68, .06);
  --myio-card-bg: #fff;
  --myio-card-border: #e9eef5;

  --myio-chip-ok-bg: #e8f7ff;
  --myio-chip-ok-fg: #007ecc;
  --myio-chip-alert-bg: #fff4e5;
  --myio-chip-alert-fg: #b96b00;
  --myio-chip-failure-bg: #ffeaea;
  --myio-chip-failure-fg: #b71c1c;
  --myio-chip-offline-bg: #f1f5f9;
  --myio-chip-offline-fg: #64748b;

  --myio-text-1: #0f172a;
  --myio-text-2: #4b5563;
  --myio-muted: #94a3b8;

  --myio-eff-bar-bg: #e6edf5;
  --myio-eff-bar-a: #1e90ff;
  --myio-eff-bar-b: #a3d1ff;

  --myio-badge-border: rgba(255, 153, 0, .35);
  --myio-badge-border-failure: rgba(244, 67, 54, .45);
}

/* Main card container */
.myio-ho-card {
  background: var(--myio-card-bg);
  border: 1px solid var(--myio-card-border);
  border-radius: var(--myio-card-radius);
  box-shadow: var(--myio-card-shadow);
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: var(--myio-text-1);
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 280px;
  max-width: 320px;
}

.myio-ho-card:hover {
  box-shadow: 0 4px 12px rgba(10, 31, 68, .12);
  transform: translateY(-1px);
}

.myio-ho-card:focus-within {
  outline: 2px solid #007ecc;
  outline-offset: 2px;
}

/* Selected state with light green background */
.myio-ho-card.is-selected {
  border: 2px solid #00e09e;
  box-shadow: 0 12px 40px rgba(0, 224, 158, 0.25), 0 4px 12px rgba(0, 224, 158, 0.15);
  background: linear-gradient(145deg, #f0fdf9 0%, #ecfdf5 50%, #f0fdf9 100%);
  transform: translateY(-2px);
}

.myio-ho-card.is-selected:hover {
  box-shadow: 0 16px 48px rgba(0, 224, 158, 0.3), 0 8px 16px rgba(0, 224, 158, 0.2);
}

/* Alert and failure states */
.myio-ho-card.is-alert {
  border-color: var(--myio-badge-border);
  box-shadow: 0 0 0 1px var(--myio-badge-border), var(--myio-card-shadow);
}

.myio-ho-card.is-failure {
  border-color: var(--myio-badge-border-failure);
  box-shadow: 0 0 0 1px var(--myio-badge-border-failure), var(--myio-card-shadow);
}

/* Header section */
.myio-ho-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.myio-ho-card__icon {
  width: 28px;
  height: 28px;
  color: #4b6bfb;
  flex-shrink: 0;
  margin-top: 2px;
}

.myio-ho-card.is-alert .myio-ho-card__icon {
  color: var(--myio-chip-alert-fg);
}

.myio-ho-card.is-failure .myio-ho-card__icon {
  color: var(--myio-chip-failure-fg);
}

.myio-ho-card__title {
  flex: 1;
  min-width: 0;
}

.myio-ho-card__name {
  font-weight: 600;
  font-size: 15px;
  color: var(--myio-text-1);
  margin-bottom: 2px;
  word-wrap: break-word;
  line-height: 1.3;
}

.myio-ho-card__code {
  font-size: 12px;
  color: var(--myio-muted);
  font-weight: 500;
}

.myio-ho-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.myio-ho-card__kebab {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--myio-muted);
  transition: all 0.15s ease;
  position: relative;
}

.myio-ho-card__kebab:hover {
  background: #f1f5f9;
  color: var(--myio-text-2);
}

.myio-ho-card__kebab:focus {
  outline: 2px solid #007ecc;
  outline-offset: 1px;
}

.myio-ho-card__menu {
  position: absolute;
  top: 16%;
  right: 0;
  background: white;
  border: 1px solid var(--myio-card-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 140px;
  padding: 4px 0;
  margin-top: 4px;
}

/* Estilos para o Modal */
.myio-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Garante que o modal fique na frente de tudo */
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.myio-modal-overlay.visible {
  opacity: 1;
  visibility: visible;
}

.myio-modal-content {
  background-color: #fff;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  position: relative;
  min-width: 300px;
  text-align: left;
  font-family: sans-serif; /* Use a fonte que preferir */
  line-height: 1.6;
}

.myio-modal-close {
  position: absolute;
  top: 10px;
  right: 15px;
  border: none;
  background: none;
  font-size: 24px;
  cursor: pointer;
  color: #888;
}

.myio-modal-close:hover {
    color: #000;
}

.myio-modal-content p {
  margin: 0;
  color: #333;
}

.myio-modal-content strong {
    color: #000;
}

.myio-modal-title {
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  font-size: 1.25rem; /* 20px */
  color: #333;
  font-weight: 600;
}

.myio-ho-card__menu[hidden] {
  display: none;
}

.myio-ho-card__menu button {
  width: 100%;
  background: none;
  border: none;
  padding: 8px 12px;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--myio-text-1);
  transition: background-color 0.15s ease;
}

.myio-ho-card__menu button:hover {
  background: #f8fafc;
}

.myio-ho-card__menu button:focus {
  background: #e2e8f0;
  outline: none;
}

.myio-ho-card__select {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.myio-ho-card__select[hidden] {
  display: none;
}

.myio-ho-card__select input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

/* =============================================== */
/* === ESTILOS PARA O MODAL DE INFORMAÇÕES === */
/* =============================================== */

/* Fundo escurecido que cobre a tela */
.myio-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

/* Torna o modal visível */
.myio-modal-overlay.visible {
  opacity: 1;
  visibility: visible;
}

/* Caixa de conteúdo do modal */
.myio-modal-content {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 450px;
  position: relative;
  transform: translateY(-20px);
  transition: transform 0.3s ease;
}

.myio-modal-overlay.visible .myio-modal-content {
  transform: translateY(0);
}

/* Título do modal */
.myio-modal-title {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
}

/* Botão de fechar (X) */
.myio-modal-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #aaa;
  line-height: 1;
  padding: 0;
}
.myio-modal-close:hover {
  color: #333;
}

/* Linha de informação (ícone + label + valor) */
.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 0.95rem;
}

/* Estilo do ícone */
.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: #555;
}
.info-icon svg {
  width: 20px;
  height: 20px;
}

/* Rótulo (Ex: "Central:") */
.info-label {
  color: #666;
  font-weight: 500;
}

/* Valor da informação */
.info-value {
  margin-left: auto;
  font-weight: 600;
  color: #333;
  text-align: right;
}

/* Divisor entre seções */
.info-divider {
  border: none;
  border-top: 1px solid #eee;
  margin: 16px 0;
}

/* Status chip */
.myio-ho-card__status {
  margin-bottom: 16px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
}

.chip--ok {
  background: var(--myio-chip-ok-bg);
  color: var(--myio-chip-ok-fg);
}

.chip--alert {
  background: var(--myio-chip-alert-bg);
  color: var(--myio-chip-alert-fg);
}

.chip--failure {
  background: var(--myio-chip-failure-bg);
  color: var(--myio-chip-failure-fg);
}

.chip--offline {
  background: var(--myio-chip-offline-bg);
  color: var(--myio-chip-offline-fg);
}

/* Primary metric */
.myio-ho-card__primary {
  margin-bottom: 16px;
  padding: 8px 0;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.myio-ho-card__primary:hover {
  background: #f8fafc;
}

.myio-ho-card__primary:focus {
  outline: 2px solid #007ecc;
  outline-offset: 2px;
}

.myio-ho-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: wrap;
}

.myio-ho-card__value .num {
  font-size: 24px;
  font-weight: 700;
  color: var(--myio-text-1);
  line-height: 1;
}

.myio-ho-card__value .unit {
  font-size: 16px;
  font-weight: 600;
  color: var(--myio-text-2);
  line-height: 1;
}

.myio-ho-card__value .suffix {
  font-size: 12px;
  color: var(--myio-muted);
  margin-left: 4px;
}

/* Efficiency bar */
.myio-ho-card__eff {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.myio-ho-card__eff .label {
  font-size: 12px;
  color: var(--myio-text-2);
  font-weight: 500;
  min-width: 60px;
}

.myio-ho-card__eff .bar {
  flex: 1;
  height: 6px;
  background: var(--myio-eff-bar-bg);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.myio-ho-card__eff .bar__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--myio-eff-bar-a) 0%, var(--myio-eff-bar-b) 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
  min-width: 2px;
}

.myio-ho-card__eff .perc {
  font-size: 12px;
  font-weight: 600;
  color: var(--myio-text-1);
  min-width: 32px;
  text-align: right;
}

/* Footer metrics */
.myio-ho-card__footer {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.myio-ho-card__footer .metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.myio-ho-card__footer .metric .ico {
  width: 16px;
  height: 16px;
  color: var(--myio-muted);
  flex-shrink: 0;
}

.myio-ho-card__footer .metric .label {
  font-size: 10px;
  color: var(--myio-muted);
  font-weight: 500;
  line-height: 1.2;
}

.myio-ho-card__footer .metric .val {
  font-size: 12px;
  font-weight: 600;
  color: var(--myio-text-1);
  line-height: 1;
}

/* Drag and drop states */
.myio-ho-card[draggable="true"] {
  cursor: grab;
}

.myio-ho-card[draggable="true"]:active {
  cursor: grabbing;
}

.myio-ho-card.is-dragging {
  opacity: 0.5;
  transform: rotate(2deg);
}

/* Responsive adjustments */
@media (max-width: 320px) {
  .myio-ho-card {
    min-width: 260px;
    padding: 14px;
  }
  
  .myio-ho-card__value .num {
    font-size: 20px;
  }
  
  .myio-ho-card__footer {
    gap: 8px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .myio-ho-card {
    border-width: 2px;
  }
  
  .chip {
    border: 1px solid currentColor;
  }
  
  .myio-ho-card__eff .bar {
    border: 1px solid var(--myio-text-2);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .myio-ho-card,
  .myio-ho-card__primary,
  .myio-ho-card__kebab,
  .myio-ho-card__eff .bar__fill {
    transition: none;
  }
}
`;
