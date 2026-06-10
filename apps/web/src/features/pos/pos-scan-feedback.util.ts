import { unlockNotificationAudio } from '@/lib/browser-notification';

export type PosScanSound = 'ready' | 'success' | 'error';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    unlockNotificationAudio();
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** POS skaner ovozlari — ready: yoqildi, success: qo'shildi, error: xato */
export function playPosScanSound(type: PosScanSound): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const t = ctx.currentTime;

  if (type === 'ready') {
    playTone(ctx, 523.25, t, 0.12, 0.08);
    playTone(ctx, 659.25, t + 0.1, 0.14, 0.09);
    return;
  }

  if (type === 'success') {
    playTone(ctx, 1046.5, t, 0.1, 0.11);
    playTone(ctx, 1318.5, t + 0.11, 0.14, 0.1);
    return;
  }

  playTone(ctx, 220, t, 0.18, 0.1, 'triangle');
  playTone(ctx, 165, t + 0.2, 0.22, 0.09, 'triangle');
}
