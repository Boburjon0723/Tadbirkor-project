import { onboardingService } from '@/services/onboarding.service';

/** UI ketma-ketligi (6 bosqichli wizard) */
export const ONBOARDING_STEP_PATHS = [
  '/onboarding/company',
  '/onboarding/role',
  '/onboarding/business-type',
  '/onboarding/questions',
  '/onboarding/modules',
  '/onboarding/team',
  '/onboarding/employees',
  '/onboarding/review',
] as const;

/** Savollardan keyin ketma-ket o‘tadigan sahifalar */
export const ONBOARDING_POST_QUESTIONS_PATHS: OnboardingStepPath[] = [
  '/onboarding/modules',
  '/onboarding/team',
  '/onboarding/employees',
  '/onboarding/review',
];

/** Layout redirect qilmaydi — foydalanuvchi wizard ichida erkin yuraveradi */
export const ONBOARDING_FREE_NAV_PATHS: OnboardingStepPath[] = [
  '/onboarding/questions',
  ...ONBOARDING_POST_QUESTIONS_PATHS,
];

/** Majburiy emas, lekin wizardda ko‘rsatiladi */
export const ONBOARDING_OPTIONAL_PATHS: OnboardingStepPath[] = ['/onboarding/role'];

const ONBOARDING_UTILITY_PATHS = ['/onboarding/loading', '/onboarding/success'] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEP_PATHS)[number];

export type OnboardingProgressInput = {
  role?: string;
  company?: {
    tin?: string | null;
    businessType?: string | null;
    status?: string | null;
  } | null;
};

export type OnboardingProgress = {
  isComplete: boolean;
  /** Eng erta tugallanmagan majburiy bosqich */
  requiredPath: OnboardingStepPath;
  hasTin: boolean;
  hasBusinessType: boolean;
  hasModules: boolean;
};

export function computeOnboardingProgress(
  me: OnboardingProgressInput,
  features: { hasFeatureConfig?: boolean },
): OnboardingProgress {
  const role = String(me?.role || 'OWNER').toUpperCase();
  const companyStatus = String(me?.company?.status || '').toLowerCase();
  const tin = String(me?.company?.tin || '').replace(/\D/g, '');
  const hasTin = tin.length === 9;
  const hasBusinessType = !!String(me?.company?.businessType || '').trim();
  const hasModules = !!features?.hasFeatureConfig;

  // Backend /onboarding/status bilan mos: active + STIR + biznes turi yetarli
  const isComplete =
    role !== 'OWNER' ||
    (companyStatus === 'active' && hasTin && hasBusinessType);

  let requiredPath: OnboardingStepPath = '/onboarding/company';
  if (!hasTin) {
    requiredPath = '/onboarding/company';
  } else if (!hasBusinessType) {
    requiredPath = '/onboarding/business-type';
  } else if (!hasModules) {
    requiredPath = '/onboarding/questions';
  } else if (companyStatus !== 'active') {
    requiredPath = '/onboarding/modules';
  } else {
    requiredPath = '/onboarding/review';
  }

  return {
    isComplete,
    requiredPath,
    hasTin,
    hasBusinessType,
    hasModules,
  };
}

/** Dashboard / login: qayerga yo'naltirish */
export function resolveOnboardingPathFromMe(
  me: OnboardingProgressInput,
  features: { hasFeatureConfig?: boolean },
): OnboardingStepPath | null {
  const progress = computeOnboardingProgress(me, features);
  if (progress.isComplete) return null;
  return progress.requiredPath;
}

export function onboardingStepIndex(path: string): number {
  const idx = ONBOARDING_STEP_PATHS.indexOf(path as OnboardingStepPath);
  return idx >= 0 ? idx : -1;
}

/**
 * Joriy yo‘l majburiy bosqichdan oldinroqmi (indeks bo‘yicha).
 */
export function isOnboardingPathAheadOfRequired(
  currentPath: string,
  requiredPath: OnboardingStepPath,
): boolean {
  const cur = onboardingStepIndex(currentPath);
  const req = onboardingStepIndex(requiredPath);
  if (cur < 0 || req < 0) return false;
  return cur < req;
}

/**
 * Layout: faqat STIR / biznes turi / savollar bosqichidan oldin qolganlarni ushlaydi.
 * Modullar → jamoa → xodimlar → review zanjirida redirect yo‘q.
 */
export function shouldOnboardingLayoutRedirect(
  currentPath: string,
  requiredPath: OnboardingStepPath,
): boolean {
  if (!currentPath.startsWith('/onboarding')) return false;
  if ((ONBOARDING_UTILITY_PATHS as readonly string[]).includes(currentPath)) {
    return false;
  }
  if (ONBOARDING_OPTIONAL_PATHS.includes(currentPath as OnboardingStepPath)) {
    return false;
  }
  if (ONBOARDING_FREE_NAV_PATHS.includes(currentPath as OnboardingStepPath)) {
    return false;
  }
  return isOnboardingPathAheadOfRequired(currentPath, requiredPath);
}

export function needsOwnerOnboarding(
  me: OnboardingProgressInput,
  features: { hasFeatureConfig?: boolean },
): boolean {
  return resolveOnboardingPathFromMe(me, features) !== null;
}

export async function fetchPostAuthPath(
  mode: 'login' | 'register',
): Promise<string> {
  if (mode === 'register') return '/onboarding/company';
  try {
    const status = await onboardingService.getStatus();
    if (status.requiresOnboarding && status.nextPath) {
      return status.nextPath;
    }
  } catch {
    // Cookie bloklangan brauzerlarda ham dashboardga yo‘naltirish (Bearer token bilan)
  }
  return '/dashboard';
}

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  wholesale: 'Ulgurji savdo',
  retail: 'Chakana savdo',
  logistics: 'Ombor / distribyutor',
  manufacturing: 'Ishlab chiqarish',
  service: "Xizmat ko'rsatish",
  mixed: 'Aralash biznes',
};
