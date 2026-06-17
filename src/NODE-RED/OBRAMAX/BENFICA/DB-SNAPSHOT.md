# DB Snapshot — Benfica (OBRAMAX)

> **Snapshot do banco `hubot` (PostgreSQL) da central.**
> Capturado em **2026-06-17** a partir de `logMaps.log` (dump tabular `psql -U hubot`).

## Identificação da central

| Campo      | Valor                                          |
| ---------- | ---------------------------------------------- |
| Central    | OBRAMAX — Benfica                              |
| Holding    | OBRAMAX                                         |
| IPv6       | `200:47f1:8bf6:36da:65fa:4124:bcdb:dbb4`        |
| Central ID | `1248905a-ed03-414d-bde6-c4410604ae8f`         |
| Gateway ID | _(não capturado — preencher na próxima coleta)_ |
| Frequência | _(não capturada — preencher na próxima coleta)_ |

## Arquivos deste snapshot

| Arquivo          | Tabela     | Status                                  |
| ---------------- | ---------- | --------------------------------------- |
| `slaves.json`    | `slaves`   | ✅ Parseado do log (51 rows)            |
| `channels.json`  | `channels` | ✅ Parseado do log (131 rows)           |
| `ambients.json`  | `ambients` | ✅ Parseado do log (16 rows)            |
| `logMaps.log`    | (3 tabelas)| Dump bruto do psql (`ambients` + `channels` + `slaves`) |
| `slaves-map.md`  | —          | Visão **funcional** (por canais reais)  |

> Diferente do snapshot da Campinas G1/G2, aqui os três dumps vêm de um **único arquivo**
> (`logMaps.log`) e não há `logs/all-tables.log` (`\dt+`) — o inventário de tabelas e os
> tamanhos no disco ainda não foram capturados nesta central.

---

## Resumo — tabela `slaves` (51 rows)

### Por tipo

| `type`               | Qtde | Função                                              |
| -------------------- | ---- | --------------------------------------------------- |
| `outlet`             | 49   | Switches/automação (splits, lojas, exaustão, bombas, geradores, hidrômetros, etc.) |
| `three_phase_sensor` | 2    | Medição de energia 3F (ids 9 e 30 — QFAC 2 ADM / ADM) |

> **Contraste com Campinas G1/G2** (lá são 41× 3F + 15× outlet, uma central de *medição*
> de lojas): Benfica é uma central de **automação predial** — quase tudo é `outlet`
> controlando splits/compressores/iluminação/bombas, com apenas 2 medidores 3F.

### Características gerais

- **Versão de firmware**: `6.0.0` em **todos** os 51 slaves.
- **`aggregate = true`** em todos.
- **`code`**: `002-002-002-012` (outlet, 49) e `002-002-002-015` (3F, 2). Sem exceções fora do padrão (≠ Campinas, que tem o id 16 em `003-003-003-015`).
- **`clamp_type`**: NULL nos outlets; `2` (id 9) e `6` (id 30) nos 3F.
- **`addr_high`**: `248` (33 slaves) e `249` (18 slaves) — não há split 50/50 como em Campinas.
- **`temperature_correction`**: NULL em todos, exceto id 52 (`Hidrometro Reuso (Lilas)`) = `0`.
- **Lacunas de `id`**: `13, 16, 18, 44, 55, 56, 57, 59` ausentes na tabela — resquício de
  slaves removidos/recriados (o `59`, sem nome, constava em capturas anteriores).

### Padrão de config dos outlets

A grande maioria dos outlets usa dois canais de controle remoto:

```json
{
  "channelConfig": {
    "channel0": { "channel_type": "REMOTE_INPUT", "pulses": 1, "output": "HOLDING" },
    "channel1": { "channel_type": "REMOTE_INPUT", "pulses": 1, "output": "HOLDING" }
  }
}
```

Variações relevantes:
- **Hidrômetros** (ids 24, 25, 52, 53) usam `channel_type": "PULSE_ON_POWER"` em um dos canais (leitura de pulso de água).
- **Solenoide** (id 54) usa `channel_type": "NORMAL"`.
- **id 58** (`Temp. 7/8`) usa `output": "PASSTHROUGH"` no `channel0`.
- Vários trazem blocos extras `config_temperature` e/ou `config_clamp` (ids 7, 15, 17, 21, 39, 51, 58).
- **12 slaves com `config = null`**: `9, 12, 14, 27, 28, 29, 30, 42, 43, 46, 49, 50`.

---

## Resumo — tabela `channels` (131 rows)

### Por tipo

| `type`                | Qtde | Função                                                  |
| --------------------- | ---- | ------------------------------------------------------- |
| `presence_sensor`     | 63   | Status / automação ON-OFF (presença, alarmes, "Auto.") |
| `lamp`                | 45   | Saídas de iluminação / compressores (`Spt N: Comp`)    |
| `plug`                | 16   | Tomadas / splits (`Splitao N`)                          |
| `flow_sensor`         | 4    | Leitura de pulso de hidrômetro                          |
| `pulse_up`            | 2    | Pulsos de comando (exaustor cozinha)                    |
| `inverted_actionable` | 1    | Válvula (Solenoide, id 114)                             |

