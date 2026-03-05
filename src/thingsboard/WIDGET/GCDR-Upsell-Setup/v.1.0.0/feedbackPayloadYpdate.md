● ┌───────────────┬──────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐ │ Campo │ Assets │ Devices │  
 ├───────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤ │ name │ ✅ pode alterar via PUT │ ✅ pode alterar via PUT │  
 ├───────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤ │ parentAssetId │ ❌ não está no UpdateSchema — usar POST /assets/:id/move │ — │  
 ├───────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ assetId │ — │ ❌ não está no UpdateSchema — usar POST /devices/:id/move │
├───────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ customerId │ ❌ não está no UpdateSchema — sem endpoint de troca │ ❌ não está no UpdateSchema — muda implicitamente ao mover o device para asset de outro customer │
└───────────────┴──────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘

name é editável. Só parentAssetId / assetId / customerId são protegidos do PUT e têm endpoints dedicados (ou não têm troca direta).

parentAssetId — protegido porque não está no UpdateAssetSchema (src/dto/request/AssetDTO.ts:51). Endpoint dedicado: POST /assets/:id/move
{ "newParentAssetId": "uuid-ou-null", "newCustomerId": "uuid-opcional" }  
 assetId (device) — protegido porque não está no UpdateDeviceSchema (src/dto/request/DeviceDTO.ts:114). Endpoint dedicado:  
 POST /devices/:id/move
{ "newAssetId": "uuid" }

customerId (asset) — sem campo no UpdateSchema, mas pode ser trocado via o mesmo POST /assets/:id/move passando newCustomerId.

customerId (device) — sem campo no UpdateSchema, sem endpoint direto. Muda implicitamente: se você mover o device para um asset que pertence a outro customer, o customerId do device é atualizado automaticamente pelo service. Deixa eu  
 confirmar isso no código:

Resposta final consolidada:

┌────────────────────┬──────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
 │ Campo │ Protegido? │ Como alterar │ ├────────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ parentAssetId │ ✅ fora do UpdateAssetSchema │ POST /assets/:id/move com newParentAssetId │  
 ├────────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ customerId (asset) │ ✅ fora do UpdateAssetSchema │ POST /assets/:id/move com newCustomerId │
├────────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ assetId (device) │ ✅ fora do │ POST /devices/:id/move com newAssetId │  
 │ │ UpdateDeviceSchema │ │  
 ├────────────────────┼──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ customerId │ ✅ fora do │ Indireto — POST /devices/:id/move com um newAssetId que pertença ao novo customer. O service lê newAsset.customerId e passa para o repository automaticamente (linha 203 do │  
 │ (device) │ UpdateDeviceSchema │ DeviceService.ts) │  
 └────────────────────┴──────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
