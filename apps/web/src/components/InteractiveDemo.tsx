'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ShoppingCart, 
  Package, 
  Wallet, 
  CheckCircle2, 
  Zap, 
  Bell, 
  Layers, 
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Truck,
  FileText,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type DemoStep = 
  | 'intro' 
  | 'order_create' 
  | 'order_received' 
  | 'product_mapping' 
  | 'tasks_created' 
  | 'dispatch' 
  | 'goods_receipt' 
  | 'debt_created' 
  | 'payment_confirmed' 
  | 'summary';

const demoData = {
  buyer: { name: "Baraka Market", stockBefore: 30, stockAfter: 130 },
  seller: { name: "Azizbek Savdo", stockBefore: 240, stockAfter: 140 },
  product: { name: "Shakar 50kg", sellerName: "Shakar qop 50kg", qty: 100, price: 100000, total: 10000000 },
};

export const InteractiveDemo = () => {
  const [step, setStep] = useState<DemoStep>('intro');
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [liveData, setLiveData] = useState({
    orderStatus: 'Draft',
    sellerStock: 240,
    buyerStock: 30,
    debt: 0,
    debtStatus: 'Qarz yo‘q'
  });
  const router = useRouter();

  const addEvent = (event: string) => {
    setEvents(prev => [event, ...prev.slice(0, 7)]);
  };

  const stepsConfig: any = {
    intro: {
      title: "B2B oldi-berdi jarayonini ko'ramiz",
      story: "Baraka Market Azizbek Savdo’dan 100 dona Shakar 50kg buyurtma qiladi. Tizim bu jarayonda buyurtma, ombor va qarzni avtomatik bog‘laydi.",
      btn: "Demoni boshlash",
      next: 'order_create'
    },
    order_create: {
      title: "1. Xaridor buyurtma yaratadi",
      story: "Baraka Market hamkoriga mahsulot, miqdor va narx ko'rsatilgan buyurtmani yuboradi.",
      btn: "Buyurtma yuborish",
      next: 'order_received',
      onEnter: () => {
        addEvent('order.sent');
        addEvent('notification.created');
        setLiveData(prev => ({ ...prev, orderStatus: 'Yuborildi' }));
      }
    },
    order_received: {
      title: "2. Sotuvchi buyurtmani qabul qiladi",
      story: "Azizbek Savdo tizimida yangi buyurtma paydo bo'ladi va u qabul qilinadi.",
      btn: "Qabul qilish",
      next: 'product_mapping',
      onEnter: () => {
        addEvent('order.accepted');
        setLiveData(prev => ({ ...prev, orderStatus: 'Qabul qilindi' }));
      }
    },
    product_mapping: {
      title: "3. Mahsulot moslashtirildi",
      story: "Har kompaniyada nom har xil bo'lishi mumkin. Tizim 'Shakar 50kg'ni sizdagi 'Shakar qop 50kg'ga bog'laydi.",
      btn: "Mappingni saqlash",
      next: 'tasks_created',
      onEnter: () => {
        addEvent('product_mapping.created');
      }
    },
    tasks_created: {
      title: "4. Ichki vazifalar yaratiladi",
      story: "Tizim avtomatik ravishda Omborchi, Buxgalter va Menejer uchun vazifalar yaratadi.",
      btn: "Jo‘natmaga o‘tish",
      next: 'dispatch',
      onEnter: () => {
        addEvent('task.created');
        addEvent('notification.sent');
      }
    },
    dispatch: {
      title: "5. Sotuvchi tovar jo'natadi",
      story: "Sotuvchi omboridan 100 dona mahsulot chiqim qilinadi.",
      btn: "Tovarni jo'natish",
      next: 'goods_receipt',
      onEnter: () => {
        addEvent('dispatch.sent');
        addEvent('stock.out');
        setLiveData(prev => ({ ...prev, sellerStock: 140, orderStatus: 'Jo‘natildi' }));
      }
    },
    goods_receipt: {
      title: "6. Xaridor tovarni qabul qiladi",
      story: "Xaridor omboriga 100 dona mahsulot kirim qilinadi.",
      btn: "To'liq qabul qilish",
      next: 'debt_created',
      onEnter: () => {
        addEvent('goods_receipt.accepted');
        addEvent('stock.in');
        setLiveData(prev => ({ ...prev, buyerStock: 130, orderStatus: 'Qabul qilindi' }));
      }
    },
    debt_created: {
      title: "7. Qarz avtomatik yaratildi",
      story: "Tovar qabul qilingandan keyin tizim 10 000 000 so'm qarz yozuvini yaratadi.",
      btn: "Qarzni ko'rish",
      next: 'payment_confirmed',
      onEnter: () => {
        addEvent('debt.created');
        setLiveData(prev => ({ ...prev, debt: 10000000, debtStatus: 'Ochiq qarz' }));
      }
    },
    payment_confirmed: {
      title: "8. To'lov tasdiqlandi",
      story: "Real hayotda to'lov qilingach, tizimda belgilandi va qarz yopildi.",
      btn: "Qarzni yopish",
      next: 'summary',
      onEnter: () => {
        addEvent('payment.confirmed');
        addEvent('debt.closed');
        setLiveData(prev => ({ ...prev, debtStatus: 'Yopilgan' }));
      }
    },
    summary: {
      title: "Jarayon muvaffaqiyatli yakunlandi",
      story: "Buyurtma, ombor va qarz bir oqimda avtomatik bog'landi. Endi o'z biznesingizda sinab ko'ring!",
      btn: "30 kun bepul boshlash",
      next: 'register'
    }
  };

  const handleNext = () => {
    const nextStep = stepsConfig[step].next;
    if (nextStep === 'register') {
      router.push('/onboarding');
      return;
    }
    
    if (stepsConfig[nextStep]?.onEnter) {
      stepsConfig[nextStep].onEnter();
    }
    setStep(nextStep);
    setProgress(prev => prev + 1);
  };

  return (
    <div className="w-full bg-[#080808] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[600px]">
      {/* Left - Story Panel */}
      <div className="w-full md:w-1/4 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between bg-blue-600/5">
        <div>
          <div className="flex gap-1.5 mb-8">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= progress ? 'bg-blue-500' : 'bg-white/10'}`} />
            ))}
          </div>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="text-xl font-bold leading-tight">{stepsConfig[step].title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{stepsConfig[step].story}</p>
          </motion.div>
        </div>
        <button 
          onClick={handleNext}
          className="mt-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95"
        >
          {stepsConfig[step].btn}
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Center - Mock ERP Panel */}
      <div className="flex-1 p-8 bg-[#050505] relative overflow-hidden flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-md"
          >
            {step === 'intro' && (
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center gap-8 mb-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center border border-blue-500/20">
                      <Zap size={32} />
                    </div>
                    <span className="text-xs font-bold text-gray-500">Xaridor</span>
                  </div>
                  <ArrowLeftRight className="text-gray-700" size={24} />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-purple-600/20 text-purple-500 rounded-3xl flex items-center justify-center border border-purple-500/20">
                      <Zap size={32} />
                    </div>
                    <span className="text-xs font-bold text-gray-500">Sotuvchi</span>
                  </div>
                </div>
                <h4 className="font-bold text-lg text-blue-400">B2B oldi-berdi demosi</h4>
                <p className="text-sm text-gray-500 px-8">Baraka Market hamkoridan mahsulot buyurtma qiladi. Axis ERP barchasini bog'laydi.</p>
              </div>
            )}

            {step === 'order_create' && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Yangi buyurtma</h4>
                <div className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500">Hamkor</p>
                    <p className="text-sm font-bold">Azizbek Savdo</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-500">Mahsulot</p>
                    <p className="text-sm font-bold">Shakar 50kg (100 dona)</p>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
                    <p className="text-[10px] text-blue-400">Jami summa</p>
                    <p className="text-sm font-bold text-blue-400">10 000 000 so'm</p>
                  </div>
                </div>
              </div>
            )}

            {step === 'order_received' && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6">
                <div className="flex items-center gap-3">
                  <Bell className="text-blue-500 animate-pulse" size={20} />
                  <h4 className="text-sm font-bold">Yangi xabar</h4>
                </div>
                <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                  <p className="text-xs text-blue-400 mb-1">Baraka Market’dan buyurtma keldi</p>
                  <p className="font-bold">Shakar 50kg — 100 dona</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 py-3 bg-white/5 rounded-xl text-center text-xs font-bold text-gray-500">Rad etish</div>
                  <div className="flex-1 py-3 bg-blue-600 rounded-xl text-center text-xs font-bold text-white">Qabul qilish</div>
                </div>
              </div>
            )}

            {step === 'product_mapping' && (
              <div className="p-6 bg-white/5 border border-amber-500/30 rounded-3xl space-y-4">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <AlertCircle size={18} />
                  <h4 className="text-xs font-bold uppercase tracking-widest">Mapping kerak</h4>
                </div>
                <p className="text-[10px] text-gray-500">Hamkordagi mahsulot:</p>
                <div className="p-3 bg-white/5 rounded-xl text-sm font-bold">Shakar 50kg</div>
                <p className="text-[10px] text-gray-500">Sizdagi mahsulotni tanlang:</p>
                <div className="p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl text-sm font-bold flex justify-between items-center">
                   Shakar qop 50kg
                   <CheckCircle2 size={16} className="text-blue-500" />
                </div>
              </div>
            )}

            {step === 'tasks_created' && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Vazifalar yaratildi</h4>
                {[
                  { role: 'Omborchi', task: '100 dona Shakar tayyorlash' },
                  { role: 'Buxgalter', task: 'Invoice yaratish' },
                  { role: 'Menejer', task: 'Buyurtmani tasdiqlash' }
                ].map((t, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.2 }}
                    key={i} 
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4"
                  >
                    <div className="w-8 h-8 bg-blue-600/10 text-blue-500 rounded-lg flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">{t.role}</p>
                      <p className="text-xs font-bold">{t.task}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {step === 'dispatch' && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6 text-center">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck size={32} />
                </div>
                <div>
                   <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Azizbek Savdo Ombodi</p>
                   <p className="text-lg font-bold">240 → 140 dona</p>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <motion.div initial={{width: '100%'}} animate={{width: '60%'}} className="h-full bg-blue-600" />
                </div>
                <p className="text-xs text-gray-500">Sotuvchi omboridan chiqim qilindi</p>
              </div>
            )}

            {step === 'goods_receipt' && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package size={32} />
                </div>
                <div>
                   <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Baraka Market Ombori</p>
                   <p className="text-lg font-bold">30 → 130 dona</p>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <motion.div initial={{width: '30%'}} animate={{width: '100%'}} className="h-full bg-emerald-500" />
                </div>
                <p className="text-xs text-gray-500">Xaridor omboriga kirim qilindi</p>
              </div>
            )}

            {step === 'debt_created' && (
              <div className="p-8 bg-[#080808] border border-amber-500/20 rounded-[2.5rem] text-center shadow-2xl shadow-amber-500/5">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wallet size={32} />
                </div>
                <h4 className="text-lg font-bold mb-2">Yangi qarz yaratildi</h4>
                <p className="text-3xl font-black text-amber-500 mb-6">10,000,000</p>
                <div className="flex justify-between text-[10px] text-gray-500 border-t border-white/5 pt-4">
                   <p>Qarzdor: Baraka Market</p>
                   <p>Haqdor: Azizbek Savdo</p>
                </div>
              </div>
            )}

            {step === 'payment_confirmed' && (
              <div className="p-8 bg-[#080808] border border-emerald-500/20 rounded-[2.5rem] text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="text-lg font-bold mb-2">To'lov tasdiqlandi</h4>
                <p className="text-gray-500 text-sm mb-6">Hamkorlar o'rtasidagi qarz yopildi</p>
                <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-widest mx-auto w-fit">
                   Qarz yopildi
                </div>
              </div>
            )}

            {step === 'summary' && (
              <div className="space-y-4">
                <h4 className="text-xl font-bold text-center mb-8">Bitta jarayon — bir nechta bo‘lim avtomatik yangilandi</h4>
                {[
                  "Buyurtma yuborildi va qabul qilindi",
                  "Mahsulot mapping qilindi",
                  "Ombor qoldiqlari sinxron yangilandi",
                  "Qarz avtomatik hisoblandi",
                  "Xodimlar vazifa olishdi"
                ].map((s, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={i} 
                    className="flex items-center gap-3 text-sm font-medium"
                  >
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    {s}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right - Live Updates Panel */}
      <div className="w-full md:w-1/4 p-8 border-t md:border-t-0 md:border-l border-white/5 bg-[#080808]">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-8">Live Updates</h4>
        
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-500">Buyurtma statusi</p>
            <div className={`text-xs font-bold px-2 py-1 rounded-md w-fit ${
               liveData.orderStatus === 'Draft' ? 'bg-white/5 text-gray-500' : 'bg-blue-600/10 text-blue-500'
            }`}>
              {liveData.orderStatus}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500">Sotuvchi ombori</p>
              <p className="text-sm font-bold">{liveData.sellerStock} dona</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500">Xaridor ombori</p>
              <p className="text-sm font-bold">{liveData.buyerStock} dona</p>
            </div>
          </div>

          <div className="space-y-1 pt-4 border-t border-white/5">
            <p className="text-[10px] text-gray-500">Qarz holati</p>
            <p className="text-sm font-bold text-amber-500">{liveData.debt > 0 ? `${liveData.debt.toLocaleString()} so'm` : '0 so\'m'}</p>
            <p className="text-[10px] text-gray-600">{liveData.debtStatus}</p>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/5">
            <p className="text-[10px] text-gray-500 font-bold uppercase">System Events</p>
            <div className="space-y-2">
              <AnimatePresence>
                {events.map((ev, i) => (
                  <motion.div
                    key={`${ev}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-[10px] font-mono text-gray-500"
                  >
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    <span className="text-blue-400">✓</span> {ev}
                  </motion.div>
                ))}
              </AnimatePresence>
              {events.length === 0 && <p className="text-[10px] text-gray-700 italic">Hozircha harakat yo'q...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
