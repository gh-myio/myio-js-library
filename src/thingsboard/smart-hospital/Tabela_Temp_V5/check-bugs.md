temos

- console do navegador: src\thingsboard\smart-hospital\Tabela_Temp_V5\dashboard.myio-bas.com-1770822892657.log
- return do endpoint: src\thingsboard\smart-hospital\Tabela_Temp_V5\return-endpoint.json
- e veja a função do NODE RED que prepara o report : src\thingsboard\smart-hospital\Tabela_Temp_V5\nodered.controller.js

---

pergunta como que no retorno temos

dados como

@/src\thingsboard\smart-hospital\Tabela_Temp_V5\return-endpoint.json

```
  {
    "reading_date": "2026-02-11T00:00:00.000Z",
    "slave_id": 111,
    "time_interval": "2026-02-11T16:30:00.000Z",
    "avg_value": "23.8103448275862069",
    "deviceName": "CO2_CC02",
    "value": 18.810344827586206
  },
```

vindo do node red ? isso é timezone errado ?

outra pergunta

todos os dados para
Cirurgia 02 = CO2_CC02 (Souza Aguiar CO2) = CO2_CC02
estão em 21.00°C

por quem ?
