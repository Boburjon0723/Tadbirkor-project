'use client';

import React, { useMemo, useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  XCircle, 
  Clock, 
  Trash2, 
  Check, 
  Loader2,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotifications, useNotificationActions, useUnreadCount } from '@/hooks/notifications/use-notifications';
import { NotificationSoundSettings } from '@/components/NotificationSoundSettings';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { markAsRead, markAllAsRead } = useNotificationActions();
  const [scopeFilter, setScopeFilter] = useState<'all' | 'unread'>('all');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const {
    data: notificationsData,
    isLoading,
    isFetching,
  } = useNotifications({
    page,
    limit,
    scope: scopeFilter,
    severity: severityFilter,
    moduleKey: moduleFilter === 'ALL' ? undefined : moduleFilter,
  });

  const notifications = notificationsData?.items || [];

  const getIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle2 className="text-emerald-500" size={24} />;
      case 'WARNING': return <AlertTriangle className="text-amber-500" size={24} />;
      case 'ERROR': return <XCircle className="text-red-500" size={24} />;
      default: return <Info className="text-blue-500" size={24} />;
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Hozirgina';
    if (minutes < 60) return `${minutes} daqiqa avval`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} soat avval`;
    return new Date(date).toLocaleDateString();
  };

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      const key = String((n as any).moduleKey || '').trim();
      if (key) set.add(key);
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const list = notifications || [];
    return list.filter((n: any) => {
      return true;
    });
  }, [notifications]);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Bildirishnomalar <span className="text-blue-500">Markazi</span></h1>
          <p className="text-gray-400 text-lg">Tizimdagi barcha voqealar va muhim xabarlar tarixi.</p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-black hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {markAllAsRead.isPending ? <Loader2 className="animate-spin" /> : <Check size={18} />}
            Hammasini o'qilgan deb belgilash
          </button>
        )}
      </div>

      {/* Main List */}
      <div className="glass-card rounded-[3rem] overflow-hidden bg-white/[0.01] border border-white/5">
        <div className="px-8 py-4 border-b border-white/5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScopeFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
              scopeFilter === 'all'
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => {
              setScopeFilter('unread');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
              scopeFilter === 'unread'
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            O‘qilmagan
          </button>
          <select
            value={severityFilter}
            onChange={(e) =>
              {
                setSeverityFilter(
                  e.target.value as 'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
                );
                setPage(1);
              }
            }
            className="ml-auto px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300"
          >
            <option value="ALL">Hamma tur</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
          <select
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300"
          >
            {moduleOptions.map((moduleKey) => (
              <option key={moduleKey} value={moduleKey}>
                {moduleKey === 'ALL' ? 'Barcha modullar' : moduleKey}
              </option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-32 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-white/5">
              <MessageSquare className="w-10 h-10 text-gray-700" />
            </div>
            <p className="text-gray-400 font-black text-xl mb-2">Hozircha hech qanday xabar yo'q</p>
            <p className="text-gray-600 text-sm">Yangiliklar bo'lsa, bu yerda ko'rinadi. ✨</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredNotifications.map((notif: any, idx: number) => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-10 hover:bg-white/[0.02] transition-all group relative ${!notif.isRead ? 'bg-blue-500/[0.02]' : ''}`}
              >
                <div className="flex gap-8">
                  <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5 group-hover:scale-110 transition-transform shadow-lg`}>
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className={`text-xl font-black ${!notif.isRead ? 'text-white' : 'text-gray-400'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                          Yangi
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-lg leading-relaxed mb-6">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-600 font-bold flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
                          <Clock size={14} className="text-blue-500" /> {getTimeAgo(notif.createdAt)}
                        </span>
                        <span className="text-xs text-gray-700 font-bold uppercase tracking-widest">
                          ID: {notif.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      
                      {!notif.isRead && (
                        <button 
                          onClick={() => markAsRead.mutate(notif.id)}
                          className="flex items-center gap-2 text-xs font-black text-blue-500 hover:text-blue-400 transition-colors group/btn"
                        >
                          O'qilgan deb belgilash <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-2">
        <p className="text-xs text-gray-500">
          {notificationsData?.total || 0} ta xabar · Sahifa {notificationsData?.page || 1}
          {isFetching ? ' · yangilanmoqda...' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300 disabled:opacity-40"
          >
            Oldingi
          </button>
          <button
            type="button"
            disabled={!notificationsData?.hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300 disabled:opacity-40"
          >
            Keyingi
          </button>
        </div>
      </div>

      <NotificationSoundSettings />

      <div className="p-8 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] flex gap-6">
        <Info className="text-blue-400 shrink-0" size={28} />
        <div className="space-y-2">
          <h5 className="font-black text-blue-400">Bildirishnomalar haqida</h5>
          <p className="text-sm text-gray-500 leading-relaxed">
            Tizimda sodir bo&apos;layotgan muhim amallar: yangi buyurtmalar, to&apos;lov tasdiqlari va boshqa voqealar shu yerda ko&apos;rinadi.
          </p>
        </div>
      </div>
    </div>
  );
}
