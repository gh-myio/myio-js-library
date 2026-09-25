// Verifies that all 7 ThingsBoard "... - v.5.2.0 - TESTE" widget-types match
// the local repo's source files, by reading each widget-type directly from
// the ThingsBoard REST API (GET /api/widgetType/{id}) — NOT by reading the
// Ace editor UI. UI-based reads (via Playwright or DevTools) proved
// unreliable for verification (confirmed to return different wrong-content
// readings for the same field across different attempts); the backend API
// is the only fully-trustworthy source of truth for what is actually saved.
//
// Requires the same already-running debug Chrome (port 9222) with the 7
// widget-editor tabs open and logged into ThingsBoard as sync.js.
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

const WIDGET_UUID = {
  MAIN_VIEW: '55832c30-5a41-11f1-ab52-9b3e4c8bcc59',
  MENU: '6346bb70-5a41-11f1-ab52-9b3e4c8bcc59',
  HEADER: '6e346e60-5a41-11f1-ab52-9b3e4c8bcc59',
  FOOTER: '83e67a50-5a41-11f1-ab52-9b3e4c8bcc59',
  TELEMETRY: '793a1620-5a41-11f1-ab52-9b3e4c8bcc59',
  TELEMETRY_INFO: 'b0d1ce70-5a41-11f1-ab52-9b3e4c8bcc59',
  ALARM: '9be92d00-5a41-11f1-ab52-9b3e4c8bcc59',
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
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
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
  process.exit(anyMismatch ? 1 : 0);
})();
