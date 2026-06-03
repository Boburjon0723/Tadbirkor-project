'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Shield, Check, X } from 'lucide-react';
import { usersService } from '@/services/users.service';
import { PERMISSION_GROUPS, formatPermissionKey, ROLE_LABELS, type SystemRole } from '@/lib/roles';

export function RolePermissionsMatrix() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<SystemRole>('MANAGER');

  useEffect(() => {
    usersService
      .getRolesCatalog()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCatalog(list);
        const firstAssignable = list.find((r: any) => r.assignable);
        if (firstAssignable) setSelectedRole(firstAssignable.key);
      })
      .catch(() => setCatalog([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={28} />
      </div>
    );
  }

  const active = catalog.find((r) => r.key === selectedRole);
  const permissionSet = new Set<string>(active?.permissions || []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-5 rounded-[1.5rem] bg-white/[0.03] border border-white/10">
        <Shield className="text-blue-400 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-gray-400 font-medium leading-relaxed">
          Har bir rol tizimda tayyor ruxsatlar to‘plamiga ega. Xodimga rol tanlaganingizda shu ruxsatlar avtomatik qo‘llanadi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {catalog.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => setSelectedRole(role.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-black transition-all border ${
              selectedRole === role.key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {ROLE_LABELS[role.key as SystemRole] || role.label}
          </button>
        ))}
      </div>

      {active?.description && (
        <p className="text-sm text-gray-500 font-medium px-1">{active.description}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERMISSION_GROUPS.map((group) => (
          <div
            key={group.title}
            className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {group.title}
            </p>
            <ul className="space-y-2">
              {group.keys.map((key) => {
                const allowed = permissionSet.has(key);
                return (
                  <li key={key} className="flex items-center gap-2 text-sm">
                    {allowed ? (
                      <Check size={14} className="text-emerald-400 shrink-0" />
                    ) : (
                      <X size={14} className="text-gray-600 shrink-0" />
                    )}
                    <span className={allowed ? 'text-gray-300 font-medium' : 'text-gray-600'}>
                      {formatPermissionKey(key)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
