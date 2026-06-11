'use client';

import React from 'react';
import { X, BookOpen } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const SECTIONS = [
  {
    title: 'Bu hisobot nima?',
    body: 'Tanlangan sana va ombor bo‘yicha kirim, sotuv, yalpi foyda va joriy ombor qiymatini ko‘rsatadi. UZS va USD alohida hisoblanadi.',
  },
  {
    title: 'Kirim summasi',
    body: 'Davrda omborga kirgan mahsulotlar qiymati: hamkor qabuli, ombor kirimi, boshlang‘ich qoldiq, ijobiy tuzatishlar. Narx — kirim narxi; bo‘sh bo‘lsa sotuv narxi (taxminiy).',
  },
  {
    title: 'Sotuv summasi',
    body: 'Haqiqiy daromad: POS chekdagi qator summasi (chegirma bilan), B2B jo‘natmada buyurtma narxi. Bekor qilingan cheklar kirmaydi. Bu kassa yig‘indisi bilan yaqin bo‘lishi kerak.',
  },
  {
    title: 'Yalpi foyda',
    body: 'Sotuv − tannarx (COGS). Tannarx = sotilgan miqdor × kirim narxi. Kirim narxi kiritilmagan mahsulot tannarxga 0 deb olinadi. Ichki xarajatlar (xodim, ijara va hokazo) bu yerga kirmaydi — ular «Oy moliyasi» bo‘limida.',
  },
  {
    title: 'Ombor qiymati (hozir)',
    body: 'Hozirgi qoldiq × kirim narxi (bo‘sh bo‘lsa sotuv narxi). Bu «hozir omborda qancha pul turibdi» degan savolga javob.',
  },
  {
    title: 'Grafik va top mahsulotlar',
    body: 'Kunlik dinamika — sana bo‘yicha kirim, sotuv va foyda. Top mahsulotlar — davrda eng ko‘p sotilganlar (haqiqiy daromad bo‘yicha).',
  },
];

const TIPS = [
  'Aniq foyda uchun katalogda har bir mahsulotga kirim narxini (purchasePrice) kiriting.',
  'Faqat kassa hisoboti kerak bo‘lsa — «Oy moliyasi» yoki POS hisobotiga qarang.',
  'Katta davr sekin yuklanishi mumkin — sanani qisqartiring yoki bitta ombor tanlang.',
  'Excel eksport — joriy filtr bo‘yicha yuklab olish uchun.',
];

export function ReportsGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[min(90vh,720px)] flex flex-col rounded-3xl bg-[#0f1117] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-guide-title"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h2 id="reports-guide-title" className="text-lg font-black text-white">
                Savdo hisoboti — qisqa qo‘llanma
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">2 daqiqada tushunish</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            aria-label="Yopish"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {SECTIONS.map((s) => (
            <div key={s.title} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
              <h3 className="text-sm font-black text-white mb-1.5">{s.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{s.body}</p>
            </div>
          ))}

          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4">
            <h3 className="text-sm font-black text-amber-200 mb-2">Eslatma</h3>
            <ul className="space-y-2">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2 text-xs text-gray-400 leading-relaxed">
                  <span className="text-amber-400 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-5 border-t border-white/5 shrink-0">
          <button type="button" onClick={onClose} className="btn-dash-primary w-full">
            Tushundim
          </button>
        </div>
      </div>
    </div>
  );
}
