# Red Flags e Pontos de Atenção — Luiz Guilherme Martinho Sampaio Ito

**Vaga:** Engenheiro(a) DevOps — Nível Pleno / Sênior
**Data da análise:** 2026-04-08
**Fonte:** CV + Parecer Mena

> Documento de apoio à tomada de decisão. Baseado na análise do CV e do parecer do headhunter.
> Este candidato apresenta perfil geral forte — os riscos abaixo são proporcionalmente menores que em outros candidatos da seleção.

---

## 🔴 Red Flags — Riscos altos

### 1. Yocto / Buildroot não evidenciados

O CV lista "Embedded Linux" nas habilidades e o usa em Greenole e MCBTI, mas **não menciona Yocto, OpenEmbedded, Buildroot nem criação de distro Linux do zero**. A vaga exige explicitamente construção e manutenção de imagens Linux embarcado.

É possível que o candidato use Embedded Linux em nível de aplicação/middleware — não necessariamente em nível de build system, BSP ou kernel customization.

**Risco:** gap estrutural na responsabilidade central da frente de gateways.
**Investigar:** qual foi o nível mais profundo de trabalho com Linux embarcado — se chegou a criar ou modificar imagens, device trees, BSP ou se atuou em camadas superiores.

---

### 2. PostgreSQL completamente ausente

Banco de dados não é mencionado no CV. PostgreSQL é requisito obrigatório da vaga (administração em produção).

**Risco:** gap em requisito obrigatório.
**Investigar:** se tem familiaridade com PostgreSQL, mesmo que a experiência principal seja com outros bancos ou com dados via AWS IoT + armazenamento em nuvem.

---

## 🟡 Pontos de Atenção — Riscos médios

### 3. CI/CD sem ferramenta específica documentada

O parecer menciona "pipelines de desenvolvimento e integração contínua", mas o CV não cita GitLab CI, GitHub Actions, Jenkins ou qualquer ferramenta de pipeline explicitamente.

**Investigar:** qual ferramenta usa, se já montou pipelines do zero ou apenas consumiu pipelines existentes, e qual a complexidade dos stages.

---

### 4. VPN / mesh / firewall não documentados

O candidato tem experiência rica em conectividade IoT (LoRaWAN, NB-IoT, 4G, MQTT, BLE), mas **administração de VPN ou rede mesh** (WireGuard, Tailscale, Zerotier) para acesso seguro à frota não aparece no CV.

**Investigar:** como é feito o acesso remoto seguro aos dispositivos nos projetos anteriores — se usa VPN ou outro mecanismo.

---

### 5. Rotatividade nos últimos anos

| Empresa | Duração |
|---|---|
| MCBTI (atual) | ~14 meses |
| IOUPIE | ~9 meses |
| Power2Go | ~16 meses |
| Greenole | ~11 meses |
| ASTRAL Project | ~6 meses |

Padrão de 6–16 meses por empresa desde 2021. Pode ser ciclo de projetos PJ, startups em fase inicial ou instabilidade — mas o próprio candidato revelou no parecer que busca **maior previsibilidade e estabilidade** por isso. Isso é contextualmente compreensível, não necessariamente um red flag estrutural.

**Investigar:** qual o contexto de cada saída (empresa encerrou, projeto terminou, decisão própria?). O que faria ficar 3+ anos.

---

### 6. Mestrado em andamento (2024–2025)

Está cursando Mestrado em Engenharia de Computação na UFRGS simultaneamente ao trabalho full-time. Tema: Edge AI embarcado.

Isso é um diferencial técnico, mas **pode impactar disponibilidade** — especialmente em fases de escrita de dissertação ou defesa.

**Investigar:** qual o status atual do mestrado, qual é a demanda de tempo semanal e se há conflito com a dedicação esperada na vaga.

---

### 7. Localização: Farroupilha – RS

A vaga é remota ou híbrida com preferência por fuso -3 GMT. Farroupilha está no fuso -3 GMT, então sem problema de fuso. Porém, visitas presenciais (se necessárias) exigem viagem.

**Não é red flag** para modelo remoto, mas vale confirmar expectativa de deslocamento ocasional.

---

## 🟢 O que não é red flag (mas pode parecer)

| Item | Por quê não é problema |
|---|---|
| Objetivo "Technical Lead / Systems Integration" | Ambição natural para o nível de experiência; não conflita com execução técnica |
| Múltiplas pós-graduações + mestrado | Candidato investe sistematicamente em formação — diferencial raro |
| Inglês intermediário (3/5) | Suficiente para leitura técnica, documentação e comunicação básica; vaga é nacional |
| Infraestrutura PJ (Simples) | Regime flexível e compatível com a vaga (aceita PJ ou CLT) |
| IOUPIE (startup, 9 meses) | Encerrou ciclo como co-founder — padrão de startups early-stage |
| Rust no CV | Demonstra interesse em linguagens modernas para embedded — diferencial em vez de desvio |
| Edge AI no mestrado | Fora do escopo imediato da vaga, mas agrega visão de produto e evolução técnica |

---

## Resumo de riscos

| Risco | Nível | Investigável na entrevista? |
|---|---|---|
| Yocto / Buildroot não evidenciados | 🔴 Alto | Sim — resposta rápida |
| PostgreSQL ausente | 🔴 Alto | Sim |
| CI/CD sem ferramenta específica | 🟡 Médio | Sim |
| VPN / mesh não documentado | 🟡 Médio | Sim |
| Rotatividade por ciclo de projetos | 🟡 Médio | Sim — avaliar motivação |
| Mestrado em andamento (tempo) | 🟡 Médio | Sim |
| Localização RS (eventual presencial) | 🟢 Baixo | Confirmar expectativa |
