/**
 * RFC-0125: FilterModal Controller
 * Business logic wrapper for the filter modal
 */

import type {
  FilterModalParams,
  FilterModalInstance,
  FilterModalThemeMode,
  FilterModalState,
  FilterableDevice,
} from './types.js';
import { FilterModalView } from './FilterModalView.js';

export class FilterModalController implements FilterModalInstance {
  private view: FilterModalView;

  constructor(params: FilterModalParams) {
    this.view = new FilterModalView(params);
  }

  public open(items: FilterableDevice[], state?: FilterModalState): void {
    this.view.open(items, state);
  }

  public close(): void {
    this.view.close();
  }

  public setThemeMode(mode: FilterModalThemeMode): void {
    this.view.setThemeMode(mode);
  }

  public destroy(): void {
    this.view.destroy();
  }
}
