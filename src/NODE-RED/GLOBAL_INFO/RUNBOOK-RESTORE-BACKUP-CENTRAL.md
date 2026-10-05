# Runbook — Restaurar o backup do banco `hubot` numa central Orange Pi

> Quando usar: troca de central (a antiga queimou ou foi substituída) ou banco corrompido.
> O banco da central nova recebe o backup da central **antiga**, guardado no S3
> (`myio-central-backup-bucket`, arquivo `<uuid-da-central-antiga>.tar.gz`).
>
> Base: restore da **Supervia CCO em 05/10/2026** (central nova `fb924430-…`, backup da antiga
> `af8a4c31-…`), mais o incidente de 13/07/2026 que originou o script
> [`restore-hubot-backup.sh`](./restore-hubot-backup.sh).
> Acesso e lista de centrais: [`manual-centrais-linix-orangepi.md`](./manual-centrais-linix-orangepi.md).

---

## Resumo (TL;DR)

```text
S3 (URL presigned) ──wget──▶ central:/data/img.tar.gz
central: parar myio* → recriar banco hubot → timescaledb_pre_restore()
       → tar | pg_restore → timescaledb_post_restore() + ANALYZE
       → subir myio* → conferir
```

| Etapa | Seção |
| --- | --- |
| Acessar a central | §1 |
| Baixar o backup | §2 |
| Conferir o arquivo e a central | §3 |
| Parar serviços e recriar o banco | §4 |
| Restaurar | §5 |
| Acompanhar o progresso (2ª sessão) | §6 |
| Se parar em erro de chave estrangeira | §7 |
| Fechar e religar | §8 |
| Conferir o resultado | §9 |
| Limpeza | §10 |
| Armadilhas conhecidas | §11 |

**Script ou passo a passo?** O [`restore-hubot-backup.sh`](./restore-hubot-backup.sh) faz as §2 a §8 de
uma vez, com as proteções do incidente de 13/07. Ele **não** trata o erro de chave estrangeira da §7.
Se o banco de origem tiver dados órfãos, o script para e você continua pela §7 deste runbook.
Ele também usa `systemctl start 'myio*'` para religar os serviços, o que **não funciona** (§8):
depois de rodar o script, confira com `systemctl list-units --all 'myio*'` e suba pelo nome o que estiver parado.

---

## 1. Acessar a central

Dois saltos: a sua máquina → `healthchecks` → central.

```sh
ssh -i ~/.ssh/id_ed25519 ubuntu@healthchecks.myio-bas.com
cd ~/restarter
ssh -i id_rsa root@<ipv6-da-central-nova>
```

O IPv6 de cada central está no manual. Abra **duas sessões** na central: uma para o restore e
outra para acompanhar (§6).

---

## 2. Baixar o backup

O sistema raiz da central é **somente leitura**. Grave sempre em **`/data`**. Evite `/tmp`, que
costuma ficar em RAM e pode encher a memória com um backup grande.

```sh
df -h /data
cd /data
wget -O img.tar.gz "<URL presigned do S3>"
ls -lh /data/img.tar.gz
```

- A URL **precisa estar entre aspas**, porque tem `&`.
- A URL presigned **vence** (veja `X-Amz-Expires`, em segundos, contado a partir de `X-Amz-Date`).
  Depois disso o download dá 403 e é preciso gerar outra.
- A URL contém um **token temporário da AWS**: não cole em ticket, chat ou commit.
- O erro `wget: can't open 'img.tar.gz': Read-only file system` significa que você está fora de `/data`.

---

## 3. Conferir o arquivo e a central

```sh
src='/data/img.tar.gz'
tar -tzf "$src"                     # deve listar UM arquivo (o dump)
systemctl list-units 'myio*'        # serviços que vão parar
psql -X -U hubot -d postgres -c "SELECT extversion FROM pg_extension WHERE extname='timescaledb';" 2>/dev/null
```

- Mais de um arquivo no tar: o `tar -O` da §5 emendaria os arquivos e o `pg_restore` quebraria.
  Nesse caso, extraia só o dump pelo nome.
- A versão do TimescaleDB da central nova precisa ser **compatível com a do dump**. Diferença de
  versão faz a §4 ou a §5 falhar. Anote a versão.

---

## 4. Parar os serviços e recriar o banco

Antes de parar, **guarde a lista dos serviços que estão rodando**. Ela é necessária para religá-los
na §8, porque o `start` com padrão (`'myio*'`) não funciona (§11).

```sh
systemctl list-units --type=service --state=running --no-legend 'myio*' | awk '{print $1}' > /data/myio-services.txt
cat /data/myio-services.txt
systemctl stop 'myio*'
psql -X -U hubot -d postgres -c "SELECT pid, application_name FROM pg_stat_activity WHERE datname='hubot';"
```

