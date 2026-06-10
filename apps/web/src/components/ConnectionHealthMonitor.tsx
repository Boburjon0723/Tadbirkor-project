'use client';

import { usePathname } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-token';
import { useConnectionHealth } from '@/hooks/use-connection-health';
import { ConnectionRefreshBanner } from '@/components/ConnectionRefreshBanner';

const MONITORED_PREFIXES = ['/dashboard', '/pos', '/field', '/admin', '/onboarding'];

export function ConnectionHealthMonitor() {
  const pathname = usePathname() || '';
  const enabled =
    MONITORED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    Boolean(getAuthToken());

  const { issue, refresh, clearIssue } = useConnectionHealth(enabled);

  if (!enabled || !issue) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8 md:pt-3 pointer-events-none">
      <div className="max-w-4xl mx-auto pointer-events-auto shadow-2xl">
        <ConnectionRefreshBanner issue={issue} onRefresh={refresh} onDismiss={clearIssue} />
      </div>
    </div>
  );
}
