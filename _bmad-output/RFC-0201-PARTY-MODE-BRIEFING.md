# RFC-0201 — Party-Mode Briefing

> **Audience**: BMAD party-mode agents (Mary the Analyst, John the PM, Winston the Architect, Sally the UX Designer, Amelia the Senior Developer, Paige the Tech Writer, plus any module-level voices).
>
> **What this document is**: The full charter you receive at the opening of the party-mode session. Read it end-to-end before speaking. **Your collective deliverable is `src/docs/rfcs/RFC-0201-MainDashboardShopping-v5.4.0-Sync-from-v5.2.0.md`**, written in English, conforming to the RFC style of `src/docs/rfcs/RFC-0200-DeviceIcons-SharedDeviceTypeImageMap.md`.
>
> **You — the agents — are the authors of RFC-0201.** The orchestrator is not allowed to draft sections on your behalf.

---

## 1. Mission Statement

The MYIO Shopping Dashboard exists in **three rendering surfaces** that must remain feature-equivalent:

| Surface | Path | Architecture | Status |
|---|---|---|---|
| **A — ThingsBoard v-5.2.0** | `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/` | **7 separate widgets** (MAIN_VIEW, TELEMETRY, MENU, HEADER, ALARM, FOOTER, TELEMETRY_INFO) — each with its own `controller.js`, `template.html`, `styles.css`, `settingsSchema.json`. Communicates via `window.*` globals and `window.dispatchEvent` custom events. Total ≈ **27,000 lines**. | **Source of truth.** Receives all new features, bugfixes, and RFCs first. |
| **B — ThingsBoard v-5.4.0** | `src/thingsboard/main-dashboard-shopping/v-5.4.0/` | **Single widget** (one `controller.js`, one `template.html`, one `styles.css`, one `settingsSchema.json`). Uses MyIOLibrary component classes (`createHeaderShoppingComponent`, `createMenuShoppingComponent`, `createTelemetryGridShoppingComponent`, `createFooterComponent`). Total ≈ **1,138 lines**. | **Lagging.** Last RFC referenced in code is **RFC-0180**. Everything from RFC-0181 onward is missing or partial. |
| **C — Showcase** | `showcase/main-view-shopping/index.html` + `SHOWCASE-CONFIG.md` | **Single HTML page** (~3,235 lines) wiring the same library components against a static service-account login. Used as a live local demo. | **Lagging in tandem with v-5.4.0.** Its drift mirrors v-5.4.0's drift. |

The single-widget architecture (B + C) is the **direction of travel** — it is simpler to deploy, easier for customers to embed, and consolidates dashboard logic into the published `myio-js-library` package. v-5.2.0 is therefore both the *richest* and the *legacy* surface: it ships every new feature first because the multi-widget topology is what production currently runs, but the **target** is for B and C to fully match A and eventually replace it.

**The mission of RFC-0201 is to specify the sync.** What features, fixes, and components currently exist *only* in v-5.2.0? What must be ported, refactored, or rewired in v-5.4.0 and the showcase to bring them to feature parity? What should *intentionally* differ? What is the ordered, testable migration plan?

---

## 2. Confirmed Facts (Pre-Computed, Trust These)

To save tokens during your discussion, the orchestrator has already verified the following from the codebase. Treat these as established premises — do not re-grep them.

### 2.1 v-5.2.0 surface inventory

```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/
├── MAIN_VIEW/          (controller.js: 7,758 lines)  — orchestrator, prefetch, group classification, AlarmServiceOrchestrator, FreshDesk gating
├── TELEMETRY/          (controller.js: 5,989 lines)  — device cards, alarm badges, ticket badges, annotation banners
├── MENU/               (controller.js: 2,833 lines)  — navigation, filters, shopping selector, reports menu, user management entry
├── HEADER/             (controller.js: 2,586 lines)  — KPI cards, tooltips with status/category/alarm/ticket counters, NewTicketWizard entry
├── FOOTER/             (controller.js: 1,692 lines)  — selection store, max-selection limits, scroll arrows, comparison/report exports
├── ALARM/              (controller.js:   673 lines)  — alarms table widget (consumed by Settings → Alarms tab)
└── TELEMETRY_INFO/     (controller.js: 4,466 lines)  — info cards, group totals, ticket banners, drag-to-group
```

