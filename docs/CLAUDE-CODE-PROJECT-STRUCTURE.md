# Claude Code — Estrutura `.claude/` do Projeto

> **Escopo:** Referência sobre o que pode/deve existir no diretório `.claude/`
> de um projeto, comparativo entre os projetos MYIO e regras práticas para
> decidir quando criar cada artefato.
>
> **Audiência:** Devs MYIO usando Claude Code (CLI ou IDE plugin).

---

## 1. Por que existe `.claude/`?

`.claude/` é o diretório de configuração **por projeto** do Claude Code. Ele
permite que cada repositório tenha:

- Instruções permanentes que o Claude lê em toda sessão (`CLAUDE.md`).
- Permissões e settings específicas do time / pessoais.
- Subagentes, slash commands, skills e hooks customizados.
- Configurações de servidores MCP (Model Context Protocol).

Existe também um `~/.claude/` global (no home do usuário), com a mesma
estrutura — vale para todos os projetos. Settings de projeto **sobrescrevem**
as globais.

---

## 2. Comparativo dos projetos MYIO

| Arquivo / pasta       | `myio-app-5.2.0` | `myio-js-library-PROD` (atual) | Função |
|-----------------------|:---:|:---:|--------|
| `CLAUDE.md`           | ❌ | ✅ | Instruções permanentes (prompt do projeto) |
| `settings.json`       | ❌ | ✅ | Settings **commitadas** (compartilhadas com o time) |
| `settings.local.json` | ✅ | ✅ | Settings **pessoais** (gitignored) |
| `skills/`             | ✅ (BMAD) | ❌ | Skills custom invocadas via `/skill <nome>` |
| `agents/`             | ❌ | ❌ | Subagentes custom (chamados via `Task` tool) |
| `commands/`           | ❌ | ❌ | Slash commands custom (`/meucomando`) |
| `hooks/`              | ❌ | ❌ | Scripts shell que rodam em eventos do Claude |
| `mcp.json`            | ❌ | ❌ | Config de servidores MCP (ou dentro de `settings.json`) |
| `worktrees/`          | ❌ | ✅ | Estado interno de git worktrees (gerenciado pelo Claude) |

---

## 3. Detalhe de cada artefato

### 3.1 `CLAUDE.md`

Markdown lido **automaticamente** em toda sessão como instrução permanente.
Define convenções do projeto, padrões, comandos comuns, RFCs ativas.

**Quando criar:** sempre que houver uma convenção do projeto que você precisa
repetir em cada sessão (estrutura de pastas, padrões de código,
particularidades de build, etc.).

**Hierarquia de leitura:** `CLAUDE.md` no CWD → `.claude/CLAUDE.md` →
`~/.claude/CLAUDE.md` (global). Todos são concatenados; mais específico tem
prioridade.

### 3.2 `settings.json` vs `settings.local.json`

| | `settings.json` | `settings.local.json` |
|---|---|---|
| Vai pro git? | ✅ Sim | ❌ Não (gitignored) |
| Quem usa? | Todo o time | Só você |
| Para quê? | Permissões padrão, hooks compartilhados, env vars seguras | Tokens, paths absolutos seus, atalhos pessoais |

