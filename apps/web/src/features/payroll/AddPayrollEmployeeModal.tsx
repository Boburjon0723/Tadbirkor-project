'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, UserPlus, Pencil, Calendar, ChevronDown } from 'lucide-react';
import { ASSIGNABLE_ROLES, roleRequiresWarehouse } from '@/lib/roles';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import type { PayrollCurrency } from '@/lib/payroll-types';
import { PayrollMonthLeaveCalendar } from '@/features/payroll/PayrollMonthLeaveCalendar';
import { parseDateKey } from '@/lib/payroll-leave-dates.util';
import { toast } from '@/lib/toast';

export type AddPayrollEmployeePayload = {
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  role: string;
  baseSalary: number;
  currency: PayrollCurrency;
  phone: string;
  address: string;
  notes?: string;
  login?: string;
  password?: string;
  warehouseId?: string;
  companyUserId?: string;
  leavePolicy?: {
    year: number;
    month: number;
    monthlyPaidLeaveQuota: number;
    leaveDates: string[];
  };
};

export type PayrollEmployeeFormInitial = {
  companyUserId: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  role: string;
  baseSalary: number;
  currency: PayrollCurrency;
  phone: string;
  address: string;
  notes?: string;
  login?: string;
  warehouseId?: string;
  leaveYear: number;
  leaveMonth: number;
  paidLeaveQuota: number;
  leaveDates: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: AddPayrollEmployeePayload) => Promise<void>;
  busy?: boolean;
  mode?: 'add' | 'edit';
  initial?: PayrollEmployeeFormInitial | null;
  loadingInitial?: boolean;
};

const UZ_PHONE_PREFIX = '+998';

function normalizeUzPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  return UZ_PHONE_PREFIX + digits.slice(0, 9);
}

function isCompleteUzPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('998');
}

function suggestLogin(phone: string, firstName: string) {
  const digits = phone.replace(/\D/g, '').slice(-9);
  if (digits.length >= 9) return `user${digits}`;
  const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xodim';
  return `${base}${Date.now().toString().slice(-4)}`;
}

