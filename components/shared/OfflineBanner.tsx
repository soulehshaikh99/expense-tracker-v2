'use client';

import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-50 px-4 pt-2">
      <Alert role="alert" className="mx-auto max-w-[1600px] border-pending/40 bg-pending/15">
        <WifiOff aria-hidden="true" />
        <AlertDescription className="text-foreground">
          No internet connection. Changes are disabled until you&apos;re back online.
        </AlertDescription>
      </Alert>
    </div>
  );
}
