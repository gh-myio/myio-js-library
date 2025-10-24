# RFC-0055: Shopping Selector for Multi-Location Users

**Status**: Implemented
**Date**: 2025-10-23
**Version**: v-5.2.0
**Affected Widgets**: MENU

---

## Summary

Implemented a shopping selector feature that allows users from the `@sacavalcante.com.br` domain to switch between different shopping locations (Mestre Álvaro and Mont Serrat) directly from the dashboard menu.

---

## Problem Statement

Users from the sacavalcante.com.br domain need to access multiple shopping locations, each with its own dashboard. Without this feature, they would need to manually navigate to different URLs or bookmark multiple dashboards.

---

## Solution

### User Detection

The MENU widget now detects users with email addresses ending in `@sacavalcante.com.br` during the user info fetch:

```javascript
// RFC-0055: Check if user is from sacavalcante.com.br domain
if (user.email && user.email.endsWith('@sacavalcante.com.br')) {
  LogHelper.log("[MENU] User from sacavalcante.com.br detected - enabling shopping selector");
  addShoppingSelectorButton();
}
```

**Location**: `MENU/controller.js:107-112`

### Shopping Selector Button

When a sacavalcante.com.br user is detected, a new menu item "Trocar Shopping" is dynamically added to the menu:

```javascript
function addShoppingSelectorButton() {
  // Check if button already exists
  if (document.getElementById('shopping-selector-btn')) {
    LogHelper.log("[MENU] Shopping selector button already exists");
    return;
  }

  // Find the menu container (before logout button)
  const menuContainer = document.querySelector('.shops-menu-root .menu-container');
  const logoutBtn = document.getElementById('logout-btn');

  // Create shopping selector button
  const shoppingSelectorBtn = document.createElement('div');
  shoppingSelectorBtn.id = 'shopping-selector-btn';
  shoppingSelectorBtn.className = 'menu-item shopping-selector';
  shoppingSelectorBtn.innerHTML = `
    <span class="menu-icon">🏢</span>
    <span class="menu-label">Trocar Shopping</span>
  `;

  // Insert before logout button
  if (logoutBtn) {
    menuContainer.insertBefore(shoppingSelectorBtn, logoutBtn);
  } else {
    menuContainer.appendChild(shoppingSelectorBtn);
  }

  // Add click handler
  shoppingSelectorBtn.addEventListener('click', () => {
    LogHelper.log("[MENU] Shopping selector clicked");
    showShoppingModal();
  });
}
```

**Location**: `MENU/controller.js:282-322`

### Shopping Selection Modal

When the user clicks "Trocar Shopping", a modal displays with two shopping options:

```javascript
function showShoppingModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('shopping-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal with shopping options
  const modal = document.createElement('div');
  modal.id = 'shopping-modal';
  modal.className = 'shopping-modal';
  modal.innerHTML = `
    <div class="shopping-modal-overlay"></div>
    <div class="shopping-modal-content">
      <div class="shopping-modal-header">
        <h2>Selecione o Shopping</h2>
        <button class="shopping-modal-close">&times;</button>
      </div>
      <div class="shopping-modal-body">
        <div class="shopping-option" data-url="https://dashboard.myio-bas.com/dashboards/all/ed5a0dd0-a3b7-11f0-afe1-175479a33d89">
          <div class="shopping-icon">🏢</div>
          <div class="shopping-name">Mestre Álvaro</div>
        </div>
        <div class="shopping-option" data-url="https://dashboard.myio-bas.com/dashboards/all/1e785950-af55-11f0-9722-210aa9448abc">
          <div class="shopping-icon">🏢</div>
          <div class="shopping-name">Mont Serrat</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const closeBtn = modal.querySelector('.shopping-modal-close');
  const overlay = modal.querySelector('.shopping-modal-overlay');
  const options = modal.querySelectorAll('.shopping-option');

  // Close handlers
  const closeModal = () => {
    modal.classList.add('closing');
    setTimeout(() => modal.remove(), 300);
  };

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  // Shopping selection handlers
  options.forEach(option => {
    option.addEventListener('click', () => {
      const url = option.getAttribute('data-url');
      const name = option.querySelector('.shopping-name').textContent;

      LogHelper.log(`[MENU] Navigating to ${name}: ${url}`);
      window.location.href = url;
    });
  });

  // Show modal with animation
  setTimeout(() => modal.classList.add('show'), 10);
}
```

**Location**: `MENU/controller.js:324-388`

---

## Shopping Locations

| Shopping | Dashboard URL |
|----------|---------------|
| **Mestre Álvaro** | `https://dashboard.myio-bas.com/dashboards/all/ed5a0dd0-a3b7-11f0-afe1-175479a33d89` |
| **Mont Serrat** | `https://dashboard.myio-bas.com/dashboards/all/1e785950-af55-11f0-9722-210aa9448abc` |

