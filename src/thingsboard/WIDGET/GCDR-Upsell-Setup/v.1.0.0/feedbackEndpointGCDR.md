Resposta direta: listas separadas (flat). Devices não são aninhados dentro dos assets.

---

Estrutura da resposta com ?deep=1  
 {  
 "success": true,
"data": {
"customer": { "id": "...", "name": "Helexia", ... },

      "assets": [
        { "id": "asset-1-uuid", "name": "Bloco A", "type": "BUILDING", "parentAssetId": null, ... },
        { "id": "asset-2-uuid", "name": "Lab 01",  "type": "ROOM",     "parentAssetId": "asset-1-uuid", ... },
        { "id": "asset-3-uuid", "name": "Lab 02",  "type": "ROOM",     "parentAssetId": "asset-1-uuid", ... }
      ],

      "devices": [
        { "id": "dev-1-uuid", "name": "Medidor Lab 01", "assetId": "asset-2-uuid", ... },
        { "id": "dev-2-uuid", "name": "Medidor Lab 02", "assetId": "asset-3-uuid", ... }
      ]
    }

}

---

Como montar a árvore em memória

// 1. Indexar assets por id
const assetMap = new Map(data.assets.map(a => [a.id, { ...a, children: [], devices: [] }]));

// 2. Indexar devices por assetId
for (const device of data.devices) {
assetMap.get(device.assetId)?.devices.push(device);
}

// 3. Montar hierarquia de assets (parent → children)
const roots: Asset[] = [];
for (const asset of assetMap.values()) {
if (asset.parentAssetId) {
assetMap.get(asset.parentAssetId)?.children.push(asset);
} else {
roots.push(asset);
}
}

// roots = árvore completa com devices já nos seus respectivos assets

Observação importante: com ?deep=1, assets sem nenhum device são filtrados automaticamente pelo backend — assets já retorna apenas os que têm pelo menos um device associado.
