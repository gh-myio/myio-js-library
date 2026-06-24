# Questionário de Entrevista — Luiz Guilherme Martinho Sampaio Ito

**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data da entrevista:** —
**Entrevistador(a):** —

> **Objetivo:** Confirmar profundidade em Embedded Linux / Yocto, mapear CI/CD real, avaliar fit cloud e aprofundar OTA com segurança. Candidato tem boa comunicação — foco em substância técnica. Priorizar perguntas marcadas com 🔴 (críticas).

---

## Bloco 1 — Linux embarcado (ponto crítico a mapear) 🔴

1. 🔴 No CV você menciona Embedded Linux em Greenole e MCBTI. Você já trabalhou com **Yocto Project** ou **Buildroot** para criar ou customizar uma distro do zero? Qual foi a experiência mais profunda que você teve com imagem Linux embarcado?
2. 🔴 Se você precisasse criar uma imagem mínima para um novo gateway (ex: baseado em ARM Cortex-A), por onde você começaria? Qual toolchain, qual build system?
3. Você já escreveu ou modificou um **device tree** (DTS)? Em qual contexto?
4. Como você gerencia **versões de kernel** em dispositivos já em campo — sem risco de brick?
5. Qual é a diferença prática que você vê entre Yocto e Buildroot? Quando usaria cada um?

---

## Bloco 2 — OTA e segurança (ponto forte confirmado)

6. No Power2Go e na IOUPIE você implementou OTA com rollback e criptografia. Qual foi a arquitetura técnica? Como era a divisão de partições de memória?
7. Como você garante que uma atualização corrompida ou mal-assinada nunca seja aplicada em campo? O que acontece se a energia cair no meio do flash?
8. Você mencionou "atualização fragmentada" como solução para limitações de hardware. Pode detalhar — qual era a limitação e como você contornou?
9. Você usa alguma ferramenta específica para OTA (Mender, RAUC, SWUpdate, solução própria)?
10. Como você lida com rollout gradual em uma frota — você já enviou um update para 10% dos dispositivos antes de um rollout completo? Como era o critério de validação?

---

## Bloco 3 — Cloud / AWS / Docker 🔴

11. 🔴 AWS IoT Core aparece em IOUPIE e Power2Go. Você administrava apenas a integração device-to-cloud ou também o provisionamento de Things, políticas IAM, regras de roteamento e integrações com outros serviços AWS?
12. 🔴 Docker aparece nas suas habilidades. Você já criou Dockerfiles do zero, montou um docker-compose multi-serviço ou gerenciou ambientes containerizados em produção? Qual foi o caso mais complexo?
13. Você já usou algum serviço AWS além de IoT Core? (EC2, RDS, S3, Lambda, ECS, CloudWatch)
14. 🔴 CI/CD: o parecer menciona "pipelines de integração contínua". Qual ferramenta você usou — GitLab CI, GitHub Actions, Jenkins? Consegue descrever os stages de um pipeline típico que você montou?
15. Você já configurou algum sistema de observabilidade — Prometheus, Grafana, CloudWatch, Datadog? Como você monitora a saúde dos dispositivos em produção?

---

## Bloco 4 — Rede e conectividade

16. Você já configurou ou administrou uma **VPN** (WireGuard, OpenVPN, Tailscale) para conectar dispositivos remotos ao backend?
17. No contexto de IoT com LoRaWAN e NB-IoT, como você trata a reconexão automática de dispositivos que perdem sinal por horas?
18. Como você faria o debug de um dispositivo em campo (Farroupilha, RS) que reportou conectividade instável — sem acesso físico?
19. Você já trabalhou com **OCPP** (Power2Go — totens EV)? Como era a integração com o backend?

---

## Bloco 5 — Banco de dados e dados

20. Você tem experiência com **PostgreSQL** em produção? Backup, replica, consultas de validação de dados de telemetria?
21. Como você armazena e consulta séries temporais de telemetria IoT? Já usou TimescaleDB, InfluxDB ou similar?
22. No mestrado (Edge AI — UFRGS), qual é o problema que você está resolvendo? Como isso se conecta com IoT embarcado?

---

## Bloco 6 — Liderança e processo

23. Na MCBTI você faz gestão de squad com Kanban e one-on-ones. Qual é o maior desafio que você enfrenta como Tech Lead no dia a dia?
24. Como você conduz um **code review** de firmware com foco em confiabilidade? Quais são os critérios de aprovação que você usa?
25. Você já precisou tomar uma decisão técnica que conflitava com o prazo do produto? Como conduziu?

---

## Bloco 7 — Fit com a Myio

26. O modelo atual (PJ por projetos) gera menos previsibilidade — o que você busca de diferente? Qual seria o ambiente ideal para você nos próximos 2–3 anos?
27. A vaga envolve tanto gateways embarcados quanto infra cloud. Em qual frente você se sente mais forte hoje? Onde quer crescer?
28. A empresa tem fuso -3 GMT e modelo remoto/híbrido. Farroupilha/RS não é problema para você?
29. Tem alguma pergunta sobre o produto, o time ou o escopo da vaga?

---

## Espaço para anotações do entrevistador

| Pergunta | Resposta resumida | Avaliação |
|---|---|---|
| | | |
| | | |
| | | |

---

## Impressão geral pós-entrevista

**Profundidade Yocto/Buildroot:**
_—_

**CI/CD real — ferramenta e maturidade:**
_—_

**AWS além de IoT Core:**
_—_

**Comunicação ao vivo:**
_—_

**Recomendação pós-entrevista:**
- [ ] Avançar para próxima etapa
- [ ] Avançar com ressalvas
- [ ] Não avançar
- [ ] Candidato principal — priorizar

**Comentário final:**
_—_
