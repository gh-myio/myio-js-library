# Runbook: Sync Widget Source to the ThingsBoard **PRODUCTION** Widgets

> ⚠️ **This deploys to production.** A `sync.js --yes` Save here takes effect
> **immediately**, for every real customer dashboard currently using that
> widget type — there is no separate publish/build/deploy step in between.
> If you want to test a branch first without touching production, use
> `tools/tb-widget-sync/` (the "TESTE" widgets) and its runbook instead:
> `docs/thingsboard/runbooks/sync-widget-source-to-tb-teste.md`.

Use this to push the 4 source files of one or more of the 7 Shopping
Dashboard v-5.2.0 widgets (`template.html`, `styles.css`,
`settingsSchema.json`, `controller.js`) from whatever branch is currently
checked out locally into the corresponding **production** "`Widget - Shopping
Dashboard - <NAME> - v.5.2.0`" widget-type in ThingsBoard, once you've already
validated the change on the TESTE widgets and decided it's ready to ship.

---

## Overview

Same 7 widgets, same 4 files each, same UUID → folder mapping as the TESTE
tool — see that runbook's Overview section for the full explanation of the
editor's 3 code surfaces (left/right `mat-tab-group` panes + standalone JS)
and the two cross-tab-bleed failure modes this tool avoids the exact same
way. This doc only covers what's different for production.

### Production widget-type UUIDs

Confirmed 2026-09-28 via `GET /api/widgetType/{id}` against the live
`dashboard.myio-bas.com` — name, `fqn`, and descriptor field lengths all
matched the corresponding local `WIDGET/<NAME>` folder (within the expected
drift of production being a few commits behind whatever is checked out
locally when confirmed).

| Widget folder | Widget-type UUID | ThingsBoard name |
|---|---|---|
| `MAIN_VIEW` | `1faf5e00-a3b5-11f0-afe1-175479a33d89` | Widget - Shopping Dashboard - MAIN VIEW - v.5.2.0 |
| `MENU` | `7dde51f0-a3b7-11f0-afe1-175479a33d89` | Widget - Shopping Dashboard - MENU - v.5.2.0 |
| `HEADER` | `9fa2e1c0-a3b7-11f0-afe1-175479a33d89` | Widget - Shopping Dashboard - HEADER - v.5.2.0 |
| `FOOTER` | `dfc6dd60-a3b7-11f0-afe1-175479a33d89` | Widget - Shopping Dashboard - FOOTER - v.5.2.0 |
| `TELEMETRY` | `c3a99960-a3b7-11f0-afe1-175479a33d89` | Widget - Shopping Dashboard - TELEMETRY - v.5.2.0 |
| `TELEMETRY_INFO` | `3df716f0-b049-11f0-9722-210aa9448abc` | Widget - Shopping Dashboard - INFO - v.5.2.0 |
| `ALARM` | `5a9438f0-0f36-11f1-a625-4d3576ae337e` | Widget - Shopping Dashboard - ALARMS - v.5.2.0 |

If a widget is ever added or renamed, re-confirm its UUID the same way
(`GET /api/widgetType/{id}` and compare name/fqn/field lengths against the
local folder) — don't guess by pattern from the `fqn`, `tools/tb-widget-sync-prod/sync.js`
tried that for `ALARM` and it 404'd until the real name (`..._alarms_...`)
was found via `GET /api/widgetTypesInfos?widgetsBundleId=<bundleId>`.

---

## Safety gates (on top of everything the TESTE tool already does)

1. **`--yes` is required to Save.** Without it, `sync.js` always behaves like
   `--dry-run` — it sets the value in the open editor and reads it back to
   verify, but never clicks Save, no matter what else you pass. Running this
   tool the exact same way you'd run the TESTE one, out of habit, does **not**
   touch production.
2. **`--dry-run` always wins over `--yes`** if both are given.
3. A loud banner + 3-second countdown prints before any real (non-dry-run)
   run starts, naming every widget/field that's about to be saved — Ctrl+C to
   abort.
4. `verify.js` is read-only and does not require the editor tabs to be open
   (only a logged-in `dashboard.myio-bas.com` tab) — safe to run any time,
   including right before a sync to see the current production state.

---

## Prerequisites

Same as the TESTE tool (see its runbook), except:

1. **The 7 PRODUCTION widget-type editor tabs are open** (not the TESTE
   ones), one per URL: `https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>`
   using the UUID table above.
2. **You have already validated the change on TESTE** (`tools/tb-widget-sync/`)
   and decided it's ready to ship — this tool has no "is this safe" opinion
   of its own, it only refuses to Save without `--yes`.
3. First time only: `cd tools/tb-widget-sync-prod && npm install` (own
   `playwright-core`, independent of the TESTE tool's `node_modules`).

---

## Step-by-step

### 1. Check the current production state (read-only, optional but recommended)

```bash
cd tools/tb-widget-sync-prod
node verify.js
```

A `MISMATCH` here just means production differs from your current local
checkout — expected before you've synced anything. Re-run after syncing to
confirm it went through.

### 2. Check out the branch you're deploying

```bash
git checkout <branch-that-was-validated-on-teste>
```

### 3. Dry-run first

```bash
cd tools/tb-widget-sync-prod
node sync.js
```

Without `--yes` this only sets + read-back-verifies each field in the open
editors — nothing is saved. Confirms the tool can reach every tab and that
the content round-trips correctly before you commit to a real deploy.

### 4. Deploy for real

```bash
node sync.js --yes
```

3-second countdown, then syncs all 4 fields for all 7 widgets, Saving each
one (production live immediately after each individual Save — not batched at
the end). Narrower invocations work the same as the TESTE tool:

```bash
node sync.js --yes --widgets=HEADER,MENU     # only specific widgets
node sync.js --yes --fields=js               # only specific fields (e.g. a controller-only fix)
```

Prefer the narrowest scope that covers your actual change — every extra
field synced is an extra production write.

### 5. Verify against the ThingsBoard backend

```bash
node verify.js
```

Same `HTML=OK | CSS=OK | JS=OK | Schema=OK` output as the TESTE tool's
`verify.js`. A `MISMATCH` after a `--yes` run is a real problem — see
Rollback below.

### 6. Confirm in a real dashboard

Open an actual production dashboard using these widgets and exercise the
feature. No rebuild/publish step needed — ThingsBoard widget-type saves are
live immediately.

---

## Rollback

There is no automatic rollback. If a synced field needs to be reverted:

1. `git checkout <previous-known-good-branch-or-tag>` locally.
2. `node sync.js --yes --widgets=<NAME> --fields=<field>` for just the
   affected field(s).
3. `node verify.js` to confirm.

Consider keeping a note of the last-known-good branch/commit before every
production sync, precisely so step 1 is unambiguous under pressure.

---

## Troubleshooting

Same failure modes and meanings as the TESTE tool's runbook (`Save button
never found`, `Timed out waiting for Save button to become enabled`,
`SKIPPED — no open tab found`, cross-tab-bleed `MISMATCH`, CDP connect
failure) — see its Troubleshooting table. The only production-specific
addition:

| Symptom | What it means | What to do |
|---|---|---|
| You ran `sync.js` (no `--yes`) expecting it to deploy, and `verify.js` shows no change | Working as designed — `--yes` is required to Save. | Re-run with `--yes`. |

---

## Quick reference

| What | Where |
|---|---|
| Widget source files | `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/<NAME>/` |
| Sync tool (PRODUCTION) | `tools/tb-widget-sync-prod/sync.js` |
| Verify tool (PRODUCTION, read-only) | `tools/tb-widget-sync-prod/verify.js` |
| Sync tool (TESTE, safe to experiment) | `tools/tb-widget-sync/sync.js` |
| Debug Chrome CDP endpoint | `http://localhost:9222` |
| Widget-type editor URL pattern | `https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>` |
| Authoritative verification | `GET /api/widgetType/{uuid}` (used by `verify.js`) — never the Ace editor UI |

## Notes

- `playwright-core` lives only in `tools/tb-widget-sync-prod/node_modules`
  (gitignored), installed via its own local `package.json` — independent of
  both the root library and the TESTE tool's dependency tree.
- This tool is dev-only tooling; it is not part of `npm run build`, CI, or
  the published `myio-js-library` package.
- Unlike the TESTE widgets (a shared scratch resource with no locking),
  production widgets are live for real customers the instant Save succeeds —
  coordinate with the team before running `--yes` if anyone else might be
  deploying at the same time.
