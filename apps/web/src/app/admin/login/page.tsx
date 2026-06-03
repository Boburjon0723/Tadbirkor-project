'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { platformService } from '@/services/platform.service';
import { clearAuthToken } from '@/lib/auth-token';

export default function AdminLoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(login.trim(), password);
      const access = await platformService.getAccess();
      if (!access?.isPlatformAdmin) {
        clearAuthToken();
        localStorage.removeItem('user');
        localStorage.removeItem('company');
        setError(
          'Bu hisob platforma administratori emas. Railway API da PLATFORM_ADMIN_EMAILS yoki PLATFORM_ADMIN_LOGINS ni tekshiring.',
        );
        return;
      }
      router.push('/dashboard/platform-admin');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || 'Login yoki parol noto‘g‘ri');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-neutral-800 p-8 shadow-2xl border border-neutral-700">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">Platforma admin</h1>
          <p className="text-neutral-400 mt-2">
            Oddiy ERP login + Railway ro‘yxati. Keyin admin PIN so‘ralishi mumkin.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 px-4 py-3 text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="sizning login"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 px-4 py-3 text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Kirilmoqda...' : 'Admin panelga kirish'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/" className="text-indigo-400 hover:underline">
            Bosh sahifaga qaytish
          </Link>
        </p>
      </div>
    </div>
  );
}
