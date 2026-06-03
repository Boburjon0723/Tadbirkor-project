'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  BarChart3, 
  ShieldCheck, 
  ArrowRight,
  Package,
  ShoppingCart,
  Users,
  Building2,
  FileText,
  Wallet,
  Settings,
  HelpCircle,
  AlertCircle,
  Check
} from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { Navbar } from '@/components/Navbar';
import { AuthModal } from '@/components/AuthModal';
import Image from 'next/image';
import Link from 'next/link';
import { InteractiveDemo } from '@/components/InteractiveDemo';

export default function LandingPage() {
  const { t } = useTranslation();
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenAuth = () => setIsAuthModalOpen(true);
    window.addEventListener('open-auth-modal', handleOpenAuth);
    return () => window.removeEventListener('open-auth-modal', handleOpenAuth);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      <Navbar />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-wider text-blue-400 mb-8"
          >
            <Zap size={14} className="fill-blue-400" />
            {t.hero.badge}
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold leading-[1.1] mb-8 tracking-tight"
          >
            {t.hero.title_part1} <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-300% animate-gradient">
              {t.hero.title_gradient}
            </span> {t.hero.title_part2}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="px-10 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2 group shadow-xl shadow-white/5"
            >
              {t.hero.cta_primary}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <Link href="/demo" className="px-10 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2">
              <Play size={18} fill="currentColor" />
              {t.hero.cta_secondary}
            </Link>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-sm text-gray-500"
          >
            {t.hero.footer_note}
          </motion.p>
        </div>

        {/* Dashboard Preview & Status Cards */}
        <div className="max-w-6xl mx-auto px-6 mt-20 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-[#080808] p-4 shadow-2xl"
          >
            <Image 
              src="/dashboard-mockup.png" 
              alt="Axis ERP Dashboard" 
              width={1200}
              height={800}
              className="rounded-3xl opacity-80"
            />
            
            {/* Floating Status Cards */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-12 -left-8 md:-left-16 p-4 glass-card rounded-2xl border border-white/10 flex items-center gap-3 shadow-xl hidden md:flex"
            >
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-500">
                <CheckCircle2 size={18} />
              </div>
              <p className="text-xs font-bold">{t.hero.status_cards.order}</p>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute bottom-20 -right-8 md:-right-16 p-4 glass-card rounded-2xl border border-white/10 flex items-center gap-3 shadow-xl hidden md:flex"
            >
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-500">
                <Package size={18} />
              </div>
              <p className="text-xs font-bold">{t.hero.status_cards.stock}</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-8">
            {t.social_proof.title}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 grayscale opacity-40">
            <span className="text-2xl font-black italic tracking-tighter">SUPPLY.CO</span>
            <span className="text-2xl font-black italic tracking-tighter">WAREHOUSE.PRO</span>
            <span className="text-2xl font-black italic tracking-tighter">GLOBAL.BIZ</span>
            <span className="text-2xl font-black italic tracking-tighter">PARTNER.HUB</span>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 max-w-4xl mx-auto leading-tight">
              {t.problem.title}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t.problem.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.problem.cards.map((card: any, idx: number) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10 }}
                className="p-8 glass-card rounded-[2rem] border border-white/5 hover:border-red-500/20 transition-all group"
              >
                <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 group-hover:bg-red-500 group-hover:text-white transition-all">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold mb-4">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-32 bg-blue-600/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                {t.solution.title}
              </h2>
              <p className="text-gray-400 text-lg mb-12">
                {t.solution.subtitle}
              </p>
              
              <div className="space-y-6">
                {t.solution.cards.map((card: any, idx: number) => (
                  <div key={idx} className="flex gap-4 p-6 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                    <div className="w-10 h-10 shrink-0 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                      <Check size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold mb-1">{card.title}</h4>
                      <p className="text-sm text-gray-500">{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:w-1/2 relative w-full max-w-[320px] sm:max-w-[450px] lg:max-w-none mx-auto">
              <div className="aspect-square glass-card rounded-[2.5rem] sm:rounded-[3rem] border border-white/10 p-6 sm:p-8 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-600/5 blur-[100px] rounded-full" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-full h-full border-2 border-dashed border-white/5 rounded-full absolute"
                />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 scale-90 sm:scale-100">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10">
                      <Package className="text-blue-500 w-5 sm:w-6 h-5 sm:h-6" />
                      <span className="text-[9px] sm:text-[10px] font-black tracking-wider">OMBOR</span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10">
                      <ShoppingCart className="text-purple-500 w-5 sm:w-6 h-5 sm:h-6" />
                      <span className="text-[9px] sm:text-[10px] font-black tracking-wider">SAVDO</span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10">
                      <Wallet className="text-emerald-500 w-5 sm:w-6 h-5 sm:h-6" />
                      <span className="text-[9px] sm:text-[10px] font-black tracking-wider">QARZ</span>
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all hover:bg-white/10">
                      <Users className="text-amber-500 w-5 sm:w-6 h-5 sm:h-6" />
                      <span className="text-[9px] sm:text-[10px] font-black tracking-wider">B2B</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="qanday-ishlaydi" className="py-32">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">{t.howItWorks.title}</h2>
          <p className="text-gray-400 text-lg mb-20 max-w-2xl mx-auto">{t.howItWorks.subtitle}</p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-white/5 -z-10" />
            {t.howItWorks.steps.map((step: any, idx: number) => (
              <div key={idx} className="space-y-6">
                <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center font-black text-xl mx-auto shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="font-bold mb-2">{step.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-32 bg-blue-600/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Dastur qanday ishlashini o‘zingiz sinab ko‘ring</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              2 daqiqalik interaktiv demo orqali buyurtma, ombor va qarz qanday bog‘lanishini ko‘ring.
            </p>
          </div>
          <InteractiveDemo />
        </div>
      </section>

      {/* B2B Difference Section */}
      <section className="py-32 bg-white/[0.01] border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">{t.b2b_diff.title}</h2>
            <p className="text-gray-400 text-lg">{t.b2b_diff.subtitle}</p>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/3 space-y-4">
              {t.b2b_diff.steps.slice(0, 4).map((step: any, i: number) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium">
                  {i+1}. {step}
                </div>
              ))}
            </div>
            <div className="lg:w-1/3 flex flex-col items-center">
              <div className="w-full h-64 border-2 border-dashed border-blue-500/20 rounded-[3rem] relative flex items-center justify-center p-8 text-center">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 rounded-full text-xs font-bold uppercase tracking-widest">
                  Auto-Sync
                </div>
                <p className="text-blue-400 font-bold italic leading-relaxed">
                  {t.b2b_diff.highlight}
                </p>
              </div>
            </div>
            <div className="lg:w-1/3 space-y-4 text-right">
              {t.b2b_diff.steps.slice(4).map((step: any, i: number) => (
                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium">
                  {i+5}. {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modules Grid Section */}
      <section id="imkoniyatlar" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">{t.modules.title}</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t.modules.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {t.modules.items.map((module: any, idx: number) => (
              <div key={idx} className="p-8 glass-card rounded-[2.5rem] border border-white/5 hover:bg-white/5 transition-all group">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {[<Package />, <Settings />, <ShoppingCart />, <FileText />, <Wallet />, <ShieldCheck />][idx]}
                </div>
                <h3 className="text-xl font-bold mb-2">{module.title}</h3>
                <p className="text-gray-500 text-sm">{module.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="tariflar" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">{t.pricing_page.title}</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t.pricing_page.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.pricing_page.plans.map((plan: any, idx: number) => (
              <div 
                key={idx} 
                className={`p-10 rounded-[3rem] border flex flex-col transition-all duration-500 hover:scale-[1.02] ${
                  idx === 1 ? 'bg-blue-600/10 border-blue-500 shadow-2xl shadow-blue-500/10' : 'bg-white/5 border-white/10'
                }`}
              >
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">${plan.price}</span>
                  {idx !== 0 && <span className="text-gray-500 text-sm">/oy</span>}
                </div>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">{plan.desc}</p>
                
                <div className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature: any, fIdx: number) => (
                    <div key={fIdx} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 size={16} className="text-blue-500" />
                      {feature}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className={`w-full py-4 font-bold rounded-2xl transition-all ${
                    idx === 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold mb-12 text-center">{t.faq_section.title}</h2>
          <div className="space-y-6">
            {t.faq_section.items.map((item: any, idx: number) => (
              <div key={idx} className="p-8 glass-card rounded-[2rem] border border-white/5">
                <h4 className="text-lg font-bold mb-3 flex items-start gap-4">
                  <HelpCircle className="w-6 h-6 text-blue-500 shrink-0" />
                  {item.q}
                </h4>
                <p className="text-gray-500 text-sm ml-10 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[150px]" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto bg-[#080808]/80 backdrop-blur-2xl p-16 rounded-[3.5rem] border border-white/10 shadow-2xl">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">{t.final_cta.title}</h2>
            <p className="text-gray-400 text-lg mb-12">{t.final_cta.subtitle}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full sm:w-auto px-12 py-5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all active:scale-95"
              >
                {t.final_cta.cta1}
              </button>
              <Link href="/demo" className="w-full sm:w-auto px-12 py-5 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all text-center">
                {t.final_cta.cta2}
              </Link>
            </div>
            <p className="mt-8 text-sm text-gray-500">{t.final_cta.note}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Zap size={22} className="text-white fill-white" />
                </div>
                <span className="text-2xl font-bold">Axis ERP</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                {t.footer.desc}
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 italic">Menu</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">Imkoniyatlar</a></li>
                <li><a href="#qanday-ishlaydi" className="hover:text-white transition-colors">Qanday ishlaydi</a></li>
                <li><a href="#tariflar" className="hover:text-white transition-colors">Tariflar</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal'))} 
                    className="hover:text-white transition-colors text-left"
                  >
                    Kirish
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 italic">Mahsulot</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">Mahsulotlar</a></li>
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">Ombor</a></li>
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">B2B buyurtmalar</a></li>
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">Qarz daftari</a></li>
                <li><a href="#imkoniyatlar" className="hover:text-white transition-colors">Rollar</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 italic">Aloqa</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li>
                  <a 
                    href="https://t.me/Boburjon3601" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="hover:text-white transition-colors"
                  >
                    Telegram: @Boburjon3601
                  </a>
                </li>
                <li>
                  <a 
                    href="mailto:safarovbobur2004@icloud.com" 
                    className="hover:text-white transition-colors"
                  >
                    Email: safarovbobur2004@icloud.com
                  </a>
                </li>
                <li>
                  <a 
                    href="tel:+998950203601" 
                    className="hover:text-white transition-colors"
                  >
                    Tel: +998950203601
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-sm text-gray-500">
            <p>{t.footer.rights}</p>
            <div className="flex gap-8 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-white transition-colors">Maxfiylik siyosati</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Foydalanish shartlari</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
