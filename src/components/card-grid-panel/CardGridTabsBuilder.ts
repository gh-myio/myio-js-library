/**
 * CardGridTabsBuilder — Builder pattern for assembling CardGridPanel tabs.
 *
 * Tabs are often data-driven: a "Solenóide" tab only makes sense when there is
 * at least one solenoid device. Hand-writing a static array and then pruning it
 * is error prone. This builder lets you declare each tab once (with the rule
 * that decides whether it should appear) and produces a clean `TabItem[]` with
 * the empty conditional tabs already dropped and selection resolved.
 *
 * @example
 * ```ts
 * const tabs = CardGridTabsBuilder.create()
 *   .withItems(waterItems)
 *   .selected(activeTabId)
 *   .onSelect((tabId) => applyWaterTab(tabId))
 *   .addAllTab('Todos', 'all')                  // always present
 *   .addSourceTypeTab('tank', "Caixa d'Água")   // only if any item.source.type === 'tank'
 *   .addSourceTypeTab('hydrometer', 'Hidrômetro')
 *   .addSourceTypeTab('solenoid', 'Solenóide')  // dropped when there is no solenoid
 *   .build();
 * ```
 */

import type { TabItem } from './CardGridPanel';

export interface TabSpec<T = unknown> {
  /** Unique tab id (also the value matched against, for source-type tabs). */
  id: string;
  /** Display label. */
  label: string;
  /**
   * Predicate that decides whether an item belongs to this tab. When omitted
   * (or together with `alwaysShow`), the tab is not data-driven and the count
   * is the whole dataset.
   */
  match?: (item: T) => boolean;
  /** Keep the tab even when no item matches (e.g. the "Todos" tab). */
  alwaysShow?: boolean;
  /** Optional per-tab colors forwarded to the resulting TabItem. */
  colors?: TabItem['colors'];
}

export class CardGridTabsBuilder<T = unknown> {
  private specs: TabSpec<T>[] = [];
  private _items: T[] = [];
  private _selectHandler: ((tabId: string) => void) | null = null;
  private _selectedId: string | null = null;

  /** Fluent entry point. */
  static create<T = unknown>(): CardGridTabsBuilder<T> {
    return new CardGridTabsBuilder<T>();
  }

  /** Dataset the conditional tabs are evaluated against. */
  withItems(items: T[]): this {
    this._items = Array.isArray(items) ? items : [];
    return this;
  }

  /** Handler invoked with the tab id whenever a tab is clicked. */
  onSelect(handler: (tabId: string) => void): this {
    this._selectHandler = handler;
    return this;
  }

  /** Pre-select a tab by id (falls back to the first built tab if absent). */
  selected(tabId: string | null | undefined): this {
    this._selectedId = tabId || null;
    return this;
  }

  /** Always-present tab (not data-driven), e.g. "Todos". */
  addAllTab(label: string = 'Todos', id: string = 'all'): this {
    this.specs.push({ id, label, alwaysShow: true });
    return this;
  }

  /** Conditional tab; appears only when at least one item matches `spec.match`. */
  addTab(spec: TabSpec<T>): this {
    this.specs.push(spec);
    return this;
  }

  /**
   * Conditional tab matched by `item.source.type === id` — the common BAS case.
   * Dropped automatically when no item has that source type.
   */
  addSourceTypeTab(id: string, label: string, colors?: TabItem['colors']): this {
    return this.addTab({
      id,
      label,
      colors,
      match: (item: T) => ((item as { source?: { type?: string } } | null)?.source?.type || '') === id,
    });
  }

  /** Number of items belonging to a spec (no `match` → the whole dataset). */
  countFor(spec: TabSpec<T>): number {
    if (!spec.match) return this._items.length;
    let n = 0;
    for (const item of this._items) {
      try {
        if (spec.match(item)) n++;
      } catch {
        /* a faulty predicate must not break the whole build */
      }
    }
    return n;
  }

  /**
   * Build the final `TabItem[]`. Empty conditional tabs are dropped; selection
   * resolves to `selected(id)` when that tab survived, otherwise the first tab.
   */
  build(): TabItem[] {
    const tabs: TabItem[] = [];
    let firstId: string | null = null;

    for (const spec of this.specs) {
      const count = this.countFor(spec);
      if (!spec.alwaysShow && count === 0) continue; // drop empty conditional tab
      if (firstId === null) firstId = spec.id;

      const id = spec.id;
      const handler = this._selectHandler;
      tabs.push({
        id,
        label: spec.label,
        selected: false,
        colors: spec.colors,
        handleClick: () => {
          if (handler) handler(id);
        },
      });
    }

    const selectedId =
      this._selectedId && tabs.some((t) => t.id === this._selectedId)
        ? this._selectedId
        : firstId;
    for (const t of tabs) t.selected = t.id === selectedId;

    return tabs;
  }
}
