// src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.icons.ts
// Monochrome, minimal, CSS-tintable (fill="currentColor")

export const Icons = {
  // 🧰 fallback
  gear: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.66l-1.92-3.32a.5.5 0 0 0-.62-.22l-2.39.96a7.36 7.36 0 0 0-1.63-.94l-.36-2.55A.5.5 0 0 0 13.89 1h-3.78a.5.5 0 0 0-.49.41l-.36 2.55c-.58.23-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.62.22L2.7 7.48a.5.5 0 0 0 .12.66l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 13.18a.5.5 0 0 0-.12.66l1.92 3.32c.13.23.4.32.62.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.55c.05.23.26.41.49.41h3.78c.23 0 .44-.18.49-.41l.36-2.55c.58-.23 1.12-.53 1.63-.94l2.39.96c.22.1.49 0 .62-.22l1.92-3.32a.5.5 0 0 0-.12-.66l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
</svg>`,

  // 🟩 Elevator (cabin + arrows)
  elevator: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h12V5H6Z"/>
  <path d="M11 17h2v-5h-2v5Zm-2.5-7.5 2-2-2-2v4Zm7 0v-4l-2 2 2 2Z"/>
</svg>`,

  // 🟦 Escalator
  escalator: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M3 16a3 3 0 0 1 3-3h3.6l4.4-6H20a2 2 0 1 1 0 4h-3.6l-4.4 6H6a3 3 0 0 1-3-3Z"/>
  <circle cx="8.5" cy="6" r="1.5"/>
</svg>`,

  // 🟥 Chiller (snowflake)
  chiller: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M12 2v20M4 7l16 10M4 17L20 7"/>
  <path d="M8 4l4 3 4-3M8 20l4-3 4 3M3 12h18"/>
</svg>`,

  // 💧 Pump (droplet + impeller)
  pump: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M12 3s-5 5.6-5 9a5 5 0 0 0 10 0c0-3.4-5-9-5-9Zm0 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>
  <path fill="currentColor" d="M12 9.3c.9 0 1.7.8 1.7 1.7S12.9 12.7 12 12.7 10.3 12 10.3 11 11.1 9.3 12 9.3Z"/>
</svg>`,

  // 🌬️ Fan
  fan: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="2.2"/>
  <path d="M12 4c2.5 0 4 1.5 4 3.3 0 1.3-.7 2.4-1.7 3.2-1.3 1-3 .7-3-.9V4Z"/>
  <path d="M20 12c0 2.5-1.5 4-3.3 4-1.3 0-2.4-.7-3.2-1.7-1-1.3-.7-3 .9-3H20Z"/>
  <path d="M12 20c-2.5 0-4-1.5-4-3.3 0-1.3.7-2.4 1.7-3.2 1.3-1 3-.7 3 .9V20Z"/>
  <path d="M4 12c0-2.5 1.5-4 3.3-4 1.3 0 2.4.7 3.2 1.7 1 1.3.7 3-.9 3H4Z"/>
</svg>`,

  // 🔄 Motor (stator/rotor)
  motor: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <rect x="3" y="7" width="14" height="10" rx="3"/>
  <rect x="17" y="10" width="4" height="4" rx="1"/>
  <circle cx="10" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
</svg>`,

  // 🌡️ Thermostat
  thermometer: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M11 5a3 3 0 0 1 6 0v6.1a5 5 0 1 1-6 0V5Z"/>
  <rect x="13" y="4" width="2" height="9" rx="1"/>
</svg>`,

  // 🔘 Auto/Manual switch
  switch: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <rect x="2" y="7" width="20" height="10" rx="5"/>
  <circle cx="9" cy="12" r="3.5" fill="#fff"/>
</svg>`,

  // 📟 3F meter (gauge)
  energyMeter: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <rect x="3" y="4" width="18" height="14" rx="2"/>
  <path d="M6 16h12v2H6z"/>
  <path d="M12 8a5 5 0 0 0-5 5h2a3 3 0 0 1 6 0h2a5 5 0 0 0-5-5Z"/>
</svg>`,

  // 💧 Water tank
  waterTank: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <rect x="5" y="4" width="14" height="16" rx="2"/>
  <path d="M7 12c1.5 1 3 .9 5-.3s3.5-1.3 5 .3v4H7v-4Z" fill="#fff" fill-opacity=".25"/>
</svg>`,

  // 🟠 Failure (used in chips if needed)
  alertTriangle: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <path d="M12.9 3.6a1.5 1.5 0 0 0-2.7 0L2.6 18.1A1.5 1.5 0 0 0 3.9 20h16.2a1.5 1.5 0 0 0 1.3-1.9L12.9 3.6Z"/>
  <rect x="11" y="9" width="2" height="6" rx="1" fill="#fff"/>
  <circle cx="12" cy="17" r="1" fill="#fff"/>
</svg>`,

  // 🟦 Online chip (dot)
  dot: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="5"/>
</svg>`,



waterDrop: `
<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <g id="water" transform="translate(-4 -2)">
    <path id="secondary" fill="#2ca9bc" d="M19,14A7,7,0,1,1,5,14C5,8,12,3,12,3S19,8,19,14Z"/>
    <path id="primary" d="M19,14A7,7,0,1,1,5,14C5,8,12,3,12,3S19,8,19,14Z" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
  </g>
</svg>`,

  // ⋮ Kebab (for actions menu)
  kebab: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
     viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
</svg>`
};

// Device type to icon mapping
export const ICON_MAP: Record<string, string> = {
  ESCADA_ROLANTE: Icons.escalator,
  ELEVADOR: Icons.elevator,
  ELEVADOR_SERVICO: Icons.elevator,
  CHILLER: Icons.chiller,
  PUMP: Icons.pump,
  COMPRESSOR: Icons.motor,
  VENTILADOR: Icons.fan,
  MOTOR: Icons.motor,
  TERMOSTATO: Icons.thermometer,
  SELETOR_AUTO_MANUAL: Icons.switch,
  '3F_MEDIDOR': Icons.energyMeter,
  CAIXA_D_AGUA: Icons.waterTank,
  DEFAULT: Icons.gear
};
