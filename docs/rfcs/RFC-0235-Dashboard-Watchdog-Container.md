# RFC-0235 — Dashboard Watchdog Container

- **RFC number:** 0235
- **Feature name:** `dashboard-watchdog`
- **Title:** Containerized Playwright loop that periodically verifies every production dashboard is actually rendering
- **Status:** Draft (for discussion)
- **Type:** Operational tooling (standalone Node/Playwright service, not a library export)
- **Author:** (proposed)
- **Created:** 2026-09-21
- **Relates to:** the MAIN_BAS "Melicidade" incident (2026-09-21) — the
  `tenant.myio_bas_main_view_v1_0_0` widgetType was silently serving the
  Shopping-dashboard `TELEMETRY` controller instead of the real BAS
  orchestrator, leaving every visit to that dashboard stuck on "aguarde..
  carregando os dados..." forever. Nothing paged anyone; it was found by
  chance while a human happened to have the tab open.
- **Refined via:** BMAD party-mode roundtable (Winston/System Architect,
  John/Product Manager, Amelia/Senior Software Engineer), 2026-09-21 — see
  the **Decisions** section below for what was aligned and the (updated)
  **Unresolved questions** section for what remains genuinely open.

> This is a design document only. It does not implement the service. It
> specifies what "healthy" means for a dashboard, the container's shape, its
> configuration surface, and the test/rollout plan, so a follow-up
> implementation PR has a fixed contract to build against.

---

## Summary

Ship a small, standalone, containerized Node.js service —
**dashboard-watchdog** — that runs a headless [Playwright](https://playwright.dev/)
browser in a loop, on a fixed interval (`CHECK_INTERVAL_MINUTES`, default 5),
visiting every dashboard URL in a static config file, and asserting each one
actually finished loading: no permanently-stuck busy overlay, and no critical
console errors. (An earlier draft of this RFC also proposed optional
per-dashboard "smoke assertions" and best-effort network-error checking as
v1 checks — the roundtable cut smoke assertions from v1 entirely and demoted
network checking to a narrow allowlist; see **Decisions**.) A result that
flips from healthy → unhealthy (or stays unhealthy past a debounce window)
fires a notification through a pluggable channel (Slack incoming webhook
first; email/Jira later). This is not a component of
`myio-js-library` itself — it ships as its own Docker image and lives at
`tools/dashboard-watchdog/` in this repo, versioned and released
independently of the npm package.

## Motivation

Today, nobody finds out a dashboard is broken until a person opens it. The
MAIN_BAS incident this RFC is filed against is the concrete case: a
widgetType in the Widgets Library had the wrong `controllerScript` published
under it, so `window.MyIOUtils` was never populated, `onInit` threw a
`TypeError` deep in an auth call, and the widget's own `showBusy()` overlay
— "aguarde.. carregando os dados..." — never got its matching `hideBusy()`.
The dashboard has been fully blank, indefinitely, since whenever that
widgetType was last published. There is no alarm, no ticket, no log anyone
watches for this class of failure — the only reason it surfaced was that a
person happened to have the tab open and asked why it stopped loading.

This is not a one-off. The same failure shape (a widget's `onInit` throws
partway through, after `showBusy()` but before `hideBusy()`) is structurally
possible on *every* dashboard in this ecosystem — Shopping v-5.2.0, v-5.4.0,
BAS, and the OrangePi/central-facing dashboards — any time:

- a widgetType gets the wrong script published to it (human error in the
  Widgets Library UI, exactly as happened here);
- a companion orchestrator widget (`MAIN_VIEW`, `MAIN_BAS`) is missing,
  removed, or reordered on a dashboard so a child widget initializes before
  its bridge (`window.MyIOUtils`) exists;
- a backend dependency (GCDR API, ThingsBoard telemetry API, an external
  auth provider) starts timing out or returns an unexpected shape that an
  `await` chain doesn't handle;
- a library regression ships that throws during a specific `DOMAIN` or
  `deviceProfile` combination that isn't exercised by the existing Vitest
  suite (which runs in jsdom, against no live ThingsBoard, and cannot catch
  this class of bug by construction).

None of the existing automated checks in this repo can catch this class of
failure: `npm run test` is unit-level and never touches a live dashboard;
`npm run smoke-test` only checks that the built library's exports don't
throw on import; there is no CI job that opens a real, authenticated
ThingsBoard dashboard and looks at what's on screen. A watchdog that does
exactly that — periodically, unattended, against production — closes that
gap.

## Guide-level explanation

Operationally, this ships as one Docker container. An operator configures it
with a YAML file listing the dashboards to watch and a Slack webhook URL,
and runs it:

```yaml
# dashboards.yml
tenant:
  baseUrl: https://dashboard.myio-bas.com
  username: ${TB_WATCHDOG_USER}
  password: ${TB_WATCHDOG_PASSWORD}

checkIntervalMinutes: 5           # global; per-dashboard override field reserved below but inert in v1
busyOverlayTimeoutSeconds: 20      # global default; overridable per dashboard (see Decisions — needed for
                                    # dashboards where an overlay legitimately never resolves by design)
consecutiveFailuresBeforeAlert: 2  # provisional — see Decisions

dashboards:
  - name: "Shopping — Mestre Álvaro"
    url: /dashboards/all/fc6b4010-5a40-11f1-ab52-9b3e4c8bcc59
    busyOverlaySelectors:
      - "#myio-orchestrator-busy-overlay"
    criticalConsolePatterns:
      - "CRITICAL"
    # checkIntervalMinutes / busyOverlayTimeoutSeconds may be overridden here per dashboard;
    # both fields are reserved in the schema even though only the latter is used in v1.

  - name: "BAS — Melicidade"
    url: /dashboards/all/85c20590-0043-11f1-998e-25174baff087
    busyOverlaySelectors:
      - "#myio-busy-modal"
    criticalConsolePatterns:
      - "CRITICAL"
      - "Auth init FAIL"

  - name: "BAS — customer água-only (overlay eterno por design)"
    url: /dashboards/all/<...>
    busyOverlaySelectors: []   # check 1 disabled here — this customer has 0 entities on
                                # HEADER v-5.2.0 by design (known, non-bug behavior), so a
                                # generic overlay-timeout would misfire as a false positive
    criticalConsolePatterns:
      - "CRITICAL"
```

`smokeAssertions` is **not** part of the v1 schema — cut from scope entirely
(see Decisions). It may return in a later phase; when it does, it will be
introduced as a new key rather than resurrected from this example, so no
inert placeholder is kept here.

```bash
docker run -d \
  --name dashboard-watchdog \
  -e TB_WATCHDOG_USER=... \
  -e TB_WATCHDOG_PASSWORD=... \
  -e SLACK_WEBHOOK_URL=... \
  -v $(pwd)/dashboards.yml:/app/dashboards.yml:ro \
  -v dashboard-watchdog-data:/data \
  ghcr.io/gh-myio/dashboard-watchdog:latest
```

From then on, every `checkIntervalMinutes`, the container:

1. Authenticates against ThingsBoard's login API once per tick-cycle (not
   reusing a serialized browser session across ticks — see Decisions on
   Authentication), and injects the resulting token into each dashboard's
   fresh browser context before navigation.
