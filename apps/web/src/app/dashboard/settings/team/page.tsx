'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Phone, 
  Search, 
  X, 
  CheckCircle2, 
  Loader2,
  Lock,
  Building2,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { confirmAction } from '@/components/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { usersService } from '@/services/users.service';
import { authService } from '@/services/auth.service';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useEmployeesModule } from '@/hooks/use-employees-module';
import { usePermissions } from '@/hooks/use-permissions';
import { MemberEditModal } from '@/components/employees/MemberEditModal';
import { ASSIGNABLE_ROLES, ROLE_LABELS, roleRequiresWarehouse } from '@/lib/roles';
import { PosPermissionToggles } from '@/components/employees/PosPermissionToggles';
import Link from 'next/link';
import { toast, formatApiError } from '@/lib/toast';

export default function TeamPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    login: '',
    password: '',
    role: 'MANAGER',
    email: '',
    phone: '',
    warehouseId: ''
  });
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [invitePosPerms, setInvitePosPerms] = useState({
    grantPermissions: [] as string[],
    denyPermissions: [] as string[],
  });

  const { data: warehouses } = useWarehouses();
  const { employeesEnabled, loading: moduleLoading } = useEmployeesModule();
  const { canManageUsers, loading: permLoading } = usePermissions();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await usersService.getCompanyUsers();
      // Faqat oylik (pay.* login) — jamoa ro‘yxatida ko‘rsatilmaydi
      setUsers(
        (data || []).filter(
          (u: { user?: { login?: string } }) =>
            !String(u?.user?.login || '').startsWith('pay.'),
        ),
      );
    } catch (err) {
      console.error('Foydalanuvchilarni yuklashda xato:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.phone.trim()) {
      toast.error('Telefon raqami majburiy — bot xodimni shu raqam orqali taniydi.');
      return;
    }
    if (roleRequiresWarehouse(inviteForm.role) && !inviteForm.warehouseId) {
      toast.error('Bu rol uchun ombor / do\'kon tanlash shart (dala xodimi ham biriktirilgan ombordan ishlaydi).');
      return;
    }
    try {
      setIsSubmitting(true);
      await authService.inviteUser(inviteForm);
      setIsInviteModalOpen(false);
      setInviteForm({
        fullName: '',
        login: '',
        password: '',
        role: 'MANAGER',
        email: '',
        phone: '',
        warehouseId: ''
      });
      fetchUsers();
      toast.success('Xodim qo‘shildi');
    } catch (err: unknown) {
      console.error('Taklif qilishda xato:', err);
      const ax = err as { response?: { data?: { message?: string | string[] } } };
      const msg = ax?.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join('\n') : msg;
      toast.error(text || formatApiError(err, 'Xodim qo\'shishda xato. Login band bo\'lishi yoki boshqa maydon noto\'g\'ri bo\'lishi mumkin.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (item: any) => {
    const name = item.user?.fullName || item.user?.login || 'xodim';
    const ok = await confirmAction(
      `"${name}" ni kompaniyadan olib tashlaysizmi? Login ishlamay qoladi. Telegram bog‘lanishi ham uziladi.`,
      { variant: 'danger', confirmLabel: "Ha, o'chirish" },
    );
    if (!ok) return;
    try {
      await usersService.removeMember(item.id);
      toast.success('Xodim olib tashlandi');
      if (editingMember?.id === item.id) setEditingMember(null);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(formatApiError(err, 'O‘chirishda xato'));
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'MANAGER': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ACCOUNTANT': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'WAREHOUSE': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'SALES': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'FIELD_WORKER': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const filteredUsers = users.filter(u => 
    u.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.user.login.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (moduleLoading || permLoading) {
    return (
      <div className="py-32 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!employeesEnabled) {
    return (
      <div className="max-w-xl py-20 space-y-6 text-center mx-auto">
        <p className="text-2xl font-black text-white">Xodimlar moduli o‘chirilgan</p>
        <p className="text-gray-400">
          Jamoa boshqaruvi uchun Sozlamalar → Modullar bo‘limida «Xodimlar» modulini yoqing.
        </p>
        <Link
          href="/dashboard/settings?tab=modullar"
          className="btn-dash-primary"
        >
          Modullarga o‘tish
        </Link>
      </div>
    );
  }

  if (!canManageUsers()) {
    return (
      <div className="max-w-xl py-20 text-center">
        <p className="text-xl font-black text-white">Ruxsat yo‘q</p>
        <p className="text-gray-400 mt-2">Xodimlarni faqat egasi yoki menejer boshqaradi.</p>
      </div>
    );
  }

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="dash-page-title mb-1.5">Jamoa <span className="text-blue-500">boshqaruvi</span></h1>
          <p className="dash-page-subtitle">
            Yangi login ochish va xodimlar ro‘yxati. <strong className="text-gray-300">Rollar</strong> (sotuvchi, buxgalter va h.k.){' '}
            alohida:&nbsp;
            <Link href="/dashboard/settings?tab=rollar" className="text-blue-400 font-black hover:text-blue-300 underline-offset-2 hover:underline">
              Sozlamalar → Rollar
            </Link>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Link
            href="/dashboard/settings?tab=rollar"
            className="btn-dash-secondary text-gray-300"
          >
            <Shield size={18} className="text-blue-400" />
            Rollarni boshqarish
          </Link>
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="btn-dash-primary group"
          >
            <UserPlus size={20} />
            Xodim qo‘shish
          </button>
        </div>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="relative flex-1 w-full lg:max-w-md group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-5 h-5" />
          <input 
            type="text" 
            placeholder="Ism yoki login bo'yicha qidirish..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 text-sm font-bold text-gray-400">
            Jami: <span className="text-white">{users.length} ta xodim</span>
          </div>
        </div>
      </div>

      {/* Users Table — overflow-visible: amallar menyusi kesilmasin */}
      <div className="dash-section overflow-visible">
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Jamoa yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/5">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Xodim</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Rol</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Biriktirilgan nuqta</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Kontakt</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="py-32 text-center text-gray-500 font-bold">Xodimlar topilmadi</td></tr>
                  ) : filteredUsers.map((item: any, idx: number) => (
                    <motion.tr 
                      key={item.user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-blue-400 font-black text-lg border border-white/5">
                            {item.user.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-white">{item.user.fullName}</p>
                            <p className="text-xs text-gray-500">@{item.user.login}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getRoleBadgeStyle(item.role)}`}>
                          {item.role}
                        </span>
                      </td>
                      <td className="px-10 py-6">
                         {item.warehouse ? (
                           <div className="flex items-center gap-2">
                             <Building2 size={14} className="text-gray-500" />
                             <span className="text-xs font-bold text-gray-300">{item.warehouse.name}</span>
                           </div>
                         ) : (
                           <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Global (Barchasi)</span>
                         )}
                      </td>
                      <td className="px-10 py-6">
                        <div className="space-y-1">
                          {item.user.email && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Mail size={12} className="text-gray-600" /> {item.user.email}
                            </div>
                          )}
                          {item.user.phone && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Phone size={12} className="text-gray-600" /> {item.user.phone}
                            </div>
                          )}
                          {item.user.telegramChatId && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                              <CheckCircle2 size={12} /> Telegram ulangan
                            </div>
                          )}
                          {!item.user.email && !item.user.phone && <span className="text-gray-600 text-xs">Kontakt yo'q</span>}
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        {item.role === 'OWNER' ? (
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                            Egasi — Profil tab
                          </span>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMember(item)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-black rounded-xl text-xs transition-all active:scale-95"
                            >
                              Tahrirlash
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-black rounded-xl text-xs transition-all active:scale-95"
                              title="Kompaniyadan olib tashlash"
                            >
                              <Trash2 size={14} />
                              O‘chirish
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View List */}
            <div className="block md:hidden divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <div className="py-20 text-center text-gray-500 font-bold text-sm">Xodimlar topilmadi</div>
              ) : filteredUsers.map((item: any, idx: number) => (
                <motion.div 
                  key={item.user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.25 }}
                  className="p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center text-blue-400 font-black text-sm shrink-0 border border-white/5 select-none">
                        {item.user.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{item.user.fullName}</p>
                        <p className="text-xs text-gray-500">@{item.user.login}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shrink-0 ${getRoleBadgeStyle(item.role)}`}>
                      {item.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-white/5 text-xs text-gray-400">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Nuqta</p>
                      {item.warehouse ? (
                        <p className="font-bold text-gray-300 truncate">{item.warehouse.name}</p>
                      ) : (
                        <p className="font-black text-gray-600 uppercase tracking-widest text-[9px]">Global</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Telegram holati</p>
                      {item.user.telegramChatId ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Ulangan
                        </span>
                      ) : (
                        <span className="text-gray-600">Ulanmagan</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      {item.user.phone && (
                        <p className="text-xs text-gray-400 truncate font-semibold">{item.user.phone}</p>
                      )}
                      {item.user.email && (
                        <p className="text-xs text-gray-500 truncate">{item.user.email}</p>
                      )}
                      {!item.user.phone && !item.user.email && (
                        <p className="text-xs text-gray-600 italic">Kontakt yo'q</p>
                      )}
                    </div>

                    {item.role !== 'OWNER' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingMember(item)}
                          className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-black rounded-xl text-xs active:scale-95 transition-all"
                        >
                          Tahrirlash
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(item)}
                          className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 font-black rounded-xl text-xs"
                        >
                          O‘chirish
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteModalOpen(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="desktop-modal-panel max-w-2xl h-[90vh] sm:h-auto absolute bottom-0 sm:relative rounded-t-2xl sm:rounded-2xl"
            >
              <div className="desktop-modal-header flex justify-between items-start shrink-0">
                <div>
                  <h3 className="text-xl sm:text-3xl font-black mb-1">Xodim <span className="text-blue-500">Taklif Qilish</span></h3>
                  <p className="text-gray-500 text-xs sm:text-sm">Yangi xodim uchun login va parol yarating.</p>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 sm:p-3 hover:bg-white/5 rounded-xl sm:rounded-2xl text-gray-500"><X size={20} /></button>
              </div>

              <form onSubmit={handleInvite} className="flex-1 overflow-y-auto pr-1 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">To'liq Ism</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Masalan: Azizbek Savdo"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all text-white"
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm({...inviteForm, fullName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Rol Tanlang</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-white"
                    >
                      <span>{ROLE_LABELS[inviteForm.role as keyof typeof ROLE_LABELS] || inviteForm.role}</span>
                      <ChevronDown size={18} className={`text-gray-500 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isRoleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-[110]" onClick={() => setIsRoleDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-2xl p-1"
                          >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                              {ASSIGNABLE_ROLES.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => { setInviteForm({ ...inviteForm, role: opt.value }); setIsRoleDropdownOpen(false); }}
                                  className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold transition-all ${inviteForm.role === opt.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Ombor: SALES, WAREHOUSE, FIELD_WORKER */}
                {roleRequiresWarehouse(inviteForm.role) && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                      Ombor / Do&apos;kon Biriktirish <span className="text-red-500">*</span>
                      {inviteForm.role === 'FIELD_WORKER' && (
                        <span className="block text-gray-600 font-normal normal-case tracking-normal mt-1">
                          Dala xodimi shu ombordan tovar oladi
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                        className={`w-full bg-white/5 border ${!inviteForm.warehouseId ? 'border-red-500/30' : 'border-white/10'} rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-white`}
                      >
                        <span className={!inviteForm.warehouseId ? 'text-gray-500' : 'text-white'}>
                          {inviteForm.warehouseId 
                            ? warehouses?.find((w: any) => w.id === inviteForm.warehouseId)?.name 
                            : 'Omborni tanlang...'}
                        </span>
                        <ChevronDown size={18} className={`text-gray-500 transition-transform ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isWarehouseDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-[110]" onClick={() => setIsWarehouseDropdownOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-2xl p-1"
                            >
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {warehouses?.map((w: any) => (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => { setInviteForm({ ...inviteForm, warehouseId: w.id }); setIsWarehouseDropdownOpen(false); }}
                                    className={`w-full text-left px-5 py-4 rounded-xl text-sm font-bold transition-all ${inviteForm.warehouseId === w.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                  >
                                    {w.name}
                                  </button>
                                ))}
                                {(!warehouses || warehouses.length === 0) && (
                                  <div className="px-5 py-4 text-xs text-gray-500 font-bold italic">Omborlar topilmadi. Avval ombor yarating.</div>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tizim uchun Login</label>
                  <input 
                    required
                    type="text" 
                    placeholder="azizbek_99"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all text-white"
                    value={inviteForm.login}
                    onChange={(e) => setInviteForm({...inviteForm, login: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Vaqtinchalik Parol</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 font-bold outline-none focus:border-blue-500/50 transition-all text-white"
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm({...inviteForm, password: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email (Majburiy emas)</label>
                  <input 
                    type="email" 
                    placeholder="example@mail.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all text-white"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    Telefon <span className="text-red-500">*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder="+998 90 123 45 67"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold outline-none focus:border-blue-500/50 transition-all text-white"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({...inviteForm, phone: e.target.value})}
                  />
                  <p className="text-[10px] text-gray-500 font-bold">
                    Botda «Telefon raqamni ulashish» tugmasi orqali ulanadi — qo‘lda yozmaydi.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <PosPermissionToggles
                    role={inviteForm.role}
                    onChange={setInvitePosPerms}
                  />
                </div>

                <div className="md:col-span-2 pt-6 flex gap-4">
                  <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-gray-500">Bekor qilish</button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (
                      <>Taklifni Yuborish <CheckCircle2 size={20} /></>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MemberEditModal
        member={editingMember}
        warehouses={warehouses || []}
        onClose={() => setEditingMember(null)}
      onSaved={() => {
        fetchUsers();
        toast.success('Xodim ma’lumotlari yangilandi');
      }}
      />
    </div>
  );
}
