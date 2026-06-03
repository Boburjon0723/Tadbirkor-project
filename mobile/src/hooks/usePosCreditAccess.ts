import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

export type PosCreditAccess = {
  loading: boolean;
  /** Sozlamalar → Kompaniya: POS nasiya yoqilgan */
  companyEnabled: boolean;
  /** Jamoa → rol: pos.credit ruxsati */
  canUseCredit: boolean;
  /** Kassada nasiya ko‘rsatish mumkin (ikkalasi ham true) */
  enabled: boolean;
};

const defaultState: PosCreditAccess = {
  loading: true,
  companyEnabled: false,
  canUseCredit: false,
  enabled: false,
};

/** Web `usePosCreditEnabled` + `can('pos.credit')` bilan bir xil mantiq. */
export function usePosCreditAccess(): PosCreditAccess {
  const [state, setState] = useState<PosCreditAccess>(defaultState);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setState((prev) => ({ ...prev, loading: true }));
        try {
          const { data } = await api.get('/auth/me');
          if (cancelled) return;

          const companyEnabled = !!data?.company?.posCreditEnabled;
          const permissions: string[] = Array.isArray(data?.permissions)
            ? data.permissions
            : [];
          const canUseCredit = permissions.includes('pos.credit');

          setState({
            loading: false,
            companyEnabled,
            canUseCredit,
            enabled: companyEnabled && canUseCredit,
          });
        } catch {
          if (!cancelled) {
            setState({
              loading: false,
              companyEnabled: false,
              canUseCredit: false,
              enabled: false,
            });
          }
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return state;
}
