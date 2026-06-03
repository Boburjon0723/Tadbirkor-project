/**
 * npx ts-node src/modules/product-mappings/product-mapping-inbound.spec.ts
 */
import { isUuidLike, looksLikeProductCode } from '../../common/product-code.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** resolveMappingFromList ichidagi codeMatches bilan bir xil */
function mappingMatchesBusinessCode(
  m: { partnerSku?: string | null; partnerBarcode?: string | null },
  code: string,
): boolean {
  const low = code.toLowerCase();
  if (m.partnerBarcode?.trim().toLowerCase() === low) return true;
  const ps = m.partnerSku?.trim();
  if (ps && ps.toLowerCase() === low && !isUuidLike(ps)) return true;
  return false;
}

function main() {
  const sellerVariantUuid = '550e8400-e29b-41d4-a716-446655440000';

  assert(isUuidLike(sellerVariantUuid), 'fixture uuid');
  assert(looksLikeProductCode('A-001'), 'business sku shape');
  assert(!looksLikeProductCode(sellerVariantUuid), 'uuid is not business sku');

  assert(
    !mappingMatchesBusinessCode({ partnerSku: sellerVariantUuid }, 'A-001'),
    'partnerSku UUID must not match inbound SKU code A-001',
  );

  assert(
    mappingMatchesBusinessCode({ partnerSku: 'A-001' }, 'A-001'),
    'business partnerSku matches same code',
  );

  assert(
    mappingMatchesBusinessCode({ partnerBarcode: 'BX-109' }, 'BX-109'),
    'barcode match',
  );

  assert(
    !mappingMatchesBusinessCode({ partnerSku: 'A-002' }, 'A-001'),
    'different business sku',
  );

  console.log('product-mapping-inbound.spec.ts: OK');
}

main();
