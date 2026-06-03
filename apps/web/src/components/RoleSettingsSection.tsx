'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Shield, AlertCircle, UserPlus, ArrowRight } from 'lucide-react';
import { usersService } from '@/services/users.service';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { RolePermissionsMatrix } from '@/components/employees/RolePermissionsMatrix';
import { PosPermissionToggles } from '@/components/employees/PosPermissionToggles';
import { ASSIGNABLE_ROLES, roleRequiresWarehouse } from '@/lib/roles';

export function RoleSettingsSection() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingWarehouse, setPendingWarehouse] = useState<Record<string, string>>({});
  const [posPermsByMember, setPosPermsByMember] = useState<
    Record<string, { grantPermissions: string[]; denyPermissions: string[] }>
  >({});
  const { data: warehouses } = useWarehouses();

  const load = async () => {
    try {
      setError(null);
      const data = await usersService.getCompanyUsers();
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setError('Ro‘yxatni yuklashda xato. Xodimlar moduli yoqilganligini tekshiring.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRoleChange = async (membershipId: string, role: string) => {
    const member = members.find((m) => m.id === membershipId);
    const wh =
      pendingWarehouse[membershipId] || member?.warehouse?.id || '';
    if (roleRequiresWarehouse(role) && !wh) {
      setError('Omborchi yoki sotuvchi uchun ombor tanlang, so‘ng rolni qayta tanlang');
      return;
    }
    const roleChanged = member?.role !== role;
    const pos =
      posPermsByMember[membershipId] ??
      (roleChanged
        ? { grantPermissions: [] as string[], denyPermissions: [] as string[] }
        : {
            grantPermissions: member?.grantPermissions ?? [],
            denyPermissions: member?.denyPermissions ?? [],
          });
    setUpdatingId(membershipId);
    setError(null);
    try {
      await usersService.updateMemberRole(
        membershipId,
        role,
        roleRequiresWarehouse(role) ? wh : null,
        pos.grantPermissions,
        pos.denyPermissions,
      );
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Rolni saqlashda xato.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSavePosPerms = async (membershipId: string) => {
    const member = members.find((m) => m.id === membershipId);
    if (!member || member.role === 'OWNER') return;
    const wh = roleRequiresWarehouse(member.role)
      ? pendingWarehouse[membershipId] || member.warehouse?.id || ''
      : null;
    if (roleRequiresWarehouse(member.role) && !wh) {
      setError('Avval omborni tanlang');
      return;
    }
    const pos =
      posPermsByMember[membershipId] ?? {
        grantPermissions: member.grantPermissions ?? [],
        denyPermissions: member.denyPermissions ?? [],
      };
    setUpdatingId(membershipId);
    setError(null);
    try {
      await usersService.updateMemberRole(
        membershipId,
        member.role,
        wh,
        pos.grantPermissions,
        pos.denyPermissions,
      );
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'POS ruxsatlarini saqlashda xato.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleWarehousePick = async (membershipId: string, warehouseId: string) => {
    setPendingWarehouse((prev) => ({ ...prev, [membershipId]: warehouseId }));
    const member = members.find((m) => m.id === membershipId);
    if (!member || member.role === 'OWNER') return;
    if (!roleRequiresWarehouse(member.role)) return;
    setUpdatingId(membershipId);
    setError(null);
    try {
      await usersService.updateMemberRole(membershipId, member.role, warehouseId);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Omborni saqlashda xato.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={30} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-start gap-4 p-6 rounded-[2rem] bg-blue-500/5 border border-blue-500/15">
        <Shield className="text-blue-400 shrink-0 mt-0.5" size={22} />
        <div>
          <h3 className="font-black text-white text-lg mb-1">Rol va ruxsatlar</h3>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">
            Har bir xodimga tizimdagi tayyor rollardan birini bering. Rol tanlanganda ruxsatlar avtomatik qo‘llanadi.
            Yangi login — <Link href="/dashboard/settings/team" className="text-blue-400 font-black hover:underline">Jamoa</Link> sahifasida.
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/settings/team"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/[0.15] transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <UserPlus size={22} />
          </div>
          <div>
            <p className="font-black text-white text-base mb-1">Yangi xodim qo‘shish</p>
            <p className="text-sm text-gray-400 font-medium">Login, parol va birinchi rol — Jamoa sahifasida.</p>
          </div>
        </div>
        <span className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shrink-0">
          Jamoa sahifasiga o‘tish <ArrowRight size={18} />
        </span>
      </Link>

      {error && (
        <div className="flex items-center gap-2 text-sm font-bold text-red-400 px-1">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Desktop View Table */}
      <div className="hidden md:block glass-card rounded-[2rem] overflow-hidden bg-white/[0.01] border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/5">
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500">Xodim</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500">Rol</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-500">Ombor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map((m) => {
              const isOwner = m.role === 'OWNER';
              return (
                <React.Fragment key={m.id}>
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-8 py-5">
                    <p className="font-bold text-white">{m.user?.fullName}</p>
                    <p className="text-xs text-gray-500">@{m.user?.login}</p>
                  </td>
                  <td className="px-8 py-5">
                    {isOwner ? (
                      <span className="text-sm font-black text-purple-400 uppercase tracking-wide">Egasi (OWNER)</span>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <select
                          value={m.role}
                          disabled={updatingId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500/50 disabled:opacity-50 min-w-[200px]"
                        >
                          {ASSIGNABLE_ROLES.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#111] text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {updatingId === m.id && <Loader2 className="animate-spin text-blue-400 w-4 h-4" />}
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {isOwner ? (
                      <span className="text-xs text-gray-600">—</span>
                    ) : roleRequiresWarehouse(m.role) ? (
                      <select
                        value={pendingWarehouse[m.id] ?? m.warehouse?.id ?? ''}
                        onChange={(e) => handleWarehousePick(m.id, e.target.value)}
                        className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-sm font-bold text-white min-w-[180px]"
                      >
                        <option value="" className="bg-[#111]">Ombor tanlang</option>
                        {(warehouses || []).map((w: any) => (
                          <option key={w.id} value={w.id} className="bg-[#111]">
                            {w.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">Global</span>
                    )}
                  </td>
                </tr>
                {!isOwner && ['MANAGER', 'SALES', 'ACCOUNTANT'].includes(m.role) && (
                  <tr key={`${m.id}-pos`} className="bg-white/[0.01]">
                    <td colSpan={3} className="px-8 py-4">
                      <PosPermissionToggles
                        role={m.role}
                        grantPermissions={m.grantPermissions}
                        denyPermissions={m.denyPermissions}
                        onChange={(payload) =>
                          setPosPermsByMember((prev) => ({
                            ...prev,
                            [m.id]: payload,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={updatingId === m.id}
                        onClick={() => handleSavePosPerms(m.id)}
                        className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black disabled:opacity-50"
                      >
                        POS ruxsatlarini saqlash
                      </button>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View List */}
      <div className="block md:hidden space-y-4">
        {members.map((m) => {
          const isOwner = m.role === 'OWNER';
          const needsWh = roleRequiresWarehouse(m.role);
          
          return (
            <div key={m.id} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-blue-400 font-black text-sm shrink-0 border border-white/5 select-none">
                  {m.user?.fullName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">{m.user?.fullName}</p>
                  <p className="text-xs text-gray-500">@{m.user?.login}</p>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5">
                <div>
                  <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Rol</label>
                  {isOwner ? (
                    <span className="text-xs font-black text-purple-400 uppercase tracking-wide">Egasi (OWNER)</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        disabled={updatingId === m.id}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-blue-500/50 disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-[#111] text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {updatingId === m.id && <Loader2 className="animate-spin text-blue-400 w-4 h-4 shrink-0" />}
                    </div>
                  )}
                </div>

                {!isOwner && needsWh && (
                  <div>
                    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Ombor</label>
                    <select
                      value={pendingWarehouse[m.id] ?? m.warehouse?.id ?? ''}
                      onChange={(e) => handleWarehousePick(m.id, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none"
                    >
                      <option value="" className="bg-[#111]">Ombor tanlang</option>
                      {(warehouses || []).map((w: any) => (
                        <option key={w.id} value={w.id} className="bg-[#111]">
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!isOwner && ['MANAGER', 'SALES', 'ACCOUNTANT'].includes(m.role) && (
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <PosPermissionToggles
                    role={m.role}
                    grantPermissions={m.grantPermissions}
                    denyPermissions={m.denyPermissions}
                    onChange={(payload) =>
                      setPosPermsByMember((prev) => ({
                        ...prev,
                        [m.id]: payload,
                      }))
                    }
                  />
                  <button
                    type="button"
                    disabled={updatingId === m.id}
                    onClick={() => handleSavePosPerms(m.id)}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-xs font-black disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updatingId === m.id ? <Loader2 size={14} className="animate-spin" /> : 'POS ruxsatlarini saqlash'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <RolePermissionsMatrix />
    </div>
  );
}
