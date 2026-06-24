# RFC 0127: Customer Card Component

- Feature Name: `customer_card_component`
- Start Date: 2026-01-04
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0112 (Welcome Modal Head Office)

---

## Summary

This RFC documents the **CustomerCard** component family in the MYIO library. These components provide reusable, themed cards for displaying customer/shopping information with device counts, meta counts, and interactive badges.

The component family includes:
- **CustomerCardV1**: Original style with rounded corners and gradient backgrounds
- **CustomerCardV2** (Planned): Metro UI style with flat, square tiles

---

## Motivation

The Welcome Modal (RFC-0112) contains customer/shopping cards that display:
- Customer name (title)
- Device counts (energy, water, temperature)
- Meta counts (users, alarms, notifications)
- Background images
- Click and hover interactions

To improve reusability and maintainability, we extract this card into a standalone component that can be used in:
- Welcome Modal Head Office
- Dashboard overviews
- Customer selection panels
- Other contexts requiring customer cards

---

## Component Versions

### CustomerCardV1 (Implemented)

The original card style featuring:
- Rounded corners (14px border-radius)
- Gradient overlays
- Hover scale effect (1.03)
- Badge-style device/meta counts
- Dark and light theme support

**Layout:**
```
  -----------------------------------------
  |  [users] [alarms] [notifications]     |  <- Meta counts (top)
  |---------------------------------------|
  |                                       |
  |         CUSTOMER TITLE                |  <- Centered title
  |                                       |
  |---------------------------------------|
  |    [energy] [water] [temperature]     |  <- Device counts (bottom)
  -----------------------------------------
```

### CustomerCardV2 (Planned)

Metro UI style featuring:
- Flat, square tiles (no rounded corners)
- Solid color backgrounds
- No gradients
- 2x3 grid layout for badges

**Layout:**
```
  -----------------------------------------
  |        CUSTOMER TITLE / LABEL         |  <- Title at top
  |---------------------------------------|
  | energy            | water             |
  | temperature       | users             |  <- 2x3 grid of tiles
  | alarms            | notifications     |
  |---------------------------------------|
```

---

## API Reference

### CustomerCardV1

#### Types

```typescript
interface CustomerCardDeviceCounts {
  energy?: number | null;           // Device count (null = loading spinner)
  energyConsumption?: number | null; // Total kWh (displays as MWh if >= 1000)
  water?: number | null;            // Device count
  waterConsumption?: number | null;  // Total m3
  temperature?: number | null;      // Device count
  temperatureAvg?: number | null;   // Average temperature in Celsius
}

interface CustomerCardMetaCounts {
  users?: number;        // Number of users
  alarms?: number;       // Active alarms
  notifications?: number; // Unread notifications
}

interface CustomerCardData {
  title: string;
  subtitle?: string;
  dashboardId: string;
  entityId: string;
  entityType?: string;  // default: 'ASSET'
  bgImageUrl?: string;
  buttonId?: string;
  deviceCounts?: CustomerCardDeviceCounts;
  metaCounts?: CustomerCardMetaCounts;
}

interface CustomerCardV1Params {
  container: HTMLElement;
  card: CustomerCardData;
  index: number;
  themeMode?: 'dark' | 'light';
  onClick?: (card: CustomerCardData) => void;
  onBadgeClick?: (type: string, card: CustomerCardData, index: number) => void;
  enableLazyLoading?: boolean;
  debugActive?: boolean;
}

interface CustomerCardV1Instance {
  update: (card: Partial<CustomerCardData>) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  getElement: () => HTMLElement;
  destroy: () => void;
}
```

#### Usage

```typescript
import { createCustomerCardV1 } from 'myio-js-library';

const card = createCustomerCardV1({
  container: document.getElementById('cardsGrid'),
  card: {
    title: 'Shopping Mestre Alvaro',
    dashboardId: 'dash-1',
    entityId: 'ent-1',
    metaCounts: { users: 45, alarms: 3, notifications: 12 },
    deviceCounts: {
      energy: 156,
      energyConsumption: 2450.5,
      water: 34,
      waterConsumption: 1250,
      temperature: 28,
      temperatureAvg: 23.5
    }
  },
  index: 0,
  themeMode: 'dark',
  onClick: (cardData) => console.log('Card clicked:', cardData.title),
  onBadgeClick: (type, cardData, idx) => console.log('Badge clicked:', type)
});

// Update card data
card.update({ title: 'New Title' });

// Change theme
card.setThemeMode('light');

// Destroy
card.destroy();
```

---

## File Structure

```
src/components/customer-card-v1/
  index.ts              # Public exports
  types.ts              # TypeScript interfaces
  CustomerCardV1.ts     # Main component class
  styles.ts             # CSS styles (injected on first use)

src/components/customer-card-v2/  (Planned)
  index.ts
  types.ts
  CustomerCardV2.ts
  styles.ts
```

---

## CSS Classes

### CustomerCardV1

| Class | Description |
|-------|-------------|
| `.myio-customer-card-v1` | Root container |
| `.myio-customer-card-v1--light` | Light theme modifier |
| `.myio-customer-card-v1__bg` | Background image container |
| `.myio-customer-card-v1__content` | Content wrapper (title) |
| `.myio-customer-card-v1__title` | Title text |
| `.myio-customer-card-v1__meta-counts` | Meta counts row (top) |
| `.myio-customer-card-v1__device-counts` | Device counts row (bottom) |
| `.myio-customer-card-v1__badge` | Individual badge |
| `.myio-customer-card-v1__badge--energy` | Energy badge modifier |
| `.myio-customer-card-v1__badge--water` | Water badge modifier |
| `.myio-customer-card-v1__badge--temperature` | Temperature badge modifier |
| `.myio-customer-card-v1__badge--users` | Users badge modifier |
| `.myio-customer-card-v1__badge--alarms` | Alarms badge modifier |
| `.myio-customer-card-v1__badge--notifications` | Notifications badge modifier |

---

## Responsive Breakpoints

| Breakpoint | Card Height | Badge Font | Badge Min-Width |
|------------|-------------|------------|-----------------|
| Desktop (>768px) | 112px | 15px | 62px |
| Tablet (<=768px) | 100px | 12px | 52px |
| Mobile (<=480px) | 100px | 11px | 44px |

---

## Theming

Both themes (dark and light) are fully supported:

**Dark Theme (default):**
- Background: `rgba(255, 255, 255, 0.08)`
- Border: `rgba(255, 255, 255, 0.15)`
- Title color: `#F5F7FA`
- Badge background: `rgba(0, 0, 0, 0.3)`

**Light Theme:**
- Background: `rgba(0, 0, 0, 0.04)`
- Border: `rgba(0, 0, 0, 0.1)`
- Title color: `#1a1a2e`
- Badge background: `rgba(255, 255, 255, 0.7)`

---

## Showcase

See the component in action:
- [customer-card-v1.html](../../showcase/customer-card-v1.html)

---

## Document History

- 2026-01-04: Initial RFC created
- 2026-01-04: CustomerCardV1 component implemented
- 2026-01-04: Showcase created

---

## References

- [RFC-0112 Welcome Modal Head Office](./RFC-0112-WelcomeModalHeadOffice.md)
- [Showcase: customer-card-v1.html](../../showcase/customer-card-v1.html)
