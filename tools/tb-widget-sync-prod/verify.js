// Verifies that all 7 PRODUCTION ThingsBoard "Widget - Shopping Dashboard -
// <NAME> - v.5.2.0" widget-types match the local repo's source files, by
// reading each widget-type directly from the ThingsBoard REST API
// (GET /api/widgetType/{id}) — NOT by reading the Ace editor UI. UI-based
// reads proved unreliable for verification on the TESTE tool (confirmed to
// return different wrong-content readings for the same field across
// different attempts); the backend API is the only fully-trustworthy source
// of truth for what is actually saved (and, here, actually live).
//
// Read-only — this script never writes anything. Safe to run any time to
// check production against whatever branch is currently checked out locally.
//
// Requires an already-running debug Chrome (port 9222), with at least one
// tab open and logged into ThingsBoard (any dashboard.myio-bas.com tab —
// unlike sync.js, verify.js doesn't need the widget-type editor tabs open,
// it only needs a logged-in page to run its API fetch() from).
//
// Usage:
//   node verify.js                       # check all 4 fields, all 7 widgets
//   node verify.js --widgets=MAIN_VIEW,MENU

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WIDGET_DIR = path.join(REPO_ROOT, 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');
const CDP_ENDPOINT = 'http://localhost:9222';

// PRODUCTION widget-type UUIDs — see sync.js for how these were confirmed.
const WIDGET_UUID = {
  MAIN_VIEW: '1faf5e00-a3b5-11f0-afe1-175479a33d89',
  MENU: '7dde51f0-a3b7-11f0-afe1-175479a33d89',
  HEADER: '9fa2e1c0-a3b7-11f0-afe1-175479a33d89',
  FOOTER: 'dfc6dd60-a3b7-11f0-afe1-175479a33d89',
  TELEMETRY: 'c3a99960-a3b7-11f0-afe1-175479a33d89',
  TELEMETRY_INFO: '3df716f0-b049-11f0-9722-210aa9448abc',
  ALARM: '5a9438f0-0f36-11f1-a625-4d3576ae337e', // ThingsBoard name: "... - ALARMS - ..."
};

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
  );
  return {
    widgets: args.widgets ? args.widgets.split(',') : Object.keys(WIDGET_UUID),
  };
}

(async () => {
  const { widgets } = parseArgs();
  console.log('Verifying PRODUCTION widget-types against local source (read-only)...\n');
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 90000 });
  const page = browser.contexts()[0].pages()[0];

  let anyMismatch = false;

  for (const name of widgets) {
    const uuid = WIDGET_UUID[name];
    const dir = path.join(WIDGET_DIR, name);
    const expected = {
      html: fs.readFileSync(path.join(dir, 'template.html'), 'utf8'),
      css: fs.readFileSync(path.join(dir, 'styles.css'), 'utf8'),
      js: fs.readFileSync(path.join(dir, 'controller.js'), 'utf8'),
      schema: fs.readFileSync(path.join(dir, 'settingsSchema.json'), 'utf8'),
    };

    const actual = await page.evaluate(async (uuid) => {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('/api/widgetType/' + uuid + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'X-Authorization': 'Bearer ' + token, 'Cache-Control': 'no-cache' },
      });
      const json = await res.json();
      const d = json.descriptor || {};
      return {
        html: d.templateHtml || '',
        css: d.templateCss || '',
        js: d.controllerScript || '',
        schema: d.settingsSchema || '',
      };
    }, uuid);

    const results = {};
    for (const field of ['html', 'css', 'js', 'schema']) {
      results[field] =
        actual[field] === expected[field] ? 'OK' : `MISMATCH(${actual[field].length} vs ${expected[field].length})`;
      if (results[field] !== 'OK') anyMismatch = true;
    }
    console.log(`${name}: HTML=${results.html} | CSS=${results.css} | JS=${results.js} | Schema=${results.schema}`);
  }

  await browser.close();
  if (anyMismatch) {
    console.log('\nMismatch found — this only means production differs from your LOCAL checkout, which is normal');
    console.log('unless you just ran sync.js --yes. It does not by itself mean production is broken.');
  }
  process.exit(anyMismatch ? 1 : 0);
})();
