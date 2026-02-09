temos que no oninit

montar o MAP dos ambientes da seguinte forma

em ctx.datasources temos vários itens
quando acharmos itens que
entityType = "DEVICE"

vamos ter que ir montando o map

pegando o parent desse device buscando igual aqui

@/src\thingsboard\bas-components\blinking-air-list-with-consumption-and-temperature-v3\controller.js

```
function getParentAssetViaHttp(deviceEntityId) {

```

se ele já existir, a gente só coloca o device na árvore caso nÀo vamos construindo essa árvore

vai ser mais ou menos assim

MelicidadeAsset (ASSET)

-     Melicidade-SalaNobreak (ASSET)
  ---- Temp. Remote Nobreak (Melicidade) (DEVICE)
  ---- 3F Ar Nobreak (Melicidade) (DEVICE)
-     Melicidade-Deck (ASSET)
  ---- Melicidade-Deck-Climatização (ASSET) <NESSE AMBIENTE NÃO FOI INSTALADO O 3F>
  -------- Ar Deck (Melicidade) (DEVICE REMOTE)) <NESSE AMBIENTE NÃO FOI INSTALADO O 3F>
  -------- Temp. Deck Dir. (Melicidade) (DEVICE)
  -------- Temp. Deck Meio (Melicidade) (DEVICE)
  ---- Melicidade-Deck-Iluminação (ASSET) <NESSE AMBIENTE NÃO FOI INSTALADO O 3F> NEM SENSOR DE TEMPERATURA
  -------- Iluminação Externa-Deck (Melicidade) (DEVICE REMOTE)
  -------- Iluminação Vigia (Melicidade) (DEVICE REMOTE)
-     Melicidade-Auditório (ASSET) <NESSE AMBIENTE NÃO FOI INSTALADO O 3F>
  ---- Habilitar Evaporadora Auditório (Melicidade) (DEVICE)
  ---- Temp. Auditório Dir. (Melicidade) (DEVICE)
  ---- Temp. Auditório. Esq. (Melicidade) (DEVICE)
