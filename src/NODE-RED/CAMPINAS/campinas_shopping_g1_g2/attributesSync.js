const devices = flow.get('devices');
const centralId = env.get('CENTRAL_UUID');
const newDeviceList = {};

function getNameWithoutMultipliers(deviceName) {
  var safeName = deviceName ? deviceName : '';
  return safeName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

var deviceTypePatterns = [
  { patterns: ['COMPRESSOR'], type: 'COMPRESSOR' },
  { patterns: ['VENT'], type: 'VENTILADOR' },
  { patterns: ['ESRL'], type: 'ESCADA_ROLANTE' },
  { patterns: ['ELEV'], type: 'ELEVADOR' },
  { patterns: ['MOTOR', 'RECALQUE'], type: 'MOTOR' },
  { patterns: ['RELOGIO', 'RELOG', 'REL '], type: 'RELOGIO' },
  { patterns: ['ENTRADA', 'SUBESTACAO', 'SUBEST'], type: 'ENTRADA' },
  { patterns: ['CHILLER'], type: 'CHILLER' },
  { patterns: ['FANCOIL'], type: 'FANCOIL' },
  { patterns: ['TRAFO'], type: 'ENTRADA' },
  { patterns: ['CAG'], type: 'BOMBA_CAG' },
  { patterns: ['HIDR', 'BANHEIRO'], type: 'HIDROMETRO' },
  { patterns: ['CAIXA DAGUA', 'CX DAGUA', 'CXDAGUA', 'SCD'], type: 'CAIXA_DAGUA' },
  { patterns: ['TANK', 'TANQUE', 'RESERVATORIO'], type: 'TANK' },
  { patterns: ['AUTOMATICO'], type: 'SELETOR_AUTO_MANUAL' },
  { patterns: ['TERMOSTATO', 'TERMO', 'TEMP'], type: 'TERMOSTATO' },
  { patterns: ['ABRE'], type: 'SOLENOIDE' },
  { patterns: ['AUTOMACAO', 'GW_AUTO'], type: 'GLOBAL_AUTOMACAO' },
  { patterns: [' AC ', 'AC '], type: 'CONTROLE_REMOTO' },
  { patterns: ['ILUM', 'LAMP'], type: 'LAMP' },
];

function handleDeviceType(name) {
  var safeName = name ? name : '';
  var upper = safeName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Caso especial: MOTR sem CHILLER
  if (upper.includes('MOTR') && !upper.includes('CHILLER')) {
    return 'MOTOR';
  }

  // Busca nos padrões
  for (var i = 0; i < deviceTypePatterns.length; i++) {
    var item = deviceTypePatterns[i];
    for (var j = 0; j < item.patterns.length; j++) {
      if (upper.includes(item.patterns[j])) {
        return item.type;
      }
    }
  }

  // Caso especial: termina com " AC"
  if (upper.slice(-3) === ' AC') {
    return 'CONTROLE REMOTO';
  }

  // Caso especial: começa com "3F "
  if (upper.indexOf('3F ') === 0) {
    return '3F_MEDIDOR';
  }

  return 'UNDEFINED';
}

Object.keys(devices).forEach((key) => {
  const device = devices[key];

  if (devices[key].slaveId && devices[key].name) {
    const cleanName = getNameWithoutMultipliers(device.name);

    newDeviceList[cleanName] = {
      deviceType: handleDeviceType(key),
      centralId: centralId,
      slaveId: device.slaveId,
    };
  }
});

msg.payload = newDeviceList;

return msg;