2. Opens each configured dashboard URL in its own fresh browser tab
   (Playwright *browser context*, not a new browser process).
3. Waits for network to go idle, then polls up to that dashboard's
   `busyOverlayTimeoutSeconds` (per-dashboard override, else the global
   default) for every listed busy-overlay selector to be gone or hidden. If
   the visit instead lands back on ThingsBoard's login page, or a core API
   call 401s, that tick is classified as "watchdog session invalid" — a
   distinct outcome from a dashboard-health failure, never conflated with
   one (see Decisions).
4. Collects console messages during the whole visit and flags any matching a
   `criticalConsolePatterns` entry.
5. Records a pass/fail result (with a screenshot on failure, redacted before
   capture per configured selectors) to `/data/results/` and to an
   in-memory rolling history.
6. If a dashboard's result flips from healthy to unhealthy, or stays
   unhealthy for `consecutiveFailuresBeforeAlert` consecutive ticks, posts a
   Slack message naming the dashboard, the failing check, and a link to the
   saved failure screenshot. A dashboard flipping back to healthy posts a
   single "recovered" message — the watchdog never re-alerts on every tick
   of an already-known outage. Per the on-call runbook (see Decisions), a
   failure alert is expected to be turned into a tracked Jira `ED` ticket.

The container also exposes a tiny local HTTP server (`:8080`) with:

- `GET /healthz` — the watchdog's own liveness (for the orchestrator running
  *it* — Docker healthcheck, Kubernetes probe, etc.).
- `GET /status` — a JSON (and a bare-bones HTML) snapshot of every
  dashboard's last result, so a human can check current state without
  waiting for the next Slack alert.

## Reference-level explanation

### Why Playwright, and why one long-running container instead of a cron job per tick

Playwright is the right tool over raw CDP (the technique used ad hoc earlier
in this project to live-patch widget scripts for testing) because this
service needs the *high-level* affordances Playwright wraps CDP with:
auto-waiting, network-idle detection, structured console/request capture,
`toHaveScreenshot`-style assertions, and — critically — first-class official
Docker images (`mcr.microsoft.com/playwright:v<version>-jammy`) that already
bundle matched browser binaries, so the Dockerfile is a thin layer on top,
not a from-scratch Chromium install.

A single long-running container with an internal scheduler (versus an
external cron invoking a fresh short-lived container every tick) is the
right default because:

