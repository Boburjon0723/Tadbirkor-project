'use client';

import { useSession } from '@/hooks/use-session';
import { isModuleKeyEnabled, areModuleKeysEnabled, type ModuleMatchMode } from '@/lib/feature-modules';

export function useModuleGate(
  moduleKey: string,
  options?: { moduleKeys?: string[]; match?: ModuleMatchMode },
) {
  const { data: session, isPending } = useSession();
  const cfg = session?.features;
  const keys = options?.moduleKeys?.length ? options.moduleKeys : [moduleKey];
  const match = options?.match ?? (keys.length > 1 ? 'all' : 'all');

  const enabled =
    keys.length === 1
      ? isModuleKeyEnabled(cfg, keys[0])
      : areModuleKeysEnabled(cfg, keys, match);

  return { enabled, loading: isPending, features: cfg };
}
