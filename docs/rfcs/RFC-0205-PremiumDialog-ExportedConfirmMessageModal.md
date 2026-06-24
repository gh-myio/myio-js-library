# RFC-0205: Premium Dialog — Exported Confirm/Message Modal with Parameterizable Buttons

- Feature Name: `premium_dialog`
- Start Date: 2026-06-12
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

Add a small, public, promise-based dialog primitive to `myio-js-library`:
`openConfirmDialog(params)` (and a thin `openMessageDialog(params)` convenience)
rendered in the **premium-modals visual style** (Nunito font, MyIO palette,
light/dark themes), with a fully **parameterizable button list**. The call
resolves with the `value` of the button the user picked:

```ts
const choice = await MyIOLibrary.openConfirmDialog({
  title: 'Excluir anotação',
  message: 'Esta ação não pode ser desfeita. Deseja continuar?',
  buttons: [
    { label: 'Cancelar', variant: 'secondary', value: 'cancel' },
    { label: 'Excluir', variant: 'danger', value: 'confirm' },
  ],
  theme: 'light',
});
if (choice === 'confirm') { /* ... */ }
```

This RFC specifies the API and behavior only. No implementation is included.

## Motivation

The library currently has **no exported, generic confirmation/message modal**.
What exists today:

| Where | Status | Limitation |
| --- | --- | --- |
| `scheduling-shared/view-helpers.ts` → exported as `schedShowConfirmModal` / `schedShowNotificationModal` (`src/index.ts:1442-1443`) | public | Hardcoded "Cancelar"/"Confirmar" buttons, scheduling CSS prefix, requires `injectSchedulingSharedStyles()`, not premium-styled |
| `premium-modals/alarm-bundle-map/openAlarmBundleMapModal.ts:400` `showConfirmModal` | private | Premium look, but inaccessible outside the component |
| `fancoil-remote/FancoilRemoteController.ts:177` `showConfirmModal` | private | Component-local duplicate |
| `solenoid-control/SolenoidControlController.ts:113` `showConfirmModal` | private | Component-local duplicate |
| `MyIOToast` (`src/index.ts:306`) | public | Toast, not a blocking dialog — cannot collect a decision |

That is **four parallel implementations** of the same UX primitive, three of
them private, none with parameterizable buttons. Every new feature that needs
"are you sure?" either copies the pattern again (drift in style, behavior,
accessibility, escaping) or abuses `window.confirm`, which breaks the premium
look and is blocked in some ThingsBoard embedding contexts.

Consolidating into one exported primitive follows the same single-source
strategy the library already applied to device icons (RFC-0200) and device
type config (RFC-0202).

## Guide-level explanation

### Confirm dialog

`openConfirmDialog(params): Promise<string | null>` opens a centered modal
over a dimmed backdrop and returns a promise:

- Resolves with the `value` of the clicked button.
- Resolves with `null` when dismissed without a choice (Esc key, backdrop
  click, or the optional × close button) — never rejects for user actions.

```ts
import { openConfirmDialog } from 'myio-js-library';

const result = await openConfirmDialog({
  title: 'Aplicar para todos?',
  message: 'O setpoint será enviado para os 12 fancoils do andar.',
  buttons: [
    { label: 'Somente este', variant: 'secondary', value: 'one' },
    { label: 'Aplicar a todos', variant: 'primary', value: 'all' },
  ],
});
```

Buttons render in array order (left → right). Any number of buttons is
allowed; two or three is the expected use. Variants map to the premium-modals
palette: `primary` (brand purple), `secondary` (neutral/outline), `danger`
(destructive red), `success` (green).

### Message dialog

`openMessageDialog(params): Promise<void>` is sugar for the single-button
case (an "OK"/"Fechar" acknowledgment), mirroring what
`schedShowNotificationModal` does today but premium-styled and not
auto-injected with scheduling CSS. An optional `severity`
(`info | success | warning | error`) selects the title icon/accent.

### Theming and typography

- `theme: 'light' | 'dark'` (default `'light'`), consistent with the
  `themeMode` convention used across premium-modals.
