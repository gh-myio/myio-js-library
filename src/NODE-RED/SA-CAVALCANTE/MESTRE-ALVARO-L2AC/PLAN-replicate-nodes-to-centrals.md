# Plano de Ação — Replicação de NODEs do MESTRE-ALVARO-L2AC para Centrais

**Referência visual:** `node-red-mestre-alvaro-L2AC.png` (neste mesmo diretório).
**Origem (template):** Flow Node-RED da central **MESTRE-ALVARO-L2AC** (SA-Cavalcante).
**Objetivo:** Replicar os NODEs/Tabs destacados na imagem para as demais centrais, com os ajustes por cliente (GCDR Customer ID, API KEY, nome do cliente).

---

## 1. Escopo — Centrais de destino (18 no total)

| # | Shopping | Qtd centrais | Identificador sugerido |
|---|----------|--------------|------------------------|
| 1 | Campinas          | 5 | `CAMPINAS-C1` … `CAMPINAS-C5` |
| 2 | Ilha Plaza        | 3 | `ILHA-PLAZA-C1` … `C3` |
| 3 | West Plaza        | 1 | `WEST-PLAZA-C1` |
| 4 | Praia da Costa    | 2 | `PRAIA-DA-COSTA-C1`, `C2` |
| 5 | Park Lagos        | 2 | `PARK-LAGOS-C1`, `C2` |
| 6 | Macaé             | 1 | `MACAE-C1` |
| 7 | Imbituba          | 2 | `IMBITUBA-C1`, `C2` |

> Confirmar os identificadores finais de cada central com o time de operação antes da execução.

---

## 2. Tabs/NODEs a replicar (conforme imagem)

Três tabs do fluxo devem ser copiadas a partir do template `MESTRE-ALVARO-L2AC`:

1. **notifics**
   - Ajustar: **GCDR Customer ID** e **API KEY** do cliente de destino.
2. **check offline**
   - Ajustar: **GCDR Customer ID** e **API KEY** do cliente de destino.
3. **Check last day data**
   - Ajustar: **GCDR Customer ID** e **API KEY** do cliente de destino.
   - ⚠️ Editar o NODE **"set email"** — trocar o valor do **Customer Name** para o do cliente de destino.

---

## 3. Pré-requisitos (antes de tocar em qualquer central)

- [ ] Lista consolidada (planilha) com, para cada central:
  - `customerName` (humano)
  - `gcdrCustomerId`
  - `apiKey` (cofre de credenciais — não commitar)
  - Email(s) de notificação que irão para o NODE `set email`
- [ ] Acesso admin ao Node-RED de cada central.
- [ ] Janela de manutenção acordada (se aplicável).
- [ ] Export do flow de referência `MESTRE-ALVARO-L2AC` salvo localmente
  (servirá como base para copiar os 3 tabs).

---

## 4. Procedimento — **sempre** começar por BACKUP

Para **cada** central da lista, executar nesta ordem:

### 4.1. Backup completo do Node-RED (obrigatório)

1. No Node-RED da central: **Menu → Export → All Flows → Download**.
2. Salvar o arquivo com o padrão de nome:
   ```
   bkp-node-red-central-<ID-CENTRAL>-YYYY-MM-DD-HH-MM.json
   ```
   Exemplo: `bkp-node-red-central-CAMPINAS-C1-2026-04-15-19-00.json`
3. Mover o backup para a pasta da central no repositório:
   ```
   src/NODE-RED/<SHOPPING>/<ID-CENTRAL>/
   ```
   - Se a pasta **não existir**, criá-la seguindo o padrão já usado em
     `src/NODE-RED/SA-CAVALCANTE/*` e `src/NODE-RED/CAMPINAS/*`.
4. Commit do backup com mensagem:
   `chore(node-red): backup pre-replicate L2AC nodes — <ID-CENTRAL>`

> **Regra:** não prosseguir para o passo 4.2 sem o backup confirmado em disco e commitado.

### 4.2. Importar os 3 tabs do template

1. Abrir o export do `MESTRE-ALVARO-L2AC` e **copiar** apenas os 3 tabs:
   `notifics`, `check offline`, `Check last day data`.
2. No Node-RED da central de destino: **Menu → Import → Clipboard → Import**.
3. Escolher **"new flow"** para preservar os tabs existentes (não sobrescrever).