- Browser **launch** is the expensive part (~1–2s cold, plus the sandbox
  setup); a **context** (Playwright's isolated-session abstraction, roughly
  "incognito tab") is cheap to create and destroy per dashboard visit. A
  long-running container launches the browser once and creates/destroys a
  fresh context per dashboard per tick — no state bleeds between dashboards
  (cookies, localStorage, service workers), but there's no repeated
  multi-second browser-launch tax on every tick.
- The ThingsBoard login session can be reused across dashboards within a
  tick (and across ticks, until it expires), instead of re-authenticating
  once per dashboard per tick.
- It's simpler to reason about the debounce/alert state machine
  (`consecutiveFailuresBeforeAlert`, "already alerted, don't re-alert")
  as in-memory state in one process, rather than needing an external store
  shared between independently-scheduled invocations.

The tradeoff (a long-lived Node process that must not leak memory or leave
zombie browser contexts across weeks of uptime) is real and addressed below
under Drawbacks. Mitigation decided by the roundtable: the **browser
process** (not the container) is recycled on a fixed schedule — every 6–12h
— independent of whether a leak has actually been observed, rather than
trusting long-lived Chromium not to grow unbounded; a container-level
`restart_policy` (Docker/Kubernetes) is kept as an additional safety net on
top of that, not as the primary mitigation.

### Health model — what "the dashboard is fine" means

Each configured dashboard entry defines two independent checks, both of
which must pass for that tick to be marked healthy. (An earlier draft
included a third, optional "smoke assertions" check; the roundtable cut it
from v1 — see Decisions.)

1. **Busy-overlay resolution.** `busyOverlaySelectors` lists the known
   loading-overlay selectors for that dashboard's widget stack — e.g.
   `#myio-orchestrator-busy-overlay` (MAIN_VIEW, Shopping v-5.2.0) or
   `#myio-busy-modal` (the TELEMETRY-derived busy pattern, also seen
   misused as the de-facto MAIN_BAS overlay in the incident this RFC is
   filed against). After the page reaches network-idle, the watchdog polls
   up to that dashboard's `busyOverlayTimeoutSeconds` — a per-dashboard
   override where set, else the global default (20s) — for every listed
   selector to be either absent from the DOM or
   `display:none`/`visibility:hidden`/zero-area. Any selector still visibly
   showing at the deadline is a failure. This one check alone would have
   caught the MAIN_BAS incident. The per-dashboard override exists because
   at least one known case in this ecosystem shows a busy overlay
   indefinitely **by design, not by bug** (a water-only customer with zero
   entities on a HEADER v-5.2.0 widget) — that dashboard either needs a
   longer timeout or `busyOverlaySelectors: []` to disable this check
   entirely, or the watchdog would misfire a false positive on it every
   single tick.
2. **Critical console patterns.** Every `console.error`/`console.warn`
   message captured during the visit is matched (case-sensitive substring,
   deliberately simple — no regex DSL to design or document) against
   `criticalConsolePatterns`. This project's widgets already tag their own
   fatal conditions in a greppable way (`❌ CRITICAL:`, `Auth init FAIL`,
   `must load first`) — this check reuses those existing conventions rather
   than inventing new ones, so it's free to add to any widget going forward
   by simply keeping that logging discipline. A dashboard entry with an
   empty list disables this check (e.g. for a dashboard with known-benign
   warnings that would otherwise generate noise until cleaned up).

