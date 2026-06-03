'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string>('OWNER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authService.getMe();
        if (cancelled) return;
        setPermissions(me.permissions || []);
        setRole((me.role || 'OWNER').toUpperCase());
      } catch {
        if (!cancelled) {
          setPermissions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const can = (permission: string) => {
    if (role === 'OWNER') return true;
    return permissions.includes(permission);
  };

  const canManageUsers = () => can('users.manage');

  return { permissions, role, loading, can, canManageUsers };
}
