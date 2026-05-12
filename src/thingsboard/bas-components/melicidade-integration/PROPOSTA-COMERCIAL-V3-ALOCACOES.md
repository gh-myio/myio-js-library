# Proposta Comercial v3 — Integração Nativa VRF · Melicidade

> Mapa detalhado de horas × perfil profissional × fase, para a Proposta Comercial
> da v3 do documento `proposta-integracao-vrf-melicidade-v3.html`.
>
> **Audiência:** equipe interna MyIO (alinhamento de pricing) + cliente Melicidade
> (transparência sobre composição do esforço, via Anexo H da v3).

---

## 1. Premissas

- **Target de serviços (excluindo CAPEX hardware):** ~R$ 100.000
- **Volume total:** 425 horas estimadas (compatível com Fases 0–3 do projeto V1 VRF)
- **Blended rate implícito:** R$ 100.000 ÷ 425h ≈ **R$ 235/h**
- **Vigência das taxas:** Abril/2026, confirmadas em cotação formal na assinatura
- **CAPEX hardware:** R$ 15.550 (separado — ver Anexo A)
- **OPEX recorrente (regra 5% MENSAL):** **R$ 5.005/mês** = 5% × R$ 100.100 (mensal, inclui 4G + suporte SLA + monitoramento — vide §5.1)
- **Total Ano 1:** Serviços + CAPEX + 12× OPEX = **R$ 175.710**
- **30 dias pós-entrega:** suporte incluído sem custo adicional; OPEX começa a contar a partir do dia D+30 do Go-Live

---

## 2. Tabela de taxas e totais por perfil

| Perfil | R$/h | Horas | Subtotal (R$) | % horas | % valor |
|---|---:|---:|---:|---:|---:|
| Arquiteto / Tech Lead Sênior | **380** | 40 | **15.200** | 9,4% | 15,2% |
| Engenheiro Sênior (Node-RED, Modbus, MQTT) | **290** | 90 | **26.100** | 21,2% | 26,1% |
| Engenheiro Pleno (Widgets, Dashboard, Controle) | **210** | 130 | **27.300** | 30,6% | 27,3% |
| Desenvolvedor Júnior / Técnico de Integração | **150** | 90 | **13.500** | 21,2% | 13,5% |
| QA Especialista | **200** | 30 | **6.000** | 7,1% | 6,0% |
| DevOps / Infra | **280** | 25 | **7.000** | 5,9% | 7,0% |
| Project Manager | **250** | 20 | **5.000** | 4,7% | 5,0% |
| **TOTAL** | — | **425** | **100.100** | 100% | 100% |

**Blended rate efetivo:** R$ 100.100 ÷ 425h = R$ 235,53/h

---

## 3. Matriz alocação — hora × perfil × fase + Pós-entrega

### 3.1 Matriz absoluta (horas)

A última coluna **Pós-entrega (mensal)** é horas **POR MÊS** de operação contínua após Go-Live, **diferente** das demais colunas que somam horas de projeto. Dimensionada para cobrir R$ 5.005/mês (= 5% do dev), distribuída para máxima cobertura SLA.

| Perfil | Fase 0<br>(70h projeto) | Fase 1<br>(140h projeto) | Fase 2<br>(140h projeto) | Fase 3 + 30d<br>(75h projeto) | Total Projeto | Pós-entrega<br>(h/mês recorrente) |
|---|---:|---:|---:|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 20 | 8 | 8 | 4 | **40** | 1 |
| Engenheiro Sênior | 25 | 30 | 25 | 10 | **90** | 3 |
| Engenheiro Pleno | 10 | 60 | 50 | 10 | **130** | 8 |
| Júnior / Técnico | 5 | 30 | 40 | 15 | **90** | 6 |
| QA | 0 | 5 | 10 | 15 | **30** | 2 |
| DevOps | 5 | 5 | 5 | 10 | **25** | 2 |
| PM | 5 | 2 | 2 | 11 | **20** | 1 |
| **Total** | **70** | **140** | **140** | **75** | **425** | **23 h/mês** |

Composição mensal de pós-entrega (23h/mês) — distribuição por valor:

| Perfil | h/mês | R$/h | R$/mês |
|---|---:|---:|---:|
| Eng. Pleno | 8 | 210 | 1.680 |
| Júnior / Técnico | 6 | 150 | 900 |
| Eng. Sênior | 3 | 290 | 870 |
| DevOps | 2 | 280 | 560 |
| QA | 2 | 200 | 400 |
| Arquiteto | 1 | 380 | 380 |
| PM | 1 | 250 | 250 |
| **Mensalidade OPEX** | **23** | — | **5.040** |

