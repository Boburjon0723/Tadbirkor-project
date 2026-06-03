'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Scale, FileText, CheckCircle, CreditCard, ShieldAlert, Zap, Globe, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function TermsOfUse() {
  const sections = [
    {
      icon: <Globe className="text-blue-500" size={24} />,
      title: "1. Xizmat Turi va Foydalanish Ruxsati",
      desc: "Axis ERP - bu tadbirkorlik faoliyatini boshqarish uchun dasturiy ta'minot (SaaS):",
      bullets: [
        "Foydalanuvchilar o'z bizneslari ehtiyojlariga qarab kerakli ERP modullarini sozlashlari va foydalanishlari mumkin.",
        "Sizga platformadan tadbirkorlik va ichki tijorat maqsadlarida foydalanish uchun cheklangan, litsenziyasiz va shaxsiy ruxsat beriladi.",
        "Tizim kodlarini nusxalash, qayta sotish, o'zgartirish yoki unga zarar yetkazuvchi harakatlarni amalga oshirish qat'iyan taqiqlanadi."
      ]
    },
    {
      icon: <Scale className="text-purple-500" size={24} />,
      title: "2. Foydalanuvchining Majburiyatlari",
      desc: "Platformadan foydalanishda siz quyidagilarga to'liq mas'ulsiz:",
      bullets: [
        "Hisob qaydnomangiz ma'lumotlari (login va parol) xavfsizligini saqlash va uchinchi shaxslarga bermaslik.",
        "Tizimga faqat haqiqiy va qonuniy ma'lumotlarni kiritish (tovarlar nomi, ombor qoldiqlari, haqiqiy B2B shartnomalari).",
        "Kompaniya xodimlariga rollar (Owner, Manager, Warehouse, Accountant, Sales) berishda ularning vakolatlarini to'g'ri taqsimlash.",
        "Platformadan har qanday noqonuniy savdo operatsiyalari yoki qonunga xilof harakatlar uchun foydalanmaslik."
      ]
    },
    {
      icon: <CreditCard className="text-emerald-500" size={24} />,
      title: "3. Tariflar, Sinov Muddati va To'lovlar",
      desc: "Tizimdan foydalanish obuna asosida amalga oshiriladi:",
      bullets: [
        "Har bir yangi kompaniya uchun 7 kunlik bepul sinov muddati (Trial period) beriladi. Sinov muddatida hech qanday bank kartasi talab qilinmaydi.",
        "Sinov muddati yakunlangach, xizmatlardan to'liq foydalanishni davom ettirish uchun Professional ($20/oy) yoki maxsus Enterprise tarifiga obuna bo'lishingiz kerak.",
        "To'lovlarni o'z vaqtida amalga oshirmaslik hisob faoliyatini vaqtinchalik cheklanishiga olib kelishi mumkin. Ma'lumotlaringiz obuna to'xtatilganidan so'ng 90 kun davomida xavfsiz saqlanadi."
      ]
    },
    {
      icon: <ShieldAlert className="text-amber-500" size={24} />,
      title: "4. Javobgarlik Chegaralari",
      desc: "Axis ERP ma'lumotlar to'g'riligi va biznes natijalari uchun javobgarlikni cheklaydi:",
      bullets: [
        "Tizim kiritilgan ma'lumotlar (ombor qoldiqlari, narxlar, qarz yozuvlari) asosida hisob-kitob qiladi. Ma'lumotlarning xatoligi sababli kelib chiqqan moddiy yo'qotishlarga tizim mas'ul emas.",
        "Tizim internet provayderlar xatoligi, serverlarga qilinadigan kiberhujumlar yoki boshqa fors-major holatlari sababli vaqtincha ishlamay qolganda yetkazilgan bilvosita zararlar qoplanmaydi.",
        "Biz tizimning uzluksiz va 99.9% darajada barqaror ishlashini ta'minlash uchun barcha texnik choralarni ko'rishni o'z zimmamizga olamiz."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[40%] left-[-10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
        {/* Navigation / Back button */}
        <div className="mb-12">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Bosh sahifaga qaytish
          </Link>
        </div>

        {/* Header */}
        <div className="mb-16 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full text-xs font-bold tracking-wider text-blue-400 mb-6">
            <Scale size={14} className="fill-blue-400/20" />
            HUQUQIY SHARTNOMA
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
            Foydalanish Shartlari
          </h1>
          <p className="text-gray-400 text-lg">
            Axis ERP platformasidan foydalanishni boshlash orqali siz ushbu shartnoma shartlariga to'liq rozilik bildirasiz. Iltimos, xizmatimizdan foydalanishdan avval shartlarni diqqat bilan o'qib chiqing.
          </p>
          <div className="mt-4 text-xs text-gray-500 font-medium">
            Oxirgi yangilanish: 2026-yil 25-may
          </div>
        </div>

        {/* Highlighted Note */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white/[0.02] border border-white/10 rounded-3xl mb-12 flex gap-4 items-start"
        >
          <div className="w-10 h-10 shrink-0 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
            <Scale size={20} />
          </div>
          <div>
            <h4 className="font-bold mb-1">Qabul qilish sharti</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Ushbu platformada ro'yxatdan o'tgan yoki undan foydalangan har qanday yuridik yoki jismoniy shaxs ushbu shartlarni so'zsiz qabul qilgan hisoblanadi. Agar siz shartlarga rozi bo'lmasangiz, platformadan foydalanmasligingiz so'raladi.
            </p>
          </div>
        </motion.div>

        {/* Detailed Sections */}
        <div className="space-y-12 mb-16">
          {sections.map((section, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="p-8 bg-white/[0.01] border border-white/5 rounded-[2rem] hover:border-white/10 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  {section.icon}
                </div>
                <h3 className="text-xl font-bold tracking-tight">{section.title}</h3>
              </div>
              
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                {section.desc}
              </p>

              <ul className="space-y-4">
                {section.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex gap-3 text-sm text-gray-300 leading-relaxed">
                    <CheckCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Ending statement */}
        <div className="border-t border-white/10 pt-10 text-center">
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Foydalanish shartlariga oid qo'shimcha so'rovlar yoki yuridik savollar uchun biz bilan bog'lanishingiz mumkin.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-support-widget'))}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all cursor-pointer text-white"
          >
            <MessageSquare size={16} />
            support@axiserp.uz
          </button>
        </div>
      </div>
    </div>
  );
}
