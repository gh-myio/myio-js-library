# Runbook — Dump do cadastro de uma central para JSON

Gera, para **qualquer central**, os JSONs de cadastro do banco `hubot` + um mapa legível:

| Arquivo gerado | Tabela no banco da central |
|---|---|
| `slaves.json` | `slaves` |
| `channels.json` | `channels` |
| `ambients.json` | `ambients` |
| `ambients_slaves_rel.json` | `ambients_rfir_slaves_rel` |
| `ambients_devices_rel.json` | `ambients_rfir_devices_rel` |
| `slaves-map.md` | (derivado) slave → channels → ambients, ambients vazios, nomes com espaço sobrando |

Formato dos JSONs (igual a `SOUL-MALLS/CONTAGEM/`): `{ "_meta": { central, table, rowCount, capturedAt, source }, "rows": [ ...uma linha por registro... ] }`.

**Somente leitura**: cada tabela é lida com `SELECT json_agg(row_to_json(t))`. Nada é gravado na central.

Script: [`dump-cadastro.py`](dump-cadastro.py) (nesta pasta).

---

## 1. Como o acesso funciona

```
sua máquina ──(~/.ssh/id_ed25519 via ssh-agent)──▶ ubuntu@healthchecks.myio-bas.com
            ──(cd restarter; ssh -i id_rsa)──────▶ root@<IPv6 Yggdrasil da central>
            ──(sh -s, SQL pelo stdin)────────────▶ psql -U hubot
```

- A `id_rsa` da frota fica **só no box restarter** — nunca é copiada para a sua máquina.
- Quem alcança a central pelo Yggdrasil é o box → **não precisa de Yggdrasil local**.
- O SQL vai pelo stdin (`sh -s`), então não há aspas aninhadas no salto duplo.

## 2. Pré-requisitos

| Item | Detalhe |
|---|---|
| Python 3 | `python --version` |
| OpenSSH do Windows | `C:\Windows\System32\OpenSSH\ssh.exe` (vem no Windows 10/11) |
| Acesso ao box | sua `~/.ssh/id_ed25519` autorizada em `ubuntu@healthchecks.myio-bas.com` |
| Dados da central | IPv6, nome, Gateway ID, Central ID, Frequência — no [`manual-centrais-linix-orangepi.md`](manual-centrais-linix-orangepi.md) §2.2 |

**ssh-agent — automático.** Na 1ª execução o script:
1. se o serviço `ssh-agent` estiver desativado, liga (Automático + Start) — **aceite o UAC**;
2. se a `id_ed25519` não estiver no agent, roda `ssh-add` e **pede a senha da chave uma vez**.

O agent do Windows guarda a chave (sobrevive a reboot) → nas próximas execuções **não há prompt nenhum**. Por isso a 1ª execução precisa ser feita por você num terminal (a senha é interativa); depois disso o Claude Code também consegue rodar.

## 3. Executar

Da raiz do repo (PowerShell):

```powershell
python -I src\NODE-RED\GLOBAL_INFO\dump-cadastro.py `
  --host 201:3bed:541b:8c61:3e69:9:d453:1bef `
  --name "Central Raiz Educação (Raiz Educação)" `
  --gateway 1deb2d86-2b76-4f88-b86f-18b3a3f33b98 `
  --central-id 197.20.86.102 `
  --freq 102 `
  --out src\NODE-RED\RAIZ-EDUCACAO
```

Saída esperada:

```
slaves.json                  slaves                       55
channels.json                channels                     9
ambients.json                ambients                     55
ambients_slaves_rel.json     ambients_rfir_slaves_rel     188
ambients_devices_rel.json    ambients_rfir_devices_rel    0
slaves-map.md gerado
```

`AUSENTE` no lugar da contagem = a tabela não existe nesse banco (o JSON sai com `rowCount: null` e nota).

### Argumentos

