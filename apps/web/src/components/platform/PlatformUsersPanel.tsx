'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone, RefreshCw, Search, UserCheck, UserX } from 'lucide-react';
import { platformService, type PlatformUserRow } from '@/services/platform.service';
import { toast } from '@/lib/toast';

export function PlatformUsersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [messageUser, setMessageUser] = useState<PlatformUserRow | null>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');

  const { data: list, isLoading, refetch } = useQuery({
    queryKey: ['platform-users', search, statusFilter],
    queryFn: () =>
      platformService.listUsers({
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        limit: 50,
      }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      platformService.updateUser(id, { status }),
    onSuccess: () => {
      toast.success('Saqlandi');
      void queryClient.invalidateQueries({ queryKey: ['platform-users'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  const msgMut = useMutation({
    mutationFn: () =>
      platformService.broadcast({
        title: msgTitle.trim(),
        message: msgBody.trim(),
        target: 'user',
        userIds: messageUser ? [messageUser.id] : [],
        type: 'INFO',
      }),
    onSuccess: (data) => {
      toast.success(`Yuborildi: ${data.sent ?? 0} ta`);
      setMessageUser(null);
      setMsgTitle('');
      setMsgBody('');
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Foydalanuvchilar</h1>
          <p className="text-neutral-400 text-sm mt-1">Bloklash, faollashtirish va shaxsiy xabar</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-neutral-300 hover:bg-white/10"
        >
          <RefreshCw size={16} />
          Yangilash
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, login, email, telefon..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
        >
          <option value="all">Barcha holat</option>
          <option value="active">Faol</option>
          <option value="inactive">Bloklangan</option>
        </select>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {(list?.items || []).map((row) => (
            <div
              key={row.id}
              className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-black">{row.fullName}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  @{row.login}
                  {row.email ? ` · ${row.email}` : ''}
                  {row.phone ? ` · ${row.phone}` : ''}
                </p>
                {row.companiesPreview && (
                  <p className="text-[10px] text-neutral-600 mt-1 truncate max-w-md">
                    {row.companyCount} kompaniya: {row.companiesPreview}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    row.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {row.status === 'active' ? 'Faol' : 'Bloklangan'}
                </span>
                <button
                  type="button"
                  onClick={() => setMessageUser(row)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-black"
                >
                  <Megaphone size={14} />
                  Xabar
                </button>
                {row.status === 'active' ? (
                  <button
                    type="button"
                    disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate({ id: row.id, status: 'inactive' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-black"
                  >
                    <UserX size={14} />
                    Bloklash
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate({ id: row.id, status: 'active' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-black"
                  >
                    <UserCheck size={14} />
                    Faollashtirish
                  </button>
                )}
              </div>
            </div>
          ))}
          {!list?.items?.length && (
            <p className="text-center text-neutral-500 py-12">Foydalanuvchi topilmadi</p>
          )}
        </div>
      )}

      {messageUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#141418] space-y-4">
            <p className="font-black">
              Xabar: <span className="text-indigo-300">{messageUser.fullName}</span>
            </p>
            <input
              value={msgTitle}
              onChange={(e) => setMsgTitle(e.target.value)}
              placeholder="Sarlavha"
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-bold"
            />
            <textarea
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              rows={4}
              placeholder="Matn"
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
              >
                Bekor
              </button>
              <button
                type="button"
                disabled={msgMut.isPending || !msgTitle.trim() || !msgBody.trim()}
                onClick={() => msgMut.mutate()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 font-black text-sm disabled:opacity-50"
              >
                Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
