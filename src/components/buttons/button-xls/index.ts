// components/buttons/button-xls — botão de export XLSX (borda/texto verdes MAN4)
import { createExportButton } from '../createExportButton';
import { ExportButtonInstance, ExportButtonParams } from '../types';

export function createXlsButton(
  container: HTMLElement,
  params: ExportButtonParams = {}
): ExportButtonInstance {
  return createExportButton('xls', container, params);
}
