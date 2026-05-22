/**
 * resolvePercentDecimals — number of decimal places for percentage labels.
 *
 * Priority: explicit argument > `window.MyIOUtils.percentDecimals` > default 2.
 *
 * The window global is read at call time, so the value can be changed at
 * runtime (e.g. `window.MyIOUtils.percentDecimals = 3`) without rebuilding
 * the library. Result is clamped to a sane 0–6 range.
 *
 * @example
 * resolvePercentDecimals();        // 2 (default)
 * resolvePercentDecimals(3);       // 3 (explicit wins)
 * // window.MyIOUtils.percentDecimals = 1 → resolvePercentDecimals() === 1
 */
export function resolvePercentDecimals(explicit?: number): number {
  const fromArg = Number(explicit);
  if (Number.isInteger(fromArg) && fromArg >= 0 && fromArg <= 6) return fromArg;

  const utils =
    typeof window !== 'undefined' ? (window as { MyIOUtils?: { percentDecimals?: unknown } }).MyIOUtils : undefined;
  const fromGlobal = utils ? Number(utils.percentDecimals) : NaN;
  if (Number.isInteger(fromGlobal) && fromGlobal >= 0 && fromGlobal <= 6) return fromGlobal;

  return 2;
}

export default resolvePercentDecimals;