**Smoke assertions were cut from v1 entirely** (a per-dashboard
`{selector, rule}` content check — e.g. "this KPI card has non-empty
text" — was in the original draft). Rationale: each assertion needs an
owner to keep it in sync with layout changes that have no defined owner
today, and a stale assertion becomes a false-positive generator, which is
the fastest way to erode trust in the whole tool. The two checks above
already fully cover the incident that motivated this RFC. See Decisions and
Rationale and Alternatives.

**Network-error severity is allowlist-only, not generic 4xx/5xx.** A
network check is captured and included in every failure report, but only
gates pass/fail for a small, explicit allowlist — the ThingsBoard API host
(and the GCDR API host, where a dashboard depends on it) returning 5xx or
401/403. Everything else (third-party scripts, analytics, CDN blips) is
logged only. Gating on any 4xx/5xx would be guaranteed noise from sources
unrelated to dashboard health, and the busy-overlay and console-pattern
checks are the real front line for the failure class this RFC targets —
network checking is explicitly supplementary, not the primary defense. See
Decisions.

### Authentication

The watchdog needs a real, authenticated ThingsBoard session per tenant to
see anything past the login page. `TB_WATCHDOG_USER`/`TB_WATCHDOG_PASSWORD`
are supplied as container secrets (never in `dashboards.yml`, which may be
mounted from a less-trusted config-management path).

**Decision (superseding an earlier draft of this section):** do not rely on
a Playwright `storageState` dump surviving idle time between ticks. The
watchdog reuses the *browser process*, not a live page, between ticks — with
no client-side JS running in the background to trigger this ecosystem's
normal token-refresh flow while the watchdog is idle between checks, a
`storageState` captured once and replayed 5–15 minutes later can be stale by
the time it's used. Instead: authenticate directly against ThingsBoard's
login API once per tick-cycle, and inject the resulting token into each
fresh browser context (e.g. via `addInitScript` writing to `localStorage` —
the same place this ecosystem's own `jwt_token` lives; see
`buildAuthHeaders()` in `MENU/controller.js` for the existing read-side
pattern) before that context's first navigation. This is faster, fully
testable without a browser (it's a plain HTTP call — see Test strategy
below), and doesn't depend on ThingsBoard's login form DOM, which could
change without the watchdog's knowledge.

A dashboard visit that instead gets redirected back to the ThingsBoard login
page, or whose own API calls come back 401, must be classified as **"watchdog
session invalid"** — a distinct outcome from a dashboard-health failure.
Conflating the two would report a false "dashboard is broken" the moment the
watchdog's own credentials expire or get rotated, which is exactly the kind
of false alarm that erodes trust in the tool.

This account should be a dedicated, least-privilege ThingsBoard user
(read-only dashboard access to the tenants being watched; **not** a
tenant/customer admin). Provisioning it, and the exact login API contract
(endpoint, response shape, JWT/refresh-token TTL) needed to implement the
above, remain open — see Unresolved Questions.

### Alerting

`consecutiveFailuresBeforeAlert` (default 2) exists specifically to absorb
one-off transient blips (a slow backend response right at the check
instant) without paging on every one. State transitions, not raw ticks,
drive notifications:

- `healthy → unhealthy` (after crossing the consecutive-failure threshold):
  fire a **failure** alert once.
- `unhealthy → unhealthy`: no repeat alert (avoids the classic monitoring
  anti-pattern of re-alerting every 5 minutes for a known, already-reported
  outage).
- `unhealthy → healthy`: fire a single **recovered** alert.

The v1 notifier is a Slack incoming webhook (`SLACK_WEBHOOK_URL`) —
zero-OAuth, one HTTP POST, the lowest-friction channel to stand this up
with. The notifier is defined as a small interface
(`notify(event: WatchdogEvent): Promise<void>`) specifically so
email/PagerDuty/a Jira-ticket-via-`createJiraIssue` notifier can be added
later without touching the check/scheduling logic — see Future
Possibilities.

**Decision:** Slack is a **notification** channel, not a **tracking** one.
This team already tracks all its other work in the `ED` Jira project (see
`docs/jira/`); a Slack alert that never becomes a ticket is exactly as
unaccountable as the original incident, which nobody tracked anywhere until
a human happened to notice by chance. The expected on-call response —
turning a failure alert into a tracked `ED` ticket, manually for v1 — is
part of this RFC's rollout: it must ship as a written runbook step alongside
the container, not be left as an unstated assumption that "someone" will
remember to do it. Automating that hop (an `ED` ticket auto-opened by the
notifier on failure, auto-commented or closed on recovery) is captured under
Future Possibilities as a natural v2, not required for v1.

### Configuration surface

| Key | Scope | Default | Notes |
|---|---|---|---|
| `checkIntervalMinutes` | global | 5 | Per-dashboard `dashboards[].checkIntervalMinutes` override is reserved in the schema but **inert in v1** (YAGNI — see Decisions); parsing must accept and ignore it rather than reject it, to avoid a breaking config-format change later. |
| `busyOverlayTimeoutSeconds` | global, **overridable per dashboard** | 20 | `dashboards[].busyOverlayTimeoutSeconds` overrides the global default — needed for a dashboard where the overlay legitimately never resolves by design (see Health model). Numeric default is provisional (see Decisions). |
| `consecutiveFailuresBeforeAlert` | global | 2 | Provisional (see Decisions) — not empirically derived, to be revisited after real operational data. |
| `dashboards[].name` | per-dashboard | — | Human-readable, used in alerts. |
| `dashboards[].url` | per-dashboard | — | Path appended to `tenant.baseUrl`. |
| `dashboards[].busyOverlaySelectors` | per-dashboard | `[]` | Empty list disables check 1. |
| `dashboards[].criticalConsolePatterns` | per-dashboard | `[]` | Empty list disables check 2. |

`smokeAssertions` is not part of the v1 schema (cut from scope — see
Decisions).

### Repository placement and release

Lives at `tools/dashboard-watchdog/` in this repo: its own `package.json`
(Playwright, a YAML parser, nothing else heavyweight), its own Dockerfile,
its own version — **not** part of the `myio-js-library` npm package, not
subject to the `scripts/size-check.js` bundle-size gates (those exist for
the library's own published bundles and don't apply to a Docker service),
and not built by `npm run build`. CI builds and pushes its image
(`ghcr.io/gh-myio/dashboard-watchdog:<tag>`) on a tag or path-scoped push to
`tools/dashboard-watchdog/**`, independent of the library's own release
flow (`npm run release`).

### Test strategy

Added by the roundtable — the original draft left this unspecified, which
Amelia flagged as a hard blocker (without it, there is no clean starting
point for a first implementation PR: someone would end up trying to spin up
real Chromium inside Vitest, producing a slow, flaky suite). Three layers,
with a hard boundary between them:

1. **Unit (Vitest, no browser at all).** Every decision function is written
   to take plain, already-serialized data — never a Playwright `Page`. For
   example: `isStuck(snapshot: OverlaySnapshot, now: number, timeoutMs:
   number): boolean`, `matchesCriticalPattern(line: string, patterns:
   string[]): boolean`. The I/O that produces that data (`readOverlayState
   (page): Promise<OverlaySnapshot>`) is a separate, thin function that is
   *not* unit-tested this way. This split — decision logic vs. Playwright
   I/O — is the actual design constraint this layer imposes on the
   implementation, not just a testing nicety.
2. **Integration (Playwright, but against local static fixtures, no
   network).** `tools/dashboard-watchdog/tests/fixtures/*.html` — small,
   static pages loaded via `page.setContent()` or `file://`, each
   reproducing one known state: a permanently-stuck overlay, a console line
   matching a critical pattern, a clean healthy page. One fixture
   specifically reproduces today's actual incident (a script that never
   populates `window.MyIOUtils` and never resolves its own busy overlay) —
   this is the layer that would have caught it, and it's exercised in CI.
