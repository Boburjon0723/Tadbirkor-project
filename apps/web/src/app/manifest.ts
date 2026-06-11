import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const v =
    process.env.NEXT_PUBLIC_ASSET_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    '1';

  const iconBase = `/brand/axis-logo.png?v=${v}`;

  return {
    name: 'Axis ERP',
    short_name: 'Axis ERP',
    description: "O'zbekiston tadbirkorlari uchun ERP platforma",
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      {
        src: iconBase,
        type: 'image/png',
        sizes: '192x192',
        purpose: 'any',
      },
      {
        src: iconBase,
        type: 'image/png',
        sizes: '512x512',
        purpose: 'any',
      },
      {
        src: iconBase,
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Ombor kirimi',
        short_name: 'Kirim',
        url: '/dashboard/warehouse-intake',
        icons: [{ src: iconBase, sizes: '192x192' }],
      },
      {
        name: 'Mahsulotlar',
        short_name: 'Ombor',
        url: '/dashboard/inventory',
        icons: [{ src: iconBase, sizes: '192x192' }],
      },
    ],
  };
}
