# Manual de Acesso e Operação — Centrais Linux Orange Pi

> **Escopo:** Procedimentos para acesso remoto, operação e manutenção das centrais Orange Pi utilizadas nos shoppings MyIO.
> **Audiência:** Técnicos e desenvolvedores MyIO.

---

## 1. Visão Geral

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| Hardware       | Orange Pi <!-- modelo: ex. Orange Pi 3 LTS --> |
| SO             | <!-- ex. Armbian 22.x / Ubuntu 20.04 -->       |
| Node-RED       | <!-- versão: ex. 3.x -->                       |
| Porta Node-RED | `1880`                                         |

---

## 2. Acesso SSH

### 2.1 Credenciais Padrão

| Campo     | Valor                    |
| --------- | ------------------------ |
| Usuário   | `root`                   |
| Chave SSH | `id_rsa` (arquivo local) |
| Porta SSH | `22`                     |

### 2.2 Endereços das Centrais por Holding

Os IPs são **IPv6** (rede mesh — Yggdrasil). Conectar sempre com `-i id_rsa`:

```bash
ssh -i id_rsa root@<ipv6-da-central>
```

#### Holding: SÁ CAVALCANTE

| Central              | IPv6                                     | Gateway ID                             |
| -------------------- | ---------------------------------------- | -------------------------------------- |
| Mestre Álvaro — L0L1 | `200:ba5f:dacb:b278:8f85:acf4:f33c:f485` | `45250d44-bad0-4071-aaa0-8091cfb12691` |
| Mestre Álvaro — L2AC | `200:8b:483c:9008:1184:caec:41b1:fa28`   | `d3202744-05dd-46d1-af33-495e9a2ecd52` |
| Mestre Álvaro — L3L4 | `200:b0b1:81aa:49a4:c554:4fec:f110:9896` | `fcb3ccd1-4b85-4cef-a1de-0b8a80bec81e` |
| Rio Poty             | `203:bdfb:8fda:634d:c846:1404:f319:718c` | `c0af8288-7b13-4024-bc11-df5017fef656` |
| Shopping da Ilha     | `201:3447:911:5955:4018:3960:6838:ee12`  | `cb318f02-1020-4f99-857f-d44d001d939b` |
| Moxuara              | `202:1567:faee:79ef:486:6d44:d391:fb18`  | `e982edf9-edb1-4aa6-8a14-4782465ae5a3` |
| Montserrat           | `200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc`  | `186bbdcb-95bc-4290-bf33-1ce89e48ffb4` |
| Shopping Ananindeua  | `201:ca6e:c33b:3a06:f4dd:d148:5d85:6315` | `7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a` |

#### Holding: SOUZA AGUIAR

| Central                         | IPv6                                     | Gateway ID |
| ------------------------------- | ---------------------------------------- | ---------- |
| Souza Aguiar — CO2              | `201:3941:4753:9232:901b:19fa:4978:51aa` | —          |
| Souza Aguiar — Ar Comprimido    | `200:4dbc:14be:a704:6904:81cd:b62a:ab22` | —          |
| Souza Aguiar — Maternidade Nova | `201:ce30:f047:7f02:a27c:cbac:ffb7:2b67` | —          |
| Souza Aguiar — T&D              | `202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`  | —          |

#### Holding: SOUL MALLS

| Central           | IPv6                                     | Gateway ID |
| ----------------- | ---------------------------------------- | ---------- |
| Praia da Costa L1 | `200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa` | —          |

#### Holding: SUPERVIA ESTAÇÕES

| Central | IPv6 |
| ------- | ---- |
| —       | —    |

#### Holding: DIMENSION

| Central           | IPv6                                     | Gateway ID |
| ----------------- | ---------------------------------------- | ---------- |
| Central Dimension | `203:984:24ef:b578:69a6:7136:b9f2:b5c2`  | —          |

#### Holding: RAIZ EDUCAÇÃO

| Central              | IPv6                                     | Gateway ID |
| -------------------- | ---------------------------------------- | ---------- |
| Central Raiz Educação | `201:3bed:541b:8c61:3e69:9:d453:1bef`   | —          |

**Exemplos de conexão:**

