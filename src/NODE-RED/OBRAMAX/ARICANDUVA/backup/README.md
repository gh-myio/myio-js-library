# Backup do banco — OBRAMAX Aricanduva (via PuTTY)

Backup do banco `hubot` no formato `pg_dump -Fc`, desenhado como **complemento do
`POST /api/clear-all-data-central`**: salva tudo antes de limpar e permite restaurar
— preservando sempre `SequelizeMeta` (migrações) e `environment` (config key→value).

> **Seu cenário:** acesso por **PuTTY (SSH)** através de um proxy reverso. Use o
> **`pscp`** (vem com o PuTTY) para enviar o script e baixar os dumps pela mesma conexão.
> Recomendado: já ter uma **sessão salva no PuTTY** (com host/porta/proxy/chave `.ppk`
> configurados) — abaixo chamo ela de `<SESSAO>`.

> Central: **OBRAMAX — Aricanduva** · gateway `1e0c1d77-1d41-4004-8be7-41328e590111` · DB `hubot`.

---

## Passo 1 — enviar o script para a central (`pscp`, no seu PC)

```bat
REM usando uma sessão salva do PuTTY (host/porta/proxy/chave já vêm dela):
pscp -load "<SESSAO>" db-backup.sh root@dummy:/tmp/db-backup.sh

REM OU explícito (ajuste host/porta/chave .ppk):
pscp -P <PORTA> -i C:\caminho\chave.ppk db-backup.sh root@<HOST-DO-PROXY>:/tmp/db-backup.sh
```

> Alternativa sem `pscp`: abra o PuTTY, e cole o conteúdo do `db-backup.sh` num here-doc:
> ```sh
> cat > /tmp/db-backup.sh <<'EOF'
> # >>> cole AQUI todo o conteúdo de db-backup.sh <<<
> EOF
> ```

## Passo 2 — rodar (na sessão PuTTY)

```sh
sh /tmp/db-backup.sh                    # config+infra + infra-only + séries temporais (à parte)
# variações:
WITH_TIMESERIES=0 sh /tmp/db-backup.sh  # SEM séries temporais (leve)
FULL=1            sh /tmp/db-backup.sh  # também gera full_*.dump (DB inteiro, Timescale-safe)
```

A última linha mostra `BACKUP_DIR=/data/backups/aricanduva/<ts>`. Confira:

```sh
ls -lh /data/backups/aricanduva/latest/
cat    /data/backups/aricanduva/latest/MANIFEST.txt
```

## Passo 3 — baixar os dumps (`pscp -r`, no seu PC)

`latest` é symlink pro último backup; baixe a pasta inteira:

```bat
REM descubra o <ts> (na sessão PuTTY): readlink -f /data/backups/aricanduva/latest
pscp -load "<SESSAO>" -r root@dummy:/data/backups/aricanduva/<ts> .

REM OU explícito:
pscp -P <PORTA> -i C:\caminho\chave.ppk -r root@<HOST-DO-PROXY>:/data/backups/aricanduva/<ts> .
```

> Para arquivos grandes (séries temporais), `pscp` é o caminho — não use copy-paste.
> Se o `pscp -r` reclamar do symlink, baixe pelo caminho real (`<ts>`), não pelo `latest`.

## Passo 4 — limpar o /tmp da central

```sh
rm -f /tmp/db-backup.sh
```

---

## Restore

> ⚠️ Teste em ambiente de scratch antes. `pg_restore` com `-Fc` permite restore seletivo.

```bash
# 1) Só o par preservado (após um clear-all-data):
pg_restore -U hubot -h /var/run/postgresql -d hubot --data-only \
  infra-only_aricanduva_<ts>.dump

# 2) Central inteira (config/topologia), sem histórico:
pg_restore -U hubot -h /var/run/postgresql -d hubot --data-only \
  config-and-infra_aricanduva_<ts>.dump

# 3) Só algumas tabelas:
pg_restore -U hubot -h /var/run/postgresql -d hubot --data-only \
  -t slaves -t channels -t ambients  config-and-infra_aricanduva_<ts>.dump

# 4) Histórico (séries temporais), se precisar:
pg_restore -U hubot -h /var/run/postgresql -d hubot --data-only \
  timeseries_aricanduva_<ts>.dump
```

## ⚠️ TimescaleDB

`logs` é hypertable (confirmado no manual) e provavelmente `consumption`/`raw_energy`/
`temperature_history` também — os dados ficam em `_timescaledb_internal`, não na tabela "pai".

- `config-and-infra` exclui os dados das tabelas-pai **e** `_timescaledb_internal.*` →
  fica realmente sem histórico (leve).
- `timeseries` inclui `_timescaledb_internal.*` (os chunks).
- Para **restaurar** histórico Timescale, pode ser preciso envolver o `pg_restore` em
  `SELECT timescaledb_pre_restore();` … `timescaledb_post_restore();`. Em dúvida, use
  **`FULL=1`** (dump do DB inteiro), o caminho mais seguro para backup/restore completo.
- Contagens no `MANIFEST.txt` usam `reltuples` (estimativa) → hypertables aparecem ~0.

## Minimalista (sem o script)

Os 2 dumps essenciais (leves), pra rodar direto na sessão PuTTY:

```sh
# infra (preservar sempre)
pg_dump -U hubot -h /var/run/postgresql -d hubot -Fc --data-only \
  -t 'public."SequelizeMeta"' -t public.environment -f /tmp/infra-only.dump

# config + topologia, sem séries temporais (exclui dados das hypertables e dos chunks)
pg_dump -U hubot -h /var/run/postgresql -d hubot -Fc \
  --exclude-table-data=public.consumption \
  --exclude-table-data=public.consumption_realtime \
  --exclude-table-data=public.raw_energy \
  --exclude-table-data=public.temperature_history \
  --exclude-table-data=public.logs \
  --exclude-table-data=public.channel_pulse_log \
  --exclude-table-data=public.alert_history \
  --exclude-table-data='_timescaledb_internal.*' \
  -f /tmp/config-and-infra.dump
```

Depois baixe com `pscp` (Passo 3).

## Reaproveitar para outra central
`db-backup.sh` é genérico — rode com `CENTRAL=<nome>` na sessão da central desejada.
