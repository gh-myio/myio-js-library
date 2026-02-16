# UI Alignment Report — TARGET vs ACTUAL (BAS Dashboard)

This document describes the visual and structural differences between the **TARGET template (BAS Dashboard)** and the **ACTUAL implementation**, and provides **clear UI/UX guidelines** for the Code Assist to align the current dashboard with the expected design.

---

## 1. Global Theme & Colors

### TARGET

- Dark navy / deep blue background.
- High contrast: light cards over a dark surface.
- Clean, enterprise-grade look.
- Subtle 1px dividers separating major areas.

### ACTUAL (Issues)

- Light beige/yellowish background creates a washed-out look.
- Low contrast reduces readability and perceived quality.
- Excessive use of pastel tones and decorative backgrounds.

### Required Adjustments

- Switch to a **dark theme**:
  ```css
  --bg-main: #0B1220;
  --bg-panel: #101A2B;
  --border-subtle: rgba(255,255,255,0.10);
  --text-primary: rgba(255,255,255,0.92);
  --text-muted: rgba(255,255,255,0.60);
  Remove background illustrations and strong gradients from widgets.
  ```

Use color only to convey status, not decoration.

2. Layout Structure & Hierarchy
   TARGET

Clear 3-column structure:

Left Sidebar — Floors (Andares)

Main Area — Hydraulic Infrastructure (KPI cards + charts)

Right Columns — Environments and Pumps/Motors (lists)

Strong visual hierarchy and consistent alignment.

ACTUAL (Issues)

Widgets feel visually “packed” without clear grouping.

Section hierarchy is unclear.

Inconsistent spacing between components.

Required Adjustments

Introduce section containers with headers.

Main KPI grid:
