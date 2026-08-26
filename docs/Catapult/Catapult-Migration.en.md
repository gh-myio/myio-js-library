# Catapult — Migration Plan

> Mapping of the [`Catapult-Migration.xlsx`](./Catapult-Migration.xlsx) spreadsheet (single `Stage 1` sheet, 16 tasks, 3 columns: `Task` / `Description` / `Size`).
> Source of truth = the spreadsheet; this `.md` is a readable/trackable mirror of it for follow-up and discussion. When editing here, replicate the change in the spreadsheet (and vice versa).
>
> **This is the English translation of [`Catapult-Migration.md`](./Catapult-Migration.md), which stays the actively-edited PT source.** If the two drift, `Catapult-Migration.md` (PT) is authoritative.

**Size** = effort estimate in t-shirt sizing: **S**mall · **M**edium · **L**arge.

**Summary:** 16 tasks · 6× S · 7× M · 3× L

---

## Phase 1 — Repository & Version Control

| # | Task | Size |
|---|---|:-:|
| 1 | Create a Git repository and make the first commit | S |

> Centralize the version of the system received into Corporate Github, with an initial structure for branches, permissions, and working conventions.

> ✅ **Confirmed fact:** the complete legacy system source code **has already been received** and is versioned in the corporate Git — this phase's precondition is already met.

## Phase 2 — Discovery & Architecture Analysis

| # | Task | Size |
|---|---|:-:|
| 2 | Run an LLM-based code analysis | L |
| 3 | Create a technical installation plan | M |

> **#2** — Use the BMAD Brownfield workflow to map the system architecture, identify modules, dependencies, integrations, and installation risks.
> **#3** — Generate a technical installation plan with execution order, required components, commands, key considerations, and environment prerequisites.

## Phase 3 — External Dependencies & Access

| # | Task | Size |
|---|---|:-:|
| 4 | List all external dependencies | S |
| 5 | Collect credentials and access for external services | S |

> **#4** — Inventory the services, APIs, accounts, and external integrations required for the system to operate correctly.
> **#5** — Gather the tokens, keys, logins, accounts, and permissions for all identified external services.

> ⚠️ **Security note**: when executing #5, follow the practice already established in this project — never commit real credentials/secrets to this repository; use an appropriate secrets vault (environment variables, secret manager) and reference here only where/how they're stored.

## Phase 4 — Infrastructure & Base Environment

| # | Task | Size |
|---|---|:-:|
| 6 | Provision the initial infrastructure | M |
| 7 | Configure the server baseline | M |
| 8 | Prepare the staging environment | S |
| 9 | Restore the database in the staging environment | S |

> **#6** — *(note: this row's description in the original spreadsheet is duplicated from row #5 — "Gather the tokens, keys, logins, accounts, and permissions..." — likely a copy/paste error in the source spreadsheet; the task title ("Provision the initial infrastructure") suggests the correct description should be about provisioning the initial infrastructure. Worth fixing in the spreadsheet.)*
> **#7** — Install and configure the operating system, web server, PHP, database, extensions, storage, and basic tooling.
> **#8** — Create a separate environment for validation, testing, and fine-tuning before production release.
> **#9** — Restore the database in the staging environment.

> ✅ **Confirmed fact:** **no staging environment exists today** — task #8 starts from scratch (not an adjustment of something that already exists), which also reinforces the `L`/`M` effort on tasks #10/#11 that follow.

> ✅ **Confirmed fact:** the current topology **is production only** — no other environment (local dev, staging, homolog) exists today. Confirms and reinforces the fact above.

