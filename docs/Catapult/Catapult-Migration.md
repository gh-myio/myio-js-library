# Catapult — Plano de Migração

> Mapeamento da planilha [`Catapult-Migration.xlsx`](./Catapult-Migration.xlsx) (aba única `Stage 1`, 16 tarefas, 3 colunas: `Task` / `Description` / `Size`).
> Fonte da verdade = a planilha; este `.md` é um espelho legível/rastreável dela para acompanhamento e discussão. Ao editar aqui, replicar a mudança na planilha (e vice-versa).

**Size** = estimativa de esforço em t-shirt sizing: **S**mall · **M**edium · **L**arge.

**Resumo:** 16 tarefas · 6× S · 7× M · 3× L

---

## Fase 1 — Repositório & Versionamento

| # | Tarefa | Size |
|---|---|:-:|
| 1 | Create a Git repository and make the first commit | S |

> Centralizar a versão do sistema recebido no GitHub corporativo, com estrutura inicial de branches, permissões e convenções de trabalho.

> ✅ **Fato confirmado:** o código-fonte completo do sistema legado **já foi recebido** e está versionado no Git corporativo — pré-condição desta fase já atendida.

## Fase 2 — Descoberta & Análise de Arquitetura

| # | Tarefa | Size |
|---|---|:-:|
| 2 | Run an LLM-based code analysis | L |
| 3 | Create a technical installation plan | M |

> **#2** — Usar o workflow BMAD Brownfield para mapear a arquitetura do sistema, identificar módulos, dependências, integrações e riscos de instalação.
> **#3** — Gerar um plano técnico de instalação com ordem de execução, componentes necessários, comandos, considerações-chave e pré-requisitos de ambiente.

## Fase 3 — Dependências Externas & Acessos

| # | Tarefa | Size |
|---|---|:-:|
| 4 | List all external dependencies | S |
| 5 | Collect credentials and access for external services | S |

> **#4** — Inventariar serviços, APIs, contas e integrações externas necessárias para o sistema operar corretamente.
> **#5** — Coletar tokens, chaves, logins, contas e permissões de todos os serviços externos identificados.

> ⚠️ **Nota de segurança**: ao executar #5, seguir a prática já estabelecida no projeto — nunca commitar credenciais/segredos reais neste repositório; usar cofre de segredos apropriado (variáveis de ambiente, secret manager) e referenciar aqui só onde/como estão guardados.

## Fase 4 — Infraestrutura & Ambiente Base

| # | Tarefa | Size |
|---|---|:-:|
| 6 | Provision the initial infrastructure | M |
| 7 | Configure the server baseline | M |
| 8 | Prepare the staging environment | S |
| 9 | Restore the database in the staging environment | S |

> **#6** — *(nota: a descrição desta linha na planilha original está duplicada da linha #5 — "Gather the tokens, keys, logins, accounts, and permissions..." — provável erro de copy/paste na planilha fonte; título da tarefa ("Provision the initial infrastructure") sugere que a descrição correta seria sobre provisionar a infraestrutura inicial. Vale corrigir na planilha.)*
> **#7** — Instalar e configurar o SO, servidor web, PHP, banco de dados, extensões, storage e ferramentas básicas.
> **#8** — Criar um ambiente separado para validação, testes e ajuste fino antes do release em produção.
> **#9** — Restaurar o banco de dados no ambiente de staging.

> ✅ **Fato confirmado:** **não existe ambiente de staging hoje** — a tarefa #8 parte do zero (não é ajuste de algo já existente), o que também reforça o `L`/`M` de esforço nas tarefas #10/#11 seguintes.

> ✅ **Fato confirmado:** a topologia atual **é só produção** — nenhum outro ambiente (dev local, staging, homolog) existe hoje. Confirma e reforça o fato acima.

