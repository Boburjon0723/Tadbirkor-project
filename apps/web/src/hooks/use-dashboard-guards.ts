'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { isPathModuleAccessAllowed } from '@/lib/feature-modules';
import { computeOnboardingProgress } from '@/lib/onboarding';
import { prefetchDashboardRoutes } from '@/lib/dashboard-prefetch';
import {
  isDashboardPathAllowedForRole,
  type DashboardMenuItem,
} from '@/lib/dashboard-menu';
import {
  SESSION_QUERY_KEY,
  type SessionData,
  type SessionRole,
} from '@/hooks/use-session';
import type { CompanyFeatureConfig } from '@/services/companies.service';

type Params = {
  pathname: string;
  search?: string;
  role: SessionRole;
  layoutHold: boolean;
  sessionPending: boolean;
  sessionIsPlaceholder: boolean;
  sessionError: boolean;
  user: SessionData['me'] | undefined;
  session: SessionData | undefined;
  featureConfig: CompanyFeatureConfig;
  allMenuItems: DashboardMenuItem[];
};

export function useDashboardGuards({
  pathname,
  search = '',
  role,
  layoutHold,
  sessionPending,
  sessionIsPlaceholder,
  sessionError,
  user,
  session,
  featureConfig,
  allMenuItems,
}: Params) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [onboardingGateReady, setOnboardingGateReady] = useState(false);

  useEffect(() => {
    if (!sessionError) return;
    router.replace('/');
  }, [sessionError, router]);

  useEffect(() => {
    if (layoutHold) return;
    if (role !== 'sales') return;
    if (!isModuleKeyEnabled(featureConfig, 'POS')) return;
    if (!pathname.startsWith('/dashboard')) return;
    router.replace('/pos');
  }, [role, featureConfig, pathname, router, layoutHold]);

  useEffect(() => {
    if (layoutHold) return;
    if (role !== 'field_worker') return;
    router.replace('/field');
  }, [role, layoutHold, router]);

  useEffect(() => {
    if (layoutHold || !user) return;
    setOnboardingGateReady(true);
  }, [layoutHold, user]);

  useEffect(() => {
    if (layoutHold) return;
    prefetchDashboardRoutes(router);
  }, [layoutHold, router]);

  useEffect(() => {
    if (layoutHold || !user || !onboardingGateReady || sessionIsPlaceholder) return;
    if (role !== 'owner') return;
    const fresh = queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY) ?? session;
    if (!fresh?.me) return;
    const progress = computeOnboardingProgress(
      { role: fresh.me.role, company: fresh.me.company },
      fresh.features ?? featureConfig,
    );
    if (!progress.isComplete) {
      router.replace(progress.requiredPath);
    }
  }, [
    layoutHold,
    user,
    role,
    featureConfig,
    router,
    onboardingGateReady,
    queryClient,
    session,
    sessionIsPlaceholder,
  ]);

  useEffect(() => {
    if (layoutHold || !featureConfig.hasFeatureConfig) return;
    if (!isPathModuleAccessAllowed(pathname, allMenuItems, featureConfig, search)) {
      router.replace('/dashboard');
    }
  }, [pathname, search, featureConfig, layoutHold, router, allMenuItems]);

  useEffect(() => {
    if (layoutHold || sessionPending) return;
    if (!isDashboardPathAllowedForRole(pathname, role, allMenuItems, search)) {
      router.replace('/dashboard');
    }
  }, [pathname, search, role, layoutHold, sessionPending, router, allMenuItems]);
}
