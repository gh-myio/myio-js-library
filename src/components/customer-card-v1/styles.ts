/**
 * CustomerCardV1 Styles
 * CSS styles for the customer card component
 */

let stylesInjected = false;

export function injectCustomerCardV1Styles(): void {
  if (stylesInjected) return;

  const styleId = 'myio-customer-card-v1-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
/* ==========================================
   CustomerCardV1 Component Styles
   ========================================== */

.myio-customer-card-v1 {
  position: relative;
  display: block;
  min-height: 112px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  overflow: hidden;
}

.myio-customer-card-v1::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%);
  z-index: 1;
  transition: opacity 0.25s ease;
}

.myio-customer-card-v1:hover {
  transform: scale(1.03);
  box-shadow:
    0 8px 32px rgba(0,0,0,0.3),
    0 0 0 1px rgba(122, 47, 247, 0.3);
  border-color: rgba(122, 47, 247, 0.4);
}

.myio-customer-card-v1:hover::before {
  opacity: 0.7;
}

.myio-customer-card-v1:focus {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(122, 47, 247, 0.4),
    0 8px 32px rgba(0,0,0,0.3);
}

/* Background Image */
.myio-customer-card-v1__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.myio-customer-card-v1__bg.loaded {
  opacity: 1;
}

/* Content Container */
.myio-customer-card-v1__content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  text-align: center;
  width: 90%;
  padding: 0 8px;
}

/* Title */
.myio-customer-card-v1__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #F5F7FA;
  text-shadow: 0 2px 12px rgba(0,0,0,0.6);
  line-height: 1.2;
  word-wrap: break-word;
}

/* Meta Counts Row - Top */
.myio-customer-card-v1__meta-counts {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* Device Counts Row - Bottom */
.myio-customer-card-v1__device-counts {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Badge (shared style for both meta and device counts) */
.myio-customer-card-v1__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 12px;
  min-width: 62px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(245, 247, 250, 0.8);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.myio-customer-card-v1__badge .count {
  font-weight: 700;
}

.myio-customer-card-v1__badge .value {
  font-size: 13px;
  font-weight: 400;
  opacity: 0.85;
  white-space: nowrap;
}

.myio-customer-card-v1__badge:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.08);
}

.myio-customer-card-v1__badge .icon {
  font-size: 13px;
}

/* Badge Type Colors */
.myio-customer-card-v1__badge--energy:hover {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.5);
}
.myio-customer-card-v1__badge--water:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}
.myio-customer-card-v1__badge--temperature:hover {
  background: rgba(249, 115, 22, 0.3);
  border-color: rgba(249, 115, 22, 0.5);
}
.myio-customer-card-v1__badge--users:hover {
  background: rgba(124, 58, 237, 0.3);
  border-color: rgba(124, 58, 237, 0.5);
}
.myio-customer-card-v1__badge--alarms:hover {
  background: rgba(220, 38, 38, 0.3);
  border-color: rgba(220, 38, 38, 0.5);
}
.myio-customer-card-v1__badge--notifications:hover {
  background: rgba(234, 179, 8, 0.3);
  border-color: rgba(234, 179, 8, 0.5);
}

.myio-customer-card-v1__badge--energy .icon { color: #22c55e; }
.myio-customer-card-v1__badge--water .icon { color: #3b82f6; }
.myio-customer-card-v1__badge--temperature .icon { color: #f97316; }
.myio-customer-card-v1__badge--users .icon { color: #a78bfa; }
.myio-customer-card-v1__badge--alarms .icon { color: #f87171; }
.myio-customer-card-v1__badge--notifications .icon { color: #fbbf24; }

/* Loading Spinner */
.myio-customer-card-v1__badge .count-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: customer-card-spin 0.8s linear infinite;
}

.myio-customer-card-v1__badge--energy .count-spinner { border-top-color: #22c55e; }
.myio-customer-card-v1__badge--water .count-spinner { border-top-color: #3b82f6; }
.myio-customer-card-v1__badge--temperature .count-spinner { border-top-color: #f97316; }

@keyframes customer-card-spin {
  to { transform: rotate(360deg); }
}

/* ==========================================
   Light Theme
   ========================================== */
.myio-customer-card-v1--light {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.myio-customer-card-v1--light::before {
  background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.5) 100%);
}

.myio-customer-card-v1--light:hover {
  box-shadow:
    0 8px 32px rgba(0,0,0,0.15),
    0 0 0 1px rgba(122, 47, 247, 0.2);
}

.myio-customer-card-v1--light .myio-customer-card-v1__title {
  color: #1a1a2e;
  text-shadow: 0 2px 12px rgba(255,255,255,0.6);
}

.myio-customer-card-v1--light .myio-customer-card-v1__badge {
  color: rgba(26, 26, 46, 0.8);
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(0, 0, 0, 0.1);
}

.myio-customer-card-v1--light .myio-customer-card-v1__badge:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.2);
}

/* ==========================================
   Responsive - Tablet
   ========================================== */
@media (max-width: 768px) {
  .myio-customer-card-v1 {
    min-height: 100px;
  }

  .myio-customer-card-v1__title {
    font-size: 16px;
  }

  .myio-customer-card-v1__device-counts {
    bottom: 8px;
    gap: 6px;
  }

  .myio-customer-card-v1__badge {
    padding: 4px 8px;
    font-size: 12px;
    min-width: 52px;
  }

  .myio-customer-card-v1__badge .icon {
    font-size: 11px;
  }

  .myio-customer-card-v1__badge .value {
    font-size: 11px;
  }
}

/* ==========================================
   Responsive - Mobile
   ========================================== */
@media (max-width: 480px) {
  .myio-customer-card-v1 {
    min-height: 100px;
    padding: 10px;
  }

  .myio-customer-card-v1__title {
    font-size: 14px;
  }

  .myio-customer-card-v1__device-counts {
    bottom: 6px;
    gap: 5px;
  }

  .myio-customer-card-v1__badge {
    padding: 3px 6px;
    font-size: 11px;
    min-width: 44px;
  }

  .myio-customer-card-v1__badge .icon {
    font-size: 10px;
  }

  .myio-customer-card-v1__badge .value {
    font-size: 10px;
  }
}
`;

  document.head.appendChild(style);
  stylesInjected = true;
}
