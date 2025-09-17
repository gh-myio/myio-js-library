# @myio/report-ui (seed)

Thin, framework-agnostic UI for premium **List** and **Cards** reports, designed for ThingsBoard widgets or vanilla web apps.

## Install

```bash
npm i @myio/report-ui
```

## Minimal usage

```ts
import { createPremiumReportUI } from "@myio/report-ui";

const ui = createPremiumReportUI({
  mount: document.getElementById("report")!,
  mode: "energy",
  async onFetchData(range) {
    // Fetch your rows here (energy or temperature). For now
    // just return an empty array; integration is per-widget.
    return [];
  }
});

ui.setDateRange(new Date("2025-09-01"), new Date("2025-09-10"));
ui.setLoading("Consolidating…", 30);
ui.render([]);
ui.setLoading("Done", 100);
```
