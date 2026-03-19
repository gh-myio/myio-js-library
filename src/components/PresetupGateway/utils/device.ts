import type { PresetupDevice, DeviceType } from '../types';

// ─── Type mappings ────────────────────────────────────────────────────────────

const PREFIX_MAP: Record<string, string> = {
  COMPRESSOR: '3F COMP.',
  VENTILADOR: '3F VENT.',
  SELETOR_AUTO_MANUAL: 'S_AUTO_MANUAL.',
  TERMOSTATO: 'TEMP.',
  '3F_MEDIDOR': '3F',
  MOTOR: '3F MOTR.',
  ESCADA_ROLANTE: '3F ESRL.',
  ELEVADOR: '3F ELEV.',
  HIDROMETRO: 'HIDR.',
  SOLENOIDE: 'ABFE.',
  CONTROLE_REMOTO: 'AC',
  CAIXA_D_AGUA: 'SCD',
  CONTROLE_AUTOMACAO: 'GW_AUTO.',
};

/**
 * Maps a ThingsBoard/presetup device type to the Ingestion API deviceType.
 * Source: presetup-nextjs/src/lib/utils.ts — mapToIngestionDeviceType()
 */
export function mapIngestionDeviceType(type: string): 'energy' | 'water' {
  const t = String(type).toUpperCase();
  if (t === 'HIDROMETRO' || t === 'CAIXA_D_AGUA' || t === 'SOLENOIDE') return 'water';
  return 'energy';
}

/**
 * Maps a device type to the Provisioning API type string.
 * Source: presetup-nextjs/src/services/sync/central-sync.ts — mapDeviceType()
 */
export function mapProvisioningDeviceType(type: string): string {
  const t = String(type).toUpperCase();
  if (['3F_MEDIDOR', 'ELEVADOR', 'ESCADA_ROLANTE', 'MOTOR', 'REPETIDOR_3F', '3F'].includes(t)) {
    return 'three_phase_sensor';
  }
  if (['REPETIDOR_RM', 'REMOTE'].includes(t)) {
    return 'infrared';
  }
  return 'outlet';
}

// ─── Effective value helpers ──────────────────────────────────────────────────

/** Source: presetup-nextjs/src/lib/utils.ts — getEffectiveSlaveId() */
export function getEffectiveSlaveId(device: Pick<PresetupDevice, 'slaveId'>): number {
  return (device as any).overrides?.slaveId ?? device.slaveId;
}

/** Source: presetup-nextjs/src/lib/utils.ts — getEffectiveAddrLow() */
export function getEffectiveAddrLow(device: Pick<PresetupDevice, 'slaveId' | 'addr_low'>): string {
  return (device as any).overrides?.addr_low ?? device.addr_low ?? String(device.slaveId);
}

/** Source: presetup-nextjs/src/lib/utils.ts — getEffectiveAddrHigh() */
export function getEffectiveAddrHigh(device: Pick<PresetupDevice, 'addr_high' | 'slaveId'>): string {
  return (device as any).overrides?.addr_high ?? device.addr_high ?? String(device.slaveId);
}

// ─── Name generation ──────────────────────────────────────────────────────────

/**
 * Abbreviate a hierarchy segment name.
 * Source: presetup-nextjs/src/lib/utils.ts — abbreviateName()
 */
export function abbreviateName(name: string): string {
  if (!name) return '';
  if (name.includes('/')) return name;

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();

  if (/^[A-Z]*\d+[A-Z]*$/i.test(normalized)) return normalized;

  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1 && normalized.length <= 10) return normalized;
  if (words.length === 1) return words[0].substring(0, 3);
  return words.slice(0, 4).map(w => w[0]).join('');
}

/**
 * Generate the device identifier used inside the full device name.
 * Source: presetup-nextjs/src/lib/utils.ts — generateDeviceIdentifier()
 */
export function generateDeviceIdentifier(
  device: Pick<PresetupDevice, 'identifier' | 'name' | 'addr_low'>,
  hierarchyPath?: string[],
): string {
  const id = device.identifier ?? '';

  if (id && (id.startsWith('AC') || id.startsWith('RC') || id.startsWith('EL'))) {
    const pathForHierarchy = hierarchyPath ? hierarchyPath.slice(0, -1) : [];
    const hierarchyCode = pathForHierarchy.length > 0
      ? pathForHierarchy.map(abbreviateName).join('').toUpperCase()
      : '';
    return `${hierarchyCode}${id}`;
  }

  const hierarchyCode = hierarchyPath
    ? hierarchyPath.map(abbreviateName).join('').toUpperCase()
    : 'UNK';

  const deviceCode = id || device.name || device.addr_low || '1';

  if (hierarchyPath && hierarchyPath.length > 0) {
    const last = hierarchyPath[hierarchyPath.length - 1];
    if (last === deviceCode) return hierarchyCode;
  }

  return `${hierarchyCode}${deviceCode}`;
}

