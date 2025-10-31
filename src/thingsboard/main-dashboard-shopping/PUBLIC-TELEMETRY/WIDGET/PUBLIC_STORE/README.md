# Public Store Widget

**Version:** 1.0.0
**RFC:** RFC-0058
**Type:** ThingsBoard Last Value Widget
**Status:** Production Ready

---

## Overview

The **Public Store Widget** is a ThingsBoard widget designed for public dashboards that enables deep-linking to specific stores via URL parameters. It provides a clean interface for viewing store information and accessing key actions like settings, consumption reports, and instant telemetry.

### Key Features

- ✅ **Deep-Linking:** Access specific stores via `?storeLUC=XXXXX` URL parameter
- ✅ **Public Access:** Supports ThingsBoard Public Dashboard (recommended) or hard-coded credentials
- ✅ **Smart Fallback:** Automatically falls back to widget-bound entity if LUC not found
- ✅ **Configurable Actions:** Show/hide buttons via settings schema
- ✅ **Responsive Design:** Works on desktop, tablet, and mobile devices
- ✅ **User-Friendly:** Non-technical error messages and toast notifications
- ✅ **Library Integration:** Integrates with myio-js-library action handlers

---

## Installation

### 1. Upload Widget to ThingsBoard

1. Login to ThingsBoard: `https://dashboard.myio-bas.com`
2. Navigate to: **Widget Library** > **Create new widget type** > **Last Value**
3. Widget Bundle: Select `main-dashboard-shopping`
4. Upload files:
   - **JavaScript:** Copy content from `controller.js`
   - **HTML:** Copy content from `template.html`
   - **CSS:** Copy content from `style.css`
5. Settings Schema: Copy content from `settings.schema.json`
6. Save widget as: **"Public Store Widget"**

### 2. Add to Dashboard

1. Navigate to your dashboard (or create new: **PUBLIC_STORE**)
2. Click **"+ Add Widget"**
3. Select: **Last Value** > **Public Store Widget**
4. Configure:
   - **Datasource:** Optional (widget works without telemetry)
   - **Entity Alias:** Optional fallback device
   - **Settings:** Configure button visibility and colors
5. Save dashboard

### 3. Configure Public Access (Recommended)

1. Dashboard settings > **Make Public**
2. Copy public dashboard URL
3. Share URL with storeLUC parameter: `https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD`

---

## Usage

### Deep-Linking with storeLUC

Access specific stores directly via URL parameter:

```
https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD
```

**How it works:**

1. Widget reads `storeLUC` from URL
2. Queries ThingsBoard API for device with matching name
3. Loads server-scope attributes (ingestionId, slaveId, centralId, identifier)
4. Renders store header and wires action buttons
5. Falls back to widget-bound entity if LUC not found

### URL Parameter Normalization

The widget automatically normalizes URL parameters:

- ✅ Trims leading/trailing whitespace
- ✅ Handles empty strings → triggers fallback
- ✅ Handles null/undefined → triggers fallback
- ✅ Case-sensitive matching (LUC must match exactly)

**Examples:**

| URL | Behavior |
|-----|----------|
| `?storeLUC=113CD` | ✅ Resolves to device "113CD" |
| `?storeLUC=   113CD   ` | ✅ Trimmed to "113CD", resolves |
| `?storeLUC=` | ⚠️ Empty, uses fallback device |
| `?storeLUC=INVALID` | ⚠️ Not found, uses fallback + toast |
| (no parameter) | ⚠️ Uses fallback device |

### Fallback Behavior

If `storeLUC` is not provided or device not found:

1. Widget checks `ctx.datasources[0]` (primary)
2. Falls back to `ctx.defaultSubscription` (legacy)
3. Displays toast: "We're showing the store bound to this widget because the link code was not found."
4. Logs WARNING to console

---

## Widget Settings

Configure button visibility and styling via ThingsBoard settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showSettings` | Boolean | `true` | Show Settings (gear icon) button |
| `showReport` | Boolean | `true` | Show Consumption Report button |
| `showInstant` | Boolean | `true` | Show Instant Telemetry button |
| `showChartCTA` | Boolean | `true` | Show "Open Detailed Dashboard" button |
| `primaryColor` | String | `#1976d2` | Hex color for primary buttons |

### Example Configuration

```json
{
  "showSettings": true,
  "showReport": true,
  "showInstant": false,
  "showChartCTA": true,
  "primaryColor": "#2196f3"
}
```

---

## Action Handlers

The widget integrates with myio-js-library action handlers:

| Button | Library Function | Fallback |
|--------|------------------|----------|
| Settings (⚙) | `MyIOLib.handleActionSettings()` | `window.handleActionSettings()` |
| Consumption Report | `MyIOLib.handleActionReport()` | `window.handleActionReport()` |
| Instant Telemetry | `MyIOLib.openDemandModal()` | `window.openDemandModal()` |
| Energy Dashboard | `MyIOLib.handleActionDashboard()` | `window.handleActionDashboard()` |

