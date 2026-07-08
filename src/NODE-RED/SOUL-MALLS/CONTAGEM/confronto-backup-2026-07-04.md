# Confronto — Backup 2026-07-04 04:00 UTC × Snapshot 2026-07-07 (Contagem)

> Backup: `70b6d878-090f-4326-af18-2695396cbc67.tar.gz` → `2026-07-04-04-00.bak`
> (pg_dump custom, PG 11.16, banco `hubot`). Restaurado em Docker (`postgres:11`,
> container `pg-contagem`, restore seletivo das 4 tabelas de cadastro).
> Estado do backup: **26 slaves · 8 channels · 4 ambients (5/6/7/8) · 26 junction**.

## 🚨 Achado principal: o import de 06/07 RENOMEOU os slaves existentes

Todos os 26 slaves presentes no backup tinham nome no padrão **`3F SMCONTAGEM_<código>`**
— e o código de loja é **DIFERENTE** do nome atual `3F SCO*`. O `updated_at` dos 26
foi sobrescrito para `2026-07-06 16:59:39.352285+00` (o timestamp exato do import
em lote). Ou seja: **o import renomeou os medidores manuais por pareamento posicional,
destruindo o mapeamento de campo original**. O revert de 07/07 removeu o que o import
*criou* (ambients SCO\*, slaves 1-canal, channels, junction), mas **não** restaurou
os nomes originais.

Evidência de que o nome original era o correto: os códigos originais existem no
catálogo de lojas — ex.: slave 5 era `SMCONTAGEM_01006` (loja SCO01006), e o import
o renomeou para `SCO01067` pareando-o com o ambient `SCO01015`. Três códigos diferentes
para o mesmo medidor.

Fora `name` e `updated_at`, **nenhum outro campo divergiu** (addr_low/high, code,
clamp_type, config idênticos). A junction dos 26 (grupos L1/L2) também está idêntica.

## Tabela de restauração — 26 nomes originais recuperados do backup

| Slave ID | Nome atual (pós-import) | Nome ORIGINAL (backup 04/07) | Obs |
|----------|--------------------------|------------------------------|-----|
| 5  | `3F SCO01067` | `3F SMCONTAGEM_01006` | |
| 6  | `3F SCO01016` | `3F SMCONTAGEM_01011` | |
| 7  | `3F SCO01018` | `3F SMCONTAGEM_01012` | |
| 8  | `3F SCO01019` | `3F SMCONTAGEM_01015` | |
| 9  | `3F SCO01020` | `3F SMCONTAGEM_01059` | |
| 10 | `3F SCO01021` | `3F SMCONTAGEM_01060` | |
| 11 | `3F SCO01022` | `3F SMCONTAGEM_01064` | |
| 12 | `3F SCO01023` | `3F SMCONTAGEM_01065` | |
| 13 | `3F SCO01025` | `3F SMCONTAGEM_01066` | |
| 14 | `3F SCO01027` | `3F SMCONTAGEM_Q0102` | |
| 15 | `3F SCO01028` | `3F SMCONTAGEM_02024` | |
| 16 | `3F SCO01029` | `3F SMCONTAGEM_1013B` | |
| 17 | `3F SCO1031`  | `3F SMCONTAGEM_1019B` | |
| 18 | `3F SCO01035` | `3F SMCINTAGEM_Q0115` | ⚠️ typo original ("CINTAGEM") |
| 19 | `3F SCO01036` | `3F SMCONTAGEM_Q0204` | |
| 20 | `3F SCO01037` | `3F SMCONTAGEM_Q200B` | |
| 21 | `3F SCO01041` | `3F SMCONTAGEM_Q0103` | |
| 22 | `3F SCO01044` | `3F SMCONTAGEM_Q0116` | |
| 23 | `3F SCO01046` | `3F SMCONTAGEM_Q1015` | |
| 24 | `3F SCO1047`  | `3F SMCONTAGEM_Q202B` | |
| 25 | `3F SCO01048` | `3F SMCONTAGEM_Q0104` | |
| 26 | `3F SCO01053` | `3F SMCONTAGEM_Q0201` | |
| 27 | `3F SCO01054` | `3F SMCONTAGEM_Q0104B` | |
| 28 | `3F SCO01059` | `3F SMCONTAGEM_Q0202` | |
| 29 | `3F SCO01060` | `3F SMCONTAGEM_Q102A` | |
| 30 | `3F SCO01064` | `3F SMCONTAGEM_Q114A` | |

Script pronto (não executado): [`restore-names-from-bkp-2026-07-04.sql`](restore-names-from-bkp-2026-07-04.sql).

## Cobertura e lacunas