- Typography is **Nunito**, the standard premium-modals font. The dialog
  reuses the same font-loading approach as the other premium modals (no new
  font pipeline).

### Where it lives

`src/components/premium-modals/dialog/` alongside the other premium modals,
exported from `src/index.ts` and therefore available on
`window.MyIOLibrary.openConfirmDialog` in ThingsBoard widgets.

## Reference-level explanation

### Public API

```ts
export type DialogButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

export interface DialogButton {
  /** Visible label. Rendered as text (HTML-escaped). */
  label: string;
  /** Visual style. Default: 'secondary'. */
  variant?: DialogButtonVariant;
  /** Value the promise resolves with when this button is clicked. */
  value: string;
  /** Receives initial keyboard focus and responds to Enter. At most one. */
  autoFocus?: boolean;
}

export interface ConfirmDialogParams {
  title: string;
  /** Plain text by default; rendered HTML-escaped. */
  message: string;
  buttons: DialogButton[];
  /** Default: 'light'. */
  theme?: 'light' | 'dark';
  /**
   * Dismissal policy. When true (default), Esc/backdrop/× resolve with null.
   * When false, the user must pick a button (no ×, Esc/backdrop ignored).
   */
  dismissible?: boolean;
  /** Width override, e.g. 420 or '32rem'. Default: 420px, max 90vw. */
  width?: number | string;
  /** Mount target. Default: document.body. Required for shadow-DOM hosts. */
  container?: HTMLElement;
}

export interface MessageDialogParams {
  title?: string;            // default derived from severity ('Sucesso', 'Erro', ...)
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error'; // default 'info'
  buttonLabel?: string;      // default 'OK'
  theme?: 'light' | 'dark';
  autoCloseMs?: number;      // 0/undefined = no auto-close
  container?: HTMLElement;
}

export function openConfirmDialog(params: ConfirmDialogParams): Promise<string | null>;
export function openMessageDialog(params: MessageDialogParams): Promise<void>;
```

`src/index.ts` exports: `openConfirmDialog`, `openMessageDialog`, and the
types `ConfirmDialogParams`, `MessageDialogParams`, `DialogButton`,
`DialogButtonVariant`.

### Behavior contract

1. **Promise semantics.** Exactly one resolution per call. Button click →
   `value`; dismissal → `null` (confirm) / resolve (message). The promise
   never rejects from user interaction; programmer errors (e.g. empty
   `buttons`) throw synchronously.
2. **DOM lifecycle.** The overlay is appended to `params.container ??
   document.body` and fully removed on close. No singleton state; concurrent
   dialogs stack with incrementing z-index above the premium-modals baseline.