### Características

- **Canais órfãos (`slave_id` NULL)**: ids `119`, `120` (`Spt 7: Comp1/2`) e `121` (`Teste`)
  — restos de vínculos removidos. Candidatos a `DELETE`.
- `config` é `{"confirm":false}` na maioria dos canais editados, ou NULL.
- `channel_id`, `scene_up_id`, `scene_down_id` são NULL em **todas** as linhas.
- Grafias com typo preservadas: `Liga Exasut. Cozinha`, `Auto.  L27/L28 (50%)..` (espaço
  duplo + reticências), `Alarme i - Mot. ON/OFF` (minúsculo).

---

## Resumo — tabela `ambients` (16 rows)

- Ambientes mesclam **agrupamentos funcionais** (`Estacionamento`, `Termostatos`,
  `Compressores`, `Splitões`, `Casa de Bombas`, `Hidrometros/Solenoide`) e **macros de UI**
  (`Comandos`, `Desligar Automação`, `Medição De Energia`).
- `config.hide_devices_v1` usado em 14 dos 16 (só `Medição De Energia` tem lista vazia e não há os ~9 nulos do caso Campinas).
- `order` definido em 10 dos 16 (ids 2,3,4,6,8,9,10,12,13,25); os demais sem ordenação.
- Apenas o ambiente `QT-Depósito` (id 8) usa `image`.
- Nomes com leading space (`" Splitões"`) e apóstrofo (`Nivel caixa d'água`) preservados.

---

## ⚠️ Não-conformidades / pontos de atenção

1. **Nome do slave frequentemente não reflete a função** (principal divergência desta central).
   Detalhado em [`slaves-map.md`](slaves-map.md) §⚠️:
   - Compressores nomeados como temperatura: slaves `10, 11, 17, 22, 58` (`Temp.`/`Termostato`)
     → **não** classificar como TERMOSTATO no dashboard.
   - Ventilação/exaustão nomeada como loja: slaves `45, 47, 48` (`Lj 1/3/4`).
   - Único termostato real: slave `50` (`Temperatura Ambiente Central`).

2. **Referências fantasmas em `ambients.hide_devices_v1`** (slaves/canais inexistentes):
   | Ambiente            | Referência fantasma           |
   | ------------------- | ----------------------------- |
   | `QT-Depósito` (8)   | slave `16`                    |
   | `QT- Loja Incorporadora` (9) | slave `18` (×2)      |
   | `Termostatos` (10)  | slave `13`, canais `39`, `63` |
   | `Compressores` (27) | slave `13` (×2)               |
   | `Comandos` (31)     | slave `13` (×2)               |
   Limpar do JSON de config (análogo à não-conformidade §9 de Campinas).

3. **Entrada duplicada em `Comandos` (31)** — `{"slave_id":45,"is_slave":true,"energy":true}`
   aparece duas vezes no `hide_devices_v1`. Deduplicar.

4. **Canais órfãos (`slave_id` NULL)** — ids `119, 120, 121`. Vincular ou remover.

5. **Lacunas de `id` em `slaves`** — `13, 16, 18, 44, 55, 56, 57, 59` ausentes. O slave `59`
   (sem nome) sumiu desde a captura anterior → total caiu de 52 para 51.

6. **Slaves sem nenhum channel** (7): `9, 30` (3F — esperado, telemetria direta), `42, 43`
   (SCD — config no nome `×0.95`), `46, 49` (`LJ2`/`LJ 5` sem config), `50` (temperatura).

7. **Outlets com `clamp_type` NULL** — esperado (não usam clamp); mesma ressalva do manual
   §7.1 que aparece em Campinas (confirmar se a regra NOT NULL vale só para 3F).

8. **`id 76` (`Hidr. Dog_Express`) NÃO existe nesta central** — diferente de Campinas; aqui
   não há anomalia de `addr_low` alto. (nota de contraste, não é problema)

---

## Como regenerar o snapshot

Na central (`ssh` via IPv6 acima):

```bash
# Dump tabular único (como o logMaps.log atual)
psql -U hubot -c "SELECT * FROM ambients;" >  /tmp/logMaps.log
psql -U hubot -c "SELECT * FROM channels;" >> /tmp/logMaps.log
psql -U hubot -c "SELECT * FROM slaves;"   >> /tmp/logMaps.log

# Preferível: exportar JSON direto (sem parse manual)
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM slaves t;"   > /tmp/slaves.json
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM channels t;" > /tmp/channels.json
psql -U hubot -t -A -c "SELECT json_agg(t ORDER BY t.id) FROM ambients t;" > /tmp/ambients.json

# Capturar também o inventário de tabelas (ainda não coletado nesta central)
psql -U hubot -c "\dt+" > /tmp/all-tables.log
```

Depois baixar com `scp` para esta pasta.

---

_Última atualização: 2026-06-17_
