/** Platforma sinov muddati — API `TRIAL_DAYS` bilan mos (default 7 kun) */

const DEFAULT_TRIAL_DAYS = 7;

export function getTrialDays(): number {
  const raw = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 365) {
    return Math.floor(raw);
  }
  return DEFAULT_TRIAL_DAYS;
}

/** Masalan: "7 kunlik bepul sinov" */
export function trialPeriodLabelUz(): string {
  return `${getTrialDays()} kunlik bepul sinov`;
}

/** Masalan: "7 kunlik sinov" */
export function trialShortLabelUz(): string {
  return `${getTrialDays()} kunlik sinov`;
}
