# RFC-0002: Alarm Profiles Panel Authentication Bypass

- **Feature Name:** `alarm_panel_auth_bypass`
- **Start Date:** 2025-12-09
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 1.0.0
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)

---

## Summary

This RFC proposes an authentication bypass mechanism for the Alarm Profiles Panel Widget to ensure API calls (`/api/v2/alarms`, `/api/deviceInfos`, `/api/deviceProfile/`) work independently of the currently logged-in user's permissions.

The solution involves temporarily authenticating with fixed service credentials, executing the required API calls, and then restoring the original user session.

---

## Motivation

### Problem Statement

The Alarm Profiles Panel Widget relies on several ThingsBoard REST APIs:

| API Endpoint | Purpose |
|--------------|---------|
| `/api/deviceInfos/all` | Fetch all devices for a customer |
| `/api/deviceProfile/{id}` | Fetch device profile with alarm rules |
| `/api/v2/alarms` | Fetch active/cleared alarms |

These API calls may fail or return incomplete data when:

1. **Insufficient Permissions**: The logged-in user may not have access to all devices or alarm data
2. **Role Restrictions**: Some users may have read-only access to specific entities
3. **Tenant vs Customer Context**: API responses vary based on user authority level

### Current Behavior

```
User Login (jwt_token in localStorage)
         │
         ▼
    Widget Loads
         │
         ▼
    API Calls with User Token
         │
         ▼
    ⚠️ Partial Data / Permission Errors
```

### Desired Behavior

```
User Login (jwt_token in localStorage)
         │
         ▼
    Widget Loads
         │
         ├── Save Current Token
         │
         ▼
    Authenticate with Service Account
         │
         ▼
    API Calls with Service Token (Full Access)
         │
         ▼
    Restore Original User Token
         │
         ▼
    ✅ Complete Data Available
```

---

## Guide-level Explanation

### Authentication Flow

The widget will implement a token swap mechanism:

1. **Capture Current Session**: Store the current `jwt_token` and user info
2. **Service Authentication**: Authenticate with fixed credentials to obtain a service token
3. **Execute API Calls**: Perform all data fetching operations with elevated privileges
4. **Restore Session**: Swap back to the original user token

### Reference Implementations

#### Fetching User Info (from Menu Widget)

```javascript
// src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js
fetchUserInfo();

async function fetchUserInfo() {
  // Retrieves current logged-in user details
}
```

#### Token Retrieval

```javascript
const token = localStorage.getItem('jwt_token');
```

#### Fixed Authentication (from Multimeter Widget)

```javascript
// src/thingsboard/WIDGET/Multimeter/device_card/controller.js
const body = { username: TB_USERNAME, password: TB_PASSWORD };
```

---

## Reference-level Explanation

### Proposed Implementation

#### 1. Authentication Service Module

```javascript
var AuthBypass = {
  originalToken: null,
  originalUser: null,
  serviceToken: null,

  // Service account credentials (should be stored securely)
  SERVICE_USERNAME: 'service@myio.com',
  SERVICE_PASSWORD: 'secure_password',

  /**
   * Save current user session
   */
  saveSession: function() {
    this.originalToken = localStorage.getItem('jwt_token');
    this.originalUser = localStorage.getItem('user_info');
  },

  /**
   * Authenticate with service account
   */
  authenticateService: function() {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.SERVICE_USERNAME,
        password: this.SERVICE_PASSWORD
      })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      AuthBypass.serviceToken = data.token;
      localStorage.setItem('jwt_token', data.token);
      return data.token;
    });
  },

  /**
   * Restore original user session
   */
  restoreSession: function() {
    if (this.originalToken) {
      localStorage.setItem('jwt_token', this.originalToken);
    }
    if (this.originalUser) {
      localStorage.setItem('user_info', this.originalUser);
    }
  },

  /**
   * Execute function with elevated privileges
   */
  withServiceAuth: function(fn) {
    var self = this;
    this.saveSession();

    return this.authenticateService()
      .then(function() {
        return fn();
      })
      .finally(function() {
        self.restoreSession();
      });
  }
};
```

#### 2. Usage in Alarm Panel

```javascript
function fetchAllData() {
  AuthBypass.withServiceAuth(function() {
    return Promise.all([
      fetchAllDevicesWithPagination(),
      fetchAlarms()
    ]);
  })
  .then(function(results) {
    // Process results with full data
  });
}
```

