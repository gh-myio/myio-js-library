# ThingsBoard API Components

This directory contains utilities for interacting with ThingsBoard APIs.

## fetchThingsboardCustomerServerScopeAttrs

A utility function to fetch customer server scope attributes from ThingsBoard API. Handles both array and object response formats with proper error handling.

### Usage

#### MyIOLibrary (Recommended)
```javascript
// Available as part of the MyIOLibrary global object
const attrs = await MyIOLibrary.fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-uuid',
  tbToken: 'jwt-token-from-localStorage'
});

console.log(attrs.client_id, attrs.client_secret, attrs.ingestionId);
```

#### ES Module Import
```javascript
import { fetchThingsboardCustomerServerScopeAttrs } from './api/fetchThingsboardCustomerServerScopeAttrs.js';

const attrs = await fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-uuid',
  tbToken: 'jwt-token-from-localStorage'
});
```

#### Global Function (For ThingsBoard Widgets)
```javascript
// Include the script in your widget resources, then:
const attrs = await window.fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-uuid',
  tbToken: 'jwt-token-from-localStorage'
});
```

### Function Signatures

```typescript
function fetchThingsboardCustomerServerScopeAttrs(
  config: ThingsboardCustomerAttrsConfig
): Promise<Record<string, any>>

interface ThingsboardCustomerAttrsConfig {
  customerId: string;
  tbToken: string;
  baseUrl?: string;
}

function fetchThingsboardCustomerAttrsFromStorage(
  customerId: string,
  tokenKey?: string
): Promise<Record<string, any>>

function extractMyIOCredentials(
  attributes: Record<string, any> | null | undefined
): {
  clientId: string;
  clientSecret: string;
  ingestionId: string;
}
```

### Parameters

- **customerId**: ThingsBoard customer UUID
- **tbToken**: JWT token for authentication (from localStorage or manual)
- **baseUrl** *(optional)*: Base URL for ThingsBoard API (default: empty string for relative URLs)
- **tokenKey** *(optional)*: localStorage key for JWT token (default: 'jwt_token')

### Returns

A Promise resolving to an attributes map with key-value pairs from ThingsBoard.

### Examples

#### Basic Usage
```javascript
// In a ThingsBoard widget
const attrs = await MyIOLibrary.fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-uuid-123',
  tbToken: 'jwt-token-456'
});

console.log('Client ID:', attrs.client_id);
console.log('Client Secret:', attrs.client_secret);
console.log('Ingestion ID:', attrs.ingestionId);
```

#### Automatic Token Retrieval
```javascript
// Automatically get token from localStorage
const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage('customer-uuid-123');

// Use custom token key
const attrs2 = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(
  'customer-uuid-123', 
  'custom_jwt_key'
);
```

#### Extract MyIO Credentials
```javascript
const attrs = await MyIOLibrary.fetchThingsboardCustomerServerScopeAttrs(config);
const creds = MyIOLibrary.extractMyIOCredentials(attrs);

console.log('Client ID:', creds.clientId);
console.log('Client Secret:', creds.clientSecret);
console.log('Ingestion ID:', creds.ingestionId);
```

## Key Features

### **Dual Response Format Support**
- **Array Format**: `[{key: "client_id", value: "abc123"}, ...]`
- **Object Format**: `{client_id: [{value: "abc123"}], ...}`
- **Direct Object**: `{client_id: "abc123", ...}`
- Automatic detection and normalization

### **Robust Error Handling**
- Graceful handling of 404/403 errors (returns empty object)
- Proper error propagation for server errors (5xx)
- Network error handling with context
- Malformed JSON response handling

### **Convenience Functions**
- `fetchThingsboardCustomerAttrsFromStorage()` - Automatic token retrieval
- `extractMyIOCredentials()` - Extract common MyIO credentials
- Support for custom localStorage token keys

### **Production Ready**
- Full TypeScript support with proper type definitions
- Comprehensive unit test coverage (23 test cases)
- Browser and Node.js compatibility
- Null/undefined safety

## Response Format Handling

The ThingsBoard API can return attributes in different formats:

### Array Format
```json
[
  {"key": "client_id", "value": "abc123"},
  {"key": "client_secret", "value": "def456"},
  {"key": "ingestionId", "value": "ghi789"}
]
```

### Object Format
```json
{
  "client_id": [{"value": "abc123"}],
  "client_secret": [{"value": "def456"}],
  "ingestionId": [{"value": "ghi789"}]
}
```

