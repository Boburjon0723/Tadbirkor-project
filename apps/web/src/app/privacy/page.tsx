'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Eye, Lock, FileText, CheckCircle, Database, RefreshCw, Scale } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  const sections = [
    {
      icon: <Database className="text-blue-500" size={24} />,
      title: "1. Yig'iladigan Ma'lumotlar",
      desc: "Axis ERP xizmatlaridan foydalanganingizda, biz quyidagi ma'lumotlarni yig'amiz:",
      bullets: [
        "Shaxsiy ma'lumotlar: Ism-familiya, telefon raqam, elektron pochta manzili va login ma'lumotlari.",
        "Kompaniya ma'lumotlari: Kompaniya nomi, STIR (INN), faoliyat turi, manzil va aloqa ma'lumotlari.",
        "Biznes ma'lumotlari: Tizimga yuklangan mahsulotlar ro'yxati, ombor qoldiqlari, B2B buyurtmalar, hisob-fakturalar (invoice) va qarz daftari yozuvlari.",
        "Texnik ma'lumotlar: IP-manzil, brauzer turi, kirish vaqti va tizimdan foydalanish faolliklari jurnali (Audit logs)."
      ]
    },
    {
      icon: <RefreshCw className="text-purple-500" size={24} />,
      title: "2. Ma'lumotlardan Foydalanish Maqsadi",
      desc: "Sizning biznes va shaxsiy ma'lumotlaringiz faqat quyidagi maqsadlarda ishlatiladi:",
      bullets: [
        "ERP tizimi modullarini (ombor, kassa, B2B order, moliya) sizning faoliyatingizga moslashtirish va onboarding jarayonini sozlash.",
        "Hamkorlar o'rtasida B2B zanjirini sinxronizatsiya qilish hamda mahsulot nomlarini o'zaro moslashtirish (Product Mapping).",
        "Xavfsizlikni ta'minlash, firgarlikni oldini olish va tizimdagi harakatlar jurnalini (audit logs) yuritish.",
        "Mijozlarni qo'llab-quvvatlash xizmati orqali texnik yordam ko'rsatish va tizim yangilanishlari haqida xabardor qilish."
      ]
    },
    {
      icon: <Lock className="text-emerald-500" size={24} />,
      title: "3. Ma'lumotlar Xavfsizligi va Himoyasi",
      desc: "Biz ma'lumotlaringiz xavfsizligini ta'minlash uchun eng zamonaviy texnologiyalardan foydalanamiz:",
      bullets: [
        "Barcha ma'lumotlar uzatilishi va saqlanishi SSL/TLS protokollari yordamida to'liq shifrlanadi (Encryption).",
        "Foydalanuvchilar parollari ma'lumotlar bazasida shifrlangan (hashed) holda saqlanadi va ularga tizim xodimlarining kirish ruxsati mavjud emas.",
        "Biz ma'lumotlaringizni uchinchi shaxslarga sotmaymiz va ularni tijoriy maqsadlarda tarqatmaymiz.",
        "B2B operatsiyalarida ma'lumotlar faqat siz tasdiqlagan va ruxsat bergan hamkor kompaniyalargagina sinxron ko'rsatiladi."
      ]
    },
    {
      icon: <Eye className="text-amber-500" size={24} />,
      title: "4. Foydalanuvchilar Huquqlari",
      desc: "Siz o'z ma'lumotlaringiz ustidan to'liq nazoratga egasiz:",
      bullets: [
        "O'z profilingiz va kompaniyangiz ma'lumotlarini istalgan vaqtda tahrirlash yoki yangilash.",
        "Tizimga yuklangan tovarlar va ombor qoldiqlarini o'chirish yoki Excel ko'rinishida eksport qilib olish.",
        "Kompaniya a'zolari (xodimlar) va ularning rollarini boshqarish hamda ruxsatlarni cheklash.",
        "Hisobingizni butunlay o'chirishni talab qilish (bunda qonunchilikda saqlanishi shart bo'lgan moliya hujjatlaridan tashqari barcha ma'lumotlar bazadan to'liq o'chiriladi)."
      ]
    },
    {
      icon: <Scale className="text-red-500" size={24} />,
      title: "5. Davlat Organlariga Ma'lumotlarni Taqdim Etish Tartibi",
      desc: "Tadbirkorlarning moliyaviy, ombor va tijorat ma'lumotlari qonuniy ravishda himoyalangan va davlat idoralariga norasmiy yoki shunchaki og'zaki so'rovlar asosida mutlaqo berilmaydi. Ma'lumotlar faqat quyidagi qat'iy va qonuniy shartlar asosida taqdim etilishi mumkin:",
      bullets: [
        "Sud qarori: O'zbekiston Respublikasi Jinoyat-protsessual qonunchiligiga muvofiq, sudya tomonidan imzolangan va tegishli muhr bilan tasdiqlangan rasmiy sud ajrimi yoki qarori taqdim etilganda.",
        "Rasmiy yozma so'rov: Huquqni muhofaza qiluvchi organlar (Prokuratura, IIB, DXX) yoki Soliq organlari tomonidan qo'zg'atilgan rasmiy ma'muriy yoki jinoyat ishi raqami ko'rsatilgan, rasmiy xat blankida yozilgan va muhrlangan yozma so'rov mavjud bo'lganda.",
        "Minimal ma'lumot tamoyili: Har qanday qonuniy so'rovda faqat so'ralgan eng cheklangan va minimal hajmdagi ma'lumotlar taqdim etiladi. Tizimdagi boshqa tadbirkorlar yoki so'rovga daxldor bo'lmagan ma'lumotlar yopiqligicha qoladi.",
        "Tadbirkorni xabardor qilish: Agar qonunchilik yoki sud qarori taqiqlamasa (masalan, davlat xavfsizligiga oid maxfiy surishtiruvlar), platforma ma'muriyati uning ma'lumotlari so'ralganligi haqida tadbirkorni darhol xabardor qiladi."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[40%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 rounded-full blur-[140px]" />
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
            <Shield size={14} className="fill-blue-400/20" />
            MAXFIYLIK KAFOLATI
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
            Maxfiylik Siyosati
          </h1>
          <p className="text-gray-400 text-lg">
            Axis ERP platformasida ma'lumotlaringiz himoyasi va shaffoflik biz uchun eng oliy qadriyatdir. Ushbu hujjat orqali ma'lumotlaringiz qanday saqlanishi va qayta ishlanishi haqida batafsil ma'lumot olasiz.
          </p>
          <div className="mt-4 text-xs text-gray-500 font-medium">
            Oxirgi yangilanish: 2026-yil 25-may
          </div>
        </div>

        {/* Important Warning Alert Box */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white/[0.02] border border-white/10 rounded-3xl mb-12 flex gap-4 items-start"
        >
          <div className="w-10 h-10 shrink-0 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
            <Shield size={20} />
          </div>
          <div>
            <h4 className="font-bold mb-1">Muhim kafolat</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Biz sizning omboringizdagi tovarlar qoldiqlari, xaridorlaringiz ro'yxati, savdo aylanmalari va qarz daftaringizdagi moliyaviy ma'lumotlaringizni 100% sir saqlashni kafolatlaymiz. Ushbu ma'lumotlar faqat sizning kompaniyangizga xizmat ko'rsatish uchungina ishlatiladi.
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
            Maxfiylik siyosatiga oid har qanday savol yoki takliflaringiz bo'lsa, biz bilan bog'lanishingiz mumkin.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-support-widget'))}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all cursor-pointer text-white"
          >
            <FileText size={16} />
            support@axiserp.uz
          </button>
        </div>
      </div>
    </div>
  );
}
