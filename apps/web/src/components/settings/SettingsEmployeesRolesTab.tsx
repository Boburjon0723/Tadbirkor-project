'use client';

import { Loader2 } from 'lucide-react';
import { RoleSettingsSection } from '@/components/RoleSettingsSection';
import { useEmployeesModule } from '@/hooks/use-employees-module';

export function SettingsEmployeesRolesTab() {
  const { employeesEnabled, loading } = useEmployeesModule();

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={30} />
      </div>
    );
  }

  if (!employeesEnabled) {
    return (
      <div className="p-8 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 text-amber-200">
        <p className="font-black text-lg mb-2">Xodimlar moduli o‘chirilgan</p>
        <p className="text-sm text-amber-200/80 font-medium">
          Rollar va jamoa boshqaruvi uchun «Modullar» bo‘limida Xodimlar modulini yoqing.
        </p>
      </div>
    );
  }

  return <RoleSettingsSection />;
}