### Direct Object Format
```json
{
  "client_id": "abc123",
  "client_secret": "def456",
  "ingestionId": "ghi789"
}
```

All formats are automatically normalized to a simple key-value object:
```javascript
{
  client_id: "abc123",
  client_secret: "def456",
  ingestionId: "ghi789"
}
```

## Error Handling

### Non-Critical Errors (404, 403)
```javascript
// Returns empty object instead of throwing
const attrs = await fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'nonexistent-customer',
  tbToken: 'valid-token'
});
// attrs = {}
```

### Server Errors (5xx)
```javascript
try {
  const attrs = await fetchThingsboardCustomerServerScopeAttrs(config);
} catch (error) {
  console.error('Server error:', error.message);
  // "Failed to fetch customer attributes: ThingsBoard API error: HTTP 500 Internal Server Error"
}
```

### Network Errors
```javascript
try {
  const attrs = await fetchThingsboardCustomerServerScopeAttrs(config);
} catch (error) {
  console.error('Network error:', error.message);
  // "Failed to fetch customer attributes: Network error"
}
```

## Migration from Inline Implementation

If you're migrating from the inline `fetchCustomerServerScopeAttrs` implementation:

**Before:**
```javascript
async function fetchCustomerServerScopeAttrs() {
  const tbToken = localStorage.getItem("jwt_token");
  // ... inline implementation
  return map;
}

const attrs = await fetchCustomerServerScopeAttrs();
```

**After:**
```javascript
// Use extracted component with fallback
async function fetchCustomerServerScopeAttrs() {
  if (typeof MyIOLibrary?.fetchThingsboardCustomerAttrsFromStorage === 'function') {
    try {
      return await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(CUSTOMER_ID);
    } catch (error) {
      console.warn('Using extracted component failed:', error.message);
      // Fall back to inline implementation
    }
  }
  
  // Fallback: inline implementation for compatibility
  // ... original code
}
```

## Testing

The ThingsBoard API component includes comprehensive unit tests covering:

- Array and object response format handling
- Direct value object format support
- Custom baseUrl configuration
- Error handling (404, 403, 5xx, network errors)
- Malformed JSON responses
- Empty and unexpected response formats
- localStorage integration
- Credential extraction with multiple key formats
- Null/undefined safety

Run tests with:
```bash
npm test -- fetchThingsboardCustomerServerScopeAttrs.test.js
```

## Files

- `fetchThingsboardCustomerServerScopeAttrs.ts` - TypeScript version with full type definitions
- `fetchThingsboardCustomerServerScopeAttrs.js` - JavaScript version for broader compatibility
- `../../../tests/fetchThingsboardCustomerServerScopeAttrs.test.js` - Comprehensive unit tests

## Integration Examples

### ThingsBoard Widget Integration

```javascript
// In widget controller.js
self.onInit = async function() {
  CUSTOMER_ID = self.ctx.settings.customerId || " ";
  
  // Use extracted component with fallback
  const customerCredentials = await fetchCustomerServerScopeAttrs();
  
  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";
  
  // ... rest of initialization
};

async function fetchCustomerServerScopeAttrs() {
  if (typeof MyIOLibrary?.fetchThingsboardCustomerAttrsFromStorage === 'function') {
    try {
      return await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(CUSTOMER_ID);
    } catch (error) {
      console.warn('Using extracted component failed:', error.message);
    }
  }
  
  // Fallback implementation...
}
```

### Modal Component Integration

```javascript
// In modal components
const attrs = await MyIOLibrary.fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-123',
  tbToken: 'jwt-token'
});

const creds = MyIOLibrary.extractMyIOCredentials(attrs);

const modal = MyIOLibrary.openDashboardPopupAllReport({
  customerId: creds.ingestionId,
  api: {
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com'
  },
  // ... other parameters
});
```

### Custom Base URL

```javascript
// For custom ThingsBoard installations
const attrs = await MyIOLibrary.fetchThingsboardCustomerServerScopeAttrs({
  customerId: 'customer-123',
  tbToken: 'jwt-token',
  baseUrl: 'https://custom.thingsboard.com'
});
```

This ThingsBoard API component provides a robust, efficient, and reusable solution for fetching customer attributes across all ThingsBoard widgets and modal components, with proper error handling and format normalization.