```bash
# Mestre Álvaro L0L1 (Sá Cavalcante)
ssh -i id_rsa root@200:ba5f:dacb:b278:8f85:acf4:f33c:f485

# Mestre Álvaro L2AC (Sá Cavalcante)
ssh -i id_rsa root@200:8b:483c:9008:1184:caec:41b1:fa28

# Mestre Álvaro L3L4 (Sá Cavalcante)
ssh -i id_rsa root@200:b0b1:81aa:49a4:c554:4fec:f110:9896

# Rio Poty (Sá Cavalcante)
ssh -i id_rsa root@203:bdfb:8fda:634d:c846:1404:f319:718c

# Shopping da Ilha (Sá Cavalcante)
ssh -i id_rsa root@201:3447:911:5955:4018:3960:6838:ee12

# Moxuara (Sá Cavalcante)
ssh -i id_rsa root@202:1567:faee:79ef:486:6d44:d391:fb18

# Montserrat (Sá Cavalcante)
ssh -i id_rsa root@200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc

# Shopping Ananindeua (Sá Cavalcante)
ssh -i id_rsa root@201:ca6e:c33b:3a06:f4dd:d148:5d85:6315

# Souza Aguiar — CO2
ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa

# Souza Aguiar — Ar Comprimido
ssh -i id_rsa root@200:4dbc:14be:a704:6904:81cd:b62a:ab22

# Souza Aguiar — Maternidade Nova
ssh -i id_rsa root@201:ce30:f047:7f02:a27c:cbac:ffb7:2b67

# Souza Aguiar — T&D
ssh -i id_rsa root@202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7

# Praia da Costa L1 (Soul Malls)
ssh -i id_rsa root@200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa

# Central Dimension (Dimension)
ssh -i id_rsa root@203:984:24ef:b578:69a6:7136:b9f2:b5c2

# Central Raiz Educação (Raiz Educação)
ssh -i id_rsa root@201:3bed:541b:8c61:3e69:9:d453:1bef
```

---

## 3. Node-RED

### 3.1 Verificar status

```bash
systemctl status nodered
```

### 3.2 Iniciar / Parar / Reiniciar

```bash
systemctl start nodered
systemctl stop nodered
systemctl restart nodered
```

### 3.3 Ver logs em tempo real

```bash
journalctl -u nodered -f
```

### 3.4 Acessar editor Node-RED (browser)

```
http://<ip-da-central>:1880
```

---

## 4. Arquivos e Diretórios

| Caminho                                  | Descrição                       |
| ---------------------------------------- | ------------------------------- |
| <!-- ex. /root/.node-red/ -->            | Diretório principal do Node-RED |
| <!-- ex. /root/.node-red/flows.json -->  | Flow principal                  |
| <!-- ex. /root/.node-red/settings.js --> | Configurações do Node-RED       |
| <!-- ex. /opt/myio/scripts/ -->          | Scripts JS customizados         |

### 4.1 Editar um arquivo JS na central

```bash
# Usando nano
nano <caminho-do-arquivo>

# Salvar: Ctrl+O → Enter
# Sair:   Ctrl+X
```

### 4.2 Fazer deploy após editar flow manualmente

```bash
# Reiniciar o serviço para recarregar os flows
systemctl restart nodered
```

---

## 5. Banco de Dados PostgreSQL

### 5.1 Conectar

```bash
psql -U hubot
```

> **Troubleshooting** — se retornar
> `could not connect to server: No such file or directory / Is the server running locally and accepting connections on Unix domain socket "/tmp/.s.PGSQL.5432"?`,
> o cliente está procurando o socket em `/tmp`, mas no Debian/Ubuntu o Postgres usa `/var/run/postgresql`. Force o host correto:
>
> ```bash
> psql -U hubot -h /var/run/postgresql
> ```

### 5.2 Comandos úteis dentro do psql

```sql
-- Listar tabelas
\dt
--  SELECT id, name FROM slaves WHERE name ~ ' X[0-9]';
--  SELECT id, name FROM channels WHERE name ~ ' X[0-9]';

-- Listar tabelas com detalhes (schema, tipo, owner)
\dt+

-- Detalhes de uma tabela
\d nome_da_tabela

-- Detalhes completos (tamanho, storage, descrições)
\d+ nome_da_tabela

-- Limpar o terminal
\! clear

-- Desconectar
\q
```

