import type { QueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY, type SessionData } from '@/hooks/use-session';
import type { CompanyFeatureConfig } from '@/services/companies.service';

/** Modul yoqish/o‘chirishdan keyin sidebar va sahifalar darhol yangilanadi. */
export function patchSessionFeatures(
  queryClient: QueryClient,
  features: CompanyFeatureConfig,
) {
  const prev = queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY);
  if (prev) {
    queryClient.setQueryData<SessionData>(SESSION_QUERY_KEY, { ...prev, features });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
}

/** Onboarding yakunlangach dashboardga eski sessiya bilan qaytmaslik uchun */
export function patchSessionCompanyActive(queryClient: QueryClient) {
  const prev = queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY);
  if (!prev?.me?.company) return;
  queryClient.setQueryData<SessionData>(SESSION_QUERY_KEY, {
    ...prev,
    me: {
      ...prev.me,
      company: { ...prev.me.company, status: 'active' },
    },
  });
}
