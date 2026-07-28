// components/clock/RealTimeClock.ts
// Relógio em tempo real (atualiza a cada segundo) — usado no footer premium.

export type RealTimeClockThemeMode = 'light' | 'dark';

export interface RealTimeClockOptions {
  /** Exibe segundos (default true). */
  showSeconds?: boolean;
  /** Exibe a data antes da hora (default false). */
  showDate?: boolean;
  /** Ícone antes do horário (default '🕐'; '' remove). */
  icon?: string;
  /** Locale de formatação (default 'pt-BR'). */
  locale?: string;
  /** IANA timezone (ex.: 'America/Sao_Paulo'); default = timezone do browser. */
  timezone?: string;
  themeMode?: RealTimeClockThemeMode;
}

export interface RealTimeClockInstance {
  element: HTMLElement;
  setThemeMode(mode: RealTimeClockThemeMode): void;
  destroy(): void;
}

const THEME_COLORS: Record<RealTimeClockThemeMode, string> = {
  light: '#6b7280',
  dark: '#cbd5e1',
};

export function createRealTimeClock(
  container: HTMLElement,
  options: RealTimeClockOptions = {}
): RealTimeClockInstance {
  const opts = { showSeconds: true, showDate: false, icon: '🕐', locale: 'pt-BR', ...options };
  let themeMode: RealTimeClockThemeMode = opts.themeMode || 'light';

  const el = document.createElement('span');
  el.className = 'myio-realtime-clock';
  el.style.cssText =
    'display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;font-size:12px;';
  container.appendChild(el);

  const timeFmt: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(opts.showSeconds ? { second: '2-digit' as const } : {}),
    ...(opts.timezone ? { timeZone: opts.timezone } : {}),
  };
  const dateFmt: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(opts.timezone ? { timeZone: opts.timezone } : {}),
  };

  const tick = (): void => {
    const now = new Date();
    const time = now.toLocaleTimeString(opts.locale, timeFmt);
    const date = opts.showDate ? `${now.toLocaleDateString(opts.locale, dateFmt)} ` : '';
    el.style.color = THEME_COLORS[themeMode];
    el.textContent = `${opts.icon ? `${opts.icon} ` : ''}${date}${time}`;
  };

  tick();
  const timer = setInterval(tick, 1000);

  return {
    element: el,
    setThemeMode(mode) {
      themeMode = mode;
      tick();
    },
    destroy() {
      clearInterval(timer);
      el.remove();
    },
  };
}
