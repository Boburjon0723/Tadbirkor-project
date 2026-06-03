'use client';

import Link from 'next/link';
import { ArrowLeft, Link2 } from 'lucide-react';

export default function IntegrationsModulePage() {
  return (
    <div className="max-w-3xl mx-auto p-8 md:p-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white mb-10"
      >
        <ArrowLeft size={18} /> Asosiy
      </Link>
      <div className="w-16 h-16 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-6">
        <Link2 size={32} />
      </div>
      <h1 className="text-3xl font-black text-white mb-3">Ulanishlar</h1>
      <p className="text-gray-400 font-medium leading-relaxed">
        Telegram va boshqa tashqi tizimlar bilan aloqa hozir Sozlamalar orqali sozlanadi. Ushbu
        markaziy sahifa tez orada barcha ulanishlarni bir qatordan boshqarish uchun kengayadi.
      </p>
      <Link
        href="/dashboard/settings"
        className="inline-block mt-8 text-sm font-black text-blue-400 hover:text-blue-300"
      >
        Sozlamalarga o‘tish →
      </Link>
    </div>
  );
}
