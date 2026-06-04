'use client';

import { usePermissions } from '@/hooks/use-permissions';

export function usePayrollAccess() {
  const { role, loading } = usePermissions();
  const upper = role.toUpperCase();

  return {
    loading,
    canManage: upper === 'OWNER' || upper === 'MANAGER',
    canCalculate: ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(upper),
    canApprove: ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(upper),
    canPay: upper === 'OWNER' || upper === 'ACCOUNTANT',
  };
}
