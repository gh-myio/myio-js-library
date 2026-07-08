# Showcase — Main View Shopping (v-5.4.0 domain-agnostic dashboard)

A standalone **dev harness** that runs the production ThingsBoard widget controller
`src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` **outside ThingsBoard**, in a
plain browser page. It fakes the TB widget context (`self.ctx`), loads the compiled
`MyIOLibrary` UMD bundle, and gives you a right-hand **cockpit** to drive the widget lifecycle,
edit every widget setting, switch environments, log in, watch events, and emulate a mobile
viewport.

> **This README is a reconstruction spec.** It is written so that, reading only this file, you
> can recreate the entire `showcase/main-view-shopping/` folder from scratch — the file list,
> each file's contract, the DOM skeleton the controller depends on, the harness JS functions,
> and the boot/run order. Verbatim snippets below are the parts that are *contracts* (must match
> exactly); everything else is described precisely enough to re-implement.

---

## 1. Quick start

```bash
./start-server.sh         # or start-server.bat (Windows) — serves the REPO ROOT on :3339
# open http://localhost:3339/showcase/main-view-shopping/
```

1. **🔑 Login TB** → authenticate; JWT is stored in `localStorage.jwt_token`.
2. **▶ Run onInit + onDataUpdated** → builds `self.ctx`, lazy-loads the controller, runs `onInit()`.
   This fetches the GCDR `/entities` tree + `/devices` live and enriches consumption.

> ⚠️ Requires the compiled bundle at `../../dist/myio-js-library.umd.js` — run **`npm run build`**
> at the repo root after changing library source. Live GCDR/Data-Apps calls need the servers
> reachable **with CORS** for `localhost:3339`.

---

## 2. File manifest (everything in this folder)

| File | Tracked | Purpose |
|------|---------|---------|
| `index.html` | ✅ | The entire harness (DOM + CSS + JS). §4 specifies it fully. |
| `config.example.json` | ✅ | Template for `config.json` (same shape, **no secrets**). §5. |
| `config.json` | 🚫 gitignored | Your real environments + secrets. **Loaded by the page.** §5. |
| `start-server.sh` / `start-server.bat` | ✅ | Static server on port `3339`, served from repo root. §6. |
| `stop-server.sh` / `stop-server.bat` | ✅ | Kill the server on `3339`. §6. |
| `README.md` | ✅ | This spec. |

To rebuild from zero you create exactly these files. `config.json` is created by the user
(copy of `config.example.json`); it is never committed.

---

## 3. External dependencies (loaded by `index.html`, in order)

1. `https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap` — MyIO standard font.
2. `https://code.jquery.com/jquery-3.7.1.min.js`
3. `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js`
4. `../../dist/myio-js-library.umd.js?v=<Date.now()>` — the compiled library (cache-busted via `document.write`).
5. The v-5.4.0 controller is **not** loaded at page load — it is injected lazily on first **Run**
   from `../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js?v=<Date.now()>`.

All paths are `../../`-relative because the server roots at the repo, not this folder.

---

## 4. `index.html` — full specification

### 4.1 `<head>`

- charset, viewport, title.
- The Nunito `<link>` (preconnect to googleapis + gstatic, then the stylesheet).
- The widget stylesheet: `<link rel="stylesheet" href="../../src/thingsboard/main-dashboard-shopping/v-5.4.0/styles.css">`.
- One inline `<style>` block (§4.4).

### 4.2 `<body>` DOM skeleton (this is a **contract** — the controller targets these ids)

