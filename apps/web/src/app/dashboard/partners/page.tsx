'use client';

import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Building2, 
  CheckCircle2, 
  XCircle,
  Clock, 
  ArrowRight,
  Loader2,
  ShieldCheck,
  Ban,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePartners, useSearchCompany, usePartnerActions } from '@/hooks/partners/use-partners';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { toast } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { ModuleGate } from '@/components/ModuleGate';

type TabType = 'active' | 'incoming' | 'outgoing' | 'blocked';

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTin, setSearchTin] = useState('');
  const [settingsPartner, setSettingsPartner] = useState<any | null>(null);
  const [allWarehousesVisible, setAllWarehousesVisible] = useState(true);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
  
  const { data: partners, isLoading, refetch } = usePartners();
  const { data: warehouses } = useWarehouses();
  const { data: searchResult, isLoading: isSearching, error: searchError } = useSearchCompany(searchTin, searchTin.length >= 9);
  const { sendRequest, accept, reject, block, remove, updateWarehouseVisibility } = usePartnerActions();

  const activePartners = partners?.filter((p: any) => p.status === 'ACTIVE') || [];
  const incomingRequests = partners?.filter((p: any) => p.status === 'PENDING' && p.isIncoming) || [];
  const outgoingRequests = partners?.filter((p: any) => p.status === 'PENDING' && !p.isIncoming) || [];
  const blockedPartners = partners?.filter((p: any) => p.status === 'BLOCKED') || [];

  const handleSendRequest = async (companyId: string) => {
    try {
      await sendRequest.mutateAsync(companyId);
      setShowAddModal(false);
      setSearchTin('');
    } catch (error: any) {
      if (error.response?.status === 409) {
        setShowAddModal(false);
        setSearchTin('');
        refetch();
        toast.warning(error.response?.data?.message || 'So‘rov allaqachon yuborilgan.');
      } else {
        console.error('Hamkorlik so‘rovi yuborishda xato:', error);
        const msg =
          error.response?.data?.message ||
          (error.response?.status === 503
            ? 'Ma’lumotlar bazasi band. Bir necha soniyadan keyin qayta urinib ko‘ring.'
            : error.response?.status === 404
              ? 'Bunday STIR raqamli kompaniya tizimda ro‘yxatdan o‘tmagan.'
              : 'Xatolik yuz berdi. Iltimos qaytadan urinib ko‘ring.');
        toast.error(msg);
      }
    }
  };

  // Compile-safe color dictionaries for static Tailwind CSS compiler validation
  const statColorStyles: Record<string, { bgIcon: string; textIcon: string; glow: string }> = {
    blue: {
      bgIcon: 'bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5',
      textIcon: 'text-blue-400',
      glow: 'shadow-blue-500/5 hover:border-blue-500/20'
    },
    amber: {
      bgIcon: 'bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5',
      textIcon: 'text-amber-400',
      glow: 'shadow-amber-500/5 hover:border-amber-500/20'
    },
    gray: {
      bgIcon: 'bg-white/5 border border-white/5 shadow-md',
      textIcon: 'text-gray-400',
      glow: 'shadow-white/5 hover:border-white/10'
    },
    emerald: {
      bgIcon: 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
      textIcon: 'text-emerald-400',
      glow: 'shadow-emerald-500/5 hover:border-emerald-500/20'
    }
  };

  const openVisibilitySettings = (partner: any) => {
    const current = Array.isArray(partner.visibleWarehouseIdsForCurrentCompany)
      ? partner.visibleWarehouseIdsForCurrentCompany
      : null;
    setSettingsPartner(partner);
    setAllWarehousesVisible(!current);
    setSelectedWarehouseIds(current || []);
  };

  const toggleWarehouse = (warehouseId: string) => {
    setSelectedWarehouseIds((prev) =>
      prev.includes(warehouseId) ? prev.filter((id) => id !== warehouseId) : [...prev, warehouseId],
    );
  };

  const saveVisibilitySettings = async () => {
    if (!settingsPartner) return;
    try {
      await updateWarehouseVisibility.mutateAsync({
        id: settingsPartner.id,
        dto: {
          allVisible: allWarehousesVisible,
          warehouseIds: allWarehousesVisible ? [] : selectedWarehouseIds,
        },
      });
      setSettingsPartner(null);
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Ombor ko'rinish sozlamalarini saqlashda xatolik yuz berdi.";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  return (
    <ModuleGate moduleKey="PARTNERS" moduleLabel="Hamkorlar">
    <div className="dash-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/5">
        <div>
          <h1 className="dash-page-title mb-1.5">B2B <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">hamkorlar</span></h1>
          <p className="dash-page-subtitle">Hamkor kompaniyalar, so‘rovlar va aloqa holati.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-dash-primary group whitespace-nowrap self-start md:self-auto"
        >
          <UserPlus size={16} className="group-hover:scale-110 transition-transform" />
          Yangi hamkor
        </button>
      </div>

      {/* KPI Cards (Fixed Dynamic Classes bug & Premium Hover) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Faol hamkorlar", value: activePartners.length, icon: Users, color: "blue" },
          { title: "Kutilayotgan", value: incomingRequests.length, icon: Clock, color: "amber" },
          { title: "Bloklanganlar", value: blockedPartners.length, icon: Ban, color: "gray" },
          { title: "O'zaro Balans", value: "0", icon: Wallet, color: "emerald" },
        ].map((stat, idx) => {
          const colors = statColorStyles[stat.color] || statColorStyles.gray;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, type: 'spring', stiffness: 100 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`glass-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${colors.glow}`}
            >
              <div className="relative flex flex-col gap-4">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${colors.bgIcon} ${colors.textIcon}`}>
                  <stat.icon size={24} className="md:size-[28px]" />
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.title}</p>
                  <h3 className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">{stat.value}</h3>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Elastic, Horizontally Scrollable Sliding Filter Tabs */}
      <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-none flex flex-row flex-nowrap gap-1">
        {[
          { id: 'active', label: 'Faol Hamkorlar' },
          { id: 'incoming', label: `Kelgan so'rovlar (${incomingRequests.length})` },
          { id: 'outgoing', label: 'Yuborilgan' },
          { id: 'blocked', label: 'Bloklanganlar' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className="relative px-5 py-2.5 rounded-xl text-xs lg:text-sm font-black transition-all duration-300 z-10 whitespace-nowrap flex-shrink-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activePartnerTab"
                className="absolute inset-0 bg-white rounded-lg shadow-md z-[-1]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-black' : 'text-gray-400 hover:text-white'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="dash-section min-h-[400px] shadow-xl">
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : (
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {activeTab === 'active' && activePartners.length === 0 && <EmptyState message="Faol hamkorlar mavjud emas" />}
              {activeTab === 'incoming' && incomingRequests.length === 0 && <EmptyState message="Yangi so'rovlar yo'q" />}
              {activeTab === 'outgoing' && outgoingRequests.length === 0 && <EmptyState message="Yuborilgan so'rovlar yo'q" />}
              {activeTab === 'blocked' && blockedPartners.length === 0 && <EmptyState message="Bloklanganlar yo'q" />}

              {(activeTab === 'active' ? activePartners : 
                activeTab === 'incoming' ? incomingRequests : 
                activeTab === 'outgoing' ? outgoingRequests : blockedPartners).map((partner: any) => (
                <PartnerCard 
                  key={partner.id} 
                  partner={partner} 
                  onAccept={() => accept.mutate(partner.id)}
                  onReject={() => reject.mutate(partner.id)}
                  onBlock={() => block.mutate(partner.id)}
                  onRemove={async () => {
                    if (await confirmAction('Haqiqatdan ham ushbu hamkorlikni o\'chirmoqchimisiz?', { variant: 'danger', confirmLabel: "Ha, o'chirish" })) {
                      remove.mutate(partner.id);
                    }
                  }}
                  onConfigureVisibility={() => openVisibilitySettings(partner)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Partner Modal (Fully stylized with frosted glass) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} className="relative w-full max-w-lg glass-card rounded-[2.5rem] p-6 md:p-8 bg-[#0d0d0f]/95 border border-white/10 shadow-2xl backdrop-blur-3xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl md:text-2xl font-black mb-1 text-white">Hamkor <span className="text-blue-500">Qidirish</span></h3>
                  <p className="text-gray-500 text-xs">Kompaniyani STIR (TIN) raqami orqali qidiring.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all"><X size={18} /></button>
              </div>

              <div className="space-y-5">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5" />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="STIR (TIN) raqamini kiriting..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:border-blue-500/50 outline-none transition-all text-white h-12"
                    value={searchTin}
                    onChange={(e) => setSearchTin(e.target.value)}
                  />
                </div>

                <div className="min-h-[100px] flex items-center justify-center border border-dashed border-white/5 rounded-2xl bg-white/[0.01] p-4">
                  {isSearching ? (
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                  ) : searchResult ? (
                    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Kompaniya topildi</p>
                        <h4 className="text-base font-black text-white truncate">{searchResult.name}</h4>
                        <p className="text-gray-500 text-xs font-bold">STIR: {searchResult.tin}</p>
                      </div>
                      <button 
                        onClick={() => handleSendRequest(searchResult.id)}
                        disabled={sendRequest.isPending}
                        className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-xs whitespace-nowrap"
                      >
                        {sendRequest.isPending ? 'Yuborilmoqda...' : 'So‘rov yuborish'}
                      </button>
                    </div>
                  ) : searchTin.length >= 9 ? (
                    <p className="text-gray-500 text-xs font-bold">Bunday STIR raqamli hamkor topilmadi</p>
                  ) : (
                    <p className="text-gray-500 text-xs font-medium">Kamida 9 ta raqam kiriting</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Warehouse Settings Visibility Modal */}
      <AnimatePresence>
        {settingsPartner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsPartner(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0d0f]/95 p-6 md:p-8 shadow-2xl backdrop-blur-3xl"
            >
              <div className="flex items-start justify-between mb-5 pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white">
                    Ombor ko'rinishi <span className="text-blue-500">sozlamasi</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {settingsPartner.company?.name || 'Hamkor'} uchun qaysi ombor zaxiralari ochiqligini belgilang.
                  </p>
                </div>
                <button onClick={() => setSettingsPartner(null)} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all">
                  <X size={16} />
                </button>
              </div>

              <label className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allWarehousesVisible}
                  onChange={(e) => setAllWarehousesVisible(e.target.checked)}
                  className="w-4 h-4 accent-blue-500 rounded"
                />
                <span className="text-xs lg:text-sm font-bold text-white">Barcha omborlar va to'liq zaxiralar ko'rinsin</span>
              </label>

              {!allWarehousesVisible && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {warehouses?.map((w: any) => (
                    <label
                      key={w.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-all"
                    >
                      <span className="font-bold text-xs lg:text-sm text-gray-200">{w.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedWarehouseIds.includes(w.id)}
                        onChange={() => toggleWarehouse(w.id)}
                        className="w-4 h-4 accent-blue-500 rounded"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setSettingsPartner(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-400 hover:text-white transition-all h-10 active:scale-95"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={saveVisibilitySettings}
                  disabled={updateWarehouseVisibility.isPending || (!allWarehousesVisible && selectedWarehouseIds.length === 0)}
                  className="px-5 py-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white disabled:opacity-50 transition-all active:scale-95"
                >
                  {updateWarehouseVisibility.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ModuleGate>
  );
}

function PartnerCard({ partner, onAccept, onReject, onBlock, onRemove, onConfigureVisibility }: any) {
  const company =
    (partner.isIncoming ? partner.ownerCompany : partner.partnerCompany) ?? partner.company;

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.3 }}
      className="p-6 md:p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:border-blue-500/30 transition-all duration-300 group flex flex-col justify-between backdrop-blur-xl relative overflow-hidden shadow-lg hover:shadow-blue-500/[0.02]"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
            <Building2 size={24} className="md:size-[28px]" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <button 
                onClick={onRemove} 
                className="p-1.5 hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-lg transition-all active:scale-90" 
                title="O'chirish"
              >
                <X size={13} />
              </button>
              {partner.status === 'ACTIVE' ? (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">Faol</span>
              ) : partner.status === 'PENDING' ? (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">Kutilmoqda</span>
              ) : (
                <span className="bg-gray-500/10 text-gray-400 border border-gray-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">Bloklangan</span>
              )}
            </div>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
              {partner.isIncoming ? 'Kiruvchi so\'rov' : 'Chiquvchi so\'rov'}
            </span>
          </div>
        </div>
        <h3 className="text-lg md:text-xl font-black text-white mb-0.5 group-hover:text-blue-400 transition-colors truncate">{company?.name ?? 'Hamkor'}</h3>
        <p className="text-gray-500 text-xs font-bold mb-6">STIR: {company?.tin ?? '—'}</p>
      </div>

      <div className="pt-5 border-t border-white/5">
        {partner.status === 'PENDING' && partner.isIncoming ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={onAccept} className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-xs">Qabul qilish</button>
            <button onClick={onReject} className="py-2.5 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 font-black rounded-xl transition-all active:scale-95 text-xs">Rad etish</button>
          </div>
        ) : partner.status === 'PENDING' && !partner.isIncoming ? (
          <button onClick={onRemove} className="w-full py-2.5 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 font-black rounded-xl transition-all active:scale-95 text-xs">So'rovni bekor qilish</button>
        ) : partner.status === 'ACTIVE' ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">O'zaro Balans</span>
              <span className="font-black text-emerald-400 text-sm md:text-base truncate">{Number(partner.balance || 0).toLocaleString()} UZS</span>
              <span className="text-[9px] text-gray-500 font-bold mt-1 uppercase tracking-wider">
                Omborlar: {Array.isArray(partner.visibleWarehouseIdsForCurrentCompany) ? `${partner.visibleWarehouseIdsForCurrentCompany.length} ta` : 'Barchasi'}
              </span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button 
                onClick={onConfigureVisibility} 
                className="p-2.5 bg-white/5 hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 rounded-xl transition-all active:scale-95 border border-white/5" 
                title="Ombor ko'rinishi"
              >
                <Settings2 size={16} />
              </button>
              <button 
                onClick={onBlock} 
                className="p-2.5 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-xl transition-all active:scale-95 border border-white/5" 
                title="Bloklash"
              >
                <Ban size={16} />
              </button>
              <button 
                className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md active:scale-95 hover:scale-105 transition-all"
                title="Batafsil"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-600 text-xs font-bold py-2">Jarayon kutilmoqda...</p>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full py-20 text-center flex flex-col items-center gap-3 opacity-40">
      <Users size={40} className="text-gray-600" />
      <p className="text-gray-500 font-bold text-base">{message}</p>
    </div>
  );
}
