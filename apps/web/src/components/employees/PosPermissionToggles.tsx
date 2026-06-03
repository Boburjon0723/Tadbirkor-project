'use client';

import React, { useEffect, useState } from 'react';
import {
  POS_PERMISSION_TOGGLES,
  defaultPosTogglesForRole,
  posTogglesFromMember,
  buildPosGrantDeny,
} from '@/lib/pos-permissions';

type Props = {
  role: string;
  grantPermissions?: string[];
  denyPermissions?: string[];
  onChange: (payload: {
    grantPermissions: string[];
    denyPermissions: string[];
  }) => void;
  /** SALES kabi rollarda POS bo‘lmasa yashirish */
  showOnlyIfPosRole?: boolean;
};

const POS_ROLES_WITH_KASSA = ['MANAGER', 'SALES', 'ACCOUNTANT'];

export function PosPermissionToggles({
  role,
  grantPermissions,
  denyPermissions,
  onChange,
  showOnlyIfPosRole = true,
}: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (grantPermissions !== undefined || denyPermissions !== undefined) {
      setChecked(
        posTogglesFromMember(role, grantPermissions, denyPermissions),
      );
    } else {
      setChecked(defaultPosTogglesForRole(role));
    }
  }, [role, grantPermissions, denyPermissions]);

  const setToggle = (key: string, on: boolean) => {
    const next = { ...checked, [key]: on };
    setChecked(next);
    onChange(buildPosGrantDeny(role, next));
  };

  if (showOnlyIfPosRole && !POS_ROLES_WITH_KASSA.includes(role.toUpperCase())) {
    return null;
  }

  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
        Kassa (POS) qo‘shimcha ruxsatlar
      </p>
      {POS_PERMISSION_TOGGLES.map(({ key, label, hint }) => (
        <label
          key={key}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={!!checked[key]}
            onChange={(e) => setToggle(key, e.target.checked)}
            className="mt-1 w-4 h-4 accent-blue-500"
          />
          <div>
            <p className="font-black text-sm text-white group-hover:text-blue-300">
              {label}
            </p>
            <p className="text-xs text-gray-500 font-medium">{hint}</p>
          </div>
        </label>
      ))}
      {role.toUpperCase() === 'SALES' && (
        <p className="text-xs text-amber-400/90 font-bold">
          Sotuvchi uchun odatda barchasi o‘chiq — faqat naqd sotuv.
        </p>
      )}
    </div>
  );
}
