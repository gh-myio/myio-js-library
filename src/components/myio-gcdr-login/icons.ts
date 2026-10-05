/** Inline lucide drawings (ISC licence) — no icon library at runtime. */

const svg = (body: string, size = 16) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  eye: (s?: number) => svg('<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>', s),
  eyeOff: (s?: number) =>
    svg('<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.9 3.12 10 7a10.7 10.7 0 0 1-1.67 3.13"/><path d="M14.08 14.16a3 3 0 1 1-4.24-4.24"/><path d="M17.48 17.5A10.7 10.7 0 0 1 12 19c-4.97 0-8.9-3.12-10-7a10.7 10.7 0 0 1 4.52-5.5"/><path d="m2 2 20 20"/>', s),
  lock: (s?: number) => svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', s),
  shieldAlert: (s?: number) =>
    svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>', s),
  alert: (s?: number) => svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>', s),
  info: (s?: number) => svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', s),
  sun: (s?: number) =>
    svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>', s),
  moon: (s?: number) => svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', s),
  globe: (s?: number) => svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>', s),
  x: (s?: number) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s),
  arrowLeft: (s?: number) => svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', s),
  chevronRight: (s?: number) => svg('<path d="m9 18 6-6-6-6"/>', s),
  external: (s?: number) => svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', s),
  book: (s?: number) => svg('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>', s),
  headset: (s?: number) =>
    svg('<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>', s),
  plug: (s?: number) => svg('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>', s),
  grid: (s?: number) => svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', s),
  building: (s?: number) =>
    svg('<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>', s),
  activity: (s?: number) => svg('<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>', s),
  spinner: (s?: number) => svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', s),
};