3. **Manual smoke (real ThingsBoard homolog, not CI).** Run once per PR that
   touches the watchdog, against a real staging dashboard — too costly and
   environment-dependent to run continuously, but necessary because layers
   1–2 cannot validate the real login contract or real DOM structure.

## Drawbacks

- **A new operational surface to run and own.** This is a long-running
  service that needs somewhere to actually run (a VM, a small Kubernetes
  deployment, a container host) — it is not "just a script," and once it
  exists, its own uptime becomes something someone is implicitly
  responsible for. A watchdog that has silently been down for a week is
  worse than no watchdog, because it creates false confidence. The
  `/healthz` endpoint and its own external monitoring (see Unresolved
  Questions) exist specifically to bound this risk, but don't eliminate it.
- **Headless-browser resource cost.** Chromium is not free — CPU/memory
  scale with dashboard count × concurrency. For a handful of dashboards on
  a 5-minute interval this is modest, but it is not free the way a simple
  HTTP-status-code health check would be, and it will not scale linearly
  forever without a concurrency cap (see Reference-level explanation's
  context-reuse design, and the concurrency limiter called out in Future
  Possibilities).
- **A watchdog account is a new, standing, credentialed identity** in every
  tenant it watches. It must be provisioned deliberately (least-privilege,
  rotated like any other service credential) rather than reusing a human's
  or an existing service's login — getting this wrong turns a monitoring
  tool into a new attack surface.
- **Alert state lives in memory only (accepted for v1).** Per-dashboard
  healthy/unhealthy state and consecutive-failure counters are not
  persisted to disk or an external store. A watchdog container restart or
  redeploy resets this state, which can produce a spurious "recovered" post
  for a dashboard that was never actually fixed, or silently swallow a
  state transition that happened during the restart window. This is a known
  v1 limitation, written down deliberately rather than glossed over — not a
  blocker, but something an operator should know before relying on the
  absence of an alert as proof of health across a watchdog redeploy.
- **False negatives are possible by construction.** The busy-overlay and
  console-pattern checks only catch failures that *this ecosystem's own
  existing conventions* already surface visibly (an overlay, a tagged
  console error). A silent failure that renders a plausible-looking but
  wrong UI (stale data, a miscalculated KPI) would pass every check this
  RFC defines. This tool catches "the page never finished loading," not
  "the page loaded something incorrect" — a narrower, but still valuable
  and currently entirely unmonitored, class of failure.

## Rationale and alternatives

- **Why not extend the existing Vitest suite instead?** Vitest runs against
  jsdom with no live ThingsBoard backend, no real widget-library
  publishing pipeline, and no real auth — it is structurally incapable of
  catching "the wrong script got published to this widgetType in
  production," which is exactly the incident motivating this RFC. A
  watchdog against live, deployed dashboards is a different test tier
  (closer to synthetic monitoring / smoke testing in production) than what
  Vitest is for, and this RFC does not propose replacing or overlapping
  with the unit-test suite.
- **Why not a full visual-regression/E2E suite (pixel-diffing every panel,
  every state, every domain) instead of this narrower health model?** That
  is a legitimate, larger investment with a different goal (catching
  *visual* or *behavioral* regressions before they ship) and a much higher
  authoring/maintenance cost (baseline screenshots per dashboard per
  domain per theme, inevitable flakiness tuning). This RFC deliberately
  scopes to the cheaper, narrower "did it finish loading and does it look
  structurally alive" question, because that is the specific, currently
  fully-unmonitored gap the motivating incident exposed. A fuller E2E suite
  is not precluded by this design and could reuse its Playwright/Docker
  foundation later (see Future Possibilities) but is out of scope here.