> 🔎 **Calibração ao target de 5% mensal**: R$ 5.040/mês ≈ 5,04% × R$ 100.100 (tolerância < 1%). Forfait fixo arredondado a **R$ 5.005/mês** para casar exato com 5% do dev.

**O que cobre essa mensalidade**:
- **Monitoramento 24/7 do Gateway** (alertas automáticos, dashboard de saúde)
- **SLA 8h business** para incidentes nível 1–3 (resposta em horário comercial)
- **Patches de OS e software** (segurança, bugs do agente)
- **Hot-fixes em produção** dentro da bolsa de 23h/mês
- **Plano de dados M2M 4G/5G** (já incluso)
- **Backup e snapshot mensal** do gateway spare
- **Relatório mensal de status** (operação, incidentes, SLA atingido)

**Não cobre** (cobrado à parte com pré-aprovação):
- Horas excedentes à bolsa de 23h/mês: R$ 250/h
- Mudanças de escopo (adição de zonas, novos dashboards, novos relatórios)
- Troca de hardware fora de garantia
- Atendimento off-business hours (final de semana, feriado) sem SLA contratado

### 3.2 Matriz percentual (%)

| Perfil | Fase 0 | Fase 1 | Fase 2 | Fase 3 + 30d | % Projeto |
|---|---:|---:|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 28,6% | 5,7% | 5,7% | 5,3% | **9,4%** |
| Engenheiro Sênior | 35,7% | 21,4% | 17,9% | 13,3% | **21,2%** |
| Engenheiro Pleno | 14,3% | 42,9% | 35,7% | 13,3% | **30,6%** |
| Júnior / Técnico | 7,1% | 21,4% | 28,6% | 20,0% | **21,2%** |
| QA | 0% | 3,6% | 7,1% | 20,0% | **7,1%** |
| DevOps | 7,1% | 3,6% | 3,6% | 13,3% | **5,9%** |
| PM | 7,1% | 1,4% | 1,4% | 14,7% | **4,7%** |
| **Total fase** | 100% | 100% | 100% | 100% | **100%** |

### Valor por fase (calculado a partir da matriz acima)

| Fase | Horas | Valor (R$) | Rate efetivo R$/h | % do total |
|---|---:|---:|---:|---:|
| **Fase 0** — Levantamento + Fundação | 70 | **20.350** | 290,71 | 20,3% |
| **Fase 1** — Telemetria Nativa | 140 | **31.740** | 226,71 | 31,7% |
| **Fase 2** — Controle + Agendamentos | 140 | **30.690** | 219,21 | 30,7% |
| **Fase 3** — Relatórios + Homologação + 30d Pós | 75 | **17.320** | 230,93 | 17,3% |
| **TOTAL** | 425 | **100.100** | 235,53 | 100% |

> 🔎 **Observação sobre rate efetivo por fase**: Fase 0 tem o maior rate (R$ 290,71/h) porque concentra perfis sêniores (arquiteto + engenheiro Sr representam 64,3% das horas da fase). Fases 1 e 2 ficam abaixo do blended geral porque concentram Pleno + Júnior. Fase 3 sobe um pouco pelo peso de QA + PM + DevOps.

### Detalhamento financeiro Fase 0 (vendável isolada)

| Perfil | Horas | R$/h | Subtotal |
|---|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 20 | 380 | 7.600 |
| Engenheiro Sênior | 25 | 290 | 7.250 |
| Engenheiro Pleno | 10 | 210 | 2.100 |
| Júnior / Técnico | 5 | 150 | 750 |
| DevOps | 5 | 280 | 1.400 |
| PM | 5 | 250 | 1.250 |
| **Fase 0 (subtotal)** | **70** | — | **20.350** |

### Detalhamento financeiro Fase 1

| Perfil | Horas | R$/h | Subtotal |
|---|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 8 | 380 | 3.040 |
| Engenheiro Sênior | 30 | 290 | 8.700 |
| Engenheiro Pleno | 60 | 210 | 12.600 |
| Júnior / Técnico | 30 | 150 | 4.500 |
| QA | 5 | 200 | 1.000 |
| DevOps | 5 | 280 | 1.400 |
| PM | 2 | 250 | 500 |
| **Fase 1 (subtotal)** | **140** | — | **31.740** |

### Detalhamento financeiro Fase 2

| Perfil | Horas | R$/h | Subtotal |
|---|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 8 | 380 | 3.040 |
| Engenheiro Sênior | 25 | 290 | 7.250 |
| Engenheiro Pleno | 50 | 210 | 10.500 |
| Júnior / Técnico | 40 | 150 | 6.000 |
| QA | 10 | 200 | 2.000 |
| DevOps | 5 | 280 | 1.400 |
| PM | 2 | 250 | 500 |
| **Fase 2 (subtotal)** | **140** | — | **30.690** |

