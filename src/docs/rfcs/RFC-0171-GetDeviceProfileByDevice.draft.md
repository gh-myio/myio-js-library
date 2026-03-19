crie um método na LIB

similar a esse

/\*\*

- Checks if device type is an energy meter
- @param {string} deviceType - Device type string
- @returns {boolean}
  \*/
  export function isEnergyDevice(deviceType) {
  const dt = String(deviceType || '').toUpperCase();
  return dt === '3F_MEDIDOR' || dt.includes('3F') || dt.includes('MEDIDOR');
  }

em C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\classify\deviceType.ts

exposto em
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\index.ts

que vai receber na verdade o objeto device

verificamos as regras
