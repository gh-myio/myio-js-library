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
