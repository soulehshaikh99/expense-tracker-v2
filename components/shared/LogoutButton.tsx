'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  const logout = async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      toast.error('Logout failed. Please try again.');
      setPending(false);
    }
  };

  return (
    <Button variant="outline" size="lg" onClick={logout} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
      {pending ? 'Logging out...' : 'Logout'}
    </Button>
  );
}
