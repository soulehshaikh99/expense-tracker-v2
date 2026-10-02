'use client';

import { useMemo, useRef } from 'react';

/**
 * Controlled dialogs opened without a Trigger have no element to return focus to.
 * Spread the returned handlers onto Dialog/Sheet/Drawer content: the opener is recorded
 * before Radix moves focus in, and focus goes back to it on close.
 */
export function useRestoreFocus() {
  const opener = useRef<HTMLElement | null>(null);
  return useMemo(
    () => ({
      onOpenAutoFocus: () => {
        const el = document.activeElement;
        opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
      },
      onCloseAutoFocus: (event: Event) => {
        const el = opener.current;
        if (el && el.isConnected) {
          event.preventDefault();
          el.focus();
        }
      },
    }),
    [],
  );
}
