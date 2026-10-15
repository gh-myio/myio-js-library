# Inventory Panel v2 — export checklist (RFC-0237 AC-09)

Run in the showcase (`showcase/inventory-panel-v2/`, port 3346) — mock first, then live —
and open each file in Excel / a PDF reader.

## Every format

- [ ] The button shows "Exportar N ▾" and N matches "Mostrando N de …".
- [ ] Changing a filter or the search updates N; with N = 0 the button is disabled.
- [ ] File name `inventario_<cliente|todos>_<AAAA-MM-DD_HHmm>.<ext>`; the customer appears only
      when exactly one is filtered.
- [ ] Collapsed groups and rows not rendered yet (beyond the first 200) are in the file.
- [ ] Rows follow the list order (grouping + sort).

## CSV

- [ ] Opens in Excel pt-BR with accents correct (UTF-8 BOM) and columns split by `;`.
- [ ] Only header + rows (no metadata lines).
- [ ] A label starting with `=`, `+`, `-` or `@` shows as text (prefixed with `'`).
- [ ] `deviceId` and `customerId` filled (customerId empty only for "Sem cliente").

## XLSX

- [ ] Sheets **Dispositivos** and **Filtros**.
- [ ] Dispositivos: autofilter on the header; ids (`ingestionId`, `slaveId`, …) keep leading
      zeros (stored as text).
- [ ] Filtros: generated at / by, active filters (or "Nenhum"), indicator counts equal to the
      KPI chips for the same filters.
- [ ] Known limitation: the header row is not frozen (SheetJS Community Edition).
- [ ] With the CDN blocked (DevTools → Network request blocking `cdnjs.cloudflare.com/ajax/libs/xlsx`)
      a dialog offers the CSV, and the CSV has the same rows.

## PDF

- [ ] Landscape A4; page 1 = title, summary (filters + counts), annex legend (dots + rule
      codes, disabled rules omitted) and the customer × rule matrix.
- [ ] Annex from page 2: 3 columns, one device per line — 2 dots (Cadastro, Atividade),
      "Label (name)" cut with "…", rule codes and last-activity age (`<1h`, `5h`, `3d`, `—`).
- [ ] Groups follow the list grouping; a group crossing a column/page repeats its header with
      "— cont."; no header left alone at the bottom of a column.
- [ ] Footer "Gerado em … · Página x de y" on every page.
- [ ] Accents (ã, ç, í, ×, ·, …) render correctly.
- [ ] Live tenant, no filter — 2026-10-06 baseline: 9,294 devices → 56 pages, 1.6 MB, ~6 s
      (the old 8-column table: 342 pages, 16.5 MB, 11 s).
