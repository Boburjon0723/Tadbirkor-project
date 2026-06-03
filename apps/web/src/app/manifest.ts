import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const v =
    process.env.NEXT_PUBLIC_ASSET_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    '1';

  return {
    name: 'Axis ERP',
    short_name: 'AxisERP',
    description: "O'zbekiston tadbirkorlari uchun ERP platforma",
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      {
        src: `/favicon.png?v=${v}`,
        type: 'image/png',
        sizes: '512x512',
      },
    ],
  };
}

