# Status das Investigações — OBRAMAX / Praia Grande

> **Última atualização:** 2026-05-28
> **Estado geral:** ⏸️ **Pausado** — dois diagnósticos preliminares fechados, aguardando 1 query SQL cada para confirmar/refutar a hipótese mais forte.

---

## Sumário rápido

| # | Investigação | Status | Próximo passo (1 ação) |
|---|--------------|--------|-----------------------|
| 1 | [INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md](./INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md) | ⏸️ Pausado | Rodar `SELECT id,name FROM device WHERE name ILIKE '%motor ligado%'` no TB — decide §9.11 |
| 2 | [INVESTIGACAO_Device_Slave48_AguaPotavelEntraNovo.md](./INVESTIGACAO_Device_Slave48_AguaPotavelEntraNovo.md) | ⏸️ Pausado | Rodar (T3) no `ts_kv` — verifica se `Min ≤ Avg ≤ Max` no envio |

---

## 1. Investigação de Alarme — flapping `Motor Ligado (PG)` / `Bomba Ligada`

**Arquivo:** [`INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md`](./INVESTIGACAO_Alarme_OBRAMAX_PraiaGrande.md)

### Estado do diagnóstico

- ✅ **Evento decifrado:** 18/05 18:06 → 19/05 07:33 = janela de queda de energia (~13,5 h). Durante essa janela o `Motor Ligado (PG)` "flapou" 116× → 232 mensagens no Telegram (= o "alarme global falhou" relatado pelo cliente).
- ✅ **Não é o Node-RED** — não há lógica de partida de bomba; pump start é função elétrica de campo (QTA/ATS).
- ✅ **Não é leitura travada** no `Rede (PG)` — sinal real (3 transições limpas) confirmou `Falta de Fase` legítima (§9.10).
- ⚠️ **Veredito em revisão:** §9.9 (chattering de campo) → §9.11 (**colisão de devices homônimos "Motor Ligado"** entre slaves 35 e 45). Explica o padrão melhor.

### Itens em aberto (§1.1 do .md)

| # | Item | Tipo |
|---|------|------|
| 1 | ~~Série temporal de `Rede (PG)`~~ ✅ FECHADO | — |
| 1b | Polaridade do sinal "Sinal De Rede" — `detected` = normal ou falta? | confirmação |
| **2** 🔴 | **Colisão de devices homônimos "Motor Ligado"** — decide a §9.11 | **query SQL** |
| 3 | Inspeção de campo da entrada digital "Motor Ligado" | ação física |
| 4 | Debounce na alarm rule `Bomba Ligada` (OBS-5) | mitigação software |
| 5 | Correções da rule chain (BUG-1 texto fixo, nós órfãos) | mitigação software |

### Query decisiva para retomar (item 2)

```sql
-- ThingsBoard: quantos devices se chamam "Motor Ligado..."?
SELECT id, name, type,
       to_timestamp(created_time/1000) AT TIME ZONE 'America/Sao_Paulo' AS criado
FROM device
WHERE name ILIKE '%motor ligado%';
```

- **1 linha** → 🔴 colisão confirmada (2 channels físicos → 1 device TB) → reescrever veredito da §9.9 como configuração/modelo de dados.
- **2 linhas** → veredito §9.9 (chattering de campo) se mantém → seguir para inspeção de campo (item 3).

---

## 2. Investigação de Device — slave 48 `Água Potável Entra Novo` / `pulsesHourlyAverage`

**Arquivo:** [`INVESTIGACAO_Device_Slave48_AguaPotavelEntraNovo.md`](./INVESTIGACAO_Device_Slave48_AguaPotavelEntraNovo.md)

### Estado do diagnóstico

