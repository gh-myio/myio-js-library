# Mapa — Duplicação de "Bombas Hidráulicas" (subcategorias de Climatização)

> **Contexto:** a string `"Bombas Hidráulicas"` (e as demais subcategorias de
> Climatização: Chillers, Fancoils, CAG, Outros HVAC) aparece repetida em vários
> arquivos. Este documento mapeia **onde**, **por quê** e **como consolidar**.

**Última atualização:** 2026-06-23 · **Domínio:** Energy → Climatização (breakdown)

> **STATUS — resolvido por design (2026-06-23).** A solução desta duplicação foi
> consolidada no **RFC-0207** (ver `rfcs/RFC-0207-CustomerScopedDeviceClassificationProfile.md`,
> **§ Addendum — RFC-0207 v3 (FINAL)**), após a série de feedback GCDR v1→v5 + MyIO-Lib v4.
> Em resumo: **motor de classificação em código (golden, group-generic, tier-1+tier-2)**
> × **árvore declarativa em dado (labels/ícones/membership)** atrás de um `ProfileSource`
> trocável; a **tabela única `{key,name,icon,match}`** proposta abaixo vira o **baked
> default versionado** do v3 (com `name`/`icon` migrando para o GCDR/RFC-0047 só na fase
> condicional v3.2). Este documento permanece como o **mapa do problema**; o **como** está no RFC.
> A série de feedback (GCDR v1→v5 + MyIO-Lib v4) foi **compilada no RFC e removida**.

---

## TL;DR

A string aparece repetida porque há **três responsabilidades diferentes**
espalhadas, **sem uma fonte única** — e ainda por cima há **código duplicado
SIM ↔ WIDGET**:

1. **A regra** (quais devices são "bomba"): existe inline em `MAIN_VIEW` **e** em
   `MYIO-SIM/MAIN` (duplicada), **e** uma terceira versão diferente em
   `equipmentCategory.js` (que ninguém chama).
2. **O nome de exibição** (`'Bombas Hidráulicas'`): passado como argumento nos
   controllers (vira `details.name`) **e** redigitado no consumidor.
3. **O ícone** (`💧`): só existe no consumidor (TELEMETRY_INFO).

---

## Ocorrências

São 4 lugares. Cada bloco abaixo: **arquivo → o que faz → usa o quê → status**.

### 1. `src/utils/equipmentCategory.js` — `classifyEquipmentSubcategory()` (~L172)

- **O que faz:** regra + nome canônicos (`BOMBA` e não `INCENDIO` → `'Bombas Hidráulicas'`).
- **Usa:** `deviceType` / `deviceProfile` / `identifier`.
- **Status:** ⚠️ exportado na lib (`src/index.ts`), mas **NÃO usado pelos dashboards** (só citado em RFCs). Lógica paralela/órfã.

### 2. `WIDGET/MAIN_VIEW/controller.js` (~L3472–3514 + L3651)

- Caminho: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`
- **O que faz:** regra **inline** (monta `bombaHidraulicaItems` com `combined.includes('BOMBA')…` excluindo `INCENDIO`) **+ label** via `buildCategorySummary(items, total, 'Bombas Hidráulicas')` → grava em `details.name`.
- **Usa:** filtro próprio, **não** chama #1.
- **Status:** ✅ fonte real em produção.

### 3. `MYIO-SIM/v5.2.0/MAIN/controller.js` (~L4555–4601 + L4726)

- Caminho: `src/MYIO-SIM/v5.2.0/MAIN/controller.js`
- **O que faz:** cópia idêntica de #2 (regra inline + label).
- **Usa:** filtro próprio.
- **Status:** 🔁 duplicata (simulador espelha o widget).

### 4. `WIDGET/TELEMETRY_INFO/controller.js`

- Caminho: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js`
- **O que faz:** exibição — lê só os números (`subcategories.bombasHidraulicas.summary.{count,total,perc}`) e **re-hardcoda** `name: 'Bombas Hidráulicas'` + `icon: '💧'`.
- **Usa:** consome #2 mas **ignora** `details.name`.
- **Status:** 🔁 display duplicado.

> As mesmas observações valem para **Chillers**, **Fancoils**, **CAG** e
> **Outros HVAC** (todas as subcategorias de Climatização), e analogamente para
> as subcategorias de **Outros** (Iluminação, Bombas de Incêndio,
> Geradores/Nobreaks, Geral).

---

## Como o `buildCategorySummary` guarda o nome

`buildCategorySummary(items, total, name)` (MAIN_VIEW ~L3596) retorna:

```js
{
  summary: { total, count, perc, percStr, formatted },
  details: { devices: [...], name }   // ← o 'name' fica AQUI (details.name)
}
```

