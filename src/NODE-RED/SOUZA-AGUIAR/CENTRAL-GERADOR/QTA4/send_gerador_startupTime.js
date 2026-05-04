// Node-RED function — QTA4 / Gerador 4
// Group:   36513397.a434cc (QTA4)
// Node id: 6ea7cdcf.a463c4
// Name:    "Send Gerador StartupTime"
// Tab:     f58a5c30.bc029 (Flow 1)
// Source:  bkp_QTA4_flow_souza_aguiar_gerador_2026-05-04-12_32.json
//
// Empacota o timeDelta (ms) recebido de "Detect Gerador ON" no formato
// esperado pelo HTTP POST de telemetria do ThingsBoard.
// Saída → link out ff42b7a3.bd4718 → link in 5cc7bf8e.1546a → HTTP POST TB.

msg.payload = {
  'Gerador 4 (Souza Aguiar Gerador)': [
    {
      ts: new Date().getTime(),
      values: {
        startupTime: msg.payload,
      },
    },
  ],
};
return msg;