### 5.3 Executar um arquivo SQL

```bash
# 1. Criar arquivo temporário
cat > /tmp/fix-nome.sql << 'EOF'
-- Cole o SQL aqui
EOF

# 2. Executar
psql -U hubot -f /tmp/fix-nome.sql

# 3. Remover após uso
rm /tmp/fix-nome.sql
```

---

## 6. Serviços MyIO

### 6.1 Reiniciar APIs

```bash
systemctl restart myio.service
systemctl restart myio-api.service
```

### 6.2 Verificar status dos serviços

```bash
systemctl status myio.service
systemctl status myio-api.service
```

---

## 7. Modbus / Slaves

### 7.1 Schema da tabela `slaves`

```
hubot=# \d slaves;
                                             Table "public.slaves"
         Column         |           Type           | Collation | Nullable |              Default
------------------------+--------------------------+-----------+----------+------------------------------------
 id                     | integer                  |           | not null | nextval('slaves_id_seq'::regclass)
 type                   | character varying(255)   |           |          |
 addr_low               | integer                  |           |          |
 addr_high              | integer                  |           |          |
 channels               | integer                  |           |          |
 name                   | character varying(255)   |           |          |
 color                  | character varying(255)   |           |          |
 code                   | character varying(255)   |           |          |
 clamp_type             | integer                  |           |          |
 aggregate              | boolean                  |           |          | true
 version                | character varying(255)   |           |          | '1.0.0'::character varying
 temperature_correction | integer                  |           |          |
 config                 | json                     |           |          |
 created_at             | timestamp with time zone |           | not null | now()
 updated_at             | timestamp with time zone |           | not null | now()
```

**Campo `config` — estrutura relevante:**

```json
{
  "config_clamp": {
    "value": 2
  }
}
```

`clamp_type` deve ser sempre `NOT NULL` e igual a `config->'config_clamp'->>'value'`.

### 7.2 Query: não conformidades `clamp_type` vs `config.config_clamp.value`

```sql
SELECT
  id,
  name,
  clamp_type,
  (config -> 'config_clamp' ->> 'value')::integer AS config_clamp_value,
  CASE
    WHEN clamp_type IS NULL                                          THEN 'clamp_type NULL'
    WHEN config IS NULL                                              THEN 'config NULL'
    WHEN config -> 'config_clamp' IS NULL                           THEN 'config_clamp ausente'
    WHEN (config -> 'config_clamp' ->> 'value') IS NULL             THEN 'config_clamp.value NULL'
    WHEN clamp_type <> (config -> 'config_clamp' ->> 'value')::int  THEN 'divergência'
  END AS problema
FROM slaves
WHERE
  clamp_type IS NULL
  OR config IS NULL
  OR config -> 'config_clamp' IS NULL
  OR (config -> 'config_clamp' ->> 'value') IS NULL
  OR clamp_type <> (config -> 'config_clamp' ->> 'value')::int
ORDER BY id;
```

### 7.3 Update pontual de `clamp_type`

```sql
-- Exemplo: forçar clamp_type = 2 para slave id = 66
UPDATE slaves
SET clamp_type = 2
WHERE id = 66;
```

### 7.4 Update em massa — sincronizar `clamp_type` com `config.config_clamp.value`

```sql
-- Atualiza todos onde há divergência e config_clamp.value é válido
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE
  (config -> 'config_clamp' ->> 'value') IS NOT NULL
  AND (
    clamp_type IS NULL
    OR clamp_type <> (config -> 'config_clamp' ->> 'value')::int
  );
```

### 7.5 Verificar dispositivos ativos

<!-- Descrever como verificar slaves conectados:
     ex. via log Node-RED, arquivo de configuração, etc.
-->

### 7.6 Arquivo de mapeamento de devices

<!-- Caminho e formato do arquivo que mapeia slaveId → deviceName -->

---

## 8. RFIR — Controle Remoto Infravermelho (Modelo de Dados)

