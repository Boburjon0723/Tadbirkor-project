import { isTrialActive } from './trial.util';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';

export function normalizeSubscriptionStatus(raw?: string | null): SubscriptionStatus {
  const s = String(raw || 'TRIAL').toUpperCase();
  if (s === 'ACTIVE' || s === 'EXPIRED') return s;
  return 'TRIAL';
}

export type SubscriptionAccess = {
  status: SubscriptionStatus;
  canWrite: boolean;
  trialActive: boolean;
  labelUz: string;
};

export function resolveSubscriptionAccess(company: {
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
}): SubscriptionAccess {
  const status = normalizeSubscriptionStatus(company.subscriptionStatus);
  const trialActive = isTrialActive(company.trialEndsAt);

  if (status === 'ACTIVE') {
    return { status: 'ACTIVE', canWrite: true, trialActive: false, labelUz: 'Faol obuna' };
  }
  if (status === 'TRIAL' && trialActive) {
    return { status: 'TRIAL', canWrite: true, trialActive: true, labelUz: 'Bepul sinov' };
  }
  return {
    status: 'EXPIRED',
    canWrite: false,
    trialActive: false,
    labelUz: 'Sinov tugagan',
  };
}

export function canCompanyWrite(company: {
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
}): boolean {
  return resolveSubscriptionAccess(company).canWrite;
}
