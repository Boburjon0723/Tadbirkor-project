const SOUND_ENABLED_KEY = 'axis.notifications.soundEnabled';
const MIN_PLAY_INTERVAL_MS = 1500;

let lastPlayedAt = 0;
let audioCtx: AudioContext | null = null;

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  if (stored === null) return true;
  return stored === '1';
}

export function setNotificationSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0');
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/** Brauzer autoplay siyosati — foydalanuvchi bir marta bosgandan keyin ovoz ishlaydi */
export function unlockNotificationAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    // ignore
  }
}

async function playInAppChime(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (audioCtx.state !== 'running') return false;

    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    const tones: Array<[number, number]> = [
      [880, 0],
      [1174.66, 0.1],
    ];
    for (const [freq, offset] of tones) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t + offset);
      osc.stop(t + offset + 0.22);
    }
    return true;
  } catch {
    return false;
  }
}

function showBrowserNotification(payload: SystemNotificationPayload) {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  const title = String(payload.title || 'Yangi bildirishnoma').trim() || 'Yangi bildirishnoma';
  const body = String(payload.message || '').trim();

  try {
    const notification = new Notification(title, {
      body: body || undefined,
      tag: payload.tag || 'axis-notification',
      icon: '/icon.png',
      silent: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (window.location.pathname !== '/dashboard/notifications') {
        window.location.assign('/dashboard/notifications');
      }
    };
  } catch {
    // Brauzer bloklagan yoki kontekst yo‘q
  }
}

type SystemNotificationPayload = {
  title: string;
  message?: string;
  tag?: string;
};

/** Ovoz (Web Audio) + ixtiyoriy tizim bildirishnomasi */
export function playSystemNotificationSound(payload: SystemNotificationPayload) {
  if (!isNotificationSoundEnabled()) return;

  const now = Date.now();
  if (now - lastPlayedAt < MIN_PLAY_INTERVAL_MS) return;
  lastPlayedAt = now;

  void playInAppChime();
  showBrowserNotification(payload);
}

/** Sozlamalarda “sinov” tugmasi */
export async function previewNotificationSound(): Promise<boolean> {
  if (!isNotificationSoundEnabled()) return false;
  unlockNotificationAudio();
  lastPlayedAt = 0;
  return playInAppChime();
}
