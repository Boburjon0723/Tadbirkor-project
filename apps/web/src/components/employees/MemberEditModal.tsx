'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Lock, Phone, AlertTriangle } from 'lucide-react';
import { usersService } from '@/services/users.service';
import { ASSIGNABLE_ROLES, roleRequiresWarehouse } from '@/lib/roles';
import { PosPermissionToggles } from '@/components/employees/PosPermissionToggles';
import { toast } from '@/lib/toast';

type Member = {
  id: string;
  role: string;
  grantPermissions?: string[];
  denyPermissions?: string[];
  warehouse?: { id: string; name: string } | null;
  user: {
    id: string;
    fullName: string;
    login: string;
    phone?: string | null;
    telegramChatId?: string | null;
  };
};

interface MemberEditModalProps {
  member: Member | null;
  warehouses: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

export function MemberEditModal({ member, warehouses, onClose, onSaved }: MemberEditModalProps) {
  const [role, setRole] = useState('MANAGER');
  const [warehouseId, setWarehouseId] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [tab, setTab] = useState<'role' | 'phone' | 'password'>('role');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posPerms, setPosPerms] = useState({
    grantPermissions: [] as string[],
    denyPermissions: [] as string[],
  });

  useEffect(() => {
    if (member) {
      setRole(member.role || 'MANAGER');
      setWarehouseId(member.warehouse?.id || '');
      setPhone(member.user.phone || '');
      setNewPassword('');
      setTab('role');
      setError(null);
      setPosPerms({
        grantPermissions: member.grantPermissions ?? [],
        denyPermissions: member.denyPermissions ?? [],
      });
    }
  }, [member]);

  if (!member) return null;

  const needsWarehouse = roleRequiresWarehouse(role);
  const hasTelegram = Boolean(member.user.telegramChatId);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsWarehouse && !warehouseId) {
      setError('Bu rol uchun ombor tanlash shart');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersService.updateMemberRole(
        member.id,
        role,
        needsWarehouse ? warehouseId : null,
        posPerms.grantPermissions,
        posPerms.denyPermissions,
      );
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Telefon raqami majburiy');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await usersService.updateMemberPhone(member.id, phone.trim());
      if (res.telegramUnlinked) {
        toast.warning(
          'Telefon yangilandi. Telegram uzildi — xodim botda telefonini qayta ulashi kerak.',
        );
      } else {
        toast.success('Telefon saqlandi');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Telefonni saqlashda xato');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Parol kamida 6 belgi bo‘lishi kerak');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersService.resetMemberPassword(member.id, newPassword);
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Parolni yangilashda xato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-t-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[90vh] p-6 sm:p-8 absolute bottom-0 sm:relative"
        >
          <div className="flex justify-between items-start mb-6 shrink-0">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white">{member.user.fullName}</h3>
              <p className="text-gray-500 text-xs sm:text-sm">@{member.user.login}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-gray-500">
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl shrink-0">
            {(['role', 'phone', 'password'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
                className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-black ${
                  tab === t ? 'bg-blue-600 text-white' : 'text-gray-400'
                }`}
              >
                {t === 'role' ? 'Rol' : t === 'phone' ? 'Telefon' : 'Parol'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
            {error && <p className="text-red-400 text-sm font-bold mb-4">{error}</p>}

            {tab === 'role' ? (
              <form onSubmit={handleSaveRole} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rol</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value);
                      setPosPerms({ grantPermissions: [], denyPermissions: [] });
                    }}
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold text-white"
                  >
                    {ASSIGNABLE_ROLES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {needsWarehouse && (
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Ombor / do‘kon
                    </label>
                    <select
                      required
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold text-white"
                    >
                      <option value="">Tanlang...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {['MANAGER', 'SALES', 'ACCOUNTANT'].includes(role) && (
                  <PosPermissionToggles
                    role={role}
                    grantPermissions={posPerms.grantPermissions}
                    denyPermissions={posPerms.denyPermissions}
                    onChange={setPosPerms}
                  />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'Rolni saqlash'}
                </button>
              </form>
            ) : tab === 'phone' ? (
              <form onSubmit={handleSavePhone} className="space-y-4">
                {(hasTelegram || phone !== (member.user.phone || '')) && (
                  <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium leading-relaxed">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <p>
                      Telefon o‘zgarsa Telegram uziladi. Xodim botda yangi raqam bilan qayta{' '}
                      <strong>/start</strong> qilishi kerak.
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Telefon (bot uchun)
                  </label>
                  <div className="relative mt-2">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 font-bold text-white"
                      placeholder="+998901234567"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'Telefonni saqlash'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Yangi parol
                  </label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 font-bold text-white"
                      placeholder="Kamida 6 belgi"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'Parolni yangilash'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
