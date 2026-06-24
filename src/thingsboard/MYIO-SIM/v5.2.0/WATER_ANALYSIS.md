# Análise de Dispositivos de Água (Water)

**Data:** 2026-02-03

## Resumo Geral

| Métrica | Valor |
|---------|-------|
| Total de dispositivos (API) | 523 |
| Dispositivos de água | 520 |
| Consumo total de água | 10370.420 m³ |

## Por Profile

| Profile | Dispositivos | Consumo (m³) | % |
|---------|--------------|--------------|---|
| HIDROMETRO | 409 | 4842.290 | 46.7% |
| default | 86 | 3601.639 | 34.7% |
| HIDROMETRO_AREA_COMUM | 22 | 1925.870 | 18.6% |
| N/A (sem profile) | 3 | 0.621 | 0.0% |
| **TOTAL** | **520** | **10370.420** | **100%** |

## Por Shopping

| Shopping | Dispositivos | Consumo (m³) |
|----------|--------------|--------------|
| Metrópole Pará | 98 | 2744.360 |
| Shopping da Ilha | 102 | 2502.010 |
| Rio Poty | 84 | 2056.780 |
| Moxuara | 84 | 2046.700 |
| Mestre Álvaro | 94 | 785.481 |
| Mont Serrat | 58 | 235.089 |

## Contextos de Água

| Contexto | ProfileId | Dispositivos | Consumo (m³) |
|----------|-----------|--------------|--------------|
| Lojas (HIDROMETRO) | 526275a7-55cd-4e40-a9b8-0b08b7db6cdc | 409 | 4842.290 |
| Área Comum | a538da0d-fbef-4e1a-b753-7f64fe40d18a | 22 | 1925.870 |
| Entrada | - | 0 | 0.000 |
| Outros | - | 89 | 3602.260 |

## Observações

- O profileId **526275a7-55cd-4e40-a9b8-0b08b7db6cdc** é usado para HIDROMETRO (lojas)
- Similar à energia, devices com profile "default" podem precisar ser descartados
- Devices HIDROMETRO_ENTRADA são análogos aos ENTRADA de energia
