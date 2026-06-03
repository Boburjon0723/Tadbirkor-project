'use client';

import { useSession } from '@/hooks/use-session';

/** Chakana nasiya — POS modulidan alohida, kompaniya sozlamasi (posCreditEnabled). */
export function usePosCreditEnabled() {
  const { data: session, isPending } = useSession();
  return {
    enabled: !!session?.me?.company?.posCreditEnabled,
    loading: isPending && !session,
  };
}
