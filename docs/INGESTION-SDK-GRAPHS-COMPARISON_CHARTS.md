# Comparison Charts SDK Documentation

This guide covers how to use the MyIO Energy Chart SDK for rendering comparison/multi-source charts with the new `bar_mode` feature.

## Overview

The SDK provides two types of comparison charts:

| Chart Type | Description | Default Display |
|------------|-------------|-----------------|
| **Stacked Chart** | Multiple data sources with bar_mode support | Grouped (side-by-side) |
| **Comparison Chart** | Period-over-period comparison | Donut/Total view |

## SDK Base URL

```
Production: https://graphs.apps.myio-bas.com
Staging:    https://graphs.staging.apps.myio-bas.com
```

## Quick Start

### Method 1: Direct iframe (Recommended for Thingsboard)

```html
<iframe
  src="https://graphs.staging.apps.myio-bas.com/embed/telemetry-stacked?auth_token=YOUR_TOKEN&reading_type=energy&bar_mode=grouped&data_sources=[...]&startDate=2024-01-01&endDate=2024-01-31&granularity=1d&theme=light&timezone=America/Sao_Paulo&api_base_url=https://api.myio-bas.com"
  width="100%"
  height="400"
  frameborder="0">
</iframe>
```

### Method 2: Using the SDK (JavaScript)

```html
<script src="https://graphs.staging.apps.myio-bas.com/sdk/energy-chart-sdk.umd.js"></script>
<script>
  const chart = EnergyChartSDK.renderTelemetryStackedChart('#chart-container', {
    version: 'v2',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    readingType: 'energy',
    dataSources: [
      { type: 'asset', id: 'asset-uuid-1', label: 'Building A' },
      { type: 'asset', id: 'asset-uuid-2', label: 'Building B' },
    ],
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    granularity: '1d',
    theme: 'light',
    timezone: 'America/Sao_Paulo',
    iframeBaseUrl: 'https://graphs.staging.apps.myio-bas.com',
    apiBaseUrl: 'https://api.myio-bas.com'
  });
</script>
```

---

## Bar Mode Parameter

The `bar_mode` parameter controls how multiple data sources are displayed:

| Value | Description | Visual |
|-------|-------------|--------|
| `grouped` | Bars displayed **side-by-side** (DEFAULT) | ![Grouped](grouped.png) |
| `stacked` | Bars displayed **on top of each other** | ![Stacked](stacked.png) |

### Usage via iframe URL

```
?bar_mode=grouped   // Side-by-side bars (default)
?bar_mode=stacked   // Stacked bars
```

### Full iframe Example with bar_mode

```html
<!-- GROUPED BARS (side-by-side) -->
<iframe
  src="https://graphs.staging.apps.myio-bas.com/embed/telemetry-stacked?bar_mode=grouped&auth_token=TOKEN&reading_type=energy&data_sources=[{&quot;type&quot;:&quot;asset&quot;,&quot;id&quot;:&quot;uuid1&quot;},{&quot;type&quot;:&quot;asset&quot;,&quot;id&quot;:&quot;uuid2&quot;}]&startDate=2024-01-01&endDate=2024-01-07&granularity=1d&theme=light&timezone=America/Sao_Paulo&api_base_url=https://api.myio-bas.com"
  width="100%"
  height="400"
  frameborder="0">
</iframe>

<!-- STACKED BARS -->
<iframe
  src="https://graphs.staging.apps.myio-bas.com/embed/telemetry-stacked?bar_mode=stacked&..."
  width="100%"
  height="400"
  frameborder="0">
</iframe>
```

---

## Complete Parameter Reference

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `auth_token` | string | JWT token from authentication |
| `reading_type` | `energy` \| `water` | Type of telemetry data |
| `data_sources` | JSON array | Array of data sources (see below) |
| `startDate` | string | Start date (YYYY-MM-DD or ISO) |
| `endDate` | string | End date (YYYY-MM-DD or ISO) |
| `granularity` | `1h` \| `1d` | Data granularity |
| `api_base_url` | string | API base URL |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bar_mode` | `grouped` \| `stacked` | `grouped` | Bar display mode |
| `theme` | `light` \| `dark` | `light` | Chart theme |
| `timezone` | string | Browser TZ | Timezone for display |
| `deep` | `0` \| `1` | `0` | Include nested entities |

### Data Sources Format

```json
[
  {
    "type": "device",     // "device" | "asset" | "customer"
    "id": "uuid-here",    // Entity UUID
    "label": "Custom Name", // Optional display name
    "deep": true          // Optional, override global deep
  }
]
```

---

## Authentication

Before rendering charts, you need to obtain an auth token:

```javascript
// Get auth token
const response = await fetch('https://api.myio-bas.com/api/v1/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    grant_type: 'client_credentials'
  })
});