- ✅ **Cadeia de publicação rastreada** ponta a ponta (§A): SQL `Get 30 days average every hour` → `Map devices` (injeta `pulsesHourlyAverage`/`…Min`/`…Max`) → function `7cf444b7` (adiciona sufixo `(PG)` hardcoded) → MQTT out → `mqtt.myio-bas.com:1883` topic `v1/gateway/telemetry`.
- ✅ **Envio matematicamente correto** (§B): a SQL garante `MIN ≤ AVG ≤ MAX` sobre `hourly_sum`. Logo, as anomalias do dashboard (`Mín 1485 > Méd 860` em 04–05 e `Mín 3070 > Méd 1970,7` em 14–15) **não** podem ter origem no envio.
- 🔥 **Hipótese F1 = mais provável**: widget do dashboard com colunas Min/Avg trocadas (ou keys mapeadas erradas).
- ✅ **`emitter.js` não está nesta cadeia** — publica via `mqtt out` padrão.

### Itens em aberto (§8 do .md)

**Foco principal (4 queries):**
- [ ] **(T1)** `SELECT id,name FROM device WHERE name ILIKE '%hidr%potavel%entrada%'` no TB — `entity_id` do device
- [ ] **(T2)** Listar todas as chaves do device hoje em `ts_kv` — descobre fonte do "Total 9 830 L"
- [ ] **(T3)** 🔥 Série hora-a-hora de `pulses`/`pulsesHourlyAverage`/`…Min`/`…Max` — **decide F1**
- [ ] **(T4)** Pulsos brutos do slave 48 ch 1 na central — compara com `pulses` no TB

Há um shell script pronto para a central: [`query-slave48-pulses-hoje.sh`](./query-slave48-pulses-hoje.sh) (faz Passos 1–5 da central; salva log em `/tmp/`).

**Contexto / device:**
- [ ] Confirmar unidade do multiplicador `×10` (litros?)
- [ ] Verificar dupla contagem com slave 20 (medidor original)
- [ ] Documentar o que `Fonte` (ch 97) representa
- [ ] Decidir sobre o channel `Teste` (ch 111)
- [ ] Comparar com redundância (slave 49)

### Query decisiva para retomar (T3)

Pré-requisito: rodar (T1) para descobrir `<UUID>` do device.

```sql
SELECT to_timestamp(tk.ts/1000) AT TIME ZONE 'America/Sao_Paulo' AS momento,
       kd.key, tk.long_v, tk.dbl_v
FROM ts_kv tk JOIN key_dictionary kd ON kd.key_id = tk.key
WHERE tk.entity_id = '<UUID>'
  AND kd.key IN ('pulses','pulsesHourlyAverage','pulsesHourlyAverageMin','pulsesHourlyAverageMax')
  AND tk.ts >= (EXTRACT(EPOCH FROM TIMESTAMP '2026-05-25 00:00:00-03')*1000)::bigint
ORDER BY tk.ts, kd.key;
```

- Se sempre `pulsesHourlyAverageMin ≤ pulsesHourlyAverage ≤ pulsesHourlyAverageMax` → **F1 confirmado** → bug no widget do dashboard.
- Se algum hora violar → bug em outro lugar (F2 ou F5).

---

## Arquivos de apoio na pasta

| Arquivo | Conteúdo |
|---------|----------|
| [`slaves-map.md`](./slaves-map.md) | Mapa completo dos 46 slaves + 113 channels da PG |
| [`Evidencia_Alarme_Telegram_OBRAMAX_PraiaGrande.png`](./Evidencia_Alarme_Telegram_OBRAMAX_PraiaGrande.png) | Print do Telegram 19/05 06:49 (evidência inicial do alarme) |
| `bkp-all-flows-node-red-obramax-praia-grande-2026-05-20-10-29.json` | Backup completo do flow Node-RED da central |
| `slaves.log`, `query-alarmes-praia-grande-18-a-20-maio-2026.log`, `resultSerieTemporal.log` | Evidências das queries já rodadas |
| [`query-slave48-pulses-hoje.sh`](./query-slave48-pulses-hoje.sh) | Script para rodar as queries da central PG |

---

## Como retomar (passo a passo)

1. Abrir esse `STATUS.md` para o panorama.
2. Decidir qual investigação atacar primeiro (1 ou 2 acima — independentes).
3. Rodar a **query decisiva** da investigação escolhida (já está pronta nas seções acima).
4. Atualizar o `.md` respectivo com o resultado e mover o status de "⏸️ Pausado" para "🔬 Em progresso" ou "✅ Concluído".
