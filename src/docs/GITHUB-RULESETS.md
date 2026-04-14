# GitHub Rulesets — myio-js-library

## Visão Geral

```
feature/*, fix/*  →  desenv  →  main
     (dev)           (dev PR)   (admin only)
```

---

## Ruleset 1 — `protect-desenv`

**Target:** `refs/heads/desenv`

| Regra | Configuração |
|-------|-------------|
| `deletion` | Bloqueado — desenv nunca pode ser deletada |
| `non_fast_forward` | Bloqueado — force push proibido |
| `pull_request` | Obrigatório — PR com 1 approval para fazer merge |
| `dismiss_stale_reviews_on_push` | `true` — novo push na PR invalida approval anterior |

**Bypass:** OrganizationAdmin — admin pode fazer push direto em desenv sem PR.

**Comportamento:**
- Dev abre PR de `fix/*` ou `feat/*` → `desenv`
- Precisa de 1 review + 1 approval para merge
- Após merge, a branch do dev é deletada automaticamente ¹

---

## Ruleset 2 — `protect-main`

**Target:** `refs/heads/main`

| Regra | Configuração |
|-------|-------------|
| `deletion` | Bloqueado — main nunca pode ser deletada |
| `non_fast_forward` | Bloqueado — force push proibido |
| `pull_request` | Obrigatório — PR com 1 approval para fazer merge |
| `restrict_pushes` | Somente bypass actors podem fazer merge/push |
| `dismiss_stale_reviews_on_push` | `true` |

**Bypass:** OrganizationAdmin — somente admin pode abrir PR e fazer merge em main.

**Comportamento:**
- Dev **não pode** fazer merge de PR para main (push bloqueado por `restrict_pushes`)
- Admin abre PR de `desenv` → `main` e faz merge após approval
- Dev pode *abrir* um PR para main, mas não consegue fazer merge (somente admin)

> **Alternativa considerada:** permitir que dev abra PR `desenv` → `main` e faça merge
> com 1 approval. Nesse caso, remover `restrict_pushes` do ruleset de main.
> Recomendação: manter `restrict_pushes` — main deve ser controlada pelo admin.

---

## Nota ¹ — Auto-delete de branches após merge

Não é uma regra de ruleset — é uma configuração do repositório:

**GitHub → Settings → General → "Automatically delete head branches"** → ativar

Isso deleta automaticamente a branch do dev (`fix/*`, `feat/*`) após o merge do PR.
A desenv **não é deletada** pois possui `deletion` bloqueado no ruleset.

---

## Resumo de Permissões

| Ação | Dev | Admin |
|------|-----|-------|
| Push direto em `feature/*`, `fix/*` | ✅ | ✅ |
| Abrir PR para `desenv` | ✅ | ✅ |
| Fazer merge PR → `desenv` (com 1 approval) | ✅ | ✅ |
| Push direto em `desenv` | ❌ | ✅ (bypass) |
| Deletar `desenv` | ❌ | ❌ |
| Abrir PR para `main` | ✅ (abre, não faz merge) | ✅ |
| Fazer merge PR → `main` | ❌ | ✅ (bypass) |
| Push direto em `main` | ❌ | ✅ (bypass) |
| Deletar `main` | ❌ | ❌ |

---

## Aplicação via API (GitHub CLI)

### Deletar ruleset antigo `require-approval-all-branches`
```bash
gh api --method DELETE repos/gh-myio/myio-js-library/rulesets/14791783
```

### Criar `protect-desenv`
```bash
gh api --method POST repos/gh-myio/myio-js-library/rulesets \
  --field name="protect-desenv" \
  --field target="branch" \
  --field enforcement="active" \
  --field 'conditions={"ref_name":{"include":["refs/heads/desenv"],"exclude":[]}}' \
  --field 'rules=[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":1,"dismiss_stale_reviews_on_push":true,"require_last_push_approval":false,"required_review_thread_resolution":false}}]' \
  --field 'bypass_actors=[{"actor_id":null,"actor_type":"OrganizationAdmin","bypass_mode":"always"}]'
```

### Criar `protect-main`
```bash
gh api --method POST repos/gh-myio/myio-js-library/rulesets \
  --field name="protect-main" \
  --field target="branch" \
  --field enforcement="active" \
  --field 'conditions={"ref_name":{"include":["refs/heads/main"],"exclude":[]}}' \
  --field 'rules=[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":1,"dismiss_stale_reviews_on_push":true,"require_last_push_approval":false,"required_review_thread_resolution":false}},{"type":"restrict_pushes","parameters":{"restrict_creations":true,"push_allowances":[]}}]' \
  --field 'bypass_actors=[{"actor_id":null,"actor_type":"OrganizationAdmin","bypass_mode":"always"}]'
```

### Atualizar ruleset existente `protect-main-desenv` (alternativa ao recriar)
```bash
gh api --method PUT repos/gh-myio/myio-js-library/rulesets/8412146 \
  --field name="protect-main-desenv" \
  ...
```