### 2.2 v-5.4.0 surface inventory

```
src/thingsboard/main-dashboard-shopping/v-5.4.0/
├── controller.js       (1,138 lines — last RFC tag in code: RFC-0180)
├── template.html
├── styles.css
└── settingsSchema.json
```

The v-5.4.0 controller currently composes:
- `createHeaderShoppingComponent` (RFC-0146)
- `createMenuShoppingComponent` (RFC-0147)
- `createTelemetryGridShoppingComponent` (RFC-0145)
- `createFooterComponent` (RFC-0149)
- A single `MyIOOrchestrator` stub mirroring RFC-0051.2 / RFC-0180 contracts.

It does **not** import or reference any of: `AlarmServiceOrchestrator`, `FreshDeskService`, `TicketServiceOrchestrator`, `MyIOAuthContext`, `deviceIcons`, `orchIdSet`, `gcdrDeviceId` (as a propagated key — only `gcdrCustomerId/TenantId` are present), `ExclusionGroupsTab`, `UserManagementController`, `NewTicketWizard`, `TicketDetailModal`.

### 2.3 Recent RFCs / features that landed in v-5.2.0 since v-5.4.0 was last synced

| RFC | Title (short) | Visible artifact in v-5.2.0 |
|---|---|---|
| RFC-0181 | Reports menu item | MENU/controller.js — `_openGroupReport`, `openDashboardPopupAllReport` |
| RFC-0182 | Orchestrator group classification + AllReportModal API filter | MAIN_VIEW + MENU `_buildItemsList`, `orchIdSet` filter in `AllReportModal` |
| RFC-0183 | AlarmServiceOrchestrator + AlarmBadge | MAIN_VIEW creates `window.AlarmServiceOrchestrator`; TELEMETRY/HEADER read it; `gcdrDeviceId` propagated through `ctx.data → meta → STATE.itemsBase` |
| RFC-0190/0197 | UserManagement (users, roles, policies, groups, profiles) | `src/components/premium-modals/user-management/*` — opened from MENU |
| RFC-0193 | Closed-alarm notification toast | Wired in MAIN_VIEW + TELEMETRY |
| RFC-0194 | Customer default dashboard | MENU integration |
| RFC-0195 | Telemetry device sync job button | TELEMETRY action |
| RFC-0196 | Telemetry info-cards click-by-group + error calc | TELEMETRY_INFO |
| RFC-0198 | Chamados / FreshDesk integration | New service classes (`FreshdeskClient`, `TbTicketSync`, `TicketServiceOrchestrator`), `TicketsTab` in Settings, `NewTicketWizard` in HEADER, `TicketDetailModal`, ticket badges in TELEMETRY, `tickets_enabled`/`tickets_only_to_myio` gates, FreshWorks Widget API |
| RFC-0199 | MyIOAuthContext + PermissionGuard (client-side GCDR RBAC) | `src/components/gcdr-auth/*` — gates UI affordances by user policy |
| RFC-0200 | `deviceIcons` shared device-type image map | `src/utils/deviceIcons.ts` — replaces the 4 duplicated `DEVICE_TYPE_CONFIG` copies |

### 2.4 Cross-cutting bugfix categories landed since RFC-0180

(Not exhaustive — these are the families you should expect to encounter when diffing.)

- Offline alarm-badge / offline-filter behavior gated by `showOfflineAlarms` (multiple commits).
- HEADER alarm tooltip width + inline toggles + `isInternalSupportRule` flag.
- `gcdrDeviceId` propagation chain fixes (`buildMetadataMapFromCtxData` casing, `STATE.itemsBase` mapping in both code paths, orchestrator `baseItem`).
- `DATA_API_HOST` double-prefix fix in `EnergyDataFetcher`.
- Blank-screen GAP after contract modal in MAIN_VIEW.
- Telemetry-export filenames prefixed with customer name + "Gerado em" PDF header.
- Realtime telemetry: FP÷255, session countdown, dynamic chart title, status icon, friendly errors.
- Device-report 1h/1d tab + time picker, comparison SDK format, light default.

### 2.5 Showcase signal

