# MyIO JS Library Refactoring Plan
## Reducing Duplicate Functionality in PRE_SETUP/controller.js

### A. Export Inventory Table

| exportedName | source(file) | summary | usedBy(controller? yes/no) | replaceable? | replacement(lib+API) | class (drop-in/adapter/NR) |
|--------------|--------------|---------|---------------------------|--------------|---------------------|---------------------------|
| decodePayload | index.ts | Decodes XOR+Base64 payload | yes | yes | Use index.ts export directly | drop-in |
| decodePayloadBase64Xor | index.ts | Alias for decodePayload | yes | yes | Use index.ts export directly | drop-in |
| formatDateToYMD | index.ts | Formats date to YYYY-MM-DD | no | yes | Replace tsStamp() with this + time formatting | adapter |
| getSaoPauloISOString | index.ts | Gets São Paulo timezone ISO string | no | yes | Replace tsStampBR() locale logic | adapter |
| formatNumberReadable | index.ts | Formats numbers for readability | no | yes | Replace manual number formatting in PDF generation | adapter |
| http | index.ts | HTTP client with retry | no | yes | Replace manual fetch calls in API functions | adapter |
| fetchWithRetry | index.ts | Fetch with retry mechanism | no | yes | Replace manual retry logic in MyIOAuth | adapter |
| normalizeRecipients | index.ts | Normalizes recipient strings | no | maybe | Could replace sanitizeForFile() logic | adapter |
| toFixedSafe | index.ts | Safe decimal formatting | no | yes | Replace manual number formatting | drop-in |
| strings namespace | index.ts | String utilities | no | maybe | Could replace custom string manipulation | adapter |
| numbers namespace | index.ts | Number utilities | no | maybe | Could replace custom number operations | adapter |

### B. Replacement Details

#### 1. Codec Functions - Direct Duplication
**Before (controller.js lines ~180-185):**
```javascript
function encodePayload(payload, xorKey = 73) {
  const bytes = new TextEncoder().encode(payload);
  const encoded = bytes.map((b) => b ^ xorKey);
  return btoa(String.fromCharCode(...encoded));
}
```

**After:**
```javascript
// Remove from controller.js entirely
// Use: import { decodePayloadBase64Xor } from 'myio-js-library'
```

#### 2. Date Formatting Functions
**Before (controller.js lines ~50-60):**
```javascript
function tsStampBR(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const MM = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}/${MM}/${yyyy} ${hh}:${mm}:${ss}`;
}
```

**After:**
```javascript
import { getSaoPauloISOString } from 'myio-js-library';

