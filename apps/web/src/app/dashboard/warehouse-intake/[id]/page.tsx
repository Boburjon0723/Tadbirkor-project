'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { useWarehouseIntake } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { IntakeSessionDesktop } from '@/features/warehouse-intake/IntakeSessionDesktop';
import { IntakeMobileSession } from '@/features/warehouse-intake/mobile/IntakeMobileSession';

export default function WarehouseIntakeSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const { data: intake, isLoading, isError, refetch } = useWarehouseIntake(id);

  return (
    <ModuleGate moduleKey="WAREHOUSE_INTAKE" moduleLabel="Ombor kirimi">
      <div className="hidden lg:block pb-12">
        {isLoading && (
          <div className="py-24 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        )}
        {isError && (
          <div className="py-20 text-center text-gray-500">
            Hujjat topilmadi yoki ruxsat yo&apos;q.
          </div>
        )}
        {intake && (
          <IntakeSessionDesktop
            intake={intake}
            onUpdated={() => {
              void refetch();
              if (intake.status !== 'DRAFT') {
                router.refresh();
              }
            }}
          />
        )}
      </div>

      {intake && (
        <IntakeMobileSession
          intake={intake}
          onUpdated={() => void refetch()}
        />
      )}
    </ModuleGate>
  );
}
