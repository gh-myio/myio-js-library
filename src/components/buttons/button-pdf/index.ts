// components/buttons/button-pdf — botão de export PDF (borda/texto vermelhos MAN4)
import { createExportButton } from '../createExportButton';
import { ExportButtonInstance, ExportButtonParams } from '../types';

export function createPdfButton(
  container: HTMLElement,
  params: ExportButtonParams = {}
): ExportButtonInstance {
  return createExportButton('pdf', container, params);
}