> ✅ **Decisão registrada:** o staging novo (#8) **vai refletir fielmente a configuração de produção**, ao menos inicialmente.

## Fase 5 — Instalação & Validação da Aplicação

| # | Tarefa | Size |
|---|---|:-:|
| 10 | Perform the first application installation | L |
| 11 | Validate critical system workflows | L |

> **#10** — Subir a aplicação no novo ambiente com a configuração mínima necessária para funcionar.
> **#11** — Testar login, permissões, operações CRUD, uploads, jobs, integrações e outros fluxos de negócio centrais. Registrar erros, limitações, ajustes necessários e pontos de retrabalho encontrados durante a validação.

## Fase 6 — Automação de Deploy

| # | Tarefa | Size |
|---|---|:-:|
| 12 | Define the automated deployment model | S |
| 13 | Set up the deployment pipeline | M |

> **#12** — Escolher e definir o fluxo de deploy usando GitHub Actions, Docker, scripts ou um orquestrador simples.
> **#13** — Implementar o fluxo automatizado para publicar novas versões com segurança e rollback previsível.

> ✅ **Decisão registrada:** o orquestrador de deploy (#12) será o **Dokploy** (PaaS self-hosted para subir containers) — não Terraform gerenciando infra crua. Consequência direta: não há (nem precisa haver) state file remoto de Terraform (S3+DynamoDB lock / Terraform Cloud) para este projeto — o Dokploy assume essa camada.

> ✅ **Fatos confirmados (CI/CD):** **não existe pipeline de CI/CD hoje** (nenhum GitHub Actions/GitLab CI/Jenkins, nem parcial) e **não existe cobertura de teste automatizado** dos fluxos críticos no sistema legado. A estratégia de rollout dentro do Dokploy (#13) **será manual/deploy direto por ora** — não rolling/blue-green/canary nesta primeira fase.

## Fase 7 — Estratégia de Plataforma (Lovable / Supabase)

| # | Tarefa | Size |
|---|---|:-:|
| 14 | Define the Lovable usage strategy | S |
| 15 | Plan the frontend/backend separation | M |
| 16 | Define the Supabase strategy | S |

> **#14** — Decidir se o Lovable será usado apenas como ferramenta de desenvolvimento ou também como camada de edição para o time interno.
> **#15** — Avaliar quais partes podem ser desacopladas e quais devem permanecer no backend atual.
> **#16** — Avaliar quais partes do sistema podem migrar para o Supabase, especialmente banco de dados, auth e storage.

---

## Legenda de Size

| Size | Significado (uso convencional t-shirt sizing) |
|---|---|
| **S** | Small — esforço pontual, baixo risco/escopo |
| **M** | Medium — esforço moderado, múltiplos passos ou dependências |
| **L** | Large — esforço alto, escopo amplo ou incerteza significativa |

## Observações de mapeamento

- Planilha tem **1 aba** (`Stage 1`), **16 linhas de dados** (+ cabeçalho), **3 colunas** (`Task`, `Description`, `Size`) — sem colunas extras (status, responsável, data) na fonte original.
- Numeração `#1`–`#16` acima corresponde à ordem de linhas da planilha (linha 2 = #1, ..., linha 17 = #16) e ao agrupamento por fase é interpretativo (feito para este `.md`, não existe na planilha original).
- Fila #6 tem descrição provavelmente incorreta (duplicada da #5) — sinalizado acima, não corrigido automaticamente aqui para não divergir silenciosamente da fonte.

---

## Revisão BMAD Party-Mode — Checklist de Perguntas (2026-08-25)

O checklist de riscos de migração em `Catapult-Migration.php` (aba "Questions"/"Dúvidas") passou por uma rodada de revisão com 4 agentes BMAD reais (não simulados) — **🏗️ Winston** (arquitetura), **💻 Amelia** (execução/testabilidade), **📊 Mary** (rigor/evidência), **📋 John** (priorização/JTBD) — pedindo: o que falta no checklist, qual pergunta é bloqueante vs. crítica vs. baixa prioridade, e o que é redundante.

**Resultado inicial da rodada** (antes dos cortes do Rodrigo descritos no item 5 abaixo): checklist reorganizado em 16 categorias (6 novas), cada pergunta com uma **tag de prioridade** (🔴 Bloqueante / 🟠 Crítica / ⚪ Baixa) e — quando bloqueante — qual fase específica do plano ela trava (`blocksPhase`). O formulário ficou **bilíngue PT/EN** (texto das perguntas acompanha o seletor de idioma do painel; as respostas continuam sempre em PT, valor canônico da trilha de auditoria). **Checklist ativo hoje (após os cortes, em andamento): 36 perguntas em 14 categorias** — as categorias "PHP / Backend Legado" e "CI/CD" foram removidas por inteiro (somem sozinhas da renderização, já que nenhuma pergunta mais referencia esses `cat`). Esse número segue caindo conforme o Rodrigo revisa pergunta a pergunta — ver item 5 da seção seguinte para o critério de corte e a lista mais atual.

**Categorias novas adicionadas** (convergência Winston + Amelia): Dados & Schema, Testabilidade & Paridade de Dados, Jobs Assíncronos/Sessão & Storage, Observabilidade, Capacidade & Performance — nenhuma dessas existia no checklist original; cobrem exatamente onde migração de PHP legado costuma explodir (schema não documentado, sessão em arquivo local quebrando com múltiplos containers, cron jobs invisíveis numa varredura de rotas web).

**Perguntas reformuladas** (eram redundantes ou mal formuladas):
- `iac-1` — antes misturava "estado atual" com o destino já decidido (Dokploy) nas próprias opções; agora pergunta só o estado atual.
- `cicd-3` — antes listava Dokploy ao lado de blue-green/rolling/canary (erro de categoria — plataforma vs. estratégia de rollout dentro dela); agora pergunta só a estratégia de rollout.
- `env-1` — refocada para não duplicar o fato já registrado (sem staging hoje).
- `cicd-2` — religada à nova pergunta de fluxos críticos nomeados, em vez de genérica.
- **Critério de sucesso** (antes 1 pergunta de texto livre vaga) foi desmembrado em 4 perguntas testáveis (fluxos críticos nomeados, critério de "passou" por fluxo, tolerância de divergência, critério de go/no-go) — proposta da Amelia: uma frase solta não vira AC verificável pela tarefa #11.
- **Versionamento & Branching** consolidado de 3 perguntas pra 2 (Amelia) e retagueado como baixa prioridade (Winston) — Fase 1 já está resolvida (repo existe e versionado), então essas perguntas são decisão de time de baixo risco, não bloqueio técnico.

**Campo estrutural `decision_owner` — proposto e depois removido.** A Mary havia proposto: "quem preencheu o formulário" (`person_name`) e "quem tem autoridade pra aprovar essa decisão" são papéis diferentes, então virou campo irmão de `person_name` em vez de mais uma pergunta por categoria. **O Rodrigo removeu esse campo do formulário** (2026-08-25) — decisão registrada, não fica mais no form.

---

## Pontos que só o Rodrigo pode direcionar

Achados da mesa que não são pergunta de checklist — são decisão de produto/processo que só ele pode bater o martelo:

1. **Pergunta "dono de produto/negócio + gatilho da migração" (proposta pelo John como bloqueante) foi REMOVIDA do formulário por decisão do Rodrigo** (2026-08-25) — não incluída como pergunta ativa. Fica registrado aqui que a mesa considerou essa lacuna real (sem dono nomeado, ninguém tem autoridade formal pra validar as demais respostas do checklist), mas o Rodrigo optou por não formalizar isso como campo obrigatório do form.
2. **Existe um documento de negócio irmão do Catapult** (product brief, doc de kickoff) além destes dois artefatos (`.md` + `.php`)? A Mary perguntou isso diretamente — se existir, as perguntas de impacto de negócio/downtime/comunicação de cutover que faltam no checklist técnico pertencem lá, não aqui; se não existir, é lacuna real a considerar.
3. **A escolha do Lovable veio de decisão de negócio, ou é "stack nova" ainda sem teste de adequação pra este sistema PHP especificamente?** O John questionou isso diretamente — se for a segunda, o sizing S/M/S da Fase 7 pode estar errado (a nova pergunta `lov-scope` no checklist tenta capturar isso, mas a validação de fundo — "faz sentido usar Lovable aqui" — é decisão do Rodrigo, não algo que o checklist resolve sozinho).
4. **Critério de promoção "resposta do checklist → fato registrado neste `.md`"** — a Mary notou que isso já acontece (3 casos: código recebido, sem staging, Dokploy) mas sem regra escrita, e a trilha de auditoria é append-only (pode acumular respostas conflitantes da mesma pergunta ao longo do tempo). Proposta dela pra avaliação do Rodrigo: só promover resposta **yesno/choice** (não texto livre) que **não tenha resposta conflitante mais recente** na mesma pergunta no JSON. Ainda não adotado formalmente.
5. **Princípio de corte aplicado pelo Rodrigo (2026-08-25): perguntas "descobríveis por inspeção direta" saem do checklist.** Ele removeu, na sequência: `mig-flows`/`mig-pass` (fluxos críticos + critério de "passou"), a categoria inteira **PHP / Backend Legado** (`php-1` versão, `php-2` framework, `php-3` deps obsoletas, `php-secrets` hardcoded), `dat-schema`/`dat-charset`/`dat-size` (schema/charset/tamanho do banco) — todas com a justificativa "vai ser visto direto ao ter acesso ao código/banco/dump, não precisa perguntar antes". **Fica registrado como critério geral de curadoria do checklist**: perguntas que um humano só consegue responder observando um artefato técnico não deveriam estar no formulário — só perguntas que dependem de conhecimento/decisão de alguém.
6. **Segundo padrão de corte, distinto do item 5: perguntas cuja resposta o Rodrigo já sabe de cor viram FATO no `.md`, não pergunta removida sem registro.** Ele removeu a categoria inteira **CI/CD** (`cicd-1` pipeline hoje?, `cicd-2` cobertura de teste hoje?, `cicd-3` estratégia de rollout no Dokploy) e `env-1`/`env-2` (topologia atual, staging vai refletir produção?) — mas dessa vez com respostas conhecidas registradas como fato/decisão nas Fases 6 e 4 respectivamente (não existe CI/CD nem teste automatizado hoje, rollout será manual por ora; hoje só existe produção; staging novo vai refletir produção fielmente, ao menos inicialmente).
7. **Campo `decision_owner`** (proposto pela Mary) foi removido do formulário por decisão do Rodrigo — ver nota na seção anterior.

**Perguntas ainda no checklist que podem cair no mesmo critério do item 5, se o Rodrigo confirmar** (observáveis por inspeção direta, não precisam de pergunta): `dat-migrations` (repo/config do ORM), `job-cron` (crontabs/config do servidor), `host-1`/`host-2` (DNS/painel de hosting), `aud-1` (existência da tabela de log).

## Pontos futuros / backlog (não bloqueiam agora)

- **Riscos do Lovable** (categoria inteira) — relevante só pra Fase 7, não trava Fases 1-5.
- **Versionamento & Branching** — baixa prioridade, decisão de time reversível a qualquer momento.
- **Hosting & DNS → TTL baixo (`host-3`)** — só importa perto do go-live (cutover), não agora.
- **`php-3` (dependências obsoletas)** — não é pergunta pra responder agora; é achado esperado da tarefa #2 (análise de código), a registrar quando ela rodar.
- **Observabilidade / Capacidade & Performance** — categorias novas, críticas, mas relevantes principalmente a partir da Fase 3 em diante (provisionamento), não bloqueiam Fase 1-2.
