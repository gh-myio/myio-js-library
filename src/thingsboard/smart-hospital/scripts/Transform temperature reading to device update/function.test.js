/**
 * Testes simples para a função "Transform temperature reading to device update"
 *
 * Para rodar: node function.test.js
 */

// --- Carrega a função como módulo inline ---
function transformTemperatureReading(msg) {
  const slave = msg.slave;
  const lastReading = msg.payload;

  const name = slave.name.trimStart().trim();
  let key = 'temperature';

  if (!lastReading.hasOwnProperty('temperature')) {
    key = 'value';
  }

  const match = slave.name.match(/^(Temp\.\s*)([\wÀ-ÿ\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);

  const finalName = match ? match[2].trim() : name;
  const adjustment = match && match[3] ? match[3].trim() : '';

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
}

// --- Helpers ---
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ ${testName}`);
    failed++;
  }
}

// ============================================================
// Teste 1: Leitura simples sem ajuste
// Input: slave.name = "Temp. Sala Cirúrgica", payload.temperature = 22.5
// Esperado: payload = { "Sala Cirúrgica": [{ temperature: 22.5 }] }
// ============================================================
console.log('\nTeste 1: Leitura simples sem ajuste');
{
  const msg = {
    slave: { name: 'Temp. Sala Cirúrgica' },
    payload: { temperature: 22.5 },
  };

  const result = transformTemperatureReading(msg);

  assert(result.payload['Sala Cirúrgica'] !== undefined, 'Nome extraído corretamente');
  assert(result.payload['Sala Cirúrgica'][0].temperature === 22.5, 'Temperatura sem ajuste = 22.5');
}

// ============================================================
// Teste 2: Leitura com ajuste positivo (+2.5)
// Input: slave.name = "Temp. UTI +2.5", payload.temperature = 20
// Esperado: payload = { "UTI": [{ temperature: 22.5 }] }
// ============================================================
console.log('\nTeste 2: Leitura com ajuste positivo (+2.5)');
{
  const msg = {
    slave: { name: 'Temp. UTI +2.5' },
    payload: { temperature: 20 },
  };

  const result = transformTemperatureReading(msg);

  assert(result.payload['UTI'] !== undefined, 'Nome extraído = "UTI"');
  assert(result.payload['UTI'][0].temperature === 22.5, 'Temperatura ajustada = 20 + 2.5 = 22.5');
}

// ============================================================
// Teste 3: Fallback para chave "value" quando "temperature" não existe
// Input: slave.name = "Temp. Corredor -1", payload.value = 25
// Esperado: payload = { "Corredor": [{ temperature: 24 }] }
// ============================================================
console.log('\nTeste 3: Fallback para chave "value" + ajuste negativo (-1)');
{
  const msg = {
    slave: { name: 'Temp. Corredor -1' },
    payload: { value: 25 },
  };

  const result = transformTemperatureReading(msg);

  assert(result.payload['Corredor'] !== undefined, 'Nome extraído = "Corredor"');
  assert(result.payload['Corredor'][0].temperature === 24, 'Temperatura ajustada = 25 - 1 = 24');
}

// --- Resumo ---
console.log(`\nResultado: ${passed} passou, ${failed} falhou\n`);
process.exit(failed > 0 ? 1 : 0);
