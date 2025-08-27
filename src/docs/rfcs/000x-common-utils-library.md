- Feature Name: common_utils_library
- Start Date: 2025-08-26
- RFC PR: (leave this empty until PR is opened)
- Tracking Issue: (leave this empty)

# Summary
[summary]: #summary

Introduce a new **Common Utils Library** published to NPM that centralizes formatting, date, and reporting helper functions extracted from the current widget/dashboard codebase.

The library will standardize utility logic across different MyIO dashboards and services, allowing us to import functions instead of duplicating code.

# Motivation
[motivation]: #motivation

Currently, the ThingsBoard widgets and dashboards include a large set of duplicated helper functions for:

- Formatting energy values (kWh, MWh, GWh)
- Formatting percentages
- Formatting dates (ISO, São Paulo timezone, YYYY-MM-DD)
- Determining interval ranges (day vs. month)
- Generating CSV exports
- Building report tables
- Classifying device labels into groups

This duplication increases maintenance cost, introduces inconsistency, and makes testing harder.

By extracting these helpers into a **dedicated NPM package**, we will:

- Improve **reusability** across multiple widgets and projects
- Ensure **consistency** in formatting, classification, and reporting logic
- Simplify **testing and versioning** of utility logic
- Enable **lighter widget code**, since utilities will be imported rather than re-declared

# Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

We will create an NPM package (e.g., `@myio/common-utils`) that exports a set of reusable functions.

Example usage:

```js
import { formatEnergy, fmtPerc, formatDateToYMD, exportToCSV } from "@myio/common-utils";

console.log(formatEnergy(1500)); // "1.50 MWh"
console.log(fmtPerc(0.05));      // "<0,1"
console.log(formatDateToYMD(Date.now(), "America/Sao_Paulo")); // "2025-08-26"

// Export data to CSV
exportToCSV(reportData, "Energy Report", "123.45 kWh", "Device-001", "26/08/2025 - 23:19");
```

These functions will be pure, framework-agnostic, and safe to use both in browser and Node.js contexts.

## Extracted functions

From the current widget source, we will extract:

### Formatting
- `formatEnergy(value)` - Formats energy values with appropriate units (kWh, MWh, GWh)
- `formatAllInSameUnit(values)` - Formats array of values using consistent unit
- `fmtPerc(value)` - Formats percentage values with special handling for small values
- `formatNumberReadable(value)` - Formats numbers for Brazilian locale

### Date handling
- `formatDateToYMD(timestampMs, tzIdentifier)` - Formats timestamp to YYYY-MM-DD
- `getSaoPauloISOString(dateStr, endOfDay)` - Creates São Paulo timezone ISO strings
- `getDateRangeArray(start, end)` - Generates array of dates in range
- `determineInterval(startTimeMs, endTimeMs)` - Determines appropriate time interval

### CSV Export
- `exportToCSV(reportData, entityLabel, totalConsumption, identifiers, issueDate)` - Exports single device data
- `exportToCSVAll(reportData)` - Exports multiple devices data

### Classification
- `classify(label)` - Classifies device labels into categories (Entrada e Relógios, Administração e Bombas, Lojas)

### Utility
- `getValueByDatakey(dataList, dataSourceNameTarget, dataKeyTarget)` - Extracts values from data structures

These will be organized by domain (format, date, csv, classify, etc.).

# Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

The library will be a plain JavaScript (ESM + CJS build) package with TypeScript typings (.d.ts).

## Proposed file structure:

```
src/
  format/
    energy.ts
    percentage.ts
    numbers.ts
  date/
    formatDateToYMD.ts
    interval.ts
    saoPauloISOString.ts
    dateRange.ts
  csv/
    exportToCSV.ts
    exportToCSVAll.ts
  classify/
    classifyDevice.ts
  utils/
    getValueByDatakey.ts
  index.ts
```

## Technical specifications:

- **Dependencies**: none (only built-in JS / Intl API)
- **Build**: Rollup + TypeScript, output to dist/ with CJS, ESM, and UMD builds
- **Package**: published under the MyIO NPM organization (@myio/common-utils)
- **Versioning**: Semantic versioning (SemVer)
- **Testing**: Jest with 100% code coverage target
- **Documentation**: JSDoc comments for all public functions

## Function signatures:

```typescript
// Formatting
export function formatEnergy(value: number): string;
export function formatAllInSameUnit(values: number[]): { format: (val: number) => string; unit: string };
export function fmtPerc(value: number | string): string;
export function formatNumberReadable(value: number): string;

// Date handling
export function formatDateToYMD(timestampMs: number, tzIdentifier?: string): string;
export function getSaoPauloISOString(dateStr: string, endOfDay?: boolean): string;
export function getDateRangeArray(start: Date | string, end: Date | string): string[];
export function determineInterval(startTimeMs: number, endTimeMs: number): string;

// CSV Export
export function exportToCSV(reportData: any[], entityLabel: string, totalConsumption: string, identifiers: string, issueDate: string): void;
export function exportToCSVAll(reportData: any[]): void;

// Classification
export function classify(label: string): "Entrada e Relógios" | "Administração e Bombas" | "Lojas";

// Utility
export function getValueByDatakey(dataList: any[], dataSourceNameTarget: string, dataKeyTarget: string): any;
```

# Drawbacks
[drawbacks]: #drawbacks

- Adds a new repository/package to maintain
- Widgets will need to import from the library instead of relying on local inline code (initial refactor overhead)
- Increases dependency on NPM package availability
- Potential version conflicts if different widgets require different versions

# Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

## Why is this design the best in the space of possible designs?

This approach provides the best balance between reusability, maintainability, and ease of adoption. By creating a focused utility library, we can:

- Maintain a single source of truth for common functions
- Version utilities independently from widgets
- Enable gradual migration (widgets can adopt functions one by one)
- Provide TypeScript support for better developer experience

## What other designs have been considered?

**Alternative 1: Leave as is** - Keep duplicating helpers in each widget
- **Rationale for not choosing**: This is unsustainable long term and leads to inconsistencies

**Alternative 2: Copy-paste snippets repo** - Instead of NPM, keep a Gist/snippets repo
- **Rationale for not choosing**: This loses versioning and consistency benefits, no dependency management

**Alternative 3: Monorepo utilities** - Include as part of a larger monorepo (e.g., myio-js-library)
- **Rationale for not choosing**: Starting focused allows faster iteration, can be merged later if needed

**Alternative 4: Internal shared module** - Create a shared module within the ThingsBoard project
- **Rationale for not choosing**: Less portable, harder to version independently

## What is the impact of not doing this?

- Continued code duplication across widgets
- Inconsistent behavior between similar functions
- Higher maintenance burden
- Increased likelihood of bugs due to copy-paste errors
- Difficulty in testing utility functions in isolation

# Prior art
[prior-art]: #prior-art

This approach follows established patterns in the JavaScript ecosystem:

- **Lodash**: Provides utility functions for common programming tasks
- **date-fns**: Modular date utility library
- **Ramda**: Functional programming utility library
- **React ecosystem**: Many small, focused utility packages

The pattern of extracting common utilities into separate packages is well-established and proven to reduce code duplication while improving maintainability.

# Unresolved questions
[unresolved-questions]: #unresolved-questions

- Should CSV export functions depend on DOM APIs (document.createElement) or also provide a Node.js alternative?
- Should percentage/energy formatting support i18n locales beyond pt-BR?
- Should classification rules (regex for "entrada", "lojas", etc.) be configurable instead of hardcoded?
- What should be the initial version number (0.1.0 or 1.0.0)?
- Should we include polyfills for older browser support?

# Future possibilities
[future-possibilities]: #future-possibilities

This RFC opens up several future enhancement opportunities:

- **Expanded test coverage**: Unit tests for all helpers with edge case coverage
- **React integration**: Provide React hooks around date/CSV utilities (e.g., `useDateRange`, `useCSVExport`)
- **Additional formatters**: Custom formatters for other metrics (water, temperature, pressure)
- **Internationalization**: Support for multiple locales and languages
- **Performance optimizations**: Memoization for expensive formatting operations
- **Browser compatibility**: Polyfills and fallbacks for older browsers
- **Documentation site**: Interactive documentation with examples
- **Migration tools**: Automated tools to help migrate existing widgets
- **Library consolidation**: Merge into a bigger MyIO library (@myio/js-library) if consolidation becomes desirable

The modular design allows for incremental adoption of these enhancements without breaking existing functionality.