function tsStampBR(d = new Date()) {
  const isoString = getSaoPauloISOString(d);
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
```

#### 3. HTTP Calls with Retry Logic
**Before (controller.js MyIOAuth module lines ~70-120):**
```javascript
async function _requestNewToken() {
  let attempt = 0;
  while (true) {
    try {
      const resp = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // ... retry logic
    } catch (err) {
      attempt++;
      if (attempt >= RETRY_MAX_ATTEMPTS) throw err;
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await _sleep(backoff);
    }
  }
}
```

**After:**
```javascript
import { fetchWithRetry } from 'myio-js-library';

async function _requestNewToken() {
  const response = await fetchWithRetry(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, {
    maxAttempts: RETRY_MAX_ATTEMPTS,
    baseDelay: RETRY_BASE_MS,
    backoffFactor: 2
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Auth failed: HTTP ${response.status} ${response.statusText} ${text}`);
  }
  
  return await response.json();
}
```

### C. Migration Plan

#### Phase 1: Low-Risk Replacements (Week 1-2)
**Tasks:**
- Replace `decodePayload` in controller.js with index.ts export
- Replace manual number formatting with `toFixedSafe` and `formatNumberReadable`
- Update imports to use library functions

**Files to edit:**
- `src/PRE_SETUP/controller.js` (remove duplicate functions)
- Add proper imports at top of file

**Tests:**
- Unit tests for codec functions (verify identical behavior)
- Integration tests for PDF generation (ensure formatting unchanged)

**Rollback plan:** Keep original functions commented out for 1 sprint

#### Phase 2: HTTP and Authentication Refactoring (Week 3-4)
**Tasks:**
- Replace manual retry logic in MyIOAuth with `fetchWithRetry`
- Standardize all API calls to use `http` utility
- Consolidate error handling patterns

**Files to edit:**
- `src/PRE_SETUP/controller.js` (MyIOAuth module, API functions)

**Tests:**
- Mock API tests to verify retry behavior
- Authentication flow integration tests
- Error handling edge cases

**Rollback plan:** Feature flag to toggle between old/new HTTP logic

#### Phase 3: Date and String Utilities (Week 5-6)
**Tasks:**
- Replace `tsStampBR` and `tsStamp` with library functions
- Replace `sanitizeForFile` with `normalizeRecipients` or `strings` utilities
- Consolidate all date formatting

**Files to edit:**
- `src/PRE_SETUP/controller.js` (utility functions, PDF generation)

**Tests:**
- Date formatting unit tests (multiple timezones)
- File naming integration tests
- PDF generation visual regression tests

**Rollback plan:** Maintain adapter functions during transition period

#### Phase 4: Code Organization and Cleanup (Week 7-8)
**Tasks:**
- Extract UI logic into separate modules
- Consolidate API interaction patterns
- Remove dead code and unused functions
- Optimize imports and dependencies

**Files to edit:**
- `src/PRE_SETUP/controller.js` (major restructuring)
- Create new utility modules as needed

**Tests:**
- Full integration test suite
- Performance benchmarks
- Bundle size analysis

### D. Test Matrix

| Function | Happy Path | Edge Cases | Error Handling | i18n/Locale | Performance |
|----------|------------|------------|----------------|-------------|-------------|
| decodePayload | ✓ Valid XOR+Base64 | ✓ Invalid Base64, Empty string | ✓ Malformed input | N/A | ✓ Large payloads |
| tsStampBR | ✓ Current date | ✓ Leap year, DST transitions | ✓ Invalid date objects | ✓ PT-BR locale | ✓ Bulk formatting |
| fetchWithRetry | ✓ Successful request | ✓ Network timeouts, 5xx errors | ✓ Max retries exceeded | N/A | ✓ Concurrent requests |
| sanitizeForFile | ✓ Normal strings | ✓ Unicode, Special chars | ✓ Null/undefined input | ✓ Accented characters | ✓ Long strings |
| PDF generation | ✓ Standard structure | ✓ Empty data, Large datasets | ✓ QR code failures | ✓ Non-ASCII device names | ✓ Memory usage |

### E. Deprecation Notice Draft

```markdown
## Deprecation Notice - MyIO JS Library v2.1.0

### Deprecated Functions in PRE_SETUP/controller.js

The following functions are deprecated and will be removed in v3.0.0:

#### `decodePayload(payload, xorKey)` 
**Deprecated:** Use `decodePayloadBase64Xor` from the main library export instead.
```javascript
// Old
import controller from './PRE_SETUP/controller.js';
controller.decodePayload(data);

// New  
import { decodePayloadBase64Xor } from 'myio-js-library';
decodePayloadBase64Xor(data);
```

#### `tsStampBR(date)` and `tsStamp(date)`
**Deprecated:** Use `getSaoPauloISOString` and standard date formatting instead.
```javascript
// Old
const timestamp = tsStampBR();

// New
import { getSaoPauloISOString } from 'myio-js-library';
const timestamp = new Date(getSaoPauloISOString()).toLocaleString('pt-BR');
```

#### Manual retry logic in API calls
**Deprecated:** Use `fetchWithRetry` or `http` utilities instead.
```javascript
// Old
// Manual retry loops with setTimeout

// New
import { fetchWithRetry } from 'myio-js-library';
const response = await fetchWithRetry(url, options, retryConfig);
```

### Migration Timeline
- **v2.1.0** (Current): Deprecation warnings added
- **v2.2.0** (Month 2): Alternative implementations available
- **v2.3.0** (Month 4): Legacy functions marked as deprecated in JSDoc
- **v3.0.0** (Month 6): Legacy functions removed

### Support
For migration assistance, see the [Migration Guide](./MIGRATION.md) or contact the development team.
```

### F. Open Questions

1. **Authentication Strategy**: Should the `MyIOAuth` module be extracted into a separate, reusable authentication utility in the main library, or kept as application-specific code?

2. **PDF Generation Dependencies**: The PDF generation logic heavily depends on `jsPDF` and `QRious` libraries. Should these be made peer dependencies of the main library, or kept isolated in the controller?

3. **UI Framework Integration**: The modal and tree rendering logic is tightly coupled to vanilla DOM manipulation. Should this be refactored to be framework-agnostic or moved to a separate UI package?

4. **API Endpoint Configuration**: The hardcoded API endpoints (ThingsBoard, Ingestion API, provision_central) should be configurable. Should this configuration be part of the main library or remain application-specific?

5. **Error Handling Standardization**: Different parts of the code use different error handling patterns (alerts, console.error, thrown exceptions). Should we standardize on a single approach?

6. **Bundle Size Impact**: What is the acceptable increase in bundle size when importing additional utilities from the main library? Should we implement tree-shaking optimizations?

7. **Backward Compatibility**: For functions that are heavily used in production, should we maintain adapter functions indefinitely or set a firm deprecation timeline?

8. **Testing Strategy**: Should the refactored code maintain 100% backward compatibility, or are minor breaking changes acceptable if they improve the overall architecture?

### Estimated Impact

**Lines of Code Reduction:**
- Phase 1: ~50-100 lines (codec and formatting functions)
- Phase 2: ~100-200 lines (HTTP retry logic consolidation)  
- Phase 3: ~75-150 lines (date/string utilities)
- Phase 4: ~200-400 lines (code organization and cleanup)

**Total Estimated Reduction: 425-850 lines (~15-30% of current file)**

**Risk Assessment:**
- **Low Risk**: Codec functions, number formatting (drop-in replacements)
- **Medium Risk**: Date formatting, HTTP utilities (adapter needed)
- **High Risk**: Major code reorganization, UI logic extraction

**Dependencies Added:**
- No new external dependencies (using existing library exports)
- Potential peer dependency clarification needed for PDF/QR libraries