| Argumento | Obrigatório | Descrição |
|---|---|---|
| `--host` | ✅ | IPv6 Yggdrasil da central |
| `--name` | ✅ | Nome usado no `_meta` e no título do `slaves-map.md` |
| `--out` | ✅ | Pasta de saída (criada se não existir), ex.: `src\NODE-RED\<HOLDING>\<CENTRAL>` |
| `--gateway` / `--central-id` / `--freq` | — | Só aparecem no cabeçalho do `slaves-map.md` (default `—`) |
| `--via` | — | Box de salto (default `ubuntu@healthchecks.myio-bas.com`) |
| `--box-dir` | — | Pasta no box com a `id_rsa` (default `restarter`) |
| `--box-key` | — | Chave para o box (default `~/.ssh/id_ed25519`; `''` = só o agent) |
| `--direct --key <id_rsa>` | — | Sem box: SSH direto da sua máquina (exige a `id_rsa` da frota local **e** Yggdrasil 0.3.x ativo — ver §5) |

⚠ Os arquivos em `--out` são **sobrescritos**. Se a pasta já tiver JSONs editados à mão (ex.: com `note` no `_meta`), faça cópia antes.

## 4. Conferência pós-dump

1. Abra o `slaves-map.md`:
   - `⚠ sem ambient` → slave sem vínculo em `ambients_rfir_slaves_rel`;
   - `⚠ vazio` na tabela de Ambients → ambient sem slaves;
   - `` `nome ` ⚠ espaço `` → nome com espaço à esquerda/direita (quebra o casamento de nome com o ThingsBoard);
   - seção **Channels sem slave_id** → channels órfãos (normalmente teste de bancada).
2. Sanidade rápida (opcional):

```powershell
python -I -c "import json,collections;p=r'src\NODE-RED\RAIZ-EDUCACAO\\';L=lambda f:json.load(open(p+f,encoding='utf-8'))['rows'];s=L('slaves.json');a=L('ambients.json');r=L('ambients_slaves_rel.json');sid={x['id'] for x in s};aid={x['id'] for x in a};print('rel órfã',sum(1 for x in r if x['slave_id'] not in sid or x['ambient_id'] not in aid));print('addr_low duplicado',[k for k,v in collections.Counter((x['addr_low'],x['addr_high']) for x in s).items() if v>1]);print('MQTT Sync',[x['name'] for x in s if 'MQTT' in x['name']])"
```

3. Commit (só com OK explícito): `src/NODE-RED/**` pode ir direto na `desenv`; antes, confira que nenhum JSON tem segredo (ex.: tokens em `config`).

## 5. Troubleshooting

| Sintoma | Causa | Ação |
|---|---|---|
| `ERRO: não consegui iniciar o ssh-agent` | UAC recusado | Rodar de novo e aceitar o UAC |
| `ERRO: ssh-add falhou` | Senha da `id_ed25519` errada | Rodar de novo |
| `Permission denied (publickey)` **no box** | `id_ed25519` não autorizada em `ubuntu@healthchecks` | Pedir inclusão da sua `.pub` no `~/.ssh/authorized_keys` do box |
| `Permission denied (publickey,password)` **na central** | `id_rsa` do box não autorizada nessa central | Verificar `authorized_keys` da central |
| `Connection timed out` porta 22 da central | Central offline ou fora do Yggdrasil | Conferir no box: `ping6 <ipv6>`; ver `restarter/centrais.txt` |
| `--direct`: timeout | Yggdrasil local sem peer — a rede das centrais é **0.3.x**; o serviço `Yggdrasil` 0.4.7 do Windows **não faz peering** | `C:\Programas\yggdrasil-0.3.16\run-test.ps1` como Admin (para o 0.4.7 e sobe o 0.3.16); conferir com `yggdrasilctl -endpoint tcp://127.0.0.1:9004 getPeers` |
| `--direct`: `Permission denied` em todas | A `id_rsa` local não é a da frota | Usar o modo padrão (via box) |
| `AUSENTE` em uma tabela | Tabela não existe nessa versão do banco | Normal em centrais antigas (ex.: sem RFIR) |

## 6. Histórico

| Data | Central | Saída | Resultado |
|---|---|---|---|
| 2026-11-16 | Central Raiz Educação | `src/NODE-RED/RAIZ-EDUCACAO/` | 55 slaves · 9 channels · 55 ambients · 188 rel · 0 devices_rel |
