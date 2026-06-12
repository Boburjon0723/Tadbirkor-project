import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { LanguageProvider } from '@/context/LanguageContext';
import { Providers } from '@/components/providers';
import { PWARegister } from '@/components/pwa-register';
import { SupportWidget } from '@/components/SupportWidget';
import { MetaPixel } from '@/components/MetaPixel';

const inter = Inter({ subsets: ["latin"] });

const assetVersion =
  process.env.NEXT_PUBLIC_ASSET_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  '1';

export const metadata: Metadata = {
  title: "Axis ERP - Biznesingizni Intellektual Boshqaring",
  description: "O'zbekiston tadbirkorlari uchun yangi avlod ERP tizimi. Ombor, moliya, B2B savdo va xodimlar hisobi bir joyda.",
  manifest: `/manifest.webmanifest?v=${assetVersion}`,
  icons: {
    icon: [
      { url: `/brand/axis-logo.png?v=${assetVersion}`, type: 'image/png', sizes: '512x512' },
      { url: `/favicon.ico?v=${assetVersion}`, sizes: 'any' },
    ],
    apple: [{ url: `/brand/axis-logo.png?v=${assetVersion}`, type: 'image/png', sizes: '180x180' }],
    shortcut: [{ url: `/brand/axis-logo.png?v=${assetVersion}` }],
  },
  appleWebApp: {
    capable: true,
    title: 'Axis ERP',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className="scroll-smooth">
      <body className={`${inter.className} bg-[#020202] text-white min-h-screen antialiased`}>
        <MetaPixel />
        <Providers>
          <LanguageProvider>
            <PWARegister />
            {children}
            <SupportWidget />
          </LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
