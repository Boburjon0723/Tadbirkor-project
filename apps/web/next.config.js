/** @type {import('next').NextConfig} */
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8) ||
  'dev';

const DEFAULT_BACKEND = 'https://tadbirkor-backend-production.up.railway.app';
const apiProxyTarget = String(process.env.API_PROXY_TARGET || DEFAULT_BACKEND)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api\/?$/, '');

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_ASSET_VERSION: buildId,
  },
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // HTML (fayl kengaytmasi yo'q marshrutlar) — eski deploy qolmasin
        source: '/:path((?!_next|api|.*\\..*).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/favicon.png',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/apple-touch-icon.png',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/brand/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
