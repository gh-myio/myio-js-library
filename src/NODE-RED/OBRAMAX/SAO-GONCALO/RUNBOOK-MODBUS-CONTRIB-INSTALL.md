# Runbook — Instalar `node-red-contrib-myio-modbus` numa central Orange Pi

> Ticket: [ED-1299](https://myio.atlassian.net/browse/ED-1299) — Modbus na Obramax São Gonçalo.
> Doc da central: [`CENTRAL-OBRAMAX-SAO-GONCALO.md`](./CENTRAL-OBRAMAX-SAO-GONCALO.md).
>
> Procedimento indicado pela arquitetura: **descompactar o pacote em `/data/node-red/node_modules`
> e declarar a dependência no `package.json` com a versão correta.**
>
> Este runbook reflete a **execução real de 30/09/2026 em São Gonçalo**, com as armadilhas do
> BusyBox encontradas no caminho. Referência de "como deve ficar": central **Obramax Jacarepaguá**.

---

## Resumo (TL;DR)

```text
PC ──scp──▶ healthchecks (~/restarter) ──scp -O──▶ central (/tmp)
central: backup package.json → tar -xzf em /data/node-red/node_modules
         → trocar dependência no package.json → chown 61494 → chmod 666 /dev/ttyUSB0
         → restart myio-api → conferir log
```

| Etapa | Onde | Seção |
| --- | --- | --- |
| Preparar o pacote (`.tar.gz`) | PC | §2 |
| Enviar até a central (2 saltos) | PC → healthchecks → central | §3 |
| Pré-checagem | central | §4 |
| Backup | central | §5 |
| Descompactar + `package.json` | central | §6 |
| Permissões (arquivos e serial) | central | §7 |
| Subir e verificar | central | §8 |
| Rollback | central | §9 |

---

## 1. Dados de referência

### 1.1 O pacote

| Campo | Valor |
| --- | --- |
| Origem | `C:\Projetos\GitHub\myio\clientes\MYIO\central\node-red-contrib-myio-modbus.zip` (SHA-256 `caaf289c…4704813`) |
| Repositório | `git@gitlab.com:myio/central/node-red-contrib-myio-modbus.git` |
| Pasta | `node-red-contrib-myio-modbus/` |
| `name` no `package.json` interno | `red-contrib-myio-modbus` (sem o prefixo `node-`) |
| `version` | **`4.0.3`** |
| Nó registrado | `modbus` → `modbus.js` (tipo usado nos flows Obramax) |
| Dependências | `modbus-serial` 7.8.1 · `serialport` 8.0.6 (`@serialport/bindings` 8.0.8) |
| Binário nativo | `bindings.node` — **ELF 32-bit ARM**, compilado para **Node 12.22.12 (ABI 72)** |

> ⚠️ **Não confundir com `node-red-contrib-modbus`** (pacote público do npm, também na versão
> 4.0.3). Ele registra outros tipos de nó (`modbus-read`, `modbus-client`…), **não** o tipo `modbus`
> dos flows MYIO. Era o que estava declarado em São Gonçalo — ver §4.

### 1.2 Como está numa central que funciona — Jacarepaguá (30/09/2026)

| Item | Valor |
| --- | --- |
| Acesso | `ssh -i id_rsa root@201:91a5:f3eb:e718:946e:2c8c:ba67:1028` |
| UUID / Central ID / Frequência | `65d0f8c9-27de-497a-9ef8-c42a9021f3eb` / `43.161.61.73` / `88` |
| `uname -m` / `node -v` | `armv7l` / `v12.21.0` (compatível com o binário) |
| userDir no `server.js:109` | `/usr/lib/node_modules/API/nodered_data/` → **symlink** para `/var/lib/node-red` |
| Diretório real | **`/data/node-red`** — dono `61494:61494` (usuário dinâmico do `myio-api`) |
| Pacote instalado | `node_modules/node-red-contrib-myio-modbus` · `4.0.3` |
| `myio-api.service` | `DynamicUser=yes`, sem `SupplementaryGroups`, sem drop-in |
| Processo | `Uid/Gid 61494`, `Groups: 61494` (**fora do `dialout`**) |
| `/dev/ttyUSB0` | **`crw-rw-rw-` root:dialout (0666)** — é o que deixa o Node-RED abrir a serial |
| Log | leituras Modbus a cada ~4 s, sem `EACCES`/`EBUSY`/`timed out` |

`/data/node-red/package.json` em Jacarepaguá:

```json
{
    "name": "node-red-project",
    "description": "A Node-RED Project",
    "version": "0.0.1",
    "private": true,
    "dependencies": {
        "node-red-contrib-myio-modbus": "^4.0.3",
        "node-red-contrib-postgresql": "^0.14.0"
    }
}
```

> **Pendente:** descobrir *como* Jacarepaguá mantém a porta em 0666 (regra udev ou `chmod` no boot):
>
> ```sh
> grep -rn -iE 'ttyUSB|0666|MODE=' /etc/udev/rules.d/ /lib/udev/rules.d/ 2>/dev/null | head
> grep -rn -iE 'ttyUSB|chmod' /etc/rc.local /etc/systemd/system/*.service /etc/crontab 2>/dev/null | head
> ```

### 1.3 Central alvo — São Gonçalo

| Item | Valor |
| --- | --- |
| IPv6 | `201:16bc:18d:dd1f:373c:c603:92bf:b83d` |
| UUID | `6cbe447e-f32c-46fa-85d7-0340a009aebe` |
| Diretório do Node-RED | `/data/node-red` — dono `61494:61494` |
| `/dev/ttyUSB0` antes | `crw-rw----` `0:20` (root:dialout, **0660**) |
| `package.json` antes | `"node-red-contrib-modbus": "4.0.3"` ❌ · `"node-red-contrib-postgresql": "^0.14.2"` · `"pg": "8.13.3"` |

---

## 2. Preparar o pacote (no PC)

A central roda **BusyBox** (sem garantia de `unzip`). Converter o zip em `.tar.gz` **sem a pasta
`.git`** — o `tar` do BusyBox abre sem problema. No Git Bash:

```sh
cd /tmp && rm -rf modbus-pkg && mkdir modbus-pkg && cd modbus-pkg
unzip -q "C:/Projetos/GitHub/myio/clientes/MYIO/central/node-red-contrib-myio-modbus.zip"
rm -rf node-red-contrib-myio-modbus/.git
tar -czf node-red-contrib-myio-modbus-4.0.3.tar.gz node-red-contrib-myio-modbus
sha256sum node-red-contrib-myio-modbus-4.0.3.tar.gz
```

Arquivo já gerado em 30/09/2026:

| Campo | Valor |
| --- | --- |
| Caminho | `C:\Projetos\GitHub\myio\clientes\MYIO\central\node-red-contrib-myio-modbus-4.0.3.tar.gz` |
| Tamanho | 605 KB · 847 entradas · sem `.git` |
| SHA-256 | `3ba4966aa6ec76a52da5d5b1de82e496bd5032fdee55de724736a4a0b51bf38d` |

---

## 3. Enviar até a central (dois saltos)

O acesso às centrais passa pelo servidor **`ubuntu@healthchecks.myio-bas.com`** (chave pessoal com
senha); dentro dele, na pasta **`~/restarter`**, está a `id_rsa` das centrais.

**3a. PC → healthchecks**

```sh
scp -i ~/.ssh/id_ed25519 "C:/Projetos/GitHub/myio/clientes/MYIO/central/node-red-contrib-myio-modbus-4.0.3.tar.gz" ubuntu@healthchecks.myio-bas.com:~/restarter/
```

**3b. healthchecks → central**

```sh
ssh -i ~/.ssh/id_ed25519 ubuntu@healthchecks.myio-bas.com
cd ~/restarter
scp -O -i id_rsa node-red-contrib-myio-modbus-4.0.3.tar.gz "root@[201:16bc:18d:dd1f:373c:c603:92bf:b83d]:/tmp/"
```

> ⚠️ **`scp -O` é obrigatório.** Sem ele o `scp` novo usa SFTP, que a central não tem, e falha com
> `scp: Connection closed`. O IPv6 vai **entre colchetes e aspas**.
> Alternativa: `cat arquivo | ssh -i id_rsa root@<ipv6> "cat > /tmp/arquivo"`.

**3c. Entrar na central e conferir**

```sh
ssh -i id_rsa root@201:16bc:18d:dd1f:373c:c603:92bf:b83d
ls -l /tmp/node-red-contrib-myio-modbus-4.0.3.tar.gz
sha256sum /tmp/node-red-contrib-myio-modbus-4.0.3.tar.gz
# esperado: 3ba4966aa6ec76a52da5d5b1de82e496bd5032fdee55de724736a4a0b51bf38d
```

---

## 4. Pré-checagem (na central, só leitura)

```sh
uname -m; node -v                       # esperado: armv7l / v12.x
ls -ldn /data/node-red                  # anotar o UID dono (61494 nas centrais vistas)
cat /data/node-red/package.json
ls -d /data/node-red/node_modules/*modbus* 2>/dev/null
ls -ln /dev/ttyUSB*
```

Decisão:

- `package.json` já tem `node-red-contrib-myio-modbus` **e** a pasta existe em `node_modules` →
  **não reinstalar**; ir direto ao §7 (serial) / §8.
- `package.json` tem `node-red-contrib-modbus` (pacote público) ou nada → seguir §5–§8.
- `uname -m` ≠ `armv7l` ou Node ≠ 12 → **parar**: o binário do pacote não serve; recompilar o
  pacote para a plataforma antes.

---

## 5. Backup

> ⚠️ Nessas centrais **não existe `/root`** (`cp: can't create '/root/…'`). Guardar em `/data`.

```sh
cp /data/node-red/package.json /data/package.json.bak
ls -l /data/package.json.bak
```

Recomendado também: exportar os flows pelo editor (Menu → Export → All flows) antes de reiniciar.

---

## 6. Instalar

### 6.1 Parar o serviço (opcional, recomendado)

```sh
systemctl stop myio-api.service
```

> Para o Node-RED **e** a API da central. Combinar a janela com a loja.

### 6.2 Descompactar em `node_modules`

```sh
cd /data/node-red/node_modules
tar -xzf /tmp/node-red-contrib-myio-modbus-4.0.3.tar.gz
ls node-red-contrib-myio-modbus/modbus.js
```

### 6.3 Ajustar o `package.json`

Trocar **só** a dependência do Modbus, preservando as demais (`postgresql`, `pg`):

```sh
sed -i 's/"node-red-contrib-modbus": "4.0.3"/"node-red-contrib-myio-modbus": "^4.0.3"/' /data/node-red/package.json
cat /data/node-red/package.json
```

Resultado esperado em São Gonçalo:

```json
{
    "name": "node-red-project",
    "description": "A Node-RED Project",
    "version": "0.0.1",
    "private": true,
    "dependencies": {
        "node-red-contrib-myio-modbus": "^4.0.3",
        "node-red-contrib-postgresql": "^0.14.2",
        "pg": "8.13.3"
    }
}
```

> Se a central **não tiver** nenhuma linha de Modbus, acrescentar
> `"node-red-contrib-myio-modbus": "^4.0.3",` dentro de `dependencies` com `vi`.
> Validar o JSON:
> `node -e "JSON.parse(require('fs').readFileSync('/data/node-red/package.json','utf8'));console.log('ok')"`

---

## 7. Permissões

### 7.1 Dono dos arquivos

> ⚠️ O `chown` do BusyBox **não aceita `--reference`**. Usar o UID numérico visto no §4.

```sh
chown -R 61494:61494 /data/node-red/node_modules/node-red-contrib-myio-modbus
```

### 7.2 Liberar a porta serial

O `myio-api` roda com `DynamicUser=yes` e **fora do grupo `dialout`**; com a porta em `0660` ele
não abre a serial. Deixar igual a Jacarepaguá:

```sh
chmod 666 /dev/ttyUSB0
ls -l /dev/ttyUSB0          # esperado: crw-rw-rw- root dialout
```

> ⚠️ **Não é permanente:** o `chmod` se perde em reboot ou se o adaptador USB for reconectado.
> Tornar permanente com o mesmo mecanismo usado em Jacarepaguá (pendente — §1.2), por exemplo uma
> regra udev `KERNEL=="ttyUSB*", MODE="0666"`. Confirmar antes se `/etc` persiste na imagem Mender.

---

## 8. Subir e verificar

```sh
systemctl start myio-api.service        # ou restart, se não parou no §6.1
systemctl status myio-api.service --no-pager | head -5
sleep 30
journalctl -u myio-api.service --since "-2 min" --no-pager | grep -iE 'modbus|ttyUSB|EACCES|EBUSY|timed out|missing|compiled|Started flows' | tail -25
```

| O que aparece | Significado |
| --- | --- |
| `interface: '/dev/ttyUSB0'` + `Client: ModbusRTU {` repetindo | ✅ nó carregado e lendo (igual a Jacarepaguá) |
| `Waiting for missing types` / `unknown type: modbus` | pacote não carregou — conferir §6.2/§6.3 |
| `was compiled against a different Node.js version` / `wrong ELF class` | binário incompatível (§1.1) |
| `EACCES` / `Permission denied` | porta sem permissão — §7.2 |
| `EBUSY` / `Resource busy` | outro processo com a porta (2 nós `modbus` no flow, ou `myio.service`) |
| `Timed out` | porta ok, medidor não responde — slave id, baud/paridade/stop bits, fiação A/B |
| `ReferenceError: process is not defined` em `Memoria Node-RED (RSS + caches)` | **não é do Modbus** — função do Supervisório usa `process`, indisponível em function node; pré-existente |

Validação funcional: no editor, o nó `Modbus` sem marca de tipo desconhecido; debug `Modbus_Debug`
recebendo `[hi, lo]`; telemetria chegando no ThingsBoard / Helexia.

> São Gonçalo tem **dois nós `modbus` na mesma `/dev/ttyUSB0`** (Flow 1 e Supervisório) — ver §4.1
> do doc da central. Se der `EBUSY` ou timeouts intermitentes, desativar um dos dois para isolar.

---

## 9. Rollback

Volta ao estado anterior à instalação (`package.json` original, sem o pacote, porta em 0660):

```sh
systemctl stop myio-api.service
cp /data/package.json.bak /data/node-red/package.json
rm -rf /data/node-red/node_modules/node-red-contrib-myio-modbus
chmod 660 /dev/ttyUSB0
systemctl start myio-api.service
```

Conferir:

```sh
cat /data/node-red/package.json
systemctl status myio-api.service --no-pager | head -5
```

> A instalação não apaga nem sobrescreve nada além do `package.json` (que tem backup), então o
> rollback é completo.

---

## 10. Armadilhas encontradas (BusyBox / acesso)

| Sintoma | Causa | Solução |
| --- | --- | --- |
| `scp: Connection closed` | `scp` novo usa SFTP; central não tem | `scp -O` |
| `cp: can't create '/root/…'` | não existe `/root` | usar `/data` |
| `chown: unrecognized option '--reference'` | BusyBox | `chown -R 61494:61494` |
| `tar: can't open '/tmp/…tar.gz'` | arquivo ainda não foi enviado | fazer o §3 antes |
| `unzip` pode não existir | BusyBox | enviar `.tar.gz` (§2) |
| Log vazio logo após o restart | serviço ainda subindo | `sleep 30` antes do `journalctl` |

---

## 11. Registro de execuções

| Data | Central | Quem | O que foi feito | Resultado |
| --- | --- | --- | --- | --- |
| 30/09/2026 | Obramax Jacarepaguá | Rodrigo | Levantamento de referência (só leitura) | Pacote `4.0.3` instalado, porta 0666, Modbus lendo |
| 30/09/2026 | Obramax São Gonçalo | Rodrigo | §3–§8: pacote descompactado, `package.json` corrigido (`node-red-contrib-modbus` → `node-red-contrib-myio-modbus ^4.0.3`), `chown 61494`, `chmod 666 /dev/ttyUSB0`, restart | _Resultado da verificação do §8 não registrado; rollback (§9) solicitado em seguida — **confirmar o estado final da central**_ |
