'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  X, 
  Lock,
  ArrowRight
} from 'lucide-react';

import { AxisLogo } from '@/components/AxisLogo';
import { useTranslation } from '@/context/LanguageContext';
import { Language } from '@/lib/translations';

export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { t, language, setLanguage } = useTranslation();
  
  // Custom event to open auth modal from any component
  const openAuth = () => {
    const event = new CustomEvent('open-auth-modal');
    window.dispatchEvent(event);
  };

  const menuItems = [
    { name: t.nav.features, href: "#imkoniyatlar" },
    { name: t.nav.howItWorks, href: "#qanday-ishlaydi" },
    { name: t.nav.pricing, href: "#tariflar" },
    { name: t.nav.faq, href: "#faq" },
  ];

  return (
    <nav className="fixed top-0 w-full z-[80] glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <AxisLogo size={40} />

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-8">
          {menuItems.map((item) => (
            <a key={item.name} href={item.href} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              {item.name}
            </a>
          ))}
          
          <div className="h-4 w-px bg-white/10 mx-2" />
          
          {/* Language Indicator */}
          <div className="flex items-center bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-[10px] font-bold uppercase text-white">
            UZ
          </div>

          <button 
            onClick={openAuth}
            className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {t.nav.login}
          </button>
        </div>

        {/* Mobile Toggle - Render direct Kirish button */}
        <div className="flex items-center gap-3 md:hidden">
          <div className="flex items-center bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 text-[9px] font-bold uppercase text-white">
            UZ
          </div>
          <button 
            onClick={openAuth}
            className="px-4 py-2 bg-white text-black text-xs font-black rounded-full hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-1.5 shadow-lg"
          >
            <Lock className="w-3.5 h-3.5" />
            {t.nav.login}
          </button>
        </div>
      </div>
    </nav>
  );
};