Ou seja, a estrutura final é:

```
byCategory.climatizacao.subcategories.bombasHidraulicas = {
  summary: { count, total, perc, ... },
  details: { name: 'Bombas Hidráulicas', devices: [...] }
}
```

…mas o **TELEMETRY_INFO ignora `details.name`** e usa um literal próprio + ícone.

---

## Fluxo atual

```
device ──(regra inline, DUPLICADA em MAIN_VIEW + SIM MAIN)──► bombaHidraulicaItems
                                                                │
                  buildCategorySummary(items, total, 'Bombas Hidráulicas')
                                                                │
 byCategory.climatizacao.subcategories.bombasHidraulicas = {
   summary: { count, total, perc },
   details: { name: 'Bombas Hidráulicas' }
 }
                                                                │
 TELEMETRY_INFO ──► lê summary.{count,total,perc};
                    IGNORA details.name e usa name:'Bombas Hidráulicas' + icon:'💧' (hardcoded)
```

---

## Por que está repetido (causas)

- **SIM vs WIDGET:** o simulador (`src/MYIO-SIM/`) é uma cópia do widget de
  produção; como **não compartilham módulo**, o bloco de categorização foi
  **copiado** → daí #2 == #3.
- **Classificador nunca adotado:** o `equipmentCategory.js` (RFC-0128) era para
  ser a fonte única, mas os controllers mantiveram **regras inline**. A
  consolidação da **RFC-0207** cobre a classificação de **grupos/colunas**, mas
  **não** a sub-subcategorização de Climatização (chiller/fancoil/bomba/cag).
- **Display desacoplado do dado:** o `details.name` que o MAIN_VIEW já produz é
  **ignorado** pelo TELEMETRY_INFO, que recria o rótulo (e o ícone só existe lá).

---

## Proposta de consolidação (fonte única)

Criar uma tabela única das subcategorias em `src/utils/equipmentCategory.js`,
por exemplo:

```js
// CLIMATIZACAO_SUBCATEGORIES: { key, name, icon, match(combined, id) }
export const CLIMATIZACAO_SUBCATEGORIES = [
  { key: 'chillers',          name: 'Chillers',           icon: '❄️',
    match: (c, id) => c.includes('CHILLER') || id.startsWith('CHILLER-') },
  { key: 'fancoils',          name: 'Fancoils',           icon: '🌀',
    match: (c, id) => c.includes('FANCOIL') || id.startsWith('FANCOIL-') },
  { key: 'bombasHidraulicas', name: 'Bombas Hidráulicas', icon: '💧',
    match: (c) => c.includes('BOMBA') && !['INCENDIO','INCÊNDIO','BOMBA_INCENDIO'].some(p => c.includes(p)) },
  { key: 'cag',               name: 'CAG',                icon: '🏭',
    match: (c, id) => id.includes('CAG') || c.includes('CENTRAL') },
  { key: 'hvacOutros',        name: 'Outros HVAC',        icon: '⚙️',
    match: () => true }, // fallback
];
```

Com isso:

- **MAIN_VIEW** e **SIM MAIN** classificam por essa tabela (elimina a regra
  inline duplicada — #2 e #3 passam a iterar a tabela).
- **`buildCategorySummary`** pega `name`/`icon` da tabela (sem string literal
  solta no call site).
- **TELEMETRY_INFO** lê `details.name`/`details.icon` em vez de hardcodar
  (#4 deixa de duplicar nome + ícone).

**Resultado:** a string e o ícone passam a existir **uma única vez**.

### Faseamento recomendado

1. **Fase A (baixo risco):** criar a tabela única + fazer o **TELEMETRY_INFO**
   ler `details.name`/`details.icon` (e o MAIN_VIEW/SIM passarem `icon` no
   `buildCategorySummary`). Sem mexer na regra de classificação.
2. **Fase B (precisa validar golden):** trocar as **regras inline** de
   MAIN_VIEW/SIM pela tabela. Validar contra o golden da **RFC-0207** (a
   classificação de devices não pode mudar).

---

## Arquivos citados

- `src/utils/equipmentCategory.js` — `classifyEquipmentSubcategory()` (regra+nome órfãos)
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — regra inline + `buildCategorySummary`
- `src/MYIO-SIM/v5.2.0/MAIN/controller.js` — cópia da regra inline + `buildCategorySummary`
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js` — display hardcoded (nome + ícone)

## Relacionados

- RFC-0128 — Main Device Setup Category (origem do `equipmentCategory.js`)
- RFC-0207 — Device Classification Profile (consolidação de grupos/colunas)
- RFC-0159 — Device Classification Migration