- **Why not simply add a global `onError` handler + a max busy-overlay
  timeout *inside* each widget itself, self-healing without an external
  watchdog?** That is a good, complementary defensive-coding improvement
  (a widget should probably never show a busy overlay with no timeout
  fallback at all — `showBusy()`'s existing `timeoutMs` parameter in
  TELEMETRY is unused in most call sites, per the code read while
  diagnosing the incident) and is worth pursuing independently. It does not
  replace an external watchdog, though: it cannot catch "the wrong script
  was published to this widgetType," "a companion orchestrator widget is
  missing from this dashboard," or any failure where the code that would
  need to self-heal never gets a chance to run at all.
- **Why Slack and not email/PagerDuty for v1?** Lowest setup friction (one
  webhook URL, no mail server or paid on-call tooling dependency to stand
  up this RFC's v1), and this team's existing tool access already includes
  Slack MCP integration for this account. The notifier interface is
  designed so this is not a one-way door.

## Prior art

- This project's own `docs/jira/` cockpit is a related but distinct
  pattern: a periodically-refreshed, file-based snapshot of *ticket* state
  for humans to read. This RFC is the same "periodic synthetic check,
  human-readable status, alert on change" shape, applied to *dashboard
  health* instead of *ticket backlog*.
- The ad hoc CDP-based live-injection technique used earlier in this
  project (connecting to a Chrome debug port, intercepting
  `/api/widgetType` responses via the `Fetch` domain to test local widget
  code against a live dashboard without publishing) is the direct ancestor
  of this RFC's approach to driving a real, authenticated ThingsBoard
  session programmatically — this RFC generalizes "drive a real dashboard
  headlessly and inspect what happened" from a one-off manual debugging
  script into a supported, scheduled, alerting service.
- Synthetic monitoring / uptime-check services (Pingdom, Checkly,
  Playwright-based synthetic monitors) are the general industry pattern
  this RFC is a narrow, self-hosted instance of, scoped specifically to
  this ecosystem's known failure shape (stuck busy overlays from a broken
  widget-init chain) rather than generic HTTP-status uptime checking, which
  would not have caught the motivating incident (the page returned 200 and
  loaded successfully — the *content* never did).

## Decisions

Reached in a BMAD party-mode roundtable (Winston/System Architect,
John/Product Manager, Amelia/Senior Software Engineer), 2026-09-21, called
specifically to work through this RFC's original Unresolved Questions. Each
item below states the decision, not just the debate; the questions that
remain genuinely open — because they need input from someone outside this
roundtable (ops, security) or real operational data that doesn't exist yet
— are in the (updated) Unresolved Questions section that follows.

1. **Repo placement confirmed as drafted.** `tools/dashboard-watchdog/`,
   own Dockerfile/release, outside the npm package build and
   `scripts/size-check.js` gates. (Winston: uncontested — isolates blast
   radius between the library's release cadence and the watchdog's.)

2. **v1 scope is narrowed to two checks: busy-overlay timeout and critical
   console patterns. Smoke assertions are cut from v1 entirely.** (John:
   the incident that motivated this RFC needed exactly these two checks to
   catch; a content-assertion check adds an ongoing per-dashboard
   maintenance burden with no defined owner, and a stale assertion becomes
   a false-positive generator — the fastest way to erode trust in the tool.
   Not contested by Winston or Amelia.) The config schema does not carry an
   inert `smokeAssertions` placeholder — it will be introduced as a new key
   if and when this is revisited, per a separately-scoped follow-up (see
   Future Possibilities), not resurrected from the current schema.

