'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import {
  computeOnboardingProgress,
  shouldOnboardingLayoutRedirect,
} from '@/lib/onboarding';
import { Loader2 } from 'lucide-react';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, isError } = useSession();

  React.useEffect(() => {
    if (isPending || isError || !session?.me) return;

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

    if (shouldOnboardingLayoutRedirect(pathname, progress.requiredPath)) {
      router.replace(progress.requiredPath);
    }
  }, [isPending, isError, session, pathname, router]);

  if (isPending) {
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
