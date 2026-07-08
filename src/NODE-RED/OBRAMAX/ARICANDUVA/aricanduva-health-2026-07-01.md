# Central Aricanduva — Health / Load Snapshot

| Campo          | Valor                                                          |
| -------------- | ------------------------------------------------------------- |
| Data da coleta | 2026-07-01 (~19:44 local)                                     |
| Holding        | OBRAMAX                                                       |
| Central        | Aricanduva                                                   |
| IPv6 (mesh)    | `200:bc45:34ee:59da:371a:cfe9:98d3:3805`                     |
| Gateway ID     | `1e0c1d77-1d41-4004-8be7-41328e590111`                       |
| Acesso         | `ssh -i id_rsa root@200:bc45:34ee:59da:371a:cfe9:98d3:3805`  |
| SO / Shell     | imagem MyIO (Mender) · BusyBox `ash` · systemd               |
| Node-RED       | embarcado no `myio-api.service` (porta `8080`, editor `/red`) |
| PID do node    | **5549** (`/usr/bin/node .../API/server.js`)                 |

---

## Coleta

### `cat /proc/loadavg` (2 leituras)

```
0.12 0.07 0.06 1/178 7244
0.32 0.14 0.09 2/178 7274
```

### `uptime`

```
 19:44:22 up 2 days, 23:54,  load average: 0.27, 0.13, 0.08
```

### `top -b -n1 | head -20`

```
Mem: 499536K used, 10004K free, 121648K shrd, 14144K buff, 265784K cached
CPU:   0% usr   2% sys   0% nic  97% idle   0% io   0% irq   0% sirq
Load average: 0.23 0.13 0.08 1/179 7279
  PID  PPID USER     STAT   VSZ %VSZ %CPU COMMAND
  325     1 root     S     906m 182%   0% /usr/bin/mender daemon
  294     1 root     S     902m 181%   0% /usr/bin/yggdrasil -useconffile /etc/yggdrasil.conf
  326     1 root     S     893m 179%   0% /usr/bin/mender-connect daemon
 5549     1 61494    S     226m  45%   0% /usr/bin/node /usr/lib/node_modules/API/server.js
  446   245 postgres S     154m  31%   0% postgres: hubot hubot 127.0.0.1(46734) idle
  445   245 postgres S     153m  31%   0% postgres: hubot hubot 127.0.0.1(46730) idle
  444   245 postgres S     153m  31%   0% postgres: hubot hubot 127.0.0.1(46728) idle
  302   245 postgres S     153m  31%   0% postgres: TimescaleDB Background Worker Scheduler
  298   245 postgres S     152m  31%   0% postgres: autovacuum launcher
  300   245 postgres S     152m  31%   0% postgres: TimescaleDB Background Worker Launcher
  301   245 postgres S     152m  31%   0% postgres: logical replication launcher
  295   245 postgres S     151m  30%   0% postgres: checkpointer
  297   245 postgres S     151m  30%   0% postgres: walwriter
  245     1 postgres S     151m  30%   0% /usr/bin/postgres
  296   245 postgres S     151m  30%   0% postgres: background writer
  336     1 root     S     135m  27%   0% /usr/lib/myio/erts-12.3.2.11/bin/beam.smp -- -root /usr/lib/myio ... -setcookie <REDACTED-COOKIE> -sname myio -config .../sys -boot .../start ... --no-halt
```

### `free -m` (2 leituras)

```
              total        used        free      shared  buff/cache   available
Mem:            497         213          10         118         273         188
Swap:           485          11         474
              total        used        free      shared  buff/cache   available
Mem:            497         214           9         118         273         187
Swap:           485          11         474
```

### `ps -ef | grep -E 'node|myio' | grep -v grep`

```
  336 root     33:56 /usr/lib/myio/erts-12.3.2.11/bin/beam.smp -- -root /usr/lib/myio ... -setcookie <REDACTED-COOKIE> -sname myio -config .../sys -boot .../start ... --no-halt
  368 root      0:04 /usr/lib/myio/erts-12.3.2.11/bin/epmd -daemon
 5549 61494     9:18 /usr/bin/node /usr/lib/node_modules/API/server.js
```

### `cat /proc/5549/status | grep -E 'VmRSS|VmSize'` (RSS do Node-RED)

> ⏳ **Não capturado.** A 1ª tentativa usou o PID `761` (Moxuara) e a 2ª usou a var
> `$NODEPID` vazia (`/proc//status`). Agora que o PID é **5549**, refazer:
>
> ```sh
> cat /proc/5549/status | grep -E 'VmRSS|VmSize'
> ```
>
> No `top`, o node aparece com **VSZ 226m / 45%** — mas VSZ é virtual; o `VmRSS` é o real.

---

## Análise (2026-07-01)

| Item             | Leitura                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Uptime**       | up **2 dias 23h54** (~3 dias). Central **estável**, sem reboot recente (contraste com a Moxuara, ~14 min de boot).             |
| **Load average** | ~0.23–0.32 (1 min) · 0.13 (5 min) · 0.08 (15 min). CPU **97% idle**. Ociosa e plana — sem gargalo de CPU.                       |
| **Memória**      | total 497 MB · used ~213–214 MB · **available ~187–188 MB** · buff/cache 273 MB · free "puro" ~9–10 MB (normal). Folga **menor** que a Moxuara (≈188 vs 264 MB). |
| **Swap**         | **11 MB** em uso (de 485). Mínimo/estável, sem pressão — mas diferente da Moxuara (0 usado). Monitorar tendência.               |
| **Node-RED**     | PID **5549** · CPU 0% · VSZ 226m (45%). `VmRSS` real pendente (1 comando). CPU acumulada 9:18.                                  |
| **myio.service** | `beam.smp` PID 336 (Erlang/OTP · rádio/Modbus) + `epmd` 368 → **OK**.                                                          |
| **Postgres**     | DB `hubot` + workers TimescaleDB ativos → **OK**.                                                                              |

### ⚠️ Pontos de atenção

1. **`myio-exporter` AUSENTE.** Na Moxuara havia `/usr/bin/myio-exporter -listen=:9100` (métricas Prometheus). Aqui **não aparece** no `top`/`ps` (o `grep 'myio'` o pegaria). Impacto: esta central **não expõe métricas em `:9100`** → sem monitoramento externo/Prometheus. Verificar:
   ```sh
   systemctl status myio-exporter
   systemctl is-enabled myio-exporter
   ```
   e reativar se for esperado rodar.
2. **Folga de RAM menor + swap com 11 MB** (available ~187 MB). Sem alarme agora, mas monitorar se `Swap used` crescer.
3. **Capturar o `VmRSS` do node** (PID 5549) para fechar a medição de memória do Node-RED.

### Veredito

Central **operacional e saudável** — uptime longo, load baixo, `available` 187 MB, serviços core no ar. Atenção principal: **`myio-exporter` parado** (monitoramento).

---

> 🔒 **Segurança:** o `-setcookie` do Erlang (`beam.smp`) foi **redactado** (`<REDACTED-COOKIE>`) — é segredo de cluster. Não versionar o cookie real.
