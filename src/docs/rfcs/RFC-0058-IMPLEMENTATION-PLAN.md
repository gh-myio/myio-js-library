# Implementation Plan: Public Store Widget with Deep-Linking

**RFC:** RFC-0058
**Project:** Public Store Last Value Widget
**Target:** main-dashboard-shopping / PUBLIC-TELEMETRY
**Status:** Ready for Implementation
**Last Updated:** 2025-10-29

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Task Breakdown](#detailed-task-breakdown)
5. [Timeline & Milestones](#timeline--milestones)
6. [Verification Checklist](#verification-checklist)
7. [Deployment Steps](#deployment-steps)
8. [Rollback Plan](#rollback-plan)
9. [Success Criteria](#success-criteria)

---

## Overview

### Project Scope

Implement a public-facing ThingsBoard widget that enables:
- Deep-linking to specific stores via URL parameters (`storeLUC`)
- Public authentication using hard-coded credentials
- Integration with existing library action handlers
- Responsive store header and energy chart display
- Seamless fallback to widget-bound entities

### Key Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| 1 | Widget Files | controller.js, template.html, style.css |
| 2 | Authentication Module | MyIOAuthTB with token management |
| 3 | Device Resolution | URL parameter parsing + API integration |
| 4 | Action Integration | Wire buttons to library handlers |
| 5 | Documentation | README.md with usage instructions |
| 6 | Test Suite | Unit + integration tests |

### Technology Stack

- **Platform:** ThingsBoard 3.x+
- **Widget Type:** Last Value Widget
- **Language:** JavaScript (ES6+)
- **Styling:** CSS3 with flexbox
- **Authentication:** ThingsBoard REST API
- **Integration:** myio-js-library action handlers

---

## Prerequisites

### Development Environment

- [ ] Access to ThingsBoard instance (`dashboard.myio-bas.com`)
- [ ] Development credentials for ThingsBoard
- [ ] Text editor / IDE with JavaScript support
- [ ] Git repository access (`myio-js-library-PROD`)
- [ ] Modern browser with DevTools (Chrome/Firefox recommended)

### Required Knowledge

- ThingsBoard widget development
- JavaScript ES6+ features (async/await, arrow functions)
- REST API integration
- CSS flexbox layout
- Browser localStorage/sessionStorage APIs

### Dependencies

| Dependency | Version | Source | Purpose |
|-----------|---------|--------|---------|
| myio-js-library | Latest | Internal | Action handlers (Settings, Report, etc.) |
| ThingsBoard API | 3.x+ | Platform | Device & attribute APIs |
| Hard-coded Credentials | - | `alarmes@myio.com.br` | Public authentication |

### Access Requirements

- [ ] Read-only ThingsBoard account configured (`alarmes@myio.com.br`)
- [ ] Access to PUBLIC-TELEMETRY dashboard
- [ ] Permission to create/edit widgets in ThingsBoard
- [ ] Test devices with server-scope attributes configured

---

## Implementation Phases

### Phase 1: Project Setup (Day 1)

**Goal:** Create project structure and decide on authentication strategy

**Duration:** 1 day (6-8 hours)

#### Decision Gate: Authentication Strategy

**IMPORTANT:** Decide on authentication approach before implementation:

| Question | Answer | Action |
|----------|--------|--------|
| Is this a ThingsBoard Public Dashboard? | **YES** | Skip MyIOAuthTB entirely; use TB's native public share link |
| Is this a ThingsBoard Public Dashboard? | **NO** | Include MyIOAuthTB with hard-coded credentials |

**Recommended:** Use ThingsBoard's native public dashboard feature for better security and simpler implementation.

#### Tasks

1. **Create directory structure**
   ```
   C:\Projetos\GitHub\myio\myio-js-library-PROD.git\
     src\thingsboard\main-dashboard-shopping\PUBLIC-TELEMETRY\WIDGET\
       PUBLIC_STORE\
         controller.js
         template.html
         style.css
         settings.schema.json
         README.md
   ```

2. **Initialize files**
   - ✅ **Public Dashboard Path:** Skip authentication module entirely
   - ⚠️ **Private Dashboard Path:** Copy MyIOAuthTB module from PUBLIC-TELEMETRY reference
   - Set up basic widget scaffold with lifecycle hooks
   - Configure debug logging system

3. **Test authentication (if using MyIOAuthTB)**
   - Verify hard-coded credentials work
   - Test token caching in localStorage
   - Test automatic token refresh
   - Verify user profile loading

4. **Create settings schema**
   - Add settings.schema.json with button visibility toggles (showSettings, showReport, showInstant, showChartCTA)
   - Add primaryColor customization option

#### Verification

- [ ] **Decision made:** Public or Private dashboard approach selected
- [ ] Files created successfully
- [ ] Settings schema created with visibility toggles
- [ ] Authentication tested (if applicable)
- [ ] No console errors

---

### Phase 2: Device Resolution (Day 2)

**Goal:** Implement URL parameter reading and device lookup

**Duration:** 1 day (6-8 hours)

#### Tasks

1. **URL parameter parsing with normalization**
   - Implement `getStoreLUCFromURL()` function
   - **Add normalization:** `const storeLUC = (urlParams.get('storeLUC') || '').trim()`
   - Handle empty strings, null, undefined
   - Add logging for parameter detection

2. **API device resolution with dual-path lookup**
   - Implement `getDeviceByLUC()` with ThingsBoard API
   - **Primary path:** Query by deviceName
   - **Fallback path:** Query by server-scope attribute (commented out by default)
   - Handle successful responses
   - Handle 404/error responses gracefully
   - Add retry logic for network failures

3. **Safer fallback mechanism**
   - Implement `getDeviceFromContext()` for widget-bound entities
   - **Check `ctx.datasources[0]` first** (more reliable for LV widgets)
   - Fallback to `ctx.defaultSubscription` as secondary option
   - Test fallback when LUC is missing
   - Test fallback when LUC lookup fails

4. **Integration testing**
   - Test with valid LUC: `?storeLUC=113CD`
   - Test with invalid LUC: `?storeLUC=INVALID`
   - Test without LUC parameter
   - **Test with trailing spaces:** `?storeLUC=113CD   `
   - **Test with leading spaces:** `?storeLUC=   113CD`
   - **Test with mixed case** (if applicable)
   - **Test with empty parameter:** `?storeLUC=`
   - Verify fallback behavior in all cases

#### Verification

- [ ] Valid LUC resolves to correct device
- [ ] Invalid LUC triggers fallback
- [ ] Missing LUC uses widget-bound entity
- [ ] **URL normalization removes trailing/leading spaces**
- [ ] **Empty storeLUC parameter triggers fallback**
- [ ] **ctx.datasources fallback works correctly**
- [ ] All scenarios logged correctly

---

### Phase 3: Attributes & UI (Day 3)

**Goal:** Load device attributes and render store header

**Duration:** 1 day (6-8 hours)

#### Tasks

1. **Attribute loading**
   - Implement `loadServerScopeAttributes()` function
   - Parse attribute response into structured object
   - Handle missing attributes with defaults
   - Log warnings for missing critical attributes

2. **HTML template**
   - Create store header section
   - Add device info display elements
   - Create action button group
   - Add energy chart placeholder
   - Add loading overlay
   - Add error message container

3. **CSS styling**
   - Style store header with flexbox
   - Create button styles (primary, secondary, icon)
   - Add responsive breakpoints for mobile
   - Style loading overlay and error messages
   - Add hover effects and transitions

4. **UI rendering with smart identifier fallback**
   - Implement `pickIdentifier(attrs, storeLUC)` helper function
   - **Logic:** Prefer server-scope `identifier` → fallback to `storeLUC` → fallback to `'-'`
   - Implement `renderStoreHeader(label, identifier)` function
   - Implement `showLoading()` / `hideLoading()`
   - Implement `showError()` / `hideError()`
   - **Add user-facing toast for fallback scenarios** (non-technical copy)
   - Test UI states (loading, loaded, error)

#### Verification

- [ ] Store header displays device label
- [ ] **Identifier uses storeLUC when server-scope identifier is missing**
- [ ] Identifier shows correct format: "Store: 113CD"
- [ ] Loading overlay appears during init
- [ ] Error messages display correctly
- [ ] **Toast notification shown for fallback: "We're showing the store bound to this widget because the link code was not found."**
- [ ] Responsive layout works on mobile/tablet

---

### Phase 4: Action Integration (Day 4)

**Goal:** Wire action buttons to library handlers

**Duration:** 1 day (6-8 hours)

#### Tasks

1. **Device context creation**
   - Implement `createDeviceContext()` function
   - Include all required fields (deviceId, ingestionId, etc.)
   - Validate context structure

2. **Action wiring with namespace resolution**
   - Implement `wireActions()` function
   - **Create `resolveHandler()` helper:** Check `window.MyIOLib?.funcName` first, then `window.funcName`
   - Add event listeners for all buttons:
     - Settings button → `handleActionSettings()`
     - Report button → `handleActionReport()`
     - Instant Telemetry button → `openDemandModal()`
     - Energy chart/expand button → `handleActionDashboard()`

3. **Settings schema integration**
   - **Wire button visibility** to settings (ng-if="settings.showSettings !== false")
   - Apply primaryColor from settings to CSS variables
   - Test button show/hide based on settings
   - Validate that QA outcomes match visibility settings

4. **Error handling**
   - Check if library functions exist before calling (both namespaced and global)
   - Display user-friendly errors if functions missing
   - Log errors for debugging

5. **Integration testing**
   - Test each action button individually
   - Verify correct device context passed
   - Verify modals/dashboards open correctly
   - Test with missing library functions
   - **Test settings toggles:** Hide/show each button
   - **Test primaryColor:** Change and verify CSS update

#### Verification

- [ ] Settings button opens settings modal
- [ ] Report button opens consumption report
- [ ] Instant Telemetry opens demand modal
- [ ] Chart opens energy dashboard
- [ ] **Namespace resolution works:** `MyIOLib?.handleActionX` checked first
- [ ] Errors handled gracefully when functions missing
- [ ] **Button visibility controlled by settings schema**
- [ ] **Primary color applies from settings**

---

### Phase 5: Polish & Testing (Day 5)

**Goal:** Finalize implementation and comprehensive testing

**Duration:** 1 day (6-8 hours)

#### Tasks

1. **Code cleanup**
   - Remove debug code and console logs (if not needed)
   - Add JSDoc comments for functions
   - Format code consistently
   - Remove unused variables/functions

2. **Logging enhancement**
   - Ensure all logs use `MYIO:PUBLIC_TELEMETRY` prefix
   - Add context to log messages
   - Categorize logs (INFO, WARN, ERROR)
   - Make logging configurable via DEBUG_ACTIVE flag

3. **Responsive design**
   - Test on desktop (1920x1080, 1366x768)
   - Test on tablet (iPad, 768x1024)
   - Test on mobile (iPhone, 375x667)
   - Fix any layout issues

4. **Complete flow testing**
   - Test happy path: Valid LUC → Load → Render → Actions
   - Test error paths: Invalid LUC, missing attrs, API failures
   - Test edge cases: Empty attributes, long device names
   - Verify loading states and error messages

#### Verification

- [ ] Code is clean and well-commented
- [ ] All logs use correct prefix
- [ ] Widget is responsive on all devices
- [ ] Complete flow works end-to-end
- [ ] No console errors or warnings

---

### Phase 6: Unit Testing (Day 6)

**Goal:** Write and execute unit tests

**Duration:** 1 day (6-8 hours)

#### Tasks

1. **URL parameter tests**
   - Test `getStoreLUCFromURL()` with valid parameter
   - Test with missing parameter
   - Test with multiple parameters
   - Test with encoded characters

2. **Device resolution tests**
   - Mock `getDeviceByLUC()` API calls
   - Test successful device lookup
   - Test 404 response handling
   - Test network error handling
   - Test fallback logic

3. **Attribute loading tests**
   - Mock `loadServerScopeAttributes()` API calls
   - Test complete attribute set
   - Test partial attributes (missing some)
   - Test empty response
   - Test API error response

4. **Authentication tests**
   - Test token caching
   - Test token refresh
   - Test login on first load
   - Test expired token handling

#### Test Framework

```javascript
describe('Public Store Widget', () => {
  describe('URL Parameters', () => {
    it('should extract storeLUC from URL');
    it('should return null if no storeLUC');
  });

  describe('Device Resolution', () => {
    it('should fetch device by LUC');
    it('should return null for invalid LUC');
    it('should fallback to widget context');
  });

  describe('Attributes', () => {
    it('should load server-scope attributes');
    it('should return defaults for missing attrs');
  });

  describe('Authentication', () => {
    it('should login with credentials');
    it('should cache token in localStorage');
    it('should refresh expired token');
  });
});
```

#### Verification

- [ ] All unit tests pass
- [ ] Code coverage >80%
- [ ] Edge cases covered
- [ ] Mock data realistic

---

### Phase 7: Integration Testing (Day 7)

**Goal:** Test complete widget in ThingsBoard environment

**Duration:** 1 day (6-8 hours)

#### Test Cases

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | **Deep-Linking with Valid LUC** | 1. Open `?storeLUC=113CD`<br>2. Wait for load | Device "Shopping Campinas" displayed with identifier "113CD" | ⬜ |
| 2 | **Fallback without LUC** | 1. Open without storeLUC<br>2. Wait for load | Widget uses bound entity and displays info | ⬜ |
| 3 | **Invalid LUC Fallback** | 1. Open `?storeLUC=INVALID`<br>2. Check logs | Warning logged, fallback used | ⬜ |
| 4 | **Settings Action** | 1. Click Settings button | Settings modal opens with correct device | ⬜ |
| 5 | **Report Action** | 1. Click Report button | Report dashboard opens | ⬜ |
| 6 | **Instant Telemetry** | 1. Click Instant button | Demand modal opens | ⬜ |
| 7 | **Dashboard Action** | 1. Click chart area | Energy dashboard opens | ⬜ |
| 8 | **Missing Attributes** | 1. Device with no attrs<br>2. Load widget | Widget renders with "-" placeholders | ⬜ |
| 9 | **Authentication Flow** | 1. Clear localStorage<br>2. Reload | Auto-login successful | ⬜ |
| 10 | **Responsive Mobile** | 1. Open on mobile<br>2. Test layout | Buttons stack, layout adapts | ⬜ |

#### Verification

- [ ] All integration tests pass
- [ ] No console errors in any test
- [ ] Performance acceptable (<2s load time)
- [ ] Actions work correctly

---

### Phase 8: Deployment (Day 8)

**Goal:** Deploy widget to production ThingsBoard

**Duration:** 1 day (4-6 hours)

#### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed
- [ ] README.md completed
- [ ] Hard-coded credentials confirmed as READ-ONLY
- [ ] Widget settings schema validated
- [ ] Test devices configured with attributes

#### Deployment Steps

1. **Upload widget to ThingsBoard**
   - Navigate to Widget Library
   - Create new widget type: "Last Value"
   - Upload controller.js, template.html, style.css
   - Configure widget settings schema
   - Save widget

2. **Configure public dashboard**
   - Create or open PUBLIC_STORE dashboard
   - Add Public Store Widget
   - Configure widget settings if needed
   - Set dashboard as public (if required)

3. **Test in production**
   - Open dashboard with `?storeLUC=<TEST_LUC>`
   - Verify device loads correctly
   - Test all action buttons
   - Check browser console for errors

4. **Create deep-link URLs**
   - Generate URLs for each store:
     ```
     https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD
     https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=225AB
     ```
   - Document URLs for distribution

5. **Documentation**
   - Update README with usage instructions
   - Document URL parameter format
   - Add troubleshooting section
   - Share with stakeholders

#### Verification

- [ ] Widget visible in ThingsBoard widget library
- [ ] Dashboard loads without errors
- [ ] Deep-linking URLs work correctly
- [ ] Documentation complete

---

## Timeline & Milestones

### Week 1: Core Implementation

| Day | Phase | Tasks | Deliverable |
|-----|-------|-------|-------------|
| **1** | Project Setup | Directory structure, auth module, logging | Working authentication |
| **2** | Device Resolution | URL parsing, API integration, fallback | Device lookup working |
| **3** | Attributes & UI | Attribute loading, HTML/CSS, rendering | UI rendering correctly |
| **4** | Action Integration | Wire buttons, error handling | Actions functional |
| **5** | Polish & Testing | Code cleanup, responsive design, flow testing | Production-ready code |

### Week 2: Testing & Deployment

| Day | Phase | Tasks | Deliverable |
|-----|-------|-------|-------------|
| **6** | Unit Testing | Write tests, mock APIs, verify coverage | Test suite passing |
| **7** | Integration Testing | Test in ThingsBoard, verify actions, check responsiveness | All tests passing |
| **8** | Deployment | Upload widget, configure dashboard, document | Widget live in production |

### Total Duration: **2 weeks (8 working days)**

---

## Verification Checklist

### Functionality

- [ ] Widget loads without errors
- [ ] **URL parameter `storeLUC` correctly parsed and normalized** (trim whitespace)
- [ ] **Device resolved by LUC successfully (primary path: deviceName)**
- [ ] **Dual-path lookup available** (commented fallback to attribute search)
- [ ] **Fallback to widget-bound entity works** (ctx.datasources → defaultSubscription)
- [ ] Server-scope attributes loaded
- [ ] **Store header displays correct information with smart identifier fallback** (attr → storeLUC → '-')
- [ ] Settings button opens settings modal
- [ ] Report button opens consumption report
- [ ] Instant Telemetry button opens demand modal
- [ ] Chart area opens energy dashboard
- [ ] Loading overlay shown during initialization
- [ ] Error messages displayed on failures
- [ ] **User-facing toast notification shown for fallback scenarios** (non-technical copy)

### Technical

- [ ] **Authentication decision made:** Public dashboard (TB native) OR Private (MyIOAuthTB)
- [ ] Authentication with hard-coded credentials works (if applicable)
- [ ] Token cached in localStorage (if applicable)
- [ ] Token refresh works automatically (if applicable)
- [ ] Logs use `MYIO:PUBLIC_TELEMETRY` prefix
- [ ] **Action handlers use namespace resolution:** `MyIOLib?.funcName` → `window.funcName`
- [ ] No console errors or warnings
- [ ] Code follows project conventions
- [ ] JSDoc comments added for functions
- [ ] **Settings schema configured** with button visibility toggles

### UI/UX

- [ ] Responsive layout on desktop (1920x1080, 1366x768)
- [ ] Responsive layout on tablet (iPad, 768x1024)
- [ ] Responsive layout on mobile (iPhone, 375x667)
- [ ] Buttons have hover effects
- [ ] Loading state is visible
- [ ] **Error messages are user-friendly and non-technical**
- [ ] **Toast notifications use user-friendly copy** ("We're showing the store bound to this widget because the link code was not found.")
- [ ] **Button visibility controlled by settings** (showSettings, showReport, showInstant, showChartCTA)
- [ ] **Primary color customizable** via settings

### Security

- [ ] **Preferred:** ThingsBoard Public Dashboard used (no credentials in code)
- [ ] **Alternative:** Hard-coded credentials are READ-ONLY (if using MyIOAuthTB)
- [ ] Token not exposed in URL or logs
- [ ] HTTPS used for all API calls
- [ ] No sensitive data in URL parameters
- [ ] **LUC value normalized** to prevent injection attacks

### Performance

- [ ] Widget loads in <2 seconds
- [ ] Device resolution in <500ms
- [ ] Attribute loading in <300ms
- [ ] Action response time <200ms

---

## Deployment Steps

### 1. Pre-Deployment

```bash
# Navigate to project directory
cd C:\Projetos\GitHub\myio\myio-js-library-PROD.git

# Pull latest changes
git pull origin main

# Verify files exist
dir src\thingsboard\main-dashboard-shopping\PUBLIC-TELEMETRY\WIDGET\PUBLIC_STORE
```

### 2. Widget Upload

**Via ThingsBoard UI:**

1. Login to ThingsBoard: `https://dashboard.myio-bas.com`
2. Navigate to: **Widget Library** > **Create new widget type** > **Last Value**
3. Widget Bundle: Select `main-dashboard-shopping`
4. Upload files:
   - **JavaScript:** Copy content from `controller.js`
   - **HTML:** Copy content from `template.html`
   - **CSS:** Copy content from `style.css`
5. Settings Schema: Copy content from `settings.schema.json` (if applicable)
6. Save widget as: **"Public Store Widget"**

### 3. Dashboard Configuration

1. Navigate to: **Dashboards** > **PUBLIC_STORE** (or create new)
2. Click **"+ Add Widget"**
3. Select: **Last Value** > **Public Store Widget**
4. Configure widget:
   - **Datasource:** Optional (can leave empty)
   - **Entity Alias:** Optional fallback device
   - **Settings:** Configure if needed
5. Resize and position widget on dashboard
6. Save dashboard

### 4. Public Access Configuration

1. Dashboard settings > **Make Public**
2. Copy public dashboard URL
3. Test URL: `https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD`

### 5. Post-Deployment Verification

```bash
# Test URLs for each store
# Replace <LUC> with actual store codes
https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=113CD
https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=225AB
https://dashboard.myio-bas.com/dashboard/PUBLIC_STORE?storeLUC=334EF
```

**Checklist:**
- [ ] Each URL loads correctly
- [ ] Correct store displayed
- [ ] All action buttons work
- [ ] No console errors
- [ ] Responsive on mobile

---

## Rollback Plan

### If Critical Issues Found

**Symptoms:**
- Widget crashes on load
- Authentication fails completely
- Actions trigger errors
- Data not loading

**Rollback Procedure:**

1. **Remove widget from dashboard**
   - Edit dashboard
   - Delete Public Store Widget
   - Add previous widget version (if available)
   - Save dashboard

2. **Disable public access (if needed)**
   - Dashboard settings > **Make Private**

3. **Notify stakeholders**
   - Send email with issue description
   - Provide ETA for fix
   - Offer alternative access method

4. **Fix issues**
   - Review error logs
   - Apply fixes
   - Re-test locally
   - Re-deploy when stable

### Backup Strategy

**Before deployment:**
```bash
# Create backup of current dashboard configuration
# Export dashboard JSON from ThingsBoard UI
# Save to: backups/PUBLIC_STORE_dashboard_<DATE>.json

# Create git tag for deployment
git tag -a v1.0.0-public-store-widget -m "Public Store Widget v1.0.0"
git push origin v1.0.0-public-store-widget
```

---

## Success Criteria

### Functional Success

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Deep-link success rate | 100% | - | ⬜ |
| Fallback success rate | 100% | - | ⬜ |
| Action success rate | 100% | - | ⬜ |
| Authentication success rate | ≥99% | - | ⬜ |
| Attribute load success rate | ≥95% | - | ⬜ |

### Performance Success

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Widget load time | <2s | - | ⬜ |
| Device resolution time | <500ms | - | ⬜ |
| Attribute load time | <300ms | - | ⬜ |
| Action response time | <200ms | - | ⬜ |

### User Experience Success

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Error rate | <1% | - | ⬜ |
| User confusion (support tickets) | <5% | - | ⬜ |
| Deep-link usage | >50% | - | ⬜ |

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Developer** | ____________ | ______ | ____________ |
| **Tech Lead** | ____________ | ______ | ____________ |
| **QA Lead** | ____________ | ______ | ____________ |
| **Product Owner** | ____________ | ______ | ____________ |

---

## Next Steps

### After Successful Deployment

1. **Monitor widget performance**
   - Check error logs daily for first week
   - Monitor authentication success rate
   - Track deep-link usage

2. **Gather user feedback**
   - Survey stakeholders
   - Monitor support tickets
   - Identify improvement opportunities

3. **Documentation**
   - Create user guide with screenshots
   - Add to knowledge base
   - Share deep-link URLs with teams

4. **Future enhancements**
   - Multi-language support (PT, ES)
   - KPI badges (Min/Max/Avg)
   - Real chart rendering
   - Export functionality

---

## Contact & Support

### Development Team

- **Tech Lead:** [Name] - [Email]
- **Backend Developer:** [Name] - [Email]
- **Frontend Developer:** [Name] - [Email]

### Documentation

- **RFC Document:** `src/docs/rfcs/RFC-0058-Public-Store-Widget.md`
- **Code Location:** `src/thingsboard/main-dashboard-shopping/PUBLIC-TELEMETRY/WIDGET/PUBLIC_STORE/`
- **Library Actions:** `myio-js-library` (action handlers)

### Issue Tracking

- **GitHub Issues:** [Repository URL]
- **Support Email:** support@myio.com.br
- **Documentation:** [Wiki URL]

---

**End of Implementation Plan**

**Prepared by:** MYIO Platform Team
**Version:** 1.0.0
**Date:** 2025-10-29