```html
<body>
  <!-- LEFT: the dashboard, wrapped in #sc-stage so it can be framed as a phone -->
  <div id="sc-stage">
    <section id="myio-root" class="myio-grid">
      <aside class="myio-sidebar"><section id="menuContainer"  class="myio-menu-section"></section></aside>
      <header class="myio-header"><section id="headerContainer" class="myio-header-section"></section></header>
      <main class="myio-content">
        <div id="domainContentRoot"></div>                 <!-- controller generates one section per GCDR domain -->
        <div data-content-state="alarm_content" class="myio-content-grid" style="display:none">
          <section id="alarmContentContainer" class="myio-grid-column myio-grid-full"></section>
        </div>
      </main>
      <footer class="myio-footer"><section id="footerContainer" class="myio-footer-section"></section></footer>
      <div id="panelModalContainer"></div>
    </section>
  </div><!-- /#sc-stage -->

  <!-- RIGHT: showcase cockpit -->
  <aside id="sc-cockpit">
    <div class="sc-head">
      <button id="sc-toggle" class="sc-ghost">⟩</button>
      <strong class="sc-title">v-5.4.0 cockpit</strong>
      <button id="sc-login" class="sc-ghost sc-title">🔑 Login TB</button>
    </div>
    <div class="sc-body">
      <div class="sc-scroll">                              <!-- ZONE 1: scrollable -->
        <div id="sc-auth" class="sc-auth no">🔒 sem JWT</div>
        <div id="sc-fields"><!-- settings form, generated from settingsSchema.json --></div>
        <fieldset class="sc-fieldset">
          <legend>SERVER_SCOPE attrs (simulado)</legend>
          <label for="sc-gcdrKey">X-API-Key (gcdrApiKey)</label>
          <select id="sc-gcdrKey"><!-- options from config.apiKeys --></select>
        </fieldset>
      </div>
      <div class="sc-console" id="sc-console">             <!-- ZONE 2: collapsible log -->
        <div class="sc-console-head"><button id="sc-log-toggle" class="sc-ghost">▾ console</button></div>
        <div id="sc-log"></div>
      </div>
      <div class="sc-actions">                             <!-- ZONE 3: fixed buttons -->
        <button id="sc-run">▶ Run onInit + onDataUpdated</button>
        <button id="sc-data">⟳ onDataUpdated</button>
        <button id="sc-destroy">✖ onDestroy</button>
        <button id="sc-mobile" class="sc-ghost">📱 Emular Mobile</button>
      </div>
    </div>
  </aside>

  <!-- Login modal -->
  <div class="sc-modal-overlay" id="sc-login-modal">
    <form class="sc-login" id="sc-login-form">
      <button type="button" class="sc-close" id="sc-login-close">×</button>
      <div class="sc-logo">⚡</div><h2>Login ThingsBoard</h2>
      <div id="sc-login-err" class="sc-err" style="display:none"></div>
      <input id="sc-login-user" type="text"/> 
      <div class="pwd"><input id="sc-login-pass" type="password"/><button type="button" id="sc-login-eye">👁</button></div>
      <button type="submit" class="sc-submit" id="sc-login-submit">Entrar</button>
    </form>
  </div>
  <!-- Boot countdown overlay (visible by default; §4.5 startBootCountdown) -->
  <div id="sc-boot"><div class="sc-boot-card">
    <div class="sc-boot-title">…</div>
    <div class="sc-boot-count" id="sc-boot-count">6</div>
    <div class="sc-boot-sub">Iniciando em <span id="sc-boot-secs">6</span>s …</div>
    <button id="sc-boot-cancel" class="sc-boot-cancel">Cancelar</button>
  </div></div>

  <!-- dependencies + harness scripts (§3) -->
</body>
```

**Required ids the controller reads** (do not rename): `myio-root`, `menuContainer`,
`headerContainer`, `domainContentRoot`, `footerContainer`, `panelModalContainer`, plus the
`data-content-state` convention for state switching. `#sc-stage` and everything `#sc-*` belong to
the harness, not the controller.

### 4.3 Layout model

`body { display:flex; flex-direction:row }`. Two children: `#sc-stage` (`flex:1 1 auto`, holds the
dashboard) and `#sc-cockpit` (`flex:0 0 340px`). `body.console-collapsed` shrinks the cockpit to a
`46px` strip (hiding `.sc-body`/`.sc-title`).

### 4.4 Inline CSS — the parts that are contracts (copy verbatim)

