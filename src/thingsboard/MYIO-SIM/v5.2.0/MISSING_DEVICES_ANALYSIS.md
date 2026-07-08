# Análise de Dispositivos - ctx.data como Fonte de Verdade

**Data:** 2026-02-03

## Resumo

| Métrica | Valor |
|---------|-------|
| Header (ctx.data) | 679.513 MWh ✅ |
| Gráfico (antes do fix) | 691.27 MWh ❌ |
| **Diferença corrigida** | **11.757 MWh** |

## Regra de Negócio

O `ctx.data` (ThingsBoard datasource) é a **fonte de verdade**. Dispositivos que existem na API mas não estão no datasource devem ser **descartados**.

## Dispositivos Descartados (Correto)

### 3F_MEDIDOR (45 dispositivos, 12.635 MWh)

Esses dispositivos existem na API mas **não estão configurados** no Entity Alias `Equipamentos e Lojas` do ThingsBoard. Eles são **corretamente descartados**.

| Nome | Shopping | Consumo (kWh) |
|------|----------|---------------|
| 3F SCMT208D | Metrópole Pará | 7160.23 |
| 3F SCMOXUARA209JKL2 | Moxuara | 1288.92 |
| 3F SCRPCM06 | Rio Poty | 757.96 |
| 3F SCMTQ308B | Metrópole Pará | 358.12 |
| 3F SCRP309GHI | Rio Poty | 342.42 |
| 3F SCMTQ102 | Metrópole Pará | 307.64 |
| 3F SCMTQ308 | Metrópole Pará | 221.63 |
| 3F SCRP304BC | Rio Poty | 190.40 |
| 3F SCMoxuara207i | Moxuara | 181.66 |
| 3F SCRP308DE | Rio Poty | 168.93 |
| 3F SCRP211D | Rio Poty | 164.23 |
| 3F SCRP401A1 | Rio Poty | 161.45 |
| 3F SCMS207D_L2 | Mont Serrat | 142.94 |
| 3F SCMAL3L4306FG | Mestre Álvaro | 140.44 |
| 3F SCMAL3L4308ABCDE | Mestre Álvaro | 111.97 |
| 3F SCMAL2ACD210D | Mestre Álvaro | 108.09 |
| 3F SCMTQ108B | Metrópole Pará | 103.18 |
| 3F SCMOXUARA104ABL1 | Moxuara | 94.12 |
| 3F SCRP408BCDE | Rio Poty | 85.09 |
| 3F SCRP406F | Rio Poty | 61.89 |
| 3F SCMAL3L4304J | Mestre Álvaro | 51.71 |
| 3F SCMAL3L4304KLMN | Mestre Álvaro | 49.89 |
| 3F SCRP210F | Rio Poty | 38.77 |
| 3F SCRP108E | Rio Poty | 37.48 |
| 3F SCRP210C | Rio Poty | 32.60 |
| 3F SCMAL3L4306F | Mestre Álvaro | 32.29 |
| 3F SCMAL3L4Q315 | Mestre Álvaro | 31.01 |
| 3F SCSDI103A/B | Shopping da Ilha | 29.76 |
| 3F SCMAL2ACCM210HI | Mestre Álvaro | 28.35 |
| 3F SCRPAC-CasaAR17 | Rio Poty | 25.98 |
| 3F SCRP415JK | Rio Poty | 23.95 |
| 3F SCRP408A | Rio Poty | 20.34 |
| 3F SCRP415F | Rio Poty | 19.27 |
| 3F SCMAL3L4Q314 | Mestre Álvaro | 18.78 |
| 3F SCMAL3L4313A | Mestre Álvaro | 12.06 |
| 3F SCRP415B | Rio Poty | 10.23 |
| Q102 Oficial | Mestre Álvaro | 7.40 |
| 3F SCMAL2ACdoutormassagem | Mestre Álvaro | 6.33 |
| 3F SCMSAC-BI_Grande | Mont Serrat | 5.25 |
| 3F SCMADPChiquinho_L1 | Mestre Álvaro | 1.26 |
| 3F SCMALoscompadres_L1 | Mestre Álvaro | 0.80 |
| 3F SCMSAC_BI_Jockey | Mont Serrat | 0.29 |
| 3F ESRL. Sem definição | Mestre Álvaro | 0.00 |
| 3F SCMAL0L1Q113_2 | Mestre Álvaro | 0.00 |
| 3F SCMAL2AC213A | Mestre Álvaro | 0.00 |

## Fix Aplicado

### Antes
- Header usava ctx.data → 679.513 MWh ✅
- Gráfico usava API direta → 691.27 MWh ❌ (incluía 45 dispositivos extras)

### Depois
- Header usa ctx.data → 679.513 MWh ✅
- Gráfico agora filtra pela lista de ctx.data → ~679.5 MWh ✅

### Código Alterado

**ENERGY/controller.js** - `fetchPeriodConsumptionByDay`:
```javascript
// RFC-FIX: Get valid device IDs from orchestrator cache (devices that exist in ctx.data)
const orchestratorItems = window.MyIOOrchestratorData?.energy?.items || [];
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

**WATER/controller.js** - `fetchWaterPeriodConsumptionByDay`:
- Mesmo fix aplicado para consistência

## Resumo Total de Dispositivos Descartados

| Profile | Dispositivos | Consumo | Status |
|---------|--------------|---------|--------|
| ENTRADA | 10 | 560.400 MWh | ✅ Corretamente filtrado pelo código |
| default | 9 | 132.121 MWh | ✅ Corretamente filtrado (nomes ENTRADA) |
| 3F_MEDIDOR | 45 | 12.635 MWh | ✅ Corretamente descartado (não em ctx.data) |
| N/A | 7 | 0.734 MWh | ✅ Descartado (sem metadata) |
| HIDROMETRO | 8 | 0.000 MWh | ✅ Descartado (domain errado) |
| **TOTAL** | **79** | **705.890 MWh** | ✅ |
