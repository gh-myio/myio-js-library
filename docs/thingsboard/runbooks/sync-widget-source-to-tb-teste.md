# Runbook: Sync Widget Source to the ThingsBoard "TESTE" Widgets

Use this whenever you need to manually test a **non-`desenv` branch** of the
Shopping Dashboard v-5.2.0 widgets against a real ThingsBoard dashboard,
without publishing/merging anything. It pushes the 4 source files of each
widget (`template.html`, `styles.css`, `settingsSchema.json`,
`controller.js`) from whatever branch is currently checked out locally into
the corresponding "`Widget - Shopping Dashboard - <NAME> - v.5.2.0 - TESTE`"
widget-type editor in ThingsBoard, and saves it.

---

## Overview

`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET` has 7 subfolders
(`MAIN_VIEW`, `MENU`, `HEADER`, `FOOTER`, `TELEMETRY`, `TELEMETRY_INFO`,
`ALARM`), each with the 4 files above. Each one maps 1:1 to a ThingsBoard
**widget type** (not a widget instance), identified by a fixed UUID:

| Widget folder | Widget-type UUID |
|---|---|
| `MAIN_VIEW` | `55832c30-5a41-11f1-ab52-9b3e4c8bcc59` |
| `MENU` | `6346bb70-5a41-11f1-ab52-9b3e4c8bcc59` |
| `HEADER` | `6e346e60-5a41-11f1-ab52-9b3e4c8bcc59` |
| `FOOTER` | `83e67a50-5a41-11f1-ab52-9b3e4c8bcc59` |
| `TELEMETRY` | `793a1620-5a41-11f1-ab52-9b3e4c8bcc59` |
| `TELEMETRY_INFO` | `b0d1ce70-5a41-11f1-ab52-9b3e4c8bcc59` |
| `ALARM` | `9be92d00-5a41-11f1-ab52-9b3e4c8bcc59` |

Each widget-type editor page (`https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>`)
has 3 code surfaces, all backed by the Ace editor:

- **Resources / HTML / CSS** tabs — one Angular `mat-tab-group` (the "left"
  pane), sharing a single Ace editor instance whose bound content swaps with
  whichever tab is active. HTML → `template.html`, CSS → `styles.css`.
- **Settings schema / Data key settings schema / Latest data key settings
  schema / Widget settings** tabs — a second `mat-tab-group` (the "right"
  pane), same sharing behavior. `Settings schema` → `settingsSchema.json`.
- A standalone JS pane (not inside any `mat-tab-group`) → `controller.js`.

The tool (`tools/tb-widget-sync/`) drives this editor via Playwright,
connected over Chrome DevTools Protocol (CDP) to an **already-running**
Chrome instance — it never launches its own browser and never touches the
`git` state of the repo.

### The two known failure modes it exists to avoid

Both were found the hard way while building this tool, by comparing what the
UI showed against ThingsBoard's own backend state via `GET
/api/widgetType/{id}`:

1. **Cross-tab bleed on write.** Setting a value into the shared Ace instance
   and then immediately switching tabs (before Angular commits the change)
   silently duplicates the just-written value backward into the *previous*
   tab's field. This corrupted the HTML field of all 7 widgets with CSS
   content during an early, hand-rolled version of this script.
2. **Same bleed even across separate save cycles.** Doing a full
   set→verify→click-Save→wait-for-disabled cycle for `html`, then
   immediately starting the same cycle for `css` **in the same page
   session**, still reproduced the corruption — the full save-wait is not
   enough by itself. The fix that proved reliable is a full page reload
   between any two fields that share the "left" pane (`html`/`css`); the
   tool does this automatically, you don't need to think about it.

Because of finding #1, **UI-based verification is not trustworthy** —
reading a field back through the Ace editor after a tab switch can report
different wrong content on different attempts. The only verification method
that has proven consistent is `GET /api/widgetType/{id}` (`verify.js`),
which bypasses the editor UI entirely.

---

## Prerequisites

1. **A debug Chrome running with a remote debugging port**, e.g. started with
   `--remote-debugging-port=9222`. The tool connects to `http://localhost:9222`
   — it does not open a browser itself. (This is a separate concern from the
   `chrome-devtools` MCP tool; both can talk to the same debug Chrome, but
   neither one turns debug mode on for you.)
2. **Logged into ThingsBoard** in that Chrome, with a valid session
   (`jwt_token` in `localStorage` — used for the API verification calls).
3. **The 7 widget-type editor tabs already open**, one per URL:
   `https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>`
   (see the UUID table above). The tool finds each tab by matching the UUID
   in its URL — it does not open missing tabs for you.