> **Status: Em análise (draft).** Esta seção consolida o entendimento atual do
> modelo RFIR. A conclusão preliminar é que o desenho acumulou débito técnico
> relevante — excesso de indireção, duplicação entre `slaves` e `rfir_*`,
> acoplamento com endereçamento físico do firmware. Objetivo desta seção:
> servir de base para a rediscussão arquitetural.

### 8.1 Conceito fundamental

Dispositivos `slaves` com `type = 'infrared'` são blasters IR físicos. O ponto
crítico é **onde o sinal IR mora**:

- **O comando IR (o "código" capturado do controle)** fica armazenado **dentro
  do hardware do blaster**, em uma página de memória identificada por um par
  `(page_low, page_high)`.
- O **banco de dados guarda só a referência** ao endereço de memória — não o
  sinal IR em si.
- Consequência prática: para reproduzir um comando é sempre necessário
  comunicar com o hardware; o banco sozinho não consegue "tocar" o IR.
- Consequência operacional: **migrar/clonar configurações de IR entre centrais**
  exige recapturar cada comando no hardware destino — o dump do Postgres
  **não é auto-suficiente**.

### 8.2 Tabelas envolvidas

| Tabela                        | Papel (entendimento atual)                                     |
| ----------------------------- | -------------------------------------------------------------- |
| `slaves` (`type='infrared'`)  | Blaster IR físico (hardware Modbus)                            |
| `rfir_devices`                | ⚠️ Camada adicional sobre o slave IR — a confirmar via `\d`     |
| `rfir_remotes`                | Controle remoto lógico (agrupamento de botões)                 |
| `rfir_buttons`                | Botões do remote — cada botão aponta para um comando           |
| `rfir_commands`               | Mapa comando → `(page_low, page_high)` no hardware             |
| `ambients_rfir_devices_rel`   | Junction: ambiente × `rfir_device`                             |
| `ambients_rfir_slaves_rel`    | Junction: ambiente × `slave` — ⚠️ parece redundante com a anterior |

### 8.3 Cadeia de referências (suspeita — a validar)

```
ambient ──┬─► ambients_rfir_devices_rel ──► rfir_device ──┐
          │                                                │
          └─► ambients_rfir_slaves_rel  ──► slave (IR) ◄──┘
                                                 ▲
              rfir_remote ──► rfir_button ──► rfir_command ──► (page_low, page_high) no firmware do slave
```

Para responder "qual botão aciona qual sinal no hardware X" a query precisa
percorrer **pelo menos 4 tabelas** (`rfir_buttons` → `rfir_commands` →
`rfir_devices`/`slaves` → `ambients_*`).

### 8.4 Pontos de fricção / débito técnico

1. **Duplicação `slaves` ↔ `rfir_devices`** — aparentemente representam o mesmo
   hardware por ângulos diferentes. Qual é a fonte-da-verdade?
2. **Duas junctions com `ambients`** (`ambients_rfir_devices_rel` e
   `ambients_rfir_slaves_rel`) — se `rfir_device` está 1:1 com `slave`, uma delas
   é redundante. Se não está 1:1, a semântica precisa ser documentada.
3. **`page_low`/`page_high` vaza no modelo relacional** — é um detalhe de
   implementação do firmware (endereço de página da flash interna). Modelar isso
   no Postgres acopla o schema ao hardware específico.
4. **Indireção excessiva** — 4 hops (`button → command → device → ambient`) pra
   responder perguntas operacionais simples.
5. **Dump do banco não é portável** — um `pg_dump` de uma central não recria o
   ambiente RFIR em outra sem recaptura dos comandos físicos.
6. **Sem integridade referencial óbvia entre `rfir_command.page_*` e o
   hardware** — nada no banco impede que `page_low/page_high` apontem para uma
   página vazia/sobrescrita do firmware.

### 8.5 Investigação pendente — schemas a capturar

Rodar em uma central ativa (sugestão: Raiz Educação — 35 blasters IR) e colar a
saída em `CENTRAL-RAIZ-EDUCACAO.md` §2.5 e/ou referenciar aqui:

```sql
\d rfir_devices
\d rfir_remotes
\d rfir_buttons
\d rfir_commands
\d ambients_rfir_devices_rel
\d ambients_rfir_slaves_rel
```

