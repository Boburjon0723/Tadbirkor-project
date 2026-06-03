'use client';

import React from 'react';
import { InteractiveDemo } from '@/components/InteractiveDemo';
import { Navbar } from '@/components/Navbar';
import { motion } from 'framer-motion';
import { Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 mt-10">
        <div className="max-w-7xl w-full">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <Link href="/" className="text-gray-500 hover:text-white flex items-center gap-2 text-sm transition-colors mb-4 w-fit">
                <ArrowLeft size={16} />
                Landing sahifasiga qaytish
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Zap size={24} className="fill-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">Interaktiv Demo</h1>
              </div>
              <p className="text-gray-500 max-w-2xl">
                Hech narsa o‘rnatmasdan, Axis ERP’da ikki kompaniya o‘rtasidagi oldi-berdi jarayonini interaktiv tarzda sinab ko‘ring.
              </p>
            </div>
            
            <div className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-500 uppercase tracking-widest h-fit">
               2 daqiqalik B2B demosi
            </div>
          </div>

          <InteractiveDemo />
          
          <div className="mt-12 p-8 bg-blue-600/5 border border-blue-500/10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold">Xuddi shu jarayonni o'z biznesingizda sinab ko'ring</h3>
              <p className="text-gray-500 text-sm">30 kunlik bepul sinov muddati. Karta talab qilinmaydi.</p>
            </div>
            <Link 
              href="/onboarding"
              className="px-10 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              30 kun bepul boshlash
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-white/5 text-center text-gray-600 text-sm">
        © 2024 Axis ERP. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