| Faixa de slaves | Criados em | Nome original recuperável? |
|-----------------|------------|----------------------------|
| 5–30 (26) | 07-03 → 07-04 01:17 | ✅ **Este backup** |
| 31–55, 88, 89, 91–94 (31) | 07-04 15:05 → 07-05 17:03 | ⚠️ Buscar backups `2026-07-05-04-00.bak` e `2026-07-06-04-00.bak` (mesma origem/UUID) |
| 95–116 (22) | 07-06 14:08 → 16:57 (mesmo dia do import, após as 04:00) | ❌ Nenhum backup diário cobre; **verificar nomes dos devices no ThingsBoard** (se o MQTT Sync rodou antes das 16:59 do dia 06, os devices TB guardam o nome original) |

## Fase 2 — Recuperação via ThingsBoard (2026-07-07)

Consulta ao Postgres do TB (customer `c1915150-7719-11f1-b3a7-c5fc06cba2c4`, schema
novo 3.6.2+ com `key_dictionary`; resultado em [`thingsboard.log`](thingsboard.log))
revelou que **os devices do TB preservaram os nomes originais**: o MQTT Sync rodou
às **16:53–16:56 de 06/07** (`gcdrSyncAt`), minutos **antes** do import das 16:59:39.
Como o sync cria device novo a cada rename (nome é chave), o TB guarda o histórico.

- **75 dos 79** slaves manuais recuperados → script consolidado
  [`restore-names-from-thingsboard.sql`](restore-names-from-thingsboard.sql)
  (**substitui** o `restore-names-from-bkp-2026-07-04.sql`, que cobria só os 26).
- **Validação cruzada: 26/26 idênticos** entre backup 04/07 e devices TB.
- Critério p/ variantes de nome (com/sem sufixo `X40 X40A` de TC): device com
  `gcdrSyncAt` mais recente; empate → maior `inactivityAlarmTime`. 0 ambíguos.
- Sufixos "(Ilha Plaza)"/"(Contagem)" nos devices TB = hardcode do Node-RED, ignorados.
- 🎯 Resolve o duplicado `3F SCO02089`: slave **51 = loja 3007** (`3F SMCONTAGEM_3007`),
  slave **111 = quiosque Q203A** (`3F SMCONTAGEM_Q203A`).
- Os 4 sem device `3F SM%` foram resolvidos por query por `slaveId` (nome-agnóstica):
  - **89 → `Quiosque Quadro QPBT-G3`** (quadro não identificado — casa com o ambient
    "Identificar"; device criado 05/07 15:54 UTC, minutos após o slave);
  - **112 → `3F CONTAGEM_Q200A`** (prefixo sem "SM"; device criado pelo sync
    16:56:31 UTC, 3 min antes do import);
  - **106 = `3F SCO02083` mantém**: o sync das 16:56 processou os vizinhos 105/107 e
    não criou device p/ 106 — só acontece quando já existe device homônimo, e
    `3F SCO02083` existia no TB desde 03/07 → o slave já nasceu com o código SCO;
  - **116 = `3F SCO02094` mantém (não confirmável)**: criado 16:57:40, após a passada
    do sync e 2 min antes do import; nenhum sync capturou nome intermediário.
- 🔎 Contexto extra: os devices `3F SCO*` foram **pré-criados no TB em lotes**
  (03/07 20:49 UTC e 06/07 16:49 UTC — 10 min antes do import da central), ou seja,
  o import de 06/07 16:59 foi a segunda perna de uma operação iniciada no TB.
  Os devices com sufixo "(Ilha Plaza)" surgiram no sync pós-import de 17:24 UTC.

**Placar final: 77/79 nomes restauráveis** (75 do padrão SM + 89 + 112); 106 e 116
permanecem com o código SCO por evidência de que já nasceram assim.

## ✅ EXECUTADO na central em 2026-07-07

`restore-names-from-thingsboard.sql` (versão idempotente) aplicado com sucesso:
**51 renomeados na execução + 26 já restaurados antes** (pelo script do backup
04/07) = **77/77 com nome original, COMMIT**. Estado final conferido: 79 slaves,
sendo 77 com nomes de campo + 106/116 com código SCO de nascença.

## Achados menores

1. **Trailing spaces reais no banco** que os JSONs do repo perderam (parser rtrim do
   psql alinhado): ambients 5 `"L1 Medidores 3F "`, 6 `"L2 Medidores 3F "`,
   7 `" Serviço Medidores 3F "`; channels 3 `"Energia 01 "`, 5 `"Energia "`, 6 `"Hidrometro "`.
2. Channels de teste (1–8) e ambients 5–8: sem alterações entre 04 e 07 além disso.
3. O backup confirma que ambients 9 (`Piso G4`), 10 (`Identificar`) e 229 (`Piso G3`)
   e todos os slaves ≥31 são posteriores a 04/07 04:00.

---
*Gerado em 2026-07-07. Container Docker local: `pg-contagem` (postgres:11, porta 5433,
senha `contagem`, db `hubot` com as 4 tabelas restauradas para consulta).*
