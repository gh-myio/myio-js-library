# Plano de Projeto — Integração Nativa Melicidade

> Estimativa baseada no que conhecemos até 16/04/2026.

---

## Escopo

| Sistema | V1 | Futuro |
|---------|----|----|
| **VRF** — Hitachi Reiri DCPF04 / Daikin | ✅ Incluso | — |
| **CHILLER** — Niagara Framework | ❌ Fora | V2 |
| **GERADOR** | ❌ Fora | V3 (após identificar sistema) |

---

## V1 — Integração VRF

### O que sabemos

- Controlador: **DCPF04 — Reiri for Office Touch** (Hitachi)
- Unidades: **Daikin VRF** via adaptador **DCPA01** (DIII-Net → Modbus RTU)
- Protocolo nativo: **Modbus RTU (RS485)** — documentado no manual
- Modbus TCP (via Ethernet): **provável mas não confirmado** — prioridade na Fase 0
- Manual técnico disponível: `INS_DCPF04_Reiri for Office Touch_DHOS-CS-IM-2107002G.pdf`

### O que não sabemos ainda (Fase 0 resolve)

- IP do DCPF04 na rede local
- Porta 502 aberta? (Modbus TCP confirmado?)
- Mapa de registros Modbus do DCPA01
- Quantas UIs Daikin, quantas zonas
- Tem medidores de energia (SMeter) instalados?
- Tem sensores IAQ instalados?

---

## Fases da V1

### Fase 0 — Levantamento Técnico
> Sem código. Objetivo: confirmar conectividade e mapear os pontos disponíveis.

**Tarefas:**

- [ ] Obter IP do DCPF04 na rede local da Melicidade
- [ ] Port scan: `nmap -p 502,80,443 <IP_DCPF04>`
  - Porta 502 aberta → **Modbus TCP** (sem cabo adicional) ✅
  - Porta 502 fechada → **Modbus RTU via RS485** (cabo físico) → comprar adaptador USB-RS485
- [ ] Testar leitura Modbus: `mbpoll <IP> -p 502 -a 1 -r 1 -c 10`
- [ ] Exportar CSV do **Reiri Setup Tool** (Windows) — lista todos os pontos configurados com IDs
- [ ] Solicitar mapa de registros Modbus do DCPA01 à Hitachi ou ao integrador
- [ ] Levantar com o cliente:
  - Quantas unidades internas (UIs)?
  - Quantas zonas / ambientes?
  - Nomes dos ambientes (para labels no dashboard)
  - Tem medidores de energia (SMeter)?
  - Tem sensores IAQ?
- [ ] Confirmar onde roda o MyIO Gateway Agent (central existente ou novo hardware?)
- [ ] Confirmar acesso de rede do Gateway ao DCPF04

**O que define:**
- Opção de conexão (TCP ou RS485)
- Granularidade dos devices no ThingsBoard (por UI? por zona?)
- Esforço real das próximas fases

**Estimativa:** 1–2 semanas
**Dependência principal:** acesso do cliente à rede interna (VPN ou presencial)

---

### Fase 1 — Telemetria (leitura)
> Gateway lendo dados do DCPF04 e enviando ao ThingsBoard. Sem controle ainda.

**Entregas:**

- Node-RED conectado ao DCPF04 via Modbus (TCP ou RTU)
- Polling a cada 60s de todas as UIs configuradas
- Pontos coletados por unidade interna:

  | Telemetria | Unidade | Modbus |
  |-----------|---------|--------|
  | Liga / Desliga | bool | FC03 |
  | Modo (cooling/heating/fan/dry/auto) | enum | FC03 |
  | Setpoint de temperatura | °C | FC03 |
  | Temperatura ambiente (sensor da UI) | °C | FC03 |
  | Velocidade do ventilador | enum | FC03 |
  | Status (running/standby/error) | enum | FC03 |
  | Código de erro | int | FC03 |

- Se medidores de energia instalados:

  | Telemetria | Unidade |
  |-----------|---------|
  | Potência instantânea | W |
  | Consumo acumulado | kWh |

