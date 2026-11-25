# Runbook — Dump do cadastro de uma central para JSON

Gera, para **qualquer central**, os JSONs de cadastro do banco `hubot` + um mapa legível:

| Arquivo gerado | Tabela no banco da central |
|---|---|
| `slaves.json` | `slaves` |
| `channels.json` | `channels` |
| `ambients.json` | `ambients` |
| `ambients_slaves_rel.json` | `ambients_rfir_slaves_rel` |
| `ambients_devices_rel.json` | `ambients_rfir_devices_rel` |
| `rfir_devices.json` | `rfir_devices` (device lógico IR → `slave_id`, `command_on_id`/`command_off_id`) |
| `rfir_remotes.json` | `rfir_remotes` (controle remoto → `rfir_device_id`) |
| `rfir_commands.json` | `rfir_commands` (comando IR gravado: `page_low`/`page_high`, `rfir_device_id`) |
| `rfir_buttons.json` | `rfir_buttons` (botão do controle → `rfir_remote_id` + `rfir_command_id`) |
| `slaves-map.md` | (derivado) slave → channels → ambients, ambients vazios, nomes com espaço sobrando + RFIR devices (cmd ON/OFF) e remotes → buttons |

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
| `AUSENTE` em uma tabela | Tabela não existe nessa versão do banco | Normal em centrais antigas (ex.: sem RFIR). O erro do psql agora aparece como `psql [tabela]: …` |
| `psql: could not connect … socket "/tmp/.s.PGSQL.5432"` | Em parte da frota o psql procura o socket em `/tmp`, mas o Postgres escuta em `/var/run/postgresql` | O script já detecta sozinho (tenta padrão → `/var/run/postgresql` → `/run/postgresql` → `localhost`) |
| `ERRO: psql não retornou a tabela slaves — nada foi gravado` | psql falhou por completo | Fail-safe: nenhum arquivo é sobrescrito nem pasta criada; ver a mensagem `psql [slaves]` |

## 6. Histórico