3. **Event binding inside shadow DOM.** All lookups use the dialog's own root
   element (`root.querySelector`), never `document.getElementById` — the known
   premium-modals shadow-DOM pitfall (see CLAUDE.md "Shadow DOM Button
   Binding").
4. **Keyboard.** `Esc` dismisses when `dismissible`. `Tab` is trapped inside
   the dialog. `Enter` activates the `autoFocus` button when one is declared.
5. **Accessibility.** `role="dialog"`, `aria-modal="true"`,
   `aria-labelledby` → title, `aria-describedby` → message. Focus returns to
   the previously focused element on close.
6. **Escaping.** `title`, `message` and button labels are HTML-escaped.
   (A `messageHtml` opt-in is listed under Future possibilities, not in v1.)
7. **Styles.** CSS is injected once per page under a `myio-dialog` prefix,
   scoped so it cannot leak into host-page elements (no bare element or
   generic class selectors — lesson from the `.card-checkbox` global-leak bug
   found in MAIN_BAS review). Nunito loaded the same way other premium modals
   load it; if the font fails to load, system fallback applies silently.
8. **ThingsBoard.** No dependency on widget context (`self.ctx`); usable from
   any controller via `window.MyIOLibrary`.

### Migration (follow-up work, not part of this RFC's deliverable)

Once shipped, the four existing implementations become consumers:

| Call site | Replacement |
| --- | --- |
| `alarm-bundle-map` private `showConfirmModal` | `openConfirmDialog` (danger variant) |
| `fancoil-remote` private `showConfirmModal` | `openConfirmDialog` |
| `solenoid-control` private `showConfirmModal` | `openConfirmDialog` |
| `scheduling-shared` `showConfirmModal` / `showNotificationModal` | delegate internally; keep exports as deprecated aliases for one minor cycle |

Each migration is an independent, low-risk PR; none blocks the primitive.

### Size budget

The component must respect the enforced bundle limits (ESM/CJS ≤ 50 KB, UMD
≤ 60 KB, min ≤ 25 KB). Expected cost is ~2-3 KB minified (markup template +
scoped CSS + focus trap); no new dependencies are allowed.

## Drawbacks

- One more modal system in a library that already has several bespoke modal
  shells (premium-modals, scheduling, alarm panel). Until migrations land,
  this is a fifth implementation, not a consolidation.
- A generic primitive invites scope creep (forms, inputs, async buttons);
  guarding the API surface requires discipline in review.
- Promise-resolving-`null` on dismissal is a convention callers must learn
  (vs. a `{ dismissed, value }` object).

## Rationale and alternatives

- **Why promise-based instead of callback params?** Matches how every current
  private implementation is already consumed (`const ok = await
  showConfirmModal(...)`) and composes naturally with controller `async`
  flows.
- **Why `value: string` instead of generic `<T>`?** Keeps the UMD/window
  consumption story trivial (ThingsBoard controllers are plain JS). A future
  generic overload remains possible without breaking changes.
- **Why resolve `null` instead of rejecting on dismissal?** Rejection forces
  try/catch at every call site for a non-exceptional outcome; `null` keeps
  the happy path linear. Alternative `{ dismissed: boolean; value?: string }`
  was considered and rejected as heavier for the common two-button case.
- **Why not extend `schedShowConfirmModal`?** Its CSS prefix, style injection
  contract and exported signature are scheduling-specific; retrofitting
  parameterizable buttons and premium styling there would break its existing
  consumers' look or fork its behavior anyway.
- **Why not adopt a third-party dialog lib?** Bundle budget is tight
  (≤ 25 KB min total) and the premium visual identity (Nunito, MyIO palette)
  would still require a full restyle.

## Prior art

- The four in-repo implementations listed in Motivation define the de-facto
  behavior (overlay + backdrop + 2 buttons + promise) this RFC standardizes.
- RFC-0200 (deviceIcons) and RFC-0202 (deviceTypeConfig): consolidation of
  duplicated in-repo primitives into one exported source of truth.
- Native `<dialog>`/`window.confirm`: rejected for styling and ThingsBoard
  embedding constraints, but the keyboard/focus semantics mirror native
  `<dialog>` behavior intentionally.
- Web ecosystem analogues (`sweetalert2`, MUI `Dialog`, Ant `Modal.confirm`)
  validate the `{ title, message, buttons[] } → promise` shape.

## Unresolved questions

- Should v1 ship a `messageHtml` (trusted HTML) escape hatch, or is escaped
  text + `\n` → `<br>` enough for current consumers?
- Stacking policy when a dialog opens another dialog (queue vs. stack) — v1
  proposes simple stacking; confirm with the first real nested use case.
- Should `openMessageDialog` auto-close (parity with
  `schedShowNotificationModal`'s 6 s default) or default to explicit
  acknowledgment? v1 proposes **no auto-close** unless `autoCloseMs` is set.
- Exact Nunito loading mechanism in widgets where no premium modal has loaded
  the font yet (inherit from `premium-modals` shared loader vs. local
  `@font-face`).

## Future possibilities

- `messageHtml` / slot for custom body content (e.g. a checkbox "don't ask
  again").
- Input dialogs (`openPromptDialog`) reusing the same shell.
- Async button actions: `onClick: () => Promise<void>` with built-in spinner
  and double-click guard.
- `danger` confirmation pattern with type-to-confirm (GitHub-style) for
  destructive bulk operations.
- Generic `openConfirmDialog<T extends string>` typing for stricter consumer
  unions.
- Adoption inside AlarmDetailsModal batch actions and HeaderAnnotationsPanel
  archive/delete flows once migrated.
