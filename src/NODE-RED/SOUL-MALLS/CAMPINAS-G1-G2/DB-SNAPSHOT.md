# DB Snapshot — Campinas Shopping G1 G2 (Soul Malls)

> **Snapshot do banco `hubot` (PostgreSQL) da central.**
> Capturado em **2026-06-11** via `psql -U hubot` na central.

## Identificação da central

| Campo      | Valor                                      |
| ---------- | ------------------------------------------ |
| Central    | Campinas Shopping — G1 G2                  |
| Holding    | Soul Malls                                 |
| IPv6       | `203:5e50:3e69:89bd:5846:e41f:23b8:fd28`   |
| Gateway ID | `1b5d79c4-5fc6-46c4-bd05-89e8b1499920`     |
| Central ID | `16.2.170.222`                             |
| Frequência | `107`                                      |

## Arquivos deste snapshot

| Arquivo               | Tabela        | Status                          |
| --------------------- | ------------- | ------------------------------- |
| `slaves.json`         | `slaves`      | ✅ Parseado do log (56 rows)    |
| `channels.json`       | `channels`    | ✅ Parseado do log (36 rows)    |
| `ambients.json`       | `ambients`    | ✅ Parseado do log (27 rows)    |
| `logs/slaves.log`     | `slaves`      | Dump bruto do psql              |
| `logs/channels.log`   | `channels`    | Dump bruto do psql              |
| `logs/ambients.log`   | `ambients`    | Dump bruto do psql              |
| `logs/all-tables.log` | (`\dt+`)      | Inventário das 27 tabelas do DB |

### Inventário do banco (`\dt+`) — destaques

- 27 tabelas no schema `public`, owner `hubot`.
- Maiores: `ambients_rfir_slaves_rel` (56 kB), `slaves` (48 kB), `ambients`/`channels`/`favorites` (16 kB).
- **Vazias (0 bytes)**: `alarms`, `logs`, `consumption`, `raw_energy`, `channel_pulse_log`, todas as `rfir_*`, `ambients_rfir_devices_rel` — esta central não usa IR nem acumula histórico local relevante.
- Curioso: `ambients_rfir_slaves_rel` tem 56 kB mesmo com todas as `rfir_*` vazias — reforça a hipótese do manual (§8.4) de que essa junction é vestígio.

---

## Resumo — tabela `slaves` (56 rows)

### Por tipo

| `type`               | Qtde | Função                                      |
| -------------------- | ---- | ------------------------------------------- |
| `three_phase_sensor` | 41   | Medidores de energia 3F (lojas/quiosques)   |
| `outlet`             | 15   | Hidrômetros (pulso) + 1 switch (`SW Reborne`) |

### Características gerais

- **Versão de firmware**: `6.0.0` em **todos** os 56 slaves.
- **`aggregate = true`** em todos.
- **`addr_high`**: exatamente metade em `248` (28) e metade em `249` (28) — dois grupos de rádio (provavelmente G1/G2).
- **`code`**: `002-002-002-015` (3F) e `002-002-002-012` (outlet). Única exceção: id 16 (ver não-conformidades).
- **Convenção de nome**:
  - Energia: `3F <código-loja> <nome>` (ex.: `3F SCP0D009 Havaianas 1`); entradas/relógios como `3F RELOGIO ...`.
  - Água: `Hidr. <loja> x<multiplicador> 0m3` — o `x1/x10/x100` indica o fator do hidrômetro.

### Padrão de config dos hidrômetros (`outlet`)

```json
{
  "channelConfig": {
    "channel0": { "channel_type": "REMOTE_INPUT",   "pulses": 1, "output": "HOLDING" },
    "channel1": { "channel_type": "PULSE_ON_POWER", "pulses": N, "output": "HOLDING" }
  }
}
```

`pulses` do `channel1` varia: **1** (maioria), **5** (id 82 — Aquazero), **10** (id 85 — Padoca).

---

## Resumo — tabela `channels` (36 rows)

### Por tipo

| `type`            | Qtde | Função                                              |
| ----------------- | ---- | ---------------------------------------------------- |
| `flow_sensor`     | 17   | Leitura de pulso do hidrômetro (channel 1)          |
| `presence_sensor` | 17   | Status de energia/fonte do equipamento (channel 0)  |
| `lamp`            | 2    | Canais de teste (`Check` no slave 83, `Test` no 81) |

### Características

- **Channels existem apenas para os `outlet`** (hidrômetros) — os 41 medidores 3F **não têm** linha em `channels` (telemetria 3F vem direto do slave).
- Padrão por hidrômetro: 1 `flow_sensor` (channel 1) + 1 `presence_sensor` (channel 0, nome `Energia` ou `Fonte`).
- `config = {"confirm": false}` presente nos `flow_sensor` mais recentes/editados.
- **Renomeação em andamento para padrão `HIDR. <código-loja>`**: ids 5 (`HIDR. SCP00259`), 33 (`HIDR. SCP0Q031`), 37 (`HIDR. SCP0T255C`) — atualizados em 2026-06-10.

