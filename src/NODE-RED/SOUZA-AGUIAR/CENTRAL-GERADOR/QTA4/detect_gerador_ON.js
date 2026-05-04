// Node-RED function — QTA4 / Gerador 4
// Group:   36513397.a434cc (QTA4)
// Node id: e05d3e4b.c3369
// Name:    "Detect Gerador ON"
// Tab:     f58a5c30.bc029 (Flow 1)
// Source:  bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json
//
// Detecta transição do gerador OFF→ON com a rede ainda OFF, e produz um
// número puro (msg.payload = timeDelta, em ms) consumido pelo próximo node
// "Send Gerador StartupTime" (6ea7cdcf.a463c4).
//
// ⚠️ BUG semântico identificado em
//    src/NODE-RED/SOUZA-AGUIAR/CENTRAL-GERADOR/investigation-gerador-4-startup-time.md §4
// Resumo: REDE_OFF_TIME4 só é resetada quando rede vai ON→OFF.
// Se o gerador oscilar (partir → cair → partir) com a rede ainda OFF, todas
// as partidas posteriores reusam o MESMO REDE_OFF_TIME4 → timeDelta cresce
// monotonicamente. O nome "startupTime" engana: o cálculo entrega
// "tempo desde a queda da rede até esta partida do gerador", não
// "tempo de partida do gerador nesta transição".

const lastStatusGerador = flow.get('STATUS_GERADOR4');
const statusRede = flow.get('STATUS_REDE4');
const input = msg.payload.channels[0].input;

const statusGerador = input > 0 ? 'OFF' : 'ON';

flow.set('STATUS_GERADOR4', statusGerador);

if (statusRede === 'OFF' && statusGerador === 'ON' && lastStatusGerador === 'OFF') {
  const redeOffTime = flow.get('REDE_OFF_TIME4');
  const now = new Date().getTime();

  const timeDelta = now - redeOffTime;

  msg.payload = timeDelta;

  return msg;
}