- Buffer local SQLite no Gateway — resiliência offline
- Sync para ThingsBoard com `ts` original (backlog quando conexão volta)
- Devices criados no ThingsBoard (um por zona ou por UI — definido na Fase 0)
- **Dashboard BAS MyIO**: cards VRF com dados nativos — sem iframe

**Estimativa:** 2–3 semanas
**Risco:** mapa de registros não disponível → +1 semana para descoberta ativa por varredura

---

### Fase 2 — Controle
> Adiciona escrita de comandos sobre o que já foi feito na Fase 1.

**Entregas:**

- Comandos via ThingsBoard RPC → Gateway → Modbus Write (FC06):

  | Comando | Ação |
  |---------|------|
  | Ligar / Desligar UI | `power = 1 / 0` |
  | Alterar modo | `mode = cooling / heating / fan / dry / auto` |
  | Alterar setpoint | `setpoint = 18–30°C` |
  | Alterar velocidade ventilador | `fan = auto / low / mid / high` |

- Interface de controle no Dashboard MyIO:
  - Botão liga/desliga por UI ou por zona
  - Slider de setpoint
  - Seletor de modo

- Agendamentos via ThingsBoard Rule Engine → cron local no Gateway:
  - Ligar sistema às 07h00 (dias úteis)
  - Desligar às 22h00
  - Setpoint reduzido em horário de pico elétrico
  - Desligar zonas vazias por agenda

**Estimativa:** 2–3 semanas
**Dependência:** Fase 1 estável em produção

---

### Fase 3 — Relatórios
> Dados já estão no ThingsBoard — relatórios são construídos sobre eles.

**Entregas:**

- Relatório de horas de operação por UI / zona (diário e mensal)
- Temperatura média por ambiente (histórico)
- Histórico de modos de operação
- Histórico de alarmes e erros
- Se medidores instalados:
  - Consumo de energia por zona (diário / mensal)
  - Comparativo de consumo entre zonas
- Exportação CSV/Excel pelo AllReportModal MyIO

**Estimativa:** 2 semanas
**Dependência:** Fase 1 com pelo menos 1 semana de histórico acumulado

---

### Fase 4 — Deprecar iframe VRF
> Remove a aba VRF do modal de integrações.

**Entregas:**

- Validar que todos os casos de uso estão cobertos nativamente
- Remover aba `vrf` do `IntegrationsModal` (ou manter como fallback de emergência oculto)
- Comunicado ao cliente

**Estimativa:** 2–3 dias

---

## Resumo V1

| Fase | Entrega | Estimativa |
|------|---------|------------|
| **0 — Levantamento** | IP, protocolo, mapa de pontos, zonas | 1–2 sem |
| **1 — Telemetria** | Dados VRF nativos no dashboard, sem iframe | 2–3 sem |
| **2 — Controle** | Comandos + agendamentos | 2–3 sem |
| **3 — Relatórios** | Relatórios MyIO do VRF | 2 sem |
| **4 — Deprecar iframe** | Remove aba VRF do modal | 2–3 dias |
| **Total V1** | | **~8–11 semanas** |

> Fases 1 e 3 podem se sobrepor parcialmente (relatórios começam quando há dados suficientes).

---

## O que o cliente precisa fornecer para começar

| Item | Quando |
|------|--------|
| Acesso VPN ou presencial à rede interna | Fase 0 — imediato |
| IP do DCPF04 na LAN | Fase 0 |
| Acesso a um PC Windows com o Reiri Setup Tool instalado | Fase 0 — exportar CSV de pontos |
| Lista de zonas e nomes dos ambientes | Fase 0 |
| Horários de operação desejados | Fase 2 |

---

## Referências

| Documento | Conteúdo |
|-----------|---------|
| `ESTUDO-VRF-INTEGRACAO-NATIVA.md` | Deep dive técnico VRF — Modbus, flows, TB model |
| `ESTUDO-INTEGRACAO-NATIVA.md` | Visão geral da arquitetura offline-first |
| `MELICIDADE-INTEGRATION.md` | Integração atual via iframe |
| `INS_DCPF04_Reiri for Office Touch_DHOS-CS-IM-2107002G.pdf` | Manual técnico DCPF04 |
