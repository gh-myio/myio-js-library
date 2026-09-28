// Syncs template.html / styles.css / settingsSchema.json / controller.js from
// the local repo (whatever git branch is currently checked out) into the
// matching PRODUCTION "Widget - Shopping Dashboard - <NAME> - v.5.2.0"
// ThingsBoard widget-type editor, using Playwright connected over CDP to the
// ALREADY-RUNNING Chrome (debug port 9222) — it does not launch its own browser.
//
// *** THIS TARGETS PRODUCTION. *** Unlike tools/tb-widget-sync (the "TESTE"
// widgets, a shared scratch resource), a Save here takes effect immediately
// for every real customer dashboard using that widget type — there is no
// separate publish/deploy step. Treat every run of this script as a
// production deploy.
//
// See docs/thingsboard/runbooks/sync-widget-source-to-tb-prod.md for the
// full runbook (prerequisites, step-by-step, rollback, troubleshooting).
// tools/tb-widget-sync/sync.js (TESTE) documents the field-sync mechanics
// and the two cross-tab-bleed failure modes this shares line-for-line —
// read those comments there if you need the "why", not just the "what".
//
// SAFETY GATES on top of the TESTE script:
//   1. --yes is REQUIRED to click Save. Without it, this always behaves like
//      --dry-run (set + read-back verify in the editor, never persisted),
//      no matter what else was passed — running this the exact same way you
//      run the TESTE tool, out of habit, does NOT touch production.
//   2. Prints the widget list and a loud PRODUCTION banner before doing
//      anything, whether or not --yes was given.
//
// Usage:
//   node sync.js                          # dry-run (prints what WOULD sync)
//   node sync.js --yes                    # actually sync + save, all 4 fields, all 7 widgets
//   node sync.js --yes --widgets=HEADER    # actually sync + save, just one widget
//   node sync.js --yes --fields=js         # actually sync + save, just one field
//   node sync.js --dry-run --yes           # --dry-run always wins even with --yes

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WIDGET_DIR = path.join(REPO_ROOT, 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');
const CDP_ENDPOINT = 'http://localhost:9222';

// PRODUCTION widget-type UUIDs — "Widget - Shopping Dashboard - <NAME> - v.5.2.0"
// (no "- TESTE" suffix). Confirmed 2026-09-28 via GET /api/widgetType/{id} against
// the live dashboard.myio-bas.com: name + fqn + descriptor field lengths all matched
// the corresponding local WIDGET/<NAME> folder (within the expected drift of PROD
// being a few commits behind whatever is currently checked out). Do not guess new
// ones by pattern — confirm the same way if a widget is ever added/renamed.
const WIDGET_UUID = {
  MAIN_VIEW: '1faf5e00-a3b5-11f0-afe1-175479a33d89',
  MENU: '7dde51f0-a3b7-11f0-afe1-175479a33d89',
  HEADER: '9fa2e1c0-a3b7-11f0-afe1-175479a33d89',
  FOOTER: 'dfc6dd60-a3b7-11f0-afe1-175479a33d89',
  TELEMETRY: 'c3a99960-a3b7-11f0-afe1-175479a33d89',
  TELEMETRY_INFO: '3df716f0-b049-11f0-9722-210aa9448abc',
  ALARM: '5a9438f0-0f36-11f1-a625-4d3576ae337e', // ThingsBoard name: "... - ALARMS - ..."
};

// field -> { tabLabel, fileName }. HTML/CSS live in the LEFT tab-group
// (Resources/HTML/CSS), Settings schema in the RIGHT one, JS is standalone.
const FIELD_DEF = {
  html: { tabLabel: 'HTML', fileName: 'template.html', pane: 'left' },
  css: { tabLabel: 'CSS', fileName: 'styles.css', pane: 'left' },
  schema: { tabLabel: 'Settings schema', fileName: 'settingsSchema.json', pane: 'right' },
  js: { tabLabel: null, fileName: 'controller.js', pane: 'js' },
};

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
  );
  const yes = !!args.yes;
  const explicitDryRun = !!args['dry-run'];
  return {
    fields: args.fields ? args.fields.split(',') : Object.keys(FIELD_DEF),
    widgets: args.widgets ? args.widgets.split(',') : Object.keys(WIDGET_UUID),
    // Real writes require BOTH: --yes given, AND --dry-run not given.
    dryRun: explicitDryRun || !yes,
    yes,
  };
}

function readFile(widgetName, fileName) {
  return fs.readFileSync(path.join(WIDGET_DIR, widgetName, fileName), 'utf8');
}

// Self-contained: every helper this needs is declared INSIDE the callback,
// since Playwright only ships the one function it's given to the page — it
// does not also bring along other Node-side functions referenced by name.
// Locates the correct Ace editor DOM element for a given pane ('left' |
// 'right' | 'js') by DOM structure/position, re-queried fresh every time —
// never cached, never by fixed index.
function pageLocateEditor(pane) {
  const editors = Array.from(document.querySelectorAll('.ace_editor'));
  if (pane === 'js') return editors.find((el) => !el.closest('mat-tab-group')) || null;
  const groups = Array.from(document.querySelectorAll('mat-tab-group'))
    .map((g) => ({ g, x: g.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x);
  const targetGroup = pane === 'left' ? groups[0] && groups[0].g : groups.length && groups[groups.length - 1].g;
  if (!targetGroup) return null;
  return editors.find((el) => el.closest('mat-tab-group') === targetGroup) || null;
}

async function getSaveDisabled(page) {
  return page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'saveSave');
    return btn ? btn.disabled : null;
  });
}

