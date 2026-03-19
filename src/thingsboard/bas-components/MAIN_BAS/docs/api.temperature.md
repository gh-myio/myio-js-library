para buscar temperature por enquanto tem que buscar 1 por 1

assim

https://api.data.apps.myio-bas.com/api/v1/telemetry/devices/44a289c8-0809-4227-80fe-d43cda3915a1/temperature?startTime=2026-01-13T00:00:00-03:00&endTime=2026-02-12T23:59:59-03:00&granularity=1d&deep=0

ou seja se temos por exemplo 10 sensores

para sensor 1 fazemos uma busca

https://api.data.apps.myio-bas.com/api/v1/telemetry/devices/44a289c8-0809-4227-80fe-d43cda3915a1/temperature?startTime=2026-02-05T00:00:00-03:00&endTime=2026-02-12T23:59:59-03:00&granularity=1d&deep=0

com intervalo dos últimos 7 dias

e para o sensor 2 mesma coisa mudando o uuid e etc

veja o exemplo de um retorno da api

---

[
{
"id": "44a289c8-0809-4227-80fe-d43cda3915a1",
"name": "Temp. RJ 1",
"type": "temperature",
"consumption": [
{
"timestamp": "2026-01-13T03:00:00.000Z",
"value": 24.568421052631574
},
{
"timestamp": "2026-01-14T03:00:00.000Z",
"value": 22.942105263157885
},
{
"timestamp": "2026-01-15T03:00:00.000Z",
"value": 22.812280701754386
},
{
"timestamp": "2026-01-16T03:00:00.000Z",
"value": 23.39298245614035
},
{
"timestamp": "2026-01-17T03:00:00.000Z",
"value": 27.05614035087719
},
{
"timestamp": "2026-01-18T03:00:00.000Z",
"value": 28.06842105263159
},
{
"timestamp": "2026-01-19T03:00:00.000Z",
"value": 24.43508771929824
},
{
"timestamp": "2026-01-20T03:00:00.000Z",
"value": 23.407017543859652
},
{
"timestamp": "2026-01-21T03:00:00.000Z",
"value": 22.201754385964914
},
{
"timestamp": "2026-01-22T03:00:00.000Z",
"value": 22.221052631578946
},
{
"timestamp": "2026-01-23T03:00:00.000Z",
"value": 23.743859649122804
},
{
"timestamp": "2026-01-24T03:00:00.000Z",
"value": 24.49084249084249
},
{
"timestamp": "2026-01-25T03:00:00.000Z",
"value": 26.377192982456137
},
{
"timestamp": "2026-01-26T03:00:00.000Z",
"value": 25.68245614035088
},
{
"timestamp": "2026-01-27T03:00:00.000Z",
"value": 25.352631578947367
},
{
"timestamp": "2026-01-28T03:00:00.000Z",
"value": 25.221052631578953
},
{
"timestamp": "2026-01-29T03:00:00.000Z",
"value": 25.580701754385966
},
{
"timestamp": "2026-01-30T03:00:00.000Z",
"value": 23.499999999999996
},
{
"timestamp": "2026-01-31T03:00:00.000Z",
"value": 26.67017543859649
},
{
"timestamp": "2026-02-01T03:00:00.000Z",
"value": 26.608771929824563
},
{
"timestamp": "2026-02-02T03:00:00.000Z",
"value": 24.44912280701755
},
{
"timestamp": "2026-02-03T03:00:00.000Z",
"value": 24.417543859649122
},
{
"timestamp": "2026-02-04T03:00:00.000Z",
"value": 24.652631578947368
},
{
"timestamp": "2026-02-05T03:00:00.000Z",
"value": 24.854385964912282
},
{
"timestamp": "2026-02-06T03:00:00.000Z",
"value": 24.638888888888886
},
{
"timestamp": "2026-02-07T03:00:00.000Z",
"value": 25.986111111111104
},
{
"timestamp": "2026-02-08T03:00:00.000Z",
"value": 26.894097222222218
},
{
"timestamp": "2026-02-09T03:00:00.000Z",
"value": 24.417543859649122
},
{
"timestamp": "2026-02-10T03:00:00.000Z",
"value": 24.000000000000004
},
{
"timestamp": "2026-02-11T03:00:00.000Z",
"value": 25.605902777777775
},
{
"timestamp": "2026-02-12T03:00:00.000Z",
"value": 25.92622950819672
}
]
}
]

com isso podemos voltar a habilitar a tab TEMPERATURE em mountchartpanel
