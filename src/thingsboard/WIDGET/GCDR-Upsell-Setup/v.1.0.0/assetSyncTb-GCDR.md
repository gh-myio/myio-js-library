Campos-chave para integração ThingsBoard:

Hierarquia de tipos disponíveis:

SITE → BUILDING → FLOOR → ROOM / ZONE / EQUIPMENT / OTHER

Campos-chave para integração ThingsBoard:

┌───────────────┬─────────────────┬───────────────────────────────────────────────────────────────┐
│ Campo │ Onde vai │ Uso │
├───────────────┼─────────────────┼───────────────────────────────────────────────────────────────┤
│ metadata.tbId │ JSONB metadata │ UUID do asset no TB — para lookup WHERE metadata->>'tbId' = ? │
├───────────────┼─────────────────┼───────────────────────────────────────────────────────────────┤
│ parentAssetId │ coluna dedicada │ montar a hierarquia TB → GCDR │
├───────────────┼─────────────────┼───────────────────────────────────────────────────────────────┤
│ code │ coluna dedicada │ código curto único por customer │
└───────────────┴─────────────────┴───────────────────────────────────────────────────────────────┘

Assets não têm externalId dedicado como devices — o metadata.tbId é o campo correto para guardar o UUID do ThingsBoard enquanto não houver uma coluna específica para isso.

exemplos de payloads
src\thingsboard\WIDGET\GCDR-Upsell-Setup\v.1.0.0\payloadSample-newAsset.json
src\thingsboard\WIDGET\GCDR-Upsell-Setup\v.1.0.0\payloadSample-updateAsset.json
