// Node-RED function — QTA4 / Gerador 4
// Group:   36513397.a434cc (QTA4)
// Node id: 2faa4fd1.66fbf
// Name:    "Status Rede"
// Tab:     f58a5c30.bc029 (Flow 1)
// Source:  bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json
//
// Emite ao ThingsBoard o estado bruto do canal 1 do slave 6.
// Slave 6 = "QTA 4" (type=outlet). Canal 1 = device lógico "Rede 4"
// (type=presence_sensor) — sensor de presença de tensão no barramento da
// concessionária. 0 = ON (rede ativa), >0 = OFF (rede caída). Sem debouncing.

msg.payload = {
  'Rede 4 (Souza Aguiar Gerador)': [
    {
      ts: new Date().getTime(),
      values: {
        status: msg.payload.channels[1].input,
      },
    },
  ],
};

return msg;