Se ainda houver conexões, o `DROP DATABASE` falha. Encerre-as:

```sh
psql -X -U hubot -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='hubot' AND pid <> pg_backend_pid();"
```

Recrie o banco. Use `ON_ERROR_STOP`: sem ele, um `DROP` que falha passa despercebido
(foi o incidente de 13/07).

```sh
psql -X -v ON_ERROR_STOP=1 -U hubot -d postgres \
  -c 'DROP DATABASE IF EXISTS "hubot";' \
  -c 'CREATE DATABASE "hubot" TEMPLATE template0;'
psql -X -v ON_ERROR_STOP=1 -U hubot -d hubot \
  -c 'CREATE EXTENSION IF NOT EXISTS timescaledb;' \
  -c 'SELECT timescaledb_pre_restore();'
```

- `systemctl stop 'myio*'` vai **com aspas**, senão o shell tenta expandir o `*` com nomes de arquivo.
  O padrão funciona no `stop` porque os serviços em execução estão carregados.
- `TEMPLATE template0` evita herdar lixo do `template1`.

---

## 5. Restaurar

```sh
tar -xzOf /data/img.tar.gz | pg_restore --verbose --exit-on-error -U hubot -Fc -d hubot
```

- Lê o dump direto do tar, sem gravar uma cópia descompactada em disco.
- `--exit-on-error` para no primeiro erro. Os casos conhecidos estão na §7 e na §11.
- Se o dump trouxer o `CREATE EXTENSION timescaledb` e o restore parar em *"already exists"*,
  use o filtro de TOC do script (`grep -vE 'EXTENSION (- )?timescaledb'`, linha 123).

**Ordem das fases**, o que explica a demora:

1. **Dados** (`COPY` por tabela): o `tar` some do `ps` quando essa fase termina.
2. **Índices**: um `CREATE INDEX` por chunk de cada hypertable. É a fase mais longa.
3. **Índices das tabelas principais, triggers e chaves estrangeiras (FK)**.

Na Supervia CCO: 5 hypertables (`consumption_realtime` com 366 chunks, `metadata` 237,
`temperature_history` 213, `logs` 300, `channel_pulse_log` 0), 1116 índices de chunk.

**Não interrompa** o restore no meio: o banco fica incompleto e é preciso recomeçar pela §4.

---

## 6. Acompanhar o progresso (2ª sessão)

Os comandos abaixo só leem; não interferem no restore.

**Ainda está rodando?**

```sh
ps | grep -E 'pg_restore|tar' | grep -v grep
```

**O que está fazendo agora?**

```sh
psql -X -U hubot -d hubot -c "SELECT now()-query_start AS tempo, left(query,100) AS query FROM pg_stat_activity WHERE datname='hubot' AND pid <> pg_backend_pid() AND query NOT LIKE 'autovacuum%';"
```

- `COPY …`: carregando dados.
- `CREATE INDEX _hyper_<N>_<chunk>_chunk_…`: índices da hypertable `<N>`.
- Linhas `autovacuum: ANALYZE` são o PostgreSQL atualizando estatísticas. São normais e inofensivas.

**Quais hypertables existem e quantos chunks cada uma tem:**

```sh
psql -X -U hubot -d hubot -c "SELECT h.id, h.table_name, count(c.id) AS chunks FROM _timescaledb_catalog.hypertable h LEFT JOIN _timescaledb_catalog.chunk c ON c.hypertable_id = h.id GROUP BY h.id, h.table_name ORDER BY h.id;"
```

Use `_timescaledb_catalog`, que existe em todas as versões. A view `timescaledb_information.chunks`
não existe no TimescaleDB 1.x, a versão destas centrais.

**Quantos chunks de cada hypertable já têm índice:**

```sh
psql -X -U hubot -d hubot -c "SELECT c.hypertable_id, count(DISTINCT c.id) AS chunks, count(DISTINCT i.tablename) AS com_indice FROM _timescaledb_catalog.chunk c LEFT JOIN pg_indexes i ON i.schemaname = c.schema_name AND i.tablename = c.table_name GROUP BY c.hypertable_id ORDER BY c.hypertable_id;"
```

**Quantos índices o backup ainda vai criar, por hypertable** (lê só a lista do início do arquivo; é rápido):

```sh
tar -xzOf /data/img.tar.gz | pg_restore -l | grep ' INDEX ' | grep -oE '_hyper_[0-9]+_' | sort | uniq -c
```

`com_indice = 0` com a tabela presente nessa lista quer dizer que os índices dela ainda estão na
fila, não que ela não tem índice. Durante o restore, `pg_indexes` no schema `public` vem vazio:
os índices das tabelas principais são criados no fim.

**Tempo estimado** (mede o ritmo em 2 minutos; ajuste `total` para a soma de chunks das hypertables):

