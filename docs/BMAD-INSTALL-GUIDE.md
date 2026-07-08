# BMAD V6 — Guia de Instalação para `myio-js-library-PROD`

> **Escopo:** Como instalar e usar o framework BMAD-METHOD V6 (bmadcode/BMAD-METHOD)
> nesta biblioteca, com referência cruzada à instalação já existente em
> `myio-app-5.2.0`.
>
> **Audiência:** Devs MYIO que querem usar agentes de IA (PM, Architect, Dev,
> QA, etc.) integrados ao Claude Code.
>
> **Pré-leitura:** [`CLAUDE-CODE-PROJECT-STRUCTURE.md`](./CLAUDE-CODE-PROJECT-STRUCTURE.md)

---

## 1. O que é BMAD V6

**BMAD-METHOD** é um framework de agentes de IA para desenvolvimento ágil. Cada
agente tem um papel (PM, Architect, Dev, QA, SM, Analyst, UX), persona própria
e workflows específicos. Em vez de pedir genericamente para o Claude
"implementar feature X", você invoca o **PM** para criar uma PRD, depois o
**Architect** para desenhar a solução, depois o **Dev** para implementar — cada
um com seu prompt especializado.

### Versão V6 (atual) vs V4 (legada)

A maioria dos tutoriais antigos descreve V4. **Estamos em V6.** As diferenças
estruturais:

| Aspecto | V4 (legada) | V6 (atual) |
|---|---|---|
| Diretório principal | `.bmad-core/` | `_bmad/` |
| Agentes Claude Code | `.claude/agents/bmad-*.md` (subagent-style) | Skills + workflows orquestrados |
| Slash commands | `.claude/commands/BMad/*.md` | `.claude/skills/bmad-*/SKILL.md` |
| Modular | Pacote único | Módulos: `core` + `bmm` (+ futuros) |
| Help interativo | Não | `bmad-help` skill que orienta no fluxo |
| Versionamento | Implícito | Manifest com versão por módulo |

**Não tente seguir tutorial de V4** — a estrutura mudou totalmente.

---

## 2. Pré-requisitos

| Requisito | Verificação |
|---|---|
| **Node.js ≥ 20** | `node -v` |
| **npm ≥ 10** | `npm -v` |
| **Git** | `git --version` |
| **Claude Code** instalado | `claude --version` |
| Terminal interativo | Bash, Zsh, ou PowerShell — **não** rodar dentro de pipe |

> ⚠️ O instalador BMAD é **interativo** (perguntas com setinhas). Rode em
> terminal real, não dentro de Claude Code via tool calls — não funciona bem.

---

## 3. Instalação — passo a passo

### 3.1 Abrir um terminal real (não no Claude Code)

```bash
cd C:/Projetos/GitHub/myio/myio-js-library-PROD.git
```

### 3.2 Rodar o instalador

```bash
npx bmad-method install
```

Aceite o prompt do `npx` para baixar o pacote (~2 MB).

### 3.3 Responder as perguntas interativas

| Pergunta | Resposta recomendada | Por quê |
|---|---|---|
| **Project type** | `Brownfield` | Lib já existe com código maduro, RFCs, etc. |
| **Modules to install** | `core` ✅ + `bmm` ✅ | Mesmos do `myio-app-5.2.0`. `core` = skills cross-cutting; `bmm` = workflow ágil completo. |
| **Expansions** | (nenhuma) | Game Dev / Creative Writing / DevOps Infrastructure não se aplicam aqui. |
| **IDE / host** | `claude-code` ✅ | Você já usa Claude Code. |
| **Web bundles** | `não` | Só marque se for usar BMAD em ChatGPT/Gemini Web também. |

### 3.4 Aguardar instalação (~30 segundos)

O instalador vai:
1. Baixar templates dos módulos
2. Criar `_bmad/` com toda a estrutura
3. Criar/atualizar `.claude/skills/` com os skills do `core`
4. Gerar `_bmad/_config/manifest.yaml` com a versão e timestamp

---

## 4. Estrutura esperada após instalação