---

## Resumo — tabela `ambients` (27 rows)

- Ambientes "reais": agrupamentos por loja/hidrômetro (`Renner`, `Padoca`, `OMO`, `Localiza`...) e macro (`Lojas G1/G2`, `Quiosque G1/G2`, `Todos`, `Todos medidores`).
- `config.hide_devices_v1` é usado em 18 dos 27 para ocultar cards de energia/temperatura dos slaves no app.
- Nenhum ambiente usa `image` ou `order`.
- **Lixo evidente**: `Para Excluir` (id 20), `Novo` (id 10), `Sem numero` (id 9) — candidatos a limpeza.

---

## ⚠️ Não-conformidades / pontos de atenção

1. **5 medidores 3F com `clamp_type` NULL divergindo do `config.config_clamp.value`**
   (regra do manual §7.1: `clamp_type` deve ser NOT NULL e igual ao config):

   | id | Nome                            | `clamp_type` | `config_clamp.value` |
   | -- | ------------------------------- | ------------ | -------------------- |
   | 89 | 3F Novo Barbarella G2           | NULL         | 0                    |
   | 93 | 3F RELOGIO DETRAN Emplacamento  | NULL         | 1                    |
   | 94 | 3F Depósito Real Vistoria       | NULL         | 0                    |
   | 95 | 3F Q268 Mia_Perfume             | NULL         | 0                    |
   | 96 | Rei Do Mate Oficial             | NULL         | 0                    |

   Correção em massa: query do manual §7.4 (`UPDATE slaves SET clamp_type = (config->'config_clamp'->>'value')::int ...`).

2. **id 16 (`3F SCP0D002 Havaianas 2`)** — `code = 003-003-003-015`, fora do padrão `002-002-002-015` dos demais 3F.

3. **id 76 (`Hidr. Dog_Express`)** — `addr_low = 251`, acima da faixa usual (demais ≤ 247).

4. **Possível duplicidade Rei Do Mate** — id 19 (`3F SCP0D003 Rei Do Mate`) e id 96 (`Rei Do Mate Oficial`): o `updated_at` do 19 (2026-03-10 16:07:28) é ~1 min após a criação do 96 (16:06:06), sugerindo troca de medidor com o antigo ainda ativo no banco.

5. **Slaves novos sem nome de loja** — ids 98 (`3F SCPC0Q024`) e 99 (`3F SCP0Q271`), criados em 2026-06-08; nomear quando a loja for confirmada.

6. **Inconsistências de grafia** (afetam matching por nome no dashboard):
   - `Acqazero` (id 70, energia) vs `Aquazero` (id 82, água);
   - `Burguer King` / `Burgue King` (ids 59, 65, 97);
   - prefixo `Hidr.` vs `Hid.` (ids 100, 101).

7. **Outlets com `clamp_type` NULL** — esperado para hidrômetros (não usam clamp), mas a regra §7.1 do manual diz NOT NULL sempre; confirmar se a regra vale só para 3F.

8. **6 channels órfãos (`slave_id` NULL)** — ids 3, 4 (Padoca antiga), 7, 8 (OMO antiga), 23, 24 (`Hidr. BK_G0`): restos de slaves removidos/recriados. Candidatos a DELETE.

9. **`ambients.hide_devices_v1` referencia slaves inexistentes** — slave 75 (em `Hidrometro Smart Fit`, id 11) e slave 87 (em `Todos medidores`, id 21) não existem mais na tabela `slaves`. Referências fantasmas; limpar o JSON do config.

10. **`SW Reborne` (slave 91) sem nenhum channel** — é o único `outlet` sem `flow_sensor`/`presence_sensor`; confirmar se é switch (não hidrômetro) e se está operacional.

11. **Nome do ambiente id 2 com espaço à esquerda** — `" Quiosque G1/G2"`: quebra ordenação alfabética e matching por nome.

12. **Mais variantes de grafia** — `Acquazero` (ambient 16) é a 3ª grafia da mesma loja (`Acqazero` energia, `Aquazero` água); `Quioque Mc Donalds G1` (ambient 30) com typo.

---

## Como regenerar o snapshot

Na central (`ssh -i id_rsa root@203:5e50:3e69:89bd:5846:e41f:23b8:fd28`):

```bash
# Dump tabular (como os .log atuais)
psql -U hubot -c "SELECT * FROM slaves;"   > /tmp/slaves.log
psql -U hubot -c "SELECT * FROM channels;" > /tmp/channels.log
psql -U hubot -c "SELECT * FROM ambients;" > /tmp/ambients.log

# Preferível: exportar JSON direto (sem parse manual)
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM slaves t;"   > /tmp/slaves.json
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM channels t;" > /tmp/channels.json
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM ambients t;" > /tmp/ambients.json
```

Depois baixar com `scp -i id_rsa root@[<ipv6>]:/tmp/*.json .` para esta pasta.

---

_Última atualização: 2026-06-11_
