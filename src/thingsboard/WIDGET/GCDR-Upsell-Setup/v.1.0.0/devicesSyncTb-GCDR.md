Campos-chave para integração ThingsBoard:

┌───────────────┬─────────────────┬──────────────────────────────────────────────────┐
│ Campo │ Onde vai │ Uso │
├───────────────┼─────────────────┼──────────────────────────────────────────────────┤
│ externalId │ coluna dedicada │ lookup direto GET /devices/external/:tbId │
├───────────────┼─────────────────┼──────────────────────────────────────────────────┤
│ metadata.tbId │ JSONB metadata │ compatibilidade com dados legados │
├───────────────┼─────────────────┼──────────────────────────────────────────────────┤
│ slaveId │ coluna dedicada │ lookup Modbus GET /devices?centralId=X&slaveId=Y │
├───────────────┼─────────────────┼──────────────────────────────────────────────────┤
│ centralId │ coluna dedicada │ referência ao gateway/central │
├───────────────┼─────────────────┼──────────────────────────────────────────────────┤
│ deviceProfile │ coluna dedicada │ perfil TB para regras │
└───────────────┴─────────────────┴──────────────────────────────────────────────────┘

Recomendação: usar externalId como campo principal para o UUID do TB (lookup indexado). O metadata.tbId é útil para manter durante a migração de devices que foram cadastrados antes do campo externalId existir.

exemplos de payloads
src\thingsboard\WIDGET\GCDR-Upsell-Setup\v.1.0.0\payloadSample-newDevice.json
src\thingsboard\WIDGET\GCDR-Upsell-Setup\v.1.0.0\payloadSample-updateDevice.json
