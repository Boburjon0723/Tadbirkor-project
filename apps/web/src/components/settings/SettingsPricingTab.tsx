'use client';

import { Check } from 'lucide-react';

type Props = {
  isTrialActive: boolean;
};

export function SettingsPricingTab({ isTrialActive }: Props) {
  const plans = [
    {
      key: 'free',
      name: 'Free',
      price: '0$ / oy',
      desc: 'Yangi bizneslar uchun',
      features: ['1 kompaniya', 'Asosiy ombor', '7 kunlik bepul sinov'],
    },
    {
      key: 'standard',
      name: 'Standard',
      price: '19$ / oy',
      desc: 'O‘sib borayotgan jamoalar',
      features: ['B2B va mapping', 'Tasklar', 'Hisobotlar'],
      highlight: true,
    },
    {
      key: 'business',
      name: 'Business',
      price: '20$ / oy',
      desc: 'Kengaytirilgan yechim',
      features: ['Cheksiz xodimlar', 'Full audit', 'Prioritet support'],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {plans.map((p) => (
        <div
          key={p.key}
          className={`p-6 rounded-[2.5rem] border ${p.highlight ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/5 bg-white/[0.01]'}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-black text-lg">{p.name}</h4>
              <p className="text-sm font-bold text-gray-400">{p.price}</p>
            </div>
            {p.key === 'free' && isTrialActive && (
              <span className="text-[8px] font-black px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg">
                JORIY
              </span>
            )}
          </div>
          <ul className="space-y-2 mb-6">
            {p.features.map((f) => (
              <li
                key={f}
                className="text-[10px] font-bold text-gray-300 flex items-center gap-2"
              >
                <Check size={12} className="text-emerald-500" /> {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`w-full py-3 rounded-2xl text-xs font-black transition-all ${p.highlight ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {p.key === 'free' && isTrialActive ? 'Faol Reja' : 'Tanlash'}
          </button>
        </div>
      ))}
    </div>
  );
}
