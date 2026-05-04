// Node-RED function — QTA4 / Gerador 4
// Group:   36513397.a434cc (QTA4)
// Node id: 25facd11.288612    (versão ATIVA — convive com cdfb0afe.c4e898 que é dead code)
// Name:    "Store Status Rede"
// Tab:     f58a5c30.bc029 (Flow 1)
// Source:  bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json
//
// Mantém STATUS_REDE4 e REDE_OFF_TIME4 no flow.context.
//   - Em ON→OFF (rede caiu): grava o instante e NÃO emite.
//   - Em OFF→ON (rede voltou): emite "Rede 4 time" com a duração total da queda.
// Convive em fan-out com:
//   - Detect Gerador ON (e05d3e4b.c3369), que LÊ REDE_OFF_TIME4 setada aqui.
// Ordem de execução no link in 1dd55047.29013: este node executa ANTES do Detect.

const storedState = flow.get('STATUS_REDE4');
const input = msg.payload.channels[1].input;
let timeDelta = 0;
const newState = input === 0 ? 'ON' : 'OFF';

flow.set('STATUS_REDE4', newState);

if (newState === 'OFF' && storedState === 'ON') {
  flow.set('REDE_OFF_TIME4', new Date().getTime());

  return null;
} else if (storedState == 'OFF' && newState == 'ON') {
  const redeOffTime = flow.get('REDE_OFF_TIME4');
  const now = new Date().getTime();
  timeDelta = now - redeOffTime;
  msg.payload = {
    'Rede 4 time (Souza Aguiar Gerador)': [
      {
        ts: new Date().getTime(),
        values: {
          startupTime: timeDelta,
        },
      },
    ],
  };
  return msg;
}
return null;