```sh
q="SELECT count(DISTINCT i.tablename) FROM _timescaledb_catalog.chunk c JOIN pg_indexes i ON i.schemaname=c.schema_name AND i.tablename=c.table_name;"
total=1116
a=$(psql -X -t -A -U hubot -d hubot -c "$q"); sleep 120
b=$(psql -X -t -A -U hubot -d hubot -c "$q")
ritmo=$(( b - a )); falta=$(( total - b ))
echo "prontos: $b de $total | faltam: $falta | ritmo: $ritmo a cada 2 min"
[ "$ritmo" -gt 0 ] && echo "tempo estimado: ~$(( falta * 2 / ritmo )) min" || echo "nenhum avanço em 2 min, rode de novo"
```

A estimativa é aproximada: chunks de tabelas diferentes têm tamanhos diferentes. Os de `metadata`
e `logs` são bem menores que os de `consumption_realtime`.

---

## 7. Se parar em erro de chave estrangeira (dados órfãos)

**Sintoma** (Supervia CCO, 05/10/2026):

```text
pg_restore: creating FK CONSTRAINT "_timescaledb_internal._hyper_1_101_chunk 101_1_consumption_realtime_slave_id_fkey"
pg_restore: [archiver (db)] Error from TOC entry 12134; ... FK CONSTRAINT ...
ERROR:  insert or update on table "_hyper_1_101_chunk" violates foreign key constraint "101_1_consumption_realtime_slave_id_fkey"
DETAIL:  Key (slave_id)=(32) is not present in table "slaves".
```

**Causa:** o banco da central antiga já tinha leituras de um `slave_id` que não existe mais em
`slaves`. Dados, índices e triggers já entraram. Faltam as chaves estrangeiras a partir da
entrada que falhou e o que vem depois dela no backup.

**Não rode** o `post_restore` nem suba os serviços ainda.

**Caminho recomendado: recriar as FKs com `NOT VALID`.**
- É rápido: não confere as linhas antigas, só as novas.
- Não apaga nada: as leituras órfãs continuam no banco, como já estavam na central antiga.

```sh
cd /data
tar -xzOf img.tar.gz | pg_restore -l > toc.list
sed -n '/^12134;/,$p' toc.list > toc-rest.list        # troque 12134 pelo número da "TOC entry" do erro
tar -xzOf img.tar.gz | pg_restore -L toc-rest.list -f rest.sql
sed -r -i '/FOREIGN KEY/ s/;$/ NOT VALID;/' rest.sql

# conferência: os dois números precisam ser iguais
grep -c 'FOREIGN KEY' rest.sql
grep -c 'NOT VALID' rest.sql

psql -X -U hubot -d hubot -v ON_ERROR_STOP=1 -f /data/rest.sql
```

- `rest.sql` contém só o que faltou restaurar. Leia antes de aplicar, se quiser.
- Se os dois `grep -c` não baterem, alguma FK está em outro formato. Ajuste o `sed` antes de aplicar.

**Alternativa: apagar as leituras órfãs e criar as FKs normalmente.** É bem mais lento: lê a tabela
de consumo inteira, sem estatísticas, porque o `ANALYZE` ainda não rodou, e cada FK confere todas
as linhas de novo. Também **apaga dados**.

```sh
# só leitura — pode demorar muito; Ctrl+C é seguro
psql -X -U hubot -d hubot -c "SELECT slave_id, count(*) FROM consumption_realtime WHERE slave_id NOT IN (SELECT id FROM slaves) GROUP BY slave_id;"
# apaga as órfãs
psql -X -U hubot -d hubot -c "DELETE FROM consumption_realtime WHERE slave_id NOT IN (SELECT id FROM slaves);"
```

Depois, aplique o `rest.sql` **sem** o `sed` do `NOT VALID`.

---

## 8. Fechar e religar

```sh
psql -X -v ON_ERROR_STOP=1 -U hubot -d hubot -c 'SELECT timescaledb_post_restore();'
psql -X -U hubot -d hubot -c 'ANALYZE VERBOSE;'

# religar pelo NOME de cada serviço (lista gravada na §4)
for s in $(cat /data/myio-services.txt); do systemctl start "$s"; done
systemctl list-units --all 'myio*'       # todos devem estar active (running)
journalctl -u myio-api.service -f        # Ctrl+C para sair
```

- **Não use `systemctl start 'myio*'`.** Com padrão, o `systemctl` só enxerga serviços carregados,
  e um serviço parado deixa de estar carregado: o comando mostra o aviso *"start called with a glob
  pattern … will usually have no effect"* e não sobe nada (Supervia CCO, 05/10/2026).
