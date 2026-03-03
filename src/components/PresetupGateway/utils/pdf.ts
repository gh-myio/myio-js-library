import { jsPDF } from 'jspdf';
import QRious from 'qrious';
import type { GatewayInfo, PresetupDevice } from '../types';
import {
  buildDeviceQrUrl,
  tsStampBR,
  tsStamp,
  sanitizeForFile,
  getEffectiveAddrLow,
  getEffectiveAddrHigh,
  generateDeviceNameWithPrefix,
} from './device';

export type PdfLayout = 'grid_4x7' | 'grid_2x4' | 'per_page';

// ─── QR helper ────────────────────────────────────────────────────────────────

async function makeQrDataUrl(value: string): Promise<string> {
  return new Promise(resolve => {
    try {
      const qr = new QRious({ value, size: 520, level: 'M' });
      resolve(qr.toDataURL());
    } catch {
      // 1×1 transparent fallback
      resolve(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      );
    }
  });
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function sanitizePdf(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\u0000-\u007F]/g, '');
}

function drawHeader(
  doc: jsPDF,
  pageW: number,
  headerH: number,
  gatewayName: string,
  deviceCount: number,
): void {
  doc.setFillColor(245, 246, 250);
  doc.rect(0, 0, pageW, headerH, 'F');

  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(10, headerH - 0.8, pageW - 10, headerH - 0.8);

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PresetupGateway — Etiquetas', 12, headerH / 2 + 1.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Gerado em: ${tsStampBR()}`, pageW - 14, headerH / 2 + 1.2, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(`Gateway: ${sanitizePdf(gatewayName)}  •  Dispositivos: ${deviceCount}`, 12, headerH - 2.2);
}

function drawFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  footerH: number,
  pageNo: number,
  pageCount: number,
): void {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, pageH - footerH, pageW, footerH, 'F');

  doc.setDrawColor(210);
  doc.setLineWidth(0.25);
  doc.line(10, pageH - footerH + 1.2, pageW - 10, pageH - footerH + 1.2);

  const baseline = pageH - footerH + 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(55);
  doc.text('MyIO — PresetupGateway SDK', 12, baseline);

  const label = `Página ${pageNo} de ${pageCount}`;
  const padX = 2.6;
  const padY = 1.6;
  doc.setFont('helvetica', 'bold');
  const textW = doc.getTextWidth(label);
  const badgeW = textW + padX * 2;
  const badgeH = 2 + padY * 2;
  const rightSafe = 12;
  const bx = pageW - rightSafe - badgeW;
  const by = baseline - 4;

  doc.setFillColor(245, 246, 250);
  doc.setDrawColor(230);
  doc.roundedRect(bx, by, badgeW, badgeH, 1.6, 1.6, 'FD');
  doc.setTextColor(40);
  doc.text(label, bx + padX, baseline);
}