// Polls by re-reading state on a plain interval rather than page.waitForFunction
// — waitForFunction's in-page polling proved unreliable here (a real, confirmed
// save was reported as a timeout at least once during testing), root cause not
// fully pinned down. This simpler poll-from-Node approach was verified to work.
async function waitForSaveState(page, wantEnabled, timeoutMs = 8000) {
  const start = Date.now();
  let everFound = false;
  while (Date.now() - start < timeoutMs) {
    const disabled = await getSaveDisabled(page);
    if (disabled !== null) {
      everFound = true;
      if (wantEnabled ? disabled === false : disabled === true) return;
    }
    // null (button transiently not in the DOM, e.g. mid tab-switch animation
    // or Angular re-render right after a click) is NOT an error by itself —
    // only a problem if it's STILL missing once the whole timeout elapses.
    await page.waitForTimeout(150);
  }
  throw new Error(
    everFound
      ? `Timed out waiting for Save button to become ${wantEnabled ? 'enabled' : 'disabled'}`
      : 'Save button never found in the DOM during the whole wait window'
  );
}

async function syncField(page, widgetName, fieldKey, { dryRun }) {
  const def = FIELD_DEF[fieldKey];
  const content = readFile(widgetName, def.fileName);

  // pageLocateEditor's SOURCE is passed as a string and reconstructed with
  // `new Function` inside the page, since Playwright's evaluate only
  // serializes the one function object it's handed, not other Node-side
  // functions referenced by closure. `new Function(body)` here is safe (no
  // user/network-controlled input — pageLocateEditor is our own static source).
  const locateSrc = pageLocateEditor.toString();

  if (def.tabLabel) {
    // Read the shared editor's content BEFORE the click, so we can detect
    // when Angular has actually finished swapping tab content afterwards.
    const preClickValue = await page.evaluate(
      ({ pane, locateSrc }) => {
        const locateEditorEl = new Function('pane', `const fn = ${locateSrc}; return fn(pane);`);
        const el = locateEditorEl(pane);
        return el ? window.ace.edit(el).getValue() : null;
      },
      { pane: def.pane, locateSrc }
    );

    await page.evaluate((label) => {
      const tabs = Array.from(document.querySelectorAll('.mat-mdc-tab, [role="tab"]'));
      const tab = tabs.find((t) => t.textContent.trim() === label);
      if (!tab) throw new Error('Tab not found: ' + label);
      tab.click();
    }, def.tabLabel);

    // CRITICAL (post-incident hardening, same as the TESTE tool): a fixed
    // timeout here is not reliable — Angular's tab-switch handler (which
    // commits the outgoing tab's content to ITS model slot, then loads the
    // incoming tab's stored content into the shared Ace instance) can still
    // be mid-flight when we call setValue() next. If our write lands before
    // that handler's first step runs, our NEW value gets committed to the
    // PREVIOUS (outgoing) tab's model instead. Poll for the editor's content
    // to actually change away from what it was pre-click, which can only
    // happen once Angular's handler has run.
    const start = Date.now();
    let changed = false;
    while (Date.now() - start < 3000) {
      const current = await page.evaluate(
        ({ pane, locateSrc }) => {
          const locateEditorEl = new Function('pane', `const fn = ${locateSrc}; return fn(pane);`);
          const el = locateEditorEl(pane);
          return el ? window.ace.edit(el).getValue() : null;
        },
        { pane: def.pane, locateSrc }
      );
      if (current !== preClickValue) {
        changed = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!changed) {
      // Rare fallback (e.g. the two tabs' stored content happens to be
      // byte-identical) — give Angular extra grace time and proceed anyway.
      console.log(`  [${fieldKey}] (tab content did not visibly change after click — using fallback grace wait)`);
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(200); // small settle margin after the detected swap
  }

  const write = await page.evaluate(
    ({ pane, content, locateSrc }) => {
      const locateEditorEl = new Function('pane', `const fn = ${locateSrc}; return fn(pane);`);
      const el = locateEditorEl(pane);
      if (!el) return { ok: false, error: 'editor element not found for pane=' + pane };
      const editor = window.ace.edit(el);
      editor.setValue(content, -1);
      document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
      return { ok: true, writtenLength: editor.getValue().length };
    },
    { pane: def.pane, content, locateSrc }
  );
  if (!write.ok) throw new Error(`[${widgetName}/${fieldKey}] setValue failed: ${write.error}`);
  if (write.writtenLength !== content.length) {
    throw new Error(
      `[${widgetName}/${fieldKey}] length mismatch after setValue: wrote ${content.length}, editor now has ${write.writtenLength}`
    );
  }

  // Verify (read back) before saving — cheap, catches the exact class of bug
  // that caused the incident, before it ever reaches Save.
  const readBack = await page.evaluate(
    ({ pane, locateSrc }) => {
      const locateEditorEl = new Function('pane', `const fn = ${locateSrc}; return fn(pane);`);
      const el = locateEditorEl(pane);
      return el ? window.ace.edit(el).getValue() : null;
    },
    { pane: def.pane, locateSrc }
  );
  if (readBack !== content) {
    throw new Error(`[${widgetName}/${fieldKey}] read-back mismatch — editor content does not match what was written`);
  }

  if (dryRun) {
    console.log(`  [${fieldKey}] OK (dry-run, NOT saved — production untouched) — ${content.length} chars verified`);
    return;
  }

  // If the content we just wrote is byte-identical to what was already
  // saved, Angular never marks the form dirty and Save never enables — this
  // is a legitimate "already up to date" case (verified above via read-back),
  // not a failure. Treat it as a benign skip so it doesn't abort the rest of
  // this widget's fields.
  try {
    await waitForSaveState(page, true); // Save must be enabled (dirty) before we click it
  } catch (err) {
    if (/become enabled/.test(err.message)) {
      console.log(`  [${fieldKey}] OK (already up to date, nothing to save) — ${content.length} chars verified`);
      return;
    }
    throw err;
  }
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'saveSave');
    if (!btn) throw new Error('Save button not found');
    btn.click();
  });
  await waitForSaveState(page, false); // Save must be disabled again (persisted) before moving on
  console.log(`  [${fieldKey}] OK — SAVED TO PRODUCTION (${content.length} chars)`);
}

