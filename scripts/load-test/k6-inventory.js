import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.LOAD_TEST_BASE_URL || 'http://localhost:4002/api').replace(/\/+$/, '');
const TOKEN = __ENV.LOAD_TEST_TOKEN || '';
const WAREHOUSE = __ENV.LOAD_TEST_WAREHOUSE_ID || '';

export const options = {
  vus: Number(__ENV.LOAD_TEST_CONCURRENCY || 10),
  duration: `${Number(__ENV.LOAD_TEST_DURATION_SEC || 30)}s`,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
};

export default function () {
  const wh = WAREHOUSE ? `&warehouseId=${WAREHOUSE}` : '';
  const urls = [
    `${BASE}/products?view=catalog&page=1&limit=50${wh}`,
    `${BASE}/products/summary/stats${WAREHOUSE ? `?warehouseId=${WAREHOUSE}` : ''}`,
    `${BASE}/stock/balances${WAREHOUSE ? `?warehouseId=${WAREHOUSE}` : ''}`,
    `${BASE}/pick-tasks?limit=30`,
  ];
  const url = urls[Math.floor(Math.random() * urls.length)];
  const res = http.get(url, { headers });
  check(res, { 'status 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(0.2);
}
