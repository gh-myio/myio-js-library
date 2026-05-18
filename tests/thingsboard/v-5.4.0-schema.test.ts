/**
 * RFC-0201 Phase-1 (Pod C) — Schema regression tests
 *
 * Validates that `settingsSchema.json` for v-5.4.0 carries the Phase-1 keys
 * required by the work list:
 *   - row #6  : `defaultThemeMode` default flipped to `"light"`
 *               (AC-Fix-LightDefault-1).
 *   - row #14 : `showOfflineAlarms` boolean key present (default `false`).
 *
 * NOTE: This test parses the JSON directly. It does NOT exercise runtime
 * controller behavior — runtime defaulting is verified separately (the
 * controller already reads `settings.defaultThemeMode || 'light'`).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_PATH = resolve(
  __dirname,
  '..',
  '..',
  'src',
  'thingsboard',
  'main-dashboard-shopping',
  'v-5.4.0',
  'settingsSchema.json'
);

interface SettingsSchemaFile {
  schema: {
    type: string;
    properties: Record<string, any>;
  };
  form: any[];
}

function loadSchema(): SettingsSchemaFile {
  const raw = readFileSync(SCHEMA_PATH, 'utf-8');
  return JSON.parse(raw);
}

describe('v-5.4.0 settingsSchema.json — RFC-0201 Phase-1 keys', () => {
  it('parses as valid JSON with the expected top-level shape', () => {
    const schema = loadSchema();
    expect(schema).toBeDefined();
    expect(schema.schema).toBeDefined();
    expect(schema.schema.properties).toBeDefined();
    expect(schema.form).toBeDefined();
    expect(Array.isArray(schema.form)).toBe(true);
  });

  describe('defaultThemeMode (RFC-0201 work-list row #6 — AC-Fix-LightDefault-1)', () => {
    it('exists as a string property', () => {
      const { properties } = loadSchema().schema;
      expect(properties.defaultThemeMode).toBeDefined();
      expect(properties.defaultThemeMode.type).toBe('string');
    });

    it('defaults to "light" (matches v-5.2.0)', () => {
      const { properties } = loadSchema().schema;
      expect(properties.defaultThemeMode.default).toBe('light');
    });

    it('enumerates exactly ["light", "dark"]', () => {
      const { properties } = loadSchema().schema;
      const enumVals = properties.defaultThemeMode.enum;
      expect(Array.isArray(enumVals)).toBe(true);
      expect(enumVals).toHaveLength(2);
      expect(new Set(enumVals)).toEqual(new Set(['light', 'dark']));
    });

    it('carries a human-facing title and description', () => {
      const { properties } = loadSchema().schema;
      expect(typeof properties.defaultThemeMode.title).toBe('string');
      expect(properties.defaultThemeMode.title.length).toBeGreaterThan(0);
      expect(typeof properties.defaultThemeMode.description).toBe('string');
      expect(properties.defaultThemeMode.description.length).toBeGreaterThan(0);
    });
  });

  describe('showOfflineAlarms (RFC-0201 work-list row #14)', () => {
    it('exists as a boolean property', () => {
      const { properties } = loadSchema().schema;
      expect(properties.showOfflineAlarms).toBeDefined();
      expect(properties.showOfflineAlarms.type).toBe('boolean');
    });

    it('defaults to false (avoids alarm flooding when a central is offline)', () => {
      const { properties } = loadSchema().schema;
      expect(properties.showOfflineAlarms.default).toBe(false);
    });

    it('carries a human-facing title and description', () => {
      const { properties } = loadSchema().schema;
      expect(typeof properties.showOfflineAlarms.title).toBe('string');
      expect(properties.showOfflineAlarms.title.length).toBeGreaterThan(0);
      expect(typeof properties.showOfflineAlarms.description).toBe('string');
      expect(properties.showOfflineAlarms.description.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 1 boundary — Phase 2/3 keys must NOT be present', () => {
    // Pod C only adds Phase-1 keys. Phase 2/3 keys land in their own pods.
    const phase2or3Keys = [
      'tickets_enabled',
      'tickets_only_to_myio',
      'freshdeskApiBaseUrl',
      'freshdeskApiKey',
      'freshworksWidgetId',
      'enableReportsMenu',
      'customerDefaultDashboardKey',
    ];

    it.each(phase2or3Keys)('does not declare %s yet', (key) => {
      const { properties } = loadSchema().schema;
      expect(properties[key]).toBeUndefined();
    });
  });
});
