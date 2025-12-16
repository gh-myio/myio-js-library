# RFC 0104: Device Annotations System

- **Feature Name:** `device-annotations-system`
- **Start Date:** 2025-12-16
- **RFC PR:** [myio-js-library#0104](https://github.com/gh-myio/myio-js-library/pull/0104)
- **MYIO Issue:** [myio-js-library#0104](https://github.com/gh-myio/myio-js-library/issues/0104)

## Summary

This RFC proposes a comprehensive device annotations system for the MYIO platform. The system adds a new "Annotations" tab to the existing Settings Modal, enabling users to create, view, edit, and archive structured annotations per device. Annotations are persisted as a JSON structure in the device's `server_scope` attribute named `log_annotations`. The feature includes role-based permissions, audit logging, visual indicators on device cards, and a rich filtering/search interface.

## Motivation

Currently, there is no standardized way to track observations, maintenance activities, pending tasks, or general notes associated with individual devices in the MYIO ecosystem. This leads to several operational challenges:

1. **Lack of Traceability**: Field technicians, operators, and administrators have no centralized place to log device-related observations
2. **No Audit Trail**: When issues are identified or resolved, there's no historical record of who did what and when
3. **Poor Communication**: Information about device status, maintenance needs, or pending actions is not easily shared between team members
4. **Missing Visual Indicators**: Dashboard cards don't reflect whether devices have pending issues, observations, or recent activities

This RFC addresses these challenges by providing:

1. **Centralized Annotation Management**: Single UI within the Settings Modal for all device annotations
2. **Structured Data Model**: Typed annotations with categories, importance levels, and due dates
3. **Role-Based Permissions**: Control over who can create, edit, or archive annotations
4. **Audit Logging**: Complete version history with timestamps and user attribution
5. **Visual Feedback**: Card-level indicators showing annotation status at a glance
6. **Search & Filter**: Rich querying capabilities for finding relevant annotations

## Guide-level explanation

### Product/UX Requirements

The Annotations System introduces a new tab in the Settings Modal alongside the existing "General" tab.

#### Tab Structure

```
+----------------------------------------------------------+
|  Device Settings                              [Save] [X]  |
+----------------------------------------------------------+
|  [General]  [Annotations]                                 |
+----------------------------------------------------------+
```

When the "Annotations" tab is selected, users see:

#### Annotations Tab Layout

```
+----------------------------------------------------------+
|  NEW ANNOTATION                                           |
+----------------------------------------------------------+
|  Type: [Observation v]  Importance: [Normal v]           |
|  Due Date: [Optional Date Picker]                         |
|  +------------------------------------------------------+ |
|  | Enter annotation text (max 255 characters)...       | |
|  +------------------------------------------------------+ |
|  [Add Annotation]                                         |
+----------------------------------------------------------+
|  FILTERS                                                  |
+----------------------------------------------------------+
|  Date Range: [DateRangePicker]  Status: [All v]          |
|  Type: [All v]  User: [All v]  Search: [________]        |
+----------------------------------------------------------+
|  ANNOTATIONS (Page 1 of 5)                                |
+----------------------------------------------------------+
|  [x] | 2025-12-15 14:30 | John Doe | Pending | High      |
|      | "Equipment showing intermittent conn..."  [Details]|
|  +--------------------------------------------------------+
|  [ ] | 2025-12-14 09:15 | Jane Smith | Maintenance | Med  |
|      | "Scheduled calibration completed su..."   [Details]|
|  +--------------------------------------------------------+
|  ... (10 items per page)                                  |
+----------------------------------------------------------+
|  [< Prev]  Page 1 of 5  [Next >]                         |
+----------------------------------------------------------+
```

### Annotation Types

Each annotation must be classified into one of four types:

| Type | Color | Icon | Description |
|------|-------|------|-------------|
| `observation` | Blue | Info circle | General observations and notes |
| `pending` | Red | Exclamation | Outstanding issues requiring attention |
| `maintenance` | Yellow | Wrench | Maintenance-related activities |
| `activity` | Green | Check circle | Completed activities or updates |

### Importance Levels

Annotations can be assigned an importance level:

| Level | Value | Visual Indicator |
|-------|-------|------------------|
| Very Low | 1 | Gray |
| Low | 2 | Light Blue |
| Normal | 3 | Blue (default) |
| High | 4 | Orange |
| Very High | 5 | Red |

### Annotation Status

Annotations progress through the following statuses:

| Status | Description |
|--------|-------------|
| `created` | Initial state when annotation is added |
| `modified` | Annotation text or properties have been edited |
| `archived` | Annotation is no longer active (soft delete) |

### Permission Model

The system implements a hierarchical permission model:

#### SuperAdmin MYIO
- Users with email ending in `@myio.com.br` (except `alarme@` and `alarmes@`)
- Can edit or archive ANY annotation on ANY device
- Detection via `detectSuperAdmin()` function (to be exposed in library)

#### SuperAdmin Holding
- Users with `isUserAdmin: true` attribute on their customer entity
- Can edit or archive annotations within their tenant/holding
- Detection via customer attribute check

#### Regular Users
- Can create new annotations on any device they have access to
- Can ONLY edit or archive their OWN annotations
- Cannot delete annotations (soft archive only)

```typescript
// Permission check pseudocode
function canModifyAnnotation(annotation: Annotation, currentUser: User): boolean {
  // SuperAdmin MYIO can modify anything
  if (isSuperAdminMyio(currentUser)) return true;

  // SuperAdmin Holding can modify within tenant
  if (isSuperAdminHolding(currentUser)) return true;

  // Regular users can only modify their own
  return annotation.createdBy.email === currentUser.email;
}
```

### Acknowledgment Feature

Each annotation row includes a checkbox for "acknowledgment":
- Any user can acknowledge an annotation (mark as "seen/resolved")
- Acknowledgment records the user and timestamp
- Acknowledgments don't change annotation status
- Useful for tracking that someone has reviewed a pending issue

### Card Indicators

Device cards in both `template-card-v5.js` and `card-head-office.js` display a floating annotation indicator icon:

```
+------------------+
|  Device Card    [!] <-- Annotation indicator
|  ...             |
+------------------+
```

**Indicator Colors:**
- **Red**: Has `pending` annotations (highest priority)
- **Yellow**: Has `maintenance` annotations
- **Green**: Has `activity` annotations only
- **Blue**: Has `observation` annotations only
- **50% Transparent**: No annotations (disabled state)

The indicator shows a premium tooltip on hover with annotation summary.

### Tooltip Content

Following the pattern from `EnergyRangeTooltip.ts`:

```
+------------------------------------------+
|  Annotations Summary                      |
+------------------------------------------+
|  Total: 5                                 |
|  - Pending: 2 (1 overdue)                |
|  - Maintenance: 1                         |
|  - Activity: 1                            |
|  - Observation: 1                         |
|                                           |
|  Latest: "Equipment showing..."           |
|  By: John Doe @ 2025-12-15 14:30         |
+------------------------------------------+
```

## Reference-level explanation

### Data Model

#### Annotation Structure

```typescript
interface Annotation {
  id: string;                    // UUID v4
  version: number;               // Increments on each change

  // Content
  text: string;                  // Max 255 characters
  type: AnnotationType;          // 'observation' | 'pending' | 'maintenance' | 'activity'
  importance: ImportanceLevel;   // 1-5 (very_low to very_high)
  status: AnnotationStatus;      // 'created' | 'modified' | 'archived'

  // Dates
  createdAt: string;             // ISO 8601 timestamp
  dueDate?: string;              // Optional ISO 8601 date

  // User Attribution
  createdBy: UserInfo;

  // Acknowledgment
  acknowledged: boolean;
  acknowledgedBy?: UserInfo;
  acknowledgedAt?: string;

  // Audit Trail
  history: AuditEntry[];
}

interface UserInfo {
  id: string;                    // ThingsBoard user ID
  email: string;
  name: string;
}

interface AuditEntry {
  timestamp: string;             // ISO 8601
  userId: string;
  userName: string;
  userEmail: string;
  action: 'created' | 'modified' | 'archived' | 'acknowledged';
  previousVersion?: number;
  changes?: Record<string, { from: any; to: any }>;
}

type AnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
type ImportanceLevel = 1 | 2 | 3 | 4 | 5;
type AnnotationStatus = 'created' | 'modified' | 'archived';
```

#### Storage Structure

The complete annotations data is stored in the device's `server_scope` attribute `log_annotations`:

```typescript
interface LogAnnotationsAttribute {
  schemaVersion: string;         // "1.0.0"
  deviceId: string;              // ThingsBoard device ID
  lastModified: string;          // ISO 8601
  lastModifiedBy: UserInfo;
  annotations: Annotation[];
}
```

#### Example JSON

```json
{
  "schemaVersion": "1.0.0",
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "lastModified": "2025-12-16T10:30:00.000Z",
  "lastModifiedBy": {
    "id": "user-uuid",
    "email": "john.doe@company.com",
    "name": "John Doe"
  },
  "annotations": [
    {
      "id": "annot-uuid-1",
      "version": 2,
      "text": "Equipment showing intermittent connection drops. Scheduled for inspection.",
      "type": "pending",
      "importance": 4,
      "status": "modified",
      "createdAt": "2025-12-15T14:30:00.000Z",
      "dueDate": "2025-12-20",
      "createdBy": {
        "id": "user-uuid",
        "email": "john.doe@company.com",
        "name": "John Doe"
      },
      "acknowledged": true,
      "acknowledgedBy": {
        "id": "user-uuid-2",
        "email": "jane.smith@company.com",
        "name": "Jane Smith"
      },
      "acknowledgedAt": "2025-12-15T16:00:00.000Z",
      "history": [
        {
          "timestamp": "2025-12-15T14:30:00.000Z",
          "userId": "user-uuid",
          "userName": "John Doe",
          "userEmail": "john.doe@company.com",
          "action": "created"
        },
        {
          "timestamp": "2025-12-15T15:45:00.000Z",
          "userId": "user-uuid",
          "userName": "John Doe",
          "userEmail": "john.doe@company.com",
          "action": "modified",
          "previousVersion": 1,
          "changes": {
            "text": {
              "from": "Equipment showing connection issues.",
              "to": "Equipment showing intermittent connection drops. Scheduled for inspection."
            },
            "importance": {
              "from": 3,
              "to": 4
            }
          }
        }
      ]
    }
  ]
}
```

### API Integration

#### Fetching User Information

Leverage existing pattern from `MENU/controller.js`:

```typescript
async function fetchUserInfo(): Promise<UserInfo> {
  const jwt = localStorage.getItem('jwt_token');
  const response = await fetch('/api/auth/user', {
    headers: {
      'X-Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    }
  });
  const user = await response.json();
  return {
    id: user.id.id,
    email: user.email,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
  };
}
```

#### SuperAdmin Detection (Library Export)

```typescript
// To be exported from src/index.ts

export async function detectSuperAdminMyio(): Promise<boolean> {
  const jwt = localStorage.getItem('jwt_token');
  if (!jwt) return false;

  const response = await fetch('/api/auth/user', {
    headers: { 'X-Authorization': `Bearer ${jwt}` }
  });

  if (!response.ok) return false;

  const user = await response.json();
  const email = (user.email || '').toLowerCase().trim();

  return email.endsWith('@myio.com.br') &&
         !email.startsWith('alarme@') &&
         !email.startsWith('alarmes@');
}

export async function detectSuperAdminHolding(customerId: string): Promise<boolean> {
  const jwt = localStorage.getItem('jwt_token');
  if (!jwt) return false;

  const response = await fetch(`/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`, {
    headers: { 'X-Authorization': `Bearer ${jwt}` }
  });

  if (!response.ok) return false;

  const attributes = await response.json();
  const isUserAdmin = attributes.find((a: any) => a.key === 'isUserAdmin');
  return isUserAdmin?.value === true;
}
```

#### Reading Annotations

```typescript
async function readAnnotations(deviceId: string): Promise<LogAnnotationsAttribute | null> {
  const jwt = localStorage.getItem('jwt_token');
  const response = await fetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE?keys=log_annotations`,
    { headers: { 'X-Authorization': `Bearer ${jwt}` } }
  );

  if (!response.ok) return null;

  const attributes = await response.json();
  const attr = attributes.find((a: any) => a.key === 'log_annotations');

  if (!attr?.value) return null;

  return typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;
}
```

#### Writing Annotations

```typescript
async function writeAnnotations(deviceId: string, data: LogAnnotationsAttribute): Promise<boolean> {
  const jwt = localStorage.getItem('jwt_token');
  const response = await fetch(
    `/api/plugins/telemetry/DEVICE/${deviceId}/SERVER_SCOPE`,
    {
      method: 'POST',
      headers: {
        'X-Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ log_annotations: data })
    }
  );

  return response.ok;
}
```

### Component Architecture

#### File Structure

```
src/components/premium-modals/settings/
├── SettingsModalView.ts          # Add tab navigation
├── tabs/
│   ├── GeneralTab.ts             # Existing general settings (refactored)
│   └── AnnotationsTab.ts         # NEW: Annotations tab component
├── annotations/
│   ├── AnnotationForm.ts         # New annotation input form
│   ├── AnnotationGrid.ts         # Paginated grid with filters
│   ├── AnnotationRow.ts          # Single row component
│   ├── AnnotationDetailModal.ts  # Full annotation view/edit modal
│   ├── AnnotationTooltip.ts      # Premium tooltip for card indicators
│   └── types.ts                  # TypeScript interfaces
└── types.ts                      # Update with annotation types
```

#### AnnotationsTab Component

```typescript
export class AnnotationsTab {
  private container: HTMLElement;
  private deviceId: string;
  private currentUser: UserInfo;
  private permissions: PermissionSet;
  private annotations: Annotation[];
  private filters: FilterState;
  private pagination: PaginationState;

  constructor(config: AnnotationsTabConfig) {
    // Initialize
  }

  async render(): Promise<void> {
    // Render form + filters + grid
  }

  async addAnnotation(data: NewAnnotationData): Promise<void> {
    // Create annotation with audit entry
  }

  async editAnnotation(id: string, changes: Partial<Annotation>): Promise<void> {
    // Update with permission check and audit
  }

  async archiveAnnotation(id: string): Promise<void> {
    // Soft delete with permission check
  }

  async acknowledgeAnnotation(id: string): Promise<void> {
    // Mark as acknowledged
  }
}
```

### Card Integration

#### template-card-v5.js

Add floating annotation indicator to the card layout:

```javascript
// In card render function
const annotationIndicator = document.createElement('div');
annotationIndicator.className = 'myio-card-v5__annotation-indicator';
annotationIndicator.setAttribute('data-annotation-type', getHighestPriorityType(annotations));
annotationIndicator.innerHTML = getAnnotationIcon();

// Position: absolute, top-right, non-displacing
card.appendChild(annotationIndicator);

// Attach tooltip
if (annotations.length > 0) {
  attachAnnotationTooltip(annotationIndicator, annotations);
}
```

#### card-head-office.js

Similar integration with floating indicator that doesn't displace consumption value:

```javascript
// Position indicator in header actions area
const annotationIndicator = document.createElement('div');
annotationIndicator.className = 'myio-ho-card__annotation-indicator';
// ... similar implementation
```

### Date Range Picker Integration

Use existing `createDateRangePicker` component for date filters:

```typescript
import { createDateRangePicker } from '@/components/createDateRangePicker';

const dateFilter = createDateRangePicker({
  container: filterContainer,
  onChange: (startDate, endDate) => {
    this.filters.dateRange = { start: startDate, end: endDate };
    this.refreshGrid();
  }
});
```

## Drawbacks

1. **Storage Size**: JSON in `server_scope` may grow large with many annotations. Consider pagination or archival strategies for devices with extensive history.

2. **Complexity**: Adds significant complexity to the Settings Modal, which was previously a simple form.

3. **Performance**: Loading annotations for many devices in a grid view could be slow. May need lazy loading or caching strategies.

4. **Offline Support**: Annotations require API connectivity; no offline support in initial implementation.

## Rationale and alternatives

### Why `server_scope` attribute?

- **Persistence**: Survives device restarts, unlike client-side storage
- **Access Control**: ThingsBoard manages permissions at the attribute level
- **Simplicity**: No additional database required; uses existing ThingsBoard infrastructure
- **Audit**: Server-side storage ensures data integrity

### Alternatives Considered

1. **Separate Database Table**: More scalable but requires additional infrastructure
2. **Device Telemetry**: Not appropriate for non-time-series data
3. **Customer-level Storage**: Would mix annotations from different devices
4. **External Service**: Adds dependency and complexity

### Why JSON instead of separate attributes?

- **Atomicity**: Single attribute update for all annotation operations
- **Versioning**: Easier to maintain schema version in single structure
- **Query**: Can be loaded in one API call

## Prior art

1. **GitHub Issues**: Similar annotation/comment system with status, labels, and assignees
2. **Jira Comments**: Rich comment threads with history and mentions
3. **EnergyRangeTooltip**: Existing premium tooltip pattern in MYIO library
4. **SettingsModal**: Existing modal structure to extend

## Unresolved questions

1. **Search Indexing**: Should annotations be indexed for full-text search across all devices?
2. **Notifications**: Should annotation creation/modification trigger notifications?
3. **Mentions**: Should users be able to @mention other users in annotations?
4. **Attachments**: Should annotations support file attachments (images, documents)?
5. **Export**: Should there be bulk export functionality for annotations?
6. **Retention Policy**: Should old archived annotations be automatically purged?

## Future possibilities

1. **Cross-Device Annotations**: Link annotations across related devices
2. **Templates**: Pre-defined annotation templates for common scenarios
3. **Workflows**: Annotation-triggered automation (e.g., create maintenance ticket)
4. **Analytics**: Dashboard showing annotation trends and statistics
5. **Mobile App Integration**: Sync annotations with mobile applications
6. **AI Suggestions**: Smart suggestions based on device telemetry patterns

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Export `detectSuperAdminMyio()` and `detectSuperAdminHolding()` in `src/index.ts`
- [ ] Define TypeScript interfaces in `src/components/premium-modals/settings/annotations/types.ts`
- [ ] Implement annotation read/write utilities

### Phase 2: Settings Modal Integration
- [ ] Add tab navigation to `SettingsModalView.ts`
- [ ] Implement `AnnotationsTab` component
- [ ] Implement `AnnotationForm` component
- [ ] Implement `AnnotationGrid` with pagination

### Phase 3: Detail and Edit
- [ ] Implement `AnnotationDetailModal` for viewing/editing
- [ ] Add permission checks for edit/archive operations
- [ ] Implement audit logging

### Phase 4: Card Indicators
- [ ] Add annotation indicator to `template-card-v5.js`
- [ ] Add annotation indicator to `card-head-office.js`
- [ ] Implement `AnnotationTooltip` component

### Phase 5: Testing and Polish
- [ ] Create showcase examples in `/showcase`
- [ ] Mock data for development testing
- [ ] Performance optimization
- [ ] Documentation

## Showcase Examples

```typescript
// showcase/annotations-demo.ts

import { openDashboardPopupSettings } from '@myio/js-library';

// Mock annotation data
const mockAnnotations: LogAnnotationsAttribute = {
  schemaVersion: '1.0.0',
  deviceId: 'mock-device-001',
  lastModified: new Date().toISOString(),
  lastModifiedBy: { id: '1', email: 'demo@myio.com.br', name: 'Demo User' },
  annotations: [
    {
      id: 'annot-1',
      version: 1,
      text: 'Observed unusual power consumption pattern during night hours.',
      type: 'observation',
      importance: 3,
      status: 'created',
      createdAt: '2025-12-14T08:00:00.000Z',
      createdBy: { id: '1', email: 'demo@myio.com.br', name: 'Demo User' },
      acknowledged: false,
      history: []
    },
    // ... more mock annotations
  ]
};

// Demo showcase
document.getElementById('demo-btn')?.addEventListener('click', () => {
  openDashboardPopupSettings({
    deviceId: 'mock-device-001',
    // ... other params
    mockAnnotations, // For showcase only
  });
});
```
