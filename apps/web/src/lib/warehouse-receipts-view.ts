import { isWarehouseRole } from '@/lib/warehouse-role';

/** Omborchi: kelgan yuklarda mahsulot/miqdor/narx, moliyaviy jami summalar emas */
export function isWarehouseReceiptsOpsRole(role: string | undefined): boolean {
  return isWarehouseRole(role);
}