**Device Context Passed:**

```javascript
{
  deviceId: "abc123...",
  deviceName: "store_113CD",
  deviceLabel: "Shopping Campinas",
  ingestionId: "ing_123",
  slaveId: "slave_456",
  centralId: "central_789",
  identifier: "113CD"
}
```

---

## Authentication Options

### Option 1: ThingsBoard Public Dashboard (Recommended)

**Pros:**
- ✅ No credentials in widget code
- ✅ Better security
- ✅ Simpler implementation

**Setup:**
1. Dashboard settings > **Make Public**
2. **Remove/comment out** `MyIOAuthTB` module in `controller.js`
3. Use ThingsBoard's native authentication

### Option 2: Hard-Coded Credentials (Fallback)

**Pros:**
- ✅ Works on private dashboards
- ✅ No user login required

**Cons:**
- ⚠️ Credentials visible in browser DevTools
- ⚠️ Requires READ-ONLY ThingsBoard account

**Setup:**
1. Keep `MyIOAuthTB` module in `controller.js`
2. Configure credentials (currently: `alarmes@myio.com.br`)
3. Ensure account has READ-ONLY permissions

---

## Server-Scope Attributes

The widget requires the following server-scope attributes on devices:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `ingestionId` | ✅ | Ingestion API identifier |
| `slaveId` | ✅ | Modbus slave ID |
| `centralId` | ✅ | Central system ID |
| `identifier` | ⚠️ Optional | Store identifier (falls back to LUC) |

**Missing Attributes:**

- Widget logs `WARN` message
- Uses defaults: `null` for IDs, `'-'` or `storeLUC` for identifier
- Widget continues to function

---

## Device Resolution Logic

### Primary Path: deviceName

```javascript
GET /api/tenant/devices?deviceName=113CD
```

If device found → Use device
If 404 → Try fallback path

### Fallback Path: Attribute Search (Optional)

```javascript
// Commented out by default - enable if needed
// Search by server-scope attribute "identifier"
```

### Ultimate Fallback: Widget-Bound Entity

```javascript
// Check ctx.datasources[0] → ctx.defaultSubscription
```

---

## Identifier Display Logic

The widget intelligently selects the best identifier to display:

1. **Server-scope `identifier` attribute** (preferred)
2. **storeLUC from URL** (fallback)
3. **`'-'`** (last resort)

**Example:**

| Server Attribute | URL LUC | Display |
|------------------|---------|---------|
| "113CD" | "113CD" | "Store: 113CD" (attribute) |
| null | "113CD" | "Store: 113CD" (LUC fallback) |
| null | null | "Store: -" |

---

## Responsive Design

### Desktop (1920x1080, 1366x768)

- Full layout with all buttons visible
- Horizontal action button group
- Large chart placeholder

### Tablet (iPad, 768x1024)

- Slightly reduced padding
- Buttons may wrap to second row
- Optimized chart size

### Mobile (iPhone, < 768px)

- Vertical stack layout
- Store header stacked vertically
- Action buttons in column (full width)
- Smaller chart with readable labels

---

## Performance

### Metrics

| Metric | Target | Optimization |
|--------|--------|--------------|
| Widget Load Time | <2s | Cached token, single API calls |
| Device Resolution | <500ms | Primary path optimized |
| Attribute Loading | <300ms | Session cache by deviceId |
| Action Response | <200ms | Direct handler invocation |

### Optimization Rules

1. **Attribute Caching:** Attributes cached by `deviceId` for session lifetime
2. **Token Reuse:** MyIOAuthTB caches tokens in localStorage
3. **Lazy Resolution:** Device lookup only on init, not on data updates
4. **No Refetch:** Avoid attribute refetch on `onDataUpdated()`

---

## Troubleshooting

### Widget doesn't load

**Symptoms:** Loading spinner persists, no content
**Solutions:**

1. Check console logs: `[MYIO:PUBLIC_TELEMETRY:*]`
2. Verify authentication (if using MyIOAuthTB)
3. Verify device exists with matching name
4. Check network tab for failed API calls

### "Failed to load store data" error

**Causes:**

- Authentication failed
- Device not found
- Network error

**Solutions:**

1. Check credentials (if using MyIOAuthTB)
2. Verify device name matches LUC
3. Check browser console for error details

### Action buttons don't work

**Symptoms:** Click has no effect, shows "action not available"
**Solutions:**

1. Verify myio-js-library loaded on page
2. Check `window.MyIOLib` or `window.handleActionX` exists
3. Review console logs for errors

### Toast notification shows fallback message

**Symptoms:** "We're showing the store bound to this widget..."
**Meaning:** storeLUC not found, using widget-bound entity
**Solutions:**

1. Verify device name matches LUC exactly
2. Check device exists in ThingsBoard
3. Check URL parameter spelling: `storeLUC` (case-sensitive)

