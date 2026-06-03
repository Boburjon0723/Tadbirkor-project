'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock, Crown } from 'lucide-react';
import { platformService, clearStoredPlatformAdminPin } from '@/services/platform.service';
import { toast } from '@/lib/toast';

type Props = {
  children: React.ReactNode;
  isPlatformAdmin: boolean;
};

export function PlatformAdminPinGate({ children, isPlatformAdmin }: Props) {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const { data: access, isLoading } = useQuery({
    queryKey: ['platform-access'],
    queryFn: () => platformService.getAccess(),
    enabled: isPlatformAdmin,
  });

  if (!isPlatformAdmin) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (!access?.pinRequired || unlocked) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      toast.error('PIN kamida 4 belgi');
      return;
    }
    setChecking(true);
    try {
      await platformService.verifyPin(pin);
      setUnlocked(true);
      toast.success('Admin panel ochildi');
    } catch (err) {
      clearStoredPlatformAdminPin();
      toast.error((err as Error).message || 'Parol noto‘g‘ri');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <div className="p-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 space-y-6">
        <div className="text-center">
          <Crown className="mx-auto text-amber-400 mb-3" size={40} />
          <h1 className="text-xl font-black">Admin panel paroli</h1>
          <p className="text-sm text-gray-500 mt-2">
            Platforma boshqaruvi uchun alohida PIN kiriting. Bu parol oddiy foydalanuvchi
            loginidan farq qiladi.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              size={18}
            />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Admin PIN"
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 font-bold text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={checking}
            className="w-full py-3 rounded-xl bg-amber-500 text-black font-black text-sm disabled:opacity-50"
          >
            {checking ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </form>
        <p className="text-[10px] text-gray-600 text-center">
          PIN serverdagi <code className="text-gray-500">PLATFORM_ADMIN_PIN</code> bilan
          mos kelishi kerak
        </p>
      </div>
    </div>
  );
}
