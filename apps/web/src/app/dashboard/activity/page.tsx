'use client';

import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Package, 
  ShoppingBag, 
  Truck, 
  Wallet, 
  User, 
  ShieldCheck, 
  Tag, 
  Clock,
  Loader2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Box,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuditLog, useAuditLogs, useAuditStats } from '@/hooks/audit/use-audit';

export default function ActivityPage() {
  const [filters, setFilters] = useState<any>({
    action: '',
    entityType: '',
  });
  const [queryText, setQueryText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: logs, isLoading } = useAuditLogs({
    ...filters,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const { data: stats } = useAuditStats();
  const { data: selectedLog, isLoading: selectedLogLoading } = useAuditLog(selectedLogId);

  // Smart fallback parser for unmapped English audit keys
  const smartPrettifyAction = (action: string) => {
    const clean = String(action || '')
      .replace(/_/g, ' ')
      .replace(/\./g, ' ')
      .trim();

    // Mapping dictionary for technical keywords to Uzbek equivalents
    const termsMap: Record<string, string> = {
      'product': 'Mahsulot',
      'import': 'importi',
      'confirmed': 'tasdiqlandi',
      'created': 'yaratildi',
      'updated': 'yangilandi',
      'deleted': 'o‘chirildi',
      'stock': 'Ombor zaxirasi',
      'order': 'Buyurtma',
      'warehouse': 'Ombor',
      'receipt': 'Qabul',
      'accepted': 'tasdiqlandi',
      'rejected': 'rad etildi',
      'sent': 'yuborildi',
      'payment': 'To‘lov',
      'received': 'qabul qilindi',
      'mapped': 'moslashtirildi',
      'item': 'qatori',
      'user': 'Foydalanuvchi',
      'role': 'Rol',
      'adjusted': 'tuzatildi',
      'completed': 'yakunlandi',
      'voided': 'bekor qilindi',
      'override': 'o‘zgartirildi',
    };

    const words = clean.split(/\s+/).map((word) => {
      const lower = word.toLowerCase();
      return termsMap[lower] || word;
    });

    return words.join(' ');
  };

  const actionLabel = (action: string) => {
    const key = String(action || '').toLowerCase().trim();
    
    // Complete standard ERP action translations
    const dictionary: Record<string, string> = {
      'order.sent': 'Buyurtma yuborildi',
      'order.accepted': 'Buyurtma tasdiqlandi',
      'order.rejected': 'Buyurtma rad etildi',
      'order.cancelled': 'Buyurtma bekor qilindi',
      'order.deleted': 'Buyurtma o‘chirildi',
      'order.item_mapped': 'Buyurtma qatori moslashtirildi',
      'stock.in': 'Omborga kirim qilindi',
      'stock.out': 'Ombordan chiqim qilindi',
      'stock.updated': 'Ombor zaxirasi yangilandi',
      'stock.adjusted': 'Ombor zaxirasi tuzatildi',
      'pos.sale_completed': 'POS savdo yakunlandi',
      'pos.sale_voided': 'POS chek bekor qilindi',
      'pos.sale_deleted_draft': 'POS qoralama o‘chirildi',
      'pos.price_override': 'POS narxi o‘zgartirildi',
      'partner_ledger.linked_from_stock': 'Hamkor daftariga ombor bog‘landi',
      'product.price_updated': 'Mahsulot narxi yangilandi',
      'product.created': 'Yangi mahsulot yaratildi',
      'product.updated': 'Mahsulot tahrirlandi',
      'product.deleted': 'Mahsulot o‘chirildi',
      'product import_confirmed': 'Mahsulotlar importi muvaffaqiyatli yakunlandi',
      'product.import_confirmed': 'Mahsulotlar importi muvaffaqiyatli yakunlandi',
      'product_import_confirmed': 'Mahsulotlar importi muvaffaqiyatli yakunlandi',
      'warehouse.created': 'Yangi ombor yaratildi',
      'warehouse.updated': 'Ombor sozlamalari yangilandi',
      'warehouse.deleted': 'Ombor o‘chirildi',
      'receipt.accepted': 'Qabul hujjati tasdiqlandi',
      'receipt.partial_accepted': 'Qabul qisman tasdiqlandi',
      'debt.created': 'Qarz majburiyati shakllantirildi',
      'debt.payment_received': 'To‘lov qabul qilindi',
      'expense.create': 'Ichki xarajat qo‘shildi',
      'expense.approve': 'Xarajat tasdiqlandi',
      'expense.reject': 'Xarajat rad etildi',
      'expense.delete': 'Xarajat o‘chirildi',
      'partner_ledger.sale_order_create': 'Hamkor sotuvi tasdiqlandi',
      'partner_ledger.operation_create': 'Hamkor daftariga operatsiya',
      'partner_ledger.operation_update': 'Hamkor operatsiyasi yangilandi',
      'partner_ledger.operation_delete': 'Hamkor operatsiyasi o‘chirildi',
      'partner_ledger.contact_delete': 'Hamkor daftaridan o‘chirildi',
      'payment.received': 'To‘lov qabul qilindi',
      'user.login': 'Tizimga kirildi',
      'user.logout': 'Tizimdan chiqildi',
    };

    if (dictionary[key]) return dictionary[key];

    // Normalize keys with spaces/underscores and re-check
    const normalizedKey = key.replace(/_/g, '.').replace(/\s+/g, '.');
    if (dictionary[normalizedKey]) return dictionary[normalizedKey];

    return smartPrettifyAction(action);
  };

  const entityLabel = (entityType: string) => {
    const e = String(entityType || '').toUpperCase().trim();
    if (e === 'B2B_ORDER') return 'Buyurtmalar';
    if (e === 'PRODUCT') return 'Mahsulotlar';
    if (e === 'PRODUCT_IMPORT') return 'Mahsulotlar importi';
    if (e === 'WAREHOUSE') return 'Omborlar';
    if (e === 'STOCK' || e === 'STOCK_MOVEMENT' || e === 'STOCK_BALANCE') return 'Ombor zaxirasi';
    if (e === 'POS_SALE') return 'POS savdo';
    if (e === 'PARTNER_LEDGER_OPERATION' || e === 'PARTNER_LEDGER_CONTACT') return 'Hamkor daftari';
    if (e === 'DISPATCH' || e === 'GOODS_RECEIPT') return 'Logistika';
    if (e === 'DEBT') return 'Moliya / Qarz';
    if (e === 'PAYMENT') return 'To‘lovlar';
    if (e === 'USER' || e === 'ROLE') return 'Xavfsizlik';
    
    return e.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const sectionOptions = React.useMemo(() => {
    const fromLogs = Array.from(
      new Set<string>((logs || []).map((l: any) => String(l.entityType || '').trim()).filter(Boolean)),
    )
      .map((val: string) => ({ val, label: entityLabel(val) }));
    return [{ val: '', label: "Barcha bo'limlar" }, ...fromLogs];
  }, [logs]);

  const actionOptions = React.useMemo(() => {
    const fromLogs = Array.from(
      new Set<string>((logs || []).map((l: any) => String(l.action || '').trim()).filter(Boolean)),
    )
      .map((val: string) => ({ val, label: actionLabel(val) }));
    return [{ val: '', label: 'Barcha harakatlar' }, ...fromLogs];
  }, [logs]);

  const colorStyles: Record<string, { chip: string; iconWrap: string; iconColor: string; border: string }> = {
    blue: {
      chip: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      iconWrap: 'bg-blue-500/10 border-blue-500/20 shadow-lg shadow-blue-500/5',
      iconColor: 'text-blue-400',
      border: 'bg-gradient-to-b from-blue-500 to-blue-600',
    },
    purple: {
      chip: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      iconWrap: 'bg-purple-500/10 border-purple-500/20 shadow-lg shadow-purple-500/5',
      iconColor: 'text-purple-400',
      border: 'bg-gradient-to-b from-purple-500 to-purple-600',
    },
    emerald: {
      chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      iconWrap: 'bg-emerald-500/10 border-emerald-500/20 shadow-lg shadow-emerald-500/5',
      iconColor: 'text-emerald-400',
      border: 'bg-gradient-to-b from-emerald-500 to-emerald-600',
    },
    amber: {
      chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      iconWrap: 'bg-amber-500/10 border-amber-500/20 shadow-lg shadow-amber-500/5',
      iconColor: 'text-amber-400',
      border: 'bg-gradient-to-b from-amber-500 to-amber-600',
    },
    red: {
      chip: 'bg-red-500/10 text-red-400 border-red-500/20',
      iconWrap: 'bg-red-500/10 border-red-500/20 shadow-lg shadow-red-500/5',
      iconColor: 'text-red-400',
      border: 'bg-gradient-to-b from-red-500 to-red-600',
    },
    gray: {
      chip: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      iconWrap: 'bg-white/5 border border-white/5 shadow-md',
      iconColor: 'text-gray-400',
      border: 'bg-white/10',
    },
  };

  const statColorStyles: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/5',
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
  };

  const getEventConfig = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('order')) return { icon: <ShoppingBag size={18} />, color: 'blue', label: 'Buyurtma' };
    if (act.includes('stock') || act.includes('product') || act.includes('warehouse')) return { icon: <Package size={18} />, color: 'purple', label: 'Mahsulot/Ombor' };
    if (act.includes('dispatch') || act.includes('receipt')) return { icon: <Truck size={18} />, color: 'emerald', label: 'Logistika' };
    if (act.includes('debt') || act.includes('payment')) return { icon: <Wallet size={18} />, color: 'amber', label: 'Moliya' };
    if (act.includes('user') || act.includes('role')) return { icon: <ShieldCheck size={18} />, color: 'red', label: 'Xavfsizlik' };
    return { icon: <History size={18} />, color: 'gray', label: 'Tizim' };
  };

  const progressPercent = (log: any) => {
    const total = Number(log?.orderSummary?.qtyOrdered || 0);
    if (!total) return 0;
    const received = Number(log?.orderSummary?.qtyReceived || 0);
    return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Hozirgina';
    if (minutes < 60) return `${minutes}m avval`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}s avval`;
    return new Date(date).toLocaleDateString();
  };

  const visibleLogs = (logs || []).filter((log: any) => {
    const q = queryText.trim().toLowerCase();
    if (!q) return true;
    return (
      actionLabel(log.action).toLowerCase().includes(q) ||
      entityLabel(log.entityType).toLowerCase().includes(q) ||
      String(log.entityId || '').toLowerCase().includes(q) ||
      String(log.user?.fullName || log.user?.login || log.userId || '').toLowerCase().includes(q)
    );
  });

  const formatMoneyMap = (map?: Record<string, number>) => {
    if (!map) return '—';
    const entries = Object.entries(map).filter(([, v]) => Number(v || 0) !== 0);
    if (!entries.length) return '0';
    return entries
      .map(([c, v]) => `${Number(v).toLocaleString('uz-UZ', { maximumFractionDigits: c === 'USD' ? 2 : 0 })} ${c}`)
      .join(' | ');
  };

  return (
    <div className="dash-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="dash-page-title mb-1">
            Tizim <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">jurnali</span>
          </h1>
          <p className="dash-page-subtitle">
            Kim, qachon va nima o‘zgartirgani — barcha harakatlar tarixi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
        {[
          { title: "Bugungi harakatlar", value: stats?.totalToday || 0, icon: TrendingUp, color: "blue" },
          { title: "Narx o'zgarishlari (jami)", value: stats?.priceUpdates || 0, icon: Tag, color: "purple" },
          { title: "Ombor harakatlari (jami)", value: stats?.stockActions || 0, icon: Box, color: "emerald" },
        ].map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, type: 'spring', stiffness: 100 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="glass-card p-4 md:p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300"
          >
            <div className="relative flex flex-col gap-4">
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${statColorStyles[stat.color] || statColorStyles.blue}`}>
                <stat.icon size={24} className="md:size-[28px]" />
              </div>
              <div>
                <p className="text-gray-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters (optimized and spacious) */}
      <div className="glass-card p-4 lg:p-5 rounded-2xl lg:rounded-[2rem] flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center bg-white/[0.01] relative z-20 border border-white/5">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="Qidirish..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs lg:text-sm focus:outline-none focus:border-blue-500/50 transition-all text-white font-bold h-12"
          />
        </div>
        
        {/* Elastic responsive sub-group */}
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-56">
            <button
              type="button"
              onClick={() => setIsSectionDropdownOpen(!isSectionDropdownOpen)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs lg:text-sm font-bold outline-none focus:border-blue-500/50 transition-all text-white flex items-center justify-between h-12 whitespace-nowrap"
            >
              <span className="truncate">
                {sectionOptions.find((x) => x.val === filters.entityType)?.label || "Barcha bo'limlar"}
              </span>
              <ChevronDown size={16} className={`text-gray-500 transition-transform shrink-0 ${isSectionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isSectionDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsSectionDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0f]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 backdrop-blur-3xl p-1"
                  >
                    {sectionOptions.map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => { setFilters({ ...filters, entityType: opt.val }); setIsSectionDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${filters.entityType === opt.val ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="relative w-full sm:w-56">
            <button
              type="button"
              onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs lg:text-sm font-bold outline-none focus:border-blue-500/50 transition-all text-white flex items-center justify-between h-12 whitespace-nowrap"
            >
              <span className="truncate">{actionOptions.find((x) => x.val === filters.action)?.label || 'Barcha harakatlar'}</span>
              <ChevronDown size={16} className={`text-gray-500 transition-transform shrink-0 ${isActionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isActionDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsActionDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0f]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-40 backdrop-blur-3xl p-1"
                  >
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      {actionOptions.map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            setFilters({ ...filters, action: opt.val });
                            setIsActionDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs lg:text-sm font-bold transition-all ${filters.action === opt.val ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
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

          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl h-12">
            <Calendar size={14} className="text-blue-500 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-[11px] text-white outline-none [color-scheme:dark]"
            />
            <span className="text-gray-500 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-[11px] text-white outline-none [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="dash-section p-4 md:p-6 relative shadow-xl">
        <div className="absolute left-[54px] md:left-[71px] top-20 bottom-20 w-px bg-gradient-to-b from-blue-500/0 via-blue-500/10 to-blue-500/0 hidden sm:block" />

        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="py-32 text-center">
            <p className="text-gray-500 font-bold text-sm">Hozircha harakatlar tarixi bo'sh</p>
          </div>
        ) : (
          <div className="space-y-10 relative">
            {visibleLogs.map((log: any, idx: number) => {
              const config = getEventConfig(log.action);
              const cs = colorStyles[config.color] || colorStyles.gray;
              return (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  className="relative flex gap-4 md:gap-8 group"
                >
                  {/* Icon Panel */}
                  <div className="relative z-10 shrink-0 hidden sm:block">
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl border flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 ${cs.iconWrap} ${cs.iconColor}`}>
                      {config.icon}
                    </div>
                  </div>

                  {/* Glassmorphic Log Detail Card */}
                  <div className="flex-1 bg-white/[0.01] border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 hover:bg-white/[0.03] hover:backdrop-blur-sm transition-all duration-300 relative overflow-hidden group/card shadow-md hover:shadow-blue-500/5 hover:border-white/10">
                    <div className={`absolute top-0 left-0 w-1 h-full ${cs.border}`} />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                         <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${cs.chip}`}>
                           {entityLabel(log.entityType)}
                         </span>
                         <span className="text-gray-600 font-bold text-xs hidden xs:inline">•</span>
                         <span className="text-gray-400 text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                           <Clock size={11} className="text-blue-500" /> {getTimeAgo(log.createdAt)}
                         </span>
                      </div>
                      <span className="text-[8px] md:text-[9px] text-gray-600 font-black uppercase tracking-[0.2em]">ID: {String(log.entityId || '').slice(0, 8).toUpperCase()}</span>
                    </div>

                    <h4 className="text-lg md:text-xl font-black text-white mb-3 group-hover/card:text-blue-400 transition-colors">
                      {actionLabel(log.action)}
                    </h4>
                    
                    <div className="flex items-center gap-2.5 text-gray-500">
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-blue-400 shrink-0">
                        <User size={13} />
                      </div>
                      <p className="text-[11px] md:text-xs font-bold">
                        Foydalanuvchi:{' '}
                        <span className="text-white">
                          {log.user?.fullName || log.user?.login || String(log.userId || 'Tizim').slice(0, 8)}
                        </span>
                      </p>
                    </div>

                    {log.orderSummary && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                          <div className="text-gray-500 font-bold mb-0.5">Hamkor (Kimga/Kimdan)</div>
                          <div className="text-white font-black">{log.orderSummary.counterpartyName || '—'}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                          <div className="text-gray-500 font-bold mb-0.5">Buyurtma summasi</div>
                          <div className="text-white font-black">{formatMoneyMap(log.orderSummary.orderedAmountByCurrency)}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                          <div className="text-gray-500 font-bold mb-0.5">Jo‘natilgan / Kelgan / Qolgan</div>
                          <div className="text-white font-black">
                            {log.orderSummary.qtyDispatched} ta / {log.orderSummary.qtyReceived} ta / {log.orderSummary.qtyRemaining} ta
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px]">
                          <div className="text-gray-500 font-bold mb-0.5">Kelgan / Qolgan summa</div>
                          <div className="text-white font-black">
                            {formatMoneyMap(log.orderSummary.receivedAmountByCurrency)} / {formatMoneyMap(log.orderSummary.remainingAmountByCurrency)}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] sm:col-span-2">
                          <div className="flex items-center justify-between text-gray-500 mb-1.5 font-bold">
                            <span>Yetkazish progressi</span>
                            <span className="text-white font-black">{progressPercent(log)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                              style={{ width: `${progressPercent(log)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                      <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-wider">
                        {log.orderSummary
                          ? `${log.orderSummary.counterpartyName || 'Hamkor'} bilan bog‘liq harakat`
                          : `${entityLabel(log.entityType)} bo‘yicha operatsiya`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedLogId(log.id)}
                        className="p-2 bg-white/5 hover:bg-blue-600 text-gray-400 hover:text-white rounded-xl transition-all duration-300"
                        title="Tafsilotlar"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Localized audit info block */}
      <div className="p-6 md:p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] flex gap-4 md:gap-6 shadow-md shadow-emerald-500/[0.02]">
        <AlertCircle className="text-emerald-400 shrink-0 w-6 h-6 md:w-8 md:h-8" />
        <div className="space-y-1.5">
          <h5 className="font-black text-emerald-400 text-sm md:text-base">Audit va Monitoring Nazorati</h5>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed font-medium">
            Faollik jurnali tizimdagi har bir o‘zgarishni soniyalarigacha aniqlikda qayd etadi. 
            Bu xavfsizlik va xatoliklarni aniqlashda asosiy vosita hisoblanadi. Xavfsizlik maqsadida ushbu yozuvlar 
            tizimdan o'chirib yuborilmaydi va doimiy saqlanadi.
          </p>
        </div>
      </div>

      {/* Action details modal */}
      <AnimatePresence>
        {selectedLogId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={() => setSelectedLogId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0d0d0f] p-6 shadow-2xl custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <h3 className="text-lg md:text-xl font-black text-white">Operatsiya tafsiloti</h3>
                <button
                  type="button"
                  onClick={() => setSelectedLogId(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  Yopish
                </button>
              </div>

              {selectedLogLoading ? (
                <div className="py-20 flex items-center justify-center gap-3 text-gray-400 font-bold text-xs">
                  <Loader2 className="animate-spin text-blue-500" size={20} />
                  Yuklanmoqda...
                </div>
              ) : !selectedLog ? (
                <div className="text-gray-500 text-sm py-12 text-center font-bold">Ma'lumot topilmadi.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Amal / Harakat</div>
                      <div className="font-black text-white">{actionLabel(selectedLog.action)}</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Bo‘lim / Kategoriya</div>
                      <div className="font-black text-white">{entityLabel(selectedLog.entityType)}</div>
                    </div>
                  </div>

                  {selectedLog.orderSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Hamkor</div>
                        <div className="font-black text-white">{selectedLog.orderSummary.counterpartyName || '—'}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Buyurtma summasi</div>
                        <div className="font-black text-white">{formatMoneyMap(selectedLog.orderSummary.orderedAmountByCurrency)}</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Jo‘natilgan / Kelgan (miqdor)</div>
                        <div className="font-black text-white">
                          {selectedLog.orderSummary.qtyDispatched} ta / {selectedLog.orderSummary.qtyReceived} ta / {selectedLog.orderSummary.qtyRemaining} ta
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Kelgan / Qolgan summa</div>
                        <div className="font-black text-white">
                          {formatMoneyMap(selectedLog.orderSummary.receivedAmountByCurrency)} / {formatMoneyMap(selectedLog.orderSummary.remainingAmountByCurrency)}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 md:col-span-2">
                        <div className="flex items-center justify-between text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-bold">
                          <span>Yetkazish progressi</span>
                          <span className="text-white font-black">{progressPercent(selectedLog)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                            style={{ width: `${progressPercent(selectedLog)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs md:text-sm">
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Foydalanuvchi</div>
                      <div className="font-black text-white">
                        {selectedLog.user?.fullName || selectedLog.user?.login || selectedLog.userId}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-1">Vaqt (Sana va soat)</div>
                      <div className="font-black text-white">{new Date(selectedLog.createdAt).toLocaleString('uz-UZ')}</div>
                    </div>
                  </div>

                  {/* Premium formatting of raw payload changes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {[
                      { title: "O'zgarishdan oldingi holat (Old Data)", data: selectedLog.oldData, color: "text-gray-400" },
                      { title: "O'zgarishdan keyingi holat (New Data)", data: selectedLog.newData, color: "text-emerald-400" }
                    ].map((section, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
                        <div className="text-gray-500 font-bold text-[10px] uppercase tracking-wider mb-2.5">{section.title}</div>
                        {section.data && typeof section.data === 'object' && Object.keys(section.data).length > 0 ? (
                          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                            {Object.entries(section.data).map(([key, value]) => {
                              const translatedKey: Record<string, string> = {
                                name: "Nomi", type: "Turi", unit: "O'lchov birligi", status: "Holati",
                                imageUrl: "Rasm URL", categoryId: "Kategoriya ID", description: "Tavsifi",
                                price: "Narxi", purchasePrice: "Sotib olish narxi", salePrice: "Sotish narxi",
                                stock: "Zaxira", barcode: "Barkod", sku: "SKU", role: "Rol",
                                phone: "Telefon", fullName: "Ism sharif", login: "Login", warehouseId: "Ombor ID",
                                productVariantId: "Variant ID", movementId: "Harakat ID", movementType: "Harakat turi",
                                quantity: "Miqdor", email: "Email", address: "Manzil",
                              };
                              const label = translatedKey[key] || key;

                              let displayValue = String(value);
                              if (typeof value === 'object' && value !== null) {
                                displayValue = JSON.stringify(value);
                              } else if (value === null || value === '') {
                                displayValue = '—';
                              }

                              return (
                                <div key={key} className="flex flex-col bg-black/20 p-2 rounded-lg border border-white/5">
                                  <span className="text-gray-500 text-[9px] uppercase tracking-wider mb-1">{label}</span>
                                  <span className={`text-xs font-medium break-all ${section.color}`}>{displayValue}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-600 text-xs italic p-3">— Ma'lumot yo'q —</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
