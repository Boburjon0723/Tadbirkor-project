'use client';

import React from 'react';
import { ArrowRight, Clock, Loader2, MessageSquare } from 'lucide-react';
import { MOBILE_LIST_ITEM, MOBILE_LIST_SURFACE } from '@/lib/mobile-pwa';
import {
  formatNotificationTimeAgo,
  getNotificationIcon,
} from './notifications-utils';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  moduleKey?: string | null;
};

type Props = {
  notifications: NotificationRow[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  markReadPending?: boolean;
};

export function NotificationsListMobile({
  notifications,
  isLoading,
  onMarkRead,
}: Props) {
  if (isLoading) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-20 flex flex-col items-center justify-center gap-4`}>
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-gray-500 font-bold text-xs">Yuklanmoqda...</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-16 text-center px-6`}>
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
          <MessageSquare className="w-8 h-8 text-gray-600" />
        </div>
        <p className="text-gray-400 font-black text-base mb-1">Hozircha xabar yo‘q</p>
        <p className="text-gray-600 text-xs">Yangiliklar bo‘lsa, bu yerda ko‘rinadi.</p>
      </div>
    );
  }

  return (
    <div className={MOBILE_LIST_SURFACE}>
      {notifications.map((notif) => (
        <article
          key={notif.id}
          className={`${MOBILE_LIST_ITEM} ${!notif.isRead ? 'bg-blue-500/[0.03]' : ''}`}
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-white/5 border border-white/5">
              {getNotificationIcon(notif.type, 18)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4
                  className={`text-[15px] font-bold leading-snug pr-1 ${
                    !notif.isRead ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {notif.title}
                </h4>
                {!notif.isRead && (
                  <span className="shrink-0 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase rounded-md border border-blue-500/20">
                    Yangi
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mt-1 line-clamp-3">
                {notif.message}
              </p>
              <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                <span className="text-[10px] text-gray-600 font-bold flex items-center gap-1.5 min-w-0">
                  <Clock size={12} className="text-blue-500 shrink-0" />
                  <span className="truncate">{formatNotificationTimeAgo(notif.createdAt)}</span>
                  {notif.moduleKey ? (
                    <span className="text-gray-700 uppercase tracking-wider truncate">
                      · {notif.moduleKey}
                    </span>
                  ) : null}
                </span>
                {!notif.isRead && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(notif.id)}
                    className="shrink-0 flex items-center gap-1 text-[10px] font-black text-blue-500 active:opacity-70"
                  >
                    O‘qildi
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