```css
/* base */
html, body { height:100%; }
body { margin:0; font-family:'Nunito', Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
       background:#f4f4f7; display:flex; flex-direction:row; height:100vh; overflow:hidden; }
#myio-root { flex:1 1 auto; min-width:0; min-height:0; }

/* stage wrapper (neutral flex) */
#sc-stage { flex:1 1 auto; min-width:0; min-height:0; display:flex; }
#sc-stage > #myio-root { flex:1 1 auto; min-width:0; min-height:0; }

/* mobile preview: iframe at a phone width (real viewport → dashboard @media rules fire) */
#sc-mobile-overlay { position:fixed; inset:0; z-index:10001; background:rgba(11,11,20,.78); display:flex; align-items:center; justify-content:center; }
#sc-mobile-overlay .sc-phone { display:flex; flex-direction:column; width:390px; max-width:94vw; height:844px; max-height:94vh; background:#14141f; border-radius:28px; padding:10px; box-shadow:0 0 0 2px #2a2a3a, 0 24px 70px rgba(0,0,0,.6); }
#sc-mobile-overlay .sc-phone-screen { flex:1 1 auto; width:100%; border:0; border-radius:20px; background:#fff; }

/* embed mode (?embed=mobile): hide cockpit, dashboard fills the iframe viewport */
body.embed-mobile { flex-direction:column; }
body.embed-mobile #sc-cockpit, body.embed-mobile #sc-login-modal { display:none !important; }
body.embed-mobile #sc-stage > #myio-root { width:100%; height:100%; border-radius:0; box-shadow:none; }

/* cockpit shell */
#sc-cockpit { flex:0 0 340px; display:flex; flex-direction:column; background:#1f1147; color:#fff; font-size:12px; overflow:hidden; transition:flex-basis .2s ease; }
#sc-cockpit .sc-body { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
#sc-cockpit .sc-scroll { flex:1 1 auto; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding:10px 12px; }
#sc-cockpit .sc-actions { flex:0 0 auto; display:flex; flex-direction:column; gap:6px; padding:10px 12px; border-top:1px solid rgba(255,255,255,.15); background:#1f1147; }
#sc-cockpit button { font-size:12px; padding:8px 12px; border:none; border-radius:6px; background:#6c5ce7; color:#fff; cursor:pointer; }
#sc-cockpit button.sc-ghost { background:transparent; border:1px solid rgba(255,255,255,.4); padding:4px 9px; }
#sc-cockpit button.sc-ghost.active { background:#6c5ce7; border-color:#6c5ce7; opacity:1; }
body.console-collapsed #sc-cockpit { flex-basis:46px; }
body.console-collapsed #sc-cockpit .sc-body, body.console-collapsed #sc-cockpit .sc-title { display:none; }
```

The rest of the CSS (env tabs `.sc-envtab`, fieldsets `.sc-fieldset`, `#sc-log` monospace, the
`.sc-login` modal, `@keyframes sc-rot`) is presentational — recreate to taste using these class
names.

### 4.5 Harness JavaScript — function contracts

All in one inline `<script>` after the dependencies. Recreate each:

| Function | Contract |
|----------|----------|
| `log(kind, msg)` | Prepend `[hh:mm:ss] msg` to `#sc-log` with class `info\|warn\|err`. |
| Event subscriptions | On load, subscribe `window` to `myio:data-ready`, `myio:dashboard-state`, `myio:energy-summary-ready`, `myio:water-summary-ready`, `myio:temperature-data-ready`, `myio:update-date` → `log()` each. |
| `deviceRows({...})` / `buildMockData()` | Build TB-datasource-shaped rows: each row `{ datasource:{entityId,entityName,entityLabel,aliasName:'all3fs'}, dataKey:{name}, data:[[ts,val]] }`. ~6 devices. **Fallback only** — real devices come from GCDR `/devices`. |
| `loadConfig()` | `fetch('./config.json')`, else `'./config.example.json'`. Set `_config`, resolve `_currentEnv` from `localStorage['sc-env']` → `cfg.defaultEnv` → first env. Log the source (warn if it was the example). |
| `flattenSettings(obj)` | Flatten nested settings (`{darkMode:{x}}` → `{'darkMode.x'}`); arrays kept as values. → `DEFAULT_OVERRIDES`. |
| `applyEnv(env)` | Set `_currentEnv`, persist to `localStorage['sc-env']`, `DEFAULT_OVERRIDES = flatten(env.settings)`, `_apiKeyOptions = env.apiKeys`, then `renderForm()` + `populateApiKeySelect()`. |
| `buildEnvTab()` | A `.sc-envtab` with one button per `_config.environments` key; active = `_currentEnv`; click → `applyEnv`. |
| `loadSchema()` | `fetch(settingsSchema.json)` → `_schema` (`{ schema:{properties}, form:[…] }`). |
| `schemaProp(path)` | Resolve a dotted key against `_schema.schema.properties` (descends `.properties`). |
| `renderField(key, typeOverride)` | Build one labeled control seeded from `DEFAULT_OVERRIDES[key] ?? prop.default`. Types: `boolean`→checkbox; `enum`/`select`→`<select>`; `number`→number; `array`→comma-separated text; `color`→color; else text. Each control carries `data-setkey` + `data-kind`. |
| `buildFieldset(item)` | A collapsible `.sc-fieldset` (collapsed by default) of `renderField`s for `item.items`. |
| `renderForm()` | Render `_schema.form` into `#sc-fields`: plain fields first, `fieldset` items last; insert `buildEnvTab()` right after the `enableAnnotationsOnboarding` field. |
| `assignPath(obj,path,val)` / `readSettings()` | Read every `#sc-fields [data-setkey]` back into a **nested** settings object (inverse of flatten), coercing by `data-kind`. |
| `seedCustomerAttrs(gcdrTenantId)` | Set `window.MyIOUtils.customerAttrs.gcdrapikey` = the `#sc-gcdrKey` value, and `.gcdrtenantid`. **Gotcha:** the controller does `Object.assign(window.MyIOUtils, …)` at load, wiping `customerAttrs` → this MUST run again **after** `loadController()` and **before** `onInit()`, or GCDR calls 401. |
| `buildCtx()` | Set `self.ctx` (§4.6). Returns false if `_schema` not loaded. |
| `loadController()` | Inject the controller `<script>` once (cache-busted). Resolves on load. |
| `updateAuthStatus()` / login flow | `#sc-auth` shows JWT state; the modal `POST {thingsboardUrl}/api/auth/login {username,password}` → save `localStorage.jwt_token`. |
| `startBootCountdown()` | Full-screen blur overlay `#sc-boot` counting `_bootCountdownSecs`→0 (from `config.json` `general-settings.bootCountdownSeconds`, default 6; `0` = run immediately). On 0: click `#sc-run` (auto onInit) then `body.classList.add('console-collapsed')` (fully collapse the cockpit). **Cancel** (`#sc-boot-cancel`) aborts and keeps the cockpit. One-shot per load — F5 to redo. Not shown in embed mode. |

