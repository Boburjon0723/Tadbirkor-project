'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitBranch, 
  Plus, 
  Search, 
  Building2, 
  ArrowRight, 
  Trash2, 
  Pencil,
  ChevronDown
} from 'lucide-react';
import { api } from '@/lib/api';
import { b2bService } from '@/services/b2b.service';
import { productsService } from '@/services/products.service';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { ModuleGate } from '@/components/ModuleGate';
import {
  displayOrderProductSnapshot,
  displayPartnerMappingSku,
  editablePartnerMappingSku,
  formatOwnVariantPickerLabel,
  isPartnerSkuInternalId,
} from '@/lib/order-product-label';

export default function ProductMappingsPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [ownProducts, setOwnProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    partnerId: '',
    ownProductVariantId: '',
    partnerProductName: '',
    partnerProductSku: '',
    partnerInternalId: '',
  });

  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const [isOwnProductDropdownOpen, setIsOwnProductDropdownOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [mappingsData, partnersData, productsData] = await Promise.all([
        api.get('/product-mappings').then(res => res.data),
        b2bService.getPartners(),
        productsService.getProducts()
      ]);
      setMappings(mappingsData);
      setPartners(partnersData.filter((p: any) => p.status === 'ACTIVE'));
      
      const variants = productsData.flatMap((p: any) =>
        (p.variants || [])
          .filter((v: any) => v.status !== 'INACTIVE' && v.status !== 'ARCHIVED')
          .map((v: any) => ({
            ...v,
            productName: p.name,
            displayName: formatOwnVariantPickerLabel(p.name, v),
          })),
      );
      setOwnProducts(variants);
    } catch (err) {
      console.error("Data fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resolvePartnerCompanyId = (partner: any) => {
    if (!partner) return '';
    return partner.company?.id || partner.partnerCompanyId || partner.ownerCompanyId || '';
  };

  const emptyForm = () => ({
    partnerId: '',
    ownProductVariantId: '',
    partnerProductName: '',
    partnerProductSku: '',
    partnerInternalId: '',
  });

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setShowAddModal(true);
  };

  const openEditModal = (mapping: any) => {
    const partner = partners.find(
      (p) => resolvePartnerCompanyId(p) === mapping.partnerCompanyId,
    );
    setEditingId(mapping.id);
    setFormData({
      partnerId: partner?.id || '',
      ownProductVariantId: mapping.ownProductVariantId || mapping.ownProductVariant?.id || '',
      partnerProductName: mapping.partnerProductName || '',
      partnerProductSku: editablePartnerMappingSku(mapping),
      partnerInternalId: isPartnerSkuInternalId(mapping.partnerSku) ? mapping.partnerSku : '',
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setFormData(emptyForm());
    setIsPartnerDropdownOpen(false);
    setIsOwnProductDropdownOpen(false);
  };

  const filteredMappings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter((m) => {
      const haystack = [
        m.partnerCompany?.name,
        m.partnerCompany?.tin,
        m.partnerProductName,
        m.partnerSku,
        m.ownProductVariant?.product?.name,
        m.ownProductVariant?.name,
        m.ownProductVariant?.sku,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mappings, searchQuery]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownProductVariantId || !formData.partnerProductName.trim()) {
      toast.error("Barcha majburiy maydonlarni to'ldiring");
      return;
    }
    if (!editingId && !formData.partnerId) {
      toast.error('Hamkor tanlang');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const skuValue = formData.partnerProductSku.trim();
        const payload: Record<string, string | undefined> = {
          partnerProductName: formData.partnerProductName.trim(),
          ownProductVariantId: formData.ownProductVariantId,
        };
        if (formData.partnerInternalId) {
          payload.partnerBarcode = skuValue || undefined;
        } else {
          payload.partnerSku = skuValue || undefined;
        }
        await api.patch(`/product-mappings/${editingId}`, payload);
        toast.success('Mapping yangilandi');
      } else {
        const selectedPartner = partners.find((p) => p.id === formData.partnerId);
        if (!selectedPartner) throw new Error('Hamkor tanlanmagan');

        const partnerCompanyId = resolvePartnerCompanyId(selectedPartner);
        if (!partnerCompanyId) throw new Error('Hamkor kompaniyasi aniqlanmadi');

        await api.post('/product-mappings', {
          partnerCompanyId,
          ownProductVariantId: formData.ownProductVariantId,
          partnerProductName: formData.partnerProductName.trim(),
          partnerSku: formData.partnerProductSku.trim() || undefined,
        });
        toast.success('Mapping saqlandi');
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(formatApiError(err, 'Xatolik yuz berdi'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Ushbu moslashtirishni o'chirib tashlamoqchimisiz?", { variant: 'danger', confirmLabel: "Ha, o'chirish" }))) return;
    try {
      await api.delete(`/product-mappings/${id}`);
      toast.success("Mapping o'chirildi");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(formatApiError(err, "O'chirishda xatolik"));
    }
  };

  return (
    <ModuleGate moduleKey="PRODUCT_MAPPING" moduleLabel="Mahsulot Mapping">
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Mahsulotlar <span className="text-blue-500">Mappingi</span></h1>
          <p className="text-gray-400 text-lg">
            Hamkorlaringiz mahsulotlarini o&apos;zingizning bazangizga moslashtiring.
            Yuk qabulidagi nom bilan <span className="text-white font-bold">bir xil</span> yozing
            (masalan: <span className="text-blue-400">A-001 — Qora (Qora)</span>).
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-[1.5rem] transition-all shadow-[0_15px_30px_rgba(37,99,235,0.3)] active:scale-95"
        >
          <div className="p-1 bg-white/20 rounded-lg group-hover:rotate-45 transition-transform">
            <Plus size={20} />
          </div>
          Yangi Mapping
        </button>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Hamkor, mahsulot nomi yoki SKU bo'yicha qidirish..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-5 text-sm font-bold text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/40"
        />
        {searchQuery.trim() && !loading && (
          <p className="mt-2 text-xs text-gray-500 font-bold">
            {filteredMappings.length} ta natija (jami {mappings.length})
          </p>
        )}
      </div>

      {/* Mappings Table/Grid */}
      <div className="glass-card rounded-[3rem] overflow-hidden border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Hamkor</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Hamkor Mahsuloti</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Yo'nalish</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Sizning Mahsulotingiz</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6"><div className="h-4 bg-white/5 rounded w-full" /></td>
                  </tr>
                ))
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-500">
                      <GitBranch size={48} className="opacity-20" />
                      <p className="font-bold text-lg">
                        {searchQuery.trim()
                          ? 'Qidiruv bo\'yicha natija topilmadi'
                          : 'Hozircha hech qanday mapping yaratilmagan'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredMappings.map((m, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={m.id} 
                  className="hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/10">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <p className="font-black text-sm">{m.partnerCompany?.name || '—'}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          STIR: {m.partnerCompany?.tin || '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-block px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                       <p className="font-bold text-sm">
                         {displayOrderProductSnapshot(m.partnerProductName)}
                       </p>
                       <p className="text-[10px] text-gray-500">
                         SKU: {displayPartnerMappingSku(m)}
                       </p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center">
                      <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500">
                        <ArrowRight size={20} />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-block px-4 py-2 bg-blue-600/10 rounded-xl border border-blue-500/10">
                       <p className="font-bold text-sm text-blue-400">{m.ownProductVariant?.product?.name}</p>
                       <p className="text-[10px] text-blue-400/50 uppercase font-black">
                         {m.ownProductVariant?.name}
                         {m.ownProductVariant?.sku ? ` · SKU: ${m.ownProductVariant.sku}` : ''}
                       </p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Mappingni tahrirlash"
                        onClick={() => openEditModal(m)}
                        className="p-3 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        title="Mappingni o'chirish"
                        onClick={() => handleDelete(m.id)}
                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Mapping Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-2xl glass-card rounded-[3rem] p-10 md:p-12 shadow-2xl border-white/10 overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32" />
               
               <div className="flex justify-between items-start mb-10 relative z-10">
                <div>
                  <h3 className="text-3xl font-black mb-3 text-blue-400">
                    {editingId ? (
                      <>Mappingni <span className="text-white">Tahrirlash</span></>
                    ) : (
                      <>Yangi <span className="text-white">Moslashtirish</span></>
                    )}
                  </h3>
                  <p className="text-gray-500 text-sm font-medium">
                    {editingId
                      ? "Hamkor mahsulot nomi o'zgarganda shu yerdan yangilang."
                      : "Hamkor va o'z mahsulotlaringiz o'rtasida aloqa o'rnating."}
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-blue-500 border border-white/10">
                  <GitBranch size={28} />
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Step 1: Hamkor */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Hamkorni tanlang</label>
                   <div className="relative">
                     <button
                       type="button"
                       disabled={!!editingId}
                       onClick={() => !editingId && setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                       className={`w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-4 px-6 text-sm font-bold focus:outline-none focus:border-blue-500/50 flex items-center justify-between ${editingId ? 'opacity-70 cursor-not-allowed' : ''}`}
                     >
                       <span className={formData.partnerId ? 'text-white' : 'text-gray-500'}>
                         {formData.partnerId 
                           ? partners.find(p => p.id === formData.partnerId)?.company?.name 
                           : "--- Hamkor tanlang ---"}
                       </span>
                       <ChevronDown size={18} className={`text-gray-500 transition-transform ${isPartnerDropdownOpen ? 'rotate-180' : ''}`} />
                     </button>

                     <AnimatePresence>
                       {isPartnerDropdownOpen && !editingId && (
                         <>
                           <div className="fixed inset-0 z-[110]" onClick={() => setIsPartnerDropdownOpen(false)} />
                           <motion.div
                             initial={{ opacity: 0, y: 10, scale: 0.95 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, y: 10, scale: 0.95 }}
                             className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-2xl p-1"
                           >
                             <div className="max-h-60 overflow-y-auto custom-scrollbar">
                               <button
                                 type="button"
                                 onClick={() => { setFormData({ ...formData, partnerId: '' }); setIsPartnerDropdownOpen(false); }}
                                 className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!formData.partnerId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                               >
                                 --- Hamkor tanlang ---
                               </button>
                               {partners.map(p => (
                                 <button
                                   key={p.id}
                                   type="button"
                                   onClick={() => { setFormData({ ...formData, partnerId: p.id }); setIsPartnerDropdownOpen(false); }}
                                   className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${formData.partnerId === p.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                 >
                                   {p.company?.name}
                                 </button>
                               ))}
                             </div>
                           </motion.div>
                         </>
                       )}
                     </AnimatePresence>
                   </div>
                  </div>

                  {/* Step 2: O'z mahsulotimiz */}
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Sizning mahsulotingiz</label>
                   <div className="relative">
                     <button
                       type="button"
                       onClick={() => setIsOwnProductDropdownOpen(!isOwnProductDropdownOpen)}
                       className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-4 px-6 text-sm font-bold focus:outline-none focus:border-blue-500/50 flex items-center justify-between"
                     >
                       <span className={formData.ownProductVariantId ? 'text-white' : 'text-gray-500'}>
                         {formData.ownProductVariantId 
                           ? ownProducts.find(v => v.id === formData.ownProductVariantId)?.displayName 
                           : "--- Mahsulot tanlang ---"}
                       </span>
                       <ChevronDown size={18} className={`text-gray-500 transition-transform ${isOwnProductDropdownOpen ? 'rotate-180' : ''}`} />
                     </button>

                     <AnimatePresence>
                       {isOwnProductDropdownOpen && (
                         <>
                           <div className="fixed inset-0 z-[110]" onClick={() => setIsOwnProductDropdownOpen(false)} />
                           <motion.div
                             initial={{ opacity: 0, y: 10, scale: 0.95 }}
                             animate={{ opacity: 1, y: 0, scale: 1 }}
                             exit={{ opacity: 0, y: 10, scale: 0.95 }}
                             className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[120] backdrop-blur-2xl p-1"
                           >
                             <div className="max-h-60 overflow-y-auto custom-scrollbar">
                               <button
                                 type="button"
                                 onClick={() => { setFormData({ ...formData, ownProductVariantId: '' }); setIsOwnProductDropdownOpen(false); }}
                                 className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${!formData.ownProductVariantId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                               >
                                 --- Mahsulot tanlang ---
                               </button>
                               {ownProducts.map(v => (
                                 <button
                                   key={v.id}
                                   type="button"
                                   onClick={() => { setFormData({ ...formData, ownProductVariantId: v.id }); setIsOwnProductDropdownOpen(false); }}
                                   className={`w-full text-left px-5 py-3 rounded-xl text-sm font-bold transition-all ${formData.ownProductVariantId === v.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                 >
                                   {v.displayName}
                                 </button>
                               ))}
                             </div>
                           </motion.div>
                         </>
                       )}
                     </AnimatePresence>
                   </div>
                  </div>
                </div>

                <div className="p-8 bg-blue-600/5 rounded-[2.5rem] border border-blue-500/10 space-y-6">
                   <p className="text-xs font-black text-blue-400 uppercase tracking-widest text-center">Hamkor mahsulot ma'lumotlari</p>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mahsulot nomi (Hamkorda)</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Yuk qabulidagi nom: A-001 — Qora (Qora)"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-blue-500/50"
                        value={formData.partnerProductName}
                        onChange={(e) => setFormData({...formData, partnerProductName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                        SKU / Artikul (Hamkorda)
                      </label>
                      <input
                        type="text"
                        placeholder="Masalan: M-524"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:outline-none focus:border-blue-500/50"
                        value={formData.partnerProductSku}
                        onChange={(e) => setFormData({ ...formData, partnerProductSku: e.target.value })}
                      />
                      {formData.partnerInternalId && (
                        <p className="text-[10px] text-gray-500 leading-relaxed px-1">
                          Ichki kalit (avtomatik, o‘zgartirilmaydi):{' '}
                          <span className="font-mono text-gray-400">
                            {formData.partnerInternalId.slice(0, 8)}…
                          </span>
                          . Yuk qabulida sotuvchi variant ID si saqlanadi — artikul
                          yuqoridagi maydonda.
                        </p>
                      )}
                    </div>
                   </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="flex-1 py-5 bg-white/5 text-gray-400 font-black rounded-2xl hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3 shadow-[0_15px_30px_rgba(37,99,235,0.3)] disabled:opacity-50"
                  >
                    {saving ? 'Saqlanmoqda...' : editingId ? 'Yangilash' : 'Saqlash'}
                    {!saving && <ArrowRight size={20} />}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ModuleGate>
  );
}
