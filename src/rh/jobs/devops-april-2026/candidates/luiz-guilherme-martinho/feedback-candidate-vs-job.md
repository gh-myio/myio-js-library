# Feedback — Candidato × Vaga

**Candidato:** Luiz Guilherme Martinho Sampaio Ito
**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data:** 2026-04-08
**Fonte:** Parecer Mena + CV

---

## Visão geral

| Dimensão | Avaliação | Peso |
|---|---|---|
| Linux embarcado / OTA / firmware | Alta | Alta |
| Cloud / AWS / Docker | Alta | Alta |
| CI/CD e observabilidade | Média | Alta |
| Redes / VPN / segurança | Média-Alta | Média |
| Shell scripting / Python / linguagens | Alta | Média |
| Fit comportamental / comunicação | Alta | Média |
| Liderança e visão de produto | Alta | Baixa |

**Score estimado de aderência à vaga: 7,5 / 10**

> Candidato mais completo da seleção até agora. Cobre embedded + cloud com Docker e AWS IoT reais. Gap principal: Yocto/Buildroot não explicitado. Soft skills excelentes — diferencial claro sobre Paulo Mentani.

---

## Análise critério a critério

### Responsabilidades da vaga

| Responsabilidade | Evidência | Aderência |
|---|---|---|
| Construir e manter imagens Linux embarcado | Embedded Linux (Greenole, MCBTI); sem menção explícita a Yocto/Buildroot | ⚠️ Atende parcialmente |
| Pipeline OTA para centenas de dispositivos | OTA com rollback, criptografia, integridade (IOUPIE, Power2Go); bootloader embarcado | ✅ Atende plenamente |
| Rollouts graduais, monitoramento e rollbacks | Estratégias de rollback por partição; validação de integridade antes de produção | ✅ Atende |
| Provisionamento de novos gateways | Arquitetura de smart lockers do zero (hardware + firmware + cloud); ESP-IDF + AWS IoT Core | ✅ Atende |
| Administrar e escalar serviços cloud | AWS IoT Core em produção (IOUPIE + Power2Go); Docker; pipelines de desenvolvimento | ✅ Atende |
| Gerenciar deployments via Docker e AWS | Docker listado nas habilidades; AWS IoT Core confirmado em múltiplas experiências | ✅ Atende |
| Manter e evoluir pipeline CI/CD | "Pipelines de integração contínua" citado no parecer; sem detalhe de ferramenta específica | ⚠️ Atende parcialmente |
| Configurar observabilidade (métricas, dashboards, alertas) | Pipeline de testes + monitoramento de dispositivos + homologação formal; sem Prometheus/Grafana | ⚠️ Atende parcialmente |
| Administrar rede mesh gateways ↔ cloud | LoRaWAN, NB-IoT, 4G, Wi-Fi, BLE — múltiplas camadas de conectividade; sem VPN/mesh explícito | ⚠️ Atende parcialmente |
| Troubleshoot conectividade dispositivos remotos | Carregadores EV (Power2Go), smart lockers (IOUPIE), monitoramento ambiental (ASTRAL) | ✅ Atende |
| Gerenciar autenticação e acesso seguro à frota | Autenticação de atualizações + comunicação segura device-to-cloud | ✅ Atende |
| Gerenciar secrets, chaves criptográficas, certificados | Criptografia de firmware + validação de integridade no fluxo OTA | ✅ Atende |
| Planejar migração e atualização de dependências | OTA seguro em campo + bootloader com rollback | ✅ Atende |
| Monitoramento proativo de saúde dos dispositivos | Telemetria + monitoramento de confiabilidade em operação (parecer) | ✅ Atende |

---

### Requisitos obrigatórios

| Requisito | Evidência | Aderência |
|---|---|---|
| Linux embarcado (Yocto / OpenEmbedded / Buildroot) | Embedded Linux confirmado; Yocto/Buildroot não citados explicitamente | ⚠️ Atende (profundidade a confirmar) |
| Docker e orquestração de containers | Docker nas habilidades + citado no parecer | ✅ Atende |
| CI/CD (GitLab CI / GitHub Actions) | Integração contínua no parecer; ferramenta não especificada | ⚠️ Atende parcialmente |
| systemd e administração Linux | Implícito — Embedded Linux profundo em múltiplas empresas | ✅ Atende (implícito) |
| PostgreSQL em produção | Não evidenciado | ❌ Não confirmado |
| Redes: VPN/mesh, firewall, troubleshooting remoto | Múltiplos protocolos + carregadores EV em campo; VPN/mesh não explícito | ⚠️ Atende parcialmente |
| AWS | AWS IoT Core em IOUPIE e Power2Go; Docker + CI/CD | ✅ Atende |
| Shell scripting + linguagem (Python / Go) | Python avançado, C/C++ avançado, Rust intermediário | ✅ Atende plenamente |

