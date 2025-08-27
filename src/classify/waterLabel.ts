/**
 * Classifies water device labels into predefined categories
 * @param label - The device label to classify
 * @returns Classification category for water devices
 */
export function classifyWaterLabel(label: string): "Caixas D'Água" | "Lojas" | "Área Comum" {
  if (!label) {
    console.warn('classifyWaterLabel: empty label, defaulting to "Lojas"');
    return "Lojas";
  }
  
  const normalizedLabel = label.toLowerCase().trim();
  
  // Check for water tank indicators
  if (/rel[óo]gio|caixa|superior|inferior|nível_terraço/.test(normalizedLabel)) {
    return "Caixas D'Água";
  }
  
  // Check for administration/common area indicators
  if (/administra|bomba|chiller|adm/.test(normalizedLabel)) {
    return "Área Comum";
  }
  
  // Default to stores/shops
  return "Lojas";
}

/**
 * Classifies multiple labels and returns a summary
 * @param labels - Array of labels to classify
 * @returns Object with counts for each category
 */
export function classifyWaterLabels(labels: string[]): {
  "Caixas D'Água": number;
  "Lojas": number;
  "Área Comum": number;
  total: number;
} {
  const counts = {
    "Caixas D'Água": 0,
    "Lojas": 0,
    "Área Comum": 0,
    total: 0
  };
  
  labels.forEach(label => {
    const category = classifyWaterLabel(label);
    counts[category]++;
    counts.total++;
  });
  
  return counts;
}

/**
 * Gets all possible water classification categories
 * @returns Array of all classification categories
 */
export function getWaterCategories(): Array<"Caixas D'Água" | "Lojas" | "Área Comum"> {
  return ["Caixas D'Água", "Lojas", "Área Comum"];
}

/**
 * Checks if a label belongs to a specific category
 * @param label - The label to check
 * @param category - The category to check against
 * @returns True if the label belongs to the category
 */
export function isWaterCategory(
  label: string, 
  category: "Caixas D'Água" | "Lojas" | "Área Comum"
): boolean {
  return classifyWaterLabel(label) === category;
}
