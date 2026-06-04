'use client';

import { ModuleGate } from '@/components/ModuleGate';
import { PayrollEmployeesView } from '@/features/payroll/PayrollEmployeesView';

export default function PayrollPage() {
  return (
    <ModuleGate moduleKey="PAYROLL" moduleLabel="Oylik">
      <PayrollEmployeesView />
    </ModuleGate>
  );
}