### Security Considerations

| Concern | Mitigation |
|---------|------------|
| Credential Exposure | Store credentials in server-side configuration, not in client code |
| Token Leakage | Always restore original token in `finally` block |
| Session Hijacking | Use short-lived service tokens |
| Audit Trail | Log all service account API calls for auditing |

### Alternative Approaches

#### Option A: Server-Side Proxy (Recommended for Production)

Create a backend service that handles authentication and proxies API calls:

```
Widget → Backend Proxy → ThingsBoard API
                │
                └── Authenticated with service credentials
```

**Pros**: Credentials never exposed to client
**Cons**: Requires additional infrastructure

#### Option B: Token Refresh with Elevated Scope

Request a token refresh with additional scopes:

```javascript
POST /api/auth/token
{
  "refreshToken": "...",
  "scopes": ["ALARM_READ", "DEVICE_READ"]
}
```

**Pros**: Uses existing token infrastructure
**Cons**: May not be supported by ThingsBoard

#### Option C: Customer-Level Service Account (Current Proposal)

Use a dedicated service account per customer with full read access.

**Pros**: Simple to implement, works with existing ThingsBoard setup
**Cons**: Credentials in client code (should be obfuscated)

---

## Drawbacks

1. **Security Risk**: Storing service credentials in client-side code is inherently risky
2. **Maintenance Overhead**: Service account credentials need to be rotated periodically
3. **Audit Complexity**: Actions performed with service account may be harder to attribute to specific users
4. **Token Race Conditions**: If user performs actions during the swap window, they may fail

---

## Rationale and Alternatives

### Why This Approach?

1. **Minimal Infrastructure Change**: No new backend services required
2. **Immediate Implementation**: Can be deployed without ThingsBoard modifications
3. **Proven Pattern**: Already used in other widgets (Multimeter)

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| Backend Proxy | Requires additional infrastructure and maintenance |
| Role Modification | Changing user roles affects entire system, not just this widget |
| Data Caching | Doesn't solve the fundamental permission issue |

---

## Prior Art

### Existing Implementations in Codebase

1. **Multimeter Widget** (`src/thingsboard/WIDGET/Multimeter/device_card/controller.js`)
   - Uses fixed credentials for device data access
   - Pattern: Direct authentication with stored username/password

2. **Menu Widget** (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js`)
   - Fetches user info using current session token
   - Pattern: `fetchUserInfo()` async function

---

## Unresolved Questions

1. **Credential Storage**: Should service credentials be stored in:
   - Widget settings (current approach)
   - Environment variables
   - Encrypted configuration file

2. **Token Lifetime**: What should be the validity period for service tokens?

3. **Error Handling**: How should the widget behave if service authentication fails?

4. **Logging**: Should service account API calls be logged separately for audit purposes?

---

## Future Possibilities

1. **OAuth2 Integration**: Implement proper OAuth2 client credentials flow
2. **Centralized Auth Service**: Create a dedicated authentication microservice
3. **Role-Based Data Filtering**: Instead of bypassing auth, implement proper RBAC at the data layer
4. **WebSocket Authentication**: Extend this pattern to support real-time data subscriptions

---

## Implementation Plan

### Phase 1: Core Authentication Module

- [ ] Create `AuthBypass` module with save/restore session functions
- [ ] Implement service account authentication
- [ ] Add error handling and retry logic

### Phase 2: Integration with Alarm Panel

- [ ] Wrap `fetchAllData()` with `AuthBypass.withServiceAuth()`
- [ ] Test with various user permission levels
- [ ] Verify token restoration after API calls

### Phase 3: Security Hardening

- [ ] Obfuscate credentials in production build
- [ ] Add audit logging for service account usage
- [ ] Implement token refresh mechanism

### Phase 4: Documentation and Monitoring

- [ ] Document service account setup process
- [ ] Add monitoring for authentication failures
- [ ] Create runbook for credential rotation

---

## References

- [ThingsBoard REST API Documentation](https://thingsboard.io/docs/reference/rest-api/)
- [JWT Token Handling in ThingsBoard](https://thingsboard.io/docs/reference/rest-api/#authentication)
- Related RFC: RFC-0096 (Alarm Profiles Panel Widget)
