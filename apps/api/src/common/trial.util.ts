/** Platforma sinov muddati — bitta manba (marketing: 7 kun) */

const DEFAULT_TRIAL_DAYS = 7;

export function getTrialDays(): number {
  const raw = Number(process.env.TRIAL_DAYS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 365) {
    return Math.floor(raw);
  }
  return DEFAULT_TRIAL_DAYS;
}

export function computeTrialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + getTrialDays());
  return end;
}

export function isTrialActive(trialEndsAt: Date | string | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}
