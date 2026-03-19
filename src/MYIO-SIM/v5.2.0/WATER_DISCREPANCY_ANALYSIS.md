# Análise de Discrepância Water - ctx.data como Fonte de Verdade

**Data:** 2026-02-03

## Resumo

| Fonte | Dispositivos | Consumo |
|-------|--------------|---------|
| ctx.data (AllHidroDevices) | 497 | 199.646 m³ (acumulado) |
| waterClassified | 442 | - |
| API (response.json) | 520 | 10370.420 m³ |
| API após fetch (7 dias) | - | 6.754 m³ (último valor no log) |

## Contagem ctx.data

| Categoria | Quantidade |
|-----------|------------|
| waterClassified (lojas + área comum) | 442 |
| ignorados (entrada) | 14 |
| UNCLASSIFIED (problemas tipo) | 5 |
| **Sub-total conhecido** | **461** |
| ctx.data total | 497 |
| **Diferença não explicada** | **36** |

## Dispositivos por Profile na API

| Profile | Dispositivos | Consumo (m³) | Em ctx.data? |
|---------|--------------|--------------|--------------|
| HIDROMETRO | 409 | 4842.290 | ✅ Sim |
| HIDROMETRO_AREA_COMUM | 22 | 1925.870 | ✅ Sim |
| default | 86 | 3601.639 | ❌ Provavelmente não |
| N/A (sem profile) | 3 | 0.621 | ❌ Não |

## Dispositivos "default" (86) - Provavelmente fora do ctx.data


### Rio Poty (81 dispositivos, 2056.470 m³)

| Nome | Consumo (m³) |
|------|-------------|
| Device 248 | 49.810 |
| Device 303 | 6.720 |
| Device 275 | 1.000 |
| Device 254 | 0.440 |
| Device 255 | 0.140 |
| Device 277 | 0.240 |
| Device 261 | 0.010 |
| Device 312 | 2.650 |
| Device 288 | 1.600 |
| Device 301 | 2.950 |
| Device 271 | 0.100 |
| Device 302 | 1.500 |
| Device 306 | 0.530 |
| Device 314 | 0.000 |
| Device 267 | 1.110 |
| Device 250 | 550.110 |
| Device 281 | 0.060 |
| Device 268 | 0.480 |
| Device 310 | 21.740 |
| Device 246 | 90.100 |
| Device 283 | 0.600 |
| Device 245 | 4.460 |
| Device 258 | 0.030 |
| Device 244 | 4.860 |
| Device 289 | 2.220 |
| Device 305 | 0.000 |
| Device 270 | 0.000 |
| Device 308 | 0.000 |
| Device 264 | 0.310 |
| Device 285 | 0.150 |
| Device 256 | 0.000 |
| Device 293 | 18.130 |
| Device 272 | 0.040 |
| Device 313 | 0.000 |
| Device 262 | 0.090 |
| Device 287 | 3.930 |
| Device 290 | 2.760 |
| Device 249 | 2.220 |
| Device 269 | 15.510 |
| Device 252 | 0.680 |
| Device 274 | 0.510 |
| Device 296 | 3.940 |
| Device 253 | 0.120 |
| Device 299 | 11.020 |
| Device 247 | 71.870 |
| Device 279 | 1.520 |
| Device 311 | 4.760 |
| Device 265 | 4.490 |
| Device 259 | 0.060 |
| Device 263 | 1.510 |
| Device 294 | 14.450 |
| Device 307 | 1.360 |
| Device 298 | 12.370 |
| Device 286 | 0.050 |
| Device 260 | 2.220 |
| Device 297 | 8.670 |
| Device 300 | 3.300 |
| Device 266 | 1.110 |
| Device 321 | 58.210 |
| Device 291 | 0.120 |
| Device 276 | 0.270 |
| Device 280 | 0.150 |
| Device 304 | 2.220 |
| Device 292 | 0.090 |
| Device 273 | 1.260 |
| Device 282 | 0.230 |
| Device 284 | 1.910 |
| Device 322 | 0.000 |
| Device 323 | 50.620 |
| Device 324 | 154.080 |
| Device 325 | 0.140 |
| Device 326 | 630.580 |
| Device 251 | 13.000 |
| Device 309 | 20.020 |
| Device 257 | 6.910 |
| Device 315 | 0.870 |
| Device 316 | 59.470 |
| Device 317 | 23.530 |
| Device 318 | 19.770 |
| Device 319 | 70.520 |
| Device 320 | 11.890 |

### Moxuara (5 dispositivos, 1545.169 m³)

| Nome | Consumo (m³) |
|------|-------------|
| Hidr. Banheiro_Fem_L3 x10 | 56.320 |
| Hidr. Banheiro_L2 x10 | 62.630 |
| Hidr. shopping_principal x10 | 1378.650 |
| Hidr. Banheiro_Masc_L3 x10 | 46.580 |
| Hidr. SCMoxuaraBanheiroL4 | 0.989 |

## Dispositivos UNCLASSIFIED no Log

Estes dispositivos estão no alias AllHidroDevices mas têm problemas de tipo:

| Nome | Problema |
|------|----------|
| PASTEL LOCO | deviceType=3F_MEDIDOR, mas deviceProfile=HIDROMETRO |
| DELALÉ | deviceType=3F_MEDIDOR, mas deviceProfile=HIDROMETRO |
| CLIMEP | deviceType=3F_MEDIDOR, mas deviceProfile=HIDROMETRO |
| PLANET PARK | deviceType=3F_MEDIDOR, mas deviceProfile=HIDROMETRO |
| Polo Wear (RETIRAR DO DASHBOARD) | deviceProfile=HIDROMETRO_ARQUIVADO_OFFLINE |

## Regra de Negócio (igual à energia)

O `ctx.data` (ThingsBoard datasource AllHidroDevices) é a **fonte de verdade**. Dispositivos que existem na API mas não estão no datasource devem ser **descartados**.

### Ação já aplicada no código

O mesmo fix aplicado em ENERGY/controller.js foi aplicado em WATER/controller.js:

```javascript
// RFC-FIX: Get valid device IDs from orchestrator cache (devices that exist in ctx.data)
const waterClassified = window.MyIOOrchestratorData?.waterClassified;
const orchestratorItems = waterClassified?.all?.items || window.MyIOOrchestratorData?.water?.items || [];
const validIngestionIds = new Set();
orchestratorItems.forEach((item) => {
  if (item.ingestionId) validIngestionIds.add(item.ingestionId);
  if (item.id) validIngestionIds.add(item.id);
});

// Filter devices to only include those that exist in ctx.data
const devices = validIngestionIds.size > 0
  ? allDevices.filter((d) => validIngestionIds.has(d.id))
  : allDevices;
```

## Resumo

- **86 dispositivos "default"** da API (3.601 m³) provavelmente não estão em ctx.data
- **5 dispositivos UNCLASSIFIED** têm problemas de configuração (deviceType incorreto)
- **14 dispositivos entrada** são corretamente ignorados
- O header e gráfico devem mostrar apenas dispositivos que existem em ctx.data
