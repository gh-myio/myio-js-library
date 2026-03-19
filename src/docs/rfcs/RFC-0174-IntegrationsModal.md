# RFC-0174: Integrations Premium Modal with Tabs and iFrames

## Summary

Create a premium modal that opens when clicking "Integrações" in the sidebar menu. The modal displays external integrations (CHILLER, VRF, GERADOR) via iframes, using tabs to switch between them.

## Status

- **Status**: Implemented
- **Author**: Claude Code
- **Created**: 2026-02-12

## Requirements

1. Menu item "Integrações" triggers the modal
2. Maximized modal with blur backdrop
3. 3 tabs: CHILLER | VRF | GERADOR
4. Each tab loads an iframe:
   - CHILLER: `https://melicidade1.myio-bas.com/`
   - VRF: `https://melicidade2.myio-bas.com/`
   - GERADOR: `https://melicidade3.myio-bas.com/`

## Architecture

### Pattern: Simplified Premium Modal

Based on existing patterns in `src/components/premium-modals/`, we use a simplified structure:

```
src/components/premium-modals/integrations/
├── IntegrationsModal.ts       # Main modal class
├── IntegrationsModalView.ts   # UI rendering
├── openIntegrationsModal.ts   # Public API
├── types.ts                   # TypeScript interfaces
└── index.ts                   # Exports
```

### Reuse from existing components

- `ModalPremiumShell.ts` - backdrop blur, modal container, close handling
- `CardGridPanel` tabs CSS - adapted `myio-cgp__tabs-*` classes for consistent tab styling
- CSS tokens from `internal/styles/tokens.ts`

## Tab Configuration

```typescript
const INTEGRATION_TABS: IntegrationTab[] = [
  { id: 'chiller', label: 'CHILLER', url: 'https://melicidade1.myio-bas.com/' },
  { id: 'vrf', label: 'VRF', url: 'https://melicidade2.myio-bas.com/' },
  { id: 'gerador', label: 'GERADOR', url: 'https://melicidade3.myio-bas.com/' },
];
```

## Modal Specifications

- **Width:** 95vw (nearly full width)
- **Height:** 95vh (nearly full height)
- **Backdrop:** rgba(0, 0, 0, 0.5) with blur(2px)
- **Header:** Minimal - title "Integrações" + close button
- **Content:** Tabs bar + iframe (fills remaining space)

## Files Created/Modified

| File | Action |
|------|--------|
| `src/docs/rfcs/RFC-0174-IntegrationsModal.md` | Created |
| `src/components/premium-modals/integrations/types.ts` | Created |
| `src/components/premium-modals/integrations/IntegrationsModalView.ts` | Created |
| `src/components/premium-modals/integrations/IntegrationsModal.ts` | Created |
| `src/components/premium-modals/integrations/openIntegrationsModal.ts` | Created |
| `src/components/premium-modals/integrations/index.ts` | Created |
| `src/components/premium-modals/index.ts` | Modified (added export) |
| `src/thingsboard/bas-components/MAIN_BAS/controller.js` | Modified (wired menu) |

## Usage

```typescript
import { openIntegrationsModal } from 'myio-js-library';

// Open the modal
const modal = openIntegrationsModal({
  theme: 'dark',
  defaultTab: 'chiller',
  onClose: () => console.log('Modal closed'),
});

// Close programmatically
modal.close();
```

## Verification Checklist

- [x] Build passes: `npm run build`
- [x] Click "Integrações" in sidebar menu
- [x] Modal opens with blur backdrop
- [x] 3 tabs visible: CHILLER | VRF | GERADOR
- [x] Clicking each tab loads corresponding iframe
- [x] Close button (X) closes modal
- [x] Clicking backdrop closes modal
- [x] ESC key closes modal
