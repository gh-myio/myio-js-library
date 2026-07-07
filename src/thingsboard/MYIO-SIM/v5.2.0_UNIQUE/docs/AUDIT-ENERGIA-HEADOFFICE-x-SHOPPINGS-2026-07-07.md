# Auditoria de Energia — Head Office (MYIO SIM UNIQUE) × Dashboards dos Shoppings

**Data do estudo:** 2026-07-07
**Período comparado:** 01/07/2026 00:00 → 07/07/2026 (mês corrente até o momento; período default dos dois lados)
**Método:** leitura ao vivo via Chrome DevTools (valores renderizados nos dashboards), com espera do enriquecimento de cada painel. Pequenos deltas (~0,1–1,5%) entre leituras são drift temporal — os dashboards foram lidos em sequência ao longo de ~30 min e o consumo cresce em tempo real.

## Dashboards auditados

| Dashboard | ID | Papel |
|---|---|---|
| Head Office - Sá Cavalcante - v.5.4.0 | `bf839840-7990-11f1-9875-9d92dab6711d` | Agregador (widget `MAIN_UNIQUE_DATASOURCE`) |
| Dashboard - Metrópole Ananindeua - v.5.2.0 | `aaa21b80-d6e9-11f0-998e-25174baff087` | Metrópole Pará |
| Dashboard - Rio Poty - v.5.2.0 | `d432db90-cee9-11f0-998e-25174baff087` | Rio Poty |
| Dashboard - Moxuara - v.5.2.0 | `4b53bbb0-b5a7-11f0-be7f-e760d1498268` | Moxuara |
| Dashboard - Shopping da Ilha - v.5.2.0 | `d2754480-b668-11f0-be7f-e760d1498268` | Shopping da Ilha |
| Dashboard - Montserrat - v.5.2.0 | `39e4ca30-b503-11f0-be7f-e760d1498268` | Mont Serrat |
| Dashboard - Mestre Álvaro - v.5.2.0 | `6c188a90-b0cc-11f0-9722-210aa9448abc` | Mestre Álvaro |

> Os atributos `customerDefaultDashboard` dos 6 customers foram verificados e apontam para os dashboards corretos.

## Mapeamento de colunas

Nos dashboards v-5.2.0 de cada shopping, a view de Energia tem 3 colunas de telemetria. A correspondência com as abas do Head Office (menu Energia) é:

| Coluna no shopping | Aba no Head Office (UNIQUE) | Contexto RFC-0111 |
|---|---|---|
| Entrada | — (sem aba própria; alimenta a aba "Geral (Energia)") | `energy.entrada` |
| **Área Comum** | **Energia > Equipamentos** (aba default) | `energy.equipments` |
| Lojas | Energia > Lojas | `energy.stores` |

## 1. Mapa por coluna — dashboards dos shoppings

Formato: `devices · consumo no período`.

| Shopping | Entrada | Área Comum | Lojas |
|---|---|---|---|
| Metrópole Pará | 1 · 168,679 MWh | 72 · 127,957 MWh | 162 · 57,683 MWh |
| Rio Poty | 1 · 249,863 MWh | 86 · 340,217 MWh | 181 · 97,788 MWh |
| Moxuara | 2 · 123,547 MWh | 58 · 24,628 MWh | 165 · 79,811 MWh |
| Shopping da Ilha | 2 · 282,929 MWh | 67 · 72,177 MWh | 231 · 141,521 MWh |
| Mont Serrat | 1 · 54,790 MWh | 33 · 62,922 MWh | 77 · 31,638 MWh |
| Mestre Álvaro | 1 · 121,551 MWh | 69 · 58,800 MWh | 187 · 59,860 MWh |
| **Σ (6 shoppings)** | **8 · 1.001,36 MWh** | **385 · 686,70 MWh** | **1.003 · 468,30 MWh** |

Medidores de entrada por shopping (nomes dos devices na coluna Entrada):

| Shopping | Devices de entrada (coluna Entrada do dashboard próprio) |
|---|---|
| Metrópole Pará | ENTRADA GERAL 126A |
| Rio Poty | ENTRADA GERAL (obs.: TRAFO 1 e TRAFO 2, com perfil ENTRADA, aparecem na coluna **Área Comum**) |
| Moxuara | MEDIÇÃO GERAL (TRAFO) + CAG-ENTRADA |
| Shopping da Ilha | GERAL ENTRADA + MEDIÇÃO GERAL CAG |
| Mont Serrat | SCMSL1_Geral_Entrada (REDE GERAL) |
| Mestre Álvaro | REDE GERAL ENTRADA (TRAFO) |

