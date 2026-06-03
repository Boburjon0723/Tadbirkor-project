'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderPlus, Tag, Loader2, ArrowRight, ChevronDown, Warehouse, Trash2 } from 'lucide-react';
import { useProductActions, useCategories } from '@/hooks/products/use-products';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { toast } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId?: string;
  warehouseName?: string;
}

export function CategoryModal({ isOpen, onClose, warehouseId: fixedWarehouseId, warehouseName }: CategoryModalProps) {
  const { data: categories } = useCategories(fixedWarehouseId, {
    enabled: !!fixedWarehouseId && isOpen,
  });
  const { data: warehouses } = useWarehouses();
  const { createCategory, deleteCategory } = useProductActions();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [warehouseId, setWarehouseId] = useState(fixedWarehouseId || '');
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen && fixedWarehouseId) {
      setWarehouseId(fixedWarehouseId);
    }
  }, [isOpen, fixedWarehouseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      toast.error('Kategoriya uchun ombor tanlang.');
      return;
    }
    try {
      await createCategory.mutateAsync({ 
        name, 
        parentId: parentId || undefined,
        warehouseId,
      });
      setName('');
      setParentId('');
      setWarehouseId('');
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredParentCategories = categories?.filter(
    (c: any) => c.warehouseId === warehouseId,
  );
  const filteredCategoriesByWarehouse = categories?.filter(
    (c: any) => c.warehouseId === warehouseId,
  );

  const handleDeleteCategory = async (category: any) => {
    if (!(await confirmAction(`"${category.name}" kategoriyasini o'chirishni tasdiqlaysizmi?`, { variant: 'danger', confirmLabel: "Ha, o'chirish" }))) return;
    try {
      const result = await deleteCategory.mutateAsync(category.id);
      if (result?.action === 'archived' || result?.status === 'ARCHIVED') {
        toast.warning(result?.message || 'Kategoriya arxivlandi (mahsulotlari bor).');
      } else {
        toast.success(result?.message || 'Kategoriya o‘chirildi.');
      }
      if (parentId === category.id) {
        setParentId('');
      }
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Kategoriyani o'chirishda xatolik yuz berdi.";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black">Yangi <span className="text-purple-500">Kategoriya</span></h2>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
                  <Warehouse size={14} /> Ombor
                </label>
                {fixedWarehouseId ? (
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold text-sm text-white">
                    {warehouseName ||
                      warehouses?.find((w: any) => w.id === fixedWarehouseId)?.name ||
                      'Tanlangan ombor'}
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen);
                        setIsParentDropdownOpen(false);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-purple-500/50 transition-all flex items-center justify-between font-bold text-sm"
                    >
                      <span className={warehouseId ? 'text-white' : 'text-gray-500'}>
                        {warehouseId
                          ? warehouses?.find((w: any) => w.id === warehouseId)?.name
                          : 'Omborni tanlang'}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-500 transition-transform ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <AnimatePresence>
                      {isWarehouseDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-[110]"
                            onClick={() => setIsWarehouseDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[130] backdrop-blur-2xl p-1"
                          >
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                              {warehouses?.map((w: any) => (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => {
                                    setWarehouseId(w.id);
                                    setParentId('');
                                    setIsWarehouseDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${warehouseId === w.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                  {w.name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
                  <Tag size={14} /> Kategoriya Nomi
                </label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: Oziq-ovqat"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-purple-500/50 transition-all font-bold"
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
                  <FolderPlus size={14} /> Asosiy Kategoriya (Ixtiyoriy)
                </label>
                 <div className="relative">
                   <button
                     type="button"
                     disabled={!warehouseId}
                     onClick={() => {
                      if (!warehouseId) return;
                      setIsParentDropdownOpen(!isParentDropdownOpen);
                      setIsWarehouseDropdownOpen(false);
                     }}
                     className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:border-purple-500/50 transition-all flex items-center justify-between font-bold text-sm disabled:opacity-60"
                   >
                     <span className={parentId ? 'text-white' : 'text-gray-500'}>
                       {parentId 
                         ? categories?.find((c: any) => c.id === parentId)?.name 
                         : warehouseId ? "Asosiy (Ota) kategoriya yo'q" : "Avval omborni tanlang"}
                     </span>
                     <ChevronDown size={18} className={`text-gray-500 transition-transform ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                   </button>

                   <AnimatePresence>
                     {isParentDropdownOpen && (
                       <>
                         <div className="fixed inset-0 z-[110]" onClick={() => setIsParentDropdownOpen(false)} />
                         <motion.div
                           initial={{ opacity: 0, y: 10, scale: 0.95 }}
                           animate={{ opacity: 1, y: 0, scale: 1 }}
                           exit={{ opacity: 0, y: 10, scale: 0.95 }}
                           className="absolute bottom-full left-0 right-0 mb-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[130] backdrop-blur-2xl p-1"
                         >
                           <div className="max-h-60 overflow-y-auto custom-scrollbar">
                             <button
                               type="button"
                               onClick={() => { setParentId(''); setIsParentDropdownOpen(false); }}
                               className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!parentId ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                             >
                               Asosiy (Ota) kategoriya yo'q
                             </button>
                             {filteredParentCategories?.map((c: any) => (
                               <button
                                 key={c.id}
                                 type="button"
                                 onClick={() => { setParentId(c.id); setIsParentDropdownOpen(false); }}
                                 className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${parentId === c.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                               >
                                 {c.name}
                               </button>
                             ))}
                           </div>
                         </motion.div>
                       </>
                     )}
                   </AnimatePresence>
                 </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 ml-1">
                  <FolderPlus size={14} /> Mavjud kategoriyalar
                </label>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-2 max-h-44 overflow-y-auto custom-scrollbar">
                  {filteredCategoriesByWarehouse?.length ? (
                    filteredCategoriesByWarehouse.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-white/5">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{c.name}</p>
                          {c.parent?.name && (
                            <p className="text-[10px] text-gray-500 truncate">Ichida: {c.parent.name}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c)}
                          disabled={deleteCategory.isPending}
                          className="shrink-0 p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="Kategoriyani o'chirish"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-xs text-gray-500">Hozircha kategoriya yo'q.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black hover:bg-white/10 transition-all"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={createCategory.isPending || deleteCategory.isPending}
                  className="flex-[1.5] py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createCategory.isPending ? <Loader2 className="animate-spin" size={18} /> : (
                    <>Saqlash <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
