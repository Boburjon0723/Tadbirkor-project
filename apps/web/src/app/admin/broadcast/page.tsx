'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { platformService } from '@/services/platform.service';
import { toast } from '@/lib/toast';

type Target = 'all' | 'owners' | 'company' | 'user';

export default function AdminBroadcastPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [type, setType] = useState<'INFO' | 'WARNING' | 'SUCCESS'>('INFO');
  const [companyIds, setCompanyIds] = useState('');
  const [userIds, setUserIds] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const { data: companies } = useQuery({
    queryKey: ['platform-companies-broadcast'],
    queryFn: () => platformService.listCompanies({ page: 1, limit: 100 }),
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['platform-scheduled-jobs'],
    queryFn: () => platformService.listScheduledJobs({ status: 'pending', page: 1, limit: 20 }),
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof platformService.broadcast>[0] = {
        title: title.trim(),
        message: message.trim(),
        target,
        type,
      };
      if (target === 'company') {
        body.companyIds = companyIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (target === 'user') {
        body.userIds = userIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (scheduledAt) {
        body.scheduledAt = new Date(scheduledAt).toISOString();
      }
      return platformService.broadcast(body);
    },
    onSuccess: (data) => {
      if (data.scheduled) {
        toast.success('Xabar rejalashtirildi');
        void queryClient.invalidateQueries({ queryKey: ['platform-scheduled-jobs'] });
      } else {
        toast.success(`Yuborildi: ${data.sent ?? 0} ta foydalanuvchi`);
      }
      setTitle('');
      setMessage('');
      setScheduledAt('');
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  const cancelMut = useMutation({
    mutationFn: (jobId: string) => platformService.cancelScheduledJob(jobId),
    onSuccess: () => {
      toast.success('Reja bekor qilindi');
      void queryClient.invalidateQueries({ queryKey: ['platform-scheduled-jobs'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Xatolik'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Sarlavha va matn majburiy');
      return;
    }
    sendMut.mutate();
  };

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Megaphone className="text-indigo-400" size={28} />
          Xabar yuborish
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Darhol yoki belgilangan vaqtda — barcha, egalar, kompaniya yoki foydalanuvchi
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div>
          <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
            Kimga
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-bold"
          >
            <option value="all">Barcha faol foydalanuvchilar</option>
            <option value="owners">Faqat kompaniya egalari (OWNER)</option>
            <option value="company">Tanlangan kompaniyalar</option>
            <option value="user">Tanlangan foydalanuvchilar (ID)</option>
          </select>
        </div>

        {target === 'company' && (
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
              Kompaniya ID (vergul bilan)
            </label>
            <select
              multiple
              value={companyIds ? companyIds.split(',') : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                setCompanyIds(selected.join(','));
              }}
              className="w-full min-h-[100px] px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm"
            >
              {(companies?.items || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-neutral-600 mt-1">Ctrl+bosib bir nechtasini tanlang</p>
          </div>
        )}

        {target === 'user' && (
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
              Foydalanuvchi ID (vergul yoki bo‘shliq bilan)
            </label>
            <input
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
              placeholder="uuid1, uuid2..."
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-bold"
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
              Turi
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-bold"
            >
              <option value="INFO">Ma&apos;lumot</option>
              <option value="WARNING">Ogohlantirish</option>
              <option value="SUCCESS">Muvaffaqiyat</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase text-neutral-500 mb-2 flex items-center gap-1">
              <Clock size={12} />
              Vaqt (ixtiyoriy)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
            Sarlavha
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-bold"
            placeholder="Masalan: Texnik ishlar"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase text-neutral-500 mb-2">
            Matn
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm"
            placeholder="Foydalanuvchilarga ko‘rinadigan xabar..."
          />
        </div>

        <button
          type="submit"
          disabled={sendMut.isPending}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black text-sm disabled:opacity-50"
        >
          {sendMut.isPending
            ? 'Yuborilmoqda...'
            : scheduledAt
              ? 'Rejalashtirish'
              : 'Hozir yuborish'}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-black flex items-center gap-2">
          <Clock size={20} className="text-amber-400" />
          Kutilayotgan rejalar
        </h2>
        {jobsLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {(jobs?.items || []).map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-neutral-500">
                    {job.kind === 'broadcast' ? 'Xabar' : 'Obuna'} ·{' '}
                    {new Date(job.runAt).toLocaleString('uz-UZ')}
                  </p>
                  <p className="text-sm font-bold mt-0.5 truncate">
                    {String(job.payload.title ?? job.payload.subscriptionStatus ?? '—')}
                  </p>
                  {job.kind === 'broadcast' && (
                    <p className="text-xs text-neutral-500 truncate">{String(job.payload.message ?? '')}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={cancelMut.isPending}
                  onClick={() => cancelMut.mutate(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-black"
                >
                  <Trash2 size={14} />
                  Bekor
                </button>
              </div>
            ))}
            {!jobs?.items?.length && (
              <p className="text-neutral-500 text-sm py-4">Rejalashtirilgan vazifa yo‘q</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
