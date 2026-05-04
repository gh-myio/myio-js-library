// Node-RED function — QTA4 / Gerador 4
// Group:   36513397.a434cc (QTA4)
// Node id: d4f4992c.1d82d8
// Name:    "Status Gerador"
// Tab:     f58a5c30.bc029 (Flow 1)
// Source:  bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json
//
// Emite ao ThingsBoard o estado bruto do canal 0 do slave 6.
// Slave 6 = "QTA 4" (type=outlet). Canal 0 = device lógico "Gerador 4"
// (type=presence_sensor) — sensor de presença de tensão na saída do gerador.
// 0 = ON (com tensão), >0 = OFF (sem tensão). Sem debouncing.

msg.payload = {
  'Gerador 4 (Souza Aguiar Gerador)': [
    {
      ts: new Date().getTime(),
      values: {
        status: msg.payload.channels[0].input,
      },
    },
  ],
};

return msg;
