'use client';

import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled } from '@/lib/feature-modules';

export function useEmployeesModule() {
  const { data: session, isPending } = useSession();
  return {
    employeesEnabled: isModuleKeyEnabled(session?.features, 'EMPLOYEES'),
    loading: isPending,
  };
}
