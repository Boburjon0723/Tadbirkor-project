import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { companiesService, CompanyFeatureConfig } from '@/services/companies.service';

export type SessionRole =
  | 'owner'
  | 'manager'
  | 'accountant'
  | 'warehouse'
  | 'sales'
  | 'field_worker'
  | 'worker';

export type SessionData = {
  me: Awaited<ReturnType<typeof authService.getMe>>;
  features: CompanyFeatureConfig;
  role: SessionRole;
};

async function fetchSession(): Promise<SessionData> {
  const [me, features] = await Promise.all([
    authService.getMe(),
    companiesService.getFeatures(),
  ]);
  const role = (me.user?.role || me.role || 'owner').toLowerCase() as SessionRole;
  return { me, features, role };
}

export const SESSION_QUERY_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: (query) => {
      if (!query.state.data) return true;
      return query.isStale();
    },
  });
}
