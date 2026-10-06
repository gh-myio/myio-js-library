import { describe, it, expect } from 'vitest';
import { buildDashboardSummary } from '../../../../src/utils/devices/inventory/dashboard';
import {
  buildExportSummary,
  INVENTORY_EXPORT_COLUMNS,
  INVENTORY_PDF_COLUMN_KEYS,
  exportFileName,
  guardFormula,
  pickColumns,
  summarizeFilters,
  toCSV,
  toExportMatrix,
} from '../../../../src/utils/devices/inventory/exportRows';
import {
  NO_CUSTOMER_KEY,
  buildInventoryRows,
  createEmptyFilters,
  getVisibleRows,
} from '../../../../src/utils/devices/inventory/filters';
import { formatDeviceLabel } from '../../../../src/utils/devices/inventory/formatLabel';
import * as lib from '../../../../src/index';
import { NOW, makeDevice } from './fixtures';

const rows = buildInventoryRows(
  [
    makeDevice({ id: 'a', label: 'Chiller 1', name: 'N-A', customerId: 'cust-1', ingestionId: 'ing-a', gcdrDeviceId: 'g-a' }),
    makeDevice({ id: 'b', label: '=HYPERLINK("x")', name: '+55;21', ingestionId: 'ing-b', gcdrDeviceId: null }),
    makeDevice({ id: 'c', label: 'Loja "Bistrô"', name: 'N-C', ownerName: 'Rio Poty', customerId: 'cust-2', ingestionId: 'ing-c', gcdrDeviceId: 'g-c' }),
  ],
  { now: NOW }
);

describe('RFC-0237 export matrix', () => {
  it('has the same devices, in the same order, as getVisibleRows (collapsed/unrendered included)', () => {
    const visible = getVisibleRows(rows, createEmptyFilters(), 'gravity', 'customer');
    const matrix = toExportMatrix(visible);
    const idCol = INVENTORY_EXPORT_COLUMNS.findIndex((c) => c.key === 'deviceId');
    expect(matrix.rows.map((r) => r[idCol])).toEqual(visible.map((r) => r.device.id));
  });

  it('includes deviceId and customerId, and readable failed rules', () => {
    const header = toExportMatrix(rows).header;
    expect(header).toEqual(expect.arrayContaining(['deviceId', 'customerId', 'Regras com falha']));
    const b = toExportMatrix(rows.filter((r) => r.device.id === 'b'));
    const reasonsCol = INVENTORY_EXPORT_COLUMNS.findIndex((c) => c.key === 'reasons');
    expect(b.rows[0][reasonsCol]).toBe('Sem gcdrDeviceId');
  });

  it('PDF columns are a subset with the same rows', () => {
    const pdf = toExportMatrix(rows, pickColumns(INVENTORY_PDF_COLUMN_KEYS));
    expect(pdf.header.length).toBe(INVENTORY_PDF_COLUMN_KEYS.length);
    expect(pdf.rows.length).toBe(rows.length);
    expect(() => pickColumns(['nope'])).toThrow();
  });
});

describe('RFC-0237 CSV', () => {
  it('is tabular: BOM, ";" separator, CRLF, header first, no metadata rows', () => {
    const csv = toCSV(toExportMatrix(rows));
    expect(csv.startsWith('﻿Cadastro;Atividade;')).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines.length).toBe(rows.length + 1);
  });

  it('guards formula injection and quotes separators and quotes', () => {
    expect(guardFormula('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(guardFormula('-1')).toBe("'-1");
    expect(guardFormula('@x')).toBe("'@x");
    expect(guardFormula('Chiller')).toBe('Chiller');
    const csv = toCSV(toExportMatrix(rows));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"'+55;21"`);
    expect(csv).toContain('"Loja ""Bistrô"""');
  });
});

describe('RFC-0237 export metadata', () => {
  it('summarizes active filters in pt-BR', () => {
    const f = createEmptyFilters();
    f.customers.add(NO_CUSTOMER_KEY);
    f.cadastro.add('critical');
    f.rules.add('C3');
    f.text = ' bistro ';
    expect(summarizeFilters(f)).toEqual([
      ['Cliente', 'Sem cliente'],
      ['Cadastro', 'Crítico'],
      ['Regra', 'Sem ingestionId'],
      ['Ciclo de vida', 'Ativo'],
      ['Busca', 'bistro'],
    ]);
  });

  it('file name carries the single filtered customer or "todos"', () => {
    const now = new Date(2026, 9, 6, 9, 5);
    const f = createEmptyFilters();
    expect(exportFileName(f, 'xlsx', now)).toBe('inventario_todos_2026-10-06_0905.xlsx');
    f.customers.add('Shopping da Ilha');
    expect(exportFileName(f, 'csv', now)).toBe('inventario_shopping-da-ilha_2026-10-06_0905.csv');
  });
});

describe('RFC-0237 formatDeviceLabel', () => {
  it('label first, name in parentheses; name alone when label is blank or equal', () => {
    expect(formatDeviceLabel({ label: 'CM AR 4', name: '3F SCSDIACCCasaAr4' })).toEqual({ primary: 'CM AR 4', secondary: '3F SCSDIACCCasaAr4' });
    expect(formatDeviceLabel({ label: '', name: 'X' })).toEqual({ primary: 'X', secondary: null });
    expect(formatDeviceLabel({ label: null, name: 'X' })).toEqual({ primary: 'X', secondary: null });
    expect(formatDeviceLabel({ label: 'X', name: 'X' })).toEqual({ primary: 'X', secondary: null });
  });
});

describe('RFC-0237 library export', () => {
  it('is reachable as MyIOLibrary.inventory without clashing with root names', () => {
    expect(typeof lib.inventory.evaluateDevice).toBe('function');
    expect(typeof lib.inventory.getVisibleRows).toBe('function');
    expect(typeof lib.inventory.toCSV).toBe('function');
    expect(lib.inventory.toCSV).not.toBe((lib as Record<string, unknown>).toCSV);
  });
});

describe('RFC-0237 buildExportSummary (XLSX "Filtros" sheet / PDF header)', () => {
  it('lists generation info, "Nenhum" when no filter is active, and the indicator counts', () => {
    const f = createEmptyFilters();
    f.lifecycle.clear();
    const summary = buildExportSummary(f, buildDashboardSummary(rows), { generatedAt: NOW, generatedBy: 'qa@myio', exported: 3 });
    const map = Object.fromEntries(summary);
    expect(map['Gerado por']).toBe('qa@myio');
    expect(map['Dispositivos exportados']).toBe('3');
    expect(map['Filtros']).toBe('Nenhum (todos os dispositivos)');
    expect(map['Cadastro · Pendente']).toBe('1'); // b has no gcdrDeviceId
    expect(map['Cadastro · Íntegro']).toBe('2');
    expect(map['Fora dos indicadores (estoque / arquivados)']).toBe('0 / 0');
  });

  it('shows the active filters instead of "Nenhum"', () => {
    const f = createEmptyFilters();
    f.customers.add('Rio Poty');
    const map = Object.fromEntries(buildExportSummary(f, buildDashboardSummary(rows), { generatedAt: NOW, exported: 1 }));
    expect(map['Cliente']).toBe('Rio Poty');
    expect(map['Filtros']).toBeUndefined();
    expect(map['Gerado por']).toBe('');
  });
});
