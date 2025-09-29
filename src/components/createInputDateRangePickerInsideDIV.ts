/**
 * createInputDateRangePickerInsideDIV - Premium Date Range Input Component
 * 
 * Creates a beautifully styled date range input inside a target DIV container,
 * combining the functionality of createDateRangePicker with premium MyIO styling
 * from demos/energy.html.
 * 
 * @author MyIO UI Platform
 * @version 1.0.0
 * @since 2025-09-26
 */

import { createDateRangePicker, CreateDateRangePickerOptions, DateRangeControl, DateRangeResult } from './createDateRangePicker';

// Premium MyIO styling extracted and adapted from demos/energy.html
const PREMIUM_STYLES = `
  .myio-daterange-wrapper {
    font-family: 'Roboto', Arial, sans-serif;
    background: #f9f9f9;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    transition: all 0.2s ease;
  }
  
  .myio-daterange-wrapper:hover {
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  }
  
  .myio-daterange-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .myio-daterange-input {
    width: 100%;
    max-width: 300px;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    font-size: 14px;
    color: #333;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    line-height: 1.4;
  }
  
  .myio-daterange-input:hover {
    border-color: #4A148C;
    box-shadow: 0 0 0 2px rgba(74, 20, 140, 0.1);
  }
  
  .myio-daterange-input:focus {
    outline: none;
    border-color: #4A148C;
    box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.2);
  }
  
  .myio-daterange-input::placeholder {
    color: #999;
    opacity: 1;
  }
  
  .myio-daterange-helper {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
    line-height: 1.3;
    transition: color 0.2s ease;
  }
  
  .myio-daterange-helper.success {
    color: #28a745;
    font-weight: 500;
  }
  
  .myio-daterange-helper.error {
    color: #dc3545;
    font-weight: 500;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .myio-daterange-wrapper {
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .myio-daterange-input {
      max-width: 100%;
      font-size: 16px; /* Prevents zoom on iOS */
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .myio-daterange-wrapper {
      border: 2px solid #000;
    }
    
    .myio-daterange-input {
      border: 2px solid #000;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .myio-daterange-wrapper,
    .myio-daterange-input,
    .myio-daterange-helper {
      transition: none;
    }
  }
`;

/**
 * Configuration parameters for createInputDateRangePickerInsideDIV
 */
export interface CreateInputDateRangePickerInsideDIVParams {
  /** The DIV id where the input will be created (required) */
  containerId: string;
  
  /** The id to set on the created input (required) */
  inputId: string;
  
  /** Optional label text to render above the input */
  label?: string;
  
  /** Placeholder text for the input (default: "Clique para selecionar período") */
  placeholder?: string;
  
  /** Pass-through options for createDateRangePicker */
  pickerOptions?: CreateDateRangePickerOptions;
  
  /** Custom CSS classes for styling customization */
  classNames?: {
    wrapper?: string;   // Container wrapper class
    label?: string;     // Label element class  
    input?: string;     // Input element class
    helper?: string;    // Helper text class
  };
  
  /** Inject premium MyIO styling (default: true) */
  injectStyles?: boolean;
  
  /** Show helper text with format information (default: true) */
  showHelper?: boolean;
}

/**
 * Controller interface for the created date range input
 */
export interface DateRangeInputController {
  /** The created input element */
  input: HTMLInputElement;
  
  /** The container element */
  container: HTMLElement;
  
  /** The wrapper element created by this component */
  wrapper: HTMLElement;
  
  /** The date range picker instance */
  picker: DateRangeControl;
  
  /** Get current display value from input */
  getDisplayValue(): string;
  
  /** Get current date range data */
  getDates(): DateRangeResult;
  
  /** Set date range programmatically */
  setDates(startISO: string, endISO: string): void;
  
  /** Update helper text */
  setHelperText(text: string, type?: 'default' | 'success' | 'error'): void;
  
  /** Clean up and remove all created elements */
  destroy(): void;
}

/**
 * Injects premium MyIO styles into the document head
 * Uses a singleton pattern to avoid duplicate style injection
 */
function injectPremiumStyles(): void {
  const styleId = 'myio-daterange-premium-styles';
  
  if (document.getElementById(styleId)) {
    return; // Already injected
  }
  
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = PREMIUM_STYLES;
  document.head.appendChild(styleEl);
  
  console.log('[MyIO] Premium date range styles injected');
}

/**
 * Validates and sanitizes HTML ID attributes
 */
function validateId(id: string, context: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`[createInputDateRangePickerInsideDIV] ${context} must be a non-empty string`);
  }
  
  // Basic HTML ID validation
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
    throw new Error(`[createInputDateRangePickerInsideDIV] ${context} '${id}' is not a valid HTML ID`);
  }
}

/**
 * Creates a styled date range input inside a target DIV container
 * with premium MyIO styling and full createDateRangePicker functionality
 * 
 * @param params Configuration parameters
 * @returns Promise resolving to DateRangeInputController
 * 
 * @example
 * ```typescript
 * const controller = await createInputDateRangePickerInsideDIV({
 *   containerId: 'date-picker-container',
 *   inputId: 'energy-date-range',
 *   label: 'Período de Análise',
 *   pickerOptions: {
 *     presetStart: '2025-09-01',
 *     presetEnd: '2025-09-25',
 *     onApply: (result) => {
 *       console.log('Date range selected:', result);
 *     }
 *   }
 * });
 * ```
 */
