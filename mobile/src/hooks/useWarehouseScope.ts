import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

type WarehouseRow = { id: string; name: string };

export type WarehouseScopeState = {
  loading: boolean;
  role: string;
  warehouses: WarehouseRow[];
  /** Owner/Manager/Accountant — omborni tanlay oladi */
  canPickWarehouse: boolean;
  activeWarehouseId: string | null;
  activeWarehouseName: string;
  setSelectedWarehouseId: (id: string) => void;
};

export function useWarehouseScope(): WarehouseScopeState {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('SALES');
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [canPickWarehouse, setCanPickWarehouse] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [lockedWarehouseId, setLockedWarehouseId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        setLoading(true);
        try {
          const [meRes, whRes] = await Promise.all([
            api.get('/auth/me'),
            api.get('/warehouses'),
          ]);
          if (cancelled) return;

          const scope = meRes.data?.warehouseScope;
          const nextRole = String(meRes.data?.role || 'SALES').toUpperCase();
          const list: WarehouseRow[] = (Array.isArray(whRes.data) ? whRes.data : []).map(
            (w: any) => ({
              id: String(w.id),
              name: String(w.name || 'Ombor'),
            }),
          );

          setRole(nextRole);
          setWarehouses(list);

          const all = !!scope?.all;
          setCanPickWarehouse(all);

          if (all) {
            const defaultId = scope?.defaultWarehouseId || list[0]?.id || null;
            setLockedWarehouseId(null);
            setSelectedWarehouseId((prev) =>
              prev && list.some((w) => w.id === prev) ? prev : defaultId,
            );
          } else {
            const locked =
              scope?.defaultWarehouseId ||
              scope?.warehouseIds?.[0] ||
              list[0]?.id ||
              null;
            setLockedWarehouseId(locked);
            setSelectedWarehouseId(null);
          }
        } catch {
          if (!cancelled) {
            setWarehouses([]);
            setCanPickWarehouse(false);
            setLockedWarehouseId(null);
            setSelectedWarehouseId(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const activeWarehouseId = canPickWarehouse ? selectedWarehouseId : lockedWarehouseId;

  const activeWarehouseName = useMemo(() => {
    if (!activeWarehouseId) return '';
    return warehouses.find((w) => w.id === activeWarehouseId)?.name || 'Ombor';
  }, [activeWarehouseId, warehouses]);

  return {
    loading,
    role,
    warehouses,
    canPickWarehouse,
    activeWarehouseId,
    activeWarehouseName,
    setSelectedWarehouseId,
  };
}
