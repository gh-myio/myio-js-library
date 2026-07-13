/**
 * MYIO Enhanced Card Component - Version 6
 * Type declarations
 */

export interface CustomStyle {
  fontSize?: string;
  backgroundColor?: string;
  fontColor?: string;
  width?: string;
  height?: string;
  padding?: string;
  borderRadius?: string;
  boxShadow?: string;
  margin?: string;
  /**
   * Scale multiplier for all card dimensions (default: 1.0)
   * Example: 0.9 = 90% scale (everything 10% smaller)
   * Example: 1.1 = 110% scale (everything 10% larger)
   */
  zoomMultiplier?: number;
  /**
   * CSS height for the ⋮ piano-key actions column.
   * Default stretches with the card (height: 100%, max-height: 72%);
   * 'auto' yields a compact pill hugging its buttons.
   */
  actionsHeight?: string;
  /** CSS height for each action button inside the column (e.g. '32px'). */
  actionButtonHeight?: string;
}

export interface RenderCardV6Options {
  entityObject: Record<string, unknown>;
  handleActionDashboard?: ((entity: Record<string, unknown>) => void) | undefined;
  handleActionReport?: ((entity: Record<string, unknown>) => void) | undefined;
  handleActionSettings?: ((entity: Record<string, unknown>, opts?: Record<string, unknown>) => void) | undefined;
  handleSelect?: ((entity: Record<string, unknown>) => void) | undefined;
  handInfo?: ((entity: Record<string, unknown>) => void) | undefined;
  handleClickCard?: ((entity: Record<string, unknown>) => void) | undefined;
  useNewComponents?: boolean;
  enableSelection?: boolean;
  enableDragDrop?: boolean;
  showEnergyRangeTooltip?: boolean;
  showPercentageTooltip?: boolean;
  showTempComparisonTooltip?: boolean;
  showTempRangeTooltip?: boolean;
  customStyle?: CustomStyle;
  /**
   * When true, replaces the 3 piano-key action buttons with a single button
   * that opens a selection modal ("step"). The user then picks one of:
   * Gráfico (handleActionDashboard), Relatório (handleActionReport), or
   * Configurações (handleActionSettings). Only options whose handler is
   * provided are shown. Default: false (3 separate buttons).
   */
  enableActionSelector?: boolean;
  /**
   * Requires enableActionSelector. When true, the single ⋮ button is not
   * rendered and the selection modal opens on the card body click instead
   * (handleClickCard is then ignored). Default: false.
   */
  actionSelectorOnCardClick?: boolean;
}

export interface CardResult {
  get: (index: number) => HTMLElement | undefined;
  0: HTMLElement;
  length: number;
  find: (selector: string) => unknown;
  on: (event: string, handler: EventListener) => unknown;
  addClass: (className: string) => unknown;
  removeClass: (className: string) => unknown;
  destroy: () => void;
}

export function renderCardComponentV6(options: RenderCardV6Options): CardResult;
export function renderCardComponent(options: RenderCardV6Options): CardResult;