### Detalhamento financeiro Fase 3 (+30d pós)

| Perfil | Horas | R$/h | Subtotal |
|---|---:|---:|---:|
| Arquiteto / Tech Lead Sr | 4 | 380 | 1.520 |
| Engenheiro Sênior | 10 | 290 | 2.900 |
| Engenheiro Pleno | 10 | 210 | 2.100 |
| Júnior / Técnico | 15 | 150 | 2.250 |
| QA | 15 | 200 | 3.000 |
| DevOps | 10 | 280 | 2.800 |
| PM | 11 | 250 | 2.750 |
| **Fase 3 (subtotal)** | **75** | — | **17.320** |

### Verificação de consistência

| Visão | Soma | Confere? |
|---|---:|:---:|
| Por perfil (Tabela §2) | 100.100 | ✅ |
| Por fase (somando subtotais) | 20.350 + 31.740 + 30.690 + 17.320 = **100.100** | ✅ |

---

## 4. Lógica de senioridade por fase

### Fase 0 — Levantamento Técnico + Fundação (70h)
**Concentração sênior — definir arquitetura antes de codar.**
- **Arquiteto** (20h, 28,6%): conduz kickoff, define topologia Gateway↔ThingsBoard, valida protocolo Modbus, sela contratos de API.
- **Eng. Sênior** (25h, 35,7%): POC de leitura DCPF04, design dos drivers, mapeamento de registradores.
- **Eng. Pleno** (10h, 14,3%): apoio na POC, modelagem de devices.
- **DevOps** (5h, 7,1%): preparação de imagem OS, VPN, certificados.
- **PM** (5h, 7,1%): kickoff, atas, planejamento de Sprints 1–4.
- **Júnior** (5h, 7,1%): catalogação de devices, inventário de slaves.
- **QA** (0h): sem QA ainda — apenas no fim da fase, revisão de spec.

### Fase 1 — Telemetria Nativa (140h)
**Carga máxima em Eng. Pleno desenvolvendo UI/widgets.**
- **Eng. Pleno** (60h, 42,9%): widgets VRF, dashboard ThingsBoard, sync MQTT.
- **Eng. Sênior** (30h, 21,4%): drivers Modbus, buffer SQLite, retry/reconciliation.
- **Júnior** (30h, 21,4%): configuração de slaves, testes unitários, importação devices.
- **Arquiteto** (8h, 5,7%): code review, decisões arquiteturais pontuais.
- **QA + DevOps** (5h + 5h, 7,2%): sanity tests, CI/CD básico.
- **PM** (2h, 1,4%): follow-up sprint.

### Fase 2 — Controle e Agendamentos (140h)
**Carga distribuída — controle remoto, scheduler offline-first, logs.**
- **Eng. Pleno** (50h, 35,7%): RPC handlers, UI de controle, agendamentos.
- **Júnior** (40h, 28,6%): cadastros (schedules, ambientes), testes funcionais.
- **Eng. Sênior** (25h, 17,9%): scheduler offline-first, lógica de retry, logs de auditoria.
- **QA** (10h, 7,1%): test plan, cenários E2E críticos.
- **Arquiteto + DevOps + PM** (8h + 5h + 2h, 10,7%): code review, deploy, follow-up.

### Fase 3 — Relatórios + Homologação + Pós-entrega (75h)
**Peso maior em QA + DevOps + PM (Go-Live, atas, suporte do mês).**
- **Júnior** (15h, 20%): suporte 30d (incidentes nível 1, monitor).
- **QA** (15h, 20%): homologação completa, testes de regressão, sign-off.
- **PM** (11h, 14,7%): atas de homologação, follow-up cliente, encerramento.
- **DevOps** (10h, 13,3%): Go-Live, monitoramento ativo, ajuste fino.
- **Eng. Sênior + Pleno** (10h + 10h, 26,7%): relatórios MyIO, deprecação iframe, ajustes finais.
- **Arquiteto** (4h, 5,3%): sign-off técnico final.

---

## 5. Resumo financeiro Ano 1

### 5.1 OPEX recorrente — modelo 5% mensal (regra MyIO)

**Premissa contratual**: o custo de operação contínua pós-entrega é dimensionado como **5% do custo de desenvolvimento da solução POR MÊS**, garantindo banco de horas técnicas suficiente para suporte real (não apenas 4G + monitoramento básico).

