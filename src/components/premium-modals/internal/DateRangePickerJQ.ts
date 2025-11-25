// internal/DateRangePickerJQ.ts
// Default-on DateRangePicker with robust fallbacks

import { DATERANGEPICKER_STYLES } from './styles/tokens';

// Global type declarations for CDN libraries
declare global {
  interface Window {
    jQuery?: any;
    moment?: any;
    $?: any;
  }
}

export interface AttachOptions {
  presetStart?: string;  // ISO or "YYYY-MM-DD"
  presetEnd?: string;    // ISO or "YYYY-MM-DD"
  maxRangeDays?: number; // default 31
  parentEl?: HTMLElement; // modal root for proper z-index
  onApply?: (result: DateRangeResult) => void;

  // RFC-0086: DateTime picker options
  includeTime?: boolean;  // Enable time selection (default: false)
  timePrecision?: 'minute' | 'hour'; // Time precision (default: 'minute')
  locale?: 'pt-BR' | 'en-US'; // Locale (default: 'pt-BR')
}

export interface DateRangeResult {
  startISO: string;      // YYYY-MM-DDTHH:mm:ss-03:00
  endISO: string;        // YYYY-MM-DDTHH:mm:ss-03:00
  startLabel: string;    // DD/MM/YY HH:mm
  endLabel: string;      // DD/MM/YY HH:mm
}

export interface DateRangeControl {
  getDates(): DateRangeResult;
  setDates(startISO: string, endISO: string): void;
  destroy(): void;
}

// CDN Resources with SRI
const CDN_RESOURCES = [
  {
    id: 'jquery-3.7.1',
    src: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
    integrity: 'sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs',
    crossorigin: 'anonymous'
  },
  {
    id: 'moment-2.29.4',
    src: 'https://cdn.jsdelivr.net/npm/moment@2.29.4/min/moment.min.js',
    integrity: 'sha384-2xoILS8hBHw+Atyv/qJLEdk8dFdW1hbGjfeQ3G0GU3pGNPlqck0chRqjMTZ5blGf',
    crossorigin: 'anonymous'
  },
  {
    id: 'daterangepicker-3.1.0',
    src: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.min.js',
    integrity: 'sha384-IbJFThFkdkMvvxP0U8wOffxBHPYEJE65UtA/l25/jJQUt/hft6OdAuKLxGjtOVnL',
    crossorigin: 'anonymous'
  }
];

const CSS_RESOURCE = {
  id: 'daterangepicker-css',
  href: 'https://cdn.jsdelivr.net/npm/daterangepicker@3.1.0/daterangepicker.css',
  integrity: 'sha384-zLkQsiLfAQqGeIJeKLC+rcCR1YoYaQFLCL7cLDUoKE1ajKJzySpjzWGfYS2vjSG+',
  crossorigin: 'anonymous'
};

// Fallback paths for self-hosted assets
const FALLBACK_PATHS = [
  '/assets/vendor/jquery.min.js',
  '/assets/vendor/moment.min.js',
  '/assets/vendor/daterangepicker.min.js'
];

// RFC-0086: Generate locale configuration based on includeTime option
function getLocaleConfig(includeTime: boolean = false): any {
  return {
    format: includeTime ? 'DD/MM/YY HH:mm' : 'DD/MM/YYYY',
    separator: ' até ',
    applyLabel: 'Aplicar',
    cancelLabel: 'Cancelar',
    fromLabel: 'De',
    toLabel: 'Até',
    customRangeLabel: 'Personalizado',
    daysOfWeek: ['Do','Se','Te','Qa','Qi','Se','Sa'],
    monthNames: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
    firstDay: 1
  };
}

class CDNLoader {
  private static jQueryInstance: any = null;
  private static loadingPromise: Promise<any> | null = null;
  private static loaded = false;

  static async ensureLoaded(): Promise<any> {
    if (this.loaded && this.jQueryInstance) {
      return this.jQueryInstance;
    }
    
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadResources();
    return this.loadingPromise;
  }

  private static async loadResources(): Promise<any> {
    // Check if already available
    if (window.jQuery && window.moment && window.jQuery.fn.daterangepicker) {
      this.jQueryInstance = window.jQuery.noConflict(true);
      this.loaded = true;
      return this.jQueryInstance;
    }

    try {
      // Try CDN first
      await this.loadFromCDN();
      console.log('DateRangePicker: CDN loaded successfully');
    } catch (cdnError) {
      console.warn('DateRangePicker: CDN failed, trying local assets:', cdnError);
      
      try {
        // Try local assets
        await this.loadFromLocal();
        console.log('DateRangePicker: Local assets loaded successfully');
      } catch (localError) {
        console.warn('DateRangePicker: Local assets failed, using native inputs:', localError);
        throw new Error('DateRangePicker unavailable - using native inputs');
      }
    }

    // Capture jQuery and release global $
    this.jQueryInstance = window.jQuery?.noConflict(true);
    this.loaded = true;
    
    if (!this.jQueryInstance) {
      throw new Error('jQuery not available after loading');
    }

    return this.jQueryInstance;
  }

