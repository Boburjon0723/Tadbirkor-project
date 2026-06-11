import {
  FileText,
  LayoutGrid,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import type { ReactNode } from 'react';

export const ONBOARDING_MODULE_LABELS: Record<
  string,
  { title: string; desc: string; icon: ReactNode }
> = {
  WAREHOUSE: {
    title: 'Ombor',
    desc: 'Kirim, chiqim, qoldiq va qabul qilish.',
    icon: <Warehouse />,
  },
  B2B: {
    title: 'B2B buyurtmalar',
    desc: 'Hamkorlar bilan buyurtma almashish.',
    icon: <ShoppingCart />,
  },
  GOODS_RECEIPTS: {
    title: 'Kelgan yuklar',
    desc: 'Hamkordan kelgan yuklarni qabul qilish.',
    icon: <Package />,
  },
  PARTNERS: {
    title: 'Hamkorlar',
    desc: 'Kompaniyalar bilan hamkorlikni boshqarish.',
    icon: <Users />,
  },
  PRODUCT_MAPPING: {
    title: 'Mahsulot mapping',
    desc: 'Hamkor mahsulotlarini moslashtirish.',
    icon: <FileText />,
  },
  DEBT: {
    title: 'Qarz daftari',
    desc: 'Debitorlik va kreditorlikni nazorat qilish.',
    icon: <Wallet />,
  },
  POS: {
    title: 'POS / Kassa',
    desc: 'Chakana sotuv interfeysi.',
    icon: <LayoutGrid />,
  },
  EMPLOYEES: {
    title: 'Xodimlar',
    desc: 'Jamoa va rollar boshqaruvi.',
    icon: <Users />,
  },
};

export type OnboardingModuleCard = {
  id: string;
  title: string;
  desc: string;
  icon: ReactNode;
};

export function moduleKeysToDisplay(keys: string[]): OnboardingModuleCard[] {
  const base: OnboardingModuleCard[] = [
    {
      id: 'products',
      title: 'Mahsulotlar',
      desc: 'Mahsulot va variantlarni boshqarish.',
      icon: <Package />,
    },
  ];
  const seen = new Set<string>();
  for (const key of keys) {
    const u = key.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    const meta = ONBOARDING_MODULE_LABELS[u];
    if (meta) {
      base.push({ id: u.toLowerCase(), ...meta });
    }
  }
  return base;
}
