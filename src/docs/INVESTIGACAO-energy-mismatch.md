# Investigação — Mismatch de consumo (energy) no AllReportModal

> Data: 2026-05-21 · Cliente: **Campinas Shopping** · Grupo: **Lojas** (energy)
> Componente: `src/components/premium-modals/report-all/AllReportModal.ts`

## Contexto

Suspeita reportada: *"consumo zero não está sendo considerado"* no painel de
relatório (AllReportModal). O relatório de Lojas mostra **20 lojas com consumo
`0 kWh`**, mas várias dessas lojas claramente consomem energia.

## Evidências analisadas

| Arquivo | O que é |
|---------|---------|
| `logs/campinas-shopping-lojas-20260521-1609.csv` | Saída do relatório (70 lojas, 20 com `0`) |
| `logs/responseAllReports-campinas.json` | Resposta da API de totais (202 devices: 112 energy + 90 water) |
| API | `GET /telemetry/customers/73d4c75d-.../energy/devices/totals?startTime=2026-05-01T00:00:00-03:00&endTime=2026-05-21T23:59:59-03:00&granularity=1d` |

Período: **01/05/2026 → 21/05/2026**.

## TL;DR do diagnóstico

**O `AllReportModal.ts` NÃO está descartando zeros — ele está reportando
fielmente o que recebe.** O problema é de **identidade de device**: a `id`
(ingestionId) que o orquestrador passa para essas lojas aponta para um device
**duplicado/morto** (total_value 0, sem telemetria), enquanto o medidor real
— com consumo — é outro device, com `id` diferente, que não entra no filtro.

- **19 das 20 lojas-zero** do relatório têm consumo real > 0 na API.
- Consumo não contabilizado nessas 19 lojas: **≈ 24.006 kWh**.
- Total do relatório: `56.480 kWh` → subreporta **~30%** só nas lojas-zero.

---

## A. Lojas com `0` no relatório mas consumo REAL na API

Cruzamento feito por código SCP embutido no `name` do device da API
(`"3F SCP0Q005 Bob's G1"`) e por nome da loja.

| # CSV | Loja | Identificador (CSV) | Relatório | API (total_value) |
|-------|------|---------------------|-----------|-------------------|
| 51 | ACIUM 01 | `SCP0Q006` | **0** | 277,0 |
| 52 | DiGaspi | `5d344a31-…` (UUID) | **0** | 6.217,1 |
| 53 | Doce Mimo | `N/A` | **0** | 95,4 |
| 54 | Gi Celulares | `SCP0Q011` | **0** | 24,1 |
| 55 | Global 4 | `SCP0Q252` | **0** | 138,7 |
| 56 | Gold Spell | `SCP0Q025` | **0** | 21,3 |
| 57 | Kalunga1 | `SCP00434` | **0** | 3.698,8 |
| 58 | Kids Race | `SCP0Q043` | **0** | 45,1 |
| 59 | Lojas Americanas | `SCP00601` | **0** | 3.438,3 |
| 60 | London Bus | `SCP0Q022` | **0** | 53,7 |
| 61 | Love Case | `SCP0Q004` | **0** | 50,2 |
| 62 | Lupo | `SCP00110` | **0** | 382,1 |
| 63 | Makibela 02 | `SCP00405` | **0** | 1.937,0 |
| 64 | Massage Express | `SCP0Q205` | **0** | 28,3 |
| 66 | Pernambucanas | `SCP00055` | **0** | 6.975,1 |
| 67 | Piticas | `SCP0Q013` | **0** | 112,9 |
| 68 | QDonuts | `SCP0Q041` | **0** | 150,0 |
| 69 | Showcolate | `SCP0Q111` | **0** | 261,2 |
| 70 | Touti | `SCP0Q039` | **0** | 99,5 |

> Única loja-zero legítima: **#65 Narducci** (`SCP0D001`) — sem device com
> consumo correspondente na API. Confirmar se está realmente inativa.

## B. Lojas com valor DIVERGENTE (relatório > 0 e API > 0)

| # CSV | Loja | Relatório | API | Observação |
|-------|------|-----------|-----|------------|
| 4  | Makibela 01 | 3.885,2 | 5.822,2 | API tem **2 devices** p/ o código — relatório pegou só 1 |
| 9  | Rei Do Mate - Mar-2026 | 1.572,7 | 655,7 | relatório **maior** que a API |
| 11 | Burguer King | 847,8 | 1.285,3 | API tem **2 devices** |
| 30 | Loccitane | 112,9 | 150,0 | |
| 39 | We Pink | 57,1 | 21,3 | relatório maior que a API |
| 42 | Key Master G2 | 48,8 | 0,9 | relatório maior que a API |
| 48 | Boticário | 18,7 | 134,3 | |

> Casos onde "relatório > API" sugerem que o relatório casou com **outro**
> device (homônimo/duplicado) que não o do mesmo período.

## C. Lojas sem device casado pela heurística

⚠️ **Esta lista é limitada pela heurística de cruzamento** (o `name` da API
usa placeholders como `SCP0Qxxx` e variações de código `SCP00055` vs
`SCP0L00055`). Várias destas **existem** na API — apenas não casaram
automaticamente. Não tratar como "ausentes confirmadas".

