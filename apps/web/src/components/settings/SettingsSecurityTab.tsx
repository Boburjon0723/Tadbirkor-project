'use client';

import { useState } from 'react';
import { Key, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

export function SettingsSecurityTab() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Parol kamida 8 ta belgidan iborat bo‘lishi kerak.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Parollar mos kelmadi.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.patch('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Xato yuz berdi';
      setPasswordError(Array.isArray(message) ? message[0] : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handlePasswordChange}
      className="glass-card p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-center gap-3 mb-2">
        <Key className="text-purple-500" size={20} />
        <p className="font-black text-sm uppercase tracking-widest text-gray-400">
          Parolni o&apos;zgartirish
        </p>
      </div>

      <div className="space-y-4">
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => (
          <div key={field} className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
              {field === 'currentPassword'
                ? 'Joriy Parol'
                : field === 'newPassword'
                  ? 'Yangi Parol'
                  : 'Tasdiqlang'}
            </label>
            <div className="relative">
              <input
                required
                type={showPasswords[field] ? 'text' : 'password'}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 pr-14 font-bold outline-none focus:border-purple-500/50 transition-all text-white"
                value={passwordForm[field]}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, [field]: e.target.value })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswords((p) => ({ ...p, [field]: !p[field] }))
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPasswords[field] ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {passwordError && (
        <p className="text-xs text-red-500 font-bold ml-1">{passwordError}</p>
      )}
      {success && (
        <p className="text-xs text-emerald-500 font-bold ml-1">Parol yangilandi!</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <Save size={20} /> Saqlash
          </>
        )}
      </button>
    </form>
  );
}
