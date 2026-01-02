/**
 * RFC-0115: Footer Component Library
 * Alert dialog utilities for the Footer Component
 */

import { FooterColors, DEFAULT_FOOTER_COLORS } from './types';

let currentOverlay: HTMLElement | null = null;
let colors: FooterColors = DEFAULT_FOOTER_COLORS;

/**
 * Set the color palette for alerts
 */
export function setAlertColors(newColors: Partial<FooterColors>): void {
  colors = { ...DEFAULT_FOOTER_COLORS, ...newColors };
}

/**
 * Create the base alert overlay
 */
function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'myio-footer-alert-overlay';

  // Set CSS variables for theming
  overlay.style.setProperty('--fc-surface', colors.surface);
  overlay.style.setProperty('--fc-surface-elevated', colors.surfaceElevated);
  overlay.style.setProperty('--fc-text-primary', colors.textPrimary);
  overlay.style.setProperty('--fc-text-secondary', colors.textSecondary);
  overlay.style.setProperty('--fc-primary', colors.primary);
  overlay.style.setProperty('--fc-primary-dark', colors.primaryDark);
  overlay.style.setProperty('--fc-primary-hover', colors.primaryHover);

  return overlay;
}

/**
 * Create an alert box with icon, title, message, and button
 */
function createAlertBox(
  icon: string,
  title: string,
  message: string,
  buttonLabel: string
): HTMLElement {
  const box = document.createElement('div');
  box.className = 'myio-footer-alert-box';

  box.innerHTML = `
    <div class="myio-footer-alert-icon">${icon}</div>
    <h2 class="myio-footer-alert-title">${title}</h2>
    <p class="myio-footer-alert-message">${message}</p>
    <button class="myio-footer-alert-button" type="button">${buttonLabel}</button>
  `;

  return box;
}

/**
 * Show the mixed unit types alert
 */
export function showMixedUnitsAlert(): void {
  hideAlert();

  const overlay = createOverlay();
  const alertBox = createAlertBox(
    '&#9888;', // Warning symbol
    'Tipos Incompativeis',
    `Voce nao pode comparar dispositivos de <strong>tipos diferentes</strong>
     (ex: energia vs agua). A selecao foi limpa automaticamente.
     <br><br>
     Selecione apenas dispositivos do mesmo tipo para comparacao.`,
    'Entendi'
  );

  overlay.appendChild(alertBox);

  // Close handlers
  const closeButton = alertBox.querySelector('.myio-footer-alert-button');
  if (closeButton) {
    closeButton.addEventListener('click', hideAlert);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAlert();
    }
  });

  // Handle Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideAlert();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

/**
 * Show the selection limit reached alert
 */
export function showLimitAlert(limit: number = 6): void {
  hideAlert();

  const overlay = createOverlay();
  const alertBox = createAlertBox(
    '&#9888;', // Warning symbol
    'Limite Atingido',
    `Voce pode selecionar no maximo <strong>${limit} dispositivos</strong> para comparacao.
     Remova um dispositivo antes de adicionar outro.`,
    'FECHAR'
  );

  overlay.appendChild(alertBox);

  // Close handlers
  const closeButton = alertBox.querySelector('.myio-footer-alert-button');
  if (closeButton) {
    closeButton.addEventListener('click', hideAlert);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAlert();
    }
  });

  // Handle Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideAlert();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

/**
 * Show a custom error alert
 */
export function showErrorAlert(title: string, message: string): void {
  hideAlert();

  const overlay = createOverlay();
  const alertBox = createAlertBox(
    '&#10060;', // X symbol
    title,
    message,
    'FECHAR'
  );

  // Style the icon for error
  const iconEl = alertBox.querySelector('.myio-footer-alert-icon') as HTMLElement;
  if (iconEl) {
    iconEl.style.background = 'linear-gradient(135deg, rgba(255, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)';
    iconEl.style.borderColor = 'rgba(255, 68, 68, 0.5)';
    iconEl.style.color = '#ff4444';
  }

  overlay.appendChild(alertBox);

  // Close handlers
  const closeButton = alertBox.querySelector('.myio-footer-alert-button');
  if (closeButton) {
    closeButton.addEventListener('click', hideAlert);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideAlert();
    }
  });

  // Handle Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideAlert();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  document.body.appendChild(overlay);
  currentOverlay = overlay;
}

/**
 * Hide the current alert
 */
export function hideAlert(): void {
  if (currentOverlay && currentOverlay.parentNode) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}

/**
 * Check if an alert is currently visible
 */
export function isAlertVisible(): boolean {
  return currentOverlay !== null;
}