## 2. Leituras do Head Office

**Cards do header:** Equipamentos `375/387` · Consumo de Energia `1,316 GWh` · Média de Temperatura `24,2 °C` · Água `8.762,51 M³`

| Aba (menu Energia) | Conectividade | Total de devices | Consumo total | Sem consumo |
|---|---|---|---|---|
| Equipamentos (default) | 375/387 (96,9%) | **387** | **550,15 MWh** | 32 |
| Lojas | 1001/1009 (99,2%) | **1.009** | **467,95 MWh** | 34 |

Contagem do HO por shopping (classificação RFC-0111 no datasource do HO):

| Shopping | HO `equipments` | Shopping "Área Comum" | Δ | HO `stores` | Shopping "Lojas" | Δ |
|---|---|---|---|---|---|---|
| Metrópole Pará | 75 | 72 | **+3** | 162 (+1 lixo¹) | 162 | 0 |
| Rio Poty | 85 | 86 | **−1** | 182 | 181 | **+1** |
| Moxuara | 58 | 58 | 0 ✓ | 165 | 165 | 0 ✓ |
| Shopping da Ilha | 68 | 67 | **+1** | 231 | 231 | 0 ✓ |
| Mont Serrat | 32 | 33 | **−1** | 77 | 77 | 0 ✓ |
| Mestre Álvaro | 69 | 69 | 0 ✓ | 189 (+2 lixo¹) | 187 | **+2** |
| **Σ** | **387** | **385** | **+2** | **1.009** | **1.003** | **+6** |

¹ Devices de customers-lixo presentes no datasource do HO: "Mestre Álvaro - DELETAR" (×2) e "Metrópole Pará - Desativar" (×1).

O contexto `entrada` do HO tem apenas **3 devices** (Metrópole 1 + Rio Poty 2 trafos) contra **8 medidores reais** nas colunas Entrada dos shoppings — os demais não estão no datasource do HO ou não são classificados como entrada.

## 3. Resultados do batimento

### 3.1 Equipamentos — contagem (387 × 385, Δ +2)

As divergências por shopping (+3 Metrópole, +1 Ilha, −1 Mont Serrat, −1 Rio Poty) **quase se cancelam no agregado** — é diferença de *classificação por device* entre o datasource do HO e o de cada shopping, não de dados brutos. O −1 do Rio Poty tem relação com os TRAFO 1/2 (classificados como `entrada` no HO, mas exibidos em Área Comum no dashboard do shopping). Fechar os +3/+1/−1 restantes exige diff nominal por device (pendente).

### 3.2 Equipamentos — consumo (550,15 × 686,70 MWh, Δ −136,5)

A diferença é **dominada pelos TRAFO 1 + TRAFO 2 do Rio Poty (~128 MWh)**: contam na coluna Área Comum do shopping, mas no HO são `entrada` (fora da aba Equipamentos). Removendo-os da soma: `686,70 − 128 ≈ 558,7` vs `550,15` — o resíduo (~1,5%) é drift temporal + as pequenas diferenças de classificação da §3.1.

**Conclusão:** consistente, porém a classificação dos trafos do Rio Poty **diverge entre HO e shopping** e precisa ser padronizada (ou são entrada, ou são área comum — nos dois lugares).

### 3.3 Lojas — ✅ consumo bate; contagem +6 identificada

- **Consumo: 467,95 ≈ 468,30 MWh (Δ 0,07%)** — bate dentro do drift de leitura. ✅
- **Contagem (1.009 × 1.003):** +3 devices de customers-lixo (DELETAR/Desativar) + Mestre Álvaro +2 + Rio Poty +1.

### 3.4 Header "Consumo de Energia" (1,316 GWh)

Fecha internamente: `Equipamentos (550) + Lojas (468) + Entrada do HO (~296, 3 devices) ≈ 1.314 MWh`. O card não erra a conta — mas herda a **entrada subcontada** do HO (3 de 8 medidores).

## 4. Achado correlato — régua de metas (auditoria do mesmo dia)