---

## Logging

All logs use prefix: `[MYIO:PUBLIC_TELEMETRY:CONTEXT]`

### Log Levels

| Level | Context Examples |
|-------|------------------|
| **INFO** | `INIT_START`, `LUC_RESOLVE_OK`, `ATTR_LOAD_OK` |
| **WARN** | `LUC_RESOLVE_FALLBACK`, `ATTR_LOAD_MISSING` |
| **ERROR** | `INIT_ERROR`, `AUTH_ERROR`, `LUC_RESOLVE_ERROR` |

### Enable/Disable Logging

Edit `controller.js`:

```javascript
const DEBUG_ACTIVE = false; // Disable all console logs
```

---

## Browser Compatibility

### Supported Browsers

- ✅ Chrome 90+ (recommended)
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

### Features Used

- ES6+ (async/await, arrow functions, optional chaining)
- Fetch API
- URLSearchParams
- localStorage / sessionStorage

---

## Security

### Recommendations

1. **Use ThingsBoard Public Dashboard** (no credentials in code)
2. **If using MyIOAuthTB:** Ensure account is READ-ONLY
3. **Never commit credentials** to version control
4. **Use HTTPS** for all deployments
5. **Validate LUC input** (normalization prevents injection)

### Attack Vectors

| Vector | Mitigation |
|--------|------------|
| XSS | Angular sanitizes template variables |
| CSRF | ThingsBoard token-based auth |
| Injection | URL parameter normalization + encoding |
| Token theft | Public dashboard has no sensitive ops |

---

## API Reference

### URL Parameters

| Parameter | Type | Required | Example |
|-----------|------|----------|---------|
| `storeLUC` | String | No | `?storeLUC=113CD` |

### Widget Context API

```javascript
// Access settings
const settings = self.ctx.settings;

// Access datasources
const ds0 = self.ctx.datasources[0];

// Access subscription (legacy)
const sub = self.ctx.defaultSubscription;
```

### ThingsBoard API Endpoints Used

```
POST /api/auth/login                                    # Login (if MyIOAuthTB)
POST /api/auth/token                                    # Refresh token
GET  /api/auth/user                                     # Get user profile
GET  /api/tenant/devices?deviceName={LUC}              # Resolve device
GET  /api/plugins/telemetry/DEVICE/{id}/values/attributes?scope=SERVER_SCOPE
```

---

## Development

### File Structure

```
PUBLIC_STORE/
├── controller.js            # Main widget logic (18KB)
├── template.html            # HTML structure (4KB)
├── style.css                # Styling + responsive (9KB)
├── settings.schema.json     # Settings configuration (1KB)
└── README.md                # Documentation (this file)
```

### Code Organization

```
controller.js
├── Configuration (TB_HOST, DEBUG_ACTIVE)
├── LogHelper (logging utility)
├── MyIOAuthTB (authentication module)
├── Device Resolution (URL parsing, API lookup, fallback)
├── Server-Scope Attributes (API loading, caching)
├── UI Rendering (show/hide, toast, header)
├── Action Handlers (button wiring, namespace resolution)
└── Widget Lifecycle (onInit, onDataUpdated, onDestroy)
```

### Testing Checklist

- [ ] Valid LUC resolves to correct device
- [ ] Invalid LUC triggers fallback + toast
- [ ] Missing LUC uses widget-bound entity
- [ ] URL normalization removes spaces
- [ ] Empty storeLUC triggers fallback
- [ ] All action buttons work
- [ ] Settings visibility toggles work
- [ ] Primary color applies from settings
- [ ] Responsive layout works on mobile
- [ ] Loading/error states display correctly

---

## Changelog

### v1.0.0 (2025-10-29)

- ✨ Initial release
- ✅ Deep-linking with storeLUC parameter
- ✅ Dual-path device resolution (name → attribute)
- ✅ Smart identifier fallback (attr → LUC → '-')
- ✅ Namespace resolution for library handlers
- ✅ Settings schema for button visibility
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ User-friendly toast notifications
- ✅ Performance optimization (caching)

---

## Related Documentation

- **RFC-0058:** [Public Store Widget Specification](../../../docs/rfcs/RFC-0058-Public-Store-Widget.md)
- **Implementation Plan:** [RFC-0058-IMPLEMENTATION-PLAN.md](../../../docs/rfcs/RFC-0058-IMPLEMENTATION-PLAN.md)
- **Review Summary:** [RFC-0058-REV-002y.md](../../../docs/rfcs/RFC-0058-REV-002y.md)

---

## Support

### Contact

- **Tech Lead:** MYIO Platform Team
- **GitHub Issues:** [myio-js-library-PROD/issues](https://github.com/myio/myio-js-library-PROD/issues)
- **Email:** support@myio.com.br

### Common Issues

See [Troubleshooting](#troubleshooting) section above.

---

**End of Documentation**