  private static async loadFromCDN(): Promise<void> {
    // Load CSS first
    await this.loadCSS(CSS_RESOURCE.href, CSS_RESOURCE.integrity);
    
    // Load JS resources sequentially
    for (const resource of CDN_RESOURCES) {
      await this.loadScript(resource.src, resource.integrity);
    }
  }

  private static async loadFromLocal(): Promise<void> {
    // Try to load from local paths (no integrity check for local)
    for (const path of FALLBACK_PATHS) {
      await this.loadScript(path);
    }
  }

  private static loadScript(src: string, integrity?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
      }
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }

  private static loadCSS(href: string, integrity?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      if (integrity) {
        link.integrity = integrity;
        link.crossOrigin = 'anonymous';
      }
      
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
      
      document.head.appendChild(link);
    });
  }
}

// Native input fallback
function createNativeFallback(input: HTMLInputElement, opts: AttachOptions): DateRangeControl {
  // Replace single input with two native date inputs
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.gap = '8px';
  
  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.className = input.className;
  startInput.style.width = '150px';
  
  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.className = input.className;
  endInput.style.width = '150px';
  
  // Set default values
  if (opts.presetStart) {
    startInput.value = opts.presetStart.split('T')[0]; // Extract date part
  } else {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    startInput.value = firstOfMonth.toISOString().split('T')[0];
  }
  
  if (opts.presetEnd) {
    endInput.value = opts.presetEnd.split('T')[0]; // Extract date part
  } else {
    endInput.value = new Date().toISOString().split('T')[0];
  }
  
  container.appendChild(startInput);
  container.appendChild(endInput);
  
  // Replace original input
  input.parentNode?.replaceChild(container, input);
  
  return {
    getDates(): DateRangeResult {
      const start = new Date(startInput.value + 'T00:00:00');
      const end = new Date(endInput.value + 'T23:59:59');
      
      // Generate timezone-aware ISO strings
      const startISO = start.toISOString().replace('Z', getTimezoneOffset());
      const endISO = end.toISOString().replace('Z', getTimezoneOffset());
      
      return {
        startISO,
        endISO,
        startLabel: start.toLocaleDateString('pt-BR'),
        endLabel: end.toLocaleDateString('pt-BR')
      };
    },
    
    setDates(startISO: string, endISO: string): void {
      startInput.value = startISO.split('T')[0];
      endInput.value = endISO.split('T')[0];
    },
    
    destroy(): void {
      container.remove();
    }
  };
}

function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset <= 0 ? '+' : '-';
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Inject premium MyIO styling for DateRangePicker
function injectPremiumStyling(): void {
  const styleId = 'myio-daterangepicker-styles';
  
  // Check if already injected
  if (document.getElementById(styleId)) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = DATERANGEPICKER_STYLES;
  document.head.appendChild(style);
}

// Main attach function
export async function attach(input: HTMLInputElement, opts: AttachOptions = {}): Promise<DateRangeControl> {
  try {
    const $ = await CDNLoader.ensureLoaded();
    return createDateRangePicker($, input, opts);
  } catch (error) {
    console.error('DateRangePicker: Failed to load dependencies. Native date inputs are forbidden in this project.', error);
    throw new Error('DateRangePicker dependencies unavailable. Please ensure jQuery, moment.js, and daterangepicker are accessible.');
  }
}

