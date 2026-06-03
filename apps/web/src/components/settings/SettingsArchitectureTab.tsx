'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Zap,
  Package,
  ShoppingCart,
  Truck,
  FileCheck,
  Banknote,
  Workflow,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { api } from '@/lib/api';

export function SettingsArchitectureTab() {
  const [workflowItems, setWorkflowItems] = useState<any[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const data = await api.get('/workflows');
        setWorkflowItems(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error('Workflowlarni yuklashda xato:', error);
      } finally {
        setWorkflowLoading(false);
      }
    };
    loadWorkflows();
  }, []);

  const steps = [
    { icon: Package, label: 'Product', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { icon: WarehouseIcon, label: 'Stock', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: ShoppingCart, label: 'Order', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: Truck, label: 'Dispatch', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: FileCheck, label: 'Receipt', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: Banknote, label: 'Debt', color: 'text-rose-400', bg: 'bg-rose-500/20' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-6 sm:p-12 rounded-[2rem] sm:rounded-[3rem] bg-white/[0.01] border border-white/5 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[800px] relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-rose-500/20 -translate-y-1/2" />
          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center gap-4">
              <div
                className={`w-20 h-20 ${step.bg} rounded-3xl flex items-center justify-center border border-white/5 shadow-2xl backdrop-blur-xl group transition-all hover:scale-110 cursor-pointer`}
              >
                <step.icon className={step.color} size={32} />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${step.color}`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem]">
          <h5 className="font-black mb-4 flex items-center gap-2 text-blue-400">
            <Zap size={18} /> Avtomatizatsiya
          </h5>
          <p className="text-sm text-gray-400 font-bold leading-relaxed">
            Har bir bosqich keyingi bosqich uchun ma&apos;lumotlarni tayyorlab beradi.
            Masalan, <strong>Dispatch</strong> amalga oshirilganda, xaridor omborida avtomatik
            ravishda <strong>Receipt</strong> kutish holatiga o&apos;tadi.
          </p>
        </div>
        <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem]">
          <h5 className="font-black mb-4 flex items-center gap-2 text-rose-400">
            <Banknote size={18} /> Moliyaviy oqim
          </h5>
          <p className="text-sm text-gray-400 font-bold leading-relaxed">
            Qarz (Debt) faqat tovar real qabul qilingandan (Receipt) keyin shakllanadi.
          </p>
        </div>
      </div>

      <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem]">
        <h5 className="font-black mb-4 flex items-center gap-2 text-cyan-400">
          <Workflow size={18} /> Faol Workflow&apos;lar
        </h5>
        {workflowLoading ? (
          <Loader2 className="animate-spin text-cyan-400" size={20} />
        ) : workflowItems.length === 0 ? (
          <p className="text-sm text-gray-500 font-bold">Hozircha workflow konfiguratsiya qilinmagan.</p>
        ) : (
          <div className="space-y-3">
            {workflowItems.map((w: any) => (
              <div key={w.id} className="p-4 rounded-2xl bg-black/20 border border-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black">{w.name}</p>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-lg ${w.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}
                  >
                    {w.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-bold mt-1">Event: {w.eventKey}</p>
                <p className="text-xs text-gray-400 mt-2">Qadamlar soni: {w.steps?.length || 0}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
