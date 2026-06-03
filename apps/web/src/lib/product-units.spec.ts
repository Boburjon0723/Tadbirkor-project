/**
 * npx ts-node src/lib/product-units.spec.ts
 */
import {
  commitStockFieldValue,
  parseStockFieldValue,
  sanitizeStockDraftInput,
} from './product-units';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  assert(sanitizeStockDraftInput('12.', 'kg') === '12.', 'kg allows trailing dot');
  assert(sanitizeStockDraftInput('12,5', 'l') === '12.5', 'comma to dot');
  assert(sanitizeStockDraftInput('12.5', 'dona') === null, 'dona rejects decimal');
  assert(sanitizeStockDraftInput('100', 'dona') === '100', 'dona integer');

  assert(parseStockFieldValue('12.', 'kg') === 12, 'parse partial decimal on submit');
  assert(parseStockFieldValue('', 'kg') === 0, 'empty is zero on save');
  assert(commitStockFieldValue('10.77777', 'kg') === 10.7778, 'round to 4 decimals');
  assert(commitStockFieldValue('10.6', 'dona') === 11, 'dona rounds on blur');

  console.log('product-units.spec.ts: OK');
}

main();
