# ThingsBoard integration (example)

In your widget `controller.js`, after the popup opens, mount:

```js
import { createPremiumReportUI } from "@myio/report-ui";

const mount = document.getElementById("report-root");
const ui = createPremiumReportUI({
  mount,
  mode: "temperature",
  async onFetchData({ start, end }) {
    // Wire to your existing RPC / Data API calls and map to ReportRow[]
    return window.fetchTemperatures(start, end);
  }
});
```

Use your existing overlay and CSV/PDF helpers if desired — the API is compatible.
