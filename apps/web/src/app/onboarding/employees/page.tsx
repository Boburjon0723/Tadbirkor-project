'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  User, 
  KeyRound, 
  Briefcase, 
  Building2, 
  Trash2, 
  ArrowRight, 
  ChevronLeft,
  CheckCircle2,
  Zap,
  Mail,
  Plus,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const steps = [
  { id: 1, name: "Hisob" },
  { id: 2, name: "Kompaniya" },
  { id: 3, name: "Biznes" },
  { id: 4, name: "Modullar" },
  { id: 5, name: "Jamoa" },
  { id: 6, name: "Yakunlash" }
];

import { onboardingService } from '@/services/onboarding.service';

interface Employee {
  id: string;
  fullName: string;
  login: string;
  role: string;
  department: string;
}

const roleMap: Record<string, string> = {
  'Bosh menejer': 'MANAGER',
  'Buxgalter': 'ACCOUNTANT',
  'Omborchi': 'WAREHOUSE',
  'Sotuvchi': 'SALES',
  'Custom rol': 'MANAGER'
};

export default function AddEmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    login: '',
    password: '',
    role: 'Sotuvchi',
    department: 'Savdo'
  });
  const router = useRouter();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const data = await onboardingService.addTeamMember({
        fullName: formData.fullName,
        login: formData.login,
        password: formData.password,
        role: roleMap[formData.role] || 'SALES',
        department: formData.department
      });

      const newEmp = {
        id: data.id,
        fullName: formData.fullName,
        login: formData.login,
        role: formData.role,
        department: formData.department
      };
      setEmployees([...employees, newEmp]);
      setFormData({ ...formData, fullName: '', email: '', login: '', password: '' });
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const removeEmployee = (id: string) => {
    setEmployees(employees.filter(emp => emp.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Top Progress Stepper */}
      <div className="w-full bg-[#080808] border-b border-white/5 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-blue-500 fill-blue-500 w-6 h-6" />
            <span className="font-bold text-lg">Axis ERP</span>
          </div>
          <div className="hidden md:flex items-center gap-12">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step.id === 5 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                  step.id < 5 ? 'bg-emerald-500' : 'bg-white/5 text-gray-500'
                }`}>
                  {step.id < 5 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={`text-sm font-medium ${step.id === 5 ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">5/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-6 lg:p-12 gap-12">
        <div className="flex-1">
          <div className="mb-10">
            <h1 className="text-3xl font-bold mb-3">Xodim qo‘shish</h1>
            <p className="text-gray-500">Har bir xodimga o‘z vazifasiga mos rol va ruxsat bering.</p>
          </div>

          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleAdd} 
                className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Ism familiya</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text"
                        placeholder="Aziz Rahimov"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Login</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        required
                        type="text"
                        placeholder="aziz_axis"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                        value={formData.login}
                        onChange={(e) => setFormData({...formData, login: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Rol</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none"
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                      >
                        <option className="bg-[#080808]">Bosh menejer</option>
                        <option className="bg-[#080808]">Buxgalter</option>
                        <option className="bg-[#080808]">Omborchi</option>
                        <option className="bg-[#080808]">Sotuvchi</option>
                        <option className="bg-[#080808]">Custom rol</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Bo'lim</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all appearance-none"
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                      >
                        <option className="bg-[#080808]">Boshqaruv</option>
                        <option className="bg-[#080808]">Moliya</option>
                        <option className="bg-[#080808]">Ombor</option>
                        <option className="bg-[#080808]">Savdo</option>
                        <option className="bg-[#080808]">Boshqa</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Vaqtinchalik parol</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      required
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs flex items-center gap-3">
                    {error}
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                   <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-4 text-gray-500 font-bold hover:text-white transition-all"
                  >
                    Bekor qilish
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : (
                      <>
                        Xodimni qo‘shish
                        <Plus size={18} />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowForm(true)}
                className="w-full py-10 border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center gap-4 text-gray-500 hover:border-blue-500/50 hover:text-blue-500 transition-all group"
              >
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-blue-500/10 transition-all">
                  <UserPlus />
                </div>
                <span className="font-bold">Yana xodim qo‘shish</span>
              </motion.button>
            )}
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-between">
            <button 
              onClick={() => router.push('/onboarding/team')}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              Orqaga
            </button>
            <button 
              onClick={() => router.push('/onboarding/review')}
              className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl shadow-white/5"
            >
              Davom etish
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        {/* Right - Added Employees Table */}
        <div className="w-full lg:w-96">
           <div className="p-8 bg-[#080808] border border-white/5 rounded-[2.5rem] sticky top-12">
             <div className="flex items-center justify-between mb-8">
               <h3 className="font-bold">Jamoa a'zolari</h3>
               <div className="px-2 py-0.5 bg-blue-600/10 text-blue-500 rounded-md text-[10px] font-bold">
                 {employees.length} kishi
               </div>
             </div>

             <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
               {employees.length === 0 ? (
                 <div className="py-12 text-center">
                   <User className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                   <p className="text-xs text-gray-600">Hozircha xodim qo‘shilmadi</p>
                 </div>
               ) : (
                 employees.map((emp) => (
                   <motion.div 
                    layout
                    key={emp.id} 
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl group flex items-center justify-between"
                   >
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center font-bold">
                         {emp.fullName[0]}
                       </div>
                       <div>
                         <h4 className="text-sm font-bold truncate max-w-[120px]">{emp.fullName}</h4>
                         <p className="text-[10px] text-gray-500">{emp.role} • {emp.department}</p>
                       </div>
                     </div>
                     <button 
                      onClick={() => removeEmployee(emp.id)}
                      className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                     >
                       <Trash2 size={16} />
                     </button>
                   </motion.div>
                 ))
               )}
             </div>

             <div className="mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Xodimlar uchun dashboard tayyorlanadi
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
