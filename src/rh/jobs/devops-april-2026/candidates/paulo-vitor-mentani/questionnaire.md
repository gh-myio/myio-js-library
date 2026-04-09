# Questionário de Entrevista — Paulo Vitor Mentani

**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data da entrevista:** —
**Entrevistador(a):** —

> **Objetivo:** Confirmar profundidade em embedded/OTA, mapear gaps reais em DevOps/cloud e avaliar comunicação técnica ao vivo. Priorizar perguntas marcadas com 🔴 (críticas).

---

## Bloco 1 — Linux embarcado (profundidade confirmada)

1. Na Magnamed você criou uma distro Linux do zero com Yocto para um ventilador hospitalar. Quais foram as principais decisões de arquitetura que você tomou — quais layers usou, como gerenciou dependências de pacotes?
2. 🔴 Quando você cria um BSP para um novo hardware, qual é o fluxo? Do device tree até a imagem rodando no dispositivo.
3. Como você gerencia updates de kernel ou drivers em produtos já em campo, sem risco de brick?
4. Já precisou criar ou modificar um systemd service ou unit file para gerenciar o ciclo de vida de uma aplicação? Como foi?
5. Qual é a diferença prática entre Yocto e Buildroot para você? Em que situação escolheria um ou outro?

---

## Bloco 2 — OTA e gestão de frota 🔴

6. 🔴 Na Vammo você tem 4.000+ dispositivos. Como o processo de OTA funciona na prática — do trigger até a confirmação de sucesso? Quem coordena o rollout gradual?
7. 🔴 Já teve um update que falhou em produção? O que aconteceu, como você detectou e qual foi o rollback?
8. Além do SWUpdate, você avaliou outras soluções como Mender ou RAUC? O que você conhece sobre elas?
9. Como você monitora a saúde dos dispositivos pós-update? Que métricas você coleta via MQTT?
10. O provisionamento de um novo gateway (do hardware zerado até conectado à plataforma) — como é esse fluxo na Vammo?

---

## Bloco 3 — DevOps / Cloud (mapear gaps) 🔴

11. 🔴 Você tem experiência com Docker — criação de Dockerfiles, docker-compose, redes entre containers? Já usou em algum projeto?
12. 🔴 Já montou ou manteve um pipeline de CI/CD? (GitLab CI, GitHub Actions, Jenkins, etc.) Consegue descrever os stages de um pipeline que você usaria para build + deploy de firmware?
13. 🔴 Quando menciona AWS no CV via Boto3, qual foi o uso? Só scripts de automação ou chegou a administrar serviços como EC2, RDS, S3, ECS?
14. Você já configurou ou administrou um banco de dados PostgreSQL em produção? Backup, replica, tuning de queries?
15. Já trabalhou com alguma ferramenta de observabilidade — Prometheus, Grafana, Datadog, ELK? Mesmo que superficialmente.

---

## Bloco 4 — Rede e segurança

16. 🔴 Como é feita a conectividade entre os dispositivos da Vammo e o backend? Os gateways têm IP público, usam VPN, ou alguma rede mesh?
17. Você já gerenciou certificados TLS/mTLS para autenticação de dispositivos? Como era o processo de rotação?
18. Na experiência com Pagmob (EMV, IEC 7816-4), o que você aprendeu sobre segurança criptográfica aplicada a hardware?
19. Como você faria o troubleshooting de um dispositivo IoT em campo que perdeu conectividade com o backend, sem acesso físico?

---

## Bloco 5 — Código e automação

20. Python é a sua principal linguagem de scripting. Qual foi o script mais complexo que você escreveu para automação de infra ou análise de dispositivos?
21. Você tem familiaridade com shell scripting (bash)? Consegue escrever um script que monitore um serviço e faça restart automático com logging?
22. Já trabalhou com Git em time — branches, pull requests, code review? Qual é seu fluxo de trabalho?
23. O que você usa para automação de testes de firmware — além de GoogleTest e Parasoft?

---

## Bloco 6 — Fit com a Myio

24. O contexto da Myio é shoppings/facilities — energia, água e temperatura. É diferente de motos elétricas. O que te atrai nesse domínio?
25. 🔴 A vaga envolve tanto embedded (gateways) quanto cloud infra. Qual das duas frentes você prefere? Como se vê daqui a 1 ano na posição?
26. Você gosta de trabalhar com documentação técnica — SOPs, runbooks, arquitetura? Dá exemplos do que você já produziu.
27. Em times pequenos e enxutos, a comunicação clara é crítica. Já recebeu feedback sobre isso — como você tem trabalhado essa habilidade?
28. Qual é a sua expectativa de regime (CLT ou PJ) e faixa salarial? Tem flexibilidade de horário para fuso -3 GMT?

---

## Espaço para anotações do entrevistador

| Pergunta | Resposta resumida | Avaliação |
|---|---|---|
| | | |
| | | |
| | | |

---

## Impressão geral pós-entrevista

**Profundidade técnica embedded:**
_—_

**Gaps DevOps/cloud — aprendíveis?:**
_—_

**Comunicação ao vivo:**
_—_

**Recomendação pós-entrevista:**
- [ ] Avançar para próxima etapa
- [ ] Avançar com ressalvas
- [ ] Não avançar
- [ ] Redirecionar (perfil embedded puro)

**Comentário final:**
_—_
