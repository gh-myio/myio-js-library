const devices = flow.get('devices');
const centralId = env.get('CENTRAL_UUID');
const newDeviceList = {};

function getNameWithoutMultipliers(deviceName) {
  return deviceName
    .replace(/ x\d+\.?\d*[AV]?/gi, '')
    .replace(/ -\d+$/g, '')
    .trim();
}

function handleDeviceType(name) {
  const upper = (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // ENERGY
  if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
  if (upper.includes('VENT')) return 'VENTILADOR';
  if (upper.includes('ESRL')) return 'ESCADA_ROLANTE';
  if (upper.includes('ELEV')) return 'ELEVADOR';
  if (upper.includes('MOTR') || upper.includes('MOTOR') || upper.includes('RECALQUE')) return 'MOTOR';
  if (upper.includes('RELOGIO') || upper.includes('RELOG') || upper.includes('REL ')) return 'RELOGIO';
  if (
    upper.includes('ENTRADA') ||
    upper.includes('SUBESTACAO') ||
    upper.includes('SUBESTACAO') ||
    upper.includes('SUBEST')
  )
    return 'ENTRADA';
  if (upper.includes('3F')) return '3F_MEDIDOR';

  // WATER
  if (upper.includes('HIDR')) return 'HIDROMETRO';

  // Corrige para casar com o typeMap: CAIXA_DAGUA
  if (
    upper.includes('CAIXA DAGUA') ||
    upper.includes('CX DAGUA') ||
    upper.includes('CXDAGUA') ||
    upper.includes('SCD')
  )
    return 'CAIXA_DAGUA';

  // Novo (presentes no typeMap como water)
  if (upper.includes('TANK') || upper.includes('TANQUE') || upper.includes('RESERVATORIO')) return 'TANK';

  // Extras (não mapeados no typeMap, mas mantidos)
  if (upper.includes('AUTOMATICO')) return 'SELETOR_AUTO_MANUAL';
  if (upper.includes('TERMOSTATO') || upper.includes('TERMO') || upper.includes('TEMP')) return 'TERMOSTATO';
  if (upper.includes('ABRE')) return 'SOLENOIDE';
  if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO')) return 'GLOBAL_AUTOMACAO';
  if (upper.includes(' AC ') || upper.endsWith(' AC')) return 'CONTROLE REMOTO';

  return '3F_MEDIDOR';
}

Object.keys(devices).forEach((key) => {
  const device = devices[key];

  if (devices[key].slaveId && devices[key].name) {
    const cleanName = getNameWithoutMultipliers(device.name);

    newDeviceList[cleanName] = {
      deviceType: handleDeviceType(key),
      centralId: centralId,
      slaveId: devices[key].slaveId,
    };
  }
});

msg.payload = newDeviceList;

return msg;