| Data | Central | Saída | Resultado |
|---|---|---|---|
| 2026-11-16 | Central Raiz Educação | `src/NODE-RED/RAIZ-EDUCACAO/` | 55 slaves · 9 channels · 55 ambients · 188 rel · 0 devices_rel |
| 2026-11-16 | Rio Poty (Sá Cavalcante) | `src/NODE-RED/SA-CAVALCANTE/RIO-POTY/` | 406 slaves · 214 channels · 329 ambients · 432 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Shopping da Ilha - ENTRADA - 2026-10-06 | `src/NODE-RED/SA-CAVALCANTE/SHOPPING-DA-ILHA-ENTRADA/` | 5 slaves · 3 channels · 5 ambients · 5 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Shopping Ananindeua (Sá Cavalcante) | `src/NODE-RED/SA-CAVALCANTE/ANANINDEUA/` | 361 slaves · 243 channels · 281 ambients · 389 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Souza Aguiar — CO2 | `src/NODE-RED/SOUZA-AGUIAR/CENTRAL-CO2/` | 77 slaves · 72 channels · 36 ambients · 73 rel · 0 devices_rel · rfir 22/23/1/1 |
| 2026-11-16 | Souza Aguiar — Ar Comprimido | `src/NODE-RED/SOUZA-AGUIAR/CENTRAL-AR-COMPRIMIDO/` | 14 slaves · 14 channels · 9 ambients · 15 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Souza Aguiar — Maternidade Nova | `src/NODE-RED/SOUZA-AGUIAR/CENTRAL-MATERNIDADE/` | 41 slaves · 9 channels · 21 ambients · 38 rel · 0 devices_rel · rfir 2/2/0/0 |
| 2026-11-16 | Souza Aguiar — T&D | `src/NODE-RED/SOUZA-AGUIAR/CENTRAL-TED/` | 28 slaves · 36 channels · 12 ambients · 33 rel · 0 devices_rel · rfir 4/4/1/1 |
| 2026-11-16 | Souza Aguiar — Gerador | `src/NODE-RED/SOUZA-AGUIAR/CENTRAL-GERADOR/` | 4 slaves · 10 channels · 7 ambients · 12 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Macaé (Soul Malls) | `src/NODE-RED/SOUL-MALLS/MACAE/` | 167 slaves · 18 channels · 159 ambients · 168 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Ilha Plaza AL2 - 2026-10-22 | `src/NODE-RED/SOUL-MALLS/ILHA-PLAZA-AL2/` | 85 slaves · 2 channels · 16 ambients · 85 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Shopping Contagem (Soul Malls) | `src/NODE-RED/SOUL-MALLS/CONTAGEM/` | 274 slaves · 14 channels · 12 ambients · 273 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Shopping Capim Dourado 2.0 - 2026-07-30 | `src/NODE-RED/SOUL-MALLS/CAPIM-DOURADO/` | 249 slaves · 243 channels · 246 ambients · 247 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | West Plaza - NOVA - 2026-09-28 | `src/NODE-RED/SOUL-MALLS/WEST-PLAZA/` | 240 slaves · 2 channels · 209 ambients · 230 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Supervia CCO 2026-10-05 | `src/NODE-RED/SUPERVIA/CCO/` | 86 slaves · 71 channels · 32 ambients · 270 rel · 0 devices_rel · rfir 29/29/127/72 |
| 2026-11-16 | Praia Grande (Obramax) | `src/NODE-RED/OBRAMAX/PRAIA_GRANDE/` | 47 slaves · 117 channels · 23 ambients · 82 rel · 0 devices_rel · rfir 5/5/47/19 |
| 2026-11-16 | Aricanduva (Obramax) | `src/NODE-RED/OBRAMAX/ARICANDUVA/` | 47 slaves · 144 channels · 26 ambients · 48 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Benfica (Obramax) | `src/NODE-RED/OBRAMAX/BENFICA/` | 52 slaves · 132 channels · 17 ambients · 86 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Mesquita (Obramax) | `src/NODE-RED/OBRAMAX/MESQUITA/` | 57 slaves · 149 channels · 23 ambients · 110 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Jacarepaguá (Obramax) | `src/NODE-RED/OBRAMAX/JACAREPAGUA/` | 50 slaves · 106 channels · 18 ambients · 78 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | São Gonçalo (Obramax) | `src/NODE-RED/OBRAMAX/SAO-GONCALO/` | 45 slaves · 143 channels · 11 ambients · 73 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Fábrica MYIO | `src/NODE-RED/MYIO/CENTRAL-FABRICA-MYIO/` | 43 slaves · 81 channels · 13 ambients · 45 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Mestre Álvaro — L0L1 | `src/NODE-RED/SA-CAVALCANTE/MESTRE-ALVARO-L0L1/` | 143 slaves · 128 channels · 102 ambients · 297 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Mestre Álvaro — L2AC | `src/NODE-RED/SA-CAVALCANTE/MESTRE-ALVARO-L2AC/` | 199 slaves · 101 channels · 92 ambients · 429 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Mestre Álvaro — L3L4 | `src/NODE-RED/SA-CAVALCANTE/MESTRE-ALVARO-L3L4/` | 126 slaves · 102 channels · 103 ambients · 380 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Mestre Álvaro — Entrada | `src/NODE-RED/SA-CAVALCANTE/MESTRE-ALVARO-ENTRADA/` | 2 slaves · 1 channel · 2 ambients · 2 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Shopping da Ilha (Sá Cavalcante) | `src/NODE-RED/SA-CAVALCANTE/SHOPPING-DA-ILHA/` | 429 slaves · 240 channels · 310 ambients · 428 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Moxuara 2.0 - 2026-07-13 | `src/NODE-RED/SA-CAVALCANTE/MOXUARA/` | 348 slaves · 190 channels · 259 ambients · 381 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Montserrat (Sá Cavalcante) | `src/NODE-RED/SA-CAVALCANTE/MONTSERRAT/` | 195 slaves · 128 channels · 128 ambients · 203 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Praia da Costa L1 (Soul Malls) | `src/NODE-RED/SOUL-MALLS/PRAIA-DA-COSTA-L1/` | 122 slaves · 62 channels · 19 ambients · 154 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Praia da Costa L3 (Soul Malls) | `src/NODE-RED/SOUL-MALLS/PRAIA-DA-COSTA-L3/` | 223 slaves · 47 channels · 25 ambients · 393 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Ilha Plaza AL3 (Soul Malls) | `src/NODE-RED/SOUL-MALLS/ILHA-PLAZA-AL3/` | 73 slaves · 22 channels · 14 ambients · 70 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Campinas Shopping — G1 G2 | `src/NODE-RED/CAMPINAS/CAMPINAS-G1-G2/` | 58 slaves · 36 channels · 29 ambients · 171 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Campinas Shopping — G0 Nova | `src/NODE-RED/CAMPINAS/campinas_shopping_g0_nova/` | 77 slaves · 23 channels · 26 ambients · 220 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Campinas Shopping — G0 Hidrômetros Novo - 2026-09-03 | `src/NODE-RED/SOUL-MALLS/CAMPINAS-HIDROMETROS-G0-NOVO/` | 84 slaves · 147 channels · 67 ambients · 219 rel · 0 devices_rel · rfir 0/1/0/0 |
| 2026-11-16 | Campinas Shopping — G1 G2 Hidrômetros | `src/NODE-RED/CAMPINAS/campinas_shopping_hidrometros_g1_g2/` | 20 slaves · 44 channels · 25 ambients · 42 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Campinas Shopping — Subestação Principal | `src/NODE-RED/CAMPINAS/campinas_shopping_subestac_ao_principal/` | 9 slaves · 4 channels · 9 ambients · 25 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-16 | Central Shopping Taboão - 2026-10-19 | `src/NODE-RED/SHOPPING-TABOAO/CENTRAL-TABOAO/` | 324 slaves · 211 channels · 202 ambients · 324 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-22 | Central Deodoro - 2026-10-22 (backup antes da realocação p/ Mogi Shopping) | `src/NODE-RED/SUPERVIA/DEODORO/BKP-CADASTRO-2026-11-22/` | 56 slaves · 0 channels · 13 ambients · 53 rel · 0 devices_rel · rfir 7/7/40/34 |
| 2026-11-24 | Central Ananindeua Entrada de Energia - 2026-11-16 (Sá Cavalcante) | `src/NODE-RED/SA-CAVALCANTE/ANANINDEUA-ENTRADA/` | 2 slaves · 1 channel · 3 ambients · 2 rel · 0 devices_rel · rfir 0/0/0/0 |
| 2026-11-25 | Goiabeiras Shopping (Soul Malls) | `src/NODE-RED/SOUL-MALLS/GOIABEIRAS/` | 173 slaves · 1 channel · 173 ambients · 173 rel · 0 devices_rel · rfir 0/0/0/0 (1ª tentativa: timeout SSH, latência 0,2–1,5 s; 2ª ok) |

> rfir = rfir_devices/remotes/commands/buttons.