async function main() {
  const { fields, widgets, dryRun, yes } = parseArgs();

  console.log('='.repeat(72));
  console.log('  PRODUCTION widget-type sync — dashboard.myio-bas.com');
  console.log('  A Save here is LIVE IMMEDIATELY for every real customer dashboard');
  console.log('  using that widget type. There is no separate publish step.');
  console.log('='.repeat(72));
  console.log(`Fields: ${fields.join(', ')} | Widgets: ${widgets.join(', ')}`);
  console.log(
    dryRun
      ? `Mode: DRY-RUN — nothing will be saved.${yes ? '' : ' (pass --yes to actually save; --dry-run always wins over --yes)'}`
      : 'Mode: LIVE — Save WILL be clicked for each field. Ctrl+C now to abort.'
  );
  if (!dryRun) {
    for (let s = 3; s >= 1; s--) {
      process.stdout.write(`  starting in ${s}...\r`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('');
  }

  // Default 30s connect timeout isn't always enough once the dashboard page
  // has accumulated many worker targets over a long session (Playwright has
  // to enumerate all of them on connect) — bump it rather than fail spuriously.
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 90000 });
  const contexts = browser.contexts();
  const allPages = contexts.flatMap((c) => c.pages());

  const failures = [];
  for (const widgetName of widgets) {
    const uuid = WIDGET_UUID[widgetName];
    if (!uuid) {
      console.log(`[${widgetName}] SKIPPED — unknown widget name (not in WIDGET_UUID)`);
      failures.push(widgetName);
      continue;
    }
    const page = allPages.find((p) => p.url().includes(uuid));
    if (!page) {
      console.log(`[${widgetName}] SKIPPED — no open tab found for UUID ${uuid}`);
      failures.push(widgetName);
      continue;
    }
    console.log(`\n[${widgetName}] (${page.url()})`);
    let lastPane = null;
    let widgetFailed = false;
    for (const fieldKey of fields) {
      const pane = FIELD_DEF[fieldKey].pane;
      try {
        // Confirmed by incident post-mortem on the TESTE tool: syncing two
        // 'left'-pane fields (html/css) back-to-back in the SAME page
        // session still corrupts one into the other, even with the full
        // save-cycle wait in between. A page reload between them forces
        // Angular to fully re-mount the editor/tab state — the only
        // combination proven safe. Only needed pane-to-pane, never on the
        // very first field of a widget.
        if (lastPane === 'left' && pane === 'left') {
          console.log(`  (reloading page before next left-pane field to avoid tab-switch corruption)`);
          await page.reload({ waitUntil: 'load' });
          await page.waitForSelector('.ace_editor', { timeout: 15000 });
          await page.waitForTimeout(500);
        }
        await syncField(page, widgetName, fieldKey, { dryRun });
      } catch (err) {
        // Don't let one field's failure stop the rest of this widget's
        // fields from being attempted — each field is independent.
        console.log(`  [${fieldKey}] FAILED: ${err.message}`);
        widgetFailed = true;
      }
      lastPane = pane;
    }
    if (widgetFailed) failures.push(widgetName);
  }

  await browser.close();

  console.log('\n=== Summary ===');
  console.log(`${widgets.length - failures.length}/${widgets.length} widgets OK`);
  if (dryRun) console.log('(dry-run — nothing was saved to production; re-run with --yes to actually deploy)');
  if (failures.length) {
    console.log('Failures:', failures.join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