3. **Runtime shape: one long-running container, one Playwright browser
   process reused across ticks, a fresh browser context per dashboard
   visit — with the browser *process* (not the container) recycled every
   6–12h on a fixed schedule**, regardless of whether a leak has actually
   been observed, plus a container-level `restart_policy` as an additional
   (not primary) safety net. (Winston: agrees with the long-running design
   in the original draft, but treats "Playwright doesn't leak memory over
   long uptime" as an assumption not to be trusted.)

4. **Authentication: no cross-tick `storageState` reuse.** Authenticate via
   ThingsBoard's login API once per tick-cycle and inject the token into
   each fresh context before navigation, rather than serializing and
   replaying browser session state after idle time with no background JS
   to refresh it. A dashboard visit that lands back on the login page, or
   whose API calls 401, is classified as **"watchdog session invalid"** — a
   distinct outcome, never conflated with a dashboard-health failure.
   (Amelia: identified the storageState-staleness gap and proposed the
   fix; Winston independently raised the same session-vs-dashboard-failure
   distinction from the reliability side — convergent, not contested.)
   Superseded the original draft's "reuse storageState across ticks"
   design.

5. **Network-error severity: allowlist-only, never generic 4xx/5xx.** Only
   the ThingsBoard API host (and GCDR API host, where relevant) returning
   5xx or 401/403 gates pass/fail; everything else is logged, not failed.
   (Winston: gating on any 4xx/5xx is guaranteed noise — third-party
   scripts, analytics, CDN blips — that would produce exactly the alert
   fatigue this RFC exists to prevent; the busy-overlay and console checks
   are the real front line, network checking is supplementary. Uncontested.)

6. **`busyOverlayTimeoutSeconds` must be overridable per dashboard, not
   only global.** At least one known, non-bug case in this ecosystem shows
   a busy overlay indefinitely by design (a water-only customer with zero
   entities on a HEADER v-5.2.0 widget) — a purely global timeout would
   misfire a false positive on it every tick. (Amelia, independently
   corroborated by the existing project knowledge cited in her review.)
   This is a different axis from per-dashboard **check interval**, which
   stays deferred (next item) — the two should not be conflated.

7. **Per-dashboard `checkIntervalMinutes` override: still YAGNI for v1**,
   but the schema reserves the field now (parsed, ignored) specifically to
   avoid a breaking config-format change if this is revisited later.
   (Winston: cheap to reserve now, expensive to migrate later; uncontested.)

8. **`consecutiveFailuresBeforeAlert` and the overlay-timeout numeric
   defaults are provisional, not empirically grounded — say so explicitly
   in config/docs rather than presenting them as validated.** (John: the
   only real reference point this team has is how long the actual MAIN_BAS
   overlay sat stuck before a human noticed by chance, and nobody currently
   knows that number; revisit both after roughly two weeks of real
   production false-positive/negative data.)

9. **Auto-remediation (auto-clicking "Limpar" on a known failure
   signature) is explicitly rejected for v1 — not deferred with hooks, just
   not built.** (Winston: technical risk — the button's full side effects
   on live dashboard state aren't mapped, so scripting it in production
   risks the watchdog becoming its own incident source; product risk — the
   motivating incident was a deploy-process bug that "Limpar" doesn't fix,
   and silent self-healing would hide the next occurrence until a customer
   complains. Uncontested by John or Amelia.) If ever revisited: (a) an
   alert still fires even on a "successful" auto-remediation, tagged
   `auto-recovered`, never folded into plain `healthy`; (b) a circuit
   breaker pages a human after N consecutive auto-remediations on the same
   dashboard; (c) explicit product-owner sign-off per affected dashboard
   before enabling it.

10. **Ownership, named by role:**
    - Provisioning the watchdog's ThingsBoard service account
      (least-privilege, view-only) falls to whoever already provisions
      service accounts for this project's other integrations (GCDR client,
      MQTT Sync) — i.e., whoever holds ThingsBoard tenant-admin today.
      (John: explicitly do **not** mark this "resolved" if that isn't a
      formally assigned role today — record it as an organizational gap to
      close, not a technical one to solve.)
    - **Watchdog-of-the-watchdog is promoted from an open question to a v1
      requirement**, not a follow-up: `/healthz` must be wired to an
      external uptime checker, whose alert routes to a named
      on-call-responsible role. (John: an unwatched watchdog reproduces the
      exact failure mode this RFC exists to close — a critical failure
      found only by chance. Winston agrees mechanism-wise — `/healthz`
      already exists for exactly this, plug-and-play with whatever uptime
      tool the org already runs.) The *tool choice* remains an open ops
      decision (see Unresolved Questions); the *requirement* itself is
      decided.