### 4.6 The faked `self.ctx` (contract)

```js
self.ctx = {
  settings,                                   // readSettings() — current env form
  data: buildMockData(),
  datasources: [{ type:'entity', name:'AllDevices', aliasName:'all3fs' }],
  currentUser: { email:'showcase@myio.com.br', firstName:'Showcase', lastName:'User',
                 authority:'CUSTOMER_USER', customerTitle:'Shopping (showcase)' },
  http: { getServerCredentials: () => ({ token: localStorage.getItem('jwt_token') || '' }) },
  $scope: {}, detectChanges: () => {},
};
```

### 4.7 Button handlers (exact ordering matters)

- **`#sc-run`**: `if (!MyIOLibrary) abort` → `buildCtx()` → `await loadController()` →
  `seedCustomerAttrs(ctx.settings.gcdrTenantId)` **again** (re-seed after the controller wipe) →
  `await self.onInit()` → optionally `self.onDataUpdated()`.
- **`#sc-data`**: `buildCtx()` → `self.onDataUpdated?.()`.
- **`#sc-destroy`**: `self.onDestroy?.()`.
- **`#sc-toggle`**: toggle `body.console-collapsed`; swap glyph `⟩`/`⟨`.
- **`#sc-log-toggle`**: toggle `#sc-console.collapsed`; swap `▾`/`▸`.
- **`#sc-mobile`** (mobile preview): toggle a fixed `#sc-mobile-overlay` containing a 390×844
  phone frame with `<iframe src="./index.html?embed=mobile">`. The iframe has a **real 390px
  viewport**, so the dashboard's own `@media (max-width: 920px/768px)` rules fire and it renders
  the true mobile layout. (Resizing the element in this same document would **not** trigger media
  queries — that's why a frame/iframe is required.) The embedded page detects `?embed=mobile`
  (`EMBED_MOBILE`), adds `body.embed-mobile` (hides the cockpit), and **auto-runs** `onInit`
  (it shares the parent's `localStorage` JWT, same origin; GCDR calls use the X-API-Key).

### 4.8 Boot sequence (`window load`)

```
loadConfig() → loadSchema() → applyEnv(_currentEnv) → updateAuthStatus()
→ if (EMBED_MOBILE) auto-click #sc-run
  else startBootCountdown()   // 6s blur → auto Run onInit → collapse cockpit (Cancel aborts)
```

A full-screen blur overlay (`#sc-boot`, visible in the initial HTML) counts down 6→0 on normal
load, then auto-runs `onInit` and fully collapses the cockpit. **Cancel** keeps the cockpit for
manual use. To re-run, reload (F5).

---

## 5. `config.json` / `config.example.json`

Copy the example → `config.json` (gitignored) and fill it. Shape:

```jsonc
{
  "defaultEnv": "LOCAL",
  "general-settings": {                     // global, non-per-env showcase options
    "bootCountdownSeconds": 6               // boot countdown length; 0 = run immediately (no countdown)
  },
  "environments": {
    "LOCAL": {
      "settings": { /* mirrors settingsSchema.json 1:1 — every cockpit field */
        "customerTB_ID": "…",
        "dataApiHost": "https://api.data.apps.myio-bas.com/api/v1",   // keep /api/v1 (auth appends /auth)
        "thingsboardUrl": "https://dashboard.myio-bas.com",
        "chartsBaseUrl": "https://graphs.apps.myio-bas.com",
        "gcdrApiBaseUrl": "http://localhost:3015/api/v1",
        "gcdrCustomerId": "…", "gcdrTenantId": "…",
        "alarmsApiBaseUrl": "…", "alarmsApiKey": "…",
        "defaultThemeMode": "light", "darkMode": { … }, "lightMode": { … },
        "domainsEnabled": { "energy": true, "water": true, "temperature": true }
      },
      "apiKeys": [ { "label": "…", "value": "X-API-KEY…" } ]
    },
    "PROD": { "settings": { … }, "apiKeys": [ … ] }
  }
}
```

- **`general-settings`** (optional, top-level, **not** per-env) holds global showcase options.
  Currently: `bootCountdownSeconds` (default `6`; `0` disables the countdown and runs immediately).
  Read in `loadConfig()` into `_bootCountdownSecs`; used by `startBootCountdown()`.
- **`settings`** mirrors `settingsSchema.json` exactly — it *is* the cockpit form for that env.
- **`apiKeys`** feeds the X-API-Key dropdown (simulated SERVER_SCOPE `gcdrApiKey`, sent as `X-API-Key`).
- `config.json` is **gitignored** — keep real customer ids, client secrets, and API keys **only** there.
  Never paste secrets into committed files (this README, `config.example.json`, or the HTML).

---

## 6. Server scripts

`start-server.*` — kill anything on `3339`, `cd` to the **repo root**, run `npx serve . -p 3339`,
then open `http://localhost:3339/showcase/main-view-shopping/`. `stop-server.*` — find the PID
listening on `3339` and kill it. (Serving from the root is why `index.html` uses `../../` paths to
reach `dist/` and `src/`.)

---

## 7. Data flow on "Run onInit"

1. **Tree** — `GET {gcdrApiBaseUrl}/entities?parentId=null&deep=all&customerId=…` →
   `parseClassificationEntities()` → domains/columns → dashboard sections generated dynamically.
2. **Devices** — `GET {gcdrApiBaseUrl}/devices?customerId=…` (paginated) → classified by
   `deviceProfile`; cards render immediately at consumption `0`.
3. **Consumption enrichment** (current month by default):
   - energy/water → `GET {dataApiHost}/telemetry/customers/{ingestionId}/{domain}/devices/totals`
     (join `slaveId`+`centralId`↔`gatewayId`, value `total_value`).
   - temperature → `GET {dataApiHost}/telemetry/devices/{ingestionId}/temperature` (latest reading).
   Header date change (`myio:update-date`) refetches for the new period.
4. Per-domain summary events fire → header KPIs, telemetry-info panel, footer update.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `MyIOLibrary NOT loaded` | `dist` missing/stale | `npm run build`, hard-reload |
| Tree/devices empty, CORS errors | GCDR unreachable / no CORS for `:3339` | Start GCDR; enable CORS |
| GCDR calls 401/403 | X-API-Key lost (controller wiped `customerAttrs`) | Ensure `seedCustomerAttrs()` runs **after** `loadController()` and before `onInit()` |
| Cards consumption `0` | Data Apps auth/period/join | Check `[consumption] …` logs; `dataApiHost` must keep `/api/v1`; ingestion customer id resolved |
| Settings form empty | `settingsSchema.json` failed | Check path/log |

---

## 9. Related source

- Controller: `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` (+ `template.html`, `styles.css`, `settingsSchema.json`).
- Components rendered here: `src/components/{menu-shopping,header-shopping,telemetry-grid-shopping,telemetry-info-shopping,footer}` + `cards/main-view`.
- RFCs: RFC-0209 (slim controller), RFC-0211 (v-5.4.0 parity), RFC-0047 (GCDR entity registry).
