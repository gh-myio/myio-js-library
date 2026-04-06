const slave = msg.slave;
const lastReading = msg.payload;

const name = slave.name.trimStart().trim();
let key = 'temperature';

if (!lastReading.hasOwnProperty('temperature')) {
  key = 'value';
}

const match = slave.name.match(/^(Temp\.\s*)([\wÀ-ÿ\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/i);
// node.warn(match);
// Always strip trailing offset (e.g. " -2", " +1.5") from the name — even when regex doesn't match
const rawName = match ? match[2].trim() : name;
const finalName = rawName.replace(/\s[+\-x]\d+(\.\d+)?$/, '').trim();
const adjustment = match && match[3]
  ? match[3].trim()
  : (name.match(/\s([+\-x]\d+(\.\d+)?)$/) || [])[1] || '';

// Check for operator before applying adjustment
let adjustedTemperature = lastReading[key];
if (/^[+\-x]\d+(\.\d+)?$/.test(adjustment)) {
  const operator = adjustment.charAt(0);
  const value = parseFloat(adjustment.substring(1));

  if (operator === '+') {
    adjustedTemperature += value;
  } else if (operator === '-') {
    adjustedTemperature -= value;
  } else if (operator === 'x') {
    adjustedTemperature *= value;
  }
}

msg.payload = {
  [finalName]: [
    {
      temperature: adjustedTemperature,
    },
  ],
};

return msg;
