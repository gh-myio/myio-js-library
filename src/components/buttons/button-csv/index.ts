// components/buttons/button-csv — botão de export CSV (borda/texto azuis MAN4)
import { createExportButton } from '../createExportButton';
import { ExportButtonInstance, ExportButtonParams } from '../types';

export function createCsvButton(
  container: HTMLElement,
  params: ExportButtonParams = {}
): ExportButtonInstance {
  return createExportButton('csv', container, params);
}
