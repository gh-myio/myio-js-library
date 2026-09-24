// Syncs template.html / styles.css / settingsSchema.json / controller.js from
// the local repo (whatever git branch is currently checked out) into the
// matching "... - v.5.2.0 - TESTE" ThingsBoard widget-type editor, using
// Playwright connected over CDP to the ALREADY-RUNNING Chrome (debug port
// 9222) — it does not launch its own browser.
//
// See docs/thingsboard/runbooks/sync-widget-source-to-tb-teste.md for the
// full runbook (prerequisites, step-by-step, troubleshooting).
//
// SAFETY DESIGN (post-incident): each of the 4 fields (html/css/js/schema)
// gets its own fully independent cycle — set value, wait for Save to enable,
// click Save, wait for Save to disable again (confirms persisted) — BEFORE
// touching any other tab. The original bug came from setting a value and
// then immediately switching tabs before Angular had committed the change,
// which silently duplicated the LAST-set value into the PREVIOUS field.
// Editors are located by DOM structure/position (which mat-tab-group they
// belong to, left vs right), never by a fixed .ace_editor[] index — indices
// are not stable once a lazily-mounted tab has been visited.
//
// A second, subtler variant of the same bug was found afterwards: syncing
// html and css (they share one Ace instance/tab-group — the "left" pane)
// back-to-back in the SAME page session still corrupts one into the other,
// even with the full save-cycle wait in between. The fix is a page reload
// between two "left"-pane fields, forcing Angular to fully re-mount the
// editor/tab state — this script does that automatically.
//
// Usage:
//   node sync.js                      # sync all 4 fields, all 7 widgets
//   node sync.js --fields=html         # only the html field (e.g. recovery)
//   node sync.js --widgets=MAIN_VIEW,MENU
//   node sync.js --dry-run             # set values + verify, but never click Save

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WIDGET_DIR = path.join(REPO_ROOT, 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');
const CDP_ENDPOINT = 'http://localhost:9222';

const WIDGET_UUID = {
  MAIN_VIEW: '55832c30-5a41-11f1-ab52-9b3e4c8bcc59',
  MENU: '6346bb70-5a41-11f1-ab52-9b3e4c8bcc59',
  HEADER: '6e346e60-5a41-11f1-ab52-9b3e4c8bcc59',
  FOOTER: '83e67a50-5a41-11f1-ab52-9b3e4c8bcc59',
  TELEMETRY: '793a1620-5a41-11f1-ab52-9b3e4c8bcc59',
  TELEMETRY_INFO: 'b0d1ce70-5a41-11f1-ab52-9b3e4c8bcc59',
  ALARM: '9be92d00-5a41-11f1-ab52-9b3e4c8bcc59',
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
  return {
    fields: args.fields ? args.fields.split(',') : Object.keys(FIELD_DEF),
    widgets: args.widgets ? args.widgets.split(',') : Object.keys(WIDGET_UUID),
    dryRun: !!args['dry-run'],
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

  if (def.tabLabel) {
    await page.evaluate((label) => {
      const tabs = Array.from(document.querySelectorAll('.mat-mdc-tab, [role="tab"]'));
      const tab = tabs.find((t) => t.textContent.trim() === label);
      if (!tab) throw new Error('Tab not found: ' + label);
      tab.click();
    }, def.tabLabel);
    await page.waitForTimeout(300); // tab-switch animation + lazy content mount
  }

  // pageLocateEditor's SOURCE is passed as a string and reconstructed with
  // `new Function` inside the page, since Playwright's evaluate only
  // serializes the one function object it's handed, not other Node-side
  // functions referenced by closure. `new Function(body)` here is safe (no
  // user/network-controlled input — pageLocateEditor is our own static source).
  const locateSrc = pageLocateEditor.toString();

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
    console.log(`  [${fieldKey}] OK (dry-run, not saved) — ${content.length} chars verified`);
    return;
  }

  await waitForSaveState(page, true); // Save must be enabled (dirty) before we click it
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'saveSave');
    if (!btn) throw new Error('Save button not found');
    btn.click();
  });
  await waitForSaveState(page, false); // Save must be disabled again (persisted) before moving on
  console.log(`  [${fieldKey}] OK — saved (${content.length} chars)`);
}

async function main() {
  const { fields, widgets, dryRun } = parseArgs();
  console.log(`Fields: ${fields.join(', ')} | Widgets: ${widgets.join(', ')} | dryRun=${dryRun}`);

  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const contexts = browser.contexts();
  const allPages = contexts.flatMap((c) => c.pages());

  const failures = [];
  for (const widgetName of widgets) {
    const uuid = WIDGET_UUID[widgetName];
    const page = allPages.find((p) => p.url().includes(uuid));
    if (!page) {
      console.log(`[${widgetName}] SKIPPED — no open tab found for UUID ${uuid}`);
      failures.push(widgetName);
      continue;
    }
    console.log(`\n[${widgetName}] (${page.url()})`);
    try {
      let lastPane = null;
      for (const fieldKey of fields) {
        const pane = FIELD_DEF[fieldKey].pane;
        // Confirmed by incident post-mortem: syncing two 'left'-pane fields
        // (html/css) back-to-back in the SAME page session still corrupts
        // one into the other, even with the full save-cycle wait in between.
        // A page reload between them forces Angular to fully re-mount the
        // editor/tab state, which is the only combination proven safe. Only
        // needed pane-to-pane, never on the very first field of a widget.
        if (lastPane === 'left' && pane === 'left') {
          console.log(`  (reloading page before next left-pane field to avoid tab-switch corruption)`);
          await page.reload({ waitUntil: 'load' });
          await page.waitForSelector('.ace_editor', { timeout: 15000 });
          await page.waitForTimeout(500);
        }
        await syncField(page, widgetName, fieldKey, { dryRun });
        lastPane = pane;
      }
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      failures.push(widgetName);
    }
  }

  await browser.close();

  console.log('\n=== Summary ===');
  console.log(`${widgets.length - failures.length}/${widgets.length} widgets OK`);
  if (failures.length) {
    console.log('Failures:', failures.join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
