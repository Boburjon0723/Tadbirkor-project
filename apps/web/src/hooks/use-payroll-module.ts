'use client';

import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled } from '@/lib/feature-modules';

export function usePayrollModule() {
  const { data: session, isPending } = useSession();
  return {
    payrollEnabled: isModuleKeyEnabled(session?.features, 'PAYROLL'),
    loading: isPending,
  };
}
