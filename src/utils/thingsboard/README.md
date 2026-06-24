# ThingsBoard Utilities

This directory contains utility functions for working with ThingsBoard widget data.

## buildListItemsThingsboardByUniqueDatasource

A utility function that extracts and processes ThingsBoard widget context data to create a standardized list of items with `id`, `identifier`, and `label` properties.

### Usage

#### MyIOLibrary (Recommended)
```javascript
// Available as part of the MyIOLibrary global object
const items = MyIOLibrary.buildListItemsThingsboardByUniqueDatasource(ctx.datasources, ctx.data);
```

#### ES Module Import
```javascript
import { buildListItemsThingsboardByUniqueDatasource } from './utils/buildListItemsThingsboardByUniqueDatasource.js';

const items = buildListItemsThingsboardByUniqueDatasource(ctx.datasources, ctx.data);
```

#### Global Function (For ThingsBoard Widgets)
```javascript
// Include the script in your widget resources, then:
const items = window.buildListItemsThingsboardByUniqueDatasource(ctx.datasources, ctx.data);
```

#### CommonJS (Legacy)
```javascript
const { buildListItemsThingsboardByUniqueDatasource } = require('./utils/buildListItemsThingsboardByUniqueDatasource.js');
```

### Function Signature

```typescript
function buildListItemsThingsboardByUniqueDatasource(
  datasources: any[], 
  data: any[]
): Array<{
  id: string | null;
  identifier: string;
  label: string;
}>
```

### Parameters

- **datasources**: Array of ThingsBoard datasources from `ctx.datasources`
- **data**: Array of data rows from `ctx.data`

### Returns

An array of standardized items, each containing:
- **id**: The ingestion ID or entity ID
- **identifier**: The store/device identifier 
- **label**: The human-readable name/label

### Example

```javascript
// In a ThingsBoard widget
const items = buildListItemsThingsboardByUniqueDatasource(
  self.ctx.datasources,
  self.ctx.data
);

console.log(items);
// Output:
// [
//   { id: "ING123", identifier: "STORE001", label: "McDonald's Store 1" },
//   { id: "ING456", identifier: "STORE002", label: "Burger King Store 2" }
// ]
```

### Features

- **Attribute Normalization**: Automatically normalizes attribute keys (`ingestionId`, `identifier`, `label`, etc.)
- **Data Hydration**: Combines datasource metadata with actual telemetry data
- **Fallback Values**: Uses sensible fallbacks when data is missing
- **Portuguese Sorting**: Results are sorted by label using Portuguese locale
- **Error Handling**: Gracefully handles malformed or missing data

### Migration from Inline Functions

If you're migrating from the inline functions in controller.js:

**Before:**
```javascript
function buildItemsInverted(ctx) {
  // ... inline implementation
}

const itemsListTB = buildItemsInverted(self.ctx);
```

**After:**
```javascript
// Use the extracted utility with fallback
const itemsListTB = typeof window.buildListItemsThingsboardByUniqueDatasource === 'function' 
  ? window.buildListItemsThingsboardByUniqueDatasource(self.ctx.datasources, self.ctx.data)
  : buildItemsInverted(self.ctx); // Keep as fallback
```

### Testing

The utility includes comprehensive unit tests covering:
- Empty and null inputs
- Data hydration scenarios
- Attribute key normalization
- Sorting behavior
- Error handling
- Edge cases

Run tests with:
```bash
npm test -- buildListItemsThingsboardByUniqueDatasource.test.js
```

### Files

- `buildListItemsThingsboardByUniqueDatasource.ts` - TypeScript version with full type definitions
- `buildListItemsThingsboardByUniqueDatasource.js` - JavaScript version for broader compatibility
- `../../../tests/buildListItemsThingsboardByUniqueDatasource.test.js` - Unit tests