Contagens por tabela (panorama de volume):

```sql
SELECT 'rfir_devices'              AS tabela, count(*) FROM rfir_devices
UNION ALL SELECT 'rfir_remotes',              count(*) FROM rfir_remotes
UNION ALL SELECT 'rfir_buttons',              count(*) FROM rfir_buttons
UNION ALL SELECT 'rfir_commands',             count(*) FROM rfir_commands
UNION ALL SELECT 'ambients_rfir_devices_rel', count(*) FROM ambients_rfir_devices_rel
UNION ALL SELECT 'ambients_rfir_slaves_rel',  count(*) FROM ambients_rfir_slaves_rel;
```

Amostra de um botão até o endereço físico (uma vez que as FKs estejam mapeadas):

```sql
-- Esqueleto — ajustar os joins aos nomes reais das FKs
SELECT
  b.id              AS button_id,
  b.name            AS button_name,
  r.name            AS remote_name,
  c.page_low,
  c.page_high,
  s.id              AS slave_id,
  s.name            AS slave_name
FROM rfir_buttons b
JOIN rfir_commands c ON c.id = b.command_id        -- confirmar FK
JOIN rfir_remotes  r ON r.id = b.remote_id         -- confirmar FK
JOIN rfir_devices  d ON d.id = r.device_id         -- confirmar FK
JOIN slaves        s ON s.id = d.slave_id          -- confirmar FK
ORDER BY r.name, b.name;
```

### 8.6 Perguntas abertas para a rediscussão

- Qual a **cardinalidade real** `rfir_device` ↔ `slave`? (1:1 via `code`? N:1?)
- `rfir_remote` representa um **controle físico do cliente** (ex.: remote da TV)
  ou apenas um agrupamento lógico de botões?
- `rfir_command` é **compartilhado** entre botões/remotes ou único por
  `(remote, button)`? Se compartilhado, qual a chave natural?
- Por que **duas junctions com `ambients`**? Qual delas é consultada pela app e
  qual está morta?
- `page_low`/`page_high` são **alocados pelo firmware** (auto-incremento) ou
  **escolhidos pelo app** no momento da captura?
- Existe tabela/colunas para **marcar comandos "órfãos"** (apontando para
  página já sobrescrita no firmware)?
- Estratégia de **migração** entre centrais: existe ferramenta/flow que relê o
  firmware e reconstrói `rfir_commands`?

### 8.7 Próximos passos sugeridos

1. Capturar os `\d` das 6 tabelas RFIR e anexar aqui em §8.2.
2. Desenhar o ERD real (não suposto) após §8.5.
3. Identificar qual das duas junctions `ambients_*_rel` está em uso — candidate
   para deprecation.
4. Avaliar se `rfir_devices` pode ser fundido a `slaves` (view ou migração).
5. Documentar o procedimento oficial de recaptura IR pós-troca de hardware.

---

## 9. Procedimentos Comuns

### 9.1 Atualizar script JS de um shopping

```bash
# 1. Conectar via SSH
ssh -i id_rsa root@<ipv6-da-central>

# 2. Navegar até o diretório
cd <caminho-dos-scripts>

# 3. Editar o arquivo
nano <nome-do-arquivo>.js

# 4. Reiniciar Node-RED
systemctl restart nodered
```

### 9.2 Verificar se dados estão chegando ao ThingsBoard

<!-- Descrever como confirmar que a telemetria está sendo enviada:
     ex. via log, via painel TB, via debug node no Node-RED
-->

### 9.3 Reinicialização completa da central

```bash
reboot
```

---

## 10. Troubleshooting

| Problema               | Causa provável                             | Solução          |
| ---------------------- | ------------------------------------------ | ---------------- |
| Node-RED não inicia    | <!-- ex. porta 1880 em uso -->             | <!-- solução --> |
| Slaves sem leitura     | <!-- ex. cabo Modbus solto -->             | <!-- solução --> |
| Dados não chegam ao TB | <!-- ex. sem internet / token expirado --> | <!-- solução --> |

---

## 11. Observações e Boas Práticas

<!-- Adicionar dicas, avisos, particularidades de instalação -->

---

_Última atualização: 2026-04-13_
