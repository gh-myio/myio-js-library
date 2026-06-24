/**
 * MYIO Ambiente Card Component - Version 6
 * TypeScript definitions
 */

export interface AmbienteDevice {
  /** Device ID */
  id: string;
  /** Device type: 'temperature' | 'energy' | 'remote' */
  type: 'temperature' | 'energy' | 'remote';
  /** Original device type (TERMOSTATO, 3F_MEDIDOR, etc.) */
  deviceType?: string;
  /** Device status */
  status?: 'online' | 'offline';
  /** Current value (temperature, consumption, or 0/1 for remote) */
  value?: number;
}

export interface AmbienteData {
  /** Ambiente ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional identifier */
  identifier?: string;
  /** Current temperature (°C) */
  temperature?: number;
  /** Current consumption (kW) */
  consumption?: number;
  /** Remote state (on/off) */
  isOn?: boolean;
  /** Whether ambiente has remote control */
  hasRemote?: boolean;
  /** Overall status */
  status?: 'online' | 'offline';
  /** Array of devices in this ambiente */
  devices?: AmbienteDevice[];
}

export interface CustomStyle {
  /** CSS font-size */
  fontSize?: string;
  /** CSS background-color */
  backgroundColor?: string;
  /** CSS color */
  fontColor?: string;
  /** CSS width */
  width?: string;
  /** CSS height */
  height?: string;
}

export interface CardAmbienteApi {
  /** Get the container element */
  getElement(): HTMLElement;
  /** Get ambiente ID */
  getId(): string;
  /** Get ambiente data */
  getData(): AmbienteData;
  /** Set selection state */
  setSelected(selected: boolean): void;
  /** Update ambiente data */
  updateData(newData: Partial<AmbienteData>): void;
  /** Destroy and remove the card */
  destroy(): void;
}

export interface RenderCardAmbienteOptions {
  /** The ambiente data object */
  ambienteData: AmbienteData;
  /** Dashboard button callback */
  handleActionDashboard?: (data: AmbienteData) => void;
  /** Report button callback */
  handleActionReport?: (data: AmbienteData) => void;
  /** Settings button callback */
  handleActionSettings?: (data: AmbienteData) => void;
  /** Card click callback */
  handleClickCard?: (data: AmbienteData) => void;
  /** Selection change callback */
  handleSelect?: (id: string, selected: boolean) => void;
  /** Remote toggle callback */
  handleToggleRemote?: (isOn: boolean, data: AmbienteData) => void;
  /** Enable selection checkbox (default: true) */
  enableSelection?: boolean;
  /** Enable drag and drop (default: true) */
  enableDragDrop?: boolean;
  /** Per-card style overrides */
  customStyle?: CustomStyle;
}

/**
 * Renders an Ambiente card component with aggregated device data.
 *
 * @param options - Card options
 * @returns Tuple of [container element, card API]
 *
 * @example
 * const [cardEl, api] = renderCardAmbienteV6({
 *   ambienteData: {
 *     id: 'amb-001',
 *     label: 'Sala de Reunião',
 *     temperature: 22.5,
 *     consumption: 1.8,
 *     isOn: true,
 *     hasRemote: true,
 *     status: 'online',
 *   },
 *   handleClickCard: (data) => console.log('Clicked:', data),
 * });
 */
export function renderCardAmbienteV6(
  options: RenderCardAmbienteOptions
): [HTMLElement, CardAmbienteApi];

export default renderCardAmbienteV6;
