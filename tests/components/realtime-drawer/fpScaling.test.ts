/**
 * RFC-0201 Phase-2 pod J — FP÷255 scaling.
 *
 * Asserts the firmware-byte-to-fraction math used by the realtime drawer
 * (`RealTimeTelemetryModal.ts` lines 2296 / 2349 / 2422-2423) is correct
 * for the canonical FP keys (`fp_a`, `fp_b`, `fp_c`, `powerFactor`).
 */

import { describe, it, expect } from 'vitest';
import {
  scaleFp,
  applyFpScalingIfNeeded,
  isFpKey,
  FP_TELEMETRY_KEYS,
} from '../../../src/components/realtime-drawer/helpers';

describe('realtime-drawer / FP scaling', () => {
  it('255 -> 1.0 (full power factor)', () => {
    expect(scaleFp(255)).toBe(1);
  });

  it('128 -> ~0.502 (mid)', () => {
    expect(scaleFp(128)).toBeCloseTo(0.5019, 3);
  });

  it('0 -> 0 (no power factor)', () => {
    expect(scaleFp(0)).toBe(0);
  });

  it('non-numeric inputs collapse to 0 (never NaN)', () => {
    expect(scaleFp('not a number')).toBe(0);
    expect(scaleFp(null)).toBe(0);
    expect(scaleFp(undefined)).toBe(0);
    expect(Number.isNaN(scaleFp('xx'))).toBe(false);
  });

  it('isFpKey() returns true exactly for the four canonical keys', () => {
    for (const k of FP_TELEMETRY_KEYS) {
      expect(isFpKey(k)).toBe(true);
    }
    expect(isFpKey('voltage_a')).toBe(false);
    expect(isFpKey('total_current')).toBe(false);
    expect(isFpKey('consumption')).toBe(false);
    expect(isFpKey('FP_A')).toBe(false); // case sensitive — keys arrive lower-case
  });

  it('applyFpScalingIfNeeded() scales FP keys and passes through everything else', () => {
    expect(applyFpScalingIfNeeded('fp_a', 255)).toBe(1);
    expect(applyFpScalingIfNeeded('fp_b', 128)).toBeCloseTo(0.5019, 3);
    expect(applyFpScalingIfNeeded('powerFactor', 0)).toBe(0);

    // Non-FP keys are returned unchanged (other scaling like mA -> A is the
    // caller's responsibility — see RFC-0086 in the modal).
    expect(applyFpScalingIfNeeded('voltage_a', 220)).toBe(220);
    expect(applyFpScalingIfNeeded('consumption', 1234)).toBe(1234);
  });

  it('every FP key in FP_TELEMETRY_KEYS divides by 255 (not 256, not 100)', () => {
    for (const k of FP_TELEMETRY_KEYS) {
      // Use a value that would produce a different result for /256 or /100
      const raw = 200;
      const scaled = applyFpScalingIfNeeded(k, raw);
      expect(scaled).toBeCloseTo(raw / 255, 6);
      expect(scaled).not.toBeCloseTo(raw / 256, 6);
      expect(scaled).not.toBeCloseTo(raw / 100, 6);
    }
  });
});
