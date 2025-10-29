RFC-0057: Home “Welcome LV” Widget with Brand Palette, User Menu, and Shopping Shortcuts

Status: Draft

Authors: MYIO Platform Team

Date: 2025-10-29

Target: main-dashboard-shopping v-5.2.0

Owners: Frontend (ThingsBoard Widgets) + Library (myio-js-library-PROD)

Summary

Create a new Last Value–type widget (“Welcome LV”) for the Home dashboard that:

Replicates the current welcome hero (title, description, primary CTA ACESSAR) and keeps the existing widget intact.

Adds a horizontal row of shortcut cards that navigate to other dashboards (one card per shopping).

Displays the logged user’s name, email, and a Logout action, reusing the logic from the existing MENU widget in the library.

Is brand-aware: reads a logo and color palette from Customer SERVER_SCOPE attributes, with fallback to MYIO default palette and logo.

Is packaged as a ThingsBoard “Last Value” widget for easy drop-in (no heavy datasource requirements).

Motivation

We already have a visually strong Home hero, but we need direct shortcuts to specific shopping dashboards and to surface user session info (name/email/logout).

Partner projects (e.g., custom corporate colors/logos) require a first-class theming mechanism controlled at Customer level.

Using a Last Value widget simplifies installation and avoids breaking current dashboards.

Guide-Level Explanation
What users will see

A hero section (logo + headline + description + ACESSAR CTA).

A user strip (user name, email, Logout) aligned to the right/top of the hero.

A scrollable horizontal row of cards (one per shopping). Clicking a card navigates to the shopping’s dedicated dashboard.

The entire widget respects a brand palette (colors/gradients/ink) and logo. If no brand is configured on the Customer, it falls back to MYIO palette and logo.

Actions / Navigation

Primary CTA (“ACESSAR”): default action stays Navigate → New dashboard state → main (configurable).

Shopping cards: each card performs Navigate → Other dashboard using the configured dashboardId.

Where configuration lives

Customer (SERVER_SCOPE) attributes provide:

home.brand.logoUrl

home.brand.palette (primary, secondary, gradientStart, gradientEnd, ink, muted)

home.cards (array with title, subtitle, dashboardId, optional bgImageUrl/iconUrl)

home.actions.primaryState (default "main")

home.showUserMenu (default true)

If absent, the widget uses MYIO defaults (current hero visuals and MYIO purple palette).

Reference-Level Explanation
File Locations (proposed)
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\
  src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\
    HOME\
      WelcomeLV\
        index.html
        styles.css
        controller.js
        schema.json
    MENU\  (existing; will be referenced)


The MENU widget already exposes logic to get user info and logout. We’ll import or replicate minimal parts as library helpers to avoid cross-widget coupling.

Attribute Schema (Customer SERVER_SCOPE)
{
  "home.brand.logoUrl": "https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG",
  "home.brand.palette": {
    "primary": "#7A2FF7",
    "secondary": "#5A1FD1",
    "gradientStart": "rgba(10,18,44,0.55)",
    "gradientEnd": "rgba(10,18,44,0.15)",
    "ink": "#F5F7FA",
    "muted": "#B8C2D8"
  },
  "home.cards": [
    {
      "title": "Campinas Shopping",
      "subtitle": "Energia & Água",
      "dashboardId": "7a9e2b50-1111-2222-3333-444444444444",
      "bgImageUrl": "https://.../campinas.jpg"
    },
    {
      "title": "Mestre Álvaro",
      "subtitle": "Operações",
      "dashboardId": "1b2c3d4e-aaaa-bbbb-cccc-dddddddddddd",
      "bgImageUrl": "https://.../mestre.jpg"
    }
  ],
  "home.actions.primaryState": "main",
  "home.showUserMenu": true
}


Partners can override the palette with their corporate colors (e.g., Sá Cavalcante greens). If home.brand.palette is absent, fallback to the MYIO palette currently used by the hero.

Widget Type & Data

Type: Last value (ThingsBoard)

Datasource: optional; widget does not require specific keys. We use LV type purely for convenience and to fit the current dashboard’s widget grid rules.

Actions Mapping

ACESSAR → handleNavigateState(ctx, getAttr('home.actions.primaryState', 'main'))

Shopping Card Click → handleNavigateDashboard(ctx, card.dashboardId)

Internally leverage existing library helpers for navigation if available (e.g., handleActionDashboard already used elsewhere).

User Menu Integration

Reference the MENU widget for methods:

C:\Projetos\GitHub\myio\myio-js-library-PROD.git\
  src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU


Use/port a small helper to obtain current user display name and email from TB context/auth.

