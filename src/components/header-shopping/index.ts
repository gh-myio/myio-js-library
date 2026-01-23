/**
 * RFC-0139: HeaderShopping Component
 * Shopping Dashboard header toolbar with date picker, contract status, and action buttons
 */

export { createHeaderShoppingComponent } from './createHeaderShoppingComponent';
export { HeaderShoppingView } from './HeaderShoppingView';
export { injectHeaderShoppingStyles, HEADER_SHOPPING_STYLES } from './styles';

export type {
  DomainType as HeaderShoppingDomainType,
  ThemeMode as HeaderShoppingThemeMode,
  HeaderShoppingPeriod,
  ContractState as HeaderShoppingContractState,
  HeaderShoppingConfigTemplate,
  HeaderShoppingParams,
  HeaderShoppingInstance,
  HeaderShoppingEventType,
  HeaderShoppingEventHandler,
} from './types';

export {
  HEADER_SHOPPING_CSS_PREFIX,
  DEFAULT_HEADER_SHOPPING_CONFIG,
} from './types';
