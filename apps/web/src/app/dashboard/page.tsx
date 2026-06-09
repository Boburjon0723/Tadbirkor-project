'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Clock, 
  Package, 
  Plus, 
  ArrowRight, 
  TrendingUp, 
  Building2, 
  ShieldCheck, 
  Box,
  ShoppingCart,
  AlertCircle,
  FileText,
  ArrowDownLeft,
  Loader2,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, 
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { useTranslation } from '@/context/LanguageContext';
import { useDashboardStats } from '@/hooks/dashboard/use-dashboard-stats';
import { useCompanyRealtime } from '@/hooks/use-company-realtime';
import { useOrderAnalytics, useStockAnalytics } from '@/hooks/reports/use-analytics';
import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled } from '@/lib/feature-modules';
import { canSeeFinanceKpi } from '@/lib/role-access';

type Role = 'owner' | 'manager' | 'accountant' | 'warehouse' | 'sales';

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [days, setDays] = useState(30);

  const { data: session } = useSession();
  const role = (session?.role || 'owner') as Role;
  const company = session?.me?.company;
  const posModuleOn = session ? isModuleKeyEnabled(session.features, 'POS') : true;

  useCompanyRealtime(true);
  const { data: dashboardData, isLoading: isStatsLoading } = useDashboardStats();
  const { data: orderData, isLoading: isOrdersLoading } = useOrderAnalytics(days);
  const { data: stockData, isLoading: isStockLoading } = useStockAnalytics(days);
  const detectedChartCurrency = orderData?.currency || 'UZS';

  const processedOrderData = React.useMemo(() => {
    return orderData?.data || [];
  }, [orderData]);

  const formatMoney = (v: any, currency?: 'UZS' | 'USD') => {
    if (typeof v === 'object' && v !== null) {
      const parts: string[] = [];
      if (v.USD && v.USD !== 0) parts.push(new Intl.NumberFormat("uz-UZ").format(v.USD) + " USD");
      if (v.UZS && v.UZS !== 0) parts.push(new Intl.NumberFormat("uz-UZ").format(v.UZS) + " so'm");
      if (parts.length === 0) return "0 so'm";
      return parts.join(" · ");
    }
    return new Intl.NumberFormat("uz-UZ").format(v || 0) + (currency === 'USD' ? " USD" : " so'm");
  };

  const receivables = dashboardData?.stats.totalReceivables || { UZS: 0, USD: 0 };
  const payables = dashboardData?.stats.totalPayables || { UZS: 0, USD: 0 };

  const pieData = [
    { name: "Debitorlik (so'm)", value: receivables.UZS || 0, color: '#10b981' },
    { name: 'Debitorlik (USD)', value: receivables.USD || 0, color: '#34d399' },
    { name: "Kreditorlik (so'm)", value: payables.UZS || 0, color: '#ef4444' },
    { name: 'Kreditorlik (USD)', value: payables.USD || 0, color: '#f87171' },
  ].filter((slice) => slice.value > 0);

  if (isStatsLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Analitika yuklanmoqda...</p>
    </div>
  );

  // Check if data is empty for custom premium overlays
  const isOrdersDataEmpty = !processedOrderData || processedOrderData.length === 0 || processedOrderData.every((d: any) => d.volume === 0 && d.count === 0);
  const isPieDataEmpty = pieData.length === 0;
  const isStockDataEmpty = !stockData?.daily || stockData.daily.length === 0 || stockData.daily.every((d: any) => d.in === 0 && d.out === 0);
  const isTopProductsEmpty = !stockData?.topProducts || stockData.topProducts.length === 0;

  // Find max volume of top products for percentage bars
  const maxProductSales = stockData?.topProducts ? Math.max(...stockData.topProducts.map((p: any) => p.value), 1) : 1;

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-4 rounded-2xl border border-white/10 bg-[#0d0d0f]/95 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-purple-500" />
          <p className="text-[10px] font-black text-gray-400 mb-2.5 uppercase tracking-wider">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => {
              const nameMap: any = {
                volume: 'Savdo Hajmi',
                count: 'Buyurtmalar Soni',
                in: 'Kirim',
                out: 'Chiqim'
              };
              const isMoney = entry.name === 'volume';
              const valueFormatted = isMoney 
                ? new Intl.NumberFormat("uz-UZ").format(entry.value) + (detectedChartCurrency === 'USD' ? " USD" : " so'm")
                : entry.name === 'in' || entry.name === 'out'
                  ? entry.value + " ta"
                  : entry.value;

              return (
                <div key={index} className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
                    <span className="text-xs text-gray-300 font-black">{nameMap[entry.name] || entry.name}</span>
                  </div>
                  <span className="text-xs font-black text-white ml-6">
                    {valueFormatted}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="px-3 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={10} className="animate-pulse" /> Rol: {role}
            </span>
            {company && (
              <span className="px-3 py-1 bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={10} /> {company.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-2 tracking-tight">
            Analytics <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Dashboard</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base">Bugungi ko‘rsatkichlar va biznesingiz tahlili.</p>
        </div>

        {/* Laptop & Mobile Screen Optimized Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          {/* Days Switcher */}
          <div className="flex items-center gap-1 bg-white/[0.02] p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl justify-between sm:justify-start sm:w-auto">
            {[7, 30, 90].map(d => (
              <button 
                key={d} 
                onClick={() => setDays(d)}
                className={`relative px-4 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 whitespace-nowrap z-10 ${days === d ? 'text-white' : 'text-gray-500 hover:text-white'}`}
              >
                {days === d && (
                  <motion.div
                    layoutId="active-days-tab"
                    className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-lg shadow-blue-500/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {d} KUN
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid — omborchi/sotuvchi: faqat operatsion (chiqim + qabul) */}
      <div
        className={`grid gap-4 md:gap-6 ${
          canSeeFinanceKpi(role)
            ? 'grid-cols-2 lg:grid-cols-4'
            : role === 'warehouse'
              ? 'grid-cols-2 lg:grid-cols-3 max-w-5xl'
              : 'grid-cols-2 lg:grid-cols-2 max-w-3xl'
        }`}
      >
        <StatCard title="Bugungi chiqim" value={`${dashboardData?.stats.dailyDispatches || 0} ta`} icon={<ArrowUpRight size={20} />} color="blue" trend="Faol" />
        <StatCard title="Kutilayotgan qabul" value={`${dashboardData?.stats.pendingReceipts || 0} ta`} icon={<Clock size={20} />} color="purple" trend="Kutilmoqda" />
        {role === 'warehouse' && (
          <StatCard
            title="Kutilayotgan saralash"
            value={`${dashboardData?.stats.pendingPickTasks || 0} ta`}
            icon={<Package size={20} />}
            color="amber"
            trend="Saralash"
          />
        )}
        {canSeeFinanceKpi(role) && (
          <>
            <StatCard title="Debitorlik" value={formatMoney(dashboardData?.stats.totalReceivables || 0)} icon={<ArrowDownLeft size={20} />} color="emerald" trend="Balans" />
            <StatCard title="Kreditorlik" value={formatMoney(dashboardData?.stats.totalPayables || 0)} icon={<ArrowUpRight size={20} />} color="red" trend="Mulk" />
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 1. Orders Dynamics - Visible to Owner, Manager, Sales */}
        {['owner', 'manager', 'sales'].includes(role) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="lg:col-span-2 rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-6 md:p-10 relative overflow-hidden backdrop-blur-xl"
          >
            {isOrdersLoading && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 flex items-center justify-center rounded-[2.5rem]">
                <Loader2 className="animate-spin text-blue-500" />
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl md:text-2xl font-black">Buyurtmalar Dinamikasi</h3>
                <p className="text-gray-500 text-xs md:text-sm">Oxirgi {days} kunlik buyurtmalar soni va hajmi</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
                  <span className="text-[10px] font-black uppercase text-gray-500">
                    Hajm ({detectedChartCurrency === 'USD' ? 'USD' : 'so\'m'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50" />
                  <span className="text-[10px] font-black uppercase text-gray-500">Soni (ta)</span>
                </div>
              </div>
            </div>

            {/* Custom Empty State Cover */}
            {isOrdersDataEmpty && (
              <div className="absolute inset-0 bg-[#08080a]/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-3xl flex items-center justify-center mb-4">
                  <ShoppingCart size={26} className="animate-pulse" />
                </div>
                <h4 className="text-lg font-black text-white mb-1.5">Buyurtmalar Dinamikasi Bo'sh</h4>
                <p className="text-xs text-gray-500 max-w-sm">Ushbu muddat ichida hali buyurtmalar shakllanmagan. Buyurtmalar kelib tushishi bilan grafikda real vaqt rejimida aks etadi.</p>
              </div>
            )}

            <div className="h-[250px] md:h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={isOrdersDataEmpty ? [
                  { date: '0', volume: 0, count: 0 },
                  { date: '1', volume: 0, count: 0 },
                  { date: '2', volume: 0, count: 0 }
                ] : processedOrderData}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#4b5563" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val && val.includes('-') ? val.split('-').slice(1).join('/') : val} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    stroke="#4b5563" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#4b5563" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="volume" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorVolume)" 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#a855f7" 
                    strokeWidth={3} 
                    dot={{ r: 4, stroke: '#a855f7', strokeWidth: 2, fill: '#08080a' }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 2. Debt vs Credit - Visible to Owner, Accountant */}
        {['owner', 'accountant'].includes(role) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-6 md:p-10 flex flex-col justify-between backdrop-blur-xl relative overflow-hidden"
          >
            <div>
              <h3 className="text-xl md:text-2xl font-black mb-2">Moliya Balansi</h3>
              <p className="text-gray-500 text-xs md:text-sm">
                Ochiq qarzlar: debitorlik va kreditorlik (UZS va USD alohida)
              </p>
            </div>

            {isPieDataEmpty && (
              <div className="absolute inset-0 bg-[#08080a]/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mb-4">
                  <Wallet size={26} className="animate-pulse" />
                </div>
                <h4 className="text-lg font-black text-white mb-1.5">Moliya Balansi Bo'sh</h4>
                <p className="text-xs text-gray-500 max-w-xs">Hozircha debitorlik yoki kreditorlik qarzdorliklar mavjud emas.</p>
              </div>
            )}

            <div className="h-[280px] flex items-center justify-center relative my-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={isPieDataEmpty ? [{ name: 'Empty', value: 1, color: '#27272a' }] : pieData} 
                    innerRadius={82} 
                    outerRadius={102} 
                    paddingAngle={isPieDataEmpty ? 0 : 8} 
                    dataKey="value"
                    stroke="none"
                  >
                    {isPieDataEmpty ? (
                      <Cell fill="#27272a" />
                    ) : (
                      pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)
                    )}
                  </Pie>
                  {!isPieDataEmpty && <Tooltip content={<CustomTooltip />} />}
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>

              {/* Central Typography Balance Indicator */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <p className="text-[9px] font-black uppercase text-gray-500 tracking-widest mb-1">Sof balans</p>
                <div className="text-center px-6">
                  {(() => {
                    const rec = dashboardData?.stats.totalReceivables || { UZS: 0, USD: 0 };
                    const pay = dashboardData?.stats.totalPayables || { UZS: 0, USD: 0 };
                    const net = {
                      UZS: (rec.UZS || 0) - (pay.UZS || 0),
                      USD: (rec.USD || 0) - (pay.USD || 0)
                    };
                    const isPositive = net.UZS >= 0 && net.USD >= 0;
                    return (
                      <h4 className={`text-base md:text-lg font-black leading-tight tracking-tight ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatMoney(net)}
                      </h4>
                    );
                  })()}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed px-1">
              Diagrammada UZS va USD bir xil o‘lchovda emas — aniq sof balans markazda. B2B qarzlar
              bo‘yicha; hamkor daftari va POS alohida bo‘limlarda.
            </p>
          </motion.div>
        )}

        {/* 3. Stock IN/OUT - Visible to Owner, Warehouse, Manager */}
        {['owner', 'warehouse', 'manager'].includes(role) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-6 md:p-10 relative overflow-hidden backdrop-blur-xl"
          >
            {isStockLoading && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 flex items-center justify-center rounded-[2.5rem]">
                <Loader2 className="animate-spin text-blue-500" />
              </div>
            )}

            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl md:text-2xl font-black">Ombor Harakati</h3>
                <p className="text-gray-500 text-xs md:text-sm">Kirim va chiqim mahsulotlar hajmi</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-gray-500">Kirim</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-gray-500">Chiqim</span>
                </div>
              </div>
            </div>

            {isStockDataEmpty && (
              <div className="absolute inset-0 bg-[#08080a]/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-3xl flex items-center justify-center mb-4">
                  <Package size={26} className="animate-pulse" />
                </div>
                <h4 className="text-lg font-black text-white mb-1.5">Ombor Harakati Bo'sh</h4>
                <p className="text-xs text-gray-500 max-w-sm">Ushbu davrda mahsulotlar harakati aniqlanmadi.</p>
              </div>
            )}

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={isStockDataEmpty ? [
                  { date: '1', in: 0, out: 0 },
                  { date: '2', in: 0, out: 0 }
                ] : stockData?.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#4b5563" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val && val.includes('-') ? val.split('-').slice(2).join('') : val} 
                  />
                  <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="in" fill="#10b981" radius={[4, 4, 0, 0]} barSize={10} />
                  <Bar dataKey="out" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* 4. Top Products - Visible to Owner, Manager, Warehouse */}
        {['owner', 'manager', 'warehouse'].includes(role) && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="lg:col-span-2 rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-6 md:p-10 backdrop-blur-xl"
          >
            <h3 className="text-xl md:text-2xl font-black mb-8 flex items-center gap-3">
              <TrendingUp className="text-blue-500" /> Top Mahsulotlar ({days} kunlik chiqim)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Bar Chart representation */}
              <div className="h-[280px]">
                {isTopProductsEmpty ? (
                  <div className="h-full flex items-center justify-center text-gray-500 font-bold border border-dashed border-white/5 rounded-[2rem]">
                    Grafik mavjud emas
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockData?.topProducts} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={100} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18}>
                        {stockData?.topProducts.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#3b82f670'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Progress-enhanced Premium Stagger List */}
              <div className="space-y-3.5">
                {isTopProductsEmpty ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 font-black border-2 border-dashed border-white/5 rounded-[2rem] p-6 text-center">
                    <Layers size={24} className="mb-2 text-gray-600" />
                    Ma'lumotlar mavjud emas
                  </div>
                ) : (
                  stockData?.topProducts.slice(0, 5).map((p: any, i: number) => {
                    const relativeWidth = `${(p.value / maxProductSales) * 100}%`;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.4 }}
                        key={i} 
                        className="flex flex-col p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-all cursor-default relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 font-black text-xs border border-blue-500/20">
                              {i + 1}
                            </div>
                            <span className="font-bold text-xs md:text-sm text-white">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-white text-xs md:text-sm block">{p.value} ta</span>
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sotildi</span>
                          </div>
                        </div>
                        
                        {/* Elegant relative bar indicator */}
                        <div className="w-full bg-white/5 rounded-full h-1 mt-3 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: relativeWidth }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          />
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Upgraded Glassmorphic StatCard Component
function StatCard({ title, value, icon, color, trend }: any) {
  const themeColors: any = {
    blue: {
      text: "text-blue-400",
      border: "border-blue-500/10 hover:border-blue-500/30",
      bg: "bg-blue-500/5",
      glow: "group-hover:bg-blue-500/10",
      iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
      gradient: "from-blue-500/20 via-blue-500/5 to-transparent",
      trendColor: "bg-blue-500/10 text-blue-400",
    },
    purple: {
      text: "text-purple-400",
      border: "border-purple-500/10 hover:border-purple-500/30",
      bg: "bg-purple-500/5",
      glow: "group-hover:bg-purple-500/10",
      iconBg: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      gradient: "from-purple-500/20 via-purple-500/5 to-transparent",
      trendColor: "bg-purple-500/10 text-purple-400",
    },
    emerald: {
      text: "text-emerald-400",
      border: "border-emerald-500/10 hover:border-emerald-500/30",
      bg: "bg-emerald-500/5",
      glow: "group-hover:bg-emerald-500/10",
      iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      trendColor: "bg-emerald-500/10 text-emerald-400",
    },
    red: {
      text: "text-red-400",
      border: "border-red-500/10 hover:border-red-500/30",
      bg: "bg-red-500/5",
      glow: "group-hover:bg-red-500/10",
      iconBg: "bg-red-500/10 border-red-500/20 text-red-400",
      gradient: "from-red-500/20 via-red-500/5 to-transparent",
      trendColor: "bg-red-500/10 text-red-400",
    }
  };
  
  const theme = themeColors[color] || themeColors.blue;
  
  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      className={`p-5 md:p-7 rounded-[2rem] relative overflow-hidden group transition-all duration-300 bg-white/[0.02] border ${theme.border} backdrop-blur-xl h-full flex flex-col justify-between`}
    >
      {/* Dynamic Glowing Accent Flare */}
      <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${theme.gradient} rounded-full blur-[45px] -mr-10 -mt-10 opacity-40 group-hover:opacity-100 transition-opacity duration-500`} />
      
      <div className="relative z-10 w-full">
        <div className="flex items-center justify-between mb-5">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 ${theme.text} group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300 shadow-md`}>
            {icon}
          </div>
          
          {trend && (
            <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${theme.trendColor}`}>
              {trend}
            </span>
          )}
        </div>
        
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{title}</p>
        <h4 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white truncate">
          {value}
        </h4>
      </div>
    </motion.div>
  );
}
