# RFC-0001: MYIO Platform – Landing Dashboard Layout

- Feature Name: myio_landing_dashboard
- Start Date: 2026-01-02
- Status: Draft
- Authors: MYIO Engineering
- Target Version: v1.0
- Related Components: Authentication UI, Dashboard Router, Customer Selector

---

## Summary

This RFC documents the reverse-engineered structure, behavior, and intent of the MYIO Platform Landing Dashboard.  
The screen serves as the primary entry point after user authentication, providing identity context, navigation control, and shortcuts to individual shopping center dashboards.

---

## Motivation

The Landing Dashboard fulfills three core objectives:

1. **User Context Awareness**

   - Clearly indicate who is logged in.
   - Provide a safe and explicit logout action.

2. **Platform Orientation**

   - Communicate the MYIO value proposition.
   - Act as a neutral starting point before drilling down into data.

3. **Fast Navigation**
   - Offer direct access to multiple shopping dashboards.
   - Reduce friction between login and operational dashboards.

This design prioritizes clarity, speed, and scalability as the number of monitored sites grows.

---

## High-Level Layout Overview

The interface is composed of four primary regions:

1. **Top Navigation Bar**
2. **Hero / Welcome Section**
3. **Primary Call-to-Action**
4. **Dashboard Shortcut Cards**

The layout is horizontally centered, visually symmetric, and uses a full-width gradient background consistent with MYIO brand identity.

---

## Detailed Design

### 1. Top Navigation Bar

#### 1.1 Logo Area (Top-Left)

- Displays the MYIO brand logo.
- Serves as a static brand anchor.
- No navigation behavior is implied or required at this stage.

**Purpose:**

- Brand reinforcement
- Immediate platform recognition

---

#### 1.2 User Context Panel (Top-Right)

Contains:

- Logged-in user full name
- User email address
- Explicit **Logout / Sign Out** button

**Behavior:**

- Logout button terminates the current session.
- Redirects user back to the authentication flow.

**Purpose:**

- Transparency about session identity
- Security and session control

---

### 2. Hero / Welcome Section (Center)

#### 2.1 Welcome Message

Displayed centrally with high visual hierarchy.

**Content:**

- Primary heading welcoming the user to the MYIO Platform
- Secondary descriptive subtitle explaining the platform focus:
  - Energy
  - Water
  - Resource management
  - Shopping centers

**Purpose:**

- Contextual onboarding
- Reinforce platform mission and scope

---

### 3. Primary Call-to-Action

#### 3.1 "Access Dashboard" Button

- Positioned directly below the welcome text.
- Visually prominent and action-oriented.

**Behavior:**

- Redirects to the default or last-accessed dashboard.
- Acts as a general entry point when a specific shopping is not selected.

**Purpose:**

- Fast continuation for returning users
- Clear next step for first-time users

---

### 4. Shopping Dashboard Cards Section

#### 4.1 Cards Grid

A horizontal grid of cards, each representing a shopping center.

Each card contains:

- Shopping name (e.g., Mestre Álvaro, Mont Serrat, etc.)
- Subtitle indicating "Main Dashboard" (or equivalent)

**Behavior:**

- Entire card is clickable.
- Redirects directly to the selected shopping’s dashboard context.

**Design Characteristics:**

- Equal-sized cards
- Consistent spacing
- Visual affordance for clickability
- Scales horizontally as more shopping centers are added

---

## Routing & Navigation Model

- Authentication occurs before this screen.
- All redirects preserve user session and permissions.
- Each card maps to a unique dashboard identifier.

```text
Login
  → Landing Dashboard
      → Access Panel (default)
      → Shopping A Dashboard
      → Shopping B Dashboard
      → Shopping N Dashboard
```
