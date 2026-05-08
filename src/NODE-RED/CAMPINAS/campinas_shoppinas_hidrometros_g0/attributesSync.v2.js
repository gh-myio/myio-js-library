// attributesSync v2 — consolidated final
//
// Mudanças em relação à v1 (PROD):
//   - getCleanName: strip de prefixo "Temp."|"Temperatura", offset estendido
//     para [+\-x]\d+(\.\d+)?, e strip de leitura inicial \d+m³ no fim.
//     Suporta nomes com parênteses (ex: "Temperatura SalaA(Perto da escada)").
//   - handleDeviceType:
//       · MOTR só retorna MOTOR se NÃO contiver CHILLER (deixa cair no bloco 3F).
//       · 3F é subclassificado em CHILLER, FANCOIL, ENTRADA (via TRAFO ou ENTRADA),
//         BOMBA_CAG (via CAG); fallback é 3F_MEDIDOR.
//       · HIDROMETRO inclui devices com "BANHEIRO" no nome.
//   - Strip de diacríticos sem \p{Diacritic} (compat com Node-RED Function node):
//     usa range [̀-ͯ] (Combining Diacritical Marks) após NFD.

const devices = flow.get('devices');
const centralId = env.get('CENTRAL_UUID');
const newDeviceList = {};

// Limpa o nome: remove prefixo, multiplicador, offset e leitura inicial
// Ex: "Hidr. Colonial x1 0m3"                    -> "Hidr. Colonial"
//     "Temp. SalaA -2"                           -> "SalaA"
//     "Temperatura xxxx xxxx(Perto da escada)"   -> "xxxx xxxx(Perto da escada)"
function getCleanName(deviceName) {
  return deviceName
    .replace(/^(Temp\.\s*|Temperatura\s+)/i, '') // Remove prefixo Temp.|Temperatura
    .replace(/ x\d+\.?\d*[AV]?/gi, '')           // Remove multiplicador (x1, x100, etc.)
    .replace(/\s[+\-x]\d+(\.\d+)?$/, '')         // Remove offset trailing (-2, +1.5, x2)
    .replace(/\s*\d+m[³3]?\s*$/i, '')            // Remove leitura inicial (0m3, 2810m3, etc.)
    .trim();
}

function handleDeviceType(name) {
  const upper = (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip Combining Diacritical Marks

  // ENERGY
  if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
  if (upper.includes('VENT')) return 'VENTILADOR';
  if (upper.includes('ESRL')) return 'ESCADA_ROLANTE';
  if (upper.includes('ELEV')) return 'ELEVADOR';

  // MOTR/MOTOR — exclui CHILLER para que MOTR_CHILLER caia no bloco 3F abaixo
  if (
    (upper.includes('MOTR') && !upper.includes('CHILLER'))
    || upper.includes('MOTOR')
    || upper.includes('RECALQUE')
  ) return 'MOTOR';

  if (upper.includes('RELOGIO') || upper.includes('RELOG') || upper.includes('REL ')) return 'RELOGIO';

  if (
    upper.includes('ENTRADA') ||
    upper.includes('SUBESTACAO') ||
    upper.includes('SUBEST')
  ) return 'ENTRADA';

  // 3F — subclassificação por palavra-chave; 3F_MEDIDOR é fallback
  if (upper.includes('3F')) {
    if (upper.includes('CHILLER')) return 'CHILLER';
    if (upper.includes('FANCOIL')) return 'FANCOIL';
    if (upper.includes('TRAFO'))   return 'ENTRADA';
    if (upper.includes('ENTRADA')) return 'ENTRADA';
    if (upper.includes('CAG'))     return 'BOMBA_CAG';
    return '3F_MEDIDOR';
  }

  // WATER
  if (upper.includes('HIDR') || upper.includes('BANHEIRO')) return 'HIDROMETRO';

  // CAIXA_DAGUA (casa com typeMap)
  if (
    upper.includes('CAIXA DAGUA') ||
    upper.includes('CX DAGUA') ||
    upper.includes('CXDAGUA') ||
    upper.includes('SCD')
  ) return 'CAIXA_DAGUA';

  if (upper.includes('TANK') || upper.includes('TANQUE') || upper.includes('RESERVATORIO')) return 'TANK';

  // Extras
  if (upper.includes('AUTOMATICO')) return 'SELETOR_AUTO_MANUAL';
  if (upper.includes('TERMOSTATO') || upper.includes('TERMO') || upper.includes('TEMP')) return 'TERMOSTATO';
  if (upper.includes('ABRE')) return 'SOLENOIDE';
  if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO')) return 'GLOBAL_AUTOMACAO';
  if (upper.includes(' AC ') || upper.endsWith(' AC')) return 'CONTROLE REMOTO';

  // Fallback
  return '3F_MEDIDOR';
}

Object.keys(devices).forEach((key) => {
  const device = devices[key];

  if (devices[key].slaveId && devices[key].name) {
    const cleanName = getCleanName(device.name);

    newDeviceList[cleanName] = {
      deviceType: handleDeviceType(key),
      centralId: centralId,
      slaveId: devices[key].slaveId,
    };
  }
});

msg.payload = newDeviceList;

return msg;
