# Slaves Map — Central Deodoro (Supervia Estações)

> Central: **Supervia Estações — Deodoro** (`adb43bf6-6107-44fa-b786-6e88c150d779`)
> IPv6: `200:1e6a:69a5:73f1:b18a:e6e:aa68:9229`
> Total slaves: 56

---

## 1. Equipamentos de Acesso / Catracas (SUPERVIA-ACD-XXX)

Sensores ACD (Acesso/Catraca/Anti-Climbing Device) — equipamentos de detecção em catracas/portas de acesso da estação.

| Slave ID | Nome                       | Central                    | Obs |
|----------|----------------------------|----------------------------|-----|
| 18       | SUPERVIA-ACD-001           | Supervia Estações — Deodoro | — |
| 16       | SUPERVIA-ACD-006           | Supervia Estações — Deodoro | — |
| 17       | SUPERVIA-ACD-007           | Supervia Estações — Deodoro | — |
| 14       | SUPERVIA-ACD-008           | Supervia Estações — Deodoro | — |
| 15       | SUPERVIA-ACD-009           | Supervia Estações — Deodoro | — |
| 19       | SUPERVIA-ACD-010           | Supervia Estações — Deodoro | — |
| 23       | SUPERVIA-ACD-011           | Supervia Estações — Deodoro | — |
| 24       | SUPERVIA-ACD-043           | Supervia Estações — Deodoro | — |
| 25       | SUPERVIA-ACD-044           | Supervia Estações — Deodoro | — |
| 26       | SUPERVIA-ACD-045           | Supervia Estações — Deodoro | — |
| 27       | SUPERVIA-ACD-046           | Supervia Estações — Deodoro | — |
| 28       | SUPERVIA-ACD-047           | Supervia Estações — Deodoro | — |
| 29       | SUPERVIA-ACD-048           | Supervia Estações — Deodoro | — |
| 30       | SUPERVIA-ACD-049           | Supervia Estações — Deodoro | — |
| 32       | SUPERVIA-ACD-055-056-057   | Supervia Estações — Deodoro | **Triplo** — único slave cobrindo 3 IDs de ACD no mesmo registro |
| 42       | SUPERVIA-ACD-059           | Supervia Estações — Deodoro | — |
| 48       | SUPERVIA-ACD-069           | Supervia Estações — Deodoro | Pareado com `RM ACD-069` (slave 56) — possível par sensor + repetidor |
| 49       | SUPERVIA-ACD-070           | Supervia Estações — Deodoro | — |
| 34       | SUPERVIA-ACD-095           | Supervia Estações — Deodoro | — |
| 33       | SUPERVIA-ACD-099           | Supervia Estações — Deodoro | — |
| 43       | SUPERVIA-ACD-114           | Supervia Estações — Deodoro | — |
| 44       | SUPERVIA-ACD-115           | Supervia Estações — Deodoro | — |
| 35       | SUPERVIA-ACD-131           | Supervia Estações — Deodoro | — |
| 36       | SUPERVIA-ADC-132           | Supervia Estações — Deodoro | ⚠️ **Naming inconsistente** — prefixo `ADC` em vez de `ACD`. Provável typo; padronizar |
| 37       | SUPERVIA-ACD-133           | Supervia Estações — Deodoro | — |
| 38       | SUPERVIA-ACD-134           | Supervia Estações — Deodoro | — |
| 39       | SUPERVIA-ACD-135           | Supervia Estações — Deodoro | — |
| 40       | SUPERVIA-ACD-136           | Supervia Estações — Deodoro | — |
| 41       | SUPERVIA-ACD-137           | Supervia Estações — Deodoro | — |
| 45       | SUPERVIA-ACD-176           | Supervia Estações — Deodoro | — |
| 46       | SUPERVIA-ACD-205           | Supervia Estações — Deodoro | — |
| 47       | SUPERVIA-ACD-206           | Supervia Estações — Deodoro | — |

> Total ACD: 32 slaves. Sufixos numéricos vão de 001 a 206 com gaps significativos. Maiores blocos contíguos: 043–049 (7 unidades) e 131–137 (7 unidades).

---

## 2. Elevadores

| Slave ID | Nome        | Central                    | Obs |
|----------|-------------|----------------------------|-----|
| 12       | Elevador-07 | Supervia Estações — Deodoro | — |
| 6        | Elevador-08 | Supervia Estações — Deodoro | — |
| 7        | Elevador-09 | Supervia Estações — Deodoro | — |
| 9        | Elevador-10 | Supervia Estações — Deodoro | — |
| 8        | Elevador-11 | Supervia Estações — Deodoro | — |
| 3        | Elevador-12 | Supervia Estações — Deodoro | — |

> 6 elevadores numerados **07–12**. Sem entradas 01–06 — provavelmente não fazem parte do escopo desta central (ou estão em outra estação Supervia).

---

## 3. Escadas Rolantes

| Slave ID | Nome           | Central                    | Obs |
|----------|----------------|----------------------------|-----|
| 4        | Escada-30      | Supervia Estações — Deodoro | — |
| 5        | Escada-31      | Supervia Estações — Deodoro | — |
| 10       | Escada-32      | Supervia Estações — Deodoro | — |
| 11       | Escada-33      | Supervia Estações — Deodoro | — |
| 1        | Escada Rol.34  | Supervia Estações — Deodoro | ⚠️ Naming variante (`Escada Rol.` em vez de `Escada-`) |
| 2        | Escada Rol.35  | Supervia Estações — Deodoro | ⚠️ Naming variante |

