'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Volume2, VolumeX, BellRing, Loader2 } from 'lucide-react';
import {
  getNotificationPermission,
  isBrowserNotificationSupported,
  isNotificationSoundEnabled,
  previewNotificationSound,
  requestNotificationPermission,
  setNotificationSoundEnabled,
  unlockNotificationAudio,
} from '@/lib/browser-notification';

export function NotificationSoundSettings({ compact = false }: { compact?: boolean }) {
  const [soundOn, setSoundOn] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [requesting, setRequesting] = useState(false);
  const [testingSound, setTestingSound] = useState(false);

  useEffect(() => {
    setSoundOn(isNotificationSoundEnabled());
    setPermission(getNotificationPermission());
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    setNotificationSoundEnabled(next);
    if (next) {
      unlockNotificationAudio();
      void previewNotificationSound();
    }
  }, [soundOn]);

  const handleEnableSystem = useCallback(async () => {
    setRequesting(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result === 'unsupported' ? 'unsupported' : result);
      if (result === 'granted') {
        setSoundOn(true);
        setNotificationSoundEnabled(true);
        unlockNotificationAudio();
        await previewNotificationSound();
      }
    } finally {
      setRequesting(false);
    }
  }, []);

  const handleTestSound = useCallback(async () => {
    setTestingSound(true);
    try {
      unlockNotificationAudio();
      await previewNotificationSound();
    } finally {
      setTestingSound(false);
    }
  }, []);

  const permissionBlocked = permission === 'denied';
  const permissionGranted = permission === 'granted';
  const notSupported = permission === 'unsupported';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleSound}
          disabled={notSupported || !permissionGranted}
          title={
            notSupported
              ? 'Brauzer bildirishnomalarni qo‘llamaydi'
              : !permissionGranted
                ? 'Avval tizim ruxsatini bering'
                : soundOn
                  ? 'Ovoz yoqilgan'
                  : 'Ovoz o‘chirilgan'
          }
          className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >
          {soundOn ? <Volume2 size={16} className="text-blue-400" /> : <VolumeX size={16} className="text-gray-500" />}
        </button>
        {!permissionGranted && !notSupported && (
          <button
            type="button"
            onClick={handleEnableSystem}
            disabled={requesting || permissionBlocked}
            className="px-2 py-1 rounded-lg text-[10px] font-black border border-blue-500/30 text-blue-300 disabled:opacity-40"
          >
            {requesting ? <Loader2 size={12} className="animate-spin" /> : 'Ruxsat'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl md:rounded-[2rem] space-y-4">
      <div className="flex items-start gap-4">
        <BellRing className="text-emerald-400 shrink-0" size={24} />
        <div className="space-y-1">
          <h5 className="font-black text-emerald-300">Ovozli bildirishnoma</h5>
          <p className="text-sm text-gray-500 leading-relaxed">
            Yangi xabar kelganda qisqa signal ovozi eshitiladi. Tizim bildirishnomasi (toast) uchun
            brauzer ruxsati kerak — ovoz esa sahifa ochiq bo‘lsa ham ishlaydi (birinchi marta ekranga
            bosganingizdan keyin).
          </p>
        </div>
      </div>

      {notSupported && (
        <p className="text-xs text-amber-400 font-bold">Bu brauzer tizim bildirishnomalarini qo‘llamaydi.</p>
      )}

      {permissionBlocked && (
        <p className="text-xs text-amber-400 font-bold">
          Ruxsat rad etilgan. Brauzer sozlamalaridan Tadbirkor uchun bildirishnomalarni yoqing.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleToggleSound}
          disabled={notSupported || !permissionGranted}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-40 ${
            soundOn
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-white/5 border-white/10 text-gray-400'
          }`}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {soundOn ? 'Ovoz yoqilgan' : 'Ovoz o‘chirilgan'}
        </button>

        {!permissionGranted && !notSupported && (
          <button
            type="button"
            onClick={handleEnableSystem}
            disabled={requesting || permissionBlocked}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-blue-500/15 border border-blue-500/30 text-blue-300 disabled:opacity-40"
          >
            {requesting ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
            Tizim ruxsatini berish
          </button>
        )}

        {permissionGranted && (
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
            Tizim ruxsati berilgan
          </span>
        )}

        <button
          type="button"
          onClick={handleTestSound}
          disabled={!soundOn || testingSound}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-40"
        >
          {testingSound ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          Ovozni sinash
        </button>
      </div>
    </div>
  );
}
