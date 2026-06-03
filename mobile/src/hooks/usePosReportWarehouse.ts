import { useWarehouseScope, type WarehouseScopeState } from './useWarehouseScope';

export type PosReportWarehouseState = WarehouseScopeState & {
  reportWarehouseId: string | null;
  reportWarehouseName: string;
};

/** @deprecated nomi — `useWarehouseScope` ishlating */
export function usePosReportWarehouse(): PosReportWarehouseState {
  const scope = useWarehouseScope();
  return {
    ...scope,
    reportWarehouseId: scope.activeWarehouseId,
    reportWarehouseName: scope.activeWarehouseName,
  };
}
