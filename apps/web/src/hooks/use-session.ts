import { QueryClient, useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { companiesService, CompanyFeatureConfig } from '@/services/companies.service';
import { getAuthToken } from '@/lib/auth-token';

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

export async function fetchSession(): Promise<SessionData> {
  const [me, features] = await Promise.all([
    authService.getMe(),
    companiesService.getFeatures(),
  ]);
  const role = (me.user?.role || me.role || 'owner').toLowerCase() as SessionRole;
  return { me, features, role };
}

export const SESSION_QUERY_KEY = ['session'] as const;

/** localStorage dan tez ko‘rsatish — to‘liq ekran «Yuklanmoqda» ni qisqartiradi */
export function readSessionPlaceholder(): SessionData | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return undefined;

    const userStub = JSON.parse(userRaw) as {
      id?: string;
      fullName?: string;
      login?: string;
      role?: string;
    };
    const companyRaw = localStorage.getItem('company');
    const companyStub = companyRaw ? JSON.parse(companyRaw) : null;
    const role = String(userStub.role || 'owner').toLowerCase() as SessionRole;

    const me = {
      user: userStub,
      role: userStub.role,
      company: companyStub,
      permissions: [] as string[],
      isPlatformAdmin: false,
    } as SessionData['me'];

    return {
      me,
      features: {
        hasFeatureConfig: false,
        enabledFeatures: [],
        enabledModules: [],
      },
      role,
    };
  } catch {
    return undefined;
  }
}

function hasLikelyAuthSession(): boolean {
  if (typeof window === 'undefined') return false;
  if (getAuthToken()) return true;
  try {
    return !!localStorage.getItem('user');
  } catch {
    return false;
  }
}

export function prefetchSession(queryClient: QueryClient) {
  if (!hasLikelyAuthSession()) {
    return Promise.resolve(undefined as SessionData | undefined);
  }
  return queryClient.fetchQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    enabled: hasLikelyAuthSession(),
    placeholderData: readSessionPlaceholder,
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