Wire Logout to the same library method used in MENU (do not duplicate auth code; call the existing logout() in the library if exported; otherwise export a tiny wrapper).

Styling (tokens)

Expose CSS variables (with Customer overrides):

:root {
  --ink: var(--home-ink, #F5F7FA);
  --muted: var(--home-muted, #B8C2D8);
  --primary: var(--home-primary, #7A2FF7);
  --secondary: var(--home-secondary, #5A1FD1);
  --grad-start: var(--home-grad-start, rgba(10,18,44,0.55));
  --grad-end: var(--home-grad-end, rgba(10,18,44,0.15));
}


Background can default to:

{
  "backgroundImage": "linear-gradient(120deg, var(--grad-start), var(--grad-end)), url(https://dashboard.myio-bas.com/api/images/public/wntqPf1KcpLX2l182DY86Y4p8pa3bj6F)",
  "backgroundSize": "cover",
  "backgroundPosition": "center",
  "backgroundRepeat": "no-repeat",
  "border": "none"
}

Accessibility & Responsiveness

Keep current hero layout (grid; stacks on ≤1024px).

Shortcut cards use horizontal scroll on small screens and wrap on wide screens.

Buttons have focus styles; text maintains contrast against background (respect --ink).

Logging

Use consistent, prefixed logs:

[WelcomeLV] init…
[WelcomeLV] palette resolved {…}
[WelcomeLV] user {name, email}
[WelcomeLV] cards n=4
[WelcomeLV] click CTA → state=main
[WelcomeLV] click card "Campinas Shopping" → dashboardId=…

Backward Compatibility

The existing welcome HTML widget remains unchanged.

The new Welcome LV is an additional widget and can be placed on Home replacing or coexisting with the old one.

If Customer attributes are not present, the widget falls back to MYIO defaults.

Drawbacks

Slight duplication of hero visuals until the old widget is removed.

Brand attributes require Customer write access (operational coordination).

Alternatives Considered

Embedding shortcuts into the old widget (rejected to avoid regressions).

Using a Timeseries widget (unnecessary complexity).

Security Considerations

Logout action must re-use the trusted method from the MENU widget/library.

Only read Customer SERVER_SCOPE attributes (no secrets stored here).

Success Metrics

Shortcuts row renders with the correct cards for at least 3 partner shoppings.

Brand palette and logo override correctly via Customer attributes.

User strip shows accurate name/email and working Logout.

Zero regressions on navigation: ACESSAR → main; cards → target dashboards.

Testing

Unit (library helpers): palette resolver, attribute parsing, navigation helpers.

Widget manual tests:

With and without brand attributes.

With 0, 1, N cards.

Logout flow.

Responsive breakpoints (≤560px, ≤1024px).

Rollout Plan

Implement in myio-js-library-PROD under WIDGET\HOME\WelcomeLV.

Publish library build; import widget into ThingsBoard resources.

Add Customer attributes for a pilot Customer.

Place the widget on Home next to the current one; validate.

Optionally remove the old widget after acceptance.

Code-Assist Prompt (copy/paste)

Goal: Implement a new ThingsBoard Last Value widget “WelcomeLV” as described in RFC-0051.
Repo: myio-js-library-PROD
Base path: src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HOME/WelcomeLV

Do the following:

Create files

index.html: hero layout, user strip, CTA button, horizontal cards container.

styles.css: tokens for palette, responsive grid, card row.

controller.js:

Read Customer attributes listed in RFC (home.brand.*, home.cards, home.actions.primaryState, home.showUserMenu).

Resolve palette with fallback to MYIO defaults.

Render user info (name/email) and Logout by reusing helpers from WIDGET\MENU (export or lightweight wrapper).

Wire ACESSAR to navigate to dashboard state from home.actions.primaryState (default main).

Wire cards to handleActionDashboard(ctx, dashboardId).

Add detailed [WelcomeLV] logs as in RFC.

schema.json: minimal widget config so it registers as Last Value.

Styling & visuals

Use CSS variables: --ink, --muted, --primary, --secondary, --grad-start, --grad-end.

Background: gradient over image (see RFC).

Buttons: keep MYIO look; respect palette overrides.

Data & safety

Widget must render with zero attributes (fallback palette + logo).

If home.cards is empty/invalid, hide the row gracefully.

Examples

Include an example Customer attribute JSON in the README section inside controller.js comment header.

Acceptance criteria

CTA navigates to main by default; can be changed via attribute.

Cards navigate to the provided dashboardIds.

User strip shows name/email and logs out via same mechanism as MENU.

Future Work

Optional “Saiba mais” to open a documentation modal.

Server-driven feature flags (home.flags.*) for hiding sections.

Telemetry-driven highlights on cards (e.g., alert badges) once needed.