---

## CSS Styling

The modal is styled with:

- **Overlay**: Semi-transparent backdrop with blur effect
- **Modal content**: White card with border-radius, shadow, and smooth animations
- **Header**: Purple background (`var(--brand)`) matching the menu theme
- **Shopping options**: Card-style buttons with hover effects (lift animation)
- **Animations**: Fade-in/scale-up on open, fade-out/scale-down on close
- **Responsive**: Adjusts for mobile screens (< 640px)

**Location**: `MENU/style.css:230-403`

Key CSS classes:
- `.shopping-modal` - Modal container with fade animation
- `.shopping-modal-overlay` - Semi-transparent backdrop
- `.shopping-modal-content` - Modal box with scale animation
- `.shopping-modal-header` - Purple header with close button
- `.shopping-modal-body` - Container for shopping options
- `.shopping-option` - Interactive shopping cards with hover effects

---

## User Experience Flow

1. **Login**: User logs in with `@sacavalcante.com.br` email
2. **Detection**: MENU widget detects the domain during user info fetch
3. **Button Added**: "Trocar Shopping" button appears in menu (before logout button)
4. **Click**: User clicks "Trocar Shopping"
5. **Modal Opens**: Modal displays with two shopping options
6. **Selection**: User clicks on a shopping option
7. **Navigation**: Browser navigates to the selected shopping's dashboard URL

---

## User Access Control

**Enabled for**:
- Users with email ending in `@sacavalcante.com.br`

**Not shown for**:
- Users from other domains
- Unauthenticated users

---

## Technical Details

### Duplicate Prevention

The button creation function checks if the button already exists before adding it:

```javascript
if (document.getElementById('shopping-selector-btn')) {
  LogHelper.log("[MENU] Shopping selector button already exists");
  return;
}
```

This prevents duplicate buttons if the function is called multiple times.

### Modal Cleanup

The modal creation function removes any existing modal before creating a new one:

```javascript
const existingModal = document.getElementById('shopping-modal');
if (existingModal) {
  existingModal.remove();
}
```

This ensures only one modal is displayed at a time.

### Animation Timing

The modal uses CSS transitions with JavaScript timing:

```javascript
// Show modal with animation (add .show class after DOM insertion)
setTimeout(() => modal.classList.add('show'), 10);

// Close modal with animation (remove after animation completes)
const closeModal = () => {
  modal.classList.add('closing');
  setTimeout(() => modal.remove(), 300);
};
```

---

## Logging

All actions are logged for debugging:

```javascript
LogHelper.log("[MENU] User from sacavalcante.com.br detected - enabling shopping selector");
LogHelper.log("[MENU] Shopping selector button added successfully");
LogHelper.log("[MENU] Shopping selector clicked");
LogHelper.log("[MENU] Shopping modal displayed");
LogHelper.log(`[MENU] Navigating to ${name}: ${url}`);
```

---

## Testing Checklist

- [ ] Login with `@sacavalcante.com.br` email
- [ ] Verify "Trocar Shopping" button appears in menu
- [ ] Verify button appears before logout button
- [ ] Click "Trocar Shopping" button
- [ ] Verify modal opens with animation
- [ ] Verify modal shows two shopping options: Mestre Álvaro and Mont Serrat
- [ ] Click overlay - verify modal closes
- [ ] Click X button - verify modal closes
- [ ] Click Mestre Álvaro option - verify navigation to correct URL
- [ ] Click Mont Serrat option - verify navigation to correct URL
- [ ] Login with non-sacavalcante.com.br email - verify button does NOT appear
- [ ] Test on mobile screen (< 640px) - verify responsive styling

---

## Future Enhancements

### Potential Improvements:

1. **Dynamic Shopping List**: Fetch shopping list from API instead of hardcoding
2. **Current Location Indicator**: Highlight the currently active shopping
3. **Keyboard Navigation**: Add keyboard shortcuts (ESC to close, arrow keys to navigate)
4. **Loading State**: Show loading indicator while navigating
5. **Error Handling**: Handle navigation errors gracefully
6. **Breadcrumb**: Show current shopping location in HEADER
7. **Quick Switch**: Add keyboard shortcut to open modal directly

---

## Related RFCs

- **RFC-0042**: State ID to Domain mapping (tab navigation)
- **RFC-0053**: Content container show/hide logic
- **RFC-0054**: MAIN_VIEW orchestrator and HEADER fixes

---

## Files Modified

1. **MENU/controller.js** - Added user detection, button creation, modal display
2. **MENU/style.css** - Added modal styling with animations

---

## References

- User email: Retrieved from `/api/auth/user` endpoint
- Shopping URLs: ThingsBoard dashboard permalinks
- Menu styling: Uses existing CSS variables (`--brand`, `--ghost`, `--hover-bg`)
