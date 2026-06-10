import { Suspense } from 'react';
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient';
import { DashboardLayoutFallback } from '@/components/dashboard/DashboardLayoutFallback';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
