# RFC-0101: Export Data Smart Component

- **Feature Name:** `export_data_smart_component`
- **Start Date:** 2025-12-08
- **RFC PR:** (leave this empty)
- **Issue:** (leave this empty)
- **Status:** Draft

## Summary

Introduce a two-part smart component system for exporting device data in multiple formats (PDF, XLS, CSV) across different domains (temperature, water, energy) with configurable export types and styling options.

## Motivation

Currently, there is no standardized way to export device data from the MYIO platform. Users need the ability to:

- Export data in multiple formats depending on their use case
- Generate professional-looking PDF reports with MYIO branding
- Create data-focused spreadsheets for analysis (XLS/CSV)
- Export data for single devices, comparisons, or customer groups
- Have consistent file naming conventions for easy organization

This RFC proposes a modular, two-component architecture that separates configuration from execution, enabling flexible and reusable export functionality.

## Guide-level Explanation

The Export Data Smart Component system consists of two main functions:

### 1. `buildTemplateExport` - Configuration Builder

This function creates a configuration object (skeleton/template) that defines how the export should be structured:

```typescript
const configMyioExportData = buildTemplateExport({
  domain: 'energy' | 'water' | 'temperature',
  formatExport: 'pdf' | 'xlsx' | 'csv',
  typeExport: 'one-device' | 'comparison' | 'one-customer' | 'group-of-customer',
  colorsPallet?: CustomColorsPallet // optional
});
```

### 2. `myioExportData` - Data Exporter

This function takes the actual data and the configuration to produce the export file:

```typescript
myioExportData(data, configMyioExportData);
```

### File Naming Convention

Exported files follow a consistent naming pattern:

```
{DeviceLabel}-{Identifier}-{DOMAIN}-{YYYY}-{MM}-{DD}-{HH}-{mm}-{ss}.{ext}
```

Examples:
- `Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.pdf`
- `Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.xlsx`
- `Burguer_king-113CD-ENERGIA-2025-12-08-12-47-00.csv`

## Reference-level Explanation

### Type Definitions

```typescript
type Domain = 'energy' | 'water' | 'temperature';

type FormatExport = 'pdf' | 'xlsx' | 'csv';

type TypeExport = 'one-device' | 'comparison' | 'one-customer' | 'group-of-customer';

interface ColorsPallet {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

interface ExportConfig {
  domain: Domain;
  formatExport: FormatExport;
  typeExport: TypeExport;
  colorsPallet?: ColorsPallet;
}

interface DeviceData {
  identifier?: string;
  label?: string;
  name: string;
  icon?: string;
  customerName?: string;
  shoppingName?: string;
  data: DataPoint[];
}

interface DataPoint {
  timestamp: Date;
  value: number;
  unit: string;
}

interface ExportMetrics {
  min: number;
  max: number;
  average: number;
  period: {
    start: Date;
    end: Date;
  };
}
```

### Format-Specific Behavior

#### PDF Export
- MYIO brand colors and styling
- Header section with customer/shopping name
- Device information: identifier, label (fallback to name if null), icon
- Data grid table with formatted values
- Optional chart visualization for the period
- Statistics section: minimum, maximum, and average values

#### XLSX Export
- Data-focused grid layout
- Period information in header rows
- Device metadata in separate sheet or header
- Statistics summary (min, max, average)
- Formatted cells with proper data types

#### CSV Export
- Clean, minimal format
- Header row with column names
- Raw data values only
- No styling or formatting
- Maximum compatibility with external tools

### Display Logic

When displaying device information:
- **Label**: Display `label` if available, otherwise fall back to `name`
- **Identifier**: Display only if not null/undefined
- **Icon**: Render domain-appropriate icon

### Statistics Calculation

For each export, calculate and include:
- **Minimum**: Lowest value in the period
- **Maximum**: Highest value in the period
- **Average**: Mean value across all data points in the period

## Drawbacks

- Adds complexity to the codebase with two separate components
- PDF generation may require additional dependencies (e.g., jsPDF, pdfmake)
- Excel generation requires a library like xlsx or exceljs
- Different formats have different capabilities, which may cause feature inconsistency

## Rationale and Alternatives

### Why two components?

Separating configuration from execution provides:
- **Reusability**: Same configuration can be reused across multiple exports
- **Testability**: Configuration can be validated independently
- **Flexibility**: Easy to add new formats or export types without changing the core logic

### Alternatives Considered

1. **Single function approach**: A single `exportData(data, options)` function
   - Rejected because it mixes concerns and reduces reusability

2. **Class-based approach**: An `ExportService` class with methods for each format
   - Rejected because it adds unnecessary OOP complexity for a functional operation

3. **Template-based approach**: Pre-defined templates selected by name
   - Rejected because it reduces flexibility and customization options

## Prior Art

- **Google Sheets Export**: Provides PDF, XLSX, CSV export with formatting options
- **Tableau**: Offers multiple export formats with configurable layouts
- **Power BI**: Separates report configuration from data binding

## Unresolved Questions

1. Should charts be included in XLSX exports as embedded images?
2. What chart library should be used for PDF chart generation?
3. Should there be a preview mode before final export?
4. How to handle large datasets that exceed single-file limits?
5. Should exports support multiple languages/localization?

## Future Possibilities

- **Scheduled exports**: Automatic periodic exports via cron jobs
- **Email integration**: Send exports directly via email
- **Cloud storage**: Save exports directly to cloud services (S3, Google Drive)
- **Custom templates**: User-defined PDF templates
- **Batch exports**: Export multiple devices/periods in a single operation
- **Compression**: ZIP multiple files for large exports

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Define TypeScript interfaces and types
- [ ] Implement `buildTemplateExport` configuration builder
- [ ] Create base `myioExportData` function structure

### Phase 2: Format Implementations
- [ ] Implement CSV export (simplest format first)
- [ ] Implement XLSX export with xlsx library
- [ ] Implement PDF export with pdfmake or jsPDF

### Phase 3: Domain-Specific Features
- [ ] Add energy domain formatting and icons
- [ ] Add water domain formatting and icons
- [ ] Add temperature domain formatting and icons

### Phase 4: Export Types
- [ ] Implement `one-device` export type
- [ ] Implement `comparison` export type
- [ ] Implement `one-customer` export type
- [ ] Implement `group-of-customer` export type

### Phase 5: Showcase & Documentation
- [ ] Create showcase examples with mock data in `showcase/` directory
- [ ] Add comprehensive documentation
- [ ] Create usage examples for each combination

## Showcase Examples

Showcase files should be created at:
```
C:\Projetos\GitHub\myio\myio-js-library-PROD.git\showcase\
```

Example showcase files:
- `export-pdf-energy.html`
- `export-xlsx-water.html`
- `export-csv-temperature.html`
- `export-comparison.html`
