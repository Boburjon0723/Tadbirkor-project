'use client';

import React, { useState } from 'react';
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
import { toast } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState<'balances' | 'history' | 'list'>('balances');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { data: warehouses, isLoading: isLoadingWarehouses } = useWarehouses();
  const { data: balances, isLoading: isLoadingBalances } = useStockBalances();
  const { data: movements, isLoading: isLoadingMovements } = useStockMovements();
  const { deleteWarehouse } = useInventoryActions();
  
  const groupedBalances = React.useMemo(() => {
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

  const stats = [
    { title: "Jami Omborlar", value: warehouses?.length || 0, icon: Warehouse, color: "blue" },
    { title: "Mahsulot Qoldig'i", value: balances?.reduce((sum: number, b: any) => sum + Number(b.quantity), 0) || 0, icon: Package, color: "purple" },
    { title: "Bugungi Kirim", value: movements?.filter((m: any) => m.type === 'IN').length || 0, icon: TrendingUp, color: "emerald" },
    { title: "Bugungi Chiqim", value: movements?.filter((m: any) => m.type === 'OUT').length || 0, icon: TrendingDown, color: "red" },
  ];

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
    <div className="space-y-10 pb-20">
      <CreateWarehouseModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Ombor <span className="text-purple-500">Boshqaruvi</span></h1>
          <p className="text-gray-400 text-lg">Zaxiralarni nazorat qilish, ko'chirish va amallar tarixi.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-black hover:bg-white/10 transition-all text-blue-400"
          >
            <Plus size={20} />
            Yangi Ombor
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/10 blur-[50px] -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500`} />
            <div className="relative flex flex-col gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-500/20 flex items-center justify-center text-${stat.color}-500`}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-gray-500 text-sm font-black uppercase tracking-widest">{stat.title}</p>
                <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center p-2 bg-white/5 border border-white/10 rounded-3xl w-fit">
        <button 
          onClick={() => setActiveTab('balances')}
          className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${activeTab === 'balances' ? 'bg-white text-black shadow-xl' : 'text-gray-400 hover:text-white'}`}
        >
          Qoldiqlar
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-white text-black shadow-xl' : 'text-gray-400 hover:text-white'}`}
        >
          Harakatlar Tarixi
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-8 py-3 rounded-2xl text-sm font-black transition-all ${activeTab === 'list' ? 'bg-white text-black shadow-xl' : 'text-gray-400 hover:text-white'}`}
        >
          Omborlar
        </button>
      </div>

      {/* Main Content Area */}
      <div className="glass-card rounded-[3rem] overflow-hidden bg-white/[0.01] border border-white/5">
        {activeTab === 'balances' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Mahsulot / Variant</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Ombor</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Jami</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Rezerv</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Blok</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Erkin</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Holat</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoadingBalances ? (
                  <tr><td colSpan={8} className="py-20 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Yuklanmoqda...</td></tr>
                ) : balances?.length === 0 ? (
                  <tr><td colSpan={8} className="py-20 text-center text-gray-500 font-bold">Hali qoldiqlar mavjud emas</td></tr>
                ) : groupedBalances.map((group: any, groupIdx: number) => (
                  <React.Fragment key={group.warehouse?.id || `warehouse-${groupIdx}`}>
                    <tr className="bg-white/[0.04] border-y border-white/5">
                      <td colSpan={8} className="px-10 py-4">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-sm text-blue-400 uppercase tracking-widest">
                            {group.warehouse?.name || "Noma'lum ombor"}
                          </p>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            {group.items.length} ta qator
                          </p>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((b: any, idx: number) => (
                      <motion.tr 
                        key={b.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: (groupIdx * 0.08) + (idx * 0.03) }}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                              <Package size={18} />
                            </div>
                            <div>
                              <p className="font-black text-sm">{b.productVariant.product.name}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase">{b.productVariant.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-sm font-medium text-gray-400">{b.warehouse.name}</td>
                        <td className="px-10 py-6">
                          <p className="font-black text-lg text-white">{Number(b.quantity)}</p>
                        </td>
                        <td className="px-10 py-6">
                          <p className="font-bold text-amber-400">{Number(b.reservedQuantity ?? 0)}</p>
                        </td>
                        <td className="px-10 py-6">
                          <p className="font-bold text-gray-400">{Number(b.blockedQuantity ?? 0)}</p>
                        </td>
                        <td className="px-10 py-6">
                          <p className={`font-black text-lg ${
                            Math.max(0, Number(b.quantity) - Number(b.reservedQuantity ?? 0) - Number(b.blockedQuantity ?? 0)) < 10
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }`}>
                            {Math.max(0, Number(b.quantity) - Number(b.reservedQuantity ?? 0) - Number(b.blockedQuantity ?? 0))}
                          </p>
                        </td>
                        <td className="px-10 py-6">
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
                        <td className="px-10 py-6 text-right">
                           <button className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all">
                            <ArrowRight size={18} />
                           </button>
                        </td>
                      </motion.tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Sana</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Mahsulot</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Turi</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Miqdor</th>
                  <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoadingMovements ? (
                  <tr><td colSpan={5} className="py-20 text-center">Yuklanmoqda...</td></tr>
                ) : movements?.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-gray-500 font-bold">Harakatlar tarixi bo'sh</td></tr>
                ) : movements?.map((m: any, idx: number) => (
                  <motion.tr 
                    key={m.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-10 py-6 text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-10 py-6">
                      <p className="font-bold text-sm">{m.productVariant.product.name}</p>
                      <p className="text-[10px] text-gray-500">{m.productVariant.name}</p>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${m.type === 'IN' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                        {m.type === 'IN' ? 'Kirim' : 'Chiqim'}
                      </span>
                    </td>
                    <td className="px-10 py-6 font-black">{m.type === 'IN' ? '+' : '-'}{m.quantity}</td>
                    <td className="px-10 py-6 text-sm text-gray-500">{m.note || '-'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                    <button
                      onClick={() => handleDeleteWarehouse(w.id, w.name)}
                      disabled={deleteWarehouse.isPending}
                      className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                      title="O'chirish"
                    >
                      <Trash2 size={18} />
                    </button>
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
