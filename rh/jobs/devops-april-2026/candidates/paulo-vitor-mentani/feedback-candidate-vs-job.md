# Feedback — Candidato × Vaga

**Candidato:** Paulo Vitor Mentani
**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data:** 2026-04-08
**Fonte:** Parecer Mena + CV (02/2026)

---

## Visão geral

| Dimensão | Avaliação | Peso |
|---|---|---|
| Linux embarcado (Yocto / Buildroot / OTA) | Alta | Alta |
| Gestão de frota IoT em escala | Alta | Alta |
| DevOps / Cloud (Docker, CI/CD, AWS infra) | Baixa | Alta |
| Redes / VPN / mesh / segurança | Baixa-Média | Média |
| Shell scripting / Python | Alta | Média |
| Fit comportamental / comunicação | Moderado | Média |

**Score estimado de aderência à vaga: 6 / 10**

> Candidato acima da média na metade mais rara da vaga (embedded + OTA + frota), abaixo da média na metade DevOps/cloud. Perfil de "Embedded DevOps", não DevOps puro.

---

## Análise critério a critério

### Responsabilidades da vaga

| Responsabilidade | Evidência | Aderência |
|---|---|---|
| Construir e manter imagens Linux embarcado | Yocto (Magnamed + Vammo), Buildroot, criou distro do zero | ✅ Atende plenamente |
| Pipeline OTA para centenas de dispositivos | SWUpdate + soluções proprietárias, frota 4.000+ motos e 500 carregadores | ✅ Atende plenamente |
| Rollouts graduais, monitoramento e rollbacks | Experiência prática com frota real + debug remoto em produção | ✅ Atende |
| Provisionamento de novos gateways | Test jigs + SOP para operações (Vammo) | ✅ Atende parcialmente |
| Administrar e escalar serviços cloud (backend, BD, web) | Não evidenciado — AWS apenas via Boto3 scripts | ❌ Não atende |
| Gerenciar deployments via Docker e AWS | Docker não mencionado; AWS em nível de scripts | ❌ Não atende |
| Manter e evoluir pipeline CI/CD | Não evidenciado | ❌ Não atende |
| Configurar observabilidade (métricas, dashboards, alertas) | Telemetria via MQTT e análise preditiva; sem Prometheus/Grafana | ⚠️ Atende parcialmente |
| Administrar rede mesh gateways ↔ cloud | Debug remoto em escala; sem VPN/mesh explícito | ⚠️ Atende parcialmente |
| Troubleshoot conectividade dispositivos remotos | Experiência real com frota + debug campo (Cazaquistão, carregadores) | ✅ Atende |
| Gerenciar autenticação e acesso seguro à frota | Não evidenciado | ❌ Não atende |
| Gerenciar secrets, chaves criptográficas, certificados | Integração EMV + IEC 7816-4 (Pagmob) — criptografia em nível de protocolo | ⚠️ Atende parcialmente |
| Planejar migração e atualização de dependências | Implícito no contexto Yocto/Buildroot; sem evidência direta | ⚠️ Parcial |
| Monitoramento proativo de saúde dos dispositivos | Análise preditiva de falhas de bateria com ML (Vammo) | ✅ Atende (diferencial) |

---

### Requisitos obrigatórios

| Requisito | Evidência | Aderência |
|---|---|---|
| Linux embarcado (Yocto / OpenEmbedded / Buildroot) | Yocto + Buildroot em produção real, criação de distro do zero | ✅ Atende plenamente |
| Docker e orquestração de containers | Não mencionado | ❌ Não atende |
| CI/CD (GitLab CI / GitHub Actions) | Não mencionado | ❌ Não atende |
| systemd e administração Linux | Implícito — embedded Linux profundo com drivers e daemons | ✅ Atende (implícito) |
| PostgreSQL em produção | MySQL mencionado; PostgreSQL ausente | ⚠️ Não confirmado |
| Redes: VPN/mesh, firewall, troubleshooting remoto | Troubleshooting remoto em escala real; VPN/mesh não explícito | ⚠️ Atende parcialmente |
| AWS | Boto3 em scripts Python (Power2Go); sem infra cloud | ⚠️ Atende parcialmente |
| Shell scripting + linguagem (Python / Go) | Python avançado + C/C++ sólido | ✅ Atende plenamente |

**Obrigatórios atendidos: 3 de 8 (2 parciais, 1 implícito)**

---

### Requisitos desejáveis

| Requisito | Evidência | Aderência |
|---|---|---|
| Nix / NixOS (flakes, cross-compilação, overlays) | Não mencionado | ❌ Não atende |
| OTA update (Mender / RAUC) | SWUpdate + soluções próprias — sem Mender/RAUC explícito | ⚠️ Atende (ferramenta diferente) |
| Erlang / Elixir ou Node.js | Não mencionado | ❌ Não atende |
| Prometheus + Grafana | Não mencionado | ❌ Não atende |
| Hardware embarcado (ARM, U-Boot) | ESP32 (Xtensa/ARM), STM32 (Cortex-M), BSP customization | ✅ Atende plenamente |

**Desejáveis atendidos: 1 de 5 (1 parcial)**

---

## Pontos fortes (o que ele traz de valor)

- **Linux embarcado de ponta**: Yocto + Buildroot em produção, criação de distros do zero, drivers, BSP — exatamente o core da vaga.
- **OTA em escala real**: frota 4.000+ dispositivos com SWUpdate + soluções proprietárias; experiência de rollout, debug remoto e correção em campo.
- **Firmware + hardware profundo**: C/C++, debug a nível de componente, test jigs — compreende o dispositivo de ponta a ponta.
- **Telemetria e análise preditiva**: MQTT em escala, algoritmos ML para previsão de falhas (diferencial raro em DevOps).
- **Protocolos IoT completos**: MQTT, Modbus, CAN, I2C, Bluetooth, LTE 4G — cobre a camada de conectividade.
- **Proatividade e autonomia**: criou test jigs, SOPs, integrou sistemas de pagamento do zero — perfil hands-on.
- **Inglês avançado**: diferencial para documentação técnica e comunicação internacional.

---

## Lacunas críticas

- **Docker e containers**: zero evidência — requisito obrigatório central para a camada cloud da Myio.
- **CI/CD**: sem menção a GitLab CI, GitHub Actions ou qualquer pipeline de entrega contínua.
- **AWS infra**: experiência limitada a scripts Python (Boto3); sem administração de serviços cloud.
- **VPN / mesh / firewall**: troubleshooting remoto evidenciado, mas sem gestão de rede explicada.
- **PostgreSQL**: MySQL mencionado, mas não PostgreSQL.
- **Observabilidade (Prometheus / Grafana)**: telemetria MQTT sim; stack de monitoramento padrão não.
- **Comunicação**: fala lenta e truncada — gap comportamental documentado pelo headhunter com feedback anterior.

---

## Recomendação final

| Decisão | Justificativa |
|---|---|
| ✅ Avançar para entrevista técnica | Stack embedded + OTA + frota é exatamente o que a Myio precisa e é difícil de encontrar |
| ⚠️ Investigar gaps DevOps/cloud | Docker, CI/CD e AWS são aprendíveis — avaliar disposição e velocidade de aprendizado |
| ⚠️ Avaliar comunicação ao vivo | Risco real para time enxuto — verificar se é timidez ou limitação estrutural |
| ⚠️ Considerar como candidato primário para frente embedded | Se a vaga for dividida entre embedded e cloud, Paulo é forte para a frente de gateways |

---

## Notas do avaliador

_Adicionar aqui._