O painel **Metas × Consumo** do HO usa medidores de ENTRADA como régua (metas GCDR são definidas contra a entrada). O batimento da entrada HO × dashboards próprios deu: Metrópole ✅, Mont Serrat ✅, Mestre Álvaro ✅, e **3 divergentes**:

| Shopping | Entrada no dashboard próprio | Entrada usada pelo HO (heurístico) | Causa |
|---|---|---|---|
| Rio Poty | ENTRADA GERAL (244+ MWh) | TRAFO 1 + TRAFO 2 (~128 MWh) | ENTRADA GERAL tem `profileId null` na Data API; heurístico do HO não o reconhece |
| Moxuara | MEDIÇÃO GERAL + CAG-ENTRADA | só MEDIÇÃO GERAL | "CAG-ENTRADA" é excluído pelo filtro anti-CAG |
| Shopping da Ilha | GERAL ENTRADA + MEDIÇÃO GERAL CAG | só GERAL ENTRADA | idem |

A curadoria de entrada é **inconsistente entre shoppings** (uns contam o medidor de entrada da CAG, outros não). Heurístico por nome/profile não reproduz; a correção robusta é curadoria explícita (ver §5).

## 5. Ações recomendadas

1. **Padronizar TRAFO 1/2 do Rio Poty** — decidir se são Entrada ou Área Comum e alinhar HO × shopping (impacta contagem e consumo de Equipamentos, e a régua de metas).
2. **Remover/filtrar devices de customers-lixo** ("Mestre Álvaro - DELETAR", "Metrópole Pará - Desativar") do datasource do HO — corrige +3 da contagem de Lojas.
3. ✅ **FEITO (2026-07-07)** — Curadoria explícita de entrada por shopping: attr SERVER_SCOPE **`entradaIngestionIds`** (array de ingestion ids) gravado nos 6 customers com os medidores canônicos identificados por batimento de consumo:
   - Metrópole Pará: `a062f80d-…` (ENTRADA SCMPAC-Entrada Geral)
   - Rio Poty: `d9a4be74-…` (SCRP Entrada Geral)
   - Moxuara: `fa7f68bc-…` (Trafo_Entrada_L2) + `0b3affff-…` (CAGEntrada)
   - Shopping da Ilha: `880660e7-…` (TrafoEntrada) + `96716b4f-…` (TrafoCAG/“MEDIÇÃO GERAL CAG”)
   - Mont Serrat: `439be1b5-…` (SCMSL1_Geral_Entrada)
   - Mestre Álvaro: `dd083df1-…` (Trafo Entrada Shopping)

   O controller (`getEntradaDevices`) passou a preferir o attr (fallback heurístico só p/ shoppings sem o attr), e a aba **Geral (Energia)** agora busca o total REAL de entrada no período (`refreshRealEntradaSummary` → `window.MyIOUtils.realEntrada`) e recalcula Área Comum + percentuais sobre ele (`buildEnergyPanelSummary`). Isso também corrige a régua do painel Metas × Consumo para Rio Poty/Moxuara/Ilha.
4. **Diff nominal por device** para os deltas residuais de contagem (Metrópole +3 equip, Ilha +1, Mont Serrat −1, Mestre Álvaro +2 lojas, Rio Poty +1 loja).
5. **Aba Geral (Energia) do HO**: hoje a "Entrada" usa só os 3 devices classificados no datasource (294 MWh vs ~1.000 reais), gerando percentuais sem sentido (Total Consumidores 340% da entrada, Área Comum 0,0). A ação 3 resolve; o layout (cards grandes, baixa densidade) é ajuste à parte.

## Apêndice — mapeamento TB customer ↔ nome

| Customer TB (id) | Shopping |
|---|---|
| `01369a40-d6ac-11f0-998e-25174baff087` | Metrópole Pará |
| `0c433230-cedd-11f0-998e-25174baff087` | Rio Poty |
| `5085bf40-b4dd-11f0-be7f-e760d1498268` | Moxuara |
| `209424d0-b04f-11f0-9722-210aa9448abc` | Shopping da Ilha |
| `bef16b70-a93c-11f0-afe1-175479a33d89` | Mont Serrat |
| `20b93da0-9011-11f0-a06d-e9509531b1d5` | Mestre Álvaro |
