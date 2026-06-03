'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';

const plans = [
  {
    name: "Bepul",
    price: "0",
    description: "Kichik tadbirkorlar uchun",
    features: ["7 kunlik bepul sinov", "1 ta kompaniya", "3 ta foydalanuvchi", "Asosiy modullar"],
    button: "Boshlash",
    highlight: false
  },
  {
    name: "Professional",
    price: "20",
    description: "O'rta biznes uchun",
    features: ["Barcha modullar", "Cheksiz foydalanuvchi", "Priority Support", "B2B integratsiya", "Excel Export"],
    button: "Tanlash",
    highlight: true
  },
  {
    name: "Enterprise",
    price: "Aniqmas",
    description: "Katta tashkilotlar uchun",
    features: ["Maxsus modullar", "Shaxsiy menejer", "SLA kafolati", "API ruxsati"],
    button: "Bog'lanish",
    highlight: false
  }
];

import { useTranslation } from '@/context/LanguageContext';

export const Pricing = () => {
  const { t } = useTranslation();

  return (
    <section id="tariflar" className="py-24 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{t.pricing.title}</h2>
          <p className="text-gray-400">{t.pricing.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {t.pricing.plans.map((plan: any, idx: number) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className={`relative p-8 rounded-[2.5rem] border ${
                idx === 1 
                  ? 'bg-white/5 border-blue-500/50 shadow-2xl shadow-blue-500/10' 
                  : 'bg-transparent border-white/5'
              }`}
            >
              {idx === 1 && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest text-white">
                  {t.pricing.popular}
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.description}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">${plan.price}</span>
                {idx < 2 && <span className="text-gray-500 text-sm">{t.pricing.per_month}</span>}
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check className="w-5 h-5 text-blue-500" />
                    {feature}
                  </div>
                ))}
              </div>

              <button className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-95 ${
                idx === 1 
                  ? 'bg-blue-600 text-white hover:bg-blue-500' 
                  : 'glass text-white hover:bg-white/10'
              }`}>
                {idx === 0 ? t.pricing.start : (idx === 1 ? t.pricing.select : t.pricing.contact)}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