| # CSV | Loja | Identificador | Relatório |
|-------|------|---------------|-----------|
| 3  | Maravilha Do Lar E2 | `SCP00001_E2` | 5.737,6 |
| 6  | Maravilha Do Lar E1 | `SCP00001_E2` | 2.135,7 |
| 14 | Acquazero | `SCP0Q034` | 736,2 |
| 22 | Kopenhagen G1 | `N/A` | 317,3 |
| 29 | Banco 24h T | `SCP0Q008` | 115,5 |
| 46 | M480 | `N/A` | 29,0 |
| 49 | KFC G1 | `N/A` | 5,3 |
| 65 | Narducci | `SCP0D001` | 0 |

---

## Causa raiz

### O código (`mapCustomerTotalsResponse`, AllReportModal.ts:873)

```ts
for (const apiItem of apiArray) {
  const apiId = String(apiItem?.id || '');
  if (!apiId || !orchIdSet.has(apiId)) continue; // descarta: fora do grupo
  const consumption = Math.round(this.pickConsumption(apiItem) * 100) / 100;
  rows.push({ identifier: meta?.identifier ..., name: meta?.label ..., consumption });
}
```

- O join é por **`id`** (UUID): `StoreItem.id` (ingestionId do orquestrador)
  × `apiItem.id` (device da API).
- Uma loja aparece com `0` quando o device casado **tem `total_value: 0`** na
  API. O modal não inventa o zero — ele copia o `total_value` do device que
  casou.

### Por que o device casado tem 0

Há **devices duplicados** no ThingsBoard para a mesma loja. Exemplo
confirmado — **Touti** (`SCP0Q039`) tem **2 devices energy** na API:

| device id | total_value | lastTelemetryTs |
|-----------|-------------|-----------------|
| `47d48756…` | **0** | `null` (nunca enviou telemetria) |
| (outro) | 99,5 | (com telemetria) |

O `ingestionId` que o orquestrador associa à loja Touti aponta para o
device **morto** (`47d48756`, total_value 0). O medidor real (99,5) tem
outro `id` e nunca entra no `orchIdSet`.

A API tem **12 devices energy com `total_value: 0`**, e 6 deles com
`lastTelemetryTs: null` — clássicos registros duplicados/órfãos:

```
3F Relógio 302136207 (Entrada Detran)   ts=null
Repetidor Rihappy                       ts=null
3F SCP0Q039 Touti                       ts=null
Device 26 / Device 21                   ts=null
3F SCP0QXXX Premier                     ts=null
3F SCP0L00303 KFC / SCP0QM006 NXT / SCP0Q023 Pandora / …  (ts antigo, ago/2025)
```

### Conclusão da causa raiz

O bug **não é do AllReportModal** — é de **identidade de device**:
o `ingestionId` gravado no device do TB (ou o mapeamento do orquestrador)
aponta para o **device duplicado/stale** em vez do medidor ativo. Isso conecta
diretamente com o trabalho de **Sync Ingestion ID** / GCDR (match por
`centralId + slaveId`): se o `ingestionId` está stale, todo o pipeline
downstream (relatório incluso) reporta o device errado.

---

## Recomendações

### Curto prazo — dados (corrige o sintoma)
1. Para as 19 lojas da seção A, re-rodar o **Sync Ingestion ID** (modal Upsell)
   para reapontar o `ingestionId` ao device ativo (match `centralId+slaveId`).
2. Limpar/desativar os devices duplicados-mortos no TB (os 6 com `ts=null`).

### Médio prazo — AllReportModal (torna o sintoma visível)
O modal hoje é silencioso quando o join falha ou casa device-zero. Sugestões:
1. **Iterar por `itemsList`** (devices do orquestrador), não pelo `apiArray`.
   Para cada item, buscar o `apiItem` por `id`; se ausente → linha com `0` +
   flag de "sem dado". Hoje devices do orquestrador ausentes da API somem
   silenciosamente.
2. Emitir um **aviso de diagnóstico** (log/contador) quando uma loja casar com
   device de `total_value 0` **e** `lastTelemetryTs` nulo/antigo — forte
   indício de `ingestionId` apontando para duplicado.
3. Opcional: detectar SCP code duplicado na resposta da API e sinalizar.

### Investigação adicional necessária
- Confirmar a hipótese com a `itemsList` real do orquestrador (id ↔ identifier
  ↔ label) — não disponível nos logs deste mapa, o cruzamento aqui foi por
  código SCP/nome (heurístico).

---

## Metodologia (como reproduzir o cruzamento)

```js
// 1. Carregar API + CSV
// 2. energy = data.filter(d => d.deviceType === 'energy')   → 112 devices
// 3. Para cada linha do CSV, extrair o código SCP do name da API
//    ("3F SCP0Q005 Bob's G1" → SCP0Q005) e casar com o Identificador do CSV
// 4. Comparar consumo (CSV) × total_value (API)
// 5. Flag: CSV==0 && API>0  → loja-zero indevida
```

> Limitação: o join real do produto é por `id` (UUID/ingestionId). Este mapa
> usou código SCP + nome como proxy porque os logs não trazem a `itemsList`
> do orquestrador. Os valores da API são exatos; o pareamento loja↔device
> é aproximado e deve ser confirmado pelos `id`s reais.
