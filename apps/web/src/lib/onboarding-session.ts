import type { QueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '@/hooks/use-session';

/** Onboarding API dan keyin sessiyani darhol yangilash */
export async function refreshOnboardingSession(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  await queryClient.refetchQueries({ queryKey: SESSION_QUERY_KEY });
}
