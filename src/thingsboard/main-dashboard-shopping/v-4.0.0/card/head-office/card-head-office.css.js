// Atomic CSS injection for Head Office cards

export const CSS_STRING = `
/* CSS Variables for theming */
:root {
  --myio-card-radius: 16px;
  --myio-card-shadow: 0 2px 8px rgba(10, 31, 68, .06);
  --myio-card-bg: #fff;
  --myio-card-border: #e9eef5;

  /* Status colors - Normal/Power On (blue) */
  --myio-chip-ok-bg: #dbeafe;
  --myio-chip-ok-fg: #1d4ed8;
  --myio-border-ok: rgba(59, 130, 246, 0.4);

  /* Status colors - Standby (green) */
  --myio-chip-standby-bg: #dcfce7;
  --myio-chip-standby-fg: #15803d;
  --myio-border-standby: rgba(34, 197, 94, 0.4);

  /* Status colors - Alert/Warning (yellow) */
  --myio-chip-alert-bg: #fef3c7;
  --myio-chip-alert-fg: #b45309;
  --myio-border-alert: rgba(245, 158, 11, 0.5);

  /* Status colors - Failure (dark red) */
  --myio-chip-failure-bg: #fee2e2;
  --myio-chip-failure-fg: #b91c1c;
  --myio-border-failure: rgba(153, 27, 27, 0.6);

  /* Status colors - Power Off (light red) */
  --myio-chip-power-off-bg: #fecaca;
  --myio-chip-power-off-fg: #dc2626;
  --myio-border-power-off: rgba(239, 68, 68, 0.5);

  /* Status colors - Offline (dark gray) */
  --myio-chip-offline-bg: #e2e8f0;
  --myio-chip-offline-fg: #475569;
  --myio-border-offline: rgba(71, 85, 105, 0.6);

  /* Status colors - No Info (dark orange) */
  --myio-chip-no-info-bg: #fed7aa;
  --myio-chip-no-info-fg: #c2410c;
  --myio-border-no-info: rgba(194, 65, 12, 0.5);

  /* Status colors - Not Installed (purple) */
  --myio-chip-not-installed-bg: #e9d5ff;
  --myio-chip-not-installed-fg: #7c3aed;
  --myio-border-not-installed: rgba(124, 58, 237, 0.5);

  /* Temperature range colors - solid backgrounds for better visibility */
  --myio-temp-cold-bg: #dbeafe;           /* Blue 100 - below ideal range */
  --myio-temp-cold-border: rgba(59, 130, 246, 0.6);
  --myio-temp-ok-bg: #dcfce7;             /* Green 100 - within ideal range */
  --myio-temp-ok-border: rgba(34, 197, 94, 0.6);
  --myio-temp-hot-bg: #fee2e2;            /* Red 100 - above ideal range */
  --myio-temp-hot-border: rgba(239, 68, 68, 0.6);

  --myio-text-1: #0f172a;
  --myio-text-2: #4b5563;
  --myio-muted: #94a3b8;

  --myio-eff-bar-bg: #e6edf5;
  --myio-eff-bar-a: #1e90ff;
  --myio-eff-bar-b: #a3d1ff;

  --myio-badge-border: rgba(255, 153, 0, .35);
  --myio-badge-border-failure: rgba(244, 67, 54, .45);
}

/* Dark Theme Support */
[data-theme="dark"] {
  --myio-card-bg: #1e293b;
  --myio-card-border: #334155;
  --myio-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  --myio-text-1: #f1f5f9;
  --myio-text-2: #94a3b8;
  --myio-muted: #64748b;
  --myio-eff-bar-bg: #334155;
}

[data-theme="dark"] .myio-ho-card {
  background: var(--myio-card-bg);
  border-color: var(--myio-card-border);
  color: var(--myio-text-1);
}

[data-theme="dark"] .myio-ho-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, .4);
}

[data-theme="dark"] .myio-ho-label,
[data-theme="dark"] .myio-ho-value,
[data-theme="dark"] .myio-ho-unit {
  color: var(--myio-text-1);
}

[data-theme="dark"] .myio-ho-subtitle {
  color: var(--myio-text-2);
}

[data-theme="dark"] .myio-ho-secondary-info {
  color: var(--myio-muted);
}

[data-theme="dark"] .myio-ho-icon-bg {
  background: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .myio-ho-dropdown {
  background: #1e293b;
  border-color: #334155;
}

[data-theme="dark"] .myio-ho-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Main card container */
.myio-ho-card {
  background: var(--myio-card-bg);
  border: 1px solid var(--myio-card-border);
  border-radius: var(--myio-card-radius);
  box-shadow: var(--myio-card-shadow);
  padding: 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: var(--myio-text-1);
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 252px;
  max-width: 288px;
  overflow: visible;
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

/* Card border states based on device status */

/* POWER_ON - Blue */
.myio-ho-card.is-power-on {
  border-color: var(--myio-border-ok);
  box-shadow: 0 0 0 2px var(--myio-border-ok), var(--myio-card-shadow);
}

/* STANDBY - Green */
.myio-ho-card.is-standby {
  border-color: var(--myio-border-standby);
  box-shadow: 0 0 0 2px var(--myio-border-standby), var(--myio-card-shadow);
}

/* WARNING - Yellow */
.myio-ho-card.is-warning {
  border-color: var(--myio-border-alert);
  box-shadow: 0 0 0 2px var(--myio-border-alert), var(--myio-card-shadow);
}

/* MAINTENANCE - Yellow */
.myio-ho-card.is-maintenance {
  border-color: var(--myio-border-alert);
  box-shadow: 0 0 0 2px var(--myio-border-alert), var(--myio-card-shadow);
}

/* FAILURE - Dark Red */
.myio-ho-card.is-failure {
  border-color: var(--myio-border-failure);
  box-shadow: 0 0 0 2px var(--myio-border-failure), var(--myio-card-shadow);
}

/* POWER_OFF - Light Red */
.myio-ho-card.is-power-off {
  border-color: var(--myio-border-power-off);
  box-shadow: 0 0 0 2px var(--myio-border-power-off), var(--myio-card-shadow);
}

/* NO_INFO - Dark Orange */
.myio-ho-card.is-no-info {
  border-color: var(--myio-border-no-info);
  box-shadow: 0 0 0 2px var(--myio-border-no-info), var(--myio-card-shadow);
}

/* NOT_INSTALLED - Purple */
.myio-ho-card.is-not-installed {
  border-color: var(--myio-border-not-installed);
  box-shadow: 0 0 0 2px var(--myio-border-not-installed), var(--myio-card-shadow);
}

/* Temperature range backgrounds (domain=temperature only) */
.myio-ho-card.is-temp-cold {
  background: var(--myio-temp-cold-bg);
  border-color: var(--myio-temp-cold-border);
  box-shadow: 0 0 0 2px var(--myio-temp-cold-border), var(--myio-card-shadow);
}

.myio-ho-card.is-temp-ok {
  background: var(--myio-temp-ok-bg);
  border-color: var(--myio-temp-ok-border);
  box-shadow: 0 0 0 2px var(--myio-temp-ok-border), var(--myio-card-shadow);
}

.myio-ho-card.is-temp-hot {
  background: var(--myio-temp-hot-bg);
  border-color: var(--myio-temp-hot-border);
  box-shadow: 0 0 0 2px var(--myio-temp-hot-border), var(--myio-card-shadow);
}

/* Header section */
.myio-ho-card__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  overflow: visible;
}

.myio-ho-card__icon {
  width: 28px;
  height: 28px;
  color: #4b6bfb;
  flex-shrink: 0;
  margin-top: 2px;
}

/* Icon colors based on status */
.myio-ho-card.is-warning .myio-ho-card__icon,
.myio-ho-card.is-maintenance .myio-ho-card__icon {
  color: var(--myio-chip-alert-fg);
}

.myio-ho-card.is-failure .myio-ho-card__icon {
  color: var(--myio-chip-failure-fg);
}

.myio-ho-card.is-power-off .myio-ho-card__icon {
  color: var(--myio-chip-power-off-fg);
}

.myio-ho-card.is-offline .myio-ho-card__icon {
  color: var(--myio-chip-offline-fg);
}

.myio-ho-card.is-no-info .myio-ho-card__icon {
  color: var(--myio-chip-no-info-fg);
}

.myio-ho-card.is-not-installed .myio-ho-card__icon {
  color: var(--myio-chip-not-installed-fg);
}

.myio-ho-card__title {
  flex: 1;
  min-width: 0;
}

/* OFFLINE - Dark Gray */
.myio-ho-card.is-offline {
  border-color: var(--myio-border-offline);
  box-shadow: 0 0 0 2px var(--myio-border-offline), var(--myio-card-shadow);
}

.myio-ho-card__name {
  font-weight: 600;
  font-size: 13px;
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
  position: relative;
  z-index: 10;
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
  overflow: visible;
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
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid var(--myio-card-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 160px;
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

/* ======================================================== */
/* === BLOCO AJUSTADO PARA ALINHAMENTO DE CHIPS === */
/* ======================================================== */

/* ====== CONTAINER DOS CHIPS DE SHOPPING E STATUS ====== */
.myio-ho-card__chips-row {
  display: flex; /* Usa Flexbox para alinhamento horizontal */
  justify-content: space-between; /* Empurra os itens para as extremidades (esquerda e direita) */
  align-items: center; /* Centraliza verticalmente os chips */
  
  /* Usa o mesmo padding lateral do card (14px) */
  padding: 0 0px; 
  
  /* Espaçamento acima (para separar do header) e abaixo (para separar do valor) */
  margin-top: 10px; 
  margin-bottom: 12px;
}

/* ====== ESTILO DO CHIP DE SHOPPING (estilo "Mont Serrat") ====== */
.myio-ho-card__shopping-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  /* Cores baseadas na imagem "Mont Serrat" */
  background-color: #EBF4FF; /* Fundo azul bem claro */
  border: 1px solid #BEE3F8; /* Borda azul clara */
  color: #2C5282; /* Texto azul escuro */

  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  white-space: nowrap;
}

.myio-ho-card__shopping-chip .chip-icon {
  /* Ajusta o ícone SVG */
  width: 14px;
  height: 14px;
  opacity: 0.7;
  stroke: currentColor; /* Faz o SVG usar a cor do texto */
}

/* ====== CONTAINER ADICIONAL PARA O CHIP DE STATUS ====== */
.myio-ho-card__status-chip-container {
  /* Este seletor é um container para o chip de status, 
     permitindo que o flexbox o alinhe à direita. */
  /* O alinhamento é feito pelo justify-content: space-between no pai */
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

.myio-ho-card__menu button {
  display: flex;
  align-items: center;
  gap: 8px; /* Espaço entre o ícone e o texto */
  text-align: left;
  width: 100%;
}

.myio-ho-card__menu button img {
  flex-shrink: 0; /* Impede que o ícone seja espremido */
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
  /* margin-bottom: 7px; <-- Esta linha foi removida */
  /* O espaçamento agora é controlado por .myio-ho-card__chips-row */
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

.chip--standby {
  background: var(--myio-chip-standby-bg);
  color: var(--myio-chip-standby-fg);
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

/* New chip classes aligned with getCardStateClass */
.chip--power-on {
  background: var(--myio-chip-ok-bg);
  color: var(--myio-chip-ok-fg);
}

.chip--warning {
  background: var(--myio-chip-alert-bg);
  color: var(--myio-chip-alert-fg);
}

.chip--maintenance {
  background: var(--myio-chip-alert-bg);
  color: var(--myio-chip-alert-fg);
}

.chip--power-off {
  background: var(--myio-chip-power-off-bg);
  color: var(--myio-chip-power-off-fg);
}

.chip--no-info {
  background: var(--myio-chip-no-info-bg);
  color: var(--myio-chip-no-info-fg);
}

.chip--not-installed {
  background: var(--myio-chip-not-installed-bg);
  color: var(--myio-chip-not-installed-fg);
}

/* Status indicator dot for power metric */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--myio-chip-offline-fg);
}

.status-dot.dot--ok {
  background: var(--myio-chip-ok-fg);
}

.status-dot.dot--standby {
  background: var(--myio-chip-standby-fg);
}

.status-dot.dot--alert {
  background: var(--myio-chip-alert-fg);
}

.status-dot.dot--failure {
  background: var(--myio-chip-failure-fg);
}

.status-dot.dot--offline {
  background: var(--myio-chip-offline-fg);
}

.status-dot.dot--neutral {
  background: var(--myio-muted);
}

/* New dot classes aligned with getCardStateClass */
.status-dot.dot--power-on {
  background: var(--myio-chip-ok-fg);
}

.status-dot.dot--warning {
  background: var(--myio-chip-alert-fg);
}

.status-dot.dot--maintenance {
  background: var(--myio-chip-alert-fg);
}

.status-dot.dot--power-off {
  background: var(--myio-chip-power-off-fg);
}

.status-dot.dot--no-info {
  background: var(--myio-chip-no-info-fg);
}

.status-dot.dot--not-installed {
  background: var(--myio-chip-not-installed-fg);
}

/* Primary metric */
.myio-ho-card__primary {
  margin-bottom: 14px;
  padding: 7px 0;
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
  justify-content: center;
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
  margin-bottom: 14px;
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

/* Footer metrics - Now with 2 columns (removed temperature) */
.myio-ho-card__footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 0 8px;
}

.myio-ho-card__footer .metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}

.myio-ho-card__footer .metric .status-dot {
  margin-bottom: 2px;
}

.myio-ho-card__footer .metric .ico {
  width: 18px;
  height: 18px;
  color: var(--myio-muted);
  flex-shrink: 0;
}

.myio-ho-card__footer .metric .label {
  font-size: 10.5px;
  color: var(--myio-muted);
  font-weight: 500;
  line-height: 1.2;
}

.myio-ho-card__footer .metric .val {
  font-size: 11px;
  font-weight: 600;
  color: var(--myio-text-1);
  line-height: 1.3;
  word-break: break-word;
  max-width: 100%;
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
    min-width: 234px;
    padding: 12px;
  }

  .myio-ho-card__value .num {
    font-size: 20px;
  }

  .myio-ho-card__footer {
    gap: 7px;
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

/* ============================================
   DEBUG TOOLTIP STYLES (Premium)
   ============================================ */

.has-debug-tooltip {
  cursor: help !important;
}

.has-debug-tooltip::after {
  content: '🐛';
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 10px;
  z-index: 1;
}

.debug-tooltip-container {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.has-debug-tooltip:hover .debug-tooltip-container {
  opacity: 1;
  pointer-events: auto;
}

.debug-tooltip {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 12px;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  min-width: 340px;
  max-width: 420px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #e2e8f0;
  overflow: hidden;
}

.debug-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.2);
}

.debug-tooltip__icon {
  font-size: 16px;
}

.debug-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #f1f5f9;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.debug-tooltip__content {
  padding: 12px 16px;
  max-height: 400px;
  overflow-y: auto;
}

.debug-tooltip__section {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.debug-tooltip__section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.debug-tooltip__section-title {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.debug-tooltip__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 4px 0;
  gap: 12px;
}

.debug-tooltip__row--full {
  flex-direction: column;
  gap: 4px;
}

.debug-tooltip__label {
  color: #94a3b8;
  font-size: 11px;
  flex-shrink: 0;
}

.debug-tooltip__value {
  color: #f1f5f9;
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

.debug-tooltip__row--full .debug-tooltip__value {
  text-align: left;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  width: 100%;
  box-sizing: border-box;
}

.debug-tooltip__value--mono {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
}

.debug-tooltip__value--highlight {
  color: #a5b4fc;
  font-style: italic;
}

.debug-tooltip__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(99, 102, 241, 0.3);
  color: #a5b4fc;
}

.debug-tooltip__badge--energy {
  background: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.debug-tooltip__badge--water {
  background: rgba(6, 182, 212, 0.3);
  color: #67e8f9;
}

.debug-tooltip__badge--temperature {
  background: rgba(249, 115, 22, 0.3);
  color: #fdba74;
}

/* Tooltip arrow */
.debug-tooltip::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 12px;
  height: 12px;
  background: #0f172a;
  border-right: 1px solid rgba(99, 102, 241, 0.3);
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
}

/* Scrollbar styling for tooltip content */
.debug-tooltip__content::-webkit-scrollbar {
  width: 6px;
}

.debug-tooltip__content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.debug-tooltip__content::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.4);
  border-radius: 3px;
}

.debug-tooltip__content::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.6);
}

/* ============================================
   Temperature Range Tooltip (for domain=temperature)
   Shows temperature ruler with current position and deviation
   ============================================ */
.temp-range-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateY(5px);
}

.temp-range-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.temp-range-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 280px;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.temp-range-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #fff7ed 0%, #fed7aa 100%);
  border-bottom: 1px solid #fdba74;
}

.temp-range-tooltip__icon {
  font-size: 18px;
}

.temp-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #c2410c;
}

.temp-range-tooltip__body {
  padding: 16px;
}

/* Temperature value display */
.temp-range-tooltip__value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.temp-range-tooltip__current {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.temp-range-tooltip__current sup {
  font-size: 14px;
  color: #64748b;
}

.temp-range-tooltip__deviation {
  text-align: right;
}

.temp-range-tooltip__deviation-value {
  font-size: 16px;
  font-weight: 700;
}

.temp-range-tooltip__deviation-value.cold {
  color: #2563eb;
}

.temp-range-tooltip__deviation-value.ok {
  color: #16a34a;
}

.temp-range-tooltip__deviation-value.hot {
  color: #dc2626;
}

.temp-range-tooltip__deviation-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Temperature ruler/gauge */
.temp-range-tooltip__ruler {
  position: relative;
  height: 32px;
  margin: 12px 0;
  border-radius: 8px;
  overflow: visible;
}

.temp-range-tooltip__ruler-track {
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  height: 8px;
  background: linear-gradient(90deg, #dbeafe 0%, #dcfce7 50%, #fee2e2 100%);
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.temp-range-tooltip__ruler-range {
  position: absolute;
  top: 12px;
  height: 8px;
  background: #22c55e;
  border-radius: 4px;
  opacity: 0.6;
}

.temp-range-tooltip__ruler-marker {
  position: absolute;
  top: 4px;
  width: 4px;
  height: 24px;
  background: #1e293b;
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.temp-range-tooltip__ruler-marker::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: #1e293b;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.temp-range-tooltip__ruler-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10px;
  color: #64748b;
}

.temp-range-tooltip__ruler-min,
.temp-range-tooltip__ruler-max {
  font-weight: 600;
}

/* Range info */
.temp-range-tooltip__range-info {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 12px;
}

.temp-range-tooltip__range-item {
  text-align: center;
}

.temp-range-tooltip__range-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.temp-range-tooltip__range-value {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

/* Status badge */
.temp-range-tooltip__status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.temp-range-tooltip__status.cold {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.temp-range-tooltip__status.ok {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.temp-range-tooltip__status.hot {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.temp-range-tooltip__status.unknown {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

/* ============================================
   Energy Range Tooltip (for domain=energy)
   Shows power ruler with current position and status ranges
   ============================================ */
.energy-range-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateY(5px);
}

.energy-range-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.energy-range-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 300px;
  max-width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.energy-range-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%);
  border-bottom: 1px solid #6ee7b7;
}

.energy-range-tooltip__icon {
  font-size: 18px;
}

.energy-range-tooltip__title {
  font-weight: 700;
  font-size: 13px;
  color: #047857;
}

.energy-range-tooltip__body {
  padding: 16px;
}

/* Power value display */
.energy-range-tooltip__value-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.energy-range-tooltip__current {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.energy-range-tooltip__current sup {
  font-size: 14px;
  color: #64748b;
}

.energy-range-tooltip__status-badge {
  text-align: right;
}

.energy-range-tooltip__status-value {
  font-size: 14px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
}

.energy-range-tooltip__status-value.standby {
  background: #dbeafe;
  color: #1d4ed8;
}

.energy-range-tooltip__status-value.normal {
  background: #dcfce7;
  color: #15803d;
}

.energy-range-tooltip__status-value.alert {
  background: #fef3c7;
  color: #b45309;
}

.energy-range-tooltip__status-value.failure {
  background: #fee2e2;
  color: #b91c1c;
}

.energy-range-tooltip__status-value.offline {
  background: #f3f4f6;
  color: #6b7280;
}

/* Power ruler/gauge */
.energy-range-tooltip__ruler {
  position: relative;
  height: 40px;
  margin: 12px 0;
  border-radius: 8px;
  overflow: visible;
}

.energy-range-tooltip__ruler-track {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  height: 8px;
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.energy-range-tooltip__ruler-segment {
  height: 100%;
}

.energy-range-tooltip__ruler-segment.standby {
  background: #dbeafe;
}

.energy-range-tooltip__ruler-segment.normal {
  background: #dcfce7;
}

.energy-range-tooltip__ruler-segment.alert {
  background: #fef3c7;
}

.energy-range-tooltip__ruler-segment.failure {
  background: #fee2e2;
}

.energy-range-tooltip__ruler-marker {
  position: absolute;
  top: 8px;
  width: 4px;
  height: 24px;
  background: #1e293b;
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.energy-range-tooltip__ruler-marker::after {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: #1e293b;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Range info grid */
.energy-range-tooltip__ranges {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 16px;
}

.energy-range-tooltip__range-item {
  text-align: center;
  padding: 8px 4px;
  border-radius: 6px;
  background: #f8fafc;
}

.energy-range-tooltip__range-item.standby {
  border-left: 3px solid #3b82f6;
}

.energy-range-tooltip__range-item.normal {
  border-left: 3px solid #22c55e;
}

.energy-range-tooltip__range-item.alert {
  border-left: 3px solid #f59e0b;
}

.energy-range-tooltip__range-item.failure {
  border-left: 3px solid #ef4444;
}

.energy-range-tooltip__range-label {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}

.energy-range-tooltip__range-value {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
}

/* Status info */
.energy-range-tooltip__status-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.energy-range-tooltip__status-info.standby {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #93c5fd;
}

.energy-range-tooltip__status-info.normal {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.energy-range-tooltip__status-info.alert {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fcd34d;
}

.energy-range-tooltip__status-info.failure {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.energy-range-tooltip__status-info.offline {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
}
`;