4. **The branch you want to test is checked out locally** in this repo. The
   tool always reads from disk, whatever branch/working-tree state is
   currently checked out — it has no branch awareness of its own.
5. Node 18+ (only needed once, to `npm install` the tool's own
   `playwright-core` dependency).

---

## Step-by-step

### 1. Install the tool's dependency (first time only)

```bash
cd tools/tb-widget-sync
npm install
```

This installs `playwright-core` **only inside `tools/tb-widget-sync/`** — it
does not touch the root `package.json`/`package-lock.json` or the library's
own dependency tree.

### 2. Check out the branch you want to test

```bash
git checkout <branch-to-test>
```

### 3. Sync everything

```bash
cd tools/tb-widget-sync
node sync.js
```

This syncs all 4 fields for all 7 widgets, in order, reloading the page
automatically between `html` and `css` on each widget. Expect it to take a
couple of minutes — each field does a full set → read-back-verify → wait for
Save to enable → click Save → wait for Save to disable cycle before moving
on.

Useful narrower invocations:

```bash
node sync.js --widgets=MAIN_VIEW,MENU        # only specific widgets
node sync.js --fields=html,css               # only specific fields
node sync.js --dry-run                       # set + verify in the editor, never click Save
```

### 4. Verify against the ThingsBoard backend

```bash
node verify.js
```

Prints one line per widget:

```
MAIN_VIEW: HTML=OK | CSS=OK | JS=OK | Schema=OK
```

A `MISMATCH(<actualLen> vs <expectedLen>)` means that field's ThingsBoard
content does not byte-match the local file — re-run `sync.js` for just that
`--widgets=<NAME> --fields=<field>` and verify again. **Always verify with
this script, not by eyeballing the editor UI** — see the cross-tab bleed
note above.

### 5. Test in the dashboard

Open the actual "TESTE" dashboard in ThingsBoard and exercise the feature.
No rebuild/publish step is needed — ThingsBoard widget-type saves take effect
immediately for any dashboard using that widget type.

### 6. When done, restore `desenv` if needed

```bash
git checkout desenv
cd tools/tb-widget-sync
node sync.js   # re-sync the TESTE widgets back to desenv's content
```

The TESTE widgets are shared scratch environments — leaving them on a stale
branch's content will confuse the next person to use them.

---

## Troubleshooting

| Symptom | What it means | What to do |
|---|---|---|
| `FAILED: Save button never found in the DOM during the whole wait window` | Sometimes a real, confirmed false-negative — the save can still have succeeded (observed and reproduced during development). | Re-run `verify.js` before assuming it actually failed. |
| `FAILED: Timed out waiting for Save button to become enabled` | The content you tried to write is byte-identical to what's already saved — Angular never marks the form dirty, so the tool's wait-for-enabled step times out. | Safe — nothing was written. Confirm with `verify.js`. Only a real problem if you expected a change. |
| `SKIPPED — no open tab found for UUID ...` | That widget's editor tab isn't open in the debug Chrome. | Open `https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>` and re-run. |
| `verify.js` reports a `MISMATCH` right after a successful-looking `sync.js` run | Possible cross-tab bleed (see failure mode #2 above), especially if `html`/`css` were synced together. | Re-sync just the affected field(s) individually (e.g. `--fields=css --widgets=ALARM`), then `verify.js` again. |
| Connecting via `chromium.connectOverCDP` fails outright | The debug Chrome isn't running, or isn't listening on port 9222. | Start/restart the debug Chrome with `--remote-debugging-port=9222`. |

---

## Quick reference

| What | Where |
|---|---|
| Widget source files | `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/<NAME>/` |
| Sync tool | `tools/tb-widget-sync/sync.js` |
| Verify tool | `tools/tb-widget-sync/verify.js` |
| Debug Chrome CDP endpoint | `http://localhost:9222` |
| Widget-type editor URL pattern | `https://dashboard.myio-bas.com/resources/widgets-library/widget-types/<uuid>` |
| Authoritative verification | `GET /api/widgetType/{uuid}` (used by `verify.js`) — never the Ace editor UI |

## Notes

- This tool is dev-only tooling for manual QA against the shared "TESTE"
  widgets; it is not part of `npm run build`, CI, or the published package.
- The 7 "TESTE" widgets are a shared scratch resource — whoever runs this
  last "wins"; there's no locking. Coordinate with the team before syncing if
  someone else might be actively testing there.
- `playwright-core` lives only in `tools/tb-widget-sync/node_modules`
  (gitignored), installed via its own local `package.json` — it is
  intentionally not a dependency of the library itself.