`showcase/main-view-shopping/index.html` (3,235 lines) wires the **same library components** that v-5.4.0 wires, and `SHOWCASE-CONFIG.md` documents the live Moxuara customer credentials, GCDR endpoints, alarms-API key, and service-account login. The showcase is therefore the **fastest validation surface** for any v-5.4.0 change — it can be exercised locally without a running ThingsBoard instance.

### 2.6 Library export gate

Anything used by v-5.4.0 or the showcase must be reachable through `src/index.ts` (the public library entry). v-5.2.0 widgets can pull from internal paths because they bundle inline in ThingsBoard; v-5.4.0 and the showcase consume the published `MyIOLibrary` global / ESM exports. **Export coverage is itself a gap to audit.**

---

## 3. The Question The Roundtable Must Answer

> **"What is the complete, ordered, low-risk plan to bring `v-5.4.0` and `showcase/main-view-shopping/` into feature parity with `v-5.2.0/WIDGET/` — and what, if anything, should intentionally not be ported?"**

Concretely, RFC-0201 must specify:

1. **A gap matrix** — for each RFC and bugfix family in §2.3 / §2.4: present in v-5.2.0? present in v-5.4.0? present in showcase? what is the porting cost (S/M/L/XL)?
2. **A wiring delta** — which components, services, orchestrators, and `window.*` globals exist in v-5.2.0 but are not constructed (or not exported) in v-5.4.0/showcase.
3. **A misuse / drift list** — places where v-5.4.0 calls a library function with the *old* signature, the *wrong* component, or a stale event name.
4. **An export audit** — which symbols v-5.4.0/showcase need that are not yet in `src/index.ts`.
5. **An execution plan** — phased migration: what to port first, what depends on what, what can ship behind a settings flag, what requires a new RFC of its own.
6. **Acceptance criteria** — how do we *prove* parity? Which showcase scenarios + which manual TB widget tests must pass?
7. **Out-of-scope decisions** — what is *deliberately* not being ported (e.g., legacy patterns, deprecated flows) and why.
8. **Risk register** — what could break customers, what mitigations exist (feature flags, settings toggles), how is rollback handled.

---

## 4. Per-Agent Reading Assignments and Charge

Each agent below has a *primary* reading list and a *charge* — the question they own answers to during the discussion. Other agents are welcome to weigh in, but the charge belongs to the named agent.

### 4.1 Mary — Business Analyst

**Primary reading**:
- `src/docs/rfcs/RFC-0181-*` through `RFC-0200-*` (titles + summaries; full reads for RFC-0182, 0183, 0198, 0199, 0200).
- `showcase/main-view-shopping/SHOWCASE-CONFIG.md`.

**Charge**: *"What user-visible capabilities does a v-5.4.0 customer not have today that a v-5.2.0 customer does? Which gaps are tier-1 (block adoption) vs. tier-3 (nice-to-have)?"*

Deliver to the room: a prioritized capability gap list with adoption-risk framing.

### 4.2 John — Product Manager

**Primary reading**:
- The "Confirmed Facts" section above (§2).
- `src/thingsboard/main-dashboard-shopping/v-5.4.0/settingsSchema.json` vs. each `v-5.2.0/WIDGET/*/settingsSchema.json`.

**Charge**: *"What is the rollout strategy? Big-bang sync or staged migration? Which customers are on which surface today, and what is the migration story for them? Do we need a settings flag (`enableLegacyMode`?) for the transition window?"*

Deliver to the room: a migration roadmap with a phasing recommendation and the explicit list of settings keys the PRD must promise.

### 4.3 Winston — System Architect

