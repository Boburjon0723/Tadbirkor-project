'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Info,
  Loader2,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import {
  useMarkNotificationsReadOnPageEnter,
  useNotifications,
  useNotificationActions,
  useUnreadCount,
} from '@/hooks/notifications/use-notifications';
import { NotificationSoundSettings } from '@/components/NotificationSoundSettings';
import { NotificationsListMobile } from '@/features/notifications/NotificationsListMobile';
import {
  formatNotificationTimeAgo,
  getNotificationIcon,
} from '@/features/notifications/notifications-utils';

export default function NotificationsPage() {
  useMarkNotificationsReadOnPageEnter();

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

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      const key = String((n as { moduleKey?: string }).moduleKey || '').trim();
      if (key) set.add(key);
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [notifications]);

  const filterBar = (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            setScopeFilter('all');
            setPage(1);
          }}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black border transition-all ${
            scopeFilter === 'all'
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
              : 'bg-white/5 border-white/10 text-gray-400'
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
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-black border transition-all ${
            scopeFilter === 'unread'
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
              : 'bg-white/5 border-white/10 text-gray-400'
          }`}
        >
          O‘qilmagan
          {unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>
      <div className="flex gap-2 sm:ml-auto">
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(
              e.target.value as 'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
            );
            setPage(1);
          }}
          className="flex-1 sm:flex-none min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300"
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
          className="flex-1 sm:flex-none min-w-0 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300"
        >
          {moduleOptions.map((moduleKey) => (
            <option key={moduleKey} value={moduleKey}>
              {moduleKey === 'ALL' ? 'Barcha modullar' : moduleKey}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="dash-page max-w-4xl md:mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-20">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="dash-page-title">
            Bildirishnomalar <span className="text-blue-500">markazi</span>
          </h1>
          <p className="dash-page-subtitle mt-1.5">
            Tizimdagi voqealar va muhim xabarlar tarixi.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="btn-dash-secondary shrink-0"
          >
            {markAllAsRead.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Hammasini o‘qilgan deb belgilash
          </button>
        )}
      </div>

      <div className="md:hidden space-y-3">
        {filterBar}
        <div className="-mx-6">
          <NotificationsListMobile
            notifications={notifications}
            isLoading={isLoading}
            onMarkRead={(id) => markAsRead.mutate(id)}
          />
        </div>
      </div>

      <div className="hidden md:block dash-section">
        <div className="px-6 py-4 border-b border-white/5">{filterBar}</div>
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-blue-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-32 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-white/5">
              <MessageSquare className="w-10 h-10 text-gray-700" />
            </div>
            <p className="text-gray-400 font-black text-xl mb-2">Hozircha hech qanday xabar yo‘q</p>
            <p className="text-gray-600 text-sm">Yangiliklar bo‘lsa, bu yerda ko‘rinadi.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notif: {
              id: string;
              title: string;
              message: string;
              type: string;
              isRead: boolean;
              createdAt: string;
              moduleKey?: string | null;
            }) => (
              <article
                key={notif.id}
                className={`p-6 xl:p-8 hover:bg-white/[0.02] transition-colors ${!notif.isRead ? 'bg-blue-500/[0.02]' : ''}`}
              >
                <div className="flex gap-6">
                  <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5">
                    {getNotificationIcon(notif.type, 24)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h4 className={`text-lg font-black ${!notif.isRead ? 'text-white' : 'text-gray-400'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20 shrink-0">
                          Yangi
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-base leading-relaxed mb-4">{notif.message}</p>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-600 font-bold flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl">
                          <Clock size={14} className="text-blue-500" />
                          {formatNotificationTimeAgo(notif.createdAt)}
                        </span>
                        {notif.moduleKey ? (
                          <span className="text-xs text-gray-700 font-bold uppercase tracking-widest">
                            {notif.moduleKey}
                          </span>
                        ) : null}
                      </div>
                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead.mutate(notif.id)}
                          className="flex items-center gap-2 text-xs font-black text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          O‘qilgan deb belgilash
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-0 md:px-2">
        <p className="text-xs text-gray-500">
          {notificationsData?.total || 0} ta xabar · Sahifa {notificationsData?.page || 1}
          {isFetching ? ' · yangilanmoqda...' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300 disabled:opacity-40"
          >
            Oldingi
          </button>
          <button
            type="button"
            disabled={!notificationsData?.hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300 disabled:opacity-40"
          >
            Keyingi
          </button>
        </div>
      </div>

      <NotificationSoundSettings />

      <div className="p-4 md:p-8 bg-blue-500/5 border border-blue-500/10 rounded-2xl md:rounded-[2.5rem] flex gap-4 md:gap-6">
        <Info className="text-blue-400 shrink-0" size={22} />
        <div className="space-y-1.5 min-w-0">
          <h5 className="font-black text-blue-400 text-sm md:text-base">Bildirishnomalar haqida</h5>
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
            Yangi buyurtmalar, to‘lov tasdiqlari va boshqa muhim voqealar shu yerda ko‘rinadi.
            Pastdagi blokdan ovoz va tizim ruxsatini sozlashingiz mumkin.
          </p>
        </div>
      </div>
    </div>
  );
}
