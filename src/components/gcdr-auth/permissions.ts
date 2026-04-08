/**
 * RFC-0199 — MyIOAuthContext: client-side GCDR RBAC permission constants.
 *
 * Action strings follow the `resource:action` convention.
 * These must match the action strings configured in GCDR policies.
 */
export const PERM = {
  // ── Alarm actions ────────────────────────────────────────────────────────
  ALARM_VIEW:        'alarm:view',
  ALARM_ACK:         'alarm:ack',
  ALARM_ESCALATE:    'alarm:escalate',
  ALARM_SNOOZE:      'alarm:snooze',
  ALARM_CLOSE:       'alarm:close',

  // ── Reports ──────────────────────────────────────────────────────────────
  REPORT_VIEW:       'report:view',
  REPORT_EXPORT:     'report:export',

  // ── Settings modal ───────────────────────────────────────────────────────
  SETTINGS_VIEW:     'settings:view',
  SETTINGS_EDIT:     'settings:edit',

  // ── User management (GCDR) ───────────────────────────────────────────────
  USER_VIEW:         'user:view',
  USER_MANAGE:       'user:manage',

  // ── Integration config ───────────────────────────────────────────────────
  INTEGRATION_VIEW:  'integration:view',
  INTEGRATION_EDIT:  'integration:edit',

  // ── Dashboard config ─────────────────────────────────────────────────────
  DASHBOARD_CONFIG:  'dashboard:configure',

  // ── Shopping / customer selector ─────────────────────────────────────────
  SHOPPING_SELECT:   'shopping:select',
} as const;

export type Permission = typeof PERM[keyof typeof PERM];