> ✅ **Decision recorded:** the new staging environment (#8) **will faithfully reflect production's configuration**, at least initially.

## Phase 5 — Application Installation & Validation

| # | Task | Size |
|---|---|:-:|
| 10 | Perform the first application installation | L |
| 11 | Validate critical system workflows | L |

> **#10** — Bring the application up in the new environment with the minimum configuration required to run.
> **#11** — Test login, permissions, CRUD operations, uploads, jobs, integrations, and other core business flows. Record errors, limitations, required adjustments, and rework points found during validation.

## Phase 6 — Deployment Automation

| # | Task | Size |
|---|---|:-:|
| 12 | Define the automated deployment model | S |
| 13 | Set up the deployment pipeline | M |

> **#12** — Choose and configure the deployment flow using GitHub Actions, Docker, scripts, or a simple orchestrator.
> **#13** — Implement the automated flow to publish new versions with security and predictable rollback.

> ✅ **Decision recorded:** the deployment orchestrator (#12) will be **Dokploy** (self-hosted PaaS for running containers) — not Terraform managing raw infrastructure. Direct consequence: there is no (nor any need for) a remote Terraform state file (S3+DynamoDB lock / Terraform Cloud) for this project — Dokploy takes over that layer.

> ✅ **Confirmed facts (CI/CD):** **there is no CI/CD pipeline today** (no GitHub Actions/GitLab CI/Jenkins, not even partial) and **there is no automated test coverage** of critical flows in the legacy system. The rollout strategy within Dokploy (#13) **will be manual/direct deploy for now** — not rolling/blue-green/canary in this first phase.

## Phase 7 — Platform Strategy (Lovable / Supabase)

| # | Task | Size |
|---|---|:-:|
| 14 | Define the Lovable usage strategy | S |
| 15 | Plan the frontend/backend separation | M |
| 16 | Define the Supabase strategy | S |

> **#14** — Decide whether Lovable will be used only as a development tool or also as an editing layer for the internal team.
> **#15** — Evaluate which parts can be decoupled and which should remain in the current backend.
> **#16** — Assess which parts of the system can move to Supabase, especially database, auth, and storage.

---

## Size Legend

| Size | Meaning (conventional t-shirt sizing usage) |
|---|---|
| **S** | Small — one-off effort, low risk/scope |
| **M** | Medium — moderate effort, multiple steps or dependencies |
| **L** | Large — high effort, broad scope or significant uncertainty |

## Mapping Notes

- The spreadsheet has **1 sheet** (`Stage 1`), **16 data rows** (+ header), **3 columns** (`Task`, `Description`, `Size`) — no extra columns (status, owner, date) in the original source.
- Numbering `#1`–`#16` above corresponds to the spreadsheet's row order (row 2 = #1, ..., row 17 = #16), and the phase grouping is interpretive (done for this `.md`, doesn't exist in the original spreadsheet).
- Row #6 likely has an incorrect description (duplicated from #5) — flagged above, not automatically fixed here to avoid silently diverging from the source.

---

## BMAD Party-Mode Review — Question Checklist (2026-08-25)

The migration risk checklist in `Catapult-Migration.php` (the "Questions"/"Dúvidas" tab) went through a review round with 4 real (not simulated) BMAD agents — **🏗️ Winston** (architecture), **💻 Amelia** (execution/testability), **📊 Mary** (rigor/evidence), **📋 John** (prioritization/JTBD) — asked: what's missing from the checklist, which question is blocking vs. critical vs. low priority, and what's redundant.

**Initial round result** (before Rodrigo's cuts described in item 5 below): checklist reorganized into 16 categories (6 new), each question with a **priority tag** (🔴 Blocking / 🟠 Critical / ⚪ Low) and — when blocking — which specific plan phase it blocks (`blocksPhase`). The form became **bilingual PT/EN** (question text follows the panel's language selector; answers always stay in PT, the audit trail's canonical value). **Active checklist today (after the ongoing cuts): 36 questions in 14 categories** — the "PHP / Legacy Backend" and "CI/CD" categories were removed entirely (they disappear from rendering on their own, since no question references those `cat` values anymore). This number keeps dropping as Rodrigo reviews question by question — see item 5 in the next section for the cut criterion and the most current list.

**New categories added** (Winston + Amelia convergence): Data & Schema, Testability & Data Parity, Async Jobs/Sessions & Storage, Observability, Capacity & Performance — none of these existed in the original checklist; they cover exactly where legacy PHP migrations tend to blow up (undocumented schema, local-file session breaking with multiple containers, cron jobs invisible to a web-route scan).

**Reformulated questions** (were redundant or poorly worded):
- `iac-1` — used to mix "current state" with the already-decided target (Dokploy) in its own options; now asks only about the current state.
- `cicd-3` — used to list Dokploy alongside blue-green/rolling/canary (category error — platform vs. rollout strategy within it); now asks only about the rollout strategy.
- `env-1` — refocused to not duplicate the already-recorded fact (no staging today).
- `cicd-2` — re-tied to the new named-critical-flows question, instead of being generic.
- **Success criterion** (previously 1 vague free-text question) was split into 4 testable questions (named critical flows, per-flow "passed" criterion, divergence tolerance, go/no-go criterion) — Amelia's proposal: a loose sentence doesn't become a verifiable AC for task #11.
- **Versioning & Branching** consolidated from 3 questions to 2 (Amelia) and re-tagged as low priority (Winston) — Phase 1 is already resolved (repo exists and is versioned), so these questions are a low-risk team decision, not a technical blocker.

**`decision_owner` structural field — proposed and later removed.** Mary had proposed: "who filled out the form" (`person_name`) and "who has authority to approve this decision" are different roles, so it became a sibling field to `person_name` instead of one more question per category. **Rodrigo removed this field from the form** (2026-08-25) — decision recorded, no longer in the form.

---

## Points Only Rodrigo Can Direct

Findings from the roundtable that aren't checklist questions — they're product/process decisions only he can settle:

1. **The "product/business owner + migration trigger" question (proposed by John as blocking) was REMOVED from the form by Rodrigo's decision** (2026-08-25) — not included as an active question. Recorded here that the roundtable considered this a real gap (with no named owner, no one has formal authority to validate the checklist's other answers), but Rodrigo chose not to formalize it as a required form field.
2. **Is there a business document sibling to Catapult** (product brief, kickoff doc) besides these two artifacts (`.md` + `.php`)? Mary asked this directly — if it exists, the business-impact/downtime/cutover-communication questions missing from the technical checklist belong there, not here; if it doesn't exist, it's a real gap to consider.
3. **Did the choice of Lovable come from a business decision, or is it "new stack" still untested for fit with this specific PHP system?** John questioned this directly — if it's the latter, Phase 7's S/M/S sizing might be wrong (the new `lov-scope` checklist question tries to capture this, but the underlying validation — "does Lovable make sense here" — is Rodrigo's decision, not something the checklist resolves on its own).
4. **Promotion criterion "checklist answer → fact recorded in this `.md`"** — Mary noted this already happens (3 cases: code received, no staging, Dokploy) but without a written rule, and the audit trail is append-only (it can accumulate conflicting answers to the same question over time). Her proposal for Rodrigo's evaluation: only promote a **yesno/choice** answer (not free text) that **has no more-recent conflicting answer** to the same question in the JSON. Not formally adopted yet.
5. **Cut principle applied by Rodrigo (2026-08-25): questions "discoverable by direct inspection" leave the checklist.** He removed, in sequence: `mig-flows`/`mig-pass` (critical flows + "passed" criterion), the entire **PHP / Legacy Backend** category (`php-1` version, `php-2` framework, `php-3` obsolete deps, `php-secrets` hardcoded), `dat-schema`/`dat-charset`/`dat-size` (schema/charset/database size) — all with the justification "will be seen directly once there's access to the code/database/dump, no need to ask beforehand". **Recorded as a general checklist-curation criterion**: questions a human can only answer by observing a technical artifact shouldn't be in the form — only questions that depend on someone's knowledge/decision.
6. **Second, distinct cut pattern from item 5: questions whose answer Rodrigo already knows by heart become a FACT in the `.md`, not a question removed without a record.** He removed the entire **CI/CD** category (`cicd-1` pipeline today?, `cicd-2` test coverage today?, `cicd-3` rollout strategy in Dokploy) and `env-1`/`env-2` (current topology, will staging reflect production?) — but this time with known answers recorded as fact/decision in Phases 6 and 4 respectively (no CI/CD or automated tests today, rollout will be manual for now; only production exists today; new staging will faithfully reflect production, at least initially).
7. **The `decision_owner` field** (proposed by Mary) was removed from the form by Rodrigo's decision — see note in the previous section.

**Questions still in the checklist that could fall under the same item-5 criterion, if Rodrigo confirms** (observable by direct inspection, don't need a question): `dat-migrations` (repo/ORM config), `job-cron` (server crontabs/config), `host-1`/`host-2` (DNS/hosting panel), `aud-1` (existence of the log table).

## Future Points / Backlog (not blocking now)

- **Lovable Risks** (whole category) — only relevant to Phase 7, doesn't block Phases 1-5.
- **Versioning & Branching** — low priority, team decision reversible at any time.
- **Hosting & DNS → low TTL (`host-3`)** — only matters close to go-live (cutover), not now.
- **`php-3` (obsolete dependencies)** — not a question to answer now; it's an expected finding from task #2 (code analysis), to be recorded once it runs.
- **Observability / Capacity & Performance** — new, critical categories, but mainly relevant from Phase 3 onward (provisioning), don't block Phase 1-2.