```
myio-js-library-PROD.git/
├── _bmad/                              ← Motor BMAD (commitar no git)
│   ├── _config/
│   │   ├── manifest.yaml               ← Versão, módulos, IDE
│   │   ├── agent-manifest.csv          ← 6 agentes nomeados
│   │   ├── skill-manifest.csv          ← Catálogo de skills
│   │   ├── files-manifest.csv          ← Inventário de arquivos
│   │   └── bmad-help.csv               ← Roteiro do bmad-help
│   ├── core/                           ← 11 skills cross-cutting
│   │   ├── bmad-brainstorming/
│   │   ├── bmad-advanced-elicitation/
│   │   ├── bmad-distillator/
│   │   ├── bmad-editorial-review-prose/
│   │   ├── bmad-editorial-review-structure/
│   │   ├── bmad-help/
│   │   ├── bmad-index-docs/
│   │   ├── bmad-party-mode/
│   │   ├── bmad-review-adversarial-general/
│   │   ├── bmad-review-edge-case-hunter/
│   │   └── bmad-shard-doc/
│   └── bmm/                            ← BMad Method Module (workflow ágil)
│       ├── 1-analysis/
│       │   ├── bmad-agent-analyst/     ← Mary (Business Analyst)
│       │   ├── bmad-agent-tech-writer/ ← Paige (Tech Writer)
│       │   ├── bmad-document-project/
│       │   ├── bmad-prfaq/
│       │   ├── bmad-product-brief/
│       │   └── research/
│       ├── 2-plan-workflows/
│       │   ├── bmad-agent-pm/          ← John (Product Manager)
│       │   ├── bmad-agent-ux-designer/ ← Sally (UX Designer)
│       │   ├── bmad-create-prd/
│       │   ├── bmad-create-ux-design/
│       │   ├── bmad-edit-prd/
│       │   └── bmad-validate-prd/
│       ├── 3-solutioning/
│       │   ├── bmad-agent-architect/   ← Winston (System Architect)
│       │   ├── bmad-check-implementation-readiness/
│       │   ├── bmad-create-architecture/
│       │   ├── bmad-create-epics-and-stories/
│       │   └── bmad-generate-project-context/
│       └── 4-implementation/
│           ├── bmad-agent-dev/         ← Amelia (Senior Developer)
│           ├── bmad-checkpoint-preview/
│           ├── bmad-code-review/
│           ├── bmad-correct-course/
│           ├── bmad-create-story/
│           ├── bmad-dev-story/
│           ├── bmad-qa-generate-e2e-tests/
│           ├── bmad-quick-dev/
│           ├── bmad-retrospective/
│           └── bmad-sprint-planning/
│
└── .claude/
    └── skills/                         ← Espelha core/ (interface Claude Code)
        ├── bmad-brainstorming/SKILL.md
        ├── bmad-advanced-elicitation/SKILL.md
        ├── bmad-distillator/SKILL.md
        ├── bmad-editorial-review-prose/SKILL.md
        ├── bmad-editorial-review-structure/SKILL.md
        ├── bmad-help/SKILL.md
        ├── bmad-index-docs/SKILL.md
        ├── bmad-party-mode/SKILL.md
        ├── bmad-review-adversarial-general/SKILL.md
        ├── bmad-review-edge-case-hunter/SKILL.md
        └── bmad-shard-doc/SKILL.md
```

### 4.1 Por que dois diretórios (`_bmad/` e `.claude/skills/`)?

São **camadas complementares**, não duplicação:

- **`_bmad/`** é o "motor" — toda a lógica, templates, workflows, agent
  definitions. É o que o BMAD usa internamente.
- **`.claude/skills/`** é a "interface" para o Claude Code — apenas as 11
  skills do `core` ficam acessíveis via `/skill bmad-<nome>`. Os agentes
  específicos de fase (PM, Dev, etc.) ficam em `_bmad/bmm/` e são acessados
  através do `/skill bmad-help`.

---

## 5. Verificação pós-instalação

### 5.1 Conferir manifest

```bash
cat _bmad/_config/manifest.yaml
```

Esperado:
```yaml
installation:
  version: 6.x.x
  installDate: 2026-04-29T...
  lastUpdated: 2026-04-29T...
modules:
  - name: core
    version: 6.x.x
    source: built-in
  - name: bmm
    version: 6.x.x
    source: built-in
ides:
  - claude-code
```

### 5.2 Listar skills disponíveis

```bash
ls .claude/skills/
```

Deve mostrar 11 diretórios `bmad-*`.

### 5.3 Testar no Claude Code

Em uma sessão Claude Code:

```
/skill bmad-help
```

Deve abrir um menu interativo orientando próximos passos.

---

## 6. Como usar — fluxo recomendado

### 6.1 Brownfield já maduro (caso desta lib)

Como a lib já tem **muito código + RFCs + padrões consolidados**, o fluxo
clássico (PRD → Architecture → Story → Dev) é overkill para a maioria das
mudanças. Use BMAD pontualmente para:

| Cenário | Skill / agente |
|---|---|
| Brainstorm de uma feature nova | `/skill bmad-brainstorming` |
| Auditar um doc/RFC longo | `/skill bmad-editorial-review-structure` |
| Buscar edge cases num design | `/skill bmad-review-edge-case-hunter` |
| Adversarial review de uma proposta | `/skill bmad-review-adversarial-general` |
| Dividir uma RFC enorme em RFCs menores | `/skill bmad-shard-doc` |
| Indexar pasta de docs (gerar TOC) | `/skill bmad-index-docs` |
| Não sei o que fazer | `/skill bmad-help` |