| Cálculo | Fórmula | Valor |
|---|---|---:|
| Custo de desenvolvimento | Tabela §2 | R$ 100.100 |
| **OPEX mensal (5% do dev)** | 5% × R$ 100.100 | **R$ 5.005/mês** |
| OPEX anual | R$ 5.005 × 12 | R$ 60.060/ano |
| Total Ano 1 | Dev + CAPEX + 12×OPEX | **R$ 175.710** |

**Composição da mensalidade de R$ 5.005/mês** (vide matriz §3.1):
- **23h/mês de horas técnicas** distribuídas entre 7 perfis (Pleno + Júnior dominantes, com escalonamento Sr + Arq disponível)
- Plano de dados M2M 4G/5G do gateway
- Monitoramento 24/7 + alertas automáticos
- Patches de OS, hot-fixes, backup de snapshots
- Relatório mensal de SLA

Horas excedentes à bolsa de 23h/mês: R$ 250/h sob demanda, pré-aprovado por e-mail.

### 5.2 Resumo financeiro consolidado

| Item | Valor (R$) | Observação |
|---|---:|---|
| **Serviços (425h × blended R$ 235,53)** | **100.100** | One-shot, faturamento por milestone |
| CAPEX hardware (Gateway, UPS, switch, etc.) | 15.550 | One-shot; vide Anexo A |
| OPEX recorrente (5% dev mensal) | **5.005/mês** | Bolsa 23h SLA + 4G + monitor + patches |
| **TOTAL Ano 1** | **175.710** | Dev + CAPEX + 12× OPEX |
| Total Ano 2+ (só OPEX, reajustável) | 60.060/ano | + IGP-M anual contratual |

### 5.3 Forma de pagamento sugerida

**Projeto (Fases 0–3)**:
- **30% na assinatura** (Fase 0 + parte da Fase 1) = R$ 30.030
- **30% no fim da Fase 1** (telemetria entregue) = R$ 30.030
- **25% no fim da Fase 2** (controle + agendamento entregues) = R$ 25.025
- **15% no Go-Live** (Fase 3) — segura motivação até homologação = R$ 15.015

**Pós-entrega**:
- OPEX (R$ 5.005/mês) começa a faturar a partir do **dia D+30 do Go-Live** (após os 30d de suporte gratuitos)
- Faturamento mensal antecipado (dia 1 de cada mês) ou conforme negociação contratual
- Reajuste anual por IGP-M ou índice negociado

---

## 6. Fase 0 — Vendável isoladamente

A **Fase 0 (R$ 20.350)** é estruturada para ser **um diagnóstico contratável separadamente** se o cliente preferir validar a viabilidade antes de comprometer o pacote completo.

| Entregável da Fase 0 | Para que serve |
|---|---|
| Relatório técnico de levantamento | Confirmação do protocolo (Modbus TCP vs. RTU + adaptador) |
| Mapa de pontos VRF (zonas, sensores, controles) | Define escopo de telemetria e controle |
| Arquitetura técnica final | Topologia Gateway, fluxo de dados, segurança |
| POC funcional | Prova que a integração é técnicamente factível |
| Estimativa refinada das Fases 1–3 | Substitui esta proposta com números firmes |

**Risco coberto pela Fase 0 isolada:** o cliente paga R$ 20.350 e ganha o direito de **não seguir** com as Fases 1–3 se descobrir que (a) DCPF04 não expõe Modbus, (b) custo de adaptador inviabiliza, ou (c) outra opção é mais adequada. Se prosseguir, a Fase 0 já entra no escopo contratual (não é cobrada duas vezes).

---

## 7. Premissas e limites

1. **Hitachi DCPF04 acessível** via rede local com Modbus TCP na porta 502 confirmado em Fase 0. Caso contrário: adaptador USB-RS485 (R$ 250 + ~3 dias adicionais ≈ R$ 5.000 em escopo). Será comunicado antes da Fase 1.
2. **Mapa de registros Modbus disponível** pela Hitachi OU descoberto via engineering reverso. Não disponibilizado → +20h de Eng. Sr na Fase 0 (≈ R$ 5.800).
3. **Adição de novas zonas/UIs após entrega:** orçamento adicional sob escopo (não inclui mudanças fora dos pontos catalogados na Fase 0).
4. **CHILLER e GERADOR**: versões V2 e V3 com orçamento separado (não cobertas neste valor).
5. **30 dias de suporte pós-entrega** estão inclusos. Renovação como SLA contratual mensal sob consulta (Anexo C).
6. **Reajuste**: IGP-M anual a partir da renovação do OPEX (Ano 2+).

---

## 8. Histórico do documento

| Versão | Data | Alteração |
|---|---|---|
| v3 | 2026-05-12 | Criação inicial — alocação detalhada hora×perfil×fase para target R$ 100k |

