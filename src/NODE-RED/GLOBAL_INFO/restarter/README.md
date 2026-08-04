# restarter — rodar um comando na frota inteira de centrais

Automatiza o que hoje é feito **central por central na mão**: entrar via SSH e
rodar `systemctl restart myio-api.service` (ou qualquer comando).

## 🔒 Exclusivo do Líder Técnico

Depende da chave **`id_rsa`** (assinada e liberada para **todas** as centrais),
que vive **apenas no box `restarter`** — `ubuntu@healthchecks.myio-bas.com`
(`ip-172-31-81-79`), em `~/restarter`. **Só o Líder Técnico (Rodrigo) tem essa
chave.** Este script **não serve para quem não tem a `id_rsa`** (ex.: não roda na
máquina do Victor). A chave **não** está versionada aqui — só é referenciada pelo nome.

## Fluxo

1. PuTTY → `ubuntu@healthchecks.myio-bas.com:22` com a **chave privada `.ppk`** (+ passphrase).
2. `cd restarter`
3. `./run-fleet.sh 'systemctl restart myio-api.service'`

```bash
./run-fleet.sh                                   # restart (default) em todas
./run-fleet.sh 'systemctl restart myio-api.service'
./run-fleet.sh 'systemctl is-active myio-api.service'          # só checar
./run-fleet.sh 'systemctl show -p ActiveEnterTimestamp --value myio-api.service'
```

No fim ele imprime **`N OK · M falharam`** e lista as que falharam (`✗`) — as
**offline dão timeout** e caem aí (útil pra saber quais reprocessar depois).

## Por que resolve os 2 atritos manuais

As flags de SSH (dentro do script) eliminam a dança do dia a dia:

| Atrito manual | Flag |
|---|---|
| pede `yes` na 1ª conexão | `-o StrictHostKeyChecking=no` |
| `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED` | `-o UserKnownHostsFile=/dev/null` |
| warning poluindo | `-o LogLevel=ERROR` |
| central offline travando | `-o ConnectTimeout=10` |
| cair pra senha | `-o BatchMode=yes` |

O `HOST KEY CHANGED` acontece porque as centrais são **re-imageadas (Mender)** e
trocam a host key — por isso **não faz sentido manter `known_hosts`** pra elas.
Com `UserKnownHostsFile=/dev/null` o erro **nunca** aparece e você **não precisa**
mais rodar `ssh-keygen -R ... && tentar de novo`.

> ⚠️ **Tradeoff:** essas flags **desligam a verificação de host** (proteção MITM).
> É aceitável nesta **mesh Yggdrasil privada**, para a **própria frota**. Não use
> esse padrão para hosts fora da mesh.

## `centrais.txt`

Formato `nome|IPv6`, uma por linha (linhas com `#` e vazias são ignoradas).
É **gerado do manual** (fonte única) — só centrais **ativas** (as inativadas
`~~...~~` ficam de fora). Para **regenerar** após mexer no manual:

```bash
# a partir da raiz do repo myio-js-library:
node -e '
const fs=require("fs");
const md=fs.readFileSync("src/NODE-RED/GLOBAL_INFO/manual-centrais-linix-orangepi.md","utf8");
for(const l of md.split(/\r?\n/)){
  if(!l.startsWith("|")||/~~/.test(l)) continue;
  const c=l.split("|").map(s=>s.trim());
  const m=(c[2]||"").match(/`(20[0-9a-f]:[0-9a-f:]+)`/i);
  if(c[1] && c[1]!=="Central" && m) console.log(c[1].replace(/\s+/g," ")+"|"+m[1]);
}' > src/NODE-RED/GLOBAL_INFO/restarter/centrais.txt
```

## Dica: versão paralela (frota inteira em segundos)

```bash
KEY=id_rsa; OPTS="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10 -o BatchMode=yes"
CMD='systemctl restart myio-api.service'
grep -v '^\s*#' centrais.txt | grep '|' | xargs -P 8 -I{} bash -c '
  l="{}"; nome="${l%%|*}"; ip="${l##*|}"
  ssh '"$OPTS"' "root@$ip" "'"$CMD"'" >/dev/null 2>&1 && echo "OK   $nome" || echo "FAIL $nome"'
```

> ⚠️ CRLF: se o `run-fleet.sh` foi para o box via checkout Windows, rode
> `sed -i 's/\r$//' run-fleet.sh` antes (o `.gitattributes` aqui já força LF no repo).
