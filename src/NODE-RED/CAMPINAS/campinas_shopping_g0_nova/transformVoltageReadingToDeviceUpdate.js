const slave = msg.slave;
const lastReading = msg.payload;
const voltage = lastReading.voltage;
const fp = lastReading.fp;

let a, b, c;
let fpA, fpB, fpC;

if (voltage) {
  a = voltage.a;
  b = voltage.b;
  c = voltage.c;
}

if (fp) {
  fpA = fp.a;
  fpB = fp.b;
  fpC = fp.c;
}

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

function getMultiplier(deviceName) {
  const match = deviceName.match(/ x(\d+\.?\d*)V/i);
  return match ? parseFloat(match[1]) : 1;
}

const name = getNameWithoutMultipliers(slave.name);
const multiplier = getMultiplier(slave.name);

msg.payload = {
  [name]: [
    {
      fp_a: fpA,
      fp_b: fpB,
      fp_c: fpC,
      voltage_a: a ? a * multiplier : null,
      voltage_b: b ? b * multiplier : null,
      voltage_c: c ? c * multiplier : null,
    },
  ],
};

return msg;
