/**
 * CustomerCardV2 Styles - Metro UI
 * Flat design with square tiles
 */

let stylesInjected = false;

export function injectCustomerCardV2Styles(): void {
  if (stylesInjected) return;

  const styleId = 'myio-customer-card-v2-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
/* ==========================================
   CustomerCardV2 Component - Metro UI Style
   Flat design with square tiles
   ========================================== */

.myio-customer-card-v2 {
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  border: none;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.myio-customer-card-v2:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.myio-customer-card-v2:focus {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
}

/* Header - Title */
.myio-customer-card-v2__header {
  padding: 16px 20px;
  background: #5B2EBC;
  text-align: center;
}

.myio-customer-card-v2__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #F9F9F9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tiles Grid - 2x3 layout */
.myio-customer-card-v2__tiles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 2px;
  background: #0d0d1a;
  flex: 1;
}

/* Individual Tile */
.myio-customer-card-v2__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  min-height: 60px;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
  position: relative;
}

.myio-customer-card-v2__tile:hover {
  transform: scale(1.02);
  z-index: 1;
}

.myio-customer-card-v2__tile:active {
  transform: scale(0.98);
}

/* Tile Colors */
.myio-customer-card-v2__tile--energy {
  background: #16a34a;
}
.myio-customer-card-v2__tile--energy:hover {
  background: #15803d;
}

.myio-customer-card-v2__tile--water {
  background: #2563eb;
}
.myio-customer-card-v2__tile--water:hover {
  background: #1d4ed8;
}

.myio-customer-card-v2__tile--temperature {
  background: #ea580c;
}
.myio-customer-card-v2__tile--temperature:hover {
  background: #c2410c;
}

.myio-customer-card-v2__tile--users {
  background: #7c3aed;
}
.myio-customer-card-v2__tile--users:hover {
  background: #6d28d9;
}

.myio-customer-card-v2__tile--alarms {
  background: #dc2626;
}
.myio-customer-card-v2__tile--alarms:hover {
  background: #b91c1c;
}

.myio-customer-card-v2__tile--notifications {
  background: #ca8a04;
}
.myio-customer-card-v2__tile--notifications:hover {
  background: #a16207;
}

/* Tile Content */
.myio-customer-card-v2__tile-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.myio-customer-card-v2__tile-value {
  font-size: 18px;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1;
}

.myio-customer-card-v2__tile-label {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.myio-customer-card-v2__tile-secondary {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 2px;
}

/* Loading Spinner */
.myio-customer-card-v2__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: metro-spin 0.8s linear infinite;
}

@keyframes metro-spin {
  to { transform: rotate(360deg); }
}

/* ==========================================
   Light Theme
   ========================================== */
.myio-customer-card-v2--light {
  background: #f0f2f5;
}

.myio-customer-card-v2--light .myio-customer-card-v2__header {
  background: #5B2EBC;
}

.myio-customer-card-v2--light .myio-customer-card-v2__tiles {
  background: #e5e7eb;
}

/* Light theme keeps same tile colors for Metro look */

/* ==========================================
   Responsive - Tablet
   ========================================== */
@media (max-width: 768px) {
  .myio-customer-card-v2__header {
    padding: 12px 16px;
  }

  .myio-customer-card-v2__title {
    font-size: 14px;
  }

  .myio-customer-card-v2__tile {
    padding: 10px 6px;
    min-height: 50px;
  }

  .myio-customer-card-v2__tile-icon {
    font-size: 16px;
  }

  .myio-customer-card-v2__tile-value {
    font-size: 14px;
  }

  .myio-customer-card-v2__tile-label {
    font-size: 9px;
  }
}

/* ==========================================
   Responsive - Mobile
   ========================================== */
@media (max-width: 480px) {
  .myio-customer-card-v2__header {
    padding: 10px 12px;
  }

  .myio-customer-card-v2__title {
    font-size: 12px;
  }

  .myio-customer-card-v2__tile {
    padding: 8px 4px;
    min-height: 45px;
  }

  .myio-customer-card-v2__tile-icon {
    font-size: 14px;
    margin-bottom: 2px;
  }

  .myio-customer-card-v2__tile-value {
    font-size: 12px;
  }

  .myio-customer-card-v2__tile-label {
    font-size: 8px;
  }

  .myio-customer-card-v2__tile-secondary {
    font-size: 9px;
  }
}
`;

  document.head.appendChild(style);
  stylesInjected = true;
}