**Conteúdo típico:**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test:*)",
      "Bash(git status)",
      "WebFetch(domain:github.com)"
    ],
    "deny": ["Bash(rm -rf:*)"]
  },
  "env": {
    "DEBUG": "true"
  },
  "hooks": {
    "PreToolUse": [],
    "Stop": []
  },
  "model": "claude-opus-4-7",
  "outputStyle": "default"
}
```

### 3.3 `agents/`

Subagentes **especializados** que você invoca via tool `Task`. Cada um é um
`.md` com frontmatter (nome, descrição, tools permitidas) + system prompt.

**Diferente de skills:**
- Agente roda **isolado** — contexto próprio, não polui o seu.
- Retorna um único resultado consolidado.
- Skill roda **inline** na sua sessão (todo conteúdo entra no contexto).

**Exemplos úteis pra MYIO:**
- `code-reviewer.md` — review de PRs com critérios próprios do time
- `db-query-helper.md` — formula queries SQL pro schema das centrais
- `tb-widget-debugger.md` — diagnostica widgets ThingsBoard
- `rfc-author.md` — gera RFCs no formato Rust-RFC

### 3.4 `commands/`

Slash commands custom. Cada `.md` em `.claude/commands/X.md` vira `/X` no
Claude Code.

**Sintaxe:** arquivo markdown com `$ARGUMENTS` placeholder onde o input do
usuário é injetado.

**Exemplos pra MYIO:**
- `/release-checklist` — roda lint + test + size-check em sequência
- `/rfc-new <título>` — cria scaffold de novo RFC com numeração automática
- `/widget-bundle <nome>` — empacota um widget TB para deploy
- `/expo-doctor` — roda `npx expo-doctor` e analisa o output

### 3.5 `hooks/`

Pasta convencional para **scripts shell** referenciados em
`settings.json::hooks`. Eventos disponíveis:

| Evento | Quando dispara |
|---|---|
| `PreToolUse` | Antes do Claude usar uma tool — pode bloquear |
| `PostToolUse` | Depois do Claude usar uma tool — pode logar |
| `UserPromptSubmit` | Quando você envia um prompt |
| `Stop` | Quando Claude termina um turno |
| `SubagentStop` | Quando um subagente termina |
| `Notification` | Quando Claude emite uma notificação |

**Casos de uso:**
- Bloquear edição de arquivos sensíveis (`.env`, `*.pem`)
- Auto-formatar ao salvar (rodar `prettier` em `PostToolUse` de `Edit`)
- Logar atividade pra auditoria
- Bipar quando Claude termina (`Stop`)

### 3.6 `mcp.json` (ou `settings.json::mcpServers`)

Config de servidores MCP — fontes externas de tools/dados. Servidores comuns:

| Servidor | Função |
|---|---|
| `filesystem` | Acesso a paths fora do CWD |
| `github` | Leitura de PRs/issues sem `gh` CLI |
| `postgres` | Query direto num DB (útil pras centrais Macaé/Dimension) |
| `slack` | Postar/ler mensagens |

### 3.7 `skills/`

Pacotes invocáveis via `/skill <nome>`. Cada skill é um diretório com
`SKILL.md` no formato YAML-frontmatter.

**No `myio-app-5.2.0`:** 11 skills do BMAD V6 (brainstorming, advanced
elicitation, doc-sharding, reviews, etc.). Ver
[`BMAD-INSTALL-GUIDE.md`](./BMAD-INSTALL-GUIDE.md).

### 3.8 `worktrees/`

Diretório **gerenciado pelo Claude Code** quando você usa o `EnterWorktree` /
worktree mode. Não editar manualmente.

---

## 4. Estado atual dos projetos MYIO

### 4.1 `myio-js-library-PROD` (este repo)

```
.claude/
├── CLAUDE.md            (430+ linhas — convenções, RFCs, padrões TB)
├── settings.json        (settings commitadas)
├── settings.local.json  (settings pessoais)
└── worktrees/           (gerenciado automaticamente)
```

**Bem servido.** Possíveis adições futuras:
- `agents/tb-widget-tester.md` — valida widget TB antes de publicar
- `commands/release.md` — atalho pra `npm run build && npm run smoke-test`
- `agents/rfc-author.md` — gera RFCs no formato Rust-RFC

### 4.2 `myio-app-5.2.0`

```
.claude/
├── settings.local.json  (settings pessoais)
└── skills/              (11 skills BMAD V6)
```

**Falta:**
- ❌ `CLAUDE.md` — sem instruções permanentes; cada sessão começa do zero
- ❌ `settings.json` — sem permissões padrão; todo prompt repete

**Sugestão de criação prioritária:**

| Adição | Por quê |
|---|---|
| `.claude/CLAUDE.md` | Documentar padrões: estrutura `src/core/`, convenções Expo, uso de MMKV, aliases TypeScript (`@core/...`). |
| `.claude/settings.json` | Permissions padrão: `allow Bash(npm:*)`, `allow Bash(npx expo:*)`. Reduz prompts repetidos. |
| `.claude/commands/expo-doctor.md` | Atalho `/expo-doctor` que roda `npx expo-doctor` e analisa o output. |
| `.claude/agents/rn-component-reviewer.md` | Review focado em React Native (perf, re-renders, FlatList vs map). |
| MCP `postgres` configurado | Pra Claude consultar `consumption_realtime` direto da central (com SSH tunnel) sem passar pelo terminal. |

---

## 5. Regras práticas — quando criar cada artefato

| Sintoma | Solução |
|---------|---------|
| Repete a mesma instrução/contexto em sessões diferentes | Vira `CLAUDE.md` |
| Roda o mesmo comando várias vezes | Vira `commands/` |
| Concede a mesma permissão toda hora | Vira `settings.json` |
| Faz a mesma análise/review repetidas vezes | Vira `agents/` |
| Quer rodar X automaticamente em todo Y | Vira `hooks/` |
| Precisa de capacidade que tools nativos não têm | Vira MCP server |
| Comportamento específico que mistura instrução + workflow | Vira `skills/` |

**Princípio:** só crie quando perceber que está repetindo. Não pré-otimize.

---

## 6. Hierarquia de carregamento

Quando uma sessão Claude Code inicia em `/projeto/foo/bar/`:

1. `~/.claude/settings.json` — global do usuário (todos os projetos)
2. `~/.claude/settings.local.json` — global pessoal
3. `/projeto/foo/.claude/settings.json` — mais próximo do CWD subindo na árvore
4. `/projeto/foo/.claude/settings.local.json`
5. `/projeto/foo/bar/.claude/settings.json` (se existir)
6. `/projeto/foo/bar/.claude/settings.local.json`

Mais específico (mais profundo) vence em conflito. CLAUDE.md são **concatenados**
(não sobrescritos) — o Claude lê todos da árvore.

---

## 7. Gitignore recomendado

Em `.gitignore` do projeto:

```gitignore
# Claude Code — settings pessoais
.claude/settings.local.json

# Claude Code — worktrees gerenciados
.claude/worktrees/
```

**Mantenha no git:**
- `.claude/CLAUDE.md`
- `.claude/settings.json`
- `.claude/agents/` (se houver)
- `.claude/commands/` (se houver)
- `.claude/skills/` (se houver — o BMAD adiciona)
- `.claude/hooks/` (se houver)

---

## 8. Documentação oficial

- **Claude Code docs:** https://docs.claude.com/en/docs/claude-code
- **Settings reference:** https://docs.claude.com/en/docs/claude-code/settings
- **Hooks guide:** https://docs.claude.com/en/docs/claude-code/hooks
- **Subagents:** https://docs.claude.com/en/docs/claude-code/sub-agents

---

_Última atualização: 2026-04-29_
