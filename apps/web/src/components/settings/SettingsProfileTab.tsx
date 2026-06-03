'use client';

import { Mail, Phone, History } from 'lucide-react';

type Props = {
  user: {
    fullName: string;
    login: string;
    email?: string | null;
    phone?: string | null;
  };
};

export function SettingsProfileTab({ user }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-8 rounded-[2.5rem] bg-white/[0.01] border border-white/5 space-y-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center text-blue-400 font-black text-3xl border border-white/5">
            {user.fullName.charAt(0)}
          </div>
          <div>
            <p className="text-2xl font-black text-white">{user.fullName}</p>
            <p className="text-gray-500 font-bold tracking-wide">@{user.login}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <Mail className="text-gray-500" size={20} />
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Email
              </p>
              <p className="font-bold">{user.email || 'Kiritilmagan'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <Phone className="text-gray-500" size={20} />
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                Telefon
              </p>
              <p className="font-bold">{user.phone || 'Kiritilmagan'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex flex-col justify-center gap-4">
        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
          <History className="text-blue-400" size={24} />
        </div>
        <h4 className="text-xl font-black">Profil faolligi</h4>
        <p className="text-sm text-gray-400 font-bold leading-relaxed">
          Siz oxirgi marta {new Date().toLocaleDateString('uz-UZ')} kuni tizimga kirgansiz.
          Profil ma&apos;lumotlarini o&apos;zgartirish uchun admin bilan bog&apos;laning.
        </p>
      </div>
    </div>
  );
}
