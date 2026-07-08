# MyIO Authentication Components

This directory contains authentication utilities for MyIO Data API integration.

## buildMyioIngestionAuth

A factory function that creates authentication instances with shared token caching based on credentials. Multiple instances with the same credentials will share the same token cache for efficiency.

### Usage

#### MyIOLibrary (Recommended)
```javascript
// Available as part of the MyIOLibrary global object
const auth = MyIOLibrary.buildMyioIngestionAuth({
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

const token = await auth.getToken();
```

#### ES Module Import
```javascript
import { buildMyioIngestionAuth } from './auth/buildMyioIngestionAuth.js';

const auth = buildMyioIngestionAuth({
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});
```

#### Global Function (For ThingsBoard Widgets)
```javascript
// Include the script in your widget resources, then:
const auth = window.buildMyioIngestionAuth({
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});
```

### Function Signature

```typescript
function buildMyioIngestionAuth(config: MyIOAuthConfig): MyIOAuthInstance

interface MyIOAuthConfig {
  dataApiHost: string;
  clientId: string;
  clientSecret: string;
  renewSkewSeconds?: number;    // Default: 60
  retryBaseMs?: number;         // Default: 500
  retryMaxAttempts?: number;    // Default: 3
}

interface MyIOAuthInstance {
  getToken(): Promise<string>;
  getExpiryInfo(): { expiresAt: number; expiresInSeconds: number };
  clearCache(): void;
  isTokenValid(): boolean;
}
```

### Parameters

- **dataApiHost**: MyIO Data API base URL (e.g., 'https://api.data.apps.myio-bas.com')
- **clientId**: OAuth2 client ID for authentication
- **clientSecret**: OAuth2 client secret for authentication
- **renewSkewSeconds** *(optional)*: Seconds before expiry to renew token (default: 60)
- **retryBaseMs** *(optional)*: Base retry delay in milliseconds (default: 500)
- **retryMaxAttempts** *(optional)*: Maximum retry attempts (default: 3)

### Returns

An authentication instance with the following methods:

- **getToken()**: Returns a valid access token (fetches new one if needed)
- **getExpiryInfo()**: Returns token expiration information
- **clearCache()**: Clears the cached token for this instance
- **isTokenValid()**: Checks if the current token is valid

### Example

```javascript
// In a ThingsBoard widget
const auth = MyIOLibrary.buildMyioIngestionAuth({
  dataApiHost: 'https://api.data.apps.myio-bas.com',
  clientId: 'demo-client-id',
  clientSecret: 'demo-client-secret'
});

// Get token for API calls
const token = await auth.getToken();

// Use token in API requests
const response = await fetch('/api/v1/some-endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Check token status
console.log('Token valid:', auth.isTokenValid());
console.log('Expires in:', auth.getExpiryInfo().expiresInSeconds, 'seconds');
```

## Key Features

### **Shared Token Caching**
- Multiple instances with the same credentials share the same token cache
- Reduces API calls and improves performance
- Automatic cache key generation based on credentials

### **Automatic Token Renewal**
- Tokens are automatically renewed before expiration
- Configurable renewal skew (default: 60 seconds before expiry)
- Race condition protection prevents duplicate renewal requests

### **Robust Error Handling**
- Exponential backoff retry logic for network failures
- Configurable retry attempts and delays
- Detailed error messages for debugging

### **Memory Management**
- Efficient cache cleanup with `clearCache()` and `clearAllAuthCaches()`
- Cache statistics available via `getAuthCacheStats()`
- No memory leaks with proper cleanup

### **Production Ready**
- Full TypeScript support with proper type definitions
- Comprehensive unit test coverage (16 test cases)
- Browser and Node.js compatibility

## Cache Behavior

The authentication component uses a **global cache** shared across all instances:

```javascript
// These two instances will share the same token cache
const auth1 = buildMyioIngestionAuth({
  dataApiHost: 'https://api.example.com',
  clientId: 'client1',
  clientSecret: 'secret1'
});

const auth2 = buildMyioIngestionAuth({
  dataApiHost: 'https://api.example.com',
  clientId: 'client1',
  clientSecret: 'secret1'
});

// Only one API call will be made, token is shared
const token1 = await auth1.getToken(); // API call
const token2 = await auth2.getToken(); // Uses cached token
```

### Cache Management

```javascript
// Clear cache for specific instance
auth.clearCache();

// Clear all caches globally (useful for logout)
MyIOLibrary.clearAllAuthCaches();

// Get cache statistics
const stats = MyIOLibrary.getAuthCacheStats();
console.log(`Total caches: ${stats.totalCaches}`);
console.log(`Cache keys: ${stats.cacheKeys}`);
```

## Migration from Inline Auth

If you're migrating from the inline MyIOAuth implementation:

**Before:**
```javascript
const MyIOAuth = (() => {
  // ... inline implementation
  return { getToken, clearCache };
})();

const token = await MyIOAuth.getToken();
```

**After:**
```javascript
// Initialize with extracted component
const MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
  dataApiHost: DATA_API_HOST,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
});

const token = await MyIOAuth.getToken();
```

## Testing

The authentication component includes comprehensive unit tests covering:

- Token caching and sharing between instances
- Automatic token renewal and expiration handling
- Error handling and retry logic
- Race condition prevention
- Cache management and cleanup
- HTTP error responses and malformed data

Run tests with:
```bash
npm test -- buildMyioIngestionAuth.test.js
```

## Files

- `buildMyioIngestionAuth.ts` - TypeScript version with full type definitions
- `buildMyioIngestionAuth.js` - JavaScript version for broader compatibility
- `../../../tests/buildMyioIngestionAuth.test.js` - Comprehensive unit tests

## Integration Examples

### ThingsBoard Widget Integration

```javascript
// In widget controller.js
let MyIOAuth = null;

self.onInit = async function() {
  // Get credentials from ThingsBoard
  const credentials = await fetchCustomerServerScopeAttrs();
  
  // Initialize authentication
  MyIOAuth = MyIOLibrary.buildMyioIngestionAuth({
    dataApiHost: 'https://api.data.apps.myio-bas.com',
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret
  });
  
  // Use in API calls
  const token = await MyIOAuth.getToken();
  // ... make authenticated requests
};
```

### Modal Component Integration

```javascript
// In modal components
const modal = MyIOLibrary.openDashboardPopupAllReport({
  customerId: 'customer-123',
  api: {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    dataApiBaseUrl: 'https://api.data.apps.myio-bas.com',
    ingestionToken: await auth.getToken() // Use extracted auth
  },
  // ... other parameters
});
```

This authentication component provides a robust, efficient, and reusable solution for MyIO Data API authentication across all ThingsBoard widgets and modal components.
