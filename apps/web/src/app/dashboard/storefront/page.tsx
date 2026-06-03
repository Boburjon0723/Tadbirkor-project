'use client';

import Link from 'next/link';
import { ArrowLeft, Store } from 'lucide-react';

export default function StorefrontModulePage() {
  return (
    <div className="max-w-3xl mx-auto p-8 md:p-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white mb-10"
      >
        <ArrowLeft size={18} /> Asosiy
      </Link>
      <div className="w-16 h-16 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mb-6">
        <Store size={32} />
      </div>
      <h1 className="text-3xl font-black text-white mb-3">Onlayn do‘kon</h1>
      <p className="text-gray-400 font-medium leading-relaxed">
        Veb-vitrina va buyurtmalar sinxroni hozircha ishlab chiqilmoqda. Modulni Sozlamalar → Modullardan
        yoqib qo‘yishingiz mumkin; funksiyalar paydo bo‘lishi bilan shu yerda ko‘rinadi.
      </p>
    </div>
  );
}
