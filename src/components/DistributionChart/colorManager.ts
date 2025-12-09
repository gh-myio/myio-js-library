/**
 * RFC-0102: Centralized Color Management
 * Ensures consistent shopping colors across all widgets and domains
 */

import type { GroupColors, ShoppingColors, DistributionThemeColors, ThemeMode } from './types';

/**
 * Default color palette for shoppings
 * Used when orchestrator colors are not available
 * These colors cycle for more than 10 shoppings
 */
export const DEFAULT_SHOPPING_COLORS: string[] = [
  '#3b82f6',  // Blue
  '#8b5cf6',  // Purple
  '#f59e0b',  // Amber
  '#ef4444',  // Red
  '#10b981',  // Emerald
  '#06b6d4',  // Cyan
  '#ec4899',  // Pink
  '#14b8a6',  // Teal
  '#f97316',  // Orange
  '#a855f7',  // Violet
];

/**
 * Default colors for ENERGY equipment groups
 */
export const DEFAULT_ENERGY_GROUP_COLORS: GroupColors = {
  'Elevadores': '#3b82f6',
  'Escadas Rolantes': '#8b5cf6',
  'Climatização': '#f59e0b',
  'Climatizacao': '#f59e0b', // Without accent
  'Outros Equipamentos': '#ef4444',
  'Lojas': '#10b981',
};

/**
 * Default colors for WATER groups
 */
export const DEFAULT_WATER_GROUP_COLORS: GroupColors = {
  'Lojas': '#10b981',
  'Área Comum': '#0288d1',
  'Area Comum': '#0288d1', // Without accent
};

/**
 * Default colors for GAS groups
 */
export const DEFAULT_GAS_GROUP_COLORS: GroupColors = {
  'Cozinha': '#f59e0b',
  'Aquecimento': '#ef4444',
  'Outros': '#94a3b8',
};

/**
 * Get default group colors based on domain
 */
export function getDefaultGroupColors(domain: string): GroupColors {
  switch (domain.toLowerCase()) {
    case 'energy':
      return DEFAULT_ENERGY_GROUP_COLORS;
    case 'water':
      return DEFAULT_WATER_GROUP_COLORS;
    case 'gas':
      return DEFAULT_GAS_GROUP_COLORS;
    default:
      return DEFAULT_ENERGY_GROUP_COLORS;
  }
}

/**
 * Creates a color assignment map for shoppings
 * Should be called once by the orchestrator during initialization
 *
 * @param shoppingIds - Array of shopping IDs
 * @returns Map of shopping ID to color
 */
export function assignShoppingColors(shoppingIds: string[]): ShoppingColors {
  const colors: ShoppingColors = {};

  shoppingIds.forEach((id, index) => {
    colors[id] = DEFAULT_SHOPPING_COLORS[index % DEFAULT_SHOPPING_COLORS.length];
  });

  return colors;
}

/**
 * Gets the color for a specific shopping
 * Falls back to cycling through default colors if not found
 *
 * @param shoppingId - The shopping ID or name
 * @param shoppingColors - Color map from orchestrator (optional)
 * @param fallbackIndex - Index to use for fallback color cycling
 * @returns Color hex string
 */
export function getShoppingColor(
  shoppingId: string,
  shoppingColors: ShoppingColors | null,
  fallbackIndex: number = 0
): string {
  // Try exact match first
  if (shoppingColors && shoppingColors[shoppingId]) {
    return shoppingColors[shoppingId];
  }

  // Try matching by shopping name if colors is a name-based map
  if (shoppingColors) {
    const normalizedId = shoppingId.toLowerCase();
    for (const [key, color] of Object.entries(shoppingColors)) {
      if (key.toLowerCase() === normalizedId || key.toLowerCase().includes(normalizedId)) {
        return color;
      }
    }
  }

  // Fallback to default palette
  return DEFAULT_SHOPPING_COLORS[Math.abs(fallbackIndex) % DEFAULT_SHOPPING_COLORS.length];
}

/**
 * Gets the color for a group (equipment type, area type, etc.)
 *
 * @param groupName - The group name
 * @param groupColors - Custom group colors (optional)
 * @param domain - Domain for default colors
 * @param fallbackIndex - Index for fallback color
 * @returns Color hex string
 */
export function getGroupColor(
  groupName: string,
  groupColors: GroupColors | null,
  domain: string = 'energy',
  fallbackIndex: number = 0
): string {
  // Try custom colors first
  if (groupColors && groupColors[groupName]) {
    return groupColors[groupName];
  }

  // Try default domain colors
  const defaultColors = getDefaultGroupColors(domain);
  if (defaultColors[groupName]) {
    return defaultColors[groupName];
  }

  // Fallback to shopping palette
  return DEFAULT_SHOPPING_COLORS[Math.abs(fallbackIndex) % DEFAULT_SHOPPING_COLORS.length];
}

/**
 * Get theme colors for chart rendering
 *
 * @param theme - Light or dark theme
 * @returns Theme color configuration
 */
export function getThemeColors(theme: ThemeMode): DistributionThemeColors {
  if (theme === 'dark') {
    return {
      text: '#f3f4f6',
      secondaryText: '#9ca3af',
      background: '#111827',
      cardBackground: '#1f2937',
      border: '#374151',
      grid: '#374151',
    };
  }

  return {
    text: '#1f2937',
    secondaryText: '#6b7280',
    background: '#f5f5f5',
    cardBackground: '#ffffff',
    border: '#e5e7eb',
    grid: '#e5e7eb',
  };
}

/**
 * Generate a deterministic color for a string (useful for unknown categories)
 * Uses a simple hash to ensure same string always gets same color
 *
 * @param str - String to hash
 * @returns Color hex string
 */
export function getHashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return DEFAULT_SHOPPING_COLORS[Math.abs(hash) % DEFAULT_SHOPPING_COLORS.length];
}