- Sem o arquivo da §4, suba pelo nome as unidades essenciais. Na Supervia CCO
  (`systemctl list-unit-files 'myio*'`, 05/10/2026), eram estas:

  | Unidade | Papel | Subir à mão? |
  | --- | --- | --- |
  | `myio.path`, `myio-api.path` | vigiam arquivos e disparam os serviços | sim |
  | `myio.service`, `myio-api.service` (Node-RED), `myio-hkbridge.service` | ficam rodando | sim |
  | `myio-cloud-env`, `myio-cloud-reg`, `myio-radio-env`, `myio-serial-gen` | pelo nome, preparação que roda no boot | em geral não |

  ```sh
  systemctl start myio.path myio-api.path myio.service myio-api.service myio-hkbridge.service
  ```

- **Alternativa mais limpa:** `reboot` depois que o `ANALYZE` terminar. Tudo sobe na ordem do boot,
  inclusive as unidades de preparação.
- O `ANALYZE VERBOSE` leva de minutos a mais de uma hora (Supervia CCO: ~80 milhões de linhas só em
  `consumption_realtime`) e imprime bastante coisa. Ele não bloqueia leituras nem gravações, então
  dá para religar os serviços numa 2ª sessão antes de ele terminar.
- Se o restore falhou e você desistiu dele, religue os serviços do mesmo jeito, pelo nome.

---

## 9. Conferir o resultado

**Serviços e Node-RED:**

```sh
systemctl list-units 'myio*'
journalctl -u myio-api.service --since "-10 min" --no-pager | tail -50
```

Procure erros de inicialização, conexões MQTT com o ThingsBoard e a mensagem de healthcheck.

**Banco:**

```sh
psql -X -U hubot -d hubot -c "SELECT count(*) AS tabelas FROM pg_tables WHERE schemaname='public';"
psql -X -U hubot -d hubot -c "SELECT count(*) AS slaves FROM slaves;"
psql -X -U hubot -d hubot -c "SELECT max(timestamp) AS ultima_leitura FROM consumption_realtime;"
```

- `ultima_leitura` deve ser perto da data do backup. Leituras novas devem aparecer depois que
  os serviços subirem.
- O script `restore-hubot-backup.sh` confere a tabela `consumption`. Ela existe, mas é legada e
  fica vazia: as leituras estão em `consumption_realtime`. Um `0` para `consumption` no script não
  indica falha.
- Referência da Supervia CCO após o restore: 86 `slaves`, 71 `channels`, 32 `ambients`, 1 `users`.

**ThingsBoard e identidade da central:**
- O banco veio da central **antiga**. Confirme que a central nova sobe com o **próprio** uuid, e
  que os nomes que dependem dele, como o device `MQTT Sync - <uuid>`, ficaram corretos.
- No ThingsBoard, os dispositivos da central devem voltar a receber telemetria.
- Atualize o manual: marque a central antiga como substituída e acrescente a nova, com IPv6,
  uuid, central id, frequência e a linha de SSH.

---

## 10. Limpeza

Depois de conferir tudo:

```sh
rm -f /data/img.tar.gz /data/toc.list /data/toc-rest.list /data/rest.sql
df -h /data
```

---

## 11. Armadilhas conhecidas

| Sintoma | Causa | O que fazer |
| --- | --- | --- |
| `can't open 'img.tar.gz': Read-only file system` | fora de `/data` | `cd /data` (§2) |
| 403 no `wget` | URL presigned vencida | gerar nova URL |
| `DROP DATABASE … is being accessed by other users` | serviço ou sessão ainda conectado | `pg_terminate_backend` (§4) |
| `type … already exists` no restore | `DROP` anterior falhou em silêncio | recomeçar pela §4 com `ON_ERROR_STOP` |
| `extension "timescaledb" already exists` no restore | o dump traz a extensão | filtrar o TOC como no script (§5) |
| `relation "timescaledb_information.chunks" does not exist` | TimescaleDB 1.x | usar `_timescaledb_catalog` (§6) |
| restore parece parado por muito tempo | criando índice de chunk grande | §6 |
| `violates foreign key constraint … not present in table "slaves"` | dados órfãos no banco de origem | §7 |
| `pg_indexes` do schema `public` vazio durante o restore | índices principais são criados no fim | normal; usar a contagem do backup (§6) |
| `systemctl start called with a glob pattern … will usually have no effect` | `start` com padrão não vê serviços parados | subir pelo nome (§8) |

---

## Histórico

| Data | Central | Observação |
| --- | --- | --- |
| 2026-07-13 | — | Incidente que originou o `restore-hubot-backup.sh` (`DROP` silencioso, extensão no TOC, `template0`). |
| 2026-10-05 | Supervia CCO (nova `fb924430-…`, backup de `af8a4c31-…`) | Restore parou na FK `101_1_consumption_realtime_slave_id_fkey` (`slave_id` 32 órfão). Recuperação pela §7, com `NOT VALID`. **Conclusão a confirmar e registrar aqui.** |
