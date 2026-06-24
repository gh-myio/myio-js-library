# GoalsPanel — Estrutura de Dados das Metas de Consumo

> Componente: `src/components/GoalsPanel.js` · export `openGoalsPanel(params)` (RFC-0075).
> Modal de configuração de **metas de consumo** (energia/água) por **ano**, com
> distribuição **mensal** e — desde a extensão de granularidade — **diária** (importação
> por planilha). Granularidade **horária** está prevista (UI "em breve"), ainda não persistida.

---

## 1. Como o componente é aberto

```js
window.MyIOLibrary.openGoalsPanel({
  customerId,          // (obrigatório) Customer ThingsBoard (Holding)
  token,               // JWT do TB (obrigatório quando não usa `data` mock)
  api: { baseUrl },    // base da API do TB
  data,                // (opcional) JSON de metas inicial — ver §2
  shoppingList: [{ value, name }],  // shoppings filhos (UUID + nome)
  onSave: async (goalsData) => { /* persistir o JSON — ver §2 */ },
  onClose,
  locale: 'pt-BR',
  entityLabel: 'Shopping',
});
```

O componente **não decide o storage**. Ele monta/edita o JSON e entrega tudo via
`onSave(goalsData)` — quem chama grava (atributo SERVER_SCOPE no TB, API GCDR, etc.).

---

## 2. Estrutura de dados armazenada (`goalsData`)

O objeto raiz persistido/recebido em `data` e devolvido em `onSave`:

```jsonc
{
  "version": 3,                 // incrementado a cada save (otimista)
  "history": [                  // trilha de alterações (mais recente primeiro)
    {
      "tag": "2026-06-18T19:24:13.123Z|user",
      "reason": "Manual update from Goals Panel",
      "diff": { "year": 2026, "changed": ["manual_update"] }
    }
  ],
  "years": {                    // metas indexadas por ANO (string)
    "2026": {
      "annual": { "total": 1200000, "unit": "kWh" },   // meta anual + unidade ("kWh" | "m3")
      "monthly": {              // distribuição mensal — chave "01".."12"
        "01": 100000,
        "02": 95000
        // ... meses sem valor simplesmente não aparecem (esparso)
      },
      "granularity": "month",   // "month" | "day"  (origem da meta) — ver §3
      "daily": {                // (opcional) detalhe diário — só quando granularity = "day"
        "2026-01-01": 3200,
        "2026-01-02": 3100
        // ... chave ISO "YYYY-MM-DD" (esparso)
      },
      "assets": {               // metas por ASSET (aba "Assets")
        "<assetTbId>": {
          "label": "Chiller 1",
          "annual": { "total": 50000, "unit": "kWh" },
          "monthly": { "01": 4200 }
        }
      },
      "metaTag": "2026-06-18T19:24:13.123Z|user"   // <ISO>|<autor> da última escrita do ano
    }
  }
}
```

### Campos

| Caminho | Tipo | Descrição |
| --- | --- | --- |
| `version` | int | Versão do documento; incrementa a cada `save`. |
| `history[]` | array | Append-only (unshift). Cada item: `tag` (`<ISO>\|user`), `reason`, `diff`. |
| `years["<ano>"].annual.total` | number | Meta **anual** do ano. |
| `years["<ano>"].annual.unit` | string | `"kWh"` (energia) ou `"m3"` (água). |
| `years["<ano>"].monthly` | object | Mapa **esparso** `"01".."12"` → valor. **Sempre presente** (é a visão canônica). |
| `years["<ano>"].granularity` | string | `"month"` (padrão) ou `"day"`. Indica a **fonte** da meta. |
| `years["<ano>"].daily` | object | **Opcional**. Mapa esparso `"YYYY-MM-DD"` → valor. Presente só quando `granularity = "day"`. |
| `years["<ano>"].assets` | object | Metas por asset: `{ <tbId>: { label, annual, monthly } }`. |
| `years["<ano>"].metaTag` | string | `<ISO>\|<autor>` da última gravação daquele ano. |

> **Esparso por design:** `monthly`/`daily` só guardam as chaves preenchidas — quem não
> tem meta não ocupa espaço. Mês = até 12 chaves; Dia = até 365/366 chaves por ano/entidade.

---

## 3. Granularidade (Mês | Diária | Hora "em breve")

A modal tem um **seletor de granularidade**. A **grade de 12 meses é sempre a visão canônica**
e editável; a diária entra por **importação de planilha** e é **agregada para o mensal**.

| Granularidade | Como entra | O que persiste |
| --- | --- | --- |
| **Mês** (padrão) | Edição direta na grade de 12 meses **ou** import CSV mensal | `monthly{}` (12), `granularity:"month"` |
| **Diária** | Import CSV diário (365/366 linhas) | `daily{}` (detalhe) **+** `monthly{}` (re-agregado por soma) **+** `granularity:"day"` |
| **Hora** | UI exibida como **"em breve"** (desabilitada) | — (não persistido) |

Regras:
- Ao importar **diário**, os valores são **somados por mês** e gravados em `monthly{}` (assim
  as views/relatórios mensais existentes continuam funcionando), e o detalhe fica em `daily{}`.
- No modo **Diária**, a grade mensal fica **read-only** (deriva do detalhe) — edita-se via planilha.
- O `total` anual é sincronizado com a soma quando ainda está zerado.
- **Retrocompat:** documentos antigos sem `granularity`/`daily` continuam válidos — são tratados
  como `month` (a ausência do campo equivale a `"month"`).

---

## 4. Templates CSV (download/upload)

Os templates são **CSV** (não XLSX) — sem dependência externa, abrem no Excel (BOM UTF-8).
Um arquivo por granularidade, gerado **para o ano selecionado** (respeita ano bissexto):

**Mensal** (`metas-mensal-<ano>.csv`):
```
mes;valor
2026-01;100000
2026-02;95000
...
2026-12;0
```

**Diário** (`metas-diaria-<ano>.csv`):
```
data;valor
2026-01-01;3200
2026-01-02;3100
...
2026-12-31;0
```

Parsing do upload aceita decimal pt-BR (`1.234,56`) e ponto (`1234.56`); valida contagem
de linhas (12 ou 365/366), datas dentro do ano e valores ≥ 0, citando a linha em erro.

---

## 5. Limites e cuidados de persistência

- **Mês** (≤12 valores/ano/entidade): trivial — cabe em qualquer atributo.
- **Diária** (≤365/366 valores/ano/entidade): aceitável, mas com **N entidades** o JSON cresce;
  confirmar o limite de tamanho do atributo SERVER_SCOPE do TB ao persistir muitas entidades.
- **Hora** (8.760/ano/entidade): **não persistir inline** — estouraria o atributo; quando
  implementada, o detalhe horário deve ir para blob/telemetria separada, não para o JSON de metas.

---

_Componente: `src/components/GoalsPanel.js`. Última atualização: 2026-06-18._