11. **Alerting process: Slack is a notification channel, not a tracking
    one.** A failure alert is expected to become a tracked Jira `ED` ticket
    — manually, for v1 — documented as a written runbook step shipped
    alongside the container, not left as an unstated assumption. (John: an
    alert that isn't tracked anywhere durable reproduces the original
    incident's "rotted in scrollback until luck intervened" failure mode.)

12. **Screenshot/trace handling — mechanism decided, exact retention
    window left open.** Local-only retention on the container's mounted
    volume, rotated by age; the raw image is **never** posted inline to
    Slack (a link or text description only) until a security review signs
    off; redaction happens proactively, *before* capture — a `page.
    addStyleTag`-injected CSS rule blurs (not crops, to keep layout context
    for debugging) elements matching a per-dashboard configurable selector
    list (`config/redaction-selectors.json`, since DOM structure differs
    across Shopping v-5.2.0/v-5.4.0/BAS); filenames carry no PII
    (`{dashboardId}_{timestamp}_{checkType}.png`). (Amelia proposed 7 days'
    retention, arguing the real use case — "saw the Slack alert yesterday,
    want to see the screenshot now" — needs that window, and that the
    number is a one-constant change if wrong; Winston independently
    proposed a more conservative 24–48h pending an actual security
    sign-off. The roundtable did not resolve this specific number — see
    Unresolved Questions — but fully agreed on the mechanism around it.)

13. **Test strategy — added net-new** (the original draft didn't specify
    one; Amelia flagged this as a hard implementation blocker). Three
    layers: pure-logic unit tests decoupled from any Playwright `Page`;
    integration tests against static local HTML fixtures (including one
    that reproduces today's actual incident); manual smoke against a real
    homolog ThingsBoard, once per PR, outside CI. See the new Test strategy
    subsection above.

14. **Known, accepted v1 limitation, written down rather than glossed
    over:** per-dashboard alert state lives in memory only; a watchdog
    restart/redeploy can produce a spurious "recovered" post or lose a
    state transition mid-restart. Not persisted to disk/an external store
    in v1. (Winston.)

## Unresolved questions

- **Real minimum ThingsBoard permission set for the service account, and
  whether "whoever holds TB admin" is a formally defined role today or an
  ad hoc arrangement.** The design supports a narrow, view-only request
  (Decision 10); confirming the exact minimum and closing the
  role-definition gap if one exists needs ops/security input this
  roundtable can't supply on its own.
- **Choice of external uptime-check tool** for the now-decided
  watchdog-of-the-watchdog requirement (Decision 10) — e.g. UptimeRobot,
  healthchecks.io, or an existing internal tool — and the specific named
  on-call-responsible recipient for its alert. An ops decision, not
  resolved here.
- **Exact ThingsBoard service-account login API contract** needed to
  implement Decision 4: endpoint, request/response shape, and JWT/
  refresh-token TTL. Blocks writing the authentication layer; needs
  confirmation from whoever owns ThingsBoard admin/API knowledge on this
  project.
- **Source of the dashboard list to monitor**: committed to a static config
  file (as drafted throughout this RFC) versus pulled dynamically from a
  ThingsBoard API (e.g. `/api/tenant/dashboards`). Changes the shape of the
  main loop; not decided.
- **Ownership and format of the "known critical console patterns" list** —
  who maintains it, where it lives, exact-string match (as drafted) versus
  a regex DSL.
- **Slack payload format specifics** — target channel(s), and whether any
  re-alert/repost behavior beyond the already-decided
  healthy↔unhealthy-transition debounce (see Alerting) is needed.
- **Screenshot retention window: 24–48h (Winston's conservative default) or
  7 days (Amelia's real-use-case argument)** — see Decision 12. The
  roundtable agreed on everything around this number except the number
  itself; needs a security/ops call.
- **The actual numeric values of `consecutiveFailuresBeforeAlert` and the
  overlay-timeout defaults** (Decision 8 established that they're
  provisional and must be revisited — it did not, and could not, establish
  what the right numbers are without real operational data).

## Future possibilities

- **Additional notifier backends** behind the same `notify()` interface:
  email, PagerDuty, or a `createJiraIssue`-backed notifier that opens (and,
  on recovery, auto-comments/closes) a ticket in the same `ED` Jira project
  already used for this team's other tracked work, using the exact
  create/edit patterns already established in `docs/jira/README.md`'s
  workflow.
- **A concurrency limiter** (e.g. `p-limit`) once the dashboard count grows
  enough that visiting all of them within one tick's browser-context budget
  needs bounding, rather than firing every dashboard's context open
  simultaneously.
- **Growing smoke assertions into a real visual-regression layer** (see
  Rationale and Alternatives) reusing this same container's Playwright/
  Docker foundation, as a deliberate, separately-scoped follow-up RFC
  rather than scope creep on this one.
- **Feeding results into a shared status page** (a small Artifact-hosted
  or GCDR-backed dashboard showing every watched dashboard's current
  health and recent history), instead of `/status` being the only human
  -facing view.
- **Self-healing hooks** — e.g. on detecting the exact "busy overlay stuck,
  console shows `MyIOUtils bridge unavailable`" signature specifically,
  automatically triggering the dashboard's own "Limpar" (clear cache)
  action once before alerting, in case the failure is a stale
  client-side-cached `widgetType` rather than a genuinely broken published
  script. **Explicitly rejected for v1 by the roundtable** — not merely
  deferred, no design hooks or abstractions for it are built now. Two
  reasons: (a) technical — the real effect of that button on live dashboard
  state hasn't been fully mapped; scripting a click on production without
  understanding every side effect risks the watchdog itself becoming a new
  incident source; (b) product — the incident that motivated this RFC was a
  wrong script published to a widgetType, a deploy-process bug that
  "Limpar" does not fix; a watchdog that silently self-heals and moves on
  would mean the next occurrence of the same class of bug goes undetected
  until a customer complains, which is worse than today's status quo. If
  ever revisited, three non-negotiable preconditions apply: (1) an alert
  still fires even when auto-remediation "succeeds," with a distinct
  `auto-recovered` status that is never folded into plain `healthy`; (2) a
  circuit breaker — N consecutive auto-remediations on the same dashboard
  escalates to a human page instead of looping silently forever; (3)
  explicit sign-off from the product owner of the affected dashboard before
  enabling it per customer.