function createDateRangePicker($: any, input: HTMLInputElement, opts: AttachOptions): DateRangeControl {
  const $input = $(input);
  const maxRangeDays = opts.maxRangeDays ?? 31;
  
  // Inject premium MyIO styling
  injectPremiumStyling();
  
  // Set input properties
  input.readOnly = true;
  input.setAttribute('aria-label', 'Período de datas');
  
  // Add helper text container for proper alignment
  const helpText = document.createElement('div');
  helpText.className = 'myio-text-muted';
  helpText.style.fontSize = '12px';
  helpText.style.marginTop = '4px';
  helpText.style.display = 'flex';
  helpText.style.alignItems = 'center';
  input.parentNode?.appendChild(helpText);
  
  // RFC-0086: Determine if we need time precision
  const includeTime = opts.includeTime === true;
  const timePrecision = opts.timePrecision || 'minute';

  // RFC-0086: Get locale configuration based on includeTime
  const localeConfig = getLocaleConfig(includeTime);

  // Normalize preset dates
  const moment = window.moment;
  let startDate, endDate;

  if (includeTime) {
    // For datetime: preserve exact time or use now/start-of-day
    startDate = opts.presetStart
      ? moment(opts.presetStart)
      : moment().startOf('day');
    endDate = opts.presetEnd
      ? moment(opts.presetEnd)
      : moment(); // Use current time
  } else {
    // For date-only: use start/end of day
    startDate = opts.presetStart
      ? moment(opts.presetStart).startOf('day')
      : moment().startOf('month');
    endDate = opts.presetEnd
      ? moment(opts.presetEnd).endOf('day')
      : moment().endOf('day');
  }

  // RFC-0086: Build ranges based on includeTime option
  let ranges: Record<string, [any, any]>;

  if (includeTime) {
    // Time-based presets (última hora, últimas 6h, etc.)
    const now = moment();
    ranges = {
      'Última hora': [moment().subtract(1, 'hours'), now.clone()],
      'Últimas 6 horas': [moment().subtract(6, 'hours'), now.clone()],
      'Últimas 12 horas': [moment().subtract(12, 'hours'), now.clone()],
      'Últimas 24 horas': [moment().subtract(24, 'hours'), now.clone()],
      'Hoje': [moment().startOf('day'), now.clone()],
      'Ontem': [moment().subtract(1, 'day').startOf('day'), moment().subtract(1, 'day').endOf('day')],
      'Últimos 7 dias': [moment().subtract(6,'days').startOf('day'), now.clone()],
      'Este mês': [moment().startOf('month'), now.clone()]
    };
  } else {
    // Date-only presets (existing behavior)
    ranges = {
      'Hoje': [moment().startOf('day'), moment().endOf('day')],
      'Últimos 7 dias': [moment().subtract(6,'days').startOf('day'), moment().endOf('day')],
      'Últimos 30 dias': [moment().subtract(29,'days').startOf('day'), moment().endOf('day')],
      'Mês Anterior': [moment().subtract(1,'month').startOf('month'), moment().subtract(1,'month').endOf('month')]
    };
  }

  // Setup DateRangePicker
  $input.daterangepicker({
    parentEl: opts.parentEl || document.body,
    timePicker: includeTime, // RFC-0086: Conditional time picker
    timePicker24Hour: true,
    timePickerIncrement: timePrecision === 'hour' ? 60 : 1, // RFC-0086: Hour vs minute precision
    autoApply: true,
    autoUpdateInput: true,
    linkedCalendars: true,
    showCustomRangeLabel: true,
    maxSpan: { days: maxRangeDays },
    maxDate: moment().endOf('day'),
    startDate: startDate,
    endDate: endDate,
    opens: 'right',
    drops: 'down',
    locale: localeConfig, // RFC-0086: Dynamic locale format
    applyButtonClasses: 'btn btn-primary',
    cancelClass: 'btn btn-muted',
    ranges: ranges // RFC-0086: Dynamic ranges
  });
  
  // Set initial display
  updateInputDisplay();
  
  // Event handlers
  $input.on('apply.daterangepicker.myio', () => {
    updateInputDisplay();
    if (opts.onApply) {
      const result = getDates();
      opts.onApply(result);
    }
  });
  
  $input.on('cancel.daterangepicker.myio', () => {
    $input.val('');
    if (opts.onApply) {
      opts.onApply({ startISO: '', endISO: '', startLabel: '', endLabel: '' });
    }
  });
  
  function updateInputDisplay(): void {
    const picker = $input.data('daterangepicker');
    if (picker) {
      const formatted = `${picker.startDate.format(localeConfig.format)}${localeConfig.separator}${picker.endDate.format(localeConfig.format)}`;
      $input.val(formatted);
    }
  }

  function getDates(): DateRangeResult {
    const picker = $input.data('daterangepicker');

    // RFC-0086: Use moment.format() to preserve timezone offset
    const startISO = picker.startDate.format('YYYY-MM-DD[T]HH:mm:ssZ');
    const endISO = picker.endDate.format('YYYY-MM-DD[T]HH:mm:ssZ');
    const startLabel = picker.startDate.format(localeConfig.format);
    const endLabel = picker.endDate.format(localeConfig.format);

    return { startISO, endISO, startLabel, endLabel };
  }
  
  function setDates(startISO: string, endISO: string): void {
    const picker = $input.data('daterangepicker');
    picker.setStartDate(moment(startISO));
    picker.setEndDate(moment(endISO));
    updateInputDisplay();
  }
  
  function destroy(): void {
    const picker = $input.data('daterangepicker');
    
    // Unbind namespaced events
    $input.off('.daterangepicker.myio');
    
    // Remove picker instance
    picker?.remove?.();
    
    // Clear data
    $input.removeData('daterangepicker');
    
    // Remove helper text
    helpText?.remove();
  }
  
  return { getDates, setDates, destroy };
}

// Export namespace for MyIOLibrary
export const DateRangePickerJQ = {
  attach
};
