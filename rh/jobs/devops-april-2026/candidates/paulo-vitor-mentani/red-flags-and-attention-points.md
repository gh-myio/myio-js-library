# Red Flags e Pontos de Atenção — Paulo Vitor Mentani

**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data da análise:** 2026-04-08
**Fonte:** CV (02/2026) + Parecer Mena

> Documento de apoio à tomada de decisão. Baseado na análise do CV e do parecer do headhunter.
> Nenhum item aqui é eliminatório por si só — devem ser investigados na entrevista.

---

## 🔴 Red Flags — Riscos altos

### 1. Docker e containers completamente ausentes

Nenhuma menção a Docker, Docker Compose, podman ou qualquer ferramenta de orquestração de containers (Kubernetes, ECS, Swarm) — nem mesmo superficialmente.

Para uma vaga DevOps que envolve deployments de backend e serviços cloud, Docker é um requisito central e não negociável no dia a dia.

**Risco:** gap técnico direto em requisito obrigatório.
**Investigar:** se tem algum contato informal com containers; disposição e velocidade para aprender.

---

### 2. CI/CD completamente ausente

Sem menção a GitLab CI, GitHub Actions, Jenkins, CircleCI ou qualquer pipeline de entrega contínua. Toda a experiência é em desenvolvimento e deploy manual/OTA próprio.

**Risco:** vai precisar construir pipelines de CI/CD do zero sem referencial — curva íngreme para a função.
**Investigar:** se o processo de build/deploy nos projetos anteriores tinha alguma automação que não foi documentada no CV.

---

### 3. Comunicação lenta e truncada — feedback prévio documentado

O parecer do headhunter documenta explicitamente: _"fala lenta e truncada, dificuldade em explicar ideias de forma fluida e energética. Já recebeu feedback anterior sobre 'traduzir técnico para linguagem comum'."_

Em um time enxuto onde o DevOps precisa comunicar incidentes, coordenar rollouts e alinhar com desenvolvedores e clientes, clareza na comunicação é crítica.

**Risco:** impacto real na colaboração, na resposta a incidentes e na credibilidade técnica perante o cliente.
**Investigar:** como ele lida com esse feedback; se está trabalhando ativamente na habilidade.

---

## 🟡 Pontos de Atenção — Riscos médios

### 4. AWS limitado a scripts Python (Boto3)

A única menção a AWS no CV é "Python scripts using AWS SDK (Boto3)" na Power2Go (2021–2022). Não há evidência de administração de serviços cloud — EC2, RDS, S3, ECS, VPC, IAM, CloudWatch.

A vaga exige administrar e escalar backend, banco de dados e aplicação web/mobile na cloud.

**Investigar:** se tem conhecimento de administração AWS mesmo que informal; se já interagiu com console AWS além de scripts.

---

### 5. PostgreSQL não evidenciado

MySQL aparece na lista de qualificações, mas PostgreSQL — requisito explícito da vaga — não é mencionado em nenhuma experiência.

**Investigar:** se tem familiaridade com PostgreSQL, mesmo que a experiência principal seja MySQL.

---

### 6. VPN / mesh / firewall não explícitos

O candidato tem experiência sólida em troubleshooting remoto de dispositivos IoT, mas não menciona administração de VPN, rede mesh (Tailscale, WireGuard, Zerotier) ou configuração de firewall.

**Investigar:** como é feita a conectividade na Vammo entre os dispositivos e o backend — se passa por VPN/mesh ou outro mecanismo.

---

### 7. OTA com SWUpdate, não Mender / RAUC

A vaga menciona Mender e RAUC como desejáveis. Paulo usa SWUpdate + soluções proprietárias. A experiência prática com OTA em escala é real e valiosa, mas a ferramenta específica difere.

**Isso não é red flag** — SWUpdate é uma ferramenta legítima e a experiência em escala real é mais relevante que a ferramenta específica. Mas vale mapear.

**Investigar:** se já avaliou Mender/RAUC e qual seria o esforço de migração/aprendizado.

---

### 8. Domínio distante: mobilidade elétrica → automação predial

Toda a experiência recente (Vammo) é em mobilidade elétrica (motos, carregadores). O domínio da Myio é facilities/shoppings (energia, água, temperatura). Embora os problemas técnicos sejam similares (frota IoT, telemetria, OTA), o contexto operacional e os stakeholders são diferentes.

**Isso não é eliminatório** — o stack técnico é amplamente transferível.
**Investigar:** interesse genuíno no domínio de automação predial e monitoramento de facilities.

---

### 9. Pouco tempo em algumas empresas

| Empresa | Duração |
|---|---|
| Vammo (atual) | ~5 meses |
| Pagmob | ~6 meses |
| MAGNAMED (via Pasquali + direto) | ~21 meses total |
| Power2Go | ~11 meses |

Pagmob teve duração muito curta (6 meses). O padrão geral mostra rotatividade em empresas menores — pode ser padrão do mercado de startups/embedded ou instabilidade dos projetos.

**Investigar:** motivação das saídas, especialmente Pagmob (6 meses). O que o faria ficar em uma empresa por 2+ anos?

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Objetivo declarado "Technical Product Specialist" | Ambição de crescimento — não conflita com atuação técnica sólida no curto prazo |
| Firmware C/C++ mais que scripts bash/cloud | O core da vaga de gateways é exatamente firmware + Linux embarcado |
| SWUpdate em vez de Mender/RAUC | OTA em escala real vale mais do que o nome da ferramenta |
| Experiência em mobilidade, não facilities | Stack técnico é transferível; domínio é aprendível |
| 26 anos — sênior jovem | A profundidade técnica é real e comprovada em múltiplos contextos |
| Sem Prometheus/Grafana explícito | Telemetria MQTT + análise preditiva mostra mentalidade de observabilidade |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| Docker / containers ausente | 🔴 Alto | Parcialmente (confirmar lacuna + disposição) |
| CI/CD ausente | 🔴 Alto | Sim |
| Comunicação lenta e truncada | 🔴 Alto | Sim — avaliar ao vivo |
| AWS limitado a scripts | 🟡 Médio | Sim |
| PostgreSQL não evidenciado | 🟡 Médio | Sim |
| VPN / mesh não explícito | 🟡 Médio | Sim |
| OTA com SWUpdate (não Mender/RAUC) | 🟡 Baixo-Médio | Sim |
| Domínio diferente (mobilidade → facilities) | 🟡 Baixo | Sim |
| Rotatividade em Pagmob (6 meses) | 🟡 Médio | Sim |
