#!/usr/bin/env node
/**
 * Axis ERP — oddiy load test (Node 18+).
 *
 * Muhit:
 *   LOAD_TEST_BASE_URL=http://localhost:4002/api
 *   LOAD_TEST_TOKEN=<JWT>
 *   LOAD_TEST_WAREHOUSE_ID=<uuid>   (ixtiyoriy)
 *   LOAD_TEST_CONCURRENCY=10
 *   LOAD_TEST_DURATION_SEC=30
 *
 * Ishga tushirish:
 *   node scripts/load-test/load-test.mjs
 */

const BASE = (process.env.LOAD_TEST_BASE_URL || 'http://localhost:4002/api').replace(/\/+$/, '');
const TOKEN = String(process.env.LOAD_TEST_TOKEN || '').trim();
const WAREHOUSE_ID = String(process.env.LOAD_TEST_WAREHOUSE_ID || '').trim();
const CONCURRENCY = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 10));
const DURATION_SEC = Math.max(5, Number(process.env.LOAD_TEST_DURATION_SEC || 30));

if (!TOKEN) {
  console.error('LOAD_TEST_TOKEN majburiy. Login qilib JWT oling.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
};

const scenarios = [
  {
    name: 'GET /products (catalog, page 1)',
    run: () =>
      fetch(`${BASE}/products?view=catalog&page=1&limit=50${WAREHOUSE_ID ? `&warehouseId=${WAREHOUSE_ID}` : ''}`, {
        headers,
      }),
  },
  {
    name: 'GET /products/summary/stats',
    run: () =>
      fetch(`${BASE}/products/summary/stats${WAREHOUSE_ID ? `?warehouseId=${WAREHOUSE_ID}` : ''}`, {
        headers,
      }),
  },
  {
    name: 'GET /stock/balances',
    run: () =>
      fetch(`${BASE}/stock/balances${WAREHOUSE_ID ? `?warehouseId=${WAREHOUSE_ID}` : ''}`, {
        headers,
      }),
  },
  {
    name: 'GET /pick-tasks',
    run: () => fetch(`${BASE}/pick-tasks?limit=30`, { headers }),
  },
];

const stats = scenarios.map((s) => ({
  name: s.name,
  ok: 0,
  fail: 0,
  latencies: [],
}));

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function worker(until) {
  while (Date.now() < until) {
    const idx = Math.floor(Math.random() * scenarios.length);
    const scenario = scenarios[idx];
    const stat = stats[idx];
    const start = performance.now();
    try {
      const res = await scenario.run();
      const ms = performance.now() - start;
      stat.latencies.push(ms);
      if (res.ok) stat.ok += 1;
      else stat.fail += 1;
    } catch {
      stat.fail += 1;
    }
  }
}

console.log(`Base: ${BASE}`);
console.log(`Concurrency: ${CONCURRENCY}, duration: ${DURATION_SEC}s`);
console.log('---');

const until = Date.now() + DURATION_SEC * 1000;
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(until)));

for (const s of stats) {
  const total = s.ok + s.fail;
  const avg = s.latencies.length
    ? (s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length).toFixed(0)
    : '—';
  console.log(
    `${s.name}\n  requests: ${total} | ok: ${s.ok} | fail: ${s.fail} | avg: ${avg}ms | p95: ${percentile(s.latencies, 95).toFixed(0)}ms`,
  );
}

const totalFail = stats.reduce((n, s) => n + s.fail, 0);
process.exit(totalFail > 0 ? 1 : 0);