**Obrigatórios atendidos: 4 de 8 (2 parciais, 1 implícito)**

---

### Requisitos desejáveis

| Requisito | Evidência | Aderência |
|---|---|---|
| Nix / NixOS (flakes, cross-compilação, overlays) | Não mencionado | ❌ Não atende |
| OTA update (Mender / RAUC) | OTA avançado com rollback, criptografia, integridade — ferramenta própria/não nomeada | ✅ Atende (conceito > ferramenta) |
| Erlang / Elixir ou Node.js | Não mencionado | ❌ Não atende |
| Prometheus + Grafana | Observabilidade citada no comportamento; sem stack específica | ⚠️ Não confirmado |
| Hardware embarcado (ARM, U-Boot) | ESP32 (Xtensa/ARM), STM32 (Cortex-M), bootloader embarcado, KiCAD (PCB) | ✅ Atende plenamente |

**Desejáveis atendidos: 2 de 5 (1 parcial)**

---

## Pontos fortes (o que ele traz de valor)

- **Stack completa embedded + cloud**: firmware C/C++, Embedded Linux, AWS IoT Core e Docker em produção — cobre ambas as frentes da vaga.
- **OTA com profundidade de segurança**: rollback por partição, criptografia de firmware, validação de integridade, atualização fragmentada para hardware limitado — além do básico.
- **Comunicação excelente**: clara, estruturada, didática — diferencial crítico para time enxuto comparado a outros candidatos.
- **Liderança comprovada**: Tech Lead (MCBTI + Power2Go) + Co-founder/Head of IoT (IOUPIE) — traz visão estratégica, não só execução.
- **Rust como diferencial**: linguagem crescente em embedded e sistemas com foco em segurança/confiabilidade.
- **Mestrado em andamento (UFRGS)**: Edge AI aplicado a embedded — candidato em evolução contínua.
- **Infraestrutura própria de desenvolvimento**: laboratório em casa, automação da residência — comprometimento pessoal com a área.
- **Prêmios**: Renault Experience (engenharia) e Startup Weekend — perfil criativo e competitivo.

---

## Lacunas críticas

- **Yocto / Buildroot não explicitados**: Embedded Linux confirmado, mas criação de distro do zero, BSP e layers Yocto — nível de profundidade exigido pela vaga — não evidenciado no CV.
- **PostgreSQL**: ausente — requisito obrigatório da vaga.
- **VPN / mesh / firewall**: múltiplos protocolos de conectividade, mas administração de VPN ou rede mesh não documentada.
- **CI/CD sem ferramenta específica**: integração contínua mencionada no parecer, mas sem evidência de GitLab CI, GitHub Actions ou similar.
- **Prometheus / Grafana**: observabilidade estruturada confirmada no comportamento, mas stack de monitoramento não especificada.

---

## Comparativo com Paulo Vitor Mentani

| Critério | Luiz Guilherme | Paulo Mentani |
|---|---|---|
| Yocto / Buildroot | ⚠️ Não explícito | ✅ Produção confirmada |
| OTA em escala | ✅ Com segurança avançada | ✅ Com frota 4.000+ |
| Docker | ✅ Confirmado | ❌ Não evidenciado |
| AWS IoT Core | ✅ IOUPIE + Power2Go | ⚠️ Apenas Boto3 scripts |
| CI/CD | ⚠️ Parcial | ❌ Não evidenciado |
| PostgreSQL | ❌ | ❌ |
| Comunicação | ✅ Clara e didática | ⚠️ Lenta e truncada |
| Liderança | ✅ Tech Lead + Co-founder | ⚠️ Não evidenciada |
| Pretensão | R$ 15k PJ | R$ 12k CLT |
| Localização | Farroupilha/RS (remoto) | Osasco/SP (híbrido) |

---

## Recomendação final

| Decisão | Justificativa |
|---|---|
| ✅ Avançar com prioridade | Candidato mais completo da seleção — cobre embedded + cloud + liderança + comunicação |
| ⚠️ Investigar Yocto/Buildroot | Gap crítico para a frente de gateways — verificar profundidade real em imagens Linux |
| ⚠️ Mapear CI/CD real | Confirmar ferramentas usadas e nível de maturidade em pipelines |
| ⚠️ Verificar regime PJ vs. vaga | A vaga aceita PJ ou CLT; confirmar se há flexibilidade de ambos os lados |

---

## Notas do avaliador

_Adicionar aqui._
