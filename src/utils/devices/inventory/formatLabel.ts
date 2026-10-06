/**
 * RFC-0237 — row title: `label` first, `(name)` second; the name alone when the
 * label is blank or equal to it (no empty or repeated parentheses).
 */

export interface DeviceLabelParts {
  primary: string;
  /** `name` to show muted between parentheses, or null when it would repeat the primary. */
  secondary: string | null;
}

export function formatDeviceLabel(device: { label?: string | null; name?: string | null }): DeviceLabelParts {
  const name = String(device.name ?? '').trim();
  const label = String(device.label ?? '').trim();
  if (!label || label === name) return { primary: name, secondary: null };
  return { primary: label, secondary: name || null };
}