### 4.3. Customização por central

Para cada tab importada:

- **notifics**
  - [ ] Abrir NODEs com credenciais GCDR → substituir `gcdrCustomerId` e `apiKey`.
- **check offline**
  - [ ] Abrir NODEs com credenciais GCDR → substituir `gcdrCustomerId` e `apiKey`.
- **Check last day data**
  - [ ] Substituir `gcdrCustomerId` e `apiKey`.
  - [ ] Editar o NODE **`set email`** → trocar **Customer Name** para o da central.

### 4.4. Deploy e validação

- [ ] **Deploy** no Node-RED da central.
- [ ] `notifics`: disparar evento de teste (ou acompanhar próximo ciclo) e validar chegada da notificação.
- [ ] `check offline`: validar que o check roda sem erro e reporta apenas devices reais da central.
- [ ] `Check last day data`: validar que o email sai com o **Customer Name** correto.
- [ ] Checar logs do Node-RED por 15 min — sem erros relacionados aos novos nodes.

### 4.5. Pós-deploy

- [ ] Exportar novamente o flow atualizado e salvar como
      `node-red-central-<ID-CENTRAL>-<YYYY-MM-DD>.json` na mesma pasta do backup.
- [ ] Commit: `feat(node-red): replicate L2AC notifics/offline/lastday tabs — <ID-CENTRAL>`.
- [ ] Marcar a central como ✅ na planilha de controle (seção 5).

---

## 5. Planilha de execução

| Central | Backup feito | Import OK | GCDR/API ajustados | set email ajustado | Deploy OK | Validação OK |
|---|---|---|---|---|---|---|
| CAMPINAS-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| CAMPINAS-C2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| CAMPINAS-C3 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| CAMPINAS-C4 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| CAMPINAS-C5 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| ILHA-PLAZA-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| ILHA-PLAZA-C2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| ILHA-PLAZA-C3 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| WEST-PLAZA-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| PRAIA-DA-COSTA-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| PRAIA-DA-COSTA-C2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| PARK-LAGOS-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| PARK-LAGOS-C2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| MACAE-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| IMBITUBA-C1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| IMBITUBA-C2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

Total: **16 centrais** (Campinas 5 + Ilha Plaza 3 + West 1 + Praia da Costa 2 + Park Lagos 2 + Macaé 1 + Imbituba 2).

---

## 6. Rollback

Em caso de erro em uma central:

1. No Node-RED: **Menu → Import** → selecionar o `bkp-node-red-central-<ID>-*.json`.
2. Escolher **"replace"** no prompt de import (restaura 100% do estado pré-mudança).
3. Deploy.
4. Registrar o incidente na planilha e abrir investigação antes de nova tentativa.

---

## 7. Organização no repositório

Estrutura alvo em `src/NODE-RED/`:

```
src/NODE-RED/
├── SA-CAVALCANTE/           # template de origem (MESTRE-ALVARO-L2AC)
├── CAMPINAS/<C1..C5>/
├── ILHA-PLAZA/<C1..C3>/
├── WEST-PLAZA/<C1>/
├── PRAIA-DA-COSTA/<C1..C2>/
├── PARK-LAGOS/<C1..C2>/
├── MACAE/<C1>/
└── IMBITUBA/<C1..C2>/
```

Cada pasta de central deve conter, no mínimo:
- `bkp-node-red-central-<ID>-YYYY-MM-DD-HH-MM.json` (backup pré-mudança)
- `node-red-central-<ID>-YYYY-MM-DD.json` (estado pós-mudança)

> **Nota de limpeza (2026-04-15):** a pasta `src/NODE-RED/CENTRAL/` foi removida
> e seu conteúdo mesclado em `src/NODE-RED/SA-CAVALCANTE/` para padronizar o
> layout por shopping.

---

## 8. Pontos em aberto / dúvidas a confirmar

- [ ] Confirmar **nomes oficiais** das 16 centrais (se já existem IDs canônicos, usá-los).
- [ ] Confirmar onde buscar `gcdrCustomerId` e `apiKey` (cofre? planilha? GCDR admin?).
- [ ] O NODE `set email` usa apenas `Customer Name` ou também uma lista de destinatários por central?
- [ ] Existe algum outro NODE no tab `Check last day data` que também referencia o cliente por nome/ID e que precise ser ajustado além do `set email`?
