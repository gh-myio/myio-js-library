# RFC 0141: Premium PDF Export with Equipment Category Breakdown

- **Feature Name:** `premium-pdf-export`
- **Start Date:** 2026-01-09
- **RFC PR:** [myio-js-library#0141](https://github.com/gh-myio/myio-js-library/pull/0141)
- **MYIO Issue:** [myio-js-library#0141](https://github.com/gh-myio/myio-js-library/issues/0141)

## Summary

This RFC proposes extending `src/utils/equipmentCategory.js` to support **Premium PDF Export** functionality that generates comprehensive energy consumption reports with:

1. **Detailed equipment category breakdown** (7 categories + subcategories)
2. **Device-level consumption tables** with concatenated identifiers
3. **Shopping-wise aggregation** for multi-site reports
4. **Executive summary** with KPIs and charts
5. **PDF generation** using client-side libraries (jsPDF + html2canvas)

## Motivation

### Current Problem

The existing export functionality only provides:
- Basic CSV exports with raw device data
- No categorization or hierarchy
- No visual charts or executive summaries
- No PDF format support

Shopping mall administrators need:
- **Professional PDF reports** for stakeholders and board meetings
- **Category breakdowns** to identify consumption patterns
- **Device-level details** with clear identification
- **Multi-shopping aggregation** for portfolio management

### Concatenated Identifier Problem

Devices in ThingsBoard often have **multiple identifier attributes** that need to be combined for unique identification:

| Attribute | Example | Purpose |
|-----------|---------|---------|
| `identifier` | `CAG-01` | Equipment category prefix |
| `deviceIdentifier` | `SM-001-CAG-01` | Shopping + category + sequence |
| `deviceLabel` | `Chiller Principal` | Human-readable name |
| `serial` | `CHI-2024-00145` | Manufacturer serial |
| `assetTag` | `MYIO-BAS-00892` | Internal asset tracking |

**Problem:** No single attribute uniquely identifies a device across all contexts. Reports must show a **concatenated identifier** that combines relevant attributes.

### Goals

1. **Export function** that generates PDF from equipment category data
2. **Concatenated identifier builder** for unique device identification
3. **Configurable report templates** (summary, detailed, comparison)
4. **Integration** with existing `buildEquipmentCategorySummary()` function

## Guide-level Explanation

### Report Types

#### 1. Executive Summary Report

Single-page overview for quick consumption analysis:

```
+================================================================+
|                    MYIO ENERGY REPORT                          |
|                    Shopping Iguatemi                           |
|                    January 2026                                |
+================================================================+
|                                                                 |
|  TOTAL CONSUMPTION          PEAK DEMAND          COST ESTIMATE |
|  ==================         ===========          ============= |
|  1,250,000 kWh              2,450 kW             R$ 875,000.00 |
|                                                                 |
|  +----------------------------------------------------------+  |
|  |              CONSUMPTION BY CATEGORY                      |  |
|  +----------------------------------------------------------+  |
|  |  [PIE CHART]                                              |  |
|  |                                                           |  |
|  |  - Lojas: 52% (650,000 kWh)                               |  |
|  |  - Climatizacao: 25% (312,500 kWh)                        |  |
|  |  - Elevadores: 10% (125,000 kWh)                          |  |
|  |  - Esc. Rolantes: 6% (75,000 kWh)                         |  |
|  |  - Outros: 7% (87,500 kWh)                                |  |
|  +----------------------------------------------------------+  |
|                                                                 |
|  Generated: 2026-01-09 15:30:00 | MYIO Energy Management       |
+================================================================+
```

#### 2. Detailed Category Report

Multi-page report with device-level breakdown:

```
+================================================================+
| CATEGORY: CLIMATIZACAO                                         |
| Total: 312,500 kWh | 180 devices | 25% of total                |
+================================================================+

SUBCATEGORY: Chillers (8 devices)
+------------------------------------------------------------------+
| Device ID          | Name              | Consumption | % of Cat  |
+------------------------------------------------------------------+
| SM-001-CHI-01      | Chiller Principal | 45,000 kWh  | 14.4%     |
| SM-001-CHI-02      | Chiller Backup    | 38,000 kWh  | 12.2%     |
| SM-001-CHI-03      | Chiller Torre A   | 32,000 kWh  | 10.2%     |
+------------------------------------------------------------------+

SUBCATEGORY: Fancoils (156 devices)
+------------------------------------------------------------------+
| Device ID          | Name              | Consumption | % of Cat  |
+------------------------------------------------------------------+
| SM-001-FAN-001     | Fancoil Piso 1    |  1,200 kWh  |  0.4%     |
| SM-001-FAN-002     | Fancoil Piso 1    |  1,150 kWh  |  0.4%     |
| ...                | ...               | ...         | ...       |
+------------------------------------------------------------------+
```

#### 3. Multi-Shopping Comparison Report

Aggregated report for portfolio management:

```
+================================================================+
| MYIO PORTFOLIO REPORT - January 2026                           |
| 5 Shopping Centers | 3,450,000 kWh Total                       |
+================================================================+

+------------------------------------------------------------------+
| Shopping           | Total kWh   | Lojas    | Area Comum | Rank |
+------------------------------------------------------------------+
| Iguatemi Campinas  | 1,250,000   | 650,000  | 600,000    | 1    |
| Shopping Aricanduva|   980,000   | 510,000  | 470,000    | 2    |
| Center Norte       |   720,000   | 374,000  | 346,000    | 3    |
| Plaza Sul          |   320,000   | 166,000  | 154,000    | 4    |
| Vila Olimpia       |   180,000   | 93,600   | 86,400     | 5    |
+------------------------------------------------------------------+
```

### Concatenated Identifier Format

The `buildDeviceIdentifier()` function creates unique identifiers:

```javascript
// Format: {SHOPPING_CODE}-{CATEGORY_PREFIX}-{SEQUENCE}

// Examples:
buildDeviceIdentifier(device);
// → "SM-001-CHI-01"   (Shopping Iguatemi, Chiller, Unit 01)
// → "SM-001-FAN-156"  (Shopping Iguatemi, Fancoil, Unit 156)
// → "SM-001-ELV-05"   (Shopping Iguatemi, Elevator, Unit 05)
// → "SM-001-ESC-12"   (Shopping Iguatemi, Escalator, Unit 12)
// → "SM-001-GEN-01"   (Shopping Iguatemi, Generator, Unit 01)

// When identifier attribute exists:
buildDeviceIdentifier({ identifier: 'CAG-PRINCIPAL', deviceLabel: 'Chiller 1' });
// → "CAG-PRINCIPAL"   (Uses existing identifier)

// When only label exists:
buildDeviceIdentifier({ deviceLabel: 'Bomba Incendio Torre A' });
// → "BOMBA-INCENDIO-TORRE-A" (Normalized from label)
```

### Identifier Concatenation Rules

| Priority | Source | Format | Example |
|----------|--------|--------|---------|
| 1 | `identifier` attribute | Use as-is | `CAG-01` |
| 2 | `deviceIdentifier` | Use as-is | `SM-001-CAG-01` |
| 3 | Shopping + Category + Sequence | `{SHOP}-{CAT}-{SEQ}` | `IGU-CHI-01` |
| 4 | Label normalization | Uppercase + hyphenate | `CHILLER-PRINCIPAL` |
| 5 | Entity ID (fallback) | UUID truncation | `a1b2c3d4` |

### Shopping Code Derivation

```javascript
// Shopping codes derived from customer name:
getShoppingCode('Shopping Iguatemi Campinas');  // → 'IGU'
getShoppingCode('Shopping Center Norte');        // → 'CNO'
getShoppingCode('Shopping Aricanduva');          // → 'ARI'
getShoppingCode('Plaza Sul Shopping');           // → 'PLS'

// Rules:
// 1. Remove common words: 'Shopping', 'Center', 'Mall', 'Plaza'
// 2. Take first 3 consonants of remaining words
// 3. Uppercase
```

### Category Prefix Mapping

| Category | Prefix | Example ID |
|----------|--------|------------|
| Entrada | `ENT` | `IGU-ENT-01` |
| Lojas | `LOJ` | `IGU-LOJ-0892` |
| Climatizacao | `CLI` | `IGU-CLI-045` |
| - Chillers | `CHI` | `IGU-CHI-01` |
| - Fancoils | `FAN` | `IGU-FAN-156` |
| - CAG | `CAG` | `IGU-CAG-01` |
| - Bombas Hidraulicas | `BHI` | `IGU-BHI-03` |
| Elevadores | `ELV` | `IGU-ELV-12` |
| Escadas Rolantes | `ESC` | `IGU-ESC-08` |
| Outros | `OUT` | `IGU-OUT-21` |
| - Iluminacao | `ILU` | `IGU-ILU-04` |
| - Bombas Incendio | `BIN` | `IGU-BIN-02` |
| - Geradores | `GER` | `IGU-GER-01` |

## Reference-level Explanation

### New Functions in `equipmentCategory.js`

#### 1. `buildDeviceIdentifier(device, options)`

```javascript
/**
 * Build a unique concatenated identifier for a device.
 *
 * Priority order:
 * 1. device.identifier (if exists and valid)
 * 2. device.deviceIdentifier (if exists)
 * 3. Generated: {shoppingCode}-{categoryPrefix}-{sequence}
 * 4. Normalized label (fallback)
 * 5. Truncated entityId (last resort)
 *
 * @param {Object} device - Device object
 * @param {string} [device.identifier] - Server scope identifier attribute
 * @param {string} [device.deviceIdentifier] - ThingsBoard device identifier
 * @param {string} [device.deviceLabel] - Device label/name
 * @param {string} [device.entityId] - ThingsBoard entity UUID
 * @param {string} [device.customerName] - Shopping/customer name
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.includeShoppingCode=true] - Include shopping prefix
 * @param {boolean} [options.includeCategoryPrefix=true] - Include category prefix
 * @param {number} [options.sequenceNumber] - Override sequence number
 * @returns {string} Concatenated unique identifier
 *
 * @example
 * buildDeviceIdentifier({
 *   identifier: 'CAG-01',
 *   deviceLabel: 'Chiller Principal',
 *   customerName: 'Shopping Iguatemi'
 * });
 * // → 'CAG-01' (uses existing identifier)
 *
 * @example
 * buildDeviceIdentifier({
 *   deviceLabel: 'Fancoil Piso 3',
 *   customerName: 'Shopping Iguatemi',
 *   deviceType: 'FANCOIL'
 * }, { sequenceNumber: 45 });
 * // → 'IGU-FAN-045'
 */
export function buildDeviceIdentifier(device, options = {}) {
  const {
    includeShoppingCode = true,
    includeCategoryPrefix = true,
    sequenceNumber = null,
  } = options;

  // Priority 1: Use existing identifier
  if (device.identifier && isValidIdentifier(device.identifier)) {
    return device.identifier.toUpperCase();
  }

  // Priority 2: Use deviceIdentifier
  if (device.deviceIdentifier && isValidIdentifier(device.deviceIdentifier)) {
    return device.deviceIdentifier.toUpperCase();
  }

  // Priority 3: Generate concatenated identifier
  const parts = [];

  if (includeShoppingCode && device.customerName) {
    parts.push(getShoppingCode(device.customerName));
  }

  if (includeCategoryPrefix) {
    const category = classifyEquipment(device);
    const subcategory = classifyEquipmentSubcategory(device, category);
    parts.push(getCategoryPrefix(category, subcategory));
  }

  if (sequenceNumber !== null) {
    parts.push(String(sequenceNumber).padStart(3, '0'));
  } else if (device._sequenceNumber) {
    parts.push(String(device._sequenceNumber).padStart(3, '0'));
  }

  if (parts.length > 0) {
    return parts.join('-');
  }

  // Priority 4: Normalize label
  if (device.deviceLabel || device.labelOrName) {
    return normalizeToIdentifier(device.deviceLabel || device.labelOrName);
  }

  // Priority 5: Truncated entityId
  if (device.entityId) {
    return device.entityId.substring(0, 8).toUpperCase();
  }

  return 'UNKNOWN';
}
```

#### 2. `getShoppingCode(customerName)`

```javascript
/**
 * Derive a 3-letter shopping code from customer name.
 *
 * @param {string} customerName - Full customer/shopping name
 * @returns {string} 3-letter uppercase code
 *
 * @example
 * getShoppingCode('Shopping Iguatemi Campinas'); // → 'IGU'
 * getShoppingCode('Shopping Center Norte');       // → 'CNO'
 * getShoppingCode('Aricanduva Shopping');         // → 'ARI'
 */
export function getShoppingCode(customerName) {
  if (!customerName) return 'UNK';

  const REMOVE_WORDS = ['SHOPPING', 'CENTER', 'MALL', 'PLAZA', 'OUTLET', 'PARK'];

  let normalized = customerName.toUpperCase();
  REMOVE_WORDS.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  });

  // Extract consonants from remaining words
  const consonants = normalized.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');

  if (consonants.length >= 3) {
    return consonants.substring(0, 3);
  }

  // Fallback: first 3 alphanumeric chars
  const alphanumeric = normalized.replace(/[^A-Z0-9]/g, '');
  return (alphanumeric.substring(0, 3) || 'UNK').padEnd(3, 'X');
}
```

#### 3. `getCategoryPrefix(category, subcategory)`

```javascript
/**
 * Get the 3-letter prefix for a category/subcategory.
 *
 * @param {string} category - Equipment category from EquipmentCategory enum
 * @param {string|null} subcategory - Subcategory name (optional)
 * @returns {string} 3-letter uppercase prefix
 */
export function getCategoryPrefix(category, subcategory = null) {
  const SUBCATEGORY_PREFIXES = {
    'Chillers': 'CHI',
    'Fancoils': 'FAN',
    'CAG': 'CAG',
    'Bombas Hidraulicas': 'BHI',
    'Outros HVAC': 'HVC',
    'Iluminacao': 'ILU',
    'Bombas de Incendio': 'BIN',
    'Geradores/Nobreaks': 'GER',
    'Geral': 'GER',
  };

  if (subcategory && SUBCATEGORY_PREFIXES[subcategory]) {
    return SUBCATEGORY_PREFIXES[subcategory];
  }

  const CATEGORY_PREFIXES = {
    [EquipmentCategory.ENTRADA]: 'ENT',
    [EquipmentCategory.LOJAS]: 'LOJ',
    [EquipmentCategory.CLIMATIZACAO]: 'CLI',
    [EquipmentCategory.ELEVADORES]: 'ELV',
    [EquipmentCategory.ESCADAS_ROLANTES]: 'ESC',
    [EquipmentCategory.OUTROS]: 'OUT',
    [EquipmentCategory.AREA_COMUM]: 'ACM',
  };

  return CATEGORY_PREFIXES[category] || 'UNK';
}
```

#### 4. `buildPDFReportData(devices, options)`

```javascript
/**
 * Build data structure for PDF report generation.
 *
 * @param {Object[]} devices - Array of device objects
 * @param {Object} options - Report options
 * @param {string} options.reportType - 'summary' | 'detailed' | 'comparison'
 * @param {string} options.period - Report period (e.g., 'January 2026')
 * @param {string} options.shoppingName - Shopping/customer name
 * @param {boolean} [options.includeDeviceList=false] - Include device-level details
 * @param {boolean} [options.includeSubcategories=true] - Include subcategory breakdown
 * @returns {Object} Report data structure
 */
export function buildPDFReportData(devices, options) {
  const {
    reportType = 'summary',
    period,
    shoppingName,
    includeDeviceList = false,
    includeSubcategories = true,
  } = options;

  const summary = buildEquipmentCategorySummary(devices);

  // Assign sequence numbers to devices
  const categoryCounters = {};
  devices.forEach(device => {
    const category = classifyEquipment(device);
    if (!categoryCounters[category]) categoryCounters[category] = 0;
    device._sequenceNumber = ++categoryCounters[category];
    device._concatenatedId = buildDeviceIdentifier(device);
  });

  return {
    metadata: {
      reportType,
      period,
      shoppingName,
      generatedAt: new Date().toISOString(),
      generatedBy: 'MYIO Energy Management',
      version: '1.0.0',
    },
    totals: {
      consumption: summary[EquipmentCategory.ENTRADA].consumption,
      deviceCount: devices.length,
      categoryCount: Object.keys(summary).filter(k => summary[k].count > 0).length,
    },
    categories: Object.entries(summary).map(([category, data]) => ({
      id: category,
      ...getCategoryDisplayInfo(category),
      consumption: data.consumption,
      percentage: data.percentage,
      deviceCount: data.count,
      subcategories: includeSubcategories
        ? Object.entries(data.subcategories).map(([name, sub]) => ({
            name,
            consumption: sub.consumption,
            percentage: data.consumption > 0 ? (sub.consumption / data.consumption) * 100 : 0,
            deviceCount: sub.count,
            devices: includeDeviceList
              ? sub.devices.map(d => ({
                  id: d._concatenatedId,
                  name: d.deviceLabel || d.labelOrName,
                  consumption: d.value || d.consumption || 0,
                }))
              : undefined,
          }))
        : undefined,
      devices: includeDeviceList && !includeSubcategories
        ? data.devices.map(d => ({
            id: d._concatenatedId,
            name: d.deviceLabel || d.labelOrName,
            consumption: d.value || d.consumption || 0,
          }))
        : undefined,
    })),
  };
}
```

#### 5. `exportToPDF(reportData, filename)`

```javascript
/**
 * Generate and download PDF report.
 * Uses jsPDF and html2canvas for client-side generation.
 *
 * @param {Object} reportData - Data from buildPDFReportData()
 * @param {string} [filename] - Output filename (without extension)
 * @returns {Promise<Blob>} PDF blob
 */
export async function exportToPDF(reportData, filename) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Generate PDF pages based on reportType
  // ... implementation details ...

  const outputFilename = filename ||
    `MYIO_Report_${reportData.metadata.shoppingName}_${reportData.metadata.period}`.replace(/\s+/g, '_');

  doc.save(`${outputFilename}.pdf`);
  return doc.output('blob');
}
```

### Integration with Existing Code

```javascript
// In MAIN_UNIQUE_DATASOURCE/controller.js or TelemetryGridView.ts

import {
  buildEquipmentCategorySummary,
  buildPDFReportData,
  exportToPDF,
  buildDeviceIdentifier,
} from 'myio-js-library';

// Generate PDF report
async function handleExportPDF() {
  const devices = window.MyIOOrchestratorData?.classified?.energy?.equipments || [];

  const reportData = buildPDFReportData(devices, {
    reportType: 'detailed',
    period: 'Janeiro 2026',
    shoppingName: currentCustomerName,
    includeDeviceList: true,
    includeSubcategories: true,
  });

  await exportToPDF(reportData);
}
```

## Drawbacks

1. **Bundle size increase**: jsPDF (~280KB) and html2canvas (~40KB) add to bundle
2. **Client-side generation**: Large reports may be slow on mobile devices
3. **Browser compatibility**: Requires modern browser features (Canvas, Blob)
4. **Memory usage**: Large device lists may cause memory issues

## Rationale and Alternatives

### Why client-side PDF generation?

- **No server dependency**: Works offline
- **Instant generation**: No API calls
- **Privacy**: Data never leaves client

### Alternative: Server-side PDF

Rejected because:
- Requires backend infrastructure
- API latency for large reports
- Deployment complexity

### Alternative: HTML export with print-to-PDF

Rejected because:
- Inconsistent output across browsers
- No control over page breaks
- Poor chart rendering

## Prior Art

- **RFC-0128**: Equipment category classification
- **RFC-0063**: Identifier-based classification
- **RFC-0111**: Domain/context detection
- **jsPDF**: Industry-standard PDF generation library

## Unresolved Questions

1. Should we support Excel export alongside PDF?
2. How to handle very large device lists (10,000+ devices)?
3. Should chart generation use Chart.js or canvas directly?
4. How to localize reports for different languages?

## Future Possibilities

1. **Scheduled reports**: Email PDF reports on schedule
2. **Template customization**: Custom branding and layouts
3. **Comparison reports**: Month-over-month analysis
4. **Mobile app export**: React Native support

---

## Implementation Checklist

- [ ] Add `buildDeviceIdentifier()` function
- [ ] Add `getShoppingCode()` function
- [ ] Add `getCategoryPrefix()` function
- [ ] Add `buildPDFReportData()` function
- [ ] Add `exportToPDF()` function
- [ ] Add jsPDF/html2canvas as optional peer dependencies
- [ ] Update `src/index.ts` exports
- [ ] Add unit tests for identifier generation
- [ ] Add integration tests for PDF generation
- [ ] Update CLAUDE.md with new functions
- [ ] Create showcase/pdf-export.html demo

---

## Appendix: Concatenated Identifier Examples

### Energy Devices

| Device Type | Identifier | Label | Customer | Generated ID |
|-------------|------------|-------|----------|--------------|
| CHILLER | `CAG-01` | Chiller Principal | Shopping Iguatemi | `CAG-01` |
| FANCOIL | - | Fancoil Piso 3 | Shopping Iguatemi | `IGU-FAN-045` |
| ELEVADOR | `ELV-12` | Elevador Social 12 | Center Norte | `ELV-12` |
| BOMBA | - | Bomba CAG Torre A | Aricanduva | `ARI-BHI-003` |
| 3F_MEDIDOR | - | Loja 0892 | Shopping Iguatemi | `IGU-LOJ-892` |
| ESCADA_ROLANTE | `ESC-08` | Escada Rolante P2 | Plaza Sul | `ESC-08` |
| GERADOR | - | Gerador Emergencia | Center Norte | `CNO-GER-001` |

### Water Devices

| Device Type | Identifier | Label | Customer | Generated ID |
|-------------|------------|-------|----------|--------------|
| HIDROMETRO_SHOPPING | `HID-ENT-01` | Hidrometro Entrada | Shopping Iguatemi | `HID-ENT-01` |
| HIDROMETRO | - | Hidrometro Loja 45 | Shopping Iguatemi | `IGU-HID-045` |
| HIDROMETRO_AREA_COMUM | - | Banheiro Feminino P1 | Center Norte | `CNO-BAN-012` |

---

**RFC Status:** Draft
**Author:** MYIO Team
**Last Updated:** 2026-01-09
