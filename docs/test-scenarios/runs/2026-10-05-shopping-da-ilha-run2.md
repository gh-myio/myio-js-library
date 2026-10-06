# TS-001 — Execução 2 (2026-10-05, tarde) — Shopping da Ilha

> Cenário: [TS-001](../TS-001-shopping-v520-dashboard-e-relatorios.md) · Execução anterior: [run 1](./2026-10-05-shopping-da-ilha.md)
> Objetivo extra: validar o fallback da API de temperatura (`temperatureApiFallbackThresholdPercent`, padrão 90%) já publicado no MAIN_VIEW.

## Parâmetros

| Campo | Valor |
|---|---|
| Dashboard | `Dashboard - Shopping da Ilha - v.5.2.0` (`d2754480-b668-11f0-be7f-e760d1498268`), aberto direto pela URL |
| Lib | 0.1.547 |
| Período | 01/10/2026 00:00 → 05/10/2026 23:59 (valores maiores que na run 1 porque o dia 05 avançou) |
| MAIN_VIEW | com o fallback publicado (`window.MyIOUtils.temperatureApiFallback` presente) |

## Carregamento

| Métrica | Run 1 | Run 2 |
|---|---|---|
| Totais de energia disponíveis | ~26 s | **33,7 s** |
| Última requisição da carga | 49,5 s | **47,5 s** |
| Requisições de API | 516 | 529 |
| Falhas HTTP | 0 | 0 |
| Erros de console | 1 (`ctx.data timeout`) | 1 (o mesmo) |
| Atributos SERVER_SCOPE por device | 469 | **468** (soma 105 s) |
| `energy/devices/totals` duplicado | 2× (~13,5 s) | **2×** (soma 33,4 s) |

## Relatórios

| # | Relatório | Tempo (s) | Dispositivos | Total relatório | Total dashboard | Δ | Resultado |
|---|---|---|---|---|---|---|---|
| 1 | ⚡ Entrada | 17,6 *(1ª chamada, API 17,5 s)* | 2 | 222.165,54 kWh | 222.165,54 | 0,00% | ✅ |
| 2 | ⚡ Área Comum | 3,7 | **66** | 61.559,21 kWh | 61.559,20 (67) | 0,00% | ⚠️ F4 (CM AR 4) |
| 3 | ⚡ Lojas | 3,6 | 231 | 105.056,37 kWh | 105.056,35 | 0,00% | ✅ |
| 4 | ⚡ Todos | 3,2 | 299 | 388.781,12 kWh | soma 388.781,09 | 0,00% | ⚠️ F3 |
| 5a | 💧 Entrada **antes** de abrir a aba Água | 11,9 | 0 | "Nenhum dado encontrado" | 1.751,80 | — | ❌ F2 |
| 5 | 💧 Entrada | 1,6 | 2 | 1.751,80 m³ | 1.751,80 | 0,00% | ✅ |
| 6 | 💧 Área Comum | 1,5 | 4 | 220,29 m³ | 220,29 | 0,00% | ✅ |
| 7 | 💧 Lojas | 1,5 | 89 | 570,51 m³ | 570,518 | 0,00% | ✅ |
| 8 | 💧 Todos | 1,6 | 95 | 2.542,60 m³ | soma 2.542,61 | 0,00% | ⚠️ F3 |
| 9 | 🌡️ Climatizáveis | 3,6 | 16 | **0,00 °C** | 24,44 °C | 100% | ❌ F1 |
| 10 | 🌡️ Não Climatizáveis | 2,0 | 0 | "Nenhum dado encontrado" | 0 dispositivos | — | ✅ coerente |
| 11 | 🌡️ Todos | 1,0 | 16 | **0,00 °C** | 24,44 °C | 100% | ❌ F1 |
| — | 🔔 Alarmes (3) | — | — | — | — | — | 🔒 desabilitados |

Nenhuma falha HTTP e nenhum erro de console durante os relatórios. Os achados F1–F4 da run 1 continuam.

## Fallback da API de temperatura

| Cenário | Problemas | Resultado observado |
|---|---|---|
| Normal (API real) | 2/16 (12,5% < 90%) | ✅ sem fallback: `enableTemperatureApiDataFetch = true`, `temperatureApiFallback = null`, 14 sensores com `lastTelemetryTs` da API |
| API simulada com HTTP 500 (`window.fetch` interceptado só na aba de teste) + `hydrateDomain('temperature')` | 16/16 (100% ≥ 90%) | ✅ fallback ativo: `enableTemperatureApiDataFetch = false`, `temperatureApiFallback = { active: true, problems: 16, queried: 16, problemPct: 100, threshold: 90 }`, 16 sensores mantidos com dados do ThingsBoard (média 24,44 °C), 0 com `lastTelemetryTs` da API; console: `RFC-0189: API fallback — 16/16 devices with problems (100% >= 90%)…` |
| API restaurada + nova carga (após o cache de 30 s) | 2/16 | ✅ recuperou sozinho: flag `true`, `temperatureApiFallback = null`, 14 sensores com `lastTelemetryTs` |

**Observação de teste:** o botão "Carregar" do HEADER não refez a carga de temperatura dentro dos 30 s de cache do orquestrador; a recarga foi forçada com `MyIOOrchestrator.hydrateDomain('temperature', período)`.

Não verificado nesta execução: a abertura do modal de temperatura de um card durante o fallback (deve usar a fonte do ThingsBoard, porque o TELEMETRY lê `window.MyIOUtils.enableTemperatureApiDataFetch` no clique).
