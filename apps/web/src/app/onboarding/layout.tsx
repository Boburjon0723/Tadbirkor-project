'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import {
  computeOnboardingProgress,
  isOnboardingPathAheadOfRequired,
} from '@/lib/onboarding';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { Loader2 } from 'lucide-react';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, isPending, isError } = useSession();
  const [sessionReady, setSessionReady] = React.useState(false);

  React.useEffect(() => {
    if (isPending || isError) return;
    let cancelled = false;
    void refreshOnboardingSession(queryClient).finally(() => {
      if (!cancelled) setSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isPending, isError, queryClient]);

  React.useEffect(() => {
    if (isPending || isError || !session?.me || !sessionReady) return;

    const role = String(session.role || 'owner').toUpperCase();
    if (role !== 'OWNER') {
      router.replace('/dashboard');
      return;
    }

    const progress = computeOnboardingProgress(
      { role: session.me.role, company: session.me.company },
      session.features,
    );

    if (progress.isComplete) {
      router.replace('/dashboard');
      return;
    }

    // Faqat majburiy bosqichdan oldingi sahifaga kirganda orqaga qaytarish
    if (
      pathname.startsWith('/onboarding') &&
      isOnboardingPathAheadOfRequired(pathname, progress.requiredPath)
    ) {
      router.replace(progress.requiredPath);
    }
  }, [isPending, isError, session, sessionReady, pathname, router]);

  if (isPending || !sessionReady) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (isError || !session?.me) {
    router.replace('/');
    return null;
  }

  return <>{children}</>;
}
