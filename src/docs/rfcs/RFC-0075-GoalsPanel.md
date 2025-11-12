# RFC 0075: Consumption Goals Setup Panel

- Feature Name: `consumption_goals_setup`
- Start Date: 2025-11-10
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

Create a Consumption Goals Setup Panel that provides a comprehensive system for managing energy and water consumption targets. The system includes a data model for annual and monthly goals per year, month, customerId, and optionally assetId; API/Backend for CRUD operations on goals; a two-level UI (Shopping/Customer level and Advanced per Asset level); validation rules ensuring monthly sum ≤ annual goal; versioning via TAG (timestamp + author) and history tracking; dashboard indicators showing Goal vs Actual Consumption per unit; and persistence via JSON stored in ThingsBoard's Server Scope Customer Attributes.

## Motivation

This RFC addresses three key challenges in consumption management:

1. **Standardization**: Establish a unified approach for setting energy and water consumption goals by time period and organizational unit.

2. **Single Source of Truth**: Consolidate goal registration and consumption tracking in a single reliable repository (Customer Server Scope).

3. **Continuous Monitoring**: Enable ongoing comparisons in dashboards showing deviations, achievement percentage, and trends.

## Guide-level explanation

### User Flow

1. User clicks the new "Goals" button in the MENU → opens "Goals Setup" Modal.

2. **Shopping Tab**: Define Annual Goal and distribute Monthly Goals.

3. **Per Asset Tab**: Refine specific goals per asset (e.g., "Common Area", "Food Court").

4. **Save**: Backend validates (monthly sum ≤ annual goal, valid ranges), applies versioning, and persists JSON to Customer Server Scope (ThingsBoard).

5. **Dashboard**: Reads JSON and displays Goal vs Actual per unit (Customer/Asset).

### Permission Scope

- Only roles with `WRITE_CUSTOMER_ATTRIBUTES` (or equivalent) can save goals.
- Read access is available to all viewing roles.

## Reference-level explanation

### Storage Keys and Location

- **Entity**: Customer (Holding)
- **Scope**: `SERVER_SCOPE`
- **Attribute Key**: `consumptionGoals`
- **Format**: Single JSON document containing multiple years and assets

### JSON Schema

```json
{
  "version": 3,
  "history": [
    {
      "tag": "2025-11-10T13:05:20Z|rodrigo.pimentel",
      "reason": "Adjusted 2026 goals",
      "diff": { "year": 2026, "changed": ["annual.total", "monthly[3]"] }
    }
  ],
  "years": {
    "2025": {
      "annual": {
        "total": 1200000,         // Annual goal (kWh or m³) for Customer
        "unit": "kWh"
      },
      "monthly": {
        "01": 90000,
        "02": 88000,
        "03": 95000,
        "04": 98000,
        "05": 100000,
        "06": 105000,
        "07": 110000,
        "08": 115000,
        "09": 100000,
        "10": 95000,
        "11": 90000,
        "12": 92000
      },
      "assets": {
        "asset-COMMON-AREA-UUID": {
          "label": "Common Area",
          "annual": { "total": 300000, "unit": "kWh" },
          "monthly": {
            "01": 22000, "02": 21000, "03": 23000, "04": 24000,
            "05": 25000, "06": 25500, "07": 26000, "08": 26500,
            "09": 24500, "10": 23500, "11": 22500, "12": 23000
          }
        },
        "asset-FOOD-COURT-UUID": {
          "label": "Food Court",
          "annual": { "total": 450000, "unit": "kWh" },
          "monthly": {
            "01": 35000, "02": 34000, "03": 36000, "04": 37000,
            "05": 38000, "06": 38500, "07": 39500, "08": 40500,
            "09": 38000, "10": 36500, "11": 35000, "12": 35500
          }
        }
      },
      "metaTag": "2025-08-01T12:00:00Z|admin@myio"
    },
    "2026": {
      "annual": { "total": 1250000, "unit": "kWh" },
      "monthly": {},
      "assets": {},
      "metaTag": "2025-11-10T13:05:20Z|rodrigo.pimentel"
    }
  }
}
```

### Consistency Rules

- `sum(monthly[01..12]) ≤ annual.total` (at both Customer level and each Asset level)
- If `monthly` is empty, only `annual.total` is considered
- `unit` must be consistent within the same year (e.g., "kWh" for energy, "m3" for water)

### Versioning

- **metaTag per year**: ISO8601|author format
- **version**: Incremental document version (optimistic concurrency control)
- **history[]**: Stores entries with reason and summarized diff

### API Endpoints (REST)

**Base**: `POST /api/consumption-goals/...` (MYIO backend)

Backend performs validation and persists via ThingsBoard REST (Server Scope).

#### `GET /goals?customerId=...&year=2025`
Returns the year block with asset aggregation.

#### `PUT /goals/annual`
```json
{
  "customerId": "...",
  "year": 2025,
  "unit": "kWh",
  "total": 1200000,
  "author": "user@myio",
  "reason": "Budget adjustment"
}
```

#### `PUT /goals/monthly`
```json
{
  "customerId": "...",
  "year": 2025,
  "monthly": {"01": 90000, ...},
  "author": "...",
  "reason": "Revised distribution"
}
```

#### `PUT /goals/asset`
```json
{
  "customerId": "...",
  "assetId": "...",
  "year": 2025,
  "annual": {"total": 300000, "unit": "kWh"},
  "monthly": {...},
  "author": "...",
  "reason": "Goal per area"
}
```