/**
 * Generate the full device name with type prefix.
 * Source: presetup-nextjs/src/lib/utils.ts — generateDeviceNameWithPrefix()
 */
export function generateDeviceNameWithPrefix(
  device: Pick<PresetupDevice, 'type' | 'identifier' | 'name' | 'addr_low' | '_localId'>,
  hierarchyPath?: string[],
  allDevicesInAsset?: Pick<PresetupDevice, 'type' | 'identifier' | 'name' | 'addr_low' | '_localId'>[],
): string {
  const prefix = PREFIX_MAP[device.type] ?? 'DEV.';
  const identifier = generateDeviceIdentifier(device, hierarchyPath);
  const baseName = `${prefix} ${identifier}`;

  if (allDevicesInAsset && allDevicesInAsset.length > 0) {
    const conflicts = allDevicesInAsset.filter(d => {
      if (d._localId === device._localId) return false;
      const otherPrefix = PREFIX_MAP[d.type] ?? 'DEV.';
      const otherId = generateDeviceIdentifier(d, hierarchyPath);
      return `${otherPrefix} ${otherId}` === baseName;
    });

    if (conflicts.length > 0) {
      const all = allDevicesInAsset.filter(d => {
        const otherPrefix = PREFIX_MAP[d.type] ?? 'DEV.';
        const otherId = generateDeviceIdentifier(d, hierarchyPath);
        return `${otherPrefix} ${otherId}` === baseName;
      });
      const idx = all.findIndex(d => d._localId === device._localId);
      if (idx > 0) return `${baseName}_${idx + 1}`;
    }
  }

  return baseName;
}

// ─── QR URL encoding ──────────────────────────────────────────────────────────

/**
 * XOR + base64 encode a payload string.
 * Source: presetup-nextjs/src/lib/utils.ts — encodePayload()
 */
export function encodePayload(payload: string, xorKey = 73): string {
  const bytes = new TextEncoder().encode(payload);
  const encoded = Array.from(bytes).map(b => b ^ xorKey);
  return btoa(String.fromCharCode(...encoded));
}

/**
 * Build the full QR code URL for a device.
 * Source: presetup-nextjs/src/services/pdf-export.ts — buildDeviceQrUrl()
 */
export function buildDeviceQrUrl(
  device: PresetupDevice,
  centralIdArray: number[],
  hierarchyPath?: string[],
  allDevicesInAsset?: PresetupDevice[],
): string {
  const addrLow = parseInt(getEffectiveAddrLow(device), 10);
  const addrHigh = parseInt(getEffectiveAddrHigh(device), 10);
  const freq = device.slaveId; // frequency comes from gateway; use slaveId for now
  const arr = centralIdArray.length === 4 ? centralIdArray : [21, 0, 0, 0];
  const centralId = `${arr[0]}.${String(arr[1]).padStart(3, '0')}.${String(arr[2]).padStart(3, '0')}.${String(arr[3]).padStart(3, '0')}`;
  const identifier = device.identifier ?? '';
  const payload = `${addrLow}/${addrHigh}/${freq}/${centralId}/${identifier}`;
  const encodedPayload = encodePayload(payload);

  const fullName = generateDeviceNameWithPrefix(device, hierarchyPath, allDevicesInAsset);
  const safeName = fullName
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '');

  return `https://produto.myio.com.br/${safeName}/${encodedPayload}`;
}

// ─── Unique ID generation ─────────────────────────────────────────────────────

export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateDeviceUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─── Timestamp ────────────────────────────────────────────────────────────────

export function tsStampBR(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

export function tsStamp(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

export function sanitizeForFile(s: string): string {
  return String(s || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 80);
}

// ─── Device label helpers ─────────────────────────────────────────────────────

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  '3F_MEDIDOR': '3F Medidor',
  HIDROMETRO: 'Hidrômetro',
  COMPRESSOR: 'Compressor',
  VENTILADOR: 'Ventilador',
  TERMOSTATO: 'Termostato',
  MOTOR: 'Motor',
  ESCADA_ROLANTE: 'Escada Rolante',
  ELEVADOR: 'Elevador',
  SOLENOIDE: 'Solenoide',
  CONTROLE_REMOTO: 'Controle Remoto (AC)',
  CAIXA_D_AGUA: 'Caixa d\'Água',
  CONTROLE_AUTOMACAO: 'Controle de Automação',
};