const { access_token } = await response.json();
// Use access_token as auth_token in iframe URL
```

---

## Thingsboard Widget Integration

### Step 1: Create Custom Widget

```javascript
self.onInit = function() {
  const SDK_URL = 'https://graphs.staging.apps.myio-bas.com/sdk/energy-chart-sdk.umd.js';

  // Load SDK
  const script = document.createElement('script');
  script.src = SDK_URL;
  script.onload = initChart;
  document.head.appendChild(script);
};

function initChart() {
  const container = self.ctx.$container[0];

  // Build data sources from widget config
  const dataSources = self.ctx.settings.dataSources || [];

  self.chart = EnergyChartSDK.renderTelemetryStackedChart(container, {
    version: 'v2',
    clientId: self.ctx.settings.clientId,
    clientSecret: self.ctx.settings.clientSecret,
    readingType: self.ctx.settings.readingType || 'energy',
    dataSources: dataSources,
    startDate: getStartDate(),
    endDate: getEndDate(),
    granularity: self.ctx.settings.granularity || '1d',
    theme: self.ctx.settings.theme || 'light',
    timezone: 'America/Sao_Paulo',
    iframeBaseUrl: 'https://graphs.staging.apps.myio-bas.com',
    apiBaseUrl: 'https://api.myio-bas.com'
  });
}

self.onDestroy = function() {
  if (self.chart) {
    self.chart.destroy();
  }
};
```

### Step 2: Widget Settings Schema

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "clientId": { "type": "string", "title": "API Client ID" },
      "clientSecret": { "type": "string", "title": "API Client Secret" },
      "readingType": {
        "type": "string",
        "enum": ["energy", "water"],
        "default": "energy"
      },
      "granularity": {
        "type": "string",
        "enum": ["1h", "1d"],
        "default": "1d"
      },
      "theme": {
        "type": "string",
        "enum": ["light", "dark"],
        "default": "light"
      },
      "dataSources": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["device", "asset", "customer"] },
            "id": { "type": "string" },
            "label": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## Verifying bar_mode is Working

### Check 1: Inspect iframe URL

Open browser DevTools → Network tab → Find the iframe request. The URL should contain:
```
bar_mode=grouped
```

### Check 2: Visual Verification

- **Grouped mode**: Each timestamp shows bars **side by side**
- **Stacked mode**: Each timestamp shows bars **stacked on top of each other**

### Check 3: Label Check

The chart displays a label in the top-left corner:
- Grouped: `"X fonte(s) agrupada(s)"`
- Stacked: `"X fonte(s) empilhada(s)"`

---

## Troubleshooting

### Chart not showing bar_mode changes

1. **Clear browser cache** - The JS file may be cached
2. **Check the iframe URL** - Ensure `bar_mode=grouped` is in the URL
3. **Verify staging deployment** - Check if build is up-to-date:
   ```bash
   curl -s https://graphs.staging.apps.myio-bas.com/assets/index-*.js | grep -o "bar_mode" | head -1
   ```

### Authentication errors

- Verify `client_id` and `client_secret` are correct
- Check token expiration (tokens are cached for 5 minutes)
- Ensure `api_base_url` is correct

### Data not loading

- Verify entity IDs exist in the API
- Check date range has data
- Verify `reading_type` matches your devices

---

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth` | POST | Get auth token |
| `/api/v1/telemetry/devices/{id}/energy` | GET | Device energy data |
| `/api/v1/telemetry/assets/{id}/energy` | GET | Asset energy data |
| `/api/v1/telemetry/customers/{id}/energy` | GET | Customer energy data |

---

## Changelog

### v1.1.0 (2024-11)
- Added `bar_mode` parameter
- Default changed from `stacked` to `grouped`
- Added visual label indicator for bar mode

### v1.0.0
- Initial release with stacked chart support
