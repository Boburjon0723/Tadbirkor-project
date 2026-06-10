'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { formatStockQty } from '@/lib/currency';
import { canManageWarehouses } from '@/lib/role-access';
import { 
  Warehouse, 
  ArrowLeftRight, 
  History, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Search, 
  Filter,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWarehouses, useStockBalances, useStockMovements, useInventoryActions } from '@/hooks/warehouse/use-warehouse';

import { CreateWarehouseModal } from '@/components/CreateWarehouseModal';
import { WarehouseBalancesMobileList } from '@/features/warehouse/WarehouseBalancesMobileList';
import { WarehouseHistoryList } from '@/features/warehouse/WarehouseHistoryList';
import { toast } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';

type WarehouseTab = 'balances' | 'history' | 'list';

const TAB_META: Record<
  WarehouseTab,
  { title: string; subtitle: string; tabLabel: string }
> = {
  balances: {
    title: 'Ombor qoldiqlari',
    subtitle: 'Mahsulotlar bo‘yicha jami, rezerv va erkin qoldiq.',
    tabLabel: 'Qoldiqlar',
  },
  history: {
    title: 'Ombor harakatlari',
    subtitle: 'Kirim, chiqim va ichki ko‘chirishlar tarixi.',
    tabLabel: 'Harakatlar',
  },
  list: {
    title: 'Omborlar ro‘yxati',
    subtitle: 'Omborxonalar, manzillar va sozlamalar.',
    tabLabel: 'Omborlar',
  },
};

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function WarehousePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = session?.role ?? 'owner';
  const isAccountant = role === 'accountant';
  const canManage = canManageWarehouses(role);
  const defaultTab: WarehouseTab = isAccountant ? 'history' : 'balances';
  const [activeTab, setActiveTab] = useState<WarehouseTab>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { data: warehouses, isLoading: isLoadingWarehouses } = useWarehouses();
  const { data: balances, isLoading: isLoadingBalances } = useStockBalances();
  const { data: movements, isLoading: isLoadingMovements } = useStockMovements();
  const { deleteWarehouse } = useInventoryActions();
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'balances' || tab === 'history' || tab === 'list') {
      setActiveTab(tab);
    } else {
      setActiveTab(defaultTab);
    }
  }, [searchParams, defaultTab]);

  const selectTab = useCallback(
    (tab: WarehouseTab) => {
      setActiveTab(tab);
      router.replace(`/dashboard/warehouse?tab=${tab}`, { scroll: false });
    },
    [router],
  );

  const groupedBalances = useMemo(() => {
    if (!balances?.length) return [];
    const groups = new Map<string, { warehouse: any; items: any[] }>();

    balances.forEach((balance: any) => {
      const key = balance.warehouse?.id || 'unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          warehouse: balance.warehouse || { name: "Noma'lum ombor" },
          items: [],
        });
      }
      groups.get(key)!.items.push(balance);
    });

    return Array.from(groups.values());
  }, [balances]);

  const totalQty = useMemo(
    () =>
      balances?.reduce((sum: number, b: { quantity: unknown }) => sum + Number(b.quantity), 0) || 0,
    [balances],
  );

  const todayMovements = useMemo(
    () => (movements || []).filter((m: { createdAt?: string }) => m.createdAt && isToday(m.createdAt)),
    [movements],
  );

  const stats = [
    { title: 'Jami omborlar', value: String(warehouses?.length || 0), icon: Warehouse, color: 'blue' },
    { title: 'Mahsulot qoldig‘i', value: formatStockQty(totalQty), icon: Package, color: 'purple' },
    {
      title: 'Bugungi kirim',
      value: String(
        todayMovements.filter((m: { type?: string; kind?: string }) => m.type === 'IN' || m.kind === 'intake')
          .length,
      ),
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      title: 'Bugungi chiqim',
      value: String(
        todayMovements.filter((m: { kind?: string; type?: string }) => m.kind === 'single' && m.type === 'OUT')
          .length,
      ),
      icon: TrendingDown,
      color: 'red',
    },
  ];

  const pageMeta = TAB_META[activeTab];

  const handleDeleteWarehouse = async (id: string, name: string) => {
    if (!(await confirmAction(`"${name}" omborini o'chirishni tasdiqlaysizmi?`, { variant: 'danger', confirmLabel: "Ha, o'chirish" }))) return;
    try {
      const result = await deleteWarehouse.mutateAsync(id);
      if (result?.action === 'archived') {
        toast.warning(result?.message || 'Ombor arxivlandi.');
      } else {
        toast.success(result?.message || 'Ombor o‘chirildi.');
      }
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Omborni o'chirishda xatolik yuz berdi.";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  return (
    <div className="space-y-5 lg:space-y-7 pb-24 md:pb-16">
      {canManage && (
        <CreateWarehouseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 px-1">
        <div>
          <h1 className="dash-page-title mb-1">
            {pageMeta.title.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-purple-500">{pageMeta.title.split(' ').slice(-1)}</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl">{pageMeta.subtitle}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-white/5 border border-white/10 rounded-2xl font-black hover:bg-white/10 transition-all text-blue-400 text-sm md:text-base w-full md:w-auto justify-center"
            >
              <Plus size={20} />
              Yangi Ombor
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-3 md:p-4 lg:p-5 rounded-xl lg:rounded-2xl relative overflow-hidden group min-w-0"
          >
            <div className="relative flex flex-col gap-2 md:gap-3 min-w-0">
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center text-${stat.color}-500 shrink-0`}>
                <stat.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-gray-500 text-[9px] md:text-[10px] font-black uppercase tracking-wider leading-tight truncate">
                  {stat.title}
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-black mt-0.5 tabular-nums truncate">
                  {stat.value}
                </h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center p-1.5 md:p-2 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl w-full md:w-fit overflow-x-auto scrollbar-none">
        {(['balances', 'history', 'list'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => selectTab(tab)}
          className={`shrink-0 px-4 md:px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all ${activeTab === tab ? 'bg-white text-black shadow-xl' : 'text-gray-400 hover:text-white'}`}
        >
          {TAB_META[tab].tabLabel}
        </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="glass-card rounded-xl lg:rounded-2xl overflow-hidden bg-white/[0.01] border border-white/5">
        {activeTab === 'balances' && (
          <>
          <div className="md:hidden -mx-6">
            <WarehouseBalancesMobileList
              groups={groupedBalances}
              isLoading={isLoadingBalances}
            />
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-4 lg:px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">Mahsulot / variant</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 text-right">Jami</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 text-right">Rezerv</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 text-right hidden lg:table-cell">Blok</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 text-right">Erkin</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 hidden md:table-cell">Holat</th>
                  <th className="px-3 lg:px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 text-right w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoadingBalances ? (
                  <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Yuklanmoqda...</td></tr>
                ) : balances?.length === 0 ? (
                  <tr><td colSpan={7} className="py-20 text-center text-gray-500 font-bold">Hali qoldiqlar mavjud emas</td></tr>
                ) : groupedBalances.map((group: any, groupIdx: number) => (
                  <React.Fragment key={group.warehouse?.id || `warehouse-${groupIdx}`}>
                    <tr className="bg-blue-500/[0.06] border-y border-white/5">
                      <th colSpan={7} scope="colgroup" className="px-4 lg:px-6 py-3 text-left">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-sm text-blue-300">
                            {group.warehouse?.name || "Noma'lum ombor"}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 shrink-0">
                            {group.items.length} ta mahsulot
                          </p>
                        </div>
                      </th>
                    </tr>
                    {group.items.map((b: any, idx: number) => (
                      <motion.tr 
                        key={b.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (groupIdx * 0.08) + (idx * 0.03) }}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 lg:px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                              <Package size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{b.productVariant.product.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold truncate">{b.productVariant.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 lg:px-4 py-4 text-right">
                          <p className="font-black text-sm text-white tabular-nums">{formatStockQty(Number(b.quantity))}</p>
                        </td>
                        <td className="px-3 lg:px-4 py-4 text-right">
                          <p className="font-bold text-amber-400 tabular-nums">{formatStockQty(Number(b.reservedQuantity ?? 0))}</p>
                        </td>
                        <td className="px-3 lg:px-4 py-4 text-right hidden lg:table-cell">
                          <p className="font-bold text-gray-400 tabular-nums">{formatStockQty(Number(b.blockedQuantity ?? 0))}</p>
                        </td>
                        <td className="px-3 lg:px-4 py-4 text-right">
                          <p className={`font-black text-sm tabular-nums ${
                            Math.max(0, Number(b.quantity) - Number(b.reservedQuantity ?? 0) - Number(b.blockedQuantity ?? 0)) < 10
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }`}>
                            {formatStockQty(Math.max(0, Number(b.quantity) - Number(b.reservedQuantity ?? 0) - Number(b.blockedQuantity ?? 0)))}
                          </p>
                        </td>
                        <td className="px-3 lg:px-4 py-4 hidden md:table-cell">
                          {Number(b.quantity) < 10 ? (
                            <span className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest bg-red-400/10 px-3 py-1 rounded-full w-fit">
                              <AlertCircle size={10} /> Kam qolgan
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-400/10 px-3 py-1 rounded-full w-fit">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-3 lg:px-4 py-4 text-right">
                           <button type="button" className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                            <ArrowRight size={16} />
                           </button>
                        </td>
                      </motion.tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {activeTab === 'history' && (
          <WarehouseHistoryList items={movements} isLoading={isLoadingMovements} />
        )}

        {activeTab === 'list' && (
          <div className="p-4 md:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {isLoadingWarehouses ? (
              <div className="col-span-full py-20 text-center">Yuklanmoqda...</div>
            ) : warehouses?.map((w: any) => (
              <div key={w.id} className="p-8 bg-white/5 border border-white/10 rounded-[2rem] hover:border-blue-500/30 transition-all group">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                    <Warehouse size={24} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-400/10 text-emerald-400 px-3 py-1 rounded-full">Faol</span>
                </div>
                <h3 className="text-xl font-black mb-2">{w.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{w.address || 'Manzil ko\'rsatilmagan'}</p>
                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Turi</span>
                    <span className="font-bold text-sm">Asosiy ombor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-3 bg-white/5 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                      <FileText size={18} />
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWarehouse(w.id, w.name)}
                        disabled={deleteWarehouse.isPending}
                        className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                        title="O'chirish"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