**Primary reading**:
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` (high-level scan — find the orchestrator construction, event bus, AlarmServiceOrchestrator wiring).
- `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` end-to-end.
- `src/index.ts` (export surface).
- `src/components/gcdr-auth/`, `src/components/premium-modals/settings/tickets/`, `src/utils/deviceIcons.ts` (if present).

**Charge**: *"What is the smallest set of architectural changes that lets v-5.4.0 absorb the v-5.2.0 capabilities without copying 27k lines of widget code into the library? Which features belong as components, which as services, which as documented integration patterns? What goes through `MyIOOrchestrator` vs. through new orchestrators (Alarm, Ticket, Auth)?"*

Deliver to the room: a target architecture diagram (in prose — Mermaid is fine in the RFC) plus a list of `window.*` globals that must exist with their contracts.

### 4.4 Sally — UX Designer

**Primary reading**:
- `showcase/main-view-shopping/index.html` end-to-end (it is the user-visible surface).
- HEADER, MENU, TELEMETRY templates in v-5.2.0 — diff against showcase.

**Charge**: *"What does the user see today in v-5.2.0 that they will not see in a synced v-5.4.0 / showcase, and what is the right introduction order so the UI doesn't shift under power users? Are there interaction patterns (alarm tooltip width, badge placement, ticket-banner location) that need explicit visual specs in the RFC?"*

Deliver to the room: the visual-parity checklist and any UX decisions that need explicit calls in the RFC.

### 4.5 Amelia — Senior Developer

**Primary reading**:
- `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` — every wiring point.
- `src/components/telemetry-grid-shopping/TelemetryGridShoppingView.ts`.
- `src/components/premium-modals/settings/SettingsModalView.ts` (and the Alarms / Tickets / Annotations / ExclusionGroups tabs).
- `src/components/header/createHeaderComponent.ts`, `src/components/menu/MenuView.ts`, `src/components/footer/`.

**Charge**: *"What are the concrete, file-and-line-level changes required in v-5.4.0/controller.js, the showcase, and the relevant components? Where are the call-sites that pass the wrong shape, the missing event listener, the stale prop name? What TypeScript types in `src/index.ts` need to be widened or added?"*

Deliver to the room: a prioritized work list with file paths and the porting cost (S/M/L/XL) per item. **Lean toward concrete: name the function, the line, the signature change.**

### 4.6 Paige — Technical Writer

**Primary reading**:
- `src/docs/rfcs/RFC-0200-DeviceIcons-SharedDeviceTypeImageMap.md` (style reference).
- `src/docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md`.
- `.claude/CLAUDE.md` (project conventions).

**Charge**: *"How is the RFC-0201 document itself structured, paginated, and indexed? Where in the existing RFC tree does it sit, what does it link to, what acceptance-criteria format follows the house style, and what should the Mermaid / table conventions be?"*

Deliver to the room: the RFC skeleton — section list with one-line descriptions per section, before the agents start filling them in.

### 4.7 Optional voices

Bring in only if a round needs them:

- **The Adversarial Reviewer** (`bmad-review-adversarial-general` flavor) — for the risk register and the "what could break customers" round.
- **The Edge-Case Hunter** (`bmad-review-edge-case-hunter` flavor) — when discussing GCDR-id propagation, settings-schema migrations, or auth context boundaries.

---

## 5. Process — How The Roundtable Runs

The orchestrator (party-mode skill) drives the cadence. The expected shape:

1. **Round 1 — Framing.** Mary + John open with their gap reads. Winston frames the architectural envelope. The room debates: **big-bang sync vs. staged?**
2. **Round 2 — Per-area depth.** For each of the seven RFC families (Reports, OrchestratorGroupClassification, AlarmServiceOrchestrator, UserManagement, FreshDesk Tickets, MyIOAuthContext, deviceIcons), the agents nominate the porting cost and the order. Amelia drives concreteness; Sally checks UX coherence; Winston checks orchestration boundaries.
3. **Round 3 — Showcase parity.** Sally + Amelia walk through the showcase HTML. What needs to change in showcase to validate each phase?
4. **Round 4 — Risk + acceptance.** Adversarial reviewer optional. Define the acceptance scenarios and the rollback story.
5. **Round 5 — Drafting.** Paige proposes the section skeleton. Each agent owns drafting their assigned sections in-line. The orchestrator assembles, Paige edits for voice consistency, and the final file is written to `src/docs/rfcs/RFC-0201-MainDashboardShopping-v5.4.0-Sync-from-v5.2.0.md`.

The orchestrator is allowed to merge agent text and copyedit for flow. The orchestrator is **not** allowed to invent architectural positions, gap-list entries, or acceptance criteria that no agent stated.

---

## 6. RFC Output Specification

The agents must produce **one** file:

- **Path**: `src/docs/rfcs/RFC-0201-MainDashboardShopping-v5.4.0-Sync-from-v5.2.0.md`
- **Language**: English.
- **Style**: Match `RFC-0200-DeviceIcons-SharedDeviceTypeImageMap.md` — header block (Status, Date, Author, Related), Summary, Motivation, Guide-Level Explanation, Reference-Level Explanation, Drawbacks, Alternatives, Prior Art, Unresolved Questions, Future Work, Appendix.
- **Length**: Long is fine. Be specific. Tables, diagrams, and code blocks are encouraged. Aim for a document that a senior engineer can execute against without re-asking the room any of its questions.
- **Required sections** (in addition to the standard RFC headers):
  - **§ Gap Matrix** — table covering RFC-0181 through RFC-0200 + bugfix families, columns: present-in-v5.2.0, present-in-v5.4.0, present-in-showcase, porting cost, sequencing tier.
  - **§ Wiring Delta** — list of `window.*` globals, components, services, and events that must exist in v-5.4.0 to match v-5.2.0.
  - **§ Misuse Audit** — known cases where v-5.4.0 calls library APIs with stale signatures or wrong component.
  - **§ Library Export Audit** — symbols missing from `src/index.ts` that v-5.4.0 / showcase need.
  - **§ Phased Plan** — Phase 1, Phase 2, ..., with per-phase scope, exit criteria, and a sample commit message header.
  - **§ Showcase Validation** — checklist of showcase scenarios that must work after each phase.
  - **§ Risk Register & Rollback** — settings-flag strategy, customer-impact assessment, rollback steps per phase.
  - **§ Out of Scope** — explicit non-goals.
- **Header block**:
  ```
  - Status: Draft — Design In Progress
  - Date: 2026-04-29
  - Authors: BMAD party-mode roundtable (Mary, John, Winston, Sally, Amelia, Paige)
  - Related: RFC-0145, RFC-0146, RFC-0147, RFC-0149, RFC-0150, RFC-0180, RFC-0181, RFC-0182, RFC-0183, RFC-0198, RFC-0199, RFC-0200
  ```
- **Linkage**: After writing, open a follow-up suggestion to update `.claude/CLAUDE.md` and `MEMORY.md` with the RFC-0201 reference.

---

## 7. Operating Constraints

- **Do not edit production code during this session.** RFC-0201 is a design document; its execution is a separate engagement.
- **Disagree visibly.** When two agents see a gap differently (e.g., "AlarmServiceOrchestrator is a Phase 1 must" vs. "it's a Phase 2 nice-to-have"), surface the disagreement in the document with both positions and a recommended resolution.
- **Ground claims.** Every "missing in v-5.4.0" assertion in the RFC must be either (a) confirmed by §2 of this briefing, or (b) verifiable by grep — Amelia is the gatekeeper. No hand-waved claims.
- **Be specific.** "Update the orchestrator" is not a porting item. "Add `gcdrDeviceId` propagation in `v-5.4.0/controller.js` `extractDeviceMetadataFromRows` near the existing `entityId` extraction, mirroring `v-5.2.0/WIDGET/MAIN_VIEW/controller.js:buildMetadataMapFromCtxData`" is.
- **Respect the export gate.** Anything v-5.4.0 needs that is currently buried inside the v-5.2.0 widgets is, by definition, also a library-export item.
- **Keep showcase in scope.** Every porting decision must answer: "and how is this tested in the showcase?"

---

## 8. Definition of Done

The party-mode session is complete when:

1. The file `src/docs/rfcs/RFC-0201-MainDashboardShopping-v5.4.0-Sync-from-v5.2.0.md` exists and matches the output specification in §6.
2. The Gap Matrix has a row for every RFC in §2.3 and every bugfix family in §2.4.
3. The Phased Plan has at least three phases, each with at minimum: scope, exit criteria, showcase validation step, rollback step.
4. Every agent named in §4 contributed at least one explicit position recorded in the RFC (Paige's role of structural editor counts).
5. The Unresolved Questions section is non-empty — if the room has no unresolved questions, the room did not look hard enough.

When done, the orchestrator returns a one-paragraph summary: which file was produced, the headline phasing recommendation, and the top three risks the RFC flagged.

---

_End of briefing. Open the floor._
