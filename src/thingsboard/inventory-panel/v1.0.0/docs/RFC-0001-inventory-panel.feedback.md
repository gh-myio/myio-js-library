# Feedback: RFC-0001 Inventory Panel

## Overall
The RFC aligns with the requested scope (device inventory + alarms dashboard) and the `alarm-panel-setup` inspiration. Below are concrete gaps to close before implementation.

## Required Clarifications
1. **"Products" definition**: confirm whether "products" means devices, assets, or device profiles.
2. **Alarm time window**: default scope (today, last 24h, last 7d, custom)?
3. **Alarm filtering**: tenant-wide totals vs filtered by selected customer (or by devices shown in the Devices tab).
4. **Active status**: confirm if `device.active === true` or a custom attribute/tag.
5. **Permissions**: who can see alarms and export data (tenant admin vs customer user)?

## Data & API Considerations
1. **Alarm volume**: define pagination strategy and max records for stats.
2. **Rate limits**: clarify refresh interval defaults and minimums.
3. **Caching**: whether to cache device/profile/customer lookups in memory.

## UI/UX Notes
1. **Tree depth**: allow only 2 levels (Customer → Device) or deeper (Customer → Type → Device)?
2. **Search behavior**: global search across all groups or within expanded groups only?
3. **Empty states**: explicit UI for no devices / no alarms / API errors.

## Export
1. **Export scope**: export current tab only or both tabs?
2. **CSV/PDF formats**: define columns and summary sections.

## Suggested Additions to RFC
1. Add a **settings schema** section for alarm filters (time range, statuses, severities).
2. Include **performance notes** for large tenants (virtual scroll / lazy tree).
3. Add **acceptance criteria** for the two tabs.
