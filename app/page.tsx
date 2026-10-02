'use client';

import { LogoutButton } from '@/components/shared/LogoutButton';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Expense Tracker</h1>
            <p className="text-muted-foreground">Manage your monthly expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
      </main>
    </div>
  );
}
