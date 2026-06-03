/**
 * Oddiy mantiq tekshiruvi: npm run build dan oldin yoki keyin
 * npx ts-node src/modules/warehouses/warehouse-catalog.util.spec.ts
 */
import {
  importVariantCatalogFilter,
  productsTiedToWarehouseFilter,
} from './warehouse-catalog.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const companyId = 'c1';
const warehouseId = 'w1';

const importFilter = importVariantCatalogFilter(companyId, warehouseId);
assert(importFilter.companyId === companyId, 'companyId');
assert(importFilter.status === 'ACTIVE', 'variant active');
const productOr = (importFilter.product as any)?.OR;
assert(Array.isArray(productOr) && productOr.length === 2, 'import scope OR');

const purgeFilter = productsTiedToWarehouseFilter(companyId, warehouseId);
assert((purgeFilter.OR as any[])?.length === 2, 'purge tied OR');

console.log('warehouse-catalog.util.spec.ts: OK');