export function AddPayrollEmployeeModal({
  open,
  onClose,
  onSubmit,
  busy,
  mode = 'add',
  initial = null,
  loadingInitial = false,
}: Props) {
  const isEdit = mode === 'edit';
  const formReady = !isEdit || !!initial;
  const now = new Date();
  const { data: warehouses } = useWarehouses();
  const [leaveYear, setLeaveYear] = useState(now.getFullYear());
  const [leaveMonth, setLeaveMonth] = useState(now.getMonth() + 1);
  const [paidLeaveQuota, setPaidLeaveQuota] = useState('4');
  const [leaveCalendarOpen, setLeaveCalendarOpen] = useState(false);
  const [selectedLeaveDates, setSelectedLeaveDates] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    role: 'WORKER',
    baseSalary: '',
    currency: 'UZS' as PayrollCurrency,
    phone: UZ_PHONE_PREFIX,
    address: '',
    notes: '',
    login: '',
    password: '',
    warehouseId: '',
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit && initial && formReady) {
      setLeaveYear(initial.leaveYear);
      setLeaveMonth(initial.leaveMonth);
      setPaidLeaveQuota(String(initial.paidLeaveQuota));
      setSelectedLeaveDates(new Set(initial.leaveDates));
      setLeaveCalendarOpen(initial.leaveDates.length > 0);
      setForm({
        firstName: initial.firstName,
        lastName: initial.lastName,
        position: initial.position,
        department: initial.department,
        role: initial.role,
        baseSalary: initial.baseSalary > 0 ? String(initial.baseSalary) : '',
        currency: initial.currency,
        phone: initial.phone.startsWith('+') ? initial.phone : normalizeUzPhoneInput(initial.phone),
        address: initial.address,
        notes: initial.notes ?? '',
        login: initial.login ?? '',
        password: '',
        warehouseId: initial.warehouseId ?? '',
      });
      return;
    }
    const d = new Date();
    setLeaveYear(d.getFullYear());
    setLeaveMonth(d.getMonth() + 1);
    setPaidLeaveQuota('4');
    setLeaveCalendarOpen(false);
    setSelectedLeaveDates(new Set());
    setForm({
      firstName: '',
      lastName: '',
      position: '',
      department: '',
      role: 'WORKER',
      baseSalary: '',
      currency: 'UZS',
      phone: UZ_PHONE_PREFIX,
      address: '',
      notes: '',
      login: '',
      password: '',
      warehouseId: '',
    });
  }, [open, isEdit, initial, formReady]);

  const toggleLeaveDate = (dateKey: string) => {
    setSelectedLeaveDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const onLeaveMonthChange = (y: number, m: number) => {
    setLeaveYear(y);
    setLeaveMonth(m);
    setSelectedLeaveDates(new Set());
  };

  const needsWarehouse = roleRequiresWarehouse(form.role);

  const loginSuggestion = useMemo(
    () => suggestLogin(form.phone, form.firstName),
    [form.phone, form.firstName],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const salary = parseFloat(form.baseSalary.replace(/\s/g, '').replace(',', '.'));
    if (!form.firstName.trim() || !form.lastName.trim() || !salary || salary < 0) return;
    if (!isCompleteUzPhone(form.phone)) {
      toast.error('Telefon +998 dan boshlanib, yana 9 ta raqam bo‘lishi kerak');
      return;
    }
    if (needsWarehouse && !form.warehouseId) return;

    const login = form.login.trim();
    const password = form.password;
    const wantsSystemAccess = !isEdit && Boolean(login || password);
    if (!isEdit && wantsSystemAccess) {
      if (!login || !password) {
        toast.error('Login va parolni ikkalasini ham kiriting yoki ikkalasini ham bo‘sh qoldiring');
        return;
      }
      if (password.length < 6) {
        toast.error('Parol kamida 6 belgidan iborat bo‘lsin');
        return;
      }
    }
    if (isEdit && password && password.length < 6) {
      toast.error('Parol kamida 6 belgidan iborat bo‘lsin');
      return;
    }

    const quota = Math.max(0, Math.min(10, parseInt(paidLeaveQuota, 10) || 0));
    const datesInMonth = Array.from(selectedLeaveDates).filter((key) => {
      const p = parseDateKey(key);
      return p.year === leaveYear && p.month === leaveMonth;
    });

    await onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      position: form.position.trim(),
      department: form.department.trim(),
      role: form.role,
      baseSalary: salary,
      currency: form.currency,
      phone: form.phone.trim(),
      address: form.address.trim(),
      notes: form.notes.trim() || undefined,
      login: login || undefined,
      password: password || undefined,
      warehouseId: needsWarehouse ? form.warehouseId : undefined,
      leavePolicy: {
        year: leaveYear,
        month: leaveMonth,
        monthlyPaidLeaveQuota: quota,
        leaveDates: datesInMonth,
      },
      companyUserId: isEdit ? initial!.companyUserId : undefined,
    });
  };

  const field = (
    label: string,
    key: keyof typeof form,
    opts?: { required?: boolean; type?: string; placeholder?: string; colSpan?: boolean },
  ) => (
    <label className={`space-y-2 block ${opts?.colSpan ? 'md:col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
        {label}
        {opts?.required && <span className="text-red-400"> *</span>}
      </span>
      <input
        type={opts?.type || 'text'}
        required={opts?.required}
        placeholder={opts?.placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold text-white outline-none focus:border-violet-500/50"
      />
    </label>
  );

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-6 sm:p-8 border-b border-white/5 shrink-0">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
                  {isEdit ? (
                    <Pencil className="text-violet-400" size={28} />
                  ) : (
                    <UserPlus className="text-violet-400" size={28} />
                  )}
                  {isEdit ? 'Xodimni tahrirlash' : 'Xodim qo‘shish'}
                </h3>
                <p className="text-gray-500 text-sm font-bold mt-1">
                  {isEdit
                    ? 'Ma’lumotlarni yangilang va saqlang'
                    : 'Kadrlar va ish haqi — login/parol ixtiyoriy'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/5 text-gray-500"
              >
                <X size={22} />
              </button>
            </div>

            {loadingInitial || (isEdit && !formReady) ? (
              <div className="flex-1 flex items-center justify-center p-16">
                <Loader2 className="animate-spin text-violet-400" size={36} />
              </div>
            ) : (
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80 mb-4">
                Shaxsiy ma’lumotlar
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                {field('Ism', 'firstName', { required: true, placeholder: 'Masalan: Dilshod' })}
                {field('Familiya', 'lastName', { required: true, placeholder: 'Masalan: Karimov' })}
                {field('Lavozim', 'position', { placeholder: 'Masalan: Ombor mudiri' })}
                {field('Bo‘lim', 'department', { placeholder: 'Masalan: Sotuv bo‘limi' })}
                <label className="space-y-2 block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                    Rol (tizim) <span className="text-red-400"> *</span>
                  </span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold outline-none"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="bg-[#111]">
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                    Telefon <span className="text-red-400"> *</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: normalizeUzPhoneInput(e.target.value) }))
                    }
                    onFocus={() => {
                      if (!form.phone.startsWith(UZ_PHONE_PREFIX)) {
                        setForm((f) => ({ ...f, phone: UZ_PHONE_PREFIX }));
                      }
                    }}
                    placeholder="+998901234567"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold text-white outline-none focus:border-violet-500/50"
                  />
                  <p className="text-[11px] font-bold text-gray-600">
                    Faqat raqam: +998 va 9 ta raqam (masalan +998901234567)
                  </p>
                </label>
                {field('Manzil', 'address', {
                  colSpan: true,
                  placeholder: 'Masalan: Samarqand vil., Urgut tumani',
                })}
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80 mb-4">
                Ish haqi
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                {field('Oylik maoshi', 'baseSalary', {
                  required: true,
                  type: 'number',
                  placeholder: 'Masalan: 5 500 000',
                })}
                <label className="space-y-2 block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                    Valyuta
                  </span>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currency: e.target.value as PayrollCurrency,
                      }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold"
                  >
                    <option value="UZS" className="bg-[#111]">
                      UZS
                    </option>
                    <option value="USD" className="bg-[#111]">
                      USD
                    </option>
                  </select>
                </label>
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 mb-8 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                    Dam olish siyosati
                  </p>
                  <p className="text-xs font-bold text-gray-500 mt-2 leading-relaxed">
                    Limit — oyiga necha kun dam olish maoshdan ayirmaydi. Aniq sanalarni keyin
                    xodim qatoridagi <span className="text-teal-400">Dam olish</span> tugmasi
                    orqali ham belgilash mumkin.
                  </p>
                </div>
                <label className="space-y-2 block max-w-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                    Oylik bepul dam limiti (kun)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={paidLeaveQuota}
                    onChange={(e) => setPaidLeaveQuota(e.target.value)}
                    placeholder="Masalan: 4"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold text-white outline-none focus:border-emerald-500/50"
                  />
                  <p className="text-[11px] font-bold text-gray-600">
                    0–10 kun · limitdan ortiq dam olish oylikdan ayiriladi
                  </p>
                </label>
                {!leaveCalendarOpen ? (
                  <button
                    type="button"
                    onClick={() => setLeaveCalendarOpen(true)}
                    className="inline-flex items-center gap-2 text-xs font-black text-teal-400 hover:text-teal-300"
                  >
                    <Calendar size={14} />
                    Bu oy uchun dam kunlarini oldindan belgilash (ixtiyoriy)
                    <ChevronDown size={14} />
                  </button>
                ) : (
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLeaveCalendarOpen(false);
                        setSelectedLeaveDates(new Set());
                      }}
                      className="text-xs font-bold text-gray-500 hover:text-gray-300"
                    >
                      Kalendarni yopish va tanlovni tozalash
                    </button>
                    <PayrollMonthLeaveCalendar
                      year={leaveYear}
                      month={leaveMonth}
                      selectedDates={selectedLeaveDates}
                      onToggleDate={toggleLeaveDate}
                      onChangeMonth={onLeaveMonthChange}
                      paidLeaveQuota={Math.max(0, parseInt(paidLeaveQuota, 10) || 0)}
                    />
                  </div>
                )}
              </section>

              {needsWarehouse && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80 mb-4">
                    Biriktirish
                  </p>
                  <label className="space-y-2 block mb-8">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                      Ombor / do‘kon <span className="text-red-400"> *</span>
                    </span>
                    <select
                      required
                      value={form.warehouseId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, warehouseId: e.target.value }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 font-bold"
                    >
                      <option value="" className="bg-[#111]">
                        Tanlang…
                      </option>
                      {(warehouses || []).map((w: { id: string; name: string }) => (
                        <option key={w.id} value={w.id} className="bg-[#111]">
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {!isEdit && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80 mb-1">
                    Tizimga kirish
                  </p>
                  <p className="text-xs font-bold text-amber-400/90 mb-4">
                    Login va parol kiritsangiz — xodim jamoaga ham qo‘shiladi (Kompaniya →
                    Xodimlar). Bo‘sh qoldirsangiz faqat oylik ro‘yxatida qoladi.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div className="space-y-2">
                      {field('Login', 'login', {
                        placeholder: 'Masalan: dilshod.karimov',
                      })}
                      {!form.login && loginSuggestion && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, login: loginSuggestion }))}
                          className="text-xs font-bold text-violet-400 hover:text-violet-300"
                        >
                          Taklif: {loginSuggestion}
                        </button>
                      )}
                    </div>
                    {field('Parol', 'password', {
                      type: 'password',
                      placeholder: 'Masalan: Rustam2024!',
                    })}
                  </div>
                </>
              )}
              {isEdit && form.login && (
                <p className="text-xs font-bold text-gray-500 mb-4">
                  Tizim login: <span className="text-gray-300">{form.login}</span>
                </p>
              )}
              <div className="grid grid-cols-1 gap-5 mb-6">
                {field('Izoh', 'notes', {
                  colSpan: true,
                  placeholder: 'Masalan: Ishga chiqish — 01.06.2026, sinov 3 oy',
                })}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-black text-base disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : isEdit ? (
                  <Pencil size={20} />
                ) : (
                  <UserPlus size={20} />
                )}
                {isEdit ? 'O‘zgarishlarni saqlash' : 'Xodimni saqlash'}
              </button>
            </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
