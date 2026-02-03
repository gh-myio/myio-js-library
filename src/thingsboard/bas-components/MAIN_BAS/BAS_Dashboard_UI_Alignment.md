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
```css
--bg-main: #0B1220;
--bg-panel: #101A2B;
--border-subtle: rgba(255,255,255,0.10);
--text-primary: rgba(255,255,255,0.92);
--text-muted: rgba(255,255,255,0.60);
```

---

## 2. Layout Structure & Hierarchy

- 3-column structure: Sidebar / Main KPIs / Lists
- KPI grid with 4 columns and 18px gap
- Right panels should use list rows, not cards

---

## 3. Cards

```css
border-radius: 16px;
background: #FFFFFF;
padding: 18px;
box-shadow: 0 10px 24px rgba(0,0,0,0.25);
```

---

## 4. Spacing System

```css
--space-8: 8px;
--space-12: 12px;
--space-16: 16px;
--space-18: 18px;
--space-24: 24px;
```

---

## 5. Typography

- Section title: 14px / 600 / uppercase
- KPI value: 28–32px / 700
- Unit: 14px / muted
- Helper text: 12–13px

---

## 6. Section Headers

Uppercase titles with subtle divider below.

---

## 7. Sidebar

- Minimal
- Clear active state
- Subtle hover

---

## 8. Lists (Environments & Pumps)

- Row height: 52–60px
- Status dot on left
- Values aligned right

---

## 9. Charts

- Clean white background
- No decorative images
- Readable legend

---

## 10. Final Checklist

- [ ] Dark background
- [ ] Unified cards
- [ ] Consistent spacing
- [ ] Clear hierarchy
- [ ] List-based right panels
