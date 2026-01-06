# RFC-0129: Customer Users Fetcher Component

- **Feature Name:** `customer_users_fetcher`
- **Start Date:** 2026-01-06
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 1.0.0
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)

---

## Summary

This RFC defines a new utility component for fetching customer users from the ThingsBoard REST API. The component handles paginated API responses, transforms the raw user data into a simplified format with São Paulo timezone formatting, and integrates with the existing `UsersSummaryTooltip` component for display in the WelcomeModal and Menu components.

---

## Motivation

### Current Problem

Currently, there is no standardized way to fetch and display customer user information in the MYIO dashboard widgets. The `UsersSummaryTooltip` component exists but lacks a data provider to feed it with user information from ThingsBoard.

### Use Cases

1. **Head Office Dashboard**: Display total users with access to each shopping mall
2. **Welcome Modal**: Show user counts in shopping cards with tooltip details
3. **Menu Component**: Filter icons showing user breakdown by role (Admin/User)
4. **User Management Visibility**: Quick overview of who has access to each customer

### Goals

| Goal | Description |
|------|-------------|
| Centralized API Fetching | Single utility function to fetch customer users |
| Pagination Handling | Automatically fetch all pages for large user lists |
| Data Normalization | Transform raw API response to simplified user objects |
| Timezone Formatting | Format timestamps to São Paulo timezone (UTC-3) |
| Role Classification | Categorize users by group (Administrators vs Users) |
| Library Integration | Export utility for use across all widgets |

---

## Guide-level Explanation

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MAIN_UNIQUE_DATASOURCE Widget                     │
│                         (controller.js)                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MyIOLibrary.fetchCustomerUsers(token, customerId)       │
│                    (new utility from this RFC)                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Page 0   │   │  Page 1   │   │  Page N   │
            │  (API)    │   │  (API)    │   │  (API)    │
            └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                  │               │               │
                  └───────────────┼───────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Aggregate & Transform Users                       │
│     Raw API Data → CustomerUserInfo[] (simplified format)           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        ┌───────────────────┐       ┌───────────────────┐
        │   WelcomeModal    │       │    MenuView       │
        │  (shoppingCards)  │       │ (filter tooltips) │
        └─────────┬─────────┘       └─────────┬─────────┘
                  │                           │
                  └─────────────┬─────────────┘
                                ▼
        ┌─────────────────────────────────────────────────┐
        │            UsersSummaryTooltip                   │
        │     (existing component - RFC-0112)              │
        │  Shows: Total, Admins(+expand), Users(+expand)  │
        └─────────────────────────────────────────────────┘
```

### User Workflow

1. **Widget Initialization**: `MAIN_UNIQUE_DATASOURCE/controller.js` calls `fetchCustomerUsers()` during `onInit()`
2. **API Fetching**: Utility fetches all users via paginated ThingsBoard API
3. **Data Transformation**: Raw user objects are normalized to `CustomerUserInfo[]`
4. **Distribution**: User list is passed to WelcomeModal and Menu components
5. **Tooltip Display**: Hovering over user icon triggers `UsersSummaryTooltip` with user breakdown

---

## Reference-level Explanation

### API Endpoint

```
GET /api/customer/{customerId}/users?pageSize={size}&page={page}
```

**Parameters:**
- `customerId` - Customer UUID (e.g., `784f394c-42b6-435a-983c-b7beff2784f9`)
- `pageSize` - Maximum entities per page (recommended: 100)
- `page` - Zero-indexed page number

**Response Structure:**

```typescript
interface ThingsboardUsersResponse {
  data: ThingsboardUser[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

interface ThingsboardUser {
  id: {
    entityType: "USER";
    id: string;  // User UUID
  };
  createdTime: number;  // Unix timestamp in milliseconds
  tenantId: { entityType: "TENANT"; id: string };
  customerId: { entityType: "CUSTOMER"; id: string };
  email: string;
  authority: "CUSTOMER_USER";
  firstName: string;
  lastName: string;
  phone: string | null;
  ownerName: string;  // Customer name (e.g., "Rio Poty")
  groups: Array<{
    id: { entityType: "ENTITY_GROUP"; id: string };
    name: string;  // "Customer Administrators" or "Customer Users"
  }>;
  additionalInfo: {
    description: string;
    defaultDashboardId: string;
    homeDashboardId: string;
    homeDashboardHideToolbar: boolean;
    userCredentialsEnabled: boolean;
    userActivated: boolean;
    lastLoginTs: number | null;
  };
}
```

### New TypeScript Interfaces

```typescript
/**
 * Simplified user information returned by fetchCustomerUsers()
 */
export interface CustomerUserInfo {
  /** User UUID from ThingsBoard */
  userId: string;

  /** User creation timestamp formatted for São Paulo timezone */
  createdTime: string;  // Format: "DD/MM/YYYY HH:mm"

  /** Full name: firstName + lastName */
  fullName: string;

  /** User email address */
  email: string;

  /** User role based on group membership */
  role: 'admin' | 'user';

  /** Raw groups from ThingsBoard (for advanced use) */
  groups: string[];
}

/**
 * Result from fetchCustomerUsers() including metadata
 */
export interface FetchCustomerUsersResult {
  /** List of normalized user objects */
  users: CustomerUserInfo[];

  /** Total number of users */
  totalUsers: number;

  /** Count of administrators */
  adminCount: number;

  /** Count of regular users */
  userCount: number;

  /** Fetch timestamp (São Paulo timezone) */
  fetchedAt: string;
}

/**
 * Parameters for fetchCustomerUsers()
 */
export interface FetchCustomerUsersParams {
  /** ThingsBoard JWT token */
  token: string;

  /** Customer UUID */
  customerId: string;

  /** Optional: ThingsBoard base URL (default: current origin) */
  baseUrl?: string;

  /** Optional: Page size for API requests (default: 100) */
  pageSize?: number;
}
```

### Core Utility Function

```typescript
/**
 * Fetches all users for a customer from ThingsBoard API
 * Handles pagination automatically and transforms data to simplified format
 *
 * @param params - Fetch parameters including token and customerId
 * @returns Promise<FetchCustomerUsersResult> - Normalized user list with counts
 *
 * @example
 * const result = await fetchCustomerUsers({
 *   token: jwtToken,
 *   customerId: '784f394c-42b6-435a-983c-b7beff2784f9'
 * });
 * console.log(result.users);  // CustomerUserInfo[]
 * console.log(result.adminCount);  // Number of admins
 */
export async function fetchCustomerUsers(
  params: FetchCustomerUsersParams
): Promise<FetchCustomerUsersResult>
```

### Implementation Details

#### 1. Pagination Handler

```typescript
async function fetchAllPages(
  token: string,
  customerId: string,
  baseUrl: string,
  pageSize: number
): Promise<ThingsboardUser[]> {
  const allUsers: ThingsboardUser[] = [];
  let page = 0;
  let hasNext = true;

  while (hasNext) {
    const url = `${baseUrl}/api/customer/${customerId}/users?pageSize=${pageSize}&page=${page}`;

    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data: ThingsboardUsersResponse = await response.json();
    allUsers.push(...data.data);

    hasNext = data.hasNext;
    page++;
  }

  return allUsers;
}
```

#### 2. Timestamp Formatting (São Paulo Timezone)

```typescript
/**
 * Formats Unix timestamp to São Paulo timezone string
 * Uses existing formatDateWithTimezoneOffset utility
 */
function formatTimestampSP(timestamp: number): string {
  const date = new Date(timestamp);

  // Format: DD/MM/YYYY HH:mm
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

#### 3. Role Classification

```typescript
/**
 * Determines user role based on ThingsBoard group membership
 * Users with "Customer Administrators" group are admins
 * All others are regular users
 */
function classifyUserRole(groups: ThingsboardUser['groups']): 'admin' | 'user' {
  const isAdmin = groups.some(g =>
    g.name === 'Customer Administrators'
  );
  return isAdmin ? 'admin' : 'user';
}
```

#### 4. User Transformation

```typescript
function transformUser(rawUser: ThingsboardUser): CustomerUserInfo {
  return {
    userId: rawUser.id.id,
    createdTime: formatTimestampSP(rawUser.createdTime),
    fullName: `${rawUser.firstName} ${rawUser.lastName}`.trim(),
    email: rawUser.email,
    role: classifyUserRole(rawUser.groups),
    groups: rawUser.groups.map(g => g.name)
  };
}
```

### Integration with UsersSummaryTooltip

The existing `UsersSummaryTooltip` expects `UsersSummaryData`:

```typescript
interface UsersSummaryData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  byRole: {
    admin: number;
    operator: number;
    viewer: number;
    adminUsers?: UserInfo[];
    operatorUsers?: UserInfo[];
    viewerUsers?: UserInfo[];
  };
  lastUpdated: string;
  customerName?: string;
}
```

**Mapping from FetchCustomerUsersResult to UsersSummaryData:**

```typescript
function buildUsersSummaryData(
  result: FetchCustomerUsersResult,
  customerName?: string
): UsersSummaryData {
  const adminUsers = result.users.filter(u => u.role === 'admin');
  const regularUsers = result.users.filter(u => u.role === 'user');

  return {
    totalUsers: result.totalUsers,
    activeUsers: result.totalUsers,  // All fetched users are active
    inactiveUsers: 0,  // API doesn't return inactive users
    byRole: {
      admin: result.adminCount,
      operator: 0,  // Not used in current implementation
      viewer: result.userCount,  // Regular users shown as viewers
      adminUsers: adminUsers.map(u => ({
        id: u.userId,
        name: u.fullName,
        email: u.email
      })),
      viewerUsers: regularUsers.map(u => ({
        id: u.userId,
        name: u.fullName,
        email: u.email
      }))
    },
    lastUpdated: result.fetchedAt,
    customerName
  };
}
```

### Controller Integration

**In `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`:**

```javascript
self.onInit = async function () {
  // ... existing initialization code ...

  // Fetch customer users for each shopping
  const usersPerCustomer = {};

  for (const customer of customers) {
    try {
      const result = await MyIOLibrary.fetchCustomerUsers({
        token: jwtToken,
        customerId: customer.customerId
      });

      usersPerCustomer[customer.customerId] = result;
    } catch (error) {
      console.error(`Failed to fetch users for ${customer.name}:`, error);
      usersPerCustomer[customer.customerId] = { users: [], totalUsers: 0, adminCount: 0, userCount: 0 };
    }
  }

  // Pass to WelcomeModal
  const welcomeModal = MyIOLibrary.openWelcomeModal({
    // ... existing params ...
    usersData: usersPerCustomer  // New param
  });
};
```

### Library Export

**In `src/index.ts`:**

```typescript
// RFC-0129: Customer Users Fetcher
export { fetchCustomerUsers, buildUsersSummaryData } from './utils/customerUsers';
export type {
  CustomerUserInfo,
  FetchCustomerUsersResult,
  FetchCustomerUsersParams
} from './utils/customerUsers';
```

---

## Drawbacks

1. **API Rate Limits**: Multiple API calls for paginated data may hit rate limits with many customers
2. **Latency**: Sequential pagination adds latency for large user lists
3. **No Real-time Updates**: User list is fetched once; changes require manual refresh
4. **Authentication Required**: Requires valid JWT token with customer user read permissions

---

## Rationale and Alternatives

### Why This Approach?

| Aspect | Alternative | Chosen Approach |
|--------|-------------|-----------------|
| Data Source | ThingsBoard datasource binding | REST API fetch |
| Pagination | Single large request | Paginated with auto-fetch |
| Timezone | UTC or browser locale | Fixed São Paulo (UTC-3) |
| Role Detection | Custom attribute | ThingsBoard group membership |

### Alternatives Considered

#### Alternative 1: ThingsBoard Entity Table Datasource
Use built-in entity table widget to display users.

**Rejected**: Doesn't integrate with existing tooltip components; requires separate widget configuration.

#### Alternative 2: Server-side Aggregation
Create backend endpoint to aggregate user data.

**Rejected**: Increases deployment complexity; requires backend changes.

#### Alternative 3: WebSocket Subscription
Subscribe to user entity changes for real-time updates.

**Considered for Future**: More complex implementation; not needed for initial release.

---

## Prior Art

- **RFC-0096**: Alarm Profiles Panel Widget - Similar paginated API fetching pattern
- **RFC-0112**: UsersSummaryTooltip - Existing tooltip component this RFC integrates with
- **ThingsBoard Entity Table**: Reference implementation for user listing

---

## Unresolved Questions

1. **Inactive User Detection**: ThingsBoard API doesn't return inactive users separately. Should we use `lastLoginTs` to infer activity status?

2. **Caching Strategy**: Should we cache user data to reduce API calls? If yes, what's the TTL?

3. **Error Handling UI**: How should fetch failures be displayed in the tooltip?

4. **Head Office Aggregation**: For head office view with multiple customers, should we aggregate all users or show per-customer breakdown?

---

## Future Possibilities

1. **Real-time User Updates**: WebSocket subscription for user changes
2. **User Activity Status**: Track last login to show active/inactive breakdown
3. **User Search**: Add search capability in tooltip for large user lists
4. **Permission Visualization**: Show what dashboards/assets each user can access
5. **Export to CSV**: Export user list for administrative purposes

---

## File Structure

```
src/
├── utils/
│   ├── customerUsers.ts          # NEW: Main utility (this RFC)
│   └── UsersSummaryTooltip.ts    # EXISTING: Display component
├── components/
│   ├── premium-modals/
│   │   └── welcome/
│   │       ├── types.ts          # MODIFY: Add usersData param
│   │       └── WelcomeModalView.ts # MODIFY: Pass users to tooltip
│   └── menu/
│       └── MenuView.ts           # MODIFY: Integrate users data
├── MYIO-SIM/v5.2.0/
│   └── MAIN_UNIQUE_DATASOURCE/
│       └── controller.js         # MODIFY: Call fetchCustomerUsers
└── index.ts                      # MODIFY: Export new utility
```

---

## Success Criteria

- [ ] `fetchCustomerUsers()` successfully fetches paginated user data
- [ ] Timestamps are formatted in São Paulo timezone (DD/MM/YYYY HH:mm)
- [ ] Users are correctly classified as admin/user based on groups
- [ ] Integration with WelcomeModal works (user counts in cards)
- [ ] Integration with MenuView works (tooltip shows user breakdown)
- [ ] UsersSummaryTooltip displays admin list with (+) expand
- [ ] UsersSummaryTooltip displays user list with (+) expand
- [ ] Error handling for API failures
- [ ] TypeScript types exported correctly
- [ ] Library builds without errors

---

## Appendix A: Sample API Response

```json
{
  "data": [
    {
      "id": {
        "entityType": "USER",
        "id": "1063a320-e0f5-11f0-998e-25174baff087"
      },
      "createdTime": 1766600359506,
      "email": "john.doe@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "groups": [
        { "id": { "entityType": "ENTITY_GROUP", "id": "..." }, "name": "Customer Administrators" },
        { "id": { "entityType": "ENTITY_GROUP", "id": "..." }, "name": "Customer Users" }
      ]
    }
  ],
  "totalPages": 1,
  "totalElements": 5,
  "hasNext": false
}
```

## Appendix B: Transformed Output

```typescript
// Input: API response above
// Output: FetchCustomerUsersResult

{
  users: [
    {
      userId: "1063a320-e0f5-11f0-998e-25174baff087",
      createdTime: "06/01/2026 10:30",
      fullName: "John Doe",
      email: "john.doe@company.com",
      role: "admin",
      groups: ["Customer Administrators", "Customer Users"]
    }
  ],
  totalUsers: 5,
  adminCount: 2,
  userCount: 3,
  fetchedAt: "06/01/2026 14:25"
}
```
