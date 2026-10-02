'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * When offline, wrap a (disabled) write control in a focusable span with a
 * "You're offline" tooltip. Disabled buttons do not fire pointer events, so the
 * tooltip trigger has to be the wrapper.
 */
export function OfflineTooltip({ offline, children }: { offline: boolean; children: React.ReactNode }) {
  if (!offline) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>You&apos;re offline</TooltipContent>
    </Tooltip>
  );
}
