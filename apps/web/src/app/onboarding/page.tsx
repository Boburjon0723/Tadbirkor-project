import { redirect } from 'next/navigation';

/** Eski wizard — yangi onboarding oqimiga yo‘naltirish */
export default function LegacyOnboardingRedirect() {
  redirect('/onboarding/company');
}