async function drawTag(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  device: PresetupDevice,
  gateway: GatewayInfo,
  allDevices: PresetupDevice[],
): Promise<void> {
  const FRAME_SCALE_Y = 1.05;
  const QR_SCALE = 1.7;
  const QR_SHIFT_Y = 3;
  const GAP_AFTER_QR = 6;

  const frameH = h * FRAME_SCALE_Y;
  const frameY = y - (frameH - h) / 2;

  doc.setDrawColor(235);
  doc.setLineWidth(0.15);
  doc.rect(x, frameY, w, frameH);

  const pad = Math.max(2, h * 0.05);
  const innerX = x + pad;
  const innerW = w - pad * 2;

  const titleAreaH = h * 0.15;
  const qrAreaTop = y + titleAreaH;
  const qrAreaH = h - titleAreaH - 12;

  // Device name with prefix
  const displayName = generateDeviceNameWithPrefix(device, undefined, allDevices);
  const rawName = sanitizePdf(displayName);
  const nameFont = Math.max(6, Math.min(11, titleAreaH * 0.45));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameFont);
  let nameLines: string[] = doc.splitTextToSize(rawName, innerW);
  if (nameLines.length > 2) nameLines = [nameLines[0], nameLines[1] + '…'];
  const titleY = y + titleAreaH / 2 - (nameLines.length - 1) * nameFont * 0.5;
  doc.text(nameLines, innerX + innerW / 2, titleY + nameFont / 2, { align: 'center' });

  // QR code
  const qrUrl = buildDeviceQrUrl(device, gateway.centralId ?? [21, 0, 0, 0], undefined, allDevices);
  const qrData = await makeQrDataUrl(qrUrl);
  const baseSize = Math.min(qrAreaH, innerW);
  const qrSize = Math.min(baseSize * QR_SCALE, innerW, qrAreaH);
  const qrX = innerX + (innerW - qrSize) / 2;
  let qrY = qrAreaTop + (qrAreaH - qrSize) / 2 + QR_SHIFT_Y;

  // Prevent overflow below frame
  const qrBottom = qrY + qrSize;
  const frameBottom = frameY + frameH - 12;
  if (qrBottom > frameBottom) qrY -= qrBottom - frameBottom;

  try {
    doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {
    // silently skip on image error
  }

  // Text below QR
  const secondaryInfo = device.identifier ?? device.name ?? '';
  const addrLow = getEffectiveAddrLow(device);
  const addrHigh = getEffectiveAddrHigh(device);
  const addrRange = `${addrLow}-${addrHigh}`;
  let currentY = qrY + qrSize + GAP_AFTER_QR;

  if (secondaryInfo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const tw = doc.getTextWidth(secondaryInfo);
    doc.text(secondaryInfo, innerX + innerW / 2 - tw / 2, currentY - 2.5);
    currentY += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const atw = doc.getTextWidth(addrRange);
  doc.text(addrRange, innerX + innerW / 2 - atw / 2, currentY - 2.5);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Export a label sheet PDF for all devices in the gateway.
 * Ported from presetup-nextjs/src/services/pdf-export.ts — exportTagsPdf().
 */
export async function exportDeviceTagsPdf(
  devices: PresetupDevice[],
  gateway: GatewayInfo,
  layout: PdfLayout = 'grid_4x7',
): Promise<void> {
  if (!devices.length) throw new Error('Nenhum dispositivo para exportar');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const headerH = 16;
  const footerH = 14;
  const marginX = 8;
  const marginY = 8;
  const gutterX = 3;
  const gutterY = 3;

  const usableX = marginX;
  const usableY = headerH + marginY;
  const usableW = pageW - marginX * 2;
  const usableH = pageH - headerH - footerH - marginY * 2;

  const stamp = tsStamp();
  const gatewaySafe = sanitizeForFile(gateway.name);
  const filename = `presetup-tags-${gatewaySafe}-${stamp}.pdf`;

  const paintPage = (pageNo: number, total: number) => {
    drawHeader(doc, pageW, headerH, gateway.name, devices.length);
    drawFooter(doc, pageW, pageH, footerH, pageNo, total);
  };

  if (layout === 'per_page') {
    for (let i = 0; i < devices.length; i++) {
      if (i > 0) doc.addPage();
      paintPage((doc as any).internal.getNumberOfPages(), devices.length);
      await drawTag(doc, usableX, usableY, usableW, usableH, devices[i], gateway, devices);
    }
  } else {
    const cols = layout === 'grid_2x4' ? 2 : 4;
    const rows = layout === 'grid_2x4' ? 4 : 7;
    const tagW = (usableW - gutterX * (cols - 1)) / cols;
    const tagH = (usableH - gutterY * (rows - 1)) / rows;
    const totalPages = Math.ceil(devices.length / (cols * rows));

    let idx = 0;
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();
      paintPage(page + 1, totalPages);
      for (let row = 0; row < rows && idx < devices.length; row++) {
        for (let col = 0; col < cols && idx < devices.length; col++) {
          const tx = usableX + col * (tagW + gutterX);
          const ty = usableY + row * (tagH + gutterY);
          await drawTag(doc, tx, ty, tagW, tagH, devices[idx], gateway, devices);
          idx++;
        }
      }
    }
  }

  doc.save(filename);
}
