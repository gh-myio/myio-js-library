// index.ts
export * from './types';
export { openDashboardPopupEnergy } from './energy/openDashboardPopupEnergy';
export { openDashboardPopupReport } from './report-device/openDashboardPopupReport';
export { openDashboardPopupAllReport } from './report-all/openDashboardPopupAllReport';
export { openDashboardPopup } from './settings/openDashboardPopup';
export { openDashboardPopupWaterTank } from './water-tank/openDashboardPopupWaterTank';

// RFC-0103: Power Limits Setup Modal
export { openPowerLimitsSetupModal } from './power-limits/openPowerLimitsSetupModal';

// RFC-0112: Welcome Modal Head Office
export { openWelcomeModal } from './welcome/openWelcomeModal';
export type {
  WelcomeModalParams,
  WelcomeModalInstance,
  WelcomePalette,
  WelcomeConfigTemplate,
  WelcomeThemeConfig,
  WelcomeThemeMode,
  ShoppingCard,
  ShoppingCardDeviceCounts,
  UserInfo,
} from './welcome/types';
export {
  DEFAULT_PALETTE,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_SHOPPING_CARDS,
} from './welcome/types';

// RFC-0113: Header Component
export { createHeaderComponent } from './header/createHeaderComponent';
export { HeaderView } from './header/HeaderView';
export { HeaderFilterModal } from './header/HeaderFilterModal';
export type {
  HeaderComponentParams,
  HeaderComponentInstance,
  HeaderConfigTemplate,
  HeaderCardColors,
  CardColorConfig,
  CardKPIs,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
  Shopping,
  FilterSelection,
  FilterPreset,
  CardType,
  HeaderEventType,
} from './header/types';
export {
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CARD_COLORS as HEADER_DEFAULT_CARD_COLORS,
  HEADER_DEFAULT_LOGO_URL,
} from './header/types';

// RFC-0115: Footer Component
export { createFooterComponent } from '../footer/createFooterComponent';
export type {
  FooterComponentParams,
  FooterComponentInstance,
  FooterColors,
  FooterThemeMode,
  SelectedEntity as FooterSelectedEntity,
  UnitType as FooterUnitType,
  DateRange as FooterDateRange,
} from '../footer/types';
export { DEFAULT_FOOTER_COLORS } from '../footer/types';