### 6.2 Greenfield / feature grande (raro nesta lib)

Para uma feature **substancial** (tipo um novo widget completo, novo módulo
de relatório, nova integração), o fluxo BMM completo:

```
1. Mary (Analyst)        — bmad-product-brief, market research
2. John (PM)             — bmad-create-prd
3. Sally (UX Designer)   — bmad-create-ux-design (se tiver UI)
4. Winston (Architect)   — bmad-create-architecture
5. Winston (Architect)   — bmad-create-epics-and-stories
6. Amelia (Dev)          — bmad-dev-story (loop por story)
7. QA                    — bmad-qa-generate-e2e-tests
8. Time                  — bmad-retrospective
```

Cada agente é invocado via `/skill bmad-help` que te direciona para o
workflow apropriado.

---

## 7. Gitignore — o que commitar

**Commitar:**
- `_bmad/` inteiro
- `.claude/skills/bmad-*/` (gerados pelo instalador)

**Não commitar:**
- `.claude/settings.local.json` (já no `.gitignore`)
- Outputs gerados pelo BMAD em `output-location` configuradas (variam por
  workflow — checar `_bmad/_config/manifest.yaml`)

> ⚠️ Verificar `.gitignore` raiz antes de commitar a primeira vez. Adicionar
> regras específicas se necessário.

---

## 8. Atualizar o BMAD

```bash
npx bmad-method update
```

Lê `_bmad/_config/manifest.yaml`, compara com a versão mais recente no npm,
e aplica diff respeitando customizações suas em `_bmad/`.

---

## 9. Desinstalar (se necessário)

```bash
npx bmad-method uninstall
```

Remove `_bmad/` e os arquivos `.claude/skills/bmad-*` adicionados pelo
instalador. **Não toca** em `.claude/skills/` que você criou manualmente.

---

## 10. Perguntas frequentes

### "Devo instalar o BMAD nesta lib?"

**Argumentos a favor:**
- A lib já gera muitos RFCs (200+); o `bmad-shard-doc` e `bmad-index-docs`
  podem ajudar.
- `bmad-review-adversarial-general` é útil para criticar propostas próprias
  antes de commitar.
- Brainstorm de novos componentes/widgets fica mais estruturado.

**Argumentos contra:**
- A lib é **muito** madura; o fluxo PRD → Architecture → Story raramente
  cabe em mudanças cotidianas.
- Adiciona ~2-3 MB ao repo (`_bmad/` + skills).
- Se ninguém mais do time usar, vira "código morto".

**Recomendação:** instalar **só `core`** primeiro (sem `bmm`), validar que
agrega valor por 2-3 semanas, e só depois instalar `bmm` se sentir falta.
**No prompt do instalador, marcar só `core`.**

### "Posso instalar agora ou prefiro esperar?"

Sem urgência. Lib funciona normalmente sem BMAD. Instale quando tiver uma
feature/refactor grande para usar como teste real.

### "E se quiser instalar exatamente igual ao `myio-app-5.2.0`?"

Marque `core` + `bmm` + `claude-code` no instalador. Mesma config.

### "O que acontece se eu rodar duas vezes?"

O instalador detecta a instalação existente e faz um update. Não duplica.

---

## 11. Referências

- **Repositório oficial:** https://github.com/bmadcode/BMAD-METHOD
- **npm:** https://www.npmjs.com/package/bmad-method
- **Instalação no `myio-app-5.2.0`** (referência viva): `_bmad/_config/manifest.yaml` lá
- **Estrutura `.claude/`:** [`CLAUDE-CODE-PROJECT-STRUCTURE.md`](./CLAUDE-CODE-PROJECT-STRUCTURE.md)

---

## 12. Checklist de instalação

Use isto quando for executar:

- [ ] Terminal real aberto em `C:/Projetos/GitHub/myio/myio-js-library-PROD.git`
- [ ] `node -v` ≥ 20.x
- [ ] Git working tree limpo (`git status` mostra "nothing to commit")
- [ ] Decidiu: `core` apenas, ou `core` + `bmm`?
- [ ] Rodar `npx bmad-method install`
- [ ] Responder prompts (project type, modules, IDE, web bundles)
- [ ] Aguardar conclusão (~30s)
- [ ] Verificar `_bmad/_config/manifest.yaml` foi criado
- [ ] Verificar `.claude/skills/` tem novos `bmad-*`
- [ ] Testar `/skill bmad-help` no Claude Code
- [ ] Atualizar `.gitignore` se necessário
- [ ] Commit: `feat(bmad): install BMAD-METHOD v6.x.x (core + bmm) for Claude Code`
- [ ] Atualizar `CLAUDE.md` mencionando que BMAD está disponível

---

_Última atualização: 2026-04-29_