#### `DELETE /goals/asset`
```json
{
  "customerId": "...",
  "assetId": "...",
  "year": 2025,
  "author": "...",
  "reason": "Goal removal"
}
```

**Responses**: Always return consolidated document + new version + year metaTag.

### Validations

- `total >= 0`, monthly values `>= 0`
- Monthly sum does not exceed `annual.total`
- Valid months: `01..12`
- Supported units: `"kWh"`, `"m3"` (extensible)
- Concurrency control: `If-Match: <version>` header (optimistic)

### UI/UX

**Entry Point**: "Goals" button in MENU → opens "Goals Setup" Modal

**Tabs**: "Shopping (Annual/Monthly)" | "Per Asset"

#### Shopping Tab:
- Fields: "Year", "Unit (kWh/m3)", "Annual Goal"
- 12-month grid with inline editing (optional proportional auto-fill)
- Progress bar: Monthly Sum / Annual Goal

#### Per Asset Tab:
- Asset list (search/filter), each item expands to Annual + Monthly
- Local validation (tooltip/inline error)

#### Footer:
- "Save" button (enabled when valid), "Cancel"
- Displays current metaTag and last adjustment author
- Clear error messages (e.g., "Monthly sum (1,230,000) exceeds annual goal (1,200,000)")

### Dashboard Integration

**New Card/Indicator**: "Goal vs Actual"

- **Inputs**: customerId, year, month, optional assetId
- **Displays**: Actual consumption (telemetry) vs goal (JSON)
- **KPIs**: % achieved, absolute deviation, trend (if available)
- **Goal Source**: `SERVER_SCOPE` `consumptionGoals`

## Drawbacks

- Single JSON document can grow large with many years/assets (mitigable through future cleanup/partitioning routines)
- Concurrency control requires discipline (using version/If-Match)

## Rationale and alternatives

**Why Server Scope (Customer)?**
- Centralizes data and simplifies dashboard reads
- Leverages existing ThingsBoard infrastructure

**Alternatives considered:**
- Dedicated database (more robust, higher cost/complexity)
- Attributes per year (more granular, more keys)

## Prior art

- Annual/monthly budgeting methodologies with "top-down cap" and proportional roll-down
- Lightweight versioning via tag + history

## Unresolved questions

- Do we need separate goals by energy/water type? (e.g., demand vs consumption)
- Do we need weekly/daily goals?
- What is the history retention strategy?

## Future possibilities

- Partition by `resourceType` (energy, water) within same document
- Dynamic goals per m², people flow, or time-of-day
- Reports and alerts (deviations above X%)

## Migration plan

1. Create empty `consumptionGoals` attribute (base structure)
2. Enable UI (read-only mode)
3. Release write access to pilot profile
4. Populate current year goals
5. Release to all users

## Testing plan

- **Unit**: Validation of sums, JSON structure, versioning
- **Integration**: GET/PUT/DELETE against ThingsBoard Attributes
- **UI**: Form tests and error states
- **E2E**: Save goals and verify reflection in dashboard

## Security & Privacy

- Role-based authorization (only authorized profiles can edit)
- Auditable via history with author and tag
- Backend change logs

## Example Payloads

### 1) Create/Update Annual Goal (Shopping)
```http
PUT /goals/annual
If-Match: 2
Content-Type: application/json

{
  "customerId": "cust-HOLDING-UUID",
  "year": 2026,
  "unit": "kWh",
  "total": 1250000,
  "author": "rodrigo.pimentel",
  "reason": "2026 budget approved"
}
```

### 2) Distribute Monthly Goals (Shopping)
```http
PUT /goals/monthly
If-Match: 3
Content-Type: application/json

{
  "customerId": "cust-HOLDING-UUID",
  "year": 2026,
  "monthly": {
    "01": 100000, "02": 98000, "03": 104000, "04": 105000,
    "05": 108000, "06": 110000, "07": 112000, "08": 115000,
    "09": 105000, "10": 102000, "11": 98000, "12": 98000
  },
  "author": "energy.analyst",
  "reason": "Seasonal distribution"
}
```

### 3) Asset Goal
```http
PUT /goals/asset
If-Match: 4
Content-Type: application/json

{
  "customerId": "cust-HOLDING-UUID",
  "assetId": "asset-COMMON-AREA-UUID",
  "year": 2026,
  "annual": { "total": 320000, "unit": "kWh" },
  "monthly": {
    "01": 24000, "02": 23000, "03": 25000, "04": 26000,
    "05": 27000, "06": 27000, "07": 27500, "08": 28000,
    "09": 26500, "10": 25500, "11": 24500, "12": 24500
  },
  "author": "facility.manager",
  "reason": "Area refinement"
}
```

## Acceptance Criteria

- [ ] Goals button in MENU opens modal with Shopping/Asset tabs
- [ ] Save goals with validation and applied metaTag
- [ ] `consumptionGoals` attribute created/updated in SERVER_SCOPE (Customer)
- [ ] Dashboard displays "Goal vs Actual" using saved JSON
- [ ] Accessible history (last 10 versions in history array)
- [ ] Version conflicts return 409 with reload instruction

## Glossary

- **Customer (Holding)**: ThingsBoard entity grouping assets
- **Asset**: Unit/area of the shopping mall (e.g., Common Area)
- **Server Scope**: Server-side attribute scope (trusted)
- **MetaTag**: ISO8601|author identifier for goal version per year