> 6 escadas rolantes numeradas **30–35**. **Padronizar naming**: slaves 1 e 2 usam `Escada Rol.NN` enquanto slaves 4–11 usam `Escada-NN`. Mesma família, formato divergente.

---

## 4. Ambientes / Equipamentos de Sala

| Slave ID | Nome                | Central                    | Função / Obs |
|----------|---------------------|----------------------------|--------------|
| 54       | Bilheteria          | Supervia Estações — Deodoro | Equipamento da bilheteria |
| 53       | Sala Convivencia 01 | Supervia Estações — Deodoro | Pareada com slave 51 |
| 51       | Sala Convivencia 02 | Supervia Estações — Deodoro | Pareada com slave 53 |
| 52       | RM Dormitorio       | Supervia Estações — Deodoro | RM = provável Repetidor Modbus do dormitório |
| 55       | REPETIDOR CME       | Supervia Estações — Deodoro | Repetidor Modbus genérico (CME = ?) |
| 56       | RM ACD-069          | Supervia Estações — Deodoro | Repetidor Modbus cobrindo `SUPERVIA-ACD-069` (slave 48) |
| 50       | Remot Audio E CFTV  | Supervia Estações — Deodoro | Sistema de áudio + CFTV (Circuito Fechado de TV) |
| 57       | Remote PB Telecon   | Supervia Estações — Deodoro | Remote PB (Plataforma Baixa?) de telecomunicação |

---

## 5. Controle / Sistema

| Slave ID | Nome   | Central                    | Função                            |
|----------|--------|----------------------------|-----------------------------------|
| 13       | Reboot | Supervia Estações — Deodoro | Reinicialização remota da central |

---

## 6. Sem nome (a identificar)

| Slave ID | Nome | Central                    | Obs |
|----------|------|----------------------------|-----|
| 20       | —    | Supervia Estações — Deodoro | Não identificado — campo `name` vazio no DB |
| 21       | —    | Supervia Estações — Deodoro | Não identificado |
| 22       | —    | Supervia Estações — Deodoro | Não identificado |

> Considerar inspecionar `slaves.config`, `slaves.code` e tabelas relacionadas (`channels`, `consumption_realtime`) para descobrir o que esses 3 slaves controlam:
> ```sql
> SELECT id, type, addr_low, addr_high, channels, code, config
>   FROM slaves WHERE id IN (20, 21, 22);
> SELECT slave_id, channel, COUNT(*) AS leituras, MIN(timestamp), MAX(timestamp)
>   FROM consumption_realtime WHERE slave_id IN (20, 21, 22)
>   GROUP BY 1, 2 ORDER BY 1, 2;
> ```
> Possíveis candidatos: equipamentos antigos desativados, placas reservadas para futuras ACDs, ou cadastros abortados.

---

## Resumo por categoria

| Categoria                  | Qtd    |
|----------------------------|--------|
| ACD (acesso/catraca)       | 32     |
| Elevadores                 | 6      |
| Escadas rolantes           | 6      |
| Ambientes/Sala/Repetidores | 8      |
| Controle/Sistema (Reboot)  | 1      |
| Sem nome                   | 3      |
| **Total**                  | **56** |

---

## Anomalias e Pontos de Atenção

1. **`SUPERVIA-ADC-132` (slave 36)** — prefixo `ADC` (não `ACD`). Provável typo durante cadastro; quebra grep/pattern matching. SQL de correção:
   ```sql
   UPDATE slaves SET name = 'SUPERVIA-ACD-132' WHERE id = 36;
   ```

2. **`SUPERVIA-ACD-055-056-057` (slave 32)** — único slave triplo (3 IDs de ACD no mesmo registro). Verificar se é intencional (uma placa Modbus que cobre 3 catracas físicas) ou se deveriam ser 3 slaves separados.

3. **Possível par sensor + repetidor ACD-069**:
   - `48 / SUPERVIA-ACD-069`
   - `56 / RM ACD-069`
   Provável arranjo: slave 48 é o sensor físico, slave 56 é o repetidor Modbus que estende o barramento até o ACD-069. Confirmar topologia.

4. **Naming escadas inconsistente** — `Escada Rol.34/35` (slaves 1, 2) vs `Escada-30/31/32/33` (slaves 4, 5, 10, 11). Padronizar para `Escada-NN` ou `Escada Rol.NN` (escolher um):
   ```sql
   UPDATE slaves SET name = 'Escada-34' WHERE id = 1;
   UPDATE slaves SET name = 'Escada-35' WHERE id = 2;
   ```

5. **Slaves sem nome (20, 21, 22)** — 3 IDs consecutivos com `name` vazio. Investigar via query do §6 acima e renomear / desativar conforme aplicável.

6. **Glossário de prefixos a confirmar**:
   - `ACD` — Acesso/Catraca/Anti-Climbing Device (catracas da estação)
   - `RM`  — provavelmente Repetidor Modbus
   - `CME` — sigla de localização (verificar com o cliente Supervia)
   - `PB`  — Plataforma Baixa?