export async function createInputDateRangePickerInsideDIV(
  params: CreateInputDateRangePickerInsideDIVParams
): Promise<DateRangeInputController> {
  const {
    containerId,
    inputId,
    label = "Período de Datas",
    placeholder = "Clique para selecionar período",
    pickerOptions = {},
    classNames = {},
    injectStyles = true,
    showHelper = true
  } = params;

  // 1. Validate required parameters
  validateId(containerId, 'containerId');
  validateId(inputId, 'inputId');

  // 2. Find and validate container
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`[createInputDateRangePickerInsideDIV] Container '#${containerId}' not found`);
  }

  // 3. Inject premium styles if requested
  if (injectStyles) {
    injectPremiumStyles();
  }

  // 4. Check for existing input with same ID
  let inputEl = document.getElementById(inputId) as HTMLInputElement | null;
  
  if (inputEl && inputEl.tagName.toLowerCase() !== 'input') {
    throw new Error(`[createInputDateRangePickerInsideDIV] Element '#${inputId}' exists but is not an input element`);
  }

  // 5. Create wrapper structure
  const wrapper = document.createElement('div');
  wrapper.className = classNames.wrapper || 'myio-daterange-wrapper';
  wrapper.setAttribute('data-myio-component', 'daterange-input');
  wrapper.setAttribute('data-version', '1.0.0');

  // 6. Create label if provided
  let labelEl: HTMLLabelElement | null = null;
  if (label) {
    labelEl = document.createElement('label');
    labelEl.className = classNames.label || 'myio-daterange-label';
    labelEl.textContent = label;
    labelEl.setAttribute('for', inputId);
    wrapper.appendChild(labelEl);
  }

  // 7. Create or configure input element
  if (!inputEl) {
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.id = inputId;
    inputEl.name = inputId;
  }
  
  // Configure input properties
  inputEl.className = classNames.input || 'myio-daterange-input';
  inputEl.readOnly = true;
  inputEl.placeholder = placeholder;
  inputEl.autocomplete = 'off';
  inputEl.setAttribute('aria-label', label || 'Date range selector');
  
  // Add accessibility attributes
  if (showHelper) {
    inputEl.setAttribute('aria-describedby', `${inputId}-helper`);
  }

  // 8. Create helper text element
  let helperEl: HTMLDivElement | null = null;
  if (showHelper) {
    helperEl = document.createElement('div');
    helperEl.id = `${inputId}-helper`;
    helperEl.className = classNames.helper || 'myio-daterange-helper';
    helperEl.setAttribute('aria-live', 'polite');
    helperEl.style.display = 'flex';
    helperEl.style.alignItems = 'center';
  }

  // 9. Assemble DOM structure
  wrapper.appendChild(inputEl);
  if (helperEl) {
    wrapper.appendChild(helperEl);
  }

  // 10. Clean up any existing wrapper and append new one
  const existingWrapper = container.querySelector('[data-myio-component="daterange-input"]');
  if (existingWrapper) {
    console.warn(`[createInputDateRangePickerInsideDIV] Replacing existing daterange input in container '#${containerId}'`);
    existingWrapper.remove();
  }
  container.appendChild(wrapper);

  // 11. Initialize date range picker with enhanced options
  const enhancedOptions: CreateDateRangePickerOptions = {
    maxRangeDays: 31,
    onApply: (result) => {
      // Update helper text with selected range info
      if (helperEl) {
        const startDate = new Date(result.startISO);
        const endDate = new Date(result.endISO);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        helperEl.textContent = `Período selecionado: ${days} dia${days !== 1 ? 's' : ''}`;
        helperEl.className = (classNames.helper || 'myio-daterange-helper') + ' success';
        
        // Reset to default style after 3 seconds
        setTimeout(() => {
          if (helperEl) {
            helperEl.className = classNames.helper || 'myio-daterange-helper';
          }
        }, 3000);
      }
      
      // Call user's onApply callback if provided
      if (pickerOptions.onApply) {
        pickerOptions.onApply(result);
      }
    },
    ...pickerOptions
  };

  let picker: DateRangeControl;
  try {
    picker = await createDateRangePicker(inputEl, enhancedOptions);
    console.log(`[createInputDateRangePickerInsideDIV] Successfully initialized for input '#${inputId}'`);
  } catch (error) {
    // Clean up on error
    wrapper.remove();
    throw new Error(`[createInputDateRangePickerInsideDIV] Failed to initialize date picker: ${error.message}`);
  }

  // 12. Create and return controller interface
  const controller: DateRangeInputController = {
    input: inputEl,
    container,
    wrapper,
    picker,
    
    getDisplayValue: () => inputEl.value,
    
    getDates: () => picker.getDates(),
    
    setDates: (startISO: string, endISO: string) => {
      try {
        picker.setDates(startISO, endISO);
      } catch (error) {
        console.error(`[createInputDateRangePickerInsideDIV] Error setting dates:`, error);
        throw error;
      }
    },
    
    setHelperText: (text: string, type: 'default' | 'success' | 'error' = 'default') => {
      if (helperEl) {
        helperEl.textContent = text;
        const baseClass = classNames.helper || 'myio-daterange-helper';
        helperEl.className = type === 'default' ? baseClass : `${baseClass} ${type}`;
      }
    },
    
    destroy: () => {
      try {
        // Destroy the date picker
        picker.destroy();
        console.log(`[createInputDateRangePickerInsideDIV] Date picker destroyed for input '#${inputId}'`);
      } catch (error) {
        console.warn(`[createInputDateRangePickerInsideDIV] Error destroying picker:`, error);
      }
      
      try {
        // Remove the wrapper (which contains all our created elements)
        wrapper.remove();
        console.log(`[createInputDateRangePickerInsideDIV] Wrapper removed for input '#${inputId}'`);
      } catch (error) {
        console.warn(`[createInputDateRangePickerInsideDIV] Error removing wrapper:`, error);
      }
    }
  };

  return controller;
}

// Export types for external use
export type { CreateDateRangePickerOptions, DateRangeResult, DateRangeControl };
